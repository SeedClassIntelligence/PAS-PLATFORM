# PAS Master Architecture & Build Specification

**Canonical Control Specification — v1.0**

> This specification supersedes the fragmented architectural proposals we developed earlier
> only where they conflict. It does not discard that work. It consolidates it.

---

## Status of this document

This is the **controlling document** for the PAS Platform repository.

- Implementation does not make architectural decisions. Architectural ambiguity resolves
  back to this document.
- `docs/RECONCILIATION.md`, `docs/ARCHITECTURE_DECISIONS.md` and
  `docs/IMPLEMENTATION_PLAN.md` are **derived from** this specification and are
  subordinate to it.
- Where any derived document disagrees with this specification, this specification wins
  and the derived document is corrected.

Source: `PAS_PLAFORM.pdf`, v1.0, 29 pages. Transcribed verbatim into version control.
Two artifacts of the source rendering were corrected during transcription and are marked
inline: a stray UI string on page 1, and a pull-quote in §XVI whose definition box
extracted out of sequence.

---

## I. System identity

**PAS — Professional Authority System**

PAS is a persistent professional-authority infrastructure for people and organizations.

Its purpose is to capture and reconstruct the breadth of what a person or organization has
genuinely experienced, learned, developed, built, implemented, produced and demonstrated;
establish the support for those assertions; organize the resulting authority coherently;
publish appropriate representations of it; make that authority intelligible to humans and
machines; and facilitate discovery, recognition, relationships and opportunity.

PAS is **not** fundamentally:

a résumé builder, portfolio builder, social network, SEO product, dossier generator,
credentialing service, AI profile generator, or job board.

Those may become capabilities or outputs of PAS.

The canonical progression is:

```
Authority → Representation → Discovery → Recognition → Relationship
          → Opportunity → Outcome → Learning
```

And the original human mission remains:

> **Find your tribe.**

---

## II. The canonical system boundary

There is one system. Everything we've developed now belongs inside:

**Professional Authority System**

It contains seven major operating layers:

1. Authority Capture & Reconstruction
2. Authority Record & Intelligence
3. Authority Graph & Organization
4. Authority Composition & Representation
5. Publishing & Discovery Intelligence
6. Fellowship, Relationships & Opportunities
7. Outcomes, Measurement & Learning

Underneath all seven is **PAS Core Infrastructure**:

Persistence · Governance · Workflow · Events · AI/Agent Gateway · Source adapters ·
Identity/access · Audit · Object storage · Search/retrieval · Dependency/impact analysis ·
Observability.

There is no separate "Knowledge-to-Demand product."
There is no separate "Authority Intelligence product."
Those are PAS capabilities.

> **Editorial note (source verification, page 1).** The specification records that the live
> branch was inspected directly and the code confirms the critical findings: the existing
> `AuthorityObject` carries module/dossier membership, the canonical module type hardcodes
> M01–M08, `acceptEnrichment()` creates `SOURCE_CONFIRMED` objects directly as
> `PUBLISH_READY`, `WebHarvester` constructs authority without retrieving the webpage,
> `DocumentParser` promotes heuristic extraction directly to authority, and
> `AgnosticAIEngine` is currently a mock adapter returning hardcoded objects.

---

## III. The persistent root

The root domain object becomes:

**`AuthorityEntity`**

An Authority Entity represents the persistent subject whose authority PAS manages.

Initial entity classes:

- `PERSON`
- `ORGANIZATION`

Each Authority Entity owns or controls an **`AuthorityRecord`** — the complete governed
record PAS maintains concerning that entity.

Therefore: `AuthorityEntity → AuthorityRecord`

- A published PAS is **not** the Authority Record.
- A dossier is **not** the Authority Record.
- The Authority Graph is **not** by itself the Authority Record.

Those are structures or projections derived from it.

---

## IV. Personal PAS and Business PAS

Both remain first-class.

**Personal PAS** represents the authority of a person.

**Business PAS / BPAS** represents the authority, capability and operating record of an
organization.

They share the PAS substrate but do not collapse into one another.

Relationships can cross them:

```
Person       → founded     → Organization
Person       → authored    → Framework
Organization → implemented → Framework
Organization → operated    → Program
Person       → led         → Program
Program      → produced    → Outcome
Evidence     → supports    → Claim
```

This creates the larger professional authority ecosystem.

---

## V. The canonical Authority Record

The Authority Record contains the governed professional record. Its principal object
families become:

| Family | Question it answers |
|---|---|
| **Identity** | Who/what is the Authority Entity? |
| **Experience** | What has actually been experienced or performed? |
| **Work** | What substantive work occurred? |
| **Role** | What responsibility was held? |
| **Project** | What bounded body of work occurred? |
| **Initiative** | What sustained body of work exists? |
| **Framework** | What structured intellectual architecture was developed? |
| **Methodology** | What repeatable process was developed or practiced? |
| **Output** | What was produced? |
| **Credential** | What formal qualification or recognition exists? |
| **Agreement** | What formal relationship/commitment exists? |
| **Partnership** | What institutional/professional collaboration exists? |
| **Claim** | What exactly is PAS asserting? |
| **Evidence** | What supports or contradicts a Claim? |
| **Knowledge** | What does the entity demonstrably know? |
| **Know-How** | What can the entity demonstrably perform? |
| **Expertise** | What accumulated capability can reasonably be established? |
| **Outcome** | What resulted? |
| **Domain** | What substantive field does authority concern? |
| **Relationship** | How do Authority Record objects and external entities relate? |

**These are not automatically public.**

---

## VI. Experience becomes first-class

This is a major addition.

`Experience` cannot be reduced to employment.

A canonical Experience record should eventually be capable of representing:

entity · context · time period · location where relevant · role · responsibility ·
problem/environment · actions · decisions · tools/methods · collaborators ·
knowledge gained · know-how demonstrated · outputs · outcomes · supporting evidence ·
related claims · related projects · confidence/provenance · visibility.

This is one of the mechanisms through which PAS fulfills its original purpose:
professional authority that conventional résumé structures routinely fail to capture.

---

## VII. Evidence, Claim and Authority must be separated

**This is a hard architectural boundary.**

| Concept | Definition |
|---|---|
| **Source** | Where information came from. |
| **Observation** | What PAS observed in that source. |
| **Extracted Assertion** | What a parser/model believes the source says. |
| **Claim** | A normalized assertion PAS may evaluate. |
| **Evidence** | Material supporting, weakening or contradicting the Claim. |
| **Knowledge / Know-How / Expertise** | Higher-order conclusions that may emerge from accumulated governed Claims and Evidence. |
| **Representation** | How approved authority is communicated. |

Therefore:

```
Source ≠ Evidence ≠ Claim ≠ Knowledge ≠ Expertise ≠ Authority Representation
```

The existing code currently collapses several of these. **That must be refactored.**

---

## VIII. Extraction boundary

Every ingestion mechanism operates under the same rule:

> **Extraction may propose. Extraction may not establish authority.**

`DocumentParser` · `WebHarvester` · AI models · connected accounts · public records ·
user uploads · third-party APIs · other PAS records

can create:

```
SourceRecord → Observation → ProposedClaim
```

They **cannot** directly create public `PUBLISH_READY` authority.

This specifically supersedes the current behavior visible in `WebHarvester`,
`DocumentParser`, `AgnosticAIEngine`, and `acceptEnrichment()`.

---

## IX. Provenance

The existing vocabulary is **preserved**:

`VERIFIED` · `SOURCE_CONFIRMED` · `USER_CONFIRMED` · `AI_INFERRED` · `UNVERIFIED`

But its meaning becomes exact:

- `AI_INFERRED` — AI produced or inferred the assertion.
- `SOURCE_CONFIRMED` — PAS confirmed that a source contains/supports the assertion.
- `USER_CONFIRMED` — the Authority Entity or authorized representative confirmed it.
- `VERIFIED` — the applicable verification requirement has been satisfied.
- `UNVERIFIED` — sufficient verification has not occurred.

**None of these states automatically determines publication eligibility.**

---

## X. Governance lifecycle

The current workflow vocabulary should evolve. Canonical lifecycle:

```
DRAFT
 → EXTRACTED
 → PENDING_REVIEW
 → SUPPORTED / CONFLICT / MISSING_EVIDENCE
 → APPROVED
 → ACTIVE
 → potentially STALE
 → SUPERSEDED / RETIRED / REJECTED
```

Publication eligibility is a **separate governed decision**.

An object can be: verified but private; or supported but unpublished; or public but later
stale; or historically valid but superseded.

This separation matters.

---

## XI. Authority Graph

The existing Authority Graph concept is **PRESERVED**. The existing `GraphEdge` model is
also a strong starting point.

Existing semantic verbs are preserved initially:

`founded` · `authored` · `created` · `co_created` · `implemented` · `leads` · `managed` ·
`advised` · `funded` · `supported` · `partnered_with` · `collaborated_with` ·
`contributed_to` · `employed_by` · `served_on` · `reviewed` · `recognized` · `adopted` ·
`cited` · `formerly_affiliated_with`

The vocabulary can expand as required.

Graph relationships remain governed and carry provenance/visibility. The graph **connects**
Authority Record objects; it does not **replace** them.

---

## XII. Knowledge, Know-How and Expertise

These remain distinct.

- **Knowledge** — what the entity knows or understands.
- **Know-How** — what the entity knows how to perform, apply, operate, build, solve or execute.
- **Expertise** — accumulated, sufficiently supported capability within a substantive area.

These concepts **must not** be inferred solely from: job titles, keywords, credentials,
self-description or AI similarity.

They **can** be supported by combinations of: Experience · Projects · Work · Methods ·
Outputs · Outcomes · Credentials · Evidence · Claims · Repeated execution ·
External recognition · other governed signals.

The deeper ontology can later be cross-referenced against the separate
Knowledge / Know-How / Expertise research rather than improvised during coding.

---

## XIII. Authority Domains

Fixed M01–M08 modules cease to be universal domain architecture.

PAS discovers **`AuthorityDomain`** — a coherent substantive field in which the Authority
Entity possesses relevant record material.

Domains emerge from the Authority Record. They may be suggested by AI but become governed
PAS structures. Examples vary completely by person.

**No universal domain count exists.**

---

## XIV. Authority Clusters

Within Domains, PAS constructs **`AuthorityCluster`** — a coherent body of related
authority.

Clusters prevent PAS from becoming an indiscriminate collection of pages.

A cluster may combine: experiences · projects · claims · knowledge · know-how · expertise ·
frameworks · outputs · evidence · relationships · outcomes.

Clusters are organizational intelligence. They are not merely keyword groups.

---

## XV. The fixed-module correction

The existing M01–M08 remain valid for the existing WDJIV composition where appropriate.

They are no longer `CanonicalModuleCode` in the universal sense. They become composition
structures or migrated legacy/reference module codes.

- **No Authority Object should be born requiring an M01–M08 assignment.**
- **No extraction engine should assign them as canonical authority ontology.**

PAS may generate modules dynamically from Domains/Clusters and presentation needs.

---

## XVI. Dossiers

A Dossier becomes:

> A governed composition of Authority Record material assembled for a defined audience,
> purpose or evaluative context.

*(Transcription note: in the source PDF this definition renders as a pull-quote box that
extracted after §XVIII. It belongs here.)*

**Dossiers do not own authority.**

The current `AuthorityObject.associatedDossierIds` relationship therefore must be removed
from canonical ownership.

Composition should point **toward** Authority Record objects, not Authority Record objects
toward compositions.

Conceptually:

```
DossierDefinition
  → selection rules/references
  → Authority objects/claims/evidence/etc.
```

**Deleting the Dossier leaves authority untouched.**

---

## XVII. Authority Surfaces

Dossier is only one possible surface. Introduce **`AuthoritySurface`**.

Possible surface types include:

PAS home · Domain page · Cluster page · Expertise page · Experience page · Project page ·
Framework page · Methodology page · Research page · Case study · Evidence view ·
Credential view · Outcome view · Bio · Résumé · CV · Dossier · Implementation brief ·
Knowledge/answer surface · Business capability surface.

This list is extensible. **There is no fixed page count.**

---

## XVIII. Dynamic PAS Composition

The Composition Engine receives: Authority Entity · Authority Record · Authority Graph ·
Domains · Clusters · audience · purpose · privacy rules · owner objectives ·
evidence density · significance · representation rules.

It determines appropriate Authority Surfaces.

Therefore:

> **Authority determines composition. Not: Template determines authority.**

A PAS can contain 6 meaningful surfaces or 46. Depth alone does not justify another page.
The system optimizes for coherent authority representation rather than page count.

---

## XIX. Builder

The existing Builder experience is **PRESERVED**, but its internal pipeline changes.

Canonical pipeline:

```
1  Source Acquisition
2  Corpus Ingestion
3  Authority Extraction
4  Authority Reconstruction
5  Initial Authority Graph
6  Gap Interview
7  Claim/Evidence/Provenance Review
8  Knowledge/Know-How/Expertise Reconstruction
9  Domain & Cluster Discovery
10 PAS Composition
11 Design / Preview / Publication
```

The interface does not necessarily need exactly eleven screens. This is the logical
workflow.

---

## XX. Gap Interview

The current Conversation concept becomes a major intelligence capability.

PAS asks questions based on **missing authority information**, not a static questionnaire.

The objective is to discover: undocumented responsibility · decision-making ·
problem-solving · tacit knowledge · repeated practices · failures and lessons · methods ·
leadership · collaboration · outcomes · evidence · institutional history ·
unrecorded bodies of work.

This is how PAS captures authority that documents alone cannot reveal.

---

## XXI. Published PAS

A Published PAS is: **a versioned governed projection of an Authority Record.**

Publication creates a `PublicationSnapshot`. The existing concept is preserved.

A snapshot should eventually identify exactly: what representation versions were published ·
which claims/evidence versions supported them · visibility state · canonical URLs ·
structured-data versions · publisher/authorization · timestamp.

This makes published authority reproducible and auditable.

---

## XXII. Machine representation

The existing JSON-LD capability is **PRESERVED and ENHANCED**.

Machine representation derives from governed authority. Potential representations include:
Schema.org JSON-LD · semantic metadata · canonical URLs · sitemaps · structured APIs ·
entity identifiers · machine-readable evidence/provenance references where appropriate.

**Machine representation must not expose private Authority Record material.**

---

## XXIII. PAS Authority Intelligence

The intelligence capability now formally consists of **eleven integrated engines**:

1. **Demand Intelligence** — observes what knowledge/expertise/problems are being sought.
2. **Knowledge Registry** — governs knowledge records.
3. **Evidence & Provenance** — manages support and lineage.
4. **Authority Production** — turns supported authority into legitimate representations.
5. **Machine Discoverability** — makes representations technically interpretable.
6. **AI/Search Observatory** — observes retrieval, citation, indexing and discovery.
7. **Gap Detection** — identifies missing knowledge, evidence, representation or discoverability.
8. **Distribution** — manages legitimate representation distribution.
9. **Relationship Ownership** — manages direct relationships and consent.
10. **Interaction/Action Capability** — supports authorized actions/opportunities.
11. **Measurement & Learning** — evaluates outcomes and generates improvement proposals.

These engines operate over the PAS Authority Record.

---

## XXIV. Authority-Demand Matching

**Demand cannot create authority.**

The matching function asks: *Does this Authority Entity possess supported authority relevant
to this demand?*

**The system must support a negative answer.**

Conceptually useful results include: strongly supported intersection · partially supported
intersection · latent/unrepresented authority · adjacent authority · insufficient evidence ·
no supported authority.

These should not become simplistic public ranking scores.

---

## XXV. Discovery Intelligence

The existing SEO/AI area evolves into **Discovery Intelligence**.

It observes: indexation · search impressions where available · queries · referrals ·
AI citations where observable · AI retrieval/mentions where observable · entity
interpretation · surface discovery · authority-demand coverage · technical discoverability ·
freshness · citation gaps · representation gaps.

The system **records observations**. It does not pretend to know what cannot actually be
measured.

---

## XXVI. Gap taxonomy

PAS adopts:

| ID | Gap |
|---|---|
| G1 | Demand Gap |
| G2 | Knowledge Gap |
| G3 | Evidence Gap |
| G4 | Authority Gap |
| G5 | Technical Discovery Gap |
| G6 | Retrieval Gap |
| G7 | Citation Gap |
| G8 | Engagement Gap |
| G9 | Relationship Gap |
| G10 | Opportunity/Conversion Gap |
| G11 | Outcome Gap |

A gap produces a diagnosis/proposal. **It does not authorize an unsupported claim.**

---

## XXVII. Fellowship

Fellowship remains: **Recognition, not networking.**

Fellowship operates on governed authority. It may identify: shared domains · complementary
expertise · common work · professional intersections · institutional overlap · framework
relationships · collaboration potential · existing verified relationships ·
authority citations · endorsements/vouches.

The current hardcoded `94% PAS Alignment` pattern is replaced by **explainable matching**.

PAS should answer: *Why are these people/organizations meaningfully aligned?*
Not merely: *94%.*

---

## XXVIII. External and internal discovery

"Find your tribe" operates through two pathways.

**External**

```
Demand/query/problem → Discovery system → PAS Authority Surface
  → inspection → relationship → opportunity
```

**Internal**

```
Authority Graphs → Fellowship matching → explained alignment
  → recognition → relationship → collaboration/opportunity
```

These are different discovery mechanisms serving the same ecosystem.

---

## XXIX. Relationships and opportunity

Introduce first-class governed relationship/opportunity concepts.

A relationship may originate from: PAS contact · Fellowship · referral · search ·
AI discovery · institutional inquiry · collaboration · existing relationship.

**Privacy and consent must remain explicit.**

An Opportunity may concern: employment · consulting · speaking · research · partnership ·
funding · implementation · contracting · collaboration · licensing ·
other professional engagement.

PAS does not determine that an opportunity is "good." It records and supports the process.

---

## XXX. Journey

`Journey` remains from the earlier architecture, but **below** Authority Entity.

An Authority Entity can participate in many Journeys.

A Journey connects context such as: Demand · Discovery · Representation · Relationship ·
Action · Outcome.

Example:

```
Demand X → Surface Y discovered → Relationship Z created
  → Opportunity Q → Action → Outcome
```

This provides traceability without making journeys the canonical authority record.

---

## XXXI. Outcomes and attribution

Outcome becomes first-class.

PAS must distinguish **"Outcome occurred"** from **"PAS caused outcome."**

Attribution should carry confidence/evidence. This prevents false causal claims.

---

## XXXII. Learning

Learning does not directly rewrite canonical truth.

Canonical loop:

```
Observe → Analyze → Propose → Authorize → Apply → Measure
```

AI can propose changes. **It cannot silently rewrite professional authority because
analytics changed.**

---

## XXXIII. Event architecture

Material lifecycle changes produce events. Core examples:

`AuthorityEntityCreated` · `SourceConnected` · `SourceIngested` · `ObservationCreated` ·
`ClaimProposed` · `EvidenceAttached` · `ClaimReviewed` · `ClaimApproved` ·
`ExperienceCreated` · `KnowledgeApproved` · `ExpertiseEstablished` · `DomainCreated` ·
`ClusterCreated` · `CompositionGenerated` · `SurfaceApproved` · `RepresentationPublished` ·
`DiscoveryObserved` · `RelationshipCreated` · `OpportunityCreated` · `ActionCompleted` ·
`OutcomeRecorded` · `LearningGenerated` · `AuthorityStaled` · `ClaimRetracted` ·
`RepresentationSuperseded`

Events support audit, workflow and derived systems. **They are not substitutes for
canonical state.**

---

## XXXIV. PAS Core Infrastructure

The previous MBS infrastructure remains canonical:

| Component | Role |
|---|---|
| **PostgreSQL** | Canonical transactional truth. |
| **Object Storage** | Documents, media and source artifacts. |
| **pgvector** (initially) | Semantic retrieval/indexing. Vector representations are derived, never canonical truth. |
| **Graph projection** | Authority relationships may initially reside relationally and be projected for graph operations. Do not prematurely require a separate graph database. |
| **Event Ledger** | Append-only durable event history. |
| **Transactional Outbox** | Canonical mutation and event publication remain atomic. |
| **Event Dispatcher** | Processes durable outbox events. |
| **Workflow Runtime** | Owns long-running governed processes. |
| **Agent Gateway** | Centralizes AI-provider interaction. |
| **Governance Engine** | Controls authorization. |
| **Human Task Queue** | Handles required review/confirmation. |
| **Dependency/Impact Service** | Determines what representations become affected when underlying authority changes. |
| **Audit Service** | Records governed actions. |

This is PAS infrastructure — not another application.

---

## XXXV. Agent architecture

**The LLM never owns workflow state.**

Agent Gateway handles: provider/model routing · prompt versions · structured outputs ·
context assembly · timeouts · retries · cost accounting · tool permissions · logging ·
fallbacks.

Agents return **proposals**. Domain services decide whether proposals become canonical
records. This preserves LLM agnosticism.

---

## XXXVI. Worker classes

PAS workflows use three execution classes:

- **Deterministic Worker** — parsing, validation, transforms, indexing, calculations.
- **Cognitive Worker** — extraction, classification, clustering, synthesis, matching, gap analysis.
- **Human Worker** — verification, approval, conflict resolution, sensitive publication/action.

The workflow orchestrator determines transitions.

---

## XXXVII. Governance gates

Retain the earlier gate architecture:

| Gate | Question |
|---|---|
| **G0 Intake** | May PAS accept/process this source? |
| **G1 Evidence** | Is evidence admissible/usable for its intended purpose? |
| **G2 Authority** | Can the Claim/Knowledge/Expertise conclusion enter the governed Authority Record? |
| **G3 Publication** | Can this representation become public? |
| **G4 Action** | May PAS perform the requested external action? |
| **G5 Learning** | May a proposed learning alter canonical state/configuration? |

Possible decisions: `ALLOW` · `DENY` · `REQUIRE_REVIEW` · `REQUIRE_CONFIRMATION` ·
`ESCALATE`.

---

## XXXVIII. Capability risk

The R0–R5 capability-risk model from the previous MBS remains. Higher-risk capabilities
require stronger authorization and audit.

**Knowledge authority and action authority remain separate.**

A model capable of describing a contract does not thereby gain authority to sign one.

---

## XXXIX. Dependency and impact

Every governed object must support downstream impact analysis.

Example — Evidence `E-102` is invalidated. PAS determines:

- which Claims depended on `E-102`
- which Knowledge/Expertise conclusions depended on those Claims
- which Authority Clusters are affected
- which Dossiers/Surfaces use those records
- which Published Representations contain them
- which structured-data representations contain them

Affected public surfaces can then be: flagged · reviewed · withdrawn · superseded ·
republished.

This is essential for trustworthy living authority.

---

## XL. Canonical object envelope

Governed records should share a standard envelope where appropriate:

Object ID · Object Type · Authority Entity ID · Authority Record ID ·
Journey ID where contextual · Parent/related IDs · Version · Lifecycle state · Owner ·
Created/updated timestamps · Created by · Source references · Governance status ·
Confidence where meaningful · Provenance references · Correlation ID · Visibility.

> Do not force every domain object into one giant generic table merely because the envelope
> is shared.

---

## XLI. Identity and IDs

IDs must be **durable and non-semantic**.

Do not encode `M01`, `d01` or presentation assumptions into authority identity.

Authority survives redesign. Representation IDs and authority IDs remain separate.

---

## XLII. API boundary

The production PAS backend should eventually expose versioned domain APIs, approximately:

```
/api/v1/authority-entities   /authority-records   /sources        /observations
        /claims              /evidence            /experiences    /knowledge
        /know-how            /expertise           /authority-graph
        /domains             /clusters            /compositions   /surfaces
        /representations     /publications        /discovery      /demand
        /fellowship          /relationships       /opportunities  /journeys
        /outcomes            /learning            /governance     /impact
        /system
```

These namespaces express **domain boundaries**, not necessarily separate microservices.

---

## XLIII. Deployment topology

Initial production architecture should remain a **modular monolith**. Do not prematurely
create dozens of distributed services.

Initial target: web application · PAS API · worker process · PostgreSQL/pgvector ·
object storage · workflow/event infrastructure · external AI/model providers through
Agent Gateway.

Subsystems can later separate when actual scale/failure/isolation requirements justify it.

---

## XLIV. Existing Zustand store

`usePASStore.ts` is currently serving simultaneously as: seed database · application state ·
business logic · demo identity · publishing state · graph state · BPAS state ·
Fellowship state · marketplace state · admin metrics.

That is acceptable for the prototype. **It cannot remain the canonical backend.**

During migration:

- Zustand becomes primarily client/UI state and cached server state where appropriate.
- Canonical domain records move server-side.
- Seed/demo fixtures move into explicit fixtures/dev data.
- The frontend should stop pretending seed objects are persisted production truth.

---

## XLV. Existing parser services

### `WebHarvester` — REFACTOR / then ENHANCE

Current behavior is a mock. Production behavior becomes:

```
URL acquisition through authorized/safe retrieval → source artifact
  → content extraction → observations → proposed claims → review/governance
```

**It must never fabricate "harvested" content merely from a hostname.**

### `DocumentParser` — REFACTOR / then ENHANCE

Parsing becomes actual format-specific extraction. Filename regex can remain as a **weak
hint, not evidence**.

### `AgnosticAIEngine` — PRESERVE INTERFACE IDEA / REBUILD IMPLEMENTATION

Provider abstraction is correct. Hardcoded provider results are removed. All providers go
through Agent Gateway. Provider output returns **structured proposals — not authority**.

---

## XLVI. Existing AuthorityObject

**Classification: PRESERVE CONCEPT, REFACTOR RESPONSIBILITY.**

Do not delete it merely because richer types now exist. It can evolve into a
graph-addressable generalized authority node or projection.

But concepts requiring independent lifecycle/governance — Claim, Evidence, Experience,
Knowledge, Expertise, etc. — receive **first-class records**.

`AuthorityObject` must stop being the universal dumping ground for everything PAS knows.

---

## XLVII. Existing modules

**Classification: REFACTOR.**

The eight current modules become a migrated WDJIV/reference composition. They may remain
visible in your PAS.

Universal `CanonicalModuleCode M01–M08` is **retired**. Dynamic composition replaces it.

---

## XLVIII. Existing dossiers

**Classification: PRESERVE EXPERIENCE / REFACTOR DATA OWNERSHIP.**

Keep: title · audience · purpose · access tier · visibility · sections ·
publication behavior.

Change: authority membership belongs to the composition/dossier definition. Authority
objects do not canonically carry dossier back-pointers.

---

## XLIX. Existing Published Personal PAS

**Classification: PRESERVE / ENHANCE.**

Do not rebuild the visual experience simply because the backend changes. Refactor its data
source gradually from seed Zustand data to published server representations.

This reduces unnecessary frontend churn.

---

## L. Existing BPAS

**Classification: PRESERVE / ENHANCE.**

Do not collapse BPAS into Personal PAS. Its current organizational suite becomes backed by
Organization Authority Records and graph relationships. Later BPAS operational objects can
be normalized where necessary.

---

## LI. Existing Fellowship

**Classification: PRESERVE EXPERIENCE / ADD INTELLIGENCE.**

Current visual/product concept survives.

Replace hardcoded alignment percentages with **explainable Authority Alignment records**
derived from actual governed graph intersections.

Endorsements/vouches remain object-specific.

---

## LII. Existing Marketplace / Knowledge Market

**Classification: PRESERVE AS OPTIONAL PAS ECOSYSTEM CAPABILITY.**

It is not the definition of PAS authority. Knowledge products can reference approved
Authority Record material.

**Commercialization cannot create authority retroactively.**

---

## LIII. Existing SEO & AI Schema

**Classification: PRESERVE / EXPAND INTO DISCOVERY INTELLIGENCE.**

JSON-LD remains a **publication adapter**. It does not become canonical truth.

Discovery telemetry and observability are added behind the existing experience.

---

## LIV. Existing design implementation

**Classification: PRESERVE VISUAL BASELINE / ENHANCE SYSTEMIZATION.**

Do not conduct a wholesale UI rewrite during backend migration. Extract repeated styling
progressively into real design tokens/components.

Architecture migration and cosmetic refactoring should not be unnecessarily coupled.

---

## LV. Build Contract

Every production component must pass eight questions:

1. **Identity** — What canonical object/service is this?
2. **Input** — What does it accept?
3. **Output** — What does it produce?
4. **Lineage** — Can we trace its result?
5. **Governance** — Who/what authorizes changes?
6. **Observability** — Can its behavior be inspected?
7. **Continuity** — Can interrupted work resume safely?
8. **Impact** — Can downstream effects be determined?

> If one cannot answer all eight, the component is **not production-complete**.

---

## LVI. Implementation phases

*This is the part implementation should follow.*

### Phase 0 — Freeze and document baseline
No product redesign. Tag/preserve `f23d11a`. Add Master Specification. Add reconciliation
derived from it. Establish architecture decision records.

### Phase 1 — Backend foundation
Repository/server structure · configuration · PostgreSQL · migrations · canonical ID
service · `AuthorityEntity` · `AuthorityRecord` · audit · event ledger ·
transactional outbox. **No AI magic yet.**

### Phase 2 — Core Authority ontology
`SourceRecord` · `Observation` · `Claim` · `Evidence` · `Experience` ·
Authority Graph persistence · versioning/provenance · visibility · governance state.
Migrate seed fixtures without losing current UI.

### Phase 3 — Governance/workflow
Governance Policy Registry · Decision Engine · Workflow Runtime · Human Tasks ·
publication gates · impact/dependency service.

### Phase 4 — Real ingestion
File storage · document ingestion · web-source acquisition · connectors/adapters ·
extraction pipeline · Agent Gateway · provider adapters.
**Everything extracted enters as proposals.**

### Phase 5 — Authority intelligence
Knowledge · Know-How · Expertise · Domain discovery · Cluster discovery · gap interview ·
conflict detection · authority reconstruction.

### Phase 6 — Dynamic composition
Composition definitions · `AuthoritySurface` · Dossier migration · dynamic modules ·
audience/purpose compositions · representation versioning.
**This is where fixed M01–M08/d01–d10 assumptions are finally removed from generalized
runtime behavior.**

### Phase 7 — Publishing
Publication snapshots · public representation API · Personal PAS integration ·
BPAS integration · JSON-LD · canonical URLs · sitemaps · machine representation.

### Phase 8 — Discovery intelligence
Demand objects · query targets · discovery observations · search/AI observatory ·
gap diagnosis · Authority-Demand Matching.

### Phase 9 — Fellowship
Authority Alignment · explainable matching · citations/vouches · recognition workflows ·
relationship formation.

### Phase 10 — Opportunity/outcome/learning
Opportunity · Journey · Action · Outcome · attribution · measurement ·
learning proposals.

### Phase 11 — Hardening
security · privacy · permissions · rate limits · backups · recovery · performance ·
accessibility · testing · observability · deployment/operations.

---

## LVII. Migration rule

Implementation must follow:

```
Expand → Migrate → Verify → Contract
```

**Do not delete prototype fields before replacement functionality exists.**

Example:

1. Add `CompositionDefinition`.
2. Migrate dossier memberships.
3. Verify rendered Personal PAS remains correct.
4. **Only then** deprecate `associatedDossierIds`.

Same with modules. This protects the working baseline.

---

## LVIII. Non-regression requirement

At every phase:

- `tsc` must pass.
- Production build must pass.
- Existing usable screens must continue rendering unless an approved migration explicitly
  replaces them.
- Seed/demo mode should remain available until corresponding production services exist.

This allows us to build **underneath** PAS rather than destroy it while "modernizing."

---

## LIX. Reference fixtures

We need at least three architectural test fixtures.

- **Fixture A — WDJIV Personal PAS.** Tests multidimensional/nontraditional authority and
  preserves the existing reference implementation.
- **Fixture B — Deep Academic/Research Authority.** Tests someone with decades of
  publications, research, credentials, methods and potentially dozens of authority surfaces.
- **Fixture C — Skilled Practitioner/Operator.** Tests substantial Know-How/Experience
  without requiring academic credentials or a huge publication history.

This is specifically how we prevent your PAS from becoming the universal schema.

Later BPAS receives equivalent organizational fixtures.

---

## LX. Canonical invariants

**These are now controlling.**

1. PAS represents authority; it does not manufacture it.
2. Authority Entity is persistent; representations are contextual.
3. Authority Record is canonical; Published PAS is a projection.
4. No universal module, dossier or page count exists.
5. WDJIV's PAS is a reference instance, not the human schema.
6. Experience is first-class.
7. Credentials are evidence of certain authority, not authority's universal definition.
8. Knowledge, Know-How and Expertise are distinct.
9. Source, Observation, Claim and Evidence are distinct.
10. Extraction cannot directly establish public authority.
11. AI confidence is not verification.
12. Source confirmation is not independent verification.
13. Authority objects do not canonically belong to dossiers.
14. Dossiers and Authority Surfaces derive from the Authority Record.
15. Demand cannot manufacture authority.
16. PAS must support "no supported authority."
17. Search/AI systems are discovery channels, not PAS truth authorities.
18. Personal PAS and BPAS share infrastructure without becoming identical products.
19. Fellowship is authority-based recognition, not conventional social networking.
20. Alignment must be explainable.
21. Learning proposes canonical changes; it does not silently make them.
22. Vector/graph/search indexes are derived projections.
23. External platforms are adapters, not architecture dependencies.
24. Every material public claim retains lineage.
25. Every governed change supports downstream impact analysis.
26. Scores assist analysis; governance gates authorize state changes.
27. Knowledge authority and action authority remain separate.
28. Outcomes and attribution remain separate.
29. PAS evolves longitudinally over a professional lifetime.
30. Authority Intelligence is part of PAS, never a competing product.

---

## LXI. Handoff boundary

The first implementation artifact is `docs/RECONCILIATION.md`. It inventories every current
source file and classifies it `PRESERVE` / `ENHANCE` / `REFACTOR` / `ADD/REPLACE`, recording
for each: current responsibility · canonical PAS responsibility · specific conflict, if any ·
migration requirement · dependencies · phase · non-regression requirement.

Then `docs/ARCHITECTURE_DECISIONS.md`, recording the thirty invariants above and major
superseded prototype assumptions.

Then `docs/IMPLEMENTATION_PLAN.md`, mapping actual repository paths to Phases 0–11.

> **No production feature implementation should begin until those three artifacts reconcile
> cleanly with this Master Specification. That is the handoff boundary.**

---

## Consolidated state

We have finished deciding **what PAS is** at the system-architecture level.

- The existing platform remains the working product baseline.
- The Personal PAS remains a **reference implementation**, not the universal structure.
- The eight-module/ten-dossier architecture becomes **your composition**, not everybody's composition.
- The Authority Graph survives and becomes substantially richer.
- The Builder survives, but it **reconstructs authority before composing pages**.
- Personal PAS survives. BPAS survives. Publishing survives. Fellowship survives.
- The Knowledge Market survives as an optional ecosystem capability.
- SEO/AI work survives and expands into Discovery Intelligence.
- The missing production backend is now explicitly defined.
- The earlier Knowledge-to-Demand work has been absorbed into PAS Authority Intelligence.
- The earlier MBS infrastructure has been absorbed into PAS Core Infrastructure.

Nothing remains floating as a separate architecture.

From this point, the work changes from *"What are we building?"* to
*"How does each existing file migrate into what we have now defined?"*
