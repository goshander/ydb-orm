# YDB ORM Agent Guide

This file is the canonical engineering guide, project map, feature status, and
roadmap for this repository. Keep it current when architecture, scripts, CI, or
public ORM behavior changes.

## Project Goal

`ydb-orm` is a TypeScript active-record ORM for YDB. It targets Bun during
development while the published package must run natively as ESM under Node.js.
The API follows useful Sequelize conventions where they fit YDB semantics.

Priorities:

1. Correct YDB behavior and safe schema/query generation.
2. Strong model and query type inference without declaration merging hacks.
3. Native package behavior under Bun, Node.js ESM, and Node.js CommonJS.
4. Deterministic unit tests plus integration coverage against local and cloud YDB.
5. Small, explicit abstractions that follow existing repository patterns.

## Non-Negotiable Rules

### Model typing

- Register models as an object: `models: { User, Game }`.
- Do not use `declare module` to augment a global model registry.
- Define fields once in a `UserFields`/`GameFields` type.
- Extend `YdbModel<Fields>` and merge the instance interface:

```ts
export class User extends YdbModel<UserFields> {
  // schema and behavior
}

export interface User extends UserFields {}
```

- Keep constructors ergonomic with direct assignments. Do not use
  `Object.assign(this, fields)` as a typing workaround.
- Query field names must remain inferred from `YdbModel<Fields>`.

### Module and package format

- The package is native Node ESM (`"type": "module"`).
- Runtime TypeScript relative imports use emitted `.js` specifiers under
  `moduleResolution: nodenext`.
- Do not add post-build import rewriting scripts.
- `tsc` output in `dist` must run directly under Node.js.
- Package smoke tests must install the result of `npm pack` into a fresh project
  and test both `import 'ydb-orm'` and `require('ydb-orm')`.

### Scope and quality

- Preserve existing patterns and avoid unrelated refactors.
- Use structured APIs and YDB SDK primitives instead of parsing strings where
  practical.
- Validate every SQL identifier derived from a model or query option.
- Add tests for every public ORM method, query operator, retry policy, or schema
  behavior change.
- Keep coverage meaningful for package source and add regression tests for
  changed behavior. `bun run test:coverage` currently produces text and LCOV
  reports but does not enforce a minimum threshold.
- Do not edit generated `dist` files manually.
- Never enable shell tracing around credentials or tokens.
- Never interpolate repository secrets directly into generated shell source.
- Runtime model input must be restricted to registered schema fields.
- Bulk update and destroy must reject empty `where` clauses.

## Required Checks

Run checks appropriate to the change before completion:

```sh
npm run lint
npm run typecheck
npm run typecheck:test
bun run test:unit
bun run test
bun run test:coverage
npm run test:nodejs
npm run test:smoke
```

- `bun run test:unit` must pass with no YDB process or container running.
- `bun run test` and coverage are integration suites and require YDB.
- `npm run test:nodejs` builds `dist` and tests the compiled library.
- `npm run test:smoke` builds, packs, installs, and exercises the real package.
- `npm run test:cloud` uses `scripts/cloud.sh`, `yc`, `jq`, and a configured
  Yandex Cloud profile. Do not run it casually against shared infrastructure.

Local database commands:

```sh
npm run docker:db-up
npm run docker:db-down
```

Containerized suites:

```sh
npm run test:docker
npm run test:docker:nodejs
npm run test:docker:smoke
npm run test:docker:clean
```

## Test Boundaries

- `test/unit.spec.ts` uses Bun directly and mocks Driver/API/SQL boundaries. It
  must never call the integration test bootstrap or require a live YDB.
- `test/game.spec.ts`, `test/user.spec.ts`, `test/sql.spec.ts`, and
  `test/sync.spec.ts` are focused integration tests. Keep cases independent so
  failures identify one behavior.
- `test/typecheck.test.ts` contains compile-only model/query inference checks.
- `test/nodejs.test.spec.js` tests the compiled package with Node's test runner.
- `scripts/smoke/import-smoke.mjs` and `require-smoke.cjs` test ESM/CJS parity
  after installing the packed package.
- Use stable neutral names in smoke tests. Avoid random model/field names unless
  parallel integration isolation requires a unique table.

The shared integration helper in `test.ts` initializes models, calls `db.wait()`,
optionally synchronizes schemas, and closes the connection after each test.
`YDB_TEST_WAIT_TIMEOUT` controls its startup deadline and defaults to 30 seconds.

## YDB Readiness and Retries

### Database wait

`lib/wait.ts` owns readiness behavior. `Ydb.wait(timeout = 10000)` delegates to
it and swaps in the returned ready Driver.

Readiness rules:

- Create a fresh Driver for each failed attempt because a rejected SDK
  `Driver.ready()` promise cannot recover.
- Wait for successful Discovery.
- Request verbose Monitoring SelfCheck.
- Require `GOOD` health plus a non-static storage pool containing storage
  groups. A static pool alone is not sufficient for user-table tablets.
- If exactly `/Ydb.Monitoring.V1.MonitoringService/SelfCheck` returns gRPC code
  `12 UNIMPLEMENTED`, fall back to successful Discovery for cloud compatibility.
- Do not treat `UNIMPLEMENTED` from another RPC as readiness.
- Do not create probe tables in `wait()`.

### Schema operation throttling

`lib/retry.ts` handles the transient cloud error:

```text
Request exceeded a limit on the number of schema operations, try again later
```

`executeSql()` recreates the query and retries with bounded exponential backoff
(250, 500, 1000, then at most 2000 ms) within the configured database timeout.
Other schema/YQL errors fail immediately.

## Runtime Architecture

- `index.ts`: public package exports.
- `lib/db.ts`: Driver construction, credentials, model registry, raw SQL,
  transactions, and adapters for wait/sync/API.
- `lib/wait.ts`: Driver readiness, Monitoring SelfCheck, storage readiness, and
  cloud fallback.
- `lib/retry.ts`: transient schema-operation retry policy.
- `lib/model.ts`: active-record base class and model CRUD/query methods.
- `lib/query.ts`: schema-aware SQL fragments, where operators, attributes,
  ordering, and pagination validation.
- `lib/where.ts`: where-builder alias tested directly but not exported from the
  package root.
- `lib/sync.ts`: table creation and schema synchronization for columns, indexes,
  rename behavior, and strict mode.
- `lib/api.ts`: low-level Table and Monitoring API wrappers.
- `lib/iam.ts`: Yandex Cloud IAM credential provider and token caching.
- `lib/error.ts`: nested YDB issue normalization.
- `lib/type.ts`: public and internal TypeScript contracts.
- `lib/constant.ts`: YDB data type maps and rejected field names.

## Repository Map

### Tests and examples

- `test.ts`: Bun integration-test bootstrap.
- `test/*.spec.ts`: unit and integration suites.
- `test/model/*.ts`: typed integration models.
- `test/nodejs.test.spec.js`: compiled Node.js runtime scenario.
- `example/model.ts`: model declaration example.
- `example/query.ts`: typed query example.

### Build and infrastructure

- `package.json`: scripts, package surface, and dependencies.
- `tsconfig.json`: native ESM library build.
- `tsconfig.test.json`: test type checking.
- `biome.json`: formatting and linting.
- `bunfig.toml`: Bun test/coverage configuration.
- `docker-compose.yaml`: local YDB plus Bun, Node, and package smoke services.
- `docker-compose.db.yaml`: host-accessible YDB on ports 2136 and 8765.
- `docker/test.dockerfile`: Bun integration image.
- `docker/test.nodejs.dockerfile`: Node compiled/package smoke image.
- `scripts/smoke.mjs`: isolated npm pack/install orchestrator.
- `scripts/cloud.sh`: Yandex Cloud test bootstrap.

### Pull request CI

CI is intentionally split into independent workflow files/jobs:

- lint;
- library and test typecheck;
- unit tests without YDB;
- Bun integration tests against local YDB;
- coverage;
- cloud integration tests;
- Node.js compiled-library matrix on Node 20, 22, and 24;
- host and Docker Node/package smoke tests.

Every workflow that starts YDB must clean it up in an `always()` step.
All workflows use `actions/checkout@v6`. Test and coverage workflows currently
rely on their command output and exit status; they do not publish separate job
summaries or PR comments.

## Sequelize-Inspired Feature Status

Reference areas: model basics, querying, associations, and transactions from the
Sequelize v6 documentation.

Implemented:

- Model definition, registration, and schema synchronization.
- Instance lifecycle: `build`, `save`, `create`, `update`, `delete`, `reload`,
  and `increment`.
- Finders: `find`, `findAll`, `findOne`, `findByPk`, and `count`.
- Bulk operations: `update` and `destroy` with validated fields/where clauses.
- Query options: `where`, `attributes`, `order`, `limit`, `offset`, and `page`.
- Operators: equality, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `like`,
  `notLike`, `is`, `isNot`, `not`, `between`, `notBetween`, nested `and`/`or`.
- Runtime schema validation for attributes, ordering, where clauses, updates,
  deletes, count, increment, pagination, table names, indexes, and fields.
- Compile-time field-safe query options inferred from model fields.
- Raw SQL with parameters.
- Raw SQL transactions with commit/rollback behavior.
- `Model.query(sql, params)` returning hydrated model instances (issue #6).
- Index and legacy table naming support.

Intentional gaps:

- Model-level transaction options.
- Validation and default metadata pipeline.
- Lifecycle hooks.
- Associations and eager loading.
- Scopes.
- Migration files and production-safe migration planning.
- Sync dry-run and explicit destructive-change plans.

## Roadmap

Work in this order unless a concrete issue requires otherwise:

1. Stabilize model-level transaction propagation across find/create/update/save
   and destroy operations.
2. Add schema validation/default metadata and a lifecycle validation pipeline.
3. Add hooks around create/save/update/destroy after transaction semantics are
   stable.
4. Add migration files or sync dry-run output before expanding destructive sync
   behavior.
5. Add associations/eager loading only after query composition, transactions,
   and migration behavior are reliable.
6. Add scopes after query option composition has a stable merge contract.
7. Consider `defineModels({ User, Game })` only if runtime registration needs
   validation or metadata beyond the existing typed object registry.

For roadmap work, update this file as features move from gaps to implemented and
keep README/examples aligned with the public API.
