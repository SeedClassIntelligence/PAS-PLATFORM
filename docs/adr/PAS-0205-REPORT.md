# PAS-0205 — Authorization Security Tests

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0205 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 02 — Accounts, Authentication and Authorization (**closes Build 02**) |
| **Depends on** | PAS-0201…0204 ✅ |

---

## Purpose

Test the six actors the ticket names, and verify that **frontend behaviour is irrelevant to
server authorization**.

That second clause is what separates this ticket from the four before it. PAS-0204 proved the
decision is correct; this proves the decision cannot be influenced by the party it is made
about.

---

## The problem this ticket had to solve first

The frontend-irrelevance clause cannot be shown in-process. "The client sent a header claiming
to be an administrator" is not representable as a function call — it needs a real socket, real
requests, and a client free to send whatever it likes.

**No protected route exists.** `apps/api` serves `/health`, `/ready` and a 404; the first
domain routes arrive at PAS-0405. Three paths were considered:

| Path | Verdict |
|---|---|
| Defer PAS-0205 until routes exist | **Rejected.** Build 02 would close with an unmet acceptance criterion, which the completion contract forbids. |
| Add a protected route to `apps/api` for the tests to drive | **Rejected.** That is PAS-0405's scope, and a route existing only for a test is product surface nobody asked for. |
| A test-owned harness composing the **real** `resolveSession` and `requireCapability`, in the order a route will, over a real socket | **Taken.** |

The harness is not a mock. Every authorization decision in this suite is made by the shipped
service against the shipped schema, reached through a real HTTP request carrying a real session
token. The route table — which capability guards which path — lives on the server, so no
client can select it.

**What the harness does not prove**, stated plainly: that PAS-0405's routes will call this
path. That is PAS-0204's job, and it has two mechanisms for it — `Grant` makes omission a
compile error, `no-bypass.test.ts` makes a private reimplementation a test failure. When real
routes land, this suite re-points at them and the harness goes.

---

## Files Created

| Path | Purpose |
|---|---|
| `tests/security/harness.ts` | the route table and the real session → authorize chain over HTTP |
| `tests/security/actors.ts` | the six actors, as real users, memberships, roles and sessions |
| `tests/security/authorization-matrix.test.ts` | 47 tests — the six actors against every guarded path |
| `tests/security/frontend-irrelevance.test.ts` | 28 tests — hostile clients |
| `tests/security/vitest.config.ts`, `tsconfig.json` | suite setup |

## Files Modified

| File | Change |
|---|---|
| `package.json` | `test:security` added to `ci` **and** to `typecheck` |

A security suite that does not run in CI is decoration, so it runs in CI.

---

## Tests Added

**75 tests.**

### The six actors — driven over HTTP, not by calling `authorize`

An authorization service that is correct in isolation and never reached is the failure this
build exists to prevent. Each actor holds a real session token and is judged through the same
path a request takes.

The matrix is written out in full, **including every DENY**:

| | anonymous | owner | collaborator | unauthorized | org admin | platform admin |
|---|---|---|---|---|---|---|
| read records | DENY | ALLOW | ALLOW | DENY | ALLOW | DENY |
| read **private** records | DENY | ALLOW | **DENY** | DENY | ALLOW | **DENY** |
| create a claim | DENY | ALLOW | ALLOW | DENY | ALLOW | DENY |
| **approve** a claim | DENY | **DENY** | **DENY** | DENY | **DENY** | **DENY** |
| publish | DENY | ALLOW | DENY | DENY | ALLOW | DENY |
| administer the organization | DENY | DENY | DENY | DENY | ALLOW | DENY |

Three rows carry the decisions PAS-0203 made and this ticket now enforces end to end:

- **The collaborator is refused private read.** Withheld by role, grantable only by an
  override with a reason.
- **The platform administrator is refused everything in someone else's account**, including
  plain reads. Being an administrator is not authority over anyone's material — the
  `MasterAdminView` god view answered by mechanism.
- **Nobody can approve a claim.** Not the owner, not the organization administrator, not the
  platform administrator. INV-27, INV-12, SUP-12.

Two further tests assert the *table itself* stays honest: every row must contain at least one
refusal, and every row must cover all six actors. A security suite that drifted into a list of
permissions would otherwise still pass.

The "unauthorized user" is deliberately **an authenticated member in good standing of a
different account** — the realistic attacker is a legitimate user of the platform, not a
stranger.

### Frontend irrelevance — hostile clients

| Attack | Result |
|---|---|
| ten impersonation headers (`x-role: PLATFORM_ADMIN`, `x-capabilities`, `x-is-admin`, `x-environment`, …) | ignored |
| cookies claiming `isAdmin=true`, `role=PLATFORM_ADMIN`, `capabilities=*` | ignored |
| a body naming a more privileged user, their membership, their role and `authorized: true` | ignored |
| a query string naming a capability | ignored — the server selects it from the route |
| seven forged tokens (empty, `null`, `admin`, right-shape-wrong-value, traversal, injection) | refused |
| a real token with **one character changed** | refused — and the unmodified token is asserted to pass, so the check is real |
| another account's genuine, live token | refused |
| a **revoked** session, with the client still behaving as if signed in | refused |

### A refusal tells the client nothing

- Four different probes — anonymous, member without the capability, member of another account,
  forged token — are checked against all eight denial reasons. None appears.
- A real account and an imaginary one produce **identical** status, code and message, so the
  refusal does not confirm which identifiers exist.
- The refusal contains no account, user or membership identifier.

### Server state decides, not client state

The direct rebuttal of the baseline's model: a collaborator is refused however hard the client
insists — then one `capability_overrides` row is added server-side and the same request, with
the client sending nothing special at all, succeeds. Removing the row restores the refusal.

---

## Mutation testing

Eight mutations, **eight detected** — deliberately split between the harness and the product,
because harness mutations only prove the harness.

| Mutation | Result |
|---|---|
| **product:** `authorize` drops account scope | **54 of 75 failed** |
| **product:** role grant stops matching on capability | 22 failed |
| **product:** revoked sessions resolve | 1 failed |
| **product:** membership status ignored | 1 failed |
| harness: trusts an `x-role` header | 2 failed |
| harness: treats a failed session resolution as a user | 11 failed |
| harness: puts the denial reason in the 403 | 1 failed |
| harness: private route guarded by the public capability | 14 failed |

The first is the one worth reading twice: removing the account predicate from the authorization
query fails **54 of 75** tests. That is ADR-007's membership grain holding under load — and it
is the failure mode that, shipped, would let any member of any account read any other account's
material.

---

## Security / Privacy Impact

This ticket adds no product surface and changes no behaviour. It converts four tickets' worth
of claims into assertions that fail when the claims stop being true.

What is now proven end to end, through a socket, against a real database:

- A client cannot grant itself authority by any header, cookie, body field or query parameter.
- A credential cannot be forged, guessed, or repaired by editing one character.
- A revoked session is refused however the client behaves.
- A refusal reveals neither the reason, nor whether an account exists, nor any identifier.
- Capabilities do not cross account boundaries.
- Nobody can approve their own claims.

---

## Backward Dependency Check

No new workspace edges. `tests/security` is not a workspace; it resolves `@pas/*` to source and
is typechecked explicitly by the root `typecheck` script, which is also where
`tests/integration` is covered.

**`apps/web` is a dependency of nothing.** Re-verified.

**ADR-002 sweep:** Build 02's opening sweep ran at PAS-0201. This ticket adds no consumer and
changes no data's meaning, visibility, lifecycle or governance.

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **The suite drives a harness, not `apps/api`.** Explained above and recorded in the harness
   header. The decisions are real; the routing is a stand-in until PAS-0405. **This is the one
   thing to re-check when routes land** — the suite should be re-pointed, and the harness
   deleted rather than left as a second, diverging definition of how authorization is reached.
2. **`MasterAdminView` is unchanged and still unguarded.** Nothing in Build 02 touched
   `apps/web` (ADR-003). What Build 02 delivers is that the *server* will not honour it, which
   is the half that matters — but the view itself is still Phase 11.
3. **No rate limiting by source address**, carried forward from PAS-0202. Lockout is per-user
   and does not bound spraying one attempt across many accounts. Belongs at the HTTP layer.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Test: anonymous user | ✅ refused on every guarded path, before any database work |
| Test: authenticated owner | ✅ allowed what OWNER holds, refused approval and organization administration |
| Test: authorized collaborator | ✅ allowed read and create, **refused private read and publish** |
| Test: unauthorized user | ✅ an authenticated member of another account, refused everything here |
| Test: organization administrator | ✅ the only actor holding `organization.manage` |
| Test: platform administrator | ✅ allowed the platform audit record, **refused everything in another account** |
| **Verify that frontend behavior is irrelevant to server authorization** | ✅ 28 tests over a real socket: headers, cookies, bodies, query strings, forged and edited tokens, revoked sessions — none changes the answer, and a server-side row does |

**No criterion is unmet. STATUS = COMPLETE.**
