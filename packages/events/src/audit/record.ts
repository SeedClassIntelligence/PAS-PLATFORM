/**
 * PAS-0301 — writing an audit entry.
 *
 * ── The transaction is the caller's, and that is the point ───────────────
 *
 * `recordAuditEntry` takes an optional client and does **not** open a
 * transaction of its own. Part I §5 requires the mutation and its audit entry
 * to commit together:
 *
 *   BEGIN
 *     UPDATE claim …
 *     INSERT audit_entry …
 *     INSERT outbox_event …
 *   COMMIT
 *
 * A writer that managed its own transaction would commit the audit entry
 * whether or not the mutation survived — producing a record of something that
 * never happened, which is worse than no record, because it is believed.
 *
 * `auditWithin` exists so the common case reads that way at the call site.
 *
 * ── Redaction ────────────────────────────────────────────────────────────
 *
 * *"Sensitive values must be redacted appropriately."*
 *
 * Metadata is assembled at a call site from whatever context was to hand,
 * which is exactly how a token or a connection string ends up in it. It is
 * scrubbed with PAS-0003's `scrubDetails` — the same pass that guards error
 * responses — rather than a second redactor written here, because two
 * redactors drift and the weaker one is the one that leaks.
 *
 * Audit is the table that is never deleted, so a leak into it is permanent.
 */

import { query, type PoolClient } from '@pas/database';
import { generateId } from '@pas/domain';
import { now, scrubDetails, ValidationError, type Instant } from '@pas/contracts';
import { correlationFields } from '@pas/observability';
import { type AuditEntryInput, type AuditActor } from './types.js';

function assertActor(actor: AuditActor): void {
  const problems: { path: string; message: string }[] = [];

  if (actor.type === 'USER' && !actor.id) {
    problems.push({ path: 'actor.id', message: 'is required when the actor is a USER' });
  }
  if (actor.type !== 'USER' && actor.id) {
    // Not pedantry: a SYSTEM row carrying a user id reads, during an
    // investigation, as that user having done it.
    problems.push({
      path: 'actor.id',
      message: `must not be set when the actor is ${actor.type}`,
    });
  }

  if (problems.length > 0) {
    throw new ValidationError('The audit actor is not valid.', problems);
  }
}

/**
 * Scrubs metadata to a plain object.
 *
 * `scrubDetails` may return a non-object for a non-object input; the column
 * requires an object, so anything else is wrapped rather than dropped —
 * losing audit detail silently is the one outcome worse than keeping it.
 */
function safeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (metadata === undefined) return {};
  const scrubbed = scrubDetails(metadata);
  if (scrubbed !== null && typeof scrubbed === 'object' && !Array.isArray(scrubbed)) {
    return scrubbed as Record<string, unknown>;
  }
  return { value: scrubbed };
}

/**
 * Appends an audit entry.
 *
 * Pass the transaction's client. Without one this commits on its own, which
 * is correct only for something that has already happened irrevocably — a
 * login, a dispatch attempt — and wrong for anything that is part of a
 * mutation still in flight.
 */
export async function recordAuditEntry(
  entry: AuditEntryInput,
  client?: PoolClient,
): Promise<string> {
  assertActor(entry.actor);

  const id = generateId();
  const occurredAt: Instant = entry.occurredAt ?? now();
  const correlationId = entry.correlationId ?? correlationFields().correlationId ?? null;

  await query(
    `insert into audit_entries (
       id, occurred_at, actor_type, actor_id, action, target_type, target_id,
       authority_entity_id, before_ref, after_ref,
       authorization_result, authorization_reason, governance_decision,
       origin, correlation_id, metadata
     ) values (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10,
       $11, $12, $13,
       $14, $15, $16
     )`,
    [
      id,
      occurredAt,
      entry.actor.type,
      entry.actor.id ?? null,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.authorityEntityId ?? null,
      entry.beforeRef ?? null,
      entry.afterRef ?? null,
      entry.authorizationResult ?? null,
      entry.authorizationReason ?? null,
      entry.governanceDecision ?? null,
      entry.origin,
      correlationId,
      JSON.stringify(safeMetadata(entry.metadata)),
    ],
    { client, operation: `audit.${entry.action}` },
  );

  return id;
}

/**
 * The Part I §5 shape, so a caller cannot accidentally write the audit entry
 * outside the transaction that made the change.
 *
 * ```ts
 * await auditWithin(tx, { actor, action: 'claim.approve', … });
 * ```
 *
 * The client is the first parameter deliberately: a call missing it does not
 * compile, where an optional trailing argument would simply be absent.
 */
export async function auditWithin(
  client: PoolClient,
  entry: AuditEntryInput,
): Promise<string> {
  return recordAuditEntry(entry, client);
}
