# `@pas/database`

PAS-0101 — PostgreSQL connection layer. Centralises **connection pooling**, **transactions**,
**migration access**, **query instrumentation** and **database health**.

## The Pool is not exported

PAS-0101: *"Application code must not independently create arbitrary database connections."*

Callers get `query`, `queryOne`, `withConnection` and `withTransaction`. Nothing else can
obtain a raw client, and an ESLint rule bans importing `pg` outside this package:

```
error  'pg' import is restricted from being used. Import from @pas/database instead.
```

A hand-rolled client has no per-connection `statement_timeout`, no transaction nesting, no
error mapping, and leaks a pool slot on the first early return.

## Transactions — Part I §5

> *"A canonical mutation and its required outbox event SHALL occur within the same
> transaction."*

```ts
await withTransaction(async (tx) => {
  await query('update claims set ...',        [id], { client: tx });
  await query('insert into claim_versions ...', [id], { client: tx });
  await query('insert into audit_entries ...',  [id], { client: tx });
  await query('insert into outbox_events ...',  [id], { client: tx });
});                                            // one COMMIT
```

### Nesting uses savepoints

Postgres has **one transaction per connection**. If a nested `withTransaction` issued its own
`COMMIT`, it would commit the *outer* transaction's partial work: the mutation becomes
durable, the outbox event never lands, and the outer caller's later rollback does nothing.
That is exactly the state/event divergence §5 forbids.

So the outermost frame owns `BEGIN`/`COMMIT`; nested calls become `SAVEPOINT`s. A nested
failure rolls back only its own work and leaves the enclosing transaction usable.

`isolation` and `readOnly` are **rejected** on a nested call rather than silently ignored —
believing you have `SERIALIZABLE` while you inherited `READ COMMITTED` produces rare,
unexplained anomalies under concurrency.

`retries` is **off by default**: a retry re-runs the callback, and a callback that sent an
email or called an external API will do it twice.

## Instrumentation goes into Postgres, not just the log

```sql
-- pas:corr=01J8XYZ op=claim.approve
update claims set ...
```

A log line would be cheaper, but the comment travels *into* the database — it appears in
`pg_stat_activity`, `log_min_duration_statement` output and `pg_stat_statements`. A slow query
found by a DBA traces back to the request that caused it without correlating timestamps across
two systems.

The id is interpolated into SQL text, so it must not be able to close the comment or inject a
newline. Safety comes from PAS-0004's `isValidId` charset (`[A-Za-z0-9._-]`) — this module
**re-checks and drops** rather than escaping. A hostile correlation id never reaches the text.

## Errors are typed, and never raw

A `pg` error's message routinely carries the connection string. None escapes this package:

| SQLSTATE | Becomes | Retryable |
|---|---|---|
| `23505` unique violation | `ConflictError` | no |
| `42P07`/`42701`/`42710` duplicate object | `ConflictError` | no |
| `23503` foreign key | `ConflictError` | no |
| `23502`/`23514` constraint | `ValidationError` | no |
| `40001`/`40P01` serialization, deadlock | `ExternalServiceError` | **yes** |
| `57014` statement timeout | `ExternalServiceError` | **no** — it will not return faster |
| `ECONNREFUSED`, `ECONNRESET`, … | `ExternalServiceError` | yes |

Details carry the constraint and table but **never** `error.detail`: Postgres puts the
offending row's values there (`Key (email)=(a@b.com) already exists`), which would echo user
data straight back onto the wire.

## Connection settings, and why

Set on every connection at checkout:

- **`statement_timeout`** — without it one pathological query holds a pool slot indefinitely.
  At `poolMax` such queries the pool is exhausted, every request blocks, and an unrelated slow
  query has taken the service down.
- **`lock_timeout`** — an unbounded wait behind someone else's uncommitted transaction
  exhausts the pool the same way.
- **`idle_in_transaction_session_timeout`** — an abandoned open transaction holds its locks
  and snapshot, blocking vacuum and other writers.

The pool's `error` handler is deliberately non-empty-but-silent: an idle client erroring
(server restart, proxy drop) is an `uncaughtException` if unhandled, turning a database blip
into a crash loop.

## Migration access (PAS-0102 consumes this)

`withMigrationLock` serialises concurrent migrators with a session-level advisory lock. A
rolling deploy starts several instances at once; without it they all apply the same migrations
and the losers crash-loop, or interleave DDL and leave the schema half-applied.

Session-scoped on purpose: if the process dies outright, Postgres releases the lock when the
connection closes. A row in a table would stay set forever.

## Migrations — PAS-0102

```bash
npm run migrate                # apply everything pending
npm run migrate -- status      # report without applying
npm run migrate -- --dry-run   # report what would be applied
```

Files are `migrations/NNNN_snake_case_name.sql`. The four-digit prefix is the ordering Part I
§4 requires — files have no inherent order, so it has to be in the name.

**The application never migrates.** Part I §4 forbids startup from creating tables
opportunistically. The migrator is a separate step a deploy runs before the new version
starts serving; the API only *reads* the migration state, and refuses readiness when the
database is behind the build.

### The four ways a migration system corrupts a schema

Each has an explicit check, because none is caught by "does the SQL run".

| | Failure | Prevention |
|---|---|---|
| 1 | An applied migration is edited, so environments diverge | Checksum recorded on apply; a mismatch refuses the run |
| 2 | A migration older than one already applied is applied now | Pre-flight comparison against the highest applied identifier |
| 3 | An applied migration is deleted, so clean builds differ from production | Ledger entries with no file refuse the run |
| 4 | The DDL commits and the bookkeeping row does not | Structural: they are **one transaction** |

(4) is the one that cannot be fixed by checking harder, so it is not checked — it is made
impossible. `recordApplied` takes the same client the DDL ran on. A test injects a failure
between the two and asserts the schema change rolls back with it; without that test, a
two-transaction implementation passes everything else in the suite.

Each migration gets its own transaction rather than one transaction around the whole run.
All-or-nothing is tempting, but it means a failure on migration 40 rolls back 39 good ones.
Per-migration atomicity gives a well-defined resume point.

### Reads never create the ledger

`migrationStatus` and `pendingMigrationCount` are read-only, including of the
`schema_migrations` table itself — an absent ledger reads as "nothing applied". Only the
migrator calls `ensureLedger`. The API's schema check calls the read path on every probe, and
a read that bootstraps its own table is still opportunistic table creation.

## Health

Two checks, registered by `apps/api` at PAS-0102, reported separately because they have
different operator responses: `database` means the database is unreachable — fix the
database; `database.schema` means it is reachable but behind this build — run the migrator.
Collapsing them would report "database down" during a perfectly healthy rolling deploy.

`databaseReadinessCheck` is the shape PAS-0005's registry consumes. `select 1` — deliberately
not `count(*)`, which gets slower as the database grows until it times out and reports an
outage that is really a large table.

## Running the tests

They need a real PostgreSQL — see `docs/operations/local-database.md`.
