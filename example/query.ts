import { Ydb } from 'ydb-orm'

import { User } from './model.js'

const db = Ydb.init({
  connectionString: process.env.YDB_CONNECTION_STRING,
  models: { User },
})

const user = await db.model.User.create({
  login: 'demo',
})

const users = await db.model.User.findAll({
  attributes: ['id', 'login', 'createdAt'],
  where: {
    login: { like: 'demo' },
  },
  order: ['createdAt', 'DESC'],
})

await db.model.User.update(
  {
    login: 'demo-updated',
  },
  {
    where: {
      id: user.id,
    },
  },
)

console.log(users.map((item) => item.toJson()))
