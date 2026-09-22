# PAS-0203 — Capability Registry

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0203 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 02 — Accounts, Authentication and Authorization |
| **Depends on** | PAS-0201 ✅ (`account_memberships`), PAS-0202 ✅, **ADR-006**, **ADR-007** |

---

## Purpose

`capabilities`, `roles`, `role_capabilities`, `membership_roles` and `capability_overrides`,
seeded with the canonical namespace of Part I §7.

**This ticket decides nothing at runtime.** PAS-0204 is the authorization service; this is the
data it will read. What this ticket *does* decide is who may hold what — and that is a
governance decision, not a data-modelling one.

---

## Files Created

| Path | Purpose |
|---|---|
| `migrations/0003_create_capability_registry.sql` | five tables, the `PLATFORM` account type, and the seed |
| `packages/auth/src/capabilities/namespace.ts` | the namespace as a typed constant; `Capability`, `Role` |
| `packages/auth/src/capabilities/platform.ts` | resolving the platform account |
| `packages/auth/tests/capabilities.test.ts` | 26 tests |

## Files Modified

| File | Change |
|---|---|
| `packages/auth/src/index.ts` | exports the capability surface |

**No new workspace dependency edges.**

---

## Decisions Made, Not Referred

### The grain, and the platform as an account — ADR-007 implemented

Part I §6 names `user_capability_overrides`; PAS-0203 names `capability_overrides`. Resolved
before this ticket started, in ADR-007: the latter, grained to `account_membership_id`, on the
reasoning that §6's own model contradicts §6's name. Roles attach to a membership —
`membership_roles` exists, and a user who administers one organization does not thereby
administer another. A row keyed by `user_id` grants the capability in **every account that
user belongs to**.

The platform is seeded as an `accounts` row of type `PLATFORM`, so a platform administrator
holds an ordinary membership. `authorize()` gets one grain and no branch.

**Resolved by type, not by a well-known identifier.** A constant like `0000…0001` would be a
semantic identifier, which PAS-0103 forbids — "this one is special" is meaning. A unique
partial index makes exactly one `PLATFORM` account possible, so lookup by type is total, and
the id is `gen_random_uuid()` like any other. A test asserts the id does **not** look reserved.

### Who holds what — the governance decision

This is the substance of the ticket.

**Seven capabilities are granted to no role:**

```
claim.review   claim.approve   evidence.review   evidence.verify
experience.review   composition.approve   representation.approve
```

INV-27 keeps knowledge authority and action authority separate, with gates G2 and G4
distinctly authorized. INV-12 makes source confirmation strictly weaker than verification.
SUP-12 records what the baseline does without that separation: typing a sentence into a modal
produces `PUBLISH_READY`, `PUBLIC`, `confidenceScore: 100` authority.

Granting `OWNER` the power to approve its own claims **reproduces SUP-12 at the authorization
layer**, where it is far harder to see than in a React component. So the gate exists and is
referenceable, and nobody can currently satisfy it — which is the correct state until the
build that defines the review workflow (Builds 08–11) also defines who carries it. Seeding a
`REVIEWER` role now, with guessed semantics, would be implementation deciding architecture
(§LXI).

A test asserts the unheld set is **exactly** these seven: more means a gate has silently
become unreachable, fewer means one has been handed to someone.

**`publication.publish` IS granted to `OWNER`.** A Personal PAS its owner cannot publish is not
a product. The separation is preserved elsewhere and more precisely: INV-3 makes the Published
PAS a *projection* of the Authority Record, so publishing exposes only what has already passed
its gates. Gating the projection rather than the content would be the wrong control in the
wrong place.

**`PLATFORM_ADMIN` holds three capabilities and no reach into anyone's records.** Not
`authority.record.read_private`, not `authority.record.read`. A platform administrator is not
thereby authorized over every account's private material — that is precisely the "god view"
recorded against `MasterAdminView` (`docs/RECONCILIATION.md` Part 7). Cross-account access to
private material is an explicit, reasoned, auditable `capability_overrides` row, not a
property of being an administrator.

**`COLLABORATOR` does not hold `authority.record.read_private`, `source.delete`,
`publication.*`, `relationship.manage` or `opportunity.manage`.** A collaborator who needs
private read gets an override with a reason attached — the case `capability_overrides` exists
for.

### Capability names are primary keys

PAS-0103's non-semantic rule governs the identity of records *about the world* — an entity, a
claim, evidence — whose identifiers must survive every rename. A capability name is not that:
it is a constant the specification itself writes down. A surrogate key would make every role
grant a pair of opaque uuids, and a typo in a grant unreadable rather than refused.

### Overrides revoke as well as grant

An override that could only grant is half a mechanism: withdrawing one capability from one
membership would otherwise require inventing a bespoke role, and bespoke roles are how a role
model becomes unauditable.

`reason` is **not nullable**. An override nobody can explain is one nobody dares remove, and
it will still be there during the incident review.

A unique constraint on `(account_membership_id, capability_name)` makes `ALLOW` and `DENY` for
the same pair impossible, so resolution order is a rule about roles versus overrides only, and
never about which override wins. **DENY wins over any role grant** — recorded here, enforced
at PAS-0204.

### Seeding lives in migrations

Deterministic, version controlled, ordered, and validated by CI — which is what PAS-0102 was
built for. *"Expand without changing authorization architecture"* is then a row in a new
migration plus an entry in the typed constant, and nothing else.

The cost is two copies of one list. Accepted because callers need a name the compiler checks
and the database needs a foreign key, and **a test asserts the two are the same set** rather
than leaving it to whoever remembers.

---

## Database Migrations

`0003_create_capability_registry.sql` — five tables, `accounts.account_type` extended with
`PLATFORM`, a unique partial index forbidding a second platform account, and the seed: 30
capabilities, 4 roles, 59 role grants.

`now()` is used for the seed timestamps. A migration is the one place a timestamp legitimately
comes from the database — there is no application running to supply one.

---

## Tests Added

**26 tests.** Both things worth testing here are absences: that the seeded namespace is
exactly the specification's with nothing quietly added, and that the capabilities no role holds
are exactly the ones meant to be withheld. A registry test checking only that rows exist would
pass against a registry granting everything to everyone.

| Group | Tests |
|---|---|
| the namespace is the specification | seeded set **equals** the typed constant; exactly 30; roles equal; a typo'd name is rejected |
| **no role can authorize its own claims** | the unheld set is exactly the seven; each of the four roles holds none of them |
| grants are what they are meant to be | OWNER publishes but does not approve; COLLABORATOR has no private read, delete, publish or manage; **PLATFORM_ADMIN's grants are exactly three**; `organization.manage` belongs to one role |
| the platform is an account | seeded once; a second is refused; the id is **not** semantic; administrators hold it through an ordinary membership; resolved once and not looked up again |
| the registry refuses | a grant naming a nonexistent capability; an override naming one; an override with a NULL or blank reason; ALLOW and DENY for one pair; an unknown effect; a duplicate role grant; a grant on a nonexistent membership; deleting a referenced capability |

### Mutation testing

Thirteen mutations. Eleven detected on the first pass; two survived and both were real gaps.

| Mutation | First pass | After |
|---|---|---|
| OWNER granted `claim.approve` and `evidence.verify` | 2 failed | — |
| **PLATFORM_ADMIN granted every capability** | **4 failed** | — |
| COLLABORATOR granted `authority.record.read_private` | 1 failed | — |
| a capability removed from the seed | 4 failed | — |
| single-platform index removed | 1 failed | — |
| `ALLOW`/`DENY` uniqueness removed | 1 failed | — |
| capability foreign key removed | 2 failed | — |
| duplicate role grants allowed | 1 failed | — |
| code constant drifted from the seed | 2 failed | — |
| the unheld list altered | typecheck | — |
| platform id made semantic (`0000…0001`) | 1 failed | — |
| `reason` made nullable | **survived** | 1 failed |
| platform id cache never populated | **survived** | 1 failed |

**`reason` made nullable** survived because the test covered `''` and `'   '` but not `NULL` —
and `NULL` is the more likely case, being what an INSERT that simply omits the column
produces. The blank-string check was doing all the work the test could see.

**The cache** survived because nothing asserted it. The test now makes the row disappear
underneath a warm cache, inside a transaction that rolls back, and asserts the resolver
returns without looking — then that a reset forces it to look and fail.

---

## Security / Privacy Impact

- **`platform.admin` cannot be held without a row somebody can list, audit and revoke.** This
  is the structural answer to the unguarded god view recorded against `MasterAdminView`. The
  guard becomes a capability check that cannot be bypassed by forgetting, rather than a
  condition someone must remember to add. Enforcement is PAS-0204; the shape that makes
  enforcement possible is here.
- **A platform administrator has no reach into any account's records.** Asserted exactly, not
  by omission.
- **No role can approve its own claims or verify its own evidence.** The gate exists and is
  currently unsatisfiable by anyone.
- **A capability that does not exist cannot be granted** — refused by foreign key at write
  time, rather than silently never matching at authorization time.
- **Every override carries a reason**, NULL and blank both refused.

**Not enforced yet, and this ticket claims no enforcement.** Nothing reads these tables. Until
PAS-0204 lands, the registry is data with no consumer, and no part of the system is more
protected than it was yesterday. The claim here is that the shape is right.

---

## Backward Dependency Check

No new edges. `apps/web` is a dependency of nothing. Re-verified.

**ADR-002 sweep:** Build 02's opening sweep ran at PAS-0201 and found nothing unrecorded.
Re-checked for this ticket — no new consumer of "what may this user do" has appeared, because
nothing consumes it yet.

---

## Forward Dependencies Unlocked

PAS-0204 (the authorization service — resolution is roles ∪ ALLOW overrides, minus DENY
overrides) · PAS-0205 (security tests; the six actors it names map to: no membership, OWNER,
COLLABORATOR, a membership without the capability, ORGANIZATION_ADMIN, PLATFORM_ADMIN).

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **Seven capabilities are held by no role.** Deliberate, tested, and explained above. Recorded
   as a Known Issue because it will look like an omission to anyone reading the seed without
   the reasoning.
2. **Roles are global, not per-account.** No custom roles. The spec does not ask for them, and
   adding a nullable `account_id` to `roles` later changes no architecture — which is what
   *"expand without changing authorization architecture"* requires.
3. **`audit.read` is platform-scoped.** An organization reading its own audit record is a
   different capability, and inventing its name now would be guessing. Build 03 owns the audit
   ledger and should name it.
4. **Nothing enforces any of this.** PAS-0204.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Create `capabilities` | ✅ name as primary key, shape-constrained |
| Create `roles` | ✅ |
| Create `role_capabilities` | ✅ foreign keys to both, so an unknown capability cannot be granted |
| Create `membership_roles` | ✅ grained to `account_memberships` (ADR-007), one grant per pair |
| Create `capability_overrides` | ✅ ALLOW/DENY, mandatory reason, one per membership and capability |
| Seed the canonical capability namespace | ✅ all 30 of Part I §7, asserted equal to the typed constant |
| Part I §7 — authorization operates through explicit capabilities | ✅ nothing is implicit; the unheld set is asserted exactly |
| "Expand without changing authorization architecture" | ✅ a new capability is one migration row plus one constant entry |
| INV-27 / INV-12 — knowledge and action authority separate | ✅ no role holds review, approval or verification |
| ADR-007 — membership grain, platform as an account | ✅ implemented and tested |

**No criterion is unmet. STATUS = COMPLETE.**
