/**
 * PAS-0102 — the applied-migration ledger.
 *
 * PAS-0102 requires: migration identifier, migration name, applied timestamp,
 * checksum.
 *
 * ── Why this table is bootstrapped in code, not by a migration ────────────
 *
 * The table that records which migrations have run cannot itself be created by
 * a migration — there would be nowhere to record that it ran. The bootstrap is
 * idempotent `create table if not exists`, which is the one place in PAS where
 * that is legitimate.
 *
 * This is NOT the "opportunistic table creation" Part I §4 forbids. That rule
 * is about domain tables appearing because an application noticed they were
 * missing. This creates exactly one bookkeeping table, only when the migrator
 * runs, never during application startup.
 */

import { type PoolClient } from '../pool.js';

export const LEDGER_TABLE = 'schema_migrations';

export interface AppliedMigration {
  identifier: string;
  name: string;
  checksum: string;
  appliedAt: Date;
  appliedBy: string;
  executionMs: number;
}

/**
 * Creates the ledger if absent. Safe to call on every migrator run.
 *
 * `identifier` is the primary key rather than a surrogate: it is the natural
 * key, and making it so means a double-apply fails on the constraint instead of
 * quietly inserting a second row.
 */
export async function ensureLedger(client: PoolClient): Promise<void> {
  await client.query(`
    create table if not exists ${LEDGER_TABLE} (
      identifier    text        primary key,
      name          text        not null,
      checksum      text        not null,
      applied_at    timestamptz not null default now(),
      applied_by    text        not null,
      execution_ms  integer     not null
    )
  `);
}

interface LedgerRow {
  identifier: string;
  name: string;
  checksum: string;
  applied_at: Date;
  applied_by: string;
  execution_ms: number;
}

/**
 * Everything applied, in apply order.
 *
 * An absent ledger reads as "nothing applied" rather than an error, and
 * deliberately does **not** create it. Readers include the API's schema
 * readiness check, and Part I §4 forbids application startup from creating
 * tables. A read that bootstraps its own table is opportunistic table creation
 * however small the table is; only the migrator may call `ensureLedger`.
 */
export async function readLedger(client: PoolClient): Promise<AppliedMigration[]> {
  const { rows: present } = await client.query<{ present: boolean }>(
    `select to_regclass($1) is not null as present`,
    [LEDGER_TABLE],
  );
  if (!present[0]?.present) return [];

  const { rows } = await client.query<LedgerRow>(
    `select identifier, name, checksum, applied_at, applied_by, execution_ms
       from ${LEDGER_TABLE}
      order by identifier`,
  );
  return rows.map((row) => ({
    identifier: row.identifier,
    name: row.name,
    checksum: row.checksum,
    appliedAt: row.applied_at,
    appliedBy: row.applied_by,
    executionMs: row.execution_ms,
  }));
}

/**
 * Records an applied migration.
 *
 * **Must be called on the same client, inside the same transaction as the
 * migration's own DDL.** If the two were separate transactions, a crash between
 * them would leave the schema changed and unrecorded — and the next run would
 * re-apply a migration whose objects already exist, failing and blocking every
 * deployment until someone reconciled the ledger by hand.
 *
 * This is Part I §5's rule applied to migrations: the mutation and the record
 * of it are one commit.
 */
export async function recordApplied(
  client: PoolClient,
  migration: { identifier: string; name: string; checksum: string },
  executionMs: number,
  appliedBy: string,
): Promise<void> {
  await client.query(
    `insert into ${LEDGER_TABLE} (identifier, name, checksum, applied_by, execution_ms)
     values ($1, $2, $3, $4, $5)`,
    [migration.identifier, migration.name, migration.checksum, appliedBy, executionMs],
  );
}
