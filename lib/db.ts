import fs from 'node:fs'
import path from 'node:path'
import type { SecureContextOptions } from 'node:tls'
import { SelfCheck_Result } from '@ydbjs/api/monitoring'
import type { CredentialsProvider } from '@ydbjs/auth'
import { AccessTokenCredentialsProvider } from '@ydbjs/auth/access-token'
import { AnonymousCredentialsProvider } from '@ydbjs/auth/anonymous'
import { MetadataCredentialsProvider } from '@ydbjs/auth/metadata'
import { Driver } from '@ydbjs/core'
import {
  type Query,
  type QueryClient,
  type SQL,
  query as ydbQuery,
} from '@ydbjs/query'
import { fromJs, type JSValue, type Type, type Value } from '@ydbjs/value'
import { Json } from '@ydbjs/value/primitive'
import pino, { type BaseLogger } from 'pino'

import { api, type YdbApi } from './api.js'
import { SCHEMA_REJECTED_FIELD } from './constant.js'
import { toYdbError } from './error.js'
import { IamCredentialsProvider } from './iam.js'
import { sync } from './sync.js'
import type {
  YdbConstructorType,
  YdbModelConstructorType,
  YdbModelRegistryType,
  YdbModelsOptionType,
  YdbOptionType,
  YdbQueryResult,
  YdbRegistryFromModels,
  YdbTransactionOptionsType,
  YdbTransactionType,
  YdbType,
} from './type.js'

export const Ydb: YdbConstructorType = class Ydb<
  TRegistry extends YdbModelRegistryType = YdbModelRegistryType,
> implements YdbType<TRegistry>
{
  private _timeout: number = 10000
  private _driver: Driver
  private _createDriver: (timeout: number) => Driver
  private _query: QueryClient
  private _api: YdbApi | null = null

  model: TRegistry
  logger: BaseLogger
  debug: boolean = false

  get timeout() {
    return this._timeout
  }

  private static _db: YdbType

  static get db() {
    return Ydb._db
  }

  static init<
    TModels extends YdbModelsOptionType = Record<
      string,
      YdbModelConstructorType
    >,
  >(
    {
      token,
      credential,
      ...params
    }: YdbOptionType<TModels> = {} as YdbOptionType<TModels>,
  ) {
    let ssl: SecureContextOptions | undefined

    if (!token && fs.existsSync(path.join(process.cwd(), 'ydb-sa.json'))) {
      credential = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'ydb-sa.json'), 'utf8'),
      )
    } else if (!token && process.env.YDB_SA_KEY) {
      credential = JSON.parse(process.env.YDB_SA_KEY)
    }

    if (process.env.YDB_CERTS) {
      ssl = {
        ca: fs.readFileSync(path.join(process.env.YDB_CERTS, 'ca.pem')),
        key: fs.readFileSync(path.join(process.env.YDB_CERTS, 'key.pem')),
        cert: fs.readFileSync(path.join(process.env.YDB_CERTS, 'cert.pem')),
      }
    }

    Ydb._db = new Ydb({
      token,
      credential,
      ssl,
      ...params,
    })

    return Ydb._db as YdbType<YdbRegistryFromModels<TModels>>
  }

  constructor({
    connectionString,
    endpoint,
    database,
    models,
    token,
    credential,
    logger,
    timeout,
    ssl,
    meta,
    debug,
  }: YdbOptionType<YdbModelsOptionType>) {
    if (timeout) this._timeout = timeout
    this.logger = logger || pino()

    let authService: CredentialsProvider

    if (credential) {
      authService = new IamCredentialsProvider(credential)
    } else if (token) {
      authService = new AccessTokenCredentialsProvider({ token })
    } else if (meta) {
      authService = new MetadataCredentialsProvider()
    } else {
      authService = new AnonymousCredentialsProvider()
    }

    // fix connection string for new format
    let connectionStringFixed = connectionString || ''

    if (!connectionString && endpoint && endpoint.trim()) {
      connectionStringFixed = endpoint.endsWith('/')
        ? endpoint.substring(0, endpoint.length - 1)
        : endpoint
    }
    if (!connectionString && database && database.trim()) {
      connectionStringFixed = database.startsWith('/')
        ? `${connectionStringFixed}?database=${database}`
        : `${connectionStringFixed}?database=/${database}`
    }

    if (!connectionStringFixed.trim()) {
      connectionStringFixed = 'grpc://localhost:2136?database=/local'
    }

    connectionStringFixed = connectionStringFixed.startsWith('grpc')
      ? connectionStringFixed
      : `grpcs://${connectionStringFixed}`
    connectionStringFixed = connectionStringFixed.replace(
      '/?database=',
      '?database=',
    )

    this._createDriver = (readyTimeout) =>
      new Driver(connectionStringFixed, {
        credentialsProvider: authService,
        ssl,
        'ydb.sdk.ready_timeout_ms': readyTimeout,
      })

    this._driver = this._createDriver(this._timeout)

    this._query = ydbQuery(this._driver)

    this.model = {} as TRegistry

    if (models) {
      Object.entries(models).forEach(([name, model]) => {
        this.load(model, name)
      })
    }

    if (debug !== undefined) {
      this.debug = debug
    }
  }

  private bindParams(query: Query, params?: Record<string, JSValue>) {
    if (params) {
      Object.keys(params).forEach((paramName) => {
        // strip $ prefix if present
        const cleanName = paramName.replace('$', '')

        // wrap value with fromJs
        const value = params[paramName]
        let wrappedValue: JSValue | Value<Type>

        // fix for json fields
        if (
          value &&
          (value.constructor === Array || value.constructor === Object) &&
          !paramName.startsWith('where_')
        ) {
          wrappedValue = new Json(JSON.stringify(value))
        } else {
          wrappedValue = fromJs(value)
        }

        query = query.param(cleanName, wrappedValue)
      })
    }

    return query
  }

  private async executeSql(
    executor: SQL,
    sql: string,
    params?: Record<string, JSValue>,
  ) {
    let query = executor(sql).timeout(this._timeout)
    query = this.bindParams(query, params)

    if (this.debug) {
      this.logger.debug({ sql, params }, 'ydb: [DEBUG] sql query')
    }

    // execute query and return first result set
    try {
      const result = await query

      // parse result not needed, except ascii type (String) from Buffer
      // const queryResult: YdbQueryResult = []

      // result[0].forEach((row) => {
      //   const parsedRow: Record<string, PrimitiveType> = {}

      //   Object.keys(row).forEach((key) => {
      //     if (fields[key] === YdbDataType.ascii) {
      //       parsedRow[key] = (row[key] as Buffer).toString('utf8')
      //     } else {
      //       parsedRow[key] = row[key]
      //     }
      //   })

      //   queryResult.push(parsedRow)
      // })

      return result[0] as YdbQueryResult
    } catch (error) {
      const ydbError = toYdbError(error)
      throw ydbError
    }
  }

  async sql(sql: string, params?: Record<string, JSValue>) {
    return this.executeSql(this._query, sql, params)
  }

  async transaction<T>(
    callback: (tx: YdbTransactionType, signal: AbortSignal) => Promise<T> | T,
    options?: YdbTransactionOptionsType,
  ) {
    return this._query.begin(options || {}, async (tx, signal) => {
      const txDb: YdbTransactionType = {
        logger: this.logger,
        debug: this.debug,
        sql: (sql, params) => this.executeSql(tx, sql, params),
      }

      return callback(txDb, signal)
    })
  }

  // transaction(fn: (db: YdbType)=> Promise<void>) {
  //   this._query.transaction<void>(async (tx) => {
  //     await fn(tx)
  //   })
  // }

  async close() {
    this._driver.close()
  }

  async connect() {
    await this._driver.ready()
  }

  async wait(timeout = 10000) {
    if (!Number.isFinite(timeout) || timeout < 0) {
      throw new RangeError('ydb: wait timeout must be a non-negative number')
    }

    const deadline = Date.now() + timeout
    let lastError: unknown
    let attempt = 0

    do {
      const remaining = Math.max(1, deadline - Date.now())
      const candidate = this._createDriver(remaining)

      try {
        const signal = AbortSignal.timeout(remaining)
        await candidate.ready(signal)
        const health = await api(candidate).selfCheck(signal)
        if (health.selfCheckResult !== SelfCheck_Result.GOOD) {
          throw new Error(
            `ydb: database health check returned ${SelfCheck_Result[health.selfCheckResult]}`,
          )
        }

        const databaseHealth = health.databaseStatus.find(
          ({ name }) => name === candidate.database,
        )
        const writableStorageReady = databaseHealth?.storage?.pools.some(
          (pool) => pool.id !== 'static' && pool.groups.length > 0,
        )
        if (!writableStorageReady) {
          throw new Error('ydb: database storage pools are not ready')
        }

        this._driver.close()
        this._driver = candidate
        this._query = ydbQuery(candidate)
        this._api = null
        return
      } catch (error) {
        candidate.close()
        lastError = error

        const retryIn = deadline - Date.now()
        if (retryIn <= 0) break

        this.logger.debug(
          { attempt: attempt + 1, error },
          'ydb: database is not ready, retrying',
        )
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(250, retryIn)),
        )
        attempt += 1
      }
    } while (Date.now() <= deadline)

    throw new Error(`ydb: database was not ready within ${timeout}ms`, {
      cause: lastError,
    })
  }

  sync(): Promise<void> {
    return sync(this)
  }

  api() {
    if (this._api == null) {
      this._api = api(this._driver)
    }
    return this._api
  }

  check(model: YdbModelConstructorType) {
    if (model.tableName.replace(/[A-Za-z0-9_]/g, '').length > 0) {
      this.logger.error(
        { table: model.tableName, mode: model.className },
        'ydb: invalid table name',
      )
      throw new Error(
        `ydb: invalid table name [${model.tableName}] in model [${model.className}]`,
      )
    }

    if (model.primaryKey.replace(/[A-Za-z0-9_]/g, '').length > 0) {
      this.logger.error(
        { key: model.primaryKey, mode: model.className },
        'ydb: invalid primary key',
      )
      throw new Error(
        `ydb: invalid primary key [${model.primaryKey}] in model [${model.className}]`,
      )
    }

    const schemaKeys = Object.keys(model.schema.field || model.schema)

    for (let i = 0; i < schemaKeys.length; i += 1) {
      const schemaKey = schemaKeys[i]

      if (schemaKey.replace(/[A-Za-z0-9_]/g, '').length > 0) {
        this.logger.error(
          { field: schemaKey, mode: model.className },
          'ydb: invalid schema key',
        )
        throw new Error(
          `ydb: invalid schema key [${schemaKey}] in model [${model.className}]`,
        )
      }

      if (SCHEMA_REJECTED_FIELD.includes(schemaKey)) {
        this.logger.error(
          { field: schemaKey, mode: model.className },
          'ydb: rejected schema key',
        )
        throw new Error(
          `ydb: rejected schema key [${schemaKey}] in model [${model.className}]`,
        )
      }
    }
  }

  load(model: YdbModelConstructorType, name = model.className) {
    this.check(model)

    model.setCtx(this)
    this.model[name as keyof TRegistry] = model as TRegistry[keyof TRegistry]
  }
}
