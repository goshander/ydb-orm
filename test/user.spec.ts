import { TestOptions, test } from '../test'

import { User as UserModel } from './model/user'

declare module '..' {
  interface YdbModelRegistryType {
    User: typeof UserModel
  }
}

const options: TestOptions = {
  models: [
    UserModel,
  ],
  sync: true,
}

test(import.meta, 'user', options, async (t, { db }) => {
  const User = db.model.User

  const userOne = new User({ name: 'user-one' })
  const userTwo = new User({ name: 'user-two' })
  t.teardown(async () => {
    await userOne.delete()
    await userTwo.delete()
  })
  await userOne.save()
  await userTwo.save()

  const users = await User.find()
  t.expect(users.length).toEqual(2)

  const userCount = await User.count()
  t.expect(userCount).toBe(2)

  userOne.name = 'user-check'
  await userOne.save()

  const userCheck = await User.findByPk(userOne.id)

  t.expect(userCheck?.name).toBe('user-check')
  t.expect(userCheck?.name).toBe(userOne.name)

  const userOnlyOne = await User.findOne({
    where: {
      name: 'user-check',
    },
  })

  t.expect(userOnlyOne?.name).toBe('user-check')

  await User.update({
    name: 'user-one',
  }, {
    where: {
      name: 'user-check',
    },
  })
  userOne.name = 'user-one'

  const usersCheck = await User.find({ order: 'name' })
  t.expect(usersCheck.length).toEqual(2)
  t.expect(usersCheck.map((u) => u.toJson())).toEqual([userTwo.toJson(), userOne.toJson()])
})
