import { nanoid } from 'nanoid'

import { YdbDataType, YdbModel, type YdbSchemaType } from '..'
import { type TestOptions, test } from '../test'

const options: TestOptions = {
  models: [],
  sync: false,
}

// Test 1: Basic table creation with sync
test(import.meta, 'sync - create table with basic fields', options, async (t, { db }) => {
  const tableName = `sync_basic_${nanoid().replace(/-/g, '_')}`

  type Fields = {
    id: string
    name: string
    age: number
  }

  class TestModel extends YdbModel implements Fields {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        name: YdbDataType.ascii,
        age: YdbDataType.int32,
      },
      option: {
        tableName,
      },
    }

    id: Fields['id']
    name: Fields['name']
    age: Fields['age']

    constructor(fields: Partial<Fields>) {
      super(fields)
      const { id, name, age } = fields
      this.id = id || nanoid()
      this.name = name || ''
      this.age = age || 0
    }
  }

  db.load(TestModel)

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Sync should create the table
  await db.sync()

  // Verify table was created by inserting and querying
  const instance = new TestModel({ name: 'test-user', age: 25 })
  await instance.save()

  const result = await TestModel.findByPk(instance.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.name).toBe('test-user')
  t.expect(result?.age).toBe(25)

  await instance.delete()
})

// Test 2: Create table with index
test(import.meta, 'sync - create table with index', options, async (t, { db }) => {
  const tableName = `sync_index_${nanoid().replace(/-/g, '_')}`

  type Fields = {
    id: string
    email: string
    status: string
  }

  class TestModelWithIndex extends YdbModel implements Fields {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        email: {
          type: YdbDataType.ascii,
          index: true,
        },
        status: YdbDataType.ascii,
      },
      option: {
        tableName,
      },
    }

    id: Fields['id']
    email: Fields['email']
    status: Fields['status']

    constructor(fields: Partial<Fields>) {
      super(fields)
      const { id, email, status } = fields
      this.id = id || nanoid()
      this.email = email || ''
      this.status = status || 'active'
    }
  }

  db.load(TestModelWithIndex)

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  await db.sync()

  // Verify table and index work
  const instance = new TestModelWithIndex({ email: 'test@example.com' })
  await instance.save()

  const result = await TestModelWithIndex.findOne({
    where: { email: 'test@example.com' },
    index: `index_${tableName}_email`,
  })

  t.expect(result).toBeTruthy()
  t.expect(result?.email).toBe('test@example.com')

  await instance.delete()
})

// Test 3: Add new column to existing table
test(import.meta, 'sync - add new column to existing table', options, async (t, { db }) => {
  const tableName = `sync_add_col_${nanoid().replace(/-/g, '_')}`

  // First version of model
  type FieldsV1 = {
    id: string
    name: string
  }

  class TestModelV1 extends YdbModel implements FieldsV1 {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        name: YdbDataType.ascii,
      },
      option: {
        tableName,
      },
    }

    id: FieldsV1['id']
    name: FieldsV1['name']

    constructor(fields: Partial<FieldsV1>) {
      super(fields)
      const { id, name } = fields
      this.id = id || nanoid()
      this.name = name || ''
    }
  }

  db.load(TestModelV1)

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Create initial table
  await db.sync()

  // Verify initial table
  const instanceV1 = new TestModelV1({ name: 'initial' })
  await instanceV1.save()

  // Now update model with new field
  type FieldsV2 = {
    id: string
    name: string
    age: number
  }

  class TestModelV2 extends YdbModel implements FieldsV2 {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        name: YdbDataType.ascii,
        age: YdbDataType.int32, // New field
      },
      option: {
        tableName,
      },
    }

    id: FieldsV2['id']
    name: FieldsV2['name']
    age: FieldsV2['age']

    constructor(fields: Partial<FieldsV2>) {
      super(fields)
      const { id, name, age } = fields
      this.id = id || nanoid()
      this.name = name || ''
      this.age = age || 0
    }
  }

  // Replace model in registry
  db.model[TestModelV2.className] = TestModelV2
  TestModelV2.setCtx(db)

  // Sync should add the new column
  await db.sync()

  // Verify new field works
  const instanceV2 = new TestModelV2({ name: 'updated', age: 30 })
  await instanceV2.save()

  const result = await TestModelV2.findByPk(instanceV2.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.age).toBe(30)

  await instanceV1.delete()
  await instanceV2.delete()
})

// Test 4: Drop column (with drop flag)
test(import.meta, 'sync - drop column from table', options, async (t, { db }) => {
  const tableName = `sync_drop_col_${nanoid().replace(/-/g, '_')}`

  // Initial model with extra field
  type FieldsV1 = {
    id: string
    name: string
    deprecated: string
  }

  class TestModelV1 extends YdbModel implements FieldsV1 {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        name: YdbDataType.ascii,
        deprecated: YdbDataType.ascii,
      },
      option: {
        tableName,
      },
    }

    id: FieldsV1['id']
    name: FieldsV1['name']
    deprecated: FieldsV1['deprecated']

    constructor(fields: Partial<FieldsV1>) {
      super(fields)
      const { id, name, deprecated } = fields
      this.id = id || nanoid()
      this.name = name || ''
      this.deprecated = deprecated || ''
    }
  }

  db.load(TestModelV1)

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  await db.sync()

  // Add data
  const instance = new TestModelV1({ name: 'test', deprecated: 'old' })
  await instance.save()

  // Update model to drop the deprecated field
  type FieldsV2 = {
    id: string
    name: string
  }

  class TestModelV2 extends YdbModel implements FieldsV2 {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        name: YdbDataType.ascii,
        deprecated: {
          type: YdbDataType.ascii,
          drop: true, // Mark for dropping
        },
      },
      option: {
        tableName,
      },
    }

    id: FieldsV2['id']
    name: FieldsV2['name']

    constructor(fields: Partial<FieldsV2>) {
      super(fields)
      const { id, name } = fields
      this.id = id || nanoid()
      this.name = name || ''
    }
  }

  db.model[TestModelV2.className] = TestModelV2
  TestModelV2.setCtx(db)

  // Sync should drop the column
  await db.sync()

  // Verify data still exists but deprecated field is gone
  const result = await TestModelV2.findByPk(instance.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.name).toBe('test')
  t.expect('deprecated' in result!).toBe(false)

  await instance.delete()
})

// Test 5: Multiple syncs (idempotent)
test(import.meta, 'sync - multiple syncs are idempotent', options, async (t, { db }) => {
  const tableName = `sync_idempotent_${nanoid().replace(/-/g, '_')}`

  type Fields = {
    id: string
    value: string
  }

  class TestModel extends YdbModel implements Fields {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        value: YdbDataType.ascii,
      },
      option: {
        tableName,
      },
    }

    id: Fields['id']
    value: Fields['value']

    constructor(fields: Partial<Fields>) {
      super(fields)
      const { id, value } = fields
      this.id = id || nanoid()
      this.value = value || ''
    }
  }

  db.load(TestModel)

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  // Run sync multiple times
  await db.sync()
  await db.sync()
  await db.sync()

  // Verify table still works correctly
  const instance = new TestModel({ value: 'test' })
  await instance.save()

  const result = await TestModel.findByPk(instance.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.value).toBe('test')

  await instance.delete()
})

// Test 6: Nullable fields (all fields except primary key are nullable)
test(import.meta, 'sync - fields are nullable except primary key', options, async (t, { db }) => {
  const tableName = `sync_nullable_${nanoid().replace(/-/g, '_')}`

  type Fields = {
    id: string
    data: string
  }

  class TestModel extends YdbModel implements Fields {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        data: YdbDataType.ascii,
      },
      option: {
        tableName,
      },
    }

    id: Fields['id']
    data: Fields['data']

    constructor(fields: Partial<Fields>) {
      super(fields)
      const { id, data } = fields
      this.id = id || nanoid()
      this.data = data || ''
    }
  }

  db.load(TestModel)

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  await db.sync()

  // Insert with null optional field
  const userId = nanoid()
  await db.sql(`UPSERT INTO ${tableName} (id) VALUES ($id);`, { id: userId })

  // Verify record exists
  const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = $id;`, { id: userId })
  t.expect(result.length).toBe(1)
  t.expect(result[0].id).toBeTruthy()

  await db.sql(`DELETE FROM ${tableName} WHERE id = $id;`, { id: userId })
})
