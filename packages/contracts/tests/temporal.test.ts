/**
 * PAS-0104 acceptance tests.
 *
 * The ticket's real content is three prohibitions — a timestamp must not be
 * ambiguous about which moment it names, the seven semantics must not
 * interchange, and `createdAt` must not carry real-world occurrence — so these
 * tests are mostly attempts to commit each of them.
 *
 * The compile-time ones are asserted with `@ts-expect-error`, which fails the
 * typecheck if the assignment ever starts being allowed. A runtime test cannot
 * see them at all: the values are identical strings.
 */

import { describe, it, expect } from 'vitest';
import {
  type Instant,
  type CreatedAt,
  type UpdatedAt,
  type OccurredAt,
  type ObservedAt,
  type PublishedAt,
  type ValidFrom,
  type ValidTo,
  type ValidityInterval,
  INSTANT_PATTERN,
  isInstant,
  toInstant,
  assertInstant,
  fromDate,
  toDate,
  now,
  compareInstants,
  earliest,
  latest,
  newRecordTimestamps,
  touch,
  toOccurredAt,
  toObservedAt,
  toValidFrom,
  toValidTo,
  toPublishedAt,
  isValidAt,
  isWellFormed,
  ValidationError,
} from '../src/index.js';

describe('the canonical form', () => {
  it('is UTC, fixed width, milliseconds always present', () => {
    expect(now()).toMatch(INSTANT_PATTERN);
    expect(fromDate(new Date('2026-02-15T10:00:00Z'))).toBe('2026-02-15T10:00:00.000Z');
  });

  it('normalises an offset to UTC', () => {
    // The offset the sender used is a property of the sender, not the moment.
    expect(toInstant('2026-02-15T15:00:00+05:00')).toBe('2026-02-15T10:00:00.000Z');
    expect(toInstant('2026-02-15T05:00:00-05:00')).toBe('2026-02-15T10:00:00.000Z');
  });

  it('accepts a Date and a canonical instant unchanged', () => {
    const instant = now();
    expect(toInstant(instant)).toBe(instant);
    expect(toInstant(new Date('2026-02-15T10:00:00.000Z'))).toBe('2026-02-15T10:00:00.000Z');
  });

  /**
   * Fixed width is what makes `ORDER BY published_at` in SQL, `.sort()` in
   * JavaScript and a sorted key listing agree. A form that dropped `.000` or
   * used an expanded year would break it for the oldest and newest records
   * only — the hardest ordering bug to notice.
   */
  it('sorts lexicographically in chronological order', () => {
    const dates = [
      new Date('1970-01-01T00:00:00.000Z'),
      new Date('1999-12-31T23:59:59.999Z'),
      new Date('2000-01-01T00:00:00.000Z'),
      new Date('2026-02-15T10:00:00.000Z'),
      new Date('2200-06-01T12:00:00.500Z'),
      new Date('9999-12-31T23:59:59.999Z'),
    ];
    const chronological = dates.map((d) => fromDate(d));
    const shuffled = [chronological[3], chronological[0], chronological[5], chronological[2], chronological[4], chronological[1]];

    expect([...shuffled].sort()).toEqual(chronological);
    expect([...shuffled].sort(compareInstants)).toEqual(chronological);
  });

  it('refuses a date outside the fixed-width range rather than emitting a wider one', () => {
    // At the extremes `toISOString` switches to an expanded year —
    // '+275760-09-13T00:00:00.000Z' and '-271821-04-20T00:00:00.000Z' — which
    // are wider than every real value and would sort after and before
    // everything respectively. These are what overflowed arithmetic produces,
    // not data.
    expect(() => fromDate(new Date(8.64e15))).toThrow(ValidationError);
    expect(() => fromDate(new Date(-8.64e15))).toThrow(ValidationError);
  });

  /**
   * The boundary is exactly the four-digit years, 0001 through 9999, which is
   * where `toISOString` stops using the expanded form. Pinned because it is
   * not where it looks like it should be: a year-1 timestamp is absurd as PAS
   * data but is perfectly well-formed and sorts correctly, so rejecting it
   * would be the pattern overreaching rather than protecting anything.
   */
  it('accepts the whole four-digit year range', () => {
    expect(fromDate(new Date('0001-01-01T00:00:00Z'))).toBe('0001-01-01T00:00:00.000Z');
    expect(fromDate(new Date('9999-12-31T23:59:59.999Z'))).toBe('9999-12-31T23:59:59.999Z');
  });

  it('round trips through Date', () => {
    const instant = now();
    expect(fromDate(toDate(instant))).toBe(instant);
  });
});

describe('a timestamp must name exactly one moment', () => {
  /**
   * Each of these is in the PAS baseline or one step from it. `Date.parse`
   * accepts the first two and gives a different answer per machine for the
   * second, which is precisely why this does not delegate to `Date.parse`.
   */
  it.each([
    ['2015-01-01', 'a date with no time and no zone — the baseline value on auth-asg-cdc'],
    ['2026-03-01', 'same'],
    ['2026-02-15T10:00:00', 'no zone — means a different instant in every TZ'],
    ['2026-02-15T10:00', 'no zone, no seconds'],
    ['1 week ago', 'a rendering, not a value — PeerEndorsement.createdAt'],
    ['5 days ago', 'same'],
    ['yesterday', 'same'],
    ['2015-01-01Z', 'a date wearing a zone, not an instant anyone measured'],
    ['', 'empty'],
    ['   ', 'whitespace'],
    ['not a date at all', 'nonsense'],
  ])('rejects %j — %s', (value) => {
    expect(isInstant(value)).toBe(false);
    expect(() => toInstant(value)).toThrow(ValidationError);
  });

  it('rejects a number, because seconds and milliseconds are both plausible', () => {
    // 1739616000 is 2025-02-15 read as seconds, and 1970-01-21 read as
    // milliseconds. Both are dates a reviewer would accept.
    for (const value of [1739616000, 1739616000000, 0, -1]) {
      expect(() => toInstant(value), String(value)).toThrow(ValidationError);
    }

    // The message is the whole reason this is a branch of its own rather than
    // falling through to "not a string" — it tells the integrator which of the
    // two readings PAS could not choose between.
    try {
      toInstant(1739616000);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ValidationError).problems[0]?.message).toMatch(
        /seconds or milliseconds/,
      );
    }
  });

  it('rejects non-values', () => {
    for (const value of [undefined, null, {}, [], true, new Date('nonsense')]) {
      expect(() => toInstant(value)).toThrow(ValidationError);
    }
  });

  /**
   * Every rejection path, not one of them. `toInstant` refuses input at six
   * different points — not a string, a number, empty, no zone, no time of day,
   * unparseable — and a guarantee that holds at five of them is not a
   * guarantee. The rejected value reaches logs and error bodies.
   */
  it.each([
    ["'; drop table authority_records; --", 'no zone'],
    ['2026-02-15T10:00:00', 'no zone, well-formed'],
    ['drop table authority_records', 'no time of day'],
    ['', 'empty'],
    ['9999-99-99T99:99:99+00:00', 'unparseable'],
  ])('does not echo the rejected value: %j (%s)', (hostile) => {
    try {
      toInstant(hostile);
      expect.unreachable('should have thrown');
    } catch (error) {
      const rendered = `${(error as ValidationError).message} ${JSON.stringify(
        (error as ValidationError).problems,
      )}`;
      expect(rendered).not.toContain('drop table');
      if (hostile !== '') expect(rendered).not.toContain(hostile);
    }
  });

  it('does not echo a rejected non-string either', () => {
    for (const value of [{ secret: 'drop table authority_records' }, ['drop table'], 1739616000]) {
      try {
        toInstant(value);
        expect.unreachable('should have thrown');
      } catch (error) {
        const rendered = `${(error as ValidationError).message} ${JSON.stringify(
          (error as ValidationError).problems,
        )}`;
        expect(rendered).not.toContain('drop table');
        expect(rendered).not.toContain('1739616000');
      }
    }
  });

  it('explains that the zone is what is missing, not just "invalid"', () => {
    try {
      toInstant('2026-02-15T10:00:00');
      expect.unreachable('should have thrown');
    } catch (error) {
      // "invalid timestamp" sends an integrator hunting; this names the fix.
      expect((error as ValidationError).problems[0]?.message).toMatch(/UTC designator|offset/);
    }
  });

  it('names the field it was given', () => {
    try {
      toOccurredAt('2015-01-01');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ValidationError).problems[0]?.path).toBe('occurredAt');
    }
  });
});

describe('the seven semantics do not interchange — §PAS-0104', () => {
  /**
   * The ticket's central prohibition: "Do not overload createdAt to represent
   * real-world occurrence."
   *
   * The baseline commits it. `auth-asg-cdc` carries `createdAt: '2015-01-01'`,
   * the year A Solution Group CDC was founded — not the moment the record was
   * written, which was whenever the page last loaded. See SUP-14.
   *
   * Nothing about `string` resisted that. These assignments now do not
   * compile, and `@ts-expect-error` fails the typecheck if one ever starts to.
   */
  it('refuses a real-world occurrence in a createdAt field', () => {
    const founded: OccurredAt = toOccurredAt('2015-01-01T00:00:00Z');

    // @ts-expect-error occurredAt is not createdAt — this is SUP-14
    const created: CreatedAt = founded;

    // Identical on the wire. The separation is entirely in the type system,
    // which is the requirement — a discriminator in the value would make the
    // timestamp semantic.
    expect(created).toBe(founded);
    expect(isInstant(created)).toBe(true);
  });

  it('refuses every other pairing that means something different', () => {
    const created = newRecordTimestamps().createdAt;
    const observed: ObservedAt = toObservedAt('2026-02-15T10:00:00Z');
    const published: PublishedAt = toPublishedAt('2026-02-15T10:00:00Z');
    const from: ValidFrom = toValidFrom('2026-01-01T00:00:00Z');
    const to: ValidTo = toValidTo('2027-01-01T00:00:00Z');

    // @ts-expect-error when PAS learned it is not when PAS wrote it
    const a: CreatedAt = observed;
    // @ts-expect-error a publication timestamp is not the record's
    const b: CreatedAt = published;
    // @ts-expect-error the start of validity is not the end of it
    const c: ValidTo = from;
    // @ts-expect-error a record timestamp is not a validity bound
    const d: ValidFrom = created;
    // touch() is an UpdatedAt and nothing else…
    const updated: UpdatedAt = touch();
    // @ts-expect-error …so it is not an occurrence
    const e: OccurredAt = touch();
    expect(updated).toMatch(INSTANT_PATTERN);

    expect([a, b, c, d, e].every(isInstant)).toBe(true);
    expect(to).toMatch(INSTANT_PATTERN);
  });

  it('allows any kind where an unkinded instant is expected', () => {
    // Comparison, sorting and storage are kind-agnostic; only assignment into
    // a named field is constrained.
    const instants: Instant[] = [
      newRecordTimestamps().createdAt,
      toOccurredAt('2015-01-01T00:00:00Z'),
      toPublishedAt('2026-02-15T10:00:00Z'),
    ];
    expect(instants.every(isInstant)).toBe(true);
    expect(earliest(...instants)).toBe('2015-01-01T00:00:00.000Z');
    // The createdAt is from the clock, so it is the latest of the three —
    // which is the point: a record written today about a 2015 event.
    expect(latest(...instants)).toBe(instants[0]);
    expect(compareInstants(instants[0], toOccurredAt('2015-01-01T00:00:00Z'))).toBe(1);
  });

  /**
   * `createdAt` and `updatedAt` have no parser, on purpose. They are facts
   * about what PAS did, so they come from the clock and never from a payload —
   * which is the structural half of "do not overload createdAt". You cannot
   * put 2015 in a field you cannot parse a string into.
   */
  it('offers no way to parse a createdAt or updatedAt from input', async () => {
    const temporal = await import('../src/index.js');
    expect(Object.keys(temporal)).not.toContain('toCreatedAt');
    expect(Object.keys(temporal)).not.toContain('toUpdatedAt');
  });
});

describe('newRecordTimestamps', () => {
  it('takes one clock reading, so a new record compares equal', () => {
    for (let i = 0; i < 200; i += 1) {
      const { createdAt, updatedAt } = newRecordTimestamps();
      expect(createdAt).toBe(updatedAt);
    }
  });

  /**
   * The loop above cannot actually prove this, and it is worth being exact
   * about why. `Date.now()` has millisecond resolution, so a two-read
   * implementation lands in the same millisecond almost every time and passes
   * it — the defect only appears when a call straddles a millisecond boundary.
   * An intermittent wrong answer is worse than a consistent one: a small
   * random fraction of new records claim to have been modified, and nobody can
   * reproduce it.
   *
   * So the clock is made to advance on every read. One read then yields an
   * equal pair and two reads cannot, whatever the machine is doing.
   */
  it('reads the clock exactly once, under a clock that advances every read', () => {
    const RealDate = globalThis.Date;
    let tick = RealDate.UTC(2026, 1, 15, 10, 0, 0, 0);

    class AdvancingDate extends RealDate {
      // Not `ConstructorParameters<typeof Date>` — that resolves to the last
      // overload, a one-argument tuple, so TypeScript proves `length === 0`
      // impossible and the no-argument branch becomes unreachable.
      constructor(...args: [] | [number | string | Date]) {
        if (args.length === 0) {
          super(tick);
          tick += 1;
        } else {
          super(...args);
        }
      }
    }

    globalThis.Date = AdvancingDate as DateConstructor;
    try {
      const { createdAt, updatedAt } = newRecordTimestamps();
      expect(createdAt).toBe(updatedAt);
      expect(createdAt).toBe('2026-02-15T10:00:00.000Z');

      // The clock really did advance, so an equal pair was not luck.
      expect(now()).toBe('2026-02-15T10:00:00.001Z');
      expect(now()).toBe('2026-02-15T10:00:00.002Z');
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it('produces canonical instants', () => {
    const { createdAt, updatedAt } = newRecordTimestamps();
    expect(createdAt).toMatch(INSTANT_PATTERN);
    expect(updatedAt).toMatch(INSTANT_PATTERN);
  });

  it('advances on touch, so a modified record no longer compares equal', async () => {
    const { createdAt } = newRecordTimestamps();
    await new Promise((r) => setTimeout(r, 5));
    expect(compareInstants(touch(), createdAt)).toBe(1);
  });
});

describe('validity intervals are half-open — [validFrom, validTo)', () => {
  const interval: ValidityInterval = {
    validFrom: toValidFrom('2026-01-01T00:00:00Z'),
    validTo: toValidTo('2027-01-01T00:00:00Z'),
  };

  it('includes the start and excludes the end', () => {
    expect(isValidAt(interval, toInstant('2026-01-01T00:00:00Z'))).toBe(true);
    expect(isValidAt(interval, toInstant('2026-06-15T12:00:00Z'))).toBe(true);
    expect(isValidAt(interval, toInstant('2026-12-31T23:59:59.999Z'))).toBe(true);
    expect(isValidAt(interval, toInstant('2027-01-01T00:00:00Z'))).toBe(false);
  });

  it('excludes anything before the start', () => {
    expect(isValidAt(interval, toInstant('2025-12-31T23:59:59.999Z'))).toBe(false);
  });

  /**
   * The reason for the convention. Consecutive intervals abut exactly — one
   * ends at the instant the next begins — with no gap and no overlap, and
   * without anyone subtracting "one smallest unit" whose size differs between
   * JavaScript, PostgreSQL and a connector.
   */
  it('lets consecutive intervals abut with no gap and no overlap', () => {
    const boundary = '2027-01-01T00:00:00Z';
    const next: ValidityInterval = {
      validFrom: toValidFrom(boundary),
      validTo: null,
    };

    const at = toInstant(boundary);
    expect(isValidAt(interval, at)).toBe(false);
    expect(isValidAt(next, at)).toBe(true);

    // Exactly one of them holds at every instant across the join.
    for (const t of [
      '2026-12-31T23:59:59.999Z',
      '2027-01-01T00:00:00.000Z',
      '2027-01-01T00:00:00.001Z',
    ]) {
      const instant = toInstant(t);
      expect([isValidAt(interval, instant), isValidAt(next, instant)].filter(Boolean)).toHaveLength(1);
    }
  });

  it('treats a null end as open-ended', () => {
    const open: ValidityInterval = { validFrom: toValidFrom('2026-01-01T00:00:00Z'), validTo: null };
    expect(isValidAt(open, toInstant('9999-12-31T23:59:59.999Z'))).toBe(true);
  });

  it('rejects an interval that holds at no instant', () => {
    expect(isWellFormed(interval)).toBe(true);
    expect(isWellFormed({ validFrom: toValidFrom('2026-01-01T00:00:00Z'), validTo: null })).toBe(true);

    // Equal bounds are empty under a half-open convention, not instantaneous.
    expect(
      isWellFormed({
        validFrom: toValidFrom('2026-01-01T00:00:00Z'),
        validTo: toValidTo('2026-01-01T00:00:00Z'),
      }),
    ).toBe(false);
    expect(
      isWellFormed({
        validFrom: toValidFrom('2027-01-01T00:00:00Z'),
        validTo: toValidTo('2026-01-01T00:00:00Z'),
      }),
    ).toBe(false);
  });
});

describe('assertInstant — internal invariants', () => {
  it('returns its input', () => {
    const instant = now();
    expect(assertInstant(instant)).toBe(instant);
  });

  it('normalises nothing, because a value needing it came from elsewhere', () => {
    expect(() => assertInstant('2026-02-15T10:00:00Z')).toThrow(ValidationError);
    expect(() => assertInstant('2026-02-15T15:00:00+05:00')).toThrow(ValidationError);
    expect(() => assertInstant(' 2026-02-15T10:00:00.000Z ')).toThrow(ValidationError);
  });

  it('rejects a well-shaped string that is not a real instant', () => {
    // Passes the pattern, is not a date.
    expect(isInstant('2026-13-45T99:99:99.999Z')).toBe(false);
    expect(() => assertInstant('2026-13-45T99:99:99.999Z')).toThrow(ValidationError);
  });
});

describe('the PostgreSQL contract', () => {
  /**
   * `pg` returns `timestamptz` as a JavaScript `Date`. This states the round
   * trip the database layer depends on, without needing a database to say it.
   */
  it('round trips a driver Date into canonical form', () => {
    const fromDriver = new Date(Date.UTC(2026, 1, 15, 10, 0, 0, 123));
    const instant: CreatedAt = fromDate(fromDriver);
    expect(instant).toBe('2026-02-15T10:00:00.123Z');
    expect(toDate(instant).getTime()).toBe(fromDriver.getTime());
  });

  /**
   * PostgreSQL stores `timestamptz` to microseconds; JavaScript `Date` holds
   * milliseconds. A column declared without precision therefore round trips
   * lossily, and an equality comparison against a value that has been through
   * JavaScript fails for reasons nobody can see.
   *
   * Recorded here as the contract Build 02's columns must honour:
   * `timestamptz(3)`.
   */
  it('is millisecond precision, which the columns must match', () => {
    expect(fromDate(new Date(Date.UTC(2026, 1, 15, 10, 0, 0, 1)))).toBe(
      '2026-02-15T10:00:00.001Z',
    );
    expect(INSTANT_PATTERN.source).toContain('\\.\\d{3}Z');
  });
});
