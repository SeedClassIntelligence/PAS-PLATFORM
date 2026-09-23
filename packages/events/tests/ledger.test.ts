/**
 * PAS-0303 acceptance tests.
 *
 * "Application code may append. Application code may not edit historical
 *  events." Both halves are attacked: that an append commits with its
 * mutation, and that nothing — including a metadata-only "correction" —
 * can alter a row afterwards.
 *
 * The third property is this ticket's own: a payload shaped like a credential
 * is refused, not redacted, because an immutable table cannot be corrected.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { query, closePool, migrate, withTransaction } from '@pas/database';
import { generateId } from '@pas/domain';
import { now, ValidationError } from '@pas/contracts';
import { resolve } from 'node:path';
import {
  createDomainEvent,
  appendDomainEvent,
  emitWithin,
  readDomainEvents,
  readAggregateStream,
  findCredentialShape,
  SYSTEM_ACTOR,
} from '../src/index.js';

const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

function anEvent(over: Record<string, unknown> = {}) {
  return createDomainEvent({
    eventType: 'ClaimApproved',
    aggregateType: 'claim',
    aggregateId: 'claim-1',
    actor: { type: 'USER', id: generateId() },
    payload: { claimId: 'claim-1' },
    ...over,
  });
}

beforeAll(async () => {
  await query('drop schema public cascade');
  await query('create schema public');
  await migrate({ directory: MIGRATIONS });
}, 60_000);

beforeEach(async () => {
  await query('truncate table domain_events');
});

afterAll(async () => {
  await closePool();
});

describe('application code may append', () => {
  it('stores every envelope field and reads it back', async () => {
    const event = anEvent({
      schemaVersion: 3,
      authorityEntityId: generateId(),
      authorityRecordId: generateId(),
      journeyId: generateId(),
      correlationId: 'corr-1',
      causationId: 'cause-1',
    });

    await appendDomainEvent(event);
    const [stored] = await readDomainEvents();

    // Value-for-value, not key presence — the mistake PAS-0302's sweep caught.
    expect(stored.event).toEqual(event);
    expect(stored.sequence).toBeTypeOf('bigint');
  });

  it('stores a SYSTEM actor, for work nobody is watching', async () => {
    await appendDomainEvent(anEvent({ actor: SYSTEM_ACTOR }));
    const [stored] = await readDomainEvents();
    expect(stored.event.actor).toEqual({ type: 'SYSTEM' });
  });

  it('refuses the same event twice', async () => {
    const event = anEvent();
    await appendDomainEvent(event);
    // The identifier is the primary key, so a duplicate delivery of the same
    // event cannot create a second row.
    await expect(appendDomainEvent(event)).rejects.toThrow();
  });

  it('records when the row was written as well as when the thing happened', async () => {
    await appendDomainEvent(anEvent({ occurredAt: '2020-01-01T00:00:00.000Z' }));
    const { rows } = await query<{ occurred_at: Date; recorded_at: Date }>(
      `select occurred_at, recorded_at from domain_events`,
    );
    expect(rows[0].occurred_at.getUTCFullYear()).toBe(2020);
    expect(rows[0].recorded_at.getTime()).toBeGreaterThan(rows[0].occurred_at.getTime());
  });
});

describe('an append commits with its mutation — Part I §5', () => {
  it('is rolled back when the mutation fails', async () => {
    await query(`create table probe_claims (id text primary key)`);

    await expect(
      withTransaction(async (tx) => {
        await query(`insert into probe_claims (id) values ('claim-1')`, [], { client: tx });
        await emitWithin(tx, {
          eventType: 'ClaimApproved',
          aggregateType: 'claim',
          aggregateId: 'claim-1',
          actor: SYSTEM_ACTOR,
          payload: {},
        });
        throw new Error('the mutation failed after the event');
      }),
    ).rejects.toThrow('the mutation failed after the event');

    // An event recording something that was rolled back is worse than no
    // event, because consumers act on it.
    expect(await readDomainEvents()).toEqual([]);
    expect((await query(`select 1 from probe_claims`)).rows).toHaveLength(0);

    await query(`drop table probe_claims`);
  });

  it('commits with the mutation when it succeeds', async () => {
    await query(`create table probe_claims (id text primary key)`);

    await withTransaction(async (tx) => {
      await query(`insert into probe_claims (id) values ('claim-1')`, [], { client: tx });
      await emitWithin(tx, {
        eventType: 'ClaimApproved',
        aggregateType: 'claim',
        aggregateId: 'claim-1',
        actor: SYSTEM_ACTOR,
        payload: { claimId: 'claim-1' },
      });
    });

    expect(await readDomainEvents()).toHaveLength(1);
    await query(`drop table probe_claims`);
  });
});

describe('application code may NOT edit historical events — §21', () => {
  it('refuses an UPDATE', async () => {
    await appendDomainEvent(anEvent());
    await expect(query(`update domain_events set event_type = 'ClaimRejected'`)).rejects.toThrow();
  });

  it('refuses a DELETE', async () => {
    await appendDomainEvent(anEvent());
    await expect(query(`delete from domain_events`)).rejects.toThrow();
    expect(await readDomainEvents()).toHaveLength(1);
  });

  it('refuses an UPDATE that only rewrites the payload', async () => {
    // The subtle edit: not changing what happened, just "fixing" the detail.
    await appendDomainEvent(anEvent());
    await expect(query(`update domain_events set payload = '{}'::jsonb`)).rejects.toThrow();
  });

  it('exposes no way to edit or remove an event', async () => {
    const module = await import('../src/index.js');
    for (const forbidden of [
      'updateDomainEvent',
      'deleteDomainEvent',
      'amendDomainEvent',
      'purgeDomainEvents',
    ]) {
      expect(Object.keys(module), forbidden).not.toContain(forbidden);
    }
  });

  it('corrects by appending, which is what §21 means', async () => {
    const original = anEvent({ payload: { amount: 100 } });
    await appendDomainEvent(original);

    const correction = anEvent({
      eventType: 'ClaimAmountCorrected',
      payload: { amount: 150, corrects: original.eventId },
    });
    await appendDomainEvent(correction);

    // Both survive. The original is not edited out of existence, so a
    // consumer that already acted on it can still be reconciled.
    const stream = await readAggregateStream('claim', 'claim-1');
    expect(stream.map((s) => s.event.eventType)).toEqual([
      'ClaimApproved',
      'ClaimAmountCorrected',
    ]);
  });
});

describe('a credential in a payload is refused, not redacted', () => {
  /**
   * The decision that separates this ledger from audit. `scrubDetails`
   * redacts on key name and value shape, which is right for incidental
   * metadata and wrong for canonical data: redacting silently writes a
   * falsified record into a table that can never be corrected.
   */
  it.each([
    ['a JWT', { token: `eyJ${'a'.repeat(40)}` }],
    ['a connection string with a password', { dsn: 'postgres://user:hunter2@db/pas' }],
    ['an AWS access key id', { key: 'AKIAIOSFODNN7EXAMPLE' }],
    ['a bearer token', { header: 'Bearer abcdefghijklmnopqrstuvwx' }],
    ['a PEM private key', { pem: '-----BEGIN RSA PRIVATE KEY-----\nabc' }],
  ])('refuses %s', async (_what, payload) => {
    await expect(appendDomainEvent(anEvent({ payload }))).rejects.toBeInstanceOf(ValidationError);
    expect(await readDomainEvents()).toEqual([]);
  });

  it('finds one nested inside arrays and objects, and names the path', async () => {
    const payload = { steps: [{ ok: true }, { detail: { auth: `eyJ${'b'.repeat(40)}` } }] };
    try {
      await appendDomainEvent(anEvent({ payload }));
      expect.unreachable('should have thrown');
    } catch (error) {
      const problem = (error as ValidationError).problems[0];
      // The emitter is usually assembling a payload from several sources and
      // needs to know which one.
      expect(problem?.path).toBe('payload.steps[1].detail.auth');
      expect(problem?.message).toContain('immutable');
    }
  });

  /**
   * The other half of the decision, and the one that would be easy to get
   * wrong: key-name matching is NOT applied. These are legitimate canonical
   * data that `scrubDetails` would redact.
   */
  it.each([
    ['a claim about a password policy', { statement: 'Authored the organisation password policy' }],
    ['a field named token', { tokenIssuer: 'Nevada Board of Health' }],
    ['a credential class', { credentialType: 'CHW-1', secretariat: 'State Board' }],
    ['a field named apiKey with a plain value', { apiKeyName: 'partner-integration' }],
    ['a field named authorization', { authorizationBasis: 'board resolution 14' }],
  ])('stores %s unaltered', async (_what, payload) => {
    await appendDomainEvent(anEvent({ payload }));
    const [stored] = await readDomainEvents();
    // Unaltered — not redacted, not dropped.
    expect(stored.event.payload).toEqual(payload);
  });

  it('rolls the mutation back with the refusal', async () => {
    await query(`create table probe_claims (id text primary key)`);

    await expect(
      withTransaction(async (tx) => {
        await query(`insert into probe_claims (id) values ('claim-1')`, [], { client: tx });
        await emitWithin(tx, {
          eventType: 'ClaimApproved',
          aggregateType: 'claim',
          aggregateId: 'claim-1',
          actor: SYSTEM_ACTOR,
          payload: { token: `eyJ${'c'.repeat(40)}` },
        });
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // Nothing half-recorded: the mutation is gone too.
    expect((await query(`select 1 from probe_claims`)).rows).toHaveLength(0);
    await query(`drop table probe_claims`);
  });

  it('survives a payload containing a cycle', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;
    expect(findCredentialShape(cyclic)).toBeUndefined();
  });

  it('still finds a credential reachable only through a cycle', () => {
    // The cycle guard must terminate the walk without abandoning the branch
    // that has not been visited yet.
    const node: Record<string, unknown> = { token: `eyJ${'e'.repeat(40)}` };
    const root: Record<string, unknown> = { child: node };
    node.parent = root;
    expect(findCredentialShape(root)).toBe('payload.child.token');
  });

  /**
   * The depth cap was 12, which stored a credential nested more deeply than
   * that — in a table with no delete path. Found by a mutation sweep that
   * flagged the cycle guard as redundant; the cap was doing the scan's job
   * for it.
   */
  it('finds a credential nested far deeper than a payload has any business being', async () => {
    const jwt = `eyJ${'f'.repeat(40)}`;
    let deep: Record<string, unknown> = { token: jwt };
    for (let i = 0; i < 24; i += 1) deep = { level: deep };

    expect(findCredentialShape(deep)).toBeTruthy();
    await expect(appendDomainEvent(anEvent({ payload: deep }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  /**
   * The `seen` set survived a mutation sweep — every test passed without it —
   * and the first reading of that was "it is a performance guard, the depth cap
   * is what terminates". Measuring it said otherwise.
   *
   * Dropping `seen` costs one visit per *path* through the payload instead of
   * one per node. No cycle is needed to make those diverge: a payload whose
   * levels share a child, which is the ordinary shape of anything serialised
   * from a normalised in-memory graph, goes exponential. Measured at 24 levels
   * of two-way sharing: 50 million visits, three seconds. At 40 it does not
   * finish — and it does not fail to finish quietly, because the scan runs
   * inside the caller's open transaction and holds its row locks while it does
   * not finish.
   *
   * The assertion counts visits rather than timing the scan, and that is the
   * whole point. The first version of this test asserted elapsed time under a
   * vitest timeout, and the timeout never fired: the recursion is synchronous,
   * so it never yields the event loop and no timer can interrupt it. That test
   * turned the defect into a hung CI job instead of a failing one. A getter
   * that throws on the 101st read makes the same defect terminate immediately,
   * with a message naming what went wrong.
   *
   * No credential in the payload, deliberately — a hit short-circuits, and the
   * bound has to hold for the case that walks the whole graph.
   */
  it('visits a shared node once, not once per path that reaches it', () => {
    let visits = 0;
    const shared: Record<string, unknown> = {};
    Object.defineProperty(shared, 'leaf', {
      enumerable: true,
      get() {
        visits += 1;
        if (visits > 100) {
          throw new Error(
            `findCredentialShape re-walked a shared node ${visits} times; the scan is ` +
              'counting paths, not nodes, and goes exponential on a shared-reference payload',
          );
        }
        return 'plain';
      },
    });

    let node: Record<string, unknown> = shared;
    for (let i = 0; i < 40; i += 1) node = { left: node, right: node };

    expect(findCredentialShape(node)).toBeUndefined();
    expect(visits).toBe(1);
  });

  it('uses the same patterns as the scrubber, not a second list', async () => {
    // Two pattern lists drift, and the weaker one guards the permanent store.
    const { looksLikeCredential } = await import('@pas/contracts');
    const jwt = `eyJ${'d'.repeat(40)}`;
    expect(looksLikeCredential(jwt)).toBe(true);
    expect(findCredentialShape({ any: jwt })).toBe('payload.any');
  });
});

describe('ordering is by ledger position, not by timestamp', () => {
  /**
   * In `audit_entries` an ambiguous order cost legibility. Here it costs
   * correctness: the dispatcher claims work in order and consumers replay in
   * order, so two readers disagreeing is a state divergence.
   */
  it('returns insertion order when every timestamp is identical', async () => {
    const sameInstant = now<'occurredAt'>();
    const types = ['EventOne', 'EventTwo', 'EventThree', 'EventFour', 'EventFive'];
    for (const eventType of types) {
      await appendDomainEvent(anEvent({ eventType, occurredAt: sameInstant }));
    }

    const stream = await readDomainEvents();
    expect(new Set(stream.map((s) => s.event.occurredAt))).toEqual(new Set([sameInstant]));
    expect(stream.map((s) => s.event.eventType)).toEqual(types);
  });

  it('is not reordered by an event recording an earlier moment', async () => {
    await appendDomainEvent(anEvent({ eventType: 'HappenedFirst' }));
    await appendDomainEvent(
      anEvent({ eventType: 'AboutThePast', occurredAt: '2020-01-01T00:00:00.000Z' }),
    );

    expect((await readDomainEvents()).map((s) => s.event.eventType)).toEqual([
      'HappenedFirst',
      'AboutThePast',
    ]);
  });

  it('advances strictly, so a cursor never re-reads or skips', async () => {
    // The dispatcher's read (PAS-0305).
    for (const eventType of ['EventOne', 'EventTwo', 'EventThree']) {
      await appendDomainEvent(anEvent({ eventType }));
    }

    const first = await readDomainEvents({ limit: 1 });
    const rest = await readDomainEvents({ afterSequence: first[0].sequence });

    expect(rest.map((s) => s.event.eventType)).toEqual(['EventTwo', 'EventThree']);
    expect(rest.every((s) => s.sequence > first[0].sequence)).toBe(true);
  });

  it('exposes the position as a bigint', async () => {
    // bigserial outruns Number.MAX_SAFE_INTEGER; a cursor read as a float
    // starts skipping rows at the point nobody is testing any more.
    await appendDomainEvent(anEvent());
    expect((await readDomainEvents())[0].sequence).toBeTypeOf('bigint');
  });
});

describe('reading', () => {
  it('filters by aggregate, type and correlation', async () => {
    await appendDomainEvent(anEvent({ correlationId: 'c1' }));
    await appendDomainEvent(
      anEvent({ aggregateId: 'claim-2', eventType: 'ClaimRejected', correlationId: 'c2' }),
    );

    expect(await readDomainEvents({ aggregateId: 'claim-2' })).toHaveLength(1);
    expect(await readDomainEvents({ eventType: 'ClaimRejected' })).toHaveLength(1);
    expect(await readDomainEvents({ correlationId: 'c1' })).toHaveLength(1);
    expect(await readDomainEvents({ aggregateType: 'claim' })).toHaveLength(2);
  });

  it('reads one aggregate\'s whole stream in order', async () => {
    await appendDomainEvent(anEvent({ eventType: 'EventOne' }));
    await appendDomainEvent(anEvent({ aggregateId: 'other', eventType: 'Unrelated' }));
    await appendDomainEvent(anEvent({ eventType: 'EventTwo' }));

    expect((await readAggregateStream('claim', 'claim-1')).map((s) => s.event.eventType))
      .toEqual(['EventOne', 'EventTwo']);
  });

  it('caps a read that asks for more than the maximum', async () => {
    await query(
      `insert into domain_events
         (event_id, event_type, schema_version, aggregate_type, aggregate_id,
          actor_type, payload, occurred_at, recorded_at)
       select gen_random_uuid(), 'Bulk', 1, 'probe', i::text, 'SYSTEM', '{}'::jsonb, $1, $1
         from generate_series(1, 1100) as i`,
      [now()],
    );
    expect(await readDomainEvents({ limit: 10_000 })).toHaveLength(1_000);
    expect(await readDomainEvents()).toHaveLength(100);
  });

  /**
   * The validator exists for a row this code did not write: one that predates
   * it, was written by a version with different rules, or arrived through a
   * restore. Today's constraints make every stored row valid, so the only
   * honest way to test the validator is to relax a constraint and write the
   * row a looser system would have.
   */
  it('refuses a stored row that violates the envelope contract', async () => {
    await query(`alter table domain_events drop constraint domain_events_event_type_shape`);
    try {
      await query(
        `insert into domain_events
           (event_id, event_type, schema_version, aggregate_type, aggregate_id,
            actor_type, payload, occurred_at, recorded_at)
         values (gen_random_uuid(), 'not_pascal_case', 1, 'probe', 'x', 'SYSTEM', '{}'::jsonb, $1, $1)`,
        [now()],
      );

      // A consumer that destructured this hopefully would fail somewhere
      // unrelated, with a message about a missing property.
      await expect(readDomainEvents()).rejects.toBeInstanceOf(ValidationError);
    } finally {
      // Restored by re-running the migration, NOT by adding the constraint
      // back from a copy written here.
      //
      // The first version hand-wrote it, and that silently repaired the
      // schema: a mutation sweep that loosened the constraint in the
      // migration survived, because this test put the strict one back before
      // the next test looked. A fixture that re-declares schema is a fixture
      // that hides schema defects — the catalogue-over-enumeration rule
      // (CLAUDE.md §5) applied to constraints.
      await query('drop schema public cascade');
      await query('create schema public');
      await migrate({ directory: MIGRATIONS });
    }
  });

  it('refuses a malformed event type at the database, for a writer that skips the service', async () => {
    // The envelope validates on create, so this constraint only fires for a
    // writer that bypassed it — which is exactly when it matters.
    //
    // `CLAIM` is deliberately absent: it satisfies the rule, which is
    // "starts uppercase, then alphanumeric". Tightening to reject all-caps
    // would also reject acronym-initial names like `PASPublished`, and an
    // unconventional-but-unambiguous event type is not worth that.
    for (const eventType of ['not_pascal', 'Claim.Approved', '1Claim', 'claim', 'Claim Approved']) {
      await expect(
        query(
          `insert into domain_events
             (event_id, event_type, schema_version, aggregate_type, aggregate_id,
              actor_type, payload, occurred_at, recorded_at)
           values (gen_random_uuid(), $1, 1, 'probe', 'x', 'SYSTEM', '{}'::jsonb, $2, $2)`,
          [eventType, now()],
        ),
        eventType,
      ).rejects.toThrow();
    }
  });
});

/**
 * The three constraints a mutation sweep found nothing asserting.
 *
 * All three guard the same case as the event-type shape check above: a writer
 * that reached the table without going through `appendDomainEvent`. Through the
 * service they are unreachable — the envelope already validates — which is
 * exactly why nothing was testing them, and exactly why they have to be tested
 * directly. A constraint that no test exercises is a constraint a later
 * migration can drop in silence, and these rows cannot be corrected afterwards.
 */
describe('the database refuses a bad row even when the service is bypassed', () => {
  const RAW = `insert into domain_events
      (event_id, event_type, schema_version, aggregate_type, aggregate_id,
       actor_type, actor_id, payload, occurred_at, recorded_at)
    values (gen_random_uuid(), 'ClaimApproved', 1, 'probe', 'x', $1, $2, $3, $4, $5)`;

  it('refuses a SYSTEM row carrying a user id', async () => {
    // Not a tidiness rule. During an investigation this row reads as that user
    // having done it, and the ledger is the thing the investigation trusts.
    await expect(
      query(RAW, ['SYSTEM', '00000000-0000-4000-8000-000000000001', '{}', now(), now()]),
    ).rejects.toThrow();
  });

  it('refuses an ANONYMOUS row carrying a user id', async () => {
    await expect(
      query(RAW, ['ANONYMOUS', '00000000-0000-4000-8000-000000000001', '{}', now(), now()]),
    ).rejects.toThrow();
  });

  it('refuses a USER row with no user id', async () => {
    // The other direction of the same biconditional: attribution that claims a
    // person and names nobody.
    await expect(query(RAW, ['USER', null, '{}', now(), now()])).rejects.toThrow();
  });

  it('accepts the two shapes that are actually coherent', async () => {
    // Without this the constraint could be `check (false)` and the three
    // refusals above would all still pass.
    await expect(
      query(RAW, ['USER', '00000000-0000-4000-8000-000000000001', '{}', now(), now()]),
    ).resolves.toBeDefined();
    await expect(query(RAW, ['SYSTEM', null, '{}', now(), now()])).resolves.toBeDefined();
  });

  it.each([
    ['a string', '"just a string"'],
    ['an array', '[1, 2, 3]'],
    ['a number', '42'],
    ['a bare null', 'null'],
  ])('refuses a payload that is %s rather than a record', async (_label, payload) => {
    // jsonb accepts all of these. A consumer destructuring one fails somewhere
    // unrelated, months later, with a message about a missing property.
    await expect(query(RAW, ['SYSTEM', null, payload, now(), now()])).rejects.toThrow();
  });

  it('refuses a row recorded before the thing it records happened', async () => {
    const occurred = now();
    const earlier = new Date(new Date(occurred as unknown as string).getTime() - 60_000);
    await expect(query(RAW, ['SYSTEM', null, '{}', occurred, earlier])).rejects.toThrow();
  });

  it('accepts a row recorded after the fact, which is the ordinary case', async () => {
    // `recorded_at >= occurred_at` must not become `=`: an event may record a
    // moment that had already passed when the system learned of it.
    const occurred = new Date(Date.now() - 3_600_000);
    await expect(query(RAW, ['SYSTEM', null, '{}', occurred, now()])).resolves.toBeDefined();
  });
});
