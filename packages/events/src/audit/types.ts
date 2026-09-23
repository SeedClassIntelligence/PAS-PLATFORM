/**
 * PAS-0301 — what an audit entry is.
 *
 * The field set is the union of PAS-0301's required list and Part I §23's,
 * which adds before/after reference, authorization result, governance decision
 * and origin. PAS-0301's list is the minimum, not the ceiling.
 */

import { type Instant } from '@pas/contracts';
import { type ActorRef, type ActorType } from '../actor.js';

/**
 * The one actor shape in this package.
 *
 * Aliased rather than redeclared: PAS-0302's event envelope needs the same
 * concept, and a second declaration would be two shapes drifting apart — the
 * SUP-9 failure, where two JSON-LD generators meant guarding one fixed
 * nothing. See `../actor.ts` for why this is not `@pas/auth`'s `Actor`.
 */
export type AuditActorType = ActorType;

/**
 * ADR-004: "origin affects provenance and policy, never *whether governance
 * exists*."
 *
 * Recorded so that a later question — was this asserted by a person, or
 * proposed by an extractor — is answerable from the record rather than
 * inferred from surrounding circumstances.
 */
export type AuditOrigin =
  | 'AI'
  | 'DOCUMENT'
  | 'WEB'
  | 'CONNECTOR'
  | 'MANUAL_ENTRY'
  | 'GAP_INTERVIEW'
  | 'ADMIN'
  | 'SYSTEM';

export type AuditActor = ActorRef;

export interface AuditEntryInput {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId: string;
  origin: AuditOrigin;

  authorityEntityId?: string;

  /**
   * A **reference** to the prior and resulting states — a version id, a
   * snapshot id — never the values themselves.
   *
   * Copying values into the audit log duplicates whatever made them sensitive
   * into the one table that is never deleted.
   */
  beforeRef?: string;
  afterRef?: string;

  /** PAS-0204's decision, for the action this entry records. */
  authorizationResult?: 'ALLOW' | 'DENY';
  /** Internal, exactly as in PAS-0204. Never leaves the server. */
  authorizationReason?: string;

  governanceDecision?: string;

  /**
   * Scrubbed before it is written. Not a place to put a request body — see
   * `record.ts`.
   */
  metadata?: Record<string, unknown>;

  /** Defaults to the ambient correlation id (PAS-0004). */
  correlationId?: string;
  /** Defaults to now. Supplied only when replaying a known moment. */
  occurredAt?: Instant;
}

export interface AuditEntry extends Omit<AuditEntryInput, 'metadata' | 'occurredAt'> {
  id: string;
  occurredAt: Instant;
  metadata: Record<string, unknown>;
}
