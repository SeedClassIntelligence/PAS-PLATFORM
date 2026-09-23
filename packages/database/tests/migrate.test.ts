/**
 * PAS-0102 acceptance tests.
 *
 * The SQL running is the easy half. These concentrate on the four ways a
 * migration system silently corrupts a schema — checksum drift, out-of-order
 * application, a vanished migration, and schema/ledger divergence — none of
 * which is caught by "does the statement execute".
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConflictError, ValidationError } from '@pas/contracts';
import {
  query,
  queryOne,
  closePool,
  migrate,
  migrationStatus,
  buildPlan,
  discoverMigrations,
  pendingMigrationCount,
  checksum,
  LEDGER_TABLE,
  MIGRATION_PATTERN,
  type AppliedMigration,
  type DiscoveredMigration,
} from '../src/index.js';

/**
 * A seam for the one failure that cannot be produced with SQL: the process
 * dying between the migration's DDL and its ledger row.
 *
 * Without it, an implementation that used two transactions passes every other
 * test in this file — which is exactly how corruption mode 4 reaches
 * production.
 */
const ledgerFault = vi.hoisted(() => ({ failNextRecord: false }));

vi.mock('../src/migrate/ledger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/migrate/ledger.js')>();
  return {
    ...actual,
    recordApplied: async (...args: Parameters<typeof actual.recordApplied>) => {
      if (ledgerFault.failNextRecord) {
        ledgerFault.failNextRecord = false;
        throw new Error('simulated crash between the DDL and its ledger row');
      }
      return actual.recordApplied(...args);
    },
  };
});

const dirs: string[] = [];

async function migrationDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pas-mig-'));
  dirs.push(dir);
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(join(dir, name), sql);
  }
  return dir;
}

async function tableExists(name: string): Promise<boolean> {
  const row = await queryOne<{ present: boolean }>(
    `select to_regclass($1) is not null as present`,
    [name],
  );
  return row?.present ?? false;
}

/**
 * Resets the database to genuinely empty.
 *
 * Not an enumerated list of tables to drop, which is what this used to be and
 * which caused a real CI failure. This suite destroys `schema_migrations` on
 * purpose — the ledger is its subject — but it shared `pas_test` with suites
 * that had *migrated* it. Dropping the ledger while leaving the migrated
 * tables standing is corruption mode 4 exactly: the next suite to call
 * `migrate()` found objects it was about to create and refused, correctly.
 *
 * An enumerated list also cannot be maintained. It was written when the
 * repository had no migrations at all; the moment PAS-0201 added three tables
 * it was silently incomplete, and every future migration would break it again.
 *
 * Dropping the schema wholesale is both correct and self-maintaining: a suite
 * whose subject is "what happens to an empty database" should leave one.
 */
async function resetSchema(): Promise<void> {
  await query('drop schema public cascade');
  await query('create schema public');
}

beforeEach(resetSchema);

afterAll(async () => {
  await resetSchema();
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  await closePool();
});

describe('applying migrations', () => {
  it('bootstraps the ledger and applies in identifier order', async () => {
    const dir = await migrationDir({
      '0002_beta.sql': 'create table mig_beta (id int);',
      '0001_alpha.sql': 'create table mig_alpha (id int);',
    });

    const outcomes = await migrate({ directory: dir, appliedBy: 'test' });

    expect(outcomes.map((o) => o.identifier)).toEqual(['0001', '0002']);
    expect(await tableExists('mig_alpha')).toBe(true);
    expect(await tableExists('mig_beta')).toBe(true);
  });

  it('records every field PAS-0102 requires', async () => {
    const sql = 'create table mig_alpha (id int);';
    const dir = await migrationDir({ '0001_alpha.sql': sql });
    await migrate({ directory: dir, appliedBy: 'deployer-7' });

    const row = await queryOne<AppliedMigration & { applied_at: Date; applied_by: string }>(
      `select identifier, name, checksum, applied_at, applied_by, execution_ms
         from ${LEDGER_TABLE}`,
    );
    expect(row).toMatchObject({
      identifier: '0001',
      name: 'alpha',
      checksum: checksum(sql),
      applied_by: 'deployer-7',
    });
    expect(row?.applied_at).toBeInstanceOf(Date);
  });

  it('is idempotent — a second run applies nothing', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });

    expect(await migrate({ directory: dir })).toHaveLength(1);
    expect(await migrate({ directory: dir })).toHaveLength(0);

    const { rows } = await query(`select 1 from ${LEDGER_TABLE}`);
    expect(rows).toHaveLength(1);
  });

  it('applies only what is new when a migration is added later', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });
    await migrate({ directory: dir });

    await writeFile(join(dir, '0002_beta.sql'), 'create table mig_beta (id int);');
    const second = await migrate({ directory: dir });

    expect(second.map((o) => o.identifier)).toEqual(['0002']);
  });

  it('reports the plan without applying, on a dry run', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });
    const planned = await migrate({ directory: dir, dryRun: true });

    expect(planned.map((o) => o.identifier)).toEqual(['0001']);
    expect(await tableExists('mig_alpha')).toBe(false);
  });
});

describe('corruption mode 1 — checksum drift', () => {
  /**
   * A migration that already ran in production is edited. The local database
   * rebuilds from the edited file, production holds the original, and the two
   * schemas diverge with nothing to show for it.
   */
  it('refuses to run when an applied migration has been edited', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });
    await migrate({ directory: dir });

    await writeFile(join(dir, '0001_alpha.sql'), 'create table mig_alpha (id int, extra text);');

    const error = await migrate({ directory: dir }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe('migration.history_inconsistent');
    expect((error as ValidationError).problems[0].message).toContain('has changed since it was applied');
  });

  it('detects drift even when other migrations are pending', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });
    await migrate({ directory: dir });

    await writeFile(join(dir, '0001_alpha.sql'), '-- edited\ncreate table mig_alpha (id int);');
    await writeFile(join(dir, '0002_beta.sql'), 'create table mig_beta (id int);');

    await expect(migrate({ directory: dir })).rejects.toBeInstanceOf(ValidationError);
    // The pending migration must NOT have been applied past a broken history.
    expect(await tableExists('mig_beta')).toBe(false);
  });
});

describe('corruption mode 2 — out-of-order application', () => {
  /**
   * Two branches both pick `0005`, or a branch adds `0005` and merges after
   * `0006` shipped. Applying it now produces a schema no other environment has.
   */
  it('refuses a migration older than one already applied', async () => {
    const dir = await migrationDir({ '0002_beta.sql': 'create table mig_beta (id int);' });
    await migrate({ directory: dir });

    await writeFile(join(dir, '0001_alpha.sql'), 'create table mig_alpha (id int);');

    const error = await migrate({ directory: dir }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe('migration.out_of_order');
    expect((error as ConflictError).message).toContain('two branches picked the same next number');
    expect(await tableExists('mig_alpha')).toBe(false);
  });

  it('allows a migration newer than everything applied', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });
    await migrate({ directory: dir });

    await writeFile(join(dir, '0002_beta.sql'), 'create table mig_beta (id int);');
    await expect(migrate({ directory: dir })).resolves.toHaveLength(1);
  });
});

describe('corruption mode 3 — a vanished migration', () => {
  /**
   * A file deleted after being applied. Nothing breaks today; the next
   * clean-database build produces a different schema from production.
   */
  it('refuses to run when an applied migration is missing from disk', async () => {
    const dir = await migrationDir({
      '0001_alpha.sql': 'create table mig_alpha (id int);',
      '0002_beta.sql': 'create table mig_beta (id int);',
    });
    await migrate({ directory: dir });

    await rm(join(dir, '0001_alpha.sql'));

    const error = await migrate({ directory: dir }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).problems[0].message).toContain('no longer on disk');
  });
});

describe('corruption mode 4 — schema and ledger diverging', () => {
  /**
   * The DDL commits, the bookkeeping row does not. The next run re-applies a
   * migration whose objects already exist, fails, and blocks every deployment
   * until someone edits the ledger by hand.
   *
   * Prevented structurally: the DDL and its ledger row are one transaction.
   */
  it('rolls the DDL back when the ledger write fails — they are one transaction', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });

    ledgerFault.failNextRecord = true;
    await expect(migrate({ directory: dir })).rejects.toThrow(/simulated crash/);

    // One transaction: the DDL rolls back with the failed ledger write.
    // Two transactions: mig_alpha exists with nothing recording it, and the
    // next run fails on an object that is already there — the corruption.
    expect(await tableExists('mig_alpha')).toBe(false);
    const { rows } = await query(`select 1 from ${LEDGER_TABLE}`);
    expect(rows).toHaveLength(0);

    // The resume point is well defined: nothing happened, so it applies now.
    const outcomes = await migrate({ directory: dir });
    expect(outcomes.map((o) => o.identifier)).toEqual(['0001']);
    expect(await tableExists('mig_alpha')).toBe(true);
  });

  it('records nothing when a migration fails', async () => {
    const dir = await migrationDir({
      '0001_alpha.sql': 'create table mig_alpha (id int);',
      '0002_broken.sql': 'create table mig_beta (id int); this is not sql;',
    });

    await expect(migrate({ directory: dir })).rejects.toThrow();

    // 0001 succeeded and is recorded; 0002 failed and is not.
    const { rows } = await query<{ identifier: string }>(
      `select identifier from ${LEDGER_TABLE} order by identifier`,
    );
    expect(rows.map((r) => r.identifier)).toEqual(['0001']);
  });

  it('leaves no partial schema behind when a migration fails midway', async () => {
    const dir = await migrationDir({
      '0001_partial.sql': 'create table mig_partial (id int); create table mig_partial (id int);',
    });

    await expect(migrate({ directory: dir })).rejects.toBeInstanceOf(ConflictError);

    // PostgreSQL has transactional DDL: the first statement is rolled back too.
    expect(await tableExists('mig_partial')).toBe(false);
    const { rows } = await query(`select 1 from ${LEDGER_TABLE}`);
    expect(rows).toHaveLength(0);
  });

  it('resumes cleanly after a failure is fixed', async () => {
    const dir = await migrationDir({
      '0001_alpha.sql': 'create table mig_alpha (id int);',
      '0002_broken.sql': 'not valid sql at all;',
    });
    await expect(migrate({ directory: dir })).rejects.toThrow();

    // Fixing a migration that never applied is legitimate — it has no checksum
    // in the ledger to drift from.
    await writeFile(join(dir, '0002_broken.sql'), 'create table mig_beta (id int);');
    const outcomes = await migrate({ directory: dir });

    expect(outcomes.map((o) => o.identifier)).toEqual(['0002']);
    expect(await tableExists('mig_beta')).toBe(true);
  });
});

describe('concurrent migrators', () => {
  it('serialises a rolling deploy rather than racing', async () => {
    const dir = await migrationDir({
      '0001_alpha.sql': 'create table mig_alpha (id int);',
      '0002_beta.sql': 'create table mig_beta (id int);',
    });

    // Without the advisory lock both instances see the same pending set, both
    // apply it, and the loser crash-loops on "relation already exists".
    const results = await Promise.all([
      migrate({ directory: dir, appliedBy: 'instance-a' }),
      migrate({ directory: dir, appliedBy: 'instance-b' }),
    ]);

    const total = results[0].length + results[1].length;
    expect(total).toBe(2); // applied exactly once between them
    const { rows } = await query(`select 1 from ${LEDGER_TABLE}`);
    expect(rows).toHaveLength(2);
  });
});

describe('status and pending count', () => {
  it('reports applied and pending separately', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });
    await migrate({ directory: dir });
    await writeFile(join(dir, '0002_beta.sql'), 'create table mig_beta (id int);');

    const { applied, pending } = await migrationStatus({ directory: dir });
    expect(applied.map((m) => m.identifier)).toEqual(['0001']);
    expect(pending.map((m) => m.identifier)).toEqual(['0002']);
  });

  it('exposes a pending count for the readiness check', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });
    expect(await pendingMigrationCount(dir)).toBe(1);
    await migrate({ directory: dir });
    expect(await pendingMigrationCount(dir)).toBe(0);
  });

  it('does not create or modify schema — not even the ledger', async () => {
    const dir = await migrationDir({ '0001_alpha.sql': 'create table mig_alpha (id int);' });

    const { applied, pending } = await migrationStatus({ directory: dir });

    // Part I §4: startup must not create tables opportunistically. Status is
    // what the application is allowed to do; migrating is not.
    expect(await tableExists('mig_alpha')).toBe(false);

    // Including the bookkeeping table. The API's schema readiness check calls
    // this on every probe; a read that bootstraps its own table is still
    // opportunistic table creation, and an earlier revision of this code did
    // exactly that while passing the weaker assertion above.
    expect(await tableExists(LEDGER_TABLE)).toBe(false);

    // An absent ledger reads as "nothing applied", so the check still reports
    // the truth: everything on disk is pending.
    expect(applied).toHaveLength(0);
    expect(pending.map((m) => m.identifier)).toEqual(['0001']);
  });

  it('counts everything as pending against a database that has never migrated', async () => {
    const dir = await migrationDir({
      '0001_alpha.sql': 'create table mig_alpha (id int);',
      '0002_beta.sql': 'create table mig_beta (id int);',
    });
    expect(await pendingMigrationCount(dir)).toBe(2);
    expect(await tableExists(LEDGER_TABLE)).toBe(false);
  });
});

describe('discovery rejects malformed migrations', () => {
  it('rejects a filename that does not sort deterministically', async () => {
    const dir = await migrationDir({ 'create_stuff.sql': 'select 1;' });
    await expect(discoverMigrations(dir)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects duplicate identifiers', async () => {
    const dir = await migrationDir({ '0001_a.sql': 'select 1;', '0001_b.sql': 'select 2;' });
    const error = await discoverMigrations(dir).catch((e: unknown) => e);
    expect((error as ValidationError).problems[0].message).toContain('duplicate identifier');
  });

  it('rejects an empty migration', async () => {
    const dir = await migrationDir({ '0001_empty.sql': '   \n  ' });
    await expect(discoverMigrations(dir)).rejects.toBeInstanceOf(ValidationError);
  });

  it('ignores bookkeeping files', async () => {
    const dir = await migrationDir({
      '0001_alpha.sql': 'create table mig_alpha (id int);',
      'README.md': '# migrations',
      'checksums.json': '{}',
    });
    const found = await discoverMigrations(dir);
    expect(found.map((m) => m.filename)).toEqual(['0001_alpha.sql']);
  });

  it('throws rather than silently skipping a malformed file', async () => {
    // A migration ignored because of a typo in its name is a schema change
    // that never happens, discovered in production.
    const dir = await migrationDir({
      '0001_alpha.sql': 'create table mig_alpha (id int);',
      '2_typo.sql': 'create table mig_gamma (id int);',
    });
    await expect(discoverMigrations(dir)).rejects.toThrow();
  });
});

describe('the standalone validator agrees with the runner', () => {
  /**
   * `scripts/validate-migrations.mjs` duplicates the filename pattern so it can
   * run with no build step. Drift between the two would mean CI accepts a
   * migration the runner rejects, or vice versa — caught here rather than left
   * to discipline.
   */
  it('uses an identical filename pattern', async () => {
    const script = await readFile(
      new URL('../../../scripts/validate-migrations.mjs', import.meta.url),
      'utf8',
    );
    const match = /const MIGRATION_PATTERN = (\/.+\/);/.exec(script);
    expect(match, 'MIGRATION_PATTERN not found in the script').toBeTruthy();
    expect(match![1]).toBe(MIGRATION_PATTERN.toString());
  });

  it('uses an identical checksum algorithm', async () => {
    const script = await readFile(
      new URL('../../../scripts/validate-migrations.mjs', import.meta.url),
      'utf8',
    );
    expect(script).toContain("createHash('sha256')");
    expect(checksum('x')).toHaveLength(64);
  });
});

describe('buildPlan is pure and testable without a database', () => {
  const disk = (id: string, name: string, sql: string): DiscoveredMigration => ({
    identifier: id,
    name,
    filename: `${id}_${name}.sql`,
    sql,
    checksum: checksum(sql),
  });
  const ledger = (id: string, name: string, sql: string): AppliedMigration => ({
    identifier: id,
    name,
    checksum: checksum(sql),
    appliedAt: new Date(),
    appliedBy: 'test',
    executionMs: 1,
  });

  it('returns everything as pending against an empty ledger', () => {
    const plan = buildPlan([disk('0001', 'a', 'x'), disk('0002', 'b', 'y')], []);
    expect(plan.pending).toHaveLength(2);
    expect(plan.applied).toHaveLength(0);
  });

  it('returns nothing pending when everything is applied', () => {
    const plan = buildPlan([disk('0001', 'a', 'x')], [ledger('0001', 'a', 'x')]);
    expect(plan.pending).toHaveLength(0);
  });
});
