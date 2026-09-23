import React from 'react';
import { usePASStore } from '../../store/usePASStore';

export function ConnectionsManager() {
  const { sources, enrichmentSuggestions, acceptEnrichment, dismissEnrichment, connectSource } = usePASStore();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#FFF', margin: '0 0 6px 0' }}>
          Connections Management & Continuous Enrichment (Sections 33 & 34)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Connected sources serve two purposes: initial automated build and ongoing enrichment. Your PAS remains living because it's connected to where your work actually occurs.
        </p>
      </div>

      {/* ── ACTIVE CONNECTIONS LIST ── */}
      <div style={{ marginBottom: '36px' }}>
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4AF37', margin: '0 0 14px 0' }}>
          Authorized Data & Document Sources
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sources.map(s => (
            <div key={s.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '24px' }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#FFF' }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.accountLabel || 'Not configured'} · Last sync: {s.lastSyncedAt || 'Never'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  background: s.state === 'CONNECTED' ? 'rgba(74,138,88,0.15)' : '#1E2024',
                  color: s.state === 'CONNECTED' ? '#4A8A58' : '#9CA3AF',
                  border: `1px solid ${s.state === 'CONNECTED' ? 'rgba(74,138,88,0.3)' : '#26292E'}`
                }}>
                  {s.state}
                </span>
                {s.state !== 'CONNECTED' && (
                  <button 
                    onClick={() => connectSource(s.id)}
                    style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ENRICHMENT SUGGESTIONS ── */}
      <div>
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3A7A6A', margin: '0 0 14px 0' }}>
          Continuous Enrichment Suggestions (Section 34)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {enrichmentSuggestions.map(e => (
            <div key={e.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 8px', borderRadius: '3px', background: 'rgba(58,122,106,0.15)', color: '#3A7A6A' }}>{e.source}</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#FFF' }}>{e.title}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>{e.description}</div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {e.status === 'PENDING' ? (
                  <>
                    <button 
                      onClick={() => acceptEnrichment(e.id)}
                      style={{ background: '#4A8A58', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                      Accept & Append to Graph
                    </button>
                    <button 
                      onClick={() => dismissEnrichment(e.id)}
                      style={{ background: '#1E2024', color: '#9CA3AF', border: '1px solid #26292E', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                      Dismiss
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: '#4A8A58', fontWeight: '600' }}>✓ {e.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
