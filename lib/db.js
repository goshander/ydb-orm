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

  constructor(entrypoint, database, {
    token, credential, logger, timeout, cert, meta,
  }) {
    if (timeout) this.timeout = timeout
    this.logger = pino() || logger

    let authService

    if (credential) {
      authService = new IamAuthService(credential, database)
    } else if (token) {
      authService = new TokenAuthService(token, database)
    } else if (meta) {
      authService = new MetadataAuthService(database)
    } else {
      authService = new AnonymousAuthService()
      authService.getAuthMetadata = function () {
        const grpc = require('grpc')
        const metadata = new grpc.Metadata()
        metadata.add('x-ydb-database', database)
        return Promise.resolve(metadata)
      }
    }
    if (cert) authService.sslCredentials = cert

    this.driver = new Driver(entrypoint, database, authService)
    this.driver.logger = this.logger
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

function init(entrypoint, database, {
  credential, token, logger, timeout, meta,
} = {}) {
  let cert
  if (fs.existsSync(path.join(process.cwd(), 'ydb-sa.json'))) {
    credential = getSACredentialsFromJson(path.join(process.cwd(), 'ydb-sa.json'))
  }
  if (process.env.YDB_CERTS) {
    cert = {
      rootCertificates: fs.readFileSync(path.join(process.env.YDB_CERTS, 'ca.pem')),
      clientPrivateKey: fs.readFileSync(path.join(process.env.YDB_CERTS, 'key.pem')),
      clientCertChain: fs.readFileSync(path.join(process.env.YDB_CERTS, 'cert.pem')),
    }
  }

  db = new Ydb(entrypoint, database, {
    credential, token, logger, timeout, cert, meta,
  })

  return db
}

module.exports = {
  init,
  get db() {
    return db
  },
}
