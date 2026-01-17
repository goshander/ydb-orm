import { anyUnpack } from '@bufbuild/protobuf/wkt'
import {
  type AlterTableRequest, type AlterTableResponse, AlterTableResponseSchema,
  type CreateTableRequest, type CreateTableResponse, CreateTableResponseSchema,
  type DescribeTableResult, DescribeTableResultSchema, TableServiceDefinition,
} from '@ydbjs/api/table'
import type { Driver } from '@ydbjs/core'

import { toYdbError } from './error'

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

    const result = anyUnpack(response.operation?.result, CreateTableResponseSchema) as CreateTableResponse | undefined

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
    const result = anyUnpack(response.operation?.result, AlterTableResponseSchema) as AlterTableResponse | undefined

    return result
  }

  const describeTable = async (tableName: string) => {
    const response = await tableClient.describeTable({ path: `/${driver.database}/${tableName}` })

    if (response.operation?.issues.length) {
      const ydbError = toYdbError(response.operation)
      throw ydbError
    }

    if (!response.operation?.result) {
      throw new Error('ydb: table not found in database')
    }
    const result = anyUnpack(response.operation?.result, DescribeTableResultSchema) as DescribeTableResult | undefined

    return result
  }

  return {
    alterTable,
    createTable,
    describeTable,
  }
}

export type YdbApi = ReturnType<typeof api>
