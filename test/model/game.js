const { nanoid } = require('nanoid')

const { YdbModel, YdbType } = require('../..')

class Game extends YdbModel {
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
    meta, user, timeout, mode, score, status, turn, id = null, createdAt,
  }) {
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

module.exports = Game
