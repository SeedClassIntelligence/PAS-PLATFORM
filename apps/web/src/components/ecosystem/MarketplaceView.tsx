import React, { useState } from 'react';
import { usePASStore } from '../../store/usePASStore';

export function MarketplaceView() {
  const { marketplaceProducts } = usePASStore();
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'CREATE' | 'BROWSE'>('PRODUCTS');

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#FFF', margin: '0 0 6px 0' }}>
          Knowledge Marketplace (Sections 52–53)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Every knowledge product is credentialed by your inspectable PAS. Authority becomes verifiable at the point of purchase.
        </p>
      </div>

      {/* ── STATS ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#D4AF37' }}>{marketplaceProducts.length}</div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Products Listed</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#3A7A6A' }}>$4,280</div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>30-Day Revenue</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#1B4F8A' }}>847</div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Free Downloads</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#4A8A58' }}>12</div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase' }}>Paid Enrollments</div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #26292E', paddingBottom: '12px', marginBottom: '24px' }}>
        {(['PRODUCTS', 'CREATE', 'BROWSE'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              background: activeTab === t ? '#D4AF37' : '#141619',
              color: activeTab === t ? '#000' : '#9CA3AF',
              border: '1px solid #26292E',
              padding: '8px 18px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              cursor: 'pointer'
            }}>
            {t === 'PRODUCTS' && 'Your Listed Products'}
            {t === 'CREATE' && '+ Create New Product'}
            {t === 'BROWSE' && 'Browse Peer Network'}
          </button>
        ))}
      </div>

      {/* ── PRODUCTS LIST ── */}
      {activeTab === 'PRODUCTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {marketplaceProducts.map(p => (
            <div key={p.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '3px', background: p.priceUsd === 0 ? 'rgba(74,138,88,0.15)' : 'rgba(212,175,55,0.15)', color: p.priceUsd === 0 ? '#4A8A58' : '#D4AF37' }}>
                    {p.priceUsd === 0 ? 'FREE' : `$${p.priceUsd}`}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>{p.title}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.6', maxWidth: '700px' }}>{p.description}</div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '8px' }}>
                  {p.pageCountOrDuration} · {p.downloadsOrEnrollments} Enrollments · Linked Modules: {p.linkedModuleCodes.join(', ')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button style={{ background: '#1E2024', color: '#FFF', border: '1px solid #26292E', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Edit Product</button>
                <button style={{ background: '#1E2024', color: '#D4AF37', border: '1px solid #26292E', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>View Analytics</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CREATE PRODUCT ── */}
      {activeTab === 'CREATE' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div style={{ background: '#141619', border: '1px dashed #26292E', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>📘</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>Free Knowledge Blueprint</div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }}>Distribute free frameworks, implementation guides, and policy whitepapers to attract peers.</div>
          </div>
          <div style={{ background: '#141619', border: '1px dashed #26292E', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>💰</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>Paid Executive Toolkit</div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }}>Monetize specialized financial spreadsheets, proposal sequences, and operational toolkits.</div>
          </div>
          <div style={{ background: '#141619', border: '1px dashed #26292E', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎥</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>Video Course / Masterclass</div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }}>Multi-lesson executive video masterclass credentialed by your verifiable execution modules.</div>
          </div>
          <div style={{ background: '#141619', border: '1px dashed #26292E', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🤝</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>Consulting / Sprint Package</div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }}>Structured fractional director sprints and advisory briefings backed by your authority graph.</div>
          </div>
        </div>
      )}

      {/* ── BROWSE PEER NETWORK ── */}
      {activeTab === 'BROWSE' && (
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '14px', color: '#9CA3AF', lineHeight: '1.7' }}>
            Explore verified tools, publications, and masterclasses authored by members of the PAS ecosystem. Every purchase can be audited against the creator's live PAS authority property.
          </div>
        </div>
      )}

    </div>
  );
}
