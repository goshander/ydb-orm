import {
  FastifyInstance,
  FastifyPluginOptions,
} from 'fastify'

import { fastifyPlugin } from 'fastify-plugin'

const { init } = require('./db')

const NOT_READY = 'database doesn\'t have storage pools at all to create tablet channels to storage pool binding by profile id'

async function timeoutAsync(time: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, time)
  })
}

export const YdbFastify = fastifyPlugin(async (fastify: FastifyInstance, {
  endpoint, database, token, meta, model = [], timeout, sync,
}: FastifyPluginOptions): Promise<void> => {
  const db = init(endpoint, database, {
    token, logger: fastify.logger, timeout, meta,
  })

  // load model
  model.forEach((m) => db.load(m))

  await db.connect()

  // ready storage hack before sync
  let dbSyncReady = false
  while (!dbSyncReady) {
    try {
      await db.sync()
      dbSyncReady = true
    } catch (err) {
      if (err && err.issues && err.issues[0] && err.issues[0].message === NOT_READY) {
        await timeoutAsync(500)
      } else {
        throw err
      }
    }
  }
  // ready storage hack before sync

  if (sync === true) {
    await db.sync()
  }

  fastify.addHook('onClose', async (instance, done) => {
    if (instance.db) await instance.db.close()
    done()
  })

  fastify.decorate('db', db)
})
