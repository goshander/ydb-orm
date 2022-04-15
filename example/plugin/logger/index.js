const fp = require('fastify-plugin')
const pino = require('pino')
const jwt = require('jsonwebtoken')

module.exports = fp((fastify, { level = 'info', auth }, next) => {
  const logger = pino({
    level,
    formatters: {
      // eslint-disable-next-line no-unused-vars
      level(label, number) {
        return { level: label }
      },
    },
  })

  fastify.decorate('logger', logger)

  fastify.addHook('onRequest', (request, reply, nextHook) => {
    request.timing = Date.now()
    nextHook()
  })

  fastify.addHook('preSerialization', (request, reply, payload, nextHook) => {
    // eslint-disable-next-line no-underscore-dangle
    reply._data = payload
    nextHook()
  })

  fastify.addHook('onResponse', (request, reply, nextHook) => {
    if (reply.statusCode === 404) {
      return nextHook()
    }

    const out = {
      id: request.id,
      timing: (Date.now() - request.timing) / 1000,
      url: request.raw.url,
      code: reply.raw.statusCode,
      method: request.method,
      payload: {
        body: request.body,
        query: request.query,
      },
      headers: request.raw.headers,
      // eslint-disable-next-line no-underscore-dangle
      result: reply._data,
      msg: 'request',
    }

    if (auth) {
      let decodedJwt
      try {
        decodedJwt = jwt.decode(request.raw.headers[auth])
      } catch (err) {
        // pass
      }
      if (decodedJwt !== null) {
        out.jwt = decodedJwt
      }
    }

    logger.debug(out)
    return nextHook()
  })

  next()
})
