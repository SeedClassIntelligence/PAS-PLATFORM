# PAS Repository Reconciliation

**Derived from:** `docs/PAS_MASTER_SPECIFICATION.md` v1.0 (controlling)
**Baseline:** `f23d11a` — tag `baseline-prototype-v0`
**Scope:** every file in the repository at the baseline commit
**Status:** Phase 0 artifact. No code has been modified.

---

## How to read this document

Each file carries the seven fields required by §LXI:

- **Current responsibility** — what the file does at `f23d11a`.
- **Canonical responsibility** — what the specification says it becomes.
- **Conflict** — the specific contradiction, with line references. `None` where there is none.
- **Migration requirement** — what must happen, under §LVII `Expand → Migrate → Verify → Contract`.
- **Dependencies** — what must exist first.
- **Phase** — §LVI phase where the work lands.
- **Non-regression** — what must keep working throughout (§LVIII).

Classifications are the four from §LXI: **PRESERVE**, **ENHANCE**, **REFACTOR**,
**ADD/REPLACE**. Where the specification assigns a compound classification to a named file
(§XLV–§LIV), that compound is used verbatim rather than flattened.

---

## Verified baseline facts

Established by direct inspection at `f23d11a`, not inferred:

| Fact | Evidence |
|---|---|
| 26 source files, 4,298 LOC under `src/` | `find src -type f \| xargs wc -l` |
| `tsc` passes, production build passes | `npm run build` → 61 modules, 298.08 kB |
| **No backend, persistence or network I/O anywhere** | zero matches for `fetch(`, `axios`, `supabase`, `firebase`, `localStorage`, `process.env`, `import.meta.env` across `src/` |
| All data originates in one file | `src/store/usePASStore.ts`, 608 lines |
| 5 seeded authority objects, 8 modules, 10 dossiers | `usePASStore.ts` |
| **5 sites write publish-ready public authority with no governance** | see CONF-A below |
| `SKILL.md` and `CAS-doctrine.md` are byte-identical | `md5sum` → both `e05b0927e1e938c9068d776dfc38b07d` |

---

## CONF-A — The governance bypass (five sites)

The single most consequential finding, because it spans services **and** UI **and** store —
so fixing any one site fixes nothing. Every path that creates authority in this codebase
creates it already public and already publish-ready.

| # | Site | Origin | Written state |
|---|---|---|---|
| 1 | `services/parser/WebHarvester.ts:37-42` | hostname string, **no HTTP fetch** | `94` / `SOURCE_CONFIRMED` / `PUBLISH_READY` / `PUBLIC` |
| 2 | `services/parser/DocumentParser.ts:40-100` | filename regex | typed authority objects |
| 3 | `services/ai/AgnosticAIEngine.ts:61-108` | hardcoded `mockObjects` literal | authority objects |
| 4 | `store/usePASStore.ts:558-586` (`acceptEnrichment`) | one UI click | `90` / `SOURCE_CONFIRMED` / `PUBLISH_READY` / `PUBLIC` / `d01` |
| 5 | `components/manage/AuthorityGraphView.tsx:15-39` | manual typing in a modal | `100` / `USER_CONFIRMED` / `PUBLISH_READY` / `PUBLIC` / `M03` / `d01` |

Sites 1–4 are the four the specification names in §VIII. **Site 5 is additional and is a
different class**: it is not extraction, so §VIII does not reach it. It is governed by §IX
and §X — *"None of these states automatically determines publication eligibility."*
`USER_CONFIRMED` is not authorization to publish, and `confidenceScore: 100` is not a gate
(INV-26).

Recorded as **SUP-12** in `ARCHITECTURE_DECISIONS.md`.

**Consequence for sequencing:** the governance gate (Phase 3) must sit behind a single
write path that all five sites are routed through. Patching them individually reproduces
the same bug five times.

---

## Summary classification

| Path | Class | Phase |
|---|---|---|
| **Domain model** | | |
| `src/types/pas.ts` | REFACTOR (split) | 2 |
| `src/store/usePASStore.ts` | REFACTOR (drain) | 1–2 |
| **Services** | | |
| `src/services/parser/WebHarvester.ts` | REFACTOR → ENHANCE | 4 |
| `src/services/parser/DocumentParser.ts` | REFACTOR → ENHANCE | 4 |
| `src/services/ai/AgnosticAIEngine.ts` | PRESERVE INTERFACE / REBUILD IMPL | 4 |
| `src/services/schema/JSONLDGenerator.ts` | PRESERVE / ENHANCE | 7 |
| `src/services/studio/ExecutiveProductionStudio.ts` | PRESERVE / ENHANCE | 6–7 |
| **Shell** | | |
| `src/App.tsx` | PRESERVE / ENHANCE | 7 |
| `src/main.tsx` | PRESERVE | — |
| **Authority management** | | |
| `src/components/manage/AuthorityGraphView.tsx` | PRESERVE / REFACTOR write path | 2–3 |
| `src/components/manage/ConnectionsManager.tsx` | PRESERVE / REFACTOR write path | 3–4 |
| `src/components/builder/PASBuilderWorkspace.tsx` | PRESERVE / ENHANCE | 4–6 |
| `src/components/dossiers/DossierManager.tsx` | PRESERVE EXPERIENCE / REFACTOR OWNERSHIP | 6 |
| `src/components/dashboard/OverviewDashboard.tsx` | PRESERVE / REFACTOR write path | 3 |
| **Published surfaces** | | |
| `src/components/public/PublishedPersonalPAS.tsx` | PRESERVE / ENHANCE | 7 |
| `src/components/public/PublishedBusinessPAS.tsx` | PRESERVE / ENHANCE | 7 |
| `src/components/public/PublicPASPlatform.tsx` | PRESERVE | — |
| `src/components/preview/LivePASPreview.tsx` | PRESERVE / ENHANCE | 6 |
| **Publishing & discovery** | | |
| `src/components/publishing/PublishingCenter.tsx` | PRESERVE / REFACTOR semantics | 7 |
| `src/components/account/SEOSchemaView.tsx` | PRESERVE / EXPAND → Discovery Intelligence | 7–8 |
| `src/components/account/VerificationView.tsx` | PRESERVE / ENHANCE | 3 |
| **Ecosystem** | | |
| `src/components/ecosystem/FellowshipView.tsx` | PRESERVE EXPERIENCE / ADD INTELLIGENCE | 9 |
| `src/components/ecosystem/MarketplaceView.tsx` | PRESERVE (optional capability) | 10+ |
| `src/components/admin/MasterAdminView.tsx` | PRESERVE / ENHANCE | 11 |
| **Design** | | |
| `src/components/design/PASDesignStudio.tsx` | PRESERVE / ENHANCE | decoupled |
| `src/styles/pas-design-tokens.css` | ENHANCE (systemize) | decoupled |
| **Everything the specification requires that does not exist** | ADD | 1–11 |

---

# Part 1 — Domain model

## `src/types/pas.ts` — 370 LOC

**Classification: REFACTOR (split into governed records)**

- **Current responsibility.** The entire domain vocabulary in one file: environments,
  provenance, visibility, 14 authority object types, 20 relationship verbs, `GraphEdge`,
  `AuthorityObject`, modules, dossiers, connectors, design config, domains, publication
  snapshots, the full BPAS suite, Fellowship and marketplace types, admin metrics.

- **Canonical responsibility.** The **preserved** vocabulary (§IX, §XI) stays. The generic
  `AuthorityObject` becomes a graph-addressable node (§XLVI). Everything requiring
  independent lifecycle becomes a first-class record: `AuthorityEntity`, `AuthorityRecord`,
  `SourceRecord`, `Observation`, `Claim`, `Evidence`, `Experience`, `Knowledge`, `KnowHow`,
  `Expertise`, `AuthorityDomain`, `AuthorityCluster`, `AuthoritySurface`, `Representation`,
  `Journey`, `DiscoveryObservation`, `Relationship`, `Outcome`.

- **Conflict.**
  - `CanonicalModuleCode` (L111-119) fixes M01–M08 universally → §XIII, §XV, INV-4.
  - `AuthorityObject.associatedDossierIds` (L103) inverts composition ownership → §XVI, INV-13.
  - `sources: string[]` + `evidenceIds: string[]` (L97-98) collapse Source/Observation/Claim/Evidence into string arrays → §VII, INV-9.
  - `EVIDENCE`, `OUTCOME`, `CREDENTIAL` etc. as enum tags (L56-66), not records → INV-6, INV-7, INV-28.
  - `ConnectorPlatform` (L190-202) hardcodes 12 vendors into domain types → INV-23.
  - `PublicationSnapshot` (L268-276) stores counts, not lineage → INV-24.
  - No `version` field on any object → INV-29.
  - **No conflict** in `ProvenanceState`, `VisibilityState`, `AccessTier`, `GraphEdge`, `SemanticRelationshipType` — all explicitly preserved by §IX and §XI.

- **Migration requirement.** **Expand only.** Add new record types alongside. Do not modify
  or remove any existing type in Phases 1–5 — the entire component tree compiles against
  this file, so a single removal breaks 20 components at once. Contract in Phase 6 after
  composition works.

- **Dependencies.** None. This is the first file to change and the safest, because addition
  is non-breaking.

- **Phase.** 2 (expand). Contract at 6.

- **Non-regression.** `tsc` passes; all 20 components continue to compile unchanged.

---

## `src/store/usePASStore.ts` — 608 LOC

**Classification: REFACTOR (drain, do not delete)**

- **Current responsibility.** §XLIV names this precisely: seed database, application state,
  business logic, demo identity, publishing state, graph state, BPAS state, Fellowship state,
  marketplace state, admin metrics — simultaneously. Holds 5 authority objects, 8 modules,
  10 dossiers, connectors, endorsements, products, admin metrics, and a hardcoded WDJIV
  identity (L130-134).

- **Canonical responsibility.** Client/UI state and cached server state. Canonical records
  move server-side. Seed data relocates to explicit fixtures (§XLIV).

- **Conflict.**
  - Seed objects are treated as persisted production truth → §XLIV, INV-3.
  - `acceptEnrichment` (L558-586) — CONF-A site 4.
  - `publishPAS` (L592-607) counts arrays instead of recording lineage → INV-24, SUP-7.
  - `auth-${Date.now()}` IDs (L564) → §XLI, INV-2, SUP-11.
  - WDJIV identity hardcoded as the application's identity → INV-5.
  - Nothing persists across reload — there is no `localStorage`, let alone a database.

- **Migration requirement.** Four ordered moves, each independently verifiable:
  1. Extract seed data to `src/fixtures/wdjiv.ts` — store imports it. Zero behavior change.
  2. Introduce a server-state layer; route reads through it with fixtures as fallback.
  3. Route the two write actions (`acceptEnrichment`, `publishPAS`) through the API.
  4. Contract: demote the store to UI state only.

- **Dependencies.** Step 1: none. Steps 2–4: Phase 1 backend, Phase 2 ontology, Phase 3 gates.

- **Phase.** 1 (fixture extraction) → 2 → 7.

- **Non-regression.** §LVIII — seed/demo mode must remain available until each corresponding
  production service exists. Every screen renders identically after step 1.

---

# Part 2 — Services

## `src/services/parser/WebHarvester.ts` — 61 LOC

**Classification: REFACTOR → then ENHANCE** *(§XLV, verbatim)*

- **Current responsibility.** Accepts a URL, parses the hostname with `new URL()`, and
  constructs an authority object from the hostname string.

- **Canonical responsibility.**
  `URL acquisition through authorized/safe retrieval → source artifact → content extraction
  → observations → proposed claims → review/governance` (§XLV).

- **Conflict.** The most severe in the repository. **The file contains no HTTP retrieval of
  any kind** (L24-27 parse the hostname only), yet writes `provenance: 'SOURCE_CONFIRMED'`
  at `confidenceScore: 94` with `workflowState: 'PUBLISH_READY'` and `visibility: 'PUBLIC'`
  (L37-42). It asserts a source confirms something it never read. §XLV is explicit:
  *"It must never fabricate 'harvested' content merely from a hostname."*
  Violates INV-10, INV-11, INV-12.

- **Migration requirement.** Replace the implementation entirely. Retain the
  `HarvestRequest` shape. Output becomes `SourceRecord` + `Observation[]` + `ProposedClaim[]`.
  Requires authorized/safe retrieval — SSRF protection, robots/ToS handling, timeout and
  size limits, content-type allowlist.

- **Dependencies.** Object storage (source artifacts), Phase 2 records, Phase 3 gate G0,
  retention policy (open item 3 in `ARCHITECTURE_DECISIONS.md`).

- **Phase.** 4.

- **Non-regression.** Demo mode continues to produce sample output until real acquisition
  ships. The Builder screen calling it must not break.

---

## `src/services/parser/DocumentParser.ts` — 113 LOC

**Classification: REFACTOR → then ENHANCE** *(§XLV, verbatim)*

- **Current responsibility.** Regex over filename and any available text
  (`/license|cert|certification|degree|board|chw|diploma/i` and similar, L36-38), emitting
  typed authority objects. Defaults `textContent` to the literal string
  `'Simulated extracted document text'` (L25).

- **Canonical responsibility.** Real format-specific extraction (PDF, DOCX, TXT, CSV).
  *"Filename regex can remain as a weak hint, not evidence"* (§XLV).

- **Conflict.** Heuristic output is promoted directly to authority with module and dossier
  assignments baked in (L53-54, 73-74, 93-94). A filename is not evidence (INV-9), and a
  heuristic is not a claim (§VII).

- **Migration requirement.** Real parsers per format. Emit `Observation` carrying
  byte offsets / page anchors so a claim can cite its exact location in the source artifact
  (required for INV-24 lineage). Filename signals survive as low-weight hints on the
  observation, never as provenance.

- **Dependencies.** Object storage, Phase 2 records, format parser libraries.

- **Phase.** 4.

- **Non-regression.** Builder upload flow continues to function in demo mode.

---

## `src/services/ai/AgnosticAIEngine.ts` — 123 LOC

**Classification: PRESERVE INTERFACE IDEA / REBUILD IMPLEMENTATION** *(§XLV, verbatim)*

- **Current responsibility.** Declares `AIProvider` (Gemini / GPT-4 / Claude / local
  DeepSeek), `AIProviderConfig`, `setProvider()`, and an extraction method returning a
  hardcoded `mockObjects` array (L61-108). No network call exists.

- **Canonical responsibility.** *"Provider abstraction is correct"* (§XLV). All providers
  route through the Agent Gateway (§XXXV), which owns routing, prompt versions, structured
  outputs, context assembly, timeouts, retries, cost accounting, tool permissions, logging
  and fallbacks. *"Agents return proposals"* — never authority.

- **Conflict.** The mock returns finished authority objects with module and dossier
  assignments (L73-74). The interface is right; the output type is wrong. Violates INV-1,
  INV-10; the LLM is currently positioned to own domain state, contra §XXXV.

- **Migration requirement.** Keep `AIProvider` / `AIProviderConfig` as the public shape.
  Move execution behind Agent Gateway. Change the return type from `AuthorityObject[]` to
  `ProposedClaim[]` — this is the change that makes INV-10 enforceable at the type level
  rather than by convention.

- **Dependencies.** Agent Gateway (Phase 4), Phase 2 `ProposedClaim`.

- **Phase.** 4.

- **Non-regression.** Provider-switching UI continues to work. Demo mode still returns
  sample proposals.

---

## `src/services/schema/JSONLDGenerator.ts` — 57 LOC

**Classification: PRESERVE / ENHANCE** *(§LIII)*

- **Current responsibility.** Real, working code — builds a schema.org `@graph` with
  `Person`, `ProfilePage`, `knowsAbout`, `hasCredential` and per-object nodes from the
  authority object array.

- **Canonical responsibility.** A **publication adapter** (§LIII). *"JSON-LD remains a
  publication adapter. It does not become canonical truth."*

- **Conflict.** Two minor, neither structural:
  - It reads all authority objects with no visibility filter → §XXII: *"Machine
    representation must not expose private Authority Record material."* Currently harmless
    because all seed objects are `PUBLIC`; becomes a **privacy leak** the moment private
    records exist.
  - `SEOSchemaView.tsx:7-40` re-implements this inline rather than calling it (SUP-9).

- **Migration requirement.** Add a visibility filter **before** Phase 2 introduces private
  records — this ordering is a hard requirement, not a preference. Make it the single
  schema source. Derive from governed representations rather than raw objects.

- **Dependencies.** Phase 2 visibility state; Phase 7 representations.

- **Phase.** 7 — **except** the visibility filter, which must land with Phase 2.

- **Non-regression.** Generated schema for the WDJIV fixture remains valid and unchanged.

---

## `src/services/studio/ExecutiveProductionStudio.ts` — 123 LOC

**Classification: PRESERVE / ENHANCE**

- **Current responsibility.** Generates slide definitions, video briefing scripts and media
  packages from dossiers, modules and authority objects.

- **Canonical responsibility.** A representation generator — one more output format under
  Authority Composition & Representation (layer 4, §II). Decks are an `AuthoritySurface`
  output, not a separate product.

- **Conflict.** None architectural. It consumes `Dossier` and `PASModule` directly, so it
  inherits SUP-2 and SUP-3 transitively and will need retargeting when composition changes.

- **Migration requirement.** Retarget from `Dossier`/`PASModule` to `CompositionDefinition`
  and `AuthoritySurface`. Output must respect visibility and carry lineage.

- **Dependencies.** Phase 6 composition.

- **Phase.** 6–7.

- **Non-regression.** Deck generation for the WDJIV fixture continues to produce equivalent
  output.

---

# Part 3 — Application shell

## `src/App.tsx` — 226 LOC

**Classification: PRESERVE / ENHANCE**

- **Current responsibility.** Routes the four `PASEnvironment` values and renders the
  authenticated OS chrome with an environment switcher.

- **Canonical responsibility.** Unchanged. The four-environment model (§I, §IV) is correct
  and survives.

- **Conflict.** None architectural. Environment switching is a dev affordance that will need
  gating behind auth in production; published surfaces will resolve by URL rather than by a
  state toggle.

- **Migration requirement.** Add real routing and auth for published surfaces. Retain the
  switcher as a development tool.

- **Dependencies.** Phase 1 identity/access.

- **Phase.** 7.

- **Non-regression.** All four environments keep rendering.

---

## `src/main.tsx` — 10 LOC

**Classification: PRESERVE**

Standard React root. No conflict. No migration. No phase. Must continue to mount.

---

# Part 4 — Authority management

## `src/components/manage/AuthorityGraphView.tsx` — 219 LOC

**Classification: PRESERVE (view) / REFACTOR (write path)**

- **Current responsibility.** Visualizes authority objects and graph edges; provides a modal
  to create objects manually (L15-39).

- **Canonical responsibility.** §XI — *"The existing Authority Graph concept is PRESERVED"*
  and `GraphEdge` is *"a strong starting point."* The visualization survives intact and
  becomes substantially richer as the ontology fills in.

- **Conflict.** **CONF-A site 5**, and the only one §VIII does not cover. `handleCreateObject`
  writes `confidenceScore: 100` / `USER_CONFIRMED` / `PUBLISH_READY` / `PUBLIC` with
  `associatedModuleCodes: ['M03']` and `associatedDossierIds: ['d01']` hardcoded (L24-31).
  Typing a sentence into a modal produces public authority.
  Violates §IX (`USER_CONFIRMED` ≠ publication eligibility), §X (publication is a separate
  governed decision), INV-26 (a score is not a gate), SUP-2, SUP-3.

- **Migration requirement.** Route creation through the proposal path: user entry produces a
  `Claim` at `DRAFT`, not published authority. Remove the hardcoded `M03`/`d01`. The
  visualization itself changes only to render richer node types.

- **Dependencies.** Phase 2 `Claim`; Phase 3 gate G2/G3.

- **Phase.** 2–3.

- **Non-regression.** Graph rendering and node inspection unchanged. Creation still works —
  it lands in review rather than in public.

---

## `src/components/manage/ConnectionsManager.tsx` — 104 LOC

**Classification: PRESERVE (experience) / REFACTOR (write path)**

- **Current responsibility.** Renders connector states and enrichment suggestions; calls
  `connectSource`, `acceptEnrichment`, `dismissEnrichment`.

- **Canonical responsibility.** The UI over source adapters (§XXXIV) and the proposal review
  queue (§VIII).

- **Conflict.** `acceptEnrichment` is CONF-A site 4 — accepting a suggestion publishes.
  `connectSource` (`usePASStore.ts:553-556`) flips a state flag with no OAuth, no fetch, no
  token handling. Vendor identities are baked into domain types (SUP-8).

- **Migration requirement.** Real connector adapters with OAuth and token lifecycle. Accept
  routes to `ProposedClaim`, not to authority. The screen becomes the human review surface
  the governance layer needs — its current shape is close to right for that.

- **Dependencies.** Phase 3 human task queue; Phase 4 adapters.

- **Phase.** 3–4.

- **Non-regression.** Connector UI and the accept/dismiss interaction keep working.

---

## `src/components/builder/PASBuilderWorkspace.tsx` — 540 LOC

**Classification: PRESERVE (experience) / ENHANCE (pipeline)**

Largest component in the repository.

- **Current responsibility.** The 11-stage guided Builder, including a stage labelled
  *"STAGE 06: PAS MODULES (THE 8 CANONICAL LENSES)"* (L334). Calls `addAuthorityObject` and
  `publishPAS`.

- **Canonical responsibility.** §XIX — *"The existing Builder experience is PRESERVED, but
  its internal pipeline changes"* to the canonical 11 steps, which **reconstruct authority
  before composing pages**. Stage 6 becomes the Gap Interview (§XX), a major intelligence
  capability rather than a static form.

- **Conflict.** Stage 6 presents eight fixed lenses as canonical (SUP-2). The pipeline
  composes pages before reconstructing authority — the inverse of §XIX. It calls `publishPAS`
  directly (L~470), bypassing gate G3.

- **Migration requirement.** Re-point stages onto the canonical pipeline. Stage 6 becomes
  gap-driven questioning. Stage ordering shifts so reconstruction precedes composition.
  §XIX explicitly permits a different screen count — the logical workflow governs, not the
  screen count.

- **Dependencies.** Phase 4 ingestion; Phase 5 reconstruction and gap interview; Phase 6
  composition.

- **Phase.** 4–6.

- **Non-regression.** The Builder must remain walkable end-to-end at every phase. This is the
  highest-churn component in the migration and therefore the one most at risk under §LVIII —
  stage changes should land one at a time.

---

## `src/components/dossiers/DossierManager.tsx` — 73 LOC

**Classification: PRESERVE EXPERIENCE / REFACTOR DATA OWNERSHIP** *(§XLVIII, verbatim)*

- **Current responsibility.** Lists dossiers with audience, sync rule, view count and
  `modulesUsed` (L35).

- **Canonical responsibility.** §XVI — a Dossier is *"a governed composition of Authority
  Record material assembled for a defined audience, purpose or evaluative context."*
  §XLVIII keeps title, audience, purpose, access tier, visibility, sections and publication
  behavior.

- **Conflict.** Membership resolves through `modulesUsed` and object-side
  `associatedDossierIds` (SUP-3). Deleting a dossier today orphans back-pointers on every
  referencing object — violating INV-14, under which deletion must leave authority untouched.

- **Migration requirement.** The §LVII worked example, verbatim: add `CompositionDefinition`
  → migrate memberships → **verify the rendered Personal PAS is unchanged** → only then
  deprecate `associatedDossierIds`.

- **Dependencies.** Phase 6 `CompositionDefinition`.

- **Phase.** 6.

- **Non-regression.** All 10 WDJIV dossiers render identically before and after. This is the
  single clearest regression test in the migration and should be written as one.

---

## `src/components/dashboard/OverviewDashboard.tsx` — 142 LOC

**Classification: PRESERVE / REFACTOR (write path)**

- **Current responsibility.** Landing dashboard; surfaces enrichment suggestions with
  accept/dismiss.

- **Canonical responsibility.** Unchanged as an experience. The suggestion feed becomes the
  proposal queue.

- **Conflict.** Accept path is CONF-A site 4.

- **Migration requirement.** Point the feed at `ProposedClaim`. Accept moves a proposal
  forward in the governance lifecycle (§X) rather than publishing it.

- **Dependencies.** Phase 3 human tasks.

- **Phase.** 3.

- **Non-regression.** Dashboard renders; accept/dismiss still respond.

---

# Part 5 — Published surfaces

## `src/components/public/PublishedPersonalPAS.tsx` — 288 LOC

**Classification: PRESERVE / ENHANCE** *(§XLIX, verbatim)*

- **Current responsibility.** The live public Personal PAS. Renders hero, modules, dossier
  navigation and evidence.

- **Canonical responsibility.** §XXI — a versioned governed projection of an Authority
  Record. §XLIX: *"Do not rebuild the visual experience simply because the backend changes."*

- **Conflict.** Reads seed Zustand data directly. `activeDossier.modulesUsed` drives copy
  (L249), inheriting SUP-2.
  **Notable:** L267 already resolves membership as a **query** —
  `authorityObjects.filter(o => o.associatedDossierIds.includes(...) || activeDossier.modulesUsed.some(...))`.
  This is composition-as-query and is the **target shape**. Only the back-pointer half needs
  replacing; the filter pattern is preserved as-is.

- **Migration requirement.** §XLIX — refactor the data source *gradually* from seed Zustand
  to published server representations. Do not restyle.

- **Dependencies.** Phase 7 public representation API.

- **Phase.** 7.

- **Non-regression.** Visual output pixel-equivalent for the WDJIV fixture throughout.

---

## `src/components/public/PublishedBusinessPAS.tsx` — 244 LOC

**Classification: PRESERVE / ENHANCE** *(§L, verbatim)*

- **Current responsibility.** The live public BPAS surface over `BusinessPASState` —
  entities, team, proposals, tracker, revenue streams, agreements.

- **Canonical responsibility.** §L — backed by Organization Authority Records and graph
  relationships. *"Do not collapse BPAS into Personal PAS."*

- **Conflict.** None architectural — **INV-18 is currently satisfied**; the separation is
  correctly implemented. The BPOS operational types (`BPOSProposal`, `BPOSRevenueStream`,
  `BPOSAgreement`) sit outside the Authority Record and will need normalizing, but §L states
  this is *"later… where necessary"* and is explicitly not urgent.

- **Migration requirement.** Back the organization identity with an `AuthorityEntity` of
  class `ORGANIZATION`. Express cross-entity links (`Person → founded → Organization`, §IV)
  as real graph edges. Defer BPOS operational normalization.

- **Dependencies.** Phase 1 `AuthorityEntity`; Phase 2 graph persistence.

- **Phase.** 7.

- **Non-regression.** BPAS renders unchanged.

---

## `src/components/public/PublicPASPlatform.tsx` — 178 LOC

**Classification: PRESERVE**

- **Current responsibility.** Marketing landing page with an animated demo sequence
  (`Simulation Step {demoStep + 1}`, L151).

- **Canonical responsibility.** Unchanged. Acquisition surface.

- **Conflict.** None. The demo is labelled a simulation, which is honest.

- **Migration requirement.** None. Keep the demo clearly labelled as a simulation once real
  extraction exists — that labelling is what keeps it non-misleading.

- **Phase.** —

- **Non-regression.** Renders.

---

## `src/components/preview/LivePASPreview.tsx` — 50 LOC

**Classification: PRESERVE / ENHANCE**

- **Current responsibility.** Live reactive preview of modules and page design.

- **Canonical responsibility.** Preview of a composition before publication — the natural
  pre-G3 review surface.

- **Conflict.** Previews `modules` directly (SUP-2).

- **Migration requirement.** Preview compositions and surfaces instead of fixed modules.

- **Dependencies.** Phase 6.

- **Phase.** 6.

- **Non-regression.** Preview updates live as design changes.

---

# Part 6 — Publishing & discovery

## `src/components/publishing/PublishingCenter.tsx` — 78 LOC

**Classification: PRESERVE (experience) / REFACTOR (semantics)**

- **Current responsibility.** 3-level domain architecture UI (free slug / subdomain /
  custom), DNS and SSL status, snapshot history, publish button.

- **Canonical responsibility.** §XXI publication. The domain model (§X, `DomainConfig`) is
  sound and survives.

- **Conflict.** Publishing is ungoverned — the button calls `publishPAS` with no G3 gate
  (§XXXVII). Snapshots record counts, not lineage (SUP-7, INV-24). DNS/SSL states are
  display-only with no provisioning behind them.

- **Migration requirement.** Publication becomes a governed decision through G3. Snapshots
  record representation versions, supporting claim/evidence versions, visibility, canonical
  URLs, structured-data versions, authorization and timestamp. Real DNS/ACME provisioning.

- **Dependencies.** Phase 3 gates; Phase 7 snapshots.

- **Phase.** 7.

- **Non-regression.** Publishing flow remains usable; snapshot history keeps rendering.

---

## `src/components/account/SEOSchemaView.tsx` — 95 LOC

**Classification: PRESERVE / EXPAND INTO DISCOVERY INTELLIGENCE** *(§LIII, verbatim)*

- **Current responsibility.** Displays generated JSON-LD. Builds `@graph` **inline** (L7-40).

- **Canonical responsibility.** §XXV — becomes Discovery Intelligence, observing indexation,
  impressions, queries, referrals, AI citations and retrieval where observable, entity
  interpretation, coverage, technical discoverability, freshness and gaps.

- **Conflict.** SUP-9 — duplicates `JSONLDGenerator` rather than calling it; the two can
  drift, so the schema displayed is not guaranteed to be the schema published. No visibility
  filtering (same latent privacy issue as `JSONLDGenerator`).

- **Migration requirement.** Delete the inline builder; call the adapter. Add discovery
  telemetry **behind** the existing experience (§LIII). §XXV constrains this hard: *"The
  system records observations. It does not pretend to know what cannot actually be
  measured"* — AI citation data that cannot be observed must not be fabricated into a metric.

- **Dependencies.** Phase 7 adapter; Phase 8 observations.

- **Phase.** 7–8.

- **Non-regression.** Schema view keeps rendering valid JSON-LD.

---

## `src/components/account/VerificationView.tsx` — 74 LOC

**Classification: PRESERVE / ENHANCE**

- **Current responsibility.** Displays a `verificationBadge` — one of three literal values
  read from the store.

- **Canonical responsibility.** §IX — `VERIFIED` means *"the applicable verification
  requirement has been satisfied."* This screen becomes the surface over real verification
  state.

- **Conflict.** The badge is an unearned string. No verification requirement, evidence or
  process exists behind it. INV-11, INV-12.

- **Migration requirement.** Requires the verification requirement registry —
  **open item 1** in `ARCHITECTURE_DECISIONS.md`. This screen cannot be implemented
  correctly until that decision is made, because there is nothing to check against.

- **Dependencies.** Verification requirement registry (owner decision); Phase 3 gates.

- **Phase.** 3, **blocked** on open item 1.

- **Non-regression.** Badge renders in demo mode.

---

# Part 7 — Ecosystem

## `src/components/ecosystem/FellowshipView.tsx` — 189 LOC

**Classification: PRESERVE EXPERIENCE / ADD INTELLIGENCE** *(§LI, verbatim)*

- **Current responsibility.** Recognition feed, peer endorsements, alignment display.

- **Canonical responsibility.** §XXVII — *"Recognition, not networking."* Operates on governed
  authority; identifies shared domains, complementary expertise, common work, institutional
  overlap, framework relationships, verified relationships, citations, endorsements.

- **Conflict.** L149 is the string literal `94% PAS Alignment`. There is no matching logic in
  the repository — this is pure ADD, not REFACTOR. A percentage also cannot express *no
  supported authority*, which §XXIV requires the system to support (INV-16).

- **Migration requirement.** Build `AuthorityAlignment` records storing the **reasons** —
  which domains, which shared work, which verified relationships. §XXVII: PAS answers
  *why* two entities are aligned, not *94%*. `PeerEndorsement.targetObjectId` is already
  object-specific, which §LI explicitly preserves.

- **Dependencies.** Phase 2 graph persistence; Phase 5 domains/clusters/expertise.

- **Phase.** 9.

- **Non-regression.** Fellowship feed and endorsement display keep rendering.

---

## `src/components/ecosystem/MarketplaceView.tsx` — 128 LOC

**Classification: PRESERVE AS OPTIONAL PAS ECOSYSTEM CAPABILITY** *(§LII, verbatim)*

- **Current responsibility.** Knowledge products — blueprints, toolkits, courses, consulting
  packages — with pricing and revenue.

- **Canonical responsibility.** §LII — an optional ecosystem capability. *"It is not the
  definition of PAS authority."*

- **Conflict.** `KnowledgeProduct.linkedAuthorityObjectIds` links products to authority. §LII:
  *"Commercialization cannot create authority retroactively."* The link direction must stay
  product → approved authority, never the reverse.

- **Migration requirement.** Products reference **approved** Authority Record material only.
  Selling something must never promote its underlying claims.

- **Dependencies.** Phase 3 approval state.

- **Phase.** 10+. Lowest priority.

- **Non-regression.** Marketplace renders.

---

## `src/components/admin/MasterAdminView.tsx` — 95 LOC

**Classification: PRESERVE / ENHANCE**

- **Current responsibility.** Platform metrics — users, published PAS count, BPAS count, MRR,
  pending verifications.

- **Canonical responsibility.** Operational observability (§XXXIV).

- **Conflict.** Metrics are static seed numbers. No access control gates this "god view"
  (§XXXVIII capability risk).

- **Migration requirement.** Real metrics from real data. Real authorization — this is a
  high-risk capability under R0–R5 and must not ship without it.

- **Dependencies.** Phase 1 identity/access; Phase 11 hardening.

- **Phase.** 11.

- **Non-regression.** Admin view renders in demo mode.

---

# Part 8 — Design

## `src/components/design/PASDesignStudio.tsx` — 86 LOC

**Classification: PRESERVE / ENHANCE**

- **Current responsibility.** Six template themes, fonts, accent colors, CTAs.

- **Canonical responsibility.** Unchanged. Representation styling (§LIV).

- **Conflict.** None architectural. `PageDesignConfig.exposedModuleIds` and
  `publicDossierIds` inherit SUP-2/SUP-3.

- **Migration requirement.** Re-point exposure config at surfaces rather than fixed modules
  and dossiers.

- **Dependencies.** Phase 6.

- **Phase.** 6.

- **Non-regression.** All six templates keep rendering.

---

## `src/styles/pas-design-tokens.css` — 24 LOC

**Classification: ENHANCE (systemize)** *(§LIV)*

- **Current responsibility.** 24 lines of tokens, minimally referenced.

- **Canonical responsibility.** §LIV — *"Extract repeated styling progressively into real
  design tokens/components."*

- **Conflict.** A token file exists; a design system does not. Every component carries inline
  `style={{…}}` objects with literal hex values (`#0C0D0E`, `#D4AF37`, `#26292E`, `#E5E7EB`)
  repeated across all 20 components. The visual implementation is PRESERVE; the claim of
  systemization is not yet earned (SUP-10).

- **Migration requirement.** Progressive extraction. §LIV is explicit that *"architecture
  migration and cosmetic refactoring should not be unnecessarily coupled."*

- **Dependencies.** None.

- **Phase.** Continuous, decoupled, **non-blocking**.

- **Non-regression.** Zero visual change at each extraction step.

---

# Part 9 — Configuration and non-source artifacts

| Path | Class | Notes |
|---|---|---|
| `index.html` | PRESERVE | Vite entry. |
| `vite.config.ts` | ENHANCE | Phase 1: add proxy config for the API. |
| `tsconfig.json` | ENHANCE | Phase 1: strict-mode review before the ontology lands — the cost of tightening rises with every new type. |
| `package.json` | ENHANCE | Phase 1: workspace structure for `api` / `worker`. Currently 4 runtime deps (react, react-dom, lucide-react, zustand); no test runner, no linter. |
| `package-lock.json` | PRESERVE | Do not regenerate casually — npm version differences produce large spurious diffs. |
| `.gitignore` | PRESERVE | Added at `f23d11a`. |

### Root artifacts

| Path | Class | Disposition |
|---|---|---|
| `CAS-doctrine.md` | PRESERVE | Collaborative Agent Standard doctrine. Not PAS architecture. |
| `SKILL.md` | **DEDUPLICATE** | **Byte-identical** to `CAS-doctrine.md` (`e05b0927…`). One is redundant. Recommend keeping `SKILL.md` (it carries the skill frontmatter) and removing the copy — owner's call, no code impact. |
| `temp_script.js` (14.7 KB) | REMOVE or RELOCATE | Landing-page demo animation. **Not referenced anywhere** — outside the Vite build entirely. Dead at the repository root. |
| `temp_script_1.js` (32 KB) | REMOVE or RELOCATE | Second variant of the same. Also unreferenced. |
| `EXAMPLES/*.html` (6 files, 680 KB) | PRESERVE | Reference PAS renders. Valuable input for Fixtures B and C (§LIX). |
| `William_Darnell_Jernigan_IV_*.html` (4 files) | PRESERVE | Fixture A reference renders — the visual ground truth for non-regression. |
| `PAS_Platform_Light_OliveGreen (10) (1).html` (247 KB) | PRESERVE | Design reference for the STUDIO template. |
| `dist/` | IGNORED | Build output; gitignored at `f23d11a`. |

---

# Part 10 — ADD: what the specification requires that does not exist

Nothing in this section exists in the repository in any form. This is the capability layer.

### Phase 1 — Foundation
Server application · configuration · PostgreSQL · migrations · **canonical ID service**
(§XLI) · `AuthorityEntity` · `AuthorityRecord` · audit service · **event ledger** ·
**transactional outbox** · identity/access.

### Phase 2 — Core ontology
`SourceRecord` · `Observation` · `ProposedClaim` · `Claim` · `Evidence` · `Experience`
(§VI, ~19 attributes) · graph persistence · versioning · provenance · visibility ·
governance state.

### Phase 3 — Governance
Governance Policy Registry · Decision Engine · gates G0–G5 (§XXXVII) · Workflow Runtime ·
Human Task Queue · **Dependency/Impact Service** (§XXXIX) · verification requirement registry.

### Phase 4 — Ingestion
Object storage · document ingestion · safe web acquisition · connector adapters ·
extraction pipeline · **Agent Gateway** (§XXXV) · provider adapters · Deterministic /
Cognitive / Human worker classes (§XXXVI).

### Phase 5 — Intelligence
`Knowledge` · `KnowHow` · `Expertise` · `AuthorityDomain` discovery · `AuthorityCluster`
discovery · **Gap Interview** (§XX) · conflict detection · authority reconstruction.

### Phase 6 — Composition
`CompositionDefinition` · `AuthoritySurface` (20 surface types, §XVII) · dossier migration ·
dynamic modules · representation versioning.

### Phase 7 — Publishing
Publication snapshots with full lineage · public representation API · canonical URLs ·
sitemaps · machine representation.

### Phase 8 — Discovery Intelligence
`Demand` · query targets · `DiscoveryObservation` · AI/Search Observatory · gap diagnosis
G1–G11 (§XXVI) · Authority-Demand Matching (§XXIV, including the negative result).

### Phase 9 — Fellowship
`AuthorityAlignment` · explainable matching · citations/vouches · recognition workflows.

### Phase 10 — Opportunity
`Relationship` · `Opportunity` · `Journey` (§XXX) · `Action` · `Outcome` · attribution ·
measurement · learning proposals (§XXXII).

### Phase 11 — Hardening
Security · privacy · permissions · rate limits · backups · recovery · performance ·
accessibility · **testing** (none exists today) · observability · deployment.

### Fixtures (§LIX) — required to prove generalization
Fixture A (WDJIV, exists as seed data) · **Fixture B** (deep academic/research) ·
**Fixture C** (skilled practitioner/operator) · later, BPAS organizational equivalents.

---

# Part 11 — Reconciliation against the Build Contract

§LV requires every production component to answer eight questions. Applied to the baseline
as a whole:

| Question | Baseline answer |
|---|---|
| Identity | Partial — components are identifiable; no canonical services exist |
| Input | Partial — typed props; no service contracts |
| Output | Partial |
| **Lineage** | **No** — `sources: string[]` is not lineage |
| **Governance** | **No** — five unguarded write paths (CONF-A) |
| **Observability** | **No** — no logging, no telemetry, no audit |
| **Continuity** | **No** — no persistence; reload loses everything |
| **Impact** | **No** — one unused boolean flag |

Three of eight partial, five absent. **The baseline is a complete product experience and is
not production-complete under §LV** — which is the correct and expected reading of a
prototype, and is precisely what Phases 1–11 exist to close.

---

# Part 12 — Sequencing consequences

Five conclusions that follow from the reconciliation and are not obvious from the
specification read alone:

1. **CONF-A must be fixed at one chokepoint, not five sites.** The bypass spans services, UI
   and store. Five separate patches reproduce the same defect five times and leave no place
   to enforce INV-10. One governed write path, five callers routed through it.

2. **`JSONLDGenerator` needs a visibility filter before Phase 2, not at Phase 7.** It is
   harmless today only because every seed object is `PUBLIC`. The moment Phase 2 introduces
   private records, an unfiltered generator publishes them. This is the one ordering
   dependency in the plan that runs *backwards* against the phase numbering.

3. **`types/pas.ts` is expand-only until Phase 6.** Twenty components compile against it.
   Addition is free; removal is a twenty-file break. §LVII already says this; the
   reconciliation shows exactly how wide the blast radius is.

4. **Fixtures B and C gate Phase 5, not Phase 11.** Domain and cluster discovery built and
   validated against Fixture A alone will encode WDJIV's shape as the universal shape —
   the exact failure INV-5 exists to prevent. The fixtures are a correctness requirement for
   generalization, not a testing nicety.

5. **`VerificationView` is blocked on an owner decision, not on engineering.** Until the
   verification requirement registry exists (open item 1), there is nothing for `VERIFIED` to
   be checked against, and implementing it would mean inventing verification semantics —
   which is exactly the architectural decision-making §LXI forbids implementation from doing.

---

# Part 13 — Discrepancies between the earlier repository audit and the Master Specification

A repository audit was performed in conversation **before** the Master Specification landed.
Where the two disagree, **the Master Specification controls**. Per the reconciliation
instruction, each discrepancy is recorded here rather than silently resolved, so the
Specification's ruling is not mistaken for the audit's original position.

### DISC-1 — Service classification: audit said ADD, Specification says REFACTOR → ENHANCE

**Audit position.** *"Reconciliation should treat the component tree as PRESERVE and the
services as ADD, not ENHANCE."* Reasoning: `WebHarvester` performs no retrieval,
`DocumentParser` is filename regex, and `AgnosticAIEngine` returns a hardcoded literal —
so there is no working capability to enhance, and the honest classification is that the
capability must be added.

**Specification position.** §XLV assigns:
- `WebHarvester` → **REFACTOR / then ENHANCE**
- `DocumentParser` → **REFACTOR / then ENHANCE**
- `AgnosticAIEngine` → **PRESERVE INTERFACE IDEA / REBUILD IMPLEMENTATION**

**Resolution — Specification controls.** `RECONCILIATION.md` Part 2 uses the Specification's
classifications verbatim.

**Why the Specification is right and the audit was wrong.** The audit classified on
*implementation substance* and concluded that near-empty implementations mean ADD. The
Specification classifies on *interface and contract*, which is the more useful axis for
migration: `HarvestRequest`, `ParsedDocumentResult`, `AIProvider` and `AIProviderConfig` are
real, correct contracts that survive. §XLV is explicit that the provider abstraction *"is
correct."* Classifying these as ADD would license discarding those interfaces and rebuilding
the call sites — churn the Specification's non-regression rule (§LVIII) exists to prevent.
The audit's underlying finding (no capability exists) remains accurate and is preserved in
the conflict fields; only the classification changes.

**Practical consequence:** the files are edited in place with their interfaces preserved,
not deleted and replaced.

---

### DISC-2 — Governance bypass: Specification names four sites, reconciliation found five

**Specification position.** §VIII names four: `WebHarvester`, `DocumentParser`,
`AgnosticAIEngine`, `acceptEnrichment()`.

**Reconciliation finding.** A fifth exists:
`src/components/manage/AuthorityGraphView.tsx:15-39`, which writes
`confidenceScore: 100` / `USER_CONFIRMED` / `PUBLISH_READY` / `PUBLIC` with hardcoded
`M03`/`d01` on manual user entry.

**Not a conflict — an extension.** §VIII governs *extraction*, and site 5 is user-origin, so
§VIII correctly does not reach it. It falls under §IX and §X instead: *"None of these states
automatically determines publication eligibility."* The Specification's rule is sufficient to
condemn it; the Specification's *enumeration* simply did not include it, because the
enumeration was scoped to extraction mechanisms.

**Resolution.** Recorded as **SUP-12** in `ARCHITECTURE_DECISIONS.md` under §IX/§X rather
than §VIII.

> ⚠️ **Flagged for architectural review.** This is the one place where the reconciliation
> adds to the Specification rather than deriving from it. Two questions for the architect:
> (a) is §VIII's four-site enumeration intended as exhaustive, or as examples of a general
> rule?  (b) should a *user-origin* creation rule be stated explicitly alongside §VIII's
> extraction rule, since the two have different origins but the same required outcome?
> Implementation has not assumed an answer. Phase 3 routes all five sites through one
> governed write path, which is correct under either reading.

---

### DISC-3 — JSON-LD visibility filter: Specification places it at Phase 7, reconciliation requires Phase 2

**Specification position.** §LIII classifies `JSONLDGenerator` as PRESERVE / EXPAND, and
§LVI places JSON-LD work in Phase 7.

**Reconciliation finding.** `JSONLDGenerator.ts` reads all authority objects with no
visibility filter. This is harmless at the baseline **only because every seed object is
`PUBLIC`**. Phase 2 introduces private records. An unfiltered generator at that moment
publishes private Authority Record material — violating §XXII (*"Machine representation must
not expose private Authority Record material"*).

**Not a conflict in intent — a sequencing consequence.** §XXII's requirement is unambiguous.
The phase table places the *work* at Phase 7 without anticipating that Phase 2 creates the
exposure.

**Resolution.** `IMPLEMENTATION_PLAN.md` Phase 2 carries the visibility guard, with the rest
of the JSON-LD work remaining at Phase 7.

> ✅ **ARCHITECTURAL DECISION CONFIRMED.** Recorded as **ADR-001** in
> `ARCHITECTURE_DECISIONS.md`. The governing dependency is
> `Visibility enforcement → Private records → Machine representation`, not the nominal phase
> numbering. Deferring private records to Phase 7 would distort the core Authority Record
> implementation; accepting an exposure window would violate a canonical invariant rather
> than merely leave functionality incomplete. Generalized as **ADR-002**: a protective
> boundary moves forward with the upstream change that creates the need for it. No longer
> provisional.

**Consequence — the audit understated this.** Applying ADR-002's consumer sweep during
Phase 0 established that the exposure is **already live at `f23d11a`**, not created by
Phase 2, and that it has **four** unguarded consumers rather than one. Recorded as **SUP-13**.
See Part 14.

---

### Non-discrepancies — audit findings the Specification confirms

Recorded for completeness, so the audit's standing is clear:

| Audit finding | Specification |
|---|---|
| `associatedDossierIds` inverts composition ownership | §XVI confirms — names the field directly |
| M01–M08 hardcoded in every extraction path | §XV confirms — *"No extraction engine should assign them"* |
| `94% PAS Alignment` is a string literal with no logic | §XXVII confirms — names the pattern directly |
| `ProvenanceState` vocabulary is correct and worth keeping | §IX confirms — *"The existing vocabulary is preserved"* |
| `GraphEdge` is the right shape | §XI confirms — *"a strong starting point"* |
| No backend, persistence or network I/O exists | §XLIV confirms the store's overloaded role |
| A token file is not a design system | §LIV confirms — PRESERVE visual / ENHANCE systemization |
| `WebHarvester` never retrieves the URL | §XLV confirms — *"must never fabricate… merely from a hostname"* |

The audit's factual findings are sustained in full. Only DISC-1's *classification* was
overruled.

---

# Part 14 — ADR-002 consumer sweep (Phase 0)

The first application of ADR-002's standing obligation: *whenever a phase changes the
meaning, visibility, lifecycle or governance of data an existing component consumes, inspect
every existing consumer.*

**Swept:** all consumers of Authority Record material, against the Phase 2 introduction of
non-public records.

### Finding — visibility is written eleven times and read zero times

Every occurrence of `visibility` outside `src/types/pas.ts` is a write or a display label.
**No consumer in the codebase filters on it.**

### The exposure is already live at `f23d11a`

| Element | Value |
|---|---|
| `usePASStore.ts:207-220` — `auth-anthem-loi` | `visibility: 'GATED'`, `associatedModuleCodes: ['M04','M08']` — "Anthem Nevada $1M Clinical Partnership", a signed LOI |
| `usePASStore.ts:262` — dossier `d03` | `accessTier: 'CORE_PUBLIC'`, `visibility: 'PUBLIC'`, `modulesUsed: ['M02','M03','M04']` |
| `PublishedPersonalPAS.tsx:267` | matches by dossier id **or module code**, no visibility predicate |

`d03` is public. It uses `M04`. `auth-anthem-loi` carries `M04` and is `GATED`. **It renders
on the public surface today.** `DocumentParser.ts:72` also emits `GATED` objects, so the
extraction path reproduces the condition rather than being a one-off in seed data.

### Four unguarded consumers, not one

| Consumer | Exposure | Note |
|---|---|---|
| `components/public/PublishedPersonalPAS.tsx:267` | the public page itself | most severe — this is the actual published surface |
| `services/schema/JSONLDGenerator.ts` | all objects → structured data | the originally-identified consumer |
| `components/account/SEOSchemaView.tsx:7-40` | all objects → structured data | **inline duplicate** — guarding the generator alone does **not** fix this (SUP-9) |
| `services/studio/ExecutiveProductionStudio.ts` | decks/media from authority objects | a representation generator under ADR-001 |

The `SEOSchemaView` case is the clearest vindication of ADR-002: a fix scoped to the named
file would have left an identical unguarded path in a component nobody had classified as a
publication boundary.

### Correction to the earlier framing

The audit and the first draft of this reconciliation both described this as *"harmless today,
becomes a leak at Phase 2."* That was wrong in two ways: the seed data already contains
`GATED` material reachable from a public dossier, and there were four consumers rather than
one. Phase 2 does not create the exposure — it populates an exposure path that is already
fully constructed.

### Severity

The baseline is a local prototype with seed data and no deployment. This is **not a live
production leak** and needs no emergency fix. It is recorded at this severity because it
proves the mechanism rather than predicting it.

### Phase 2 consequence

Filtering `GATED` material out of the WDJIV published surface **changes rendered output**.
That is deliberate and correct, and is the one sanctioned exception to the §LVIII "renders
identically" requirement. It must appear in the Phase 2 exit criteria as an expected diff,
not be discovered later as an apparent regression.

---

# Part 15 — Outstanding architectural flags

Current status of every flag raised in this reconciliation. **This list is not empty.**

| Flag | Status |
|---|---|
| DISC-1 — service classification | ✅ Resolved. Specification controls; classifications corrected to §XLV. |
| DISC-3 — JSON-LD visibility sequencing | ✅ **Confirmed** as ADR-001 / ADR-002. Settled. |
| **DISC-2 — §VIII enumeration scope** | ⚠️ **OPEN — awaiting architectural review** |
| Open item 1 — verification requirement registry | ⚠️ OPEN — blocks Phase 3 (`VerificationView`, `VERIFIED` transitions) |
| Open item 2 — Fixture B and C subjects | ⚠️ OPEN — blocks Phase 5 completion |
| Open item 3 — source artifact retention policy | ⚠️ OPEN — blocks Phase 4 |
| Open item 4 — WDJIV M01–M08 public visibility | ⚠️ OPEN — product decision, blocks nothing architecturally |

**DISC-2 restated for decision.** §VIII names four extraction sites. A fifth exists at
`AuthorityGraphView.tsx:15-39` (user-origin, not extraction). §IX and §X already condemn it,
so the *rule* is sufficient; the question is whether the *enumeration* was intended as
exhaustive, and whether a user-origin creation rule should be stated explicitly alongside
§VIII's extraction rule. Phase 3 routes all five through one governed write path, which is
correct under either reading — so this does not block Phase 1 or Phase 2.

**None of the seven blocks Phase 1 or Phase 2.**

---

**Handoff status.** This document, `ARCHITECTURE_DECISIONS.md` and `IMPLEMENTATION_PLAN.md`
together constitute the §LXI handoff boundary. No production feature implementation begins
until all three reconcile cleanly with the Master Specification and the owner confirms.
