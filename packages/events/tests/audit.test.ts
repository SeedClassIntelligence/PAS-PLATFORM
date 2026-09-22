/**
 * PAS-0301 acceptance tests.
 *
 * The three properties worth attacking: an audit entry commits with its
 * mutation or not at all, it cannot be altered afterwards, and it does not
 * become a place secrets live forever.
 *
 * "It inserts a row" is not one of them.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { query, closePool, migrate, withTransaction } from '@pas/database';
import { generateId } from '@pas/domain';
import { now, ValidationError, REDACTED } from '@pas/contracts';
import { runInNewOperation, currentContext } from '@pas/observability';
import { resolve } from 'node:path';
import { recordAuditEntry, auditWithin, readAuditEntries } from '../src/index.js';

const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

const BASE = {
  actor: { type: 'USER' as const, id: '' },
  action: 'claim.approve',
  targetType: 'claim',
  targetId: 'claim-1',
  origin: 'MANUAL_ENTRY' as const,
};

function entry(over: Partial<Parameters<typeof recordAuditEntry>[0]> = {}) {
  return { ...BASE, actor: { type: 'USER' as const, id: generateId() }, ...over };
}

beforeAll(async () => {
  await query('drop schema public cascade');
  await query('create schema public');
  await migrate({ directory: MIGRATIONS });
}, 60_000);

beforeEach(async () => {
  await query('truncate table audit_entries');
});

afterAll(async () => {
  await closePool();
});

describe('an entry records what PAS-0301 and §23 require', () => {
  it('stores every required field', async () => {
    const actorId = generateId();
    const entityId = generateId();

    await recordAuditEntry({
      actor: { type: 'USER', id: actorId },
      action: 'claim.approve',
      targetType: 'claim',
      targetId: 'claim-42',
      authorityEntityId: entityId,
      beforeRef: 'version-7',
      afterRef: 'version-8',
      authorizationResult: 'ALLOW',
      authorizationReason: 'ROLE_GRANT',
      governanceDecision: 'G3_PASSED',
      origin: 'ADMIN',
      correlationId: 'corr-1',
      metadata: { note: 'reviewed' },
    });

    const [found] = await readAuditEntries();
    expect(found).toMatchObject({
      actor: { type: 'USER', id: actorId },
      action: 'claim.approve',
      targetType: 'claim',
      targetId: 'claim-42',
      authorityEntityId: entityId,
      beforeRef: 'version-7',
      afterRef: 'version-8',
      authorizationResult: 'ALLOW',
      authorizationReason: 'ROLE_GRANT',
      governanceDecision: 'G3_PASSED',
      origin: 'ADMIN',
      correlationId: 'corr-1',
      metadata: { note: 'reviewed' },
    });
    expect(found.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('takes the correlation id from the ambient context when not given', async () => {
    // PAS-0004 is what makes one action legible across the API, the worker and
    // the outbox. An audit entry that dropped it would be unjoinable.
    await runInNewOperation({ kind: 'test', name: 'audit' }, async () => {
      await recordAuditEntry(entry());
      const [found] = await readAuditEntries();
      expect(found.correlationId).toBe(currentContext()?.correlationId);
      expect(found.correlationId).toBeTruthy();
    });
  });

  it('records a SYSTEM actor, which is the one nobody is watching', async () => {
    await recordAuditEntry({ ...BASE, actor: { type: 'SYSTEM' }, action: 'outbox.dispatch' });
    const [found] = await readAuditEntries();
    expect(found.actor).toEqual({ type: 'SYSTEM' });
  });

  it.each([
    [{ type: 'USER' as const }, 'a USER with no id'],
    [{ type: 'SYSTEM' as const, id: generateId() }, 'a SYSTEM carrying a user id'],
    [{ type: 'ANONYMOUS' as const, id: generateId() }, 'an ANONYMOUS carrying a user id'],
  ])('refuses %j — %s', async (actor, why) => {
    // A SYSTEM row carrying a user id reads, during an investigation, as that
    // user having done it.
    await expect(
      recordAuditEntry({ ...BASE, actor }),
      `accepted ${why}`,
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /**
   * The application check and the database constraint both refuse this, so
   * removing either one leaves the behaviour intact — which is how a mutation
   * survived the first sweep. They are tested separately because they are
   * there for different reasons.
   */
  it('names the offending field, which the database constraint cannot', async () => {
    try {
      await recordAuditEntry({ ...BASE, actor: { type: 'SYSTEM', id: generateId() } });
      expect.unreachable('should have thrown');
    } catch (error) {
      const problems = (error as ValidationError).problems;
      expect(problems[0]?.path).toBe('actor.id');
      expect(problems[0]?.message).toContain('SYSTEM');
    }
  });

  it('is refused by the database too, for a writer that skips the service', async () => {
    // A migration, a future writer, anything not going through
    // `recordAuditEntry`. The constraint is the backstop, and a backstop
    // nothing tests is a backstop nobody knows is gone.
    await expect(
      query(
        `insert into audit_entries
           (id, occurred_at, actor_type, actor_id, action, target_type, target_id, origin)
         values ($1, $2, 'SYSTEM', $3, 'a', 'b', 'c', 'SYSTEM')`,
        [generateId(), now(), generateId()],
      ),
    ).rejects.toThrow();

    await expect(
      query(
        `insert into audit_entries
           (id, occurred_at, actor_type, action, target_type, target_id, origin)
         values ($1, $2, 'USER', 'a', 'b', 'c', 'SYSTEM')`,
        [generateId(), now()],
      ),
    ).rejects.toThrow();
  });

  it('refuses metadata that is not an object, at the database', async () => {
    // `safeMetadata` guarantees an object, so this constraint only fires for a
    // writer that bypassed it — which is exactly when it matters.
    for (const notAnObject of ['"a string"', '[1,2,3]', '42', 'null']) {
      await expect(
        query(
          `insert into audit_entries
             (id, occurred_at, actor_type, action, target_type, target_id, origin, metadata)
           values ($1, $2, 'SYSTEM', 'a', 'b', 'c', 'SYSTEM', $3::jsonb)`,
          [generateId(), now(), notAnObject],
        ),
        notAnObject,
      ).rejects.toThrow();
    }
  });

  it('refuses an origin outside ADR-004', async () => {
    await expect(
      recordAuditEntry({ ...entry(), origin: 'VIBES' as never }),
    ).rejects.toThrow();
  });
});

describe('an entry commits with its mutation, or not at all — Part I §5', () => {
  /**
   * The rule the whole build turns on. A mutation that commits without its
   * audit entry is a change nobody can account for; an audit entry that
   * commits without its mutation is a record of something that never
   * happened, which is worse, because it is believed.
   */
  it('is rolled back when the transaction that made the change fails', async () => {
    await query(`create table probe_widgets (id uuid primary key)`);
    const widgetId = generateId();

    await expect(
      withTransaction(async (tx) => {
        await query(`insert into probe_widgets (id) values ($1)`, [widgetId], { client: tx });
        await auditWithin(tx, { ...entry(), action: 'widget.create', targetId: widgetId });
        throw new Error('the mutation failed after the audit entry');
      }),
    ).rejects.toThrow('the mutation failed after the audit entry');

    expect(await readAuditEntries()).toEqual([]);
    const { rows } = await query(`select 1 from probe_widgets where id = $1`, [widgetId]);
    expect(rows).toHaveLength(0);

    await query(`drop table probe_widgets`);
  });

  it('commits with the change when the transaction succeeds', async () => {
    await query(`create table probe_widgets (id uuid primary key)`);
    const widgetId = generateId();

    await withTransaction(async (tx) => {
      await query(`insert into probe_widgets (id) values ($1)`, [widgetId], { client: tx });
      await auditWithin(tx, { ...entry(), action: 'widget.create', targetId: widgetId });
    });

    expect(await readAuditEntries()).toHaveLength(1);
    const { rows } = await query(`select 1 from probe_widgets where id = $1`, [widgetId]);
    expect(rows).toHaveLength(1);

    await query(`drop table probe_widgets`);
  });

  it('does not open a transaction of its own', async () => {
    // A writer managing its own transaction would commit the audit entry
    // whether or not the mutation survived. `auditWithin` takes the client
    // first so a call missing it does not compile.
    await expect(
      withTransaction(async (tx) => {
        await auditWithin(tx, entry());
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await readAuditEntries()).toEqual([]);
  });
});

describe('the ledger is append-only, enforced by the database', () => {
  /**
   * The person who needs to edit the audit log is exactly the person who must
   * not be able to. A convention does not stop them; a trigger does.
   */
  it('refuses an UPDATE', async () => {
    await recordAuditEntry(entry());
    await expect(
      query(`update audit_entries set action = 'something.else'`),
    ).rejects.toThrow();
  });

  it('refuses a DELETE', async () => {
    await recordAuditEntry(entry());
    await expect(query(`delete from audit_entries`)).rejects.toThrow();
    expect(await readAuditEntries()).toHaveLength(1);
  });

  it('refuses an UPDATE that only touches metadata', async () => {
    // The subtle edit: not rewriting history, just "correcting" a note.
    await recordAuditEntry(entry());
    await expect(
      query(`update audit_entries set metadata = '{}'::jsonb`),
    ).rejects.toThrow();
  });

  it('exposes no update or delete path in the module surface', async () => {
    const module = await import('../src/index.js');
    for (const forbidden of ['updateAuditEntry', 'deleteAuditEntry', 'purgeAuditEntries']) {
      expect(Object.keys(module), forbidden).not.toContain(forbidden);
    }
  });
});

describe('sensitive values are redacted', () => {
  /**
   * Metadata is assembled from whatever context was to hand, which is exactly
   * how a token ends up in it — and audit is the table that is never deleted,
   * so a leak into it is permanent.
   */
  it.each([
    ['password', 'hunter2'],
    ['token', 'abcdef0123456789'],
    ['authorization', 'Bearer abcdefghijklmnopqrstuv'],
    ['apiKey', 'sk-0123456789abcdefghij'],
    ['sessionToken', 'zzzz'],
  ])('redacts metadata.%s', async (key, value) => {
    await recordAuditEntry({ ...entry(), metadata: { [key]: value } });
    const [found] = await readAuditEntries();
    expect(found.metadata[key]).toBe(REDACTED);
    expect(JSON.stringify(found.metadata)).not.toContain(value);
  });

  it('redacts a credential by its shape, whatever the key is called', async () => {
    const jwt = `eyJ${'a'.repeat(40)}`;
    await recordAuditEntry({
      ...entry(),
      metadata: { harmlessLookingField: jwt, dsn: 'postgres://user:hunter2@db/pas' },
    });
    const [found] = await readAuditEntries();
    expect(JSON.stringify(found.metadata)).not.toContain(jwt);
    expect(JSON.stringify(found.metadata)).not.toContain('hunter2');
  });

  it('uses PAS-0003\'s scrubber rather than a second one', async () => {
    // Two redactors drift, and the weaker one is the one that leaks.
    const { scrubDetails } = await import('@pas/contracts');
    const input = { password: 'hunter2', note: 'fine' };
    await recordAuditEntry({ ...entry(), metadata: input });
    const [found] = await readAuditEntries();
    expect(found.metadata).toEqual(scrubDetails(input));
  });

  it('keeps metadata an object even when handed something else', async () => {
    // Losing audit detail silently is the one outcome worse than keeping it.
    await recordAuditEntry({ ...entry(), metadata: ['a', 'b'] as never });
    const [found] = await readAuditEntries();
    expect(typeof found.metadata).toBe('object');
    expect(Array.isArray(found.metadata)).toBe(false);
  });

  it('bounds an oversized value rather than storing it whole', async () => {
    await recordAuditEntry({ ...entry(), metadata: { blob: 'x'.repeat(50_000) } });
    const [found] = await readAuditEntries();
    expect(String(found.metadata.blob).length).toBeLessThan(2_000);
  });
});

describe('reading', () => {
  it('filters by actor, target and correlation', async () => {
    const actorId = generateId();
    await recordAuditEntry({ ...BASE, actor: { type: 'USER', id: actorId }, correlationId: 'c1' });
    await recordAuditEntry({ ...entry(), targetId: 'other', correlationId: 'c2' });

    expect(await readAuditEntries({ actorId })).toHaveLength(1);
    expect(await readAuditEntries({ targetId: 'other' })).toHaveLength(1);
    expect(await readAuditEntries({ correlationId: 'c1' })).toHaveLength(1);
    expect(await readAuditEntries({ targetType: 'claim' })).toHaveLength(2);
  });

  /**
   * The collision is forced, not hoped for.
   *
   * A first version wrote in a tight loop and asserted the timestamps
   * collided — but each write is a database round trip taking more than a
   * millisecond, so they usually did not, and the test would have passed for
   * the wrong reason on a slow machine and failed on a fast one. Giving every
   * entry the *same* `occurredAt` makes ordering by timestamp provably
   * ambiguous, so only the sequence can resolve it.
   */
  it('returns entries in insertion order when timestamps are identical', async () => {
    const sameInstant = now();
    const written = ['first', 'second', 'third', 'fourth', 'fifth'];
    for (const action of written) {
      await recordAuditEntry({ ...entry(), action, occurredAt: sameInstant });
    }

    const read = await readAuditEntries();

    // Every timestamp is identical, so `order by occurred_at` cannot decide
    // this and `order by id` would shuffle it.
    expect(new Set(read.map((e) => e.occurredAt))).toEqual(new Set([sameInstant]));
    expect(read.map((e) => e.action)).toEqual([...written].reverse());
  });

  it('orders by insertion even when an entry backdates its timestamp', async () => {
    // A corrective entry recording a moment that has already passed must not
    // reorder the ledger around it.
    await recordAuditEntry({ ...entry(), action: 'happened-first' });
    await recordAuditEntry({
      ...entry(),
      action: 'recorded-second-about-the-past',
      occurredAt: '2020-01-01T00:00:00.000Z' as ReturnType<typeof now>,
    });

    expect((await readAuditEntries()).map((e) => e.action)).toEqual([
      'recorded-second-about-the-past',
      'happened-first',
    ]);
  });

  /**
   * Written with more rows than the cap, deliberately.
   *
   * A first version inserted twelve and asserted the result was at most 500 —
   * which is true of twelve whether or not a cap exists, and a mutation
   * removing the cap survived it.
   */
  it('caps a read that asks for more than the maximum', async () => {
    const OVER_CAP = 550;
    await query(
      `insert into audit_entries
         (id, occurred_at, actor_type, action, target_type, target_id, origin)
       select gen_random_uuid(), $1, 'SYSTEM', 'bulk', 'probe', i::text, 'SYSTEM'
         from generate_series(1, $2) as i`,
      [now(), OVER_CAP],
    );

    expect(await readAuditEntries({ limit: 5 })).toHaveLength(5);
    // Asking for everything returns the cap, not everything.
    expect(await readAuditEntries({ limit: 10_000 })).toHaveLength(500);
    expect(await readAuditEntries()).toHaveLength(100);
  });

  it('does not authorize itself', async () => {
    // Reading the audit record is `audit.read` (PAS-0203), decided by PAS-0204
    // against the account being read. A reader that authorized itself would be
    // the bypass PAS-0204's guard exists to prevent.
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(resolve(import.meta.dirname, '../src/audit/read.ts'), 'utf8'),
    );
    expect(source).not.toContain('authorize(');
    expect(source).not.toContain('requireCapability');
  });
});
