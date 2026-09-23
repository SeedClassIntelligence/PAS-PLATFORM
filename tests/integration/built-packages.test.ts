/**
 * Integration: every built package loads under `node`.
 *
 * CLAUDE.md: *"Unit tests are not proof a process runs. Node packages build to
 * `dist/` and run from there; unit tests resolve `@pas/*` to source."* PAS-0005
 * shipped 27 green tests against an API that could not start, and the only
 * thing that would have caught it was loading the built artifact.
 *
 * `apps/api` has an entry point, so `api-process.test.ts` spawns it. A library
 * package has none — nothing spawns `@pas/domain` — so a resolution defect in
 * its build output stays invisible until the first build that imports it,
 * which may be several tickets away. This loads each one the way `node` will.
 *
 * The assertions are smoke, not coverage. The unit suites own behaviour; this
 * owns "the thing that ships can be loaded and called at all".
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './harness.js';

const PACKAGES = [
  'contracts',
  'config',
  'observability',
  'database',
  'domain',
  // Added when it emerged that no integration test loaded either of these
  // from dist/ — six tickets (PAS-0202…0204, PAS-0301…0303) had shipped with
  // their entire surface proved only against TypeScript source.
  'auth',
  'events',
] as const;

function distEntry(name: string): string {
  return join(ROOT, 'packages', name, 'dist/index.js');
}

/**
 * Loads the built file by path rather than by package specifier.
 *
 * A bare `import('@pas/domain')` resolves through `exports`, which is the
 * right thing in principle but lets the bundler pre-resolve it while
 * collecting the file — so a missing `dist/` fails the whole file before any
 * assertion runs, and the useful "run `npm run build` first" message never
 * appears. A file URL names exactly the artifact under test and cannot be
 * resolved to anything else.
 */
async function loadBuilt(name: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(distEntry(name)).href)) as Record<string, unknown>;
}

describe('built packages load under node', () => {
  it.each(PACKAGES)('%s has build output', (name) => {
    const entry = distEntry(name);
    expect(existsSync(entry), `${entry} is missing — run \`npm run build\` first.`).toBe(true);
  });

  it.each(PACKAGES)('%s imports without throwing', async (name) => {
    const module = await loadBuilt(name);
    expect(Object.keys(module).length).toBeGreaterThan(0);
  });

  it('@pas/domain generates and validates an identifier from built output', async () => {
    const { generateId, isId, parseId } = (await loadBuilt('domain')) as
      typeof import('@pas/domain');

    const id = generateId();
    expect(isId(id)).toBe(true);
    expect(parseId(id.toUpperCase())).toBe(id);

    // SUP-11's identifiers do not survive the built artifact either.
    expect(() => parseId('d01')).toThrow();
  });

  it('@pas/contracts renders a typed error from built output', async () => {
    const { ValidationError, toErrorResponse } = (await loadBuilt('contracts')) as
      typeof import('@pas/contracts');

    const { error } = toErrorResponse(new ValidationError('nope'), {
      correlationId: 'test',
      deployed: true,
    });
    expect(error.family).toBe('VALIDATION');
  });
});
