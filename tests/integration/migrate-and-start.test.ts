/**
 * PAS-0102 — integration: empty database → migrate → application starts.
 *
 * This is the ticket's stated test, run against the artifacts that ship: the
 * built migrator CLI and the built API process, against a database created
 * empty for the run.
 *
 * The literal reading — "migrate a database, then start the API" — passes even
 * if the API ignores the database entirely, so each case also asserts the
 * state that makes it meaningful:
 *
 *   before migrating  the API is LIVE but NOT READY, and names the schema as
 *                     the reason
 *   after migrating   the API is READY, with connectivity and schema both
 *                     passing
 *   throughout        the API creates no schema of its own (Part I §4)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import {
  MIGRATE_ENTRY,
  killAllChildren,
  runNode,
  startApiProcess,
  readiness,
} from './harness.js';

/** Pinned to `pas_test` by `vitest.config.ts`, never an ambient value. */
const ADMIN_URL = process.env.PAS_DATABASE_URL as string;

/** A database name no other run will collide with. */
const SCRATCH = `pas_mig_int_${process.pid}_${Date.now().toString(36)}`;

function urlFor(database: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const SCRATCH_URL = urlFor(SCRATCH);

/** A connection to the maintenance database — `create database` cannot run in a transaction. */
async function admin<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function onScratch<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: SCRATCH_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Every table in the scratch database's public schema. */
async function tables(): Promise<string[]> {
  return onScratch(async (client) => {
    const { rows } = await client.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' order by tablename`,
    );
    return rows.map((r) => r.tablename);
  });
}

const dirs: string[] = [];

async function migrationsDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pas-int-mig-'));
  dirs.push(dir);
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(join(dir, name), sql);
  }
  return dir;
}

async function dropScratch(): Promise<void> {
  await admin(async (client) => {
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
      [SCRATCH],
    );
    await client.query(`drop database if exists "${SCRATCH}"`);
  });
}

/** Recreates the scratch database, genuinely empty. */
async function emptyDatabase(): Promise<void> {
  await dropScratch();
  await admin((client) => client.query(`create database "${SCRATCH}"`));
  expect(await tables(), 'the scratch database is not empty').toEqual([]);
}

beforeAll(async () => {
  await emptyDatabase();
}, 60_000);

afterEach(() => {
  killAllChildren();
});

afterAll(async () => {
  killAllChildren();
  await dropScratch();
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
}, 30_000);

describe('empty database → migrate → application starts', () => {
  it('refuses readiness before migrating, serves after', async () => {
    await emptyDatabase();

    const dir = await migrationsDir({
      '0001_create_widgets.sql':
        'create table widgets (id text primary key, label text not null);',
      '0002_add_widget_created_at.sql':
        'alter table widgets add column created_at timestamptz not null default now();',
    });

    const env = { PAS_DATABASE_URL: SCRATCH_URL, PAS_MIGRATIONS_DIR: dir };

    // ── empty database ──────────────────────────────────────────────────
    {
      const { base } = await startApiProcess(env);

      // Live: the process is healthy and should not be restarted.
      expect((await fetch(`${base}/health`)).status).toBe(200);

      // Not ready: it must not receive traffic against a schema it does not
      // have. Liveness and readiness answering differently is the whole point —
      // an orchestrator that conflated them would kill this process instead of
      // waiting for the migrator.
      const { status, body } = await readiness(base);
      expect(status).toBe(503);
      expect(body.status).toBe('not_ready');

      const schema = body.checks?.find((c) => c.name === 'database.schema');
      expect(schema?.status).toBe('fail');
      expect(schema?.detail).toContain('2 migration(s) have not been applied');

      // Connectivity is fine — the two failures are reported separately so an
      // operator is not told "database down" during a healthy deploy.
      expect(body.checks?.find((c) => c.name === 'database')?.status).toBe('pass');

      // Part I §4: the application created nothing, not even the ledger.
      expect(await tables()).toEqual([]);

      killAllChildren();
    }

    // ── → migrate ───────────────────────────────────────────────────────
    const applied = await runNode(MIGRATE_ENTRY, ['up'], env);
    expect(applied.code, applied.stderr).toBe(0);
    expect(applied.stdout).toContain('applied 2 migration(s)');

    expect(await tables()).toEqual(['schema_migrations', 'widgets']);

    // ── → application starts ────────────────────────────────────────────
    {
      const { base } = await startApiProcess(env);
      const { status, body } = await readiness(base);

      expect(status, JSON.stringify(body)).toBe(200);
      expect(body.status).toBe('ready');
      expect(body.checks?.filter((c) => c.status === 'pass').map((c) => c.name).sort()).toEqual([
        'configuration',
        'database',
        'database.schema',
      ]);
    }
  }, 60_000);

  it('goes not-ready again when a later build expects a migration this database lacks', async () => {
    await emptyDatabase();

    const dir = await migrationsDir({
      '0001_create_widgets.sql': 'create table widgets (id text primary key);',
    });
    const env = { PAS_DATABASE_URL: SCRATCH_URL, PAS_MIGRATIONS_DIR: dir };

    expect((await runNode(MIGRATE_ENTRY, ['up'], env)).code).toBe(0);
    {
      const { base } = await startApiProcess(env);
      expect((await readiness(base)).status).toBe(200);
      killAllChildren();
    }

    // The next release ships a migration the deploy has not run yet. This is
    // the ordering that Expand → Migrate → Verify → Contract exists to survive,
    // and the readiness check is what makes the new code wait instead of
    // serving against a schema it does not have.
    await writeFile(join(dir, '0002_add_widget_owner.sql'), 'alter table widgets add column owner_id text;');

    const { base } = await startApiProcess(env);
    const { status, body } = await readiness(base);
    expect(status).toBe(503);
    expect(body.checks?.find((c) => c.name === 'database.schema')?.detail).toContain(
      '1 migration(s) have not been applied',
    );
  }, 60_000);

  it('refuses readiness rather than assuming nothing is pending when migrations are unreadable', async () => {
    await emptyDatabase();

    // A deployed image that ships the API without its migrations. Reporting
    // ready here would be the worst outcome: the process would serve against
    // whatever schema happened to be there.
    const { base } = await startApiProcess({
      PAS_DATABASE_URL: SCRATCH_URL,
      PAS_MIGRATIONS_DIR: join(tmpdir(), 'pas-no-such-migrations-dir'),
    });

    const { status, body } = await readiness(base);
    expect(status).toBe(503);
    expect(body.checks?.find((c) => c.name === 'database.schema')?.status).toBe('fail');
  }, 60_000);

  it('applies the repository\'s own migrations to an empty database', async () => {
    await emptyDatabase();

    // No PAS_MIGRATIONS_DIR: the shipped default, resolved from the repository
    // root. This is the path a real deploy takes, and it is only exercised if
    // nothing in the test overrides it.
    const env = { PAS_DATABASE_URL: SCRATCH_URL };

    const result = await runNode(MIGRATE_ENTRY, ['up'], env);
    expect(result.code, result.stderr).toBe(0);

    const status = await runNode(MIGRATE_ENTRY, ['status'], env);
    expect(status.code, status.stderr).toBe(0);
    expect(status.stdout).toContain('pending: 0');

    const { base } = await startApiProcess(env);
    const ready = await readiness(base);
    expect(ready.status, JSON.stringify(ready.body)).toBe(200);
  }, 60_000);
});

describe('the migrator is safe to run repeatedly', () => {
  it('is idempotent across separate processes', async () => {
    await emptyDatabase();

    const dir = await migrationsDir({
      '0001_create_widgets.sql': 'create table widgets (id text primary key);',
    });
    const env = { PAS_DATABASE_URL: SCRATCH_URL, PAS_MIGRATIONS_DIR: dir };

    const first = await runNode(MIGRATE_ENTRY, ['up'], env);
    expect(first.stdout).toContain('applied 1 migration(s)');

    const second = await runNode(MIGRATE_ENTRY, ['up'], env);
    expect(second.code, second.stderr).toBe(0);
    expect(second.stdout).toContain('nothing to apply');
  }, 60_000);

  it('serialises concurrent migrators instead of racing', async () => {
    await emptyDatabase();

    const dir = await migrationsDir({
      '0001_create_widgets.sql': 'create table widgets (id text primary key);',
      '0002_create_gadgets.sql': 'create table gadgets (id text primary key);',
    });
    const env = { PAS_DATABASE_URL: SCRATCH_URL, PAS_MIGRATIONS_DIR: dir };

    // What a rolling deploy actually does: several instances start the migrator
    // at once. Without the advisory lock both would build the same plan and the
    // loser would fail on an object the winner had just created.
    const results = await Promise.all([
      runNode(MIGRATE_ENTRY, ['up'], env),
      runNode(MIGRATE_ENTRY, ['up'], env),
      runNode(MIGRATE_ENTRY, ['up'], env),
    ]);

    for (const r of results) expect(r.code, r.stderr).toBe(0);
    expect(results.filter((r) => r.stdout.includes('applied 2 migration(s)'))).toHaveLength(1);
    expect(results.filter((r) => r.stdout.includes('nothing to apply'))).toHaveLength(2);

    expect(await tables()).toEqual(['gadgets', 'schema_migrations', 'widgets']);
  }, 60_000);

  it('refuses to run and changes nothing when an applied migration has been edited', async () => {
    await emptyDatabase();

    const dir = await migrationsDir({
      '0001_create_widgets.sql': 'create table widgets (id text primary key);',
    });
    const env = { PAS_DATABASE_URL: SCRATCH_URL, PAS_MIGRATIONS_DIR: dir };
    expect((await runNode(MIGRATE_ENTRY, ['up'], env)).code).toBe(0);

    await writeFile(
      join(dir, '0001_create_widgets.sql'),
      'create table widgets (id text primary key, label text);',
    );
    await writeFile(join(dir, '0002_create_gadgets.sql'), 'create table gadgets (id text primary key);');

    const result = await runNode(MIGRATE_ENTRY, ['up'], env);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('migration.history_inconsistent');
    // The pending migration did not sneak through alongside the refusal.
    expect(await tables()).toEqual(['schema_migrations', 'widgets']);
  }, 60_000);
});
