import { convert } from './convert'
import { escape } from './escape'
import {
  PrimitiveType, WhereType, YdbBaseModel, YdbBaseType, YdbResultType, YdbSchemaFieldType, YdbSchemaType,
} from './type'
import { where } from './where'

export class YdbModel implements YdbBaseModel {
  [field: string]: unknown

  private static _tableName: string
  private static _ctx: YdbBaseType

  get base() { return (this.constructor as typeof YdbModel) }

  static primaryKey = 'id'
  get primaryKey() { return this.base.primaryKey }

  static schema: YdbSchemaType
  get schema() { return this.base.schema }

  static get fields() {
    if (this.schema.field) return this.schema.field as YdbSchemaFieldType
    return this.schema as YdbSchemaFieldType
  }
  get fields() { return this.base.fields }

  static get className() { return this.name }
  get className() { return this.base.className }

  static get tableName() {
    if (this._tableName) return this._tableName

    this._tableName = this.className[0].toLowerCase()
      + this.className
        .slice(1, this.className.length)
        .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

    return this._tableName
  }
  get tableName() { return this.base.tableName }

  get ctx() { return this.base._ctx }
  static get ctx() { return this._ctx }
  static setCtx(ctx: YdbBaseType) {
    this._ctx = ctx
  }

  constructor(fields: Record<string, PrimitiveType>) {
    Object.keys(fields).forEach((key) => {
      this[key] = fields[key]
    })
  }

  static async copy(from: string, to: string) {
    await this.ctx.session(async (session) => {
      const yql = `UPDATE ${this.tableName} SET ${to} = ${from};`

      await session.executeQuery(yql)
    })
  }

  static async count(options: { where?: WhereType, field: string, distinct: boolean } = { distinct: false, field: '' }) {
    const result = await this.ctx.session(async (session) => {
      let cField = options.field
      if (cField === undefined) cField = this.primaryKey

      if (options.distinct) cField = `DISTINCT ${cField}`

      let yql = `SELECT COUNT(${cField}) as count FROM ${this.tableName}`

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

  static async find(options: { where?: WhereType, offset?: number, limit?: number, page?: number, order?: string } = {}) {
    const result = await this.ctx.session(async (session) => {
      let yql = `SELECT * FROM ${this.tableName}`

      if (options.where) {
        yql = `${yql} ${where(options.where)}`
      }
      if (options.order && this.fields[options.order]) {
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

    const out: Array<YdbModel> = []

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

  static async findByPk(pk: string) {
    const out = await this.find({
      where: {
        [this.primaryKey]: pk,
      },
      limit: 1,
    })

    return out[0] || null
  }

  static async findOne(options: { where?: WhereType, order?: string } = { }) {
    const out = await this.find({
      where: options.where,
      order: options.order,
      limit: 1,
    })

    return out[0] || null
  }

  static async update(data: Record<string, PrimitiveType>, options: { where: WhereType }) {
    await this.ctx.session(async (session) => {
      const set = Object.keys(data).map((c) => `${c} = ${escape(data[c])}`).join(', ')

      let yql = `UPDATE ${this.tableName} SET ${set}`

      yql = `${yql} ${where(options.where)}`

      yql = `${yql};`

      await session.executeQuery(yql)
    })
  }

  async save() {
    await this.ctx.session(async (session) => {
      const table = await session.describeTable(this.tableName)
      const columns = table.columns.map((c) => {
        if (!c.name) throw Error(`ydb: column of table \`${this.tableName}\` has null name`)
        return c.name
      })

      const values = columns.map((c) => escape(this[c] as PrimitiveType)).join(', ')

      const yql = `UPSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${values});`

      await session.executeQuery(yql)
    })
    return this
  }

  async delete() {
    await this.ctx.session(async (session) => {
      const key = escape(this[this.primaryKey] as string)

      const yql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ${key};`

      await session.executeQuery(yql)
    })
  }

  async increment(field: string, options: { by?: number } = { }) {
    const result = await this.ctx.session(async (session) => {
      const key = escape(this[this.primaryKey] as string)

      const incBy = options.by || 1

      const set = `${field} = ${field} + ${incBy}`

      const yql = `UPDATE ${this.tableName} SET ${set} WHERE ${this.primaryKey} = ${key};`

      await session.executeQuery(yql)

      const { resultSets } = await session.executeQuery(
        `SELECT ${field} FROM ${this.tableName} WHERE ${this.primaryKey} = ${key};`,
      )

      return resultSets[0]
    })
    const typedResult = result as YdbResultType

    this[field] = convert(typedResult.rows[0].items[0], typedResult.columns[0].type)
  }

  toJson() {
    const json: Record<string, PrimitiveType> = {}
    Object.keys(this.fields).forEach((key: string) => {
      json[key] = this[key] as PrimitiveType
    })

    return json
  }
}

export type YdbModelType = typeof YdbModel
export type YdbModelInstance = InstanceType<YdbModelType>
