import { nanoid } from 'nanoid'

import { YdbDataType, YdbModel, type YdbSchemaType } from '../../index.js'

export type UserFields = {
  id: string
  name: string
  createdAt: Date
}

export class User extends YdbModel<UserFields> {
  static schema: YdbSchemaType = {
    id: YdbDataType.ascii,
    name: YdbDataType.ascii,
    createdAt: YdbDataType.date,
  }

  constructor(fields: Partial<UserFields> = {}) {
    super(fields)

    const { name, id, createdAt } = fields

    this.id = id || nanoid()
    this.name = name || ''
    this.createdAt =
      createdAt ||
      (() => {
        const d = new Date()
        d.setMilliseconds(0)
        return d
      })()
  }
}

export interface User extends UserFields {}
