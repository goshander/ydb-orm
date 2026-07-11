import { nanoid } from 'nanoid'

import { YdbDataType, YdbModel, type YdbSchemaType } from '../../index.js'

export type GameFields = {
  id: string
  meta: string
  user: Array<{ id: string; name: string }> // [{id, name}, {id, name}]
  timeout: { turn: number; answer: number } // {turn: 30sec, answer: 30sec}
  mode: string // hard, easy
  score: Record<string, number> // {userId: 0, userId: 0}
  status: 'init' | 'start' | 'end' // init, start, end
  turn: number // turn counter
  progress: number // game progress
  createdAt: Date
}

export class Game extends YdbModel<GameFields> {
  static schema: YdbSchemaType = {
    id: YdbDataType.ascii,
    meta: YdbDataType.ascii,
    user: YdbDataType.json, // [{id, name}, {id, name}]
    timeout: YdbDataType.json, // {turn: 30sec, answer: 30sec}
    mode: {
      type: YdbDataType.ascii,
      index: true,
    }, // hard, easy
    score: YdbDataType.json, // {userId: 0, userId: 0}
    status: YdbDataType.ascii, // init, start, end
    turn: YdbDataType.int, // turn counter
    progress: YdbDataType.double, // game progress
    createdAt: YdbDataType.date,
  }

  constructor(fields: Partial<GameFields> = {}) {
    super(fields)

    const {
      meta,
      user,
      timeout,
      mode,
      score,
      status,
      turn,
      progress,
      id,
      createdAt,
    } = fields

    this.id = id || nanoid(32)
    this.meta = meta || ''
    this.user = user || []
    this.timeout = timeout || { turn: 30, answer: 30 }
    this.mode = mode || 'easy'
    this.score = score || {}
    this.status = status || 'init'
    this.turn = turn || 0
    this.progress = progress || 0
    this.createdAt =
      createdAt ||
      (() => {
        const d = new Date()
        d.setMilliseconds(0)
        return d
      })()
  }
}

export interface Game extends GameFields {}
