# PAS-0003 — Shared Error Contract

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0003 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 00 — Engineering Foundation |
| **Depends on** | PAS-0001 ✅, PAS-0002 ✅ |
| **Authority** | Clean-Sheet Build Specification PAS-0003 |

---

## Purpose

Structured application errors in the ten required families, with a wire contract carrying
code, message, correlationId and details-when-safe, and a hard guarantee that stack traces
and secrets never reach a production API.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/contracts/src/errors/codes.ts` | families, HTTP mapping, safety matrix, generic codes |
| `packages/contracts/src/errors/base.ts` | `PasError` |
| `packages/contracts/src/errors/families.ts` | the ten classes + `toPasError` |
| `packages/contracts/src/errors/scrub.ts` | secret scrubbing and bounding |
| `packages/contracts/src/errors/response.ts` | `toErrorResponse`, `toErrorLogRecord` |
| `packages/contracts/src/errors/index.ts`, `src/index.ts` | public API |
| `packages/contracts/tsconfig.json`, `vitest.config.ts` | build/test wiring |
| `packages/contracts/tests/errors.test.ts` | 31 tests |

## Files Modified

| File | Change |
|---|---|
| `packages/contracts/package.json` | entry point, scripts, dev deps |
| `packages/contracts/README.md` | scaffold replaced with implemented contract |
| `packages/config/src/load.ts` | `ConfigValidationError` now extends `ValidationError` |
| `packages/config/package.json` | adds `@pas/contracts` |
| `packages/config/tests/config.test.ts` | +3 reconciliation tests |

**`apps/web` untouched.**

## Database Migrations

None.

## Domain Contracts Added/Changed

`@pas/contracts` now exports the error contract: `PasError`, the ten family classes,
`ErrorFamily`, `FieldProblem`, `GovernanceDecision`, `ErrorResponse`, `toPasError`,
`toErrorResponse`, `toErrorLogRecord`, `scrubDetails`.

## API Contracts Added/Changed

`ErrorResponse` is now **the** error shape for every PAS API surface:

```json
{ "error": { "code": "...", "message": "...", "family": "...", "correlationId": "...", "details": {} } }
```

`details` is present only when the family permits it. No endpoints exist yet; PAS-0005 is the
first consumer.

## Events Added/Changed

None.

## Workflow Changes

None. `ExternalServiceError.retryable` is provided for PAS-0304's backoff logic to consume
without parsing messages.

## Governance Changes

None implemented. `GovernanceError` carries decision, gate and policy version so PAS-1104's
requirement — every governed state change stores its authorizing decision — applies to
refusals as well as approvals.

## Authorization Changes

None. `AuthorizationError` carries `requiredCapability` for PAS-0203/0204.

## Tests Added

**34 total** — 31 in `@pas/contracts`, 3 reconciliation tests in `@pas/config`.

| Group | Covers |
|---|---|
| the ten required families | exact family list; a class per family; `instanceof` survives; HTTP mapping |
| the wire contract | code/message/family/correlationId always present; boundary stamping |
| details when safe | safe families return details; unsafe withhold; dev reveals; explicit narrowing honoured |
| **never expose stacks or secrets** | 6 adversarial tests |
| `scrubDetails` | key-name redaction, value-shape redaction, nested Error stacks, depth/breadth/length bounds, circular refs, no mutation |
| log records | operators keep message and cause; details still scrubbed |
| family-specific structure | every family's typed fields |

## Tests Passed

```
 ✓ @pas/contracts  31/31
 ✓ @pas/config     33/33   (30 existing + 3 reconciliation)
 ✓ @pas/web         3/3    (unchanged)
   Test Files  3 passed (3)
        Tests  67 passed (67)
```

## Typecheck Result

✅ **PASS** — three workspaces, zero errors.

## Build Result

✅ **PASS**. Frontend artifacts **still byte-identical** to the `f23d11a` baseline:
`63a17f150ca2f875c2ced46dd0b97be2`.

## Security / Privacy Impact

**Substantially positive.** This ticket exists to prevent a class of leak, and the defences
are enforced in one place rather than per handler.

1. **Stacks are never serialised, in any environment.** A test sweeps all ten families × both
   environments asserting no `stack`, no `.ts:`, no `    at ` appears.

2. **`toPasError` is the containment boundary for unknown throws.** A raw driver error whose
   message is `connect ECONNREFUSED postgres://pas:hunter2@db.internal:5432` becomes an
   `InternalError` with a fixed message; the original survives only as `cause`, which the
   client serialiser never reads. Tested.

3. **`scrubDetails` runs over everything emitted** — including client-safe families, because a
   validation error routinely echoes a submitted request body. It redacts by key name, and
   redacts credential-shaped *values* under innocent key names: connection strings with
   embedded passwords, JWTs, PEM private keys, AWS access key ids, bearer tokens, common
   provider key prefixes. It also strips stacks from nested Errors and bounds depth, breadth
   and string length so an error response cannot become an exfiltration channel or a DoS
   payload.

4. **`deployed` defaults to `true`.** A caller that forgets the flag gets production
   behaviour. The safe default is the one you get by being careless.

5. **Message safety is derived, not per-call.** Families whose details describe internals have
   messages that describe internals too, so both are suppressed together.
   `AUTHENTICATION` is the deliberate exception: its message is a fixed, uninformative string
   while its details stay hidden, because "no such user" vs "wrong password" is an
   enumeration oracle.

**Deliberate design choice worth your review:** the safe/unsafe split is by *provenance of the
information*, not severity. Safe = the details describe the caller's own request. Unsafe = the
details describe PAS internals. That is why `AUTHORIZATION` (403) is safe while `WORKFLOW`
(500) is not, despite both being serious.

## Backward Dependency Check

✅ No circular dependencies — verified by DFS over all 20 workspaces.
✅ `@pas/web` remains a dependency of nothing.
✅ `@pas/contracts` remains a leaf with **no** workspace dependencies.

**One dependency added beyond PAS-0001's declared set:** `@pas/config → @pas/contracts`.

PAS-0001 declares `domain → contracts` and leaves `config` with none. Reconciling
`ConfigValidationError` into the shared families requires the import. It creates no cycle —
`contracts` is the universal sink — and it is the same direction PAS-0001 establishes for
every other package. Flagged rather than assumed. Reverting it would mean configuration errors
serialising under different rules from every other PAS error, with unscrubbed details naming
environment variables.

## Forward Dependencies Unlocked

PAS-0004 (correlation — supplies the `correlationId` this contract requires) ·
PAS-0005 (health/readiness — first endpoint to serialise errors) ·
PAS-0006 (CI) · PAS-0204 (`AuthorizationError`) · PAS-0304 (`ExternalServiceError.retryable`) ·
PAS-0804 (`ConflictError` for invalid lifecycle transitions) · PAS-1102 (`GovernanceError`).

## Known Issues

None outstanding. Two design points recorded rather than decided silently:

**1. Governance decisions that are not errors.** Only `DENY` is unambiguously an error.
`REQUIRE_REVIEW` and `REQUIRE_CONFIRMATION` mean "accepted, not yet complete" — the correct
HTTP answer is a success carrying the resulting `HumanTask` reference (PAS-1201), not a 4xx.
`GovernanceError` can represent them so a caller that genuinely cannot proceed has a typed way
to say so, but **Build 11 should return a task reference rather than throw**. Recorded in
`families.ts` and the README so the decision is not made silently by whoever writes the first
gate.

**2. `WorkflowError` maps to 500, not 409.** An invalid lifecycle transition (PAS-0804) is a
caller-facing conflict and should raise `ConflictError`; `WorkflowError` is for a workflow
*instance or step* failing, which is an internal fault. Build 13 should respect the split.

---

## Acceptance Criteria

| PAS-0003 requirement | Evidence |
|---|---|
| Structured application errors | ✅ `PasError` base, typed fields per family |
| `ValidationError` | ✅ carries every problem, not the first |
| `AuthenticationError` | ✅ fixed message, details never exposed |
| `AuthorizationError` | ✅ carries `requiredCapability` |
| `NotFoundError` | ✅ carries resource type/id |
| `ConflictError` | ✅ carries expected/actual version |
| `GovernanceError` | ✅ carries decision, gate, policy version |
| `WorkflowError` | ✅ carries workflow, step, instance |
| `ExternalServiceError` | ✅ carries service, retryable |
| `RateLimitError` | ✅ carries retry-after, limit |
| `InternalError` | ✅ message and details both suppressed when deployed |
| Response requires `code` | ✅ asserted for all ten |
| Response requires `message` | ✅ asserted for all ten |
| Response requires `correlationId` | ✅ asserted for all ten; stamped at boundary |
| `details` **when safe** | ✅ safety matrix + 4 tests |
| **Never expose stack traces** | ✅ swept over 10 families × 2 environments |
| **Never expose secrets** | ✅ 6 adversarial tests incl. unknown-throw containment |

Root gate `npm run verify`: **exit 0**.

**STATUS: COMPLETE.**
