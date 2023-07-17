import { nanoid } from 'nanoid'

import { YdbModel, YdbType } from '../..'

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
    id: YdbType.ascii,
    name: YdbType.ascii,
    createdAt: YdbType.date,
  }

  constructor({
    name, id, createdAt,
  }: Partial<Fields>) {
    super()

    this.id = id || nanoid()
    this.name = name || ''
    this.createdAt = createdAt || new Date()
  }
}
