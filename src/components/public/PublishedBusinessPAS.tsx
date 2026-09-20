import React, { useState } from 'react';
import { usePASStore } from '../../store/usePASStore';

export function PublishedBusinessPAS() {
  const { bpas, setEnvironment, setActiveRoute } = usePASStore();
  const [activeTab, setActiveTab] = useState<'ENTITIES' | 'PILLARS' | 'PROPOSALS' | 'TRACKER' | 'REVENUE' | 'AGREEMENTS'>('ENTITIES');

  return (
    <div style={{ background: '#F5F0E8', color: '#1A1410', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      
      {/* ── ENVIRONMENT CONTROL HEADER ── */}
      <div style={{ background: '#111215', color: '#3A7A6A', padding: '6px 20px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #26292E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#3A7A6A', color: '#FFF', padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: '700' }}>PUBLISHED BPAS VIEW</span>
          <span style={{ color: '#9CA3AF' }}>Organization: <strong>wcs-framework.org · authority.wcs-framework.org</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setEnvironment('AUTHENTICATED_APP')} style={{ background: '#26292E', color: '#FFF', border: 'none', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>
            ← Return to Console
          </button>
          <button onClick={() => setEnvironment('PUBLISHED_PERSONAL_PAS')} style={{ background: '#5C6E3A', color: '#FFF', border: 'none', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>
            View Linked Founder PAS →
          </button>
        </div>
      </div>

      {/* ── TOP NAVIGATION ── */}
      <nav style={{ background: 'rgba(245,240,232,0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(154,104,0,0.15)', height: '54px', display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: '700', color: '#9A6800', letterSpacing: '0.02em' }}>
            {bpas.organizationName}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['ENTITIES', 'PILLARS', 'PROPOSALS', 'TRACKER', 'REVENUE', 'AGREEMENTS'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? 'rgba(154,104,0,0.1)' : 'transparent',
                  color: activeTab === tab ? '#9A6800' : '#8A7A68',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #9A6800' : '2px solid transparent',
                  padding: '8px 14px',
                  fontSize: '11px',
                  fontWeight: activeTab === tab ? '700' : '500',
                  textTransform: 'uppercase',
                  cursor: 'pointer'
                }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: 'rgba(74,138,88,0.1)', color: '#1A5A30', fontWeight: '600', border: '1px solid rgba(74,138,88,0.2)' }}>
          Active Campus: Advent UMC
        </span>
      </nav>

      {/* ── HERO BANNER ── */}
      <div style={{ padding: '64px 32px 48px', borderBottom: '1px solid rgba(154,104,0,0.15)', background: 'linear-gradient(160deg, #F5F0E8 0%, #EDE6DA 100%)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9A6800', fontWeight: '700', marginBottom: '12px' }}>
            Business Professional Authority System
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '48px', fontWeight: '400', margin: '0 0 16px 0', lineHeight: 1.1, color: '#1A1410' }}>
            Your organization is more than an <em>about page.</em>
          </h1>
          <p style={{ fontSize: '16px', color: '#5A4A38', maxWidth: '780px', lineHeight: '1.8', margin: '0 0 28px 0', fontWeight: '300' }}>
            {bpas.missionStatement} An inspectable operational system linking real entities, agreements, revenue architecture, and verified team authority.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            <div style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#9A6800', fontWeight: '400' }}>{bpas.entities.length}</div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8A7A68', letterSpacing: '0.08em' }}>Operating Entities</div>
            </div>
            <div style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#0A6058', fontWeight: '400' }}>$1.0M</div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8A7A68', letterSpacing: '0.08em' }}>Anthem Ask Awarded</div>
            </div>
            <div style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#1B4F8A', fontWeight: '400' }}>50</div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8A7A68', letterSpacing: '0.08em' }}>Campus Housing Units</div>
            </div>
            <div style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#B83A20', fontWeight: '400' }}>{bpas.teamMembers.length}</div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8A7A68', letterSpacing: '0.08em' }}>Linked Team Profiles</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 32px' }}>
        
        {/* ENTITIES VIEW */}
        {activeTab === 'ENTITIES' && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#1A1410', margin: '0 0 8px 0' }}>Multi-Entity Corporate Architecture</h2>
            <p style={{ fontSize: '13px', color: '#5A4A38', margin: '0 0 24px 0' }}>The legal and operational structure governing campus asset delivery and service streams.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {bpas.entities.map(ent => (
                <div key={ent.id} style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.15)', borderRadius: '10px', padding: '20px', borderTop: '4px solid #9A6800' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '3px', background: 'rgba(154,104,0,0.1)', color: '#9A6800' }}>{ent.legalStructure}</span>
                    <span style={{ fontSize: '9px', fontWeight: '600', color: '#1A5A30' }}>✓ {ent.status}</span>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1410', marginBottom: '6px' }}>{ent.name}</div>
                  <div style={{ fontSize: '12px', color: '#5A4A38', lineHeight: '1.6' }}>{ent.roleInEcosystem}</div>
                </div>
              ))}
            </div>

            {/* Linked Team */}
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '24px', color: '#1A1410', margin: '36px 0 16px 0' }}>Linked Team Authority Profiles</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {bpas.teamMembers.map(tm => (
                <div key={tm.id} style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.15)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EDE6DA', border: '2px solid #9A6800', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#9A6800' }}>
                    {tm.name.charAt(0)}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1410' }}>{tm.name}</div>
                  <div style={{ fontSize: '11px', color: '#8A7A68', marginTop: '2px' }}>{tm.role}</div>
                  <div style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(74,138,88,0.1)', color: '#1A5A30', display: 'inline-block', marginTop: '8px', fontWeight: '600' }}>
                    ✓ PAS Linked
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROPOSALS VIEW */}
        {activeTab === 'PROPOSALS' && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#1A1410', margin: '0 0 8px 0' }}>High-Stakes Proposals & Asks</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {bpas.proposals.map(prop => (
                <div key={prop.id} style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.2)', borderRadius: '10px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1410' }}>{prop.title}</div>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#9A6800' }}>{prop.totalAskAmount}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#5A4A38', marginBottom: '12px' }}>Partner Target: <strong>{prop.targetPartner}</strong></div>
                  <div style={{ fontSize: '12px', color: '#8A7A68', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '700' }}>Key Deliverables:</div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#5A4A38' }}>
                    {prop.deliverables.map((d, i) => <li key={i} style={{ marginBottom: '4px' }}>{d}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TRACKER VIEW */}
        {activeTab === 'TRACKER' && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#1A1410', margin: '0 0 8px 0' }}>Campus Build Tracker</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bpas.trackerTasks.map(t => (
                <div key={t.id} style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.15)', borderRadius: '6px', padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#8A7A68', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '10px' }}>{t.category}</span>
                    <strong style={{ fontSize: '13px', color: '#1A1410' }}>{t.name}</strong>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: t.status === 'DONE' ? 'rgba(74,138,88,0.1)' : t.status === 'IN_PROGRESS' ? 'rgba(154,104,0,0.1)' : '#EEE',
                    color: t.status === 'DONE' ? '#1A5A30' : t.status === 'IN_PROGRESS' ? '#9A6800' : '#666'
                  }}>
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REVENUE VIEW */}
        {activeTab === 'REVENUE' && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#1A1410', margin: '0 0 8px 0' }}>Revenue Architecture</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {bpas.revenueStreams.map(rev => (
                <div key={rev.id} style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.15)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1410' }}>{rev.name}</div>
                    <div style={{ fontSize: '11px', color: '#8A7A68' }}>Category: {rev.sourceType}</div>
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: '700', color: '#9A6800' }}>
                    {rev.annualEstimate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AGREEMENTS VIEW */}
        {activeTab === 'AGREEMENTS' && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#1A1410', margin: '0 0 8px 0' }}>Sequenced Agreement Roadmap</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bpas.agreements.map(agr => (
                <div key={agr.id} style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.15)', borderRadius: '8px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '18px', color: '#8A7A68', fontWeight: '700' }}>{agr.number}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1410' }}>{agr.name}</div>
                      <div style={{ fontSize: '11px', color: '#8A7A68' }}>Parties: {agr.parties.join(' · ')}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: agr.status === 'SIGNED' ? 'rgba(74,138,88,0.1)' : 'rgba(154,104,0,0.1)', color: agr.status === 'SIGNED' ? '#1A5A30' : '#9A6800' }}>
                    {agr.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PILLARS VIEW */}
        {activeTab === 'PILLARS' && (
          <div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#1A1410', margin: '0 0 8px 0' }}>The 9 Pillars of Whole Community Solutions</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {['1. Housing & Economic Development', '2. Behavioral & Mental Health', '3. Workforce Skills & Technology', '4. Cultural Heritage & Creative Economy', '5. Physical Health & Clinical Home', '6. Education & Reentry Stabilization', '7. Environmental & Sustainable Infrastructure', '8. Transit & Mobility Equity', '9. Civic Engagement & Public Governance'].map((p, i) => (
                <div key={i} style={{ background: '#FFFDF9', border: '1px solid rgba(154,104,0,0.15)', borderRadius: '8px', padding: '16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1A1410' }}>
                  {p}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
