// @ts-nocheck
/* eslint-disable import/no-unresolved */
const argon2 = require('argon2')
const { nanoid } = require('nanoid')
const { YdbModel, YdbDataType } = require('ydb-orm')

class User extends YdbModel {
  static schema = {
    id: YdbDataType.ascii,
    login: YdbDataType.ascii,
    password: YdbDataType.ascii,
    createdAt: YdbDataType.date,
  }

  constructor(fields) {
    super(fields)
    const {
      login, createdAt, id = null, password,
    } = fields
    this.id = id || nanoid()
    this.login = login
    this.password = password
    this.createdAt = createdAt || new Date()
  }

  async hash(password) {
    this.password = await argon2.hash(password)
  }

  async check(password) {
    if (await argon2.verify(this.password, password)) {
      return true
    }
    return false
  }
}

module.exports = User
