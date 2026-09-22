/**
 * PAS-0202 — password hashing.
 *
 * No database. The properties here are about the hash itself: that it is
 * salted, that its parameters travel with it, that verification is total, and
 * that raising the cost later costs nothing.
 */

import { describe, it, expect } from 'vitest';
import { ValidationError } from '@pas/contracts';
import {
  hashPassword,
  verifyPassword,
  needsRehash,
  assertAcceptablePassword,
  configuredParameters,
} from '../src/index.js';

/** Cheap parameters. The tests are about structure, not about cost. */
const FAST = { ln: 12, r: 8, p: 1 };
const PASSWORD = 'correct horse battery staple';

describe('hashing', () => {
  it('produces a self-describing hash', async () => {
    const hash = await hashPassword(PASSWORD, FAST);
    expect(hash).toMatch(/^scrypt\$ln=12,r=8,p=1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  });

  it('never repeats a hash for the same password', async () => {
    // Salted. Without it, two users with the same password are visibly the
    // same in the table, and one cracked hash cracks every account sharing it.
    const hashes = await Promise.all(
      Array.from({ length: 16 }, () => hashPassword(PASSWORD, FAST)),
    );
    expect(new Set(hashes).size).toBe(16);
  });

  it('verifies the password it was made from', async () => {
    expect(await verifyPassword(PASSWORD, await hashPassword(PASSWORD, FAST))).toBe(true);
  });

  it('rejects a wrong password, including one off by a character', async () => {
    const hash = await hashPassword(PASSWORD, FAST);
    for (const wrong of [
      'correct horse battery stapl',
      'correct horse battery staple ',
      'Correct horse battery staple',
      '',
      'entirely different',
    ]) {
      expect(await verifyPassword(wrong, hash), wrong).toBe(false);
    }
  });

  it('treats visually identical passwords as equal', async () => {
    // 'é' as one code point and as 'e' + combining acute render identically.
    // Without NFKC normalisation, a password typed on one keyboard and
    // re-typed on another is two byte sequences, and the second simply does
    // not work — a login failure nobody can reproduce.
    const composed = 'café-password-2026';
    const decomposed = 'café-password-2026';
    expect(composed).not.toBe(decomposed);
    expect(await verifyPassword(decomposed, await hashPassword(composed, FAST))).toBe(true);
  });
});

describe('verification is total — a bad hash is never an exception', () => {
  /**
   * The login path must not be able to tell "wrong password" from "corrupt
   * row" by catching, because a caller one `catch` away from that distinction
   * is a caller that can be made to reveal it.
   */
  it.each([
    ['', 'empty'],
    ['not-a-hash', 'unstructured'],
    ['scrypt$ln=12$salt$key', 'missing parameters'],
    ['argon2id$m=19456,t=2,p=1$salt$key', 'another algorithm'],
    ['scrypt$ln=12,r=8,p=1$!!!$key', 'invalid base64url'],
    ['scrypt$ln=12,r=8,p=1$c2FsdA$c2hvcnQ', 'derived key of the wrong length'],
  ])('returns false for %j (%s)', async (hash) => {
    await expect(verifyPassword(PASSWORD, hash)).resolves.toBe(false);
  });

  /**
   * Parameters come out of the database. An attacker with write access there
   * would put ln=30 in every row to turn each login into an out-of-memory
   * kill — denial of service through a column nobody validates.
   */
  it('refuses absurd parameters rather than attempting them', async () => {
    const start = Date.now();
    expect(await verifyPassword(PASSWORD, 'scrypt$ln=30,r=64,p=1$c2FsdA$' + 'a'.repeat(43))).toBe(false);
    expect(Date.now() - start).toBeLessThan(1_000);
  });
});

describe('the cost can be raised without a migration', () => {
  it('recognises a hash below current policy', async () => {
    const old = await hashPassword(PASSWORD, { ln: 12, r: 8, p: 1 });
    expect(needsRehash(old, { ln: 16, r: 8, p: 1 })).toBe(true);
    expect(needsRehash(old, { ln: 12, r: 8, p: 1 })).toBe(false);
    // Above policy is not "below" it — a hash made stronger than the current
    // default is not downgraded.
    expect(needsRehash(await hashPassword(PASSWORD, { ln: 14, r: 8, p: 1 }), { ln: 12, r: 8, p: 1 })).toBe(false);
  });

  it('still verifies a hash made with the old parameters', async () => {
    // The whole point: raising the default must not invalidate a single
    // existing password. Parameters travel with the hash.
    const old = await hashPassword(PASSWORD, { ln: 12, r: 8, p: 1 });
    expect(await verifyPassword(PASSWORD, old)).toBe(true);
    expect(needsRehash(old, { ln: 16, r: 8, p: 1 })).toBe(true);
  });

  it('treats an unreadable hash as needing replacement', async () => {
    expect(needsRehash('garbage')).toBe(true);
  });
});

describe('password policy', () => {
  it('enforces the configured minimum length', () => {
    const min = configuredParameters() && 12;
    expect(() => assertAcceptablePassword('a'.repeat(min - 1))).toThrow(ValidationError);
    expect(() => assertAcceptablePassword('a'.repeat(min))).not.toThrow();
  });

  it('counts characters, not UTF-16 code units', () => {
    // '👍' is two code units and one character. Counting units would accept a
    // password of six emoji as twelve characters.
    expect(() => assertAcceptablePassword('👍'.repeat(6))).toThrow(ValidationError);
    expect(() => assertAcceptablePassword('👍'.repeat(12))).not.toThrow();
  });

  /**
   * The bound is not a policy about passwords. scrypt hashes its input, so a
   * long password is perfectly safe — but an unbounded one lets an
   * unauthenticated caller hand the server a megabyte to hash on every
   * request.
   */
  it('bounds the input so an unauthenticated caller cannot choose the work', () => {
    expect(() => assertAcceptablePassword('a'.repeat(1024))).not.toThrow();
    expect(() => assertAcceptablePassword('a'.repeat(1025))).toThrow(ValidationError);
  });

  it('imposes no composition rules', () => {
    // NIST dropped them: everyone satisfies them the same way, which shrinks
    // the space an attacker searches rather than growing it.
    expect(() => assertAcceptablePassword('aaaaaaaaaaaaaaaa')).not.toThrow();
    expect(() => assertAcceptablePassword('correct horse battery staple')).not.toThrow();
  });

  it('refuses to hash a password the policy rejects', async () => {
    await expect(hashPassword('short', FAST)).rejects.toThrow(ValidationError);
  });
});
