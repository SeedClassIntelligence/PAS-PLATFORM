# PAS Clean-Sheet Master Build Specification

**Status:** received 2026-09-20. Transcribed verbatim into version control.
**Relationship to `PAS_MASTER_SPECIFICATION.md`:** ⚠️ **UNRESOLVED — see
`docs/SPECIFICATION_RECONCILIATION.md`.** This document and the PAS Master Architecture &
Build Specification v1.0 agree on every canonical invariant but prescribe **different
repository topologies and a different posture toward the existing prototype**. That fork is
an owner decision and has not been resolved by implementation.

This file is the source document, unmodified. Analysis lives in
`SPECIFICATION_RECONCILIATION.md`.

---

PAS Clean-Sheet Master Build Specification
Part I — Repository, Infrastructure, Authority Core, and Governance
0. Controlling execution rules

The coding assistant SHALL:

Build in dependency order.
Treat PostgreSQL as canonical transactional truth.
Treat object storage as canonical storage for source binaries.
Treat vector, graph, search, analytics, and AI-generated indexes as derived projections.
Never permit AI output to become canonical authority solely because a model produced it.
Preserve Source → Observation → Claim → Evidence → Authority lineage.
Keep Authority Record separate from Representation.
Keep Composition separate from Authority.
Keep Personal PAS and BPAS distinct while sharing the authority substrate.
Never introduce a universal module, dossier, domain, cluster, or page count.
Enforce visibility and authorization server-side.
Generate public machine representations only from approved Published Representations.
Use durable workflows for processes that may wait, retry, fail, require human review, or span multiple operations.
Use transactional outbox events for canonical state changes.
Route all model calls through Agent Gateway.
Require explicit governance for governed state transitions.
Preserve version history and auditability.
Implement dependency/impact tracking for governed objects.
Keep domain logic outside React components.
Do not substitute mocks for required production capabilities when a build is declared complete.
1. Repository topology

Create a monorepo.

pas-platform/
│
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
│
├── packages/
│   ├── domain/
│   ├── database/
│   ├── contracts/
│   ├── auth/
│   ├── governance/
│   ├── workflows/
│   ├── events/
│   ├── agent-gateway/
│   ├── ingestion/
│   ├── authority-intelligence/
│   ├── composition/
│   ├── publishing/
│   ├── discovery/
│   ├── fellowship/
│   ├── observability/
│   ├── ui/
│   └── config/
│
├── migrations/
├── fixtures/
├── tests/
│   ├── integration/
│   ├── contract/
│   ├── e2e/
│   └── security/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── api/
│   ├── workflows/
│   └── operations/
│
└── infrastructure/
Application responsibilities

apps/web

Owns browser-facing PAS interfaces.

It SHALL NOT own canonical business rules.

apps/api

Owns synchronous API requests, authentication, authorization and domain-service invocation.

apps/worker

Owns asynchronous workflows, extraction jobs, indexing, AI jobs, publication jobs, discovery processing and scheduled operations.

2. Shared domain envelope

Create a common governed-object contract.

Conceptually:

GovernedObject
    id
    objectType
    authorityEntityId
    authorityRecordId
    version
    lifecycleState
    governanceState
    visibility
    createdAt
    createdBy
    updatedAt
    updatedBy
    correlationId

Not every database table must literally inherit from one table.

The contract standardizes semantics.

Lifecycle

Support at minimum:

DRAFT
EXTRACTED
PENDING_REVIEW
SUPPORTED
CONFLICT
MISSING_EVIDENCE
APPROVED
ACTIVE
STALE
SUPERSEDED
RETIRED
REJECTED

Not every object uses every state.

State machines SHALL specify valid transitions per object type.

3. Canonical identifier service

Create non-semantic durable identifiers.

Do not use:

M01

d01

user names

page slugs

database sequence position

as canonical identity.

Create an ID service capable of producing globally unique identifiers.

Slugs and human-readable codes are attributes.

They are not identity.

4. Database foundation

PostgreSQL SHALL contain canonical state.

Create migration infrastructure before domain tables.

Every migration SHALL:

be version controlled;
be deterministic;
support deployment ordering;
fail safely;
be exercised by CI against a clean database.

Do not allow production application startup to create tables opportunistically.

5. Transaction model

Domain mutations SHALL execute inside explicit database transactions where consistency requires them.

A canonical mutation and its required outbox event SHALL occur within the same transaction.

Example:

BEGIN

UPDATE claim ...

INSERT claim_version ...

INSERT audit_entry ...

INSERT outbox_event ClaimApproved ...

COMMIT

Never:

update claim
commit

attempt event publication later

That creates state/event divergence.

6. Account domain

Create:

accounts
users
account_memberships
sessions
roles
capabilities
role_capabilities
user_capability_overrides

Keep platform user identity distinct from Authority Entity identity.

A user account may manage:

one Personal PAS

multiple organizations

shared organizational Authority Records

or delegated authority.

Therefore:

User ≠ AuthorityEntity.

7. Capability authorization

Authorization SHALL operate through explicit capabilities.

Initial namespace:

authority.entity.create
authority.entity.read
authority.entity.update

authority.record.read
authority.record.read_private
authority.record.update

source.create
source.read
source.delete

claim.create
claim.review
claim.approve

evidence.create
evidence.review
evidence.verify

experience.create
experience.review

composition.create
composition.approve

representation.create
representation.approve

publication.publish
publication.unpublish

fellowship.interact

relationship.manage
opportunity.manage

organization.manage

governance.admin
audit.read
platform.admin

Expand without changing authorization architecture.

8. Authority Entity schema

Create:

authority_entities

Required fields:

id
entity_type
canonical_name
status
owner_account_id
created_at
created_by
updated_at
updated_by

entity_type initially:

PERSON
ORGANIZATION

Create subtype tables:

person_profiles
organization_profiles

Do not fill authority_entities with dozens of nullable person/business-specific columns.

9. Authority Record schema

Create:

authority_records

Required relationship:

AuthorityEntity 1 → 1 active AuthorityRecord

Allow historical/versioning architecture without forcing a single immutable database row forever.

Record:

id
authority_entity_id
status
record_version
created_at
updated_at

Authority Record SHALL NOT contain:

page layout

theme

dossier list

navigation configuration

SEO configuration

publication domain.

Those belong downstream.

10. Source Corpus schema

Create:

source_records
source_artifacts
source_versions
source_permissions
source_processing_runs

source_records identifies logical source.

source_artifacts identifies actual captured artifact.

source_versions supports changing sources.

Example:

Website homepage changes.

Do not overwrite historical evidence.

Store a new source version.

11. Object storage

Source binaries SHALL live in object storage rather than database blobs unless there is a specific exception.

Persist:

storage key

content type

size

hash

upload timestamp

source relationship

retention policy

access classification.

Object retrieval SHALL require authorization.

Private source URLs must not become permanent publicly accessible URLs.

12. Observation schema

Create:

observations
observation_locations
observation_extractions

An Observation requires:

id
authority_record_id
source_artifact_id
source_version_id
content
normalized_content
observation_type
source_location
extraction_method
extractor_identifier
extractor_version
confidence
created_at

source_location should support:

page number

paragraph

spreadsheet cell/range

timestamp

DOM selector

line range

or other source-specific locator.

This creates defensible lineage.

13. Claim schema

Create:

claims
claim_versions
claim_observations
claim_relationships

Claim structure SHALL support:

subject
predicate
object reference OR scalar value
statement
temporal scope
geographical scope
materiality
lifecycle
governance
provenance
visibility

Do not require every Claim to be a plain English sentence.

Maintain structured semantics whenever possible.

14. Evidence schema

Create:

evidence_records
evidence_claim_links
evidence_verifications
evidence_assessments

Evidence-to-Claim relationship must specify:

SUPPORTS
CONTRADICTS
CONTEXTUALIZES

Evidence does not automatically prove a Claim.

Verification remains separate.

15. Provenance schema

Create reusable provenance records rather than storing only a string enum.

provenance_records

Required:

id
state
source_reference
actor_reference
method
timestamp
notes

Canonical states:

VERIFIED
SOURCE_CONFIRMED
USER_CONFIRMED
AI_INFERRED
UNVERIFIED

This allows PAS to preserve not only the provenance label but why that label exists.

16. Verification subsystem

Create:

verification_requirements
verification_attempts
verification_results

Verification method can vary according to object type and materiality.

Possible methods include:

source comparison

document verification

third-party confirmation

credential registry

authorized human review

cross-source corroboration.

Do not hardcode one universal verification process.

17. Experience schema

Create:

experiences
experience_roles
experience_responsibilities
experience_actions
experience_decisions
experience_methods
experience_collaborators
experience_outputs
experience_outcomes
experience_claims
experience_evidence

Do not require every Experience to populate every subordinate structure.

An Experience can be incomplete and progressively reconstructed.

18. Professional work objects

Create first-class domain structures for:

roles
work_records
projects
initiatives
outputs
credentials
frameworks
methodologies
agreements
partnerships
outcomes

Each must be graph-addressable.

Each must be able to reference Claims/Evidence.

Each must support visibility and governance where appropriate.

19. Relationship vocabulary

Create extensible semantic relationship definitions.

Seed with:

founded
authored
created
co_created
implemented
leads
managed
advised
funded
supported
partnered_with
collaborated_with
contributed_to
employed_by
served_on
reviewed
recognized
adopted
cited
formerly_affiliated_with

Do not implement this as a database enum that requires destructive schema changes every time PAS adds a legitimate relationship.

Use governed relationship definitions.

20. Authority Graph persistence

Create:

authority_graph_nodes
authority_graph_edges
relationship_definitions

Graph nodes reference canonical domain objects.

Do not duplicate the complete canonical object into the graph node.

An edge requires:

id
source_node
target_node
relationship_definition
provenance
visibility
confidence if applicable
valid_from
valid_to
supporting_claims
supporting_evidence
21. Event Ledger

Create:

domain_events

Events SHALL be immutable.

Required envelope:

event_id
event_type
aggregate_type
aggregate_id
authority_entity_id
authority_record_id
journey_id nullable
actor
correlation_id
causation_id
payload
schema_version
occurred_at

Never edit an event to change history.

Corrective events may supersede previous information.

22. Transactional Outbox

Create:

outbox_events

Required states:

PENDING
PROCESSING
DELIVERED
FAILED
DEAD_LETTER

Implement retry and idempotency.

Consumers must tolerate duplicate delivery.

23. Audit system

Create:

audit_entries

Audit must record:

actor

action

target

before/after reference where appropriate

authorization result

governance decision

correlation ID

timestamp

origin.

Administrative activity must also be audited.

24. Governance policy registry

Create:

governance_policies
governance_policy_versions
governance_decisions

Policies must be data/version controlled rather than scattered through UI conditionals.

A decision stores:

policy version

inputs

decision

reason

actor/system

timestamp.

25. Human Task Queue

Create:

human_tasks
human_task_assignments
human_task_decisions

Required states:

OPEN
ASSIGNED
WAITING
COMPLETED
CANCELLED
EXPIRED

Tasks may concern:

claim review

evidence review

conflict resolution

verification

publication

privacy

agent proposal

learning proposal.

26. Workflow Runtime

Create:

workflow_definitions
workflow_versions
workflow_instances
workflow_steps
workflow_step_attempts

Workflow execution must be resumable.

Persist state after meaningful transitions.

Do not depend on an in-memory promise chain for long-running PAS workflows.

27. First production workflow

Implement:

SOURCE_INGESTION
SOURCE_RECEIVED
        ↓
VALIDATE
        ↓
STORE_ARTIFACT
        ↓
REGISTER_SOURCE
        ↓
PARSE
        ↓
CREATE_OBSERVATIONS
        ↓
EXTRACT_ASSERTIONS
        ↓
NORMALIZE_CLAIMS
        ↓
LINK_EVIDENCE
        ↓
DETECT_CONFLICTS
        ↓
GOVERNANCE_REVIEW
        ↓
HUMAN_TASKS where required
        ↓
AUTHORITY_RECORD_UPDATE
        ↓
IMPACT_ANALYSIS
        ↓
COMPLETE

Every step emits appropriate events.

28. Agent Gateway contracts

Create:

agent_providers
agent_models
agent_prompt_definitions
agent_prompt_versions
agent_tasks
agent_results
agent_tool_permissions
agent_usage

AgentTask requires:

taskType
inputSchema
outputSchema
contextReferences
authorizedTools
modelPolicy
timeout
retryPolicy
correlationId

AgentResult requires:

structuredOutput
provider
model
promptVersion
usage
latency
warnings
validationResult

Never persist hidden chain-of-thought.

Persist structured results and necessary execution metadata.

29. Authority extraction agent

Implement the first bounded cognitive capability:

AUTHORITY_EXTRACTION

Input:

authorized source observations.

Output:

proposed structured assertions.

The extractor SHALL NOT output:

VERIFIED

or:

PUBLISH_READY

as self-authorized states.

Its results enter Claim processing.

30. Conflict detection

Create:

conflicts
conflict_members
conflict_resolutions

Detect cases such as:

different employment dates

different titles

contradictory project outcomes

conflicting credential status

different ownership/authorship assertions.

Do not silently select whichever statement has the highest AI confidence.

31. Knowledge Registry schema

Create:

knowledge_records
knowledge_claim_links
knowledge_evidence_links
knowledge_relationships

Knowledge types must be extensible.

Every governed Knowledge Record requires an explainable basis.

32. Know-How Registry schema

Create:

knowhow_records
knowhow_procedures
knowhow_decision_rules
knowhow_exceptions
knowhow_failure_modes
knowhow_experience_links
knowhow_evidence_links

Do not collapse this into Knowledge.

33. Expertise Registry schema

Create:

expertise_records
expertise_basis
expertise_validations

expertise_basis may reference:

Knowledge
Know-How
Experience
Project
Framework
Methodology
Credential
Output
Outcome
Evidence
Recognition.

Expertise APIs must return an explanation graph.

34. Gap Interview data model

Create:

gap_assessments
gap_questions
gap_responses
gap_followups

Each question records:

why it was generated

which Authority Record gap prompted it

what object(s) it concerns

what evidence would resolve it.

Responses become new source material.

They do not bypass Claims/Evidence.

35. Domain Discovery

Create:

authority_domains
domain_memberships
domain_proposals

Domain proposals record:

basis

related objects

model/process that proposed them

confidence

human/governance decision.

No fixed domain taxonomy is required.

36. Authority Clusters

Create:

authority_clusters
cluster_memberships
cluster_relationships
cluster_proposals

Membership must point to canonical objects.

Do not copy their content into the cluster.

37. Composition model

Create:

composition_definitions
composition_versions
composition_rules
composition_memberships

Composition inputs include:

authority

audience

purpose

privacy

significance

evidence density

owner objectives.

Composition output determines presentation.

It does not modify canonical authority.

38. Authority Surface model

Create:

authority_surfaces
authority_surface_versions
surface_sections
surface_memberships

Surface types remain extensible.

Do not encode one navigation architecture into the database.

39. Dossier model

Create:

dossiers
dossier_versions
dossier_sections
dossier_memberships

Membership points from Dossier toward Authority Record objects.

There SHALL be no required reverse canonical associatedDossierIds field on authority objects.

40. Representation model

Create:

representations
representation_versions
representation_components
representation_authority_links

A Representation is an assembled presentation artifact derived from governed Authority Record material.

It records exact source versions.

41. Publication substrate

Create:

publication_candidates
publication_approvals
publications
publication_snapshots
published_representations
domains
domain_mappings

Only material copied/projected into published_representations becomes eligible for public delivery.

This creates the hard boundary:

PRIVATE AUTHORITY RECORD
        │
        X
        │
PUBLIC DELIVERY

versus:

APPROVED AUTHORITY
        ↓
REPRESENTATION
        ↓
PUBLICATION APPROVAL
        ↓
PUBLISHED REPRESENTATION
        ↓
PUBLIC DELIVERY
42. Public API

Build public endpoints exclusively over Published Representations.

Never expose internal Authority Record repository methods through public controllers.

Public endpoints should support:

PAS identity

surfaces

published dossiers

approved evidence references

public graph relationships

machine representations.

43. JSON-LD service

Input:

PublishedRepresentation

not:

AuthorityRecord.

Generate appropriate Schema.org graphs.

Generation must be deterministic for a specific Published Representation version.

Store generation version and source representation version.

44. Sitemap/indexing system

Generate sitemap entries from active Published Representations.

Unpublishing a representation must remove it from subsequent sitemap generations and indexing queues.

Private canonical records never participate.

45. Personal PAS application

Build Personal PAS from the public representation API.

Required capabilities:

dynamic home

dynamic navigation

Domains

Clusters

Experiences

Projects

Frameworks

Expertise

Knowledge/Know-How where appropriate

Credentials

Evidence inspection

Outcomes

Dossiers

relationships/recognition

contact/opportunity entry points.

The UI renders what exists.

It does not expect eight modules.

46. BPAS application

Use Organization Authority Entity.

Required domains include:

organizational identity

team

capabilities

programs

projects

frameworks

agreements

partnerships

operations

outputs

outcomes

evidence.

Authorized Personal PAS relationships can establish team capability.

47. Demand schema

Create:

demand_objects
demand_observations
demand_relationships
demand_trends

Demand is observational/intelligence data.

It cannot modify Authority Records directly.

48. Discovery schema

Create:

discovery_observations
discovery_sources
discovery_queries
discovery_citations
discovery_referrals

Every observation records what PAS actually knows versus what PAS infers.

49. Authority-Demand Match

Create:

authority_demand_matches
authority_demand_match_basis

A match stores its basis.

Do not store only a percentage.

The system must explain:

which Knowledge

which Know-How

which Expertise

which Experiences

which Evidence

support the match.

50. Gap Registry

Create:

authority_gaps

Support:

G1 DEMAND
G2 KNOWLEDGE
G3 EVIDENCE
G4 AUTHORITY
G5 TECHNICAL_DISCOVERY
G6 RETRIEVAL
G7 CITATION
G8 ENGAGEMENT
G9 RELATIONSHIP
G10 OPPORTUNITY
G11 OUTCOME

Each gap has:

basis

severity/priority where useful

affected objects

recommended response

status

resolution.

51. Fellowship architecture

Create:

fellowship_alignments
alignment_basis
recognitions
endorsements
citations
vouches
professional_reviews
adoptions

Alignment is derived from Authority Graph information.

Every alignment response must return its basis.

No unsupported 94% alignment mechanism.

52. Relationship architecture

Create:

professional_relationships
relationship_participants
relationship_interactions
relationship_consents

Private relationship information must never leak into public Authority Graph data.

53. Opportunity architecture

Create:

opportunities
opportunity_participants
opportunity_authority_links
opportunity_events

Support extensible opportunity types.

Maintain source:

Fellowship

search

AI discovery

referral

direct inquiry

existing relationship

other.

54. Journey architecture

Create:

journeys
journey_participants
journey_events

Journey connects contextual activity.

It does not own Authority Records.

Objects can participate in many journeys.

55. Outcome architecture

Create:

outcomes
outcome_evidence
outcome_attributions

Separate:

Outcome

from:

Attribution.

Store attribution confidence and supporting basis.

56. Learning architecture

Create:

learning_observations
learning_proposals
learning_decisions

A Learning Proposal may suggest a canonical change.

It enters governance.

Never:

analytics result
→ automatic canonical mutation

Use:

analytics result
→ LearningProposal
→ governance
→ authorized mutation
57. Dependency Graph

Create a generalized dependency system:

object_dependencies

Represent:

upstream_object
downstream_object
dependency_type
materiality
created_at

Examples:

Evidence → Claim

Claim → Expertise

Expertise → Cluster

Cluster → Surface

Surface → Representation

Representation → Publication.

58. Impact Analysis Service

Given any changed object:

Traverse downstream dependencies.
Identify affected canonical conclusions.
Identify affected Representations.
Identify affected Published Representations.
Determine required governance actions.
Generate impact report.
Create review tasks where required.

This is required for living authority.

59. Search and semantic retrieval

Create derived indexes from authorized canonical records.

Use PostgreSQL full-text capabilities and pgvector initially.

Indexing workers consume events.

Indexes must support rebuilding from canonical state.

Private/public indexes remain access-aware.

Do not treat embeddings as facts.

60. Frontend authenticated workspace

Create top-level environments:

Authority Workspace
Representation Studio
Publishing Center
Discovery Center
Fellowship
Relationships & Opportunities
BPAS Workspace
Administration
Authority Workspace

Sources
Record
Experiences
Claims/Evidence
Knowledge
Know-How
Expertise
Graph
Domains
Clusters
Gap Interview.

Representation Studio

Compositions
Surfaces
Dossiers
Design
Preview.

Publishing Center

Representations
Approvals
Versions
Domains
Machine Representation.

Discovery Center

Demand
Search Discovery
AI Discovery
Authority-Demand Coverage
Gaps.

61. Design system

Create tokens first.

Then primitives.

Then PAS-specific components.

Required PAS-specific visual semantics include:

ProvenanceBadge

VerificationBadge

VisibilityBadge

LifecycleBadge

EvidenceDrawer

ClaimInspector

AuthorityCard

AuthorityGraphNode

DomainCard

ClusterCard

ImpactWarning

GovernanceDecision

PublicationState.

Accessibility must be part of component acceptance, not a later cosmetic pass.

62. Required reference fixtures

Maintain four canonical test fixtures.

Fixture P1 — Multidimensional operator

Complex professional history, frameworks, organizations, implementation and nontraditional authority.

Fixture P2 — Deep academic

Decades of research, publications, teaching, credentials and specialization.

Fixture P3 — Skilled practitioner

Strong practical Know-How and Experience with limited formal credentials.

Fixture O1 — Organization

Team, capabilities, programs, agreements, operations, evidence and outcomes.

No fixture defines universal PAS structure.

63. Mandatory end-to-end test A — Authority construction

Test:

Authority Entity
→ Source
→ Artifact
→ Observation
→ Claim
→ Evidence
→ Experience
→ Knowledge
→ Know-How
→ Expertise
→ Graph
→ Domain
→ Cluster

Every transition must retain lineage.

64. Mandatory end-to-end test B — Publication

Test:

Authority Record
→ Composition
→ Surface
→ Representation
→ Governance Approval
→ Publication
→ Published Representation
→ Public API
→ JSON-LD

Inject private records into the Authority Record.

Assert they never appear publicly.

65. Mandatory end-to-end test C — Find Your Tribe

Test:

Authority Entity A
+
Authority Entity B
↓
Authority Graph analysis
↓
Alignment
↓
Explainable basis
↓
Recognition
↓
Relationship
↓
Opportunity

No alignment may exist without inspectable basis.

66. Mandatory end-to-end test D — Demand discovery

Test:

DemandObserved
↓
Authority-Demand Matching
↓
Supported Authority
↓
Published Surface
↓
DiscoveryObservation
↓
Relationship
↓
Opportunity
↓
Outcome

Also test:

DemandObserved
↓
NO_SUPPORTED_AUTHORITY

PAS must not manufacture the missing expertise.

67. Mandatory end-to-end test E — Retraction

Start with:

Evidence
→ Claim
→ Expertise
→ Cluster
→ Surface
→ Published Representation

Invalidate the Evidence.

Expected:

EvidenceChanged
↓
Impact Analysis
↓
Claim flagged
↓
Expertise impacted
↓
Representation impacted
↓
Human/Governance task
↓
Published material reviewed, superseded or withdrawn

This validates PAS as a living authority system.

68. Mandatory security test

Create:

one public record

one private Experience

one gated Dossier

one internal Evidence Record.

Attempt retrieval through:

public PAS

public API

JSON-LD

sitemap

search index

Fellowship

Discovery

Agent Gateway context.

Only explicitly authorized information may appear.

Failure of this test blocks release.

69. Build acceptance rule

Every build unit SHALL provide:

BUILD ID
PURPOSE
DEPENDENCIES
DOMAIN OBJECTS
DATABASE CHANGES
SERVICE CONTRACTS
API CONTRACTS
EVENTS
WORKFLOWS
GOVERNANCE
AUTHORIZATION
OBSERVABILITY
FAILURE BEHAVIOR
TESTS
ACCEPTANCE CRITERIA

A coding assistant may not mark a build complete because:

the screen renders

the endpoint responds

the TypeScript compiler passes

or mock data appears correctly.

Completion requires the entire Build Contract.

70. Execution ordering

The complete dependency order is now:

ENGINEERING FOUNDATION
        ↓
IDENTITY / AUTHORIZATION
        ↓
AUTHORITY ENTITY
        ↓
AUTHORITY RECORD
        ↓
SOURCE CORPUS
        ↓
OBSERVATIONS
        ↓
CLAIMS
        ↓
EVIDENCE
        ↓
PROVENANCE / VERIFICATION
        ↓
GOVERNANCE
        ↓
WORKFLOWS / EVENTS / HUMAN TASKS
        ↓
EXPERIENCE + PROFESSIONAL WORK OBJECTS
        ↓
AUTHORITY GRAPH
        ↓
AGENT GATEWAY
        ↓
REAL INGESTION
        ↓
GAP INTERVIEW
        ↓
KNOWLEDGE
        ↓
KNOW-HOW
        ↓
EXPERTISE
        ↓
DOMAINS
        ↓
CLUSTERS
        ↓
COMPOSITION
        ↓
AUTHORITY SURFACES / DOSSIERS
        ↓
REPRESENTATIONS
        ↓
PERSONAL PAS + BPAS
        ↓
PUBLICATION SUBSTRATE
        ↓
MACHINE REPRESENTATION
        ↓
DEMAND INTELLIGENCE
        ↓
DISCOVERY INTELLIGENCE
        ↓
AUTHORITY-DEMAND MATCHING
        ↓
FELLOWSHIP
        ↓
RELATIONSHIPS
        ↓
OPPORTUNITIES
        ↓
JOURNEYS
        ↓
OUTCOMES / ATTRIBUTION
        ↓
LEARNING
        ↓
CONTINUOUS IMPACT / RECONSTRUCTION

That is the construction dependency graph for the complete PAS.

The critical distinction is that we are no longer giving a coding assistant a product description and expecting it to figure out how to build PAS. We are defining the actual construction system: canonical objects, storage boundaries, governance boundaries, workflows, relationships, publication boundary, intelligence layer, network layer, reverse lineage, tests and release gates.

The next decomposition is mechanical rather than architectural: Build 00 becomes PAS-0001, PAS-0002, PAS-0003... with exact file paths, database migrations, TypeScript interfaces, endpoints, event payloads, test files and Definition of Done; then Build 01, then Build 02, sequentially through the platform. That is the level at which Claude Code can execute one ticket at a time without deciding PAS architecture for itself.

---

PAS Clean-Sheet Master Build Specification
Part II — Executable Build Tickets

This section converts the architecture into ordered coding-assistant work units. The coding assistant executes these sequentially. Each ticket has a defined dependency and completion gate.

No later ticket may compensate for an incomplete earlier contract.

BUILD 00 — Engineering Foundation
PAS-0001 — Initialize Production Monorepo
Purpose

Establish the permanent repository structure for the complete PAS platform.

Create
pas-platform/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   └── tests/
│   ├── api/
│   │   ├── src/
│   │   └── tests/
│   └── worker/
│       ├── src/
│       └── tests/
│
├── packages/
│   ├── domain/
│   ├── database/
│   ├── contracts/
│   ├── auth/
│   ├── governance/
│   ├── workflows/
│   ├── events/
│   ├── agent-gateway/
│   ├── ingestion/
│   ├── authority-intelligence/
│   ├── composition/
│   ├── publishing/
│   ├── discovery/
│   ├── fellowship/
│   ├── observability/
│   ├── ui/
│   └── config/
│
├── migrations/
├── fixtures/
├── tests/
│   ├── integration/
│   ├── contract/
│   ├── e2e/
│   └── security/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── api/
│   ├── workflows/
│   └── operations/
│
└── infrastructure/
Required architectural dependency direction
web ──────────────→ contracts / ui
api ──────────────→ domain / contracts / auth
worker ───────────→ domain / workflows / events

domain ───────────→ contracts
governance ───────→ domain / contracts
workflows ────────→ domain / governance / events
ingestion ────────→ domain / workflows / agent-gateway
composition ──────→ domain
publishing ───────→ composition / domain / governance
discovery ────────→ publishing / domain
fellowship ───────→ domain / authority-intelligence

The web application SHALL NOT become a dependency of domain packages.

Acceptance

Fresh clone supports:

install
typecheck
lint
test
build

No circular package dependencies.

PAS-0002 — Environment Configuration

Create centralized configuration under:

packages/config/

Support:

development
test
staging
production

Configuration must validate on application startup.

Required configuration categories:

DATABASE
OBJECT_STORAGE
SESSION
AUTHENTICATION
ENCRYPTION
PUBLIC_URL
API_URL
WORKER
AGENT_PROVIDERS
OBSERVABILITY
EMAIL/NOTIFICATION
RATE_LIMITING

Secrets SHALL NOT be committed.

Applications must fail startup when required production configuration is invalid.

PAS-0003 — Shared Error Contract

Create structured application errors.

Required families:

ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
GovernanceError
WorkflowError
ExternalServiceError
RateLimitError
InternalError

Error responses require:

code
message
correlationId
details when safe

Never expose stack traces or secrets through production APIs.

PAS-0004 — Correlation Context

Every request, workflow, worker operation, event and agent task receives:

correlationId

Where one operation causes another, also support:

causationId

This identity follows the operation across API, database, workflow, events and workers.

PAS-0005 — Health and Readiness

Create:

GET /health
GET /ready

/health indicates process health.

/ready validates required dependencies such as database connectivity.

Do not expose sensitive infrastructure details publicly.

PAS-0006 — CI Pipeline

CI SHALL execute:

install
typecheck
lint
unit tests
integration tests
production build
migration validation

No merge/deployment is considered successful when these fail.

BUILD 01 — Database Foundation
PAS-0101 — PostgreSQL Connection Layer

Create:

packages/database/

Centralize:

connection pooling
transactions
migration access
query instrumentation
database health.

Application code must not independently create arbitrary database connections.

PAS-0102 — Migration System

Create deterministic migrations.

Required metadata:

migration identifier
migration name
applied timestamp
checksum/version where supported

Test:

empty database
→ migrate
→ application starts
PAS-0103 — Canonical ID Service

Create:

packages/domain/src/identity/

Expose:

generateId()

IDs must be durable and non-semantic.

Do not encode:

entity type
module
dossier
page
owner name
sequence meaning.

PAS-0104 — Canonical Timestamps

Store canonical timestamps in UTC.

Domain contracts SHALL distinguish when necessary:

createdAt
updatedAt
occurredAt
validFrom
validTo
publishedAt
observedAt

Do not overload createdAt to represent real-world occurrence.

BUILD 02 — Accounts, Authentication and Authorization
PAS-0201 — Account Schema

Create:

accounts
users
account_memberships

Account membership supports multiple users managing shared organizational authority.

PAS-0202 — Authentication

Implement secure authentication/session infrastructure.

Create:

sessions
authentication_events

Authentication and Authority Entity identity remain separate.

PAS-0203 — Capability Registry

Create:

capabilities
roles
role_capabilities
membership_roles
capability_overrides

Seed the canonical capability namespace established in the Master Build Specification.

PAS-0204 — Authorization Service

Create:

authorize(actor, capability, resourceContext)

All protected server operations must call this service or an equivalent centralized enforcement mechanism.

Return explicit:

ALLOW
DENY

with internal reason information for audit.

PAS-0205 — Authorization Security Tests

Test:

anonymous user

authenticated owner

authorized collaborator

unauthorized user

organization administrator

platform administrator.

Verify that frontend behavior is irrelevant to server authorization.

BUILD 03 — Audit and Event Infrastructure
PAS-0301 — Audit Ledger

Create:

audit_entries

Required fields:

id
actorType
actorId
action
targetType
targetId
authorityEntityId nullable
correlationId
metadata
occurredAt

Sensitive values must be redacted appropriately.

PAS-0302 — Domain Event Envelope

Create shared event contract:

eventId
eventType
schemaVersion
aggregateType
aggregateId
authorityEntityId
authorityRecordId
actor
correlationId
causationId
payload
occurredAt
PAS-0303 — Event Ledger

Create immutable:

domain_events

Application code may append.

Application code may not edit historical events.

PAS-0304 — Transactional Outbox

Create:

outbox_events

States:

PENDING
PROCESSING
DELIVERED
FAILED
DEAD_LETTER

Implement:

claiming

retry

backoff

idempotency

failure metadata.

PAS-0305 — Event Dispatcher

Worker polls/receives pending outbox records and dispatches to registered consumers.

Successful delivery updates outbox delivery state.

Failed delivery does not alter canonical domain state.

BUILD 04 — Authority Entity
PAS-0401 — Authority Entity Contract

Create:

packages/domain/src/authority/entity/

Contract:

AuthorityEntity {
  id
  entityType
  canonicalName
  status
  ownerAccountId
  createdAt
  createdBy
  updatedAt
  updatedBy
}

Initial:

PERSON
ORGANIZATION
PAS-0402 — Authority Entity Persistence

Create:

authority_entities
person_profiles
organization_profiles

Subtype information stays outside the root table.

PAS-0403 — Authority Entity Repository

Required operations:

create
getById
update
listForAccount
exists

Repository methods must enforce caller/service-level visibility architecture rather than encouraging arbitrary table access.

PAS-0404 — Authority Entity Service

Create service responsible for:

validation

authorization

persistence

audit

event creation.

Emit:

AuthorityEntityCreated
AuthorityEntityUpdated
PAS-0405 — Authority Entity API

Create versioned routes:

POST /api/v1/authority-entities
GET /api/v1/authority-entities/:id
PATCH /api/v1/authority-entities/:id
GET /api/v1/authority-entities
PAS-0406 — Authority Entity Tests

Test both PERSON and ORGANIZATION.

Verify that deleting/changing a public page does not alter Authority Entity identity.

BUILD 05 — Authority Record
PAS-0501 — Authority Record Contract

Create:

AuthorityRecord {
  id
  authorityEntityId
  status
  version
  createdAt
  updatedAt
}
PAS-0502 — Persistence

Create:

authority_records
authority_record_versions

Authority Entity creation SHALL create or initialize the corresponding Authority Record according to service policy.

PAS-0503 — Authority Record Service

Responsibilities:

retrieve canonical record

authorize access

provide record context

coordinate governed record changes

expose version metadata.

PAS-0504 — Private Record Boundary

Implement visibility architecture before adding substantive private records.

Visibility states:

PUBLIC
PRIVATE
GATED
DIRECT_LINK
INTERNAL_GRAPH_ONLY

Visibility is not merely a frontend display preference.

Repository/service query paths must enforce access.

PAS-0505 — Privacy Regression Test

Create a private test object.

Assert an unauthorized caller cannot retrieve it through Authority Record APIs.

This test remains permanently in the security suite.

BUILD 06 — Source Corpus
PAS-0601 — Source Type Registry

Create extensible source definitions.

Initial types:

FILE
WEB_PAGE
WEBSITE
MANUAL_STATEMENT
CONNECTED_SERVICE
PUBLIC_RECORD
AUDIO
VIDEO
IMAGE
SPREADSHEET
OTHER
PAS-0602 — SourceRecord

Create:

source_records

Fields include:

id
authorityRecordId
sourceType
title
origin
owner
status
visibility
createdAt
createdBy
PAS-0603 — SourceArtifact

Create:

source_artifacts

Track:

sourceRecordId
storageKey
mimeType
size
hash
capturedAt
version
PAS-0604 — Object Storage Adapter

Create storage abstraction.

Required operations:

put
getAuthorized
delete according to retention policy
metadata
exists

Domain services do not depend directly on a particular cloud storage vendor.

PAS-0605 — Source Versioning

Create:

source_versions

A changed website/document creates a new version.

Never silently replace source history relied upon by Claims.

PAS-0606 — Source API

Create:

POST /api/v1/sources
GET /api/v1/sources/:id
GET /api/v1/sources
POST /api/v1/sources/:id/versions

File upload transport may use dedicated upload endpoints/presigned mechanisms as appropriate.

PAS-0607 — Source Events

Emit:

SourceCreated
SourceArtifactStored
SourceVersionCreated
SourceIngested
BUILD 07 — Observation Layer
PAS-0701 — Observation Contract

Create:

Observation {
  id
  authorityRecordId
  sourceRecordId
  sourceArtifactId
  sourceVersionId
  observationType
  content
  normalizedContent
  sourceLocation
  extractionMethod
  extractorIdentifier
  extractorVersion
  confidence
  createdAt
}
PAS-0702 — Source Locator

Implement source-specific locators capable of representing:

PDF page

document paragraph

line range

audio/video timestamp

spreadsheet range

HTML selector/location

image region where applicable.

PAS-0703 — Observation Persistence

Create:

observations
observation_locations
observation_extractions
PAS-0704 — Observation Service

Observation creation requires an existing Source/Artifact.

An Observation cannot independently establish Authority.

PAS-0705 — Observation API

Internal/authenticated:

GET /api/v1/observations/:id
GET /api/v1/sources/:id/observations

Creation normally occurs through ingestion workflows but must have a service contract independent of the workflow.

BUILD 08 — Claims
PAS-0801 — Claim Contract

Implement structured Claims.

Required fields include:

id
authorityRecordId
subjectRef
predicate
objectRef nullable
scalarValue nullable
statement
temporalScope
geographicalScope
materiality
lifecycleState
governanceState
visibility
version
PAS-0802 — Claim Versioning

Create:

claims
claim_versions

Material Claim changes create versions.

Do not overwrite historical approved Claim content without lineage.

PAS-0803 — Observation-to-Claim Links

Create:

claim_observations

One Observation may support multiple candidate Claims.

One Claim may derive from multiple Observations.

PAS-0804 — Claim Lifecycle

Implement legal transitions:

DRAFT
→ EXTRACTED
→ PENDING_REVIEW
→ SUPPORTED / CONFLICT / MISSING_EVIDENCE
→ APPROVED
→ ACTIVE
→ STALE / SUPERSEDED / RETIRED

Allow:

REJECTED

where appropriate.

Invalid transitions must fail at domain level.

PAS-0805 — Claim API

Create:

GET /api/v1/claims
GET /api/v1/claims/:id
POST /api/v1/claims
POST /api/v1/claims/:id/review

Approval will later invoke Governance Engine rather than a simple boolean.

BUILD 09 — Evidence
PAS-0901 — Evidence Contract

Create first-class Evidence.

Required attributes:

id
authorityRecordId
sourceRecordId
sourceArtifactId
evidenceType
originator
date
classification
reliabilityMetadata
verificationState
visibility
PAS-0902 — Claim-Evidence Link

Create:

evidence_claim_links

Relationship:

SUPPORTS
CONTRADICTS
CONTEXTUALIZES

Include explanatory metadata.

PAS-0903 — Evidence Assessment

Create:

evidence_assessments

Assessment does not rewrite source evidence.

It records interpretation/evaluation separately.

PAS-0904 — Evidence API

Create:

GET /api/v1/evidence
GET /api/v1/evidence/:id
POST /api/v1/evidence
POST /api/v1/claims/:id/evidence
BUILD 10 — Provenance and Verification
PAS-1001 — ProvenanceRecord

Create:

provenance_records

States:

VERIFIED
SOURCE_CONFIRMED
USER_CONFIRMED
AI_INFERRED
UNVERIFIED

Record:

method
sourceReference
actorReference
timestamp
notes
PAS-1002 — Verification Requirements

Create:

verification_requirements

Requirements may vary by:

object type

claim type

materiality

publication context

governance policy.

PAS-1003 — Verification Attempts

Create:

verification_attempts
verification_results

Preserve unsuccessful attempts.

Do not convert failed verification into absence of history.

PAS-1004 — Verification Invariant Tests

Explicitly test:

AI_INFERRED != VERIFIED
SOURCE_CONFIRMED != VERIFIED
USER_CONFIRMED != VERIFIED
confidence 0.99 != VERIFIED
BUILD 11 — Governance
PAS-1101 — Governance Policy Registry

Create:

governance_policies
governance_policy_versions

Policies include:

target operation

conditions

required evidence

required authorization

required review

result.

PAS-1102 — Governance Decision

Create:

governance_decisions

Decision values:

ALLOW
DENY
REQUIRE_REVIEW
REQUIRE_CONFIRMATION
ESCALATE
PAS-1103 — Governance Engine

Create:

evaluateGovernance(operation, actor, object, context)

Return structured decision and applicable policy version.

PAS-1104 — Governance Audit

Every governed state change stores the decision responsible for authorizing it.

BUILD 12 — Human Tasks
PAS-1201 — HumanTask

Create:

human_tasks
human_task_assignments
human_task_decisions

Task types include:

CLAIM_REVIEW
EVIDENCE_REVIEW
VERIFICATION
CONFLICT_RESOLUTION
PUBLICATION_REVIEW
PRIVACY_REVIEW
AGENT_PROPOSAL_REVIEW
LEARNING_PROPOSAL_REVIEW
PAS-1202 — Human Task API

Create:

GET /api/v1/tasks
GET /api/v1/tasks/:id
POST /api/v1/tasks/:id/claim
POST /api/v1/tasks/:id/complete

Authorization determines who can act.

BUILD 13 — Workflow Runtime
PAS-1301 — Workflow Definition

Create versioned:

workflow_definitions
workflow_versions
PAS-1302 — Workflow Instance

Create:

workflow_instances
workflow_steps
workflow_step_attempts

Required execution states:

PENDING
RUNNING
WAITING
COMPLETED
FAILED
CANCELLED
COMPENSATING
PAS-1303 — Idempotency

Every externally retryable workflow operation must have an idempotency strategy.

The same Source ingestion request cannot create duplicate canonical authority merely because a worker retried.

PAS-1304 — Human Wait State

A workflow must be able to enter:

WAITING

for HumanTask completion and resume afterward.

No worker remains alive waiting synchronously for a human.

BUILD 14 — Experience and Professional Work
PAS-1401 — ExperienceRecord

Implement first-class Experience.

Core:

experiences

Supporting structures:

experience_roles
experience_responsibilities
experience_actions
experience_decisions
experience_methods
experience_collaborators
experience_outputs
experience_outcomes
PAS-1402 — Experience Linkage

Link Experience to:

Claims

Evidence

Projects

Roles

Organizations

Knowledge

Know-How

Outcomes.

Some of these target types become available in subsequent builds; relationship contracts should permit progressive attachment.

PAS-1403 — Role

Create:

roles

Role is not equivalent to Experience.

One Role may contain multiple Experiences.

PAS-1404 — Work

Create:

work_records

Work represents substantive professional work not adequately modeled solely as employment.

PAS-1405 — Project

Create:

projects

Support:

scope

participants

time

responsibilities

outputs

outcomes

evidence.

PAS-1406 — Initiative

Create:

initiatives

Keep initiatives distinguishable from finite projects.

PAS-1407 — Output

Create:

outputs

Examples include:

publication

system

product

report

program

design

policy

software

research output

creative work.

Types remain extensible.

PAS-1408 — Framework

Create:

frameworks

Track authorship/creation separately through graph relationships and Claims.

PAS-1409 — Methodology

Create:

methodologies

Methodology is not automatically a Framework alias.

PAS-1410 — Credential

Create:

credentials

Store issuer, issuance, validity and verification independently.

Possessing a Credential does not automatically generate Expertise.

BUILD 15 — Authority Graph
PAS-1501 — Relationship Definition Registry

Create:

relationship_definitions

Seed the canonical initial relationship vocabulary.

Definitions are extensible without database schema alteration.

PAS-1502 — Graph Nodes

Create:

authority_graph_nodes

Node points to:

objectType
objectId
authorityRecordId

Do not duplicate canonical domain state into the node.

PAS-1503 — Graph Edges

Create:

authority_graph_edges

Required:

sourceNodeId
targetNodeId
relationshipDefinitionId
provenanceId
visibility
confidence nullable
validFrom
validTo
PAS-1504 — Supporting Basis

Create edge associations with:

Claims

Evidence

Sources.

The system must be able to explain why a relationship exists.

PAS-1505 — Graph Query Service

Support:

neighbors

incoming relationships

outgoing relationships

typed traversal

bounded-depth traversal

supporting basis.

Do not introduce a separate graph database yet.

BUILD 16 — Agent Gateway
PAS-1601 — Provider Contract

Create a provider-neutral interface.

Application code may request:

executeAgentTask(task)

It may not call provider SDKs directly.

PAS-1602 — Model Registry

Create:

agent_providers
agent_models

Store capability/configuration metadata.

PAS-1603 — Prompt Registry

Create:

agent_prompt_definitions
agent_prompt_versions

Every production model invocation references a prompt version.

PAS-1604 — Structured Output

Every cognitive operation defines a validated output schema.

Invalid model output does not become domain data.

PAS-1605 — Agent Permissions

Create:

agent_tool_permissions

Agent tasks receive only explicitly authorized tools and context.

PAS-1606 — Agent Telemetry

Record:

provider

model

prompt version

latency

token/usage information where available

cost information where available

validation status

retry/failure.

BUILD 17 — Production Ingestion
PAS-1701 — File Parser Registry

Implement parser adapters by supported format.

Do not infer credential/work type merely from filename.

Filename may be weak metadata only.

PAS-1702 — Web Acquisition

Implement actual authorized web retrieval.

Capture acquired content as SourceArtifact/SourceVersion.

Never fabricate professional information from the hostname.

PAS-1703 — Observation Extraction

Parsers produce Observations.

They do not produce verified authority.

PAS-1704 — Authority Extraction

Agent consumes authorized Observations.

Returns structured candidate assertions.

Persist as extraction proposals.

PAS-1705 — Claim Normalization

Normalize candidate assertions into Proposed Claims.

PAS-1706 — Evidence Association

Associate supporting/contradicting Evidence where the record supports it.

PAS-1707 — Conflict Detection

Detect contradictions before Claim approval.

Create Conflict records rather than silently selecting a winner.

PAS-1708 — Complete Ingestion Workflow

Activate:

Source
→ Artifact
→ Parse
→ Observation
→ Extraction
→ Proposed Claim
→ Evidence
→ Conflict Detection
→ Governance
→ Human Review where required
→ Authority Record

This is the first major vertical slice of PAS.

BUILD 18 — Authority Reconstruction
PAS-1801 — Gap Assessment

Create:

gap_assessments

Analyze Authority Record incompleteness.

PAS-1802 — Gap Question

Create questions linked to specific unresolved record structures.

Each question records:

reason

target

missing information

possible evidence requirement.

PAS-1803 — Gap Response

Store responses as source material.

Required path:

Gap Response
→ SourceRecord
→ Observation
→ Claim
→ normal governance
BUILD 19 — Knowledge
PAS-1901 — KnowledgeRecord

Create first-class Knowledge.

Required relationships:

Claims

Evidence

Experiences

Work

Projects

Domains.

PAS-1902 — Knowledge Reconstruction Agent

Agent proposes Knowledge based on governed Authority Record material.

It cannot approve its own proposal.

PAS-1903 — Knowledge Explanation

Endpoint:

GET /api/v1/knowledge/:id/basis

Return supporting authority.

BUILD 20 — Know-How
PAS-2001 — KnowHowRecord

Create first-class practical capability.

Represent:

capability
procedure
decisionRules
inputs
outputs
tools
conditions
exceptions
failureModes
experienceBasis
PAS-2002 — Know-How Reconstruction

Infer candidate Know-How from repeated execution and supporting material.

Do not infer it solely from titles or credentials.

PAS-2003 — Know-How Basis

Every active Know-How record must expose its supporting Experience/Claim/Evidence basis.

BUILD 21 — Expertise
PAS-2101 — ExpertiseRecord

Create first-class Expertise.

PAS-2102 — Expertise Basis

Support references to:

Knowledge

Know-How

Experience

Project

Framework

Methodology

Output

Outcome

Credential

Evidence

Recognition.

PAS-2103 — Expertise Establishment Workflow

Required:

candidate expertise
→ basis analysis
→ evidence/governance evaluation
→ human review when required
→ active expertise
PAS-2104 — Explain Expertise

Create:

GET /api/v1/expertise/:id/basis

Return a structured explanation graph.

BUILD 22 — Domains and Clusters
PAS-2201 — AuthorityDomain

Create:

authority_domains
domain_memberships
domain_proposals

No universal taxonomy/count.

PAS-2202 — Domain Discovery

Cognitive worker proposes coherent substantive fields from the Authority Record.

PAS-2203 — AuthorityCluster

Create:

authority_clusters
cluster_memberships
cluster_relationships
cluster_proposals
PAS-2204 — Cluster Discovery

Cluster related authority without duplicating canonical objects.

PAS-2205 — Large-Corpus Test

Use the deep academic fixture.

Assert hundreds of records can organize into coherent Domains/Clusters without requiring hundreds of top-level pages.

BUILD 23 — Composition
PAS-2301 — CompositionDefinition

Create:

composition_definitions
composition_versions
composition_rules
composition_memberships
PAS-2302 — Composition Inputs

Composition accepts:

Authority Record

Graph

Domains

Clusters

audience

purpose

privacy

significance

evidence density

owner objectives.

PAS-2303 — Composition Engine

Produce proposed presentation structures.

Never modify underlying Authority Record material.

PAS-2304 — Composition Approval

Govern Composition separately from authority approval.

Approved authority does not mean every representation of it is automatically approved.

BUILD 24 — Authority Surfaces and Dossiers
PAS-2401 — AuthoritySurface

Create extensible surface registry and instances.

No fixed page count.

PAS-2402 — Surface Sections

Create ordered structured sections referencing Authority Record material.

PAS-2403 — Dossier

Implement Dossier as specialized governed composition.

Membership direction:

Dossier → Authority

Never canonical:

Authority → associatedDossierIds
PAS-2404 — Surface Visibility

Surface visibility does not override underlying authority restrictions.

A Composition cannot make private authority public.

BUILD 25 — Representation
PAS-2501 — Representation

Create:

representations
representation_versions
representation_components
representation_authority_links
PAS-2502 — Immutable Representation Version

Once a version enters publication approval, freeze its authority references and content snapshot.

Subsequent changes create a new version.

PAS-2503 — Reverse Lineage

For every material represented assertion, retain enough references to traverse:

Representation
→ Authority object
→ Claim
→ Evidence
→ Source
BUILD 26 — Personal PAS and BPAS
PAS-2601 — Personal PAS Composer

Compose Personal PAS from approved surfaces.

Dynamic navigation.

No M01–M08 requirement.

PAS-2602 — Personal PAS Renderer

Render Published Representation structures rather than querying unrestricted Authority Record data.

PAS-2603 — BPAS Composer

Compose organization authority using the Organization Authority Record.

PAS-2604 — Person↔Organization Authority

Support authorized relationships:

Person → founded → Organization
Person → leads → Organization
Person → implemented → Program
Organization → operated → Program
Organization → implemented → Framework

Do not duplicate the person's canonical authority into BPAS.

BUILD 27 — Publication
PAS-2701 — PublicationCandidate

Create candidate from a frozen Representation version.

PAS-2702 — Publication Governance

Evaluate:

visibility

authority eligibility

representation approval

privacy

evidence requirements

authorization.

PAS-2703 — PublishedRepresentation

Create the public-safe projection.

Public delivery systems consume this projection exclusively.

PAS-2704 — PublicationSnapshot

Record:

representation version

supporting authority versions

publication configuration

canonical URL

publisher

authorization

timestamp.

PAS-2705 — Supersession

Publishing a replacement version must preserve prior historical snapshots while directing active delivery to the new version.

BUILD 28 — Machine Representation
PAS-2801 — JSON-LD

Generate exclusively from PublishedRepresentation.

PAS-2802 — Sitemap

Generate exclusively from active public publications.

PAS-2803 — Canonical URLs

Create stable URL strategy independent of canonical database IDs where public slugs are desired.

Changing slug must not change Authority identity.

PAS-2804 — Machine Privacy Test

Attempt to insert:

private Experience

private Evidence

internal Graph relationship.

Assert none appear in:

HTML

public API

JSON-LD

sitemap

public search index.

BUILD 29 — Demand and Discovery
PAS-2901 — DemandObject

Create demand intelligence domain.

Demand is observational.

PAS-2902 — DiscoveryObservation

Create factual observation records for measurable discovery events.

PAS-2903 — Authority-Demand Matching

Compare Demand with governed authority.

Store basis, not just score.

PAS-2904 — Gap Classification

Implement G1–G11.

PAS-2905 — No-Authority Test

Demand exists.

No supported authority exists.

Expected:

NO_SUPPORTED_AUTHORITY

No synthetic Expertise or Claim is created.

BUILD 30 — Fellowship
PAS-3001 — Authority Alignment

Analyze governed Authority Graph intersections.

PAS-3002 — Alignment Basis

Every match stores explainable basis.

PAS-3003 — Recognition Objects

Implement:

Citation

Endorsement

Vouch

Review

Adoption

Collaboration.

Attach recognition to specific authority where applicable.

PAS-3004 — Fellowship Discovery

Support discovery by:

Domain

Expertise

Know-How

Framework

Project

shared/complementary authority.

Do not organize primarily around popularity.

BUILD 31 — Relationships and Opportunities
PAS-3101 — ProfessionalRelationship

Create governed relationship records with consent/privacy.

PAS-3102 — Interaction

Record legitimate interactions separately from Authority Graph edges.

PAS-3103 — Opportunity

Create:

employment

consulting

speaking

research

partnership

funding

implementation

contracting

collaboration

licensing

other.

PAS-3104 — Opportunity Origin

Preserve whether the opportunity came through:

Fellowship

search

AI discovery

referral

direct inquiry

existing relationship

other.

BUILD 32 — Journeys, Outcomes and Learning
PAS-3201 — Journey

Trace:

Demand
→ Discovery
→ Representation
→ Relationship
→ Opportunity
→ Action
→ Outcome
PAS-3202 — Outcome

Record actual outcome independently.

PAS-3203 — Attribution

Record separately:

attributedCause
confidence
supportingBasis

Never convert correlation automatically into causation.

PAS-3204 — LearningProposal

Generate proposed system improvements from observations and outcomes.

PAS-3205 — Learning Governance

Required:

Observe
→ Analyze
→ Propose
→ Authorize
→ Apply
→ Measure

Never:

Observe
→ automatically rewrite Authority
BUILD 33 — Dependency and Impact System
PAS-3301 — ObjectDependency

Create:

object_dependencies

Track material downstream dependencies.

PAS-3302 — Impact Traversal

Given an object, calculate affected:

Claims

Knowledge

Know-How

Expertise

Domains

Clusters

Surfaces

Dossiers

Representations

Publications.

PAS-3303 — Retraction Workflow

Implement the complete invalidation path:

Evidence invalidated
↓
dependent Claims identified
↓
authority conclusions flagged
↓
Representations identified
↓
Publication review task
↓
retain / revise / supersede / withdraw

No silent public inconsistency.

BUILD 34 — Search and Retrieval
PAS-3401 — Full-Text Search

Index authorized canonical/public material according to access context.

PAS-3402 — Semantic Index

Implement pgvector-based semantic retrieval.

Embeddings are derived.

Store:

model/version

source object

source version

visibility

generation timestamp.

PAS-3403 — Rebuildability

Delete derived search/vector projections in test.

Rebuild them from canonical state.

Results must restore successfully.

BUILD 35 — Complete User Workspaces
PAS-3501 — Authority Workspace

Implement complete operational UI over real backend services.

PAS-3502 — Representation Studio

Implement Composition, Surface, Dossier and preview workflows.

PAS-3503 — Publishing Center

Implement approval, versioning, domain and machine-representation controls.

PAS-3504 — Discovery Center

Implement Demand, Discovery, matching and gap intelligence.

PAS-3505 — Fellowship Workspace

Implement alignment, recognition and relationship initiation.

PAS-3506 — Opportunity Workspace

Implement inquiry, opportunity, journey and outcome management.

PAS-3507 — BPAS Workspace

Implement organizational authority management.

PAS-3508 — Administration

Implement governance, agents, workflows, verification, audit and platform operations.

BUILD 36 — Platform Hardening
PAS-3601 — Tenant Isolation

Prove account/entity boundaries cannot be crossed through manipulated IDs.

PAS-3602 — Upload Security

Validate:

file type

size

malware/security checks

storage permissions

processing isolation.

PAS-3603 — API Security

Implement:

rate limiting

request validation

authentication

authorization

safe errors

security headers

abuse controls.

PAS-3604 — Agent Security

Prevent unauthorized records from entering agent context.

Tool access is task-scoped.

Agent output remains untrusted until validated.

PAS-3605 — Backup and Recovery

Implement and test:

database backup

object storage recovery

configuration recovery

restore procedure.

A backup is not accepted until restoration has been tested.

PAS-3606 — Observability

Implement:

logs

metrics

traces

workflow monitoring

worker monitoring

agent telemetry

publication monitoring

security monitoring.

Correlation IDs connect the systems.

PAS-3607 — Accessibility

Validate public and authenticated interfaces against the selected accessibility standard.

Accessibility defects are release defects.

PAS-3608 — Performance

Establish measurable budgets for:

API latency

public PAS rendering

search

graph traversal

workflow throughput

large Authority Records.

Do not optimize by eliminating lineage/governance.

BUILD 37 — Final Platform Certification

The coding assistant SHALL NOT declare PAS complete until these canonical scenarios pass.

Scenario 1 — Undocumented practitioner

A practitioner without conventional credentials supplies work history and evidence.

PAS reconstructs Experience and Know-How without manufacturing credentials.

Scenario 2 — Deep academic

Hundreds of research artifacts organize into Domains/Clusters and dynamic Surfaces without fixed modules.

Scenario 3 — Multidimensional operator

Multiple organizations, projects, frameworks, methodologies and experiences remain coherent without forcing one career narrative.

Scenario 4 — Organization

BPAS represents team, capabilities, programs, operations and outcomes while linking—not duplicating—Personal PAS authority.

Scenario 5 — Contradictory evidence

Conflicting sources generate Conflict and review rather than silent selection.

Scenario 6 — Privacy

Private authority remains absent from every public delivery channel.

Scenario 7 — Discovery

A real Demand intersects supported Authority and reaches the appropriate Published Surface.

Scenario 8 — Unsupported demand

Demand exists but authority does not.

PAS returns:

NO SUPPORTED AUTHORITY.

Scenario 9 — Find Your Tribe

Two entities possess meaningful related/complementary authority.

Fellowship identifies the intersection and explains why.

Scenario 10 — Opportunity

Discovery/recognition progresses through Relationship → Opportunity → Outcome with traceable Journey.

Scenario 11 — Retraction

Evidence supporting already-published authority is invalidated.

Impact analysis reaches the publication and triggers governed correction.

Scenario 12 — Provider independence

Switch the configured AI provider.

Canonical PAS architecture remains unchanged.

Final coding-assistant completion contract

Every ticket must finish with a machine-verifiable report containing:

Ticket ID
Status

Files Created
Files Modified

Database Migrations

Domain Contracts Added/Changed

API Contracts Added/Changed

Events Added/Changed

Workflow Changes

Governance Changes

Authorization Changes

Tests Added

Tests Passed

Typecheck Result

Build Result

Security/Privacy Impact

Backward Dependency Check

Forward Dependencies Unlocked

Known Issues

Known Issues cannot be used to hide incomplete acceptance criteria.

If acceptance criteria fail:

STATUS = BLOCKED

not:

STATUS = COMPLETE WITH TODO
Master execution sequence

The coding assistant therefore receives the platform as a controlled dependency chain:

00 Engineering Foundation → 01 Database → 02 Identity/Auth → 03 Audit/Events → 04 Authority Entity → 05 Authority Record → 06 Sources → 07 Observations → 08 Claims → 09 Evidence → 10 Provenance/Verification → 11 Governance → 12 Human Tasks → 13 Workflows → 14 Experience/Professional Work → 15 Authority Graph → 16 Agent Gateway → 17 Production Ingestion → 18 Reconstruction → 19 Knowledge → 20 Know-How → 21 Expertise → 22 Domains/Clusters → 23 Composition → 24 Surfaces/Dossiers → 25 Representation → 26 Personal PAS/BPAS → 27 Publication → 28 Machine Representation → 29 Demand/Discovery → 30 Fellowship → 31 Relationships/Opportunities → 32 Journeys/Outcomes/Learning → 33 Dependency/Impact → 34 Search/Retrieval → 35 Complete Workspaces → 36 Hardening → 37 Platform Certification.

This is now at the level where the architecture does not need to be reinterpreted each time coding starts. The build can be executed ticket-by-ticket while preserving the complete PAS capability chain from raw professional experience all the way through governed authority, representation, discovery, Fellowship, opportunity, outcome and learning.