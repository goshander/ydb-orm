import { nanoid } from 'nanoid'

import { YdbDataType, YdbModel, YdbSchemaType } from '../..'

type Fields = {
  id: string
  meta: string
  user: Array<{ id: string, name: string }> // [{id, name}, {id, name}]
  timeout: { turn: number, answer: number } // {turn: 30sec, answer: 30sec}
  mode: string, // hard, easy
  score: Record<string, number>, // {userId: 0, userId: 0}
  status: 'init' | 'start' | 'end', // init, start, end
  turn: number, // turn counter
  createdAt: Date,
}

export class Game extends YdbModel implements Fields {
  static schema: YdbSchemaType = {
    id: YdbDataType.ascii,
    meta: YdbDataType.ascii,
    user: YdbDataType.json, // [{id, name}, {id, name}]
    timeout: YdbDataType.json, // {turn: 30sec, answer: 30sec}
    mode: YdbDataType.ascii, // hard, easy
    score: YdbDataType.json, // {userId: 0, userId: 0}
    status: YdbDataType.ascii, // init, start, end
    turn: YdbDataType.int, // turn counter
    createdAt: YdbDataType.date,
  }

  // can be autogenerated after `implements` use
  id: Fields['id']
  meta: Fields['meta']
  user: Fields['user']
  timeout: Fields['timeout']
  mode: Fields['mode']
  score: Fields['score']
  status: Fields['status']
  turn: Fields['turn']
  createdAt: Fields['createdAt']

  constructor(fields: Partial<Fields> = {}) {
    super(fields)

    const {
      meta, user, timeout, mode, score, status, turn, id, createdAt,
    } = fields
    this.id = id || nanoid(32)
    this.meta = meta || ''
    this.user = user || []
    this.timeout = timeout || { turn: 30, answer: 30 }
    this.mode = mode || 'easy'
    this.score = score || {}
    this.status = status || 'init'
    this.turn = turn || 0
    this.createdAt = createdAt || new Date()
  }
}
