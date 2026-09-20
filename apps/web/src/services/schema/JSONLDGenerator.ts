/**
 * JSON-LD SCHEMA.ORG GENERATOR SERVICE
 * Real-time Structured Data Engine for Google Knowledge Graph & AI Search Bots (Perplexity/ChatGPT/Claude/Gemini)
 */

import { AuthorityObject } from '../../types/pas';

export class JSONLDGenerator {
  public static generateGraphSchema(
    fullName: string,
    aliases: string[],
    jobTitle: string,
    canonicalDomain: string,
    authorityObjects: AuthorityObject[],
    description: string
  ): string {
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Person",
          "@id": `https://${canonicalDomain}/#person`,
          "name": fullName,
          "alternateName": aliases,
          "jobTitle": jobTitle,
          "description": description,
          "url": `https://${canonicalDomain}/`,
          "knowsAbout": authorityObjects.map(o => o.name),
          "hasCredential": authorityObjects.filter(o => o.type === 'CREDENTIAL').map(c => ({
            "@type": "EducationalOccupationalCredential",
            "name": c.name
          }))
        },
        {
          "@type": "ProfilePage",
          "@id": `https://${canonicalDomain}/#page`,
          "name": `Professional Authority System — ${fullName}`,
          "about": { "@id": `https://${canonicalDomain}/#person` }
        },
        ...authorityObjects.map(obj => ({
          "@type": obj.type === 'ORGANIZATION' 
            ? 'Organization' 
            : obj.type === 'FRAMEWORK' 
            ? 'CreativeWork' 
            : 'Thing',
          "@id": `https://${canonicalDomain}/#${obj.id}`,
          "name": obj.name,
          "description": obj.summary,
          "provenanceState": obj.provenance,
          "confidenceScore": `${obj.confidenceScore}%`
        }))
      ]
    };

    return JSON.stringify(schema, null, 2);
  }
}
