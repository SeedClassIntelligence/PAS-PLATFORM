/**
 * PAS-0102 — the migration command.
 *
 *   npm run migrate            apply everything pending
 *   npm run migrate -- status  report without applying
 *   npm run migrate -- --dry-run
 *
 * Migration is a deliberate, separate step. Part I §4: "Do not allow production
 * application startup to create tables opportunistically." The application
 * never calls this — a deploy does, before the new version starts serving.
 */

import { resolve } from 'node:path';
import { getConfig } from '@pas/config';
import { isPasError, toErrorResponse } from '@pas/contracts';
import { runInNewOperation } from '@pas/observability';
import { migrate, migrationStatus } from './runner.js';
import { closePool } from '../pool.js';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args.find((a) => !a.startsWith('-')) ?? 'up';
  const dryRun = args.includes('--dry-run');
  // One source of truth with the API's schema readiness check, so the migrator
  // and the process that refuses to serve behind it can never read different
  // directories. Relative paths resolve against the working directory, which is
  // why the root `migrate` script does not use `-w` — that would move the cwd
  // into the package and look for `packages/database/migrations`.
  const directory = resolve(process.cwd(), getConfig().database.migrationsDir);

  if (command === 'status') {
    const { applied, pending } = await migrationStatus({ directory });
    console.log(`applied: ${applied.length}   pending: ${pending.length}`);
    for (const m of applied) {
      console.log(`  ✓ ${m.identifier}  ${m.name}  ${m.appliedAt.toISOString()}  ${m.executionMs}ms`);
    }
    for (const m of pending) {
      console.log(`  · ${m.identifier}  ${m.name}  (pending)`);
    }
    return 0;
  }

  if (command !== 'up') {
    console.error(`unknown command: ${command}. Expected "up" or "status".`);
    return 2;
  }

  const outcomes = await migrate({ directory, dryRun });

  if (outcomes.length === 0) {
    console.log('migrate: nothing to apply — the database is up to date.');
    return 0;
  }

  console.log(`migrate: ${dryRun ? 'would apply' : 'applied'} ${outcomes.length} migration(s)`);
  for (const o of outcomes) {
    console.log(`  ${dryRun ? '·' : '✓'} ${o.identifier}  ${o.name}${dryRun ? '' : `  ${o.executionMs}ms`}`);
  }
  return 0;
}

const exitCode = await runInNewOperation({ kind: 'cli', name: 'migrate' }, async () => {
  try {
    return await main();
  } catch (error) {
    if (isPasError(error)) {
      // Operators run this, so show the real detail regardless of environment;
      // `deployed: false` keeps the message and the per-problem list.
      const { error: body } = toErrorResponse(error, {
        correlationId: 'migrate',
        deployed: false,
      });
      console.error(`\nmigrate failed: ${body.code}\n  ${body.message}`);
      if (body.details) console.error(`\n${JSON.stringify(body.details, null, 2)}`);
    } else {
      console.error('\nmigrate failed:', error);
    }
    return 1;
  } finally {
    await closePool();
  }
});

process.exit(exitCode);
