# PAS-0102 — Migration System

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0102 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 01 — Database Foundation |
| **Depends on** | PAS-0101 ✅ (pool, transactions, advisory lock), PAS-0005 ✅ (readiness registry), PAS-0002 ✅ (configuration) |

---

## Purpose

Deterministic migrations carrying identifier, name, applied timestamp and checksum, applied by
a separate step that a deploy runs — never by the application at startup (Part I §4).

The ticket's stated test is *empty database → migrate → application starts*. That passes
trivially against an API that ignores the database, so this ticket also lands the wiring
PAS-0101 deferred by name: `/ready` now validates database connectivity **and** schema
currency, which is what makes the test mean something.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/database/src/migrate/discover.ts` | filename pattern, checksum, directory validation |
| `packages/database/src/migrate/ledger.ts` | `schema_migrations`; `ensureLedger`, `readLedger`, `recordApplied` |
| `packages/database/src/migrate/runner.ts` | `buildPlan`, `migrate`, `migrationStatus`, `pendingMigrationCount` |
| `packages/database/src/migrate/cli.ts` | `up` / `status` / `--dry-run` |
| `packages/database/tests/migrate.test.ts` | 28 tests against a real PostgreSQL |
| `apps/api/src/health/database-check.ts` | registers the `database` and `database.schema` readiness checks |
| `tests/integration/harness.ts` | shared harness — built-artifact spawning, port allocation |
| `tests/integration/migrate-and-start.test.ts` | 7 tests: the ticket's stated test, end to end |

## Files Modified

| File | Change |
|---|---|
| `packages/config/src/schema.ts`, `load.ts`, `.env.example` | `database.migrationsDir` / `PAS_MIGRATIONS_DIR` |
| `apps/api/src/server.ts` | registers the database checks; closes the pool on shutdown |
| `apps/api/src/health/index.ts` | exports the new registration |
| `apps/api/package.json` | **new workspace edge** — `@pas/database` (see *Backward Dependency Check*) |
| `packages/database/src/index.ts` | exports the migration surface |
| `packages/database/README.md` | migration contract, the four corruption modes, health |
| `package.json` | `migrate` script fixed; `typecheck` now covers `tests/integration` |
| `eslint.config.js` | `pg` import exemption scoped to `tests/integration/**` |
| `tests/integration/api-process.test.ts` | moved onto the shared harness; readiness now asserts all three checks |

---

## Database Migrations

None. This ticket builds the mechanism; Build 02 adds the first migration. `migrations/`
contains only `.gitkeep`, and the integration suite exercises the shipped default path against
it as well as against temporary directories carrying real DDL.

---

## Domain Contracts Added/Changed

`@pas/database` additionally exports `migrate`, `migrationStatus`, `pendingMigrationCount`,
`buildPlan`, `discoverMigrations`, `checksum`, `LEDGER_TABLE`, `MIGRATION_PATTERN`, and the
`DiscoveredMigration` / `AppliedMigration` / `MigrationPlan` / `MigrationOutcome` types.

Configuration gains `database.migrationsDir` (`PAS_MIGRATIONS_DIR`, default `migrations`).
Never required, resolved against the working directory at each use site.

---

## API Contracts / Events / Workflow / Governance / Authorization

`/ready` gains two checks. Both are **critical** — a failure means the process must not
receive traffic.

| Check | Fails when | Operator response |
|---|---|---|
| `database` | the database is unreachable | fix the database |
| `database.schema` | reachable, but migrations are pending | run the migrator |

Reported separately on purpose. Collapsed into one, a perfectly healthy rolling deploy whose
migrations have not run yet reports "database down".

Unchanged: in a deployed environment `/ready` still returns `{status, correlationId}` only.
Check names map PAS's dependencies and stay withheld. The integration suite asserts this
against the built process with real-looking production configuration.

---

## Tests Added

**`packages/database/tests/migrate.test.ts` — 28 tests.** Organised around the four ways a
migration system silently corrupts a schema, because "does the SQL run" catches none of them.

| Group | Tests |
|---|---|
| applying migrations | ordering, idempotence, incremental apply, dry run, every required metadata field |
| mode 1 — checksum drift | refuses an edited migration; detects it alongside pending work |
| mode 2 — out-of-order | refuses a migration older than the highest applied; allows a newer one |
| mode 3 — vanished migration | refuses when an applied migration is no longer on disk |
| mode 4 — schema/ledger divergence | **rolls the DDL back when the ledger write fails**; records nothing on failure; no partial schema; clean resume |
| concurrent migrators | serialises a rolling deploy |
| status and pending count | read-only — creates nothing, **not even the ledger** |
| discovery | rejects undeterministic names, duplicate identifiers, empty files; throws rather than skipping |
| validator agreement | `scripts/validate-migrations.mjs` and `MIGRATION_PATTERN` accept and reject the same names |
| `buildPlan` | pure, tested without a database |

**`tests/integration/migrate-and-start.test.ts` — 7 tests** against the built migrator CLI and
the built API process, on a database created empty for the run:

- empty database → API is **live but not ready**, naming the schema, having created nothing
  → migrate → API is **ready** with all three checks passing
- a later build expecting a migration the database lacks goes not-ready again
- an unreadable migrations directory fails loudly rather than reading as "nothing pending"
- the repository's own `migrations/` via the shipped default path
- idempotence across separate processes
- three concurrent migrator processes: exactly one applies, two report nothing to do
- an edited applied migration refuses the run and changes nothing

### Mutation testing

Green on the first run is not evidence the tests are load-bearing, so each guarantee was
verified by breaking the implementation and confirming a test failed:

| Mutation | Result |
|---|---|
| checksum drift check disabled | 2 tests failed |
| vanished-migration check disabled | 1 test failed |
| out-of-order check disabled | 1 test failed |
| advisory lock replaced with a plain connection | 2 tests failed |
| DDL and ledger row split into two transactions | **survived — no test failed** |

The last one is why `rolls the DDL back when the ledger write fails` exists. A
two-transaction implementation is exactly corruption mode 4, and it passed every other test
in the file. The test injects a failure between the DDL and the ledger insert — the one
failure that cannot be produced with SQL — and asserts the schema change rolls back with it.
Re-run against the same mutation, it fails.

---

## Tests Passed

```
npm run ci
  typecheck            ✅  (now includes tests/integration)
  lint                 ✅  1 pre-existing warning class in apps/web, 0 errors
  unit tests           ✅  @pas/database 62 · @pas/observability 37 · others green
  production build     ✅
  integration tests    ✅  14 (7 PAS-0006 + 7 PAS-0102)
  migration validation ✅
  frontend baseline    ✅  byte-identical to f23d11a
```

---

## Typecheck / Lint / Build

Clean. `npm run typecheck` previously used `--workspaces --if-present`, which silently skipped
`tests/integration/` — it is not a workspace. A type error had been sitting in
`api-process.test.ts` since PAS-0006, unreported. The root script now typechecks that project
explicitly and the error is fixed.

---

## Security / Privacy Impact

- **No new wire surface.** Deployed `/ready` still returns `{status, correlationId}`.
  Migration counts and check names appear only in non-deployed environments.
- **Migration SQL is repository content, not input.** Files come from the build; nothing
  user-supplied reaches the migrator.
- **Identifiers are not interpolated from user data.** `LEDGER_TABLE` is a module constant;
  every value is parameterised.
- **The scratch-database helper is test-only** and exempted from the `pg` import ban in
  `tests/integration/**` alone.

---

## Backward Dependency Check

### New workspace edge — `apps/api` → `@pas/database`

Recorded explicitly, because ADR-005 settled only `@pas/contracts` as universally
dependable and holds every other new edge for ratification.

This edge is **specification-derived, not invented**. Clean-Sheet PAS-0005 states: *"/ready
validates required dependencies such as database connectivity."* PAS-0005 shipped without it
because no database layer existed; PAS-0101 built the check and recorded the deferral in its
own report — *"That wiring belongs with PAS-0102, where 'empty database → migrate →
application starts' is the stated test."* Not landing it here leaves PAS-0005 in standing
violation of its own acceptance text and leaves this ticket's stated test unable to mean
anything.

No cycle: `apps/api` → `@pas/database` → `{config, contracts, observability}`, all of which
`apps/api` already depends on. `@pas/database` does not depend on `apps/api`.

**`apps/web` is not a dependency of any domain package.** Re-verified.

### Other checks

- `packages/database` → `@pas/config` was already present (PAS-0101); `cli.ts` uses it so the
  migrator and the readiness check cannot read different directories.
- `package-lock.json` gained 4 lines, three of which record `@pas/database`'s own PAS-0101
  dependencies that were never written to the lock. `npm ci` would have caught this eventually;
  it is fixed now.

---

## Forward Dependencies Unlocked

PAS-0103, PAS-0104 · Build 02 (first real migrations) · every later build that adds schema.

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **The repository's own `migrations/` directory is empty**, so the test that exercises the
   shipped default path applies zero migrations. It still proves the default resolves, the
   CLI exits 0 and the API starts ready — and it strengthens automatically at Build 02. The
   temporary-directory tests carry real DDL and cover the rest.

2. **`down` migrations are not implemented.** PAS-0102 does not ask for them, and the
   Expand → Migrate → Verify → Contract rule (CLAUDE.md §3) makes reversal a forward
   migration rather than a rollback. Recording it as a deliberate omission, not an oversight.

3. **The filename pattern and checksum exist in two places** — `discover.ts` and
   `scripts/validate-migrations.mjs`. The script must run with no build step, so it cannot
   import built output. Drift is caught mechanically by a test asserting the two accept and
   reject the same filenames, not left to discipline.

---

## Defects Found and Fixed During This Ticket

| Defect | Consequence had it shipped |
|---|---|
| `migrationStatus` called `ensureLedger` | The API's readiness check would **create a table at startup** — the exact Part I §4 violation `ledger.ts` claims never happens. Found by designing the test that asserts it; the pre-existing read-only test checked the domain table but not the ledger, so it passed throughout. Both the read path and the test are fixed. |
| Root `migrate` script used `npm run … -w @pas/database` | `-w` moves the working directory into the package, so the default resolved to `packages/database/migrations`. It failed loudly rather than silently — which is why `discoverMigrations` throws on a missing directory — but it was still wrong for every operator running the documented command. |
| `tests/integration/` was never typechecked | A type error from PAS-0006 sat unreported. |
| `@pas/database`'s dependencies were absent from `package-lock.json` | `npm ci` resolving a different tree than local development. |

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Create deterministic migrations | ✅ four-digit ordering; checksum over file content; identical input produces an identical plan |
| Metadata — migration identifier | ✅ `identifier`, primary key of `schema_migrations` |
| Metadata — migration name | ✅ `name` |
| Metadata — applied timestamp | ✅ `applied_at timestamptz` |
| Metadata — checksum/version where supported | ✅ `checksum`, SHA-256; drift refuses the run |
| **Test: empty database → migrate → application starts** | ✅ `tests/integration/migrate-and-start.test.ts`, against the built migrator and the built API, on a database created empty for the run — and asserting not-ready before, ready after |
| Part I §4 — version controlled | ✅ files in `migrations/`, applied by identifier |
| Part I §4 — deterministic | ✅ |
| Part I §4 — supports deployment ordering | ✅ ordering enforced; out-of-order refused |
| Part I §4 — fails safely | ✅ per-migration transaction; ledger row in the same commit; three pre-flight refusals |
| Part I §4 — no opportunistic table creation at startup | ✅ the application never migrates; the read path creates nothing, including the ledger |
| Part I §4 — exercised by CI against a clean database | ✅ CI step 6 against the postgres service |
| PAS-0005 — /ready validates database connectivity | ✅ registered here, as PAS-0101 deferred |

**No criterion is unmet. STATUS = COMPLETE.**
