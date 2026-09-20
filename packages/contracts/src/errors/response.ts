/**
 * PAS-0003 — the wire contract.
 *
 * "Error responses require: code, message, correlationId, details when safe."
 * "Never expose stack traces or secrets through production APIs."
 *
 * `toErrorResponse` is the single place an error becomes bytes a client sees.
 * Every API surface routes through it, so the safety rules are enforced once
 * rather than remembered at each handler.
 */

import { type ErrorFamily, REDACTED_MESSAGE } from './codes.js';
import { type PasError } from './base.js';
import { toPasError } from './families.js';
import { scrubDetails } from './scrub.js';

/** The exact shape returned to a client. */
export interface ErrorResponse {
  error: {
    /** Stable machine-readable code. */
    code: string;
    /** Human-readable, safe to display. */
    message: string;
    /** The ten-way classification. */
    family: ErrorFamily;
    /** PAS-0004 correlation identity. Always present. */
    correlationId: string;
    /** Present only when the family permits and details exist. */
    details?: unknown;
  };
}

export interface SerializeOptions {
  /** PAS-0004 correlation id for this operation. Required. */
  correlationId: string;
  /**
   * When true, internal messages, details and causes are suppressed.
   * Pass `isDeployedEnvironment(config.environment)` from `@pas/config`.
   *
   * Defaults to **true** — the safe default. A caller that forgets to pass it
   * gets production behaviour, not a leak.
   */
  deployed?: boolean;
}

/**
 * Serialises any thrown value into the wire contract.
 *
 * Stack traces are never included, in any environment: a stack in a response
 * body is a stack in a browser console, a CI log and a bug report.
 */
export function toErrorResponse(value: unknown, options: SerializeOptions): ErrorResponse {
  const deployed = options.deployed ?? true;
  const error = toPasError(value);

  const exposeMessage = !deployed || messageIsClientSafe(error);
  const exposeDetails = (!deployed || error.detailsAreClientSafe) && error.details !== undefined;

  const response: ErrorResponse['error'] = {
    code: error.code,
    message: exposeMessage ? error.message : REDACTED_MESSAGE,
    family: error.family,
    correlationId: options.correlationId,
  };

  if (exposeDetails) {
    response.details = scrubDetails(error.details);
  }

  return { error: response };
}

/**
 * Whether an error's *message* may be shown to a client in a deployed
 * environment.
 *
 * Messages for families whose details are unsafe are themselves unsafe —
 * they are written by us for us, and describe internals. The families whose
 * details describe the caller's own request have messages written for that
 * caller.
 *
 * AUTHENTICATION is the exception in the other direction: its details are
 * unsafe (enumeration oracle) but its message is a fixed, deliberately
 * uninformative string.
 */
function messageIsClientSafe(error: PasError): boolean {
  if (error.family === 'AUTHENTICATION') return true;
  return error.detailsAreClientSafe;
}

/**
 * The structure safe to send to logs and the audit ledger (PAS-0301).
 *
 * Unlike the client response this retains the cause chain and the unredacted
 * message, because operators need them — but details are still scrubbed, since
 * a credential should not reach a log aggregator either. Stacks are carried
 * separately so a logger can choose to drop them.
 */
export function toErrorLogRecord(
  value: unknown,
  options: { correlationId?: string; causationId?: string } = {},
): Record<string, unknown> {
  const error = toPasError(value);
  return {
    name: error.name,
    family: error.family,
    code: error.code,
    message: error.message,
    httpStatus: error.httpStatus,
    correlationId: options.correlationId ?? error.correlationId,
    causationId: options.causationId,
    details: error.details === undefined ? undefined : scrubDetails(error.details),
    cause: error.cause === undefined ? undefined : scrubDetails(error.cause),
    stack: error.stack,
  };
}
