const fp = require('fastify-plugin')
const { init } = require('./db')

const NOT_READY = 'database doesn\'t have storage pools at all to create tablet channels to storage pool binding by profile id'

async function timeoutReady(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, time)
  })
}

module.exports = fp(async (fastify, {
  endpoint, database, token, meta, model = [], timeout,
}, next) => {
  const db = init(endpoint, database, {
    token, logger: fastify.logger, timeout, meta,
  })

  // load model
  model.forEach((m) => db.load(m))

  await db.connect()

  // ready storage hack before sync
  let errorSync = NOT_READY
  while (errorSync === NOT_READY) {
    try {
      await db.sync()
      errorSync = null
    } catch (err) {
      if (err && err.issues && err.issues[0] && err.issues[0].message === NOT_READY) {
        await timeoutReady(500)
      } else {
        throw err
      }
    }
  }
  // ready storage hack before sync

  fastify.addHook('onClose', async (instance, done) => {
    if (instance.db) await instance.db.close()
    done()
  })

  fastify.decorate('db', db)

  next()
})
