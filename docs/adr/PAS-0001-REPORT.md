# PAS-0001 — Initialize Production Monorepo

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0001 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 00 — Engineering Foundation |
| **Authority** | Clean-Sheet Build Specification PAS-0001; ADR-003 |
| **Baseline** | `f23d11a` (tag `baseline-prototype-v0`) |

---

## Purpose

Establish the permanent repository structure for the complete PAS platform, moving the
preserved frontend into `apps/web/` structurally, without modifying product behavior.

---

## Files Created

**Root**
`package.json` (workspace manifest, replaces the single-app manifest) ·
`tsconfig.base.json` · `eslint.config.js`

**Applications**
`apps/web/package.json` · `apps/web/vitest.config.ts` · `apps/web/tests/app.smoke.test.tsx` ·
`apps/api/{package.json,README.md,src/.gitkeep,tests/.gitkeep}` ·
`apps/worker/{package.json,README.md,src/.gitkeep,tests/.gitkeep}`

**Packages** — 17 × `{package.json, README.md, src/.gitkeep, tests/.gitkeep}`
`domain` · `database` · `contracts` · `auth` · `governance` · `workflows` · `events` ·
`agent-gateway` · `ingestion` · `authority-intelligence` · `composition` · `publishing` ·
`discovery` · `fellowship` · `observability` · `ui` · `config`

**Structural boundaries**
`migrations/` · `fixtures/` · `infrastructure/` ·
`tests/{integration,contract,e2e,security}/` ·
`docs/{architecture,adr,api,workflows,operations}/`

## Files Modified

| File | Change |
|---|---|
| `package.json` | replaced with workspace root manifest |
| `apps/web/tsconfig.json` | now `extends: ../../tsconfig.base.json`; options byte-identical to baseline |
| `.gitignore` | added `apps/*/dist/`, `packages/*/dist/` |
| `docs/IMPLEMENTATION_PLAN.md` | rewritten against Builds 00–37 |
| `docs/ARCHITECTURE_DECISIONS.md` | ADR-001 supersession; ADR-003; ADR-004 |

## Files Moved (structural only — `git mv`, zero content change)

```
src/              → apps/web/src/          (26 files, all tracked as renames)
index.html        → apps/web/index.html
vite.config.ts    → apps/web/vite.config.ts
tsconfig.json     → apps/web/tsconfig.json
```

**No application source file was edited.** Git recorded every move as `R` (rename), not
delete-plus-add.

## Database Migrations

None. PAS-0001 is structural; migrations begin at PAS-0102.

## Domain Contracts Added/Changed

None. No domain implementation occurs in PAS-0001.

## API Contracts Added/Changed

None.

## Events Added/Changed

None.

## Workflow Changes

None.

## Governance Changes

None in code. Three decisions recorded in `docs/ARCHITECTURE_DECISIONS.md`:

- **ADR-003** — clean-sheet backend/platform; migration discipline for the frontend. Resolves
  the specification fork. Establishes the four-level authority hierarchy and the three UI
  dispositions (Preserve / Generalize / Replace-only-when-superseded).
- **ADR-004** — origin does not create a governance exemption. **Closes DISC-2.**
- **ADR-001** — reclassified *transitional protection → structural replacement*. Principle
  permanent; the transitional guard lands at PAS-0504, the structural replacement at PAS-2801.

## Authorization Changes

None. PAS-0204 is the first authorization work.

## Tests Added

`apps/web/tests/app.smoke.test.tsx` — 3 tests:

1. authenticated OS shell mounts
2. all four `PASEnvironment` surfaces render without throwing
3. seeded record shape preserved (5 authority objects, 8 modules, 10 dossiers)

This is the non-regression harness for the migrated baseline. It asserts **behavioral
continuity**, explicitly *not* behavioral correctness — CONF-A, SUP-13 and the other recorded
findings remain open and are addressed by their own tickets.

## Tests Passed

```
 ✓ tests/app.smoke.test.tsx (3 tests) 435ms
   Test Files  1 passed (1)
        Tests  3 passed (3)
```

## Typecheck Result

✅ **PASS** — `tsc --noEmit`, zero errors.

## Build Result

✅ **PASS** — 61 modules transformed, built in 879ms.

### Behavioral-equivalence proof

Build artifacts before and after the move are **byte-identical**:

```
BEFORE (at f23d11a)                       AFTER (apps/web)
a629bfc911408e9d34241d85d27d4aa4  css     a629bfc911408e9d34241d85d27d4aa4  css
63a17f150ca2f875c2ced46dd0b97be2  js      63a17f150ca2f875c2ced46dd0b97be2  js
91c7fda9b10c7513541943f4beb3433a  html    91c7fda9b10c7513541943f4beb3433a  html

diff → IDENTICAL
```

Identical MD5 across all three artifacts is the strongest available proof that the structural
move changed nothing the user can observe.

## Security / Privacy Impact

**None introduced.** No code path, data flow, visibility rule or exposure surface changed.

**None resolved.** SUP-13 remains live at the new paths —
`apps/web/src/components/public/PublishedPersonalPAS.tsx:267` still renders the `GATED`
`auth-anthem-loi` on the `CORE_PUBLIC` `d03` dossier. Resolution is PAS-0504, per ADR-001's
transitional obligation. PAS-0001 does not and must not address it.

## Backward Dependency Check

✅ No circular package dependencies (DFS three-colour check over all 20 workspaces).
✅ `@pas/web` is a dependency of **nothing** — PAS-0001's rule that *the web application SHALL
NOT become a dependency of domain packages* holds.

Declared graph (only what PAS-0001 declares; nothing inferred):

```
contracts, database, auth, events, agent-gateway,
authority-intelligence, observability, ui, config   → (none)
domain        → contracts
governance    → domain, contracts
workflows     → domain, governance, events
composition   → domain
ingestion     → domain, workflows, agent-gateway
publishing    → composition, domain, governance
discovery     → publishing, domain
fellowship    → domain, authority-intelligence
api           → domain, contracts, auth
worker        → domain, workflows, events
web           → (none)
```

## Forward Dependencies Unlocked

PAS-0002 (config) · PAS-0003 (errors) · PAS-0004 (correlation) · PAS-0005 (health) ·
PAS-0006 (CI). Build 01 may begin on completion of Build 00.

## Known Issues

None that affect an acceptance criterion. Two disclosures:

**1. Lint rule aligned to the project's declared compiler policy.**
`@typescript-eslint/no-unused-vars` is set to `warn`, not `error`. It produced 19 findings
across 10 preserved files — all dead imports and unused destructured values.

The baseline's own `tsconfig` sets `"noUnusedLocals": false` and `"noUnusedParameters": false`
— a deliberate project policy present at `f23d11a`. A linter that *errors* on exactly what the
compiler config permits is inconsistent with the project, not with the code. Removing them
requires editing 10 source files, which ADR-003 and the PAS-0001 instruction forbid.

The rule is `warn`, **not `off`** — all 22 findings print on every lint run and in CI. They are
removed by the tickets that rewrite those files (Builds 17, 23, 24, 26, 27). Affected:
`types/pas.ts` · `store/usePASStore.ts` · `services/{ai/AgnosticAIEngine,parser/DocumentParser,studio/ExecutiveProductionStudio}.ts` ·
`components/{account/VerificationView,builder/PASBuilderWorkspace,manage/AuthorityGraphView,public/PublishedBusinessPAS,public/PublishedPersonalPAS,publishing/PublishingCenter}.tsx`

**2. Test runner pinned to vitest 2.x.**
Vitest 5 requires Vite ≥ 6. The preserved frontend pins Vite `^5.2.11`, and upgrading Vite
would change the build output — violating the behavioral-equivalence requirement. Vitest
`^2.1.0` supports Vite 5. Verified: Vite remains **5.4.21**, and build artifacts are
byte-identical. Revisit when the frontend's Vite version is deliberately upgraded under its
own ticket.

**Deferred, not an acceptance criterion:** existing `docs/*.md` remain at `docs/` root rather
than relocating into the new `docs/architecture/` and `docs/adr/` subdirectories. Moving them
now would break roughly thirty cross-references between the five controlling documents for no
structural gain. The boundaries exist; population is incremental.

---

## Acceptance Criteria

PAS-0001: *"Fresh clone supports: install, typecheck, lint, test, build. No circular package
dependencies."*

Verified against a **deleted and reinstalled** `node_modules`:

| Criterion | Command | Result |
|---|---|---|
| install | `npm install` | ✅ 274 packages, clean |
| typecheck | `npm run typecheck` | ✅ zero errors |
| lint | `npm run lint` | ✅ 0 errors, 22 warnings |
| test | `npm run test` | ✅ 3/3 passed |
| build | `npm run build` | ✅ byte-identical artifacts |
| no circular deps | DFS over 20 workspaces | ✅ none |
| web not a domain dependency | dependency scan | ✅ none |

`npm run verify` chains all four gates; exit code **0**.

---

## Constraint Compliance

Every PAS-0001 prohibition, verified:

| Constraint | Status |
|---|---|
| Do not modify product behavior | ✅ byte-identical build artifacts |
| Do not redesign components during the move | ✅ all 26 files tracked as `git mv` renames |
| Do not begin backend domain implementation | ✅ `apps/api`, `apps/worker`, all 17 packages contain only `package.json`, `README.md`, `.gitkeep` |
| Do not refactor M01–M08 | ✅ untouched |
| Do not refactor dossiers | ✅ untouched |
| Do not refactor Zustand store | ✅ untouched |
| Do not refactor parsers | ✅ untouched |
| Do not refactor Fellowship alignment | ✅ untouched |
| Do not refactor JSON-LD | ✅ untouched |
| Do not refactor UI components | ✅ untouched |

**STATUS: COMPLETE.**
