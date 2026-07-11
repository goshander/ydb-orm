/** biome-ignore-all lint/complexity/noThisInStatic: constructor or instance as expected */
import { DEFAULT_PRIMARY_KEY } from './constant.js'
import {
  assertIdentifier,
  assertLimit,
  assertOffset,
  assertPage,
  assertSchemaField,
  exportAttributes,
  exportOrder,
  exportWhere,
} from './query.js'
import type {
  CountOptionsType,
  FindOptionsType,
  PrimitiveType,
  WhereType,
  YdbModelConstructorType,
  YdbModelFields,
  YdbModelInstance,
  YdbModelType,
  YdbSchemaFieldType,
  YdbSchemaOptionType,
  YdbSchemaType,
  YdbType,
} from './type.js'

export class YdbModel<TFields extends object = Record<string, PrimitiveType>>
  implements YdbModelType<TFields>
{
  [field: string]: unknown

  constructor(fields: Partial<Record<string, PrimitiveType>> = {}) {
    const schema = (this.constructor as YdbModelConstructorType).fields

    Object.keys(fields).forEach((key) => {
      assertSchemaField(schema, key)
      this[key] = fields[key]
    })
  }

  static _tableName: string
  static _primaryKey: string
  static _ctx: YdbType

  static schema: YdbSchemaType

  static get ctx() {
    return this._ctx
  }

  static setCtx(ctx: YdbType) {
    this._ctx = ctx
  }

  static get className() {
    return this.name
  }

  static get fields() {
    if (this.schema.field) return this.schema.field as YdbSchemaFieldType
    return this.schema as YdbSchemaFieldType
  }

  static get primaryKey() {
    if (this._primaryKey) return this._primaryKey

    const schemaOption =
      this.schema.field && this.schema.option
        ? (this.schema.option as YdbSchemaOptionType)
        : {}
    if (schemaOption.primaryKey) {
      this._primaryKey = schemaOption.primaryKey
    } else {
      this._primaryKey = DEFAULT_PRIMARY_KEY
    }

    return this._primaryKey
  }

  static get tableName() {
    if (this._tableName) return this._tableName

    const schemaOption =
      this.schema.field && this.schema.option
        ? (this.schema.option as YdbSchemaOptionType)
        : {}

    if (schemaOption.tableName) {
      this._tableName = schemaOption.tableName
    } else {
      this._tableName =
        this.className[0].toLowerCase() +
        this.className
          .slice(1, this.className.length)
          .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    }

    return this._tableName
  }

  static build<T extends YdbModelType>(
    this: new (
      fields?: Partial<YdbModelFields<T>>,
    ) => T,
    fields: Partial<YdbModelFields<T>> = {},
  ) {
    return new this(fields) as YdbModelInstance<T>
  }

  static async create<T extends YdbModelType>(
    this: new (
      fields?: Partial<YdbModelFields<T>>,
    ) => T,
    fields: Partial<YdbModelFields<T>> = {},
  ) {
    const instance = new this(fields) as YdbModelInstance<T>
    await instance.save()
    return instance
  }

  static async query<T extends YdbModelType>(
    this: new (
      fields: Partial<YdbModelFields<T>>,
    ) => T,
    sql: string,
    params?: Record<string, PrimitiveType>,
  ) {
    const { ctx } = this as unknown as YdbModelConstructorType
    const result = await ctx.sql(sql, params)

    return (result as Array<Record<string, PrimitiveType>>).map(
      (row) =>
        new this(row as Partial<YdbModelFields<T>>) as YdbModelInstance<T>,
    )
  }

  static async copy(from: string, to: string) {
    const { ctx, tableName, fields } = this

    assertIdentifier(tableName, 'table name')
    assertIdentifier(from, 'field')
    assertSchemaField(fields, to)

    await ctx.sql(`UPDATE ${tableName} SET ${to} = ${from};`)
  }

  static async count<T extends YdbModelType>(
    this: YdbModelConstructorType<T>,
    options: CountOptionsType<YdbModelFields<T>> | undefined = {
      distinct: false,
    },
  ) {
    const { ctx, primaryKey, tableName, fields } = this

    assertIdentifier(tableName, 'table name')

    let cField: string = options?.field || primaryKey
    assertSchemaField(fields, cField)

    if (options?.distinct) cField = `DISTINCT ${cField}`

    let queryText = `SELECT COUNT(${cField}) as count FROM ${tableName}`

    if (options?.index) {
      assertIdentifier(options.index, 'index')
      queryText = `${queryText} VIEW ${options.index}`
    }

    const params: Record<string, PrimitiveType> = {}

    if (options?.where) {
      const { clause, params: whereParams } = exportWhere(fields, options.where)
      queryText = `${queryText} ${clause}`
      Object.assign(params, whereParams)
    }

    queryText = `${queryText};`

    const result = await ctx.sql(queryText, params)

    return result[0].count as bigint
  }

  static async find<T extends YdbModelType>(
    this: new (
      fields: Partial<YdbModelFields<T>>,
    ) => T,
    options: FindOptionsType<YdbModelFields<T>> = {},
  ) {
    const { ctx, tableName, fields } =
      this as unknown as YdbModelConstructorType

    assertIdentifier(tableName, 'table name')

    let queryText = `SELECT ${exportAttributes(fields, options.attributes)} FROM ${tableName}`

    if (options.index) {
      assertIdentifier(options.index, 'index')
      queryText = `${queryText} VIEW ${options.index}`
    }

    const params: Record<string, PrimitiveType> = {}

    if (options.where) {
      const { clause, params: whereParams } = exportWhere(fields, options.where)
      queryText = `${queryText} ${clause}`
      Object.assign(params, whereParams)
    }

    const orderSql = exportOrder(fields, options.order)
    if (orderSql) {
      queryText = `${queryText} ${orderSql}`
    }
    if (options.limit !== undefined) {
      assertLimit(options.limit)
      queryText = `${queryText} LIMIT ${options.limit}`
    }
    if (options.offset !== undefined) {
      assertOffset(options.offset)
      queryText = `${queryText} OFFSET ${options.offset}`
    }
    if (options.page !== undefined) {
      assertPage(options.page)
    }
    if (
      options.page !== undefined &&
      options.limit !== undefined &&
      options.offset === undefined
    ) {
      queryText = `${queryText} OFFSET ${(options.page - 1) * options.limit}`
    }

    queryText = `${queryText};`

    const result = await ctx.sql(queryText, params)

    const out: Array<YdbModelInstance<T>> = []
    ;(result as Array<Record<string, PrimitiveType>>).forEach((row) => {
      out.push(
        new this(row as Partial<YdbModelFields<T>>) as YdbModelInstance<T>,
      )
    })

    return out
  }

  static async findByPk<T extends YdbModelType>(
    this: new (
      fields: Partial<YdbModelFields<T>>,
    ) => T,
    pk: string,
  ) {
    const { primaryKey } = this as unknown as YdbModelConstructorType

    const find = YdbModel.find as unknown as (
      this: new (
        fields: Partial<YdbModelFields<T>>,
      ) => T,
      options: FindOptionsType<YdbModelFields<T>>,
    ) => Promise<Array<YdbModelInstance<T>>>

    const out = await find.call(this, {
      where: {
        [primaryKey]: pk,
      } as WhereType<YdbModelFields<T>>,
      limit: 1,
    })

    return (out[0] as unknown as YdbModelInstance<T>) || null
  }

  static async findOne<T extends YdbModelType>(
    this: new (
      fields: Partial<YdbModelFields<T>>,
    ) => T,
    options: Pick<
      FindOptionsType<YdbModelFields<T>>,
      'where' | 'order' | 'index' | 'attributes'
    > = {},
  ) {
    const find = YdbModel.find as unknown as (
      this: new (
        fields: Partial<YdbModelFields<T>>,
      ) => T,
      options: FindOptionsType<YdbModelFields<T>>,
    ) => Promise<Array<YdbModelInstance<T>>>

    const out = await find.call(this, {
      where: options.where,
      order: options.order,
      index: options.index,
      attributes: options.attributes,
      limit: 1,
    })

    return (out[0] as unknown as YdbModelInstance<T>) || null
  }

  static findAll = this.find

  static async update<T extends YdbModelType>(
    this: YdbModelConstructorType<T>,
    data: Partial<YdbModelFields<T>>,
    options: { where: WhereType<YdbModelFields<T>> },
  ) {
    const { ctx, tableName, fields } = this

    assertIdentifier(tableName, 'table name')

    const setParams: Record<string, PrimitiveType> = {}
    const setClauses: string[] = []

    // Создаем SET часть с параметрами
    Object.keys(data).forEach((column, index) => {
      assertSchemaField(fields, column)

      const value = data[column as keyof YdbModelFields<T>]
      if (value === undefined) return

      const paramName = `set_${column}_${index}`
      setClauses.push(`${column} = $${paramName}`)
      setParams[paramName] = value as PrimitiveType
    })

    if (setClauses.length === 0) {
      throw new Error('ydb: update requires at least one field')
    }

    const { clause: whereClause, params: whereParams } = exportWhere(
      fields,
      options.where,
      'update',
    )

    if (!whereClause) {
      throw new Error('ydb: update requires a non-empty where clause')
    }

    const queryText = `UPDATE ${tableName} SET ${setClauses.join(', ')} ${whereClause};`

    // Объединяем все параметры
    const allParams = { ...setParams, ...whereParams }

    await ctx.sql(queryText, allParams)
  }

  static async destroy<T extends YdbModelType>(
    this: YdbModelConstructorType<T>,
    options: { where: WhereType<YdbModelFields<T>> },
  ) {
    const { ctx, tableName, fields } = this
    const { clause, params } = exportWhere(fields, options.where, 'destroy')

    assertIdentifier(tableName, 'table name')

    if (!clause) {
      throw new Error('ydb: destroy requires a non-empty where clause')
    }

    await ctx.sql(`DELETE FROM ${tableName} ${clause};`, params)
  }

  get model() {
    return this.constructor as YdbModelConstructorType
  }

  async save() {
    const { ctx, tableName } = this.model

    assertIdentifier(tableName, 'table name')

    const schema = this.model.fields
    const columns = Object.keys(schema)

    const params: Record<string, PrimitiveType> = {}
    const paramNames: string[] = []

    columns.forEach((column, index) => {
      assertSchemaField(schema, column)

      const paramName = `param_${index}`
      paramNames.push(`$${paramName}`)
      params[paramName] = this[column] as PrimitiveType
    })

    const queryText = `UPSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${paramNames.join(', ')});`

    await ctx.sql(queryText, params)

    return this
  }

  async delete() {
    const { ctx, primaryKey, tableName, fields } = this.model

    assertIdentifier(tableName, 'table name')
    assertSchemaField(fields, primaryKey)

    const pKeyValue = this[primaryKey] as PrimitiveType

    await ctx.sql(
      `DELETE FROM ${tableName} WHERE ${primaryKey} = $primaryKey;`,
      {
        primaryKey: pKeyValue,
      },
    )
  }

  async update(fields: Partial<TFields>) {
    const schema = this.model.fields
    const fieldNames = Object.keys(fields)
    fieldNames.forEach((field) => assertSchemaField(schema, field))
    fieldNames.forEach((field) => {
      this[field] = fields[field as keyof TFields]
    })
    await this.save()
    return this
  }

  async reload() {
    const { primaryKey } = this.model
    const pKeyValue = this[primaryKey] as string
    const fresh = await this.model.findByPk(pKeyValue)

    if (fresh === null) {
      return null
    }

    Object.assign(this, fresh.toJson())
    return this
  }

  async increment(field: string, options: { by?: number } = {}) {
    const { ctx, primaryKey, tableName, fields } = this.model

    assertIdentifier(tableName, 'table name')
    assertSchemaField(fields, primaryKey)
    assertSchemaField(fields, field)

    const pKeyValue = this[primaryKey] as PrimitiveType

    await ctx.sql(
      `UPDATE ${tableName}
        SET ${field} = ${field} + $incBy
        WHERE ${primaryKey} = $primaryKey;`,
      {
        primaryKey: pKeyValue,
        incBy: options.by || 1,
      },
    )

    const result = await ctx.sql(
      `SELECT ${field}
        FROM ${tableName}
        WHERE ${primaryKey} = $primaryKey;`,
      {
        primaryKey: pKeyValue,
      },
    )

    this[field] = result[0][field]
  }

  toJson() {
    const json: Record<string, PrimitiveType> = {}
    Object.keys(this.model.fields).forEach((key: string) => {
      json[key] = this[key] as PrimitiveType
    })

    return json as TFields
  }

  static async drop() {
    const { ctx, tableName } = this

    assertIdentifier(tableName, 'table name')

    await ctx.sql(`DROP TABLE ${tableName};`)
  }
}
