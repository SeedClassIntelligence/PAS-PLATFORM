/**
 * PAS-0202 — session tokens.
 *
 * The token is 256 bits of CSPRNG output. The database stores only its
 * SHA-256, so a disclosed backup, replica or query log hands an attacker
 * nothing they can present as a session.
 *
 * No password-style KDF on this path, deliberately. A KDF defends a *guessable*
 * secret against offline search; a uniformly random 256-bit value has nothing
 * to guess. Putting scrypt here would add ~200ms to every authenticated
 * request in exchange for defending against a dictionary attack on a value
 * with no dictionary.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_BYTES = 32;

/** Base64url, so it is safe in a cookie, a header and a URL without escaping. */
export function newSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashSessionToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/**
 * Whether two digests match, in constant time.
 *
 * The lookup is by indexed digest, so this is belt-and-braces for callers
 * comparing a digest they already hold. `timingSafeEqual` throws on a length
 * mismatch, which is why the length is checked first.
 */
export function sessionTokenMatches(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
