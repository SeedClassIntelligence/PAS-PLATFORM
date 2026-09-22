/**
 * PAS-0303 — appending to the event ledger.
 *
 * ── Why this REFUSES a credential rather than redacting one ──────────────
 *
 * PAS-0301's audit ledger scrubs `metadata` with `scrubDetails`, which redacts
 * on **key name** and on **value shape**. That is right there: audit metadata
 * is incidental context, assembled from whatever was to hand, and a redacted
 * field costs a debugging detail.
 *
 * An event payload is not incidental. It is the canonical record of what
 * happened, and consumers rebuild state from it. Applying the same treatment
 * would be wrong twice over:
 *
 *   **Key-name redaction corrupts canonical data.** A claim about someone's
 *   password policy, a field named `tokenIssuer`, a credential *class* in a
 *   verification record — all legitimate, all matched by a key-name
 *   heuristic. Redacting them does not protect anything; it silently writes a
 *   falsified record into a table that can never be corrected.
 *
 *   **Redaction is the wrong remedy for an immutable store.** Redacting says
 *   "this was written, and we altered it". For audit, whose purpose is
 *   observation, that is acceptable. For a ledger consumers replay, a
 *   silently altered payload is a state divergence discovered months later.
 *
 * So this refuses. A payload containing anything shaped like a credential —
 * a JWT, a PEM private key, an AWS key id, a bearer token, a connection string
 * with a password — throws, and because the event is written inside the
 * mutation's transaction (Part I §5), **the mutation rolls back with it**.
 * Nothing is half-recorded.
 *
 * Refusing is the honest choice precisely *because* the table is immutable:
 * what cannot be corrected afterwards must not be written. The check is
 * **value shape only**, never key name, so the false-positive rate is near
 * zero — these patterns do not match ordinary prose or identifiers — while
 * the false-negative cost is a credential living forever in a table with no
 * delete path.
 *
 * Domain events never legitimately carry credentials. If one appears, the
 * emitter is wrong, and finding that out at write time is the cheapest moment
 * it will ever be discoverable.
 */

import { query, type PoolClient } from '@pas/database';
import { now, looksLikeCredential, ValidationError } from '@pas/contracts';
import { type DomainEvent } from '../envelope/types.js';
import { createDomainEvent } from '../envelope/create.js';
import { type DomainEventInput } from '../envelope/types.js';

/**
 * A stack guard. It bounds recursion depth so a pathologically nested payload
 * cannot overflow the stack, and it is set high enough that it is not silently
 * doing the scan's job for it.
 *
 * It was 12, which was a **false negative**: a credential nested more deeply
 * than that was stored rather than refused, in a table with no delete path. A
 * mutation sweep found the `seen` set redundant at that depth, and chasing why
 * exposed the cap as the real problem.
 *
 * The cap and the `seen` set below do **different** jobs, and an earlier
 * version of this comment had them backwards. Termination on a cycle comes
 * from the cap — a cycle without branching simply walks until depth runs out.
 * What the `seen` set buys is the difference between visiting each *node* once
 * and visiting each *path* once, and those diverge exponentially on any graph
 * with shared references. See `findCredentialShape`.
 */
const MAX_SCAN_DEPTH = 64;

/**
 * Finds the path of the first credential-shaped value in a payload.
 *
 * Returns the path rather than a boolean so the error names where to look —
 * the emitter is usually assembling a payload from several sources and needs
 * to know which one.
 *
 * `seen` is not decoration. Without it the walk costs one visit per *path*
 * through the graph rather than one per node, and a payload whose levels share
 * a child — the ordinary shape of anything serialised from a normalised
 * in-memory graph, no cycle required — makes those diverge exponentially.
 * Measured: 24 levels of two-way sharing is 50 million visits and three
 * seconds, 40 levels does not finish. This scan runs inside the caller's open
 * transaction (see `appendDomainEvent`), so the cost is not a slow function —
 * it is row locks held until someone kills the connection.
 */
export function findCredentialShape(
  value: unknown,
  path = 'payload',
  depth = 0,
  seen = new WeakSet<object>(),
): string | undefined {
  if (depth > MAX_SCAN_DEPTH) return undefined;

  if (typeof value === 'string') {
    return looksLikeCredential(value) ? path : undefined;
  }

  if (value === null || typeof value !== 'object') return undefined;
  // A caller's object graph is not this module's to assume acyclic.
  if (seen.has(value)) return undefined;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findCredentialShape(item, `${path}[${index}]`, depth + 1, seen);
      if (found) return found;
    }
    return undefined;
  }

  for (const [key, item] of Object.entries(value)) {
    const found = findCredentialShape(item, `${path}.${key}`, depth + 1, seen);
    if (found) return found;
  }
  return undefined;
}

/**
 * Appends an event to the ledger.
 *
 * Takes the caller's client and opens no transaction of its own, for the same
 * reason `recordAuditEntry` does not (Part I §5): the event and the mutation
 * it describes commit together or neither does. An event recording something
 * that was rolled back is worse than no event, because consumers act on it.
 */
export async function appendDomainEvent<TPayload>(
  event: DomainEvent<TPayload>,
  client?: PoolClient,
): Promise<DomainEvent<TPayload>> {
  const offending = findCredentialShape(event.payload);
  if (offending) {
    throw new ValidationError(
      'The event payload contains a value shaped like a credential.',
      [
        {
          path: offending,
          message:
            'looks like a credential. domain_events is immutable, so this is refused rather ' +
            'than redacted — a value written here cannot be taken back out.',
        },
      ],
      { code: 'event.credential_in_payload' },
    );
  }

  await query(
    `insert into domain_events (
       event_id, event_type, schema_version,
       aggregate_type, aggregate_id,
       authority_entity_id, authority_record_id, journey_id,
       actor_type, actor_id,
       correlation_id, causation_id,
       payload, occurred_at, recorded_at
     ) values (
       $1, $2, $3,
       $4, $5,
       $6, $7, $8,
       $9, $10,
       $11, $12,
       $13, $14, $15
     )`,
    [
      event.eventId,
      event.eventType,
      event.schemaVersion,
      event.aggregateType,
      event.aggregateId,
      event.authorityEntityId,
      event.authorityRecordId,
      event.journeyId,
      event.actor.type,
      event.actor.id ?? null,
      event.correlationId,
      event.causationId,
      JSON.stringify(event.payload),
      event.occurredAt,
      now(),
    ],
    { client, operation: `event.append.${event.eventType}` },
  );

  return event;
}

/**
 * Builds and appends in one call, which is how the Part I §5 pattern reads at
 * a call site.
 *
 * The client is the **first** parameter deliberately: a call that omits it does
 * not compile, where an optional trailing argument would simply be absent.
 */
export async function emitWithin<TPayload>(
  client: PoolClient,
  input: DomainEventInput<TPayload>,
): Promise<DomainEvent<TPayload>> {
  return appendDomainEvent(createDomainEvent(input), client);
}
