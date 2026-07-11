import assert from 'node:assert/strict'
import { after, test } from 'node:test'

import { Ydb, YdbDataType, YdbModel } from '../dist/index.js'

const tableName = 'test'

class TestModel extends YdbModel {
  static schema = {
    field: {
      id: YdbDataType.ascii,
      text: YdbDataType.ascii,
      value: YdbDataType.int32,
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

    this.id = fields.id || 'test-record'
    this.text = fields.text || ''
    this.value = fields.value || 0
    this.createdAt = createdAt
  }
}

const db = Ydb.init({
  endpoint: process.env.YDB_ENDPOINT || '',
  database: process.env.YDB_DATABASE || '',
  models: { TestModel },
  timeout: Number(process.env.YDB_TEST_TIMEOUT || 10000),
})

after(async () => {
  await db.close()
})

test('compiled library works in node.js', async () => {
  await db.wait(Number(process.env.YDB_TEST_WAIT_TIMEOUT || 30000))
  await db.sync()

  const record = await TestModel.create({
    text: 'test value',
    value: 1,
  })

  try {
    const records = await TestModel.findAll()
    assert.equal(records.length, 1)
    assert.equal(records[0].text, 'test value')

    const foundRecord = await TestModel.findOne({ where: { id: record.id } })
    assert.ok(foundRecord)
    assert.equal(foundRecord.text, 'test value')

    await record.update({ value: 7 })
    assert.equal(record.value, 7)

    await db.sql(`UPDATE ${tableName} SET value = $value WHERE id = $id;`, {
      id: record.id,
      value: 11,
    })
    await record.reload()
    assert.equal(record.value, 11)

    await TestModel.destroy({ where: { id: record.id } })
    const count = await TestModel.count({ distinct: false })
    assert.equal(count, 0n)
  } finally {
    await TestModel.drop().catch(() => undefined)
  }
})
