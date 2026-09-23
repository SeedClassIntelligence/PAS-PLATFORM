/**
 * PAS-0101 — database health.
 *
 * Registers the readiness check PAS-0005 built the registry for. This is the
 * ADR-002 consumer sweep landing: PAS-0005 created the extension point, and
 * this build fills it without touching the health endpoint.
 */

import { query } from './query.js';
import { poolStatistics, isPoolInitialised, type PoolStatistics } from './pool.js';

export interface DatabaseHealth {
  reachable: boolean;
  pool: PoolStatistics;
}

/**
 * The cheapest statement that proves a round trip.
 *
 * Deliberately not `select count(*) from <table>`: a health check must not get
 * slower as the database grows, or it eventually times out and reports an
 * outage that is really a large table.
 */
export async function checkDatabase(): Promise<DatabaseHealth> {
  await query('select 1', [], { operation: 'health.database' });
  return { reachable: true, pool: poolStatistics() };
}

/**
 * Shape of the readiness check. The registry itself lives in `@pas/api`, so
 * this package exposes the check rather than importing upward — `database`
 * must not depend on `api`.
 */
export const databaseReadinessCheck = {
  name: 'database',
  critical: true,
  /**
   * Shorter than the default statement timeout on purpose: a readiness probe
   * that waits as long as a real query turns a slow database into a killed
   * process. Failing fast lets the load balancer route away while the process
   * stays alive.
   */
  timeoutMs: 2_000,
  async run(): Promise<void> {
    await checkDatabase();
  },
} as const;

export { isPoolInitialised };
