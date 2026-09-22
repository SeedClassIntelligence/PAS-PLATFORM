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
 * Where reading them is legitimate.
 *
 * `packages/auth` implements the service. `migrations` creates and seeds the
 * tables. Everywhere else, a reference is a second authorization
 * implementation.
 */
const ALLOWED = ['packages/auth', 'migrations'];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vite']);

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

      const contents = await readFile(file, 'utf8');
      for (const table of AUTHORIZATION_TABLES) {
        // Word-bounded, so `membership_roles_idx` in unrelated prose does not
        // trip it and `from membership_roles` does.
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
