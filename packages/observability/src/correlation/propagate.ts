/**
 * PAS-0004 — crossing a process boundary.
 *
 * In-process, `AsyncLocalStorage` carries the context. Between processes it
 * must be serialised explicitly. This module covers the HTTP hop; events and
 * the outbox carry the same identity as envelope fields (PAS-0302), and
 * workers restore it from the row they claim (`contextFromRecord`).
 */

import { type CorrelationContext, startOperation, correlationFields } from './context.js';

/**
 * Header names. `x-correlation-id` and `x-causation-id` are PAS's own.
 *
 * `traceparent` (W3C Trace Context) is *read* as a fallback so a chain begun
 * by an upstream that speaks the standard is not broken, but PAS does not
 * claim to implement distributed tracing here — PAS-3606 owns that. Reading
 * one header is cheap; pretending to be a tracing system is not.
 */
export const CORRELATION_HEADER = 'x-correlation-id';
export const CAUSATION_HEADER = 'x-causation-id';
export const TRACEPARENT_HEADER = 'traceparent';

type HeaderSource =
  | Record<string, string | string[] | undefined>
  | { get(name: string): string | null };

function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (typeof (headers as { get?: unknown }).get === 'function') {
    return (headers as { get(n: string): string | null }).get(name) ?? undefined;
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/** Extracts the W3C `traceparent` trace-id: version-traceid-spanid-flags. */
function traceIdFromTraceparent(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parts = value.split('-');
  return parts.length >= 3 && /^[0-9a-f]{32}$/i.test(parts[1]) ? parts[1] : undefined;
}

/**
 * Builds a root context from inbound headers.
 *
 * Every value is validated before use (see `acceptOrMintId`): these are
 * attacker-controlled strings that end up in log lines and database columns.
 */
export function contextFromHeaders(
  headers: HeaderSource,
  options: { kind?: string; name?: string } = {},
): CorrelationContext {
  const inbound =
    readHeader(headers, CORRELATION_HEADER) ??
    traceIdFromTraceparent(readHeader(headers, TRACEPARENT_HEADER));

  return startOperation({
    correlationId: inbound,
    causationId: readHeader(headers, CAUSATION_HEADER),
    kind: options.kind ?? 'http',
    ...(options.name ? { name: options.name } : {}),
  });
}

/**
 * Headers to send on an outbound call, continuing the current chain.
 *
 * `x-causation-id` carries the *current operation's* id, so the callee records
 * this operation as its cause.
 */
export function correlationHeaders(): Record<string, string> {
  const { correlationId, causationId } = correlationFields();
  const headers: Record<string, string> = {};
  if (correlationId) headers[CORRELATION_HEADER] = correlationId;
  if (causationId) headers[CAUSATION_HEADER] = causationId;
  return headers;
}

/**
 * Headers to return on a response.
 *
 * Echoing the correlation id lets a caller quote it in a bug report, and is
 * the same value PAS-0003 puts in an error body.
 */
export function responseCorrelationHeaders(context: CorrelationContext): Record<string, string> {
  return { [CORRELATION_HEADER]: context.correlationId };
}
