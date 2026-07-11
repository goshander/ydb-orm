const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')

const { Ydb, YdbDataType, YdbModel } = require('ydb-orm')

const tableName = `package_smoke_cjs_${randomUUID().replace(/-/g, '_')}`

class PackageSmokeCjsModel extends YdbModel {
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
  models: { PackageSmokeCjsModel },
  timeout: Number(process.env.YDB_TEST_TIMEOUT || 10000),
})

async function main() {
  await db.connect()
  await db.sync()

  const created = await PackageSmokeCjsModel.create({
    name: 'package-smoke-cjs',
    score: 1,
  })

  try {
    const found = await PackageSmokeCjsModel.findOne({
      where: {
        id: created.id,
      },
    })
    assert.ok(found)
    assert.equal(found.name, 'package-smoke-cjs')

    await db.transaction(async (tx) => {
      await tx.sql(`UPDATE ${tableName} SET score = $score WHERE id = $id;`, {
        id: created.id,
        score: 24,
      })
    })

    await created.reload()
    assert.equal(created.score, 24)

    const count = await PackageSmokeCjsModel.count({ distinct: false })
    assert.equal(count, 1n)
  } finally {
    await PackageSmokeCjsModel.drop().catch(() => undefined)
    await db.close()
  }
}

main()
