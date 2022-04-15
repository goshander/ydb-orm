const fastify = require('fastify')

const app = fastify({
  logger: false, // disable default logger
  disableRequestLogging: true, // disable default logger
})

app.register(require('./plugin/logger'), {
  level: process.env.LOG_LEVEL || process.env.NODE_ENV === 'development' ? 'debug' : 'info',
})

// load db model
const User = require('./service/user').model

app.register(require('..').fastify, {
  endpoint: process.env.YDB_ENDPOINT,
  database: process.env.YDB_DATABASE,
  meta: process.env.NODE_ENV === 'production',
  model: [
    User,
  ],
  timeout: 4000,
})

app.register(require('./service/status').api)

module.exports = app
