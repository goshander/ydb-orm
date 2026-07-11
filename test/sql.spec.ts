import { nanoid } from 'nanoid'

import { type TestOptions, test } from '../test.js'

const options = {
  models: {},
  sync: false,
} satisfies TestOptions

// generate table name with only alphanumeric characters (no hyphens) and non number from start
const generateTableName = () => `sql_${nanoid().replace(/-/g, '_')}`

test('sql - query without parameters', options, async (t, { db }) => {
  const result = await db.sql('SELECT 1 AS value;')

  t.expect(result).toBeDefined()
  t.expect(Array.isArray(result)).toBe(true)
  t.expect(result.length).toBeGreaterThan(0)
  t.expect(result[0].value).toBe(1)
})

test('sql - create and drop test table', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create test table
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      age Int32,
      createdAt Timestamp,
      isActive Bool,
      PRIMARY KEY (id)
    );
  `)

  // verify table exists by querying it
  const result = await db.sql(`SELECT 1 AS check FROM ${tableName} LIMIT 1;`)

  t.expect(Array.isArray(result)).toBe(true)
})

test('sql - insert with parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  const userId = nanoid()

  // insert with parameters (without $ prefix in keys)
  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    {
      id: userId,
      name: 'user-one',
      age: 30,
    },
  )

  // verify insertion
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE id = '${userId}';`,
  )
  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('user-one')
  t.expect(result[0].age).toBe(30)
})

test('sql - query with single parameter', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table and insert data
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  const userId = nanoid()

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    {
      id: userId,
      name: 'user-one',
      age: 30,
    },
  )

  // query with single parameter
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE id = $userId;`,
    { userId },
  )

  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('user-one')
  t.expect(result[0].age).toBe(30)
})

test('sql - query with multiple parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table and insert multiple records
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  const userIdOne = nanoid()
  const userIdTwo = nanoid()
  const userIdThree = nanoid()

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: userIdOne, name: 'user-one', age: 30 },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: userIdTwo, name: 'user-two', age: 35 },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: userIdThree, name: 'user-three', age: 25 },
  )

  // query with multiple parameters
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE name = $name AND age = $age;`,
    { name: 'user-two', age: 35 },
  )

  const userId = (result[0].id as Buffer).toString('utf8')

  t.expect(result.length).toBe(1)
  t.expect(userId).toBe(userIdTwo)
  t.expect(result[0].name).toBe('user-two')
  t.expect(result[0].age).toBe(35)
})

test('sql - parameter with $ prefix in key', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      PRIMARY KEY (id)
    );
  `)

  // insert with $ prefix in parameter keys (should be stripped automatically)
  await db.sql(`UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`, {
    $id: 'test-1',
    $name: 'Test User',
  })

  // verify insertion
  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = 'test-1';`)
  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('Test User')
})

test('sql - params can be reused in one query', options, async (t, { db }) => {
  const result = await db.sql(
    'SELECT $value AS firstValue, $value AS secondValue;',
    {
      $value: 'same-param',
    },
  )

  t.expect(result.length).toBe(1)
  t.expect(result[0].firstValue).toBe('same-param')
  t.expect(result[0].secondValue).toBe('same-param')
})

test('sql - params object is not mutated', options, async (t, { db }) => {
  const params = {
    $value: 'immutable-param',
  }

  await db.sql('SELECT $value AS value;', params)

  t.expect(params).toEqual({
    $value: 'immutable-param',
  })
})

test('sql - transaction commits queries', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      PRIMARY KEY (id)
    );
  `)

  const userId = nanoid()

  await db.transaction(async (tx) => {
    await tx.sql(`UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`, {
      id: userId,
      name: 'transaction-user',
    })
  })

  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = $id;`, {
    id: userId,
  })

  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('transaction-user')
})

test('sql - transaction rolls back on error', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      PRIMARY KEY (id)
    );
  `)

  const userId = nanoid()

  let transactionFailed = false

  try {
    await db.transaction(async (tx) => {
      await tx.sql(`UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`, {
        id: userId,
        name: 'rollback-user',
      })

      throw new Error('rollback transaction')
    })
  } catch (error) {
    transactionFailed = true
    t.expect((error as Error).message).toContain('Transaction failed')
  }

  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = $id;`, {
    id: userId,
  })

  t.expect(transactionFailed).toBe(true)
  t.expect(result.length).toBe(0)
})

test('sql - different data types', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table with various column types
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      age Int32,
      score Int64,
      isActive Bool,
      createdAt Timestamp,
      PRIMARY KEY (id)
    );
  `)

  const now = new Date()
  now.setMilliseconds(0)

  const userId = nanoid()

  // insert with different data types
  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age, score, isActive, createdAt)
     VALUES ($id, $name, $age, $score, $isActive, $createdAt);`,
    {
      id: userId,
      name: 'user-one',
      age: 30,
      score: 1000000,
      isActive: true,
      createdAt: now,
    },
  )

  // query and verify
  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = $id;`, {
    id: userId,
  })

  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('user-one')
  t.expect(result[0].age).toBe(30)
  t.expect(result[0].isActive).toBe(true)
  t.expect(result[0].createdAt).toBeInstanceOf(Date)
  t.expect((result[0].createdAt as Date).getTime()).toBe(now.getTime())
})

test('sql - update with parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table and insert data
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  const userId = nanoid()

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: userId, name: 'user-one', age: 30 },
  )

  // update with parameters
  await db.sql(
    `UPDATE ${tableName} SET name = $name, age = $age WHERE id = $id;`,
    { id: userId, name: 'John Updated', age: 31 },
  )

  // verify update
  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = $id;`, {
    id: userId,
  })

  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('John Updated')
  t.expect(result[0].age).toBe(31)
})

test('sql - delete with parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table and insert data
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      PRIMARY KEY (id)
    );
  `)

  const userIdOne = nanoid()
  const userIdTwo = nanoid()

  await db.sql(`UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`, {
    id: userIdOne,
    name: 'user-one',
  })

  await db.sql(`UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`, {
    id: userIdTwo,
    name: 'user-two',
  })

  // verify both records exist
  let result = await db.sql(`SELECT * FROM ${tableName};`)
  t.expect(result.length).toBe(2)

  // delete one record with parameters
  await db.sql(`DELETE FROM ${tableName} WHERE id = $id;`, { id: userIdOne })

  // verify deletion
  result = await db.sql(`SELECT * FROM ${tableName};`)
  const userId = (result[0].id as Buffer).toString('utf8')

  t.expect(result.length).toBe(1)
  t.expect(userId).toBe(userIdTwo)
})

test('sql - count query with parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table and insert data
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  const userIdOne = nanoid()
  const userIdTwo = nanoid()
  const userIdThree = nanoid()

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: userIdOne, name: 'user-one', age: 30 },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: userIdTwo, name: 'user-two', age: 30 },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: userIdThree, name: 'user-three', age: 25 },
  )

  // count with WHERE clause and parameter
  const result = await db.sql(
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE age = $age;`,
    { age: 30 },
  )

  t.expect(result.length).toBe(1)
  // check COUNT returns BigInt in YDB
  t.expect(result[0].count).toBe(2n)
})

test('sql - empty result set', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table (no data)
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      PRIMARY KEY (id)
    );
  `)

  // query empty table
  const result = await db.sql(`SELECT * FROM ${tableName};`)

  t.expect(Array.isArray(result)).toBe(true)
  t.expect(result.length).toBe(0)
})

test(
  'sql - complex query with multiple operations',
  options,
  async (t, { db }) => {
    const tableName = generateTableName()

    t.teardown(async () => {
      await db.sql(`DROP TABLE ${tableName};`)
    })

    // create table
    await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      name Utf8,
      age Int32,
      score Int32,
      PRIMARY KEY (id)
    );
  `)

    const users: Array<{
      id: string
      name: string
      age: number
      score: number
    }> = []

    // insert multiple records
    for (let i = 1; i <= 5; i += 1) {
      users.push({
        id: nanoid(),
        name: `user-${i}`,
        age: 20 + i,
        score: i * 10,
      })
    }

    await Promise.all(
      users.map((user) =>
        db.sql(
          `UPSERT INTO ${tableName} (id, name, age, score) VALUES ($id, $name, $age, $score);`,
          user,
        ),
      ),
    )

    // complex query with ORDER BY and LIMIT
    const result = await db.sql(
      `SELECT * FROM ${tableName} WHERE age >= $min_age ORDER BY score DESC LIMIT $limit;`,
      {
        min_age: 22,
        limit: 3,
      },
    )

    t.expect(result.length).toBe(3)
    t.expect(result[0].score).toBe(50) // highest score first
    t.expect(result[1].score).toBe(40)
    t.expect(result[2].score).toBe(30)
  },
)

test('sql - json field', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // create table (no data)
  await db.sql(`
    CREATE TABLE ${tableName} (
      id String,
      data Json,
      PRIMARY KEY (id)
    );
  `)

  // insert json data
  await db.sql(`UPSERT INTO ${tableName} (id, data) VALUES ($id, $data);`, {
    id: nanoid(),
    data: { field: 'value' },
  })

  // select json data
  const result = await db.sql(`SELECT * FROM ${tableName};`)

  t.expect(Array.isArray(result)).toBe(true)
  t.expect(result.length).toBe(1)
  t.expect(result[0].data).toEqual({ field: 'value' })
})
