import fs from 'fs'
import path from 'path'
import pino, { BaseLogger } from 'pino'
import {
  Driver,
  IamAuthService,
  TokenAuthService,
  AnonymousAuthService,
  getSACredentialsFromJson,
  MetadataAuthService,
  Session,
} from 'ydb-sdk'
import { YdbModel } from './model'

const sync = require('./sync')

let db: Ydb

export class Ydb {
  timeout = 10000
  driver: Driver
  logger: BaseLogger
  model: Record<string, YdbModel>

  static get db() {
    return db
  }

  constructor(endpoint, database, {
    token, credential, logger, timeout, cert, meta,
  }) {
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

  async session(action: (session: Session)=>Promise<unknown>) {
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

  load(model:YdbModel) {
    model.ctx = this
    this.model[model.name] = model
  }
}

export const init = (endpoint, database, {
  credential, token, logger, timeout, meta,
} = {}) => {
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
