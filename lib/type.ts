import { Ydb } from 'ydb-sdk'

export type { YdbError } from 'ydb-sdk'

export type BaseType = boolean | number | string | null
export type FieldType = BaseType | Date
export type ArrayType = Array<FieldType>
export type JsonType =
  | BaseType
  | { [property: string]: JsonType }
  | JsonType[]

export type PrimitiveType = FieldType | ArrayType | JsonType

export const YdbType = {
  date: Ydb.Type.PrimitiveTypeId.TIMESTAMP,
  string: Ydb.Type.PrimitiveTypeId.UTF8,
  ascii: Ydb.Type.PrimitiveTypeId.STRING,
  int: Ydb.Type.PrimitiveTypeId.INT32,
  int32: Ydb.Type.PrimitiveTypeId.INT32,
  int64: Ydb.Type.PrimitiveTypeId.INT64,
  int8: Ydb.Type.PrimitiveTypeId.INT8,
  uint: Ydb.Type.PrimitiveTypeId.UINT32,
  uint32: Ydb.Type.PrimitiveTypeId.UINT32,
  uint64: Ydb.Type.PrimitiveTypeId.UINT64,
  uint8: Ydb.Type.PrimitiveTypeId.UINT8,
  bool: Ydb.Type.PrimitiveTypeId.BOOL,
  json: Ydb.Type.PrimitiveTypeId.JSON,
} as const

export type YdbPrimitiveTypeId = typeof YdbType[keyof typeof YdbType]
