# 💾 YDB simple ORM

---

***[In Development]***

Minimal ORM lib for YDB database for fast development services with serverless ecosystem

**Usage example**

- as lib:
```javascript
const { Ydb } = require('ydb-orm')

const db = Ydb.init(endpoint, database, {
  endpoint: process.env.YDB_ENDPOINT,
  database: process.env.YDB_DATABASE,

  // one of auth specific method
  credential, // [optional] - auth with sa account credential
  token, // [optional] - auth with iam token
  meta, // [optional] - auth with meta service  (ex. from lambda)

  model: [
    User, // YdbModel list for load
  ],
  timeout: 2000, 
})

Ydb.db // singleton
```

- as `fastify` web-server plugin:

```javascript
const ydb = require('ydb-orm')

app.register(ydb.fastify, {
  endpoint: process.env.YDB_ENDPOINT,
  database: process.env.YDB_DATABASE,

  // same auth option as lib

  model: [
    User, // YdbModel list for load
  ],
  timeout: 2000,

  sync: true, // [optional] enable auto sync model creation/migration
})

// connection in fastify mode not needed
```

### Environment variables

- `YDB_SA_KEY` - specific path to service account credential json file

- `YDB_CERTS` - specific path to ydb connection certs

---

***[В разработке]***

Минимальная реализация ORM для YDB базы данных для быстрой разработки сервисов в безсерверной экосистеме на основе лямбда функций
