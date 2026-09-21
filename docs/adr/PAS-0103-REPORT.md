# PAS-0103 — Canonical ID Service

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0103 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 01 — Database Foundation |
| **Depends on** | PAS-0001 ✅ (package topology), PAS-0003 ✅ (`ValidationError`) |
| **Retires** | SUP-11 — "Semantic IDs are acceptable" |

---

## Purpose

`packages/domain/src/identity/` exposing `generateId()`, producing identifiers that are
durable and non-semantic, encoding no entity type, module, dossier, page, owner name or
sequence meaning.

§XLI also requires that *"representation IDs and authority IDs remain separate."* That is
honoured in the type system, not in the value — the moment separation lives in the string,
the identifier has become semantic.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/domain/src/identity/id.ts` | `Id`, `generateId`, `isId`, `parseId`, `assertId`, `ID_PATTERN`, `NIL_ID` |
| `packages/domain/src/identity/index.ts` | identity surface |
| `packages/domain/src/index.ts` | package surface |
| `packages/domain/tests/identity.test.ts` | 23 tests |
| `packages/domain/tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts` | build and test setup |
| `tests/integration/built-packages.test.ts` | every built package loads under `node` |

## Files Modified

| File | Change |
|---|---|
| `packages/domain/package.json` | scripts, entry points, dev dependencies — it was a scaffold with none |
| `packages/domain/README.md` | identity contract and the UUIDv4 rationale |
| `package.json` | `@pas/domain` added to the build order |
| `vitest.shared.ts` | `@pas/domain` source alias |
| `docs/ARCHITECTURE_DECISIONS.md` | SUP-11 status |

**No new workspace dependency edges.** `@pas/domain → @pas/contracts` was declared at
PAS-0001; `apps/api → @pas/domain` already existed. Nothing was added.

---

## Database Migrations

None. Identity is a value service; the tables that carry identifiers arrive at Build 02.

Recorded for those migrations: the column type is PostgreSQL `uuid`, not `text`. 16 bytes,
natively indexed, and returned as the canonical lowercase form `isId` requires.

---

## Domain Contracts Added/Changed

```ts
type Id<Scope extends string = string>

generateId<Scope>(): Id<Scope>          // no arguments
isId<Scope>(value: unknown): value is Id<Scope>
parseId<Scope>(value: unknown, field?): Id<Scope>   // untrusted input; normalises
assertId<Scope>(value: unknown, what?): Id<Scope>   // internal invariant; does not
ID_PATTERN, NIL_ID
```

`Scope` is a compile-time discriminator with no representation in the value. **No concrete
scopes are declared.** The entities do not exist until Build 04, and naming them now would be
implementation deciding architecture.

---

## API Contracts / Events / Workflow / Governance / Authorization

None. This ticket adds no route, no event and no governed write path.

Stated because it will be assumed otherwise: **an identifier is not a capability.** These are
unguessable and that must never be read as a security property. Knowing an identifier
authorizes nothing; authorization is PAS-0203/PAS-0204, checked on every access.

---

## Tests Added

**`packages/domain/tests/identity.test.ts` — 23 tests.** The ticket's requirement is a set of
negatives — the identifier must not encode entity type, module, dossier, page, owner name or
sequence meaning — and a negative is only tested by trying to recover the thing that must not
be there. So the tests attack the identifier rather than confirming it is a unique string.

| Group | Tests |
|---|---|
| `generateId` | canonical form, distinctness across 512, never nil |
| encodes nothing (§XLI) | **takes no arguments**; sorting does not recover creation order; a second's gap leaves no shared prefix; version and variant pinned; every SUP-11 identifier rejected |
| scopes | different scopes produce indistinguishable values; `@ts-expect-error` proves the compiler separates them; a scoped id is accepted where an unscoped one is expected |
| `parseId` | case and whitespace normalised to one spelling; nil rejected *and named*; other UUID versions rejected; non-strings; **does not echo the rejected value**; names the field |
| `assertId` | returns its input; refuses to normalise; rejects nil |
| round trip | generate → parse → assert; the PostgreSQL `uuid` column contract |

**`tests/integration/built-packages.test.ts` — 12 tests.** `apps/api` has an entry point, so
`api-process.test.ts` spawns it. A library package has none, so a resolution defect in its
build output stays invisible until the first build that imports it — several tickets away.
This loads each `dist/index.js` by file URL and exercises a smoke path.

### Mutation testing

| Mutation | Result |
|---|---|
| `generateId` → a real UUIDv7 (48-bit ms timestamp, version 7) | 8 tests failed |
| `generateId(kind = 'auth')` returning `auth-<uuid>` — the SUP-11 shape | 7 failed |
| `generateId` → an incrementing counter | 1 failed — the creation-order test |
| `ID_PATTERN` loosened to any UUID version | 4 failed |
| `parseId` stops lowercasing | 1 failed |
| `parseId` returns the raw input instead of the normalised form | 1 failed |
| `parseId` echoes the rejected value in its message | 1 failed |
| `assertId` silently normalises | 1 failed |
| **`isId` stops checking `NIL_ID`** | **survived** |

The last one survived because the check was **dead code**: the nil UUID carries `0` where
`ID_PATTERN` requires the version nibble `4`, so the pattern already excluded it and the
explicit comparison was carrying nothing. Dead code that reads as load-bearing is worse than
no code — the next reader assumes the pattern might accept nil.

Removed from `isId`. Kept in `parseId`, where it is reached *before* the pattern test and
exists only so the message can say "must not be the nil identifier" rather than "must be a
canonical PAS identifier" — one sends an integrator to the field that was never set, the
other sends them hunting. Two tests now pin this: one asserts `ID_PATTERN` itself rejects
nil, so the relationship is explicit; one asserts the message names it. The
`any-version` mutation above fails both, which is the loosening that would reintroduce the
hole.

---

## Tests Passed

```
npm run ci
  typecheck            ✅
  lint                 ✅  0 errors
  unit tests           ✅  @pas/domain 23 · @pas/database 62 · @pas/observability 37 · others green
  production build     ✅
  integration tests    ✅  26 (7 PAS-0006 + 7 PAS-0102 + 12 PAS-0103)
  migration validation ✅
  frontend baseline    ✅  byte-identical to f23d11a
```

---

## Typecheck / Lint / Build

Clean. `packages/domain` was a scaffold with no scripts, no `tsconfig`, and no build — it had
never been compiled. It is now in the root build order (ahead of `@pas/api`, which depends on
it) and in `vitest.shared.ts` so tests resolve it to source.

---

## Security / Privacy Impact

- **Identifiers leak nothing about their subject.** A v7 or ULID would disclose, to anyone
  holding two identifiers, when each record was created — information about the subject of a
  PAS, not about the row. v4 discloses nothing.
- **Rejected input is never echoed.** `parseId` and `assertId` describe the *expectation*,
  never the caller's value, which reaches logs and error bodies. Tested with a SQL-injection
  string.
- **Identifiers are drawn from the platform CSPRNG**, so they are not predictable from one
  another — and that is explicitly *not* relied on as authorization. See above.
- **The nil identifier is rejected**, so an uninitialised field cannot become a real record
  every row can point at.

---

## Backward Dependency Check

No new workspace edges. `@pas/domain → @pas/contracts` is PAS-0001's declared direction;
`apps/api → @pas/domain` predates this ticket.

**`apps/web` is not a dependency of any domain package.** Re-verified.

### ADR-002 consumer sweep

This build changes the meaning of identity. Every component that generates identifiers today
was inspected:

| Site | Disposition |
|---|---|
| `packages/observability/src/correlation/ids.ts` | **Not a consumer.** Correlation and operation IDs identify an operation in flight — telemetry, no lifecycle, no foreign key. PAS-0004's own header already records why they are not produced here. Unchanged. |
| `apps/web/src/store/usePASStore.ts:564`, `services/parser/WebHarvester.ts:32` | `auth-${Date.now()}`. Preserved. Under ADR-003 the frontend is progressively re-pointed, not rewritten; under the plan's Build 01 note these survive as *attributes* on migrated compositions. They lose their claim to define identity, which is what SUP-11's retirement means. |
| `apps/web` `M01`–`M08`, `d01`–`d10` | Same disposition. |
| Backend | Nothing else generates identifiers. |

No consumer required a change in this build.

---

## Forward Dependencies Unlocked

PAS-0104 (Canonical Timestamps) · Build 02 (account schema — the first tables to carry `uuid`
primary keys) · Build 04 (AuthorityEntity, and the first concrete `Id<Scope>` declarations).

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **Random primary keys fragment a B-tree.** Real, measured by the industry, and accepted
   here because the alternative is forbidden by the ticket. If it is ever measured to matter
   in PAS, the answer is a separate insert-ordered column the schema owns — never meaning
   smuggled back into identity. Recorded so the trade-off is not rediscovered as a defect.

2. **No concrete `Id<Scope>` types are declared.** Deliberate. The entities arrive at Build
   04; declaring their identity types now would be implementation deciding architecture
   (§LXI). The mechanism and one worked example are in the README.

3. **`generateId` has no injectable seam for deterministic tests.** Also deliberate — none of
   the properties worth testing need a fixed value, and a global override is a footgun. A
   later build that needs determinism can pass an identifier in rather than reaching into the
   generator.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Create `packages/domain/src/identity/` | ✅ |
| Expose `generateId()` | ✅ |
| IDs must be durable | ✅ a function of nothing — not the record, not the time, not the owner; renaming a subject or re-modelling a dossier cannot touch it |
| IDs must be non-semantic | ✅ structurally — `generateId()` takes no arguments, so there is no channel through which meaning could arrive |
| Do not encode entity type | ✅ not a parameter; asserted by arity |
| Do not encode module | ✅ same; `M01`–`M08` rejected by `isId`/`parseId` |
| Do not encode dossier | ✅ same; `d01`–`d10` rejected |
| Do not encode page | ✅ same |
| Do not encode owner name | ✅ same; `auth-asg-cdc`, `auth-anthem-loi` rejected |
| Do not encode sequence meaning | ✅ UUIDv4, not v7/ULID; sorting does not recover creation order; version and variant pinned so a generator swap fails the suite |
| §XLI — representation and authority IDs remain separate | ✅ `Id<Scope>`, compile-time only; proven by `@ts-expect-error` |

**No criterion is unmet. STATUS = COMPLETE.**
