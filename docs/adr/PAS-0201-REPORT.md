# PAS-0201 — Account Schema

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0201 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 02 — Accounts, Authentication and Authorization (**opens Build 02**) |
| **Depends on** | Build 01 ✅ (PAS-0101…0104) |

---

## Purpose

`accounts`, `users` and `account_memberships`, such that account membership supports multiple
users managing shared organizational authority, and platform user identity stays distinct
from Authority Entity identity (Part I §6: **User ≠ AuthorityEntity**).

### Scope, read narrowly and deliberately

PAS-0201's text is three tables. The typed row accessors that `packages/auth/` will hold are
not in it — they are how PAS-0202 onward *use* the schema, and writing them here would be
scope I added rather than scope I was given.

That reading also matters for authority: `packages/auth` has **no declared dependencies**
(PAS-0001), so accessors would require `@pas/auth → @pas/database` and `→ @pas/domain`, two
new workspace edges that ADR-005 holds for ratification. This ticket needs neither, because
a migration imports nothing. See *Backward Dependency Check* for what PAS-0202 will need.

---

## Files Created

| Path | Purpose |
|---|---|
| `migrations/0001_create_account_domain.sql` | the three tables — **the repository's first migration** |
| `tests/integration/account-schema.test.ts` | 22 tests against a migrated database |

## Files Modified

| File | Change |
|---|---|
| `tests/integration/harness.ts` | scratch-database helpers, extracted from three copies |
| `tests/integration/api-process.test.ts` | made hermetic — see *Defects Found* |
| `tests/integration/account-schema.test.ts` | uses the shared helpers |

**No new workspace dependency edges.**

---

## Database Migrations

**`0001_create_account_domain.sql`** — the first migration the repository has ever carried.
PAS-0102 built the mechanism against temporary directories; this is the shipped path running
for real, and it made PAS-0102's `applies the repository's own migrations to an empty
database` test non-degenerate for the first time.

### The model

| Table | Is |
|---|---|
| `accounts` | the tenant that **owns** authority. Part I §8 gives `authority_entities` an `owner_account_id`, so the owner is an account and never a user |
| `users` | a human login. Never a subject of authority |
| `account_memberships` | many-to-many, **in both directions** |

Both directions is the whole point. "Account membership supports multiple users managing
shared organizational authority" gives one account many users; "a user account may manage …
multiple organizations" gives one user many accounts. A user bound to exactly one account
could be quietly treated as the subject it manages. A user in four accounts cannot be — which
is how **User ≠ AuthorityEntity** becomes structural rather than a note in a document.

### Decisions worth stating

| Decision | Why |
|---|---|
| `uuid` primary keys, **no `gen_random_uuid()` default** | PAS-0103 is the one source of identity. A database-side default is a second one, and an INSERT that forgot to supply an id should fail loudly rather than quietly mint one outside the service |
| `timestamptz(3)`, **no `now()` default** | PAS-0104's recorded contract. The `(3)` is load-bearing — PostgreSQL defaults to microseconds, JavaScript `Date` holds milliseconds, and an undeclared column round trips lossily |
| `check (updated_at >= created_at)` on all three | A row claiming it was modified before it existed breaks every "changed since" query. **The cost is explicit:** a create-then-update inside the clock skew between two API instances is rejected rather than stored. Revisit if sub-second cross-instance update becomes normal |
| `email_normalized` **generated**, unique | `Bob@Example.com` and `bob@example.com` are otherwise two users who believe they are one. Generated means a writer that forgot to normalise is refused by the database, which application-side normalisation cannot guarantee. The address as entered is preserved for correspondence |
| `on delete restrict`, not cascade | Authority outlives the account that owns it. RESTRICT makes the database enforce no-hard-deletes instead of trusting every future writer; closing is a `status` |
| `text` + `check`, not `enum` | Part I §8 says the types are "initially" two. Adding a value to a check is an ordinary migration; `ALTER TYPE … ADD VALUE` is not reversible in one |
| **No role column on memberships** | Roles are PAS-0203 (`membership_roles`). A `role text` here would decide the authorization model a ticket early, and it is the kind of column nothing ever removes once something reads it |
| **No credentials** | Password material is PAS-0202's, alongside `sessions` and `authentication_events` |
| **No FK to `authority_entities`** | That table is Build 04. The edge points from the entity to the account, not the reverse |

---

## Domain Contracts Added/Changed

None in code. The schema is the contract this ticket adds.

---

## API Contracts / Events / Workflow / Governance / Authorization

None. No route, no event, no authorization decision — PAS-0204 is the authorization service,
and nothing may be enforced before it exists.

---

## Tests Added

**`tests/integration/account-schema.test.ts` — 22 tests**, against a database created empty
for the run and migrated by the **built** migrator. A schema is a set of promises the
database makes, so every constraint is asserted by attempting the write it must refuse.

| Group | Tests |
|---|---|
| what the ticket asks for | the three tables exist; `uuid` ids with **no database-side default**; `timestamptz` at **precision 3** on all six columns; a canonical instant round trips without losing or gaining precision |
| **User ≠ AuthorityEntity** | `users` has exactly six columns and none points at a subject of authority (`authority_entity_id`, `entity_id`, `person_id`, `pas_id` each asserted absent); many users manage one organizational account; one user manages a personal account and three organizations |
| constraints refuse | duplicate membership; case-differing addresses; a padded address; `email_normalized` cannot be written directly; unknown `account_type` and `status`; blank display name; five malformed addresses; `updated_at` before `created_at` on all three tables; membership referencing a missing account or user; deleting an account or user that still has a membership |
| indexing | `account_memberships` is indexed by `user_id` alone — the unique constraint leads with `account_id` and does not serve the Part I §6 question |

### Mutation testing

Ten mutations, **ten detected**. Every constraint is load-bearing.

| Mutation | Result |
|---|---|
| membership unique constraint removed | 1 failed |
| `email_normalized` made a plain column | 3 failed |
| `on delete restrict` → `cascade` | 1 failed |
| `updated_at >= created_at` neutered | 1 failed |
| `timestamptz(3)` → `timestamptz` | 1 failed |
| `default gen_random_uuid()` added | 1 failed |
| `user_id` index removed | 1 failed |
| email shape check removed | 2 failed |
| blank-name check removed | 1 failed |
| `account_type` check loosened | 1 failed |

---

## Tests Passed

```
npm run ci   (run twice consecutively — see Defects Found)
  typecheck            ✅
  lint                 ✅  0 errors
  unit tests           ✅  @pas/contracts 77 · @pas/database 62 · @pas/domain 23 · @pas/observability 37
  production build     ✅
  integration tests    ✅  48 (7 + 7 + 12 + 22)
  migration validation ✅  1 migration
  frontend baseline    ✅  byte-identical to f23d11a
```

---

## Defects Found and Fixed During This Ticket

### 1. A schema defect: `btrim()` in the generated column was unreachable

`email_normalized` was `lower(btrim(email))`, intended to make `'  bob@example.com  '` a
duplicate of `'bob@example.com'`. It cannot: `users_email_shape` rejects any address carrying
whitespace, so the `btrim()` could never fire. Found by the first test run — the padded
duplicate was refused by `23514` (check violation), not `23505` (unique violation).

Same class as PAS-0103's dead `NIL_ID` comparison: a defence that looks load-bearing and
reaches nothing. Removed. Normalisation is now case folding only, and there is an explicit
test asserting that a padded address is refused **outright** rather than trimmed — because a
database that silently stored an address it had altered would leave PAS sending mail to a
value nobody supplied.

### 2. A test that could not fail for the reason it claimed

An assertion that the planner *chooses* the `user_id` index. PostgreSQL serves a `user_id`
predicate from the `(account_id, user_id)` unique index by full bitmap scan at identical cost
whether or not the dedicated index exists — verified directly, both plans byte-identical.
The test passed with the index dropped. Removed, with the finding recorded in place of it;
the structural assertion that the index exists and covers the column is what is load-bearing.

### 3. Two of my own test suites corrupting a shared database

The one that mattered. `npm run ci` failed on its **second consecutive run** with
`migrate failed: database.duplicate_object`.

`packages/database/tests/migrate.test.ts` drops `schema_migrations` as a fixture — correctly,
the ledger being exactly what it tests — against `pas_test`. `api-process.test.ts` then
migrated the same `pas_test` and expected the result to persist. After both ran, `pas_test`
held the three tables with an **empty ledger**: schema and ledger diverged, which is
corruption mode 4, produced by my own fixtures.

The migrator refused, correctly and loudly. Nothing was wrong with PAS-0102; the defect was
the shared fixture. `api-process.test.ts` now creates its own database, like the two suites
that already did, and the scratch-database helper is extracted into `harness.ts` — three
copies having appeared, which is the drift signal. `npm run ci` now passes twice in a row,
which it did not before.

---

## Typecheck / Lint / Build

Clean.

---

## Security / Privacy Impact

- **No authorization is implied by this schema and none may be inferred from it.** Membership
  says a user is attached to an account; it says nothing about what they may do. That is
  PAS-0203/0204, and PAS-0205 is where it is proved. A reader tempted to treat "has a
  membership" as "may act" should note there is deliberately no role column to encourage it.
- **`MasterAdminView` remains unguarded.** Recorded in `docs/RECONCILIATION.md:757` with its
  migration requirement (*"Real authorization — this is a high-risk capability under R0–R5
  and must not ship without it"*). Nothing in this ticket changes it, and nothing in this
  ticket makes it worse. It is Phase 11 plus PAS-0204.
- **Email is personal data.** Stored once, as entered, with a derived column for uniqueness.
  No email appears in any index name, error message or log emitted by this migration.
- **No hard deletes**, enforced by RESTRICT rather than convention, so an erasure request
  becomes a deliberate operation rather than a cascade nobody reviewed.

---

## Backward Dependency Check

No new workspace edges. A migration imports nothing.

**`apps/web` is not a dependency of any domain package.** Re-verified.

### Coming at PAS-0202 — two edges to ratify

`packages/auth` carries **no declared dependencies** (PAS-0001). Implementing sessions and
authentication will require:

| Edge | For |
|---|---|
| `@pas/auth → @pas/database` | `query`, `withTransaction` — PAS-0101 forbids any other route to the database |
| `@pas/auth → @pas/domain` | `generateId`, `Id` — PAS-0103 is the only identity source |

Neither creates a cycle. Both are **proposed and held** under ADR-005; PAS-0202 does not start
until they are ratified. `@pas/auth → @pas/contracts` needs no proposal — ADR-005 settled
`contracts` as dependable by any package.

### ADR-002 consumer sweep — Build 02 opening sweep

This build introduces identity and access, so every component that today decides *who someone
is* or *what they may do* was inspected.

| Site | Finding | Disposition |
|---|---|---|
| `components/admin/MasterAdminView.tsx` | platform "god view" — total users, MRR, verification queues — reachable at `App.tsx:170` via `activeRoute === 'admin'` with **no access control of any kind** | **Already recorded**, `docs/RECONCILIATION.md:757`, with the migration requirement. No new SUP. Resolution is PAS-0204 + Phase 11 |
| `store/usePASStore.ts:503` `setEnvironment` | the only "environment" gate is a plain store setter any code may call | Preserved (ADR-003). It is presentation state, not authorization, and PAS-0205 exists to prove exactly that frontend behaviour is irrelevant to server authorization |
| `store/usePASStore.ts:129-134` | user identity is four loose strings — `userName`, `userTitle`, `userLocation`, `userBio` | **Already recorded** as INV-2's "Currently". Superseded by `users` + `accounts` |
| `types/pas.ts:273, 280` `roleInEcosystem`, `role` | free-text strings on relationship/team records, not access control | Not a consumer. They describe a person's role *in the world*, which is authority data, not a capability grant |
| Backend | no identity, session, role or capability anywhere | — |

**No consumer required a change in this build**, and nothing found was unrecorded.

---

## Forward Dependencies Unlocked

PAS-0202 (sessions, authentication events — FK to `users`) · PAS-0203 (capability registry —
`membership_roles` FK to `account_memberships`) · Build 04 (`authority_entities.owner_account_id`
FK to `accounts`, Part I §8).

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **`packages/auth/` is still an empty scaffold.** Deliberate, and stated in *Scope* above:
   PAS-0201's text is three tables. The accessors arrive with PAS-0202, together with the two
   dependency edges it must first have ratified.

2. **Part I §6 and PAS-0203 disagree on one table name** — §6 says
   `user_capability_overrides`, PAS-0203 says `capability_overrides`. Not this ticket's to
   resolve; recorded here so it is not discovered mid-implementation. Both are Clean-Sheet
   (Part I and Part II), so the authority hierarchy does not settle it by itself and it may
   need the owner.

3. **`check (updated_at >= created_at)` converts clock skew into a write failure.** Stated in
   the migration and above. Accepted deliberately; the alternative is storing rows that
   break every "changed since" query.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Create `accounts` | ✅ with type, display name, status, PAS-0103 identity, PAS-0104 timestamps |
| Create `users` | ✅ with database-enforced address uniqueness on the case-folded form |
| Create `account_memberships` | ✅ many-to-many, one row per pair, RESTRICT on both edges |
| Account membership supports multiple users managing shared organizational authority | ✅ tested — three users on one organizational account |
| Part I §6 — keep platform user identity distinct from Authority Entity identity | ✅ tested — `users` carries no column pointing at a subject of authority, and one user manages a personal account plus three organizations |
| Part I §8 — the owner of authority is an account | ✅ `accounts` is the tenant; no `owner_user_id` anywhere |
| PAS-0102 — deterministic, ordered, CI-validated migration | ✅ `0001_create_account_domain.sql`; `npm run validate:migrations` green; applied by the built migrator in CI |
| PAS-0103 — durable non-semantic identity | ✅ `uuid`, no database-side default |
| PAS-0104 — canonical UTC timestamps | ✅ `timestamptz(3)`, no database-side default, monotonicity checked |

**No criterion is unmet. STATUS = COMPLETE.**
