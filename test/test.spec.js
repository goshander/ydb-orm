const { test } = require('../test')

test('game', async (t, { db, logger }) => {
  const User = db.model.User
  const Game = db.model.Game
  const Turn = db.model.Turn

  const user = new User({ name: 'test' })
  t.teardown(async () => {
    await user.delete()
  })
  await user.save()

  const game = new Game({
    meta: 'test',
    user: [user.id],
  })
  t.teardown(async () => {
    await game.delete()
  })
  await game.save()

  const user2 = new User({ name: 'test2' })
  t.teardown(async () => {
    await user2.delete()
  })

  game.user.push(user2.id)
  await game.save()
  await game.start()

  const gameCheck = await Game.findOne({ id: game.id })

  t.same(gameCheck.toJson(), game.toJson())
})

// test('request', async (t, { app, db, logger }) => {

//   const response = await app.inject({
//     method: 'POST',
//     url: '/request/create',
//   })

//   t.equal(response.statusCode, 200)
// })
