import type { SecureContextOptions } from 'node:tls'
import type { YDBError } from '@ydbjs/error'
import type { JSValue } from '@ydbjs/value'
import type Long from 'long'
import type { BaseLogger } from 'pino'

import type { YdbApi } from './api.js'
import { type DATA_TYPE_ID_MAP, DATA_TYPE_KEY_MAP } from './constant.js'

export type BaseType = boolean | number | bigint | string | Buffer | null
export type FieldType = BaseType | Date
export type ArrayType = Array<FieldType>
export type JsonType = BaseType | { [property: string]: JsonType } | JsonType[]

export type PrimitiveType = FieldType | ArrayType | JsonType

export type LikeType = { like: PrimitiveType }
export type NotLikeType = { notLike: PrimitiveType }
export type NullType = { is?: null; isNot?: null }
export type NotType = { not: PrimitiveType }
export type BetweenType = {
  between?: [PrimitiveType, PrimitiveType]
  notBetween?: [PrimitiveType, PrimitiveType]
}
export type CompareType = {
  eq?: PrimitiveType
  ne?: PrimitiveType
  gt?: PrimitiveType
  gte?: PrimitiveType
  lt?: PrimitiveType
  lte?: PrimitiveType
  in?: ArrayType
  notIn?: ArrayType
}
export type WhereOperatorType =
  | LikeType
  | NotLikeType
  | NullType
  | NotType
  | BetweenType
  | CompareType
export type FieldsType = Record<string, PrimitiveType>
export type FieldNameType<TFields extends object = FieldsType> = Extract<
  keyof TFields,
  string
>
export type WhereType<TFields extends object = FieldsType> = {
  [field in FieldNameType<TFields>]?:
    | PrimitiveType
    | WhereOperatorType
    | WhereType<TFields>
    | Array<WhereType<TFields>>
    | undefined
} & {
  and?: WhereType<TFields> | Array<WhereType<TFields>>
  or?: WhereType<TFields> | Array<WhereType<TFields>>
}
export type FindOrderDirectionType = 'ASC' | 'DESC'
export type FindOrderType<TFields extends object = FieldsType> =
  | FieldNameType<TFields>
  | [FieldNameType<TFields>, FindOrderDirectionType]
  | Array<[FieldNameType<TFields>, FindOrderDirectionType]>
export type FindAttributesType<TFields extends object = FieldsType> =
  | Array<FieldNameType<TFields>>
  | {
      include?: Array<FieldNameType<TFields>>
      exclude?: Array<FieldNameType<TFields>>
    }
export type FindOptionsType<TFields extends object = FieldsType> = {
  where?: WhereType<TFields>
  offset?: number
  limit?: number
  page?: number
  order?: FindOrderType<TFields>
  index?: string
  attributes?: FindAttributesType<TFields>
}
export type CountOptionsType<TFields extends object = FieldsType> = {
  where?: WhereType<TFields>
  field?: FieldNameType<TFields>
  distinct: boolean
  index?: string
}

export const YdbDataType = DATA_TYPE_KEY_MAP
export type YdbDataTypeType = typeof YdbDataType
export type YdbDataTypeKey = (typeof DATA_TYPE_KEY_MAP)[keyof YdbDataTypeType]
export type YdbDataTypeId = (typeof DATA_TYPE_ID_MAP)[keyof YdbDataTypeType]
export type YdbDataTypeWithOption = {
  type: YdbDataTypeKey
  index?: boolean
  drop?: boolean
  renamed?: string
}
export type YdbSchemaFieldType = Record<
  string,
  YdbDataTypeKey | YdbDataTypeWithOption
>
export type YdbSchemaOptionType = {
  tableName?: string
  primaryKey?: string
  strict?: boolean
}
export type YdbSchemaType =
  | YdbSchemaFieldType
  | { field: YdbSchemaFieldType; option?: YdbSchemaOptionType }
export type YdbQueryResult = Array<FieldsType>

export interface YdbModelType<TFields extends object = FieldsType> {
  model: YdbModelConstructorType

  save(): Promise<this>
  delete(): Promise<void>
  update(fields: Partial<TFields>): Promise<this>
  reload(): Promise<this | null>
  increment(field: string, options?: { by?: number }): Promise<void>

  toJson(): TFields
}

export type YdbModelInstance<T extends YdbModelType> = T &
  (T extends YdbModelType<infer TFields> ? TFields : FieldsType)
export type YdbModelFields<T extends YdbModelType> =
  T extends YdbModelType<infer TFields> ? TFields : FieldsType

// dirty solution: https://github.com/microsoft/TypeScript/issues/5863
type ThisConstructorType<T extends YdbModelType> = new (
  fields: Partial<YdbModelFields<T>>,
) => T

export interface YdbModelConstructorType<
  TInstance extends YdbModelType = YdbModelType,
> {
  // biome-ignore lint/suspicious/noExplicitAny: model constructors own their field input shape
  new (...args: any[]): TInstance

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

  build<T extends YdbModelType>(
    this: ThisConstructorType<T>,
    fields?: Partial<YdbModelFields<T>>,
  ): YdbModelInstance<T>
  create<T extends YdbModelType>(
    this: ThisConstructorType<T>,
    fields?: Partial<YdbModelFields<T>>,
  ): Promise<YdbModelInstance<T>>
  query<T extends YdbModelType>(
    this: ThisConstructorType<T>,
    sql: string,
    params?: Record<string, PrimitiveType>,
  ): Promise<Array<YdbModelInstance<T>>>
  copy(from: string, to: string): Promise<void>
  count(options?: CountOptionsType<YdbModelFields<TInstance>>): Promise<bigint>
  find<T extends YdbModelType>(
    this: ThisConstructorType<T>,
    options?: FindOptionsType<YdbModelFields<T>>,
  ): Promise<Array<YdbModelInstance<T>>>
  findAll<T extends YdbModelType>(
    this: ThisConstructorType<T>,
    options?: FindOptionsType<YdbModelFields<T>>,
  ): Promise<Array<YdbModelInstance<T>>>
  findByPk<T extends YdbModelType>(
    this: ThisConstructorType<T>,
    pk: string,
  ): Promise<YdbModelInstance<T> | null>
  findOne<T extends YdbModelType>(
    this: ThisConstructorType<T>,
    options: Pick<
      FindOptionsType<YdbModelFields<T>>,
      'where' | 'order' | 'index' | 'attributes'
    >,
  ): Promise<YdbModelInstance<T> | null>
  update(
    fields: Partial<YdbModelFields<TInstance>>,
    options: { where: WhereType<YdbModelFields<TInstance>> },
  ): Promise<void>
  destroy(options: {
    where: WhereType<YdbModelFields<TInstance>>
  }): Promise<void>
  drop(): Promise<void>
}

export type YdbModelsObjectType = Record<string, YdbModelConstructorType>
export type YdbModelsOptionType = YdbModelsObjectType

export type YdbOptionType<
  TModels extends YdbModelsOptionType = YdbModelsObjectType,
> = {
  endpoint?: string
  database?: string
  connectionString?: string

  token?: string
  credential?: {
    serviceAccountId: string
    accessKeyId: string
    privateKey: Buffer
    iamEndpoint: string
  }

  models?: TModels

  logger?: BaseLogger
  timeout?: number
  ssl?: SecureContextOptions
  meta?: boolean

  debug?: boolean
}

export interface YdbModelRegistryType {
  [key: string]: YdbModelConstructorType
}

export type YdbRegistryFromModels<TModels extends YdbModelsObjectType> =
  keyof TModels extends never ? YdbModelRegistryType : TModels

export interface YdbType<
  TRegistry extends YdbModelRegistryType = YdbModelRegistryType,
> {
  logger: BaseLogger
  model: TRegistry

  sql(sql: string, params?: Record<string, JSValue>): Promise<YdbQueryResult>
  transaction<T>(
    callback: (tx: YdbTransactionType, signal: AbortSignal) => Promise<T> | T,
    options?: YdbTransactionOptionsType,
  ): Promise<T>
  connect(): Promise<void>
  wait(timeout?: number): Promise<void>
  close(): Promise<void>
  sync(): Promise<void>
  load(model: YdbModelConstructorType): void
  api(): YdbApi

  debug: boolean
}

export interface YdbConstructorType {
  new (option: YdbOptionType): YdbType
  get db(): YdbType
  init: {
    <TModels extends YdbModelsObjectType>(
      option: YdbOptionType<TModels> & { models: TModels },
    ): YdbType<YdbRegistryFromModels<TModels>>
    (option?: YdbOptionType): YdbType
  }
}

export type RawDataType = {
  uint8Value?: number
  uint32Value?: number
  uint64Value?: Long
  int8Value?: number
  int32Value?: number
  int64Value?: Long
  doubleValue?: number
  boolValue?: boolean
  nullFlagValue?: null
  bytesValue?: Buffer
  textValue?: string
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

export type YdbTransactionOptionsType = {
  isolation?: 'serializableReadWrite' | 'snapshotReadOnly' | 'snapshotReadWrite'
  idempotent?: boolean
  signal?: AbortSignal
}

export type YdbTransactionType = {
  logger: BaseLogger
  debug: boolean
  sql(sql: string, params?: Record<string, JSValue>): Promise<YdbQueryResult>
}

export type YdbResultType = {
  columns: Array<YdbColumnType>
  rows: Array<{ items: Array<RawDataType> }>
}

export type YdbErrorType = YDBError
