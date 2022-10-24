const fs = require('fs')
const path = require('path')
const pino = require('pino')

const {
  Driver,
  IamAuthService,
  TokenAuthService,
  AnonymousAuthService,
  getSACredentialsFromJson,
  MetadataAuthService,
} = require('ydb-sdk')

const sync = require('./sync')

let db = null

class Ydb {
  timeout = 10000

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
    if (cert) authService.sslCredentials = cert

    /** @type {Driver} */
    this.driver = new Driver({
      endpoint,
      database,
      authService,
      logger: this.logger,
    })

    /** @type {YdbModels} */
    this.model = {}
  }

  async session(action) {
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

  load(model) {
    model.ctx = this
    this.model[model.name] = model
  }
}

function init(endpoint, database, {
  credential, token, logger, timeout, meta,
} = {}) {
  let cert
  if (fs.existsSync(path.join(process.cwd(), process.env.YDB_SA_KEY))) {
    credential = getSACredentialsFromJson(path.join(process.cwd(), process.env.YDB_SA_KEY))
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

module.exports = {
  init,

  /** @return {ReturnType<init>} */
  get db() {
    return db
  },
}
