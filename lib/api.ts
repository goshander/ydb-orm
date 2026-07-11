import { anyUnpack } from '@bufbuild/protobuf/wkt'
import {
  MonitoringServiceDefinition,
  type SelfCheckResult,
  SelfCheckResultSchema,
} from '@ydbjs/api/monitoring'
import {
  type AlterTableRequest,
  type AlterTableResponse,
  AlterTableResponseSchema,
  type CreateTableRequest,
  type CreateTableResponse,
  CreateTableResponseSchema,
  type DescribeTableResult,
  DescribeTableResultSchema,
  TableServiceDefinition,
} from '@ydbjs/api/table'
import type { Driver } from '@ydbjs/core'

import { toYdbError } from './error.js'

export const api = (driver: Driver) => {
  const tableClient = driver.createClient(TableServiceDefinition)

  const createTable = async (req: CreateTableRequest) => {
    const response = await tableClient.createTable(req)

    if (response.operation?.issues?.length) {
      const ydbError = toYdbError(response.operation)
      throw ydbError
    }

    if (!response.operation?.result) {
      return undefined
    }

    const result = anyUnpack(
      response.operation?.result,
      CreateTableResponseSchema,
    ) as CreateTableResponse | undefined

    return result
  }

  const alterTable = async (req: AlterTableRequest) => {
    const response = await tableClient.alterTable(req)

    if (response.operation?.issues?.length) {
      const ydbError = toYdbError(response.operation)
      throw ydbError
    }

    if (!response.operation?.result) {
      return undefined
    }
    const result = anyUnpack(
      response.operation?.result,
      AlterTableResponseSchema,
    ) as AlterTableResponse | undefined

    return result
  }

  const describeTable = async (tableName: string) => {
    const response = await tableClient.describeTable({
      path: `/${driver.database}/${tableName}`,
    })

    if (response.operation?.issues?.length) {
      const ydbError = toYdbError(response.operation)
      throw ydbError
    }

    if (!response.operation?.result) {
      throw new Error('ydb: table not found in database')
    }
    const result = anyUnpack(
      response.operation?.result,
      DescribeTableResultSchema,
    ) as DescribeTableResult | undefined

    return result
  }

  const selfCheck = async (signal?: AbortSignal) => {
    const monitoringClient = driver.createClient(MonitoringServiceDefinition)
    const response = await monitoringClient.selfCheck(
      { returnVerboseStatus: true, maximumLevel: 10 },
      { signal },
    )

    if (response.operation?.issues?.length) {
      throw toYdbError(response.operation)
    }

    if (!response.operation?.result) {
      throw new Error('ydb: self check returned no result')
    }

    let result: SelfCheckResult | undefined

    try {
      result = anyUnpack(response.operation.result, SelfCheckResultSchema) as
        | SelfCheckResult
        | undefined
    } catch {
      throw new Error('ydb: invalid self check result')
    }

    if (!result) {
      throw new Error('ydb: invalid self check result')
    }

    return result
  }

  return {
    alterTable,
    createTable,
    describeTable,
    selfCheck,
  }
}

export type YdbApi = ReturnType<typeof api>
