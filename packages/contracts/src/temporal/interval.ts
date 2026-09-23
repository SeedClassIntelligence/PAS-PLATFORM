/**
 * PAS-0104 — validity intervals.
 *
 * `validFrom` and `validTo` are named as a pair, and a pair of instants is an
 * interval whose openness has to be decided once. Left to each consumer, half
 * will treat `validTo` as inclusive and half as exclusive, and the disagreement
 * shows up as a role that is briefly held twice, or briefly not at all.
 *
 * ── Half-open: `[validFrom, validTo)` ─────────────────────────────────────
 *
 * The start is included, the end is not. Consecutive intervals then abut
 * exactly — one ends at the instant the next begins — with no gap and no
 * overlap, and `validTo` of the old row is literally `validFrom` of the new
 * one rather than "one millisecond before, whatever a millisecond is here".
 *
 * The inclusive alternative requires every writer to subtract some smallest
 * unit, and the smallest unit differs between JavaScript (milliseconds),
 * PostgreSQL (microseconds) and whatever a connector sends. That subtraction
 * is where the gaps come from.
 *
 * PostgreSQL's `tstzrange` defaults to `[)` for the same reason, so a range
 * column and this convention agree without translation.
 */

import { type ValidFrom, type ValidTo } from './kinds.js';
import { type Instant, compareInstants } from './instant.js';

/*
 * Comparisons here go through `compareInstants` rather than `<`.
 *
 * The kinds are branded, so TypeScript refuses `validFrom < validTo` outright
 * — which is the brand doing its job, since most cross-kind comparisons are
 * the bug. The ones that are meant, like this pair, say so by name.
 */

/** An interval over which an assertion holds. `validTo: null` is open-ended. */
export interface ValidityInterval {
  validFrom: ValidFrom;
  validTo: ValidTo | null;
}

/**
 * Whether the assertion holds at `at`.
 *
 * `validFrom <= at < validTo`.
 */
export function isValidAt(interval: ValidityInterval, at: Instant): boolean {
  if (compareInstants(at, interval.validFrom) < 0) return false;
  return interval.validTo === null || compareInstants(at, interval.validTo) < 0;
}

/**
 * Whether an interval is well-formed.
 *
 * An empty interval — `validTo` equal to or before `validFrom` — holds at no
 * instant at all. It is never what a writer meant, so it is worth catching at
 * the boundary rather than discovering as a row that silently matches nothing.
 */
export function isWellFormed(interval: ValidityInterval): boolean {
  return (
    interval.validTo === null ||
    compareInstants(interval.validFrom, interval.validTo) < 0
  );
}
