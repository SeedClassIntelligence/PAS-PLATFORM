
// ── REVEAL ──
const obs=new IntersectionObserver(e=>{e.forEach(x=>{if(x.isIntersecting)x.target.classList.add('v')})},{threshold:.08,rootMargin:'0px 0px -20px 0px'});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

// ── SHOWCASE TABS ──
function showP(i){document.querySelectorAll('.show-tab').forEach((t,j)=>t.classList.toggle('on',i===j));document.querySelectorAll('.show-panel').forEach((p,j)=>p.classList.toggle('on',i===j))}

// ═══ ANIMATED DEMO BUILDER ═══
const DEMO_SEQ=[
  {type:'ai',text:'<div class="ai-label">PAS Builder · Digital Real Estate Connected</div>Welcome. Connecting your digital real estate...<br><br>I\'ll extract your authority records from LinkedIn, Google Drive, Website URL, Instagram, X, Facebook, Gmail, and uploaded files. Then we can fine-tune everything through conversation.',delay:800},
  {type:'sys',text:'🔌 Connected: LinkedIn (Executive Director, ASG CDC · 47 Records)',delay:1400},
  {type:'sys',text:'🔌 Connected: Google Drive (WCS_Framework_Overview.docx, Proposal_Anthem.pdf)',delay:1000},
  {type:'sys',text:'🔌 Mapped: Website URL (wcs-framework.org · 9 Pillars Architecture)',delay:1000},
  {type:'sys',text:'📎 Uploaded: Executive_Resume_2026.pdf',delay:600},
  {type:'sys',text:'📎 Uploaded: CHW_Certification.pdf',delay:600},
  {type:'ai',text:'<div class="ai-label">PAS Builder · Authority Record Extracted</div>I\'ve synthesized 5 connected sources and 2 documents. I see an operational profile — community health systems, workforce pipelines, framework architecture.<br><br>Let\'s fine-tune: how did you get into this work?',delay:2500,mods:['01','02'],pct:25},
  {type:'user',text:'I started as a Community Health Worker — the person on the ground navigating families through every system. Over time I realized the systems were broken, so I started building new ones.',delay:3500},
  {type:'ai',text:'<div class="ai-label">PAS Builder · Mapping Identity</div>Powerful origin story. Mapped into your <strong style="color:var(--w)">Identity Module</strong>.<br><br>Your connected LinkedIn and Drive files show concurrent leadership across multiple entities. Tell me about your active implementations right now.',delay:2500,mods:['03','04'],pct:50},
  {type:'user',text:'Right now I\'m building the Advent UMC campus in Las Vegas — 50 units of housing with an integrated clinic, childcare center, and workforce pipeline. Five entities. $1M partnership with Anthem. Groundbreaking July 2026.',delay:4000},
  {type:'ai',text:'<div class="ai-label">PAS Builder · Modules Populated</div>Extracted and mapped across all 8 modules:<br>✓ <strong style="color:var(--gold)">Architecture</strong> — WCS Framework, 9 pillars<br>✓ <strong style="color:var(--gold)">Evidence</strong> — Anthem proposal, workforce outcomes<br>✓ <strong style="color:var(--gold)">Backstop</strong> — full credential archive<br><br>Your PAS Authority Record is 100% mapped from connected sources. Check the live preview →',delay:3000,mods:['05','06','07','08'],pct:100},
  {type:'sys',text:'✓ PAS Complete — 8/8 modules mapped from digital real estate. Ready to publish.',delay:2000}
];
let demoI=0,demoTimer=null;
const DMOD={
  '01':{nm:'Orientation',c:'var(--gold)'},'02':{nm:'Identity',c:'var(--gold)'},
  '03':{nm:'Execution',c:'var(--gold)'},'04':{nm:'Active Implementation',c:'var(--teal)'},
  '05':{nm:'Architecture',c:'var(--teal)'},'06':{nm:'Domain Thesis',c:'var(--blue)'},
  '07':{nm:'Backstop',c:'var(--blue)'},'08':{nm:'Evidence',c:'var(--coral)'}
};
let demoMods=[];
function runDemo(){
  if(demoI>=DEMO_SEQ.length){setTimeout(()=>{resetDemo();runDemo()},5000);return}
  const s=DEMO_SEQ[demoI];
  const msgs=document.getElementById('demo-msgs');
  const d=document.createElement('div');
  d.className='bmsg '+(s.type==='ai'?'ai':s.type==='user'?'user':'sys');
  d.innerHTML=s.type==='sys'?s.text:s.text;
  msgs.appendChild(d);
  msgs.scrollTop=msgs.scrollHeight;
  if(s.mods){s.mods.forEach(m=>{
    const el=document.getElementById('ds-'+m);
    if(el)el.classList.add('done');
    if(!demoMods.includes(m))demoMods.push(m);
  });updateDemoPV()}
  if(s.pct!==undefined){
    document.getElementById('demo-fill').style.width=s.pct+'%';
    document.getElementById('demo-pct').textContent=s.pct;
    document.getElementById('demo-cnt').textContent=Math.round(s.pct/12.5);
  }
  demoI++;
  demoTimer=setTimeout(runDemo,s.delay||2000);
}
function updateDemoPV(){
  const pv=document.getElementById('demo-pv');
  let h='';
  demoMods.forEach(m=>{const i=DMOD[m];if(!i)return;h+=`<div class="bpv-mod"><div class="bpv-mod-h" style="color:${i.c}"><span style="font-family:'Cormorant Garamond',serif;font-size:13px;opacity:.4">${m}</span> ${i.nm}</div><div class="bpv-mod-title">Content mapped</div><div class="bpv-mod-content">Module assembled from uploaded documents and conversation.</div></div>`});
  if(h)pv.innerHTML=h;
}
function resetDemo(){
  demoI=0;demoMods=[];
  document.getElementById('demo-msgs').innerHTML='';
  document.getElementById('demo-pv').innerHTML='<div class="bpv-empty"><div class="bpv-empty-icon">◇</div><div class="bpv-empty-text">Watch the AI map experience<br>into PAS modules in real time...</div></div>';
  document.getElementById('demo-fill').style.width='0%';
  document.getElementById('demo-pct').textContent='0';
  document.getElementById('demo-cnt').textContent='0';
  ['01','02','03','04','05','06','07','08'].forEach(m=>{const el=document.getElementById('ds-'+m);if(el)el.classList.remove('done')});
}
// Start demo when section is visible
const demoObs=new IntersectionObserver(e=>{e.forEach(x=>{if(x.isIntersecting&&demoI===0){setTimeout(runDemo,600)}})},{threshold:.3});
const demoEl=document.getElementById('demo');
if(demoEl)demoObs.observe(demoEl);

// ═══ PEER RECOGNITION TABS ═══
function showPR(id,el){
  document.querySelectorAll('.pr-panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('pr-'+id).classList.add('on');
  el.parentElement.querySelectorAll('.pr-tab').forEach(t=>t.classList.remove('on'));
  if(el)el.classList.add('on');
}

// ═══ MARKETPLACE TABS ═══
function showMK(id,el){
  document.querySelectorAll('#dp-marketplace .pr-panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('mk-'+id).classList.add('on');
  el.parentElement.querySelectorAll('.pr-tab').forEach(t=>t.classList.remove('on'));
  if(el)el.classList.add('on');
}

// ═══ INTERACTIVE BUILDER (Dashboard) ═══
const FLOW=[
  {ai:`<div class="ai-label">PAS Builder</div>Welcome to the Professional Authority System builder.<br><br>I\'m going to help you build your PAS through <strong style="color:var(--w)">conversation, not forms.</strong><br><br>You can <span class="hl">upload documents</span> — resume, credentials, project docs, anything. Or just <span class="hl">talk to me</span> about your work.<br><br>I\'ll map everything into PAS modules automatically.<br><br><strong style="color:var(--w)">Let\'s start.</strong> Upload something, or tell me — what do you do?`},
  {ai:`<div class="ai-label">PAS Builder</div>I\'m mapping your experience. Let me ask:<br><br>• How did you get into this work?<br>• What\'s the biggest thing you\'ve built or led?<br>• Are you working on anything active right now?<br><br>Take your time. The more you tell me, the deeper your PAS gets.`},
  {ai:`<div class="ai-label">PAS Builder</div>Strong. I\'m mapping content into your modules:<br><br><strong style="color:var(--gold)">✓ Identity Module</strong> — your professional arc<br><strong style="color:var(--gold)">✓ Execution Module</strong> — what you\'ve delivered<br><strong style="color:var(--teal)">✓ Active Implementation</strong> — current initiatives<br><br>Do you have frameworks, case studies, or your full CV? Upload or keep talking.`},
  {ai:`<div class="ai-label">PAS Builder</div>Your PAS is taking shape — check the preview panel.<br><br><strong style="color:var(--teal)">✓ Architecture Module</strong> — your authored systems<br><strong style="color:var(--blue)">✓ Domain Thesis</strong> — your field position<br><strong style="color:var(--coral)">✓ Evidence Module</strong> — case studies<br><strong style="color:var(--blue)">✓ Backstop</strong> — full credentials<br><br>Your PAS is ready. Go to <strong style="color:var(--w)">Design & Publish</strong> to choose a template and go live.`}
];
let step=0,done=new Set();
const MODS={orientation:{n:'01',nm:'Orientation',c:'var(--gold)'},identity:{n:'02',nm:'Identity',c:'var(--gold)'},execution:{n:'03',nm:'Execution',c:'var(--gold)'},active:{n:'04',nm:'Active Implementation',c:'var(--teal)'},architecture:{n:'05',nm:'Architecture',c:'var(--teal)'},thesis:{n:'06',nm:'Domain Thesis',c:'var(--blue)'},backstop:{n:'07',nm:'Backstop',c:'var(--blue)'},evidence:{n:'08',nm:'Evidence',c:'var(--coral)'}};
function initB(){const m=document.getElementById('bchat-msgs');if(!m)return;m.innerHTML='';addAI(FLOW[0].ai);addUpload()}
function addAI(h){const m=document.getElementById('bchat-msgs'),d=document.createElement('div');d.className='bmsg ai';d.innerHTML=h;m.appendChild(d);m.scrollTop=m.scrollHeight}
function addUser(t){const m=document.getElementById('bchat-msgs'),d=document.createElement('div');d.className='bmsg user';d.textContent=t;m.appendChild(d);m.scrollTop=m.scrollHeight}
function addSys(t){const m=document.getElementById('bchat-msgs'),d=document.createElement('div');d.className='bmsg sys';d.textContent=t;m.appendChild(d);m.scrollTop=m.scrollHeight}
function addUpload(){const m=document.getElementById('bchat-msgs'),d=document.createElement('div');d.className='bupload';d.onclick=()=>document.getElementById('bfile').click();d.innerHTML=`<div class="bupload-icon">📄</div><div class="bupload-text">Drop files here or click to upload</div><div class="bupload-hint">Resume, credentials, project docs, proposals — anything</div>`;m.appendChild(d);m.scrollTop=m.scrollHeight}
function bFiles(files){for(let f of files)addSys('📎 Uploaded: '+f.name);if(step===0){step=1;setTimeout(()=>{markDone('orientation');markDone('identity');updatePV(['orientation','identity']);addAI(FLOW[1].ai)},800)}}
function bSend(){const inp=document.getElementById('binput'),t=inp.value.trim();if(!t)return;inp.value='';addUser(t);step++;const fi=Math.min(step,FLOW.length-1);setTimeout(()=>{if(step<=1){markDone('orientation');markDone('identity');updatePV(['orientation','identity'])}else if(step===2){markDone('execution');markDone('active');updatePV(['orientation','identity','execution','active'])}else{markDone('architecture');markDone('thesis');markDone('evidence');markDone('backstop');updatePV(Object.keys(MODS))}addAI(FLOW[fi].ai)},600+Math.random()*400)}
function markDone(m){done.add(m);const el=document.querySelector(`#dp-builder .bsb-l[data-m="${m}"]`);if(el)el.classList.add('done');updProg()}
function updProg(){const d=Math.min(done.size,8),p=Math.round(d/8*100);document.getElementById('bfill').style.width=p+'%';document.getElementById('bpct').textContent=p;document.getElementById('bcnt').textContent=d}
function updatePV(mods){const b=document.getElementById('bpv-body');let h='';mods.forEach(m=>{const i=MODS[m];if(!i)return;h+=`<div class="bpv-mod"><div class="bpv-mod-h" style="color:${i.c}"><span style="font-family:'Cormorant Garamond',serif;font-size:13px;opacity:.4">${i.n}</span> ${i.nm}</div><div class="bpv-mod-title">Content mapped from conversation</div><div class="bpv-mod-content">Module assembled from your uploaded documents and conversation.</div></div>`});b.innerHTML=h||b.innerHTML}
function selectTemplate(el){el.parentElement.querySelectorAll('[onclick*=selectTemplate]').forEach(t=>{t.style.borderColor='var(--bd)';t.style.borderWidth='1px';const ck=t.querySelector('[style*="position:absolute"]');if(ck)ck.style.display='none'});el.style.borderColor='var(--gold)';el.style.borderWidth='2px';const ck=el.querySelector('[style*="position:absolute"]');if(ck)ck.style.display='flex'}
setTimeout(initB,100);

// ═══ AUTH MODAL ═══
function openAuth(tab){
  document.getElementById('auth-modal').classList.add('open');
  document.body.style.overflow='hidden';
  showAuthTab(tab||'signup');
}
function closeAuth(){
  document.getElementById('auth-modal').classList.remove('open');
  document.body.style.overflow='';
}
function showAuthTab(id){
  document.querySelectorAll('.auth-form').forEach(f=>f.classList.remove('on'));
  document.getElementById('auth-'+id).classList.add('on');
  document.querySelectorAll('.auth-tab').forEach((t,i)=>t.classList.toggle('on',id==='signup'?i===0:i===1));
  document.getElementById('auth-subtitle').textContent=id==='signup'?'Build your Professional Authority System':'Welcome back';
}
function selectAuthType(el){
  el.parentElement.querySelectorAll('.auth-type').forEach(t=>t.classList.remove('selected'));
  el.classList.add('selected');
}

// ═══ FRONT PAGE EXAMPLE TABS ═══
function showFrontEx(i){
  document.querySelectorAll('#showcase .show-panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('fex-'+i).classList.add('on');
  document.querySelectorAll('#showcase .show-tab').forEach((t,j)=>t.classList.toggle('on',i===j));
}

// ═══ PUBLISHED PAS EXAMPLES ═══
function showPubEx(i){
  document.querySelectorAll('#pub-overlay .show-panel').forEach(p=>p.classList.remove('on'));
  document.getElementById('pubex-'+i).classList.add('on');
  [0,1,2].forEach(j=>{document.getElementById('pex-'+j).classList.toggle('on',i===j)});
}
function openPubEx(i){
  togglePub();
  setTimeout(()=>showPubEx(i),100);
}

// ═══ PUBLISHED PAS ═══
function togglePub(){
  document.getElementById('pub-overlay').classList.toggle('open');
  document.body.style.overflow=document.getElementById('pub-overlay').classList.contains('open')?'hidden':'';
  // Hide schema badge when closed
  const schema=document.querySelector('.pub-schema');
  if(schema)schema.style.display=document.getElementById('pub-overlay').classList.contains('open')?'block':'none';
}
function publishPAS(){
  const s=document.getElementById('pas-status');
  s.textContent='Live';s.className='n-status live';
  document.getElementById('pub-btn').textContent='Published';
  openPubEx(0);
}

// ═══ DASHBOARD ═══
function toggleDash(){
  document.getElementById('dash-overlay').classList.toggle('open');
  document.body.style.overflow=document.getElementById('dash-overlay').classList.contains('open')?'hidden':'';
}
function showDP(id,el){
  document.querySelectorAll('.d-panel').forEach(p=>p.classList.remove('on'));
  const target = document.getElementById('dp-'+id) || document.getElementById(id);
  if(target) target.classList.add('on');
  document.querySelectorAll('.d-sbl').forEach(s=>s.classList.remove('on'));
  if(el) el.classList.add('on');
}

// ═══ ENHANCEMENTS JS ═══
function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `pas-toast show ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function navigateTo(route, el) {
  const routeMap = {
    'overview': 'dp-overview',
    'builder': 'dp-builder',
    'design': 'dp-design',
    'tools': 'dp-tools',
    'peers': 'dp-peers',
    'marketplace': 'dp-marketplace',
    'verify': 'dp-verify',
    'bpas': 'dp-bpas',
    'bentities': 'dp-bentities',
    'bteam': 'dp-bteam',
    'bproposals': 'dp-bproposals',
    'btracker': 'dp-btracker',
    'brevenue': 'dp-brevenue',
    'bagreements': 'dp-bagreements',
    'bframeworks': 'dp-bframeworks',
    'connections': 'dp-connections',
    'seo': 'dp-seo',
    'domain': 'dp-domains',
    'seo': 'dp-pagebuilder',
    'design': 'dp-pagebuilder',
    'domains': 'dp-domains',
    'admin': 'dp-admin',
    'dossiers': 'dp-dossiers',
    'graph': 'dp-graph',
    'pagebuilder': 'dp-pagebuilder',
    'publishing': 'dp-publishing'
  };
  const panelId = routeMap[route];
  if (!panelId) return;
  
  document.querySelectorAll('.d-panel').forEach(p => p.classList.remove('on'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('on');
  
  document.querySelectorAll('.d-sbl').forEach(s => s.classList.remove('on'));
  if (el) el.classList.add('on');
  else {
    const sbl = document.querySelector(`.d-sbl[data-route="${route}"]`);
    if (sbl) sbl.classList.add('on');
  }
  
  const dashOverlay = document.getElementById('dash-overlay');
  if (dashOverlay && !dashOverlay.classList.contains('open')) {
    if (typeof toggleDash === 'function') {
      toggleDash();
    }
  }
}

window.PAS_CONNECTIONS = {
  linkedin: { connected: true, status: 'Connected', records: 47 },
  google_drive: { connected: true, status: 'Connected', records: 23 },
  website: { connected: false, status: 'Not connected' },
  instagram: { connected: false, status: 'Not connected' },
  twitter: { connected: false, status: 'Not connected' },
  facebook: { connected: false, status: 'Not connected' },
  tell_ai: { connected: false, status: 'Not connected' },
  upload: { connected: false, status: 'Not connected' },
  gmail: { connected: true, status: 'Connected', records: 12 },
  google_calendar: { connected: true, status: 'Connected', records: 8 },
  google_sheets: { connected: false, status: 'Not connected' },
  dropbox: { connected: false, status: 'Not connected' },
  onedrive: { connected: false, status: 'Not connected' }
};

function connectSource(source, btnEl) {
  const conn = PAS_CONNECTIONS[source];
  if (!conn) return;
  
  if (conn.connected) {
    conn.connected = false;
    conn.status = 'Not connected';
    if (btnEl) {
      btnEl.textContent = 'Connect';
      btnEl.style.background = 'var(--gold)';
      btnEl.style.color = '#fff';
    }
    showToast(source.replace(/_/g,' ') + ' disconnected', 'info');
  } else {
    conn.connected = true;
    conn.status = 'Connected';
    conn.records = Math.floor(Math.random() * 30) + 5;
    if (btnEl) {
      btnEl.textContent = 'Connected ✓';
      btnEl.style.background = 'rgba(74,138,88,.08)';
      btnEl.style.color = 'var(--green)';
    }
    showToast(source.replace(/_/g,' ') + ' connected! ' + conn.records + ' records found.', 'success');
  }
  
  const card = btnEl ? btnEl.closest('.source-card') : null;
  if (card) {
    const statusEl = card.querySelector('.source-status');
    if (statusEl) statusEl.textContent = conn.status;
  }
  
  syncConnectionsPanel();
}

function syncConnectionsPanel() {
  const connPanel = document.getElementById('dp-connections');
  if (!connPanel) return;
  const connCards = connPanel.querySelectorAll('[data-source]');
  connCards.forEach(card => {
    const src = card.getAttribute('data-source');
    const conn = PAS_CONNECTIONS[src];
    if (!conn) return;
    const statusEl = card.querySelector('.conn-status');
    if (statusEl) {
      statusEl.textContent = conn.status;
      statusEl.style.color = conn.connected ? 'var(--green)' : 'var(--dim)';
    }
  });
}

let currentStage = 1;
function setBuilderStage(n) {
  currentStage = n;
  document.querySelectorAll('.stage-num').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < n) s.classList.add('done');
    if (i + 1 === n) s.classList.add('active');
  });
  document.querySelectorAll('.stage-panel').forEach(p => p.classList.remove('on'));
  const panel = document.getElementById('stage-' + n);
  if (panel) panel.classList.add('on');
  showToast('Stage ' + n + ' of 9', 'info');
}

function showGraphTab(id, el) {
  const parent = document.getElementById('dp-graph');
  if (!parent) return;
  parent.querySelectorAll('.pr-panel').forEach(p => p.classList.remove('on'));
  const panel = document.getElementById('graph-' + id);
  if (panel) panel.classList.add('on');
  parent.querySelectorAll('.pr-tab').forEach(t => t.classList.remove('on'));
  if (el) el.classList.add('on');
}

function showPBTab(tabId, el) {
  const container = document.getElementById('dp-pagebuilder');
  if (!container) return;
  
  container.querySelectorAll('.pr-panel').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('on');
  });
  
  const target = document.getElementById(tabId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('on');
  }
  
  if (el && el.parentElement) {
    el.parentElement.querySelectorAll('.pr-tab').forEach(t => {
      t.style.borderBottom = 'none';
      t.style.color = 'var(--mu)';
      t.classList.remove('active', 'on');
    });
    el.style.borderBottom = '2px solid var(--gold)';
    el.style.color = 'var(--gold)';
    el.classList.add('active', 'on');
  }
}

function showDossierBuilder() {
  const listPanel = document.getElementById('dossier-list-panel');
  const builderPanel = document.getElementById('dossier-builder-panel');
  if (listPanel) listPanel.style.display = 'none';
  if (builderPanel) builderPanel.style.display = 'block';
  showToast('Dossier Builder opened', 'info');
}

function showDossierList() {
  const listPanel = document.getElementById('dossier-list-panel');
  const builderPanel = document.getElementById('dossier-builder-panel');
  if (listPanel) listPanel.style.display = 'block';
  if (builderPanel) builderPanel.style.display = 'none';
}

function simulateDeploy() {
  const steps = document.querySelectorAll('#deploy-steps .deploy-step');
  if (!steps.length) return;
  let i = 0;
  showToast('Deploying v13...', 'info');
  const container = document.getElementById('deploy-steps');
  if (container) container.style.display = 'block';
  function nextStep() {
    if (i >= steps.length) {
      showToast('PAS v13 published successfully!', 'success');
      return;
    }
    steps[i].classList.remove('pending');
    steps[i].classList.add('active');
    setTimeout(() => {
      steps[i].classList.remove('active');
      steps[i].classList.add('done');
      i++;
      nextStep();
    }, 400 + Math.random() * 300);
  }
  nextStep();
}

function showWizardStep(n) {
  document.querySelectorAll('.wizard-step').forEach((s, i) => {
    s.classList.remove('active');
    if (i + 1 === n) s.classList.add('active');
  });
  showToast('Step ' + n + ' of 7', 'info');
}

function selectPubMode(mode, el) {
  document.querySelectorAll('.pub-mode-option').forEach(o => o.classList.remove('selected'));
  if (el) el.classList.add('selected');
  showToast('Publishing mode: ' + mode, 'info');
}


function applyDesignParadigm(theme) {
  const themes = {
    'olive': { bg: '#F4F1EB', gold: '#3D5A2A', font: 'Cormorant Garamond', name: 'Personal Authority (Olive / Sand)' },
    'obsidian': { bg: '#0B0B0C', gold: '#3B82F6', font: 'JetBrains Mono', name: 'Governing Intelligence (Obsidian)' },
    'midnight': { bg: '#07101F', gold: '#E8A020', font: 'DM Sans', name: 'Universal Ecosystem (Midnight)' },
    'corporate': { bg: '#F5F0E8', gold: '#1B4F8A', font: 'Playfair Display', name: 'Corporate & Grant (Cream / Navy)' },
    'tactical': { bg: '#F7F3ED', gold: '#1A1510', font: 'DM Mono', name: 'Tactical Build Tracker (Sand / Ink)' }
  };
  const t = themes[theme] || themes['olive'];
  showToast('Applied Theme: ' + t.name, 'success');
}


function toggleBuilderMode(mode) {
  const streamWrap = document.getElementById('mode-streamlined-wrap');
  const pipeWrap = document.getElementById('mode-pipeline-wrap');
  const btnStream = document.getElementById('btn-mode-streamlined');
  const btnPipe = document.getElementById('btn-mode-pipeline');

  if (mode === 'pipeline') {
    if (streamWrap) streamWrap.style.display = 'none';
    if (pipeWrap) pipeWrap.style.display = 'block';
    if (btnStream) {
      btnStream.style.background = 'var(--bg3)';
      btnStream.style.border = '1px solid var(--bd2)';
      btnStream.style.color = 'var(--off)';
      btnStream.style.boxShadow = 'none';
    }
    if (btnPipe) {
      btnPipe.style.background = 'var(--gold)';
      btnPipe.style.border = 'none';
      btnPipe.style.color = '#fff';
      btnPipe.style.boxShadow = '0 0 10px rgba(212,175,55,0.2)';
    }
    showToast('Switched to Deep 9-Stage Authority Pipeline', 'info');
  } else {
    if (streamWrap) streamWrap.style.display = 'block';
    if (pipeWrap) pipeWrap.style.display = 'none';
    if (btnPipe) {
      btnPipe.style.background = 'var(--bg3)';
      btnPipe.style.border = '1px solid var(--bd2)';
      btnPipe.style.color = 'var(--off)';
      btnPipe.style.boxShadow = 'none';
    }
    if (btnStream) {
      btnStream.style.background = 'var(--gold)';
      btnStream.style.border = 'none';
      btnStream.style.color = '#fff';
      btnStream.style.boxShadow = '0 0 10px rgba(212,175,55,0.2)';
    }
    showToast('Switched to Streamlined Live Builder', 'info');
  }
}


function updateEngineIndicator(msg, stage = 'Processing') {
  const txt = document.getElementById('indicator-text');
  const stg = document.getElementById('indicator-stage');
  if (txt) txt.textContent = msg;
  if (stg) stg.textContent = stage;
}


function setPreviewMode(mode, btnEl) {
  const frame = document.getElementById('preview-render-frame');
  if (!frame) return;
  
  if (mode === 'mobile') {
    frame.style.maxWidth = '375px';
  } else if (mode === 'tablet') {
    frame.style.maxWidth = '640px';
  } else {
    frame.style.maxWidth = '100%';
  }
  showToast('Switched to ' + mode.toUpperCase() + ' viewport preview', 'info');
}


function selectPASType(type, cardEl) {
  document.querySelectorAll('.pas-type-card').forEach(c => {
    c.style.border = '1px solid var(--bd)';
    const badge = c.querySelector('div[style*="position:absolute"]');
    if (badge) badge.remove();
  });
  if (cardEl) {
    cardEl.style.border = '2px solid var(--gold)';
    const badge = document.createElement('div');
    badge.style.cssText = 'position:absolute;top:10px;right:10px;font-size:10px;padding:2px 8px;border-radius:4px;background:var(--gold);color:#fff;font-weight:600';
    badge.textContent = 'Selected Type';
    cardEl.appendChild(badge);
  }
  showToast('Selected PAS Type: ' + type.toUpperCase(), 'success');
}

function updateBrandColor(colorHex) {
  const picker = document.getElementById('brandColorPicker');
  const label = document.getElementById('brandColorHex');
  if (picker) picker.value = colorHex;
  if (label) label.textContent = colorHex.toUpperCase();
  
  const frame = document.getElementById('preview-render-frame');
  if (frame) frame.style.borderColor = colorHex;
  
  showToast('Brand Accent Color set to ' + colorHex.toUpperCase(), 'info');
}


let currentConnectingSource = '';


function closeConnectModal() {
  const modal = document.getElementById('modal-connect-source');
  if (modal) modal.style.display = 'none';
}

function submitConnectSource() {
  const val = document.getElementById('modal-input-val').value;
  closeConnectModal();
  
  showToast('Connecting to ' + currentConnectingSource.replace('_',' ') + '...', 'info');
  updateEngineIndicator('⚡ AI Active: Parsing ' + currentConnectingSource.replace('_',' ') + ' (' + (val || 'OAuth Link') + ')...', 'Parsing Records');
  
  setTimeout(() => {
    syncLivePASPreview(currentConnectingSource);
    showToast('Successfully extracted records from ' + currentConnectingSource.replace('_',' ') + '! Live PAS updated.', 'success');
    updateEngineIndicator('⚡ Engine Ready — Authority record updated with ' + currentConnectingSource.replace('_',' ') + ' records.', 'System Ready');
  }, 1500);
}

function syncLivePASPreview(source) {
  const bpvBody = document.getElementById('bpv-body');
  if (!bpvBody) return;
  
  bpvBody.innerHTML = `
    <div style="background:var(--bg3);border:1px solid var(--gold);border-radius:8px;padding:14px;margin-bottom:12px;animation:fadein 0.4s ease">
      <div style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:600;color:var(--w);margin-bottom:2px">William Darnell Jernigan IV</div>
      <div style="font-size:11px;color:var(--gold);margin-bottom:8px">WCS Architect · Executive Director</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">
        <span style="font-size:8px;padding:2px 6px;border-radius:3px;background:rgba(74,138,88,.15);color:var(--green);border:1px solid rgba(74,138,88,.3)">✓ Document Verified</span>
        <span style="font-size:8px;padding:2px 6px;border-radius:3px;background:rgba(181,148,83,.15);color:var(--gold);border:1px solid var(--bd2)">★ Platform Verified</span>
      </div>
    </div>
    
    <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gd);font-weight:600;margin-bottom:8px">Extracted Authority Modules</div>
    
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;color:var(--gold);font-weight:600">M01 ORIENTATION</span>
          <span style="font-size:9px;color:var(--green)">12 Records</span>
        </div>
        <div style="font-size:12px;color:var(--w);font-weight:500;margin-top:2px">WCS Foundational Mission & Health Equity Thesis</div>
      </div>
      
      <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;color:var(--gold);font-weight:600">M02 IDENTITY</span>
          <span style="font-size:9px;color:var(--green)">18 Records</span>
        </div>
        <div style="font-size:12px;color:var(--w);font-weight:500;margin-top:2px">NP Licensure, CHW Certification & Credentials</div>
      </div>
      
      <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;color:var(--gold);font-weight:600">M03 EXECUTION</span>
          <span style="font-size:9px;color:var(--green)">24 Records</span>
        </div>
        <div style="font-size:12px;color:var(--w);font-weight:500;margin-top:2px">ASG CDC Executive Leadership & Workforce Deployment</div>
      </div>
      
      <div style="background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:10px;color:var(--gold);font-weight:600">M04 ACTIVE IMPL.</span>
          <span style="font-size:9px;color:var(--green)">8 Records</span>
        </div>
        <div style="font-size:12px;color:var(--w);font-weight:500;margin-top:2px">Advent UMC 50-Unit Campus & Anthem $1M LOI</div>
      </div>
    </div>
    
    <button onclick="togglePub()" style="width:100%;margin-top:14px;padding:8px;background:var(--gold);color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Inspect Full Published PAS ↗</button>
  `;

  const fill = document.getElementById('bfill');
  const pct = document.getElementById('bpct');
  const cnt = document.getElementById('bcnt');
  if (fill) fill.style.width = '100%';
  if (pct) pct.textContent = '100';
  if (cnt) cnt.textContent = '8';
}

