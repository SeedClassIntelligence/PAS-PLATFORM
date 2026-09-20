/**
 * PAS PLATFORM — CANONICAL ENTERPRISE TYPE DEFINITIONS
 * Conforming to the Complete PAS Platform Specification (84-Section Doctrine)
 */

// ── 1. THE FOUR MAJOR EXPERIENCES ──
export type PASEnvironment = 
  | 'PUBLIC_PLATFORM'         // Discovery, demonstration, and user acquisition
  | 'AUTHENTICATED_APP'        // The guided operating system & control rooms
  | 'PUBLISHED_PERSONAL_PAS'   // Live public authority property for an individual
  | 'PUBLISHED_BPAS';          // Live public authority property for an organization/ecosystem

// ── 2. PROVENANCE & CONFIDENCE STATES (Section 9) ──
export type ProvenanceState = 
  | 'VERIFIED'          // Strong verification state supported by required verification method
  | 'SOURCE_CONFIRMED'  // Supported directly by a connected source
  | 'USER_CONFIRMED'    // The user has explicitly confirmed the information
  | 'AI_INFERRED'       // PAS inferred the relationship but awaiting confirmation
  | 'UNVERIFIED';       // Present but not yet sufficiently supported

export type WorkflowState = 
  | 'DRAFT'
  | 'CONFLICT'
  | 'MISSING_EVIDENCE'
  | 'PRIVATE'
  | 'REJECTED'
  | 'PUBLISH_READY';

// ── 3. PRIVACY & VISIBILITY CONTROLS (Section 15) ──
export type VisibilityState = 
  | 'PUBLIC'                          // Visible to anyone & indexed
  | 'PRIVATE'                         // Visible only to the owner/internal system
  | 'GATED'                           // Accessible to an approved viewer / business credentials
  | 'DIRECT_LINK'                     // Available only through direct authorized URL
  | 'INTERNAL_GRAPH_ONLY';            // System uses record internally, hidden from public graph

export type AccessTier = 'CORE_PUBLIC' | 'EXECUTIVE_GATED' | 'CONTROLLED_REQUEST';

// ── 4. AUTHORITY OBJECT TYPES (Section 8) ──
export type AuthorityObjectType = 
  | 'PERSON'          // Professional or collaborator
  | 'ORGANIZATION'    // Company, nonprofit, institution, agency
  | 'ROLE'            // Founder, Director, Consultant, Principal
  | 'PROJECT'         // Specific engagement, build, or campus development
  | 'INITIATIVE'      // Broader ongoing body of work
  | 'FRAMEWORK'       // Original structured intellectual property (e.g. WCS)
  | 'METHODOLOGY'     // Repeatable professional process
  | 'CREDENTIAL'      // Degree, certification, license (e.g. CHW-1)
  | 'EVIDENCE'        // Letter, formal record, LOI, agreement, audit report
  | 'OUTPUT'          // Publication, product, system, whitepaper, video
  | 'PARTNERSHIP'     // Professional or institutional relationship
  | 'AGREEMENT'       // Contract, MOU, grant award
  | 'OUTCOME'         // Measurable result or verified impact
  | 'DOMAIN';         // Professional subject area

// ── 5. SEMANTIC RELATIONSHIP TYPES (Section 14) ──
export type SemanticRelationshipType = 
  | 'founded'
  | 'authored'
  | 'created'
  | 'co_created'
  | 'implemented'
  | 'leads'
  | 'managed'
  | 'advised'
  | 'funded'
  | 'supported'
  | 'partnered_with'
  | 'collaborated_with'
  | 'contributed_to'
  | 'employed_by'
  | 'served_on'
  | 'reviewed'
  | 'recognized'
  | 'adopted'
  | 'cited'
  | 'formerly_affiliated_with';

export interface GraphEdge {
  id: string;
  sourceObjectId: string;
  targetObjectId: string;
  relationship: SemanticRelationshipType;
  confidenceScore: number;
  provenance: ProvenanceState;
  visibility: VisibilityState;
  notes?: string;
}

export interface AuthorityObject {
  id: string;
  name: string;
  type: AuthorityObjectType;
  summary: string;
  detailedDescription?: string;
  sources: string[];
  evidenceIds: string[];
  confidenceScore: number;
  provenance: ProvenanceState;
  workflowState: WorkflowState;
  visibility: VisibilityState;
  associatedModuleCodes: string[];
  associatedDossierIds: string[];
  relationships: GraphEdge[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ── 6. THE CANONICAL MODULES (Section 12) ──
export type CanonicalModuleCode = 
  | 'M01' // Orientation & Mission (Foundational Thesis)
  | 'M02' // Professional Identity (Credentials, Licensure & Arc)
  | 'M03' // Execution Track Record (Frontline Delivery & Leadership)
  | 'M04' // Active Implementation (Live Campuses, Contracts & Deployments)
  | 'M05' // Architecture & Frameworks (System Design & Intellectual Property)
  | 'M06' // Domain Thesis (Original IP, Whitepapers & Statutory Analysis)
  | 'M07' // Backstop & Compliance (Institutional Safeguards, 2 CFR 200)
  | 'M08';// Verifiable Evidence (Attestations, Audits & ROI Proof)

export interface PASModule {
  id: string;
  code: string; // M01...M08 or dynamic extensible codes for custom enterprise domains
  title: string;
  subtitle: string;
  description: string;
  category: 'CORE' | 'OPERATIONAL' | 'ARCHITECTURAL' | 'COMPLIANCE' | 'CUSTOM';
  visibility: 'FULL' | 'COMPACT' | 'HIDDEN';
  completionPercentage: number;
  unresolvedCount: number;
  objectIds: string[];
  order: number;
}

// ── 7. DOSSIER ARCHITECTURE & SYNCHRONIZATION (Sections 16, 17, 18, 19) ──
export type DossierSyncRule = 'LINKED_TO_AUTHORITY_RECORD' | 'FROZEN_AT_PUBLISHED';

export interface DossierSection {
  id: string;
  title: string;
  type: 'STATEMENT' | 'METRIC_ROW' | 'OBJECT_GRID' | 'CALLOUT' | 'TIMELINE' | 'EVIDENCE_DRAWER' | 'FREE_TEXT';
  content: string;
  referencedObjectIds: string[];
}

export interface Dossier {
  id: string;
  number: string; // e.g. "01", "02", "10", "42"
  slug: string;
  title: string;
  subtitle: string;
  targetAudience: string; // e.g. "Public Gateway", "Institutional Reviewers", "Managed Care Executives"
  purpose: string;
  accessTier: AccessTier;
  visibility: VisibilityState;
  syncRule: DossierSyncRule;
  modulesUsed: string[];
  sections: DossierSection[];
  viewCount: number;
  isPublished: boolean;
  publishedVersion?: number;
  affectedByUpdates?: boolean;
}

// ── 8. DIGITAL REAL ESTATE & CONNECTIONS (Sections 6 & 33) ──
export type ConnectorPlatform = 
  | 'LINKEDIN'
  | 'GOOGLE_DRIVE'
  | 'WEBSITE'
  | 'UPLOADED_FILES'
  | 'GMAIL'
  | 'GOOGLE_CALENDAR'
  | 'GOOGLE_SHEETS'
  | 'INSTAGRAM'
  | 'TWITTER_X'
  | 'FACEBOOK'
  | 'DROPBOX'
  | 'ONEDRIVE';

export type ConnectorState = 
  | 'CONNECTED'
  | 'NOT_CONNECTED'
  | 'SYNCHRONIZING'
  | 'PAUSED'
  | 'PERMISSION_REQUIRED'
  | 'ERROR'
  | 'RECONNECT_REQUIRED';

export interface ConnectorSource {
  id: ConnectorPlatform;
  name: string;
  icon: string;
  category: 'PRIMARY' | 'SECONDARY' | 'CLOUD';
  state: ConnectorState;
  accountLabel?: string;
  recordsDiscovered: number;
  filesDiscovered: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}

export interface EnrichmentSuggestion {
  id: string;
  source: ConnectorPlatform;
  detectedAt: string;
  title: string;
  description: string;
  proposedObjectType: AuthorityObjectType;
  proposedModuleCodes: string[];
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED';
}

// ── 9. DESIGN SYSTEM & PAGE BUILDER (Sections 20 & 21) ──
export type PASTemplateTheme = 
  | 'AUTHORITY'  // Warm editorial, Cormorant Garamond, gold accents
  | 'PRECISION'  // Dark mode, gold on black, sharp lines
  | 'STUDIO'     // Light olive green, generous whitespace
  | 'SLATE'      // Cool blue-grey, geometric, corporate
  | 'EMBER'      // Warm terracotta, deep greens
  | 'ONYX';      // Ultra-minimalist, black & white contrast

export interface PageCallToAction {
  id: string;
  label: string;
  actionType: 'REQUEST_MEETING' | 'CONTACT' | 'REQUEST_ACCESS' | 'VIEW_BPAS' | 'OPEN_DOSSIER' | 'MARKETPLACE' | 'EXTERNAL_LINK';
  target: string;
  style: 'PRIMARY' | 'OUTLINE' | 'TEXT';
  enabled: boolean;
}

export interface PageDesignConfig {
  template: PASTemplateTheme;
  accentColor: string;
  fontHeading: 'Cormorant Garamond' | 'Outfit' | 'Cinzel';
  fontBody: 'Outfit' | 'DM Sans' | 'Inter';
  avatarUrl?: string;
  heroHeadline: string;
  heroTagline: string;
  callsToAction: PageCallToAction[];
  exposedModuleIds: string[];
  publicDossierIds: string[];
}

// ── 10. PUBLISHING & DOMAIN INFRASTRUCTURE (Sections 24-30) ──
export type DomainLevel = 'LEVEL_1_FREE' | 'LEVEL_2_SUBDOMAIN' | 'LEVEL_3_CUSTOM';

export interface DomainConfig {
  freeSlugUrl: string;       // pasplatform.com/william-darnell-jernigan
  subdomainUrl: string;      // darnell.pasplatform.com
  customDomainUrl?: string;  // authority.wcs-framework.org
  canonicalLevel: DomainLevel;
  dnsTxtRecord: string;
  cnameTarget: string;
  sslStatus: 'ACTIVE' | 'PROVISIONING' | 'PENDING' | 'ERROR';
}

export interface PublicationSnapshot {
  version: number;
  publishedAt: string;
  publishedBy: string;
  changeSummary: string;
  activeDomain: string;
  objectCount: number;
  dossierCount: number;
}

// ── 11. BUSINESS PAS (BPAS) OPERATIONAL SUITE (Sections 54-65) ──
export interface BPOSEntity {
  id: string;
  name: string;
  legalStructure: '501C3' | 'LLC' | 'FOR_PROFIT_CORP' | 'PC_PLLC' | 'MSO' | 'JOINT_VENTURE';
  status: 'ACTIVE' | 'PENDING_FORMATION';
  roleInEcosystem: string;
  leadPersonId: string;
}

export interface BPOSTeamMember {
  id: string;
  name: string;
  role: string;
  personalPASSlug?: string;
  isLinked: boolean;
  accessLevel: 'FULL_ADMIN' | 'OPERATIONAL' | 'CLINICAL' | 'FIELD';
}

export interface BPOSProposal {
  id: string;
  title: string;
  targetPartner: string; // e.g. "Anthem"
  totalAskAmount: string; // e.g. "$1,000,000"
  status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'AWARDED';
  deliverables: string[];
  linkedDossierIds: string[];
}

export interface BPOSTrackerTask {
  id: string;
  category: string;
  name: string;
  status: 'DONE' | 'IN_PROGRESS' | 'NOT_STARTED' | 'ATTENTION';
  assignedTo?: string;
}

export interface BPOSRevenueStream {
  id: string;
  name: string;
  entityId: string;
  annualEstimate: string; // e.g. "$400K–$800K/yr"
  sourceType: 'MEDICAID' | 'GRANTS' | 'COMMERCIAL' | 'LICENSING' | 'CAPITAL';
}

export interface BPOSAgreement {
  id: string;
  number: string;
  name: string;
  tier: 'TIER_1_PRE_FUNDING' | 'TIER_2_OPERATIONAL' | 'TIER_3_SCALE';
  status: 'SIGNED' | 'IN_PROGRESS' | 'NOT_STARTED';
  parties: string[];
}

export interface BusinessPASState {
  organizationName: string;
  missionStatement: string;
  activeCampus: string;
  entities: BPOSEntity[];
  teamMembers: BPOSTeamMember[];
  proposals: BPOSProposal[];
  trackerTasks: BPOSTrackerTask[];
  revenueStreams: BPOSRevenueStream[];
  agreements: BPOSAgreement[];
}

// ── 12. FELLOWSHIP & MARKETPLACE (Sections 35-53) ──
export interface PeerEndorsement {
  id: string;
  endorserName: string;
  endorserTitle: string;
  endorserOrg: string;
  endorserPASUrl: string;
  targetObjectId: string; // Object-level endorsement!
  targetObjectName: string;
  relationshipType: SemanticRelationshipType;
  comment: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentType?: 'VIDEO' | 'PRESENTATION' | 'PDF';
}

export interface KnowledgeProduct {
  id: string;
  title: string;
  type: 'FREE_BLUEPRINT' | 'PAID_TOOLKIT' | 'VIDEO_COURSE' | 'CONSULTING_PACKAGE';
  priceUsd: number;
  description: string;
  pageCountOrDuration: string;
  downloadsOrEnrollments: number;
  revenueGeneratedUsd: number;
  linkedModuleCodes: string[];
  linkedAuthorityObjectIds: string[];
  isPublished: boolean;
}

// ── 13. MASTER ADMIN (C-SUITE GOD VIEW) (Section 68) ──
export interface PlatformAdminMetrics {
  totalUsers: number;
  publishedPASCount: number;
  businessPASCount: number;
  mrrUsd: number;
  pendingTier3Verifications: number;
}
