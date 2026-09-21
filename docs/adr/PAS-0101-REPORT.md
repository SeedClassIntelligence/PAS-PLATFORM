# PAS-0101 — PostgreSQL Connection Layer

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0101 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 01 — Database Foundation (**opens Build 01**) |
| **Depends on** | Build 00 ✅ (PAS-0001…0006) |

---

## Purpose

`packages/database/` centralising connection pooling, transactions, migration access, query
instrumentation and database health, such that application code cannot independently create
arbitrary database connections.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/database/src/pool.ts` | pool lifecycle, per-connection timeouts, statistics |
| `packages/database/src/query.ts` | `query`/`queryOne`, instrumentation comment |
| `packages/database/src/transaction.ts` | `withTransaction`, savepoint nesting, retry |
| `packages/database/src/migration-access.ts` | advisory lock, transactional DDL |
| `packages/database/src/errors.ts` | SQLSTATE → `PasError` mapping |
| `packages/database/src/health.ts` | `databaseReadinessCheck` |
| `packages/database/tests/database.test.ts` | 34 tests against a real PostgreSQL |
| `packages/database/README.md` | contract and rationale |
| `docs/operations/local-database.md` | reproducible local setup |

## Files Modified

| File | Change |
|---|---|
| `eslint.config.js` | bans `pg` imports outside `packages/database` |
| `.github/workflows/ci.yml` | Postgres 16 service + `PAS_DATABASE_URL` |
| `package.json` | `@pas/database` in build order |
| `vitest.shared.ts` | `@pas/database` source alias |

**`apps/web` untouched.** No runtime wiring into `apps/api` — see Known Issues.

## Database Migrations

None. PAS-0102 creates the migration system; this ticket provides the access primitives it
consumes.

## Domain Contracts Added/Changed

`@pas/database` exports `query`, `queryOne`, `withConnection`, `withTransaction`,
`withMigrationLock`, `runMigrationStatements`, `checkDatabase`, `databaseReadinessCheck`,
`toDatabaseError`, `isRetryable`, plus pool statistics and lifecycle.

**The `Pool` is deliberately not exported.**

## API Contracts / Events / Workflow / Governance / Authorization

None. This is infrastructure below the domain.

## Tests Added

**34 tests, against a real PostgreSQL 16.15.** A mocked driver proves the code calls the
functions it calls — not that a transaction rolls back, that a savepoint isolates a nested
failure, or that `statement_timeout` is in force on the connection, which are the only claims
worth making about a connection layer.

| Group | Covers |
|---|---|
| connection pooling | real connection, reuse under 20 concurrent queries, slot returned on throw, `statement_timeout`/`lock_timeout`/`idle_in_transaction_session_timeout` all in force |
| transactions | commit, rollback, **mutation+outbox atomicity (Part I §5)**, isolation and read-only |
| **savepoint nesting** | inner completion does not commit the outer; inner failure rolls back only itself and leaves the outer usable; depth tracking; isolation rejected on nested calls |
| instrumentation | correlation id visible in `pg_stat_activity`; no comment outside an operation; invalid label dropped; **SQL injection attempt neutralised** |
| error mapping | unique → `ConflictError`, check → `ValidationError`, timeout → non-retryable, no raw driver error escapes, **no row values echoed in details** |
| `queryOne` | undefined for none, throws for many |
| health | reachable + pool stats, critical check with short timeout, constant-time as tables grow |
| migration access | concurrent migrators serialised, lock released on throw, timeout rather than hanging a deploy, DDL leaves no partial schema |

## Tests Passed

```
unit         168  (database 34 · api 30 · observability 37 · config 33 · contracts 31 · web 3)
integration    7
total        175
```

## Typecheck / Lint / Build

✅ All pass. Frontend artifacts **still byte-identical** to `f23d11a`
(`63a17f150ca2f875c2ced46dd0b97be2`), verified mechanically by the PAS-0006 guard.

Full `npm run ci` from clean: **exit 0**.

## Security / Privacy Impact

**Positive.**

1. **No raw driver error escapes.** A `pg` error's message carries the connection string.
   Every failure is mapped to a `PasError` with the original retained only as `cause`, which
   PAS-0003 never serialises to a client. Tested.

2. **Row values are never echoed.** Postgres puts the offending values in `error.detail` —
   `Key (email)=(a@b.com) already exists`. Details carry the constraint and table and
   deliberately **not** that field. Tested with a sentinel value.

3. **The instrumentation comment cannot be used to inject SQL.** The correlation id is
   interpolated into SQL text, so this module re-checks PAS-0004's charset and **drops** an
   invalid id rather than escaping it. A hostile id of `*/ drop table …; --` never reaches the
   text. Tested.

4. **Pool exhaustion is bounded.** `statement_timeout`, `lock_timeout` and
   `idle_in_transaction_session_timeout` are set per connection. Without them a single
   pathological query or abandoned transaction takes the whole service down by holding slots.

5. **The pool `error` handler prevents a crash loop.** An idle client erroring is an
   `uncaughtException` if unhandled — a database blip becoming a restart storm.

6. **Tests cannot touch the development database.** `packages/database/vitest.config.ts` pins
   `PAS_DATABASE_URL` to `pas_test`; the suite truncates tables on every test.

## Backward Dependency Check

✅ No circular dependencies. `@pas/web` remains a dependency of nothing.

`@pas/database → @pas/contracts` is covered by **ADR-005**.

`@pas/database → @pas/config, @pas/observability` go **beyond** PAS-0001's declared
`database → (none)`. Not discretionary: pooling reads `config.database.*` (PAS-0002 defined
those fields for this consumer) and instrumentation requires PAS-0004's correlation context.
The ticket cannot be built without either. Flagged; revert on request at the cost of failing
both requirements.

## Forward Dependencies Unlocked

PAS-0102 (migration system — consumes `withMigrationLock` and `runMigrationStatements`) ·
PAS-0103 · PAS-0104 · every subsequent persistence ticket.

## Known Issues

None outstanding. One environment finding, one recurring defect in my own code, and two
deliberate deferrals.

### Establishing a real Postgres — the availability check lied

The ticket is unverifiable without a database, so availability was established before any code
was written. Three paths:

| Path | Root cause it addresses | Outcome |
|---|---|---|
| **A** — native `apt install postgresql-16` | no server binary present | ✅ **taken** — PostgreSQL 16.15 running |
| **B** — Docker container | no server binary present, different provisioning | ❌ **failed** |
| **C** — PGlite (real Postgres in WASM) | no server *process* possible | not needed |

**Path B is worth recording.** `docker info` **exits 0** while printing only the `Client:`
section — there is no daemon socket in this container. Trusting that check would have meant
writing the ticket against a database that does not exist and discovering it at test time. The
container only failed when a real `docker run` was attempted.

This is the same shape as the PAS-0005 defect: a check that looks like verification but tests
the wrong thing. `docs/operations/local-database.md` records both paths, including the false
positive.

### The same defect, twice, in code written this ticket

`withTransaction` and later `withMigrationLock` both wrapped **the caller's callback** in
`toDatabaseError`. A domain `ConflictError` raised inside a transaction — or a plain
`throw new Error('...')` — was flattened into `InternalError: Database operation failed.`,
destroying the family and message the caller depends on. Five tests caught the first instance,
two caught the second.

The rule this produced, now applied throughout the package: **map errors at the driver call
site only.** `query` maps what the driver throws; transaction and lock helpers map only the
failures of their own control statements (`BEGIN`, `COMMIT`, `SAVEPOINT`, `pg_try_advisory_lock`)
and propagate the callback's error unchanged. `toDatabaseError` now also returns any
already-typed `PasError` untouched, so a double-wrap is impossible rather than merely avoided.

A genuine gap surfaced with it: `42P07 duplicate_table` fell through to the generic case. A
migration creating an object that already exists is a **conflict**, and PAS-0102 needs to
distinguish that from an opaque service failure. `42P07`, `42701`, `42710` and `42P06` now map
to `ConflictError`.

### Deferred — the readiness check is exported, not registered

`databaseReadinessCheck` is built and tested, and is the exact shape PAS-0005's registry
consumes. It is **not** registered in `apps/api`.

Registering it makes `/ready` require a database, which changes the PAS-0006 integration
suite's expectations and makes the API undeployable without one. That wiring belongs with
PAS-0102, where "empty database → migrate → application starts" is the stated test and the API
genuinely depends on the database being present and migrated.

PAS-0101's criterion is to *centralise* database health, which the exported check satisfies.
The consuming ticket is named rather than left implicit.

### Unverified locally — the CI Postgres service

`.github/workflows/ci.yml` gains a `postgres:16-alpine` service with a `pg_isready` health
gate. The local equivalent is verified (full `npm run ci` green against a real database), but
**the workflow change itself cannot be executed here** — there is no GitHub Actions runner in
this container. The YAML parses and the service block is the standard form; that is the limit
of what has been proved. First real CI run confirms it.

---

## Acceptance Criteria

| PAS-0101 requirement | Evidence |
|---|---|
| Create `packages/database/` | ✅ 6 modules |
| Centralise **connection pooling** | ✅ private `Pool`, `withConnection`, statistics, per-connection timeouts |
| Centralise **transactions** | ✅ `withTransaction` with savepoint nesting; Part I §5 atomicity tested |
| Centralise **migration access** | ✅ `withMigrationLock`, `runMigrationStatements` |
| Centralise **query instrumentation** | ✅ correlation id verified present in `pg_stat_activity` |
| Centralise **database health** | ✅ `checkDatabase`, `databaseReadinessCheck` |
| **Application code must not independently create arbitrary database connections** | ✅ `Pool` not exported **and** an ESLint rule that fires outside the package, verified both directions |

**STATUS: COMPLETE.**
