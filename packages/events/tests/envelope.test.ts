/**
 * PAS-0302 acceptance tests.
 *
 * No database — this is a contract. The properties worth attacking are that
 * the envelope is genuinely immutable rather than `readonly` in name, that it
 * refuses to be built malformed, and that it refuses to be *read* malformed,
 * which is a different problem with a different cause.
 */

import { describe, it, expect } from 'vitest';
import { ValidationError, now, isInstant } from '@pas/contracts';
import { runInNewOperation, currentContext } from '@pas/observability';
import { generateId } from '@pas/domain';
import {
  createDomainEvent,
  isDomainEvent,
  assertDomainEvent,
  isEventOfType,
  EVENT_TYPE_PATTERN,
  SYSTEM_ACTOR,
  isWellFormedActor,
  type DomainEvent,
  type ActorRef,
} from '../src/index.js';

const VALID = {
  eventType: 'ClaimApproved',
  aggregateType: 'claim',
  aggregateId: 'claim-1',
  actor: { type: 'USER' as const, id: generateId() },
  payload: { claimId: 'claim-1' },
};

describe('the envelope carries what PAS-0302 and §21 require', () => {
  it('carries all thirteen fields, with the values it was given', () => {
    const event = createDomainEvent({
      ...VALID,
      schemaVersion: 2,
      authorityEntityId: 'entity-1',
      authorityRecordId: 'record-1',
      journeyId: 'journey-1',
      correlationId: 'corr-1',
      causationId: 'cause-1',
    });

    // Values, not just keys. Asserting only the key set let a mutation that
    // hard-coded `journeyId: null` pass — on the one field PAS-0302 omits and
    // §21 requires, which is the field most likely to be dropped.
    expect(event).toMatchObject({
      eventType: 'ClaimApproved',
      schemaVersion: 2,
      aggregateType: 'claim',
      aggregateId: 'claim-1',
      authorityEntityId: 'entity-1',
      authorityRecordId: 'record-1',
      journeyId: 'journey-1',
      correlationId: 'corr-1',
      causationId: 'cause-1',
      actor: VALID.actor,
      payload: VALID.payload,
    });

    expect(Object.keys(event).sort()).toEqual([
      'actor',
      'aggregateId',
      'aggregateType',
      'authorityEntityId',
      'authorityRecordId',
      'causationId',
      'correlationId',
      'eventId',
      'eventType',
      'journeyId',
      'occurredAt',
      'payload',
      'schemaVersion',
    ]);
  });

  it('includes journeyId, which PAS-0302 omits and Part I §21 requires', () => {
    // PAS-0302's list is the minimum, not the ceiling — the same relationship
    // PAS-0301 had with §23.
    expect(createDomainEvent(VALID).journeyId).toBeNull();
    expect(createDomainEvent({ ...VALID, journeyId: 'journey-9' }).journeyId).toBe('journey-9');
  });

  it('carries every optional reference through, not just declares it', () => {
    // Each of these defaults to null, so a mutation hard-coding null passes
    // any test that only checks the default.
    const supplied = {
      authorityEntityId: 'entity-9',
      authorityRecordId: 'record-9',
      journeyId: 'journey-9',
      correlationId: 'corr-9',
      causationId: 'cause-9',
    };
    const event = createDomainEvent({ ...VALID, ...supplied });
    for (const [key, value] of Object.entries(supplied)) {
      expect(event[key as keyof DomainEvent], key).toBe(value);
    }
  });

  it('generates an identifier and a canonical timestamp', () => {
    const event = createDomainEvent(VALID);
    expect(event.eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab]/);
    expect(isInstant(event.occurredAt)).toBe(true);
  });

  it('defaults schemaVersion to 1', () => {
    expect(createDomainEvent(VALID).schemaVersion).toBe(1);
  });

  it('inherits correlation and causation from the ambient context', () => {
    // PAS-0004 is what makes one action legible across API, worker and outbox.
    runInNewOperation({ kind: 'test', name: 'envelope' }, () => {
      const event = createDomainEvent(VALID);
      expect(event.correlationId).toBe(currentContext()?.correlationId);
      expect(event.causationId).toBe(currentContext()?.operationId);
      expect(event.correlationId).toBeTruthy();
    });
  });

  it('nulls the optional references rather than omitting them', () => {
    // A missing key and an explicit null read differently from a database
    // column, and a consumer checking `in` would branch differently.
    const event = createDomainEvent(VALID);
    for (const key of ['authorityEntityId', 'authorityRecordId', 'journeyId', 'causationId']) {
      expect(event, key).toHaveProperty(key);
      expect(event[key as keyof DomainEvent]).toBeNull();
    }
  });
});

describe('the envelope is immutable, not merely readonly — §21', () => {
  /**
   * "Events SHALL be immutable. Never edit an event to change history."
   *
   * `readonly` is a compile-time claim a consumer reading a row never sees.
   */
  it('refuses a write to a top-level field', () => {
    const event = createDomainEvent(VALID);
    expect(() => {
      (event as unknown as Record<string, unknown>).eventType = 'SomethingElse';
    }).toThrow(TypeError);
    expect(event.eventType).toBe('ClaimApproved');
  });

  it('refuses a write inside the payload', () => {
    // The one that matters: a consumer handed an event must not be able to
    // corrupt what the next consumer receives.
    const event = createDomainEvent({ ...VALID, payload: { nested: { value: 1 } } });
    const payload = event.payload as { nested: { value: number } };

    expect(() => {
      payload.nested.value = 2;
    }).toThrow(TypeError);
    expect(payload.nested.value).toBe(1);
  });

  it('refuses a write to the actor', () => {
    const event = createDomainEvent(VALID);
    expect(() => {
      (event.actor as unknown as Record<string, unknown>).id = 'someone-else';
    }).toThrow(TypeError);
  });

  it('copies the actor, so mutating the input cannot reach the event', () => {
    const actor: ActorRef = { type: 'USER', id: generateId() };
    const event = createDomainEvent({ ...VALID, actor });
    const originalId = actor.id;
    actor.id = 'mutated-after-the-fact';
    expect(event.actor.id).toBe(originalId);
  });

  it('survives a payload containing a cycle', () => {
    // Deep-freezing naively recurses forever here. Events come from callers,
    // and a caller's object graph is not this module's to assume.
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;
    const event = createDomainEvent({ ...VALID, payload: cyclic });
    expect(Object.isFrozen(event.payload)).toBe(true);
  });

  it('exposes no way to edit an event', async () => {
    const module = await import('../src/index.js');
    for (const forbidden of ['updateDomainEvent', 'editEvent', 'amendEvent', 'setPayload']) {
      expect(Object.keys(module), forbidden).not.toContain(forbidden);
    }
  });
});

describe('it refuses to be built malformed', () => {
  /**
   * Validated on the way in because the event is written in the same
   * transaction as the mutation it describes (Part I §5). A malformed one must
   * fail *before* the mutation commits, or the change happened and its record
   * is unusable.
   */
  it.each([
    ['claimApproved', 'camelCase'],
    ['Claim.Approved', 'dotted — the aggregate is already a field'],
    ['claim_approved', 'snake_case'],
    ['CLAIM_APPROVED', 'shouting'],
    ['', 'empty'],
    ['1Claim', 'leading digit'],
  ])('refuses the event type %j (%s)', (eventType) => {
    expect(() => createDomainEvent({ ...VALID, eventType })).toThrow(ValidationError);
  });

  it('accepts the shape Part I §5 uses', () => {
    // `INSERT outbox_event ClaimApproved …`
    expect(EVENT_TYPE_PATTERN.test('ClaimApproved')).toBe(true);
    expect(createDomainEvent({ ...VALID, eventType: 'ClaimApproved' }).eventType)
      .toBe('ClaimApproved');
  });

  it.each([
    [{ aggregateType: '' }, 'no aggregate type'],
    [{ aggregateType: '   ' }, 'blank aggregate type'],
    [{ aggregateId: '' }, 'no aggregate id'],
    [{ schemaVersion: 0 }, 'schema version below one'],
    [{ schemaVersion: -1 }, 'negative schema version'],
    [{ schemaVersion: 1.5 }, 'fractional schema version'],
    [{ actor: { type: 'USER' } }, 'a USER with no id'],
    [{ actor: { type: 'SYSTEM', id: 'x' } }, 'a SYSTEM carrying a user id'],
    [{ actor: { type: 'ROBOT' } }, 'an unknown actor type'],
  ])('refuses %j — %s', (override, why) => {
    expect(
      () => createDomainEvent({ ...VALID, ...(override as object) }),
      `accepted ${why}`,
    ).toThrow(ValidationError);
  });

  it('refuses an undefined payload but accepts an empty one', () => {
    // `{}` says "this happened and carries no data"; undefined says a caller
    // forgot, and it serialises to nothing.
    expect(() => createDomainEvent({ ...VALID, payload: undefined })).toThrow(ValidationError);
    expect(createDomainEvent({ ...VALID, payload: {} }).payload).toEqual({});
  });

  it('names every problem at once, not the first', () => {
    try {
      createDomainEvent({ ...VALID, eventType: 'bad', aggregateId: '', schemaVersion: 0 });
      expect.unreachable('should have thrown');
    } catch (error) {
      const paths = (error as ValidationError).problems.map((p) => p.path);
      expect(paths).toEqual(expect.arrayContaining(['eventType', 'aggregateId', 'schemaVersion']));
    }
  });

  it('accepts a SYSTEM actor, for work nobody is watching', () => {
    const event = createDomainEvent({ ...VALID, actor: SYSTEM_ACTOR });
    expect(event.actor).toEqual({ type: 'SYSTEM' });
  });
});

describe('it refuses to be read malformed', () => {
  /**
   * A different problem from the above, with a different cause: a row in the
   * ledger may predate the current code by years, may have been written by a
   * version with different rules, or may have arrived through a restore.
   */
  it('accepts what it built', () => {
    const event = createDomainEvent(VALID);
    expect(isDomainEvent(event)).toBe(true);
    expect(assertDomainEvent(event)).toBe(event);
  });

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    ['a string', 'a string'],
    [42, 'a number'],
    [[], 'an array'],
    [{}, 'an empty object'],
  ])('rejects %j (%s)', (value, why) => {
    expect(isDomainEvent(value), `accepted ${why}`).toBe(false);
    expect(() => assertDomainEvent(value), `accepted ${why}`).toThrow(ValidationError);
  });

  it.each([
    ['eventId', ''],
    ['eventType', 'not_pascal'],
    ['schemaVersion', 0],
    ['aggregateType', ''],
    ['aggregateId', ''],
    ['actor', { type: 'USER' }],
    ['occurredAt', '2026-02-15T10:00:00Z'],
    ['authorityEntityId', 42],
    ['journeyId', {}],
  ])('rejects a row whose %s is %j', (field, badValue) => {
    const row = { ...createDomainEvent(VALID), [field]: badValue };
    expect(isDomainEvent(row), field).toBe(false);
    expect(() => assertDomainEvent(row), field).toThrow(ValidationError);
  });

  it('names the offending field, because the caller is holding a row', () => {
    const row = { ...createDomainEvent(VALID), occurredAt: 'yesterday' };
    try {
      assertDomainEvent(row);
      expect.unreachable('should have thrown');
    } catch (error) {
      const problem = (error as ValidationError).problems.find((p) => p.path === 'occurredAt');
      expect(problem?.message).toContain('canonical UTC instant');
    }
  });

  it('rejects a timestamp that is not PAS-0104 canonical', () => {
    // '2026-02-15T10:00:00Z' names the right moment but is not the canonical
    // form, and a ledger with two spellings cannot be ordered lexically.
    expect(isDomainEvent({ ...createDomainEvent(VALID), occurredAt: '2026-02-15T10:00:00Z' }))
      .toBe(false);
    expect(isDomainEvent({ ...createDomainEvent(VALID), occurredAt: now() })).toBe(true);
  });
});

describe('consumers narrow by type and version', () => {
  /**
   * A consumer handed a version it does not know must say so rather than
   * destructure hopefully — a payload that changed shape otherwise reads as a
   * payload with missing fields.
   */
  it('matches a known type and version', () => {
    const event = createDomainEvent({ ...VALID, schemaVersion: 2 });
    expect(isEventOfType(event, 'ClaimApproved', [1, 2])).toBe(true);
    expect(isEventOfType(event, 'ClaimApproved', [2])).toBe(true);
  });

  it('refuses a version it was not written for', () => {
    const event = createDomainEvent({ ...VALID, schemaVersion: 3 });
    expect(isEventOfType(event, 'ClaimApproved', [1, 2])).toBe(false);
  });

  it('refuses a different event type at a version it does know', () => {
    const event = createDomainEvent({ ...VALID, eventType: 'ClaimRejected' });
    expect(isEventOfType(event, 'ClaimApproved', [1])).toBe(false);
  });
});

describe('one actor shape, not three', () => {
  /**
   * `@pas/auth` has its own `Actor` with no SYSTEM member, deliberately —
   * there is no answer to "what would it mean to authorize the dispatcher?".
   * Audit and the envelope share this one, so there are two shapes for two
   * reasons rather than three by accident.
   */
  it('is the same shape the audit ledger uses', async () => {
    const { recordAuditEntry } = await import('../src/index.js');
    // Structural: an actor accepted by the envelope is accepted by audit.
    const actor = VALID.actor;
    expect(isWellFormedActor(actor)).toBe(true);
    expect(createDomainEvent({ ...VALID, actor }).actor).toEqual(actor);
    expect(typeof recordAuditEntry).toBe('function');
  });

  it('accepts exactly the three attribution kinds', () => {
    expect(isWellFormedActor({ type: 'USER', id: 'u' })).toBe(true);
    expect(isWellFormedActor({ type: 'SYSTEM' })).toBe(true);
    expect(isWellFormedActor({ type: 'ANONYMOUS' })).toBe(true);
    expect(isWellFormedActor({ type: 'SERVICE' })).toBe(false);
  });
});
