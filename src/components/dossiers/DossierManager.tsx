import React from 'react';
import { usePASStore } from '../../store/usePASStore';
import { AccessTier } from '../../types/pas';

export function DossierManager() {
  const { dossiers, setDossierAccessTier, setActiveDossierId, setEnvironment } = usePASStore();

  const tiers: { id: AccessTier; label: string; icon: string }[] = [
    { id: 'CORE_PUBLIC', label: 'Core Public', icon: '🌐' },
    { id: 'EXECUTIVE_GATED', label: 'Executive Gated', icon: '🔒' },
    { id: 'CONTROLLED_REQUEST', label: 'Controlled Request', icon: '🔐' }
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px', marginBottom: '28px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#D4AF37', margin: '0 0 4px 0', fontSize: '28px' }}>
          Dossier Library & Access Controls (Sections 16–19)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Audience-specific compositions of your professional authority. Manage access clearance, synchronization rules, and inspect live presentations.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {dossiers.map(d => (
          <div key={d.id} style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '28px', color: '#D4AF37', fontWeight: '700', width: '36px' }}>{d.number}</div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>
                  {d.title} — <span style={{ color: '#9CA3AF', fontWeight: '400', fontSize: '14px' }}>{d.subtitle}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                  Audience: <strong style={{ color: '#E5E7EB' }}>{d.targetAudience}</strong> · Sync Rule: {d.syncRule} · Views: {d.viewCount} · Modules: {d.modulesUsed.join(', ')}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {tiers.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setDossierAccessTier(d.id, t.id)}
                  style={{ 
                    padding: '6px 12px', 
                    borderRadius: '4px', 
                    fontSize: '11px', 
                    fontWeight: '700', 
                    cursor: 'pointer', 
                    background: d.accessTier === t.id ? '#D4AF37' : '#1E2024', 
                    border: 'none', 
                    color: d.accessTier === t.id ? '#000' : '#9CA3AF' 
                  }}>
                  {t.icon} {t.label}
                </button>
              ))}

              <button
                onClick={() => {
                  setActiveDossierId(d.id);
                  setEnvironment('PUBLISHED_PERSONAL_PAS');
                }}
                style={{ background: '#1E2024', color: '#5C6E3A', border: '1px solid rgba(92,110,58,0.3)', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', marginLeft: '6px' }}>
                Inspect ↗
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
