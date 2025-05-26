import type { BaseLogger } from 'pino'
import {
  AlterTableDescription,
  Column,
  Session,
  Ydb,
} from 'ydb-sdk'

import { SCHEMA_REJECTED_FIELD } from './constant'
import {
  YdbColumnType,
  YdbDataTypeId,
  YdbDataTypeWithOption,
  YdbIndexType,
  YdbModelConstructorType,
  YdbSchemaFieldType,
  YdbSchemaOptionType,
  YdbType,
} from './type'

type RawTableStructure = Awaited<ReturnType<Session['describeTable']>>
type TableStructure = Record<string, YdbDataTypeId>
type IndexStructure = Record<string, string>

const exportFieldType = (fieldType: YdbDataTypeId | YdbDataTypeWithOption) => {
  if ((fieldType as YdbDataTypeWithOption).type) {
    return fieldType as YdbDataTypeWithOption
  }
  return { type: fieldType as YdbDataTypeId } as YdbDataTypeWithOption
}

const createTable = async (
  session: any,
  {
    tableName, schema, primaryKey, logger,
  }: { tableName: string, schema: YdbSchemaFieldType, primaryKey: string, logger: BaseLogger },
) => {
  // Создаем SQL DDL для создания таблицы
  const columns: string[] = []
  const indexes: string[] = []

  Object.entries(schema).forEach(([field, fieldTypeData]) => {
    const fieldType = exportFieldType(fieldTypeData)

    if (fieldType.type == null) return
    if (fieldType.drop) return

    // Преобразуем тип YDB в SQL тип
    let sqlType = 'UTF8'
    switch (fieldType.type) {
    case Ydb.Type.PrimitiveTypeId.UTF8:
      sqlType = 'UTF8'
      break
    case Ydb.Type.PrimitiveTypeId.STRING:
      sqlType = 'STRING'
      break
    case Ydb.Type.PrimitiveTypeId.INT32:
      sqlType = 'INT32'
      break
    case Ydb.Type.PrimitiveTypeId.INT64:
      sqlType = 'INT64'
      break
    case Ydb.Type.PrimitiveTypeId.UINT32:
      sqlType = 'UINT32'
      break
    case Ydb.Type.PrimitiveTypeId.UINT64:
      sqlType = 'UINT64'
      break
    case Ydb.Type.PrimitiveTypeId.BOOL:
      sqlType = 'BOOL'
      break
    case Ydb.Type.PrimitiveTypeId.DOUBLE:
      sqlType = 'DOUBLE'
      break
    case Ydb.Type.PrimitiveTypeId.TIMESTAMP:
      sqlType = 'TIMESTAMP'
      break
    case Ydb.Type.PrimitiveTypeId.JSON:
      sqlType = 'JSON'
      break
    default:
      sqlType = 'UTF8'
    }

    columns.push(`${field} ${sqlType}`)

    if (fieldType.index) {
      indexes.push(`INDEX index_${tableName}_${field} GLOBAL ON (${field})`)
    }
  })

  const createTableSQL = `
    CREATE TABLE ${tableName} (
      ${columns.join(',\n      ')},
      PRIMARY KEY (${primaryKey})
    )${indexes.length > 0 ? `\n    WITH (${indexes.join(',\n    ')})` : ''}`

  logger.info({ msg: 'ydb: create table', table: tableName })

  // Используем QueryClient для выполнения DDL
  const query = session`${createTableSQL}`
  await query
}

const alterTable = async (
  session: Session,
  {
    tableName,
    schema,
    option,
    model,
    table,
    indexes,
    logger,
  }: {
    tableName: string,
    schema: YdbSchemaFieldType,
    option: YdbSchemaOptionType,
    table: TableStructure,
    indexes: IndexStructure,
    logger: BaseLogger,
    model: YdbModelConstructorType,
  },
) => {
  let tableDesc = new AlterTableDescription()
  let alter = false

  const renamed: Record<string, YdbDataTypeWithOption> = {}

  Object.entries(schema)
    .forEach(([field, fieldTypeData]) => {
      const fieldType = exportFieldType(fieldTypeData)

      if (fieldType.type == null) return

      if (fieldType.renamed && table[field] == null) {
        renamed[fieldType.renamed] = fieldType
        delete table[field]
        return
      }

      if (fieldType.drop) {
        tableDesc = tableDesc.withDropColumn(field)

        if (indexes[field]) {
          if (!tableDesc.dropIndexes) {
            tableDesc.dropIndexes = []
          }
          tableDesc.dropIndexes.push(indexes[field])
        }

        alter = true
        delete table[field]
        return
      }

      if (!table[field]) {
        tableDesc = tableDesc.withAddColumn(new Column(
          field,
          Ydb.Type.create({ optionalType: { item: { typeId: fieldType.type } } }),
        ))
        alter = true
        return
      }

      if (table[field] !== fieldType.type) {
        tableDesc = tableDesc.withAlterColumn(new Column(
          field,
          Ydb.Type.create({ optionalType: { item: { typeId: fieldType.type } } }),
        ))
        alter = true
      }

      if (option.strict) delete table[field]
    })

  if (option.strict) {
    Object.keys(table).forEach((field) => {
      tableDesc = tableDesc.withDropColumn(field)
      alter = true
    })
  }

  if (alter) {
    await session.alterTable(tableName, tableDesc)
    logger.info({ msg: 'ydb: alter table', table: tableName })
  }

  // move column
  const renamedFields = Object.entries(renamed)

  for (let i = 0; i < renamedFields.length; i += 1) {
    const [field, fieldType] = renamedFields[i]
    await session.alterTable(tableName, new AlterTableDescription().withAddColumn(new Column(
      field,
      Ydb.Type.create({ optionalType: { item: { typeId: fieldType.type } } }),
    )))

    await model.copy(fieldType.renamed!, field)
  }
}

export const sync = async (ctx: YdbType) => {
  const models = Object.values(ctx.model)

  await ctx.session(async (session) => {
    for (let i = 0; i < models.length; i += 1) {
      const model = models[i]

      const tableName: string = model.tableName
      let tableStructure: RawTableStructure | undefined

      try {
        // Используем SQL запрос для проверки существования таблицы
        const query = session`DESCRIBE TABLE ${session.identifier(model.tableName)};`
        const [result] = await query
        tableStructure = result as any // Временное решение
      } catch {
        ctx.logger.info({ msg: 'ydb: table not found', table: model.tableName })
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

      const schemaFields = Object.keys(schema)
      for (let j = 0; j < schemaFields.length; j += 1) {
        if (SCHEMA_REJECTED_FIELD.includes(schemaFields[i])) {
          throw new Error(`ydb: schema rejected field \`${schemaFields[j]}\` detected at table \`${tableName}\``)
        }
      }

      // table not exist
      if (tableStructure === undefined) {
        await createTable(session, {
          tableName,
          schema,
          primaryKey: model.primaryKey,
          logger: ctx.logger,
        })
        continue
      }

      const table: TableStructure = {}
      const indexes: IndexStructure = {}

      const tableColumns = tableStructure.columns as Array<YdbColumnType>
      const tableIndexes = tableStructure.indexes as Array<YdbIndexType>

      tableIndexes.forEach((index) => {
        if (index.name && index.indexColumns && index.indexColumns[0]) {
          indexes[index.indexColumns[0]] = index.name
        }
      })

      tableColumns.forEach((col) => {
        const typeId = col?.type?.optionalType?.item?.typeId
        if (col.name && typeId) {
          table[col.name] = typeId
        }
      })

      await alterTable(session, {
        tableName,
        schema,
        option,
        model,
        table,
        indexes,
        logger: ctx.logger,
      })
    }
  })
}
