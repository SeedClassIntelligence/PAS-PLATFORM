#!/usr/bin/env node
/**
 * Enforces CLAUDE.md §4: the frontend build stays byte-identical to baseline
 * `f23d11a` until a ticket deliberately changes it.
 *
 * ── Why this is mechanical and not a habit ────────────────────────────────
 *
 * ADR-003 preserves `apps/web` while the backend is built underneath it. The
 * strongest available proof that a backend ticket changed nothing the user can
 * see is that the emitted bundle is byte-for-byte what it was at the baseline
 * commit. That proof is worth nothing if it depends on someone remembering to
 * run `md5sum`. PAS-0005 demonstrated what "I'll check manually" is worth.
 *
 * When a ticket legitimately changes the frontend, it re-records deliberately:
 *
 *     npm run check:baseline -- --write
 *
 * and the diff to `frontend-baseline.json` appears in review — which is the
 * point at which a human decides whether the change was intended.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/web/dist');
const BASELINE = join(ROOT, 'frontend-baseline.json');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

async function hashDist() {
  const files = (await walk(DIST)).sort();
  const hashes = {};
  for (const file of files) {
    hashes[relative(DIST, file)] = createHash('md5').update(await readFile(file)).digest('hex');
  }
  return hashes;
}

const write = process.argv.includes('--write');

if (!existsSync(DIST)) {
  console.error(`apps/web/dist is missing — run \`npm run build\` first.`);
  process.exit(1);
}

const actual = await hashDist();

if (write || !existsSync(BASELINE)) {
  await writeFile(
    BASELINE,
    `${JSON.stringify({ note: 'Regenerate deliberately: npm run check:baseline -- --write', artifacts: actual }, null, 2)}\n`,
  );
  console.log(`frontend baseline recorded (${Object.keys(actual).length} artifact(s)):`);
  for (const [name, hash] of Object.entries(actual)) console.log(`  ${hash}  ${name}`);
  process.exit(0);
}

const { artifacts: expected } = JSON.parse(await readFile(BASELINE, 'utf8'));
const problems = [];

for (const [name, hash] of Object.entries(expected)) {
  if (!(name in actual)) problems.push(`${name}: missing from the build`);
  else if (actual[name] !== hash) {
    problems.push(`${name}: ${hash.slice(0, 12)} → ${actual[name].slice(0, 12)}`);
  }
}
for (const name of Object.keys(actual)) {
  if (!(name in expected)) problems.push(`${name}: new artifact not in the baseline`);
}

if (problems.length > 0) {
  console.error('The frontend build changed (CLAUDE.md §4):\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error(
    '\nADR-003 preserves apps/web while the backend is built underneath it.\n' +
      'If this change is intentional, re-record it in the same commit:\n' +
      '  npm run check:baseline -- --write\n',
  );
  process.exit(1);
}

console.log(`frontend baseline: ${Object.keys(actual).length} artifact(s) unchanged.`);
