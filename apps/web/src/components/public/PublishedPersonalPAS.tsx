import React, { useState, useEffect } from 'react';
import { usePASStore } from '../../store/usePASStore';
import { Dossier, AuthorityObject } from '../../types/pas';

export function PublishedPersonalPAS() {
  const { 
    userName, 
    userTitle, 
    userLocation, 
    userBio, 
    dossiers, 
    activeDossierId, 
    setActiveDossierId,
    authorityObjects,
    pageDesign,
    verificationBadge,
    setEnvironment
  } = usePASStore();

  const [activeTab, setActiveTab] = useState<string>(activeDossierId || 'd01');

  useEffect(() => {
    if (activeDossierId) setActiveTab(activeDossierId);
  }, [activeDossierId]);

  const activeDossier = dossiers.find(d => d.id === activeTab) || dossiers[0];

  // Colors based on template theme
  const isDark = pageDesign.template === 'PRECISION' || pageDesign.template === 'ONYX';
  const bg = isDark ? '#0C0D0E' : '#F4F1EB';
  const cardBg = isDark ? '#141619' : '#FAFAF6';
  const textPrimary = isDark ? '#FFFFFF' : '#0E0E08';
  const textMuted = isDark ? '#9CA3AF' : '#5A5A4A';
  const textDim = isDark ? '#6B7280' : '#8A8A78';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(61,90,42,0.12)';
  const accent = pageDesign.accentColor || '#3D5A2A';

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* ── ENVIRONMENT RETURN BAR (Platform Control) ── */}
      <div style={{ background: '#111215', color: '#D4AF37', padding: '6px 20px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #26292E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#4A8A58', color: '#FFF', padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: '700' }}>LIVE PUBLISHED VIEW</span>
          <span>Canonical Domain: <strong>darnell.pasplatform.com</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setEnvironment('AUTHENTICATED_APP')} style={{ background: '#26292E', color: '#FFF', border: 'none', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>
            ← Return to Builder Console
          </button>
          <button onClick={() => setEnvironment('PUBLISHED_BPAS')} style={{ background: '#3A7A6A', color: '#FFF', border: 'none', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>
            View Linked BPAS →
          </button>
        </div>
      </div>

      {/* ── TOP NAV BAR (#topnav) ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 300, background: isDark ? 'rgba(12,13,14,0.95)' : 'rgba(244,241,235,0.97)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${border}`, height: '54px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: '700', color: accent, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: accent }}></span>
            {userName}
          </div>

          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
            {dossiers.map(d => (
              <button 
                key={d.id} 
                onClick={() => { setActiveTab(d.id); setActiveDossierId(d.id); }}
                style={{
                  background: activeTab === d.id ? (isDark ? 'rgba(212,175,55,0.15)' : 'rgba(61,90,42,0.08)') : 'transparent',
                  border: 'none',
                  color: activeTab === d.id ? accent : textDim,
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: activeTab === d.id ? '600' : '400',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}>
                {d.number} {d.title}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '3px', fontWeight: '600', background: 'rgba(61,90,42,0.1)', color: accent, border: `1px solid ${border}` }}>
            ✓ {verificationBadge.replace('_', ' ')}
          </span>
          <button style={{ background: accent, color: '#FFF', padding: '7px 16px', borderRadius: '4px', border: 'none', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '0.04em' }}>
            Request Briefing
          </button>
        </div>
      </nav>

      {/* ── CONTEXT HUD BAR (#hud) ── */}
      <div style={{ background: isDark ? '#141619' : 'rgba(250,250,246,0.95)', borderBottom: `1px solid ${border}`, height: '38px', display: 'flex', alignItems: 'center', padding: '0 28px', fontSize: '12px', gap: '12px' }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '14px', color: textDim }}>Dossier {activeDossier.number}</span>
        <span style={{ color: textDim }}>/</span>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '14px', fontWeight: '600', color: textPrimary }}>{activeDossier.title} — {activeDossier.subtitle}</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: '600', color: accent }}>
          Audience Clearance: {activeDossier.targetAudience}
        </span>
      </div>

      {/* ── MAIN LAYOUT: SIDE RAIL + DOSSIER CONTENT VIEWPORT ── */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 124px)' }}>
        
        {/* Sticky Side Rail (#rail) */}
        <aside style={{ width: '220px', minWidth: '220px', borderRight: `1px solid ${border}`, background: cardBg, padding: '16px 0', position: 'sticky', top: '92px', height: 'calc(100vh - 92px)', overflowY: 'auto' }}>
          <div style={{ padding: '0 16px 12px', borderBottom: `1px solid ${border}`, marginBottom: '10px' }}>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.18em', color: textDim, fontWeight: '700' }}>Authority Dossiers</div>
            <div style={{ fontSize: '11px', color: textDim, marginTop: '2px' }}>10 Targeted Packages</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dossiers.map(d => (
              <div 
                key={d.id} 
                onClick={() => { setActiveTab(d.id); setActiveDossierId(d.id); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderLeft: activeTab === d.id ? `3px solid ${accent}` : '3px solid transparent',
                  background: activeTab === d.id ? (isDark ? 'rgba(212,175,55,0.1)' : 'rgba(61,90,42,0.06)') : 'transparent',
                  transition: 'all 0.15s'
                }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '17px', color: activeTab === d.id ? accent : textDim, fontWeight: '600', width: '22px' }}>
                  {d.number}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: activeTab === d.id ? accent : textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: '10px', color: textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.subtitle}
                  </div>
                  <span style={{
                    fontSize: '8px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    padding: '1px 5px',
                    borderRadius: '2px',
                    fontWeight: '700',
                    marginTop: '4px',
                    display: 'inline-block',
                    background: d.accessTier === 'CORE_PUBLIC' ? 'rgba(61,90,42,0.1)' : 'rgba(180,83,9,0.1)',
                    color: d.accessTier === 'CORE_PUBLIC' ? accent : '#B45309',
                    border: `1px solid ${border}`
                  }}>
                    {d.accessTier.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px', borderTop: `1px solid ${border}`, marginTop: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: textPrimary }}>{userName}</div>
            <div style={{ fontSize: '10px', color: textDim }}>{userLocation}</div>
          </div>
        </aside>

        {/* Content Viewport (#content) */}
        <main style={{ flex: 1, padding: '48px 64px', maxWidth: '1040px' }}>
          
          {/* Header Banner */}
          <div style={{ paddingBottom: '36px', marginBottom: '40px', borderBottom: `1px solid ${border}` }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: accent, fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '24px', height: '1px', background: accent }}></span>
              DOSSIER {activeDossier.number} · {activeDossier.targetAudience}
            </div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '48px', fontWeight: '400', margin: '0 0 16px 0', lineHeight: 1.05 }}>
              {activeDossier.title} <em style={{ fontStyle: 'italic', color: accent }}>— {activeDossier.subtitle}</em>
            </h1>
            <p style={{ fontSize: '16px', color: textMuted, lineHeight: '1.8', maxWidth: '780px', margin: 0, fontWeight: '300' }}>
              {activeDossier.purpose}
            </p>
          </div>

          {/* Dossier Dynamic Viewport Content */}
          {activeTab === 'd01' && (
            <div>
              {/* Stat Row */}
              <div style={{ display: 'flex', gap: '48px', marginBottom: '40px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '42px', color: accent, lineHeight: 1, fontWeight: '300' }}>10+</div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: textDim, marginTop: '6px' }}>Years Cross-Sector Architecture</div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '42px', color: accent, lineHeight: 1, fontWeight: '300' }}>$1.0M</div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: textDim, marginTop: '6px' }}>Anthem Nevada Sponsorship LOI</div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '42px', color: accent, lineHeight: 1, fontWeight: '300' }}>50</div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: textDim, marginTop: '6px' }}>Units Advent UMC Campus</div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '42px', color: accent, lineHeight: 1, fontWeight: '300' }}>CHW-1</div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: textDim, marginTop: '6px' }}>Board Certified Community Health</div>
                </div>
              </div>

              {/* Callout Quote */}
              <div style={{ borderLeft: `3px solid ${accent}`, padding: '20px 28px', background: isDark ? 'rgba(212,175,55,0.05)' : 'rgba(61,90,42,0.04)', borderRadius: '0 8px 8px 0', margin: '32px 0' }}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontStyle: 'italic', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  "We do not simply train workers or build affordable housing; we construct integrated institutional pipelines where health equity, Medicaid fee-for-service, and construction careers reinforce community longevity."
                </p>
                <div style={{ fontSize: '11px', color: textDim }}>— William Darnell Jernigan IV, Executive Director</div>
              </div>

              {/* Authority Objects Linked Grid */}
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', fontWeight: '500', margin: '36px 0 16px 0' }}>
                Verified Authority Foundations
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {authorityObjects.map(obj => (
                  <div key={obj.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '10px', padding: '20px', borderTop: `3px solid ${accent}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: accent, textTransform: 'uppercase' }}>{obj.type}</span>
                      <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '3px', background: 'rgba(74,138,88,0.1)', color: '#4A8A58', fontWeight: '700' }}>✓ {obj.provenance}</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: textPrimary, marginBottom: '6px' }}>{obj.name}</div>
                    <div style={{ fontSize: '12px', color: textMuted, lineHeight: '1.6' }}>{obj.summary}</div>
                    <div style={{ fontSize: '10px', color: textDim, marginTop: '10px' }}>
                      Sources: {obj.sources.join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab !== 'd01' && (
            <div>
              <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '10px', padding: '28px', marginBottom: '24px' }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '24px', margin: '0 0 12px 0', color: textPrimary }}>
                  Dossier Overview & Executive Briefing
                </h3>
                <p style={{ fontSize: '14px', color: textMuted, lineHeight: '1.8', margin: '0 0 16px 0' }}>
                  This package is configured under the <strong>{activeDossier.accessTier.replace('_', ' ')}</strong> access protocol. 
                  It synthesizes verified claims from Modules {activeDossier.modulesUsed.join(', ')} into an audience-specific document for {activeDossier.targetAudience}.
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button style={{ background: accent, color: '#FFF', padding: '8px 18px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    Download Official Dossier PDF
                  </button>
                  <button style={{ background: 'transparent', color: accent, border: `1px solid ${border}`, padding: '8px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    Inspect Underlying Evidence ({authorityObjects.length} Proof Records)
                  </button>
                </div>
              </div>

              {/* Linked Authority Records */}
              <h4 style={{ fontSize: '12px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accent, margin: '24px 0 12px 0', fontWeight: '700' }}>
                Linked Canonical Records in this Dossier
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {authorityObjects.filter(o => o.associatedDossierIds.includes(activeDossier.id) || activeDossier.modulesUsed.some(m => o.associatedModuleCodes.includes(m))).map(o => (
                  <div key={o.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '3px', background: border, color: accent }}>{o.type}</span>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: textPrimary }}>{o.name}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: textMuted, marginTop: '4px' }}>{o.summary}</div>
                    </div>
                    <span style={{ fontSize: '10px', color: textDim, whiteSpace: 'nowrap' }}>Confidence {o.confidenceScore}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

    </div>
  );
}
