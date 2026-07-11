import { Ydb } from '../index.js'

import { User as UserModel } from './model/user.js'

const db = Ydb.init({
  models: { User: UserModel },
})

const User = db.model.User

void User.build({ name: 'typed-user' })
void User.create({ name: 'typed-user' })
void User.find({
  attributes: ['id', 'name'],
  order: ['name', 'ASC'],
  where: {
    or: [{ name: { like: 'typed' } }, { id: { notIn: ['missing'] } }],
  },
})
void User.query('SELECT * FROM user WHERE id = $id;', { id: 'typed-id' }).then(
  (users) => {
    const firstUserName: string | undefined = users[0]?.name
    void firstUserName
  },
)
void User.count({ field: 'name', distinct: false })
void User.update({ name: 'next-name' }, { where: { id: 'typed-id' } })
void User.destroy({ where: { id: 'typed-id' } })

// @ts-expect-error unknown build field must be rejected
void User.build({ unknownField: 'typed-user' })

// @ts-expect-error unknown where field must be rejected
void User.find({ where: { unknownField: 'typed-user' } })

// @ts-expect-error unknown attribute must be rejected
void User.find({ attributes: ['unknownField'] })

// @ts-expect-error unknown order field must be rejected
void User.find({ order: 'unknownField' })

// @ts-expect-error unknown count field must be rejected
void User.count({ field: 'unknownField', distinct: false })

// @ts-expect-error unknown update field must be rejected
void User.update({ unknownField: 'typed-user' }, { where: { id: 'typed-id' } })

// @ts-expect-error unknown destroy where field must be rejected
void User.destroy({ where: { unknownField: 'typed-user' } })
