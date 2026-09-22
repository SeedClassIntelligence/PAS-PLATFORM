# `@pas/auth`

Authentication, sessions, capability registry and the authorization service (PAS-0201..0204).

**Status:** PAS-0202 authentication and sessions · PAS-0203 capability registry · PAS-0204
authorization service.

## Allowed dependencies

`@pas/contracts` · `@pas/config` · `@pas/database` · `@pas/domain` · `@pas/observability`

Ratified by **ADR-006**: the infrastructure layer is dependable by any package. `apps/web` is a
dependency of nothing.

---

## Password hashing

### Why scrypt from `node:crypto`, and not argon2id

PAS-0002 declared argon2id parameters in configuration before there was an implementation to
hold them to. Implementing it changed the answer.

argon2id is OWASP's first choice and scrypt its second; both are memory-hard and the gap
between them is small. The gap between *in the Node standard library* and *a native module
built by node-gyp at install time* is not: a compiler on every build host, a prebuild per
platform, and a third-party package with native code on the most security-critical path in the
system. WASM builds avoid the compiler and pay in CPU per login — the one resource an
unauthenticated caller can spend.

The encoding makes that reversible at no cost. Every hash carries its algorithm and
parameters, so adopting argon2id later is a new branch in `verify` plus rehash-on-login. No
migration, no forced reset, no flag day.

### Parameters

Node runs scrypt's `p` **sequentially**, so it multiplies CPU without the parallelism OWASP's
tiers assume. Measured:

| | memory | time | hardness per second |
|---|---|---|---|
| `ln=15 r=8 p=3` — OWASP's tier | 32 MiB | 272 ms | 118 MiB/s |
| `ln=16 r=8 p=1` — **the default** | 64 MiB | 205 ms | 312 MiB/s |

Twice the memory hardness for three quarters of the time. On this runtime, raising `ln` is
strictly better than raising `p`; `p` stays 1. Re-benchmark on production hardware before
relying on the absolute numbers.

### The encoding

```
scrypt$ln=16,r=8,p=1$<salt base64url>$<derived key base64url>
```

A bare hash column forces every stored password to share whatever parameters the code
currently uses, so raising the cost either invalidates every password or silently never
applies. Here a hash below policy is recognised and replaced on its owner's next successful
login.

The database enforces the shape, so a plaintext password written into the column by mistake is
refused rather than stored and later "verified" against itself.

---

## Sessions

The token is 256 bits of CSPRNG output, handed to the client once. **The database stores only
its SHA-256.** A disclosed backup, replica or query log yields nothing presentable as a
session.

No password-style KDF on this path: a KDF defends a *guessable* secret against offline search,
and a uniformly random 256-bit value has no dictionary. scrypt here would add ~200 ms to every
authenticated request for nothing.

### Two expiries

| | Bounds |
|---|---|
| absolute — `expires_at` | how long a stolen token is *ever* useful, however active the session looks |
| idle — `last_seen_at` | an abandoned session on a shared machine, long before the absolute one would |

Either alone is insufficient. Absolute-only leaves a session live on a library computer for
twelve hours; idle-only lets an attacker who keeps a stolen token warm hold it forever.

The idle clock advances **only on a resolution that succeeds**, so a stream of requests bearing
a dead token cannot keep it alive.

### A session identifies a user

Never an Authority Entity, and there is deliberately no column that could. What a user may do
about a subject of authority is reached through `account_memberships` and decided by PAS-0204.
*"Authentication and Authority Entity identity remain separate"* is a statement about shape,
and that is the shape — asserted by a test over `information_schema`.

---

## What login does not reveal

Every unsuccessful outcome returns the same `INVALID_CREDENTIALS`: unknown address, wrong
password, no credential set, suspended account. A form that distinguishes them is an account
enumeration oracle, and the addresses it confirms are the input to every credential-stuffing
run that follows.

Saying it is not enough, because **timing says it too**:

- An **unknown address** is hashed anyway, against a fixed decoy, and the work discarded. One
  wasted hash per invalid attempt; the alternative is publishing the user list.
- A **locked-out** user is still hashed, so a locked account does not answer faster.
- A **suspended** account is hashed before its status is consulted. Moving that check earlier
  is the oracle — a test asserts the two take comparable time.

`LOCKED_OUT` is returned separately from `INVALID_CREDENTIALS` so a caller can log and
rate-limit accurately. **Callers must render both as one message**; the distinction is for the
audit trail, not the response body.

---

## `authentication_events`

Append-only. No update or delete path exists or will be added: a record a caller can revise is
not an audit record. PAS-0301's ledger subsumes the general case; this exists now because a
failed login that leaves no trace is indistinguishable from no attempt, and lockout has to
count something.

**It never stores the address attempted for an unknown user.** The operational need — spotting
credential stuffing — is served by counting attempts per source. Recording whatever was typed
produces a permanent log of other people's addresses and, every time someone types their
password into the email field, of their password.

It never stores a password or a token either.

---

## Running the tests

```bash
npm run db:start
npm run test -w @pas/auth
```

Against a real PostgreSQL. The suite applies the repository's migrations itself.


---

# Authorization — PAS-0204

```ts
import { authorize, requireCapability, actorForUser, inAccount } from '@pas/auth';

const decision = await authorize(actor, 'claim.create', inAccount(accountId));
// { decision: 'ALLOW', reason: 'ROLE_GRANT', membershipId, accountId, correlationId }

const grant = await requireCapability(actor, 'claim.create', inAccount(accountId));
// throws AuthorizationError on DENY
```

## Resolution order

| | Condition | Result |
|---|---|---|
| 1 | anonymous | DENY `ANONYMOUS` |
| 2 | capability outside the namespace | DENY `UNKNOWN_CAPABILITY` |
| 3 | no membership joining actor → account | DENY `NO_MEMBERSHIP` |
| 4 | user / account / membership not ACTIVE | DENY `*_NOT_ACTIVE` |
| 5 | override DENY | DENY `EXPLICIT_DENY` |
| 6 | override ALLOW | ALLOW `EXPLICIT_ALLOW` |
| 7 | a role on the membership grants it | ALLOW `ROLE_GRANT` |
| 8 | otherwise | DENY `NO_CAPABILITY` |

**Status (4) is checked before an ALLOW override (6).** An override says which *capability* a
membership has; it says nothing about whether the principal is live. A suspended user holding
an ALLOW override must still be refused, or suspension is not suspension. Three tests assert
exactly this.

**DENY overrides beat role grants.** PAS-0203's schema makes ALLOW and DENY mutually exclusive
for one membership and capability, so there is no override-versus-override case — only
override versus role, and the narrower, explicitly-reasoned row wins.

## One query

Everything is read in a single statement. Not for speed: separate reads of membership, status,
override and grants could observe different moments, so a capability revoked between two of
them would still authorize. One statement is one snapshot.

## The reason is internal

`NO_MEMBERSHIP` versus `EXPLICIT_DENY` tells a prober whether an account exists and whether
they were singled out. It stays in the returned decision and the audit record.

`AuthorizationError` carries the **capability** — PAS-0003 settled that as client-safe, and
telling callers which permission they lack is useful rather than a leak since they already
know what they attempted — and carries **no reason**. A test asserts the rendered error
contains no reason string and not the account id.

## A failure is not a refusal

A database error propagates. It does not become DENY. A 403 for an outage sends the on-call
engineer to debug permissions and hides the outage behind a plausible answer. *Fail closed*
means "no decision is an allow", not "every failure is a refusal".

## Why the caller supplies the account

Authorization answers "may this actor do X **to that thing**", so it needs the account that
owns the thing. Resolving a resource to its owner requires `authority_entities` — Build 04.
Rather than stub that here and have it silently disagree with the real one later, the caller
states the owning account, and this service stays a pure decision over membership and
capability.

**The cost, stated:** a caller supplying the wrong account gets a confidently wrong answer.
Hence a tagged union rather than a bare string — `authorize(actor, cap, someId)` does not
compile.

## Making the call obligatory

A centralized service nobody is obliged to call is decoration. Two mechanisms, because they
catch different bypasses:

**Forgetting to authorize is a compile error.** A protected operation takes a `Grant`:

```ts
async function createClaim(grant: Grant<'claim.create'>, input: ClaimInput) { … }
```

`Grant` has an unexported brand and no constructor, so the only way to obtain one is
`requireCapability`. The function cannot be called without one, cannot take a grant for a
different capability, and cannot have one forged. Asserted with `@ts-expect-error`, which
fails the **typecheck** if forging ever becomes possible.

The usual enforcement — a route wrapper — needs routes, and the first arrives at PAS-0405.
This does not replace one; it bounds the damage a forgotten wrapper can do, which is the part
a wrapper cannot do for itself.

**Deciding for yourself is a test failure.** `no-bypass.test.ts` scans the repository for
references to `role_capabilities`, `membership_roles` and `capability_overrides` outside
`packages/auth` and `migrations`. Querying those tables directly *is* deciding — and such code
compiles, looks reasonable, and quietly reimplements the resolution order, usually without the
status checks, because its author is thinking about capabilities rather than suspension.

Same shape as PAS-0101's ban on importing `pg`, and a test rather than a lint rule because the
bypass is SQL inside a string, which ESLint does not see. The suite also asserts the scanner
visits files and that its pattern matches a realistic bypass, so a green result means
something.
