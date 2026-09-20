import React from 'react';
import { usePASStore, AppNavRoute } from './store/usePASStore';
import { PublicPASPlatform } from './components/public/PublicPASPlatform';
import { PublishedPersonalPAS } from './components/public/PublishedPersonalPAS';
import { PublishedBusinessPAS } from './components/public/PublishedBusinessPAS';

// Dashboard & Management Components
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { PASBuilderWorkspace } from './components/builder/PASBuilderWorkspace';
import { AuthorityGraphView } from './components/manage/AuthorityGraphView';
import { FellowshipView } from './components/ecosystem/FellowshipView';
import { MarketplaceView } from './components/ecosystem/MarketplaceView';
import { ConnectionsManager } from './components/manage/ConnectionsManager';
import { VerificationView } from './components/account/VerificationView';
import { SEOSchemaView } from './components/account/SEOSchemaView';
import { MasterAdminView } from './components/admin/MasterAdminView';

// Existing / Shared components
import { DossierManager } from './components/dossiers/DossierManager';
import { PASDesignStudio } from './components/design/PASDesignStudio';
import { PublishingCenter } from './components/publishing/PublishingCenter';
import { LivePASPreview } from './components/preview/LivePASPreview';

export default function App() {
  const { 
    environment, 
    setEnvironment, 
    activeRoute, 
    setActiveRoute, 
    userName, 
    userTitle,
    domainConfig
  } = usePASStore();

  // ── ENVIRONMENT 1: PUBLIC PAS PLATFORM ──
  if (environment === 'PUBLIC_PLATFORM') {
    return <PublicPASPlatform />;
  }

  // ── ENVIRONMENT 3: PUBLISHED PERSONAL PAS (Gold Template) ──
  if (environment === 'PUBLISHED_PERSONAL_PAS') {
    return <PublishedPersonalPAS />;
  }

  // ── ENVIRONMENT 4: PUBLISHED BUSINESS PAS (BPAS) ──
  if (environment === 'PUBLISHED_BPAS') {
    return <PublishedBusinessPAS />;
  }

  // ── ENVIRONMENT 2: AUTHENTICATED PAS APPLICATION ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0C0D0E', color: '#E5E7EB', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* ── GLOBAL ENVIRONMENT BAR (Toggling the 4 Environments) ── */}
      <header style={{ background: '#141619', borderBottom: '1px solid #26292E', height: '42px', display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#D4AF37', fontWeight: '700', letterSpacing: '0.06em' }}>PAS PLATFORM OS</span>
          <span style={{ color: '#4B5563' }}>|</span>
          <span style={{ color: '#9CA3AF' }}>Environment Switcher:</span>
          
          <button 
            onClick={() => setEnvironment('PUBLIC_PLATFORM')}
            style={{ background: 'transparent', border: '1px solid #26292E', color: '#9CA3AF', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>
            Public Landing
          </button>
          
          <button 
            onClick={() => setEnvironment('AUTHENTICATED_APP')}
            style={{ background: '#26292E', border: '1px solid #D4AF37', color: '#D4AF37', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>
            ● Authenticated OS
          </button>

          <button 
            onClick={() => setEnvironment('PUBLISHED_PERSONAL_PAS')}
            style={{ background: 'transparent', border: '1px solid #26292E', color: '#5C6E3A', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: '600' }}>
            Live Personal PAS (WDJ IV) ↗
          </button>

          <button 
            onClick={() => setEnvironment('PUBLISHED_BPAS')}
            style={{ background: 'transparent', border: '1px solid #26292E', color: '#3A7A6A', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: '600' }}>
            Live Business PAS (WCS) ↗
          </button>
        </div>

        <div style={{ color: '#6B7280' }}>
          Canonical: <span style={{ color: '#4A8A58' }}>{domainConfig.subdomainUrl}</span>
        </div>
      </header>

      {/* ── WORKSPACE BODY ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        
        {/* SIDEBAR NAVIGATION (Section 71 Hierarchy) */}
        <aside style={{ width: '250px', background: '#111215', borderRight: '1px solid #26292E', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: '700', color: '#D4AF37' }}>
              PAS PLATFORM
            </div>
            <div style={{ fontSize: '10px', color: '#6B7280' }}>Enterprise Authority Architecture</div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            
            {/* OVERVIEW */}
            <div style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280', fontWeight: '700', padding: '8px 10px 2px' }}>
              Overview
            </div>
            <NavBtn label="Dashboard" icon="◇" route="overview" activeRoute={activeRoute} onClick={setActiveRoute} />

            {/* BUILD */}
            <div style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4AF37', fontWeight: '700', padding: '12px 10px 2px' }}>
              Build System
            </div>
            <NavBtn label="Build & Update My PAS" icon="💬" route="builder" activeRoute={activeRoute} onClick={setActiveRoute} highlight />

            {/* MANAGE MY PAS */}
            <div style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280', fontWeight: '700', padding: '12px 10px 2px' }}>
              Manage My PAS
            </div>
            <NavBtn label="Authority Graph" icon="⬡" route="graph" activeRoute={activeRoute} onClick={setActiveRoute} />
            <NavBtn label="Dossier Library" icon="📂" route="dossiers" activeRoute={activeRoute} onClick={setActiveRoute} />
            <NavBtn label="Page Design Studio" icon="🎨" route="pagebuilder" activeRoute={activeRoute} onClick={setActiveRoute} />
            <NavBtn label="Publishing Center" icon="🚀" route="publishing" activeRoute={activeRoute} onClick={setActiveRoute} />
            <NavBtn label="Connections & Sync" icon="⛓" route="connections" activeRoute={activeRoute} onClick={setActiveRoute} />

            {/* ECOSYSTEM */}
            <div style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3A7A6A', fontWeight: '700', padding: '12px 10px 2px' }}>
              Ecosystem
            </div>
            <NavBtn label="Business PAS (BPAS)" icon="🏛️" route="bpas" activeRoute={activeRoute} onClick={() => setEnvironment('PUBLISHED_BPAS')} />
            <NavBtn label="Fellowship Network" icon="🤝" route="fellowship" activeRoute={activeRoute} onClick={setActiveRoute} />
            <NavBtn label="Knowledge Market" icon="◆" route="marketplace" activeRoute={activeRoute} onClick={setActiveRoute} />

            {/* ACCOUNT / DISCOVERY */}
            <div style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6B7280', fontWeight: '700', padding: '12px 10px 2px' }}>
              Account & Discovery
            </div>
            <NavBtn label="Verification (3 Tiers)" icon="✓" route="verify" activeRoute={activeRoute} onClick={setActiveRoute} />
            <NavBtn label="SEO & AI Schema" icon="◉" route="seo" activeRoute={activeRoute} onClick={setActiveRoute} />

            {/* ADMIN */}
            <div style={{ fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#EF4444', fontWeight: '700', padding: '12px 10px 2px' }}>
              Admin
            </div>
            <NavBtn label="Master Admin (God View)" icon="⚡" route="admin" activeRoute={activeRoute} onClick={setActiveRoute} alert />

          </nav>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #26292E', paddingTop: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#FFF' }}>{userName}</div>
            <div style={{ fontSize: '10px', color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userTitle}</div>
          </div>
        </aside>

        {/* MAIN ROUTE CONTENT */}
        <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>
          {activeRoute === 'overview' && <OverviewDashboard />}
          {activeRoute === 'builder' && <PASBuilderWorkspace />}
          {activeRoute === 'graph' && <AuthorityGraphView />}
          {activeRoute === 'dossiers' && <DossierManager />}
          {activeRoute === 'pagebuilder' && <PASDesignStudio />}
          {activeRoute === 'publishing' && <PublishingCenter />}
          {activeRoute === 'connections' && <ConnectionsManager />}
          {activeRoute === 'fellowship' && <FellowshipView />}
          {activeRoute === 'marketplace' && <MarketplaceView />}
          {activeRoute === 'verify' && <VerificationView />}
          {activeRoute === 'seo' && <SEOSchemaView />}
          {activeRoute === 'admin' && <MasterAdminView />}
        </main>

        {/* RIGHT COLUMN LIVE PAS MINI PREVIEW */}
        {activeRoute === 'builder' && (
          <aside style={{ width: '320px', borderLeft: '1px solid #26292E', background: '#111215', padding: '20px', overflowY: 'auto' }}>
            <LivePASPreview />
          </aside>
        )}

      </div>

    </div>
  );
}

function NavBtn({ 
  label, 
  icon, 
  route, 
  activeRoute, 
  onClick, 
  highlight, 
  alert 
}: { 
  label: string; 
  icon: string; 
  route: AppNavRoute; 
  activeRoute: AppNavRoute; 
  onClick: (r: AppNavRoute) => void;
  highlight?: boolean;
  alert?: boolean;
}) {
  const isActive = activeRoute === route;
  return (
    <button
      onClick={() => onClick(route)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '8px 10px',
        borderRadius: '6px',
        background: isActive ? '#26292E' : 'transparent',
        border: 'none',
        color: isActive ? '#D4AF37' : alert ? '#EF4444' : highlight ? '#F59E0B' : '#9CA3AF',
        cursor: 'pointer',
        fontSize: '12px',
        textAlign: 'left',
        fontWeight: isActive ? '600' : '500',
        transition: 'all 0.15s'
      }}>
      <span style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}>{icon}</span>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </button>
  );
}
