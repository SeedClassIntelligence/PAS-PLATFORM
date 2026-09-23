#!/usr/bin/env node
/**
 * PAS-0006 — migration validation.
 *
 * Validates the `migrations/` directory without needing a database, so the
 * check runs on every commit rather than only where Postgres is available.
 *
 * ── What it enforces, and where each rule comes from ──────────────────────
 *
 * Part I §4: migrations must "be deterministic" and "support deployment
 * ordering". Files have no inherent order, so a total order has to be encoded
 * in the name — a zero-padded numeric prefix is the only way to get a stable
 * lexicographic sort that also survives `ls`, `git diff` and a file listing.
 *
 * PAS-0102: required metadata is "migration identifier, migration name,
 * applied timestamp, checksum/version where supported". Identifier and name
 * live in the filename; the applied timestamp is recorded by the runner at
 * apply time; the checksum is emitted here.
 *
 * ── Why a checksum manifest ───────────────────────────────────────────────
 *
 * The failure this prevents: someone edits a migration that has already run in
 * production. The local database is fine (it was built by replaying the edited
 * file), production is fine (it ran the original), and the two schemas silently
 * diverge. Recording a checksum per file makes that edit visible in review as a
 * manifest change, which is the only point at which a human can catch it.
 *
 * ── Empty is valid ────────────────────────────────────────────────────────
 *
 * With no migrations, there are no invalid migrations. The check passes and
 * says so explicitly rather than pretending to have verified something.
 * PAS-0102 extends this with the runtime half: empty database → migrate →
 * application starts.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'migrations');
const MANIFEST = join(MIGRATIONS_DIR, 'checksums.json');

/**
 * `0001_create_authority_entities.sql`
 *
 * Four digits give 9,999 migrations before the sort breaks, which is more than
 * this system will produce. PAS-0102 may refine this pattern; the properties it
 * must preserve are total ordering, uniqueness and a human-readable name.
 */
const MIGRATION_PATTERN = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

const IGNORED = new Set(['.gitkeep', 'checksums.json', 'README.md']);

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function validateMigrations({ write = false } = {}) {
  const problems = [];

  if (!existsSync(MIGRATIONS_DIR)) {
    return { ok: false, problems: [`migrations/ does not exist`], migrations: [] };
  }

  const entries = (await readdir(MIGRATIONS_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && !IGNORED.has(e.name))
    .map((e) => e.name)
    .sort();

  const bySequence = new Map();
  const migrations = [];

  for (const name of entries) {
    const match = MIGRATION_PATTERN.exec(name);
    if (!match) {
      problems.push(
        `${name}: does not match NNNN_snake_case_name.sql — migrations must sort ` +
          `deterministically (Part I §4)`,
      );
      continue;
    }

    const [, sequence, label] = match;

    if (bySequence.has(sequence)) {
      problems.push(
        `${name}: duplicate sequence ${sequence}, already used by ${bySequence.get(sequence)} — ` +
          `two migrations with the same ordinal have no defined apply order`,
      );
      continue;
    }
    bySequence.set(sequence, name);

    const content = await readFile(join(MIGRATIONS_DIR, name), 'utf8');
    if (content.trim().length === 0) {
      problems.push(`${name}: is empty`);
      continue;
    }

    migrations.push({ sequence, name, label, checksum: sha256(content) });
  }

  // Checksum drift: a migration that already ran somewhere has been edited.
  if (existsSync(MANIFEST)) {
    const recorded = JSON.parse(await readFile(MANIFEST, 'utf8'));
    for (const migration of migrations) {
      const previous = recorded[migration.name];
      if (previous && previous !== migration.checksum) {
        problems.push(
          `${migration.name}: content changed after being recorded. A migration that has ` +
            `already been applied must never be edited — add a new migration instead. ` +
            `If this change is intentional and the migration has NEVER been applied ` +
            `anywhere, re-record with: npm run validate:migrations -- --write`,
        );
      }
    }
    for (const name of Object.keys(recorded)) {
      if (!migrations.some((m) => m.name === name)) {
        problems.push(
          `${name}: recorded in checksums.json but no longer present — a migration that has ` +
            `been applied cannot be deleted`,
        );
      }
    }
  }

  if (write && problems.length === 0) {
    const manifest = Object.fromEntries(migrations.map((m) => [m.name, m.checksum]));
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { ok: problems.length === 0, problems, migrations };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes('--write');
  const { ok, problems, migrations } = await validateMigrations({ write });

  if (migrations.length === 0) {
    console.log('migration validation: no migrations yet — nothing to validate.');
    console.log('  (PAS-0102 adds the runtime half: empty database → migrate → app starts)');
  } else {
    console.log(`migration validation: ${migrations.length} migration(s)`);
    for (const m of migrations) {
      console.log(`  ${m.sequence}  ${m.label}  ${m.checksum.slice(0, 12)}`);
    }
  }

  if (!ok) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  • ${p}`);
    process.exit(1);
  }
  console.log('OK');
}
