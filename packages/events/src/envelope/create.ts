/**
 * PAS-0302 — constructing an envelope.
 */

import { generateId } from '@pas/domain';
import { now, ValidationError, type OccurredAt } from '@pas/contracts';
import { correlationFields } from '@pas/observability';
import { isWellFormedActor } from '../actor.js';
import {
  EVENT_TYPE_PATTERN,
  type DomainEvent,
  type DomainEventInput,
} from './types.js';

/**
 * Freezes the envelope and everything reachable through it.
 *
 * `readonly` is a compile-time claim that a consumer reading a row out of the
 * database never sees. §21 says events SHALL be immutable, so the object is
 * actually immutable — a consumer that mutates a payload it was handed cannot
 * corrupt what the next consumer receives.
 */
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key], seen);
  }
  return Object.freeze(value);
}

/**
 * Builds a domain event.
 *
 * Validates on the way in rather than on the way out. An event is written in
 * the same transaction as the mutation it describes (Part I §5), so a
 * malformed one must fail *before* the mutation commits — discovering it at
 * read time means the change happened and its record is unusable.
 */
export function createDomainEvent<TPayload>(
  input: DomainEventInput<TPayload>,
): DomainEvent<TPayload> {
  const problems: { path: string; message: string }[] = [];

  if (!EVENT_TYPE_PATTERN.test(input.eventType ?? '')) {
    problems.push({
      path: 'eventType',
      message: 'must be PascalCase, like ClaimApproved — the aggregate is a separate field',
    });
  }
  if (!input.aggregateType?.trim()) {
    problems.push({ path: 'aggregateType', message: 'is required' });
  }
  if (!input.aggregateId?.trim()) {
    problems.push({ path: 'aggregateId', message: 'is required' });
  }
  if (!isWellFormedActor(input.actor)) {
    problems.push({
      path: 'actor',
      message: 'must be USER with an id, or SYSTEM or ANONYMOUS without one',
    });
  }

  const schemaVersion = input.schemaVersion ?? 1;
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    problems.push({ path: 'schemaVersion', message: 'must be a positive integer' });
  }

  if (input.payload === undefined) {
    // Not the same as an empty payload. `{}` says "this happened and carries
    // no data"; undefined says a caller forgot, and it serialises to nothing.
    problems.push({ path: 'payload', message: 'is required — use {} for an event with no data' });
  }

  if (problems.length > 0) {
    throw new ValidationError('The domain event is not valid.', problems);
  }

  const ambient = correlationFields();
  const occurredAt: OccurredAt = input.occurredAt ?? now<'occurredAt'>();

  return deepFreeze({
    eventId: generateId(),
    eventType: input.eventType,
    schemaVersion,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    authorityEntityId: input.authorityEntityId ?? null,
    authorityRecordId: input.authorityRecordId ?? null,
    journeyId: input.journeyId ?? null,
    actor: { ...input.actor },
    correlationId: input.correlationId ?? ambient.correlationId ?? null,
    causationId: input.causationId ?? ambient.causationId ?? null,
    payload: input.payload,
    occurredAt,
  }) as DomainEvent<TPayload>;
}
