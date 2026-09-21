/**
 * PAS-0101 — connection pooling.
 *
 * "Application code must not independently create arbitrary database
 *  connections."
 *
 * The `Pool` is module-private and is never exported. Callers get `query`,
 * `withConnection` and `withTransaction`; nothing else can obtain a raw
 * client. An ESLint rule (`no-restricted-imports` on `pg`) makes the same rule
 * mechanical outside this package — a convention nobody can violate by
 * accident beats one stated in a README.
 */

import pg from 'pg';
import { getConfig, type PasConfig } from '@pas/config';
import { ExternalServiceError } from '@pas/contracts';

const { Pool } = pg;
export type PoolClient = pg.PoolClient;

let pool: pg.Pool | undefined;
let closing = false;

/**
 * `pg` parses `int8`/`bigint` into a JavaScript string by default, because a
 * 64-bit integer does not fit in a double. That is the right default and PAS
 * keeps it: silently truncating an id at 2^53 is the kind of bug that only
 * appears once a table is large enough to matter.
 *
 * Numeric (`1700`) is likewise left as a string — money and measurements must
 * not round-trip through a float.
 */
function assertSafeTypeParsing(): void {
  // Documented here rather than configured: the defaults are already correct.
  // This function exists so the decision is visible where the pool is built.
}

function buildPool(config: PasConfig): pg.Pool {
  assertSafeTypeParsing();

  const created = new Pool({
    connectionString: config.database.url,
    min: config.database.poolMin,
    max: config.database.poolMax,
    ssl: config.database.ssl ? { rejectUnauthorized: true } : undefined,
    // A caller waiting forever for a connection is indistinguishable from a
    // hang. Fail fast enough that a readiness probe can report it.
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    application_name: config.observability.serviceName,
  });

  created.on('connect', (client) => {
    /**
     * `statement_timeout` is set per connection, not per query.
     *
     * Without it a single pathological query holds a pool slot indefinitely.
     * At `poolMax` such queries the pool is exhausted, every subsequent request
     * blocks on `connectionTimeoutMillis`, and an unrelated slow query has
     * taken the whole service down. The timeout converts that into a bounded,
     * attributable failure.
     */
    void client.query(`set statement_timeout = ${config.database.statementTimeoutMs}`);
    /**
     * Also bound the wait for a lock. A query blocked behind someone else's
     * uncommitted transaction is not covered by statement_timeout in every
     * Postgres version, and an unbounded lock wait exhausts the pool the same way.
     */
    void client.query(`set lock_timeout = ${config.database.statementTimeoutMs}`);
    /**
     * An idle-in-transaction session holds its locks and its snapshot, blocking
     * vacuum and other writers. A client that opened a transaction and then
     * stopped is a bug; this bounds the damage.
     */
    void client.query(`set idle_in_transaction_session_timeout = ${60_000}`);
  });

  /**
   * An idle client erroring (the server restarted, a proxy dropped it) emits
   * on the pool. Unhandled, that is an `uncaughtException` and the process dies
   * — a database blip becoming a crash loop.
   */
  created.on('error', () => {
    // Intentionally swallowed: `pg` removes the broken client from the pool and
    // the next checkout gets a fresh one. Surfacing it belongs to PAS-3606
    // (observability), which owns the logger.
  });

  return created;
}

/** The pool, created on first use. Module-private by design. */
function getPool(): pg.Pool {
  if (closing) {
    throw new ExternalServiceError('postgres', 'The database pool is shutting down.', {
      code: 'database.shutting_down',
      retryable: false,
    });
  }
  pool ??= buildPool(getConfig());
  return pool;
}

/**
 * Checks out a connection for the duration of `fn` and always returns it.
 *
 * Use this only when several statements must run on the *same* connection
 * without transactional semantics — advisory locks, `LISTEN`, session settings.
 * For anything atomic use `withTransaction`.
 */
export async function withConnection<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    // `release` in `finally` is the whole reason callers do not get a raw
    // client: a single early return that skips it leaks a pool slot, and the
    // pool is exhausted silently some time later under load.
    client.release();
  }
}

export interface PoolStatistics {
  total: number;
  idle: number;
  waiting: number;
}

/** Pool saturation, for the readiness check and PAS-3606. */
export function poolStatistics(): PoolStatistics {
  if (!pool) return { total: 0, idle: 0, waiting: 0 };
  return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
}

export function isPoolInitialised(): boolean {
  return pool !== undefined;
}

/**
 * Drains the pool. Called during graceful shutdown, after the process has
 * stopped accepting traffic (PAS-0005 flips readiness first).
 */
export async function closePool(): Promise<void> {
  if (!pool) return;
  closing = true;
  const current = pool;
  pool = undefined;
  try {
    await current.end();
  } finally {
    closing = false;
  }
}

/** Test-only: discards the pool without ending it. */
export function resetPoolForTesting(): void {
  pool = undefined;
  closing = false;
}
