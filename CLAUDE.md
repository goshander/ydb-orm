# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YDB-ORM is a minimal ORM library for YDB database designed for rapid development of serverless applications. It provides a lightweight, type-safe interface for database operations with automatic schema synchronization.

## Common Commands

### Testing
- `bun test --bail ./test/*.spec.ts` - Run all tests with Bun (main test runner)
- `npm run test` - Alias for the above command
- `npm run test-debug` - Run tests with inspector for debugging
- `npm run test-docker` - Run tests in Docker environment (includes YDB instance)
- `npm run test-docker-clean` - Clean up Docker containers after tests

### Building
- `npm run build` - Compile TypeScript to JavaScript in `dist/` directory
- `npm run build-test` - Build including test files

### Development
- `npm run docker-db-up` - Start YDB database container locally for development
- `npx eslint .` - Run linting (ESLint with Airbnb TypeScript config)

## Architecture

### Core Components

**Ydb (lib/db.ts)** - Main database connection and singleton manager
- Handles driver initialization with connection strings (supports both legacy `endpoint`/`database` and new `connectionString` format)
- Manages authentication providers (IAM credentials, access tokens, metadata service, anonymous)
- Provides `session()` for query execution and `sql()` for prepared queries
- Maintains a registry of loaded models via `load()` method
- Connection string format: `grpcs://endpoint?database=/path` or legacy format auto-converted

**YdbModel (lib/model.ts)** - Base model class for ORM functionality
- All user models extend this class
- Uses prepared queries with parameterized values (via `fromJs()` from `@ydbjs/value`)
- Static methods: `find()`, `findOne()`, `findByPk()`, `count()`, `update()`, `drop()`
- Instance methods: `save()`, `delete()`, `increment()`, `toJson()`
- WHERE clause builder supports: equality, IN arrays, LIKE patterns (all parameterized)
- Query building uses `buildWhereClause()` to generate safe parameterized SQL

**Schema Definition (lib/type.ts)** - Type system and schema structure
- `YdbSchemaType` defines table schema: either `YdbSchemaFieldType` or `{ field, option }`
- `YdbDataType` constant maps database types (ascii, utf8, int32, date, etc.)
- Schema options include: `tableName`, `primaryKey`, `strict`
- Field options include: `type`, `index`, `drop`, `renamed` (for migrations)

**Sync (lib/sync.ts)** - Schema synchronization and migrations
- Checks table existence via test queries
- Creates tables from schema definitions if missing
- Uses `api.describeTable()` to compare existing schema with model schema
- TODO: field alterations, renames, drops, strict mode, index management

**IAM Provider (lib/iam.ts)** - Custom authentication for Yandex Cloud
- Generates JWT tokens signed with PS256 algorithm
- Automatically refreshes IAM tokens before expiration
- Uses retry logic with exponential backoff for token requests

**API (lib/api.ts)** - Low-level table operations via YDB SDK
- Wraps `TableServiceDefinition` from `@ydbjs/api/table`
- Methods: `createTable()`, `alterTable()`, `describeTable()`
- Used by sync logic for schema introspection and DDL operations

### Query Execution Model

All queries use prepared statements with parameters to prevent SQL injection:
1. Build SQL string with `$paramName` placeholders
2. Create params object with `fromJs(value)` for type conversion
3. Execute via `queryClient([sql] as any).param(name, value).param(...)`
4. The SDK handles type conversion and safe parameter binding

Example from `model.ts:save()`:
```typescript
const queryText = `UPSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${paramNames.join(', ')});`
let query = queryClient(strings).timeout(ctx.timeout || 10000)
Object.keys(params).forEach((paramName) => {
  query = query.param(paramName.replace('$', ''), params[paramName])
})
```

### Model Definition Pattern

User models follow this pattern:
```typescript
export class User extends YdbModel implements Fields {
  static schema: YdbSchemaType = {
    id: YdbDataType.ascii,
    name: YdbDataType.ascii,
    createdAt: YdbDataType.date,
  }

  id: Fields['id']
  name: Fields['name']
  createdAt: Fields['createdAt']

  constructor(fields: Partial<Fields>) {
    super(fields)
    // Initialize fields with defaults
  }
}
```

**Important conventions:**
- Schema is defined as static property with `YdbDataType` constants
- Table name defaults to snake_case of class name (e.g., `UserProfile` → `user_profile`)
- Primary key defaults to `id` field
- Override defaults with `schema.option` object

### Authentication Patterns

The library supports multiple authentication methods, checked in order:
1. `credential` object (service account JSON) - uses custom `IamCredentialsProvider`
2. `token` string (IAM token) - uses `AccessTokenCredentialsProvider`
3. `meta: true` - uses metadata service - `MetadataCredentialsProvider`
4. Default: `AnonymousCredentialsProvider`

Service account credentials can be loaded from:
- `credential` parameter
- `ydb-sa.json` file in project root
- `YDB_SA_KEY` environment variable (JSON string)

### Directory Structure

- `index.ts` - Package entry point (exports from lib/)
- `lib/` - Core library implementation
  - `db.ts` - Database connection manager
  - `model.ts` - ORM base class
  - `type.ts` - TypeScript types and data type mappings
  - `sync.ts` - Schema synchronization
  - `iam.ts` - IAM authentication provider
  - `api.ts` - Low-level YDB API wrapper
  - `constant.ts` - Constants (data type maps, rejected field names)
  - `convert.ts` - Type conversion utilities
  - `where.ts` - Query builder utilities
- `test/` - Test suites using Bun test framework
  - `test/model/` - Example model definitions
- `example/` - Example usage
- `dist/` - Compiled output (git-ignored)

## Key Implementation Details

### Connection String Handling
The library auto-converts legacy format to new format:
- Legacy: `endpoint: "grpcs://host"` + `database: "/local"` → `grpcs://host?database=/local`
- Ensures proper `grpcs://` prefix
- Falls back to `grpc://localhost:2136?database=/local` if not provided

### Query Timeout
Default timeout is 10000ms, configurable via `YdbOptionType.timeout`. Applied to:
- Driver initialization (`ydb.sdk.ready_timeout_ms`)
- Individual queries (`.timeout()` method)

### Schema Rejected Fields (lib/constant.ts)
Certain field names are reserved and will throw errors during `check()`:
- Check implementation in `db.ts:check()` validates table names, primary keys, and field names

### Logging
Uses `pino` logger throughout. Key log events:
- Table creation: `ydb: create table`
- Table not found: `ydb: table not found`
- Validation errors: `ydb: invalid table name`, `ydb: rejected schema key`

### Debug Output
Currently includes `console.log` statements in:
- `lib/db.ts:sql()` - Logs SQL and params (should be removed in production)
- `lib/sync.ts` - Logs table description during sync

## Development Guidelines

### ESLint Configuration
- Based on Airbnb TypeScript style guide
- Key rules: 2-space indent, no semicolons, single quotes, 140 char max line length
- Import ordering: alphabetical with groups (builtin, external, internal, parent, sibling, index)
- Console statements are errors (use logger instead)
- Debugger statements are errors

### Testing Approach
Tests use Bun's test framework with custom `test()` helper (in `test.ts`):
- Each test suite declares models and options
- `sync: true` option auto-creates tables before tests
- Tests use `t.teardown()` for cleanup
- Example: `test/user.spec.ts` demonstrates all CRUD operations

### Type Safety
- Strict TypeScript configuration (all strict flags enabled)
- Models use generic types: `find<T extends YdbModelType>(this: ThisConstructorType<T>)`
- `ThisConstructorType<T>` pattern enables proper return typing

### Current Migration Status (from git status)
The repository is on `new-sdk-version` branch with:
- Modified SDK integration (`@ydbjs/*` packages at v6.0.5)
- New API wrapper implementation (`lib/api.ts`)
- Schema sync rewrite (`lib/sync.ts`, old version in `lib/sync-old.ts`)

### Known TODOs
From code comments:
- `lib/db.ts:28` - Logger migration needs review
- `lib/sync.ts:51-62` - Schema sync needs: field alterations, rename support, drop support, strict mode, index management
- **CRITICAL**: Model query methods need result conversion - New SDK returns raw Buffers for ascii/utf8 fields instead of strings. The `convert.ts` utility exists but isn't being used by model methods (`find`, `findOne`, etc.). This causes existing tests to fail.
- COUNT() now returns BigInt instead of number in new SDK (type definitions updated)

## Common Patterns

### Creating a new model
1. Define `Fields` type with all field types
2. Extend `YdbModel` and implement `Fields`
3. Define static `schema` with `YdbDataType` constants
4. Add field properties with `Fields['fieldName']` types
5. Implement constructor calling `super(fields)` and initializing fields

### Using WHERE conditions
```typescript
// Equality
await Model.find({ where: { name: 'value' } })

// IN condition
await Model.find({ where: { id: ['id1', 'id2'] } })

// LIKE condition
await Model.find({ where: { name: { like: 'search' } } })
```

### Custom table/primary key
```typescript
static schema = {
  field: {
    customId: YdbDataType.ascii,
    name: YdbDataType.utf8,
  },
  option: {
    tableName: 'custom_table_name',
    primaryKey: 'customId',
  }
}
```
