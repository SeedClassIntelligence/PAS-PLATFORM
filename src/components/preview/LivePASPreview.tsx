import React from 'react';
import { usePASStore } from '../../store/usePASStore';

export function LivePASPreview() {
  const { userName, userTitle, modules, pageDesign, verificationBadge, setEnvironment } = usePASStore();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D4AF37', fontWeight: '700' }}>
          Live Reactive Preview
        </div>
        <span style={{ fontSize: '10px', background: '#4A8A58', color: '#FFF', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
          LIVE
        </span>
      </div>

      <div style={{ border: `2px solid ${pageDesign.accentColor}`, borderRadius: '10px', background: '#F5F0E8', color: '#1C1917', padding: '16px' }}>
        <div style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '12px', marginBottom: '12px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: '700', color: pageDesign.accentColor }}>{userName}</div>
          <div style={{ fontSize: '11px', color: '#5A5A4A', marginTop: '2px' }}>{userTitle}</div>
          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
            <span style={{ fontSize: '9px', background: 'rgba(74,138,88,0.1)', color: '#1A5A30', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(74,138,88,0.2)', fontWeight: '600' }}>
              ✓ {verificationBadge.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: pageDesign.accentColor, fontWeight: '700', marginBottom: '8px' }}>
          8 Canonical Modules
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {modules.map(m => (
            <div key={m.code} style={{ background: '#FFFDF9', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '4px', padding: '6px' }}>
              <div style={{ fontSize: '9px', color: pageDesign.accentColor, fontWeight: '700' }}>{m.code}</div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#1C1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setEnvironment('PUBLISHED_PERSONAL_PAS')}
          style={{ width: '100%', marginTop: '14px', background: pageDesign.accentColor, color: '#FFF', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
          Inspect Full Template ↗
        </button>
      </div>
    </div>
  );
}
