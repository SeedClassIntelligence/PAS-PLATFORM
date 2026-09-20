import React, { useState } from 'react';
import { usePASStore } from '../../store/usePASStore';

export function PublicPASPlatform() {
  const { setEnvironment, setActiveRoute } = usePASStore();
  const [demoStep, setDemoStep] = useState(0);

  const demoMessages = [
    { type: 'sys', text: 'Connecting professional sources... 3 documents & LinkedIn analyzed.' },
    { type: 'ai', text: 'I have ingested your career records. I see you founded A Solution Group CDC and architected the WCS Framework. How did you enter this work?' },
    { type: 'user', text: 'I started as a Community Health Worker. Over time I realized the systems were broken, so I started building new ones.' },
    { type: 'ai', text: 'Mapped to Identity Module (practitioner to systems architect). What active implementations are you leading right now?' },
    { type: 'user', text: 'Building the Advent UMC campus in Las Vegas — 50 housing units, health clinic, childcare, and a $1M Anthem partnership.' },
    { type: 'sys', text: '✓ 8/8 Modules Mapped & Verified. Ready to deploy to your PAS domain.' }
  ];

  const handleStartBuilding = () => {
    setEnvironment('AUTHENTICATED_APP');
    setActiveRoute('builder');
  };

  return (
    <div style={{ background: '#F6F4F0', color: '#2E2E26', minHeight: '100vh', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* ── TOP PLATFORM NAVIGATION ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 500, background: 'rgba(246,244,240,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(92,110,58,0.15)', height: '58px', display: 'flex', alignItems: 'center', padding: '0 40px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '24px', fontWeight: '700', color: '#5C6E3A', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5C6E3A' }}></span>
            PAS
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', fontWeight: '500', color: '#6A6A60' }}>
            <a href="#how" style={{ color: 'inherit', textDecoration: 'none' }}>How PAS Works</a>
            <a href="#demo" style={{ color: 'inherit', textDecoration: 'none' }}>Live Builder</a>
            <button onClick={() => setEnvironment('PUBLISHED_PERSONAL_PAS')} style={{ background: 'none', border: 'none', color: '#5C6E3A', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              Personal PAS Template
            </button>
            <button onClick={() => setEnvironment('PUBLISHED_BPAS')} style={{ background: 'none', border: 'none', color: '#3A7A6A', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
              Business PAS (BPAS)
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={handleStartBuilding} style={{ background: 'transparent', color: '#5C6E3A', border: '1px solid rgba(92,110,58,0.3)', padding: '8px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Sign In
          </button>
          <button onClick={handleStartBuilding} style={{ background: '#5C6E3A', color: '#FFF', border: 'none', padding: '9px 22px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            Build Your PAS →
          </button>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section style={{ padding: '100px 40px 80px', maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#5C6E3A', fontWeight: '700', marginBottom: '20px' }}>
          Professional Authority System
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '64px', fontWeight: '300', color: '#1A1A14', lineHeight: 1.05, margin: '0 0 24px 0' }}>
          Your work is <em style={{ fontStyle: 'italic', color: '#5C6E3A', fontWeight: '400' }}>too big</em> for a resume.<br />
          Build a system instead.
        </h1>
        <p style={{ fontSize: '18px', color: '#6A6A60', lineHeight: 1.8, maxWidth: '720px', margin: '0 auto 40px auto', fontWeight: '300' }}>
          PAS is a platform where individuals and organizations build modular authority systems — inspectable records of executed work, authored frameworks, and domain authority. Not a profile. Not a portfolio. A system.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button onClick={handleStartBuilding} style={{ background: '#5C6E3A', color: '#FFF', border: 'none', padding: '14px 36px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
            Start Building Your PAS
          </button>
          <button onClick={() => setEnvironment('PUBLISHED_PERSONAL_PAS')} style={{ background: '#EDEAE4', color: '#1A1A14', border: '1px solid rgba(92,110,58,0.2)', padding: '14px 32px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
            Inspect Gold Template (WDJ IV)
          </button>
        </div>
      </section>

      {/* ── PROBLEM GRID: WHY RESUMES & PROFILES FAIL ── */}
      <section id="how" style={{ padding: '80px 40px', background: '#EDEAE4', borderTop: '1px solid rgba(92,110,58,0.15)', borderBottom: '1px solid rgba(92,110,58,0.15)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5C6E3A', fontWeight: '700' }}>The Problem</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '42px', color: '#1A1A14', margin: '8px 0 0 0' }}>Why Professional Identity is Broken</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div style={{ background: '#F6F4F0', padding: '28px', borderRadius: '10px', border: '1px solid rgba(92,110,58,0.15)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>📄</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A14', textDecoration: 'line-through', opacity: 0.6 }}>The 1-Page Résumé</div>
              <p style={{ fontSize: '13px', color: '#6A6A60', lineHeight: 1.7, marginTop: '8px' }}>
                Flattens a decade of systems architecture and cross-sector execution into bullet points that get rejected by automated keyword scanners.
              </p>
            </div>
            <div style={{ background: '#F6F4F0', padding: '28px', borderRadius: '10px', border: '1px solid rgba(92,110,58,0.15)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>💼</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A14', textDecoration: 'line-through', opacity: 0.6 }}>LinkedIn Profiles</div>
              <p style={{ fontSize: '13px', color: '#6A6A60', lineHeight: 1.7, marginTop: '8px' }}>
                Reduces executive leaders to a job title, chronological silos, and vanity engagement algorithms rather than inspectable evidence of work.
              </p>
            </div>
            <div style={{ background: '#F6F4F0', padding: '28px', borderRadius: '10px', border: '1px solid rgba(92,110,58,0.15)' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🌐</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A14', textDecoration: 'line-through', opacity: 0.6 }}>Static About Pages</div>
              <p style={{ fontSize: '13px', color: '#6A6A60', lineHeight: 1.7, marginTop: '8px' }}>
                Vague marketing assertions with zero underlying proof, missing institutional records, unverified frameworks, and broken traceability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE INTERACTIVE BUILDER DEMO ── */}
      <section id="demo" style={{ padding: '90px 40px', maxWidth: '1040px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5C6E3A', fontWeight: '700' }}>Live Interactive Demonstration</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '42px', color: '#1A1A14', margin: '8px 0 0 0' }}>How PAS Reconstructs Your Authority</h2>
          <p style={{ fontSize: '14px', color: '#6A6A60', marginTop: '6px' }}>Watch the AI ingest documents, extract authority objects, and map the 8 modules through conversation.</p>
        </div>

        <div style={{ background: '#FFFDF9', border: '1px solid rgba(92,110,58,0.25)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ background: '#EDEAE4', padding: '12px 20px', borderBottom: '1px solid rgba(92,110,58,0.15)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D06050' }}></span>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D0A840' }}></span>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#5C8A48' }}></span>
            <span style={{ fontSize: '12px', color: '#6A6A60', marginLeft: '10px', fontWeight: '600' }}>PAS Builder · Conversational Authority Reconstruction</span>
          </div>

          <div style={{ padding: '28px', minHeight: '320px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {demoMessages.slice(0, demoStep + 1).map((msg, i) => (
              <div 
                key={i} 
                style={{
                  padding: '12px 18px',
                  borderRadius: '8px',
                  maxWidth: '85%',
                  fontSize: '13px',
                  lineHeight: 1.7,
                  alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.type === 'user' ? 'rgba(92,110,58,0.1)' : msg.type === 'sys' ? '#EDEAE4' : '#FFF',
                  border: `1px solid ${msg.type === 'user' ? 'rgba(92,110,58,0.3)' : 'rgba(92,110,58,0.15)'}`,
                  color: '#1A1A14'
                }}>
                {msg.type === 'ai' && <div style={{ fontSize: '10px', fontWeight: '700', color: '#5C6E3A', textTransform: 'uppercase', marginBottom: '4px' }}>PAS AI Engine</div>}
                {msg.type === 'sys' && <div style={{ fontSize: '10px', fontWeight: '700', color: '#6A6A60', textTransform: 'uppercase', marginBottom: '4px' }}>System Synchronization</div>}
                {msg.text}
              </div>
            ))}
          </div>

          <div style={{ padding: '16px 24px', background: '#EDEAE4', borderTop: '1px solid rgba(92,110,58,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#6A6A60' }}>
              Simulation Step {demoStep + 1} of {demoMessages.length}
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              {demoStep < demoMessages.length - 1 ? (
                <button onClick={() => setDemoStep(s => s + 1)} style={{ background: '#5C6E3A', color: '#FFF', border: 'none', padding: '8px 20px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  Next Conversation Step →
                </button>
              ) : (
                <button onClick={handleStartBuilding} style={{ background: '#5C6E3A', color: '#FFF', border: 'none', padding: '8px 24px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  Deploy Your Real PAS Now →
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(92,110,58,0.15)', padding: '40px', textAlign: 'center', fontSize: '12px', color: '#8A8A78' }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '18px', color: '#5C6E3A', fontWeight: '700', marginBottom: '8px' }}>
          PAS — Professional Authority System Platform
        </div>
        <div>Standardized Multi-Tenant Digital Authority Environment · Google Antigravity Architecture</div>
      </footer>

    </div>
  );
}
