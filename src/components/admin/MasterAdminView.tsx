import React from 'react';
import { usePASStore } from '../../store/usePASStore';

export function MasterAdminView() {
  const { adminMetrics } = usePASStore();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'inline-block', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#EF4444', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: '8px' }}>
          Restricted Platform Administration
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#FFF', margin: '0 0 6px 0' }}>
          Master Admin — C-Suite God View (Section 68)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Internal platform operations console for PAS executives and developers. Full visibility across global tenancy, verification queues, and revenue streams.
        </p>
      </div>

      {/* ── GLOBAL PLATFORM METRICS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '36px', color: '#D4AF37' }}>
            {adminMetrics.totalUsers.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>Total Registered Users</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '36px', color: '#4A8A58' }}>
            {adminMetrics.publishedPASCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>Published Personal PAS</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '36px', color: '#3A7A6A' }}>
            {adminMetrics.businessPASCount.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>Active Business PAS (BPAS)</div>
        </div>
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '36px', color: '#A86048' }}>
            ${(adminMetrics.mrrUsd / 1000).toFixed(0)}K
          </div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>Monthly Recurring Revenue</div>
        </div>
      </div>

      {/* ── TIER 3 PLATFORM VERIFICATION QUEUE ── */}
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF' }}>Tier 3 Platform Verification Queue ({adminMetrics.pendingTier3Verifications} Pending)</div>
            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Staff-reviewed audit of public claims, licensure registries, and institutional partnerships.</div>
          </div>
          <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontWeight: '700' }}>
            Action Required
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ background: '#1E2024', padding: '14px 18px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF' }}>William Darnell Jernigan IV</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>CHW-1 License · 501(c)(3) Filings · Advent UMC Master Agreement · 5 Peer Vouches</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ background: '#141619', color: '#9CA3AF', border: '1px solid #26292E', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Inspect Audit File</button>
              <button style={{ background: '#4A8A58', color: '#FFF', border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Approve Tier 3 Badge</button>
            </div>
          </div>

          <div style={{ background: '#1E2024', padding: '14px 18px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF' }}>Dr. Patricia Dominguez</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Medical Director · UnitedHealthcare Community Plan · 8 Modules Submitted</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ background: '#141619', color: '#9CA3AF', border: '1px solid #26292E', padding: '6px 14px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Inspect Audit File</button>
              <button style={{ background: '#4A8A58', color: '#FFF', border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Approve Tier 3 Badge</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── DEMO DATA GOVERNANCE NOTICE (Section 69) ── */}
      <div style={{ padding: '14px 18px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)', background: 'rgba(212,175,55,0.05)', fontSize: '12px', color: '#D4AF37', lineHeight: '1.6' }}>
        <strong>Demo Data Governance (Section 69):</strong> All aggregate platform user counts and financial metrics displayed on this internal dashboard represent illustrative demonstration parameters until live enterprise database telemetry is connected.
      </div>

    </div>
  );
}
