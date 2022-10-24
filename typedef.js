/**
 * @typedef {typeof import('~/plugin/ydb/db').db} Db
 * @typedef {import('pino').Logger} Pino
 * @typedef {Tap.Test} TapTest
 */

/**
 * @typedef TestContext
 * @property {Pino} logger
 * @property {Db & DbExtended} db
 */

/**
 * @callback TestCallback
 * @param {TapTest} t
 * @param {TestContext} ctx
 */

/**
 * @callback TestWithoutOptions
 * @param {String} name
 * @param {TestCallback} test
 */

/**
 * @typedef {Object} TapTestOptions
 * @property {boolean | string | undefined} todo
 * @property {boolean | string | undefined} skip
 * @property {boolean | undefined} diagnostic
 * @property {boolean | undefined} bail
 * @property {number | undefined} timeout
 * @property {boolean | undefined} autoend
 * @property {boolean | undefined} buffered
 * @property {number | undefined} jobs
 * @property {RegExp[] | undefined} grep
 * @property {boolean | undefined} only
 */

/**
 * @callback TestWithOptions
 * @param {String} name
 * @param {TapTestOptions} options
 * @param {TestCallback} test
 */

/**
 * @typedef {TestWithoutOptions | TestWithOptions} Test
 */
