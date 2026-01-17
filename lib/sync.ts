import { DATA_TYPE_KEY_TO_ID_MAP } from './constant'
import type {
  YdbColumnType,
  YdbDataTypeId,
  YdbDataTypeKey,
  YdbDataTypeWithOption,
  YdbIndexType,
  YdbModelConstructorType,
  YdbSchemaFieldType,
  YdbSchemaOptionType,
  YdbType,
} from './type'

type TableStructure = Record<string, YdbDataTypeId>
type IndexStructure = Record<string, string>

const exportFieldType = (fieldType: YdbDataTypeKey | YdbDataTypeWithOption): YdbDataTypeWithOption => {
  if ((fieldType as YdbDataTypeWithOption).type) {
    return fieldType as YdbDataTypeWithOption
  }
  return { type: fieldType as YdbDataTypeKey }
}

const createTable = async (
  ctx: YdbType,
  {
    tableName, schema, primaryKey,
  }: { tableName: string, schema: YdbSchemaFieldType, primaryKey: string },
) => {
  const columns: string[] = []
  const indexes: Array<{ name: string, field: string }> = []

  Object.entries(schema).forEach(([field, fieldTypeData]) => {
    const fieldType = exportFieldType(fieldTypeData)

    if (fieldType.type == null) return
    if (fieldType.drop) return

    columns.push(`${field} ${fieldType.type}`)

    if (fieldType.index) {
      indexes.push({ name: `index_${tableName}_${field}`, field })
    }
  })

  const createTableSql = `CREATE TABLE ${tableName} (${columns.join(', ')}, PRIMARY KEY (${primaryKey}));`

  ctx.logger.info({ table: tableName }, 'ydb: create table')

  try {
    await ctx.sql(createTableSql)
  } catch (error) {
    ctx.logger.error({ table: tableName, error }, 'ydb: error creating table')
    throw error
  }

  // Create indexes
  for (let i = 0; i < indexes.length; i += 1) {
    const index = indexes[i]
    const createIndexSql = `ALTER TABLE ${tableName} ADD INDEX ${index.name} GLOBAL ON (${index.field});`

    try {
      await ctx.sql(createIndexSql)
      ctx.logger.info({ table: tableName, index: index.name }, 'ydb: create index')
    } catch (error) {
      ctx.logger.error({ table: tableName, index: index.name, error }, 'ydb: error creating index')
    }
  }
}

const alterTable = async (
  ctx: YdbType,
  {
    tableName,
    schema,
    option,
    model,
    table,
    indexes,
  }: {
    tableName: string,
    schema: YdbSchemaFieldType,
    option: YdbSchemaOptionType,
    table: TableStructure,
    indexes: IndexStructure,
    model: YdbModelConstructorType,
  },
) => {
  const renamed: Record<string, YdbDataTypeWithOption> = {}

  for (const [field, fieldTypeData] of Object.entries(schema)) {
    const fieldType = exportFieldType(fieldTypeData)

    if (fieldType.type == null) continue

    // Handle renamed fields
    if (fieldType.renamed && table[field] == null) {
      renamed[fieldType.renamed] = fieldType
      delete table[field]
      continue
    }

    // Handle drop fields
    if (fieldType.drop) {
      if (table[field]) {
        // Drop index if exists
        if (indexes[field]) {
          try {
            await ctx.sql(`ALTER TABLE ${tableName} DROP INDEX ${indexes[field]};`)
            ctx.logger.info({ table: tableName, index: indexes[field] }, 'ydb: drop index')
          } catch (error) {
            ctx.logger.error({ table: tableName, index: indexes[field], error }, 'ydb: error dropping index')
          }
        }

        // Drop column
        try {
          await ctx.sql(`ALTER TABLE ${tableName} DROP COLUMN ${field};`)
          ctx.logger.info({ table: tableName, field }, 'ydb: drop column')
        } catch (error) {
          ctx.logger.error({ table: tableName, field, error }, 'ydb: error dropping column')
        }

        delete table[field]
      }
      continue
    }

    const typeId = DATA_TYPE_KEY_TO_ID_MAP[fieldType.type]
    if (!typeId) {
      ctx.logger.error({ field, type: fieldType.type }, 'ydb: unknown field type')
      continue
    }

    // Add new field
    if (!table[field]) {
      try {
        await ctx.sql(`ALTER TABLE ${tableName} ADD COLUMN ${field} ${fieldType.type};`)
        ctx.logger.info({ table: tableName, field }, 'ydb: add column')
      } catch (error) {
        ctx.logger.error({ table: tableName, field, error }, 'ydb: error adding column')
      }

      // Add index if needed
      if (fieldType.index && !indexes[field]) {
        try {
          await ctx.sql(`ALTER TABLE ${tableName} ADD INDEX index_${tableName}_${field} GLOBAL ON (${field});`)
          ctx.logger.info({ table: tableName, field }, 'ydb: add index')
        } catch (error) {
          ctx.logger.error({ table: tableName, field, error }, 'ydb: error adding index')
        }
      }

      continue
    }

    // Check if type changed
    if (table[field] !== typeId) {
      ctx.logger.warn({ field, oldType: table[field], newType: typeId }, 'ydb: type change detected, manual migration may be needed')
    }

    // Add/drop index
    if (fieldType.index && !indexes[field]) {
      try {
        await ctx.sql(`ALTER TABLE ${tableName} ADD INDEX index_${tableName}_${field} GLOBAL ON (${field});`)
        ctx.logger.info({ table: tableName, field }, 'ydb: add index')
      } catch (error) {
        ctx.logger.error({ table: tableName, field, error }, 'ydb: error adding index')
      }
    } else if (!fieldType.index && indexes[field]) {
      try {
        await ctx.sql(`ALTER TABLE ${tableName} DROP INDEX ${indexes[field]};`)
        ctx.logger.info({ table: tableName, index: indexes[field] }, 'ydb: drop index')
      } catch (error) {
        ctx.logger.error({ table: tableName, index: indexes[field], error }, 'ydb: error dropping index')
      }
    }

    if (option.strict) delete table[field]
  }

  // Strict mode: drop fields not in schema
  if (option.strict) {
    for (const field of Object.keys(table)) {
      try {
        await ctx.sql(`ALTER TABLE ${tableName} DROP COLUMN ${field};`)
        ctx.logger.info({ table: tableName, field }, 'ydb: drop column (strict mode)')
      } catch (error) {
        ctx.logger.error({ table: tableName, field, error }, 'ydb: error dropping column')
      }
    }
  }

  // Handle renamed fields (copy data)
  const renamedFields = Object.entries(renamed)

  for (let i = 0; i < renamedFields.length; i += 1) {
    const [newField, fieldType] = renamedFields[i]
    const oldField = fieldType.renamed!

    try {
      // Add new column
      await ctx.sql(`ALTER TABLE ${tableName} ADD COLUMN ${newField} ${fieldType.type};`)

      // Copy data from old column to new column
      await model.copy(oldField, newField)

      // Drop old column
      await ctx.sql(`ALTER TABLE ${tableName} DROP COLUMN ${oldField};`)

      ctx.logger.info({ table: tableName, from: oldField, to: newField }, 'ydb: renamed field')
    } catch (error) {
      ctx.logger.error({
        table: tableName, from: oldField, to: newField, error,
      }, 'ydb: error renaming field')
    }
  }
}

export const sync = async (ctx: YdbType) => {
  const models = Object.values(ctx.model)
  const api = ctx.api()

  for (let i = 0; i < models.length; i += 1) {
    const model = models[i]

    const tableName: string = model.tableName
    let tableExists = false

    try {
      await ctx.sql(`SELECT 1 AS check FROM ${tableName} LIMIT 1;`)
      tableExists = true
    } catch {
      ctx.logger.info({ table: model.tableName }, 'ydb: table not found')
    }

    let schema: YdbSchemaFieldType
    let option: YdbSchemaOptionType = {}

    if (model.schema.field) {
      schema = model.schema.field as YdbSchemaFieldType
      const schemaOption = model.schema.option as YdbSchemaOptionType | undefined
      if (schemaOption) { option = schemaOption }
    } else {
      schema = model.schema as YdbSchemaFieldType
    }

    // Table doesn't exist - create it
    if (!tableExists) {
      await createTable(ctx, {
        tableName,
        schema,
        primaryKey: model.primaryKey,
      })
      continue
    }

    // Table exists - check if alteration is needed
    const tableStructure = await api.describeTable(tableName)

    const table: TableStructure = {}
    const indexes: IndexStructure = {}

    const tableColumns = (tableStructure?.columns || []) as Array<YdbColumnType>
    const tableIndexes = (tableStructure?.indexes || []) as Array<YdbIndexType>

    tableIndexes.forEach((index) => {
      if (index.name && index.indexColumns && index.indexColumns[0]) {
        indexes[index.indexColumns[0]] = index.name
      }
    })

    tableColumns.forEach((col) => {
      let typeId: number | undefined

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const colType = col.type as any

      if (colType?.type?.case === 'optionalType') {
        // Optional type: col.type.type.value.item.type.value
        typeId = colType.type.value?.item?.type?.value as number
      } else if (colType?.type?.case === 'typeId') {
        // Direct type: col.type.type.value
        typeId = colType.type.value as number
      }

      if (col.name && typeId) {
        table[col.name] = typeId as YdbDataTypeId
      }
    })

    await alterTable(ctx, {
      tableName,
      schema,
      option,
      model,
      table,
      indexes,
    })
  }
}
