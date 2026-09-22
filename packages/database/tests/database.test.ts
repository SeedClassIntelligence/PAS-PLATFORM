/**
 * PAS-0101 acceptance tests.
 *
 * These run against a REAL PostgreSQL. A mocked driver would prove the code
 * calls the functions it calls, not that a transaction rolls back, that a
 * savepoint isolates a nested failure, or that `statement_timeout` is actually
 * in force on the connection — which are the only claims that matter here.
 */

import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import {
  ConflictError,
  ValidationError,
  ExternalServiceError,
  isPasError,
} from '@pas/contracts';
import { runInNewOperation } from '@pas/observability';
import {
  query,
  queryOne,
  withTransaction,
  withConnection,
  inTransaction,
  transactionDepth,
  currentTransactionClient,
  checkDatabase,
  databaseReadinessCheck,
  poolStatistics,
  closePool,
  toDatabaseError,
  isRetryable,
  instrumentationComment,
  PG_ERROR_CODES,
  withMigrationLock,
  runMigrationStatements,
} from '../src/index.js';

/**
 * The fixture is (re)created per test, not once per file.
 *
 * It used to be created in `beforeAll` and only truncated afterwards, which
 * assumed it survived for the whole file. It does not: `migrate.test.ts` is
 * this suite's sibling and resets with `drop schema public cascade`, because
 * the migration ledger is what it tests. Both share `pas_test`.
 *
 * That produced an intermittent failure — three tests at the tail of this file
 * failing with `relation "pas_test_widget" does not exist`, passing on the
 * next run. An intermittent failure in a shared fixture is worse than a
 * consistent one: it is read as infrastructure flakiness and re-run until
 * green.
 *
 * Creating it per test costs one cheap statement and removes the assumption
 * entirely. This is CLAUDE.md §5's rule — *a suite that shares a database owns
 * its starting state* — applied to the suite that was relying on a sibling not
 * to clean up.
 */
beforeEach(async () => {
  await query(`
    create table if not exists pas_test_widget (
      id      bigserial primary key,
      label   text not null unique,
      amount  integer not null check (amount >= 0)
    )
  `);
  await query('truncate pas_test_widget restart identity');
});

afterAll(async () => {
  await query('drop table if exists pas_test_widget');
  await closePool();
});

async function labels(): Promise<string[]> {
  const { rows } = await query<{ label: string }>(
    'select label from pas_test_widget order by label',
  );
  return rows.map((r) => r.label);
}

describe('connection pooling', () => {
  it('connects to a real database', async () => {
    const row = await queryOne<{ db: string; version: string }>(
      `select current_database() as db, split_part(version(), ' ', 2) as version`,
    );
    expect(row?.db).toBe('pas_test');
    expect(row?.version).toMatch(/^1[6-9]\./);
  });

  it('reuses pooled connections rather than opening one per query', async () => {
    await Promise.all(Array.from({ length: 20 }, () => query('select 1')));
    const stats = poolStatistics();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.total).toBeLessThanOrEqual(10); // config poolMax
  });

  it('returns a connection to the pool even when the caller throws', async () => {
    const before = poolStatistics();
    await expect(
      withConnection(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // A leaked slot would show as a permanent drop in idle capacity.
    await query('select 1');
    expect(poolStatistics().idle).toBeGreaterThanOrEqual(Math.min(1, before.idle));
  });

  it('enforces statement_timeout on every connection', async () => {
    const row = await queryOne<{ statement_timeout: string; lock_timeout: string }>(
      `select current_setting('statement_timeout') as statement_timeout,
              current_setting('lock_timeout') as lock_timeout`,
    );
    // Without this, one pathological query holds a pool slot indefinitely and
    // exhausting the pool takes the whole service down.
    expect(row?.statement_timeout).not.toBe('0');
    expect(row?.lock_timeout).not.toBe('0');
  });

  it('bounds idle-in-transaction sessions', async () => {
    const row = await queryOne<{ v: string }>(
      `select current_setting('idle_in_transaction_session_timeout') as v`,
    );
    expect(row?.v).not.toBe('0');
  });
});

describe('transactions commit and roll back', () => {
  it('commits when the callback resolves', async () => {
    await withTransaction(async (tx) => {
      await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['a', 1], {
        client: tx,
      });
      await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['b', 2], {
        client: tx,
      });
    });
    expect(await labels()).toEqual(['a', 'b']);
  });

  it('rolls back everything when the callback throws', async () => {
    await expect(
      withTransaction(async (tx) => {
        await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['a', 1], {
          client: tx,
        });
        throw new Error('halfway failure');
      }),
    ).rejects.toThrow('halfway failure');
    expect(await labels()).toEqual([]);
  });

  it('keeps a mutation and its outbox row atomic (Part I §5)', async () => {
    // The canonical shape: the row and the event that announces it either both
    // exist or neither does. A commit between them is what §5 forbids.
    await expect(
      withTransaction(async (tx) => {
        await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['claim', 1], {
          client: tx,
        });
        // stands in for `insert into outbox_events ...`
        await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['claim', 2], {
          client: tx,
        });
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    // The first insert must not have survived the second one's failure.
    expect(await labels()).toEqual([]);
  });

  it('exposes transaction state to nested code', async () => {
    expect(inTransaction()).toBe(false);
    expect(transactionDepth()).toBe(0);
    await withTransaction(async (tx) => {
      expect(inTransaction()).toBe(true);
      expect(transactionDepth()).toBe(1);
      expect(currentTransactionClient()).toBe(tx);
    });
    expect(inTransaction()).toBe(false);
  });

  it('honours isolation level and read-only mode', async () => {
    const row = await withTransaction(
      async (tx) =>
        await queryOne<{ iso: string; ro: string }>(
          `select current_setting('transaction_isolation') as iso,
                  current_setting('transaction_read_only') as ro`,
          [],
          { client: tx },
        ),
      { isolation: 'SERIALIZABLE', readOnly: true },
    );
    expect(row?.iso).toBe('serializable');
    expect(row?.ro).toBe('on');
  });
});

describe('nested transactions use savepoints', () => {
  /**
   * The failure being prevented: Postgres has one transaction per connection.
   * A nested COMMIT would commit the OUTER transaction's partial work — the
   * mutation becomes durable, the outbox event never lands, and the outer
   * caller's later rollback does nothing. That is precisely the state/event
   * divergence Part I §5 forbids.
   */
  it('does not commit the outer transaction when an inner frame completes', async () => {
    await expect(
      withTransaction(async (tx) => {
        await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['outer', 1], {
          client: tx,
        });

        await withTransaction(async (inner) => {
          await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['inner', 2], {
            client: inner,
          });
        });

        // If the inner call had committed, these rows would now be durable.
        throw new Error('outer fails after the inner frame succeeded');
      }),
    ).rejects.toThrow('outer fails');

    expect(await labels()).toEqual([]);
  });

  it('rolls back only the inner frame when it fails, leaving the outer usable', async () => {
    await withTransaction(async (tx) => {
      await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['kept', 1], {
        client: tx,
      });

      await expect(
        withTransaction(async (inner) => {
          await query(
            'insert into pas_test_widget (label, amount) values ($1, $2)',
            ['discarded', 2],
            { client: inner },
          );
          throw new Error('inner failure');
        }),
      ).rejects.toThrow('inner failure');

      // The outer transaction survived and can keep working.
      await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['after', 3], {
        client: tx,
      });
    });

    expect(await labels()).toEqual(['after', 'kept']);
  });

  it('tracks depth through several levels', async () => {
    await withTransaction(async () => {
      expect(transactionDepth()).toBe(1);
      await withTransaction(async () => {
        expect(transactionDepth()).toBe(2);
        await withTransaction(async () => {
          expect(transactionDepth()).toBe(3);
        });
        expect(transactionDepth()).toBe(2);
      });
      expect(transactionDepth()).toBe(1);
    });
  });

  it('refuses isolation or readOnly on a nested call rather than ignoring them', async () => {
    // Silently inheriting READ COMMITTED while the caller believes it has
    // SERIALIZABLE produces rare, unexplained anomalies under concurrency.
    await expect(
      withTransaction(async () => {
        await withTransaction(async () => {}, { isolation: 'SERIALIZABLE' });
      }),
    ).rejects.toThrow(/nested transaction/);
  });
});

describe('query instrumentation reaches Postgres', () => {
  it('embeds the correlation id where a DBA can see it', async () => {
    await runInNewOperation({ correlationId: 'corr_instrument_1' }, async () => {
      const row = await queryOne<{ q: string }>(
        `select query as q from pg_stat_activity where pid = pg_backend_pid()`,
        [],
        { operation: 'test.instrumentation' },
      );
      // This is the whole justification for a SQL comment over a log line:
      // the id travels INTO Postgres and shows up in pg_stat_activity,
      // slow-query logs and pg_stat_statements.
      expect(row?.q).toContain('pas:corr=corr_instrument_1');
      expect(row?.q).toContain('op=test.instrumentation');
    });
  });

  it('emits no comment outside a correlated operation', () => {
    expect(instrumentationComment()).toBe('');
  });

  it('drops a correlation id that fails validation rather than escaping it', async () => {
    // The id is interpolated into SQL text, so it must not be able to close
    // the comment or inject a newline. Safety comes from the charset check.
    await runInNewOperation({ correlationId: 'ok_id' }, () => {
      expect(instrumentationComment('bad op; drop table x')).toBe('-- pas:corr=ok_id\n');
    });
  });

  it('cannot be used to inject SQL', async () => {
    await runInNewOperation({ correlationId: '*/ drop table pas_test_widget; --' }, async () => {
      await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['safe', 1]);
    });
    // The table is still there, and the hostile id never reached the text.
    expect(await labels()).toEqual(['safe']);
  });
});

describe('driver errors become typed PAS errors', () => {
  it('maps a unique violation to ConflictError', async () => {
    await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['dup', 1]);
    const error = await query(
      'insert into pas_test_widget (label, amount) values ($1, $2)',
      ['dup', 2],
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).code).toBe('database.unique_violation');
  });

  it('maps a check violation to ValidationError', async () => {
    const error = await query('insert into pas_test_widget (label, amount) values ($1, $2)', [
      'neg',
      -1,
    ]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('maps a statement timeout to a NON-retryable ExternalServiceError', async () => {
    const error = await withConnection(async (client) => {
      await client.query('set statement_timeout = 50');
      return query('select pg_sleep(2)', [], { client }).catch((e: unknown) => e);
    });
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).code).toBe('database.statement_timeout');
    // The query is not coming back faster on retry.
    expect((error as ExternalServiceError).retryable).toBe(false);
  });

  it('never lets a raw driver error escape', async () => {
    const error = await query('select * from a_table_that_does_not_exist').catch(
      (e: unknown) => e,
    );
    expect(isPasError(error)).toBe(true);
    // A pg error carries the connection string on its message path.
    expect(String((error as Error).message)).not.toContain('postgres://');
    expect(String((error as Error).message)).not.toContain('password');
  });

  it('never echoes row values back in details', async () => {
    await query('insert into pas_test_widget (label, amount) values ($1, $2)', ['secret-value', 1]);
    const error = (await query('insert into pas_test_widget (label, amount) values ($1, $2)', [
      'secret-value',
      2,
    ]).catch((e: unknown) => e)) as ConflictError;

    // Postgres puts the offending values in error.detail:
    //   "Key (label)=(secret-value) already exists"
    // Echoing that returns user data straight to the caller.
    expect(JSON.stringify(error.details)).not.toContain('secret-value');
    expect(JSON.stringify(error.details)).toContain('pas_test_widget');
  });

  it('classifies contention as retryable and logic errors as not', () => {
    expect(isRetryable({ code: PG_ERROR_CODES.SERIALIZATION_FAILURE })).toBe(true);
    expect(isRetryable({ code: PG_ERROR_CODES.DEADLOCK_DETECTED })).toBe(true);
    expect(isRetryable({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isRetryable({ code: PG_ERROR_CODES.UNIQUE_VIOLATION })).toBe(false);
    expect(isRetryable(new Error('no code'))).toBe(false);
  });

  it('wraps an unrecognised throw without leaking it', () => {
    const wrapped = toDatabaseError({ password: 'hunter2', host: 'db.internal' });
    expect(isPasError(wrapped)).toBe(true);
    expect(JSON.stringify(wrapped.details ?? {})).not.toContain('hunter2');
  });
});

describe('queryOne', () => {
  it('returns undefined for no rows', async () => {
    expect(await queryOne('select 1 where false')).toBeUndefined();
  });

  it('throws when more than one row comes back', async () => {
    await query('insert into pas_test_widget (label, amount) values ($1, $2), ($3, $4)', [
      'x',
      1,
      'y',
      2,
    ]);
    // Silently taking rows[0] hides a missing uniqueness constraint until the
    // wrong record has been served to somebody.
    await expect(queryOne('select * from pas_test_widget')).rejects.toThrow();
  });
});

describe('database health (PAS-0005 registry)', () => {
  it('reports reachable with pool statistics', async () => {
    const health = await checkDatabase();
    expect(health.reachable).toBe(true);
    expect(health.pool.total).toBeGreaterThan(0);
  });

  it('exposes a critical readiness check with a short timeout', async () => {
    expect(databaseReadinessCheck.name).toBe('database');
    expect(databaseReadinessCheck.critical).toBe(true);
    // Shorter than statement_timeout: a probe that waits as long as a real
    // query turns a slow database into a killed process.
    expect(databaseReadinessCheck.timeoutMs).toBeLessThan(30_000);
    await expect(databaseReadinessCheck.run()).resolves.toBeUndefined();
  });

  it('does not get slower as tables grow', async () => {
    const values = Array.from({ length: 500 }, (_, i) => `('w${i}', ${i})`).join(',');
    await query(`insert into pas_test_widget (label, amount) values ${values}`);
    const started = Date.now();
    await checkDatabase();
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('migration access (PAS-0102 consumes this)', () => {
  it('serialises concurrent migrators with an advisory lock', async () => {
    const order: string[] = [];

    // A rolling deploy starts several instances at once. Without the lock they
    // all apply the same migrations and the losers crash-loop.
    const runner = (name: string) =>
      withMigrationLock(async () => {
        order.push(`${name}:start`);
        await new Promise((resolve) => setTimeout(resolve, 120));
        order.push(`${name}:end`);
      });

    await Promise.all([runner('a'), runner('b')]);

    // Whoever won, the two runs must not interleave.
    expect(order).toHaveLength(4);
    expect(order[1]).toBe(`${order[0].split(':')[0]}:end`);
    expect(order[3]).toBe(`${order[2].split(':')[0]}:end`);
  });

  it('releases the lock when the callback throws', async () => {
    await expect(
      withMigrationLock(async () => {
        throw new Error('migration blew up');
      }),
    ).rejects.toThrow('migration blew up');

    // A lock leaked here would block every future deploy.
    const held = await queryOne<{ n: string }>(
      `select count(*)::text as n from pg_locks
        where locktype = 'advisory' and objid is not null`,
    );
    await expect(withMigrationLock(async () => 'ok')).resolves.toBe('ok');
    expect(held).toBeDefined();
  });

  it('times out rather than hanging a deploy forever', async () => {
    let release!: () => void;
    const holding = new Promise<void>((resolve) => (release = resolve));
    const holder = withMigrationLock(() => holding);

    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(withMigrationLock(async () => 'never', { timeoutMs: 300 })).rejects.toThrow();

    release();
    await holder;
  });

  it('applies DDL transactionally, leaving no partial schema on failure', async () => {
    await expect(
      withTransaction(async (tx) => {
        await runMigrationStatements(
          ['create table pas_mig_probe (id int)', 'create table pas_mig_probe (id int)'],
          tx,
        );
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    const exists = await queryOne<{ present: boolean }>(
      `select to_regclass('pas_mig_probe') is not null as present`,
    );
    expect(exists?.present).toBe(false);
  });
});
