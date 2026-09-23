/**
 * PAS-0202, PAS-0203, PAS-0204 — authentication, capabilities and
 * authorization, proved against BUILT artifacts.
 *
 * These three tickets were marked COMPLETE with their entire surface exercised
 * only by source-resolved unit tests. `built-packages.test.ts` proves
 * `@pas/auth` *imports* from `dist/`; importing is not working. Nothing ran a
 * login, resolved a session, or asked `authorize` a question against a real
 * database from the artifact that ships.
 *
 * The record said complete. This is what the word was supposed to mean.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import {
  ROOT,
  runNode,
  migratedScratchDatabase,
  dropScratchDatabase,
  scratchDatabaseName,
} from './harness.js';

const EXERCISE = join(ROOT, 'tests/integration/fixtures/exercise-auth.mjs');

interface Check {
  name: string;
  ok: boolean;
  error?: string;
}

const database = scratchDatabaseName('auth');
let checks: Check[] = [];

beforeAll(async () => {
  const url = await migratedScratchDatabase(database);
  const result = await runNode(EXERCISE, [ROOT], { PAS_DATABASE_URL: url });

  expect(
    result.code,
    `the exercise process failed to run at all:\n${result.stdout}\n${result.stderr}`,
  ).toBe(0);

  checks = JSON.parse(result.stdout) as Check[];
}, 180_000);

afterAll(async () => {
  await dropScratchDatabase(database);
});

const EXPECTED = [
  'the built package exports the authentication surface',
  // PAS-0202
  'a password hash verifies, and a wrong password does not',
  'two hashes of the same password differ — the salt is real',
  'login succeeds with the right password and issues a session',
  'login fails with the wrong password',
  'login is case-folded on the address, as the unique index is',
  'the stored credential is not the password',
  'a session resolves, and a revoked session does not',
  'a forged token does not resolve',
  'the session token is not stored in recoverable form',
  // PAS-0203 / PAS-0204
  'a membership with no role is denied',
  'granting OWNER allows what the role carries',
  'an OWNER of one account is denied in another',
  'a DENY override beats the role that grants it',
  'an anonymous actor is denied',
  'a capability no role holds is denied even to an OWNER — INV-27',
  'a suspended user is denied what their role would allow',
] as const;

describe('the built authentication stack, run from dist/', () => {
  it('ran every check', () => {
    // A fixture that stopped emitting checks would otherwise pass this file by
    // asserting nothing.
    expect(checks.map((c) => c.name)).toEqual([...EXPECTED]);
  });

  it.each(EXPECTED)('%s', (name) => {
    const check = checks.find((c) => c.name === name);
    expect(check, `no check named "${name}" was reported`).toBeDefined();
    expect(check?.ok ? null : check?.error).toBeNull();
  });
});
