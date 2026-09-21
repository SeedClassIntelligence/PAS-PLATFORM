/**
 * PAS-0102 — the migration runner.
 *
 * Part I §4: every migration is version controlled, deterministic, supports
 * deployment ordering, fails safely, and is exercised by CI against a clean
 * database.
 *
 * ── The four ways a migration system silently corrupts a schema ───────────
 *
 * Each has a named check below, because each has been the cause of a real
 * outage somewhere and none is caught by "does the SQL run".
 *
 *   1. Checksum drift — a migration that already ran in production is edited.
 *      Local rebuilds from the edited file, production holds the original, and
 *      the two schemas diverge with nothing to show for it.
 *
 *   2. Out-of-order application — two branches both add `0005`, or a branch
 *      adds `0005` and merges after `0006` shipped. Applying it now produces a
 *      schema no other environment has.
 *
 *   3. A vanished migration — a file deleted after being applied. Nothing
 *      breaks today; the next clean-database build produces a different schema
 *      from production, and nobody knows why.
 *
 *   4. Schema and ledger diverging — the DDL commits, the bookkeeping row does
 *      not. The next run re-applies a migration whose objects exist, fails, and
 *      blocks every deployment until someone edits the ledger by hand.
 *
 * (4) is prevented structurally: the DDL and its ledger row are one
 * transaction. (1)-(3) are explicit pre-flight checks that refuse to run.
 */

import { hostname } from 'node:os';
import { ConflictError, ValidationError } from '@pas/contracts';
import { withTransaction } from '../transaction.js';
import { withMigrationLock, runMigrationStatements } from '../migration-access.js';
import { type PoolClient } from '../pool.js';
import { discoverMigrations, type DiscoveredMigration } from './discover.js';
import { ensureLedger, readLedger, recordApplied, type AppliedMigration } from './ledger.js';

export interface MigrationPlan {
  applied: AppliedMigration[];
  pending: DiscoveredMigration[];
}

export interface MigrationOutcome {
  identifier: string;
  name: string;
  executionMs: number;
}

export interface MigrateOptions {
  directory: string;
  /** Recorded in the ledger. Defaults to the host and process. */
  appliedBy?: string;
  /** Report the plan without applying anything. */
  dryRun?: boolean;
}

function actor(explicit?: string): string {
  return explicit ?? `${hostname()}:${process.pid}`;
}

/**
 * Compares disk against the ledger and refuses to proceed on any of the three
 * detectable corruptions.
 */
export function buildPlan(
  onDisk: readonly DiscoveredMigration[],
  applied: readonly AppliedMigration[],
): MigrationPlan {
  const appliedById = new Map(applied.map((m) => [m.identifier, m]));
  const problems: { path: string; message: string }[] = [];

  // (1) Checksum drift.
  for (const migration of onDisk) {
    const previous = appliedById.get(migration.identifier);
    if (previous && previous.checksum !== migration.checksum) {
      problems.push({
        path: migration.filename,
        message:
          'has changed since it was applied. A migration that has run must never be edited — ' +
          'every environment that already applied it holds the original, and editing it makes ' +
          'their schemas diverge silently. Add a new migration instead.',
      });
    }
  }

  // (3) A vanished migration.
  const onDiskIds = new Set(onDisk.map((m) => m.identifier));
  for (const previous of applied) {
    if (!onDiskIds.has(previous.identifier)) {
      problems.push({
        path: `${previous.identifier}_${previous.name}.sql`,
        message:
          'was applied but is no longer on disk. A clean-database build would now produce a ' +
          'different schema from every environment that ran it. Restore the file.',
      });
    }
  }

  if (problems.length > 0) {
    throw new ValidationError(
      `The migration history is inconsistent with the database (${problems.length} problem(s))`,
      problems,
      { code: 'migration.history_inconsistent' },
    );
  }

  const pending = onDisk.filter((m) => !appliedById.has(m.identifier));

  // (2) Out-of-order application.
  const highestApplied = applied.reduce<string | undefined>(
    (max, m) => (max === undefined || m.identifier > max ? m.identifier : max),
    undefined,
  );
  if (highestApplied !== undefined) {
    const outOfOrder = pending.filter((m) => m.identifier < highestApplied);
    if (outOfOrder.length > 0) {
      throw new ConflictError(
        `Migration(s) ${outOfOrder.map((m) => m.identifier).join(', ')} are older than ` +
          `${highestApplied}, which has already been applied. Applying them now would produce ` +
          'a schema no other environment has. Renumber them above the highest applied ' +
          'migration — this usually means two branches picked the same next number.',
        {
          code: 'migration.out_of_order',
          details: {
            outOfOrder: outOfOrder.map((m) => m.filename),
            highestApplied,
          },
        },
      );
    }
  }

  return { applied: [...applied], pending };
}

/**
 * Reads the current plan without applying anything, taking the lock, or
 * creating the ledger.
 *
 * Read-only is a requirement, not an optimisation: the API's schema readiness
 * check calls this on every probe, and Part I §4 forbids the application from
 * creating schema. An absent ledger reads as "nothing applied" — see
 * `readLedger`.
 */
export async function migrationStatus(options: {
  directory: string;
}): Promise<MigrationPlan> {
  const onDisk = await discoverMigrations(options.directory);
  return withTransaction(
    async (client) => buildPlan(onDisk, await readLedger(client)),
    { operation: 'migration.status', readOnly: true },
  );
}

/**
 * Applies every pending migration.
 *
 * Holds the PAS advisory lock for the whole run (PAS-0101), so a rolling
 * deploy's instances serialise instead of racing.
 *
 * Each migration runs in **its own** transaction, together with its ledger row.
 * One transaction around the entire run would be tempting — all-or-nothing —
 * but it means a failure on migration 40 rolls back 39 successful ones, and
 * some DDL cannot be replayed cheaply. Per-migration atomicity gives a
 * well-defined resume point: everything before the failure is applied and
 * recorded, the failure is not.
 */
export async function migrate(options: MigrateOptions): Promise<MigrationOutcome[]> {
  const onDisk = await discoverMigrations(options.directory);
  const appliedBy = actor(options.appliedBy);

  return withMigrationLock(async (lockClient: PoolClient) => {
    await ensureLedger(lockClient);
    const plan = buildPlan(onDisk, await readLedger(lockClient));

    if (options.dryRun) {
      return plan.pending.map((m) => ({
        identifier: m.identifier,
        name: m.name,
        executionMs: 0,
      }));
    }

    const outcomes: MigrationOutcome[] = [];

    for (const migration of plan.pending) {
      const started = Date.now();

      await withTransaction(
        async (tx) => {
          // PostgreSQL has transactional DDL, which is what makes a failed
          // migration leave no partial schema behind.
          await runMigrationStatements([migration.sql], tx);
          const executionMs = Date.now() - started;
          // Same transaction as the DDL. See ledger.ts.
          await recordApplied(tx, migration, executionMs, appliedBy);
        },
        { operation: `migration.apply.${migration.identifier}` },
      );

      outcomes.push({
        identifier: migration.identifier,
        name: migration.name,
        executionMs: Date.now() - started,
      });
    }

    return outcomes;
  });
}

/**
 * Whether the database is at the schema version this build expects.
 *
 * Part I §4 forbids application startup from creating tables opportunistically,
 * so the application does not migrate. It does need to refuse to serve against
 * a schema it does not understand — that is a readiness concern, not a licence
 * to mutate.
 */
export async function pendingMigrationCount(directory: string): Promise<number> {
  const { pending } = await migrationStatus({ directory });
  return pending.length;
}
