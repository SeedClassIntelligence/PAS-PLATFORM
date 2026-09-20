/**
 * EXECUTIVE PRODUCTION STUDIO SERVICE
 * Generates presentation decks (PowerPoints), video briefing scripts, and media packages directly from authority records.
 */

import { Dossier, PASModule, AuthorityObject } from '../../types/pas';

export interface SlideDefinition {
  slideNumber: number;
  title: string;
  category: string;
  bulletPoints: string[];
  calloutMetric?: string;
  evidentiaryNote?: string;
}

export interface PresentationDeck {
  deckTitle: string;
  targetAudience: string;
  generatedAt: string;
  slides: SlideDefinition[];
  exportFormat: 'PPTX' | 'PDF';
}

export interface VideoBriefingScript {
  title: string;
  durationEstimateMinutes: number;
  targetModuleCodes: string[];
  teleprompterSections: {
    heading: string;
    targetSeconds: number;
    scriptText: string;
    bRollInstructions: string;
  }[];
}

export class ExecutiveProductionStudio {
  /**
   * Generates a boardroom PowerPoint deck directly from a Dossier
   */
  public static generateDeckFromDossier(dossier: Dossier, objects: AuthorityObject[]): PresentationDeck {
    const relevantObjects = objects.filter(o => 
      dossier.modulesUsed.some(m => o.associatedModuleCodes.includes(m))
    );

    const slides: SlideDefinition[] = [
      {
        slideNumber: 1,
        title: `${dossier.title} — ${dossier.subtitle}`,
        category: 'EXECUTIVE OVERVIEW',
        bulletPoints: [
          `Prepared for: ${dossier.targetAudience}`,
          `Access Clearance: ${dossier.accessTier.replace('_', ' ')}`,
          `Operational Purpose: ${dossier.purpose}`
        ],
        calloutMetric: '10+ YRS',
        evidentiaryNote: 'Compiled from verified PAS authority objects.'
      },
      ...relevantObjects.slice(0, 5).map((obj, idx) => ({
        slideNumber: idx + 2,
        title: obj.name,
        category: obj.type,
        bulletPoints: [
          obj.summary,
          `Confidence Score: ${obj.confidenceScore}% · Provenance: ${obj.provenance}`,
          `Sources: ${obj.sources.join(' · ')}`
        ],
        calloutMetric: `${obj.confidenceScore}%`,
        evidentiaryNote: `Evidence IDs: ${obj.evidenceIds.join(', ') || 'Direct Ingestion'}`
      })),
      {
        slideNumber: relevantObjects.length + 2,
        title: 'Engagement & Partnership Scopes',
        category: 'ACTION & GOVERNANCE',
        bulletPoints: [
          'Direct advisory sprints and institutional retainers',
          'Cross-sector campus integration and deployment agreements',
          'Continuous auditability through the PAS network'
        ],
        evidentiaryNote: 'Official PAS deployment record.'
      }
    ];

    return {
      deckTitle: `${dossier.title} Executive Deck`,
      targetAudience: dossier.targetAudience,
      generatedAt: new Date().toISOString(),
      slides,
      exportFormat: 'PPTX'
    };
  }

  /**
   * Generates an Executive Video Briefing Script for syndication into the Fellowship feed
   */
  public static generateVideoBriefingScript(dossier: Dossier, userName: string): VideoBriefingScript {
    return {
      title: `${dossier.title} — Executive Video Briefing`,
      durationEstimateMinutes: 3.5,
      targetModuleCodes: dossier.modulesUsed,
      teleprompterSections: [
        {
          heading: '01. The Problem & Operational Hook',
          targetSeconds: 45,
          scriptText: `Hello, I'm ${userName}. When evaluating high-stakes community and health initiatives, traditional resumes fail to capture the operational complexity. Today I'm walking through ${dossier.title}, constructed specifically for ${dossier.targetAudience}.`,
          bRollInstructions: 'Camera on speaker with title lower-third displaying PAS verification badge.'
        },
        {
          heading: '02. Systems Architecture & Implementation Proof',
          targetSeconds: 90,
          scriptText: `Our work is not theoretical. Across Module ${dossier.modulesUsed.join(' and ')}, we have structured verified agreements, physical campus builds, and clinical reimbursement pipelines that reinforce community longevity.`,
          bRollInstructions: 'Cut to screen capture of the interactive PAS module lenses and campus blueprint.'
        },
        {
          heading: '03. Call to Action & Due Diligence Access',
          targetSeconds: 45,
          scriptText: `You can inspect every underlying contract, license, and peer vouch directly on my PAS domain. Let's schedule a strategic briefing to discuss active execution.`,
          bRollInstructions: 'Display QR code and canonical PAS subdomain URL.'
        }
      ]
    };
  }
}
