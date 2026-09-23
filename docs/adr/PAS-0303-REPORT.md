# PAS-0303 — Event Ledger

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0303 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 03 — Audit and Event Infrastructure |
| **Depends on** | PAS-0301 ✅, PAS-0302 ✅ |

---

## Purpose

> Create immutable: `domain_events`. Application code may append. Application code may not
> edit historical events.

PAS-0302 defined the envelope. This is the table it lands in, the append path that writes it
inside the caller's transaction, and the read path consumers replay from.

---

## Files Created

| Path | What |
|---|---|
| `migrations/0005_create_event_ledger.sql` | `domain_events`, thirteen envelope fields plus `sequence` and `recorded_at`; append-only triggers; eight check constraints; five indexes |
| `packages/events/src/ledger/append.ts` | `appendDomainEvent`, `emitWithin`, `findCredentialShape` |
| `packages/events/src/ledger/read.ts` | `readDomainEvents`, `readAggregateStream`, `StoredDomainEvent` |
| `packages/events/src/ledger/index.ts` | barrel |
| `packages/events/tests/ledger.test.ts` | 47 tests across seven behaviours |

## Files Modified

| Path | Change |
|---|---|
| `packages/contracts/src/errors/scrub.ts` | `looksSensitive` extracted and exported as `looksLikeCredential` — one pattern list, two consumers |
| `packages/contracts/src/errors/index.ts` | export it |
| `packages/events/src/index.ts` | export the ledger; record PAS-0303 implemented |
| `docs/IMPLEMENTATION_PLAN.md` | PAS-0303 marked complete |
| `CLAUDE.md` | §5: two standing rules earned here — schema fixtures restore via migration; assert work done, not time elapsed |

---

## Decisions Made, Not Referred

### A credential in a payload is **refused**, not redacted

PAS-0301's audit ledger scrubs `metadata` with `scrubDetails`, which redacts on key name *and*
on value shape. That is right for audit: metadata is incidental context, and a redacted field
costs a debugging detail.

An event payload is not incidental — it is the canonical record, and consumers rebuild state
from it. The same treatment would be wrong twice:

- **Key-name redaction corrupts canonical data.** A claim about a password policy, a field
  named `tokenIssuer`, a credential *class* in a verification record — all legitimate, all
  matched by a key-name heuristic. Redacting them protects nothing and writes a falsified
  record into a table that can never be corrected.
- **Redaction is the wrong remedy for an immutable store.** For audit, whose purpose is
  observation, "this was written and we altered it" is acceptable. For a ledger consumers
  replay, a silently altered payload is a state divergence found months later.

So the append refuses, on **value shape only**, and because the event is written inside the
mutation's transaction (Part I §5) the mutation rolls back with it. Nothing is half-recorded.
Refusal is the honest choice *because* the table is immutable: what cannot be corrected
afterwards must not be written.

### One pattern list, not two

`looksSensitive` in `@pas/contracts` was already the shape judgement. It is now exported as
`looksLikeCredential` rather than copied. Two lists drift, and the weaker one would be the one
guarding the permanent store. A test asserts both reach the same verdict on the same input.

### `sequence bigserial`, carried forward from PAS-0301

PAS-0301 found that millisecond timestamps (PAS-0104) plus random identifiers (PAS-0103) leave
same-millisecond rows with no defined order. In `audit_entries` that cost legibility. Here it
costs **correctness**: PAS-0305's dispatcher claims work in order and consumers replay in
order, so two readers disagreeing is a state divergence. Every read orders by `sequence`, never
by `occurred_at`. Same caveats recorded at PAS-0301: assigned at INSERT rather than COMMIT, and
gapped by rollbacks — it is an ordering, never a count.

### `recorded_at` separate from `occurred_at`

They differ whenever an event records a moment that had already passed. Collapsing them loses
the distinction between when something happened and when the system learned of it, which is
exactly the distinction an investigation needs. `recorded_at >= occurred_at` is checked.

### No `supersedes` column

§21 says corrections are new events that supersede previous information. It states the
semantics and names no mechanism. Adding a column here would be implementation deciding
architecture (§LXI). A correction is a new event; nothing more is needed until a ticket asks
for it.

### `PascalCase` event types, enforced by the database

Matching Part I §5's `INSERT outbox_event ClaimApproved`. The aggregate is its own column, so a
prefixed `Claim.Approved` would duplicate it. `check (event_type ~ '^[A-Z][A-Za-z0-9]*$')`.

### The client is the first parameter of `emitWithin`

A call that omits it does not compile, where an optional trailing argument would simply be
absent. Part I §5 is a discipline the type system can hold rather than a convention a reviewer
has to catch.

---

## What the mutation sweep found

17 mutations across the migration, the append path and the read path.

| Pass | Detected | Survived |
|---|---|---|
| first | 14 | 3 |
| after the fixes below | **17** | **0** |

Six mutations survived across the two passes. Each is recorded because each was a real defect,
and three of them were defects in the *tests*, which is the harder kind to see.

### First pass — three survivors

#### 1. The depth cap was a false negative

`MAX_SCAN_DEPTH` was 12. A credential nested more deeply than that was **stored rather than
refused**, in a table with no delete path. The sweep did not find this directly — it flagged the
cycle guard as redundant, and chasing why exposed the cap as the thing actually terminating the
scan at shallow depths. Raised to 64, with a test that nests 24 deep.

#### 2. A self-healing fixture hid a migration defect

The test `refuses a stored row that violates the envelope contract` dropped the event-type
constraint and restored it in `finally` **from a hardcoded copy written in the test**. That
silently repaired the schema before the next test looked, so the `loose-event-type` mutation —
which loosens that constraint in the migration — survived.

Fixed by restoring through the migration itself (`drop schema public cascade` → `create schema
public` → `migrate`), never by re-declaring schema in a test. This is CLAUDE.md §5's
catalogue-over-enumeration rule applied to constraints: a fixture that re-declares schema is a
fixture that hides schema defects. `loose-event-type` is detected after the fix.

#### 3. `seen` looked like a performance guard and was not

Removing the `WeakSet` from `findCredentialShape` left all tests passing, and my first reading
was that the depth cap provides termination and `seen` only avoids redundant work — so the
mutation was behaviourally equivalent and should be recorded as such, per the precedent at
PAS-0103's dead `NIL_ID` check.

Measuring it said otherwise. Without `seen`, the walk costs one visit per **path** through the
payload rather than one per node, and no cycle is needed to make those diverge — a payload
whose levels share a child, the ordinary shape of anything serialised from a normalised
in-memory graph, goes exponential:

| levels of two-way sharing | with `seen` | without |
|---|---|---|
| 10 | 22 visits | 3,071 visits, 1 ms |
| 16 | 34 visits | 196,607 visits, 22 ms |
| 20 | 42 visits | 3,145,727 visits, 179 ms |
| 24 | 50 visits | 50,331,647 visits, **2,949 ms** |

At 40 levels it does not finish. And it does not fail to finish quietly: the scan runs inside
the caller's open transaction, so it holds row locks while it does not finish. That is a
write-time denial of service, not a slow function.

**The first test I wrote for it was also wrong.** It asserted elapsed time under a vitest
timeout — and the timeout never fired, because the recursion is synchronous and never yields
the event loop, so no timer can interrupt it. That test converted the defect into a hung CI job
instead of a failing one, which is strictly worse than not testing it. Replaced with a counting
getter that throws on the 101st read of a shared node: the same defect now terminates in 10 ms
with a message naming what went wrong, and the assertion is structural rather than temporal.

The comment in `append.ts` claiming the `WeakSet` "is what makes a cyclic payload terminate"
was backwards and has been corrected. The cap terminates; `seen` is what keeps the cost linear.

### Second pass — three more, all the same shape

`payload-may-be-scalar`, `actor-id-type-mismatch-ok` and `recorded-may-precede-occurred` all
survived: three database constraints with **nothing asserting them**. They were unreachable
through `appendDomainEvent`, because the envelope validates first — which is precisely why
nothing tested them, and precisely why they needed testing. A constraint no test exercises is
one a later migration can drop in silence, and these rows cannot be corrected afterwards.

One of them, `actor_id_matches_type`, is a claim this report makes under **Security / Privacy
Impact**. Shipping that claim with nothing verifying it would have been the report asserting
what the code did not hold.

Covered by a seventh `describe` that writes raw SQL, the same posture as the existing event-type
shape test: exercise the constraint from the path it actually guards. Each refusal is paired
with an acceptance, so a constraint mutated to `check (false)` cannot pass by rejecting
everything. All three now detected.

---

## The gap found after this report first said COMPLETE

This report was written, and the ticket committed, with **no integration coverage of the event
ledger at all**. The owner asked whether the platform had actually been run. It had not, as a
shipping artifact.

CLAUDE.md §4 already states the rule that was broken:

> Unit tests are not proof a process runs. Node packages build to `dist/` and run from there;
> unit tests resolve `@pas/*` to source. PAS-0005 shipped 27 green tests against an API that
> could not start.

`packages/events/tests/ledger.test.ts` imports from `../src/index.js`. Every one of its 133
green assertions ran against TypeScript source. `tests/integration/` — the place the rule names
as where anything with an entry point gets proved — contained nothing referencing
`domain_events`, `appendDomainEvent` or `emitWithin`. And `built-packages.test.ts` loaded five
packages from `dist/`; `events` and `auth` were not among them.

So the gap was never one ticket's. **Six tickets** (PAS-0202, 0203, 0204, 0301, 0302, 0303) had
shipped with their entire surface proved only against source.

The ledger does in fact work from `dist/` — the probe passed 7/7 on first run, so nothing
shipped broken. That is the outcome, not the justification: the rule exists because the failure
is invisible until someone looks, and nobody had looked.

**Closed by:**

| Added | What it proves |
|---|---|
| `tests/integration/event-ledger.test.ts` | append, read-back, immutability, credential refusal, §5 rollback, replay ordering and constraint enforcement — all against `dist/`, in a migrated scratch database |
| `tests/integration/fixtures/exercise-ledger.mjs` | the exercise itself, in a child process, so `@pas/database` binds to the scratch database rather than the suite's own |
| `built-packages.test.ts` | `auth` and `events` added to the loaded-from-`dist/` set |

Verified the new test can fail: dropping the ledger re-export from the `@pas/events` barrel and
rebuilding turns it red, naming the missing symbol. A test that has not been seen to fail is
not evidence.

---

## Security / Privacy Impact

- A payload containing a JWT, PEM private key, AWS key id, bearer token or password-bearing
  connection string is refused at write time, and the surrounding mutation rolls back with it.
- The check is value-shape only, never key name, so a legitimate field about credentials is not
  falsified.
- `UPDATE` and `DELETE` raise from triggers. There is no application path to either.
- A `SYSTEM` row cannot carry a user id (`(actor_type = 'USER') = (actor_id is not null)`) — a
  mismatched row reads, during an investigation, as that user having done it.
- Reads validate on the way out as well as on the way in, so a row written before a constraint
  existed cannot re-enter the application as a valid event.

---

## Backward Dependency Check

`@pas/events` depends on `@pas/contracts` (ADR-005), `@pas/database` and `@pas/config`
(ADR-006). No new workspace edge. `apps/web` is not a dependency of any domain package.

---

## Known Issues

None that hide an unmet acceptance criterion.

- `sequence` is gapped by rolled-back transactions and assigned at INSERT, not COMMIT — so a
  reader tailing the ledger can observe a gap that later fills. PAS-0305's dispatcher must not
  treat "no row at N+1" as "caught up". Carried to PAS-0304/0305, where the outbox is the
  mechanism that resolves it.
- `MAX_SCAN_DEPTH = 64` is still a cap: a credential nested *deeper* than 64 levels is stored
  rather than refused. 64 is far past any plausible payload — the previous value, 12, was not,
  and that is what made it a defect rather than a limit. The cost of raising it further is
  stack depth, not correctness.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Create immutable `domain_events` | ✅ `migrations/0005_create_event_ledger.sql` |
| Application code may append | ✅ `appendDomainEvent` / `emitWithin`, inside the caller's transaction |
| Application code may not edit historical events | ✅ `domain_events_no_update` trigger; no update path exists |
| Application code may not delete historical events | ✅ `domain_events_no_delete` trigger |
| Part I §5: event commits with its mutation | ✅ tested — a rolled-back mutation leaves no event |
| Part I §21: the required envelope, `journey_id` included | ✅ thirteen fields |
| Ordering defined for replay | ✅ `sequence bigserial`, every read ordered by it |

**No criterion is unmet. STATUS = COMPLETE.**

---

## Verification

| Gate | Result |
|---|---|
| `npm run ci` | ✅ green, twice consecutively |
| `packages/events` | 133 tests |
| migration validation | 5 migrations |
| frontend baseline | 3 artifacts unchanged vs `f23d11a` |
| mutation sweep | 17/17 detected |
