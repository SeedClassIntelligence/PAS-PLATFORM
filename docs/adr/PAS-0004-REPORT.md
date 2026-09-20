# PAS-0004 — Correlation Context

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0004 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 00 — Engineering Foundation |
| **Depends on** | PAS-0001 ✅, PAS-0003 ✅ |
| **Authority** | Clean-Sheet Build Specification PAS-0004 |

---

## Purpose

Give every request, workflow, worker operation, event and agent task a `correlationId`, support
`causationId` where one operation causes another, and make that identity follow the operation
across API, database, workflow, events and workers.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/observability/src/correlation/ids.ts` | id minting, validation, inbound acceptance |
| `packages/observability/src/correlation/context.ts` | context model, `AsyncLocalStorage`, derivation |
| `packages/observability/src/correlation/propagate.ts` | HTTP header propagation |
| `packages/observability/src/correlation/index.ts`, `src/index.ts` | public API |
| `packages/observability/tsconfig.json`, `vitest.config.ts` | build/test wiring |
| `packages/observability/tests/correlation.test.ts` | 37 tests |

## Files Modified

| File | Change |
|---|---|
| `packages/observability/package.json` | entry point, scripts, `@pas/contracts` |
| `packages/observability/README.md` | scaffold replaced with implemented contract |

**`apps/web` untouched.** No other package modified.

## Database Migrations

None. PAS-0301/0302/0304 add the columns that persist these fields.

## Domain Contracts Added/Changed

`@pas/observability` now exports `CorrelationContext` and the propagation API:
`startOperation`, `deriveChildContext`, `runWithContext`, `runInNewOperation`,
`runInChildOperation`, `currentContext`, `currentCorrelationId`, `requireCorrelationId`,
`correlationFields`, `contextFromRecord`, `contextFromHeaders`, `correlationHeaders`,
`responseCorrelationHeaders`, plus `isValidId` / `acceptOrMintId`.

## API Contracts Added/Changed

Header names fixed for every PAS surface: `x-correlation-id`, `x-causation-id`, and
`traceparent` read as a fallback. No endpoints exist yet — PAS-0005 is the first consumer.

## Events Added/Changed

None emitted. `correlationFields()` supplies the `correlationId` / `causationId` pair that
PAS-0302's envelope requires.

## Workflow Changes

None. `contextFromRecord` is the mechanism PAS-0305 uses to restore context when a worker
claims an outbox row.

## Governance Changes

None.

## Authorization Changes

None.

## Tests Added

**37 tests.**

| Group | Covers |
|---|---|
| identifiers | uniqueness across 1,000 mints; accepts UUID, ULID, W3C trace id |
| **inbound identifiers are untrusted** | 5 tests — newlines, control/quoting chars, length bound, non-strings, mint-rather-than-fail |
| every operation receives a correlationId | root chain, continuing an upstream chain, discarding malformed causation |
| causation chains | `A → B → C`; fan-out distinguishable from sequence |
| **identity follows the operation** | awaits, timers/callbacks, `Promise.all`, thrown-and-caught |
| **contexts do not leak** | 25 concurrent operations stay isolated; no residue after completion or throw; parent restored after nested child |
| `requireCorrelationId` | returns inside; throws a typed `PasError` outside |
| stamping events/outbox/audit | `causationId` is the *current operation's* id |
| workers restore context | reconnects across a process boundary; mints for an uncorrelated row; discards corrupted stored values |
| HTTP propagation | plain and `Headers`-like sources, `traceparent` fallback and precedence, hostile header neutralised, outbound and response headers |
| end-to-end | API → event → worker → child step under one correlation id |

## Tests Passed

```
 ✓ @pas/observability  37/37
 ✓ @pas/contracts      31/31
 ✓ @pas/config         33/33
 ✓ @pas/web             3/3
   Test Files  4 passed (4)
        Tests 104 passed (104)
```

## Typecheck Result

✅ **PASS** — four workspaces, zero errors.

## Build Result

✅ **PASS**. Frontend artifacts **still byte-identical** to `f23d11a`:
`63a17f150ca2f875c2ced46dd0b97be2`.

## Security / Privacy Impact

**Positive.** Correlation ids arrive in attacker-controlled headers and are written into log
lines and database columns, which makes them an injection surface, not just telemetry.

1. **Log injection is blocked at the boundary.** The accepted charset is `[A-Za-z0-9._-]`.
   A correlation id carrying `\n` reaches a log line and lets an attacker **forge log
   entries** — the test asserts `x\n2026-01-01 INFO Payment approved` is neutralised. `\r`,
   `\t`, NUL, ` `, quotes and structural characters are rejected with it.

2. **Unbounded inbound values are rejected.** 128-character ceiling, so a header cannot flood
   logs or abuse storage in every event and audit row it would be copied into.

3. **A malformed id is replaced, not rejected.** Failing the request would let any upstream
   break PAS by sending a bad header, and the caller gains nothing. The operation stays
   traceable; it simply is not linked to the caller's chain. Availability preserved without
   trusting the input.

4. **`requireCorrelationId` fails loudly** rather than letting a boundary write an
   unattributable audit entry or event. It raises a typed `PasError`
   (`correlation.missing_context`), so PAS-0003's serialiser handles it like any other.

No PII is introduced: correlation ids are random UUIDs with no subject linkage.

## Backward Dependency Check

✅ No circular dependencies — DFS over all 20 workspaces.
✅ `@pas/web` remains a dependency of nothing.
✅ `@pas/contracts` remains a leaf.

**One dependency added beyond PAS-0001's declared set:** `@pas/observability → @pas/contracts`,
for `InternalError`. Same justification as PAS-0003's `config → contracts`: no cycle, and it is
the direction PAS-0001 establishes for every other package. Flagged, not assumed.

## Forward Dependencies Unlocked

PAS-0005 (health/readiness — first surface to emit a correlation id) · PAS-0006 (CI) ·
PAS-0101 (query tagging) · PAS-0301 (audit entries require `correlationId`) ·
PAS-0302 (event envelope `correlationId`/`causationId`) · PAS-0304/0305 (outbox and dispatcher
restore context) · PAS-1601 (agent task correlation) · PAS-3606 (observability proper).

## Known Issues

None outstanding. Three design points recorded rather than decided silently:

**1. Three fields, not two.** PAS-0004 names `correlationId` and `causationId`. A third,
`operationId`, is required for causation to mean anything: with only two, a child has nothing
to point *at* — causation would name the whole chain, and `A → B → C` becomes
indistinguishable from `A → B, A → C`. `operationId` is not exposed as a persisted field;
`correlationFields()` projects it into the `causationId` that PAS-0302's envelope expects, so
the wire contract is exactly the two fields the ticket names.

**2. Correlation ids are not produced by the Canonical ID Service (PAS-0103).** That service
governs the identity of governed records. A correlation id identifies an operation in flight —
telemetry, with no lifecycle and no foreign keys. Conflating them would make the ID service a
startup dependency of logging, and PAS-0004 precedes PAS-0103 in the build order precisely
because correlation must work before any domain object exists.

**3. `traceparent` is read, not implemented.** A W3C trace id is accepted as a fallback so a
chain begun by a standards-speaking upstream is not broken. PAS does not emit `traceparent` and
does not claim distributed tracing — PAS-3606 owns that. Reading one header is cheap;
pretending to be a tracing system is not.

---

## Acceptance Criteria

| PAS-0004 requirement | Evidence |
|---|---|
| Every **request** receives a correlationId | ✅ `contextFromHeaders` + `runInNewOperation` |
| Every **workflow** operation receives one | ✅ `runInChildOperation`, `kind: 'workflow'` |
| Every **worker** operation receives one | ✅ `contextFromRecord`, tested across a process boundary |
| Every **event** receives one | ✅ `correlationFields()` → PAS-0302 envelope |
| Every **agent task** receives one | ✅ same primitives, `kind: 'agent-task'` |
| `causationId` where one operation causes another | ✅ `deriveChildContext`; `A → B → C` tested |
| Identity follows across **API** | ✅ headers in and out, response echo |
| …across **database** | ✅ `currentCorrelationId()` for PAS-0101 tagging |
| …across **workflow** | ✅ child derivation, parent restored after nesting |
| …across **events** | ✅ `correlationFields()` |
| …across **workers** | ✅ `contextFromRecord`, end-to-end test |

Root gate `npm run verify`: **exit 0**.

**STATUS: COMPLETE.**
