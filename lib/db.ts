import fs from 'fs'
import path from 'path'

import pino, { BaseLogger } from 'pino'
import {
  AnonymousAuthService,
  Driver,
  IamAuthService,
  MetadataAuthService,
  Session,
  TokenAuthService,
  getSACredentialsFromJson,
} from 'ydb-sdk'

import { sync } from './sync'
import { YdbBaseModelType, YdbBaseType, YdbOptionsType } from './type'

let db: Ydb

export class Ydb implements YdbBaseType {
  timeout: number = 10000
  driver: Driver
  logger: BaseLogger
  model: Record<string, YdbBaseModelType>

  static get db() {
    return db
  }

  constructor(endpoint: string, database: string, {
    token, credential, logger, timeout, cert, meta,
  }: YdbOptionsType) {
    if (timeout) this.timeout = timeout
    this.logger = logger || pino()

    let authService

    if (credential) {
      authService = new IamAuthService(credential)
    } else if (token) {
      authService = new TokenAuthService(token)
    } else if (meta) {
      authService = new MetadataAuthService()
    } else {
      authService = new AnonymousAuthService()
    }
    /* @ts-ignore */
    if (cert) authService.sslCredentials = cert

    this.driver = new Driver({
      endpoint,
      database,
      authService,
      logger: this.logger,
    })

    this.model = {}
  }

  async session(action: (session: Session)=> Promise<unknown>) {
    return this.driver.tableClient.withSession(action)
  }

  async close() {
    await this.driver.destroy()
  }

  async connect() {
    if (!await this.driver.ready(this.timeout)) {
      throw new Error('ydb: error db connect')
    }
  }

  sync = sync

  load(model: YdbBaseModelType) {
    model.setCtx(this)
    this.model[model.className] = model
  }
}

export const ydbInit = (endpoint: string, database: string, {
  credential, token, logger, timeout, meta,
}: YdbOptionsType = {}) => {
  let cert
  if (fs.existsSync(path.join(process.cwd(), process.env.YDB_SA_KEY || 'ydb-sa.json'))) {
    credential = getSACredentialsFromJson(path.join(process.cwd(), process.env.YDB_SA_KEY || 'ydb-sa.json'))
  }
  if (process.env.YDB_CERTS) {
    cert = {
      rootCertificates: fs.readFileSync(path.join(process.env.YDB_CERTS, 'ca.pem')),
      clientPrivateKey: fs.readFileSync(path.join(process.env.YDB_CERTS, 'key.pem')),
      clientCertChain: fs.readFileSync(path.join(process.env.YDB_CERTS, 'cert.pem')),
    }
  }

  db = new Ydb(endpoint, database, {
    credential, token, logger, timeout, cert, meta,
  })

  return db
}

export type YdbType = typeof Ydb
