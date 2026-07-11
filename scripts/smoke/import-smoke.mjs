import assert from 'node:assert/strict'

import { Ydb, YdbDataType, YdbModel } from 'ydb-orm'

const tableName = 'test_import'

class TestModelImport extends YdbModel {
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

    this.id = fields.id || 'test-import-record'
    this.text = fields.text || ''
    this.value = fields.value || 0
    this.createdAt = createdAt
  }
}

const db = Ydb.init({
  endpoint: process.env.YDB_ENDPOINT || '',
  database: process.env.YDB_DATABASE || '',
  models: { TestModelImport },
  timeout: Number(process.env.YDB_TEST_TIMEOUT || 10000),
})

await db.wait(Number(process.env.YDB_TEST_WAIT_TIMEOUT || 60000))
await db.sync()

const record = await TestModelImport.create({
  text: 'test import value',
  value: 1,
})

try {
  const foundRecord = await TestModelImport.findOne({
    where: {
      id: record.id,
    },
  })
  assert.ok(foundRecord)
  assert.equal(foundRecord.text, 'test import value')

  await db.transaction(async (tx) => {
    await tx.sql(`UPDATE ${tableName} SET value = $value WHERE id = $id;`, {
      id: record.id,
      value: 24,
    })
  })

  await record.reload()
  assert.equal(record.value, 24)

  const count = await TestModelImport.count({ distinct: false })
  assert.equal(count, 1n)
} finally {
  await TestModelImport.drop().catch(() => undefined)
  await db.close()
}
