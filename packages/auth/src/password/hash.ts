/**
 * PAS-0202 — password hashing.
 *
 * ── Why scrypt from `node:crypto`, and not argon2id ───────────────────────
 *
 * PAS-0002 declared argon2id parameters in configuration before there was an
 * implementation to hold them to. Implementing it changed the answer.
 *
 * argon2id is OWASP's first choice and scrypt its second, and both are
 * memory-hard. The gap between them is small. The gap between "in the Node
 * standard library" and "a native module built by node-gyp at install time"
 * is not: it is a compiler on every build host, a prebuild per platform, and a
 * third-party package with native code on the single most security-critical
 * path in the system. WASM builds avoid the compiler and pay for it in CPU per
 * login, which is the resource an unauthenticated caller can spend.
 *
 * The encoding below makes that reversible at no cost. Every hash carries the
 * algorithm and parameters it was made with, so adopting argon2id later is a
 * new branch in `verify` plus re-hash on next login — no migration, no forced
 * reset, no flag day.
 *
 * ── Parameters ───────────────────────────────────────────────────────────
 *
 * Node runs scrypt's `p` **sequentially**, so it multiplies CPU without the
 * parallelism OWASP's tiers assume. Measured on this hardware:
 *
 *   ln=15 r=8 p=3    32 MiB   272 ms      OWASP's tier
 *   ln=16 r=8 p=1    64 MiB   205 ms      the default here
 *
 * Twice the memory hardness for three quarters of the time. Raising `ln` is
 * strictly better than raising `p` on this runtime; `p` stays 1.
 */

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { ValidationError } from '@pas/contracts';
import { getConfig } from '@pas/config';

/**
 * `promisify` collapses `scrypt`'s overloads onto the one without options, so
 * the parameters would be silently dropped and every hash would use Node's
 * defaults. Wrapped by hand instead, fully typed.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** 128 bits. More salt buys nothing; less starts to allow shared rainbow tables. */
const SALT_BYTES = 16;
/** 256 bits of derived key. */
const KEY_BYTES = 32;

export interface ScryptParameters {
  /** log2 of scrypt's N. Memory is 128 * 2^ln * r bytes. */
  ln: number;
  r: number;
  p: number;
}

/** `scrypt$ln=16,r=8,p=1$<salt>$<key>`, base64url throughout. */
const ENCODED = /^scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

function b64(buffer: Buffer): string {
  return buffer.toString('base64url');
}

/**
 * `maxmem` must exceed what the parameters need or Node refuses the call.
 * Doubling leaves room for scrypt's own working set rather than sitting exactly
 * on the boundary, where a version bump turns a login into an exception.
 */
function maxmem({ ln, r }: ScryptParameters): number {
  return 128 * 2 ** ln * r * 2 + 1024 * 1024;
}

export function configuredParameters(): ScryptParameters {
  const { authentication } = getConfig();
  return {
    ln: authentication.passwordHashCostLog2,
    r: authentication.passwordHashBlockSize,
    p: authentication.passwordHashParallelism,
  };
}

async function derive(
  password: string,
  salt: Buffer,
  parameters: ScryptParameters,
): Promise<Buffer> {
  const { ln, r, p } = parameters;
  return scrypt(password.normalize('NFKC'), salt, KEY_BYTES, {
    N: 2 ** ln,
    r,
    p,
    maxmem: maxmem(parameters),
  });
}

/**
 * Hashes a password for storage.
 *
 * The password is normalised NFKC first. Without it a password typed on one
 * keyboard and re-typed on another can be two different byte sequences that
 * render identically, and the second one simply does not work — a login
 * failure nobody can reproduce or explain.
 */
export async function hashPassword(
  password: string,
  parameters: ScryptParameters = configuredParameters(),
): Promise<string> {
  assertAcceptablePassword(password);
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, parameters);
  return `scrypt$ln=${parameters.ln},r=${parameters.r},p=${parameters.p}$${b64(salt)}$${b64(key)}`;
}

/**
 * Whether the password matches the stored hash.
 *
 * Returns false for a malformed hash rather than throwing. A caller in the
 * login path that had to distinguish "wrong password" from "corrupt row" would
 * be one `catch` away from telling an attacker which.
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = ENCODED.exec(encoded);
  if (!match) return false;

  const [, ln, r, p, saltB64, keyB64] = match;
  const parameters = { ln: Number(ln), r: Number(r), p: Number(p) };

  // Parameters come out of the database, and the database is where an
  // attacker with write access would put ln=30 to turn every login into an
  // out-of-memory kill.
  if (parameters.ln < 10 || parameters.ln > 22 || parameters.r < 1 || parameters.r > 32) {
    return false;
  }

  const expected = Buffer.from(keyB64, 'base64url');
  if (expected.length !== KEY_BYTES) return false;

  const actual = await derive(password, Buffer.from(saltB64, 'base64url'), parameters);

  // Constant time. A byte-by-byte comparison leaks, through timing, how much
  // of a guessed key was right, which turns a search over the whole space into
  // a search one byte at a time.
  return timingSafeEqual(actual, expected);
}

/**
 * Whether a stored hash is below current policy and should be replaced.
 *
 * Checked after a *successful* verification, which is the only moment the
 * plaintext is available to re-hash with. This is what lets the cost be raised
 * without a migration or a forced reset: hashes upgrade as their owners log in.
 */
export function needsRehash(
  encoded: string,
  parameters: ScryptParameters = configuredParameters(),
): boolean {
  const match = ENCODED.exec(encoded);
  if (!match) return true;
  const [, ln, r, p] = match;
  return (
    Number(ln) < parameters.ln || Number(r) < parameters.r || Number(p) < parameters.p
  );
}

/**
 * Rejects passwords that must not be stored.
 *
 * Length only, from configuration. Composition rules — an uppercase, a digit,
 * a symbol — measurably reduce the space users choose from, because everyone
 * satisfies them the same way, and NIST dropped them for that reason. Length
 * is the property that matters.
 *
 * The upper bound is not a policy: scrypt hashes its input, so long passwords
 * are safe, but an unbounded one lets an unauthenticated caller hand the
 * server a megabyte to hash on every request.
 */
export function assertAcceptablePassword(password: string): void {
  const { authentication } = getConfig();
  const problems: { path: string; message: string }[] = [];

  if (typeof password !== 'string') {
    problems.push({ path: 'password', message: 'must be a string' });
  } else {
    const length = [...password].length;
    if (length < authentication.minPasswordLength) {
      problems.push({
        path: 'password',
        message: `must be at least ${authentication.minPasswordLength} characters`,
      });
    }
    if (password.length > 1024) {
      problems.push({ path: 'password', message: 'must be at most 1024 characters' });
    }
  }

  if (problems.length > 0) {
    throw new ValidationError('The password is not acceptable.', problems);
  }
}
