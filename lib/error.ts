import type { YdbErrorType } from './type'

export const toYdbError = (error: unknown) => {
  const ydbError = error as YdbErrorType
  if (ydbError?.issues?.[0]) {
    const ydbNestedError = ydbError.issues[0] as unknown as YdbErrorType
    if (ydbNestedError.issues?.[0]) {
      const ydbNestedErrorMessage = (ydbError.issues[0] as unknown as YdbErrorType).message
      return new Error(ydbNestedErrorMessage)
    }
    return new Error(ydbNestedError.message)
  }
  return error as Error
}
