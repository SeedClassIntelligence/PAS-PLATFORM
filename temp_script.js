
// ── REVEAL ──
const obs=new IntersectionObserver(e=>{e.forEach(x=>{if(x.isIntersecting)x.target.classList.add('v')})},{threshold:.08,rootMargin:'0px 0px -20px 0px'});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));

// ── SHOWCASE TABS ──
function showP(i){document.querySelectorAll('.show-tab').forEach((t,j)=>t.classList.toggle('on',i===j));document.querySelectorAll('.show-panel').forEach((p,j)=>p.classList.toggle('on',i===j))}

// ═══ ANIMATED DEMO BUILDER ═══
const DEMO_SEQ=[
  {type:'ai',text:'<div class="ai-label">PAS Builder</div>Welcome. I\'m going to build your Professional Authority System through conversation.<br><br>Upload your documents or tell me about your work. I\'ll map everything into the right modules automatically.',delay:800},
  {type:'sys',text:'📎 Uploaded: Executive_Resume_2026.pdf',delay:2000},
  {type:'sys',text:'📎 Uploaded: CHW_Certification.pdf',delay:600},
  {type:'sys',text:'📎 Uploaded: WCS_Framework_Overview.docx',delay:600},
  {type:'ai',text:'<div class="ai-label">PAS Builder · Analyzing</div>I\'ve processed 3 documents. I can see a strong operational profile — community health systems, workforce pipelines, framework architecture.<br><br>Let me ask: how did you get into this work?',delay:2500,mods:['01','02'],pct:25},
  {type:'user',text:'I started as a Community Health Worker — the person on the ground navigating families through every system they needed. Over time I realized the systems themselves were broken, so I started building new ones.',delay:3500},
  {type:'ai',text:'<div class="ai-label">PAS Builder · Mapping</div>Powerful origin story. I\'m mapping that into your <strong style="color:var(--w)">Identity Module</strong> — the arc from practitioner to systems architect.<br><br>Your resume shows concurrent leadership across multiple entities. Tell me about what you\'re executing right now.',delay:2500,mods:['03','04'],pct:50},
  {type:'user',text:'Right now I\'m building the Advent UMC campus in Las Vegas — 50 units of housing with an integrated clinic, childcare center, and a four-stage workforce pipeline. Five entities. $1M partnership with Anthem. Groundbreaking July 2026.',delay:4000},
  {type:'ai',text:'<div class="ai-label">PAS Builder · Modules Populating</div>This is exactly what the <strong style="color:var(--w)">Active Implementation</strong> and <strong style="color:var(--w)">Architecture</strong> modules are for.<br><br>I\'m building out:<br>✓ <strong style="color:var(--gold)">Architecture</strong> — WCS Framework, 9 pillars, WCSN model<br>✓ <strong style="color:var(--gold)">Evidence</strong> — Anthem proposal, workforce outcomes<br>✓ <strong style="color:var(--gold)">Backstop</strong> — full credential archive<br><br>Your PAS is 100% mapped. Check the preview →',delay:3000,mods:['05','06','07','08'],pct:100},
  {type:'sys',text:'✓ PAS Complete — 8/8 modules mapped. Ready to publish.',delay:2000}
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
  {ai:`<div class="ai-label">PAS Builder</div>Welcome to the Professional Authority System builder.<br><br>I'm going to help you build your PAS through <strong style="color:var(--w)">conversation, not forms.</strong><br><br>You can <span class="hl">upload documents</span> — resume, credentials, project docs, anything. Or just <span class="hl">talk to me</span> about your work.<br><br>I'll map everything into PAS modules automatically.<br><br><strong style="color:var(--w)">Let's start.</strong> Upload something, or tell me — what do you do?`},
  {ai:`<div class="ai-label">PAS Builder</div>I'm mapping your experience. Let me ask:<br><br>• How did you get into this work?<br>• What's the biggest thing you've built or led?<br>• Are you working on anything active right now?<br><br>Take your time. The more you tell me, the deeper your PAS gets.`},
  {ai:`<div class="ai-label">PAS Builder</div>Strong. I'm mapping content into your modules:<br><br><strong style="color:var(--gold)">✓ Identity Module</strong> — your professional arc<br><strong style="color:var(--gold)">✓ Execution Module</strong> — what you've delivered<br><strong style="color:var(--teal)">✓ Active Implementation</strong> — current initiatives<br><br>Do you have frameworks, case studies, or your full CV? Upload or keep talking.`},
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
  document.getElementById('dp-'+id).classList.add('on');
  document.querySelectorAll('.d-sbl').forEach(s=>s.classList.remove('on'));
  if(el)el.classList.add('on');
}
