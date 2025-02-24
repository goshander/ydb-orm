/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import type Long from 'long'
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
export type FieldsType = Record<string, PrimitiveType>

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
  double: Ydb.Type.PrimitiveTypeId.DOUBLE,
  bool: Ydb.Type.PrimitiveTypeId.BOOL,
  json: Ydb.Type.PrimitiveTypeId.JSON,
} as const
export type YdbDataTypeId = typeof YdbDataType[keyof typeof YdbDataType]
export type YdbDataTypeWithOption = { type: YdbDataTypeId, index?: boolean, drop?: boolean, renamed?: string }
export type YdbSchemaFieldType = Record<string, YdbDataTypeId | YdbDataTypeWithOption>
export type YdbSchemaOptionType = { tableName?: string; primaryKey?: string, strict?: boolean }
export type YdbSchemaType = YdbSchemaFieldType | { field: YdbSchemaFieldType, option?: YdbSchemaOptionType }

export interface YdbModelType {
  model: YdbModelConstructorType

  save(): Promise<this>
  delete(): Promise<void>
  increment(field: string, options?: { by?: number }): Promise<void>

  toJson(): FieldsType
}

// dirty solution: https://github.com/microsoft/TypeScript/issues/5863
type ThisConstructorType<T> = new(fields: FieldsType)=> T

export interface YdbModelConstructorType {
  new (fields: FieldsType): YdbModelType;

  _tableName: string
  _primaryKey: string
  _ctx: YdbType

  primaryKey: string
  schema: YdbSchemaType
  fields: YdbSchemaFieldType
  className: string
  tableName: string
  ctx: YdbType
  setCtx(ctx: YdbType): void

  copy(from: string, to: string): Promise<void>
  count(options?: { where?: WhereType, field?: string, distinct: boolean, index?: string }): Promise<number>
  find<T extends YdbModelType>(this: ThisConstructorType<T>, options?: {
    where?: WhereType, offset?: number, limit?: number, page?: number, order?: string, index?: string
  }): Promise<Array<T>>
  findByPk<T extends YdbModelType>(this: ThisConstructorType<T>, pk: string): Promise<T | null>
  findOne<T extends YdbModelType>(this: ThisConstructorType<T>,
    options: { where?: WhereType, order?: string, index?: string }): Promise<T | null>
  update(fields: FieldsType, options: { where: WhereType }): Promise<void>
  drop(): Promise<void>
}

export type YdbOptionType = {
  endpoint?: string
  database?: string

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

export interface YdbModelRegistryType {
  [key: string]: YdbModelConstructorType
}

export interface YdbType {
  timeout: number
  driver: Driver
  logger: BaseLogger
  model: YdbModelRegistryType

  session(action: (session: Session)=> Promise<unknown>): Promise<unknown>
  connect(): Promise<void>
  close(): Promise<void>
  sync(): Promise<void>
  load(model: YdbModelConstructorType): void
}

export interface YdbConstructorType {
  new (option: YdbOptionType): YdbType;
  get db(): YdbType;
  init: (option: YdbOptionType)=> YdbType;
}

export type RawDataType = {
  uint8Value?: number;
  uint32Value?: number;
  uint64Value?: Long;
  int8Value?: number;
  int32Value?: number;
  int64Value?: Long;
  doubleValue?: number;
  boolValue?: boolean;
  nullFlagValue?: null;
  bytesValue?: Buffer;
  textValue?: string;
}

export type RawFieldType = {
  typeId?: YdbDataTypeId
  optionalType?: {
    item?: {
      typeId?: YdbDataTypeId
    }
  }
}

export type YdbColumnType = {
  name: string
  type: RawFieldType
}

export type YdbIndexType = {
  name: string
  indexColumns: string[]
}

export type YdbResultType = {
  columns: Array<YdbColumnType>
  rows: Array<{ items: Array<RawDataType> }>
}

export type YdbErrorType = YdbError
