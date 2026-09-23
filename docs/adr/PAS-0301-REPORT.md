# PAS-0301 — Audit Ledger

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0301 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 03 — Audit and Event Infrastructure (**opens Build 03**) |
| **Depends on** | Build 01 ✅, Build 02 ✅ |

---

## Purpose

`audit_entries`, with sensitive values redacted, written in the same transaction as the
mutation it records.

---

## Scope: PAS-0301's field list is the minimum, not the ceiling

PAS-0301 names ten fields. **Part I §23 is binding and requires more:**

> actor · action · target · **before/after reference where appropriate** ·
> **authorization result** · **governance decision** · correlation ID · timestamp · **origin**
>
> "Administrative activity must also be audited."

The union is what was built. Resolving upward (CLAUDE.md §2) means the stricter of two
Clean-Sheet statements governs, not the one the ticket happens to enumerate.

`origin` is ADR-004's list, so a later question — was this asserted by a person or proposed by
an extractor — is answerable from the record rather than inferred.

---

## Files Created

| Path | Purpose |
|---|---|
| `migrations/0004_create_audit_ledger.sql` | the table, its constraints, its ordering column and the append-only triggers |
| `packages/events/src/audit/types.ts` | the entry shape |
| `packages/events/src/audit/record.ts` | `recordAuditEntry`, `auditWithin` |
| `packages/events/src/audit/read.ts` | `readAuditEntries` |
| `packages/events/tests/audit.test.ts` | 31 tests |

## Files Modified

| File | Change |
|---|---|
| `packages/events/package.json`, `tsconfig*`, `vitest.config.ts` | the package had never been built |
| `package.json`, `vitest.shared.ts` | `@pas/events` in the build order and aliases |
| `docs/IMPLEMENTATION_PLAN.md` | audit re-homed — see below |

Edges: `@pas/events → contracts, database, domain, observability`. All ratified by **ADR-006**;
no proposal needed.

---

## Decisions Made, Not Referred

### The plan's own mapping would have created a dependency cycle

`IMPLEMENTATION_PLAN.md` put PAS-0301 in `packages/observability/`. But `@pas/database`
depends on observability — `query.ts` reads the correlation context to build its
instrumentation comment — so an audit writer there closes
`observability → database → observability`.

That mapping predates PAS-0101, which established the direction. The plan is implementation's
own document mapping tickets to paths, not the specification, so **the plan was corrected**
rather than the architecture.

Audit now lives in `packages/events/src/audit/`, which is also where it belongs: audit entries
and outbox events are siblings — both append-only ledgers written in the same transaction as
the mutation they record, per Part I §5's worked example. Keeping `observability` a leaf on
`contracts` also preserves PAS-0004's own reasoning, that correlation must work before any
domain object exists.

### The writer does not own a transaction

`recordAuditEntry` takes the caller's client and opens nothing. Part I §5 is explicit:

```
BEGIN
  UPDATE claim …
  INSERT claim_version …
  INSERT audit_entry …
  INSERT outbox_event ClaimApproved …
COMMIT
```

A writer managing its own transaction would commit the audit entry whether or not the mutation
survived — **a record of something that never happened, which is worse than no record, because
it is believed.**

`auditWithin(client, entry)` takes the client **first**, so a call that omits it does not
compile, where an optional trailing argument would simply be absent.

### Redaction reuses PAS-0003's scrubber

*"Sensitive values must be redacted appropriately."* Metadata is assembled at a call site from
whatever context was to hand, which is exactly how a token or a connection string ends up in
it — and audit is the table that is never deleted, so a leak into it is permanent.

`scrubDetails` from `@pas/contracts` is the same pass that guards error responses. A second
redactor written here would drift, and the weaker one is the one that leaks (SUP-9's
two-generators problem). A test asserts the stored metadata equals `scrubDetails(input)`
exactly, so the two cannot diverge.

Non-object input is wrapped rather than dropped: losing audit detail silently is the one
outcome worse than keeping it.

### Before/after are references, never values

§23 says "before/after **reference** where appropriate". Copying the values in would duplicate
whatever made them sensitive into the table that is never deleted.

### Append-only, enforced by the database

UPDATE and DELETE raise, via triggers. **The person who needs to edit the audit log is exactly
the person who must not be able to**, and a convention does not stop them. A test also asserts
the module exports no `updateAuditEntry`, `deleteAuditEntry` or `purgeAuditEntries`.

### Authorization results are recorded per action, not per check

§23 requires "authorization result". PAS-0204 returns a decision on every permission check;
recording all of them would be a write per read. The interesting fact is what was *permitted*,
so the audit entry for an action carries the decision that allowed it. `authorization_reason`
is stored but internal, exactly as in PAS-0204.

### The reader does not authorize itself

Reading the audit record is `audit.read` (PAS-0203), decided by PAS-0204 against the account
being read. `read.ts` checks nothing — a reader that authorized itself would be the bypass
PAS-0204's guard exists to prevent. A test asserts the module references neither `authorize(`
nor `requireCapability`.

---

## The Finding: an audit log with no defined order

A test caught three entries written in a loop coming back shuffled.

PAS-0104 fixes canonical timestamps at **millisecond** precision. PAS-0103 makes identifiers
**random**, with no sequence meaning. Both are right. Together they leave entries written
inside one millisecond with **no defined order at all** — `order by occurred_at, id` falls back
to comparing random UUIDs. "What happened first" is a core audit question, and the ledger could
not answer it.

This is exactly the remedy PAS-0103's own report named:

> *If it is ever measured to matter, the answer is a separate insert-ordered column that the
> schema owns, never meaning smuggled back into identity.*

The prediction arrived two builds later. `audit_entries` now carries `sequence bigserial`, with
both caveats stated in the migration:

- assigned at **INSERT**, not COMMIT, so a long transaction can hold a lower number and land
  later — within Part I §5's pattern the entry commits with its mutation, so this orders
  operations as they happened;
- rolled-back transactions consume numbers, so gaps are expected. It is an ordering, **never a
  count**.

**The first test for it was flaky by luck.** It wrote in a tight loop and asserted the
timestamps collided — but each write is a database round trip taking more than a millisecond,
so they usually did not. It would have passed for the wrong reason on a slow machine and failed
on a fast one. The test now **forces** the collision by giving every entry the same
`occurredAt`, making ordering by timestamp provably ambiguous so only the sequence can resolve
it. A second test covers a backdated entry, which must not reorder the ledger around itself.

---

## Tests Added

**31 tests.** Three properties are worth attacking: an entry commits with its mutation or not
at all, it cannot be altered afterwards, and it does not become a place secrets live forever.
"It inserts a row" is not one of them.

| Group | Tests |
|---|---|
| required fields | every PAS-0301 and §23 field round trips; correlation taken from the ambient context; a SYSTEM actor; four invalid actor shapes; an origin outside ADR-004 |
| **Part I §5** | the entry is rolled back when the mutation fails; commits when it succeeds; the writer opens no transaction of its own |
| append-only | UPDATE refused; DELETE refused; **a metadata-only "correction" refused**; no mutating export |
| redaction | five sensitive keys; a credential recognised by **shape** regardless of key; equality with `scrubDetails`; non-object input kept; an oversized value bounded |
| ordering | insertion order under identical timestamps; a backdated entry does not reorder |
| reading | filters; **a read capped above the maximum**; the reader does not authorize itself |

### Mutation testing

Twelve mutations. Seven detected on the first pass; **five survived**, and every one was a real
gap rather than an equivalent mutation.

| Mutation | First pass | After |
|---|---|---|
| metadata not scrubbed | 8 failed | — |
| writer commits outside the caller's transaction | 3 failed | — |
| correlation id dropped | 1 failed | — |
| ordered by timestamp instead of sequence | 2 failed | — |
| UPDATE trigger removed | 2 failed | — |
| DELETE trigger removed | 1 failed | — |
| origin check loosened | 1 failed | — |
| application actor validation removed | **survived** | 1 failed |
| read limit uncapped | **survived** | 1 failed |
| actor-type/id constraint removed | **survived** | 1 failed |
| metadata object constraint removed | **survived** | 1 failed |
| ordering column removed | **miscounted** | suite cannot run |

**Three survivors were database constraints shadowed by application validation.** Removing
either alone leaves behaviour intact, so neither was load-bearing to any test. They are not
redundant: the application check produces a message naming the offending field, and the
constraint is the backstop for a writer that skips the service entirely — a migration, or a
future writer. Both are now tested, separately, for the reason each exists.

**One was a test that could not detect its target.** The cap test inserted twelve rows and
asserted the result was at most 500 — true of twelve whether or not a cap exists. It now bulk-
inserts 550 and asserts the cap returns exactly 500.

**One was my classifier miscounting.** Removing the ordering column made the suite error out
entirely, reported as "31 skipped"; the sweep script treated only "failed" as a detection. A
suite that cannot run is a detection. Recorded because a mutation sweep that miscounts is
worse than none — it produces false confidence in exactly the shape confidence should not take.

---

## Security / Privacy Impact

- **Secrets cannot settle in the one table that is never deleted.** Scrubbed by the same pass
  that guards error responses, on key name and on value shape, with size bounded.
- **Before/after are references, not values.**
- **The audit log cannot be edited or deleted**, by anyone, including through a
  metadata-only "correction".
- **`authorization_reason` is stored but never rendered** — PAS-0204's discipline carried
  through.
- **The reader authorizes nothing**, so it cannot become a way to read another account's
  record.

---

## Backward Dependency Check

All edges ADR-006-ratified. No cycle — verified explicitly, since avoiding one is why this
ticket moved packages. `apps/web` is a dependency of nothing. Re-verified.

### ADR-002 sweep — Build 03 opening sweep

This build changes how actions are recorded, so every existing producer of a record was
inspected:

| Site | Finding | Disposition |
|---|---|---|
| `authentication_events` (PAS-0202) | a special-purpose audit table with its own lockout indexes | **Kept.** Expand → Migrate → Verify → Contract: it serves lockout counting, which a general ledger would serve worse. `audit_entries` is the general record; the two coexist, and PAS-0202's report already anticipated this |
| PAS-0204 `AuthorizationDecision` | returned but not persisted | **Now has somewhere to go** — recorded per action, not per check |
| `apps/web` | no server-side action recording exists | Unchanged (ADR-003) |

No consumer required a change.

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **Nothing writes audit entries yet**, because no governed mutation exists. Same honest
   caveat as PAS-0204: the mechanism is in place and tested; it binds from the first mutation
   written. Build 04 onward.
2. **`authentication_events` and `audit_entries` overlap.** Deliberate and recorded above. A
   later build may project the former into the latter; destroying it first would violate the
   migration rule.
3. **No retention policy.** Audit is append-only and unbounded by design. Retention is a
   governance question and is tracked in CLAUDE.md §6 alongside source retention.
4. **`sequence` orders by insertion, not commit.** Stated in the migration and above.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Create `audit_entries` | ✅ |
| Fields: id, actorType, actorId, action, targetType, targetId, authorityEntityId (nullable), correlationId, metadata, occurredAt | ✅ all ten |
| Part I §23: before/after reference, authorization result, governance decision, origin | ✅ all four |
| §23: administrative activity must also be audited | ✅ `ADMIN` origin and `SYSTEM` actor both supported and tested |
| **Sensitive values must be redacted appropriately** | ✅ PAS-0003's scrubber, on key and on shape, asserted equal to it |
| Part I §5: the audit entry and its mutation are one transaction | ✅ tested both ways; the writer opens no transaction |
| ADR-004: origin affects provenance, never whether governance exists | ✅ recorded on every entry, constrained to ADR-004's list |

**No criterion is unmet. STATUS = COMPLETE.**
