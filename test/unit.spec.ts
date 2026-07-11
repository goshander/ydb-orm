import { generateKeyPairSync } from 'node:crypto'
import { create } from '@bufbuild/protobuf'
import { anyPack } from '@bufbuild/protobuf/wkt'
import { SelfCheck_Result, SelfCheckResultSchema } from '@ydbjs/api/monitoring'
import {
  AlterTableResponseSchema,
  CreateTableResponseSchema,
} from '@ydbjs/api/table'
import { api } from '../lib/api.js'
import { Ydb } from '../lib/db.js'
import { toYdbError } from '../lib/error.js'
import { IamCredentialsProvider } from '../lib/iam.js'
import { YdbModel } from '../lib/model.js'
import {
  assertIdentifier,
  assertLimit,
  assertOffset,
  assertPage,
  exportAttributes,
  exportOrder,
  exportWhere,
} from '../lib/query.js'
import { sync } from '../lib/sync.js'
import { YdbDataType } from '../lib/type.js'
import { where } from '../lib/where.js'
import { type TestOptions, test } from '../test.js'

const options = {
  models: {},
  sync: false,
} satisfies TestOptions

const expectThrow = (callback: () => unknown) => {
  try {
    callback()
    throw new Error('expected callback to throw')
  } catch (error) {
    return error as Error
  }
}

test('unit - toYdbError extracts nested issue messages', options, (t) => {
  t.expect(
    toYdbError({
      issues: [{ message: 'nested' }],
    }).message,
  ).toBe('nested')
  t.expect(
    toYdbError({
      issues: [{ message: 'nested', issues: [{ message: 'super-nested' }] }],
    }).message,
  ).toBe('super-nested')
  t.expect(
    toYdbError({
      issues: [
        {
          message: 'nested',
          issues: [
            {
              message: 'super-nested',
              issues: [{ message: 'deep-message' }],
            },
          ],
        },
      ],
    }).message,
  ).toBe('deep-message')

  const error = new Error('plain')
  t.expect(toYdbError(error)).toBe(error)
})

test('unit - query helpers validate and export SQL fragments', options, (t) => {
  const schema = {
    id: YdbDataType.ascii,
    name: YdbDataType.ascii,
    score: YdbDataType.int32,
  }

  t.expect(exportAttributes(schema)).toBe('*')
  t.expect(exportAttributes(schema, [])).toBe('*')
  t.expect(exportAttributes(schema, { exclude: ['score'] })).toBe('id, name')
  t.expect(
    exportAttributes(schema, { exclude: ['score'], include: ['score'] }),
  ).toBe('id, name, score')
  t.expect(exportOrder(schema)).toBe('')
  t.expect(exportOrder(schema, ['name', 'ASC'])).toBe('ORDER BY name ASC')
  t.expect(
    exportOrder(schema, [
      ['name', 'ASC'],
      ['id', 'DESC'],
    ]),
  ).toBe('ORDER BY name ASC, id DESC')

  assertIdentifier('valid_name')
  assertLimit(1)
  assertOffset(0)
  assertPage(1)

  t.expect(expectThrow(() => assertIdentifier('bad-name')).message).toContain(
    'invalid identifier',
  )
  t.expect(expectThrow(() => assertLimit(0)).message).toContain('invalid limit')
  t.expect(expectThrow(() => assertOffset(-1)).message).toContain(
    'invalid offset',
  )
  t.expect(expectThrow(() => assertPage(0)).message).toContain('invalid page')
})

test(
  'unit - model getters resolve defaults and schema options',
  options,
  async (t) => {
    class DefaultGetterModel extends YdbModel<{ id: string }> {
      static override schema = {
        id: YdbDataType.ascii,
      }
    }

    class OptionGetterModel extends YdbModel<{ uuid: string }> {
      static override schema = {
        field: {
          uuid: YdbDataType.ascii,
        },
        option: {
          tableName: 'custom_model_table',
          primaryKey: 'uuid',
        },
      }
    }

    const statements: string[] = []
    const ctx = {
      sql: async (sql: string) => {
        statements.push(sql)
        return []
      },
    } as never

    DefaultGetterModel.setCtx(ctx)
    OptionGetterModel.setCtx(ctx)

    t.expect(DefaultGetterModel.ctx).toBe(ctx)
    t.expect(DefaultGetterModel.className).toBe('DefaultGetterModel')
    t.expect(DefaultGetterModel.fields).toEqual({ id: YdbDataType.ascii })
    t.expect(DefaultGetterModel.primaryKey).toBe('id')
    t.expect(DefaultGetterModel.tableName).toBe('default_getter_model')

    t.expect(OptionGetterModel.fields).toEqual({ uuid: YdbDataType.ascii })
    t.expect(OptionGetterModel.primaryKey).toBe('uuid')
    t.expect(OptionGetterModel.tableName).toBe('custom_model_table')

    t.expect(await OptionGetterModel.findAll()).toEqual([])
    t.expect(statements.at(-1)).toBe('SELECT * FROM custom_model_table;')
  },
)

test(
  'unit - exportWhere supports empty, null and skipped branches',
  options,
  (t) => {
    const schema = {
      id: YdbDataType.ascii,
      name: YdbDataType.ascii,
    }

    t.expect(exportWhere(schema, {}).clause).toBe('')
    t.expect(exportWhere(schema, { name: undefined }).clause).toBe('')
    t.expect(exportWhere(schema, { name: { is: null } }).clause).toBe(
      'WHERE name IS NULL',
    )
    t.expect(exportWhere(schema, { name: { not: null } }).clause).toBe(
      'WHERE name IS NOT NULL',
    )
    t.expect(exportWhere(schema, { and: [] }).clause).toBe('')
    t.expect(exportWhere(schema, { or: { name: 'one' } }).clause).toBe(
      'WHERE (name = $where_name_0)',
    )
    t.expect(where(schema, { name: 'one' }).clause).toBe(
      'WHERE name = $where_name_0',
    )
  },
)

test(
  'unit - api wraps table service errors and empty responses',
  options,
  async (t) => {
    const createTable = async () => ({
      operation: {
        issues: [{ message: 'create failed' }],
      },
    })
    const alterTable = async () => ({
      operation: {},
    })
    const describeTable = async () => ({
      operation: {
        issues: [{ message: 'describe failed' }],
      },
    })
    const driver = {
      database: '/local',
      createClient: () => ({
        createTable,
        alterTable,
        describeTable,
      }),
    }

    const tableApi = api(driver as never)

    try {
      await tableApi.createTable({} as never)
      throw new Error('expected createTable to reject')
    } catch (error) {
      t.expect((error as Error).message).toBe('create failed')
    }

    t.expect(await tableApi.alterTable({} as never)).toBeUndefined()

    try {
      await tableApi.describeTable('missing')
      throw new Error('expected describeTable to reject')
    } catch (error) {
      t.expect((error as Error).message).toBe('describe failed')
    }
  },
)

test(
  'unit - api handles create empty result and alter issues',
  options,
  async (t) => {
    const driver = {
      database: '/local',
      createClient: () => ({
        createTable: async () => ({
          operation: {},
        }),
        alterTable: async () => ({
          operation: {
            issues: [{ message: 'alter failed' }],
          },
        }),
        describeTable: async () => ({
          operation: {
            result: {},
          },
        }),
      }),
    }
    const tableApi = api(driver as never)

    t.expect(await tableApi.createTable({} as never)).toBeUndefined()

    try {
      await tableApi.alterTable({} as never)
      throw new Error('expected alterTable to reject')
    } catch (error) {
      t.expect((error as Error).message).toBe('alter failed')
    }
  },
)

test('unit - api unpacks successful operation results', options, async (t) => {
  const createResponse = create(CreateTableResponseSchema)
  const alterResponse = create(AlterTableResponseSchema)
  const driver = {
    database: '/local',
    createClient: () => ({
      createTable: async () => ({
        operation: {
          result: anyPack(CreateTableResponseSchema, createResponse),
        },
      }),
      alterTable: async () => ({
        operation: {
          result: anyPack(AlterTableResponseSchema, alterResponse),
        },
      }),
      describeTable: async () => ({
        operation: {},
      }),
    }),
  }
  const tableApi = api(driver as never)

  t.expect(await tableApi.createTable({} as never)).toBeTruthy()
  t.expect(await tableApi.alterTable({} as never)).toBeTruthy()

  try {
    await tableApi.describeTable('missing')
    throw new Error('expected describeTable to reject')
  } catch (error) {
    t.expect((error as Error).message).toBe('ydb: table not found in database')
  }
})

test('unit - api returns monitoring self check results', options, async (t) => {
  const health = create(SelfCheckResultSchema, {
    selfCheckResult: SelfCheck_Result.GOOD,
  })
  let clientNumber = 0
  const driver = {
    createClient: () => {
      clientNumber += 1
      if (clientNumber === 1) return {}
      return {
        selfCheck: async () => ({
          operation: {
            result: anyPack(SelfCheckResultSchema, health),
          },
        }),
      }
    },
  }

  t.expect((await api(driver as never).selfCheck()).selfCheckResult).toBe(
    SelfCheck_Result.GOOD,
  )
})

test(
  'unit - api validates monitoring self check responses',
  options,
  async (t) => {
    const responses = [
      { operation: { issues: [{ message: 'health failed' }] } },
      { operation: {} },
      {
        operation: {
          result: anyPack(
            CreateTableResponseSchema,
            create(CreateTableResponseSchema),
          ),
        },
      },
      { operation: { result: {} } },
    ]
    const driver = {
      createClient: () => ({
        selfCheck: async () => responses.shift(),
      }),
    }
    const monitoringApi = api(driver as never)

    await t.expect(monitoringApi.selfCheck()).rejects.toThrow('health failed')
    await t
      .expect(monitoringApi.selfCheck())
      .rejects.toThrow('ydb: self check returned no result')
    await t
      .expect(monitoringApi.selfCheck())
      .rejects.toThrow('ydb: invalid self check result')
    await t
      .expect(monitoringApi.selfCheck())
      .rejects.toThrow('ydb: invalid self check result')
  },
)

test('unit - IAM provider fetches and caches tokens', options, async (t) => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
  })
  const provider = new IamCredentialsProvider({
    serviceAccountId: 'service',
    accessKeyId: 'key',
    privateKey: Buffer.from(privateKey),
    iamEndpoint: 'iam.test',
  })
  const originalFetch = globalThis.fetch
  let fetchCount = 0

  globalThis.fetch = (async () => {
    fetchCount += 1
    return new Response(JSON.stringify({ iamToken: `token-${fetchCount}` }))
  }) as unknown as typeof fetch

  try {
    t.expect(await provider.getToken()).toBe('token-1')
    t.expect(await provider.getToken()).toBe('token-1')
    t.expect(await provider.getToken(true)).toBe('token-2')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test(
  'unit - IAM provider reports token response errors',
  options,
  async (t) => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
    })
    const provider = new IamCredentialsProvider({
      serviceAccountId: 'service',
      accessKeyId: 'key',
      privateKey: Buffer.from(privateKey),
    })
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async () =>
      new Response('', {
        status: 500,
        statusText: 'Broken',
      })) as unknown as typeof fetch

    try {
      await provider.getToken(true)
      throw new Error('expected getToken to reject')
    } catch (error) {
      t.expect((error as Error).message).toContain('failed to fetch token')
    } finally {
      globalThis.fetch = originalFetch
    }
  },
)

test(
  'unit - IAM provider rejects responses without token',
  options,
  async (t) => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
    })
    const provider = new IamCredentialsProvider({
      serviceAccountId: 'service',
      accessKeyId: 'key',
      privateKey: Buffer.from(privateKey),
    })
    const originalFetch = globalThis.fetch

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({}))) as unknown as typeof fetch

    try {
      await provider.getToken(true)
      throw new Error('expected getToken to reject')
    } catch (error) {
      t.expect((error as Error).message).toContain('no access token')
    } finally {
      globalThis.fetch = originalFetch
    }
  },
)

test('unit - sync logs create table errors', options, async (t) => {
  // biome-ignore lint/complexity/noStaticOnlyClass: sync expects model constructors
  class BrokenCreateModel {
    static tableName = 'broken_create'
    static primaryKey = 'id'
    static schema = {
      id: YdbDataType.ascii,
      skipped: {
        type: YdbDataType.ascii,
        drop: true,
      },
    }
  }
  const messages: string[] = []
  const ctx = {
    model: { BrokenCreateModel },
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: (_data: unknown, message: string) => messages.push(message),
    },
    api: () => ({
      describeTable: async () => ({ columns: [], indexes: [] }),
    }),
    sql: async (sql: string) => {
      if (sql.startsWith('SELECT')) throw new Error('missing')
      throw new Error('create failed')
    },
  }

  try {
    await sync(ctx as never)
    throw new Error('expected sync to reject')
  } catch (error) {
    t.expect((error as Error).message).toBe('create failed')
  }
  t.expect(messages).toContain('ydb: error creating table')
})

test('unit - sync logs create index errors', options, async (t) => {
  // biome-ignore lint/complexity/noStaticOnlyClass: sync expects model constructors
  class IndexedCreateModel {
    static tableName = 'indexed_create'
    static primaryKey = 'id'
    static schema = {
      id: YdbDataType.ascii,
      email: {
        type: YdbDataType.ascii,
        index: true,
      },
    }
  }
  const messages: string[] = []
  const ctx = {
    model: { IndexedCreateModel },
    logger: {
      info: (_data: unknown, message: string) => messages.push(message),
      warn: () => undefined,
      error: (_data: unknown, message: string) => messages.push(message),
    },
    api: () => ({
      describeTable: async () => ({ columns: [], indexes: [] }),
    }),
    sql: async (sql: string) => {
      if (sql.startsWith('SELECT')) throw new Error('missing')
      if (sql.includes('ADD INDEX')) throw new Error('index failed')
      return []
    },
  }

  await sync(ctx as never)

  t.expect(messages).toContain('ydb: error creating index')
})

test('unit - sync logs alter table errors', options, async (t) => {
  // biome-ignore lint/complexity/noStaticOnlyClass: sync expects model constructors
  class AlterModel {
    static tableName = 'alter_model'
    static primaryKey = 'id'
    static schema = {
      field: {
        id: YdbDataType.ascii,
        addFail: YdbDataType.ascii,
        addIndexFail: {
          type: YdbDataType.ascii,
          index: true,
        },
        dropIndexed: {
          type: YdbDataType.ascii,
          drop: true,
        },
        keepIndexed: YdbDataType.ascii,
        needsIndex: {
          type: YdbDataType.ascii,
          index: true,
        },
        existingNeedsIndex: {
          type: YdbDataType.ascii,
          index: true,
        },
        badType: 'BadType',
        renamed: {
          type: YdbDataType.ascii,
          renamed: 'oldName',
        },
      },
      option: {
        strict: true,
      },
    }

    static copy = async () => {
      throw new Error('copy failed')
    }
  }
  const messages: string[] = []
  const sqlStatements: string[] = []
  const ctx = {
    model: { AlterModel },
    logger: {
      info: (_data: unknown, message: string) => messages.push(message),
      warn: (_data: unknown, message: string) => messages.push(message),
      error: (_data: unknown, message: string) => messages.push(message),
    },
    api: () => ({
      describeTable: async () => ({
        columns: [
          { name: 'id', type: { type: { case: 'typeId', value: 4608 } } },
          {
            name: 'dropIndexed',
            type: { type: { case: 'typeId', value: 4608 } },
          },
          {
            name: 'keepIndexed',
            type: { type: { case: 'typeId', value: 1 } },
          },
          {
            name: 'strictExtra',
            type: { type: { case: 'typeId', value: 4608 } },
          },
          {
            name: 'optionalColumn',
            type: {
              type: {
                case: 'optionalType',
                value: { item: { type: { value: 4608 } } },
              },
            },
          },
          {
            name: 'existingNeedsIndex',
            type: { type: { case: 'typeId', value: 4608 } },
          },
        ],
        indexes: [
          { name: 'idx_drop', indexColumns: ['dropIndexed'] },
          { name: 'idx_keep', indexColumns: ['keepIndexed'] },
        ],
      }),
    }),
    sql: async (sql: string) => {
      sqlStatements.push(sql)
      if (sql.includes('ADD COLUMN addFail')) throw new Error('add failed')
      if (sql.includes('ADD INDEX index_alter_model_addIndexFail')) {
        throw new Error('add index failed')
      }
      if (sql.includes('DROP INDEX idx_drop')) {
        throw new Error('drop index failed')
      }
      if (sql.includes('DROP COLUMN dropIndexed')) {
        throw new Error('drop column failed')
      }
      if (sql.includes('ADD INDEX index_alter_model_needsIndex')) {
        throw new Error('needs index failed')
      }
      if (sql.includes('ADD INDEX index_alter_model_existingNeedsIndex')) {
        throw new Error('existing needs index failed')
      }
      if (sql.includes('DROP INDEX idx_keep')) {
        throw new Error('drop keep index failed')
      }
      if (sql.includes('DROP COLUMN strictExtra')) {
        throw new Error('strict drop failed')
      }
      if (sql.includes('ADD COLUMN renamed'))
        throw new Error('rename add failed')
      return []
    },
  }

  await sync(ctx as never)

  t.expect(sqlStatements.some((sql) => sql.includes('SELECT 1 AS check'))).toBe(
    true,
  )
  t.expect(messages).toContain('ydb: error adding column')
  t.expect(messages).toContain('ydb: error adding index')
  t.expect(messages).toContain('ydb: error dropping index')
  t.expect(messages).toContain('ydb: error dropping column')
  t.expect(messages).toContain(
    'ydb: type change detected, manual migration may be needed',
  )
  t.expect(messages).toContain('ydb: unknown field type')
  t.expect(messages).toContain('ydb: error renaming field')
})

test('unit - model drop and db getters', options, async (t) => {
  const db = Ydb.init({
    models: {},
    timeout: 1234,
  })
  t.expect(Ydb.db).toBe(db)
  t.expect((db as unknown as { timeout: number }).timeout).toBe(1234)
  await db.connect()

  class DropModel extends YdbModel {
    static tableName = 'drop_model'
    static schema = {
      id: YdbDataType.ascii,
    }
  }
  const sqlStatements: string[] = []
  DropModel.setCtx({
    sql: async (sql: string) => {
      sqlStatements.push(sql)
      return []
    },
  } as never)

  await DropModel.drop()

  t.expect(sqlStatements).toEqual(['DROP TABLE drop_model;'])
  await db.close()
})

test(
  'unit - db wait retries until health check is good',
  options,
  async (t) => {
    const db = Ydb.init({ models: {} })
    let attempts = 0

    ;(db as unknown as { _createDriver: () => unknown })._createDriver =
      () => ({
        database: '/local',
        ready: async () => {},
        close: () => {},
        createClient: () => ({
          selfCheck: async () => ({
            operation: {
              result: anyPack(
                SelfCheckResultSchema,
                create(SelfCheckResultSchema, {
                  selfCheckResult:
                    attempts++ === 0
                      ? SelfCheck_Result.EMERGENCY
                      : SelfCheck_Result.GOOD,
                  databaseStatus: [
                    {
                      name: '/local',
                      storage: {
                        pools: [{ id: 'test-pool', groups: [{}] }],
                      },
                    },
                  ],
                }),
              ),
            },
          }),
        }),
      })

    await db.wait(1000)

    t.expect(attempts).toBe(2)
    await db.close()
  },
)

test(
  'unit - db wait retries failed health check requests',
  options,
  async (t) => {
    const db = Ydb.init({ models: {} })
    let attempts = 0
    ;(db as unknown as { _createDriver: () => unknown })._createDriver =
      () => ({
        database: '/local',
        ready: async () => {
          attempts += 1
          if (attempts === 1) throw new Error('discovery unavailable')
        },
        close: () => {},
        createClient: () => ({
          selfCheck: async () => ({
            operation: {
              result: anyPack(
                SelfCheckResultSchema,
                create(SelfCheckResultSchema, {
                  selfCheckResult: SelfCheck_Result.GOOD,
                  databaseStatus: [
                    {
                      name: '/local',
                      storage: {
                        pools: [{ id: 'test-pool', groups: [{}] }],
                      },
                    },
                  ],
                }),
              ),
            },
          }),
        }),
      })

    await db.wait(1000)
    t.expect(attempts).toBe(2)
    await db.close()
  },
)

test('unit - db wait ignores static storage pool', options, async (t) => {
  const db = Ydb.init({ models: {} })
  let attempts = 0
  ;(db as unknown as { _createDriver: () => unknown })._createDriver = () => ({
    database: '/local',
    ready: async () => {},
    close: () => {},
    createClient: () => ({
      selfCheck: async () => {
        attempts += 1
        return {
          operation: {
            result: anyPack(
              SelfCheckResultSchema,
              create(SelfCheckResultSchema, {
                selfCheckResult: SelfCheck_Result.GOOD,
                databaseStatus: [
                  {
                    name: '/local',
                    storage: {
                      pools: [
                        {
                          id: attempts === 1 ? 'static' : 'test-pool',
                          groups: [{}],
                        },
                      ],
                    },
                  },
                ],
              }),
            ),
          },
        }
      },
    }),
  })

  await db.wait(1000)
  t.expect(attempts).toBe(2)
  await db.close()
})

test(
  'unit - db wait validates and enforces its timeout',
  options,
  async (t) => {
    const db = Ydb.init({ models: {} })
    ;(db as unknown as { _createDriver: () => unknown })._createDriver =
      () => ({
        ready: async () => {
          throw new Error('unavailable')
        },
        close: () => {},
      })

    await t
      .expect(db.wait(0))
      .rejects.toThrow('ydb: database was not ready within 0ms')
    await t
      .expect(db.wait(-1))
      .rejects.toThrow('ydb: wait timeout must be a non-negative number')
    await db.close()
  },
)
