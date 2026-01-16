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

  // Тест создания пользователей с prepared queries
  const userOne = new User({ name: 'user-one' })
  const userTwo = new User({ name: 'user-two' })

  t.teardown(async () => {
    await userOne.delete()
    await userTwo.delete()
  })

  // Сохранение использует UPSERT с параметрами
  await userOne.save()
  await userTwo.save()

  // Поиск всех пользователей
  const users = await User.find()
  t.expect(users.length).toEqual(2)

  // Подсчет с prepared queries
  const userCount = await User.count()
  // COUNT returns BigInt in new YDB SDK
  t.expect(userCount).toBe(2n)

  // Обновление с prepared queries
  userOne.name = 'user-check'
  await userOne.save()

  // Поиск по первичному ключу с параметрами
  const userCheck = await User.findByPk(userOne.id)

  t.expect(userCheck?.name).toBe('user-check')
  t.expect(userCheck?.name).toBe(userOne.name)

  // Поиск с WHERE условием и параметрами
  const userOnlyOne = await User.findOne({
    where: {
      name: 'user-check',
    },
  })

  t.expect(userOnlyOne?.name).toBe('user-check')

  // Массовое обновление с prepared queries
  await User.update({
    name: 'user-one',
  }, {
    where: {
      name: 'user-check',
    },
  })
  userOne.name = 'user-one'

  // Поиск с сортировкой
  const usersCheck = await User.find({ order: 'name' })
  t.expect(usersCheck.length).toEqual(2)
  t.expect(usersCheck.map((u) => u.toJson())).toEqual([userTwo.toJson(), userOne.toJson()])

  // Тест поиска с IN условием
  const usersByIds = await User.find({
    where: {
      id: [userOne.id, userTwo.id],
    },
  })
  t.expect(usersByIds.length).toBe(2)

  // Тест поиска с LIKE условием
  const usersLike = await User.find({
    where: {
      name: { like: 'user' },
    },
  })
  t.expect(usersLike.length).toBe(2)

  // Тест подсчета с условием
  const activeUsersCount = await User.count({
    where: {
      name: 'user-one',
    },
    distinct: false,
  })
  t.expect(activeUsersCount).toBe(1n)

  // Тест инкремента (если есть числовое поле)
  // Предполагаем, что в модели User есть поле score
  if ('score' in userOne) {
    const initialScore = userOne.score as number || 0
    await userOne.increment('score', { by: 5 })
    t.expect(userOne.score).toBe(initialScore + 5)
  }

  // Тест пагинации
  const firstPage = await User.find({ limit: 1, page: 1 })
  t.expect(firstPage.length).toBe(1)

  const secondPage = await User.find({ limit: 1, page: 2 })
  t.expect(secondPage.length).toBe(1)

  // Проверяем, что пользователи на разных страницах разные
  t.expect(firstPage[0].id).not.toBe(secondPage[0].id)
})
