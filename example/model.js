/* eslint-disable import/no-unresolved */
const { nanoid } = require('nanoid')
const argon2 = require('argon2')

const { YdbModel, YdbType } = require('ydb-orm')

class User extends YdbModel {
  static schema = {
    id: YdbType.ascii,
    login: YdbType.ascii,
    password: YdbType.ascii,
    createdAt: YdbType.date,
  }

  constructor({
    login, createdAt, id = null, password,
  }) {
    super()
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
