/**
 * PAS-0004 — Correlation Context
 *
 * "Every request, workflow, worker operation, event and agent task receives
 *  correlationId. Where one operation causes another, also support causationId.
 *  This identity follows the operation across API, database, workflow, events
 *  and workers."
 *
 * ── The three-field model ─────────────────────────────────────────────────
 *
 *   correlationId  stable across the entire chain. Every log line, event and
 *                  query belonging to one logical operation carries the same
 *                  value. This is what you search by.
 *
 *   operationId    identifies THIS step. Unique per operation.
 *
 *   causationId    the operationId of the step that caused this one.
 *
 * Two fields would be insufficient. With only correlationId and causationId
 * there is nothing for a child to point *at*: causation would have to name the
 * correlation, which is the whole chain, and the causal graph would flatten
 * into a set. `operationId` is what makes `A → B → C` distinguishable from
 * `A → B, A → C`, which matters as soon as an ingestion workflow fans out
 * across parsers and the question becomes which step produced a bad claim.
 *
 * ── How it "follows the operation" ────────────────────────────────────────
 *
 * `AsyncLocalStorage` propagates across every `await`, timer and callback in a
 * Node async context without being threaded through signatures. The
 * alternative — an explicit context parameter on every function — is what the
 * error contract already rejected for `correlationId` (PAS-0003): a contract
 * expensive enough to thread gets routed around, and the field silently stops
 * being populated.
 *
 * Crossing a process boundary is explicit, because it must be: HTTP via
 * headers (`propagate.ts`), events and the outbox via envelope fields
 * (PAS-0302), workers by restoring context from the row they claim (PAS-0305).
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { InternalError } from '@pas/contracts';
import { newCorrelationId, newOperationId, acceptOrMintId, isValidId } from './ids.js';

export interface CorrelationContext {
  /** Stable across the whole operation chain. */
  readonly correlationId: string;
  /** Identifies this operation. Becomes a child's `causationId`. */
  readonly operationId: string;
  /** The operation that caused this one. Absent at the root of a chain. */
  readonly causationId?: string;
  /**
   * What kind of operation this is — `http`, `workflow`, `worker`, `event`,
   * `agent-task`. Carried into logs so a trace reads as a sequence of steps.
   */
  readonly kind?: string;
  /** Human-readable operation name, e.g. `POST /api/v1/claims`. */
  readonly name?: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/** The current context, or `undefined` outside any correlated operation. */
export function currentContext(): CorrelationContext | undefined {
  return storage.getStore();
}

/** The current correlation id, or `undefined` outside a correlated operation. */
export function currentCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * The current correlation id, throwing if there is none.
 *
 * For boundaries that must not emit uncorrelated output — serialising an error
 * response (PAS-0003 requires `correlationId`), writing an event envelope
 * (PAS-0302), appending to the audit ledger (PAS-0301). Failing loudly here is
 * better than writing an unattributable record.
 */
export function requireCorrelationId(): string {
  const context = storage.getStore();
  if (!context) {
    throw new InternalError(
      'No correlation context is active. This operation must run inside runWithContext() ' +
        'or startOperation().',
      { code: 'correlation.missing_context' },
    );
  }
  return context.correlationId;
}

export interface StartOperationOptions {
  /** Inbound correlation id. Validated; a malformed value is replaced. */
  correlationId?: unknown;
  /** The causing operation's id. Validated; a malformed value is dropped. */
  causationId?: unknown;
  kind?: string;
  name?: string;
}

/**
 * Builds a root context for a new operation chain.
 *
 * Accepts an inbound correlation id so a chain begun upstream continues here,
 * and drops anything malformed rather than trusting it (see `acceptOrMintId`).
 */
export function startOperation(options: StartOperationOptions = {}): CorrelationContext {
  return {
    correlationId: acceptOrMintId(options.correlationId),
    operationId: newOperationId(),
    ...(isValidId(options.causationId) ? { causationId: options.causationId } : {}),
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.name ? { name: options.name } : {}),
  };
}

/**
 * Derives a child context: same chain, new step, caused by the current one.
 *
 * Used whenever one operation causes another — an API request enqueuing an
 * outbox event, a workflow starting a step, a worker dispatching to a handler.
 */
export function deriveChildContext(
  parent: CorrelationContext,
  options: { kind?: string; name?: string } = {},
): CorrelationContext {
  return {
    correlationId: parent.correlationId,
    operationId: newOperationId(),
    causationId: parent.operationId,
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.name ? { name: options.name } : {}),
  };
}

/** Runs `fn` with `context` active. The context propagates across awaits. */
export function runWithContext<T>(context: CorrelationContext, fn: () => T): T {
  return storage.run(context, fn);
}

/**
 * Runs `fn` in a new operation chain.
 *
 * The entry point for an API request, a scheduled job, or any operation with
 * no caller inside PAS.
 */
export function runInNewOperation<T>(
  options: StartOperationOptions,
  fn: (context: CorrelationContext) => T,
): T {
  const context = startOperation(options);
  return storage.run(context, () => fn(context));
}

/**
 * Runs `fn` as a child of the current operation.
 *
 * Outside a correlated operation this starts a new chain rather than throwing:
 * a background task that lost its context should still be traceable, and an
 * exception here would turn a telemetry gap into an outage.
 */
export function runInChildOperation<T>(
  options: { kind?: string; name?: string },
  fn: (context: CorrelationContext) => T,
): T {
  const parent = storage.getStore();
  const context = parent ? deriveChildContext(parent, options) : startOperation(options);
  return storage.run(context, () => fn(context));
}

/**
 * The fields to stamp onto an event envelope (PAS-0302), an outbox row
 * (PAS-0304) or an audit entry (PAS-0301).
 *
 * `causationId` is the **current operation's id**, not the current context's
 * `causationId`: the event is caused by the operation emitting it, not by that
 * operation's own parent. Getting this backwards produces a causal graph that
 * looks plausible and is wrong.
 */
export function correlationFields(): { correlationId?: string; causationId?: string } {
  const context = storage.getStore();
  if (!context) return {};
  return { correlationId: context.correlationId, causationId: context.operationId };
}

/**
 * Restores context from a persisted record — an outbox row, an event, a
 * workflow step (PAS-0305).
 *
 * The consumed record's `causationId` becomes this operation's `causationId`,
 * so the chain reconnects across the process boundary.
 */
export function contextFromRecord(
  record: { correlationId?: unknown; causationId?: unknown },
  options: { kind?: string; name?: string } = {},
): CorrelationContext {
  return {
    correlationId: acceptOrMintId(record.correlationId),
    operationId: newOperationId(),
    ...(isValidId(record.causationId) ? { causationId: record.causationId } : {}),
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.name ? { name: options.name } : {}),
  };
}

/** Test-only: a fresh root context without running anything. */
export function createRootContext(kind?: string): CorrelationContext {
  return {
    correlationId: newCorrelationId(),
    operationId: newOperationId(),
    ...(kind ? { kind } : {}),
  };
}
