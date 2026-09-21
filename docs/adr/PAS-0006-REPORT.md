# PAS-0006 — CI Pipeline

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0006 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 00 — Engineering Foundation (**closes Build 00**) |
| **Depends on** | PAS-0001 ✅ … PAS-0005 ✅ |

---

## Purpose

CI executes install, typecheck, lint, unit tests, integration tests, production build and
migration validation. No merge or deployment succeeds when these fail.

---

## Files Created

| Path | Purpose |
|---|---|
| `.github/workflows/ci.yml` | the pipeline |
| `scripts/validate-migrations.mjs` | migration validation |
| `scripts/check-frontend-baseline.mjs` | frontend byte-identity guard |
| `tests/integration/api-process.test.ts` | 7 tests against the **built** artifact |
| `tests/integration/vitest.config.ts`, `tsconfig.json` | integration project |
| `frontend-baseline.json` | recorded `f23d11a` artifact hashes |

## Files Modified

| File | Change |
|---|---|
| `package.json` | `ci`, `test:integration`, `validate:migrations`, `check:baseline` |
| `eslint.config.js` | Node globals for scripts; `no-undef` off for TS (see Known Issues) |
| `CLAUDE.md` | `npm run ci` is the pre-completion gate |

**`apps/web` source untouched.**

## Database Migrations / Domain Contracts / API Contracts / Events / Workflow / Governance / Authorization

None. This ticket adds no runtime code.

## Tests Added

**7 integration tests** — the first in the repository that exercise what actually ships.

| Group | Covers |
|---|---|
| the built process starts and serves | `node dist/main.js` answers `/health`, `/ready` with the config check passing, carries a correlation id on the wire, serves a typed 404 |
| the deployed process leaks nothing | production `/ready` body is exactly `{status, correlationId}`; 10 secrets absent from the wire; no stack traces |
| refuses invalid deployed configuration | exits non-zero rather than binding the port; reports every problem at once |

## Tests Passed

```
unit         134  (api 30 · observability 37 · config 33 · contracts 31 · web 3)
integration    7
total        141
```

## Typecheck / Build Result

✅ **PASS** — five workspaces. Frontend artifacts byte-identical to `f23d11a`, now enforced
mechanically rather than by inspection.

## The full pipeline, run from a clean tree

```
typecheck             ✓
lint                  ✓  0 errors, 22 warnings
unit tests            ✓  134
production build      ✓
integration tests     ✓  7
migration validation  ✓  no migrations yet
frontend baseline     ✓  3 artifacts unchanged
CI_EXIT=0
```

## Security / Privacy Impact

**Positive, indirectly.** The integration suite makes PAS-0005's leak guarantees enforceable
against the deployed artifact rather than against source: production `/ready` is asserted to
contain exactly `{status, correlationId}` and nothing else, with ten specific secrets — database
password, internal hostnames, ports, storage keys, session secret — checked absent from the raw
response bytes. A regression in the disclosure rule now fails CI.

`permissions: contents: read` — CI cannot write to the repository.

## Backward Dependency Check

✅ No circular dependencies. `@pas/web` remains a dependency of nothing. No workspace edges
added.

## Forward Dependencies Unlocked

**Build 00 is complete. Build 01 (Database Foundation) may begin.**

PAS-0102 extends `validate-migrations.mjs` with the runtime half — empty database → migrate →
application starts — and adds a Postgres service to the workflow.

## Known Issues

None outstanding. Two of the seven required steps had nothing to run against, and the pipeline
found three defects in code written during this ticket.

### The two empty steps — handled by giving them real content, not placeholders

`tests/integration/` and `migrations/` were both empty. A step that runs nothing and reports
success is *COMPLETE WITH TODO* wearing a different hat, so neither was stubbed.

**Integration tests** now spawn the built API process. PAS-0005 shipped 27 green unit tests
against an API that could not start (`ERR_MODULE_NOT_FOUND`), because unit tests transform
TypeScript source and `node` does not. This suite is the only one in the repository that
touches the artifact that deploys, and it exists specifically so that failure mode cannot
recur.

**Migration validation** enforces properties the specification already requires, without
needing a database — so it runs on every commit rather than only where Postgres exists:

| Rule | Source |
|---|---|
| `NNNN_snake_case_name.sql`, totally ordered | Part I §4 "deterministic", "support deployment ordering" |
| no duplicate sequence | two migrations with the same ordinal have no defined apply order |
| non-empty | — |
| checksum manifest, drift detected | PAS-0102 "checksum/version where supported" |

The checksum manifest prevents a specific silent failure: editing a migration that has already
run in production. The local database is fine (built by replaying the edited file), production
is fine (it ran the original), and the two schemas diverge with nothing to show for it. A
manifest change surfaces the edit in review.

Verified adversarially — malformed filename, duplicate sequence, checksum drift and deletion of
a recorded migration each fail with a specific message. On an empty directory it passes and
says so, because there are no invalid migrations.

### Three defects the pipeline caught, all in code written this ticket

1. **`no-undef` on `process`/`console` in `scripts/*.mjs`.** The ESLint config declared no Node
   globals. Fixed at the config, not by silencing the rule. `no-undef` is now **off for
   TypeScript**, on typescript-eslint's own recommendation: the compiler resolves identifiers
   against real type information while ESLint guesses from a globals list, so leaving it on
   means maintaining a duplicate, less accurate copy of the Node and DOM lib definitions.
   `npm run typecheck` is the check that actually catches this.

2. **A dead `stat` import** in the baseline script. Removed.

3. **A latent flake in my own test helper.** `freePort()` opened a connection to port 0,
   destroyed it, then returned a *random* port in the 20000–40000 range and left a no-op
   `reject;` expression behind. That is not finding a free port — it is guessing one, and it
   would have collided with a developer's local process or a concurrent CI job and produced a
   flake that looks like a product failure. Replaced with bind-port-0, read the assignment,
   release.

The third is the one worth noting: CI caught a defect in the test infrastructure being written
to catch defects.

### Beyond the seven required steps — flagged, revertible

An eighth step, **frontend baseline unchanged**, enforces CLAUDE.md §4 / ADR-003: `apps/web` is
preserved while the backend is built underneath it, and the proof is a byte-identical bundle.
That proof is worth nothing if it depends on someone remembering to run `md5sum`, which PAS-0005
demonstrated.

Judged in-domain rather than scope expansion: PAS-0006 *is* the CI pipeline, and adding a check
to the pipeline is inside the ticket's remit — unlike a workspace dependency edge, which touches
declared architecture. Flagged anyway. Deleting the step drops the guarantee and nothing else.

A legitimate frontend change re-records deliberately with
`npm run check:baseline -- --write`, and the diff to `frontend-baseline.json` appears in review.
Verified adversarially: modified artifact and new artifact both fail.

### Ordering deviation from the ticket text

The specification lists production build *after* integration tests. They run the other way
round because the integration suite spawns the built artifact. All seven steps execute; only
the order differs, and it differs because one genuinely depends on another. Documented in the
workflow.

### Provider

GitHub Actions, on Node 22. The repository is hosted on GitHub; the specification names no
provider. Reversible — the pipeline is `npm run ci`, and the workflow file is a thin wrapper
around it, so any runner can execute the same gate with one command.

---

## Acceptance Criteria

| PAS-0006 requirement | Evidence |
|---|---|
| CI executes **install** | ✅ `npm ci` — fails on a drifted lockfile |
| CI executes **typecheck** | ✅ five workspaces |
| CI executes **lint** | ✅ 0 errors |
| CI executes **unit tests** | ✅ 134 |
| CI executes **integration tests** | ✅ 7, against the built artifact |
| CI executes **production build** | ✅ five workspaces |
| CI executes **migration validation** | ✅ real validator, adversarially verified |
| No merge/deployment succeeds when these fail | ✅ sequential steps; job fails on first failure; `npm run ci` exits non-zero |

Full pipeline from a clean tree: **exit 0**.

**STATUS: COMPLETE.**
