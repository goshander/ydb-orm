import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { Ydb, YdbDataType, YdbModel } from 'ydb-orm'

const tableName = `package_smoke_mjs_${randomUUID().replace(/-/g, '_')}`

class PackageSmokeMjsModel extends YdbModel {
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
  models: { PackageSmokeMjsModel },
  timeout: Number(process.env.YDB_TEST_TIMEOUT || 10000),
})

await db.connect()
await db.sync()

const created = await PackageSmokeMjsModel.create({
  name: 'package-smoke-mjs',
  score: 1,
})

try {
  const found = await PackageSmokeMjsModel.findOne({
    where: {
      id: created.id,
    },
  })
  assert.ok(found)
  assert.equal(found.name, 'package-smoke-mjs')

  await db.transaction(async (tx) => {
    await tx.sql(`UPDATE ${tableName} SET score = $score WHERE id = $id;`, {
      id: created.id,
      score: 24,
    })
  })

  await created.reload()
  assert.equal(created.score, 24)

  const count = await PackageSmokeMjsModel.count({ distinct: false })
  assert.equal(count, 1n)
} finally {
  await PackageSmokeMjsModel.drop().catch(() => undefined)
  await db.close()
}
