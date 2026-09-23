import React, { useState } from 'react';
import { usePASStore } from '../../store/usePASStore';

export function FellowshipView() {
  const { peerEndorsements } = usePASStore();
  const [activeSubTab, setActiveSubTab] = useState<'FEED' | 'TRUSTED' | 'ALIGNMENT' | 'INSIGHTS'>('FEED');
  const [newPostText, setNewPostText] = useState('');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#FFF', margin: '0 0 6px 0' }}>
          The Fellowship Layer (Sections 35–46)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Recognition, not networking. No algorithms, vanity likes, or follower counts. A crawlable web of real professional relationships, object-level endorsements, and verified authority citations.
        </p>
      </div>

      {/* ── SUB-TABS ── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #26292E', paddingBottom: '12px', marginBottom: '24px' }}>
        {(['FEED', 'TRUSTED', 'ALIGNMENT', 'INSIGHTS'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            style={{
              background: activeSubTab === tab ? '#D4AF37' : '#141619',
              color: activeSubTab === tab ? '#000' : '#9CA3AF',
              border: '1px solid #26292E',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              cursor: 'pointer'
            }}>
            {tab === 'FEED' && 'Peer Recognition Feed'}
            {tab === 'TRUSTED' && 'Trusted Network (5 Vouched)'}
            {tab === 'ALIGNMENT' && 'AI Authority Alignment'}
            {tab === 'INSIGHTS' && 'Fellowship & Search Insights'}
          </button>
        ))}
      </div>

      {/* ── FEED TAB ── */}
      {activeSubTab === 'FEED' && (
        <div>
          {/* Post Compose Box */}
          <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
            <textarea
              value={newPostText}
              onChange={e => setNewPostText(e.target.value)}
              placeholder="Share a recognition, respond to a peer citation, or post an evidence update to your trusted network..."
              rows={3}
              style={{ width: '100%', background: '#1E2024', border: '1px solid #26292E', borderRadius: '8px', padding: '12px', color: '#FFF', fontSize: '13px', resize: 'none', marginBottom: '12px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ background: '#1E2024', color: '#9CA3AF', border: '1px solid #26292E', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>📎 Attach PDF</button>
                <button style={{ background: '#1E2024', color: '#9CA3AF', border: '1px solid #26292E', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>🎥 Video Briefing (.mp4)</button>
                <button style={{ background: '#1E2024', color: '#9CA3AF', border: '1px solid #26292E', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>📊 Presentation (.pptx)</button>
              </div>
              <button 
                onClick={() => { if (newPostText.trim()) { alert('Posted to Fellowship Network'); setNewPostText(''); } }}
                style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                Post Recognition
              </button>
            </div>
          </div>

          {/* Endorsements Feed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {peerEndorsements.map(pe => (
              <div key={pe.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1E2024', border: '1px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#D4AF37' }}>
                      {pe.endorserName.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF' }}>{pe.endorserName}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{pe.endorserTitle} · {pe.endorserOrg}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', color: '#6B7280' }}>{pe.createdAt}</span>
                </div>

                <div style={{ background: '#1A1C20', border: '1px solid #26292E', borderRadius: '6px', padding: '8px 12px', marginBottom: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#D4AF37', textTransform: 'uppercase' }}>Object Endorsed:</span>
                  <span style={{ fontSize: '12px', color: '#FFF', fontWeight: '600' }}>{pe.targetObjectName}</span>
                  <span style={{ fontSize: '9px', background: 'rgba(74,138,88,0.15)', color: '#4A8A58', padding: '2px 6px', borderRadius: '3px', fontWeight: '700' }}>✓ {pe.relationshipType}</span>
                </div>

                <p style={{ fontSize: '13px', color: '#E5E7EB', lineHeight: '1.7', margin: '0 0 14px 0' }}>
                  "{pe.comment}"
                </p>

                {pe.attachmentUrl && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#1E2024', border: '1px solid #26292E', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', color: '#D4AF37', marginBottom: '12px' }}>
                    <span>{pe.attachmentType === 'VIDEO' ? '🎥' : pe.attachmentType === 'PRESENTATION' ? '📊' : '📄'}</span>
                    <span>{pe.attachmentUrl}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #26292E', paddingTop: '12px' }}>
                  <button style={{ background: '#1E2024', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Inspect Authority Dossier</button>
                  <button style={{ background: '#1E2024', color: '#9CA3AF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cite in My PAS</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TRUSTED NETWORK TAB ── */}
      {activeSubTab === 'TRUSTED' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
            <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#D4AF37' }}>5</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>Peers You Vouched For</div>
            </div>
            <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#4A8A58' }}>8</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>Peers Vouched For You</div>
            </div>
            <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#3A7A6A' }}>3</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>Mutual Vouches</div>
            </div>
          </div>

          <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
            <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.7' }}>
              When you vouch for someone, it carries weight across the entire PAS network. When multiple PAS holders vouch for the same person, that signal compounds — creating an inspectable web of verified professional trust built by people who have inspected the work.
            </div>
          </div>
        </div>
      )}

      {/* ── AI ALIGNMENT TAB ── */}
      {activeSubTab === 'ALIGNMENT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>Dr. Patricia Dominguez · UnitedHealthcare Community Plan</div>
              <span style={{ fontSize: '11px', background: 'rgba(74,138,88,0.15)', color: '#4A8A58', padding: '2px 8px', borderRadius: '3px', fontWeight: '700' }}>94% PAS Alignment</span>
            </div>
            <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.6' }}>
              Alignment detected across <strong>Housing-First Healthcare Delivery</strong> and <strong>Medicaid CHW Supervision</strong>. Both entities operate complementary implementations in the Southwest region.
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button style={{ background: '#D4AF37', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Review Her PAS Dossiers</button>
              <button style={{ background: '#1E2024', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Initiate Formal Contact</button>
            </div>
          </div>
        </div>
      )}

      {/* ── INSIGHTS TAB ── */}
      {activeSubTab === 'INSIGHTS' && (
        <div>
          <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '24px' }}>
            <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', color: '#FFF', margin: '0 0 16px 0' }}>
              Search Queries & AI Engines Discovering Your PAS
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1E2024', borderRadius: '6px', fontSize: '13px' }}>
                <span>"community health workforce pipeline"</span>
                <span style={{ color: '#D4AF37', fontWeight: '700' }}>38 inquiries</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1E2024', borderRadius: '6px', fontSize: '13px' }}>
                <span>"whole community solution framework"</span>
                <span style={{ color: '#D4AF37', fontWeight: '700' }}>24 inquiries</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#1E2024', borderRadius: '6px', fontSize: '13px' }}>
                <span>"CHW medicaid integration model"</span>
                <span style={{ color: '#D4AF37', fontWeight: '700' }}>19 inquiries</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
