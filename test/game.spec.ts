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

test(import.meta, 'game', options, async (t, { db }) => {
  const User = db.model.User
  const Game = db.model.Game

  const userOne = new User({ name: 'user-one' })
  t.teardown(async () => {
    await userOne.delete()
  })
  await userOne.save()

  const game = new Game({
    meta: 'game',
    user: [{ id: userOne.id, name: userOne.name }],
    progress: 0.6667,
  })
  t.teardown(async () => {
    await game.delete()
  })
  await game.save()

  const userTwo = new User({ name: 'user-two' })
  t.teardown(async () => {
    await userTwo.delete()
  })
  await userTwo.save()

  game.user.push({ id: userTwo.id, name: userTwo.name })
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

  let gameTurnCheck = await Game.findOne({ where: { id: game.id } })
  t.expect(gameTurnCheck?.turn).toEqual(1)

  await game.increment('turn', { by: 5 })
  t.expect(game.turn).toEqual(6)

  gameTurnCheck = await Game.findOne({ where: { id: game.id } })
  t.expect(gameTurnCheck?.turn).toEqual(6)
})
