const escape = require('./escape')
const convert = require('./convert')
const where = require('./where')

class YdbModel {
  static _table = null

  static primaryKey = 'id'

  static ctx = null

  static schema = null

  static get table() {
    // eslint-disable-next-line no-underscore-dangle
    if (this._table != null) return this._table

    // eslint-disable-next-line no-underscore-dangle
    this._table = this.name[0].toLowerCase()
      + this.name
        .slice(1, this.name.length)
        .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

    // eslint-disable-next-line no-underscore-dangle
    return this._table
  }

  // constructor() {

  // }

  static async copy(from, to) {
    await this.ctx.session(async (session) => {
      const yql = `UPDATE ${this.table} SET ${to} = ${from};`

      await session.executeQuery(yql)
    })
  }

  static async count(options = {
    where: null, field: null, distinct: false,
  }) {
    const res = await this.ctx.session(async (session) => {
      let cField = options.field
      if (cField == null) cField = this.primaryKey

      if (options.distinct) cField = `DISTINCT ${cField}`

      let yql = `SELECT COUNT(${cField}) as count FROM ${this.table}`

      if (options.where != null) {
        yql = `${yql} ${where(options.where)}`
      }

      yql = `${yql};`

      const { resultSets: [result] } = await session.executeQuery(yql)

      return result
    })

    const count = convert(res.rows[0].items[0], res.columns[0].type)

    return count
  }

  static async find(options = {
    where: null, offset: null, limit: null, page: null, order: null,
  }) {
    const res = await this.ctx.session(async (session) => {
      let yql = `SELECT * FROM ${this.table}`

      if (options.where != null) {
        yql = `${yql} ${where(options.where)}`
      }
      if (options.order && this.schema[options.order] != null) {
        yql = `${yql} ORDER BY ${options.order} DESC`
      }
      if (options.limit) {
        yql = `${yql} LIMIT ${parseInt(options.limit)}`
      }
      if (options.offset) {
        yql = `${yql} OFFSET ${parseInt(options.offset)}`
      }
      if (options.page && options.limit && !options.offset) {
        yql = `${yql} OFFSET ${(parseInt(options.page) - 1) * parseInt(options.limit)}`
      }

      yql = `${yql};`

      const { resultSets: [result] } = await session.executeQuery(yql)

      return result
    })

    const out = []

    res.rows.forEach((r) => {
      const data = {}
      res.columns.forEach((c, ind) => {
        data[c.name] = convert(r.items[ind], c.type)
      })

      out.push(new this(data))
    })

    return out
  }

  static async findByPk(pk) {
    const out = await this.find({
      where: {
        [this.primaryKey]: pk,
      },
      limit: 1,
    })

    return out[0] || null
  }

  static async findOne(wh) {
    const out = await this.find({
      where: wh,
      limit: 1,
    })

    return out[0] || null
  }

  async save() {
    await this.constructor.ctx.session(async (session) => {
      const table = await session.describeTable(this.constructor.table)
      const columns = table.columns.map((c) => c.name)

      const values = columns.map((c) => escape(this[c])).join(', ')

      const yql = `UPSERT INTO ${this.constructor.table} (${columns.join(', ')}) VALUES (${values});`

      await session.executeQuery(yql)
    })
    return this
  }

  async delete() {
    await this.constructor.ctx.session(async (session) => {
      const key = escape(this[this.constructor.primaryKey])

      const yql = `DELETE FROM ${this.constructor.table} WHERE ${this.constructor.primaryKey} = ${key};`

      await session.executeQuery(yql)
    })
  }

  static async update(data, wh) {
    await this.ctx.session(async (session) => {
      const set = Object.keys(data).map((c) => `${c} = ${escape(data[c])}`).join(', ')

      let yql = `UPDATE ${this.table} SET ${set}`

      yql = `${yql} ${where(wh)}`

      yql = `${yql};`

      await session.executeQuery(yql)
    })
  }
}

module.exports = YdbModel
