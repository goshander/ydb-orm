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
      id Utf8,
      name Utf8,
      age Int32,
      created_at Timestamp,
      is_active Bool,
      PRIMARY KEY (id)
    );
  `)

  // verify table exists by querying it
  const result = await db.sql(`SELECT 1 AS check_value FROM ${tableName} LIMIT 1;`)

  t.expect(Array.isArray(result)).toBe(true)
})

test(import.meta, 'sql - insert with parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  // Insert with parameters (without $ prefix in keys)
  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    {
      id: 'test-1',
      name: 'John Doe',
      age: 30,
    },
  )

  // Verify insertion
  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = 'test-1';`)
  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('John Doe')
  t.expect(result[0].age).toBe(30)
})

test(import.meta, 'sql - query with single parameter', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table and insert data
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    {
      id: 'test-1',
      name: 'John Doe',
      age: 30,
    },
  )

  // Query with single parameter
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE id = $id;`,
    { id: 'test-1' },
  )

  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('John Doe')
  t.expect(result[0].age).toBe(30)
})

test(import.meta, 'sql - query with multiple parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table and insert multiple records
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: 'test-1', name: 'John Doe', age: 30 },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: 'test-2', name: 'Jane Smith', age: 25 },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: 'test-3', name: 'Bob Johnson', age: 35 },
  )

  // Query with multiple parameters
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE name = $name AND age = $age;`,
    { name: 'Jane Smith', age: 25 },
  )

  t.expect(result.length).toBe(1)
  t.expect(result[0].id).toBe('test-2')
  t.expect(result[0].name).toBe('Jane Smith')
  t.expect(result[0].age).toBe(25)
})

test(import.meta, 'sql - parameter with $ prefix in key', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      PRIMARY KEY (id)
    );
  `)

  // Insert with $ prefix in parameter keys (should be stripped automatically)
  await db.sql(
    `UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`,
    {
      $id: 'test-1',
      $name: 'Test User',
    },
  )

  // Verify insertion
  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = 'test-1';`)
  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('Test User')
})

test(import.meta, 'sql - different data types', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table with various column types
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      age Int32,
      score Int64,
      is_active Bool,
      created_at Timestamp,
      PRIMARY KEY (id)
    );
  `)

  const now = new Date()

  // Insert with different data types
  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age, score, is_active, created_at)
     VALUES ($id, $name, $age, $score, $is_active, $created_at);`,
    {
      id: 'test-1',
      name: 'John Doe',
      age: 30,
      score: 1000000,
      is_active: true,
      created_at: now,
    },
  )

  // Query and verify
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE id = $id;`,
    { id: 'test-1' },
  )

  t.expect(result.length).toBe(1)
  t.expect(result[0].name).toBe('John Doe')
  t.expect(result[0].age).toBe(30)
  t.expect(result[0].is_active).toBe(true)
  t.expect(result[0].created_at).toBeInstanceOf(Date)
})

test(import.meta, 'sql - update with parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table and insert data
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: 'test-1', name: 'John Doe', age: 30 },
  )

  // Update with parameters
  await db.sql(
    `UPDATE ${tableName} SET name = $name, age = $age WHERE id = $id;`,
    { id: 'test-1', name: 'John Updated', age: 31 },
  )

  // Verify update
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE id = $id;`,
    { id: 'test-1' },
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

  // Create table and insert data
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      PRIMARY KEY (id)
    );
  `)

  await db.sql(
    `UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`,
    { id: 'test-1', name: 'John Doe' },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name) VALUES ($id, $name);`,
    { id: 'test-2', name: 'Jane Smith' },
  )

  // Verify both records exist
  let result = await db.sql(`SELECT * FROM ${tableName};`)
  t.expect(result.length).toBe(2)

  // Delete one record with parameters
  await db.sql(
    `DELETE FROM ${tableName} WHERE id = $id;`,
    { id: 'test-1' },
  )

  // Verify deletion
  result = await db.sql(`SELECT * FROM ${tableName};`)
  t.expect(result.length).toBe(1)
  t.expect(result[0].id).toBe('test-2')
})

test(import.meta, 'sql - count query with parameters', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table and insert data
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      age Int32,
      PRIMARY KEY (id)
    );
  `)

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: 'test-1', name: 'John Doe', age: 30 },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: 'test-2', name: 'Jane Smith', age: 30 },
  )

  await db.sql(
    `UPSERT INTO ${tableName} (id, name, age) VALUES ($id, $name, $age);`,
    { id: 'test-3', name: 'Bob Johnson', age: 25 },
  )

  // Count with WHERE clause and parameter
  const result = await db.sql(
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE age = $age;`,
    { age: 30 },
  )

  t.expect(result.length).toBe(1)
  // COUNT returns BigInt in YDB
  t.expect(result[0].count).toBe(2n)
})

test(import.meta, 'sql - empty result set', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table (no data)
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      PRIMARY KEY (id)
    );
  `)

  // Query empty table
  const result = await db.sql(`SELECT * FROM ${tableName};`)

  t.expect(Array.isArray(result)).toBe(true)
  t.expect(result.length).toBe(0)
})

test(import.meta, 'sql - complex query with multiple operations', options, async (t, { db }) => {
  const tableName = generateTableName()

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create table
  await db.sql(`
    CREATE TABLE ${tableName} (
      id Utf8,
      name Utf8,
      age Int32,
      score Int32,
      PRIMARY KEY (id)
    );
  `)

  // Insert multiple records
  for (let i = 1; i <= 5; i += 1) {
    await db.sql(
      `UPSERT INTO ${tableName} (id, name, age, score) VALUES ($id, $name, $age, $score);`,
      {
        id: `test-${i}`, name: `User ${i}`, age: 20 + i, score: i * 10,
      },
    )
  }

  // Complex query with ORDER BY and LIMIT
  const result = await db.sql(
    `SELECT * FROM ${tableName} WHERE age >= $min_age ORDER BY score DESC LIMIT $limit;`,
    { min_age: 22, limit: 3 },
  )

  t.expect(result.length).toBe(3)
  t.expect(result[0].score).toBe(50) // Highest score first
  t.expect(result[1].score).toBe(40)
  t.expect(result[2].score).toBe(30)
})
