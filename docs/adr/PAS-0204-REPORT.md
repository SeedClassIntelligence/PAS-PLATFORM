# PAS-0204 — Authorization Service

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0204 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 02 — Accounts, Authentication and Authorization |
| **Depends on** | PAS-0201 ✅, PAS-0202 ✅, PAS-0203 ✅, ADR-006, ADR-007 |

---

## Purpose

`authorize(actor, capability, resourceContext)` returning explicit ALLOW / DENY with internal
reason information for audit, such that all protected server operations call this service or
an equivalent centralized enforcement mechanism.

**This is the ticket where PAS-0203 stops being inert.** The registry was data with no
consumer; this reads it and refuses.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/auth/src/authorize/types.ts` | `Actor`, `ResourceContext`, `AuthorizationDecision`, the reason unions |
| `packages/auth/src/authorize/authorize.ts` | the decision |
| `packages/auth/src/authorize/grant.ts` | `Grant`, `requireCapability` — the obligation |
| `packages/auth/tests/authorize.test.ts` | 26 tests |
| `packages/auth/tests/no-bypass.test.ts` | 3 tests — nothing reaches around the service |

**No new workspace dependency edges. No migration** — PAS-0203 created the tables; this reads
them.

---

## Decisions Made, Not Referred

### Resolution order, and why status precedes an ALLOW override

```
1  anonymous                            → DENY  ANONYMOUS
2  capability outside the namespace     → DENY  UNKNOWN_CAPABILITY
3  no membership joining actor→account  → DENY  NO_MEMBERSHIP
4  user / account / membership inactive → DENY  *_NOT_ACTIVE
5  override DENY                        → DENY  EXPLICIT_DENY
6  override ALLOW                       → ALLOW EXPLICIT_ALLOW
7  a role on the membership grants it   → ALLOW ROLE_GRANT
8  otherwise                            → DENY  NO_CAPABILITY
```

**(4) before (6) is the decision that matters.** An override states which *capability* a
membership has; it says nothing about whether the principal is live. A suspended user holding
an ALLOW override must still be refused, or suspension is not suspension. Three tests assert
it for user, account and membership independently, and a mutation moving the override check
above the status checks fails all three.

DENY beats a role grant, and there is no override-versus-override case at all: PAS-0203's
unique constraint makes ALLOW and DENY mutually exclusive for one membership and capability,
so ordering is a rule about overrides versus roles only.

### One query, because separate reads are separate moments

Everything the decision needs is read in a single statement. Not for latency: reading
membership, status, override and grants separately could observe four different moments, and a
capability revoked between two of them would still authorize. One statement is one snapshot.

### A failure is not a refusal

A database error propagates. It does **not** become DENY.

A 403 for an outage sends the on-call engineer to debug permissions, and hides the outage
behind an answer that looks deliberate. *Fail closed* means "no decision is an allow"; it does
not mean "every failure is a refusal". A mutation converting query failures into
`NO_MEMBERSHIP` — the shape this bug actually takes — fails a test.

### The reason never reaches the caller

`NO_MEMBERSHIP` versus `EXPLICIT_DENY` tells a prober whether an account exists and whether
they were singled out. `AuthorizationError` carries the **capability** (PAS-0003 settled that
as client-safe, and naming the missing permission is useful rather than a leak, since the
caller knows what they attempted) and carries **no reason**. A test asserts the rendered error
contains no reason string and not the account id.

`NO_MEMBERSHIP` deliberately covers three cases — no such user, no such account, no membership
joining them — and does not distinguish them, because distinguishing would confirm whether an
account exists.

### Anonymous is an actor, not `null`

`Actor | null` invites `authorize(maybeUser, …)` where `maybeUser` is undefined for a reason
nobody checked. An authorization call that *can* be passed a nullish actor by accident is one
that will be. Anonymous denies before touching the database, so an unauthenticated caller
cannot spend a query or learn anything about an account.

### The caller supplies the owning account

Authorization answers "may this actor do X **to that thing**", so it needs the account that
owns the thing. Resolving a resource to its owner requires `authority_entities` — Part I §8,
Build 04.

Stubbing that resolution here would produce something that silently disagrees with the real
one later. Instead the caller states the account, and this stays a pure decision over
membership and capability.

**The cost, stated rather than buried:** a caller supplying the wrong account gets a
confidently wrong answer. That is why `ResourceContext` is a tagged union and not a string —
`authorize(actor, cap, someId)` does not compile, and `{ scope: 'ACCOUNT', accountId }` is
hard to write by accident. Resource-to-account resolution lands with the resources.

### Making the call obligatory — two mechanisms, two bypasses

*"All protected server operations must call this service or an equivalent centralized
enforcement mechanism."* A centralized service nobody is obliged to call is decoration.

**Forgetting to authorize is a compile error.** A protected operation takes a `Grant<C>`,
whose brand is declared and never exported, so the only way to obtain one is
`requireCapability`. The operation cannot be called without one, cannot take a grant for a
different capability, and cannot have one forged. Asserted with `@ts-expect-error`, so the
guarantee fails the **typecheck** if it ever weakens.

The conventional mechanism — a route wrapper — needs routes, and the first arrives at
PAS-0405. Waiting would mean every operation written between now and then relies on its author
remembering. `Grant` does not replace a wrapper; it bounds the damage a forgotten wrapper can
do, which is the part a wrapper cannot do for itself.

**Deciding for yourself is a test failure.** `no-bypass.test.ts` scans the repository for
references to `role_capabilities`, `membership_roles` and `capability_overrides` outside
`packages/auth` and `migrations`. Querying those tables *is* deciding — and that code
compiles, looks reasonable, and quietly reimplements the resolution order, usually without the
status checks, because its author is thinking about capabilities rather than suspension.

Same shape as PAS-0101's `pg` ban, and a test rather than a lint rule because the bypass is SQL
inside a string, which ESLint cannot see. The suite also asserts the scanner visits files and
that its pattern matches a realistic bypass — otherwise a scanner that silently matched
nothing would pass forever.

---

## Tests Added

**29 tests.** Every deny reason is reached by constructing the state that causes it, never by
asserting the code has a branch. An authorization service returning DENY for the wrong reason
has an audit record that is fiction, and its next change will move a check past the wrong
guard.

| Group | Tests |
|---|---|
| ALLOW | role grant; override-only grant (the COLLABORATOR case PAS-0203 designed for); platform capability through a platform membership |
| every DENY reason | ANONYMOUS **without touching the database**; UNKNOWN_CAPABILITY; NO_MEMBERSHIP, and the same for a nonexistent account; USER / ACCOUNT / MEMBERSHIP_NOT_ACTIVE; NO_CAPABILITY; EXPLICIT_DENY beating the role that grants it |
| status precedes override | suspended user, account and membership each refused **despite** an ALLOW override |
| no cross-account leakage | a role in one account grants nothing in another; an override in one does not reach another; **a platform administrator cannot read a private record in someone's account**; a platform capability asked for in an ordinary account is refused |
| `requireCapability` | returns a grant; throws on DENY; **carries the capability but never the reason**; a grant cannot be forged or substituted (`@ts-expect-error`) |
| audit content | the decision names capability, actor, scope, account and membership; an unrecognised name is still recorded, so the trail shows what was attempted |
| failure ≠ refusal | a database failure propagates rather than returning DENY |
| no bypass | the authorization tables are referenced in one place; the scanner really scans; its pattern matches a realistic bypass |

### Mutation testing

Fifteen mutations, **fifteen detected**.

| Mutation | Result |
|---|---|
| anonymous allowed | 1 failed |
| unknown capability looked up instead of refused | 1 failed |
| user status check removed | 2 failed |
| account status check removed | 2 failed |
| membership status check removed | 2 failed |
| DENY override ignored | 1 failed |
| **ALLOW override moved above the status checks** | **3 failed** |
| no membership treated as ALLOW | 4 failed |
| **account scope dropped from the query** | **22 failed** |
| role grant stops matching on capability | 4 failed |
| `requireCapability` stops throwing | 2 failed |
| `requireCapability` puts the reason in the error | 1 failed |
| **database errors converted to DENY** | 1 failed |

Two were initially detected only by the **typecheck** rather than by a test — removing the
anonymous branch un-narrows the actor union, and the error-swallowing mutation was
syntactically broken. A typecheck failure proves the mutation was invalid, not that the tests
cover the behaviour, so both were rebuilt as versions that compile cleanly (`return ALLOW` for
anonymous; `.catch(() => ({ rows: [] }))` for the error path). Both then failed a test.

---

## Security / Privacy Impact

This ticket is the enforcement point, so the claims are about what is now refused.

- **A platform administrator cannot read a private record in another account.** PAS-0203
  decided it; this refuses it. That is the `MasterAdminView` god view answered by mechanism
  rather than description — though see *Known Issues*: the view itself is unchanged.
- **Capabilities do not leak across accounts.** A role or override in one account grants
  nothing in another — the concrete payoff of ADR-007's membership grain.
- **Suspension actually suspends.** Status precedes an ALLOW override.
- **The denial reason never reaches the caller.** Tested against the rendered error.
- **Anonymous denies before any query.** No database work, and nothing learned about an
  account, on an unauthenticated call.
- **An unknown capability is refused, not looked up.** A typo cannot match a row, and cannot
  be mistaken for a real permissions problem in the audit record.
- **Failures surface as failures.** An outage is not disguised as a 403.

---

## Backward Dependency Check

No new edges. `apps/web` is a dependency of nothing. Re-verified.

**ADR-002 sweep:** Build 02's opening sweep ran at PAS-0201. Re-checked here, because this
ticket changes what "may this user act" means: no consumer has appeared, since nothing calls
`authorize` yet. `apps/web` decides nothing server-side and is unchanged (ADR-003).

---

## Forward Dependencies Unlocked

PAS-0205 (security tests — the six actors map to: `ANONYMOUS`, OWNER, COLLABORATOR, a
membership without the capability, ORGANIZATION_ADMIN, PLATFORM_ADMIN) · PAS-0405 (first API
routes, where the route wrapper joins `Grant`) · every protected operation from Build 04 on.

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **Nothing calls `authorize` yet**, because no protected server operation exists. The
   mechanisms that make calling it obligatory are in place and tested; the obligation binds
   from the first operation written. Stated plainly so a green ticket is not read as "the
   platform is now protected" — `MasterAdminView` is exactly as exposed as it was, and is
   still Phase 11 plus a route guard.
2. **Decisions are returned, not persisted.** "Internal reason information for audit" is
   carried on the decision and correlated via PAS-0004. Persistence belongs to PAS-0301's
   audit ledger, and inventing its schema here would be implementation deciding Build 03's
   architecture.
3. **The caller supplies the owning account and is trusted to get it right.** Deliberate and
   explained above; the tagged union makes it hard to get wrong by accident but cannot make it
   impossible. Resource-to-account resolution lands with the resources at Build 04.
4. **`Grant` is forgeable by an explicit `as` cast.** Nothing in TypeScript prevents that. The
   cast is greppable in review; a missing call is not, which is the improvement being claimed.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Create `authorize(actor, capability, resourceContext)` | ✅ |
| Return explicit ALLOW | ✅ `ROLE_GRANT`, `EXPLICIT_ALLOW` |
| Return explicit DENY | ✅ eight reasons, each reached by a test that constructs the state |
| With internal reason information for audit | ✅ on the decision, with correlation id; never on the wire |
| All protected server operations must call this service **or an equivalent centralized enforcement mechanism** | ✅ two mechanisms: `Grant` makes omission a compile error; `no-bypass.test.ts` makes a private reimplementation a test failure |
| Part I §7 — authorization operates through explicit capabilities | ✅ an unrecognised name is refused, not resolved |
| ADR-007 — membership grain | ✅ tested across accounts in both directions |

**No criterion is unmet. STATUS = COMPLETE.**
