import bunTest from 'bun:test'
import { BaseLogger } from 'pino'

import {
  Ydb, YdbModelConstructorType, YdbType,
} from '.'

type YdbTestOptions = {
  models?: Array<YdbModelConstructorType>
  sync?: boolean
}

export type TestOptions = bunTest.TestOptions & YdbTestOptions

export type TestCtx = {
  db: YdbType;
  logger: BaseLogger;
}

type TestBase = {
  expect: typeof bunTest.expect;
  setSystemTime: typeof bunTest.setSystemTime;
  mock: typeof bunTest.mock;
  teardown: typeof bunTest.afterAll;
}

export type TestCallback = (t: TestBase, ctx: TestCtx)=> void | Promise<void>

type TestArgs = [
  string,
  TestOptions,
  TestCallback,
] | [
  string,
  TestCallback,
]

async function prepare(options?: YdbTestOptions) {
  const db = Ydb.init(process.env.YDB_ENDPOINT || '', process.env.YDB_DATABASE || '', {
    timeout: 10000,
  })

  // load models
  if (options?.models) {
    options.models.forEach((m) => db.load(m))
  }

  bunTest.afterAll(async () => {
    await db.close()
  })

  await db.connect()

  if (options?.sync === true) {
    await db.sync()
  }

  const ctx: TestCtx = {
    db,
    logger: db.logger,
  }

  const test: TestBase = {
    expect: bunTest.expect,
    setSystemTime: bunTest.setSystemTime,
    mock: bunTest.mock,
    teardown: bunTest.afterAll,
  }

  return {
    test,
    ctx,
  }
}

type BunTest = (
  label: string,
  fn: ()=> void | Promise<unknown>,
  options?: TestOptions,
)=> void

const baseTest = (args: TestArgs, testFunc: BunTest) => {
  let name: string
  let callback: TestCallback
  let options: TestOptions | undefined

  if (args.length === 3) {
    [name, options, callback] = args
  } else {
    [name, callback] = args
  }

  return testFunc(name, async () => {
    const { test, ctx } = await prepare(options)
    await callback(test, ctx)
  }, options)
}

export const test = (...args: TestArgs) => baseTest(args, bunTest.test)
test.skip = (...args: TestArgs) => baseTest(args, bunTest.test.skip)
test.todo = (...args: TestArgs) => baseTest(args, bunTest.test.todo)
test.only = (...args: TestArgs) => baseTest(args, bunTest.test.only)
test.if = (cond: boolean) => ((...args: TestArgs) => baseTest(args, bunTest.test.if(cond)))
test.skipIf = (cond: boolean) => ((...args: TestArgs) => baseTest(args, bunTest.test.skipIf(cond)))
