import React from 'react';
import { usePASStore } from '../../store/usePASStore';

export function PublishingCenter() {
  const { domainConfig, publicationSnapshots, publishPAS, setEnvironment } = usePASStore();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px', marginBottom: '28px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#D4AF37', margin: '0 0 4px 0', fontSize: '28px' }}>
          Publishing Center & 3-Level Domain Architecture (Sections 24–30)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Manage web addresses, draft-to-published state transitions, deployment version history, and custom CNAME records.
        </p>
      </div>

      {/* DOMAIN LEVELS */}
      <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4AF37', marginBottom: '14px', fontWeight: '700' }}>
        Active Domain Hierarchy
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#D4AF37', fontWeight: '700', marginBottom: '6px' }}>Level 1 · Free Address</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{domainConfig.freeSlugUrl}</div>
          <div style={{ fontSize: '11px', color: '#4A8A58', marginTop: '6px' }}>✓ Permanent SSL & Search Indexed</div>
        </div>

        <div style={{ background: '#141619', border: '2px solid #D4AF37', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#D4AF37', fontWeight: '700', marginBottom: '6px' }}>Level 2 · Ecosystem Subdomain</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{domainConfig.subdomainUrl}</div>
          <div style={{ fontSize: '11px', color: '#4A8A58', marginTop: '6px' }}>✓ Active Canonical Routing</div>
        </div>

        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#D4AF37', fontWeight: '700', marginBottom: '6px' }}>Level 3 · Custom Domain</div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{domainConfig.customDomainUrl}</div>
          <div style={{ fontSize: '11px', color: '#D4AF37', marginTop: '6px' }}>CNAME: {domainConfig.cnameTarget}</div>
        </div>
      </div>

      {/* PUBLICATION PIPELINE */}
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>Publication Deployment Pipeline</div>
            <div style={{ fontSize: '12px', color: '#9CA3AF' }}>Compiles all 8 canonical modules, 10 dossiers, and JSON-LD graphs to CDN edge.</div>
          </div>
          <button 
            onClick={() => {
              publishPAS('Published manual deployment snapshot.');
              alert('Deployed live to ' + domainConfig.subdomainUrl);
            }}
            style={{ background: '#4A8A58', color: '#FFF', border: 'none', padding: '10px 24px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            ✓ Deploy Live Snapshot
          </button>
        </div>

        {/* VERSION HISTORY (Section 28) */}
        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#D4AF37', margin: '20px 0 10px 0', fontWeight: '700' }}>
          Deployment Version History (Section 28)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {publicationSnapshots.map(snap => (
            <div key={snap.version} style={{ background: '#1E2024', borderRadius: '6px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#D4AF37', marginRight: '10px' }}>v{snap.version}.0</span>
                <span style={{ fontSize: '13px', color: '#FFF' }}>{snap.changeSummary}</span>
                <span style={{ fontSize: '11px', color: '#6B7280', marginLeft: '10px' }}>by {snap.publishedBy}</span>
              </div>
              <span style={{ fontSize: '10px', color: '#4A8A58' }}>✓ Active on {snap.activeDomain}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
