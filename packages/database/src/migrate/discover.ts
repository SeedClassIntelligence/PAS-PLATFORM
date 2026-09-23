/**
 * PAS-0102 — reading migrations from disk.
 *
 * ── Deliberate duplication with `scripts/validate-migrations.mjs` ─────────
 *
 * The filename pattern and checksum algorithm exist in two places. That is a
 * real cost, accepted for a reason: the script must run with no build step
 * (pre-commit, and as CI's migration-validation gate, which is allowed to run
 * even when the build has failed), while this module is the implementation the
 * runner uses. Making the script import built output would mean a broken build
 * silently skips migration validation.
 *
 * Drift between the two is caught mechanically — a test asserts they accept and
 * reject the same filenames — rather than left to discipline.
 */

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationError } from '@pas/contracts';

/**
 * `0001_create_authority_entities.sql`
 *
 * Part I §4 requires migrations to "support deployment ordering". Files have no
 * inherent order, so the order must be in the name. Four digits sort
 * lexicographically and numerically alike.
 */
export const MIGRATION_PATTERN = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

/** Files in `migrations/` that are not migrations. */
export const NON_MIGRATION_FILES = new Set(['.gitkeep', 'checksums.json', 'README.md']);

export interface DiscoveredMigration {
  /** The `NNNN` prefix. Primary key in the ledger. */
  identifier: string;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
}

export function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

/**
 * Reads and validates the migration directory.
 *
 * Throws on anything malformed rather than skipping it: a migration silently
 * ignored because of a typo in its name is a schema change that never happens,
 * discovered in production.
 */
export async function discoverMigrations(directory: string): Promise<DiscoveredMigration[]> {
  if (!existsSync(directory)) {
    throw new ValidationError(`The migrations directory does not exist: ${directory}`, [], {
      code: 'migration.directory_missing',
    });
  }

  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !NON_MIGRATION_FILES.has(entry.name))
    .map((entry) => entry.name)
    .sort();

  const problems: { path: string; message: string }[] = [];
  const seen = new Map<string, string>();
  const migrations: DiscoveredMigration[] = [];

  for (const filename of entries) {
    const match = MIGRATION_PATTERN.exec(filename);
    if (!match) {
      problems.push({
        path: filename,
        message:
          'does not match NNNN_snake_case_name.sql — migrations must sort deterministically ' +
          '(Part I §4, "support deployment ordering")',
      });
      continue;
    }

    const [, identifier, name] = match;

    const duplicate = seen.get(identifier);
    if (duplicate) {
      problems.push({
        path: filename,
        message: `duplicate identifier ${identifier}, already used by ${duplicate} — two ` +
          'migrations with the same ordinal have no defined apply order',
      });
      continue;
    }
    seen.set(identifier, filename);

    const sql = await readFile(join(directory, filename), 'utf8');
    if (sql.trim().length === 0) {
      problems.push({ path: filename, message: 'is empty' });
      continue;
    }

    migrations.push({ identifier, name, filename, sql, checksum: checksum(sql) });
  }

  if (problems.length > 0) {
    throw new ValidationError(
      `${problems.length} invalid migration file(s) in ${directory}`,
      problems,
      { code: 'migration.invalid_files' },
    );
  }

  return migrations;
}
