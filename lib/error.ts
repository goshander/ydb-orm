import type { YdbErrorType } from './type'

export const toYdbError = (error: unknown) => {
  const ydbError = error as YdbErrorType
  if (ydbError?.issues?.[0]) {
    const ydbNestedError = ydbError.issues[0] as unknown as YdbErrorType
    if (ydbNestedError.issues?.[0]) {
      const ydbSuperNestedError = ydbNestedError.issues[0] as unknown as YdbErrorType
      if (ydbSuperNestedError.issues?.[0]) {
        const ydbNestedErrorMessage = (ydbSuperNestedError.issues[0] as unknown as YdbErrorType).message
        return new Error(ydbNestedErrorMessage)
      }
      return new Error(ydbSuperNestedError.message)
    }
    return new Error(ydbNestedError.message)
  }
  return error as Error
}
