/**
 * PAS-0204 — nothing reaches around the authorization service.
 *
 * *"All protected server operations must call this service or an equivalent
 *  centralized enforcement mechanism."*
 *
 * `Grant` makes forgetting to authorize a compile error. It does not stop the
 * other bypass: querying `role_capabilities` directly and deciding for
 * yourself. That code compiles, looks reasonable, and quietly reimplements
 * the resolution order — usually without the status checks, because the
 * person writing it is thinking about capabilities rather than suspension.
 *
 * This is the same shape as PAS-0101's ban on importing `pg` outside
 * `packages/database`, and it exists for the same reason: the rule is
 * mechanical or it is a convention people violate by accident under deadline.
 * It is a test rather than a lint rule because the bypass is SQL inside a
 * string, which ESLint does not see.
 */

import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');

/** Tables that exist to answer "may they?". Reading them IS deciding. */
const AUTHORIZATION_TABLES = [
  'role_capabilities',
  'membership_roles',
  'capability_overrides',
];

/**
 * Where referencing them is legitimate.
 *
 * `packages/auth` implements the service. `migrations` creates and seeds the
 * tables. Everywhere else in **shipped code**, a reference is a second
 * authorization implementation.
 */
const ALLOWED = ['packages/auth', 'migrations'];

/**
 * Tests are exempt, and this exemption was earned rather than assumed.
 *
 * This guard fired on the first code written after it: PAS-0205's security
 * suite inserts `membership_roles` and `capability_overrides` rows to build
 * its six actors, and reads them back to assert the fixtures landed.
 *
 * That is not the behaviour the rule exists to stop. The rule is about code
 * that reads these tables **and acts on the result to permit something** —
 * which is shipped code, by definition. A test that sets up state is
 * arranging; a test that reads it is asserting. Neither authorizes anything.
 *
 * The exemption is deliberately narrow: a test *file*, not a test
 * *directory*, so a helper named `auth-shortcut.ts` sitting beside a suite is
 * still scanned. And `catches a bypass in shipped code` below asserts the
 * exemption has not swallowed the rule.
 */
const TEST_FILE = /(\.test\.ts|\.spec\.ts)$/;

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vite']);

/**
 * Removes comments before matching.
 *
 * Word-bounding is not enough, and the first version of this guard claimed it
 * was. A comment explaining *why* a file must not query `membership_roles` is
 * prose, not a query — and without this, documenting the rule anywhere
 * violates the rule, which is a guard that punishes the one thing it should
 * encourage.
 *
 * Deliberately crude: this is a grep, not a parser, and `//` inside a string
 * literal would over-strip. Over-stripping can only produce a false *pass*
 * for a bypass written on the same line as a URL, which no bypass is, and the
 * alternative — parsing every file in the repository — is not worth it for a
 * guard this shape.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

async function* sourceFiles(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* sourceFiles(full);
    } else if (/\.(ts|tsx|mjs|js|sql)$/.test(entry.name)) {
      yield full;
    }
  }
}

describe('the authorization tables are read in one place', () => {
  it('is not queried outside packages/auth and migrations', async () => {
    const offenders: string[] = [];

    for await (const file of sourceFiles(ROOT)) {
      const rel = relative(ROOT, file);
      if (ALLOWED.some((prefix) => rel.startsWith(prefix))) continue;
      if (TEST_FILE.test(rel)) continue;

      const contents = stripComments(await readFile(file, 'utf8'));
      for (const table of AUTHORIZATION_TABLES) {
        if (new RegExp(`\\b${table}\\b`).test(contents)) {
          offenders.push(`${rel} references ${table}`);
        }
      }
    }

    expect(
      offenders,
      offenders.length === 0
        ? ''
        : 'These decide authorization for themselves instead of calling ' +
          '`authorize()`. Move the decision into @pas/auth:\n  ' +
          offenders.join('\n  '),
    ).toEqual([]);
  });

  it('actually looks at files, so a green result means something', async () => {
    // A scanner that silently matched nothing would pass this suite forever.
    const scanned: string[] = [];
    for await (const file of sourceFiles(ROOT)) scanned.push(file);

    expect(scanned.length).toBeGreaterThan(50);
    // And it reaches the places a bypass would actually be written, rather
    // than counting files in one corner of the tree.
    expect(scanned.some((f) => f.includes('/apps/api/'))).toBe(true);
    expect(scanned.some((f) => f.includes('/packages/domain/'))).toBe(true);
  });

  /**
   * The exemption above must not have swallowed the rule. If test files were
   * exempted by *directory* rather than by filename, a helper sitting beside
   * a suite would escape — which is exactly where a convenience shortcut
   * around authorization gets written.
   */
  it('still scans non-test files inside test directories', async () => {
    const scanned: string[] = [];
    for await (const file of sourceFiles(ROOT)) {
      const rel = relative(ROOT, file);
      if (ALLOWED.some((p) => rel.startsWith(p)) || TEST_FILE.test(rel)) continue;
      scanned.push(rel);
    }
    // PAS-0205's harness and actor builder are support code, not suites, and
    // must remain under the rule.
    expect(scanned).toContain('tests/security/harness.ts');
    expect(scanned).toContain('tests/security/actors.ts');
  });

  it('reads code, not prose — a comment naming a table is not a bypass', () => {
    const documented = `
      // This module must never query membership_roles itself.
      /* capability_overrides is written only through @pas/auth. */
      const x = 1;
    `;
    const stripped = stripComments(documented);
    for (const table of AUTHORIZATION_TABLES) {
      expect(new RegExp(`\\b${table}\\b`).test(stripped), table).toBe(false);
    }
  });

  it('still catches the query the comment was describing', () => {
    const real = `
      // This module must never query membership_roles itself.
      const rows = await query('select 1 from membership_roles where id = $1');
    `;
    expect(/\bmembership_roles\b/.test(stripComments(real))).toBe(true);
  });

  it('catches a bypass in shipped code', async () => {
    // The exemption is by filename, so shipped code is unaffected by it.
    const shipped = 'apps/api/src/routes/claims.ts';
    expect(TEST_FILE.test(shipped)).toBe(false);
    expect(ALLOWED.some((p) => shipped.startsWith(p))).toBe(false);
  });

  it('would catch a bypass if one were written', async () => {
    // Proves the regex matches the shape a bypass actually takes, rather
    // than trusting that it would.
    const bypass = `
      const { rows } = await query(
        \`select 1 from membership_roles mr
           join role_capabilities rc on rc.role_name = mr.role_name
          where mr.account_membership_id = $1\`, [id]);
      if (rows.length > 0) return doTheProtectedThing();
    `;
    const hits = AUTHORIZATION_TABLES.filter((t) => new RegExp(`\\b${t}\\b`).test(bypass));
    expect(hits).toEqual(['role_capabilities', 'membership_roles']);
  });
});
