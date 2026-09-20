# PAS Implementation Plan

**Derived from:** `docs/PAS_MASTER_SPECIFICATION.md` v1.0 §LVI–§LIX (controlling)
**Reconciled against:** `docs/RECONCILIATION.md`
**Baseline:** `f23d11a` — tag `baseline-prototype-v0`
**Status:** Phase 0 artifact

This document maps the twelve specification phases onto actual repository paths. It does not
introduce architecture. Where a path does not yet exist, it is proposed as a target location
consistent with §XLIII (modular monolith) — those are marked *(new)*.

---

## Standing rules — apply to every phase

**§LVII Migration rule.** `Expand → Migrate → Verify → Contract`. No prototype field is
deleted before replacement functionality exists and has been verified.

**§LVIII Non-regression.** At the close of every phase:

```bash
npm run build      # tsc must pass; production build must pass
```

plus: every existing screen still renders, and seed/demo mode remains available until the
corresponding production service exists.

**§LV Build Contract.** No component is complete until all eight questions are answerable:
Identity · Input · Output · Lineage · Governance · Observability · Continuity · Impact.

**§LXI.** Implementation does not make architectural decisions. Ambiguity resolves back to
the Master Specification.

---

## Target repository shape

Reached incrementally across Phases 1–4. Nothing is restructured up front.

```
PAS-PLATFORM/
├─ docs/                     # Phase 0 — controlling documents
├─ src/                      # existing frontend — PRESERVED
│  ├─ components/            # 20 components, visual baseline
│  ├─ services/              # client services; thin over API after Phase 4
│  ├─ store/                 # drains to UI state
│  ├─ types/                 # expand-only until Phase 6
│  └─ fixtures/       (new)  # Phase 1 — seed data relocated out of the store
├─ api/                (new) # Phase 1 — PAS API, modular monolith (§XLIII)
│  ├─ domain/                # entity, record, claim, evidence, experience…
│  ├─ governance/            # gates G0–G5, policy registry, decision engine
│  ├─ workflow/              # workflow runtime, human task queue
│  ├─ ingestion/             # source adapters, parsers, acquisition
│  ├─ agent/                 # Agent Gateway (§XXXV)
│  ├─ composition/           # composition engine, surfaces
│  ├─ publishing/            # snapshots, representations
│  ├─ discovery/             # discovery intelligence
│  └─ platform/              # ids, events, outbox, audit, impact
├─ worker/             (new) # Phase 1 — event dispatcher, deterministic + cognitive workers
└─ migrations/         (new) # Phase 1 — PostgreSQL schema
```

---

# Phase 0 — Freeze and document baseline

**Spec:** §LVI Phase 0. **Status: COMPLETE.**

| Deliverable | Path | State |
|---|---|---|
| Source tree extracted and committed | `src/`, root | `f23d11a` |
| Baseline tagged | `baseline-prototype-v0` → `f23d11a` | done |
| Master Specification in version control | `docs/PAS_MASTER_SPECIFICATION.md` | done |
| Architecture decision records | `docs/ARCHITECTURE_DECISIONS.md` | done — 30 invariants, 12 superseded assumptions |
| Reconciliation | `docs/RECONCILIATION.md` | done — all files classified |
| Implementation plan | `docs/IMPLEMENTATION_PLAN.md` | this document |

**No product redesign occurred. No source file was modified.**

**Exit criteria:** all three derived artifacts reconcile with the Master Specification, and
the owner confirms the handoff boundary is met (§LXI).

**Blocking on owner** before Phase 1 begins: none. The four open items in
`ARCHITECTURE_DECISIONS.md` block Phases 3, 4 and 5 respectively — not Phase 1 or 2.

---

# Phase 1 — Backend foundation

**Spec:** §LVI Phase 1, §XXXIV, §XLI, §XLIII. **No AI. No extraction. No intelligence.**

| Work | Path | Notes |
|---|---|---|
| Workspace structure | `package.json` | add `api`, `worker` workspaces |
| Server application | `api/` *(new)* | modular monolith (§XLIII) |
| Configuration | `api/config/` *(new)* | no secrets in repo |
| PostgreSQL + migrations | `migrations/` *(new)* | canonical transactional truth |
| **Canonical ID service** | `api/platform/ids/` *(new)* | §XLI — durable, non-semantic. Replaces `auth-${Date.now()}` (SUP-11) |
| `AuthorityEntity` | `api/domain/entity/` *(new)* | §III — `PERSON`, `ORGANIZATION` |
| `AuthorityRecord` | `api/domain/record/` *(new)* | §III |
| Audit service | `api/platform/audit/` *(new)* | §XXXIV |
| Event ledger | `api/platform/events/` *(new)* | append-only (§XXXIII) |
| Transactional outbox | `api/platform/outbox/` *(new)* | atomic mutation + publication |
| Event dispatcher | `worker/` *(new)* | processes outbox |
| Identity/access | `api/platform/auth/` *(new)* | needed by `MasterAdminView` gating |
| **Seed extraction** | `src/fixtures/wdjiv.ts` *(new)* | move seed data out of `usePASStore.ts`; store imports it |
| API proxy | `vite.config.ts` | dev proxy to `api` |
| Strict-mode review | `tsconfig.json` | do this **before** the ontology lands — cost rises with every new type |
| Test runner | `package.json` | none exists today; required from here on |

**Frontend impact:** one change only — `usePASStore.ts` imports its seed data instead of
inlining it. Zero behavior change.

**Exit criteria:** `npm run build` passes · every screen renders identically · an
`AuthorityEntity` can be created, audited and read back · an event lands in the ledger via
the outbox.

---

# Phase 2 — Core Authority ontology

**Spec:** §LVI Phase 2, §V, §VI, §VII, §IX, §X, §XI.

| Work | Path | Notes |
|---|---|---|
| `SourceRecord` | `api/domain/source/` *(new)* | §VII |
| `Observation` | `api/domain/observation/` *(new)* | §VII |
| `ProposedClaim` | `api/domain/claim/` *(new)* | the extraction output type (§VIII) |
| `Claim` | `api/domain/claim/` *(new)* | §VII |
| `Evidence` | `api/domain/evidence/` *(new)* | first-class record, not an enum tag |
| **`Experience`** | `api/domain/experience/` *(new)* | §VI — ~19 attributes |
| Graph persistence | `api/domain/graph/` *(new)* | `GraphEdge` preserved (§XI) |
| Versioning | `api/platform/versioning/` *(new)* | INV-29 |
| Governance lifecycle | `api/domain/lifecycle/` *(new)* | §X state machine |
| **Type expansion** | `src/types/pas.ts` | **expand only** — add, never remove |
| **Visibility filter** | `src/services/schema/JSONLDGenerator.ts` | ⚠️ see ordering note below |
| Fixture migration | `src/fixtures/` | WDJIV seed → real records, UI unchanged |

> ### ⚠️ Ordering exception — `JSONLDGenerator`
> `RECONCILIATION.md` Part 12 item 2. `JSONLDGenerator` reads all authority objects with no
> visibility filter. This is harmless today only because every seed object is `PUBLIC`.
> **The moment this phase introduces private records, an unfiltered generator publishes
> them.** The filter is nominally Phase 7 work but must land here. This is the one dependency
> in the plan that runs backwards against the phase numbering.

**Exit criteria:** `npm run build` passes · all screens render · a Claim can be created with
Evidence attached and provenance recorded · an Experience record round-trips ·
`tsc` passes with zero removals from `types/pas.ts`.

---

# Phase 3 — Governance and workflow

**Spec:** §LVI Phase 3, §X, §XXXVII, §XXXIX. **This is where CONF-A closes.**

| Work | Path | Notes |
|---|---|---|
| Governance Policy Registry | `api/governance/policy/` *(new)* | §XXXVII |
| Decision Engine | `api/governance/decision/` *(new)* | `ALLOW`/`DENY`/`REQUIRE_REVIEW`/`REQUIRE_CONFIRMATION`/`ESCALATE` |
| Gates G0–G5 | `api/governance/gates/` *(new)* | intake · evidence · authority · publication · action · learning |
| **Single governed write path** | `api/domain/write/` *(new)* | the CONF-A chokepoint |
| Workflow Runtime | `api/workflow/` *(new)* | long-running governed processes |
| Human Task Queue | `api/workflow/tasks/` *(new)* | §XXXVI human worker class |
| **Dependency/Impact Service** | `api/platform/impact/` *(new)* | §XXXIX — replaces `Dossier.affectedByUpdates` |
| Verification registry | `api/governance/verification/` *(new)* | ⛔ **blocked — open item 1** |
| Review queue UI | `src/components/dashboard/OverviewDashboard.tsx` | proposals, not publications |
| Review queue UI | `src/components/manage/ConnectionsManager.tsx` | accept → `ProposedClaim` |
| Creation → Claim | `src/components/manage/AuthorityGraphView.tsx` | SUP-12; remove hardcoded `M03`/`d01` |
| Verification surface | `src/components/account/VerificationView.tsx` | ⛔ **blocked — open item 1** |

### CONF-A closure — the five sites

All five route through the single governed write path. Patching them individually reproduces
the defect five times and leaves nowhere to enforce INV-10.

| # | Site | After |
|---|---|---|
| 1 | `services/parser/WebHarvester.ts:37-42` | → `ProposedClaim` |
| 2 | `services/parser/DocumentParser.ts:40-100` | → `Observation` + `ProposedClaim` |
| 3 | `services/ai/AgnosticAIEngine.ts:61-108` | → `ProposedClaim` (return type change) |
| 4 | `store/usePASStore.ts:558-586` | accept → advance lifecycle, not publish |
| 5 | `components/manage/AuthorityGraphView.tsx:15-39` | user entry → `Claim` at `DRAFT` |

> ⛔ **Blocked on owner — open item 1.** `VERIFIED` means "the applicable verification
> requirement has been satisfied" (§IX). Those requirements are not enumerated anywhere.
> Until the registry is decided, no `VERIFIED` transition can be implemented without
> inventing verification semantics — which §LXI forbids implementation from doing. The rest
> of Phase 3 proceeds without it.

**Exit criteria:** `npm run build` passes · no path in the codebase can create public
authority without a G3 decision · invalidating one Evidence record resolves to the exact set
of affected claims, surfaces and representations.

---

# Phase 4 — Real ingestion

**Spec:** §LVI Phase 4, §VIII, §XXXV, §XXXVI, §XLV. *Everything extracted enters as proposals.*

| Work | Path | Notes |
|---|---|---|
| Object storage | `api/platform/storage/` *(new)* | source artifacts |
| Document ingestion | `api/ingestion/documents/` *(new)* | real PDF/DOCX/TXT/CSV parsing |
| Safe web acquisition | `api/ingestion/web/` *(new)* | SSRF protection, robots/ToS, timeouts, size limits, content-type allowlist |
| Connector adapters | `api/ingestion/connectors/` *(new)* | OAuth + token lifecycle; removes vendor names from domain types (SUP-8) |
| Extraction pipeline | `api/ingestion/pipeline/` *(new)* | `SourceRecord → Observation → ProposedClaim` |
| **Agent Gateway** | `api/agent/` *(new)* | §XXXV — routing, prompt versions, structured outputs, timeouts, retries, cost accounting, tool permissions, logging, fallbacks |
| Provider adapters | `api/agent/providers/` *(new)* | LLM-agnostic |
| Worker classes | `worker/` | deterministic · cognitive · human (§XXXVI) |
| Rebuild | `src/services/parser/WebHarvester.ts` | **must never fabricate from a hostname** (§XLV) |
| Rebuild | `src/services/parser/DocumentParser.ts` | filename regex → weak hint only |
| Rebuild impl | `src/services/ai/AgnosticAIEngine.ts` | interface preserved; returns proposals |
| Builder stages 1–3 | `src/components/builder/PASBuilderWorkspace.tsx` | real acquisition, ingestion, extraction |

> ⛔ **Blocked on owner — open item 3.** Retention and deletion policy for `SourceRecord`
> artifacts. Ingesting real documents creates a data-protection surface the prototype never
> had. Decide before the first real document is stored.

**Exit criteria:** `npm run build` passes · a real URL is fetched, stored and observed · a
real PDF produces anchored observations · **no ingestion path can write approved or public
state** · Builder remains walkable end-to-end.

---

# Phase 5 — Authority intelligence

**Spec:** §LVI Phase 5, §XII, §XIII, §XIV, §XX.

| Work | Path | Notes |
|---|---|---|
| `Knowledge` | `api/domain/knowledge/` *(new)* | §XII |
| `KnowHow` | `api/domain/knowhow/` *(new)* | §XII |
| `Expertise` | `api/domain/expertise/` *(new)* | §XII |
| Domain discovery | `api/domain/domains/` *(new)* | §XIII — emergent, not fixed |
| Cluster discovery | `api/domain/clusters/` *(new)* | §XIV |
| **Gap Interview** | `api/workflow/gap-interview/` *(new)* | §XX — gap-driven, not a static questionnaire |
| Conflict detection | `api/governance/conflict/` *(new)* | §X `CONFLICT` state |
| Authority reconstruction | `api/domain/reconstruction/` *(new)* | §XIX step 4 |
| Builder stage 6 | `src/components/builder/PASBuilderWorkspace.tsx` | fixed lenses → Gap Interview |
| **Fixture B** | `src/fixtures/academic.ts` *(new)* | ⛔ **blocked — open item 2** |
| **Fixture C** | `src/fixtures/practitioner.ts` *(new)* | ⛔ **blocked — open item 2** |

§XII constrains derivation hard: Knowledge, Know-How and Expertise **must not** be inferred
solely from job titles, keywords, credentials, self-description or AI similarity.

> ⛔ **Blocked on owner — open item 2.** `RECONCILIATION.md` Part 12 item 4: domain and
> cluster discovery validated against Fixture A alone will encode WDJIV's shape as the
> universal shape — the exact failure INV-5 exists to prevent. Fixtures B and C are a
> correctness requirement for this phase, not a testing nicety. Phase 5 cannot be declared
> complete without them.

**Exit criteria:** `npm run build` passes · domains emerge from record content, with
**different counts** across Fixtures A, B and C · gap interview generates questions from
actual missing information · no expertise is established from a credential alone.

---

# Phase 6 — Dynamic composition

**Spec:** §LVI Phase 6, §XVI, §XVII, §XVIII, §XLVII, §XLVIII.
*Where fixed M01–M08 / d01–d10 assumptions are finally removed from generalized runtime behavior.*

| Work | Path | Notes |
|---|---|---|
| `CompositionDefinition` | `api/composition/definitions/` *(new)* | §XVI — owns selection rules |
| Composition Engine | `api/composition/engine/` *(new)* | §XVIII |
| `AuthoritySurface` | `api/composition/surfaces/` *(new)* | §XVII — 20 types, extensible |
| Representation versioning | `api/composition/versions/` *(new)* | |
| Dossier migration | `src/components/dossiers/DossierManager.tsx` | §LVII worked example |
| **Contract `types/pas.ts`** | `src/types/pas.ts` | first removals permitted — only after verification |
| Exposure config | `src/components/design/PASDesignStudio.tsx` | surfaces, not fixed modules |
| Preview | `src/components/preview/LivePASPreview.tsx` | compositions, not modules |
| Retarget | `src/services/studio/ExecutiveProductionStudio.ts` | surfaces, not dossiers |

### The §LVII worked example — executed literally

1. **Expand** — add `CompositionDefinition`. `associatedDossierIds` still present and still working.
2. **Migrate** — move the 10 WDJIV dossier memberships into composition rules.
3. **Verify** — rendered Personal PAS is **unchanged**. `PublishedPersonalPAS.tsx:267` already
   resolves membership as a query, so this is the natural seam. Write this as a regression test.
4. **Contract** — only now deprecate `associatedDossierIds`.

Identically for `CanonicalModuleCode`. M01–M08 survive as the migrated WDJIV reference
composition (§XLVII permits them to remain visible). What is retired is the *universal* claim.

**Exit criteria:** `npm run build` passes · all 10 WDJIV dossiers render identically ·
Fixtures B and C produce **different surface counts** · deleting a composition leaves the
Authority Record byte-identical (INV-14, testable).

---

# Phase 7 — Publishing

**Spec:** §LVI Phase 7, §XXI, §XXII, §XLIX, §L, §LIII.

| Work | Path | Notes |
|---|---|---|
| Publication snapshots | `api/publishing/snapshots/` *(new)* | full lineage (INV-24) |
| Public representation API | `api/publishing/representations/` *(new)* | |
| Canonical URLs / sitemaps | `api/publishing/urls/` *(new)* | |
| Machine representation | `api/publishing/machine/` *(new)* | §XXII |
| Snapshot semantics | `src/components/publishing/PublishingCenter.tsx` | counts → lineage; publish through G3 |
| Data source | `src/components/public/PublishedPersonalPAS.tsx` | §XLIX — *gradually*; do not restyle |
| Data source | `src/components/public/PublishedBusinessPAS.tsx` | §L — backed by Organization entity |
| Deduplicate JSON-LD | `src/components/account/SEOSchemaView.tsx` | remove inline builder (SUP-9) |
| Single adapter | `src/services/schema/JSONLDGenerator.ts` | derive from governed representations |
| Routing + auth | `src/App.tsx` | published surfaces resolve by URL |

A snapshot must record: representation versions · supporting claim/evidence versions ·
visibility · canonical URLs · structured-data versions · publisher/authorization · timestamp.

**Exit criteria:** `npm run build` passes · published PAS is **reproducible from its
snapshot** · visual output pixel-equivalent for Fixture A · no private material appears in
any machine representation.

---

# Phase 8 — Discovery Intelligence

**Spec:** §LVI Phase 8, §XXIV, §XXV, §XXVI.

| Work | Path | Notes |
|---|---|---|
| `Demand` | `api/discovery/demand/` *(new)* | §XXIV |
| Query targets | `api/discovery/queries/` *(new)* | |
| `DiscoveryObservation` | `api/discovery/observations/` *(new)* | §XXV |
| AI/Search Observatory | `api/discovery/observatory/` *(new)* | |
| Gap diagnosis G1–G11 | `api/discovery/gaps/` *(new)* | §XXVI |
| Authority-Demand Matching | `api/discovery/matching/` *(new)* | **must support a negative answer** |
| Discovery UI | `src/components/account/SEOSchemaView.tsx` | telemetry *behind* the existing experience |

§XXV is a hard constraint: *"The system records observations. It does not pretend to know
what cannot actually be measured."* AI citation data that cannot be observed must not be
fabricated into a metric. §XXIV: results must not become simplistic public ranking scores.

**Exit criteria:** `npm run build` passes · matching returns *no supported authority* as a
first-class result (INV-16) · unmeasurable signals are absent, not estimated.

---

# Phase 9 — Fellowship

**Spec:** §LVI Phase 9, §XXVII, §LI.

| Work | Path | Notes |
|---|---|---|
| `AuthorityAlignment` | `api/fellowship/alignment/` *(new)* | stores **reasons**, not a number |
| Explainable matching | `api/fellowship/matching/` *(new)* | governed graph intersections |
| Citations / vouches | `api/fellowship/citations/` *(new)* | object-specific (§LI preserves this) |
| Recognition workflows | `api/fellowship/recognition/` *(new)* | |
| Alignment display | `src/components/ecosystem/FellowshipView.tsx` | replaces `94% PAS Alignment` (L149) |

The type must make an unexplained percentage unrepresentable (INV-20). PAS answers *why*
two entities are aligned — shared domains, common work, verified relationships — not *94%*.
The Fellowship visual experience is PRESERVE; only the number's source changes.

**Exit criteria:** `npm run build` passes · every alignment resolves to specific graph
intersections · Fellowship feed and endorsements render unchanged.

---

# Phase 10 — Opportunity, outcome, learning

**Spec:** §LVI Phase 10, §XXIX, §XXX, §XXXI, §XXXII.

| Work | Path | Notes |
|---|---|---|
| `Relationship` | `api/relationships/` *(new)* | explicit privacy and consent |
| `Opportunity` | `api/opportunities/` *(new)* | §XXIX |
| `Journey` | `api/journeys/` *(new)* | §XXX — below Authority Entity |
| `Action` | `api/actions/` *(new)* | gate G4 |
| `Outcome` | `api/outcomes/` *(new)* | §XXXI |
| Attribution | `api/outcomes/attribution/` *(new)* | "occurred" ≠ "PAS caused" (INV-28) |
| Measurement | `api/learning/measurement/` *(new)* | |
| Learning proposals | `api/learning/proposals/` *(new)* | gate G5 — proposes, never rewrites |
| Product linkage | `src/components/ecosystem/MarketplaceView.tsx` | approved material only (§LII) |

**Exit criteria:** `npm run build` passes · attribution carries its own confidence and
evidence · no learning output mutates canonical state without G5.

---

# Phase 11 — Hardening

**Spec:** §LVI Phase 11.

| Work | Path |
|---|---|
| Security review | all |
| Privacy and permissions | `api/platform/auth/` |
| Admin authorization | `src/components/admin/MasterAdminView.tsx` — R0–R5 (§XXXVIII); must not ship ungated |
| Rate limits | `api/platform/limits/` *(new)* |
| Backups and recovery | `migrations/`, ops |
| Performance | all |
| Accessibility | `src/components/` |
| Testing | repository-wide — **none exists today** |
| Observability | `api/platform/telemetry/` *(new)* |
| Deployment | ops |

**Exit criteria:** every production component answers all eight §LV Build Contract questions.

---

# Continuous and decoupled

**Design systemization** (§LIV, SUP-10) — `src/styles/pas-design-tokens.css` and inline
styles across all 20 components. Progressive extraction of repeated literals
(`#0C0D0E`, `#D4AF37`, `#26292E`, `#E5E7EB`) into real tokens.

§LIV: *"Architecture migration and cosmetic refactoring should not be unnecessarily
coupled."* This runs independently, blocks nothing, is blocked by nothing, and must produce
**zero visual change** at each step.

---

# Dependency summary

```
Phase 0  ──► Phase 1 ──► Phase 2 ──┬──► Phase 3 ──┬──► Phase 4 ──► Phase 5 ──► Phase 6
                                   │              │                              │
                                   └── JSON-LD    └── CONF-A closes              ▼
                                       visibility      (5 sites, 1 path)      Phase 7
                                       filter ⚠️                                  │
                                       (lands early)                              ▼
                                                                   Phase 8 ──► Phase 9 ──► Phase 10 ──► Phase 11

Design systemization ═══════════ decoupled throughout ═══════════
```

**Owner decisions on the critical path:**

| Open item | Blocks | Needed by |
|---|---|---|
| 1 — verification requirement registry | `VERIFIED` transitions, `VerificationView` | Phase 3 |
| 2 — Fixture B and Fixture C subjects | generalization proof | Phase 5 completion |
| 3 — source artifact retention/deletion policy | real document ingestion | Phase 4 |
| 4 — WDJIV M01–M08 public visibility during migration | product decision only | Phase 6 |

None blocks Phase 1 or Phase 2. **Implementation can begin immediately on approval and run
through two full phases before the first owner decision is required.**

---

# What this plan does not do

- It does not redesign PAS. Every structure traces to a specification section.
- It does not delete the prototype. §LVII and §LVIII govern throughout.
- It does not restyle the UI. §XLIX, §L and §LIV all forbid it.
- It does not resolve the four open items. Those are owner decisions (§LXI).
- It does not begin production feature implementation. That awaits confirmation that the
  §LXI handoff boundary is met.
