import { type TestBase, type TestOptions, test } from '../test.js'

import { Game as GameModel } from './model/game.js'
import { User as UserModel } from './model/user.js'

const options = {
  models: { User: UserModel, Game: GameModel },
  sync: true,
} satisfies TestOptions

type GameConstructor = typeof GameModel
type UserConstructor = typeof UserModel

const createGame = async (
  t: TestBase,
  User: UserConstructor,
  Game: GameConstructor,
) => {
  const userOne = User.build({ name: 'user-one' })
  await userOne.save()

  const game = Game.build({
    meta: 'game',
    user: [{ id: userOne.id, name: userOne.name }],
    progress: 0.6667,
  })
  await game.save()

  t.teardown(async () => {
    await game.delete()
    await userOne.delete()
  })

  return { game, userOne }
}

test('game - save and load json fields', options, async (t, { db }) => {
  const User = db.model.User
  const Game = db.model.Game
  const { game } = await createGame(t, User, Game)

  const userTwo = User.build({ name: 'user-two' })
  await userTwo.save()
  t.teardown(async () => {
    await userTwo.delete()
  })

  game.user.push({ id: userTwo.id, name: userTwo.name })
  await game.save()

  const gameCheck = await Game.findOne({ where: { id: game.id } })

  t.expect(gameCheck?.toJson()).toEqual(game.toJson())
})

test('game - double field comparisons', options, async (t, { db }) => {
  const User = db.model.User
  const Game = db.model.Game
  const { game } = await createGame(t, User, Game)

  const gameByProgress = await Game.findOne({
    where: {
      id: game.id,
      progress: {
        gt: 0.5,
        gte: 0.6667,
        lt: 1,
        lte: 0.6667,
        ne: 0,
      },
    },
  })

  t.expect(gameByProgress?.id).toBe(game.id)
  t.expect(gameByProgress?.progress).toEqual(0.6667)
})

test('game - increment field', options, async (t, { db }) => {
  const User = db.model.User
  const Game = db.model.Game
  const { game } = await createGame(t, User, Game)

  t.expect(game.turn).toEqual(0)

  await game.increment('turn')
  t.expect(game.turn).toEqual(1)

  let gameTurnCheck = await Game.findOne({ where: { id: game.id } })
  t.expect(gameTurnCheck?.turn).toEqual(1)

  await game.increment('turn', { by: 5 })
  t.expect(game.turn).toEqual(6)

  gameTurnCheck = await Game.findOne({ where: { id: game.id } })
  t.expect(gameTurnCheck?.turn).toEqual(6)
})

test('game - find by index', options, async (t, { db }) => {
  const User = db.model.User
  const Game = db.model.Game
  const { game } = await createGame(t, User, Game)

  const gameByIndex = await Game.findOne({
    where: {
      id: game.id,
      mode: 'easy',
    },
    index: 'index_game_mode',
  })

  t.expect(gameByIndex?.id).toBe(game.id)
})
