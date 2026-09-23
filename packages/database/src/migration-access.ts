/**
 * PAS-0101 — migration access.
 *
 * The primitives PAS-0102's migration runner needs from the connection layer,
 * so the runner does not reach past `@pas/database` for a raw client.
 *
 * ── Why an advisory lock ──────────────────────────────────────────────────
 *
 * Migrations run at process startup. A rolling deploy starts several instances
 * at once, so without a lock they all read "pending migrations" simultaneously
 * and all apply them. The second one to reach `create table` fails, that
 * instance crash-loops, and the cluster comes up degraded — or worse, two
 * instances interleave DDL and leave the schema half-applied with the
 * migration table claiming success.
 *
 * A session-level advisory lock serialises them: one migrates, the others wait
 * and then find nothing to do.
 */

import { withConnection, type PoolClient } from './pool.js';
import { toDatabaseError } from './errors.js';

/**
 * Namespace for PAS's migration lock.
 *
 * Advisory locks share one 64-bit space across the whole database, so an
 * arbitrary constant risks colliding with another tool's lock. Derived from
 * the ASCII of "PASMIGRT" to be recognisable in `pg_locks` during an incident.
 */
export const MIGRATION_LOCK_ID = 0x5041_534d_4947_5254n;

export interface AdvisoryLockOptions {
  /**
   * How long to wait for the lock before giving up.
   *
   * A deploy that hangs forever on a stuck migration is indistinguishable from
   * a hung deploy. Failing lets the orchestrator surface it.
   */
  timeoutMs?: number;
}

/**
 * Runs `fn` while holding the PAS migration advisory lock.
 *
 * The lock is session-scoped and released in `finally`, including when the
 * callback throws. If the process dies outright, Postgres releases it when the
 * connection closes — which is why this is an advisory lock rather than a row
 * in a table that a crashed migrator would leave set forever.
 */
export async function withMigrationLock<T>(
  fn: (client: PoolClient) => Promise<T>,
  options: AdvisoryLockOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 60_000;

  return withConnection(async (client) => {
    // Acquire. Only failures of the lock protocol itself are mapped here.
    try {
      // `lock_timeout` does not cover advisory locks, so bound the wait by
      // polling `try_advisory_lock` rather than blocking on `advisory_lock`.
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const { rows } = await client.query<{ acquired: boolean }>(
          'select pg_try_advisory_lock($1) as acquired',
          [MIGRATION_LOCK_ID.toString()],
        );
        if (rows[0]?.acquired) break;
        if (Date.now() > deadline) {
          throw Object.assign(
            new Error(
              `could not acquire the migration lock within ${timeoutMs}ms — ` +
                'another instance is migrating, or a previous migration is stuck',
            ),
            { code: 'PAS_MIGRATION_LOCK_TIMEOUT' },
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (error) {
      throw toDatabaseError(error, { operation: 'migration.lock' });
    }

    try {
      // The callback's error is the caller's. Wrapping it would flatten a
      // migration's real failure into an opaque lock error.
      return await fn(client);
    } finally {
      // Released even when the callback throws. A leaked advisory lock blocks
      // every future deploy until someone finds it in pg_locks.
      await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID.toString()]);
    }
  });
}

/**
 * Runs DDL inside a transaction on a dedicated connection.
 *
 * PostgreSQL supports transactional DDL, which is what makes a failed
 * migration leave no partial schema behind. A few statements cannot run inside
 * a transaction — `create index concurrently`, `alter type ... add value` in
 * older versions — and PAS-0102 owns deciding how those are declared.
 */
export async function runMigrationStatements(
  statements: readonly string[],
  client: PoolClient,
): Promise<void> {
  for (const statement of statements) {
    if (statement.trim().length === 0) continue;
    try {
      await client.query(statement);
    } catch (error) {
      throw toDatabaseError(error, { operation: 'migration.apply' });
    }
  }
}
