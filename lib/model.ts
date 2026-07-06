/** biome-ignore-all lint/complexity/noThisInStatic: constructor or instance as expected */
import { DEFAULT_PRIMARY_KEY } from './constant'
import type {
  PrimitiveType,
  WhereType,
  YdbModelConstructorType,
  YdbModelType,
  YdbSchemaFieldType,
  YdbSchemaOptionType,
  YdbSchemaType,
  YdbType,
} from './type'
import { where } from './where'

export const YdbModel: YdbModelConstructorType = class YdbModel
  implements YdbModelType
{
  [field: string]: unknown

  constructor(fields: Record<string, PrimitiveType>) {
    Object.keys(fields).forEach((key) => {
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

  static async copy(from: string, to: string) {
    const { ctx, tableName } = this

    await ctx.sql(`UPDATE ${tableName} SET ${to} = ${from};`)
  }

  static async count(
    options:
      | { where?: WhereType; field?: string; distinct: boolean; index?: string }
      | undefined = { distinct: false },
  ) {
    const { ctx, primaryKey, tableName } = this

    let cField = options?.field
    if (cField === undefined) cField = primaryKey

    if (options?.distinct) cField = `DISTINCT ${cField}`

    let queryText = `SELECT COUNT(${cField}) as count FROM ${tableName}`

    if (options?.index) {
      queryText = `${queryText} VIEW ${options.index}`
    }

    const params: Record<string, PrimitiveType> = {}

    if (options?.where) {
      const { clause, params: whereParams } = where(options.where)
      queryText = `${queryText} ${clause}`
      Object.assign(params, whereParams)
    }

    queryText = `${queryText};`

    const result = await ctx.sql(queryText, params)

    return result[0].count as bigint
  }

  static async find<T extends YdbModelType>(
    this: new (
      fields: Record<string, PrimitiveType>,
    ) => T,
    options: {
      where?: WhereType
      offset?: number
      limit?: number
      page?: number
      order?: string
      index?: string
    } = {},
  ) {
    const { ctx, tableName, fields } =
      this as unknown as YdbModelConstructorType

    let queryText = `SELECT * FROM ${tableName}`

    if (options.index) {
      queryText = `${queryText} VIEW ${options.index}`
    }

    const params: Record<string, PrimitiveType> = {}

    if (options.where) {
      const { clause, params: whereParams } = where(options.where)
      queryText = `${queryText} ${clause}`
      Object.assign(params, whereParams)
    }

    if (options.order && fields[options.order]) {
      queryText = `${queryText} ORDER BY ${options.order} DESC`
    }
    if (options.limit) {
      queryText = `${queryText} LIMIT ${options.limit}`
    }
    if (options.offset) {
      queryText = `${queryText} OFFSET ${options.offset}`
    }
    if (options.page && options.limit && !options.offset) {
      queryText = `${queryText} OFFSET ${(options.page - 1) * options.limit}`
    }

    queryText = `${queryText};`

    const result = await ctx.sql(queryText, params)

    const out: Array<T> = []
    ;(result as any[]).forEach((row: any) => {
      out.push(new this(row))
    })

    return out
  }

  static async findByPk<T extends YdbModelType>(
    this: new (
      fields: Record<string, PrimitiveType>,
    ) => T,
    pk: string,
  ) {
    const { primaryKey } = this as unknown as YdbModelConstructorType

    const out = await YdbModel.find.bind(this)({
      where: {
        [primaryKey]: pk,
      },
      limit: 1,
    })

    return (out[0] as unknown as T) || null
  }

  static async findOne<T extends YdbModelType>(
    this: new (
      fields: Record<string, PrimitiveType>,
    ) => T,
    options: { where?: WhereType; order?: string; index?: string } = {},
  ) {
    const out = await YdbModel.find.bind(this)({
      where: options.where,
      order: options.order,
      index: options.index,
      limit: 1,
    })

    return (out[0] as unknown as T) || null
  }

  static async update(
    data: Record<string, PrimitiveType>,
    options: { where: WhereType },
  ) {
    const { ctx, tableName } = this

    const setParams: Record<string, PrimitiveType> = {}
    const setClauses: string[] = []

    // Создаем SET часть с параметрами
    Object.keys(data).forEach((column, index) => {
      const paramName = `set_${column}_${index}`
      setClauses.push(`${column} = $${paramName}`)
      setParams[paramName] = data[column]
    })

    const { clause: whereClause, params: whereParams } = where(
      options.where,
      'update',
    )

    const queryText = `UPDATE ${tableName} SET ${setClauses.join(', ')} ${whereClause};`

    // Объединяем все параметры
    const allParams = { ...setParams, ...whereParams }

    await ctx.sql(queryText, allParams)
  }

  get model() {
    return this.constructor as YdbModelConstructorType
  }

  async save() {
    const { ctx, tableName } = this.model

    const schema = this.model.fields
    const columns = Object.keys(schema)

    const params: Record<string, PrimitiveType> = {}
    const paramNames: string[] = []

    columns.forEach((column, index) => {
      const paramName = `param_${index}`
      paramNames.push(`$${paramName}`)
      params[paramName] = this[column] as PrimitiveType
    })

    const queryText = `UPSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${paramNames.join(', ')});`

    await ctx.sql(queryText, params)

    return this
  }

  async delete() {
    const { ctx, primaryKey, tableName } = this.model
    const pKeyValue = this[primaryKey] as PrimitiveType

    await ctx.sql(
      `DELETE FROM ${tableName} WHERE ${primaryKey} = $primaryKey;`,
      {
        primaryKey: pKeyValue,
      },
    )
  }

  async increment(field: string, options: { by?: number } = {}) {
    const { ctx, primaryKey, tableName } = this.model
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

    return json
  }

  static async drop() {
    const { ctx, tableName } = this
    await ctx.sql(`DROP TABLE ${tableName};`)
  }
}
