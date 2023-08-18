import { BaseLogger } from 'pino'
import tap from 'tap'

import {
  Ydb, YdbModelConstructorType, YdbType,
} from '.'

export type TestOptions = {
  models: Array<YdbModelConstructorType>
  sync?: boolean
}

export type TestCtx = {
  db: YdbType;
  logger: BaseLogger;
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

async function prepare(t: Tap.Test, options?: TestOptions) {
  const db = Ydb.init(process.env.YDB_ENDPOINT || '', process.env.YDB_DATABASE || '', {
    timeout: 1000,
  })

  // load models
  if (options?.models) {
    options.models.forEach((m) => db.load(m))
  }

  t.teardown(async () => {
    await db.close()
  })

  await db.connect()

  if (options?.sync === true) {
    await db.sync()
  }

  return {
    db,
    logger: db.logger,
  }
}

export const test = (...args: TestArgs) => {
  let name
  let callback: TestCallback
  let options: TestOptions

  if (args.length === 3) {
    [name, options, callback] = args

    return tap.test(name, options, async (t) => {
      const ctx = await prepare(t, options)

      return callback(t, ctx)
    })
  }

  [name, callback] = args
  return tap.test(name, async (t) => {
    const ctx = await prepare(t)

    return callback(t, ctx)
  })
}
