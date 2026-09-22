# `@pas/auth`

Authentication, sessions, capability registry and the authorization service (PAS-0201..0204).

**Status:** PAS-0202 — authentication and sessions. The capability registry (PAS-0203) and the
authorization service (PAS-0204) land here next. **Nothing in this package decides what a user
may *do*.**

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
