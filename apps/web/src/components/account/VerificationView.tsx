import React from 'react';
import { usePASStore } from '../../store/usePASStore';

export function VerificationView() {
  const { verificationBadge } = usePASStore();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      
      {/* ── HEADER ── */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '32px', color: '#FFF', margin: '0 0 6px 0' }}>
          PAS Verification Architecture (Section 67)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Verification is not a superficial vanity badge. It tells the viewer what was verified, by whom, what evidence supports it, and what level of confidence applies.
        </p>
      </div>

      {/* ── 3 TIERS GRID ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        
        {/* Tier 1 */}
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '24px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(92,110,58,0.1)', border: '2px solid #5C6E3A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5C6E3A', fontWeight: '700', fontSize: '16px', marginBottom: '14px' }}>
            ✓
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFF', marginBottom: '4px' }}>Document Verified</div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: '10px' }}>Tier 1 · Automated Registry Checks</div>
          <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.7' }}>
            Automated verification of state board licenses (CHW-1), 501(c)(3) determination letters, secretary of state LLC filings, and academic credentials.
          </div>
        </div>

        {/* Tier 2 */}
        <div style={{ background: '#141619', border: '2px solid #D4AF37', borderRadius: '10px', padding: '24px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', border: '2px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontWeight: '700', fontSize: '16px', marginBottom: '14px' }}>
            ✓✓
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#D4AF37', marginBottom: '4px' }}>Peer Verified</div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: '10px' }}>Tier 2 · Network Attested (Current Status)</div>
          <div style={{ fontSize: '13px', color: '#E5E7EB', lineHeight: '1.7' }}>
            3+ verified PAS holders have inspected your modules, reviewed the underlying evidence, and vouched for the execution of your frameworks.
          </div>
        </div>

        {/* Tier 3 */}
        <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '24px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(168,96,72,0.1)', border: '2px solid #A86048', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A86048', fontWeight: '700', fontSize: '16px', marginBottom: '14px' }}>
            ★
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#FFF', marginBottom: '4px' }}>Platform Verified</div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', marginBottom: '10px' }}>Tier 3 · Staff-Audited & Reference Checked</div>
          <div style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: '1.7' }}>
            PAS executive staff audit of public claims, independent outreach to partner leadership, and manual verification of major contractual agreements.
          </div>
        </div>

      </div>

      {/* ── AUDITABLE PROOF DRAWER ── */}
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#FFF', margin: '0 0 14px 0' }}>Your Active Evidentiary Audit Trail</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: 'rgba(74,138,88,0.15)', color: '#4A8A58', fontWeight: '600' }}>✓ CHW-1 License (#NV-CHW-8492)</span>
          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: 'rgba(74,138,88,0.15)', color: '#4A8A58', fontWeight: '600' }}>✓ ASG CDC 501(c)(3) IRS Ruling</span>
          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: 'rgba(74,138,88,0.15)', color: '#4A8A58', fontWeight: '600' }}>✓ Anthem Nevada LOI ($1,000,000)</span>
          <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', background: 'rgba(212,175,55,0.15)', color: '#D4AF37', fontWeight: '600' }}>✓✓ 5 Verified Peer Vouches</span>
        </div>
      </div>

    </div>
  );
}
