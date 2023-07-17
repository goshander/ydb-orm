import tap from 'tap'
import { Ydb, YdbModel, YdbError } from '.'

export type TestOptions = {
  models: Array<typeof YdbModel>
}

export type TestCtx = {
  db: any;
  logger: any;
}

export type TestCallback = (t: Tap.Test, ctx: TestCtx)=> void | Promise<void>

type TestArgs = [
  string,
  TestOptions,
  TestCallback,
] | [
  string,
  TestCallback,
]

const NOT_READY = 'database doesn\'t have storage pools at all to create tablet channels to storage pool binding by profile id'

async function timeoutAsync(time: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, time)
  })
}

async function prepare(t: Tap.Test, option?: TestOptions) {
  const db = Ydb.init(process.env.YDB_ENDPOINT, process.env.YDB_DATABASE, {
    timeout: 1000,
  })

  // load models
  if (option?.models) {
    option.models.forEach((m) => db.load(m))
  }

  t.teardown(async () => {
    await db.close()
  })

  await db.connect()

  // ready storage hack before sync
  let dbSyncReady = false
  while (!dbSyncReady) {
    try {
      await db.sync()
      dbSyncReady = true
    } catch (err) {
      if ((err as YdbError)?.issues?.[0]?.message === NOT_READY) {
        await timeoutAsync(500)
      } else {
        throw err
      }
    }
  }
  // ready storage hack before sync

  return {
    db,
    logger: db.logger,
  }
}

export const test = (...args: TestArgs) => {
  let name
  let callback: TestCallback
  let option: TestOptions

  if (args.length === 3) {
    [name, option, callback] = args

    return tap.test(name, option, async (t) => {
      const ctx = await prepare(t, option)

      return callback(t, ctx)
    })
  }

  [name, callback] = args
  return tap.test(name, async (t) => {
    const ctx = await prepare(t)

    return callback(t, ctx)
  })
}
