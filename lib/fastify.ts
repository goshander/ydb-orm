import { fastifyPlugin } from 'fastify-plugin'
import type { BaseLogger } from 'pino'

import { Ydb } from './db'
import type { YdbErrorType, YdbFastifyOptionsType, YdbType } from './type'

declare module 'fastify' {
  interface FastifyInstance {
    logger?: BaseLogger
    db?: YdbType
  }
}

// eslint-disable-next-line import/first, import/order
import type { FastifyInstance } from 'fastify'

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
}: YdbFastifyOptionsType): Promise<void> => {
  const db = Ydb.init(endpoint, database, {
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
      if ((err as YdbErrorType)?.issues?.[0]?.message === NOT_READY) {
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
