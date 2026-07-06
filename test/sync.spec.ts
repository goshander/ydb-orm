import { nanoid } from 'nanoid'

import { YdbDataType, YdbModel, type YdbSchemaType } from '..'
import { type TestOptions, test } from '../test'

const options: TestOptions = {
  models: [],
  sync: false,
}

// basic table creation with sync
test('sync - create table with basic fields', options, async (t, { db }) => {
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

  // sync should create the table
  await db.sync()

  // verify table was created by inserting and querying
  const instance = new TestModel({ name: 'test-user', age: 25 })
  await instance.save()

  const result = await TestModel.findByPk(instance.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.name).toBe('test-user')
  t.expect(result?.age).toBe(25)

  await instance.delete()
})

// create table with index
test('sync - create table with index', options, async (t, { db }) => {
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

  // verify table and index work
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

// add new column to existing table
test('sync - add new column to existing table', options, async (t, { db }) => {
  const tableName = `sync_add_col_${nanoid().replace(/-/g, '_')}`

  // first version of model
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

  // create initial table
  await db.sync()

  // verify initial table
  const instanceV1 = new TestModelV1({ name: 'initial' })
  await instanceV1.save()

  // now update model with new field
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
        age: YdbDataType.int32, // new field
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

  // replace model in registry
  db.model[TestModelV2.className] = TestModelV2
  TestModelV2.setCtx(db)

  // sync should add the new column
  await db.sync()

  // verify new field works
  const instanceV2 = new TestModelV2({ name: 'updated', age: 30 })
  await instanceV2.save()

  const result = await TestModelV2.findByPk(instanceV2.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.age).toBe(30)

  await instanceV1.delete()
  await instanceV2.delete()
})

// drop column (with drop flag)
test('sync - drop column from table', options, async (t, { db }) => {
  const tableName = `sync_drop_col_${nanoid().replace(/-/g, '_')}`

  // initial model with extra field
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

  // add data
  const instance = new TestModelV1({ name: 'test', deprecated: 'old' })
  await instance.save()

  // update model to drop the deprecated field
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
          drop: true, // mark for dropping
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

  // sync should drop the column
  await db.sync()

  // verify data still exists but deprecated field is gone
  const result = await TestModelV2.findByPk(instance.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.name).toBe('test')
  t.expect('deprecated' in result!).toBe(false)

  await instance.delete()
})

// multiple syncs (idempotent)
test('sync - multiple syncs are idempotent', options, async (t, { db }) => {
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

  // run sync multiple times
  await db.sync()
  await db.sync()
  await db.sync()

  // verify table still works correctly
  const instance = new TestModel({ value: 'test' })
  await instance.save()

  const result = await TestModel.findByPk(instance.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.value).toBe('test')

  await instance.delete()
})

// nullable fields (all fields except primary key are nullable)
test(
  'sync - fields are nullable except primary key',
  options,
  async (t, { db }) => {
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

    // insert with null optional field
    const userId = nanoid()
    await db.sql(`UPSERT INTO ${tableName} (id) VALUES ($id);`, { id: userId })

    // verify record exists
    const result = await db.sql(`SELECT * FROM ${tableName} WHERE id = $id;`, {
      id: userId,
    })
    t.expect(result.length).toBe(1)
    t.expect(result[0].id).toBeTruthy()

    await db.sql(`DELETE FROM ${tableName} WHERE id = $id;`, { id: userId })
  },
)

// rename field (using renamed option)
test(
  'sync - rename field from oldName to newName',
  options,
  async (t, { db }) => {
    const tableName = `sync_rename_${nanoid().replace(/-/g, '_')}`

    // initial model with old field name
    type FieldsV1 = {
      id: string
      oldName: string
    }

    class TestModelV1 extends YdbModel implements FieldsV1 {
      static schema: YdbSchemaType = {
        field: {
          id: YdbDataType.ascii,
          oldName: YdbDataType.ascii,
        },
        option: {
          tableName,
        },
      }

      id: FieldsV1['id']
      oldName: FieldsV1['oldName']

      constructor(fields: Partial<FieldsV1>) {
        super(fields)
        const { id, oldName } = fields
        this.id = id || nanoid()
        this.oldName = oldName || ''
      }
    }

    db.load(TestModelV1)

    t.teardown(async () => {
      await db.sql(`DROP TABLE ${tableName};`)
    })

    await db.sync()

    // add data with old field name
    const instance = new TestModelV1({ oldName: 'test-value' })
    await instance.save()

    // update model to rename the field
    type FieldsV2 = {
      id: string
      newName: string
    }

    class TestModelV2 extends YdbModel implements FieldsV2 {
      static schema: YdbSchemaType = {
        field: {
          id: YdbDataType.ascii,
          newName: {
            type: YdbDataType.ascii,
            renamed: 'oldName', // rename from oldName to newName
          },
        },
        option: {
          tableName,
        },
      }

      id: FieldsV2['id']
      newName: FieldsV2['newName']

      constructor(fields: Partial<FieldsV2>) {
        super(fields)
        const { id, newName } = fields
        this.id = id || nanoid()
        this.newName = newName || ''
      }
    }

    db.model[TestModelV2.className] = TestModelV2
    TestModelV2.setCtx(db)

    // sync should rename the column and copy data
    await db.sync()

    // verify data was copied to new field name
    const result = await TestModelV2.findByPk(instance.id)
    t.expect(result).toBeTruthy()
    t.expect(result?.newName).toBe('test-value')
    t.expect('oldName' in result!).toBe(false)

    await db.sql(`DELETE FROM ${tableName} WHERE id = $id;`, {
      id: instance.id,
    })
  },
)

// strict mode - drop fields not in schema
test('sync - strict mode drops extra fields', options, async (t, { db }) => {
  const tableName = `sync_strict_${nanoid().replace(/-/g, '_')}`

  // initial model with multiple fields
  type FieldsV1 = {
    id: string
    name: string
    email: string
    phone: string
  }

  class TestModelV1 extends YdbModel implements FieldsV1 {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        name: YdbDataType.ascii,
        email: YdbDataType.ascii,
        phone: YdbDataType.ascii,
      },
      option: {
        tableName,
      },
    }

    id: FieldsV1['id']
    name: FieldsV1['name']
    email: FieldsV1['email']
    phone: FieldsV1['phone']

    constructor(fields: Partial<FieldsV1>) {
      super(fields)
      const { id, name, email, phone } = fields
      this.id = id || nanoid()
      this.name = name || ''
      this.email = email || ''
      this.phone = phone || ''
    }
  }

  db.load(TestModelV1)

  t.teardown(async () => {
    await db.sql(`DROP TABLE ${tableName};`)
  })

  await db.sync()

  // add data
  const instance = new TestModelV1({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '123-456-7890',
  })
  await instance.save()

  // update model to remove email and phone fields with strict mode
  type FieldsV2 = {
    id: string
    name: string
  }

  class TestModelV2 extends YdbModel implements FieldsV2 {
    static schema: YdbSchemaType = {
      field: {
        id: YdbDataType.ascii,
        name: YdbDataType.ascii,
      },
      option: {
        tableName,
        strict: true, // enable strict mode
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

  // sync should drop email and phone fields in strict mode
  await db.sync()

  // verify extra fields were dropped
  const result = await TestModelV2.findByPk(instance.id)
  t.expect(result).toBeTruthy()
  t.expect(result?.name).toBe('John Doe')
  t.expect('email' in result!).toBe(false)
  t.expect('phone' in result!).toBe(false)

  await db.sql(`DELETE FROM ${tableName} WHERE id = $id;`, { id: instance.id })
})
