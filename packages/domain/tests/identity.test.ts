/**
 * PAS-0103 acceptance tests.
 *
 * "Generates a unique string" is the easy half and proves almost nothing. The
 * ticket's actual requirement is a set of negatives — the identifier must not
 * encode entity type, module, dossier, page, owner name or sequence meaning —
 * and a negative is only tested by trying to recover the thing that must not
 * be there.
 *
 * So these tests attack the identifier: sort a batch and look for creation
 * order, diff adjacent identifiers for a moving prefix, and check the function
 * signature for any way to inject meaning at all.
 */

import { describe, it, expect } from 'vitest';
import { ValidationError } from '@pas/contracts';
import {
  generateId,
  isId,
  parseId,
  assertId,
  ID_PATTERN,
  NIL_ID,
  type Id,
} from '../src/index.js';

const SAMPLE = 512;

function batch(n = SAMPLE): string[] {
  return Array.from({ length: n }, () => generateId());
}

describe('generateId', () => {
  it('produces a canonical identifier', () => {
    for (const id of batch(64)) {
      expect(id, id).toMatch(ID_PATTERN);
      expect(isId(id)).toBe(true);
    }
  });

  it('produces distinct identifiers', () => {
    const ids = batch();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never produces the nil identifier', () => {
    expect(batch().some((id) => id === NIL_ID)).toBe(false);
  });
});

describe('the identifier encodes nothing — §XLI', () => {
  /**
   * The strongest guarantee available, and the reason it is structural rather
   * than reviewed: the function has no parameters, so there is no channel
   * through which an entity type, a module code, a dossier, a page or an owner
   * name could reach the value. A generator that accepted a prefix would be
   * one deadline away from `generateId('auth')`.
   */
  it('takes no arguments, so there is nothing to encode', () => {
    expect(generateId.length).toBe(0);
  });

  /**
   * The regression guard against swapping in UUIDv7 or ULID for the
   * index-locality win. Both are a timestamp with random padding, so sorting
   * them recovers creation order — which is exactly the "sequence meaning" the
   * ticket forbids, and leaks when each record was created to anyone holding
   * two identifiers.
   */
  it('does not carry creation order — sorting does not recover it', () => {
    const ids: string[] = [];
    for (let i = 0; i < 64; i += 1) ids.push(generateId());

    const sorted = [...ids].sort();

    // A time-ordered generator makes these identical. With 64 random values
    // the chance of agreement by luck is 1/64!, which is zero for any purpose.
    expect(sorted).not.toEqual(ids);

    // And the disagreement is thorough, not a couple of transpositions: a v7
    // batch generated this fast agrees on nearly every position.
    const agreeing = ids.filter((id, index) => sorted[index] === id).length;
    expect(agreeing).toBeLessThan(8);
  });

  it('does not carry a timestamp — identifiers a second apart share no prefix', async () => {
    const before = generateId();
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const after = generateId();

    // v7 and ULID put 48 bits of millisecond timestamp at the front, so a
    // second's gap leaves the leading hex digits almost unchanged. Only the
    // version nibble at index 14 is allowed to match structurally.
    const shared = [...before].findIndex((ch, i) => ch !== after[i]);
    expect(shared, `${before} vs ${after}`).toBeLessThan(8);
  });

  it('pins the version and variant, so a generator swap fails here', () => {
    for (const id of batch(64)) {
      expect(id[14], `version nibble of ${id}`).toBe('4');
      expect('89ab', `variant nibble of ${id}`).toContain(id[19]);
    }
  });

  /**
   * SUP-11: `d01`–`d10`, `M01`–`M08`, `auth-asg-cdc` and `auth-${Date.now()}`
   * encode presentation and ordering assumptions into identity. None of them
   * can survive as a canonical identifier.
   */
  it('rejects every semantic identifier the baseline used', () => {
    for (const legacy of [
      'd01',
      'd10',
      'M01',
      'M08',
      'auth-asg-cdc',
      'auth-anthem-loi',
      `auth-${Date.now()}`,
      'entity_1',
      '1',
    ]) {
      expect(isId(legacy), legacy).toBe(false);
      expect(() => parseId(legacy), legacy).toThrow(ValidationError);
    }
  });
});

describe('scopes separate identity at compile time only', () => {
  /**
   * §XLI: "Representation IDs and authority IDs remain separate." The
   * separation is in the type system — the moment it lives in the string, the
   * identifier has become semantic.
   */
  it('produces indistinguishable values for different scopes', () => {
    type EntityId = Id<'AuthorityEntity'>;
    type ReprId = Id<'Representation'>;

    const entity: EntityId = generateId<'AuthorityEntity'>();
    const repr: ReprId = generateId<'Representation'>();

    // Nothing about either value says which it is. That is the requirement,
    // not a shortcoming: on the wire and in the database they are the same
    // shape, and only the compiler keeps them apart.
    expect(entity).toMatch(ID_PATTERN);
    expect(repr).toMatch(ID_PATTERN);
    expect(entity).not.toBe(repr);

    // @ts-expect-error a representation id is not an authority entity id
    const wrong: EntityId = repr;
    expect(isId(wrong)).toBe(true);
  });

  it('accepts a scoped identifier where an unscoped one is expected', () => {
    const scoped = generateId<'AuthorityEntity'>();
    const plain: Id = scoped;
    expect(plain).toBe(scoped);
  });
});

describe('parseId — untrusted input', () => {
  it('normalises case and whitespace to one canonical spelling', () => {
    const id = generateId();
    expect(parseId(`  ${id.toUpperCase()}  `)).toBe(id);
  });

  it('rejects the nil identifier', () => {
    expect(() => parseId(NIL_ID)).toThrow(ValidationError);
    expect(() => parseId(NIL_ID.toUpperCase())).toThrow(ValidationError);
    expect(isId(NIL_ID)).toBe(false);
  });

  /**
   * Pins *why* the nil identifier is rejected, which is not obvious: it has
   * `0` where the version nibble must be `4`, so the pattern excludes it and
   * no separate check is carrying that weight. A pattern loosened to accept
   * other versions would start accepting nil, and this is what would fail.
   */
  it('rejects the nil identifier through the pattern itself', () => {
    expect(ID_PATTERN.test(NIL_ID)).toBe(false);
  });

  it('names the nil identifier specifically, rather than calling it malformed', () => {
    try {
      parseId(NIL_ID);
      expect.unreachable('should have thrown');
    } catch (error) {
      // "must be a canonical PAS identifier" sends an integrator hunting; this
      // sends them to the field that was never set.
      expect((error as ValidationError).problems[0]?.message).toContain('nil');
    }
  });

  it('rejects other UUID versions', () => {
    // v1 carries a timestamp and a MAC address; v7 carries a timestamp.
    for (const other of [
      '2c1b1f3e-9d4a-11ee-b9d1-0242ac120002',
      '018f2e5a-7c40-7a3b-8c1e-2f5a9d3b4c6e',
    ]) {
      expect(isId(other), other).toBe(false);
      expect(() => parseId(other), other).toThrow(ValidationError);
    }
  });

  it('rejects non-strings without throwing anything but ValidationError', () => {
    for (const value of [undefined, null, 42, {}, [], true, Symbol('x')]) {
      expect(() => parseId(value)).toThrow(ValidationError);
    }
  });

  it('does not echo the rejected value', () => {
    // It is caller-supplied and reaches logs and error bodies.
    const hostile = "'; drop table authority_entities; --";
    try {
      parseId(hostile);
      expect.unreachable('should have thrown');
    } catch (error) {
      const rendered = `${(error as ValidationError).message} ${JSON.stringify(
        (error as ValidationError).problems,
      )}`;
      expect(rendered).not.toContain('drop table');
      expect(rendered).not.toContain(hostile);
    }
  });

  it('names the field it was given, so a caller can point at the input', () => {
    try {
      parseId('nope', 'authorityEntityId');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ValidationError).problems[0]?.path).toBe('authorityEntityId');
    }
  });
});

describe('assertId — internal invariants', () => {
  it('returns the identifier it was given', () => {
    const id = generateId();
    expect(assertId(id)).toBe(id);
  });

  it('does not normalise, because a value needing it came from somewhere else', () => {
    const id = generateId();
    expect(() => assertId(id.toUpperCase())).toThrow(ValidationError);
    expect(() => assertId(` ${id} `)).toThrow(ValidationError);
  });

  it('rejects the nil identifier', () => {
    expect(() => assertId(NIL_ID)).toThrow(ValidationError);
  });
});

describe('round trip', () => {
  it('survives generate → parse → assert unchanged', () => {
    for (const id of batch(64)) {
      expect(assertId(parseId(id))).toBe(id);
    }
  });

  it('survives a PostgreSQL uuid column round trip', () => {
    // `pg` returns `uuid` columns as canonical lowercase strings, which is the
    // form `isId` requires. This asserts the contract the database layer
    // relies on without needing a database to state it.
    const id = generateId();
    expect(id).toBe(id.toLowerCase());
    expect(id).toHaveLength(36);
    expect(isId(id)).toBe(true);
  });
});
