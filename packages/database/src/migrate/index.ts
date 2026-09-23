/** PAS-0102 — Migration System. */

export {
  MIGRATION_PATTERN,
  NON_MIGRATION_FILES,
  type DiscoveredMigration,
  discoverMigrations,
  checksum,
} from './discover.js';

export {
  LEDGER_TABLE,
  type AppliedMigration,
  ensureLedger,
  readLedger,
  recordApplied,
} from './ledger.js';

export {
  type MigrationPlan,
  type MigrationOutcome,
  type MigrateOptions,
  buildPlan,
  migrate,
  migrationStatus,
  pendingMigrationCount,
} from './runner.js';
