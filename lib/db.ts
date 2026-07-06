import type { CredentialsProvider } from '@ydbjs/auth'
import { AccessTokenCredentialsProvider } from '@ydbjs/auth/access-token'
import { AnonymousCredentialsProvider } from '@ydbjs/auth/anonymous'
import { MetadataCredentialsProvider } from '@ydbjs/auth/metadata'
import { Driver } from '@ydbjs/core'
import { type QueryClient, query as ydbQuery } from '@ydbjs/query'
import { fromJs, type JSValue, type Type, type Value } from '@ydbjs/value'
import { Json } from '@ydbjs/value/primitive'
import fs from 'fs'
import path from 'path'
import pino, { type BaseLogger } from 'pino'
import type { SecureContextOptions } from 'tls'

import { api, type YdbApi } from './api'
import { SCHEMA_REJECTED_FIELD } from './constant'
import { toYdbError } from './error'
import { IamCredentialsProvider } from './iam'
import { sync } from './sync'
import type {
  YdbConstructorType,
  YdbModelConstructorType,
  YdbModelRegistryType,
  YdbOptionType,
  YdbQueryResult,
  YdbType,
} from './type'

export const Ydb: YdbConstructorType = class Ydb implements YdbType {
  private _timeout: number = 10000
  private _driver: Driver
  private _query: QueryClient
  private _api: YdbApi | null = null

  model: YdbModelRegistryType
  logger: BaseLogger
  debug: boolean = false

  get timeout() {
    return this._timeout
  }

  private static _db: YdbType

  static get db() {
    return Ydb._db
  }

  static init({ token, credential, ...params }: YdbOptionType = {}) {
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

    return Ydb._db
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
  }: YdbOptionType) {
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

    this._driver = new Driver(connectionStringFixed, {
      credentialsProvider: authService,
      ssl,
      'ydb.sdk.ready_timeout_ms': this._timeout,
    })

    this._query = ydbQuery(this._driver)

    this.model = {}

    if (models) {
      for (let i = 0; i < models.length; i += 1) {
        this.load(models[i])
      }
    }

    if (debug !== undefined) {
      this.debug = debug
    }
  }

  async sql(sql: string, params?: Record<string, JSValue>) {
    // create a proper template strings array with raw property
    let query = this._query(sql).timeout(this._timeout)

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

  load(model: YdbModelConstructorType) {
    this.check(model)

    model.setCtx(this)
    this.model[model.className] = model
  }
}
