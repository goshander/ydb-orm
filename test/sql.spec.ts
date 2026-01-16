import { nanoid } from 'nanoid'

import { type TestOptions, test } from '../test'

const options: TestOptions = {
  models: [],
  sync: false,
}

// generate table name with only alphanumeric characters (no hyphens) and non number from start
const generateTableName = () => `sql_${nanoid().replace(/-/g, '_')}`

test(import.meta, 'sql - query without parameters', options, async (t, { db }) => {
  const result = await db.sql('SELECT 1 AS value;')

  t.expect(result).toBeDefined()
  t.expect(Array.isArray(result)).toBe(true)
  t.expect(result.length).toBeGreaterThan(0)
  t.expect(result[0].value).toBe(1)
})

test(import.meta, 'sql - create and drop test table', options, async (t, { db }) => {
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
      created_at Timestamp,
      is_active Bool,
      PRIMARY KEY (id)
    );
  `)

  // verify table exists by querying it
  const result = await db.sql(`SELECT 1 AS check FROM ${tableName} LIMIT 1;`)

  t.expect(Array.isArray(result)).toBe(true)
})

test(import.meta, 'sql - insert with parameters', options, async (t, { db }) => {
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
  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = '${userId}';`)
  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('user-one')
  t.expect(result[0].age).toBe(30)
})

test(import.meta, 'sql - query with single parameter', options, async (t, { db }) => {
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

test(import.meta, 'sql - query with multiple parameters', options, async (t, { db }) => {
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

test(import.meta, 'sql - parameter with $ prefix in key', options, async (t, { db }) => {
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
  await db.sql(
    `UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`,
    {
      $id: 'test-1',
      $name: 'Test User',
    },
  )

  // verify insertion
  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = 'test-1';`)
  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('Test User')
})

test(import.meta, 'sql - different data types', options, async (t, { db }) => {
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
      is_active Bool,
      created_at Timestamp,
      PRIMARY KEY (id)
    );
  `)

  const now = new Date()
  now.setMilliseconds(0)

  const userId = nanoid()

  // insert with different data types
  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age, score, is_active, created_at)
     VALUES ($id, $name, $age, $score, $is_active, $created_at);`,
    {
      id: userId,
      name: 'user-one',
      age: 30,
      score: 1000000,
      is_active: true,
      created_at: now,
    },
  )

  // query and verify
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE id = $id;`,
    { id: userId },
  )

  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('user-one')
  t.expect(result[0].age).toBe(30)
  t.expect(result[0].is_active).toBe(true)
  t.expect(result[0].created_at).toBeInstanceOf(Date)
  t.expect((result[0].created_at as Date).getTime()).toBe(now.getTime())
})

test(import.meta, 'sql - update with parameters', options, async (t, { db }) => {
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
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE id = $id;`,
    { id: userId },
  )

  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('John Updated')
  t.expect(result[0].age).toBe(31)
})

test(import.meta, 'sql - delete with parameters', options, async (t, { db }) => {
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

  await db.sql(
    `UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`,
    { id: userIdOne, name: 'user-one' },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`,
    { id: userIdTwo, name: 'user-two' },
  )

  // verify both records exist
  let result = await db.sql(`SELECT * FROM ${tableName};`)
  t.expect(result.length).toBe(2)

  // delete one record with parameters
  await db.sql(
    `DELETE FROM ${tableName} WHERE id = $id;`,
    { id: userIdOne },
  )

  // verify deletion
  result = await db.sql(`SELECT * FROM ${tableName};`)
  const userId = (result[0].id as Buffer).toString('utf8')

  t.expect(result.length).toBe(1)
  t.expect(userId).toBe(userIdTwo)
})

test(import.meta, 'sql - count query with parameters', options, async (t, { db }) => {
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

test(import.meta, 'sql - empty result set', options, async (t, { db }) => {
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

test(import.meta, 'sql - complex query with multiple operations', options, async (t, { db }) => {
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

  const users: Array<{ id: string; name: string; age: number; score: number }> = []

  // insert multiple records
  for (let i = 1; i <= 5; i += 1) {
    users.push({
      id: nanoid(), name: `user-${i}`, age: 20 + i, score: i * 10,
    })
  }

  await Promise.all(users.map((user) => db.sql(
    `UPSERT INTO ${tableName} (id, name, age, score) VALUES ($id, $name, $age, $score);`,
    user,
  )))

  // complex query with ORDER BY and LIMIT
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE age >= $min_age ORDER BY score DESC LIMIT $limit;`,
    { min_age: 22, limit: 3 },
  )

  t.expect(result.length).toBe(3)
  t.expect(result[0].score).toBe(50) // highest score first
  t.expect(result[1].score).toBe(40)
  t.expect(result[2].score).toBe(30)
})
