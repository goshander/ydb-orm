const { test } = require('tap')
const ydb = require('.')

const NOT_READY = 'database doesn\'t have storage pools at all to create tablet channels to storage pool binding by profile id'

async function timeoutReady(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, time)
  })
}

async function prepare(t, option) {
  const db = ydb.Ydb.init(process.env.YDB_ENDPOINT, process.env.YDB_DATABASE, {
    timeout: 1000,
  })

  // load models
  if (option.models) {
    option.models.forEach((m) => db.load(m))
  }

  t.teardown(async () => {
    await db.close()
  })

  await db.connect()

  // ready storage hack before sync
  let errorSync = NOT_READY
  while (errorSync === NOT_READY) {
    try {
      await db.sync()
      errorSync = null
    } catch (err) {
      if (err && err.issues && err.issues[0] && err.issues[0].message === NOT_READY) {
        await timeoutReady(500)
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

module.exports = {
  /** @type {Test} */
  test: (...args) => {
    let name
    let callback
    let option

    if (args.length > 2) {
      [name, option, callback] = args

      return test(name, option, async (t) => {
        const ctx = await prepare(t, option)

        return callback(t, ctx)
      })
    }

    [name, callback] = args
    return test(name, async (t) => {
      const ctx = await prepare(t)

      return callback(t, ctx)
    })
  },
}
