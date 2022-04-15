const awsLambdaFastify = require('aws-lambda-fastify')

const app = require('./app')

module.exports = {
  handler: async (event, { token }) => {
    let result = null
    try {
      if (token && token.access_token) {
        process.env.IAM_TOKEN = token.access_token
      }

      await app.ready()
      // const handler = awsLambdaFastify(app)
      const handler = awsLambdaFastify(app, { serializeLambdaArguments: false })
      if (event.pathParams && event.pathParams.proxy) {
        event.path = event.pathParams.proxy
        delete event.pathParams.proxy
        delete event.multiValueParams.proxy
        delete event.params.proxy
      }

      result = await handler(event)
    } catch (err) {
      result = { statusCode: 505 }
      app.logger.fatal({ msg: 'error handler', error: err.stack || err })
    }
    return result
  },
}
