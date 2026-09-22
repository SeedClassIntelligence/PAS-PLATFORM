/**
 * PAS-0303 — reading the event ledger.
 *
 * Every read is ordered by `sequence`, never by `occurred_at`. PAS-0301 found
 * that millisecond timestamps and random identifiers leave same-millisecond
 * rows unordered; here that would not merely be illegible, it would mean two
 * consumers replaying the same aggregate arrive at different states.
 */

import { query, type PoolClient } from '@pas/database';
import { fromDate, type OccurredAt } from '@pas/contracts';
import { assertDomainEvent } from '../envelope/validate.js';
import { type DomainEvent } from '../envelope/types.js';

export interface EventQuery {
  aggregateType?: string;
  aggregateId?: string;
  eventType?: string;
  correlationId?: string;
  /** Exclusive: rows strictly after this sequence. The dispatcher's cursor. */
  afterSequence?: bigint | number;
  limit?: number;
}

interface Row {
  sequence: string;
  event_id: string;
  event_type: string;
  schema_version: number;
  aggregate_type: string;
  aggregate_id: string;
  authority_entity_id: string | null;
  authority_record_id: string | null;
  journey_id: string | null;
  actor_type: 'USER' | 'SYSTEM' | 'ANONYMOUS';
  actor_id: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

/** An event with the ledger position it was read from. */
export interface StoredDomainEvent<TPayload = unknown> {
  event: DomainEvent<TPayload>;
  /** `bigint`, not `number`: bigserial outruns Number.MAX_SAFE_INTEGER. */
  sequence: bigint;
}

const MAX_LIMIT = 1_000;

function toStored(row: Row): StoredDomainEvent {
  const event = {
    eventId: row.event_id,
    eventType: row.event_type,
    schemaVersion: row.schema_version,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    authorityEntityId: row.authority_entity_id,
    authorityRecordId: row.authority_record_id,
    journeyId: row.journey_id,
    actor: {
      type: row.actor_type,
      ...(row.actor_id === null ? {} : { id: row.actor_id }),
    },
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    payload: row.payload,
    occurredAt: fromDate<'occurredAt'>(row.occurred_at) as OccurredAt,
  };

  // Validated on the way out. A row may predate this code, may have been
  // written by a version with different rules, or may have arrived through a
  // restore — and a consumer that destructured it hopefully would fail
  // somewhere unrelated. See envelope/validate.ts.
  return { event: assertDomainEvent(event), sequence: BigInt(row.sequence) };
}

/** Oldest first, by ledger position. */
export async function readDomainEvents(
  filter: EventQuery = {},
  client?: PoolClient,
): Promise<StoredDomainEvent[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const add = (sql: string, value: unknown): void => {
    values.push(value);
    conditions.push(sql.replace('$?', `$${values.length}`));
  };

  if (filter.aggregateType) add('aggregate_type = $?', filter.aggregateType);
  if (filter.aggregateId) add('aggregate_id = $?', filter.aggregateId);
  if (filter.eventType) add('event_type = $?', filter.eventType);
  if (filter.correlationId) add('correlation_id = $?', filter.correlationId);
  if (filter.afterSequence !== undefined) {
    add('sequence > $?', filter.afterSequence.toString());
  }

  values.push(Math.min(filter.limit ?? 100, MAX_LIMIT));

  const { rows } = await query<Row>(
    `select * from domain_events
      ${conditions.length > 0 ? `where ${conditions.join(' and ')}` : ''}
      order by sequence asc
      limit $${values.length}`,
    values,
    { client, operation: 'event.read' },
  );

  return rows.map(toStored);
}

/**
 * Every event for one aggregate, oldest first.
 *
 * The read a consumer performs to rebuild state, which is why it is a named
 * operation rather than a filter someone assembles correctly each time.
 */
export async function readAggregateStream(
  aggregateType: string,
  aggregateId: string,
  client?: PoolClient,
): Promise<StoredDomainEvent[]> {
  return readDomainEvents({ aggregateType, aggregateId, limit: MAX_LIMIT }, client);
}
