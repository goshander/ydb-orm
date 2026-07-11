# 🗃️ YDB simple ORM

---

Minimal ORM library for YDB database designed for rapid development of serverless applications

## Features ⭐

- Lightweight and easy-to-use methods for managing YDB databases
- Model fields and query options inferred from TypeScript schemas
- Active-record CRUD helpers and hydrated custom queries
- Parameterized YQL generation with runtime identifier validation
- Schema synchronization for tables, columns, indexes, renames, and strict mode
- Raw SQL and transaction support
- Local and Yandex Cloud readiness handling
- Native Node.js ESM package with tested CommonJS loading

---

## Requirements 🛠️

- Node.js 20.19 or newer for the published package.
- Bun 1.3.14 or newer for repository tests and development commands.
- A reachable YDB database.

## Installation 📦

```sh
npm install ydb-orm
```

## Define A Model 🧑‍💻

Define the field shape once, pass it to `YdbModel`, and merge the interface so
instance properties remain typed without repeating declarations in the class.

```ts
import { nanoid } from 'nanoid'
import { YdbDataType, YdbModel, type YdbSchemaType } from 'ydb-orm'

export type UserFields = {
  id: string
  name: string
  createdAt: Date
}

export class User extends YdbModel<UserFields> {
  static schema: YdbSchemaType = {
    id: YdbDataType.ascii,
    name: YdbDataType.ascii,
    createdAt: YdbDataType.date,
  }

  constructor(fields: Partial<UserFields> = {}) {
    super(fields)

    this.id = fields.id || nanoid()
    this.name = fields.name || ''
    this.createdAt = fields.createdAt || new Date()
  }
}

export interface User extends UserFields {}
```

Runtime input is restricted to fields declared by the model schema. Unknown
fields are rejected even when JavaScript callers bypass TypeScript.

## Connect 🔌

Register models as an object to infer the concrete model registry:

```ts
import { Ydb } from 'ydb-orm'
import { User } from './model/user.js'

const db = Ydb.init({
  connectionString: process.env.YDB_CONNECTION_STRING,
  token: process.env.YDB_TOKEN,
  models: { User },
  timeout: 10_000,
})

await db.wait()

const UserModel = db.model.User
```

`connectionString` is the preferred connection option. `endpoint` and
`database` are also supported separately. Without connection options the local
default is `grpc://localhost:2136?database=/local`.

Authentication options are evaluated in this order:

1. `credential`: service-account credentials for the built-in IAM provider.
2. `token`: an existing IAM/access token.
3. `meta: true`: YDB metadata credentials.
4. Anonymous credentials.

If no token is provided, the library also reads service-account JSON from
`./ydb-sa.json` or from the `YDB_SA_KEY` environment variable. `YDB_SA_KEY`
must contain the JSON value itself, not a file path.

When `YDB_CERTS` points to a directory, the library loads `ca.pem`, `key.pem`,
and `cert.pem` from it.

### Readiness

`db.wait(timeout)` defaults to 10 seconds. It waits for SDK Discovery, a `GOOD`
verbose SelfCheck result, and a writable non-static storage pool. Cloud
endpoints that return gRPC `UNIMPLEMENTED` specifically for Monitoring
SelfCheck fall back to successful Discovery.

## Query Models 📚

```ts
const user = await User.create({ name: 'Ada' })

const users = await User.findAll({
  attributes: ['id', 'name'],
  where: {
    and: [
      { name: { like: 'Ada' } },
      { id: { notIn: ['disabled-id'] } },
    ],
  },
  order: ['name', 'ASC'],
  limit: 20,
  page: 1,
})

const found = await User.findByPk(user.id)
await user.update({ name: 'Ada Lovelace' })
await user.reload()
await user.delete()
```

Supported query operators include `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`,
`notIn`, `like`, `notLike`, `is`, `isNot`, `not`, `between`, `notBetween`, and
nested `and`/`or` groups.

Bulk mutation requires a non-empty `where` clause:

```ts
await User.update({ name: 'inactive' }, { where: { id: 'user-id' } })
await User.destroy({ where: { id: 'user-id' } })
```

Custom YQL can hydrate model instances:

```ts
const users = await User.query(
  'SELECT * FROM user WHERE id = $id;',
  { id: 'user-id' },
)
```

## Raw SQL And Transactions 💾

```ts
const rows = await db.sql('SELECT $value AS value;', { value: 42 })

await db.transaction(async (tx) => {
  await tx.sql(
    'UPSERT INTO audit_log (id, message) VALUES ($id, $message);',
    { id: 'event-1', message: 'created user' },
  )
})
```

Values must be passed through `params`. Raw SQL strings and schema identifiers
are trusted developer input and are not sanitized by `db.sql()` or
`Model.query()`.

## Schema Synchronization 🔄

```ts
await db.wait(60_000)
await db.sync()
```

Synchronization can create tables, add or drop columns and indexes, copy renamed
fields, and remove undeclared fields in strict mode. These operations can be
destructive. The current sync implementation is a development/schema alignment
tool, not a versioned production migration system. Review schemas and back up
data before enabling destructive options.

Cloud schema-operation throttling is retried with bounded exponential backoff
within the configured database timeout.

## Security Notes 🔒

- Model-generated identifiers are validated against the registered schema.
- Values are bound as YDB parameters rather than interpolated into YQL.
- Bulk update and destroy reject empty `where` clauses.
- `debug: true` logs SQL and parameter values. Do not enable it when parameters
  may contain credentials, personal data, or other secrets.
- Keep service-account files outside version control and restrict file
  permissions.

## Examples 🧪

- [`example/model.ts`](./example/model.ts): typed model definition.
- [`example/query.ts`](./example/query.ts): typed CRUD/query usage.

## Development 🛠️

Fast checks that do not require YDB:

```sh
npm run lint
npm run typecheck
npm run typecheck:test
bun run test:unit
```

Start and stop a host-accessible local YDB:

```sh
npm run docker:db-up
npm run docker:db-down
```

Integration and package checks:

```sh
bun run test
bun run test:coverage
npm run test:nodejs
npm run test:smoke
```

Containerized equivalents:

```sh
npm run test:docker
npm run test:docker:nodejs
npm run test:docker:smoke
npm run test:docker:clean
```

`bun run test:coverage` generates `coverage/lcov.info` and enforces 100% line
and function coverage for `index.ts` and every `lib/*.ts` source file.

`npm run test:cloud` requires `yc`, `jq`, a configured Yandex Cloud profile or
service-account key, and access to the configured test database.

## License 📜

This project is licensed under the Apache License 2.0. See the [LICENSE](./LICENSE) file for more details.

---

## Contributing 🤝

If you would like to contribute to this project, please fork the repository and create a pull request. Any contributions to improve the library are welcome!

---

## Author ✍️

Georgy Malkov
Email: i@malkovgv.ru
GitHub: goshander

---

This README provides a short overview of the YDB Simple ORM, demonstrating its features, installation, usage, and examples. Happy coding! 🎉
