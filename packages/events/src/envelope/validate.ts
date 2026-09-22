/**
 * PAS-0302 — validating an envelope read back from storage.
 *
 * `createDomainEvent` validates on the way in. This validates on the way out,
 * and the two are not redundant: a row in `domain_events` may predate the
 * current code by years, may have been written by a version with different
 * rules, or may have arrived through a restore. A consumer that assumed the
 * shape and destructured it would fail somewhere unrelated, with a message
 * about a missing property rather than a malformed event.
 */

import { ValidationError, isInstant, type OccurredAt } from '@pas/contracts';
import { isWellFormedActor } from '../actor.js';
import { EVENT_TYPE_PATTERN, type DomainEvent } from './types.js';

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** Whether a value is a well-formed envelope. Never throws. */
export function isDomainEvent(value: unknown): value is DomainEvent {
  if (value === null || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;

  return (
    typeof e.eventId === 'string' &&
    e.eventId.length > 0 &&
    typeof e.eventType === 'string' &&
    EVENT_TYPE_PATTERN.test(e.eventType) &&
    Number.isInteger(e.schemaVersion) &&
    (e.schemaVersion as number) >= 1 &&
    typeof e.aggregateType === 'string' &&
    e.aggregateType.length > 0 &&
    typeof e.aggregateId === 'string' &&
    e.aggregateId.length > 0 &&
    nullableString(e.authorityEntityId) &&
    nullableString(e.authorityRecordId) &&
    nullableString(e.journeyId) &&
    isWellFormedActor(e.actor) &&
    nullableString(e.correlationId) &&
    nullableString(e.causationId) &&
    e.payload !== undefined &&
    isInstant(e.occurredAt)
  );
}

/**
 * Asserts an envelope, naming what is wrong.
 *
 * `isDomainEvent` answers yes or no; this says which field, because the caller
 * is usually a dispatcher holding a row it cannot process and the useful
 * output is which column to look at.
 */
export function assertDomainEvent(value: unknown): DomainEvent {
  const problems: { path: string; message: string }[] = [];

  if (value === null || typeof value !== 'object') {
    throw new ValidationError('The domain event is not valid.', [
      { path: 'event', message: 'must be an object' },
    ]);
  }

  const e = value as Record<string, unknown>;
  const require = (path: string, ok: boolean, message: string): void => {
    if (!ok) problems.push({ path, message });
  };

  require('eventId', typeof e.eventId === 'string' && e.eventId.length > 0, 'is required');
  require(
    'eventType',
    typeof e.eventType === 'string' && EVENT_TYPE_PATTERN.test(e.eventType),
    'must be PascalCase, like ClaimApproved',
  );
  require(
    'schemaVersion',
    Number.isInteger(e.schemaVersion) && (e.schemaVersion as number) >= 1,
    'must be a positive integer',
  );
  require('aggregateType', typeof e.aggregateType === 'string' && e.aggregateType.length > 0, 'is required');
  require('aggregateId', typeof e.aggregateId === 'string' && e.aggregateId.length > 0, 'is required');
  require('authorityEntityId', nullableString(e.authorityEntityId), 'must be a string or null');
  require('authorityRecordId', nullableString(e.authorityRecordId), 'must be a string or null');
  require('journeyId', nullableString(e.journeyId), 'must be a string or null');
  require('actor', isWellFormedActor(e.actor), 'must be USER with an id, or SYSTEM or ANONYMOUS without one');
  require('correlationId', nullableString(e.correlationId), 'must be a string or null');
  require('causationId', nullableString(e.causationId), 'must be a string or null');
  require('payload', e.payload !== undefined, 'is required — use {} for an event with no data');
  require('occurredAt', isInstant(e.occurredAt), 'must be a canonical UTC instant');

  if (problems.length > 0) {
    throw new ValidationError('The domain event is not valid.', problems);
  }

  return value as DomainEvent;
}

/**
 * Narrows an envelope to a known type and schema version.
 *
 * Consumers are registered per event type (PAS-0305) and each understands the
 * versions it was written for. A consumer handed a version it does not know
 * must say so rather than destructure hopefully — a payload that changed
 * shape will otherwise read as a payload with missing fields.
 */
export function isEventOfType<TPayload>(
  event: DomainEvent,
  eventType: string,
  schemaVersions: readonly number[],
): event is DomainEvent<TPayload> {
  return event.eventType === eventType && schemaVersions.includes(event.schemaVersion);
}

export type { OccurredAt };
