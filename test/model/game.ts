import { nanoid } from 'nanoid'

import { YdbModel, YdbType } from '../..'

type Fields = {
  id: string
  meta: string
  user: Array<{ id: string, name: string }> // [{id, name}, {id, name}]
  timeout: { turn: number, answer: number } // {turn: 30sec, answer: 30sec}
  mode: string, // hard, easy
  score: Record<string, string>, // {userId: 0, userId: 0}
  status: 'init' | 'start' | 'end', // init, start, end
  turn: number, // turn counter
  createdAt: Date,
}

export class Game extends YdbModel implements Fields {
  id: Fields['id']
  meta: Fields['meta']
  user: Fields['user']
  timeout: Fields['timeout']
  mode: Fields['mode']
  score: Fields['score']
  status: Fields['status']
  turn: Fields['turn']
  createdAt: Fields['createdAt']

  static schema = {
    id: YdbType.ascii,
    meta: YdbType.ascii,
    user: YdbType.json, // [{id, name}, {id, name}]
    timeout: YdbType.json, // {turn: 30sec, answer: 30sec}
    mode: YdbType.ascii, // hard, easy
    score: YdbType.json, // {userId: 0, userId: 0}
    status: YdbType.ascii, // init, start, end
    turn: YdbType.int, // turn counter
    createdAt: YdbType.date,
  }

  constructor({
    meta, user, timeout, mode, score, status, turn, id, createdAt,
  }: Partial<Fields>) {
    super()
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
