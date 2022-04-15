const app = require('./app')

// eslint-disable-next-line semi-style, import/newline-after-import
;(async () => {
  app.addHook('onClose', async (instance, done) => {
    if (instance.db) await instance.db.close()
    done()
  })

  await app.ready()
  await app.db.sync()

  let admin = await app.db.model.User.findOne({ login: 'admin' })
  if (admin == null) {
    admin = new app.db.model.User({ login: 'admin' })
    await admin.hash(process.env.ADMIN_PASSWORD)
    await admin.save()
  }

  await app.listen(3000, '0.0.0.0')
  app.logger.info({ msg: 'server development ready' })
})().catch((err) => {
  app.logger.fatal({ msg: 'error server', error: err.stack || err })
})
