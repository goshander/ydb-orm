import type { BaseLogger } from 'pino'

const SCHEMA_OPERATION_LIMIT_MESSAGE =
  'Request exceeded a limit on the number of schema operations, try again later'

const isSchemaOperationLimitError = (error: unknown) =>
  error instanceof Error &&
  error.message.includes(SCHEMA_OPERATION_LIMIT_MESSAGE)

export const retrySchemaOperation = async <T>(
  operation: () => Promise<T>,
  logger: BaseLogger,
  timeout: number,
): Promise<T> => {
  const deadline = Date.now() + timeout
  let attempt = 0

  while (true) {
    try {
      return await operation()
    } catch (error) {
      const remaining = deadline - Date.now()
      if (!isSchemaOperationLimitError(error) || remaining <= 0) throw error

      const delay = Math.min(250 * 2 ** attempt, 2000, remaining)
      logger.debug(
        { attempt: attempt + 1, delay, error },
        'ydb: schema operation limit exceeded, retrying',
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
      attempt += 1
    }
  }
}
