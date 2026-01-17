import { type TestOptions, test } from '../test'

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

  // test user created with prepared queries
  const userOne = new User({ name: 'user-one' })
  const userTwo = new User({ name: 'user-two' })

  t.teardown(async () => {
    await userOne.delete()
    await userTwo.delete()
  })

  // saving uses UPSERT with parameters
  await userOne.save()
  await userTwo.save()

  // finding all users
  const users = await User.find()
  t.expect(users.length).toEqual(2)

  // counting with prepared queries
  const userCount = await User.count()
  // COUNT returns BigInt in new YDB SDK
  t.expect(userCount).toBe(2n)

  // updating with prepared queries
  userOne.name = 'user-check'
  await userOne.save()

  // finding by primary key with parameters
  const userCheck = await User.findByPk(userOne.id)

  t.expect(userCheck?.name).toBe('user-check')
  t.expect(userCheck?.name).toBe(userOne.name)

  // finding with WHERE condition and parameters
  const userOnlyOne = await User.findOne({
    where: {
      name: 'user-check',
    },
  })

  t.expect(userOnlyOne?.name).toBe('user-check')

  // bulk update with prepared queries
  await User.update({
    name: 'user-one',
  }, {
    where: {
      name: 'user-check',
    },
  })
  userOne.name = 'user-one'

  // finding with sorting
  const usersCheck = await User.find({ order: 'name' })
  t.expect(usersCheck.length).toEqual(2)
  t.expect(usersCheck.map((u) => u.toJson())).toEqual([userTwo.toJson(), userOne.toJson()])

  // test finding with IN condition
  const usersByIds = await User.find({
    where: {
      id: [userOne.id, userTwo.id],
    },
  })
  t.expect(usersByIds.length).toBe(2)

  // test finding with LIKE condition
  const usersLike = await User.find({
    where: {
      name: { like: 'user' },
    },
  })
  t.expect(usersLike.length).toBe(2)

  // test counting with condition
  const activeUsersCount = await User.count({
    where: {
      name: 'user-one',
    },
    distinct: false,
  })
  t.expect(activeUsersCount).toBe(1n)

  // test increment (if there is a numeric field)
  // assuming that the User model has a score field
  if ('score' in userOne) {
    const initialScore = userOne.score as number || 0
    await userOne.increment('score', { by: 5 })
    t.expect(userOne.score).toBe(initialScore + 5)
  }

  // test pagination
  const firstPage = await User.find({ limit: 1, page: 1 })
  t.expect(firstPage.length).toBe(1)

  const secondPage = await User.find({ limit: 1, page: 2 })
  t.expect(secondPage.length).toBe(1)

  // checking that users on different pages are different
  t.expect(firstPage[0].id).not.toBe(secondPage[0].id)
})
