const { test } = require('../test')
const UserModel = require('./model/user')
const GameModel = require('./model/game')

const options = {
  models: [
    UserModel,
    GameModel,
  ],
}

test('game', options, async (t, { logger, db }) => {
  const User = db.model.User
  const Game = db.model.Game

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

  const gameCheck = await Game.findOne({ where: { id: game.id } })

  t.same(gameCheck.toJson(), game.toJson())

  // increment
  t.equal(game.turn, 0)

  await game.increment('turn')
  t.equal(game.turn, 1)

  let gameTurnCheck = await Game.findOne({ where: { id: game.id } })
  t.equal(gameTurnCheck.turn, 1)

  await game.increment('turn', { by: 5 })
  t.equal(game.turn, 6)
  gameTurnCheck = await Game.findOne({ where: { id: game.id } })

  t.equal(gameTurnCheck.turn, 6)
})
