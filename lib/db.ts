import fs from 'fs'
import path from 'path'
import type { SecureContextOptions } from 'tls'

import type { CredentialsProvider } from '@ydbjs/auth'
import { AccessTokenCredentialsProvider } from '@ydbjs/auth/access-token'
import { AnonymousCredentialsProvider } from '@ydbjs/auth/anonymous'
import { MetadataCredentialsProvider } from '@ydbjs/auth/metadata'
import { Driver } from '@ydbjs/core'
import { QueryClient, query as ydbQuery } from '@ydbjs/query'
import { JSValue, fromJs } from '@ydbjs/value'
import pino, { Logger } from 'pino'

import { YdbApi, api } from './api'
import { SCHEMA_REJECTED_FIELD } from './constant'
import { IamCredentialsProvider } from './iam'
import { sync } from './sync'
import {
  YdbConstructorType, YdbErrorType, YdbModelConstructorType, YdbModelRegistryType, YdbOptionType, YdbType,
} from './type'

export const Ydb: YdbConstructorType = class Ydb implements YdbType {
  private _timeout: number = 10000
  private _driver: Driver
  private _query: QueryClient
  private _api: YdbApi | null = null

  model: YdbModelRegistryType
  logger: Logger

  get timeout() { return this._timeout }

  private static _db: YdbType

  static get db() {
    return Ydb._db
  }

  static init({
    token,
    credential,
    ...params
  }: YdbOptionType = {}) {
    let ssl: SecureContextOptions | undefined

    if (!token && fs.existsSync(path.join(process.cwd(), 'ydb-sa.json'))) {
      credential = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'ydb-sa.json'), 'utf8'))
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
    endpoint, database, models, token, credential, logger, timeout, ssl, meta,
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
      connectionStringFixed = endpoint.endsWith('/') ? endpoint.substring(0, endpoint.length - 1) : endpoint
    }
    if (!connectionString && database && database.trim()) {
      connectionStringFixed = database.startsWith('/')
        ? `${connectionStringFixed}?database=${database}`
        : `${connectionStringFixed}?database=/${database}`
    }

    if (!connectionStringFixed.trim()) {
      connectionStringFixed = 'grpc://localhost:2136?database=/local'
    }

    connectionStringFixed = connectionStringFixed.startsWith('grpc') ? connectionStringFixed : `grpcs://${connectionStringFixed}`
    connectionStringFixed = connectionStringFixed.replace('/?database=', '?database=')

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
  }

  async session(action: (queryClient: QueryClient)=> Promise<unknown>) {
    return action(this._query)
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
        const wrappedValue = fromJs(value)

        query = query.param(cleanName, wrappedValue)
      })
    }

    // execute query and return first result set
    try {
      const result = await query
      return result[0]
    } catch (error) {
      const ydbError = error as YdbErrorType
      if (ydbError?.issues?.[0]) {
        const ydbNestedError = ydbError.issues[0] as unknown as YdbErrorType
        if (ydbNestedError.issues?.[0]) {
          const ydbNestedErrorMessage = (ydbError.issues[0] as unknown as YdbErrorType).message
          throw new Error(ydbNestedErrorMessage)
        }
        throw new Error(ydbNestedError.message)
      }
      throw error
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
      this.logger.error('ydb: invalid table name', { table: model.tableName, mode: model.className })
      throw new Error(`ydb: invalid table name [${model.tableName}] in model [${model.className}]`)
    }

    if (model.primaryKey.replace(/[A-Za-z0-9_]/g, '').length > 0) {
      this.logger.error('ydb: invalid primary key', { key: model.primaryKey, mode: model.className })
      throw new Error(`ydb: invalid primary key [${model.primaryKey}] in model [${model.className}]`)
    }

    const schemaKeys = Object.keys(model.schema.field || model.schema)

    for (let i = 0; i < schemaKeys.length; i += 1) {
      const schemaKey = schemaKeys[i]

      if (schemaKey.replace(/[A-Za-z0-9_]/g, '').length > 0) {
        this.logger.error('ydb: invalid schema key', { field: schemaKey, mode: model.className })
        throw new Error(`ydb: invalid schema key [${schemaKey}] in model [${model.className}]`)
      }

      if (SCHEMA_REJECTED_FIELD.includes(schemaKey)) {
        this.logger.error('ydb: rejected schema key', { field: schemaKey, mode: model.className })
        throw new Error(`ydb: rejected schema key [${schemaKey}] in model [${model.className}]`)
      }
    }
  }

  load(model: YdbModelConstructorType) {
    this.check(model)

    model.setCtx(this)
    this.model[model.className] = model
  }
}
