/**
 * `@pas/database` — PAS-0101 PostgreSQL connection layer.
 *
 * Centralises connection pooling, transactions, migration access, query
 * instrumentation and database health.
 *
 * **The `Pool` is not exported.** Part of PAS-0101's contract is that
 * "application code must not independently create arbitrary database
 * connections"; callers get `query`, `queryOne`, `withConnection` and
 * `withTransaction`, and an ESLint rule bans importing `pg` outside this
 * package.
 */

export {
  type PoolClient,
  type PoolStatistics,
  withConnection,
  poolStatistics,
  isPoolInitialised,
  closePool,
  resetPoolForTesting,
} from './pool.js';

export {
  type QueryResult,
  type QueryOptions,
  query,
  queryOne,
  instrumentationComment,
} from './query.js';

export {
  type IsolationLevel,
  type TransactionOptions,
  withTransaction,
  currentTransactionClient,
  inTransaction,
  transactionDepth,
} from './transaction.js';

export {
  type DatabaseHealth,
  checkDatabase,
  databaseReadinessCheck,
} from './health.js';

export {
  type AdvisoryLockOptions,
  MIGRATION_LOCK_ID,
  withMigrationLock,
  runMigrationStatements,
} from './migration-access.js';

export * from './migrate/index.js';

export { toDatabaseError, isRetryable, PG_ERROR_CODES } from './errors.js';
