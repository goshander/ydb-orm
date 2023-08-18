import { fastifyPlugin } from 'fastify-plugin'
import type { BaseLogger } from 'pino'

import { Ydb } from './db'
import type { YdbFastifyOptionsType, YdbType } from './type'

declare module 'fastify' {
  interface FastifyInstance {
    logger?: BaseLogger
    db?: YdbType
  }
}

// eslint-disable-next-line import/first, import/order
import type { FastifyInstance } from 'fastify'

export const YdbFastify = fastifyPlugin(async (fastify: FastifyInstance, {
  endpoint, database, token, meta, model = [], timeout, sync,
}: YdbFastifyOptionsType): Promise<void> => {
  const db = Ydb.init(endpoint, database, {
    token, logger: fastify.logger, timeout, meta,
  })

  // load model
  model.forEach((m) => db.load(m))

  await db.connect()

  if (sync === true) {
    await db.sync()
  }

  fastify.addHook('onClose', async (instance, done) => {
    if (instance.db) await instance.db.close()
    done()
  })

  fastify.decorate('db', db)
})
