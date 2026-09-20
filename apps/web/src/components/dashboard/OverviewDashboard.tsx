import React from 'react';
import { usePASStore } from '../../store/usePASStore';

export function OverviewDashboard() {
  const { 
    userName, 
    verificationBadge, 
    enrichmentSuggestions, 
    acceptEnrichment, 
    dismissEnrichment,
    setActiveRoute,
    setBuilderStage,
    setEnvironment
  } = usePASStore();

  const pendingSuggestions = enrichmentSuggestions.filter(s => s.status === 'PENDING');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── HEADER STATUS ROW ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#FFF', margin: '0 0 4px 0' }}>
            PAS Executive Dashboard
          </h2>
          <div style={{ fontSize: '13px', color: '#9CA3AF' }}>
            Welcome back, {userName} · System is continuously monitoring connected sources
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => { setActiveRoute('builder'); setBuilderStage(1); }}
            style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
            + Update My PAS
          </button>
          <button 
            onClick={() => setEnvironment('PUBLISHED_PERSONAL_PAS')}
            style={{ background: '#1E2024', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)', padding: '10px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            View Live PAS ↗
          </button>
        </div>
      </div>

      {/* ── STATUS CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '32px' }}>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A8A58', fontWeight: '700' }}>PAS Publication</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFF', margin: '6px 0 2px 0' }}>LIVE & INDEXED</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>8 Modules · 10 Dossiers</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#D4AF37', fontWeight: '700' }}>Verification Badge</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#D4AF37', margin: '6px 0 2px 0' }}>✓✓ {verificationBadge.replace('_', ' ')}</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>5 Peer Vouches Confirmed</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3A7A6A', fontWeight: '700' }}>30-Day Inquiries</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#FFF', lineHeight: 1, margin: '6px 0 2px 0' }}>2,847</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>65% From AI & Google Search</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A86048', fontWeight: '700' }}>Business PAS</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFF', margin: '6px 0 2px 0' }}>WCS Active</div>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>$1M Anthem LOI Linked</div>
        </div>
      </div>

      {/* ── ATTENTION QUEUE: CONTINUOUS ENRICHMENT ── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#D4AF37', fontWeight: '700' }}>
            Continuous Enrichment Queue ({pendingSuggestions.length} Pending Actions)
          </div>
          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Automated background sync with Drive, Gmail & Calendar</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pendingSuggestions.map(item => (
            <div key={item.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '3px', background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
                    {item.source}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#FFF' }}>{item.title}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>{item.description}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => acceptEnrichment(item.id)}
                  style={{ background: '#4A8A58', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                  Add to PAS
                </button>
                <button 
                  onClick={() => dismissEnrichment(item.id)}
                  style={{ background: '#1E2024', color: '#9CA3AF', border: '1px solid #26292E', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                  Later
                </button>
              </div>
            </div>
          ))}
          {pendingSuggestions.length === 0 && (
            <div style={{ background: '#141619', border: '1px dashed #26292E', borderRadius: '8px', padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
              ✓ All background discoveries resolved. Your PAS is fully synchronized with your connected accounts.
            </div>
          )}
        </div>
      </div>

      {/* ── RECENT RECOGNITION & ACTIVITY FEED ── */}
      <div>
        <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9CA3AF', fontWeight: '700', marginBottom: '14px' }}>
          Recent Activity & Verified Inquiries
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ padding: '12px 16px', background: '#141619', border: '1px solid #26292E', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
            <span style={{ fontSize: '16px' }}>⬡</span>
            <span style={{ color: '#FFF' }}>Dr. James Mitchell (Anthem Nevada)</span>
            <span style={{ color: '#9CA3AF' }}>reviewed your WCS Architecture Module</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6B7280' }}>2 days ago</span>
          </div>
          <div style={{ padding: '12px 16px', background: '#141619', border: '1px solid #26292E', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
            <span style={{ fontSize: '16px' }}>🔍</span>
            <span style={{ color: '#FFF' }}>AI Search Query (Perplexity):</span>
            <span style={{ color: '#9CA3AF' }}>"CHW-centered housing healthcare integration" → Cited your PAS</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6B7280' }}>3 days ago</span>
          </div>
          <div style={{ padding: '12px 16px', background: '#141619', border: '1px solid #26292E', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
            <span style={{ fontSize: '16px' }}>💰</span>
            <span style={{ color: '#FFF' }}>Knowledge Marketplace:</span>
            <span style={{ color: '#9CA3AF' }}>New enrollment in WCS Framework Masterclass ($299)</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6B7280' }}>4 days ago</span>
          </div>
        </div>
      </div>

    </div>
  );
}
