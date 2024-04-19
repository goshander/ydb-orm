import { TestOptions, test } from '../test'

import { Game as GameModel } from './model/game'
import { User as UserModel } from './model/user'

declare module '..' {
  interface YdbModelRegistryType {
    Game: typeof GameModel
    User: typeof UserModel
  }
}

const options: TestOptions = {
  models: [
    UserModel,
    GameModel,
  ],
  sync: true,
}

test('game', options, async (t, { db }) => {
  const User = db.model.User
  const Game = db.model.Game

  const user = new User({ name: 'test' })
  t.teardown(async () => {
    await user.delete()
  })
  await user.save()

  const game = new Game({
    meta: 'test',
    user: [{ id: user.id, name: user.name }],
    progress: 0.6667,
  })
  t.teardown(async () => {
    await game.delete()
  })
  await game.save()

  const user2 = new User({ name: 'test2' })
  t.teardown(async () => {
    await user2.delete()
  })
  await user2.save()

  const users = await User.find()
  t.expect(users.length).toEqual(2)

  game.user.push({ id: user2.id, name: user2.name })
  await game.save()

  const gameCheck = await Game.findOne({ where: { id: game.id } })

  t.expect(gameCheck?.toJson()).toEqual(game.toJson())

  // double
  t.expect(gameCheck?.progress).toEqual(0.6667)

  // increment
  t.expect(game.turn).toEqual(0)

  await game.increment('turn')
  t.expect(game.turn).toEqual(1)

  // index
  const gameByIndex = await Game.findOne({ where: { mode: 'easy' }, index: 'index_game_mode' })
  t.expect(gameByIndex).toBeTruthy()

  // count
  const userCount = await User.count()
  t.expect(userCount).toBe(2)

  // let gameTurnCheck = await Game.findOne({ where: { id: game.id } })
  // t.equal(gameTurnCheck?.turn, 1)

  // await game.increment('turn', { by: 5 })
  // t.equal(game.turn, 6)
  // gameTurnCheck = await Game.findOne({ where: { id: game.id } })

  // t.equal(gameTurnCheck?.turn, 6)
})
