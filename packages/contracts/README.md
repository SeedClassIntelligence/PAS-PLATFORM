# `@pas/contracts`

Shared type contracts and schemas. A leaf package: it depends on nothing, and everything may
depend on it.

**Implemented:** PAS-0003 — Shared Error Contract.

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
