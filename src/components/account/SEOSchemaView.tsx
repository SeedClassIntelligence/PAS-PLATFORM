import React from 'react';
import { usePASStore } from '../../store/usePASStore';

export function SEOSchemaView() {
  const { userName, userTitle, userLocation, userBio, authorityObjects, domainConfig } = usePASStore();

  const generatedSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `https://${domainConfig.subdomainUrl}/#person`,
        "name": userName,
        "jobTitle": userTitle,
        "description": userBio,
        "url": `https://${domainConfig.subdomainUrl}/`,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": userLocation.split(',')[0]?.trim() || "Las Vegas",
          "addressRegion": userLocation.split(',')[1]?.trim() || "NV",
          "addressCountry": "US"
        },
        "knowsAbout": authorityObjects.map(o => o.name),
        "hasCredential": authorityObjects.filter(o => o.type === 'CREDENTIAL').map(c => ({
          "@type": "EducationalOccupationalCredential",
          "name": c.name,
          "credentialCategory": "Professional Certification"
        }))
      },
      {
        "@type": "ProfilePage",
        "@id": `https://${domainConfig.subdomainUrl}/#page`,
        "name": `Professional Authority System — ${userName}`,
        "description": `An inspectable 8-module authority system for ${userName}.`,
        "about": { "@id": `https://${domainConfig.subdomainUrl}/#person` }
      }
    ]
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#FFF', margin: '0 0 6px 0' }}>
          Search Readiness & AI Schema Engine (Sections 31 & 32)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Structural discoverability for Google, Bing, GPTBot, ClaudeBot, Perplexity, and Gemini. Generating machine-readable Schema.org graphs in real time.
        </p>
      </div>

      {/* ── STATUS BOX ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: '#4A8A58', fontWeight: '700', textTransform: 'uppercase' }}>Active Schema Graph</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFF', margin: '4px 0' }}>Person + ProfilePage</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Linked to {authorityObjects.length} Authority Nodes</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: '#4A8A58', fontWeight: '700', textTransform: 'uppercase' }}>AI Crawlers Status</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFF', margin: '4px 0' }}>Index Permitted</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>GPTBot, ClaudeBot, Perplexity Active</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: '#4A8A58', fontWeight: '700', textTransform: 'uppercase' }}>Canonical Target</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#D4AF37', margin: '4px 0' }}>{domainConfig.subdomainUrl}</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Permanent Edge Routing</div>
        </div>
      </div>

      {/* ── JSON-LD SCHEMA INSPECTOR ── */}
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Live Compiled application/ld+json Graph
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(generatedSchema, null, 2));
              alert('Copied JSON-LD Schema to clipboard!');
            }}
            style={{ background: '#1E2024', color: '#D4AF37', border: '1px solid #26292E', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
            Copy JSON-LD Schema
          </button>
        </div>

        <pre style={{ background: '#0C0D0E', border: '1px solid #26292E', borderRadius: '8px', padding: '18px', color: '#A3E635', fontSize: '12px', overflowX: 'auto', maxHeight: '420px', lineHeight: '1.6' }}>
          {JSON.stringify(generatedSchema, null, 2)}
        </pre>
      </div>

    </div>
  );
}
