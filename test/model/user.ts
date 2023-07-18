import { nanoid } from 'nanoid'

import { YdbDataType, YdbModel } from '../..'

type Fields = {
  id: string
  name: string
  createdAt: Date
}

export class User extends YdbModel implements Fields {
  id: Fields['id']
  name: Fields['name']
  createdAt: Fields['createdAt']

  static schema = {
    id: YdbDataType.ascii,
    name: YdbDataType.ascii,
    createdAt: YdbDataType.date,
  }

  constructor(fields: Partial<Fields>) {
    super(fields)

    const { name, id, createdAt } = fields
    this.id = id || nanoid()
    this.name = name || ''
    this.createdAt = createdAt || new Date()
  }
}
