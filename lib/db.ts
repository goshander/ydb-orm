import fs from 'fs'
import path from 'path'

import { AccessTokenCredentialsProvider } from '@ydbjs/auth/access-token'
import { AnonymousCredentialsProvider } from '@ydbjs/auth/anonymous'
import { MetadataCredentialsProvider } from '@ydbjs/auth/metadata'
import { Driver } from '@ydbjs/core'
import { QueryClient, query } from '@ydbjs/query'
import pino, { Logger } from 'pino'

import { iamTokenRequest, jwt } from './iam'
import { sync } from './sync'
import {
  YdbConstructorType, YdbModelConstructorType, YdbModelRegistryType, YdbOptionType, YdbType,
} from './type'

export const Ydb: YdbConstructorType = class Ydb implements YdbType {
  timeout: number = 10000
  driver: Driver
  logger: Logger
  model: YdbModelRegistryType
  queryClient: QueryClient

  private static _db: YdbType

  static get db() {
    return Ydb._db
  }

  static init({
    token,
    credential,
    ...params
  }: YdbOptionType = {}) {
    let ssl
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
    if (timeout) this.timeout = timeout
    this.logger = logger || pino()

    let authService

    if (credential) {
      // authService = new IamAuthService(credential)

      const sendTokenRequest = async () => {
        const jwtToken = await jwt(credential)
        const iamResponse = await iamTokenRequest(jwtToken)
        return iamResponse
      }

      // @ts-ignore
      authService.sendTokenRequest = sendTokenRequest
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

    // Если connectionString пустой, используем значение по умолчанию для тестов
    if (!connectionStringFixed.trim()) {
      connectionStringFixed = 'grpc://localhost:2136?database=/local'
    }

    connectionStringFixed = connectionStringFixed.startsWith('grpc') ? connectionStringFixed : `grpcs://${connectionStringFixed}`
    connectionStringFixed = connectionStringFixed.replace('/?database=', '?database=')

    this.driver = new Driver(connectionStringFixed, {
      credentialsProvider: authService,
      ssl,
      // logger: this.logger,
    })

    this.queryClient = query(this.driver)
    this.model = {}

    if (models) {
      models.forEach((m) => this.load(m))
    }
  }

  async session(action: (queryClient: QueryClient)=> Promise<unknown>) {
    return action(this.queryClient)
  }

  async close() {
    this.driver.close()
  }

  async connect() {
    await this.driver.ready()
  }

  sync(): Promise<void> {
    return sync(this)
  }

  load(model: YdbModelConstructorType) {
    model.setCtx(this)
    this.model[model.className] = model
  }
}
