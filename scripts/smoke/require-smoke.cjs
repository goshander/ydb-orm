const assert = require('node:assert/strict')

const { Ydb, YdbDataType, YdbModel } = require('ydb-orm')

const tableName = 'test_require'

class TestModelRequire extends YdbModel {
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

    this.id = fields.id || 'test-require-record'
    this.text = fields.text || ''
    this.value = fields.value || 0
    this.createdAt = createdAt
  }
}

const db = Ydb.init({
  endpoint: process.env.YDB_ENDPOINT || '',
  database: process.env.YDB_DATABASE || '',
  models: { TestModelRequire },
  timeout: Number(process.env.YDB_TEST_TIMEOUT || 10000),
})

async function main() {
  await db.wait(Number(process.env.YDB_TEST_WAIT_TIMEOUT || 60000))
  await db.sync()

  const record = await TestModelRequire.create({
    text: 'test require value',
    value: 1,
  })

  try {
    const foundRecord = await TestModelRequire.findOne({
      where: {
        id: record.id,
      },
    })
    assert.ok(foundRecord)
    assert.equal(foundRecord.text, 'test require value')

    await db.transaction(async (tx) => {
      await tx.sql(`UPDATE ${tableName} SET value = $value WHERE id = $id;`, {
        id: record.id,
        value: 24,
      })
    })

    await record.reload()
    assert.equal(record.value, 24)

    const count = await TestModelRequire.count({ distinct: false })
    assert.equal(count, 1n)
  } finally {
    await TestModelRequire.drop().catch(() => undefined)
    await db.close()
  }
}

main()
