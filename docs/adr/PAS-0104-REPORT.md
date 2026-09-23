# PAS-0104 — Canonical Timestamps

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0104 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 01 — Database Foundation (**closes Build 01**) |
| **Depends on** | PAS-0003 ✅ (`ValidationError`) |
| **Records** | SUP-14 — "`createdAt` can hold whatever date matters" |

---

## Purpose

`packages/contracts/src/temporal/` storing canonical timestamps in UTC, and distinguishing
the seven semantics the ticket names — `createdAt`, `updatedAt`, `occurredAt`, `validFrom`,
`validTo`, `publishedAt`, `observedAt` — such that `createdAt` cannot be overloaded to carry
real-world occurrence.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/contracts/src/temporal/instant.ts` | `Instant`, `toInstant`, `assertInstant`, `now`, `fromDate`/`toDate`, comparison |
| `packages/contracts/src/temporal/kinds.ts` | the seven kinds, `newRecordTimestamps`, `touch`, per-kind parsers |
| `packages/contracts/src/temporal/interval.ts` | `ValidityInterval`, `isValidAt`, `isWellFormed` |
| `packages/contracts/src/temporal/index.ts` | temporal surface |
| `packages/contracts/tests/temporal.test.ts` | 46 tests |
| `scripts/pg-start.sh` | idempotent local database start |

## Files Modified

| File | Change |
|---|---|
| `packages/contracts/src/index.ts` | exports the temporal surface |
| `packages/contracts/README.md` | canonical form, the seven semantics, storage contract |
| `docs/ARCHITECTURE_DECISIONS.md` | **SUP-14** |
| `docs/operations/local-database.md`, `package.json` | `npm run db:start` |

**No new workspace dependency edges.** `@pas/contracts` depends on nothing, and this ticket
did not change that.

---

## Database Migrations

None. Recorded as the contract Build 02's columns must honour:

**`timestamptz(3)`.**

`timestamptz` because it stores an absolute instant. **The `(3)` is load-bearing.** PostgreSQL
defaults to microsecond precision and JavaScript `Date` holds milliseconds, so an undeclared
column round trips lossily — a value written from JavaScript and read back compares equal,
but a value written by PostgreSQL and compared against one that has been through JavaScript
does not, for reasons invisible in the query.

---

## Domain Contracts Added/Changed

```ts
type Instant<Kind extends string = string>          // canonical UTC instant

type CreatedAt | UpdatedAt | OccurredAt | ObservedAt
   | ValidFrom | ValidTo | PublishedAt              // the seven, branded

now<Kind>(): Instant<Kind>
toInstant<Kind>(value, field?): Instant<Kind>       // untrusted input
assertInstant<Kind>(value, what?): Instant<Kind>    // internal invariant
fromDate / toDate / compareInstants / earliest / latest

newRecordTimestamps(): { createdAt, updatedAt }     // one clock read
touch(): UpdatedAt
toOccurredAt / toObservedAt / toValidFrom / toValidTo / toPublishedAt

interface ValidityInterval { validFrom; validTo: ValidTo | null }
isValidAt(interval, at) / isWellFormed(interval)    // half-open [from, to)
```

### The canonical form

```
YYYY-MM-DDTHH:mm:ss.sssZ
```

Fixed width, four-digit year, milliseconds always present, always `Z`. Deliberately stricter
than ISO-8601, which permits `2026-02-15T10:00Z`, `20260215T100000Z` and `+002026-…` for the
same instant.

Fixed width makes lexicographic order identical to chronological order, so `ORDER BY` in SQL,
`.sort()` in JavaScript and a sorted key listing agree. A variable-width form breaks that for
the oldest and newest records only.

### There is no `toCreatedAt`

`createdAt` and `updatedAt` are facts about what PAS did, so they come from the clock —
`newRecordTimestamps()` and `touch()` — and have no parser at all. **You cannot put 2015 into
a field you cannot parse a string into.** That is the structural half of "do not overload
`createdAt`"; the branded types are the other half. Hydrating a database row is
`assertInstant`, named differently so that using it in a create path reads wrong.

---

## API Contracts / Events / Workflow / Governance / Authorization

None. No route, no event, no governed write path.

---

## Tests Added

**`packages/contracts/tests/temporal.test.ts` — 46 tests.** The ticket's content is three
prohibitions, so the tests are mostly attempts to commit each one.

| Group | Tests |
|---|---|
| canonical form | UTC; offsets normalised; `Date` and canonical input; **lexicographic = chronological**; expanded-year range refused; the four-digit boundary pinned; `Date` round trip |
| names one moment | 11 rejected values, each in the baseline or one step from it; numbers rejected *with the reason*; non-values; **no echo on any of six rejection paths**; the error names the missing zone; the field is named |
| seven semantics | `@ts-expect-error` on `occurredAt → createdAt` (SUP-14) and five more pairings; any kind accepted where unkinded is expected; **the public surface has no `toCreatedAt`** |
| `newRecordTimestamps` | equal pair over 200 runs; **exact proof under a clock that advances on every read** |
| validity intervals | start included, end excluded; consecutive intervals abut with exactly one holding at every instant across the join; open-ended; empty intervals rejected |
| `assertInstant` | returns input; normalises nothing; rejects a well-shaped non-date |
| PostgreSQL contract | driver `Date` round trip; millisecond precision |

The compile-time guarantees are asserted with `@ts-expect-error`, which fails the **typecheck**
if an assignment ever starts being allowed. No runtime test can see them — the values are
identical strings, which is the requirement.

### Mutation testing

Twelve mutations. Eight were caught on the first pass; four survived and are worth stating
individually, because only two of them were weak tests.

| Mutation | First pass | After |
|---|---|---|
| zone check removed | 3 failed | — |
| time-of-day check removed | 1 failed | — |
| pattern made variable-width | 2 failed | — |
| `isInstant` stops checking the date is real | 1 failed | — |
| `assertInstant` silently normalises | 1 failed | — |
| kinds unbranded | **typecheck failed** | — |
| interval made closed `[from, to]` | 2 failed | — |
| empty intervals accepted | 1 failed | — |
| number branch disabled | **survived** | 1 failed |
| rejection message echoes the input | **survived** | 3 failed |
| `newRecordTimestamps` reads the clock twice | **survived** | 1 failed |
| `toCreatedAt` added | **survived** | 1 failed |

**The number branch** survived because disabling it changes nothing observable — numbers
still fall through to "not a string" and are still rejected. Only the *message* differs, and
the message is the branch's entire reason to exist: it tells the integrator which of the two
readings PAS could not choose between. Now asserted.

**The echo mutation** survived because I mutated a rejection path the test did not exercise.
`toInstant` refuses input at six points and the test covered one. A no-leak guarantee that
holds at five of six is not a guarantee. Now covered at every path, strings and non-strings.

**`toCreatedAt`** was a badly built mutation, not a weak test — it added the symbol to
`kinds.ts` without adding it to the explicit export list, so the public surface never changed.
Rebuilt properly, the test catches it. Recorded because a surviving mutation is not by itself
evidence of anything.

**The two-clock-read mutation is the one that mattered**, because it showed my own reasoning
was wrong. The original comment claimed two `now()` calls are "microseconds apart and
therefore unequal". They are not: `Date.now()` has millisecond resolution, so two consecutive
reads land in the same millisecond almost every time, and a 200-iteration loop passes against
a two-read implementation. The defect is *intermittent* — a small random fraction of new
records claim to have been modified, at a rate depending on machine speed — which is worse
than a consistent one, not better. The comment is corrected and the test now drives the clock
forward on every read, so one read yields an equal pair and two cannot.

---

## Tests Passed

```
npm run ci
  typecheck            ✅  including the @ts-expect-error assertions
  lint                 ✅  0 errors
  unit tests           ✅  @pas/contracts 77 · @pas/database 62 · @pas/domain 23 · @pas/observability 37
  production build     ✅
  integration tests    ✅  26
  migration validation ✅
  frontend baseline    ✅  byte-identical to f23d11a
```

---

## Typecheck / Lint / Build

Clean.

Two defects in the **tests** surfaced on the first run, both from wrong assumptions of mine
rather than implementation faults:

1. `new Date('0001-01-01Z').toISOString()` does **not** produce an expanded year — the
   expanded form starts outside 0000–9999, so year 1 is fixed-width and valid. The test
   asserting it was rejected was wrong. Replaced with the true boundary
   (`±8.64e15`, which does expand) plus a test pinning that the whole four-digit range is
   accepted.
2. `latest()` of a set including a clock-derived `createdAt` is that `createdAt`, not the
   2026-02-15 literal. The expectation was simply wrong.

One typecheck error worth recording: `ConstructorParameters<typeof Date>` resolves to the
*last* overload — a one-element tuple — so TypeScript proved `args.length === 0` impossible
and the no-argument branch of the test clock was unreachable. Widened to
`[] | [number | string | Date]`.

---

## Security / Privacy Impact

- **Rejected input is never echoed**, on any of the six rejection paths. Timestamps arrive
  from request bodies, connector payloads and imports, and the rejected value reaches logs
  and error bodies. Tested with SQL-injection strings and with non-string payloads carrying
  a hostile field.
- **Zoneless timestamps are refused rather than guessed.** Interpreting one in the server's
  local zone makes the same record mean different moments on different machines, which is a
  correctness failure that also corrupts any audit trail built on it.
- **No new wire surface.**

---

## Backward Dependency Check

No new workspace edges. `@pas/contracts` is the universal sink (ADR-005) and depends on
nothing; the temporal module imports only `ValidationError` from within the same package.

**`apps/web` is not a dependency of any domain package.** Re-verified.

### ADR-002 consumer sweep — finding recorded as SUP-14

This build changes the meaning of every timestamp in PAS, so every existing consumer was
inspected. Full detail in `docs/ARCHITECTURE_DECISIONS.md`; in summary:

| Site | Finding | Disposition |
|---|---|---|
| `usePASStore.ts:152, 169, 186, 203, 220` | `createdAt` holds `'2015-01-01'` etc. — the year the **organisation was founded**, not when the record was written. The store is in-memory and built at page load, so no record was created on the date it claims. **This is exactly what PAS-0104 forbids.** | Preserved (ADR-003) |
| `usePASStore.ts:417, 431, 445` | `PeerEndorsement.createdAt` holds `'1 week ago'`, `'5 days ago'`, `'2 days ago'` — a rendering in a timestamp field | Preserved (ADR-003) |
| `types/pas.ts:106, 107, 259, 344` | all four temporal fields typed `string`, which is what permitted both | Preserved (ADR-003) |
| `usePASStore.ts:514, 578, 595` | `new Date().toISOString()` into `updatedAt`, `createdAt`, `publishedAt` — **correct** | Unchanged |
| `observedAt`, `validFrom`, `validTo` | **absent from the baseline entirely** — no way to say "PAS learned this on X about an event on Y", or to express a credential that expired | New contract |
| Backend | no timestamps in any domain contract yet | — |

**`apps/web` was not changed.** Under ADR-003 the frontend is progressively re-pointed, not
rewritten, and these are display strings in a prototype store with no deployment. What this
build changes is that **no new contract may express a timestamp as `string`**. The baseline
fields are re-pointed when the store is replaced by real records.

---

## Forward Dependencies Unlocked

**Build 01 is COMPLETE.** Build 02 (account schema — the first tables to carry
`timestamptz(3)` columns) · Build 04 (AuthorityEntity, the first records with both clocks) ·
Build 06 (sources — `observedAt` is the provenance timestamp) · Build 11 (publishing —
`publishedAt` belongs to the publication, never the record it projects, INV-3).

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **`apps/web` still carries the SUP-14 values.** Deliberate, per ADR-003 and recorded in
   SUP-14's migration constraint. They are display data in a prototype store; what is
   retired is their claim to define the contract.

2. **No timezone-aware local-time type.** PAS-0104 asks for UTC instants and this delivers
   them. A future requirement to render "9am in the subject's local time" needs a separate
   zone field alongside the instant — deliberately *not* a timestamp that is secretly a local
   time. Recorded so the need is not met by weakening `Instant`.

3. **Cross-kind comparison must go through `compareInstants`.** TypeScript refuses `validFrom
   < validTo` between two brands, which is the brand working — most cross-kind comparisons
   are the bug. The ones that are meant say so by name. Noted because it is friction a caller
   meets immediately.

4. **`now()` reads the wall clock**, which moves backwards across an NTP correction. Nothing
   in PAS may derive ordering from two separate `now()` calls; ordering comes from the
   database under a transaction. Documented at the call site.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Store canonical timestamps in UTC | ✅ one canonical form, always `Z`; offsets normalised; zoneless values refused rather than guessed |
| Distinguish `createdAt` | ✅ `CreatedAt`, clock-only, no parser |
| Distinguish `updatedAt` | ✅ `UpdatedAt`, clock-only, no parser |
| Distinguish `occurredAt` | ✅ `OccurredAt` + `toOccurredAt` |
| Distinguish `validFrom` | ✅ `ValidFrom` + `toValidFrom`; inclusive bound |
| Distinguish `validTo` | ✅ `ValidTo` + `toValidTo`; exclusive bound, `null` open-ended |
| Distinguish `publishedAt` | ✅ `PublishedAt` + `toPublishedAt` |
| Distinguish `observedAt` | ✅ `ObservedAt` + `toObservedAt` |
| **Do not overload `createdAt` for real-world occurrence** | ✅ twice over — the assignment does not compile (`@ts-expect-error` proves it), and there is no parser that could produce a `CreatedAt` from a payload |
| §XL — the record envelope's created/updated timestamps | ✅ `RecordTimestamps`, from one clock read |

**No criterion is unmet. STATUS = COMPLETE.**
