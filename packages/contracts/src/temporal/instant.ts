/**
 * PAS-0104 — canonical timestamps.
 *
 * *"Store canonical timestamps in UTC."*
 *
 * ── What "canonical" has to mean to be worth anything ─────────────────────
 *
 * A timestamp is canonical when two systems reading it cannot disagree about
 * which moment it names. That rules out more than it sounds like:
 *
 *   '2015-01-01'              a date, not an instant. Which midnight? Whose?
 *   '2026-02-15T10:00:00'     no zone. Means whatever TZ the reader has set.
 *   '1 week ago'              a rendering, not a value.
 *   1739616000                seconds or milliseconds? Off by a factor of
 *                             1000 is the classic version of this bug, and
 *                             both readings are plausible dates.
 *
 * All four are rejected. The first three are in the PAS baseline today — see
 * SUP-14 — and the fourth is what an integrator reaches for next.
 *
 * ── The canonical form ────────────────────────────────────────────────────
 *
 *   YYYY-MM-DDTHH:mm:ss.sssZ        e.g. 2026-02-15T10:00:00.000Z
 *
 * Fixed width, four-digit year, milliseconds always present, always `Z`.
 *
 * Fixed width is not cosmetic. It makes lexicographic order identical to
 * chronological order, so `ORDER BY published_at` in SQL, `.sort()` in
 * JavaScript and a sorted object-store key listing all agree. A variable-width
 * form — dropping `.000`, or an expanded year — breaks that silently, and it
 * breaks it for the oldest and newest records only, which is the hardest kind
 * of ordering bug to see.
 *
 * ── Offsets are accepted, zonelessness is not ─────────────────────────────
 *
 * `2026-02-15T15:00:00+05:00` names exactly one instant, so it parses and
 * normalises to `2026-02-15T10:00:00.000Z`. Nothing is lost that PAS stores:
 * the offset the sender happened to use is a property of the sender, not of
 * the moment. A value that needs the original local zone preserved needs a
 * separate zone field, not a timestamp that is secretly a local time.
 */

import { ValidationError } from '../errors/index.js';

declare const instantBrand: unique symbol;

/**
 * A canonical UTC instant.
 *
 * `Kind` is a **compile-time** discriminator with no representation in the
 * value — the same device PAS-0103 uses for identifiers, for the same reason.
 * The seven kinds PAS-0104 names are in `kinds.ts`; the point of branding them
 * is that the compiler, not a reviewer, is what stops an `OccurredAt` being
 * assigned to a `createdAt` field.
 */
export type Instant<Kind extends string = string> = string & {
  readonly [instantBrand]: Kind;
};

/**
 * The canonical form. Four-digit year, milliseconds present, `Z`.
 *
 * Deliberately stricter than ISO-8601: ISO permits `2026-02-15T10:00Z`,
 * `20260215T100000Z`, `+002026-…` and a comma decimal separator, all naming
 * the same instant in different widths. One canonical spelling is what makes
 * lexicographic and chronological order the same thing.
 */
export const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Whether a value is already in canonical form. */
export function isInstant<Kind extends string = string>(
  value: unknown,
): value is Instant<Kind> {
  return (
    typeof value === 'string' &&
    INSTANT_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function reject(field: string, message: string): never {
  throw new ValidationError('The timestamp is not valid.', [{ path: field, message }]);
}

/**
 * Renders a `Date` in canonical form.
 *
 * `toISOString` is already UTC with milliseconds. The pattern check afterwards
 * is not paranoia: for years outside 0000–9999 it emits an expanded form
 * (`+275760-09-13T00:00:00.000Z`) that is wider than every other value and
 * would sort before or after everything. Those dates are not real PAS data;
 * they are what an overflowed arithmetic produces.
 */
export function fromDate<Kind extends string = string>(
  date: Date,
  field = 'timestamp',
): Instant<Kind> {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    reject(field, 'must be a valid Date');
  }
  const rendered = date.toISOString();
  if (!INSTANT_PATTERN.test(rendered)) {
    reject(field, 'is outside the representable range');
  }
  return rendered as Instant<Kind>;
}

/** The instant as a `Date`, for arithmetic and for drivers that want one. */
export function toDate(instant: Instant): Date {
  return new Date(instant);
}

/**
 * The current instant.
 *
 * `Kind` is inferred from the assignment, so `const createdAt: CreatedAt =
 * now();` produces a `CreatedAt` and nothing else will type-check there.
 *
 * Reads the wall clock, which can move backwards across an NTP correction.
 * Nothing in PAS may derive ordering from two separate `now()` calls; ordering
 * comes from the database, which assigns it under a transaction.
 */
export function now<Kind extends string = string>(): Instant<Kind> {
  return fromDate<Kind>(new Date());
}

/**
 * Normalises a timestamp arriving from outside PAS — a request body, an
 * imported record, a connector payload.
 *
 * Accepts a `Date`, a canonical instant, or any ISO-8601 string that names an
 * unambiguous instant (including one with an offset). Rejects everything that
 * does not name one: see the header.
 *
 * Throws rather than returning null, and does **not** echo the rejected value:
 * it is caller-supplied and reaches logs and error bodies.
 */
export function toInstant<Kind extends string = string>(
  value: unknown,
  field = 'timestamp',
): Instant<Kind> {
  if (value instanceof Date) return fromDate<Kind>(value, field);

  if (typeof value === 'number') {
    // Unambiguous only if you already know the unit, and the two plausible
    // units are both plausible dates a thousandfold apart. Send a string.
    reject(field, 'must be an ISO-8601 timestamp, not a number of seconds or milliseconds');
  }

  if (typeof value !== 'string') {
    reject(field, 'must be an ISO-8601 timestamp in UTC');
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    reject(field, 'must not be empty');
  }

  // A zone designator is what separates an instant from a local reading.
  // `Date.parse` would happily accept '2015-01-01' and '2026-02-15T10:00:00',
  // interpreting the first as UTC midnight and the second in the *server's*
  // zone — so the same code gives different answers on different machines.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    reject(
      field,
      'must carry a UTC designator or an offset — a timestamp without one names a ' +
        'different moment on every machine that reads it',
    );
  }

  // Requiring a time-of-day rejects '2015-01-01Z' and its relatives, which are
  // a date wearing a zone rather than an instant anyone measured.
  if (!/\d{2}:\d{2}/.test(trimmed)) {
    reject(field, 'must include a time of day, not only a date');
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    reject(field, 'must be an ISO-8601 timestamp in UTC');
  }

  return fromDate<Kind>(new Date(parsed), field);
}

/**
 * Asserts that a value produced *inside* PAS is canonical.
 *
 * Distinct from `toInstant` for the reason `assertId` is distinct from
 * `parseId` (PAS-0103): this normalises nothing, because a value that needed
 * normalising did not come from where the caller thought it did.
 */
export function assertInstant<Kind extends string = string>(
  value: unknown,
  what = 'timestamp',
): Instant<Kind> {
  if (!isInstant<Kind>(value)) {
    throw new ValidationError(`Expected a canonical ${what}.`, [
      { path: what, message: 'is not a canonical UTC instant' },
    ]);
  }
  return value;
}

/**
 * Chronological comparison, usable as a sort comparator.
 *
 * Canonical instants are fixed-width, so this is exactly string comparison.
 * It exists so that intent is readable at call sites and so the property is
 * asserted in one place rather than assumed at each.
 */
export function compareInstants(a: Instant, b: Instant): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function earliest<T extends Instant>(...instants: T[]): T | undefined {
  return instants.reduce<T | undefined>((min, i) => (min === undefined || i < min ? i : min), undefined);
}

export function latest<T extends Instant>(...instants: T[]): T | undefined {
  return instants.reduce<T | undefined>((max, i) => (max === undefined || i > max ? i : max), undefined);
}
