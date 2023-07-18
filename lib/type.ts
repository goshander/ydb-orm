/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import type { BaseLogger } from 'pino'
import { Ydb } from 'ydb-sdk'
import type {
  Driver, ISslCredentials, Session, YdbError,
} from 'ydb-sdk'

export type BaseType = boolean | number | string | null
export type FieldType = BaseType | Date
export type ArrayType = Array<FieldType>
export type JsonType =
  | BaseType
  | { [property: string]: JsonType }
  | JsonType[]

export type PrimitiveType = FieldType | ArrayType | JsonType

export type LikeType = { like: PrimitiveType }
export type WhereType = Record<string, PrimitiveType | LikeType>

export const YdbDataType = {
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
export type YdbDataTypeId = typeof YdbDataType[keyof typeof YdbDataType]
export type YdbSchemaType = Record<string, YdbDataTypeId>
export const SCHEMA_REJECTED_FIELD = ['ctx', 'base', 'schema', 'primaryKey', 'className', 'tableName'] as const

export type YdbOptionsType = {
  token?: string
  credential?: {
    serviceAccountId: string;
    accessKeyId: string;
    privateKey: Buffer;
    iamEndpoint: string;
  }
  logger?: BaseLogger
  timeout?: number
  cert?: ISslCredentials
  meta?: boolean
}
export type YdbBaseType = {
  timeout: number
  driver: Driver
  logger: BaseLogger
  model: Record<string, YdbBaseModelType>

  session(action: (session: Session)=> Promise<unknown>): Promise<unknown>
  close(): Promise<void>
  load(model: YdbBaseModelType): void
}

export class YdbBaseModel implements Record<string, unknown> {
  [field: string]: unknown

  constructor(fields: Record<string, PrimitiveType>) {
    throw new Error('ydb: constructor not implemented')
  }

  static primaryKey: string
  get primaryKey(): string { throw new Error('ydb: getter `primaryKey` not implemented') }

  static schema: YdbSchemaType
  get schema(): YdbSchemaType { throw new Error('ydb: getter `schema` not implemented') }

  static className: string
  get className(): string { throw new Error('ydb: getter `className` not implemented') }
  static tableName: string
  get tableName(): string { throw new Error('ydb: getter `tableName` not implemented') }

  get base(): Object { throw new Error('ydb: getter `base` not implemented') }

  get ctx(): YdbBaseType { throw new Error('ydb: getter `ctx` not implemented') }
  static ctx: YdbBaseType
  static setCtx(ctx: YdbBaseType): void {
    throw new Error('ydb: static method `setCtx` not implemented')
  }

  static copy(from: string, to: string): Promise<unknown> {
    throw new Error('ydb: static method `copy` not implemented')
  }
  static count(options: { where: WhereType, field: string, distinct: boolean }): Promise<number> {
    throw new Error('ydb: static method `count` not implemented')
  }
  static find(options: {
    where?: WhereType, offset?: number, limit?: number, page?: number, order?: string,
  }): Promise<Array<YdbBaseModel>> {
    throw new Error('ydb: static method `find` not implemented')
  }
  static findByPk(pk: string): Promise<YdbBaseModel | null> {
    throw new Error('ydb: static method `findByPk` not implemented')
  }
  static findOne(options: { where?: WhereType, order?: string }): Promise<YdbBaseModel | null> {
    throw new Error('ydb: static method `findOne` not implemented')
  }
  static update(data: Record<string, PrimitiveType>, options: { where: WhereType }): Promise<void> {
    throw new Error('ydb: static method `update` not implemented')
  }

  save(): Promise<YdbBaseModel> { throw new Error('ydb: method `save` not implemented') }
  delete(): Promise<void> { throw new Error('ydb: method `delete` not implemented') }
  increment(field: string, options: { by?: number }): Promise<void> {
    throw new Error('ydb: method `increment` not implemented')
  }

  toJson(): Record<string, PrimitiveType> { throw new Error('ydb: method `toJson` not implemented') }
}
export type YdbBaseModelType = typeof YdbBaseModel

export type YdbFastifyOptionsType = {
  endpoint: string
  database: string
  token?: string
  meta?: boolean
  model?: Array<YdbBaseModelType>
  timeout?: number
  sync?: boolean
}

export type YdbErrorType = YdbError
