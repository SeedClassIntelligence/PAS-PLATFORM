/**
 * PAS-0004 — Correlation Context
 *
 * Identifiers for operations, not for domain objects.
 *
 * ── Why these are not produced by the Canonical ID Service (PAS-0103) ──────
 *
 * PAS-0103 governs the identity of governed records — an AuthorityEntity, a
 * Claim, an Evidence record. Those ids are durable, non-semantic and live in
 * the database forever.
 *
 * A correlation id identifies an *operation in flight*. It is telemetry: it
 * appears in logs, event envelopes and outbox rows so a single request can be
 * traced across the API, workers and workflows. It is not a domain object, it
 * has no lifecycle, and nothing holds a foreign key to it.
 *
 * Conflating the two would make the ID service a startup dependency of
 * logging, and PAS-0004 precedes PAS-0103 in the build order precisely because
 * correlation must work before any domain object exists.
 */

import { randomUUID } from 'node:crypto';

/**
 * Maximum accepted length of an externally-supplied identifier.
 *
 * Correlation ids are written into logs, event envelopes and database columns.
 * An unbounded inbound value is a log-flooding and storage-abuse vector.
 */
export const MAX_ID_LENGTH = 128;

/**
 * Characters permitted in an externally-supplied identifier.
 *
 * Deliberately narrow. These values are interpolated into log lines and
 * structured records, so newlines (log injection / forged log entries),
 * control characters and quoting characters must never survive. Alphanumeric
 * plus `-`, `_` and `.` covers UUIDs, ULIDs, W3C trace ids and every sane
 * upstream convention.
 */
const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/** A new correlation id, identifying a whole logical operation chain. */
export function newCorrelationId(): string {
  return randomUUID();
}

/**
 * A new operation id, identifying one step within a chain.
 *
 * When this operation causes another, the child's `causationId` is this value.
 */
export function newOperationId(): string {
  return randomUUID();
}

/** Whether a value is safe to accept as an identifier from outside PAS. */
export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID_PATTERN.test(value);
}

/**
 * Accepts an externally-supplied identifier, or mints a fresh one.
 *
 * A malformed inbound trace header is *not* an error: rejecting the request
 * would let any upstream break PAS by sending a bad header, and the caller
 * gains nothing from the failure. The value is discarded and a new id is
 * generated, so the operation is still traceable — just not linked to the
 * caller's chain.
 */
export function acceptOrMintId(value: unknown): string {
  return isValidId(value) ? value : newCorrelationId();
}
