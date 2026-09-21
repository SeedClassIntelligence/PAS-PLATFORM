/**
 * PAS-0102 — the database readiness checks.
 *
 * Clean-Sheet PAS-0005 requires "/ready validates required dependencies such
 * as database connectivity". PAS-0101 built and exported the connectivity
 * check but deliberately left it unregistered: registering it makes the API
 * undeployable without a database, and that only became true once there was a
 * migration system to bring one up. That is this ticket.
 *
 * Two distinct failures are reported separately because they have different
 * operator responses:
 *
 *   `database`        — the database is unreachable. Fix the database.
 *   `database.schema` — the database is reachable but behind this build.
 *                       Run the migrator.
 *
 * Collapsing them into one check would tell an operator "database failed"
 * during a perfectly healthy rolling deploy whose migrations have not run yet.
 */

import { resolve } from 'node:path';
import { getConfig } from '@pas/config';
import { databaseReadinessCheck, pendingMigrationCount } from '@pas/database';
import { registerReadinessCheck } from './checks.js';

/**
 * Whether the schema has ever been observed current *in this process*.
 *
 * Once true it stays true, and that is sound rather than a shortcut: the
 * migrations on disk are build output and do not change while the process
 * runs, and the ledger only ever gains rows. A schema that has satisfied this
 * build cannot stop satisfying it without a redeploy.
 *
 * Caching only the success matters. A rolling deploy starts new code while the
 * migrator is still running, so the *failing* state must keep being re-checked
 * until it clears — which is exactly what a readiness probe is for.
 */
let schemaSatisfied = false;

/** Test-only: forget the cached success. */
export function resetSchemaCheck(): void {
  schemaSatisfied = false;
}

export function registerDatabaseChecks(): void {
  registerReadinessCheck(databaseReadinessCheck);

  registerReadinessCheck({
    name: 'database.schema',
    critical: true,
    timeoutMs: 2_000,
    async run(): Promise<void> {
      if (schemaSatisfied) return;

      // Throws if the directory is absent. Part I §4 forbids the application
      // from applying migrations, and an unreadable migrations directory is
      // not evidence that none are pending — treating it as "nothing to do"
      // would let a process serve against a schema it cannot describe.
      const pending = await pendingMigrationCount(
        resolve(process.cwd(), getConfig().database.migrationsDir),
      );

      if (pending > 0) {
        throw new Error(
          `${pending} migration(s) have not been applied; this build expects a newer schema`,
        );
      }
      schemaSatisfied = true;
    },
  });
}
