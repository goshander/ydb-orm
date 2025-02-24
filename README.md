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
const { Ydb } = require('ydb-orm');

const db = Ydb.init({
  endpoint: process.env.YDB_ENDPOINT,
  database: process.env.YDB_DATABASE,

  // optional: authentication method
  credential, // service account credential
  token, // cloud IAM token
  meta, // metadata service (e.g., from Lambda)

  model: [
    User, // list of YdbModels to load
  ],
  timeout: 2000,
});

Ydb.db; // singleton instance of database
```

- As a Fastify web server plugin

You can also register the YDB ORM as a plugin in your Fastify application:

Install fastify plugin with: `npm i fastify-ydb-orm`

```ts
const { YdbFastify } = require('fastify-ydb-orm');

app.register(YdbFastify, {
  endpoint: process.env.YDB_ENDPOINT,
  database: process.env.YDB_DATABASE,

  // optional: same authentication options as the library
  model: [
    User, // load YdbModels
  ],
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
import { YdbModel, YdbDataType } from 'ydb-orm';
import { nanoid } from 'nanoid';

type Fields = {
  id: string,
  name: string,
  createdAt: Date,
};

export class User extends YdbModel implements Fields {
  static schema = {
    id: YdbDataType.ascii,
    name: YdbDataType.ascii,
    createdAt: YdbDataType.date,
  };

  id: Fields['id'];
  name: Fields['name'];
  createdAt: Fields['createdAt'];

  constructor(fields: Partial<Fields>) {
    super(fields);
    const { name, id, createdAt } = fields;
    this.id = id || nanoid();
    this.name = name || '';
    this.createdAt = createdAt || new Date();
  }
}
```

---

## Running Tests with Docker 🐳

You can easily run tests using Docker. No need to set up the Docker environment variables. Just using the following command:

`npm run test-docker`

Once the tests are completed, you can down the docker containers with:

`npm run test-docker-clean`

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