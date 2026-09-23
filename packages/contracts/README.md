# `@pas/contracts`

Shared type contracts and schemas. A leaf package: it depends on nothing, and everything may
depend on it.

**Implemented:** PAS-0003 — Shared Error Contract · PAS-0104 — Canonical Timestamps.

## Error contract

The ten families PAS-0003 requires, each a real `Error` subclass:

| Family | Class | HTTP | Details client-safe |
|---|---|---|---|
| `VALIDATION` | `ValidationError` | 400 | ✅ |
| `AUTHENTICATION` | `AuthenticationError` | 401 | ❌ |
| `AUTHORIZATION` | `AuthorizationError` | 403 | ✅ |
| `NOT_FOUND` | `NotFoundError` | 404 | ✅ |
| `CONFLICT` | `ConflictError` | 409 | ✅ |
| `GOVERNANCE` | `GovernanceError` | 403 | ✅ |
| `WORKFLOW` | `WorkflowError` | 500 | ❌ |
| `EXTERNAL_SERVICE` | `ExternalServiceError` | 502 | ❌ |
| `RATE_LIMIT` | `RateLimitError` | 429 | ✅ |
| `INTERNAL` | `InternalError` | 500 | ❌ |

### Why those safety defaults

Not severity — **provenance of the information**.

- **Safe**: the details describe the *caller\'s own request*. A validation failure, a missing
  id, a version conflict, a governance decision. The caller supplied it; returning it leaks
  nothing.
- **Unsafe**: the details describe *PAS internals*. A failing workflow step, an upstream
  service\'s response, an unexpected exception. These routinely carry connection strings,
  internal hostnames, table names and third-party payloads.

`AUTHENTICATION` is unsafe for a different reason: distinguishing "no such user" from "wrong
password" is a user-enumeration oracle.

## Usage

```ts
import { NotFoundError, toErrorResponse, toErrorLogRecord } from \'@pas/contracts\';

throw new NotFoundError(\'Claim not found.\', { resourceType: \'Claim\', resourceId: id });

// At the API boundary:
const body = toErrorResponse(error, { correlationId, deployed });   // -> client
logger.error(toErrorLogRecord(error, { correlationId }));           // -> operators
```

### correlationId is assigned at the boundary

PAS-0003 requires `correlationId` in every response; PAS-0004 creates it. It is **optional on
the error and required on the response**. A throw site deep in a domain service should not
have to thread a correlation id through its signature — and a contract that expensive gets
routed around. The boundary that serialises supplies it. `withCorrelationId()` is available
where the throw site does know it.

## Never expose stack traces or secrets

Enforced in one place, `toErrorResponse`, so it is not re-remembered per handler:

- **Stacks are never serialised**, in any environment.
- In a deployed environment, unsafe families return a fixed message and no details.
- `toPasError` wraps any unknown throw as `InternalError` with the original retained as
  `cause` — available to logging, never to a client. This is what stops a raw driver error
  carrying the database URL from reaching a response.
- `scrubDetails` runs over everything emitted: redacts by key name, redacts credential-shaped
  values under innocent key names (connection strings, JWTs, PEM keys, AWS ids, bearer
  tokens), strips stacks from nested Errors, and bounds depth, breadth and string length so a
  response cannot become an exfiltration channel or a DoS payload.
- `deployed` **defaults to true**. A caller that forgets the flag gets production behaviour,
  not a leak.

## Reconciliation with `@pas/config`

`ConfigValidationError` (PAS-0002) now extends `ValidationError`, so a configuration failure
surfaced through an API boundary serialises under the same rules — with its details scrubbed.
Configuration problems name environment variables, which is exactly the shape of thing that
should never be echoed verbatim.

This adds `@pas/config → @pas/contracts`, a dependency PAS-0001 does not itself declare. It
creates no cycle (`contracts` is the universal sink) and is the direction PAS-0001 establishes
for every other package.

## Open design point — governance decisions that are not errors

Only `DENY` is unambiguously an error. `REQUIRE_REVIEW` and `REQUIRE_CONFIRMATION` mean
"accepted, not yet complete": the correct answer is a success carrying the resulting
`HumanTask` reference (PAS-1201), not a 4xx. `GovernanceError` can represent them so a caller
that genuinely cannot proceed has a typed way to say so, but Build 11 should return a task
reference rather than throw. Recorded so the decision is not made silently by whoever writes
the first gate.


---

# Canonical timestamps — PAS-0104

```ts
import {
  now, toInstant, newRecordTimestamps, touch, toOccurredAt, isValidAt,
  type CreatedAt, type OccurredAt, type ValidityInterval,
} from '@pas/contracts';
```

## The canonical form

```
YYYY-MM-DDTHH:mm:ss.sssZ        2026-02-15T10:00:00.000Z
```

Fixed width, four-digit year, milliseconds always present, always `Z`.

Fixed width is not cosmetic: it makes lexicographic order identical to chronological order,
so `ORDER BY published_at` in SQL, `.sort()` in JavaScript and a sorted key listing all
agree. A form that dropped `.000`, or used an expanded year, breaks that for the oldest and
newest records only — the hardest ordering bug to notice.

## What is rejected, and why

| Value | Why |
|---|---|
| `'2015-01-01'` | a date, not an instant. Which midnight? Whose? |
| `'2026-02-15T10:00:00'` | no zone — names a different moment on every machine that reads it |
| `'1 week ago'` | a rendering, not a value |
| `1739616000` | seconds or milliseconds? Both readings are plausible dates, a thousandfold apart |

The first three are in the PAS baseline today (SUP-14). The fourth is what an integrator
reaches for next.

**Offsets are accepted.** `2026-02-15T15:00:00+05:00` names exactly one instant and
normalises to `2026-02-15T10:00:00.000Z`. The offset the sender used is a property of the
sender, not of the moment; a value that needs its local zone preserved needs a separate zone
field, not a timestamp that is secretly a local time.

## The seven semantics do not interchange

| Type | Clock | Meaning |
|---|---|---|
| `OccurredAt` | the world's | when the thing happened |
| `ValidFrom` / `ValidTo` | the world's | when the assertion holds |
| `ObservedAt` | PAS's | when PAS learned it |
| `CreatedAt` | PAS's | when PAS wrote the record |
| `UpdatedAt` | PAS's | when PAS last changed it |
| `PublishedAt` | PAS's | when PAS showed it publicly |

```ts
const founded: OccurredAt = toOccurredAt('2015-01-01T00:00:00Z');
const created: CreatedAt = founded;   // does not compile
```

The values are identical on the wire and in the database. The separation is entirely in the
type system — a discriminator in the value would make the timestamp semantic, the same
reasoning that governs identity (PAS-0103, §XLI).

**Collapsing the two clocks costs specific things.** A record whose founding date is 2015
written into `createdAt` sorts as though PAS has held it for a decade, and "what did we know,
and when?" stops being answerable — which is the question an authority platform exists to
answer. Drop `observedAt` and a claim ingested today about a 2015 event is indistinguishable
from one PAS has carried since 2015.

### `createdAt` and `updatedAt` have no parser

Deliberately. They are facts about what PAS did, so they come from `newRecordTimestamps()`
and `touch()` — from the clock, never from a payload. You cannot put 2015 into a field you
cannot parse a string into. Hydrating a row read back from the database is `assertInstant`,
named differently so that using it in a create path reads wrong.

### One clock read per new record

`newRecordTimestamps()` returns both from a single read, so `createdAt === updatedAt` is true
by construction on a new record and false forever after the first update.

Two reads break that, but not in the obvious way: `Date.now()` has millisecond resolution, so
two consecutive reads land in the same millisecond almost every time and the pair looks
correct in testing. They differ only when a call straddles a millisecond boundary — an
*intermittent* wrong answer, which is worse than a consistent one. A test drives the clock
forward on every read so the guarantee is proved rather than observed.

## Validity intervals are half-open — `[validFrom, validTo)`

The start is included, the end is not. Consecutive intervals then abut exactly — one ends at
the instant the next begins — with no gap and no overlap, and `validTo` of the old row is
literally `validFrom` of the new one.

The inclusive alternative makes every writer subtract "one smallest unit", and that unit
differs between JavaScript (milliseconds), PostgreSQL (microseconds) and whatever a connector
sends. That subtraction is where the gaps come from. PostgreSQL's `tstzrange` defaults to
`[)` for the same reason, so a range column agrees without translation.

## Storage

`timestamptz(3)`.

`timestamptz` because it stores an absolute instant. **The `(3)` is load-bearing:** PostgreSQL
defaults to microsecond precision and JavaScript `Date` holds milliseconds, so an undeclared
column round trips lossily and an equality comparison against a value that has been through
JavaScript fails for reasons nobody can see. Build 02's columns must declare it.
