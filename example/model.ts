import * as argon2 from 'argon2'
import { nanoid } from 'nanoid'
import { YdbDataType, YdbModel, type YdbSchemaType } from 'ydb-orm'

export type UserFields = {
  id: string
  login: string
  password: string
  createdAt: Date
}

export class User extends YdbModel<UserFields> {
  static schema: YdbSchemaType = {
    id: YdbDataType.ascii,
    login: YdbDataType.ascii,
    password: YdbDataType.ascii,
    createdAt: YdbDataType.date,
  }

  constructor(fields: Partial<UserFields> = {}) {
    super(fields)

    const { login, createdAt, id, password } = fields

    this.id = id || nanoid()
    this.login = login || ''
    this.password = password || ''
    this.createdAt = createdAt || new Date()
  }

  async hash(password: string) {
    this.password = await argon2.hash(password)
  }

  async check(password: string) {
    if (await argon2.verify(this.password.toString(), password)) {
      return true
    }
    return false
  }
}

export interface User extends UserFields {}
