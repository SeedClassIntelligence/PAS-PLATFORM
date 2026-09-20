import React from 'react';
import { usePASStore } from '../../store/usePASStore';
import { PASTemplateTheme } from '../../types/pas';

export function PASDesignStudio() {
  const { pageDesign, updatePageDesign } = usePASStore();

  const templates: { id: PASTemplateTheme; name: string; icon: string; desc: string }[] = [
    { id: 'AUTHORITY', name: 'Authority Template', icon: '🏛️', desc: 'Warm editorial, Cormorant Garamond, gold accents, generous whitespace (WDJ IV model).' },
    { id: 'PRECISION', name: 'Precision Template', icon: '⚡', desc: 'Dark obsidian background, gold on black, sharp lines and structural contrast.' },
    { id: 'STUDIO', name: 'Studio Template', icon: '🌿', desc: 'Light olive green canvas, modern typography, spacious layout (Platform default).' },
    { id: 'SLATE', name: 'Slate Template', icon: '📐', desc: 'Cool blue-grey, geometric corporate aesthetic for institutions and developers.' },
    { id: 'EMBER', name: 'Ember Template', icon: '🔥', desc: 'Warm terracotta, rich earth tones, and deep forest accents.' },
    { id: 'ONYX', name: 'Onyx Template', icon: '🖤', desc: 'Ultra-minimalist, black and white high contrast with typographic focus.' }
  ];

  const presets = ['#5C6E3A', '#B59453', '#3A7A6A', '#1B4F8A', '#A86048', '#000000'];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', color: '#E5E7EB' }}>
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px', marginBottom: '28px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", color: '#D4AF37', margin: '0 0 4px 0', fontSize: '28px' }}>
          PAS Page Builder & Design Studio (Section 20)
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
          Manage the composition and visual presentation of your published PAS. Select from the 6 production templates and configure brand colors.
        </p>
      </div>

      {/* TEMPLATE SELECTOR */}
      <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4AF37', marginBottom: '14px', fontWeight: '700' }}>
        1. Select Production Template
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {templates.map(t => (
          <div 
            key={t.id} 
            onClick={() => updatePageDesign({ template: t.id })}
            style={{
              background: '#141619',
              border: pageDesign.template === t.id ? '2px solid #D4AF37' : '1px solid #26292E',
              borderRadius: '10px',
              padding: '20px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}>
            <div style={{ fontSize: '26px', marginBottom: '8px' }}>{t.icon}</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>{t.name}</div>
            <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px', lineHeight: '1.6' }}>{t.desc}</div>
            {pageDesign.template === t.id && (
              <div style={{ marginTop: '12px', fontSize: '10px', background: '#D4AF37', color: '#000', padding: '3px 8px', borderRadius: '3px', fontWeight: '700', display: 'inline-block' }}>
                Active Template
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ACCENT COLOR PICKER */}
      <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#D4AF37', marginBottom: '14px', fontWeight: '700' }}>
        2. Brand Accent Color
      </h3>
      <div style={{ background: '#141619', border: '1px solid #26292E', borderRadius: '10px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <input 
          type="color" 
          value={pageDesign.accentColor} 
          onChange={e => updatePageDesign({ accentColor: e.target.value })}
          style={{ width: '48px', height: '48px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'none' }}
        />
        <div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>{pageDesign.accentColor.toUpperCase()}</div>
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>Click color box to pick any custom HEX color or select a preset below:</div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {presets.map(p => (
              <div 
                key={p} 
                onClick={() => updatePageDesign({ accentColor: p })} 
                style={{ width: '28px', height: '28px', borderRadius: '50%', background: p, border: pageDesign.accentColor === p ? '2px solid #FFF' : '1px solid #26292E', cursor: 'pointer' }} 
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
