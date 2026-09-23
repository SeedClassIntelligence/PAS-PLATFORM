import React, { useState } from 'react';
import { usePASStore } from '../../store/usePASStore';
import { 
  ConnectorPlatform, 
  AuthorityObjectType, 
  PASTemplateTheme,
  AccessTier,
  AuthorityObject 
} from '../../types/pas';

export function PASBuilderWorkspace() {
  const { 
    builderStage, 
    setBuilderStage, 
    sources, 
    connectSource, 
    authorityObjects, 
    addAuthorityObject, 
    modules, 
    dossiers, 
    setDossierAccessTier,
    pageDesign, 
    updatePageDesign,
    domainConfig,
    publishPAS,
    setEnvironment,
    setActiveDossierId
  } = usePASStore();

  // Local state for interactive conversation
  const [chatMessages, setChatMessages] = useState<{ sender: 'ai' | 'user' | 'sys'; text: string }[]>([
    { sender: 'ai', text: "Welcome to your guided authority construction workspace. I've ingested your connected sources. Let's fill in key operational gaps to fortify your records." },
    { sender: 'ai', text: "Regarding the Advent UMC campus: what is the specific square footage of the integrated clinical home, and what licensure enables the Medicaid billing?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [activeUrlConnector, setActiveUrlConnector] = useState(false);

  const stages = [
    { num: 1, name: 'Sources', desc: 'Digital Real Estate' },
    { num: 2, name: 'Processing', desc: 'Source Ingestion' },
    { num: 3, name: 'Mapping', desc: 'Authority Objects' },
    { num: 4, name: 'Conversation', desc: 'Targeted Interview' },
    { num: 5, name: 'Review', desc: 'Inspection & Approval' },
    { num: 6, name: 'Modules', desc: '8 Canonical Lenses' },
    { num: 7, name: 'Dossiers', desc: 'Audience Compositions' },
    { num: 8, name: 'Page Design', desc: '6 Design Templates' },
    { num: 9, name: 'Preview', desc: 'Multi-Viewport' },
    { num: 10, name: 'Publish', desc: 'Draft vs Live Diffs' },
    { num: 11, name: 'Domain', desc: '3-Level Web Routing' }
  ];

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');

    setTimeout(() => {
      setChatMessages(prev => [
        ...prev,
        { 
          sender: 'ai', 
          text: `Extracted new authority record from your response: Assigned to Module M04 (Active Implementation) and M02 (Professional Identity) with 96% confidence score.` 
        }
      ]);
    }, 800);
  };

  const handleConnectUrl = () => {
    if (!urlInput.trim()) return;
    connectSource('WEBSITE');
    setActiveUrlConnector(false);
    setUrlInput('');
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── STAGE NAVIGATION PROGRESS BAR ── */}
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '12px', padding: '16px 20px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#D4AF37', fontWeight: '700' }}>
              Unified PAS Building Journey (Section 5)
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', marginTop: '2px' }}>
              Stage {builderStage}: {stages[builderStage - 1].name} — {stages[builderStage - 1].desc}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              disabled={builderStage === 1}
              onClick={() => setBuilderStage(Math.max(1, builderStage - 1))}
              style={{ background: '#1E2024', border: '1px solid #26292E', color: builderStage === 1 ? '#4B5563' : '#FFF', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', cursor: builderStage === 1 ? 'not-allowed' : 'pointer' }}>
              ← Previous Stage
            </button>
            <button 
              disabled={builderStage === 11}
              onClick={() => setBuilderStage(Math.min(11, builderStage + 1))}
              style={{ background: '#D4AF37', border: 'none', color: '#000', padding: '6px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: builderStage === 11 ? 'not-allowed' : 'pointer' }}>
              Next Stage →
            </button>
          </div>
        </div>

        {/* 11 Steps Indicator */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: '6px' }}>
          {stages.map(s => (
            <div 
              key={s.num} 
              onClick={() => setBuilderStage(s.num)}
              style={{
                background: builderStage === s.num ? '#D4AF37' : builderStage > s.num ? '#26292E' : '#141619',
                border: builderStage === s.num ? '1px solid #D4AF37' : '1px solid #26292E',
                color: builderStage === s.num ? '#000' : builderStage > s.num ? '#4A8A58' : '#9CA3AF',
                padding: '8px 6px',
                borderRadius: '6px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}>
              <div style={{ fontSize: '10px', fontWeight: '700' }}>{s.num < 10 ? `0${s.num}` : s.num}</div>
              <div style={{ fontSize: '9px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── STAGE 01: DIGITAL REAL ESTATE SOURCES ── */}
      {builderStage === 1 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 01: Connect Professional Real Estate</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>PAS begins with ingestion rather than empty forms. Connect your digital real estate to feed your canonical graph.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {sources.map(s => (
              <div key={s.id} style={{ background: '#141619', border: s.state === 'CONNECTED' ? '1px solid rgba(74,138,88,0.3)' : '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '26px' }}>{s.icon}</span>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: s.state === 'CONNECTED' ? 'rgba(74,138,88,0.15)' : '#1E2024',
                    color: s.state === 'CONNECTED' ? '#4A8A58' : '#9CA3AF',
                    border: `1px solid ${s.state === 'CONNECTED' ? 'rgba(74,138,88,0.3)' : '#26292E'}`
                  }}>
                    {s.state}
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#FFF' }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', margin: '4px 0 14px 0' }}>
                  {s.accountLabel || 'Click connect to authorize data ingestion'}
                </div>
                {s.state === 'CONNECTED' ? (
                  <div style={{ fontSize: '11px', color: '#4A8A58' }}>✓ {s.recordsDiscovered} records discovered</div>
                ) : (
                  <button 
                    onClick={() => {
                      if (s.id === 'WEBSITE') setActiveUrlConnector(true);
                      else connectSource(s.id);
                    }} 
                    style={{ width: '100%', padding: '8px', background: '#D4AF37', color: '#000', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    Connect Source →
                  </button>
                )}
              </div>
            ))}
          </div>

          {activeUrlConnector && (
            <div style={{ marginTop: '20px', background: '#141619', border: '2px solid #D4AF37', borderRadius: '10px', padding: '20px' }}>
              <h4 style={{ color: '#FFF', margin: '0 0 8px 0' }}>Enter Website or URL for Acumen Harvesting</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://asgcdc.org or https://wcs-framework.org" 
                  style={{ flex: 1, padding: '10px 14px', background: '#1E2024', border: '1px solid #26292E', borderRadius: '6px', color: '#FFF', fontSize: '13px' }} 
                />
                <button onClick={handleConnectUrl} style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
                  Harvest & Extract →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STAGE 02: SOURCE PROCESSING ── */}
      {builderStage === 2 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 02: Inspectable Ingestion Processing</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>Processing is visibly inspectable rather than a black box. See what PAS read, what was discovered, and where ambiguities lie.</p>
          </div>

          <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A8A58', fontWeight: '700', marginBottom: '12px' }}>
              ✓ Live Ingestion Feed (32 Total Assets Parsed)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ padding: '10px 14px', background: '#1E2024', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📄 Executive_Resume_2026.pdf</span>
                <span style={{ color: '#4A8A58' }}>Extracted 18 timeline roles & 12 credentials</span>
              </div>
              <div style={{ padding: '10px 14px', background: '#1E2024', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📁 WCS_Framework_IP_Overview.docx</span>
                <span style={{ color: '#4A8A58' }}>Identified 9-Pillar Framework Architecture & Solutionology IP</span>
              </div>
              <div style={{ padding: '10px 14px', background: '#1E2024', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>💼 LinkedIn (William Darnell Jernigan IV)</span>
                <span style={{ color: '#4A8A58' }}>Confirmed Executive Director appointment since 2015</span>
              </div>
              <div style={{ padding: '10px 14px', background: '#1E2024', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                <span>📜 Nevada Certification Board CHW-1 License</span>
                <span style={{ color: '#4A8A58' }}>Verified active credential status & registry number</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 03: AUTHORITY OBJECT MAPPING ── */}
      {builderStage === 3 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 03: Canonical Authority Object Extraction</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>PAS does not turn extracted data immediately into prose. It first instantiates canonical Authority Objects with provenance tracking.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {authorityObjects.map(obj => (
              <div key={obj.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px', borderTop: '3px solid #D4AF37' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 8px', borderRadius: '3px', background: '#26292E', color: '#D4AF37' }}>{obj.type}</span>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#4A8A58' }}>✓ {obj.provenance}</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF', marginBottom: '4px' }}>{obj.name}</div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }}>{obj.summary}</div>
                <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '10px' }}>
                  Confidence: {obj.confidenceScore}% · Sources: {obj.sources.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STAGE 04: TARGETED PAS CONVERSATION ── */}
      {builderStage === 4 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 04: Targeted Gap-Filling Conversation</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>The AI does not ask generic questions. It targets specific gaps and conflicting data across your authority records.</p>
          </div>

          <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '24px', minHeight: '320px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx}
                  style={{
                    maxWidth: '80%',
                    padding: '12px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    background: msg.sender === 'user' ? 'rgba(212,175,55,0.1)' : '#1E2024',
                    border: msg.sender === 'user' ? '1px solid rgba(212,175,55,0.3)' : '1px solid #26292E',
                    color: '#FFF'
                  }}>
                  {msg.sender === 'ai' && <div style={{ fontSize: '10px', color: '#D4AF37', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>PAS Authority Engine</div>}
                  {msg.text}
                </div>
              ))}
            </div>

            <div style={{ padding: '16px 20px', background: '#1A1C20', borderTop: '1px solid #26292E', display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Explain nuance, clarify dates, or describe active execution..."
                style={{ flex: 1, padding: '10px 14px', background: '#141619', border: '1px solid #26292E', borderRadius: '6px', color: '#FFF', fontSize: '13px' }}
              />
              <button onClick={handleSendChat} style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '10px 22px', borderRadius: '6px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
                Send Response →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 05: REVIEW & APPROVAL ── */}
      {builderStage === 5 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 05: Authority Inspection & Review Layer</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>Before any claim is published, inspect and approve it. Merge duplicates, resolve conflicts, and set privacy states.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {authorityObjects.map(obj => (
              <div key={obj.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '3px', background: '#26292E', color: '#D4AF37', fontWeight: '700' }}>{obj.type}</span>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{obj.name}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>{obj.summary}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{ background: 'rgba(74,138,88,0.15)', color: '#4A8A58', border: '1px solid rgba(74,138,88,0.3)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                    ✓ Approved
                  </button>
                  <button style={{ background: '#1E2024', color: '#9CA3AF', border: '1px solid #26292E', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                    Edit Record
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STAGE 06: PAS MODULES (THE 8 CANONICAL LENSES) ── */}
      {builderStage === 6 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 06: The 8 Canonical PAS Modules</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>The 8 modules are different lenses over your authority graph, organizing your track record for inspection.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {modules.map(m => (
              <div key={m.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', color: '#D4AF37', fontWeight: '700' }}>{m.code}</span>
                  <span style={{ fontSize: '10px', color: '#4A8A58', fontWeight: '700' }}>{m.completionPercentage}% Mapped</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{m.title}</div>
                <div style={{ fontSize: '11px', color: '#D4AF37', marginBottom: '6px' }}>{m.subtitle}</div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }}>{m.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STAGE 07: DOSSIERS (AUDIENCE-SPECIFIC COMPOSITIONS) ── */}
      {builderStage === 7 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 07: Targeted Dossier Library (10 Tiers)</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>Dossiers answer: <em>What does this particular audience need to understand?</em> Manage access tiers and sync rules.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dossiers.map(d => (
              <div key={d.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '24px', color: '#D4AF37', fontWeight: '700', width: '32px' }}>{d.number}</div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>{d.title} — <span style={{ color: '#9CA3AF', fontWeight: '400', fontSize: '13px' }}>{d.subtitle}</span></div>
                    <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>Audience: {d.targetAudience} · Sync Rule: {d.syncRule} · Views: {d.viewCount}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['CORE_PUBLIC', 'EXECUTIVE_GATED', 'CONTROLLED_REQUEST'] as AccessTier[]).map(tier => (
                    <button
                      key={tier}
                      onClick={() => setDossierAccessTier(d.id, tier)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        background: d.accessTier === tier ? '#D4AF37' : '#1E2024',
                        color: d.accessTier === tier ? '#000' : '#9CA3AF',
                        border: 'none'
                      }}>
                      {tier.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STAGE 08: PAGE DESIGN (6 TEMPLATES) ── */}
      {builderStage === 8 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 08: Design System & Template Studio</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>Select your visual presentation template and customize brand accent colors.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
            {(['AUTHORITY', 'PRECISION', 'STUDIO', 'SLATE', 'EMBER', 'ONYX'] as PASTemplateTheme[]).map(t => (
              <div 
                key={t}
                onClick={() => updatePageDesign({ template: t })}
                style={{
                  background: '#141619',
                  border: pageDesign.template === t ? '2px solid #D4AF37' : '1px solid #26292E',
                  borderRadius: '10px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>{t} Template</div>
                <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {t === 'AUTHORITY' && 'Warm editorial, Cormorant Garamond, gold accents.'}
                  {t === 'PRECISION' && 'Dark mode, sharp lines, gold on obsidian black.'}
                  {t === 'STUDIO' && 'Light olive green canvas with generous whitespace.'}
                  {t === 'SLATE' && 'Cool blue-grey, structured corporate geometry.'}
                  {t === 'EMBER' && 'Warm terracotta earth tones with forest accents.'}
                  {t === 'ONYX' && 'Minimalist monochrome high-contrast presentation.'}
                </div>
                {pageDesign.template === t && (
                  <span style={{ fontSize: '9px', background: '#D4AF37', color: '#000', padding: '2px 8px', borderRadius: '3px', fontWeight: '700', marginTop: '12px', display: 'inline-block' }}>
                    Active Template
                  </span>
                )}
              </div>
            ))}
          </div>

          <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <input 
              type="color" 
              value={pageDesign.accentColor} 
              onChange={e => updatePageDesign({ accentColor: e.target.value })}
              style={{ width: '44px', height: '44px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF' }}>Brand Accent: {pageDesign.accentColor.toUpperCase()}</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Applies across headers, rule dividers, callout banners, and badges.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 09: PREVIEW ── */}
      {builderStage === 9 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 09: Live Multi-Viewport Preview</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>Inspect your live authority property before deploying to your permanent domain.</p>
          </div>

          <div style={{ display: 'flex', gap: '14px', marginBottom: '20px' }}>
            <button onClick={() => setEnvironment('PUBLISHED_PERSONAL_PAS')} style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '10px 24px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
              Launch Fullscreen Published Personal PAS View ↗
            </button>
            <button onClick={() => setEnvironment('PUBLISHED_BPAS')} style={{ background: '#3A7A6A', color: '#FFF', border: 'none', padding: '10px 24px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
              Launch Fullscreen Published Business PAS (BPAS) View ↗
            </button>
          </div>

          <div style={{ border: '2px solid #D4AF37', borderRadius: '12px', overflow: 'hidden', height: '500px', background: '#0C0D0E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📱 💻 🖥️</div>
              <div style={{ fontSize: '16px', color: '#FFF', fontWeight: '600' }}>Responsive Viewport Ready</div>
              <div style={{ fontSize: '12px', marginTop: '6px' }}>Click either button above to test the living template at true scale.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 10: PUBLISH ── */}
      {builderStage === 10 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 10: Publication Diff & Version Snapshot</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>PAS maintains a strict distinction between Draft State and Published State. Review changes before pushing live.</p>
          </div>

          <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: '#D4AF37', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>
              Ready for Live Deployment
            </div>
            <p style={{ fontSize: '14px', color: '#E5E7EB', lineHeight: '1.7', margin: '0 0 20px 0' }}>
              Publishing will compile all 8 canonical modules, 10 dossiers, Schema.org JSON-LD knowledge graphs, and deploy live to your canonical address: <strong>{domainConfig.subdomainUrl}</strong>.
            </p>
            <button 
              onClick={() => {
                publishPAS('User approved live production publication snapshot.');
                alert('PAS Published Successfully to ' + domainConfig.subdomainUrl);
              }}
              style={{ background: '#4A8A58', color: '#FFF', border: 'none', padding: '12px 32px', borderRadius: '6px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
              ✓ Publish Live to Network
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE 11: DOMAINS ── */}
      {builderStage === 11 && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '26px', color: '#D4AF37', margin: '0 0 6px 0' }}>Stage 11: 3-Level Domain Architecture & DNS Wizard</h3>
            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>All publication identities resolve to your master PAS authority system without fragmented records.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#D4AF37', fontWeight: '700', marginBottom: '6px' }}>Level 1 · Free Slug</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{domainConfig.freeSlugUrl}</div>
              <div style={{ fontSize: '11px', color: '#4A8A58', marginTop: '8px' }}>✓ Search Indexed & SSL Active</div>
            </div>
            <div style={{ background: '#141619', border: '2px solid #D4AF37', borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#D4AF37', fontWeight: '700', marginBottom: '6px' }}>Level 2 · Ecosystem Subdomain</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{domainConfig.subdomainUrl}</div>
              <div style={{ fontSize: '11px', color: '#4A8A58', marginTop: '8px' }}>✓ Primary Canonical Address</div>
            </div>
            <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#D4AF37', fontWeight: '700', marginBottom: '6px' }}>Level 3 · Custom Domain</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{domainConfig.customDomainUrl}</div>
              <div style={{ fontSize: '11px', color: '#D4AF37', marginTop: '8px' }}>CNAME: {domainConfig.cnameTarget}</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
