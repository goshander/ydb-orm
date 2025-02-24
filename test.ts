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
  spyOn: typeof bunTest.spyOn
  init: typeof bunTest.beforeAll
  teardown: typeof bunTest.afterAll
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
  const db = Ydb.init({
    endpoint: process.env.YDB_ENDPOINT || '',
    database: process.env.YDB_DATABASE || '',

    timeout: 1000,
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
    spyOn: bunTest.spyOn,
    init: bunTest.beforeAll,
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

// @ts-expect-error bun test re-export fix: https://github.com/oven-sh/bun/issues/5400
const testFunc = (meta: ImportMeta, func?: string) => (func ? Bun.jest(meta.path).test[func] : Bun.jest(meta.path).test)

export const badTest = bunTest

// export const test = (...args: TestArgs) => baseTest(args, bunTest.test)
export const test = (meta: ImportMeta, ...args: TestArgs) => baseTest(args, testFunc(meta))
// test.skip = (...args: TestArgs) => baseTest(args, bunTest.test.skip)
test.skip = (meta: ImportMeta, ...args: TestArgs) => baseTest(args, testFunc(meta, 'skip'))
// test.todo = (...args: TestArgs) => baseTest(args, bunTest.test.todo)
test.todo = (meta: ImportMeta, ...args: TestArgs) => baseTest(args, testFunc(meta, 'todo'))
// test.only = (...args: TestArgs) => baseTest(args, bunTest.test.only)
test.only = (meta: ImportMeta, ...args: TestArgs) => baseTest(args, testFunc(meta, 'only'))
// test.if = (cond: boolean) => ((...args: TestArgs) => baseTest(args, bunTest.test.if(cond)))
test.if = (cond: boolean) => (meta: ImportMeta, ...args: TestArgs) => baseTest(args, testFunc(meta, 'if')(cond))
// test.skipIf = (cond: boolean) => ((...args: TestArgs) => baseTest(args, bunTest.test.skipIf(cond)))
test.skipIf = (cond: boolean) => (meta: ImportMeta, ...args: TestArgs) => baseTest(args, testFunc(meta, 'skipIf')(cond))

export const it = test
