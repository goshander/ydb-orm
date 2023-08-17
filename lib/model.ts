import { DEFAULT_PRIMARY_KEY } from './constant'
import { convert } from './convert'
import { escape } from './escape'
import {

  PrimitiveType, WhereType, YdbModelConstructorType, YdbModelType, YdbResultType,
  YdbSchemaFieldType, YdbSchemaOptionType, YdbSchemaType, YdbType,
} from './type'
import { where } from './where'

export const YdbModel: YdbModelConstructorType = class YdbModel implements YdbModelType {
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

  static get ctx() { return this._ctx }

  static setCtx(ctx: YdbType) {
    this._ctx = ctx
  }

  static get className() { return this.name }

  static get fields() {
    if (this.schema.field) return this.schema.field as YdbSchemaFieldType
    return this.schema as YdbSchemaFieldType
  }

  static get primaryKey() {
    if (this._primaryKey) return this._primaryKey

    const schemaOption = this.schema.field && this.schema.option ? this.schema.option as YdbSchemaOptionType : {}
    if (schemaOption.primaryKey) {
      this._primaryKey = schemaOption.primaryKey
    } else {
      this._primaryKey = DEFAULT_PRIMARY_KEY
    }

    return this._primaryKey
  }

  static get tableName() {
    if (this._tableName) return this._tableName

    this._tableName = this.className[0].toLowerCase()
      + this.className
        .slice(1, this.className.length)
        .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

    return this._tableName
  }

  static async copy(from: string, to: string) {
    const { ctx, tableName } = this

    await ctx.session(async (session) => {
      const yql = `UPDATE ${tableName} SET ${to} = ${from};`

      await session.executeQuery(yql)
    })
  }

  static async count(options: { where?: WhereType, field: string, distinct: boolean } = { distinct: false, field: '' }) {
    const { ctx, primaryKey, tableName } = this

    const result = await ctx.session(async (session) => {
      let cField = options.field
      if (cField === undefined) cField = primaryKey

      if (options.distinct) cField = `DISTINCT ${cField}`

      let yql = `SELECT COUNT(${cField}) as count FROM ${tableName}`

      if (options.where) {
        yql = `${yql} ${where(options.where)}`
      }

      yql = `${yql};`

      const { resultSets } = await session.executeQuery(yql)

      return resultSets[0]
    })
    const typedResult = result as YdbResultType

    const count = convert(typedResult.rows[0].items[0], typedResult.columns[0].type) as number

    return count
  }

  static async find<T extends YdbModelType>(
    this: new (fields: Record<string, PrimitiveType>)=> T,
    options: { where?: WhereType, offset?: number, limit?: number, page?: number, order?: string } = {},
  ) {
    const { ctx, tableName, fields } = this as unknown as YdbModelConstructorType

    const result = await ctx.session(async (session) => {
      let yql = `SELECT * FROM ${tableName}`

      if (options.where) {
        yql = `${yql} ${where(options.where)}`
      }
      if (options.order && fields[options.order]) {
        yql = `${yql} ORDER BY ${options.order} DESC`
      }
      if (options.limit) {
        yql = `${yql} LIMIT ${options.limit}`
      }
      if (options.offset) {
        yql = `${yql} OFFSET ${options.offset}`
      }
      if (options.page && options.limit && !options.offset) {
        yql = `${yql} OFFSET ${(options.page - 1) * options.limit}`
      }

      yql = `${yql};`

      const { resultSets } = await session.executeQuery(yql)

      return resultSets[0]
    })

    const out: Array<T> = []

    const typedResult = result as YdbResultType
    typedResult.rows.forEach((r) => {
      const data: Record<string, PrimitiveType> = {}
      typedResult.columns.forEach((c, ind) => {
        data[c.name] = convert(r.items[ind], c.type)
      })

      out.push(new this(data))
    })

    return out
  }

  static async findByPk<T extends YdbModelType>(this: new (fields: Record<string, PrimitiveType>)=> T, pk: string) {
    const { primaryKey } = this as unknown as YdbModelConstructorType

    const out = await YdbModel.find.bind(this)({
      where: {
        [primaryKey]: pk,
      },
      limit: 1,
    })

    return out[0] as unknown as T || null
  }

  static async findOne<T extends YdbModelType>(
    this: new (fields: Record<string, PrimitiveType>)=> T,
    options: { where?: WhereType, order?: string } = { },
  ) {
    const out = await YdbModel.find.bind(this)({
      where: options.where,
      order: options.order,
      limit: 1,
    })

    return out[0] as unknown as T || null
  }

  static async update(data: Record<string, PrimitiveType>, options: { where: WhereType }) {
    const { ctx, tableName } = this

    await ctx.session(async (session) => {
      const set = Object.keys(data).map((c) => `${c} = ${escape(data[c])}`).join(', ')

      let yql = `UPDATE ${tableName} SET ${set}`

      yql = `${yql} ${where(options.where)}`

      yql = `${yql};`

      await session.executeQuery(yql)
    })
  }

  get model() { return (this.constructor as YdbModelConstructorType) }

  async save() {
    const { ctx, tableName } = this.model

    await ctx.session(async (session) => {
      const table = await session.describeTable(tableName)
      const columns = table.columns.map((c) => {
        if (!c.name) throw Error(`ydb: column of table \`${tableName}\` has null name`)
        return c.name
      })

      const values = columns.map((c) => escape(this[c] as PrimitiveType)).join(', ')

      const yql = `UPSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});`

      await session.executeQuery(yql)
    })
    return this
  }

  async delete() {
    const { ctx, primaryKey, tableName } = this.model

    await ctx.session(async (session) => {
      const key = escape(this[primaryKey] as string)

      const yql = `DELETE FROM ${tableName} WHERE ${primaryKey} = ${key};`

      await session.executeQuery(yql)
    })
  }

  async increment(field: string, options: { by?: number } = {}) {
    const { ctx, primaryKey, tableName } = this.model

    const result = await ctx.session(async (session) => {
      const key = escape(this[primaryKey] as string)

      const incBy = options.by || 1

      const set = `${field} = ${field} + ${incBy}`

      const yql = `UPDATE ${tableName} SET ${set} WHERE ${primaryKey} = ${key};`

      await session.executeQuery(yql)

      const { resultSets } = await session.executeQuery(
        `SELECT ${field} FROM ${tableName} WHERE ${primaryKey} = ${key};`,
      )

      return resultSets[0]
    })
    const typedResult = result as YdbResultType

    this[field] = convert(typedResult.rows[0].items[0], typedResult.columns[0].type)
  }

  toJson() {
    const json: Record<string, PrimitiveType> = {}
    Object.keys(this.model.fields).forEach((key: string) => {
      json[key] = this[key] as PrimitiveType
    })

    return json
  }
}
