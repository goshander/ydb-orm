import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, test } from 'node:test'

import { Ydb, YdbDataType, YdbModel } from '../dist/index.js'

const tableName = `node_built_${randomUUID().replace(/-/g, '_')}`

class NodeBuiltModel extends YdbModel {
  static schema = {
    field: {
      id: YdbDataType.ascii,
      name: YdbDataType.ascii,
      score: YdbDataType.int32,
      createdAt: YdbDataType.date,
    },
    option: {
      tableName,
    },
  }

  constructor(fields = {}) {
    super(fields)

    const createdAt = fields.createdAt || new Date()
    createdAt.setMilliseconds(0)

    this.id = fields.id || randomUUID()
    this.name = fields.name || ''
    this.score = fields.score || 0
    this.createdAt = createdAt
  }
}

const db = Ydb.init({
  endpoint: process.env.YDB_ENDPOINT || '',
  database: process.env.YDB_DATABASE || '',
  models: { NodeBuiltModel },
  timeout: Number(process.env.YDB_TEST_TIMEOUT || 10000),
})

after(async () => {
  await db.close()
})

test('compiled library works in Node.js', async () => {
  await db.connect()
  await db.sync()

  const created = await NodeBuiltModel.create({
    name: 'node-built',
    score: 1,
  })

  try {
    const all = await NodeBuiltModel.findAll()
    assert.equal(all.length, 1)
    assert.equal(all[0].name, 'node-built')

    const found = await NodeBuiltModel.findOne({ where: { id: created.id } })
    assert.ok(found)
    assert.equal(found.name, 'node-built')

    await created.update({ score: 7 })
    assert.equal(created.score, 7)

    await db.sql(`UPDATE ${tableName} SET score = $score WHERE id = $id;`, {
      id: created.id,
      score: 11,
    })
    await created.reload()
    assert.equal(created.score, 11)

    await NodeBuiltModel.destroy({ where: { id: created.id } })
    const count = await NodeBuiltModel.count({ distinct: false })
    assert.equal(count, 0n)
  } finally {
    await NodeBuiltModel.drop().catch(() => undefined)
  }
})
