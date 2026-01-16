/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import type { SecureContextOptions } from 'tls'

import type {
  YDBError,
} from '@ydbjs/error'
import type {
  JSValue,
} from '@ydbjs/value'
import type Long from 'long'
import type { Logger } from 'pino'

import type { YdbApi } from './api'
import { type DATA_TYPE_ID_MAP, DATA_TYPE_KEY_MAP } from './constant'

export type BaseType = boolean | number | bigint | string | null
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

export const YdbDataType = DATA_TYPE_KEY_MAP
export type YdbDataTypeType = typeof YdbDataType
export type YdbDataTypeKey = typeof DATA_TYPE_KEY_MAP[keyof YdbDataTypeType]
export type YdbDataTypeId = typeof DATA_TYPE_ID_MAP[keyof YdbDataTypeType]
export type YdbDataTypeWithOption = { type: YdbDataTypeKey, index?: boolean, drop?: boolean, renamed?: string }
export type YdbSchemaFieldType = Record<string, YdbDataTypeKey | YdbDataTypeWithOption>
export type YdbSchemaOptionType = { tableName?: string; primaryKey?: string, strict?: boolean }
export type YdbSchemaType = YdbSchemaFieldType | { field: YdbSchemaFieldType, option?: YdbSchemaOptionType }
export type YdbQueryResult = Array<FieldsType>

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
  count(options?: { where?: WhereType, field?: string, distinct: boolean, index?: string }): Promise<bigint>
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
  connectionString?: string

  token?: string
  credential?: {
    serviceAccountId: string;
    accessKeyId: string;
    privateKey: Buffer;
    iamEndpoint: string;
  }

  models?: Array<YdbModelConstructorType>

  logger?: Logger
  timeout?: number
  ssl?: SecureContextOptions
  meta?: boolean
}

export interface YdbModelRegistryType {
  [key: string]: YdbModelConstructorType
}

export interface YdbType {
  logger: Logger
  model: YdbModelRegistryType

  session(action: (queryClient: any)=> Promise<unknown>): Promise<unknown>
  sql(sql: string, params?: Record<string, JSValue>): Promise<YdbQueryResult>
  connect(): Promise<void>
  close(): Promise<void>
  sync(): Promise<void>
  load(model: YdbModelConstructorType): void
  api(): YdbApi
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

export type YdbErrorType = YDBError
