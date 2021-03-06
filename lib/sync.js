const {
  Ydb,
  TableDescription,
  Column,
  AlterTableDescription,
} = require('ydb-sdk')

async function sync() {
  await this.session(async (session) => {
    const models = Object.values(this.model)

    // eslint-disable-next-line no-restricted-syntax
    for (const m of models) {
      let table = null

      try {
        table = await session.describeTable(m.table)
      } catch {
        this.logger.info({ msg: 'ydb: table not found', table: m.table })
      }

      let schema = m.schema
      let option = {}

      if (schema.field && schema.option) {
        option = schema.option
        schema = schema.field
      }

      // alter table
      if (table) {
        let tableDesc = new AlterTableDescription()
        let alter = false

        const current = {}
        table.columns.forEach((col) => {
          current[col.name] = col.type.optionalType.item.typeId
        })

        const renamed = {}

        Object.entries(schema)
          .forEach(([field, type]) => {
            let tId = type
            if (type === Object(type)) {
              tId = type.type
            }
            if (tId == null) return

            if (type.renamed && current[field] == null) {
              renamed[field] = type
              delete current[field]
              return
            }

            if (type.drop) {
              tableDesc = tableDesc.withDropColumn(field)

              // const dIndex = table.indexes.filter((i) => i.indexColumns.includes(field)).map((i) => i.name)
              // drop index not implemented

              alter = true
              delete current[field]
              return
            }

            if (!current[field]) {
              tableDesc = tableDesc.withAddColumn(new Column(
                field,
                Ydb.Type.create({ optionalType: { item: { typeId: tId } } }),
              ))
              alter = true
              return
            }

            if (current[field] !== tId) {
              tableDesc = tableDesc.withAlterColumn(new Column(
                field,
                Ydb.Type.create({ optionalType: { item: { typeId: tId } } }),
              ))
              alter = true
            }

            if (option.strict) delete current[field]
          })

        if (option.strict) {
          Object.keys(current).forEach((field) => {
            tableDesc = tableDesc.withDropColumn(field)
            alter = true
          })
        }

        if (alter) {
          await session.alterTable(m.table, tableDesc)
          this.logger.info({ msg: 'ydb: alter table', table: m.table })
        }

        // move column
        // eslint-disable-next-line no-restricted-syntax
        for (const [field, seed] of Object.entries(renamed)) {
          await session.alterTable(m.table, new AlterTableDescription().withAddColumn(new Column(
            field,
            Ydb.Type.create({ optionalType: { item: { typeId: seed.type } } }),
          )))

          await m.copy(seed.renamed, field)
        }

        continue
      }

      // create table
      let tableDesc = new TableDescription()

      Object.entries(m.schema).forEach(([field, type]) => {
        let tId = type

        if (type === Object(type)) {
          tId = type.type
        }
        if (tId == null) return
        if (type.drop) return

        tableDesc = tableDesc.withColumn(new Column(
          field,
          Ydb.Type.create({ optionalType: { item: { typeId: tId } } }),
        ))
      })

      Object.entries(schema).forEach(([field, seed]) => {
        if (seed.index) tableDesc.withIndex({ name: `index_${m.table}_${field}`, indexColumns: [field] })
      })

      tableDesc = tableDesc.withPrimaryKey(m.primaryKey)

      this.logger.info({ msg: 'ydb: create table', table: m.table })
      await session.createTable(m.table, tableDesc)
    }
  })
}

module.exports = sync
