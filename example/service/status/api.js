module.exports = (fastify, option, next) => {
  fastify.get('/', async (request, reply) => ({ status: 'success' }))

  next()
}
