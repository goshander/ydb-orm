import { type TestBase, type TestOptions, test } from '../test.js'

import { User as UserModel } from './model/user.js'

const options = {
  models: { User: UserModel },
  sync: true,
} satisfies TestOptions

type UserConstructor = typeof UserModel

const expectReject = async (
  t: TestBase,
  callback: () => Promise<unknown>,
  message: string,
) => {
  try {
    await callback()
    throw new Error('expected callback to reject')
  } catch (error) {
    t.expect((error as Error).message).toContain(message)
  }
}

const createUsers = async (t: TestBase, User: UserConstructor) => {
  const userOne = User.build({ name: 'user-one' })
  const userTwo = await User.create({ name: 'user-two' })

  t.teardown(async () => {
    await userOne.delete()
    await userTwo.delete()
  })

  await userOne.save()

  return { userOne, userTwo }
}

test('user - build, create and findAll', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne, userTwo } = await createUsers(t, User)

  const users = await User.findAll({
    where: {
      id: [userOne.id, userTwo.id],
    },
  })

  t.expect(users.length).toBe(2)
})

test('user - instance update and reload', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne } = await createUsers(t, User)

  await userOne.update({ name: 'user-update-instance' })
  await userOne.reload()

  t.expect(userOne.name).toBe('user-update-instance')
})

test('user - count returns bigint', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne, userTwo } = await createUsers(t, User)

  const userCount = await User.count({
    where: {
      id: [userOne.id, userTwo.id],
    },
    distinct: false,
  })

  t.expect(userCount).toBe(2n)
})

test('user - findByPk and findOne', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne } = await createUsers(t, User)

  userOne.name = 'user-check'
  await userOne.save()

  const userCheck = await User.findByPk(userOne.id)
  const userOnlyOne = await User.findOne({
    where: {
      name: 'user-check',
    },
  })

  t.expect(userCheck?.name).toBe('user-check')
  t.expect(userCheck?.name).toBe(userOne.name)
  t.expect(userOnlyOne?.name).toBe('user-check')
})

test(
  'user - custom query returns model instances',
  options,
  async (t, { db }) => {
    const User = db.model.User
    const { userOne } = await createUsers(t, User)

    const users = await User.query(
      `SELECT * FROM ${User.tableName} WHERE id = $id;`,
      {
        id: userOne.id,
      },
    )

    t.expect(users.length).toBe(1)
    t.expect(users[0]).toBeInstanceOf(User)
    t.expect(users[0].id).toBe(userOne.id)
    t.expect(users[0].name).toBe('user-one')
  },
)

test('user - bulk update', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne } = await createUsers(t, User)

  userOne.name = 'user-check'
  await userOne.save()

  await User.update(
    {
      name: 'user-bulk-update',
    },
    {
      where: {
        id: userOne.id,
      },
    },
  )

  const userCheck = await User.findByPk(userOne.id)
  t.expect(userCheck?.name).toBe('user-bulk-update')
})

test('user - order and attributes', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne, userTwo } = await createUsers(t, User)

  const usersDesc = await User.find({
    where: {
      id: [userOne.id, userTwo.id],
    },
    order: 'name',
  })
  const usersAsc = await User.find({
    where: {
      id: [userOne.id, userTwo.id],
    },
    order: ['name', 'ASC'],
  })
  const usersWithAttributes = await User.find({
    attributes: ['id', 'name'],
    where: {
      id: userOne.id,
    },
  })

  t.expect(usersDesc.map((u) => u.toJson())).toEqual([
    userTwo.toJson(),
    userOne.toJson(),
  ])
  t.expect(usersAsc.map((u) => u.id)).toEqual([userOne.id, userTwo.id])
  t.expect(usersWithAttributes.length).toBe(1)
  t.expect(usersWithAttributes[0].id).toBe(userOne.id)
})

test('user - in, notIn and logical where', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne, userTwo } = await createUsers(t, User)

  const usersByIds = await User.find({
    where: {
      id: [userOne.id, userTwo.id],
    },
  })
  const usersNotIn = await User.find({
    where: {
      id: { notIn: [userOne.id] },
      name: { ne: 'unknown-user' },
    },
  })
  const usersByLogicalWhere = await User.find({
    where: {
      or: [{ name: 'user-one' }, { name: 'user-two' }],
      and: [{ id: [userOne.id, userTwo.id] }],
    },
    order: [['name', 'ASC']],
  })

  t.expect(usersByIds.length).toBe(2)
  t.expect(usersNotIn.length).toBe(1)
  t.expect(usersNotIn[0].id).toBe(userTwo.id)
  t.expect(usersByLogicalWhere.map((u) => u.id)).toEqual([
    userOne.id,
    userTwo.id,
  ])
})

test(
  'user - like, notLike, not and null checks',
  options,
  async (t, { db }) => {
    const User = db.model.User
    await createUsers(t, User)

    const usersLike = await User.find({
      where: {
        name: { like: 'user' },
      },
    })
    const usersNotLike = await User.find({
      where: {
        name: { notLike: 'missing' },
        createdAt: { isNot: null },
      },
    })
    const usersNot = await User.find({
      where: {
        name: { not: 'missing-user' },
      },
    })

    t.expect(usersLike.length).toBeGreaterThanOrEqual(2)
    t.expect(usersNotLike.length).toBeGreaterThanOrEqual(2)
    t.expect(usersNot.length).toBeGreaterThanOrEqual(2)
  },
)

test('user - between and notBetween', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne } = await createUsers(t, User)

  const usersBetweenDates = await User.find({
    where: {
      createdAt: {
        between: [
          new Date(userOne.createdAt.getTime() - 1000),
          new Date(userOne.createdAt.getTime() + 1000),
        ],
      },
    },
  })
  const usersNotBetweenDates = await User.find({
    where: {
      createdAt: {
        notBetween: [
          new Date(userOne.createdAt.getTime() + 1000),
          new Date(userOne.createdAt.getTime() + 2000),
        ],
      },
    },
  })

  t.expect(usersBetweenDates.length).toBeGreaterThanOrEqual(2)
  t.expect(usersNotBetweenDates.length).toBeGreaterThanOrEqual(2)
})

test('user - count with condition', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne } = await createUsers(t, User)

  const activeUsersCount = await User.count({
    where: {
      id: userOne.id,
      name: 'user-one',
    },
    distinct: false,
  })

  t.expect(activeUsersCount).toBe(1n)
})

test(
  'user - invalid schema fields fail before query',
  options,
  async (t, { db }) => {
    const User = db.model.User
    const { userOne } = await createUsers(t, User)

    await expectReject(
      t,
      () =>
        User.find({
          attributes: ['unknownField'],
        } as unknown as Parameters<typeof User.find>[0]),
      'unknown schema field [unknownField]',
    )
    await expectReject(
      t,
      () =>
        User.find({
          order: 'unknownField',
        } as unknown as Parameters<typeof User.find>[0]),
      'unknown schema field [unknownField]',
    )
    await expectReject(
      t,
      () =>
        User.find({
          where: { unknownField: 'value' },
        } as unknown as Parameters<typeof User.find>[0]),
      'unknown schema field [unknownField]',
    )
    await expectReject(
      t,
      () =>
        User.update(
          { unknownField: 'value' } as unknown as Parameters<
            typeof User.update
          >[0],
          {
            where: {
              id: userOne.id,
            },
          },
        ),
      'unknown schema field [unknownField]',
    )
    await expectReject(
      t,
      () =>
        User.destroy({
          where: { unknownField: 'value' },
        } as unknown as Parameters<typeof User.destroy>[0]),
      'unknown schema field [unknownField]',
    )
    await expectReject(
      t,
      () =>
        User.count({
          field: 'unknownField',
          distinct: false,
        } as unknown as Parameters<typeof User.count>[0]),
      'unknown schema field [unknownField]',
    )
    await expectReject(
      t,
      () => userOne.increment('unknownField'),
      'unknown schema field [unknownField]',
    )
  },
)

test(
  'user - invalid pagination options fail before query',
  options,
  async (t, { db }) => {
    const User = db.model.User

    await expectReject(t, () => User.find({ limit: 0 }), 'invalid limit [0]')
    await expectReject(
      t,
      () => User.find({ offset: -1 }),
      'invalid offset [-1]',
    )
    await expectReject(t, () => User.find({ page: 0 }), 'invalid page [0]')
  },
)

test('user - pagination', options, async (t, { db }) => {
  const User = db.model.User
  const { userOne, userTwo } = await createUsers(t, User)

  const firstPage = await User.find({
    where: {
      id: [userOne.id, userTwo.id],
    },
    limit: 1,
    page: 1,
    order: ['name', 'ASC'],
  })
  const secondPage = await User.find({
    where: {
      id: [userOne.id, userTwo.id],
    },
    limit: 1,
    page: 2,
    order: ['name', 'ASC'],
  })

  t.expect(firstPage.length).toBe(1)
  t.expect(secondPage.length).toBe(1)
  t.expect(firstPage[0].id).not.toBe(secondPage[0].id)
})
