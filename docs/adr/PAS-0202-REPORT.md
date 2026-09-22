# PAS-0202 — Authentication

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0202 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 02 — Accounts, Authentication and Authorization |
| **Depends on** | PAS-0201 ✅ (`users`), Build 01 ✅, **ADR-006** (ratified edges) |

---

## Purpose

Secure authentication and session infrastructure: `sessions` and `authentication_events`, with
authentication kept separate from Authority Entity identity.

---

## Files Created

| Path | Purpose |
|---|---|
| `migrations/0002_create_authentication.sql` | `user_credentials`, `sessions`, `authentication_events` |
| `packages/auth/src/password/hash.ts` | scrypt hashing, self-describing encoding, rehash detection, policy |
| `packages/auth/src/session/tokens.ts` | token generation and digesting |
| `packages/auth/src/session/sessions.ts` | issue, resolve, revoke, revoke-all |
| `packages/auth/src/events.ts` | append-only authentication events, failure counting |
| `packages/auth/src/authenticate.ts` | the login flow, `setPassword` |
| `packages/auth/tests/password.test.ts` | 20 tests, no database |
| `packages/auth/tests/authentication.test.ts` | 25 tests against a real PostgreSQL |
| `packages/auth/README.md` | the contract and the reasoning |

## Files Modified

| File | Change |
|---|---|
| `packages/config/src/schema.ts`, `load.ts`, `.env.example` | **argon2id parameters replaced with scrypt**; `session.idleTimeoutSeconds` added |
| `packages/auth/package.json`, `tsconfig*.json`, `vitest.config.ts` | the package had never been built |
| `packages/database/tests/migrate.test.ts` | resets by dropping the schema, not an enumerated table list — see *Defects* |
| `tests/integration/account-schema.test.ts` | catalogue-driven truncation; containment assertions — see *Defects* |
| `CLAUDE.md` | two standing rules earned here: fixtures read the catalogue; a suite that migrates a shared database owns its starting state |
| `package.json`, `vitest.shared.ts` | `@pas/auth` in the build order and source aliases |

---

## Decisions Made, Not Referred

### scrypt from `node:crypto`, not argon2id

PAS-0002 declared argon2id parameters in configuration before there was an implementation to
hold them to. Implementing it changed the answer, so the configuration changed.

argon2id is OWASP's first choice and scrypt its second; both are memory-hard and the gap is
small. The gap between *Node standard library* and *native module built by node-gyp at install
time* is not: a compiler on every build host, a prebuild per platform, and third-party native
code on the most security-critical path in the system. WASM builds avoid the compiler and pay
in CPU per login — the one resource an unauthenticated caller can spend.

**The cost of being wrong is near zero**, which is what makes this the right call rather than a
gamble. Every hash is stored self-describing:

```
scrypt$ln=16,r=8,p=1$<salt>$<key>
```

Adopting argon2id later is one new branch in `verify` plus rehash-on-login. No migration, no
forced reset, no flag day.

### Parameters that contradict OWASP's published tiers, on measurement

OWASP raises `p` as `N` falls. Node runs scrypt's `p` **sequentially**, so it multiplies CPU
without the parallelism those tiers assume. Measured here:

| | memory | time | hardness/second |
|---|---|---|---|
| `ln=15 r=8 p=3` — OWASP's tier | 32 MiB | 272 ms | 118 MiB/s |
| `ln=16 r=8 p=1` — **chosen** | 64 MiB | 205 ms | 312 MiB/s |

Twice the memory hardness for three quarters of the time. Recorded with the numbers so it can
be re-checked on production hardware rather than believed.

### Credentials in their own table

`select * from users` is written a hundred times over a codebase's life — in handlers, joins,
debug logging. Every one is a place a hash can reach a log or a response body. A hash in
another table cannot be selected by accident.

### The session token is never stored

256 bits of CSPRNG output handed to the client once; the database holds only its SHA-256. A
disclosed backup, replica or query log yields nothing presentable as a session.

No KDF on this path: a KDF defends a *guessable* secret against offline search, and a uniformly
random 256-bit value has no dictionary. scrypt here would add ~200 ms to every authenticated
request for nothing.

### Two expiries

Absolute (`expires_at`) bounds how long a stolen token is ever useful; idle (`last_seen_at`)
closes an abandoned session on a shared machine long before that. Either alone is insufficient.
The idle clock advances **only on a resolution that succeeds**, so requests bearing a dead
token cannot keep it alive.

---

## Database Migrations

**`0002_create_authentication.sql`.** Three tables, all carrying PAS-0103 identity and
PAS-0104 `timestamptz(3)`.

Constraints worth naming:

| Constraint | Refuses |
|---|---|
| `user_credentials_hash_shape` | a plaintext password written into the hash column — otherwise stored and later "verified" against itself |
| `user_credentials_user_unique` | a second live credential. Password *history* is a separate table if ever needed; history must never be a candidate for authentication |
| `sessions_revocation_complete` | a revocation without a reason, or a reason without a revocation — a row nobody can interpret during an incident |
| `authentication_events_type_check` | an unknown event type |
| `authentication_events_user_agent_length` | the column becoming a free-text sink |

`authentication_events` has **no foreign key to `sessions`**: the event outlives the session,
and an audit row a future delete could orphan is not an audit row.

---

## API Contracts / Events / Workflow / Governance / Authorization

None. **Nothing in this package decides what a user may do** — that is PAS-0203/0204.

---

## Tests Added

**45 tests.** The properties worth testing are negatives: what login must not reveal, what the
database must not hold, what a rejected session must not still permit.

| Group | Tests |
|---|---|
| hashing | self-describing; never repeats (salted); verifies; rejects near-misses; NFKC-normalises so a password re-typed on another keyboard still works |
| verification is total | six malformed hashes return **false, never throw** — a caller one `catch` from that distinction can be made to reveal it; absurd parameters refused rather than attempted (`ln=30` from a compromised row is an OOM kill) |
| cost raisable | recognises a below-policy hash; still verifies it; a stronger-than-policy hash is not downgraded |
| policy | configured minimum; **characters not UTF-16 units** (six emoji are not twelve characters); 1024-char bound so an unauthenticated caller cannot choose the work; no composition rules (NIST) |
| enumeration | one indistinguishable failure across unknown address / wrong password / no credential / suspended; **timing comparable** for unknown vs real; **timing comparable** for suspended-with-correct-password vs active-with-wrong; failures for unknown users store neither the address nor the password |
| lockout | blocks after the configured count, refusing even the correct password; counts only inside the window; does not lock a non-existent account |
| what is not held | token digest never the token; no password columns on `users`; plaintext in the credential column refused |
| session shape | no column pointing at a subject of authority |
| lifecycle | resolve; absolute expiry; idle expiry; **a failed resolution does not refresh the idle clock**; a successful one does; revoked sessions kept for audit; re-revocation keeps the first reason and emits one event; revoke-all is one statement and not double-counted |
| rotation | replaces rather than appends; leaves sessions alone (the caller's decision); **upgrades a weak hash on next login** |

### Mutation testing

Seventeen mutations across five files.

| Mutation | Result |
|---|---|
| decoy hash skipped for an unknown address | 1 failed |
| unknown address given its own failure reason | 2 failed |
| attempted email written to the event log | 1 failed |
| lockout disabled | 1 failed |
| rehash-on-login removed | 1 failed |
| **raw token stored instead of its digest** | **9 failed** |
| revocation ignored on resolve | 3 failed |
| absolute expiry ignored | 1 failed |
| idle expiry ignored | 3 failed |
| idle clock touched before the checks | 2 failed |
| `timingSafeEqual` replaced by string comparison | 1 failed |
| **salt made constant** | **2 failed** |
| absurd-parameter guard removed | 2 failed |
| token shortened to 32 bits | 2 failed |
| **account status checked before the hash is spent** | **1 failed** |
| account status test reordered *within* the `if` | **survived — correctly** |

**The survivor is the finding.** I had written that checking account status *after* the
password is what stops status being an enumeration oracle. It is not: `verifyPassword` runs
unconditionally on the preceding line, so which operand of the `||` short-circuits first is
immaterial. The mutation was semantically equivalent and the tests were right to pass it.

The comment was wrong, not the code. It is corrected, and the mutation that *is* an oracle —
status checked **above** the hash, so suspended accounts answer in microseconds — was written,
run, and is detected by a new timing test.

Two mutations were rebuilt because the first attempts were unsound: `no-lockout` originally
used `if (false)`, which failed the **typecheck** rather than a test, proving nothing about
test coverage. Re-run as `>= Number.MAX_SAFE_INTEGER`, it compiles cleanly and fails a test.

---

## Defects Found and Fixed During This Ticket

### 1. A mutated file staged into the git index

The serious one. `git add -A` was run to stage the README **while the mutation sweep was
mid-flight**, capturing `sessions.ts` carrying the `touch-before-checks` mutation — the idle
clock updated *before* the revocation and expiry checks, which keeps revoked and expired
sessions alive.

The working tree was correct; the index was not. Caught by checking `git diff` before
committing rather than trusting the sweep's own restore. Re-staged from the restored tree and
verified by grepping every mutated construct back to its original.

**Process change:** never stage while a mutation sweep is running. The sweep owns the working
tree for its duration.

### 2. The same shared-fixture corruption as PAS-0201 — because I fixed the symptom

CI failed, `EXIT=1`, with `ConflictError: The database object already exists.` from the auth
suite's `beforeAll`.

PAS-0201 hit this and I fixed it by making `api-process.test.ts` hermetic. That was the
**symptom**. The cause is that `packages/database/tests/migrate.test.ts` destroys
`schema_migrations` on a shared database — legitimately, the ledger being its subject — while
leaving migrated tables standing. Any suite that later calls `migrate()` on that database
finds objects it is about to create and refuses. Correctly: it is corruption mode 4, and the
migrator exists to refuse it.

Making one suite hermetic did not fix that for the next suite, and PAS-0202 added the next
suite. It would have kept recurring for every package that touches the database.

Two changes, at the cause this time:

- `migrate.test.ts` now resets with `drop schema public cascade` rather than an enumerated
  list of tables. The list was written when the repository had no migrations at all; PAS-0201
  silently made it incomplete, and every future migration would have broken it again. A suite
  whose subject is "what happens to an empty database" should leave one, and dropping the
  schema is self-maintaining where a list is not.
- The auth suite resets before it migrates, so it depends on no other suite's cleanup. A
  suite that assumes a consistent schema *and* ledger on a shared database is assuming
  something no other suite is obliged to preserve.

Verified by running the two suites in both orders, repeatedly, and by a clean `npm run ci`.

### 3. Five hard-coded schema facts, all invalidated by one migration

Adding `0002` broke, in the same CI run:

| Fixture | How it broke |
|---|---|
| `migrate.test.ts` drop list | enumerated four `mig_*` tables and the ledger; left PAS-0201's three standing |
| `account-schema.test.ts` truncate list | `truncate users` now fails — three new tables reference it |
| `authentication.test.ts` truncate list | complete today, editable by every future migration |
| `account-schema.test.ts` table-set assertion | asserted schema **equality**, so any new table fails a PAS-0201 test |
| `account-schema.test.ts` migration count | `applied 1 migration(s)` |

Every one was correct when written and silently wrong the moment a migration landed, and each
surfaced as a test failure that reads like a product failure.

Fixed as a class, not as five instances: drop the schema wholesale, compute truncation from
`pg_tables`, assert **containment** of the tables a ticket is about, and name a migration
rather than count them. Recorded as a standing rule in `CLAUDE.md` §5 — a fixture that every
future migration must remember to edit will not be edited.

### 4. `recordAuthenticationEvent` bypassed PAS-0101 on the transaction path

First draft branched to `client.query(...)` when given a client, and `query(...)` otherwise.
That path skips the correlation comment **and** `toDatabaseError`, whose whole job is that a
raw driver error — carrying the connection string — never escapes the package. `query` already
accepts `options.client`; everything now goes through it.

### 5. Four tests tried to build sessions that cannot exist

Backdating `last_seen_at` or `expires_at` alone produced rows seen before they existed.
PAS-0201's monotonicity constraints refused them — working correctly, against my own tests. An
aged session is now aged in every column.

### 6. A timing test that tripped the lockout it shares a user with

The status-timing test spent exactly `maxFailedAttempts` failures before its final assertion,
which then saw `LOCKED_OUT`. Correct behaviour, wrong test: the outcome is now asserted before
the timing loop consumes the budget.

### 7. `promisify(scrypt)` silently drops the parameters

`promisify` collapses `scrypt`'s overloads onto the one without options, so every hash would
have used Node's defaults while the configuration appeared to be in force. Caught by the
typechecker. Wrapped by hand instead.

---

## Security / Privacy Impact

This ticket is almost entirely security surface. Stated positively:

- **No enumeration oracle.** One failure message, and comparable timing for unknown addresses,
  locked accounts and suspended accounts. All three are tested, not asserted.
- **A database disclosure yields no live sessions** — digests only.
- **A database disclosure yields no passwords** — salted, memory-hard, 64 MiB per attempt.
- **Compromised `user_credentials` rows cannot be weaponised into a denial of service** —
  parameters from the database are bounds-checked before use.
- **The event log holds no password, no token, and no address attempted for an unknown user.**
  Recording what was typed produces a permanent log of other people's addresses and, whenever
  someone types their password into the email field, of their password.
- **`LOCKED_OUT` must be rendered as `INVALID_CREDENTIALS` by callers.** It is returned
  distinctly so a caller can log and rate-limit accurately; the distinction is for the audit
  trail, not the response body. Stated in the README and at the type.

**Not yet done, and not this ticket:** rate limiting by source address. The data is recorded
(`authentication_events.source_ip`, indexed) but nothing enforces on it. Lockout is per-user
and does not bound an attacker spraying one attempt each across many accounts. This belongs
with the HTTP layer, where the source address is actually known.

---

## Backward Dependency Check

`@pas/auth → @pas/database`, `@pas/auth → @pas/domain`, `@pas/auth → @pas/contracts`,
`@pas/config`, `@pas/observability`. All ratified by **ADR-006**. No cycle.

**`apps/web` is not a dependency of any domain package.** Re-verified.

---

## Forward Dependencies Unlocked

PAS-0203 (capability registry — `membership_roles`, `capability_overrides` per **ADR-007**) ·
PAS-0204 (authorization service, which consumes a resolved session) · PAS-0205 (authorization
security tests, which need a session to act with).

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **No rate limiting by source address.** See *Security* above. The data is recorded and
   indexed; enforcement belongs at the HTTP layer.
2. **No password history.** Deliberate: `user_credentials` holds one live credential per user,
   and history has different retention and must never be a candidate for authentication. A
   separate table if ever required.
3. **Sessions are not pruned.** Expired and revoked rows accumulate; they are kept for audit.
   Retention belongs with PAS-0301's ledger, which will govern audit retention generally.
4. **`setPassword` does not revoke sessions.** Deliberate and documented: an administrative
   reset and a routine self-service change want opposite behaviour, and silently ending every
   session of a user who merely rotated a password is the kind of surprise that gets worked
   around by not rotating. `revokeAllSessionsForUser` is one call.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Implement secure authentication/session infrastructure | ✅ memory-hard hashing with raisable cost, digest-only session storage, two expiries, lockout, append-only events |
| Create `sessions` | ✅ |
| Create `authentication_events` | ✅ append-only; no update or delete path exists |
| Authentication and Authority Entity identity remain separate | ✅ a session references `users` and nothing else; asserted over `information_schema` |
| PAS-0002 — `minPasswordLength`, `maxFailedAttempts`, `lockoutSeconds` honoured | ✅ all three, tested |
| PAS-0103 — identity from the canonical service | ✅ `generateId()` throughout; no database-side default |
| PAS-0104 — canonical UTC timestamps | ✅ `timestamptz(3)`, monotonicity constrained |
| PAS-0101 — no route to the database but `@pas/database` | ✅ including on the transaction path, after a defect that bypassed it |

**No criterion is unmet. STATUS = COMPLETE.**
