import { SelfCheck_Result } from '@ydbjs/api/monitoring'
import type { Driver } from '@ydbjs/core'
import type { BaseLogger } from 'pino'

import { api, type YdbApi } from './api.js'

type WaitOptions = {
  createDriver: (timeout: number) => Driver
  logger: BaseLogger
  timeout?: number
}

const isSelfCheckUnimplemented = (error: unknown) => {
  if (typeof error !== 'object' || error === null) return false

  const grpcError = error as { code?: number; path?: string }
  return (
    grpcError.code === 12 &&
    grpcError.path === '/Ydb.Monitoring.V1.MonitoringService/SelfCheck'
  )
}

export const wait = async ({
  createDriver,
  logger,
  timeout = 10000,
}: WaitOptions): Promise<Driver> => {
  if (!Number.isFinite(timeout) || timeout < 0) {
    throw new RangeError('ydb: wait timeout must be a non-negative number')
  }

  const deadline = Date.now() + timeout
  let lastError: unknown
  let attempt = 0

  do {
    const remaining = Math.max(1, deadline - Date.now())
    const candidate = createDriver(remaining)

    try {
      const signal = AbortSignal.timeout(remaining)
      await candidate.ready(signal)
      let health: Awaited<ReturnType<YdbApi['selfCheck']>> | undefined

      try {
        health = await api(candidate).selfCheck(signal)
      } catch (error) {
        if (!isSelfCheckUnimplemented(error)) throw error

        logger.debug(
          'ydb: self check is not implemented, using discovery readiness',
        )
      }

      if (health) {
        if (health.selfCheckResult !== SelfCheck_Result.GOOD) {
          throw new Error(
            `ydb: database health check returned ${SelfCheck_Result[health.selfCheckResult]}`,
          )
        }

        const databaseHealth = health.databaseStatus.find(
          ({ name }) => name === candidate.database,
        )
        const writableStorageReady = databaseHealth?.storage?.pools.some(
          (pool) => pool.id !== 'static' && pool.groups.length > 0,
        )
        if (!writableStorageReady) {
          throw new Error('ydb: database storage pools are not ready')
        }
      }

      return candidate
    } catch (error) {
      candidate.close()
      lastError = error

      const retryIn = deadline - Date.now()
      if (retryIn <= 0) break

      logger.debug(
        { attempt: attempt + 1, error },
        'ydb: database is not ready, retrying',
      )
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(250, retryIn)),
      )
      attempt += 1
    }
  } while (Date.now() <= deadline)

  throw new Error(`ydb: database was not ready within ${timeout}ms`, {
    cause: lastError,
  })
}
