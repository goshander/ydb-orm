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

import { iamTokenRequest, jwt } from './iam'
import { sync } from './sync'
import {
  YdbConstructorType, YdbModelConstructorType, YdbModelRegistryType, YdbOptionType, YdbType,
} from './type'

export const Ydb: YdbConstructorType = class Ydb implements YdbType {
  timeout: number = 10000
  driver: Driver
  logger: BaseLogger
  model: YdbModelRegistryType

  private static _db: YdbType

  static get db() {
    return Ydb._db
  }

  static init(endpoint: string, database: string, {
    credential, token, logger, timeout, meta,
  }: YdbOptionType = {}) {
    let cert
    if (!token && fs.existsSync(path.join(process.cwd(), 'ydb-sa.json'))) {
      credential = getSACredentialsFromJson(path.join(process.cwd(), 'ydb-sa.json'))
    } else if (!token && process.env.YDB_SA_KEY) {
      credential = getSACredentialsFromJson(process.env.YDB_SA_KEY)
    }
    if (process.env.YDB_CERTS) {
      cert = {
        rootCertificates: fs.readFileSync(path.join(process.env.YDB_CERTS, 'ca.pem')),
        clientPrivateKey: fs.readFileSync(path.join(process.env.YDB_CERTS, 'key.pem')),
        clientCertChain: fs.readFileSync(path.join(process.env.YDB_CERTS, 'cert.pem')),
      }
    }

    Ydb._db = new Ydb(endpoint, database, {
      credential, token, logger, timeout, cert, meta,
    })

    return Ydb._db
  }

  constructor(endpoint: string, database: string, {
    token, credential, logger, timeout, cert, meta,
  }: YdbOptionType) {
    if (timeout) this.timeout = timeout
    this.logger = logger || pino()

    let authService

    if (credential) {
      authService = new IamAuthService(credential)

      const sendTokenRequest = async () => {
        const jwtToken = await jwt(credential)
        const iamResponse = await iamTokenRequest(jwtToken)
        return iamResponse
      }

      // @ts-ignore
      authService.sendTokenRequest = sendTokenRequest
    } else if (token) {
      authService = new TokenAuthService(token)
    } else if (meta) {
      authService = new MetadataAuthService()
    } else {
      authService = new AnonymousAuthService()
    }

    this.driver = new Driver({
      endpoint,
      database,
      authService,
      sslCredentials: cert,
      logger: this.logger,
    })

    // @ts-ignore
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

  sync(): Promise<void> {
    return sync(this)
  }

  load(model: YdbModelConstructorType) {
    model.setCtx(this)
    this.model[model.className] = model
  }
}
