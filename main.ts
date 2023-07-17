export type { YdbError, JsonType, PrimitiveType } from './lib/type'

const YdbCommon = require('./lib/db')

export { YdbModel } from './lib/model'
export { YdbFastify } from './lib/fastify'
export { YdbType } from './lib/type'

export const Ydb = YdbCommon
