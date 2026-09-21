# PAS Architecture Decision Records

**Derived from:** `docs/PAS_MASTER_SPECIFICATION.md` v1.0
**Baseline:** `f23d11a` (tag `baseline-prototype-v0`)
**Status:** Phase 0 — controlling

This document records (A) the thirty canonical invariants, each bound to the concrete code
it governs, and (B) the major prototype assumptions the specification supersedes, each with
the exact file and line where that assumption is currently encoded.

An invariant is not satisfied because it is written down. Each one below carries an
**enforcement point** — the place in the production system where a violation must become
impossible, not merely discouraged.

---

# Part A — The thirty canonical invariants

Spec reference: §LX.

### INV-1 — PAS represents authority; it does not manufacture it.
**Governs:** all ingestion and all AI paths.
**Enforcement:** Governance gate G2 (§XXXVII). No service may write to the Authority Record
except through a gate decision.
**Currently violated by:** `src/services/parser/WebHarvester.ts:29-45`,
`src/services/parser/DocumentParser.ts:40-100`, `src/services/ai/AgnosticAIEngine.ts:61-108`,
`src/store/usePASStore.ts:558-586`.

### INV-2 — Authority Entity is persistent; representations are contextual.
**Governs:** identity model.
**Enforcement:** `AuthorityEntity` row is never deleted by a representation operation;
representation tables carry FK to entity, never the reverse.
**Currently:** no `AuthorityEntity` exists. Identity is four loose string fields at
`src/store/usePASStore.ts:130-134`.

### INV-3 — Authority Record is canonical; Published PAS is a projection.
**Governs:** publishing.
**Enforcement:** the publication path reads from the Authority Record and writes only to
snapshot/representation tables. A publish may never mutate an authority record.
**Currently:** `publishPAS` (`usePASStore.ts:592-607`) counts in-memory arrays; there is no
record to project from.

### INV-4 — No universal module, dossier or page count exists.
**Governs:** composition.
**Enforcement:** no type, column, enum or constant may enumerate a fixed module or dossier
set for generalized runtime use.
**Currently violated by:** `src/types/pas.ts:111-119` (`CanonicalModuleCode` = M01–M08),
10 seeded dossiers `d01`–`d10` in `usePASStore.ts`.

### INV-5 — WDJIV's PAS is a reference instance, not the human schema.
**Governs:** fixtures.
**Enforcement:** Fixtures B and C (§LIX) must pass every generalized code path before that
path is considered complete. A path that only works for Fixture A is incomplete.
**Currently:** Fixture A is hardcoded into the store as production truth; B and C do not exist.

### INV-6 — Experience is first-class.
**Governs:** ontology.
**Enforcement:** `Experience` is its own record with its own lifecycle, not an
`AuthorityObjectType` enum value.
**Currently:** no Experience concept exists in any form.

### INV-7 — Credentials are evidence of certain authority, not authority's universal definition.
**Governs:** ontology and matching.
**Enforcement:** `Credential` may support Expertise; it may never be the sole basis for
establishing it (see INV-8 enforcement).
**Currently:** `CREDENTIAL` is one of 14 flat `AuthorityObjectType` values
(`src/types/pas.ts:58`), carrying no distinct semantics.

### INV-8 — Knowledge, Know-How and Expertise are distinct.
**Governs:** ontology.
**Enforcement:** three separate records with separate derivation rules. §XII forbids
inferring any of them from job titles, keywords, credentials, self-description or AI
similarity alone.
**Currently:** none of the three exists.

### INV-9 — Source, Observation, Claim and Evidence are distinct.
**Governs:** the hard boundary of §VII.
**Enforcement:** four separate tables. No foreign key may allow a Source to be used where a
Claim is required, or an Observation where Evidence is required.
**Currently violated by:** `AuthorityObject.sources: string[]` and
`AuthorityObject.evidenceIds: string[]` (`src/types/pas.ts:97-98`) collapse Source,
Evidence and Claim into one object's string arrays.

### INV-10 — Extraction cannot directly establish public authority.
**Governs:** §VIII, the single most-violated invariant in the current code.
**Enforcement:** extraction services may write only to `SourceRecord`, `Observation` and
`ProposedClaim`. They must have **no write capability** to any published or approved state —
enforced by service boundary and database permission, not by convention.
**Currently violated by:** all four cited call sites (see SUP-1 below).

### INV-11 — AI confidence is not verification.
**Governs:** provenance.
**Enforcement:** a numeric `confidenceScore` may never be an input to a `VERIFIED`
transition. Verification requires a satisfied verification requirement (§IX).
**Currently violated by:** `WebHarvester.ts:38-39` writes `confidenceScore: 94` alongside
`provenance: 'SOURCE_CONFIRMED'` with no verification step of any kind.

### INV-12 — Source confirmation is not independent verification.
**Governs:** provenance.
**Enforcement:** `SOURCE_CONFIRMED` requires that PAS actually retrieved and confirmed the
source contains the assertion. It is a strictly weaker state than `VERIFIED`.
**Currently violated by:** `WebHarvester` sets `SOURCE_CONFIRMED` **without ever retrieving
the URL** (`WebHarvester.ts:24-27` parses the hostname only).

### INV-13 — Authority objects do not canonically belong to dossiers.
**Governs:** composition ownership direction.
**Enforcement:** membership lives on the composition side. Any materialized membership index
is a derived projection, rebuildable from composition rules, and never the source of truth.
**Currently violated by:** `AuthorityObject.associatedDossierIds` (`src/types/pas.ts:103`).

### INV-14 — Dossiers and Authority Surfaces derive from the Authority Record.
**Governs:** composition.
**Enforcement:** deleting any composition must leave the Authority Record byte-identical.
This is a testable property and must have a test.
**Currently:** deleting a dossier would orphan back-pointers on every object referencing it.

### INV-15 — Demand cannot manufacture authority.
**Governs:** §XXIV matching.
**Enforcement:** the demand-matching path is read-only against the Authority Record.
**Currently:** no demand concept exists.

### INV-16 — PAS must support "no supported authority."
**Governs:** matching and composition.
**Enforcement:** the matching function's return type must include a negative result as a
first-class value, not an empty list or a zero score.
**Currently violated in spirit by:** `FellowshipView.tsx:149`, a hardcoded
`94% PAS Alignment` string that cannot express absence.

### INV-17 — Search/AI systems are discovery channels, not PAS truth authorities.
**Governs:** Discovery Intelligence.
**Enforcement:** observations from search/AI systems write to `DiscoveryObservation` only.
They may never write to the Authority Record.
**Currently:** no discovery observation concept exists.

### INV-18 — Personal PAS and BPAS share infrastructure without becoming identical products.
**Governs:** §IV.
**Enforcement:** shared substrate (entity, record, graph, governance); distinct composition
and surface behavior. Do not unify the two component trees.
**Currently:** correctly separated at `PublishedPersonalPAS.tsx` / `PublishedBusinessPAS.tsx`.
**This invariant is currently satisfied.**

### INV-19 — Fellowship is authority-based recognition, not conventional social networking.
**Governs:** §XXVII.
**Enforcement:** every alignment assertion must resolve to specific governed graph
intersections.
**Currently violated by:** `FellowshipView.tsx:149`.

### INV-20 — Alignment must be explainable.
**Governs:** §XXVII.
**Enforcement:** the alignment record stores the *reasons* — which domains, which shared
work, which verified relationships. A percentage without reasons is not a valid alignment
record and must not be representable in the type.
**Currently violated by:** `FellowshipView.tsx:149`.

### INV-21 — Learning proposes canonical changes; it does not silently make them.
**Governs:** §XXXII.
**Enforcement:** gate G5. The learning loop's write target is a proposal queue, never
canonical state.
**Currently:** no learning loop exists.

### INV-22 — Vector/graph/search indexes are derived projections.
**Governs:** §XXXIV.
**Enforcement:** every index must be fully rebuildable from PostgreSQL. Loss of an index is
a performance event, never a data-loss event.
**Currently:** no indexes exist.

### INV-23 — External platforms are adapters, not architecture dependencies.
**Governs:** connectors.
**Enforcement:** no domain type may name a specific vendor.
**Currently violated by:** `ConnectorPlatform` (`src/types/pas.ts:190-202`) hardcodes twelve
vendor identities into the domain type layer.

### INV-24 — Every material public claim retains lineage.
**Governs:** §XXI, §XXXIX.
**Enforcement:** a `PublicationSnapshot` must record which claim and evidence *versions*
supported each published representation.
**Currently violated by:** `PublicationSnapshot` (`src/types/pas.ts:268-276`) stores only
counts — `objectCount`, `dossierCount`. A published PAS cannot be reproduced from it.

### INV-25 — Every governed change supports downstream impact analysis.
**Governs:** §XXXIX.
**Enforcement:** Dependency/Impact Service. Invalidating one evidence record must resolve to
the exact set of affected claims, clusters, surfaces and published representations.
**Currently:** `Dossier.affectedByUpdates?: boolean` (`src/types/pas.ts:164`) is a single
optional flag with no computation behind it.

### INV-26 — Scores assist analysis; governance gates authorize state changes.
**Governs:** all state transitions.
**Enforcement:** no state transition may take a score as its authorizing input.
**Currently violated by:** `confidenceScore` values (90, 94, 99) sitting directly alongside
`PUBLISH_READY` with no gate between them.

### INV-27 — Knowledge authority and action authority remain separate.
**Governs:** §XXXVIII capability risk.
**Enforcement:** gates G2 and G4 are distinct and separately authorized.
**Currently:** no action capability exists. Enforce before adding one.

### INV-28 — Outcomes and attribution remain separate.
**Governs:** §XXXI.
**Enforcement:** "Outcome occurred" and "PAS caused outcome" are separate fields; attribution
carries its own confidence and evidence.
**Currently:** `OUTCOME` is an enum value only (`src/types/pas.ts:65`).

### INV-29 — PAS evolves longitudinally over a professional lifetime.
**Governs:** versioning and lifecycle.
**Enforcement:** records version rather than overwrite. `SUPERSEDED` is a real state (§X);
history is queryable.
**Currently:** `updatedAt` overwrites in place; no version field on any object.

### INV-30 — Authority Intelligence is part of PAS, never a competing product.
**Governs:** repository and deployment structure.
**Enforcement:** the eleven engines (§XXIII) live inside the PAS modular monolith (§XLIII).
No separate application, no separate repository.

---

# Part B — Superseded prototype assumptions

Each entry records an assumption currently encoded in the baseline, the specification
section that supersedes it, and the migration constraint under §LVII
(Expand → Migrate → Verify → Contract).

---

### SUP-1 — "Extraction produces publish-ready public authority"

**Superseded by:** §VIII, INV-10, INV-11, INV-12.

**Encoded at four sites:**

| Site | Evidence |
|---|---|
| `src/services/parser/WebHarvester.ts:37-42` | `confidenceScore: 94`, `provenance: 'SOURCE_CONFIRMED'`, `workflowState: 'PUBLISH_READY'`, `visibility: 'PUBLIC'` — from a hostname string, with no HTTP retrieval anywhere in the file |
| `src/services/parser/DocumentParser.ts:40-100` | filename regex (`/license\|cert\|…/i`) promoted directly to typed authority objects |
| `src/services/ai/AgnosticAIEngine.ts:61-108` | `mockObjects` array literal returned as extraction result |
| `src/store/usePASStore.ts:558-586` | `acceptEnrichment` writes `SOURCE_CONFIRMED` + `PUBLISH_READY` + `PUBLIC` + `associatedDossierIds: ['d01']` in a single unreviewed step |

**Replacement:** `SourceRecord → Observation → ProposedClaim`, then gates G0/G1/G2, then G3
for publication.

**Migration constraint:** the enrichment UI at `OverviewDashboard.tsx` must keep working
throughout. Expand by adding the proposal path and routing accept-actions into it; contract
the direct-write path only after the review queue renders.

**Phase:** 2 (records) → 3 (gates) → 4 (real ingestion).

---

### SUP-2 — "M01–M08 is the universal module ontology"

**Superseded by:** §XIII, §XV, §XLVII, INV-4.

**Encoded at:** `src/types/pas.ts:111-119` (`CanonicalModuleCode` union),
`src/store/usePASStore.ts:248-255` (eight seeded modules), and — more damagingly — in every
extraction service, which assigns module codes at object birth:
`WebHarvester.ts:40`, `DocumentParser.ts:53,73,93`, `AgnosticAIEngine.ts:73`.

**Replacement:** `AuthorityDomain` and `AuthorityCluster`, discovered from the record.
M01–M08 survive as a migrated WDJIV reference composition.

**Migration constraint:** §XV — *no Authority Object should be born requiring an M01–M08
assignment*. The extraction-side assignment is the part that must go first; the WDJIV
composition may keep rendering its eight modules indefinitely.

**Phase:** 5 (domain/cluster discovery) → 6 (composition removes the generalized assumption).

---

### SUP-3 — "Authority objects carry dossier membership"

**Superseded by:** §XVI, §XLVIII, INV-13, INV-14.

**Encoded at:** `src/types/pas.ts:103` (`associatedDossierIds: string[]`), written at
`usePASStore.ts:575`, `DocumentParser.ts:54,74,94`, `WebHarvester.ts:41`,
`AgnosticAIEngine.ts:74`.

**Partially correct already:** `PublishedPersonalPAS.tsx:267` already resolves membership as
a *query* (`filter` by dossier id **or** module code) rather than by traversing a stored
list. That rendering pattern is the target shape and is preserved.

**Replacement:** `CompositionDefinition` owning selection rules pointing at Authority Record
objects.

**Migration constraint:** §LVII states this case explicitly — add `CompositionDefinition`,
migrate memberships, verify the rendered Personal PAS is unchanged, **only then** deprecate
`associatedDossierIds`.

**Phase:** 6.

---

### SUP-4 — "The Zustand store is the database"

**Superseded by:** §XLIV, §XXXIV, INV-2, INV-3, INV-29.

**Encoded at:** `src/store/usePASStore.ts` (608 lines) simultaneously holding seed data,
application state, business logic, demo identity, publishing, graph, BPAS, Fellowship,
marketplace and admin metrics.

**Evidence of the gap:** zero occurrences of `fetch(`, `axios`, `supabase`, `localStorage`,
`process.env` or `import.meta.env` anywhere under `src/`. Nothing persists across reload.

**Replacement:** PostgreSQL canonical truth; Zustand demoted to client/UI state and cached
server state; seed data relocated to explicit fixtures.

**Migration constraint:** §LVIII — seed/demo mode remains available until the corresponding
production service exists. The store is not deleted; it is drained.

**Phase:** 1 (foundation) → 2 (ontology, fixtures relocated) → 7 (published reads move server-side).

---

### SUP-5 — "A percentage is a relationship assessment"

**Superseded by:** §XXVII, §LI, INV-19, INV-20, INV-16.

**Encoded at:** `src/components/ecosystem/FellowshipView.tsx:149` — the string literal
`94% PAS Alignment`. There is no matching computation in the repository to refactor.

**Replacement:** explainable `AuthorityAlignment` records derived from governed graph
intersections, capable of expressing *no supported authority*.

**Migration constraint:** the Fellowship visual experience is PRESERVE. Only the number's
source changes.

**Phase:** 9.

---

### SUP-6 — "`AuthorityObject` can hold everything"

**Superseded by:** §XLVI, INV-6, INV-8, INV-9.

**Encoded at:** `src/types/pas.ts:56-66` — `EVIDENCE`, `OUTCOME`, `CREDENTIAL`,
`AGREEMENT`, `PARTNERSHIP`, `METHODOLOGY`, `FRAMEWORK` are enum *tags* on one generic
object, not records with independent lifecycle or governance.

**Replacement:** first-class records for anything requiring its own lifecycle. `AuthorityObject`
is **preserved** as a graph-addressable generalized node — §XLVI is explicit that it is not
deleted.

**Migration constraint:** preserve the concept, refactor the responsibility. Do not delete
the type.

**Phase:** 2.

---

### SUP-7 — "Publication is an event counter"

**Superseded by:** §XXI, INV-24, INV-25.

**Encoded at:** `src/types/pas.ts:268-276` (`PublicationSnapshot` stores `objectCount` and
`dossierCount`) and `usePASStore.ts:592-607` (`publishPAS` increments a version and counts
arrays).

**Consequence:** a published PAS cannot be reproduced, audited, or impact-analyzed. If an
evidence record is later invalidated, nothing identifies which published surfaces contained it.

**Replacement:** snapshots recording representation versions, supporting claim/evidence
versions, visibility, canonical URLs, structured-data versions, authorization and timestamp.

**Phase:** 3 (impact service) → 7 (publishing).

---

### SUP-8 — "Vendors are domain concepts"

**Superseded by:** INV-23, §XXXIV (source adapters).

**Encoded at:** `src/types/pas.ts:190-202` — `ConnectorPlatform` enumerates LinkedIn, Google
Drive, Gmail, Instagram, Twitter/X, Facebook, Dropbox, OneDrive and others directly in the
domain type layer.

**Replacement:** an adapter registry. Adding or removing a vendor must not alter a domain type.

**Phase:** 4.

---

### SUP-9 — "Two JSON-LD generators are fine"

**Superseded by:** §XXII, §LIII.

**Encoded at:** `src/services/schema/JSONLDGenerator.ts` (the service) and
`src/components/account/SEOSchemaView.tsx:7-40`, which re-implements `@graph` construction
inline rather than calling the service. The two can drift, and the displayed schema is not
guaranteed to be the published schema.

**Replacement:** one publication adapter. The view renders what the adapter produces.

**Phase:** 7.

---

### SUP-10 — "A token file means a design system exists"

**Superseded by:** §LIV.

**Encoded at:** `src/styles/pas-design-tokens.css` — 24 lines, minimally referenced, while
every component carries inline `style={{…}}` objects with literal hex values
(`#0C0D0E`, `#D4AF37`, `#26292E`, `#E5E7EB`) repeated across all 20 components.

**Replacement:** progressive extraction into real tokens and components.

**Migration constraint:** §LIV — architecture migration and cosmetic refactoring must not be
coupled. This proceeds independently and does not block any phase.

**Phase:** continuous, low priority, explicitly decoupled.

---

### SUP-11 — "Semantic IDs are acceptable"

**Superseded by:** §XLI, INV-2.

**Encoded at:** `d01`–`d10`, `M01`–`M08`, `auth-asg-cdc`, and `auth-${Date.now()}`
(`usePASStore.ts:564`, `WebHarvester.ts:32`) — presentation and ordering assumptions encoded
into identity, plus a timestamp-based generator that collides under concurrency and carries
no entity scope.

**Replacement:** a canonical ID service producing durable non-semantic identifiers.
Representation IDs and authority IDs remain separate.

**Phase:** 1.

**Status: replacement delivered at PAS-0103** — `packages/domain/src/identity/`, see
`docs/adr/PAS-0103-REPORT.md`. `generateId()` takes no arguments, so there is no channel
through which an entity type, module, dossier, page or owner name could reach the value;
UUIDv4 rather than v7/ULID, so no sequence meaning either. `Id<Scope>` keeps representation
and authority identifiers separate in the type system without putting the distinction in the
string.

The baseline strings are **not** deleted. Under ADR-003 the frontend is progressively
re-pointed, not rewritten, and `M01`–`M08`, `d01`–`d10` and `auth-*` survive as *attributes*
on migrated compositions. What SUP-11's retirement removes is their claim to **define**
identity — no new record takes its identity from them.

---

### SUP-12 — "User entry is self-authorizing"

**Superseded by:** §IX, §X, §XXXVII (gate G3), INV-26.

**Encoded at:** `src/components/manage/AuthorityGraphView.tsx:15-39`. `handleCreateObject`
writes `confidenceScore: 100`, `provenance: 'USER_CONFIRMED'`, `workflowState: 'PUBLISH_READY'`,
`visibility: 'PUBLIC'`, plus hardcoded `associatedModuleCodes: ['M03']` and
`associatedDossierIds: ['d01']`. Typing a sentence into a modal produces public authority.

**Why this is separate from SUP-1.** §VIII governs *extraction*. This path is user-origin, so
§VIII does not reach it — and it would survive a fix that only addressed the four extraction
sites the specification names. It is governed instead by §IX and §X: `USER_CONFIRMED` is a
provenance state, and *"none of these states automatically determines publication
eligibility."* Publication is a separate governed decision (gate G3). A `confidenceScore` of
100 is not an authorization (INV-26).

**Replacement:** user entry produces a `Claim` at `DRAFT`. Publication requires G3.

**Migration constraint:** object creation from the graph view must keep working. It lands in
review rather than in public.

**Phase:** 2 (Claim) → 3 (gate G3).

**Sequencing note:** SUP-1 and SUP-12 together mean five write paths across services, store
and UI. They must be routed through a single governed write path rather than patched
individually — otherwise there is no chokepoint at which INV-10 can be enforced.

---

# Part C — Architecture Decision Records

Decisions taken by the architect during reconciliation. These are **settled**, not
provisional, and are binding on implementation in the same way as Part A.

---

## ADR-001 — Publication-boundary visibility enforcement

**Status:** ✅ **CONFIRMED**, and **superseded in its final form by structural isolation**
(architect, on receipt of the Clean-Sheet Build Specification).

> ### ADR-001 is now: transitional protection → structural replacement
>
> The security principle is unchanged and permanent. The *mechanism* changes in two stages.
>
> **Final architecture** (PAS-2801, PAS-2703, Part I §41):
> ```
> Private/Canonical Authority Record
>   → Governance → Composition → Representation → Publication Approval
>   → PublishedRepresentation
>   → Public PAS / JSON-LD / Sitemap / Public API / public indexing
> ```
> `JSONLDGenerator` eventually loses access to unrestricted Authority Record material
> **altogether**. Exposure becomes structurally unreachable rather than filtered.
>
> **Transitional obligation, still binding.** The legacy generator remains dangerous the
> moment private records exist. Its visibility guard must therefore still be installed
> **before private records can flow through the legacy path** — the original ADR-001
> requirement, now placed at Build 05 (PAS-0504) rather than a later phase.
>
> Once JSON-LD generates exclusively from `PublishedRepresentation`, the transitional guard
> becomes defense-in-depth, and may be retired **only** once the legacy path is provably
> unreachable.
**Governs:** §XXII, §IX, §X. Enforces INV-3, INV-24.
**Supersedes:** the Phase 7 placement of visibility enforcement implied by §LVI.

### Decision

> Any existing representation generator capable of consuming Authority Record material
> **MUST** enforce visibility / publication eligibility no later than the phase in which
> non-public records enter the canonical data model.

For the current implementation, the `JSONLDGenerator` visibility guard therefore moves to
**Phase 2**.

### Governing dependency

The correct ordering is:

```
Visibility enforcement → Private records → Machine representation
```

**not**

```
Private records → wait until Phase 7 → visibility enforcement
```

*Private Authority Record material must become impossible to expose before private Authority
Record material can exist.*

### Alternatives rejected

- **Defer private records to Phase 7.** Rejected: would distort the core Authority Record
  implementation to accommodate a downstream consumer's schedule.
- **Accept an exposure window.** Rejected: violates a canonical PAS invariant, rather than
  merely leaving functionality incomplete. An incomplete feature is acceptable during
  migration; a violated invariant is not.

### Scope boundary

Phase 7 retains the broader machine-representation work: richer Schema.org modeling,
representation versioning, canonical URLs, publication-derived generation, sitemaps,
structured APIs, provenance representation where appropriate, and related Discovery
infrastructure. **Only the guard moves.**

---

## ADR-002 — Protective boundaries move forward with upstream change

**Status:** ✅ **CONFIRMED** (architect, during Phase 0 reconciliation)
**Generalizes:** ADR-001.

### Decision

> A later-phase consumer cannot remain unsafe when an earlier phase changes the sensitivity
> or semantics of its inputs. The necessary protective boundary moves forward with the
> upstream change.

### Standing implementation obligation

Whenever a phase changes the **meaning, visibility, lifecycle or governance** of data that
an existing component consumes, implementation must inspect every existing consumer of that
data and move the necessary protection into that same phase.

This is **dependency ordering, not phase drift.** The phase tables in
`IMPLEMENTATION_PLAN.md` express intended sequence; they do not license shipping a known
unsafe consumer because its nominal phase has not arrived.

### Application

Each phase begins with a consumer sweep against this rule. Results are recorded in the
phase's exit criteria. The first such sweep was performed during Phase 0 and is recorded
as **SUP-13** below.

---

### SUP-13 — "Visibility is stored but never enforced"

**Superseded by:** ADR-001, ADR-002, §XXII, INV-3.

**Discovered by:** applying ADR-002's consumer sweep during Phase 0.

**Finding.** Visibility is **written in eleven places and read in zero.** Every occurrence of
`visibility` outside `src/types/pas.ts` is either a write or a display label. No consumer
anywhere in the codebase filters on it.

**This is not a future Phase 2 risk. It is a live defect at `f23d11a`:**

- `usePASStore.ts:207-220` — `auth-anthem-loi`, the "Anthem Nevada $1M Clinical Partnership"
  (a signed LOI), carries `visibility: 'GATED'` and `associatedModuleCodes: ['M04','M08']`.
- `usePASStore.ts:262` — dossier `d03` "Operator Resume" carries `accessTier: 'CORE_PUBLIC'`,
  `visibility: 'PUBLIC'`, `modulesUsed: ['M02','M03','M04']`.
- `PublishedPersonalPAS.tsx:267` resolves membership by dossier id **or module code**, with
  **no visibility predicate**.

Therefore the GATED $1M agreement renders on a CORE_PUBLIC dossier on the published public
PAS. `DocumentParser.ts:72` also emits `GATED` objects, so the extraction path reproduces
the condition.

**Four unguarded consumers**, not one:

| Consumer | Exposure |
|---|---|
| `components/public/PublishedPersonalPAS.tsx:267` | the public page itself — most severe |
| `services/schema/JSONLDGenerator.ts` | emits all objects to structured data |
| `components/account/SEOSchemaView.tsx:7-40` | **inline duplicate** — guarding the generator alone does not fix this one (SUP-9) |
| `services/studio/ExecutiveProductionStudio.ts` | generates decks/media from authority objects |

**Severity in context.** The baseline is a local prototype with seed data and no deployment,
so this is not a live production leak. It is recorded at this severity because it
demonstrates that the exposure path is already fully constructed — Phase 2 does not create
the risk, it populates it.

**Replacement:** a single visibility/eligibility predicate applied at every representation
boundary, in Phase 2.

**Migration constraint:** filtering `GATED` material out of the WDJIV published surface
**changes rendered output** — which is a deliberate, correct change, and the one sanctioned
exception to the §LVIII "renders identically" rule. It must be recorded in the Phase 2 exit
criteria as an expected diff rather than a regression.

**Phase:** 2.

---

### SUP-14 — "`createdAt` can hold whatever date matters"

**Superseded by:** PAS-0104, §XL.

**Discovered by:** applying ADR-002's consumer sweep while executing PAS-0104.

**Finding.** The baseline has no distinction between when a record was written and when the
thing it describes happened, and uses `createdAt` for both. Two separate failures:

**1. Real-world occurrence stored in `createdAt`** — exactly what PAS-0104 forbids.

| Site | Value | What it actually means |
|---|---|---|
| `usePASStore.ts:152` | `createdAt: '2015-01-01'` | the year A Solution Group CDC was **founded** |
| `usePASStore.ts:169` | `createdAt: '2020-06-01'` | when the WCS Framework was **authored** |
| `usePASStore.ts:186`, `:203`, `:220` | `'2021-08-10'`, `'2023-04-01'`, `'2026-03-08'` | same pattern |

The store is in-memory and constructed at page load, so none of these records was created on
the date it claims. The field is carrying `occurredAt`.

**2. A rendering stored in a timestamp field.** `PeerEndorsement.createdAt` holds
`'1 week ago'` (`usePASStore.ts:417`), `'5 days ago'` (`:431`), `'2 days ago'` (`:445`).
Not UTC, not ISO-8601, not a timestamp — a display string that has to be re-rendered to be
read and cannot be compared, sorted or stored.

**Also absent.** `observedAt`, `validFrom`, `validTo` do not exist anywhere in the baseline.
There is therefore no way to express "PAS learned this on date X about an event on date Y",
which is the question provenance exists to answer, or to express a credential that expired.

**Correctly implemented at baseline, for contrast:** `usePASStore.ts:514`, `:578` and `:595`
write `new Date().toISOString()` into `updatedAt`, `createdAt` (on the create path) and
`publishedAt`. The defect is not that the baseline cannot do this — it is that nothing
distinguished the two meanings, so both ended up in one field.

**Severity in context.** Seed data in a local prototype, so nothing is live. Recorded because
the *type* permits it: `AuthorityObject.createdAt` is `string` (`types/pas.ts:106`), and a
string field will keep accepting whatever the next writer has to hand.

**Replacement:** PAS-0104's branded instant kinds — `CreatedAt`, `UpdatedAt`, `OccurredAt`,
`ObservedAt`, `ValidFrom`, `ValidTo`, `PublishedAt` — which do not interchange, plus a parser
that rejects a value naming no single moment. `createdAt` and `updatedAt` have no parser at
all: they come from the clock, so a date from a payload cannot reach them.

**Migration constraint:** `apps/web` is **not** changed by PAS-0104. Under ADR-003 the
frontend is progressively re-pointed, not rewritten, and these strings are display data in a
prototype store. What changes is that no *new* contract may express a timestamp as `string`.
The baseline fields are re-pointed when the store is replaced by real records.

**Phase:** 1 (contract), deferred (frontend).

---

## ADR-003 — Clean-sheet backend and platform; migration discipline for the frontend

**Status:** ✅ **CONFIRMED** (architect, resolving the specification fork)
**Resolves:** the fork recorded in `docs/SPECIFICATION_RECONCILIATION.md` Part 2.

> **Numbering note.** The architect issued this decision under the label "ADR-002". That
> number was already held by *Protective boundaries move forward with upstream change*,
> confirmed earlier. This decision is recorded as **ADR-003** to preserve both. Renumber on
> request; nothing depends on the label.

### Decision

The Clean-Sheet Master Build Specification is **not a competing architecture and is not
permission to discard the working PAS.** It is the executable decomposition of the same
canonical architecture, expressed without letting prototype implementation choices constrain
the target system.

**Backend and platform infrastructure — clean sheet.** Build per PAS Builds 00–37 as
production infrastructure. There is no production backend worth migrating, so no
architectural value is gained by preserving the Zustand-as-database pattern, mock parser
behavior, hardcoded AI responses, fixed extraction mappings, or other prototype internals.

**Frontend — preserve and migrate.** The existing working product experience is an asset and
**SHALL NOT** be wholesale rewritten merely to conform to the new repository topology.

### Existing UI disposition

The 20 existing components are **implementation assets, not architectural authority.** They
fall into three dispositions:

| Disposition | Meaning | Examples |
|---|---|---|
| **Preserve** | concept remains canonical | Personal PAS, BPAS, Fellowship, Publishing |
| **Generalize** | concept valid, implementation carries prototype assumptions | Module and Dossier experiences — M01–M08 and d01–d10 may remain *operational* during migration but cease to define the underlying data architecture |
| **Replace only when superseded** | removed only after the production-backed successor is operational and verified | any component whose replacement has shipped |

### Build 35 reinterpreted

Build 35 does **not** mean "rewrite all eight workspaces from scratch." It means: complete the
operational workspaces against production PAS services. Existing components **SHALL** be
reused, refactored or re-pointed where suitable. New components **SHALL** be created where the
canonical architecture introduces capabilities the prototype does not contain.

Part I §60's information architecture is the **target operating organization**, not an
instruction to discard every existing route immediately.

### Migration rule — binding for the frontend

`Expand → Migrate → Verify → Contract`. Worked example:

```
Existing Dossier Manager keeps functioning
  → build canonical Composition/Dossier backend
  → connect existing UI to new services
  → verify behavior
  → remove associatedDossierIds assumptions
```

Identically for M01–M08.

> **There must never be a point where a functioning capability is destroyed simply because
> its replacement appears later in the build sequence.**

### Authority hierarchy (now controlling)

1. **Canonical PAS architecture and the 30 invariants** — govern *what PAS is*.
2. **Clean-Sheet Master Build Specification, Builds 00–37** — govern *how it is constructed,
   and in what dependency order*.
3. **Existing PAS baseline** — provides frontend/product assets to preserve and progressively
   migrate.
4. **Reconciliation and ADRs** — record how baseline structures transition into the canonical
   architecture.

Phases 0–11 are superseded **as implementation sequencing**, but not as architectural
requirements: Master Specification requirements remain controlling wherever they establish
invariants, definitions, boundaries or migration protections.

---

## ADR-004 — Origin does not create a governance exemption

**Status:** ✅ **CONFIRMED** (architect). **Closes DISC-2.**

Whether information originates from AI extraction, document extraction, web acquisition,
connector ingestion, **manual user entry**, Gap Interview, administrator entry, or another PAS
entity — **origin affects provenance and applicable policy, not whether governance exists.**

User and manual entry receive no privileged route around governance. No additional invariant
is necessary; Part I §0.22 and PAS-1104 already require a governance decision for every
governed state change.

CONF-A site 5 (`AuthorityGraphView.tsx:15-39`, SUP-12) is therefore governed by exactly the
same rule as the four extraction sites.

---

## ADR-005 — `config` and `observability` may depend on `contracts`

**Status:** ✅ **RATIFIED** (owner, 2026-09-20)
**Extends:** PAS-0001's declared architectural dependency direction.

### Decision

Two edges added during PAS-0003 and PAS-0004 are ratified:

```
@pas/config        → @pas/contracts
@pas/observability → @pas/contracts
```

PAS-0001 declares `domain → contracts` and leaves these two packages with no dependencies.
Both edges were added and committed before ratification, which was a scope violation under
*"quality does not purchase authority"* regardless of correctness. Recorded as such.

### Why they are correct

`@pas/contracts` is the universal sink — it depends on nothing, and PAS-0001 establishes it
as the dependency target for every other package. Neither edge creates a cycle.

Reverting them would mean:

- **config** — `ConfigValidationError` would not extend `ValidationError`, so a configuration
  failure surfaced through an API boundary would serialise under different rules from every
  other PAS error, **with unscrubbed details naming environment variables**.
- **observability** — `requireCorrelationId()` would throw a bare `Error` instead of a typed
  `PasError`, so a boundary that lost correlation context would produce an untyped failure
  that PAS-0003's serialiser cannot classify.

### Generalised rule

**`@pas/contracts` may be depended upon by any package.** It is the sink; adding an edge to it
can never create a cycle. This does not extend to any other package — every other new edge is
still proposed and held.

---

## Open items requiring owner decision

These are not ambiguities in the specification. They are points where the specification is
deliberately silent and implementation must not choose unilaterally.

> **Status refresh after ADR-003.** Item 2 is resolved — all four fixtures (P1/P2/P3/O1) are
> adopted immediately and O1 is no longer deferred. Items 1 and 3 remain open and now have
> homes: PAS-1002 supplies the verification-requirements table structure (the *content* per
> class is still an owner decision), and PAS-0604 / Part I §11 require a retention-policy
> field (the *policy* is still an owner decision). Item 4 is resolved by ADR-003: M01–M08 may
> remain operational during migration.

1. **Verification requirements per credential class (§IX).** `VERIFIED` means "the applicable
   verification requirement has been satisfied." The specification does not enumerate those
   requirements. A registry is needed before any `VERIFIED` transition can be implemented.
   *Blocks: Phase 3.*

2. **Fixture B and Fixture C subjects (§LIX).** Required to prove generalization. Without
   them, every generalized path is validated only against Fixture A — the precise failure
   mode INV-5 exists to prevent. *Blocks: Phase 5 completion.*

3. **Retention and deletion policy for `SourceRecord` artifacts (§XXXIV, object storage).**
   Ingesting real documents creates a data-protection surface the prototype never had.
   *Blocks: Phase 4.*

4. **Whether the migrated WDJIV M01–M08 composition remains publicly visible during Phase 6.**
   §XLVII permits it ("They may remain visible in your PAS"). This is a product call, not an
   architectural one.

None of the four blocks Phase 0, 1 or 2.
