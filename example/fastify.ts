import fastify from 'fastify'
import { YdbFastify } from 'ydb-orm'

const app = fastify()
// load db model
const User = require('./model')

app.register(YdbFastify, {
  endpoint: process.env.YDB_ENDPOINT || '',
  database: process.env.YDB_DATABASE || '',
  meta: process.env.NODE_ENV === 'production',
  model: [
    User,
  ],
  timeout: 4000,
})

// eslint-disable-next-line semi-style, no-return-await
;(async () => app.listen())()
