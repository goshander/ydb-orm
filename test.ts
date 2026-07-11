import bunTest from 'bun:test'
import pino, { type BaseLogger } from 'pino'

import {
  Ydb,
  type YdbModelsObjectType,
  type YdbOptionType,
  type YdbRegistryFromModels,
  type YdbType,
} from './index.js'

type YdbTestOptions<TModels extends YdbModelsObjectType = YdbModelsObjectType> =
  Pick<YdbOptionType<TModels>, 'models'> & { sync?: boolean }

export type TestOptions<
  TModels extends YdbModelsObjectType = YdbModelsObjectType,
> = bunTest.TestOptions & YdbTestOptions<TModels>

export type TestCtx<TModels extends YdbModelsObjectType = YdbModelsObjectType> =
  {
    db: YdbType<YdbRegistryFromModels<TModels>>
    logger: BaseLogger
  }

export type TestBase = {
  expect: typeof bunTest.expect
  setSystemTime: typeof bunTest.setSystemTime
  mock: typeof bunTest.mock
  spyOn: typeof bunTest.spyOn
  init: typeof bunTest.beforeAll
  teardown: typeof bunTest.afterAll
}

export type TestCallback<
  TModels extends YdbModelsObjectType = YdbModelsObjectType,
> = (t: TestBase, ctx: TestCtx<TModels>) => void | Promise<void>

async function prepare<
  TModels extends YdbModelsObjectType = YdbModelsObjectType,
>(options?: YdbTestOptions<TModels>) {
  const logger = pino({
    transport: {
      target: 'pino-pretty',
    },
    level: 'debug',
  })

  const db = Ydb.init({
    endpoint: process.env.YDB_ENDPOINT || '',
    database: process.env.YDB_DATABASE || '',

    models: (options?.models || {}) as TModels,

    timeout: Number(process.env.YDB_TEST_TIMEOUT || 10000),
    logger,
    debug: process.env.YDB_DEBUG === '1' || process.env.YDB_DEBUG === 'true',
  })

  bunTest.afterAll(async () => {
    await db.close()
  })

  const timeout = Number(process.env.YDB_TEST_WAIT_TIMEOUT || 30000)
  await db.wait(timeout)

  if (options?.sync === true) {
    await db.sync()
  }

  const ctx = {
    db,
    logger,
  } as TestCtx<TModels>

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
  fn: () => undefined | Promise<unknown>,
  options?: TestOptions,
) => void

const createTest = (testFunc: BunTest) =>
  function testWithCtx<
    TModels extends YdbModelsObjectType = YdbModelsObjectType,
  >(
    name: string,
    optionsOrCallback: TestOptions<TModels> | TestCallback<TModels>,
    callback?: TestCallback<TModels>,
  ) {
    const options =
      typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
    const testCallback =
      typeof optionsOrCallback === 'function' ? optionsOrCallback : callback

    if (!testCallback) {
      throw new Error('test callback is required')
    }

    return testFunc(
      name,
      async () => {
        const { test, ctx } = await prepare(options)
        await testCallback(test, ctx)
      },
      options,
    )
  }

export const test = Object.assign(createTest(bunTest.test), {
  skip: createTest(bunTest.test.skip),
  todo: createTest(bunTest.test.todo),
  if: (cond: boolean) => createTest(bunTest.test.if(cond)),
  skipIf: (cond: boolean) => createTest(bunTest.test.skipIf(cond)),
  ...(process.env.CI ? {} : { only: createTest(bunTest.test.only) }),
})

export const it = test
