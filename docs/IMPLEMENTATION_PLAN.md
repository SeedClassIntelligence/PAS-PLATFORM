# PAS Implementation Plan

**Controlling sequence:** `docs/PAS_CLEAN_SHEET_BUILD_SPECIFICATION.md` — Builds 00–37,
tickets PAS-0001…PAS-3608
**Controlling architecture:** `docs/PAS_MASTER_SPECIFICATION.md` — invariants, definitions,
boundaries, migration protections
**Controlling posture:** `docs/ARCHITECTURE_DECISIONS.md` ADR-003
**Baseline:** `f23d11a` (tag `baseline-prototype-v0`)

This is the repository-specific execution mapping of Builds 00–37. It introduces no
architecture. Where a ticket's target path does not yet exist, the path given is the one
PAS-0001 establishes.

---

## Authority hierarchy (ADR-003)

1. **Canonical PAS architecture and the 30 invariants** — govern *what PAS is*.
2. **Clean-Sheet Build Specification, Builds 00–37** — govern *how it is constructed and in
   what dependency order*.
3. **Existing PAS baseline** — frontend/product assets to preserve and progressively migrate.
4. **Reconciliation and ADRs** — how baseline structures transition into the architecture.

The former Phases 0–11 are superseded **as sequencing**. Master Specification requirements
remain controlling wherever they establish invariants, definitions, boundaries or migration
protections.

---

## Standing rules

**Clean sheet below, migration above (ADR-003).** Backend and platform are built new — there
is no production backend to migrate. The frontend is preserved and progressively re-pointed.

**Migration rule — frontend.** `Expand → Migrate → Verify → Contract`.
*There must never be a point where a functioning capability is destroyed because its
replacement appears later in the build sequence.*

**Non-regression.** `npm run verify` (typecheck → lint → test → build) passes at every ticket.
Existing screens keep rendering until an approved migration replaces them.

**ADR-002 consumer sweep.** Every build opens with a sweep: where it changes the meaning,
visibility, lifecycle or governance of data an existing component consumes, inspect every
consumer and move the necessary protection into *this* build. Record in the exit criteria.

**ADR-004.** Origin — AI, document, web, connector, manual entry, Gap Interview, admin,
another PAS entity — affects provenance and policy, never whether governance exists.

**§LV Build Contract.** Identity · Input · Output · Lineage · Governance · Observability ·
Continuity · Impact. Unanswerable ⇒ not production-complete.

**Completion contract.** Every ticket closes with the machine-verifiable report (Part II).
Acceptance criteria fail ⇒ **BLOCKED**. Never *COMPLETE WITH TODO*.

---

## Repository topology (established by PAS-0001)

```
pas-platform/
├── apps/
│   ├── web/      ← PRESERVED FRONTEND (moved intact from src/ at PAS-0001)
│   ├── api/      ← scaffold; Build 01+
│   └── worker/   ← scaffold; Build 03+
├── packages/     ← 17 scaffolds, dependency direction declared per PAS-0001
├── migrations/  fixtures/  infrastructure/
├── tests/{integration,contract,e2e,security}
└── docs/{architecture,adr,api,workflows,operations}
```

**`apps/web` SHALL NOT become a dependency of any domain package.** Verified at PAS-0001;
re-verify whenever a workspace dependency is added.

---

# Build 00 — Engineering Foundation

| Ticket | Target | Status |
|---|---|---|
| **PAS-0001** Initialize Production Monorepo | repository root | ✅ **COMPLETE** — see `docs/adr/PAS-0001-REPORT.md` |
| **PAS-0002** Environment Configuration | `packages/config/` | ✅ **COMPLETE** — see `docs/adr/PAS-0002-REPORT.md` |
| **PAS-0003** Shared Error Contract | `packages/contracts/src/errors/` | ✅ **COMPLETE** — see `docs/adr/PAS-0003-REPORT.md` |
| **PAS-0004** Correlation Context | `packages/observability/src/correlation/` | ✅ **COMPLETE** — see `docs/adr/PAS-0004-REPORT.md` |
| **PAS-0005** Health and Readiness | `apps/api/src/health/` | ✅ **COMPLETE** — see `docs/adr/PAS-0005-REPORT.md` |
| **PAS-0006** CI Pipeline | `.github/workflows/` | ✅ **COMPLETE** — see `docs/adr/PAS-0006-REPORT.md` |

**Build 00 is COMPLETE.** `npm run ci` runs the full gate locally; `.github/workflows/ci.yml`
is a thin wrapper around it. `npm run verify` remains the fast inner-loop subset.

Build 01 may begin. PAS-0102 extends `scripts/validate-migrations.mjs` with the runtime half
(empty database → migrate → application starts) and adds a Postgres service to the workflow.

**Done at PAS-0102.** The runtime half is `tests/integration/migrate-and-start.test.ts`,
running the built migrator CLI and the built API against a database created empty for the run.
The Postgres service was added at PAS-0101. `/ready` now validates database connectivity and
schema currency, which is the PAS-0005 criterion *"/ready validates required dependencies such
as database connectivity"* landing where a database finally exists.

---

# Build 01 — Database Foundation

| Ticket | Target |
|---|---|
| **PAS-0101** PostgreSQL Connection Layer ✅ | `packages/database/` — see `docs/adr/PAS-0101-REPORT.md` |
| **PAS-0102** Migration System ✅ | `packages/database/src/migrate/`, `migrations/`, `apps/api/src/health/database-check.ts` — see `docs/adr/PAS-0102-REPORT.md` |
| **PAS-0103** Canonical ID Service ✅ | `packages/domain/src/identity/` — see `docs/adr/PAS-0103-REPORT.md` |
| **PAS-0104** Canonical Timestamps ✅ | `packages/contracts/src/temporal/` — see `docs/adr/PAS-0104-REPORT.md` |

**Retires SUP-11 — done at PAS-0103.** `auth-${Date.now()}`
(`apps/web/src/store/usePASStore.ts:564`, `services/parser/WebHarvester.ts:32`) and the
semantic `M01`/`d01` identifiers are replaced as canonical identity. Under ADR-003 they remain
as *attributes* on migrated compositions; `apps/web` was not changed by that ticket.

PAS-0104 forbids overloading `createdAt` for real-world occurrence — the baseline does exactly
this throughout `usePASStore.ts`. **Confirmed and recorded as SUP-14** at PAS-0104: five
authority objects carry the subject's founding or authoring year in `createdAt`, and three
peer endorsements carry `'1 week ago'`. `apps/web` was not changed (ADR-003); what the ticket
changes is that no new contract may express a timestamp as `string`.

**Build 01 is COMPLETE.**

---

# Build 02 — Accounts, Authentication, Authorization

| Ticket | Target |
|---|---|
| **PAS-0201** Account Schema ✅ | `migrations/0001_create_account_domain.sql` — see `docs/adr/PAS-0201-REPORT.md` |
| **PAS-0202** Authentication ✅ | `migrations/0002_create_authentication.sql`, `packages/auth/src/{password,session}/` — see `docs/adr/PAS-0202-REPORT.md` |
| **PAS-0203** Capability Registry ✅ | `migrations/0003_create_capability_registry.sql`, `packages/auth/src/capabilities/` — see `docs/adr/PAS-0203-REPORT.md` |
| **PAS-0204** Authorization Service ✅ | `packages/auth/src/authorize/` — see `docs/adr/PAS-0204-REPORT.md` |
| **PAS-0205** Authorization Security Tests ✅ | `tests/security/` — see `docs/adr/PAS-0205-REPORT.md` |

**User ≠ AuthorityEntity** (Part I §6). PAS-0205 verifies *frontend behavior is irrelevant to
server authorization* — directly relevant to `MasterAdminView.tsx`, which today exposes a
platform "god view" with no access control whatsoever.

**Build 02's ADR-002 opening sweep ran at PAS-0201.** Every component that decides who someone
is or what they may do was inspected; nothing unrecorded was found, and no consumer needed a
change. See `docs/adr/PAS-0201-REPORT.md`.

**Build 02 is COMPLETE.** `npm run ci` now includes `test:security`.

**Ratified at ADR-006** (owner, 2026-09-22): `@pas/auth → @pas/database`,
`@pas/auth → @pas/domain`, and PAS-0102's `apps/api → @pas/database`. The standing rule is now
that the infrastructure layer — `contracts`, `config`, `observability`, `database`, `domain` —
is dependable by any package without a proposal. Every other edge is still proposed and held.

**ADR-007** resolves Part I §6's `user_capability_overrides` against PAS-0203's
`capability_overrides`: the latter, grained to membership, with the platform itself modelled as
an account. Implemented at PAS-0203.

---

# Build 03 — Audit and Event Infrastructure

| Ticket | Target |
|---|---|
| **PAS-0301** Audit Ledger ✅ | `migrations/0004_create_audit_ledger.sql`, `packages/events/src/audit/` — see `docs/adr/PAS-0301-REPORT.md` |
| **PAS-0302** Domain Event Envelope ✅ | `packages/events/src/envelope/` — see `docs/adr/PAS-0302-REPORT.md` |
| PAS-0303 Event Ledger | `packages/events/src/ledger/` |
| PAS-0304 Transactional Outbox | `packages/events/src/outbox/` |
| PAS-0305 Event Dispatcher | `apps/worker/src/dispatcher/` |

Part I §5 is binding: a canonical mutation and its outbox event occur in **one transaction**.
Never update → commit → publish-later.

**Corrected at PAS-0301.** This table originally targeted the audit ledger at
`packages/observability/`. That would close a dependency cycle: `@pas/database` depends on
observability for correlation-based query instrumentation (PAS-0101), so an audit writer there
gives `observability → database → observability`. Audit lives in `packages/events/src/audit/`
instead — alongside the event ledger and outbox, which is also where it belongs, all three
being append-only ledgers written in the same transaction as the mutation they record.

---

# Build 04 — Authority Entity

| Ticket | Target |
|---|---|
| PAS-0401 Contract | `packages/domain/src/authority/entity/` |
| PAS-0402 Persistence | `migrations/` — `authority_entities`, `person_profiles`, `organization_profiles` |
| PAS-0403 Repository | `packages/domain/src/authority/entity/` |
| PAS-0404 Service | emits `AuthorityEntityCreated` / `Updated` |
| PAS-0405 API | `apps/api/src/routes/v1/authority-entities/` |
| PAS-0406 Tests | `tests/integration/` |

PAS-0406 verifies **deleting or changing a public page does not alter Authority Entity
identity** — INV-2 made executable.

---

# Build 05 — Authority Record  ⚠️ ADR-001 transitional guard lands here

| Ticket | Target |
|---|---|
| PAS-0501 Contract | `packages/domain/src/authority/record/` |
| PAS-0502 Persistence | `authority_records`, `authority_record_versions` |
| PAS-0503 Service | `packages/domain/src/authority/record/` |
| **PAS-0504 Private Record Boundary** | `packages/domain/src/visibility/` |
| **PAS-0505 Privacy Regression Test** | `tests/security/` — **permanent** |

> ### ⚠️ ADR-001 transitional obligation
>
> PAS-0504: *"Implement visibility architecture **before** adding substantive private
> records."* Repository and service query paths enforce access; visibility is not a frontend
> display preference.
>
> **SUP-13 is live at baseline**, not hypothetical: `auth-anthem-loi` (`GATED`, `M04`) renders
> on dossier `d03` (`CORE_PUBLIC`, uses `M04`) because
> `apps/web/src/components/public/PublishedPersonalPAS.tsx:267` has no visibility predicate.
>
> **Four legacy consumers must be guarded before private records exist:**
> `PublishedPersonalPAS.tsx:267` · `services/schema/JSONLDGenerator.ts` ·
> `components/account/SEOSchemaView.tsx:7-40` (inline duplicate — guarding the service alone
> does not cover it) · `services/studio/ExecutiveProductionStudio.ts`.
>
> Build 28 (PAS-2801) later makes this **structurally unreachable**. The guard then becomes
> defense-in-depth and may be retired only once the legacy path is provably dead.
>
> **Expected diff, not a regression:** filtering `GATED` material changes rendered output.
> Record it in the exit criteria.

---

# Builds 06–10 — Source, Observation, Claim, Evidence, Provenance

| Build | Tickets | Target |
|---|---|---|
| 06 Source Corpus | PAS-0601…0607 | `packages/domain/src/source/`, object storage adapter |
| 07 Observation Layer | PAS-0701…0705 | `packages/domain/src/observation/` |
| 08 Claims | PAS-0801…0805 | `packages/domain/src/claim/` |
| 09 Evidence | PAS-0901…0904 | `packages/domain/src/evidence/` |
| 10 Provenance/Verification | PAS-1001…1004 | `packages/domain/src/provenance/` |

**Retires SUP-6 and INV-9's violation.** `AuthorityObject.sources: string[]` and
`evidenceIds: string[]` (`apps/web/src/types/pas.ts:97-98`) collapse four distinct concepts
into string arrays. Four separate records replace them.

PAS-1004 tests the invariants explicitly:
`AI_INFERRED ≠ VERIFIED` · `SOURCE_CONFIRMED ≠ VERIFIED` · `USER_CONFIRMED ≠ VERIFIED` ·
`confidence 0.99 ≠ VERIFIED`.

> ⛔ **Owner decision — verification requirement content.** PAS-1002 supplies the table and
> the variance axes. The requirements *per credential class* remain unspecified. Blocks
> `VerificationView.tsx` from becoming real.

---

# Builds 11–13 — Governance, Human Tasks, Workflow  ⚠️ CONF-A closes here

| Build | Tickets | Target |
|---|---|---|
| 11 Governance | PAS-1101…1104 | `packages/governance/` |
| 12 Human Tasks | PAS-1201…1202 | `packages/workflows/src/tasks/` |
| 13 Workflow Runtime | PAS-1301…1304 | `packages/workflows/` |

> ### ⚠️ CONF-A — five sites, one governed write path
>
> Every path that creates authority in the baseline creates it already public and already
> publish-ready. Patching the five individually reproduces the defect five times and leaves
> nowhere to enforce INV-10.
>
> | # | Site (paths post-PAS-0001) | Origin |
> |---|---|---|
> | 1 | `apps/web/src/services/parser/WebHarvester.ts:37-42` | hostname, no HTTP fetch |
> | 2 | `apps/web/src/services/parser/DocumentParser.ts:40-100` | filename regex |
> | 3 | `apps/web/src/services/ai/AgnosticAIEngine.ts:61-108` | hardcoded literal |
> | 4 | `apps/web/src/store/usePASStore.ts:558-586` | one UI click |
> | 5 | `apps/web/src/components/manage/AuthorityGraphView.tsx:15-39` | manual entry |
>
> Per **ADR-004**, site 5 is governed identically despite its different origin.

PAS-1104: *every* governed state change stores the decision that authorized it.
PAS-1304: a workflow enters `WAITING` for a human task and resumes — no worker blocks
synchronously on a person.

---

# Builds 14–15 — Experience, Professional Work, Authority Graph

| Build | Tickets | Notes |
|---|---|---|
| 14 Experience & Work | PAS-1401…1410 | **Experience becomes first-class** (INV-6) — nothing in the baseline corresponds |
| 15 Authority Graph | PAS-1501…1505 | `GraphEdge` is PRESERVED (§XI); relationship vocabulary becomes a governed registry, not a DB enum |

PAS-1410: *possessing a Credential does not automatically generate Expertise* (INV-7).
PAS-1504: the system must be able to **explain why a relationship exists**.
PAS-1505: no separate graph database yet.

---

# Builds 16–18 — Agent Gateway, Production Ingestion, Reconstruction

| Build | Tickets | Target |
|---|---|---|
| 16 Agent Gateway | PAS-1601…1606 | `packages/agent-gateway/` |
| 17 Production Ingestion | PAS-1701…1708 | `packages/ingestion/` |
| 18 Authority Reconstruction | PAS-1801…1803 | `packages/authority-intelligence/src/gaps/` |

**Build 17 is the first major vertical slice.** It replaces the three mock services:

- `WebHarvester` — *"Never fabricate professional information from the hostname"* (PAS-1702).
- `DocumentParser` — real format parsers; *filename may be weak metadata only* (PAS-1701).
- `AgnosticAIEngine` — interface preserved, implementation rebuilt behind Agent Gateway;
  returns **proposals**, never authority (PAS-1604: invalid model output does not become
  domain data).

PAS-1707: conflicts create `Conflict` records — never silently pick the highest confidence.
PAS-1803: Gap responses become `SourceRecord → Observation → Claim → governance`. They do not
bypass the pipeline.

> ⛔ **Owner decision — source artifact retention/deletion policy.** Required before the first
> real document is stored. PAS-0604 and Part I §11 require the field; the policy is yours.

---

# Builds 19–22 — Knowledge, Know-How, Expertise, Domains, Clusters

| Build | Tickets | Target |
|---|---|---|
| 19 Knowledge | PAS-1901…1903 | `packages/authority-intelligence/src/knowledge/` |
| 20 Know-How | PAS-2001…2003 | `…/knowhow/` |
| 21 Expertise | PAS-2101…2104 | `…/expertise/` |
| 22 Domains & Clusters | PAS-2201…2205 | `…/domains/`, `…/clusters/` |

Each exposes a `/basis` endpoint returning an explanation graph. §XII forbids inference from
job titles, keywords, credentials, self-description or AI similarity alone. PAS-1902: the
agent **cannot approve its own proposal**.

**PAS-2205 requires the deep-academic fixture** — hundreds of records must organize into
coherent Domains/Clusters *without* hundreds of top-level pages. This is where INV-5 is proven
or fails.

---

# Builds 23–26 — Composition, Surfaces, Representation, Personal PAS / BPAS

| Build | Tickets | Target |
|---|---|---|
| 23 Composition | PAS-2301…2304 | `packages/composition/` |
| 24 Surfaces & Dossiers | PAS-2401…2404 | `packages/composition/src/surfaces/` |
| 25 Representation | PAS-2501…2503 | `packages/publishing/src/representations/` |
| 26 Personal PAS & BPAS | PAS-2601…2604 | `apps/web/`, `packages/publishing/` |

> ### The §LVII worked example, executed literally (ADR-003)
>
> 1. **Expand** — add `CompositionDefinition`. `associatedDossierIds` still present, still working.
> 2. **Migrate** — move the 10 WDJIV dossier memberships into composition rules.
> 3. **Verify** — rendered Personal PAS unchanged. `PublishedPersonalPAS.tsx:267` already
>    resolves membership as a *query*, which is the target shape and the natural seam.
> 4. **Contract** — only now deprecate `associatedDossierIds`.
>
> Identically for M01–M08. Under ADR-003 they may remain **operational** throughout; what is
> retired is their claim to define the data architecture.

PAS-2404: **a Composition cannot make private authority public.**
PAS-2502: representation versions freeze on publication approval.
PAS-2503: reverse lineage — Representation → Authority object → Claim → Evidence → Source.
PAS-2602: the renderer consumes Published Representations, not unrestricted Authority Record
data. PAS-2604: BPAS **links**, never duplicates, a person's canonical authority.

---

# Builds 27–28 — Publication and Machine Representation  ✅ ADR-001 final form

| Build | Tickets | Target |
|---|---|---|
| 27 Publication | PAS-2701…2705 | `packages/publishing/` |
| 28 Machine Representation | PAS-2801…2804 | `packages/publishing/src/machine/` |

> ### ADR-001 reaches structural form here
>
> **PAS-2801: JSON-LD generates exclusively from `PublishedRepresentation`.** The legacy
> generator loses access to unrestricted Authority Record material altogether. Exposure
> becomes unreachable rather than filtered.
>
> **PAS-2804** asserts private Experience, private Evidence and internal graph relationships
> appear in **none** of: HTML · public API · JSON-LD · sitemap · public search index.

**Retires SUP-7.** `PublicationSnapshot` stores counts (`objectCount`, `dossierCount`);
PAS-2704 requires representation version, supporting authority versions, configuration,
canonical URL, publisher, authorization and timestamp. **Retires SUP-9** — one adapter, no
inline duplicate. PAS-2803: changing a slug must not change Authority identity.

---

# Builds 29–34 — Discovery, Fellowship, Relationships, Journeys, Impact, Search

| Build | Tickets | Target |
|---|---|---|
| 29 Demand & Discovery | PAS-2901…2905 | `packages/discovery/` |
| 30 Fellowship | PAS-3001…3004 | `packages/fellowship/` |
| 31 Relationships & Opportunities | PAS-3101…3104 | `packages/domain/src/relationships/` |
| 32 Journeys, Outcomes, Learning | PAS-3201…3205 | `packages/domain/src/journeys/` |
| 33 Dependency & Impact | PAS-3301…3303 | `packages/domain/src/impact/` |
| 34 Search & Retrieval | PAS-3401…3403 | `packages/database/src/search/` |

**PAS-2905** — demand exists, authority does not ⇒ `NO_SUPPORTED_AUTHORITY`. No synthetic
expertise (INV-16).
**PAS-3002** — **retires SUP-5.** `FellowshipView.tsx:149`'s literal `94% PAS Alignment` is
replaced by alignment records storing their basis. Part I §51: *"No unsupported 94% alignment
mechanism."*
**PAS-3203** — never convert correlation automatically into causation.
**PAS-3303** — the full retraction path; *no silent public inconsistency.*
**PAS-3403** — delete derived indexes in test and rebuild from canonical state (INV-22).

---

# Builds 35–37 — Workspaces, Hardening, Certification

## Build 35 — Complete User Workspaces (PAS-3501…3508)

> **ADR-003 reinterpretation.** This does **not** mean rewrite all eight workspaces from
> scratch. It means complete the operational workspaces against production PAS services.
> Existing components **SHALL** be reused, refactored or re-pointed where suitable. New
> components **SHALL** be created only where the architecture introduces capabilities the
> prototype lacks. §60's IA is the target operating organization, not an instruction to
> discard routes immediately.

| §60 workspace | Existing assets to re-point |
|---|---|
| Authority Workspace | `AuthorityGraphView`, `ConnectionsManager`, `PASBuilderWorkspace` |
| Representation Studio | `DossierManager`, `PASDesignStudio`, `LivePASPreview` |
| Publishing Center | `PublishingCenter` |
| Discovery Center | `SEOSchemaView` (expanded) |
| Fellowship | `FellowshipView` |
| Relationships & Opportunities | *new* — no prototype equivalent |
| BPAS Workspace | `PublishedBusinessPAS` |
| Administration | `MasterAdminView`, `VerificationView` |

## Build 36 — Platform Hardening (PAS-3601…3608)

Tenant isolation · upload security · API security · agent security · backup **and tested
restore** · observability · accessibility · performance budgets.
*"A backup is not accepted until restoration has been tested."*
*"Do not optimize by eliminating lineage/governance."*

## Build 37 — Final Platform Certification

Twelve scenarios. PAS is not complete until all pass: undocumented practitioner · deep
academic · multidimensional operator · organization · contradictory evidence · privacy ·
discovery · unsupported demand · find your tribe · opportunity · retraction · provider
independence.

---

# Reference fixtures — all four, adopted immediately (ADR-003)

| Fixture | Subject | State |
|---|---|---|
| **P1** Multidimensional Operator | WDJIV | exists as seed data in `usePASStore.ts`; relocates to `fixtures/` |
| **P2** Deep Academic / Research | — | ⛔ **subject needed** |
| **P3** Skilled Practitioner | — | ⛔ **subject needed** |
| **O1** Organization / BPAS | SCIA · WCS · A Solution Group CDC · KG Development | ✅ **source material available in `EXAMPLES/`** — extraction pending Build 22 |

*No fixture defines universal PAS structure.* P2/P3/O1 are a correctness requirement for
generalization, not a testing nicety — they are what prevent one person's shape from becoming
the schema (INV-5).

**O1 correction.** An earlier revision of this plan listed O1 as "subject needed". That was
wrong: `EXAMPLES/` has carried the material since `f23d11a` and was classified without being
read. It contains six organizational PAS renders — SCIA (Governing Intelligence Architecture),
Whole Community Solutions, WCS × KG Development × A Solution Group CDC, the Anthem Blue Cross
Nevada partnership, the Wells Fargo submission, and a team/build-status dashboard — covering
team, capabilities, programs, agreements, partnerships and outcomes, which is Part I §62's O1
requirement almost verbatim.

**P2 and P3 remain genuinely blocked.** There is no academic or independent-practitioner
subject anywhere in the repository. Only O1 moves.

---

# Outstanding owner decisions

| Item | Blocks |
|---|---|
| Verification requirement content per credential class | Build 10 (PAS-1002), `VerificationView` |
| Source artifact retention/deletion policy | Build 06 (PAS-0604), Build 17 |
| Fixture **P2** and **P3** subjects (O1 is sourced from `EXAMPLES/`) | Build 22 (PAS-2205), Build 37 |

**None blocks Builds 00–05.** Implementation can proceed through six builds before the first
decision is required.
