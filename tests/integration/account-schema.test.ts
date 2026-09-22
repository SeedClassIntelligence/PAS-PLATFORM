/**
 * PAS-0201 — integration: the account schema.
 *
 * Run against a database migrated by the built migrator, because a schema is
 * a set of promises the database makes and the only way to find out whether
 * it makes them is to try to break them. Every constraint below is asserted
 * by attempting the write it is supposed to refuse.
 *
 * The ticket's substance is Part I §6 — *"Keep platform user identity distinct
 * from Authority Entity identity … User ≠ AuthorityEntity"* — which is a
 * statement about shape, so the shape is what is tested: a user is not bound
 * to one account in either direction, and nothing in `users` points at a
 * subject of authority.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import {
  scratchDatabaseName,
  createScratchDatabase,
  dropScratchDatabase,
  MIGRATE_ENTRY,
  runNode,
} from './harness.js';

const SCRATCH = scratchDatabaseName('acct_int');
let SCRATCH_URL: string;
let client: pg.Client;

/** Runs a statement and returns the PostgreSQL error, or null if it succeeded. */
async function refusal(sql: string, values: unknown[] = []): Promise<pg.DatabaseError | null> {
  try {
    await client.query(sql, values);
    return null;
  } catch (error) {
    return error as pg.DatabaseError;
  }
}

const NOW = '2026-02-15T10:00:00.000Z';

async function insertAccount(over: Record<string, unknown> = {}): Promise<string> {
  const row = {
    id: randomUUID(),
    account_type: 'ORGANIZATION',
    display_name: 'A Solution Group CDC',
    status: 'ACTIVE',
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
  await client.query(
    `insert into accounts (id, account_type, display_name, status, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [row.id, row.account_type, row.display_name, row.status, row.created_at, row.updated_at],
  );
  return row.id as string;
}

async function insertUser(over: Record<string, unknown> = {}): Promise<string> {
  const row = {
    id: randomUUID(),
    email: `user-${randomUUID()}@example.com`,
    status: 'ACTIVE',
    created_at: NOW,
    updated_at: NOW,
    ...over,
  };
  await client.query(
    `insert into users (id, email, status, created_at, updated_at) values ($1, $2, $3, $4, $5)`,
    [row.id, row.email, row.status, row.created_at, row.updated_at],
  );
  return row.id as string;
}

async function insertMembership(accountId: string, userId: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `insert into account_memberships (account_id, user_id, id, created_at, updated_at)
     values ($1, $2, $3, $4, $5)`,
    [accountId, userId, id, NOW, NOW],
  );
  return id;
}

beforeAll(async () => {
  SCRATCH_URL = await createScratchDatabase(SCRATCH);

  // The built migrator, against a database created empty for this run.
  const result = await runNode(MIGRATE_ENTRY, ['up'], { PAS_DATABASE_URL: SCRATCH_URL });
  expect(result.code, result.stderr).toBe(0);
  expect(result.stdout).toContain('applied 1 migration(s)');

  client = new pg.Client({ connectionString: SCRATCH_URL });
  await client.connect();
}, 60_000);

afterAll(async () => {
  await client?.end();
  await dropScratchDatabase(SCRATCH);
}, 30_000);

beforeEach(async () => {
  await client.query('truncate account_memberships, accounts, users');
});

describe('the migration creates what PAS-0201 asks for', () => {
  it('creates accounts, users and account_memberships', async () => {
    const { rows } = await client.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' order by tablename`,
    );
    expect(rows.map((r) => r.tablename)).toEqual([
      'account_memberships',
      'accounts',
      'schema_migrations',
      'users',
    ]);
  });

  it('carries PAS-0103 identity — uuid primary keys with no database-side default', async () => {
    const { rows } = await client.query<{ table_name: string; data_type: string; column_default: string | null }>(
      `select table_name, data_type, column_default
         from information_schema.columns
        where table_schema = 'public' and column_name = 'id'
          and table_name in ('accounts', 'users', 'account_memberships')
        order by table_name`,
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.data_type, row.table_name).toBe('uuid');
      // No gen_random_uuid() default. PAS-0103 is the one source of identity;
      // a database-side default is a second one, and an INSERT that forgot to
      // supply an id should fail loudly rather than quietly mint one outside
      // the service.
      expect(row.column_default, row.table_name).toBeNull();
    }
  });

  it('carries PAS-0104 timestamps — timestamptz at millisecond precision', async () => {
    const { rows } = await client.query<{ table_name: string; column_name: string; data_type: string; datetime_precision: number }>(
      `select table_name, column_name, data_type, datetime_precision
         from information_schema.columns
        where table_schema = 'public'
          and column_name in ('created_at', 'updated_at')
          and table_name in ('accounts', 'users', 'account_memberships')
        order by table_name, column_name`,
    );
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.data_type, `${row.table_name}.${row.column_name}`).toBe('timestamp with time zone');
      // The (3) is load-bearing: PostgreSQL defaults to microseconds and
      // JavaScript Date holds milliseconds, so an undeclared column round
      // trips lossily and equality fails invisibly. PAS-0104 report.
      expect(row.datetime_precision, `${row.table_name}.${row.column_name}`).toBe(3);
    }
  });

  it('round trips a canonical instant without losing or gaining precision', async () => {
    const id = await insertAccount({ created_at: '2026-02-15T10:00:00.123Z', updated_at: '2026-02-15T10:00:00.123Z' });
    const { rows } = await client.query<{ created_at: Date }>(
      `select created_at from accounts where id = $1`,
      [id],
    );
    expect(rows[0].created_at.toISOString()).toBe('2026-02-15T10:00:00.123Z');
  });
});

describe('User ≠ AuthorityEntity — Part I §6', () => {
  /**
   * The statement is about shape. A `users` row that carried an authority
   * entity id would be the same claim the spec forbids, written as a column.
   */
  it('gives users no column pointing at a subject of authority', async () => {
    const { rows } = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'users' order by column_name`,
    );
    const columns = rows.map((r) => r.column_name);
    expect(columns).toEqual([
      'created_at',
      'email',
      'email_normalized',
      'id',
      'status',
      'updated_at',
    ]);
    for (const forbidden of ['authority_entity_id', 'entity_id', 'person_id', 'pas_id']) {
      expect(columns, forbidden).not.toContain(forbidden);
    }
  });

  /**
   * "Account membership supports multiple users managing shared organizational
   * authority."
   */
  it('lets many users manage one organizational account', async () => {
    const account = await insertAccount({ display_name: 'A Solution Group CDC' });
    const [a, b, c] = [await insertUser(), await insertUser(), await insertUser()];
    for (const user of [a, b, c]) await insertMembership(account, user);

    const { rows } = await client.query<{ count: string }>(
      `select count(*) from account_memberships where account_id = $1`,
      [account],
    );
    expect(rows[0].count).toBe('3');
  });

  /**
   * "A user account may manage: one Personal PAS, multiple organizations,
   * shared organizational Authority Records, or delegated authority."
   *
   * Together with the test above, this is what makes User ≠ AuthorityEntity
   * structural: a user bound to exactly one account could be quietly treated
   * as the subject it manages. A user in four accounts cannot be.
   */
  it('lets one user manage a personal account and several organizations', async () => {
    const user = await insertUser();
    const personal = await insertAccount({ account_type: 'INDIVIDUAL', display_name: 'W. D. Jernigan IV' });
    const orgs = [
      await insertAccount({ display_name: 'A Solution Group CDC' }),
      await insertAccount({ display_name: 'Seed Class Intelligence' }),
      await insertAccount({ display_name: 'KG Development' }),
    ];
    for (const account of [personal, ...orgs]) await insertMembership(account, user);

    const { rows } = await client.query<{ account_type: string; display_name: string }>(
      `select a.account_type, a.display_name
         from account_memberships m join accounts a on a.id = m.account_id
        where m.user_id = $1
        order by a.display_name`,
      [user],
    );
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.account_type === 'INDIVIDUAL')).toHaveLength(1);
    expect(rows.filter((r) => r.account_type === 'ORGANIZATION')).toHaveLength(3);
  });
});

describe('the constraints refuse what they are there to refuse', () => {
  it('refuses a second membership for the same user and account', async () => {
    const account = await insertAccount();
    const user = await insertUser();
    await insertMembership(account, user);

    const error = await refusal(
      `insert into account_memberships (id, account_id, user_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5)`,
      [randomUUID(), account, user, NOW, NOW],
    );
    expect(error?.code).toBe('23505');
    expect(error?.constraint).toBe('account_memberships_unique');
  });

  it('refuses two users whose addresses differ only in case', async () => {
    await insertUser({ email: 'Bob@Example.COM' });

    for (const duplicate of ['bob@example.com', 'BOB@EXAMPLE.COM', 'bob@Example.com']) {
      const error = await refusal(
        `insert into users (id, email, created_at, updated_at) values ($1, $2, $3, $4)`,
        [randomUUID(), duplicate, NOW, NOW],
      );
      expect(error?.code, duplicate).toBe('23505');
      expect(error?.constraint, duplicate).toBe('users_email_normalized_key');
    }
  });

  /**
   * Which constraint catches a padded address, and why it is the shape check
   * rather than uniqueness.
   *
   * The normalising column folds case and does **not** trim, because the shape
   * check refuses whitespace outright and a `btrim()` here could never fire.
   * Trimming belongs at the application boundary: a database that silently
   * stored an address it had altered would leave PAS sending mail to a value
   * nobody supplied.
   */
  it('refuses a padded address outright rather than trimming it', async () => {
    const error = await refusal(
      `insert into users (id, email, created_at, updated_at) values ($1, $2, $3, $3)`,
      [randomUUID(), '  bob@example.com  ', NOW],
    );
    expect(error?.constraint).toBe('users_email_shape');
  });

  it('preserves the address as entered while normalising for uniqueness', async () => {
    const id = await insertUser({ email: 'Bob@Example.COM' });
    const { rows } = await client.query<{ email: string; email_normalized: string }>(
      `select email, email_normalized from users where id = $1`,
      [id],
    );
    expect(rows[0].email).toBe('Bob@Example.COM');
    expect(rows[0].email_normalized).toBe('bob@example.com');
  });

  it('cannot have its normalised address written directly', async () => {
    // A generated column is what makes normalisation un-bypassable. A writer
    // that supplies its own value is rejected by the database rather than
    // quietly creating the duplicate identity this exists to prevent.
    const error = await refusal(
      `insert into users (id, email, email_normalized, created_at, updated_at)
       values ($1, $2, $3, $4, $5)`,
      [randomUUID(), 'Carol@Example.com', 'someone-else@example.com', NOW, NOW],
    );
    expect(error?.code).toBe('428C9');
  });

  it.each([
    ['accounts', 'account_type', 'TEAM', 'accounts_account_type_check'],
    ['accounts', 'status', 'DELETED', 'accounts_status_check'],
  ])('refuses an unknown %s.%s', async (_table, column, value, constraint) => {
    const error = await refusal(
      `insert into accounts (id, account_type, display_name, status, created_at, updated_at)
       values ($1, $2, 'x', $3, $4, $4)`,
      column === 'account_type'
        ? [randomUUID(), value, 'ACTIVE', NOW]
        : [randomUUID(), 'INDIVIDUAL', value, NOW],
    );
    expect(error?.constraint).toBe(constraint);
  });

  it('refuses a blank display name', async () => {
    const error = await refusal(
      `insert into accounts (id, account_type, display_name, created_at, updated_at)
       values ($1, 'INDIVIDUAL', '   ', $2, $2)`,
      [randomUUID(), NOW],
    );
    expect(error?.constraint).toBe('accounts_display_name_not_blank');
  });

  it('refuses an address that is not shaped like one', async () => {
    for (const bad of ['not-an-email', 'a@b', 'a b@example.com', '@example.com', 'a@']) {
      const error = await refusal(
        `insert into users (id, email, created_at, updated_at) values ($1, $2, $3, $3)`,
        [randomUUID(), bad, NOW],
      );
      expect(error?.constraint, bad).toBe('users_email_shape');
    }
  });

  /**
   * PAS-0104. A row claiming it was modified before it existed breaks every
   * "changed since" query written against the table.
   */
  it.each(['accounts', 'users', 'account_memberships'])(
    'refuses %s modified before it was created',
    async (table) => {
      const before = '2026-02-15T09:59:59.999Z';
      let error: pg.DatabaseError | null;

      if (table === 'accounts') {
        error = await refusal(
          `insert into accounts (id, account_type, display_name, created_at, updated_at)
           values ($1, 'INDIVIDUAL', 'x', $2, $3)`,
          [randomUUID(), NOW, before],
        );
      } else if (table === 'users') {
        error = await refusal(
          `insert into users (id, email, created_at, updated_at) values ($1, $2, $3, $4)`,
          [randomUUID(), `u-${randomUUID()}@example.com`, NOW, before],
        );
      } else {
        const account = await insertAccount();
        const user = await insertUser();
        error = await refusal(
          `insert into account_memberships (id, account_id, user_id, created_at, updated_at)
           values ($1, $2, $3, $4, $5)`,
          [randomUUID(), account, user, NOW, before],
        );
      }
      expect(error?.constraint).toBe(`${table}_updated_after_created`);
    },
  );

  it('refuses a membership in an account or for a user that does not exist', async () => {
    const account = await insertAccount();
    const user = await insertUser();

    const noAccount = await refusal(
      `insert into account_memberships (id, account_id, user_id, created_at, updated_at)
       values ($1, $2, $3, $4, $4)`,
      [randomUUID(), randomUUID(), user, NOW],
    );
    expect(noAccount?.code).toBe('23503');

    const noUser = await refusal(
      `insert into account_memberships (id, account_id, user_id, created_at, updated_at)
       values ($1, $2, $3, $4, $4)`,
      [randomUUID(), account, randomUUID(), NOW],
    );
    expect(noUser?.code).toBe('23503');
  });

  /**
   * No hard deletes: authority outlives the account that owns it, and a
   * membership vanishing because a row upstream was deleted is the silent
   * loss that rule exists to prevent. RESTRICT makes the database enforce it
   * instead of trusting every future writer to remember.
   */
  it('refuses to delete an account or user that still has a membership', async () => {
    const account = await insertAccount();
    const user = await insertUser();
    await insertMembership(account, user);

    expect((await refusal(`delete from accounts where id = $1`, [account]))?.code).toBe('23503');
    expect((await refusal(`delete from users where id = $1`, [user]))?.code).toBe('23503');

    // Closing is a status change, and it leaves the record resolvable.
    await client.query(`update accounts set status = 'CLOSED' where id = $1`, [account]);
    const { rows } = await client.query<{ status: string }>(
      `select status from accounts where id = $1`,
      [account],
    );
    expect(rows[0].status).toBe('CLOSED');
  });
});

describe('the query Part I §6 exists to make possible is indexed', () => {
  /**
   * "Which accounts does this user manage" reads `user_id` alone. The unique
   * constraint indexes (account_id, user_id), which does not serve it — a
   * leading-column index is no help to a predicate on the second column.
   */
  it('indexes account_memberships by user', async () => {
    const { rows } = await client.query<{ indexdef: string }>(
      `select indexdef from pg_indexes
        where schemaname = 'public' and tablename = 'account_memberships'`,
    );
    const defs = rows.map((r) => r.indexdef);
    expect(defs.some((d) => /\(user_id\)/.test(d)), defs.join('\n')).toBe(true);
  });

  /*
   * There is deliberately no test asserting the planner chooses this index.
   *
   * It was written and removed: PostgreSQL serves a `user_id` predicate from
   * the (account_id, user_id) unique index by full bitmap scan, at identical
   * cost, whether or not the dedicated index exists — so the assertion passed
   * with the index dropped. A test that cannot fail for the reason it claims
   * to test is worse than none, and asserting a plan tests the cost model
   * rather than the schema.
   *
   * What is load-bearing is that the index exists and covers the column,
   * which the test above states directly.
   */
});
