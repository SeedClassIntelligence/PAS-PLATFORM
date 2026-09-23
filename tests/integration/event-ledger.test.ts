/**
 * PAS-0303 — the event ledger, proved against BUILT artifacts.
 *
 * `packages/events/tests/ledger.test.ts` covers this behaviour thoroughly, and
 * it resolves `@pas/*` to TypeScript source. CLAUDE.md §4 states why that is
 * not proof: PAS-0005 shipped 27 green tests against an API that could not
 * start. A package can pass every unit test and still fail to load from
 * `dist/` — a missing export in the barrel, an unbuilt subpath, an import that
 * only resolves through a source alias.
 *
 * This file existed for none of PAS-0301, PAS-0302 or PAS-0303 until it was
 * asked whether the work marked complete had actually been run. It had not, as
 * a shipping artifact. It has now.
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

const EXERCISE = join(ROOT, 'tests/integration/fixtures/exercise-ledger.mjs');

interface Check {
  name: string;
  ok: boolean;
  error?: string;
}

const database = scratchDatabaseName('ledger');
let checks: Check[] = [];

beforeAll(async () => {
  // A scratch database, migrated by the built migrator. Nothing here shares
  // state with another suite (CLAUDE.md §5).
  const url = await migratedScratchDatabase(database);
  const result = await runNode(EXERCISE, [ROOT], { PAS_DATABASE_URL: url });

  expect(
    result.code,
    `the exercise process failed to run at all:\n${result.stdout}\n${result.stderr}`,
  ).toBe(0);

  checks = JSON.parse(result.stdout) as Check[];
}, 120_000);

afterAll(async () => {
  await dropScratchDatabase(database);
});

describe('the built event ledger, run from dist/', () => {
  it('ran every check', () => {
    // Guards the shape of the evidence: a fixture that silently stopped
    // emitting checks would otherwise pass this file by asserting nothing.
    expect(checks.length).toBe(8);
  });

  it.each([
    'the built package exports the ledger surface',
    'append, then read back through the built read path',
    'UPDATE of a historical event',
    'DELETE of a historical event',
    'an appended payload carrying a credential',
    'a rolled-back mutation leaves no event — Part I §5',
    'an aggregate stream replays in sequence order',
    'a SYSTEM row carrying a user id, written past the service',
  ])('%s', (name) => {
    const check = checks.find((c) => c.name === name);
    expect(check, `no check named "${name}" was reported`).toBeDefined();
    expect(check?.ok ? null : check?.error).toBeNull();
  });
});
