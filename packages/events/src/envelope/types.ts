/**
 * PAS-0302 — the shared domain event contract.
 *
 * PAS-0302 requires twelve fields. **Part I §21 adds `journey_id`, nullable**,
 * and is binding — so the envelope carries thirteen. PAS-0302's list is the
 * minimum, the same relationship PAS-0301 had with §23.
 *
 * ── Immutable, and §21 means it ──────────────────────────────────────────
 *
 * > Events SHALL be immutable. Never edit an event to change history.
 * > Corrective events may supersede previous information.
 *
 * An event is a statement that something happened. Editing one does not
 * correct the past, it destroys the only record of it — and the systems that
 * already consumed the original keep the version nobody can now see.
 *
 * So: every field is `readonly`, `createDomainEvent` deep-freezes what it
 * returns, and there is **no update function anywhere in this module**. A
 * correction is a new event. There is deliberately no `supersedes` field —
 * §21 states the semantics and does not name a mechanism, and inventing one
 * here would be implementation deciding architecture (§LXI).
 */

import { type OccurredAt } from '@pas/contracts';
import { type ActorRef } from '../actor.js';

/**
 * `ClaimApproved`. PascalCase, matching Part I §5's worked example
 * (`INSERT outbox_event ClaimApproved`).
 *
 * Deliberately **not** `Claim.Approved` or `claim.approved`: the aggregate is
 * already its own field, so prefixing duplicates it, and two places to read
 * the aggregate from is two places for them to disagree.
 */
export const EVENT_TYPE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export interface DomainEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly eventType: string;

  /**
   * The payload shape this event was written with.
   *
   * On the envelope, not in a registry, because an event outlives the code
   * that wrote it: a consumer reading a five-year-old row needs to know which
   * shape it is holding, and a registry only ever describes *today's*.
   *
   * Increment on a breaking payload change. Additive fields do not need one —
   * consumers that ignore unknown keys keep working, and consumers must
   * ignore unknown keys.
   */
  readonly schemaVersion: number;

  readonly aggregateType: string;
  readonly aggregateId: string;

  /** Null where the event is not about a subject of authority. */
  readonly authorityEntityId: string | null;
  readonly authorityRecordId: string | null;
  /** Part I §21, nullable: "journey_id nullable". */
  readonly journeyId: string | null;

  readonly actor: ActorRef;

  /** PAS-0004. What makes one action legible across API, worker and outbox. */
  readonly correlationId: string | null;
  /** The operation that caused this one. Null for an originating event. */
  readonly causationId: string | null;

  readonly payload: TPayload;

  /**
   * PAS-0104's `OccurredAt` — when the thing happened, not when the row was
   * written. For a domain event those usually coincide; when they do not, the
   * event is the authority on *when*, and the ledger's own ordering
   * (PAS-0303) is the authority on *sequence*.
   */
  readonly occurredAt: OccurredAt;
}

/** A `DomainEvent` before the envelope fields the system supplies. */
export interface DomainEventInput<TPayload = unknown> {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  actor: ActorRef;

  /** Defaults to 1. */
  schemaVersion?: number;

  authorityEntityId?: string | null;
  authorityRecordId?: string | null;
  journeyId?: string | null;

  /** Default to the ambient correlation context (PAS-0004). */
  correlationId?: string | null;
  causationId?: string | null;

  /** Defaults to now. Supplied when recording a moment that already passed. */
  occurredAt?: OccurredAt;
}
