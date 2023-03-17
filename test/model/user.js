const { nanoid } = require('nanoid')

const { YdbModel, YdbType } = require('../..')

class User extends YdbModel {
  static schema = {
    id: YdbType.ascii,
    name: YdbType.ascii,
    createdAt: YdbType.date,
  }

  constructor({
    name, id = null, createdAt,
  }) {
    super()

    /** @type String */
    this.id = id || nanoid()

    /** @type String */
    this.name = name || ''

    /** @type Date */
    this.createdAt = createdAt || new Date()
  }
}

module.exports = User
