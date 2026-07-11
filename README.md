# 🗃️ YDB simple ORM

---

Minimal ORM library for YDB database designed for rapid development of serverless applications

## Features ⭐
- Lightweight and easy-to-use methods for managing YDB databases
- Supports data models with automatic migrations and schema synchronization
- Compatible with the Fastify web server framework

---

## Installation 📦
To install the library, run:

`npm install ydb-orm`

Or using yarn:

`yarn add ydb-orm`

## Usage 📚

- As a Library

You can use the YDB ORM in your Node.js application as follows:

```ts
import { Ydb } from 'ydb-orm';
import { User } from './model/user';

const db = Ydb.init({
  // [deprecated] endpoint: process.env.YDB_ENDPOINT,
  // [deprecated] database: process.env.YDB_DATABASE,
  connectionString: process.env.YDB_CONNECTION_STRING,

  // optional: authentication method
  credential, // service account credential
  token, // cloud IAM token
  meta, // metadata service (e.g., from Lambda)

  // optional: object of YdbModels to load
  models: { User },
  timeout: 2000,
});

Ydb.db; // singleton instance of database
db.model.User; // typed model from the models object

// wait until YDB reports GOOD health and a writable storage pool
// - 10 seconds by default
// useful while a local YDB instance is still starting
await db.wait();

const users = await db.model.User.findAll({
  attributes: ['id', 'name'],
  where: {
    name: { like: 'alex' },
  },
  order: ['name', 'ASC'],
});

const usersFromCustomQuery = await db.model.User.query(
  'SELECT * FROM user WHERE id = $id;',
  {
    id: 'user-id',
  },
);

await db.transaction(async (tx) => {
  await tx.sql('UPSERT INTO audit_log (id, message) VALUES ($id, $message);', {
    id: 'event-1',
    message: 'created user',
  });
});
```

- As a Fastify web server plugin

You can also register the YDB ORM as a plugin in your Fastify application:

Install fastify plugin with: `npm i fastify-ydb-orm`

```ts
import { YdbFastify } from 'fastify-ydb-orm';
import { User } from './model/user';

app.register(YdbFastify, {
  // [deprecated] endpoint: process.env.YDB_ENDPOINT,
  // [deprecated] database: process.env.YDB_DATABASE,
  connectionString: process.env.YDB_CONNECTION_STRING,

  // optional: same authentication options as the library

  // optional: object of YdbModels to load
  models: { User },
  timeout: 2000,

  sync: true, // enable automatic schema synchronization and migration
});

// no need to create a connection explicitly in Fastify mode
```


## Environment Variables 🌍

You can to set up the following environment variables to automatically load credentials:

`YDB_SA_KEY` - Path to the service account credential JSON file
`YDB_CERTS` - Path to the YDB connection certificates. 🔒

---

## Example Model 🧑‍💻

Here is an example of a user model that can be defined using the YDB ORM:

```ts
import { nanoid } from 'nanoid';
import { YdbDataType, YdbModel, type YdbSchemaType } from 'ydb-orm';

export type UserFields = {
  id: string,
  name: string,
  createdAt: Date,
};

export class User extends YdbModel<UserFields> {
  static schema: YdbSchemaType = {
    id: YdbDataType.ascii,
    name: YdbDataType.ascii,
    createdAt: YdbDataType.date,
  };

  constructor(fields: Partial<UserFields> = {}) {
    super(fields);

    const { name, id, createdAt } = fields;
    this.id = id || nanoid();
    this.name = name || '';
    this.createdAt = createdAt || new Date();
  }
}

export interface User extends UserFields {}
```

`YdbModel<UserFields>` is used by `build`, `create`, `find`, `findAll`, `findOne`, `count`, `update` and `destroy`, so query field names are checked by TypeScript.

---

## Running Tests with Docker 🐳

You can easily run tests using Docker. No need to set up the Docker environment variables. Just using the following command:

`npm run test-docker`

Once the tests are completed, you can down the docker containers with:

`npm run test-docker-clean`

The compiled Node.js package smoke test is also available as an isolated Docker service:

`docker compose run --rm package-smoke`

## Local Quality Checks ✅

Run the same checks as CI before opening a PR:

```sh
npm run lint
npm run typecheck
npm run typecheck:test
bun run test
npm run test-nodejs
bun run test:coverage
```

`bun run test:coverage` writes an lcov report to `coverage/` and enforces 100% line/function coverage for package source files (`index.ts` and `lib/**/*.ts`).

---

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
