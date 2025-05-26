import { fromJs } from '@ydbjs/value'

import { DEFAULT_PRIMARY_KEY } from './constant'
import {
  PrimitiveType, WhereType, YdbModelConstructorType, YdbModelType,
  YdbSchemaFieldType, YdbSchemaOptionType, YdbSchemaType, YdbType,
} from './type'

// Функция для создания WHERE условий с параметрами
const buildWhereClause = (whereConditions: WhereType, paramPrefix: string = 'where') => {
  const conditions: string[] = []
  const params: Record<string, any> = {}
  let paramIndex = 0

  Object.keys(whereConditions).forEach((field) => {
    const condition = whereConditions[field]

    if (Array.isArray(condition)) {
      // IN условие
      const paramName = `$${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} IN ${paramName}`)
      params[paramName] = fromJs(condition)
    } else if (typeof condition === 'object' && condition !== null && 'like' in condition) {
      // LIKE условие
      const paramName = `$${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} LIKE ${paramName}`)
      params[paramName] = fromJs(`%${condition.like}%`)
    } else {
      // Обычное равенство
      const paramName = `$${paramPrefix}_${field}_${paramIndex}`
      paramIndex += 1
      conditions.push(`${field} = ${paramName}`)
      params[paramName] = fromJs(condition)
    }
  })

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

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

    const schemaOption = this.schema.field && this.schema.option ? this.schema.option as YdbSchemaOptionType : {}

    if (schemaOption.tableName) {
      this._tableName = schemaOption.tableName
    } else {
      this._tableName = this.className[0].toLowerCase()
      + this.className
        .slice(1, this.className.length)
        .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    }

    return this._tableName
  }

  static async copy(from: string, to: string) {
    const { ctx, tableName } = this

    await ctx.session(async (queryClient) => {
      const query = queryClient`UPDATE ${queryClient.identifier(tableName)}
        SET ${queryClient.identifier(to)} = ${queryClient.identifier(from)};`
      await query
    })
  }

  static async count(options:
  { where?: WhereType, field?: string, distinct: boolean, index?: string } | undefined
  = { distinct: false }) {
    const { ctx, primaryKey, tableName } = this

    const result = await ctx.session(async (queryClient) => {
      let cField = options?.field
      if (cField === undefined) cField = primaryKey

      if (options?.distinct) cField = `DISTINCT ${cField}`

      let queryText = `SELECT COUNT(${cField}) as count FROM ${tableName}`

      if (options?.index) {
        queryText = `${queryText} VIEW ${options.index}`
      }

      const params: Record<string, any> = {}

      if (options?.where) {
        const { clause, params: whereParams } = buildWhereClause(options.where)
        queryText = `${queryText} ${clause}`
        Object.assign(params, whereParams)
      }

      queryText = `${queryText};`

      // Создаем запрос с параметрами
      let query = queryClient`${queryText}`

      // Добавляем параметры
      Object.keys(params).forEach((paramName) => {
        query = query.param(paramName.replace('$', ''), params[paramName])
      })

      const [[resultSet]] = await query
      return resultSet
    })

    return (result as any).count as number
  }

  static async find<T extends YdbModelType>(
    this: new (fields: Record<string, PrimitiveType>)=> T,
    options: { where?: WhereType, offset?: number, limit?: number, page?: number, order?: string, index?: string } = {},
  ) {
    const { ctx, tableName, fields } = this as unknown as YdbModelConstructorType

    const result = await ctx.session(async (queryClient) => {
      let queryText = `SELECT * FROM ${tableName}`

      if (options.index) {
        queryText = `${queryText} VIEW ${options.index}`
      }

      const params: Record<string, any> = {}

      if (options.where) {
        const { clause, params: whereParams } = buildWhereClause(options.where)
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

      // Создаем запрос с параметрами
      let query = queryClient`${queryText}`

      // Добавляем параметры
      Object.keys(params).forEach((paramName) => {
        query = query.param(paramName.replace('$', ''), params[paramName])
      })

      const [resultSet] = await query
      return resultSet
    })

    const out: Array<T> = [];
    (result as any[]).forEach((row: any) => {
      out.push(new this(row))
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
    options: { where?: WhereType, order?: string, index?: string } = { },
  ) {
    const out = await YdbModel.find.bind(this)({
      where: options.where,
      order: options.order,
      index: options.index,
      limit: 1,
    })

    return out[0] as unknown as T || null
  }

  static async update(data: Record<string, PrimitiveType>, options: { where: WhereType }) {
    const { ctx, tableName } = this

    await ctx.session(async (queryClient) => {
      const setParams: Record<string, any> = {}
      const setClauses: string[] = []

      // Создаем SET часть с параметрами
      Object.keys(data).forEach((column, index) => {
        const paramName = `set_${column}_${index}`
        setClauses.push(`${column} = $${paramName}`)
        setParams[`$${paramName}`] = fromJs(data[column])
      })

      const { clause: whereClause, params: whereParams } = buildWhereClause(options.where, 'update')

      const queryText = `UPDATE ${tableName} SET ${setClauses.join(', ')} ${whereClause};`

      // Создаем запрос с параметрами
      let query = queryClient`${queryText}`

      // Добавляем все параметры
      const allParams = { ...setParams, ...whereParams }
      Object.keys(allParams).forEach((paramName) => {
        query = query.param(paramName.replace('$', ''), allParams[paramName])
      })

      await query
    })
  }

  get model() { return (this.constructor as YdbModelConstructorType) }

  async save() {
    const { ctx, tableName } = this.model

    await ctx.session(async (queryClient) => {
      // Получаем описание таблицы для определения колонок
      const describeQuery = queryClient`DESCRIBE TABLE ${queryClient.identifier(tableName)};`
      await describeQuery

      // Извлекаем имена колонок (это упрощенная версия, в реальности нужно парсить результат)
      const columns = Object.keys(this.model.fields)

      const params: Record<string, any> = {}
      const paramNames: string[] = []

      columns.forEach((column, index) => {
        const paramName = `param_${index}`
        paramNames.push(`$${paramName}`)
        params[`$${paramName}`] = fromJs(this[column] as PrimitiveType)
      })

      const queryText = `UPSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${paramNames.join(', ')});`

      // Создаем запрос с параметрами
      let query = queryClient`${queryText}`

      // Добавляем параметры
      Object.keys(params).forEach((paramName) => {
        query = query.param(paramName.replace('$', ''), params[paramName])
      })

      await query
    })
    return this
  }

  async delete() {
    const { ctx, primaryKey, tableName } = this.model

    await ctx.session(async (queryClient) => {
      const keyParam = fromJs(this[primaryKey] as string)

      const query = queryClient`DELETE FROM ${queryClient.identifier(tableName)} WHERE ${queryClient.identifier(primaryKey)} = $key;`
        .param('key', keyParam)

      await query
    })
  }

  async increment(field: string, options: { by?: number } = {}) {
    const { ctx, primaryKey, tableName } = this.model

    const result = await ctx.session(async (queryClient) => {
      const keyParam = fromJs(this[primaryKey] as string)
      const incBy = options.by || 1

      const updateQuery = queryClient`UPDATE ${queryClient.identifier(tableName)}
        SET ${queryClient.identifier(field)} = ${queryClient.identifier(field)} + $incBy
        WHERE ${queryClient.identifier(primaryKey)} = $key;`
        .param('incBy', fromJs(incBy))
        .param('key', keyParam)

      await updateQuery

      const selectQuery = queryClient`SELECT ${queryClient.identifier(field)}
        FROM ${queryClient.identifier(tableName)}
        WHERE ${queryClient.identifier(primaryKey)} = $key;`
        .param('key', keyParam)

      const [resultSet] = await selectQuery
      return resultSet[0]
    })

    this[field] = (result as any)[field]
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

    await ctx.session(async (queryClient) => {
      const query = queryClient`DROP TABLE ${queryClient.identifier(tableName)};`
      await query
    })
  }
}
