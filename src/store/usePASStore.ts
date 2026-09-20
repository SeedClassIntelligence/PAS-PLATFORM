import { create } from 'zustand';
import { 
  PASEnvironment,
  AuthorityObject, 
  PASModule, 
  Dossier, 
  GraphEdge,
  ConnectorSource,
  EnrichmentSuggestion,
  PageDesignConfig, 
  DomainConfig, 
  PublicationSnapshot,
  BusinessPASState,
  PeerEndorsement,
  KnowledgeProduct,
  PlatformAdminMetrics,
  AccessTier,
  VisibilityState,
  ProvenanceState
} from '../types/pas';

export type AppNavRoute = 
  // OVERVIEW
  | 'overview'
  // BUILD
  | 'builder'
  // MANAGE MY PAS
  | 'modules'
  | 'dossiers'
  | 'graph'
  | 'pagebuilder'
  | 'publishing'
  | 'domains'
  | 'connections'
  // ECOSYSTEM
  | 'bpas'
  | 'fellowship'
  | 'marketplace'
  | 'tools'
  // ACCOUNT / DISCOVERY
  | 'verify'
  | 'seo'
  | 'settings'
  // ADMIN
  | 'admin';

export interface PASStoreState {
  // ── ENVIRONMENT & VIEWPORT ──
  environment: PASEnvironment;
  activeRoute: AppNavRoute;
  builderStage: number; // 1 to 11

  // ── USER PROFILE ──
  userName: string;
  userTitle: string;
  userLocation: string;
  userBio: string;
  verificationBadge: 'DOCUMENT_VERIFIED' | 'PEER_VERIFIED' | 'PLATFORM_VERIFIED';

  // ── CANONICAL DATA STORE (Single Source of Truth) ──
  authorityObjects: AuthorityObject[];
  graphEdges: GraphEdge[];
  modules: PASModule[];
  dossiers: Dossier[];
  activeDossierId: string;

  // ── SOURCES & LIVE CONNECTIONS ──
  sources: ConnectorSource[];
  enrichmentSuggestions: EnrichmentSuggestion[];

  // ── DESIGN & PAGE BUILDER ──
  pageDesign: PageDesignConfig;

  // ── PUBLISHING & DOMAINS ──
  domainConfig: DomainConfig;
  publicationSnapshots: PublicationSnapshot[];
  isDraftModified: boolean;

  // ── BUSINESS PAS (BPAS) ──
  bpas: BusinessPASState;

  // ── FELLOWSHIP & MARKETPLACE ──
  peerEndorsements: PeerEndorsement[];
  marketplaceProducts: KnowledgeProduct[];

  // ── MASTER ADMIN ──
  adminMetrics: PlatformAdminMetrics;

  // ── ACTIONS ──
  setEnvironment: (env: PASEnvironment) => void;
  setActiveRoute: (route: AppNavRoute) => void;
  setBuilderStage: (stage: number) => void;
  setActiveDossierId: (id: string) => void;

  // Data Actions
  addAuthorityObject: (obj: AuthorityObject) => void;
  updateAuthorityObject: (id: string, updates: Partial<AuthorityObject>) => void;
  deleteAuthorityObject: (id: string) => void;

  // Graph Actions
  addGraphEdge: (edge: GraphEdge) => void;

  // Module Actions
  updateModule: (id: string, updates: Partial<PASModule>) => void;

  // Dossier Actions
  updateDossier: (id: string, updates: Partial<Dossier>) => void;
  setDossierAccessTier: (dossierId: string, tier: AccessTier) => void;
  addDossier: (dossier: Dossier) => void;

  // Design Actions
  updatePageDesign: (updates: Partial<PageDesignConfig>) => void;

  // Ingestion Actions
  connectSource: (platform: string) => void;
  acceptEnrichment: (id: string) => void;
  dismissEnrichment: (id: string) => void;

  // Publishing Actions
  publishPAS: (summary: string) => void;
}

export const usePASStore = create<PASStoreState>((set, get) => ({
  // ── INITIAL ENVIRONMENT ──
  environment: 'AUTHENTICATED_APP',
  activeRoute: 'builder',
  builderStage: 1,

  // ── USER PROFILE ──
  userName: 'William Darnell Jernigan IV',
  userTitle: 'Director of Workforce, Program & Community Health Systems',
  userLocation: 'Las Vegas, NV',
  userBio: 'Director-level operator and systems architect with 10+ years delivering integrated workforce development, community health, and housing systems across Nevada, Utah, Wisconsin, and the Midwest. Founder & Executive Director, A Solution Group CDC. CHW-1 Certified.',
  verificationBadge: 'PEER_VERIFIED',

  // ── CANONICAL AUTHORITY OBJECTS ──
  authorityObjects: [
    {
      id: 'auth-asg-cdc',
      name: 'A Solution Group CDC',
      type: 'ORGANIZATION',
      summary: '501(c)(3) community development corporation addressing intergenerational incarceration through workforce pipelines and housing integration.',
      sources: ['IRS Registry', 'Nevada Secretary of State', 'Executive Dossier'],
      evidenceIds: ['evid-501c3-doc'],
      confidenceScore: 99,
      provenance: 'VERIFIED',
      workflowState: 'PUBLISH_READY',
      visibility: 'PUBLIC',
      associatedModuleCodes: ['M01', 'M02', 'M03', 'M04'],
      associatedDossierIds: ['d01', 'd02', 'd03', 'd07'],
      relationships: [],
      createdAt: '2015-01-01',
      updatedAt: '2026-03-01'
    },
    {
      id: 'auth-wcs-framework',
      name: 'Whole Community Solution (WCS) Framework',
      type: 'FRAMEWORK',
      summary: '9-pillar cross-sector systems architecture integrating housing, community health worker navigation, and clinical fee-for-service delivery.',
      sources: ['IP Archive', 'Whitepaper Publication', 'Anthem Partnership Deck'],
      evidenceIds: ['evid-wcs-spec'],
      confidenceScore: 96,
      provenance: 'VERIFIED',
      workflowState: 'PUBLISH_READY',
      visibility: 'PUBLIC',
      associatedModuleCodes: ['M05', 'M06'],
      associatedDossierIds: ['d04', 'd05', 'd06', 'd10'],
      relationships: [],
      createdAt: '2020-06-01',
      updatedAt: '2026-02-15'
    },
    {
      id: 'auth-chw-cert',
      name: 'CHW-1 Certified Community Health Worker',
      type: 'CREDENTIAL',
      summary: 'State certification through the Nevada Certification Board credentialing frontline health navigation and Medicaid reimbursable service delivery.',
      sources: ['Nevada Certification Board', 'College of Southern Nevada'],
      evidenceIds: ['evid-chw-license-scan'],
      confidenceScore: 100,
      provenance: 'VERIFIED',
      workflowState: 'PUBLISH_READY',
      visibility: 'PUBLIC',
      associatedModuleCodes: ['M02', 'M07'],
      associatedDossierIds: ['d02', 'd03', 'd07'],
      relationships: [],
      createdAt: '2021-08-10',
      updatedAt: '2026-01-10'
    },
    {
      id: 'auth-advent-campus',
      name: 'Advent UMC Campus Development',
      type: 'PROJECT',
      summary: '50-unit affordable housing campus in Las Vegas with integrated health clinic, childcare facility, and 4-stage workforce training pipeline.',
      sources: ['Advent UMC Agreement', 'KG Development Contract'],
      evidenceIds: ['evid-campus-siteplan'],
      confidenceScore: 94,
      provenance: 'SOURCE_CONFIRMED',
      workflowState: 'PUBLISH_READY',
      visibility: 'PUBLIC',
      associatedModuleCodes: ['M03', 'M04'],
      associatedDossierIds: ['d01', 'd03', 'd06'],
      relationships: [],
      createdAt: '2023-04-01',
      updatedAt: '2026-02-28'
    },
    {
      id: 'auth-anthem-loi',
      name: 'Anthem Nevada $1M Clinical Partnership',
      type: 'AGREEMENT',
      summary: '$1,000,000 corporate sponsorship and clinical services agreement supporting clinic infrastructure and CHW benefits navigation.',
      sources: ['Signed LOI', 'Anthem Leadership Correspondence'],
      evidenceIds: ['evid-anthem-loi-pdf'],
      confidenceScore: 92,
      provenance: 'SOURCE_CONFIRMED',
      workflowState: 'PUBLISH_READY',
      visibility: 'GATED',
      associatedModuleCodes: ['M04', 'M08'],
      associatedDossierIds: ['d04', 'd06', 'd08'],
      relationships: [],
      createdAt: '2026-03-08',
      updatedAt: '2026-03-08'
    }
  ],

  graphEdges: [
    {
      id: 'edge-1',
      sourceObjectId: 'auth-asg-cdc',
      targetObjectId: 'auth-wcs-framework',
      relationship: 'created',
      confidenceScore: 98,
      provenance: 'VERIFIED',
      visibility: 'PUBLIC'
    },
    {
      id: 'edge-2',
      sourceObjectId: 'auth-asg-cdc',
      targetObjectId: 'auth-advent-campus',
      relationship: 'leads',
      confidenceScore: 95,
      provenance: 'VERIFIED',
      visibility: 'PUBLIC'
    }
  ],

  // ── THE 8 CANONICAL MODULES (Section 12) ──
  modules: [
    { id: 'mod-1', code: 'M01', title: 'Orientation & Mission', subtitle: 'Foundational Thesis', description: 'Personal narrative, career arc from practitioner to systems architect, and mission conviction.', category: 'CORE', visibility: 'FULL', completionPercentage: 96, unresolvedCount: 0, objectIds: ['auth-asg-cdc'], order: 1 },
    { id: 'mod-2', code: 'M02', title: 'Professional Identity', subtitle: 'Credentials & Licensure', description: 'CHW-1 licensure, HarvardX executive credentials, and specialized workforce training qualifications.', category: 'CORE', visibility: 'FULL', completionPercentage: 92, unresolvedCount: 0, objectIds: ['auth-chw-cert', 'auth-asg-cdc'], order: 2 },
    { id: 'mod-3', code: 'M03', title: 'Execution Track Record', subtitle: 'Frontline Capacity', description: '10+ years operational leadership delivering workforce pipelines, construction pre-apprenticeships, and reentry stabilization.', category: 'OPERATIONAL', visibility: 'FULL', completionPercentage: 90, unresolvedCount: 0, objectIds: ['auth-asg-cdc', 'auth-advent-campus'], order: 3 },
    { id: 'mod-4', code: 'M04', title: 'Active Implementation', subtitle: 'Live Campuses & Deployments', description: 'Current groundbreaks, including Advent UMC campus, Anthem $1M partnership, and 5-entity alignment.', category: 'OPERATIONAL', visibility: 'FULL', completionPercentage: 88, unresolvedCount: 1, objectIds: ['auth-advent-campus', 'auth-anthem-loi'], order: 4 },
    { id: 'mod-5', code: 'M05', title: 'Architecture & Frameworks', subtitle: 'System Design & IP', description: 'Whole Community Solution (WCS) 9-pillar architecture, Solutionologist workforce tiering, and clinical integration.', category: 'ARCHITECTURAL', visibility: 'FULL', completionPercentage: 95, unresolvedCount: 0, objectIds: ['auth-wcs-framework'], order: 5 },
    { id: 'mod-6', code: 'M06', title: 'Domain Thesis', subtitle: 'Original IP & Policy Briefs', description: 'Point-of-sentencing policy (COIP), housing-first workforce integration, and published health equity whitepapers.', category: 'ARCHITECTURAL', visibility: 'FULL', completionPercentage: 84, unresolvedCount: 0, objectIds: ['auth-wcs-framework'], order: 6 },
    { id: 'mod-7', code: 'M07', title: 'Backstop & Compliance', subtitle: 'Institutional Safeguards', description: '2 CFR 200 federal grant compliance, PREA standards, board governance, and audit trails.', category: 'COMPLIANCE', visibility: 'FULL', completionPercentage: 94, unresolvedCount: 0, objectIds: ['auth-asg-cdc', 'auth-chw-cert'], order: 7 },
    { id: 'mod-8', code: 'M08', title: 'Verifiable Evidence', subtitle: 'Attestations & ROI Proof', description: 'Independent partner letters, Medicaid billing returns, client stabilization metrics, and outcome case studies.', category: 'COMPLIANCE', visibility: 'FULL', completionPercentage: 89, unresolvedCount: 0, objectIds: ['auth-anthem-loi'], order: 8 }
  ],

  // ── DOSSIERS LIBRARY (Section 16-19) ──
  dossiers: [
    { id: 'd01', number: '01', slug: 'portfolio-cover', title: 'Portfolio Cover', subtitle: 'Entry Gateway & Executive Thesis', targetAudience: 'Public Gateway', purpose: 'Comprehensive overview and identity introduction', accessTier: 'CORE_PUBLIC', visibility: 'PUBLIC', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M01', 'M02', 'M03'], viewCount: 2847, isPublished: true, sections: [] },
    { id: 'd02', number: '02', slug: 'executive-bio', title: 'Executive Bio', subtitle: 'Identity & Professional Arc', targetAudience: 'Institutional Reviewers', purpose: 'Personal background, systems transformation thesis, and career chronology', accessTier: 'CORE_PUBLIC', visibility: 'PUBLIC', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M01', 'M02'], viewCount: 1940, isPublished: true, sections: [] },
    { id: 'd03', number: '03', slug: 'operator-resume', title: 'Operator Resume', subtitle: 'Frontline & Systems Execution', targetAudience: 'Hiring Executives & Boards', purpose: 'Operational track record, direct deliverables, and program management', accessTier: 'CORE_PUBLIC', visibility: 'PUBLIC', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M02', 'M03', 'M04'], viewCount: 1560, isPublished: true, sections: [] },
    { id: 'd04', number: '04', slug: 'policy-systems', title: 'Policy & Systems', subtitle: 'Statutory Architecture', targetAudience: 'Legislators & Policy Directors', purpose: 'Systems reform, justice-involved stabilization, and cross-sector coordination', accessTier: 'EXECUTIVE_GATED', visibility: 'GATED', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M05', 'M06'], viewCount: 890, isPublished: true, sections: [] },
    { id: 'd05', number: '05', slug: 'coip-policy-brief', title: 'COIP Policy Brief', subtitle: 'Point-of-Sentencing Interventions', targetAudience: 'Judicial & Child Welfare Leadership', purpose: 'Framework for Children of Incarcerated Parents stabilization', accessTier: 'EXECUTIVE_GATED', visibility: 'GATED', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M04', 'M05', 'M06'], viewCount: 640, isPublished: true, sections: [] },
    { id: 'd06', number: '06', slug: 'architecture-overview', title: 'Architecture Overview', subtitle: 'The 4 Core Frameworks', targetAudience: 'Health Plan & Housing Developers', purpose: 'Technical design of the WCS 9 pillars and campus health homes', accessTier: 'EXECUTIVE_GATED', visibility: 'GATED', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M05', 'M06', 'M08'], viewCount: 1120, isPublished: true, sections: [] },
    { id: 'd07', number: '07', slug: 'master-cv-record', title: 'Master CV & Record', subtitle: 'Complete Due Diligence Archive', targetAudience: 'Legal, Grant & Federal Auditors', purpose: 'Full historical chronology, board appointments, licenses, and filings', accessTier: 'CONTROLLED_REQUEST', visibility: 'GATED', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08'], viewCount: 480, isPublished: true, sections: [] },
    { id: 'd08', number: '08', slug: 'hiring-engagement', title: 'Hiring & Engagement', subtitle: 'Direct Access & Engagement Structures', targetAudience: 'Prospective Clients & Partners', purpose: 'Advisory sprint rates, fractional director terms, and scopes of work', accessTier: 'CONTROLLED_REQUEST', visibility: 'GATED', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M02', 'M03', 'M07'], viewCount: 310, isPublished: true, sections: [] },
    { id: 'd09', number: '09', slug: 'marketing-growth', title: 'Marketing & Growth', subtitle: 'Business Systems & Media', targetAudience: 'Media & Community Partners', purpose: 'Public relations, community outreach metrics, and public presentations', accessTier: 'CORE_PUBLIC', visibility: 'PUBLIC', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M03', 'M04', 'M08'], viewCount: 980, isPublished: true, sections: [] },
    { id: 'd10', number: '10', slug: 'ai-cognitive-systems', title: 'AI Systems & Cognitive Coding', subtitle: 'Original Seed Protocol', targetAudience: 'Technology & Enterprise Partners', purpose: 'Cognitive architectures, CAS doctrine implementation, and code synthesis', accessTier: 'CONTROLLED_REQUEST', visibility: 'GATED', syncRule: 'LINKED_TO_AUTHORITY_RECORD', modulesUsed: ['M05', 'M06', 'M08'], viewCount: 220, isPublished: true, sections: [] }
  ],
  activeDossierId: 'd01',

  // ── DIGITAL REAL ESTATE CONNECTORS (Section 6 & 33) ──
  sources: [
    { id: 'LINKEDIN', name: 'LinkedIn Profile', icon: '💼', category: 'PRIMARY', state: 'CONNECTED', accountLabel: 'linkedin.com/in/wdjernigan', recordsDiscovered: 47, filesDiscovered: 0, lastSyncedAt: '2 hours ago' },
    { id: 'GOOGLE_DRIVE', name: 'Google Drive', icon: '📁', category: 'PRIMARY', state: 'CONNECTED', accountLabel: 'WCS Framework IP Drive', recordsDiscovered: 18, filesDiscovered: 23, lastSyncedAt: '1 hour ago' },
    { id: 'WEBSITE', name: 'Website / URL', icon: '🌐', category: 'PRIMARY', state: 'CONNECTED', accountLabel: 'asgcdc.org · wcs-framework.org', recordsDiscovered: 12, filesDiscovered: 4, lastSyncedAt: '3 hours ago' },
    { id: 'UPLOADED_FILES', name: 'Uploaded Documents', icon: '📄', category: 'PRIMARY', state: 'CONNECTED', accountLabel: '14 PDFs, Resumes & Credentials', recordsDiscovered: 32, filesDiscovered: 14, lastSyncedAt: 'Just now' },
    { id: 'GMAIL', name: 'Gmail Correspondence', icon: '📧', category: 'SECONDARY', state: 'CONNECTED', accountLabel: 'Ujimamoja@gmail.com', recordsDiscovered: 9, filesDiscovered: 3, lastSyncedAt: '2 hours ago' },
    { id: 'GOOGLE_CALENDAR', name: 'Google Calendar', icon: '📅', category: 'SECONDARY', state: 'CONNECTED', accountLabel: 'Key Summits & Deployments', recordsDiscovered: 14, filesDiscovered: 0, lastSyncedAt: '4 hours ago' },
    { id: 'GOOGLE_SHEETS', name: 'Google Sheets', icon: '📊', category: 'SECONDARY', state: 'CONNECTED', accountLabel: 'Campus Budget & Outcome Models', recordsDiscovered: 22, filesDiscovered: 5, lastSyncedAt: '1 hour ago' },
    { id: 'TWITTER_X', name: 'Twitter / X', icon: '𝕏', category: 'SECONDARY', state: 'NOT_CONNECTED', recordsDiscovered: 0, filesDiscovered: 0 },
    { id: 'INSTAGRAM', name: 'Instagram', icon: '📸', category: 'SECONDARY', state: 'NOT_CONNECTED', recordsDiscovered: 0, filesDiscovered: 0 },
    { id: 'FACEBOOK', name: 'Facebook', icon: '📘', category: 'SECONDARY', state: 'NOT_CONNECTED', recordsDiscovered: 0, filesDiscovered: 0 },
    { id: 'DROPBOX', name: 'Dropbox', icon: '📦', category: 'CLOUD', state: 'NOT_CONNECTED', recordsDiscovered: 0, filesDiscovered: 0 },
    { id: 'ONEDRIVE', name: 'OneDrive', icon: '☁️', category: 'CLOUD', state: 'NOT_CONNECTED', recordsDiscovered: 0, filesDiscovered: 0 }
  ],

  enrichmentSuggestions: [
    {
      id: 'enr-1',
      source: 'GOOGLE_CALENDAR',
      detectedAt: '2026-03-14',
      title: 'National CHW Summit Presentation',
      description: 'Google Calendar detected you presented on Medicaid Integration at the Summit on March 14. Add to Backstop & Compliance?',
      proposedObjectType: 'OUTPUT',
      proposedModuleCodes: ['M07', 'M08'],
      status: 'PENDING'
    },
    {
      id: 'enr-2',
      source: 'GOOGLE_DRIVE',
      detectedAt: '2026-03-12',
      title: 'Q1 Workforce Pipeline Outcomes Spreadsheet',
      description: 'Google Drive detected new file "Q1_Workforce_Outcomes.xlsx" containing verified graduate metrics. Add to Verifiable Evidence?',
      proposedObjectType: 'EVIDENCE',
      proposedModuleCodes: ['M08'],
      status: 'PENDING'
    },
    {
      id: 'enr-3',
      source: 'GMAIL',
      detectedAt: '2026-03-08',
      title: 'Anthem LOI Confirmation',
      description: 'Gmail detected confirmed executed letter of intent for $1M Advent UMC partnership. Update Active Implementation?',
      proposedObjectType: 'AGREEMENT',
      proposedModuleCodes: ['M04'],
      status: 'PENDING'
    }
  ],

  // ── DESIGN SYSTEM & TEMPLATE (Section 20) ──
  pageDesign: {
    template: 'STUDIO',
    accentColor: '#5C6E3A', // Olive Green baseline
    fontHeading: 'Cormorant Garamond',
    fontBody: 'Outfit',
    heroHeadline: 'Your work is too big for a resume. Build a system instead.',
    heroTagline: 'William Darnell Jernigan IV — Director of Workforce, Program & Community Health Systems. 10+ years architecting cross-sector systems.',
    callsToAction: [
      { id: 'cta-1', label: 'Request Strategy Briefing', actionType: 'REQUEST_MEETING', target: '#contact', style: 'PRIMARY', enabled: true },
      { id: 'cta-2', label: 'Inspect Executive Dossiers', actionType: 'OPEN_DOSSIER', target: '#dossiers', style: 'OUTLINE', enabled: true }
    ],
    exposedModuleIds: ['mod-1', 'mod-2', 'mod-3', 'mod-4', 'mod-5', 'mod-6', 'mod-7', 'mod-8'],
    publicDossierIds: ['d01', 'd02', 'd03', 'd09']
  },

  // ── DOMAINS & PUBLISHING (Section 24-30) ──
  domainConfig: {
    freeSlugUrl: 'pasplatform.com/william-darnell-jernigan',
    subdomainUrl: 'darnell.pasplatform.com',
    customDomainUrl: 'authority.wcs-framework.org',
    canonicalLevel: 'LEVEL_2_SUBDOMAIN',
    dnsTxtRecord: 'pas-verify=7f8a92bc13d5_auth',
    cnameTarget: 'cname.pasplatform.com',
    sslStatus: 'ACTIVE'
  },
  publicationSnapshots: [
    {
      version: 1,
      publishedAt: '2026-02-15T10:00:00Z',
      publishedBy: 'William Darnell Jernigan IV',
      changeSummary: 'Initial publication of 8 core modules and 10 executive dossiers.',
      activeDomain: 'darnell.pasplatform.com',
      objectCount: 5,
      dossierCount: 10
    }
  ],
  isDraftModified: false,

  // ── BUSINESS PAS (BPAS) OPERATIONAL STATE (Sections 54-65) ──
  bpas: {
    organizationName: 'Whole Community Solutions',
    missionStatement: 'A multi-entity operating partnership delivering campus-based housing, healthcare, and workforce transformation.',
    activeCampus: 'Advent UMC Campus · Las Vegas, NV',
    entities: [
      { id: 'ent-1', name: 'A Solution Group CDC', legalStructure: '501C3', status: 'ACTIVE', roleInEcosystem: 'Community Operating System (CHW & Workforce)', leadPersonId: 'wdjiv' },
      { id: 'ent-2', name: "Founder's IP LLC", legalStructure: 'LLC', status: 'PENDING_FORMATION', roleInEcosystem: 'WCS Framework IP & Licensing', leadPersonId: 'wdjiv' },
      { id: 'ent-3', name: "Jamie's Medical Entity", legalStructure: 'PC_PLLC', status: 'PENDING_FORMATION', roleInEcosystem: 'Clinical Operations & Medicaid FFS Billing', leadPersonId: 'jamie' },
      { id: 'ent-4', name: 'KG Development', legalStructure: 'FOR_PROFIT_CORP', status: 'ACTIVE', roleInEcosystem: 'Physical Asset Builder & Housing Delivery', leadPersonId: 'anthony' },
      { id: 'ent-5', name: 'WCS Health Management', legalStructure: 'MSO', status: 'PENDING_FORMATION', roleInEcosystem: 'Administrative & Management Services', leadPersonId: 'wdjiv' }
    ],
    teamMembers: [
      { id: 'tm-1', name: 'The Founder', role: 'WCS Architect & Executive Director', personalPASSlug: 'william-darnell-jernigan', isLinked: true, accessLevel: 'FULL_ADMIN' },
      { id: 'tm-2', name: 'Jamie', role: 'Nurse Practitioner & Clinical Lead', personalPASSlug: 'jamie-np', isLinked: true, accessLevel: 'CLINICAL' },
      { id: 'tm-3', name: 'Anthony', role: 'KG Development Principal', personalPASSlug: 'anthony-kg', isLinked: true, accessLevel: 'OPERATIONAL' },
      { id: 'tm-4', name: 'Darnell', role: 'CHW Field Navigator', personalPASSlug: 'darnell-chw', isLinked: true, accessLevel: 'FIELD' }
    ],
    proposals: [
      { id: 'prop-1', title: 'Anthem Nevada Clinical Sponsorship', targetPartner: 'Anthem Nevada', totalAskAmount: '$1,000,000', status: 'IN_PROGRESS', deliverables: ['$500K Clinic Infrastructure', '$500K Childcare Facility', 'Annual Return: $2M–$3.4M'], linkedDossierIds: ['d04', 'd06'] }
    ],
    trackerTasks: [
      { id: 't-1', category: 'Pre-Development', name: 'Site Plan Approval Advent UMC', status: 'DONE', assignedTo: 'Anthony' },
      { id: 't-2', category: 'Pre-Development', name: 'LIHTC QAP Application Submission', status: 'DONE', assignedTo: 'Anthony' },
      { id: 't-3', category: 'Agreements', name: 'IP Ownership & License Agreement', status: 'IN_PROGRESS', assignedTo: 'The Founder' },
      { id: 't-4', category: 'Agreements', name: 'Conflicts of Interest Policy', status: 'NOT_STARTED', assignedTo: 'The Founder' },
      { id: 't-5', category: 'Clinical', name: 'Medicaid FFS Enrollment Filing', status: 'IN_PROGRESS', assignedTo: 'Jamie' },
      { id: 't-6', category: 'Clinical', name: 'HEDIS Metric Protocol Definition', status: 'NOT_STARTED', assignedTo: 'Jamie' },
      { id: 't-7', category: 'Workforce', name: 'CHW-1 Training Cohort 1 Onboarding', status: 'ATTENTION', assignedTo: 'Darnell' }
    ],
    revenueStreams: [
      { id: 'rev-1', name: 'Medicaid Fee-for-Service Billing', entityId: 'ent-3', annualEstimate: '$400K–$800K/yr', sourceType: 'MEDICAID' },
      { id: 'rev-2', name: 'Federal & State Program Grants', entityId: 'ent-1', annualEstimate: '$200K–$500K/yr', sourceType: 'GRANTS' },
      { id: 'rev-3', name: 'LIHTC Developer Fee Allocation', entityId: 'ent-4', annualEstimate: '$1.5M–$2.8M (Milestone)', sourceType: 'CAPITAL' },
      { id: 'rev-4', name: 'WCS Framework Licensing & Royalties', entityId: 'ent-2', annualEstimate: '$150K–$350K/yr', sourceType: 'LICENSING' }
    ],
    agreements: [
      { id: 'agr-1', number: '01', name: 'IP Ownership & Master Licensing Agreement', tier: 'TIER_1_PRE_FUNDING', status: 'IN_PROGRESS', parties: ["Founder's IP LLC", 'ASG CDC', 'KG Dev'] },
      { id: 'agr-2', number: '02', name: 'Conflicts of Interest & Fiduciary Policy', tier: 'TIER_1_PRE_FUNDING', status: 'NOT_STARTED', parties: ['ASG CDC Board', 'Executive Director'] },
      { id: 'agr-3', number: '03', name: 'Executive Director Employment Agreement', tier: 'TIER_1_PRE_FUNDING', status: 'NOT_STARTED', parties: ['ASG CDC', 'The Founder'] },
      { id: 'agr-4', number: '04', name: 'Co-Developer Master Agreement', tier: 'TIER_1_PRE_FUNDING', status: 'SIGNED', parties: ['ASG CDC', 'KG Development'] }
    ]
  },

  // ── FELLOWSHIP & MARKETPLACE (Sections 35-53) ──
  peerEndorsements: [
    {
      id: 'pe-1',
      endorserName: 'Roberto Lopez',
      endorserTitle: 'National Director',
      endorserOrg: 'Community Health Worker Alliance',
      endorserPASUrl: 'pasplatform.com/roberto-lopez',
      targetObjectId: 'auth-wcs-framework',
      targetObjectName: 'Whole Community Solution (WCS) Framework',
      relationshipType: 'recognized',
      comment: 'The Solutionologist network concept — three tiers of community workers deployed through a single trusted CHW relationship — is the most sophisticated integration model I have evaluated nationally.',
      createdAt: '1 week ago',
      attachmentType: 'PRESENTATION',
      attachmentUrl: 'National_CHW_Models_Comparison.pptx'
    },
    {
      id: 'pe-2',
      endorserName: 'Sarah Kowalski',
      endorserTitle: 'LIHTC Program Director',
      endorserOrg: 'Nevada Housing Division',
      endorserPASUrl: 'pasplatform.com/sarah-kowalski',
      targetObjectId: 'auth-advent-campus',
      targetObjectName: 'Advent UMC Campus Development',
      relationshipType: 'reviewed',
      comment: 'The co-developer model with integrated nonprofit services at the campus level is precisely what QAP scoring was designed to incentivize. Legal agreement sequencing demonstrates institutional-grade planning.',
      createdAt: '5 days ago',
      attachmentType: 'PDF',
      attachmentUrl: 'QAP_Scoring_Analysis_Advent.pdf'
    },
    {
      id: 'pe-3',
      endorserName: 'Dr. James Mitchell',
      endorserTitle: 'Director of Community Health',
      endorserOrg: 'Anthem Nevada',
      endorserPASUrl: 'pasplatform.com/james-mitchell',
      targetObjectId: 'auth-wcs-framework',
      targetObjectName: 'Whole Community Solution (WCS) Framework',
      relationshipType: 'adopted',
      comment: 'Reviewed the WCS architecture and workforce pipeline design. The 9-pillar integration model with CHW-driven benefits activation represents an institutional-grade delivery system.',
      createdAt: '2 days ago',
      attachmentType: 'VIDEO',
      attachmentUrl: 'WCS_Framework_Walkthrough.mp4'
    }
  ],

  marketplaceProducts: [
    {
      id: 'prod-1',
      title: 'The Community Health Worker Integration Blueprint',
      type: 'FREE_BLUEPRINT',
      priceUsd: 0,
      description: '32-page guide on designing a high-acuity CHW program billing to Medicaid under clinical supervision.',
      pageCountOrDuration: 'PDF · 32 pages',
      downloadsOrEnrollments: 847,
      revenueGeneratedUsd: 0,
      linkedModuleCodes: ['M05'],
      linkedAuthorityObjectIds: ['auth-wcs-framework', 'auth-chw-cert'],
      isPublished: true
    },
    {
      id: 'prod-2',
      title: 'WCS Framework Masterclass',
      type: 'VIDEO_COURSE',
      priceUsd: 299,
      description: '6-module video curriculum on cross-sector community health and housing campus design.',
      pageCountOrDuration: 'Video · 4.5 hours',
      downloadsOrEnrollments: 8,
      revenueGeneratedUsd: 2392,
      linkedModuleCodes: ['M05', 'M08'],
      linkedAuthorityObjectIds: ['auth-wcs-framework'],
      isPublished: true
    },
    {
      id: 'prod-3',
      title: 'MCO Partnership Proposal Toolkit',
      type: 'PAID_TOOLKIT',
      priceUsd: 149,
      description: 'Complete presentation template, LOI sequencing, and financial models for pitching managed care health plans.',
      pageCountOrDuration: 'Templates + Walkthrough',
      downloadsOrEnrollments: 4,
      revenueGeneratedUsd: 596,
      linkedModuleCodes: ['M04', 'M08'],
      linkedAuthorityObjectIds: ['auth-anthem-loi'],
      isPublished: true
    }
  ],

  // ── MASTER ADMIN (Section 68) ──
  adminMetrics: {
    totalUsers: 12847,
    publishedPASCount: 9234,
    businessPASCount: 1847,
    mrrUsd: 148000,
    pendingTier3Verifications: 7
  },

  // ── ACTIONS ──
  setEnvironment: (env) => set({ environment: env }),
  setActiveRoute: (route) => set({ activeRoute: route }),
  setBuilderStage: (stage) => set({ builderStage: stage }),
  setActiveDossierId: (id) => set({ activeDossierId: id }),

  addAuthorityObject: (obj) => set((state) => ({
    authorityObjects: [obj, ...state.authorityObjects],
    isDraftModified: true
  })),

  updateAuthorityObject: (id, updates) => set((state) => ({
    authorityObjects: state.authorityObjects.map(o => o.id === id ? { ...o, ...updates, updatedAt: new Date().toISOString() } : o),
    isDraftModified: true
  })),

  deleteAuthorityObject: (id) => set((state) => ({
    authorityObjects: state.authorityObjects.filter(o => o.id !== id),
    isDraftModified: true
  })),

  addGraphEdge: (edge) => set((state) => ({
    graphEdges: [edge, ...state.graphEdges],
    isDraftModified: true
  })),

  updateModule: (id, updates) => set((state) => ({
    modules: state.modules.map(m => m.id === id ? { ...m, ...updates } : m),
    isDraftModified: true
  })),

  updateDossier: (id, updates) => set((state) => ({
    dossiers: state.dossiers.map(d => d.id === id ? { ...d, ...updates } : d),
    isDraftModified: true
  })),

  setDossierAccessTier: (dossierId, tier) => set((state) => ({
    dossiers: state.dossiers.map(d => d.id === dossierId ? { ...d, accessTier: tier } : d),
    isDraftModified: true
  })),

  addDossier: (dossier) => set((state) => ({
    dossiers: [...state.dossiers, dossier],
    isDraftModified: true
  })),

  updatePageDesign: (updates) => set((state) => ({
    pageDesign: { ...state.pageDesign, ...updates },
    isDraftModified: true
  })),

  connectSource: (platform) => set((state) => ({
    sources: state.sources.map(s => s.id === platform ? { ...s, state: 'CONNECTED', lastSyncedAt: 'Just now' } : s),
    isDraftModified: true
  })),

  acceptEnrichment: (id) => set((state) => {
    const item = state.enrichmentSuggestions.find(e => e.id === id);
    if (!item) return state;
    
    // Create new authority object from suggestion
    const newObj: AuthorityObject = {
      id: `auth-${Date.now()}`,
      name: item.title,
      type: item.proposedObjectType,
      summary: item.description,
      sources: [item.source],
      evidenceIds: [],
      confidenceScore: 90,
      provenance: 'SOURCE_CONFIRMED',
      workflowState: 'PUBLISH_READY',
      visibility: 'PUBLIC',
      associatedModuleCodes: item.proposedModuleCodes,
      associatedDossierIds: ['d01'],
      relationships: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      authorityObjects: [newObj, ...state.authorityObjects],
      enrichmentSuggestions: state.enrichmentSuggestions.map(e => e.id === id ? { ...e, status: 'ACCEPTED' } : e),
      isDraftModified: true
    };
  }),

  dismissEnrichment: (id) => set((state) => ({
    enrichmentSuggestions: state.enrichmentSuggestions.map(e => e.id === id ? { ...e, status: 'DISMISSED' } : e)
  })),

  publishPAS: (summary) => set((state) => {
    const newSnapshot: PublicationSnapshot = {
      version: state.publicationSnapshots.length + 1,
      publishedAt: new Date().toISOString(),
      publishedBy: state.userName,
      changeSummary: summary || 'System publication update',
      activeDomain: state.domainConfig.subdomainUrl,
      objectCount: state.authorityObjects.length,
      dossierCount: state.dossiers.length
    };

    return {
      publicationSnapshots: [newSnapshot, ...state.publicationSnapshots],
      isDraftModified: false
    };
  })
}));
