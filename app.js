/* app.js - updated with bottom-sheet guided flow (flexible)
   Keep the rest of the features (wizard, autosave, charts, export) intact.
*/

const ANGLES = [
  -35,-30,-25,-20,-14,-13,-12,-11,-10,
  -9,-8,-7,-6,-5,-4,-3,-2.5,-2,-1.5,-1,-0.5,
  0,0.5,1,1.5,2,2.5,3,4,5,6,7,8,9,10,11,12,13,14,20,25,30,35
];

const COLUMNS = ['DDM','SDM','RF'];
const STORAGE_KEY = 'llz_data_v1';

// ---------- App state ----------
let state = {
  meta: { station:'', freq:'', make:'', model:'', refDate:'', presDate:'', course:'' },
  values: { tx1: { present:[], reference:[] }, tx2: { present:[], reference:[] } },
  current: { tx:'tx1', type:'present', direction:'neg2pos', idx:0 }
};

function initArrays(){
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(t=>{
      state.values[tx][t] = ANGLES.map(()=>({DDM:null,SDM:null,RF:null}));
    });
  });
}
initArrays();

// utilities
function $(id){ return document.getElementById(id); }
function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
function formatDateOK(s){ return /^\d{2}-\d{2}-\d{4}$/.test(s); }
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{
      const loaded = JSON.parse(raw);
      // basic merge
      if(loaded.meta) state.meta = Object.assign(state.meta, loaded.meta);
      if(loaded.values) state.values = Object.assign(state.values, loaded.values);
      if(loaded.current) state.current = Object.assign(state.current, loaded.current);
      // ensure arrays correct length
      ['tx1','tx2'].forEach(tx=>{
        ['present','reference'].forEach(t=>{
          if(!state.values[tx] || !state.values[tx][t] || state.values[tx][t].length !== ANGLES.length){
            state.values[tx][t] = ANGLES.map(()=>({DDM:null,SDM:null,RF:null}));
          }
        });
      });
    }catch(e){ console.warn('loadState failed',e); initArrays(); }
  }
}
function clearSaved(){ localStorage.removeItem(STORAGE_KEY); initArrays(); state.meta={station:'',freq:'',make:'',model:'',refDate:'',presDate:'',course:''}; state.current={tx:'tx1',type:'present',direction:'neg2pos',idx:0}; saveState(); }

// load initial state
loadState();

// ---------- UI navigation ----------
function showPage(id){
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  $(id).classList.remove('hidden');
  window.scrollTo(0,0);
}
function populateMetaFromUI(){
  state.meta.station = $('station').value.trim();
  state.meta.freq = $('freq').value.trim();
  state.meta.make = $('make').value.trim();
  state.meta.model = $('model').value.trim();
  state.meta.refDate = $('refDate').value.trim();
  state.meta.presDate = $('presDate').value.trim();
  state.meta.course = $('course').value.trim();
  saveState();
}
function applyHeaderCheck(){
  const ref = $('refDate').value.trim();
  const pres = $('presDate').value.trim();
  if(!formatDateOK(ref) || !formatDateOK(pres)){
    alert('Please enter REF and PRES dates in DD-MM-YYYY');
    return false;
  }
  return true;
}

// ---------- Bottom sheet helpers ----------
function createBottomSheetDOM(){
  // avoid duplicate overlay
  if(document.querySelector('.bs-overlay')) return;
  const overlay = el('div','bs-overlay');
  overlay.innerHTML = `
    <div class="bottom-sheet" role="dialog" aria-modal="true">
      <div class="bs-handle"></div>
      <div class="sheet-title" id="sheetTitle"></div>
      <div class="sheet-sub" id="sheetSub"></div>
      <div class="sheet-buttons" id="sheetButtons"></div>
      <div class="sheet-actions" id="sheetActions"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e)=>{
    if(e.target === overlay) hideBottomSheet();
  });
}
function showBottomSheet(title, subtitle, buttons){
  // buttons: [{label, kind:'primary'|'secondary'|'ghost', action: function}]
  createBottomSheetDOM();
  const overlay = document.querySelector('.bs-overlay');
  const sheet = overlay.querySelector('.bottom-sheet');
  overlay.classList.add('show');
  setTimeout(()=> sheet.classList.add('show'), 20);
  $('sheetTitle').textContent = title || '';
  $('sheetSub').textContent = subtitle || '';
  const container = $('sheetButtons');
  container.innerHTML = '';
  buttons.forEach(btn=>{
    const b = el('button','sheet-btn');
    if(btn.kind === 'primary') b.classList.add('primary');
    else if(btn.kind === 'secondary') b.classList.add('secondary');
    else if(btn.kind === 'ghost') b.classList.add('ghost');
    b.textContent = btn.label;
    b.onclick = ()=> {
      // auto-close then run action
      hideBottomSheet();
      setTimeout(()=> { if(typeof btn.action === 'function') btn.action(); }, 280);
    };
    container.appendChild(b);
  });
  // extra actions row (optional) - clear
  $('sheetActions').innerHTML = '<button class="btn" onclick="hideBottomSheet()">Close</button>';
}
function hideBottomSheet(){
  const overlay = document.querySelector('.bs-overlay');
  if(!overlay) return;
  const sheet = overlay.querySelector('.bottom-sheet');
  sheet.classList.remove('show');
  setTimeout(()=> overlay.classList.remove('show'), 260);
}

// ---------- Wizard helpers ----------
function getAngleIndexByOrder(idx){
  if(state.current.direction === 'neg2pos') return idx;
  return ANGLES.length - 1 - idx;
}
function showWizardForCurrent(){
  const tx = state.current.tx, type = state.current.type;
  const total = ANGLES.length;
  if(state.current.idx < 0) state.current.idx = 0;
  if(state.current.idx >= total) state.current.idx = total -1;
  const orderIdx = getAngleIndexByOrder(state.current.idx);
  const angle = ANGLES[orderIdx];
  $('angleValue').textContent = angle;
  $('wizardTitle').textContent = `Entering ${tx.toUpperCase()} — ${type.toUpperCase()}`;
  $('wizardMeta').textContent = `Station: ${state.meta.station || '-'}  REF: ${state.meta.refDate || '-'}  PRES: ${state.meta.presDate || '-'}`;
  const saved = state.values[tx][type][orderIdx];
  // set DDM sign UI
  if(angle === 0){
    $('ddmSign').textContent = (saved && saved._ddmSign) ? saved._ddmSign : '+';
    $('ddmSign').style.display = 'inline-block';
    $('ddmSign').onclick = ()=>{ $('ddmSign').textContent = ($('ddmSign').textContent === '+')?'-':'+'; };
  } else {
    $('ddmSign').textContent = (angle < 0) ? '-' : '+';
    $('ddmSign').style.display = 'inline-block';
    $('ddmSign').onclick = null;
  }
  $('ddmInput').value = (saved && saved.DDM !== null) ? Math.abs(saved.DDM) : '';
  $('sdmInput').value = (saved && saved.SDM !== null) ? Math.abs(saved.SDM) : '';
  $('rfInput').value = (saved && saved.RF !== null) ? Math.abs(saved.RF) : '';
  $('wizardProgress').textContent = `Angle ${state.current.idx+1} of ${ANGLES.length}`;
}

function wizardSaveCurrent(){
  const tx = state.current.tx, type = state.current.type;
  const orderIdx = getAngleIndexByOrder(state.current.idx);
  const angle = ANGLES[orderIdx];
  let ddmRaw = $('ddmInput').value.trim();
  let sdmRaw = $('sdmInput').value.trim();
  let rfRaw  = $('rfInput').value.trim();
  let ddmNum = ddmRaw === '' ? null : Number(ddmRaw);
  let sdmNum = sdmRaw === '' ? null : Number(sdmRaw);
  let rfNum  = rfRaw  === '' ? null : Number(rfRaw);
  if(ddmNum !== null && isNaN(ddmNum)){ alert('DDM must be numeric or blank'); return false; }
  if(sdmNum !== null && isNaN(sdmNum)){ alert('SDM must be numeric or blank'); return false; }
  if(rfNum !== null  && isNaN(rfNum)){ alert('RF must be numeric or blank'); return false; }
  // apply signs
  if(ddmNum !== null){
    if(angle < 0) ddmNum = -Math.abs(ddmNum);
    else if(angle > 0) ddmNum = Math.abs(ddmNum);
    else { const s = $('ddmSign').textContent; ddmNum = (s === '-') ? -Math.abs(ddmNum) : Math.abs(ddmNum); }
  }
  if(sdmNum !== null) sdmNum = Math.abs(sdmNum);
  if(rfNum !== null) rfNum = -Math.abs(rfNum);
  state.values[tx][type][orderIdx] = { DDM: ddmNum, SDM: sdmNum, RF: rfNum, _ddmSign: (angle===0? $('ddmSign').textContent : (angle<0?'-':'+')) };
  saveState();
  return true;
}

function wizardNext(){
  if(!wizardSaveCurrent()) return;
  state.current.idx++;
  const total = ANGLES.length;
  if(state.current.idx >= total) state.current.idx = total -1;
  showWizardForCurrent();
}
function wizardPrev(){
  wizardSaveCurrent();
  state.current.idx--;
  if(state.current.idx < 0) state.current.idx = 0;
  showWizardForCurrent();
}

// ---------- New: Next-step logic after saving/finish ----------
function isStageComplete(tx, type){
  // consider complete if at least one of DDM/SDM/RF is filled for every angle
  const arr = state.values[tx][type];
  for(let i=0;i<arr.length;i++){
    const r = arr[i];
    if(r.DDM === null && r.SDM === null && r.RF === null) return false;
  }
  return true;
}

function showNextStepModal(afterTx, afterType){
  // build recommended sequence based on current saved state, but keep it flexible (user may choose any)
  const txOther = (afterTx === 'tx1') ? 'tx2' : 'tx1';
  const bothPresentDone = isStageComplete('tx1','present') && isStageComplete('tx2','present');
  // title & subtitle
  const title = `${afterTx.toUpperCase()} ${afterType.toUpperCase()} saved`;
  const subtitle = 'What would you like to do next?';

  // build buttons array in recommended order:
  const buttons = [];

  // Recommendation logic:
  if(afterType === 'present'){
    // prioritize remaining present if not done
    if(!isStageComplete(txOther,'present')){
      buttons.push({ label: `Enter ${txOther.toUpperCase()} PRESENT`, kind:'primary', action: ()=> { jumpToWizard(txOther,'present'); } });
    } else {
      // both Presents done -> recommend references
      buttons.push({ label: `Enter ${afterTx.toUpperCase()} REFERENCE`, kind:'primary', action: ()=> { jumpToWizard(afterTx,'reference'); } });
    }
    // still offer other choices (flexible)
    buttons.push({ label: `Enter ${afterTx.toUpperCase()} PRESENT (edit)`, kind:'secondary', action: ()=> { jumpToWizard(afterTx,'present'); } });
    buttons.push({ label: `Enter ${txOther.toUpperCase()} REFERENCE`, kind:'secondary', action: ()=> { jumpToWizard(txOther,'reference'); } });
    buttons.push({ label: `View Results`, kind:'ghost', action: ()=> { showPage('page-results'); } });
  } else { // afterType === 'reference'
    // recommend the other reference if not done
    if(!isStageComplete(txOther,'reference')){
      buttons.push({ label: `Enter ${txOther.toUpperCase()} REFERENCE`, kind:'primary', action: ()=> { jumpToWizard(txOther,'reference'); } });
    } else {
      buttons.push({ label: `View Results`, kind:'primary', action: ()=> { showPage('page-results'); } });
    }
    // always allow edits and present jumps
    buttons.push({ label: `Enter ${afterTx.toUpperCase()} REFERENCE (edit)`, kind:'secondary', action: ()=> { jumpToWizard(afterTx,'reference'); } });
    buttons.push({ label: `Enter ${afterTx.toUpperCase()} PRESENT`, kind:'secondary', action: ()=> { jumpToWizard(afterTx,'present'); } });
    buttons.push({ label: `Enter ${txOther.toUpperCase()} PRESENT`, kind:'secondary', action: ()=> { jumpToWizard(txOther,'present'); } });
  }

  showBottomSheet(title, subtitle, buttons);
}

function jumpToWizard(tx, type){
  // set current state and open wizard
  state.current.tx = tx;
  state.current.type = type;
  state.current.idx = 0;
  // set UI tab buttons on page-tx if visible
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.tx === tx));
  document.querySelectorAll('.subtabbtn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  showWizardForCurrent();
  showPage('page-wizard');
}

// ---------- Event wiring ----------
document.addEventListener('DOMContentLoaded', ()=>{
  // populate meta fields from saved state
  $('station').value = state.meta.station || '';
  $('freq').value = state.meta.freq || '';
  $('make').value = state.meta.make || '';
  $('model').value = state.meta.model || '';
  $('refDate').value = state.meta.refDate || '';
  $('presDate').value = state.meta.presDate || '';
  $('course').value = state.meta.course || '';

  // Home button
  $('btnHome').addEventListener('click', ()=> showPage('page-meta'));

  // go to field readings
  $('toField').addEventListener('click', ()=>{
    if(!applyHeaderCheck()) return;
    populateMetaFromUI();
    showPage('page-tx');
    refreshTxTabs();
  });

  // clear saved
  $('clearAll').addEventListener('click', ()=>{
    if(confirm('Clear all saved local entries?')){
      clearSaved();
      location.reload();
    }
  });

  // tab switching
  document.querySelectorAll('.tabbtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.current.tx = btn.dataset.tx;
      refreshTxTabs();
    });
  });
  document.querySelectorAll('.subtabbtn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.subtabbtn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.current.type = btn.dataset.type;
    });
  });

  // start wizard
  $('startWizard').addEventListener('click', ()=>{
    if(!applyHeaderCheck()) return;
    populateMetaFromUI();
    state.current.direction = $('angleDirection').value;
    state.current.idx = 0;
    showWizardForCurrent();
    showPage('page-wizard');
  });

  // wizard nav buttons
  $('prevAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); wizardPrev(); });
  $('nextAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); wizardNext(); });
  $('saveAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); alert('Saved'); });

  // finish wizard - changed behavior: show bottom sheet with recommended next steps
  $('finishWizard').addEventListener('click', ()=>{
    if(!wizardSaveCurrent()) return;
    // after save, show bottom sheet with recommended options
    const tx = state.current.tx, type = state.current.type;
    showNextStepModal(tx, type);
  });

  // results actions
  $('showTables').addEventListener('click', ()=>{ buildAllTables(); $('tablesArea').classList.toggle('hidden'); });
  $('calcAll').addEventListener('click', ()=>{ calculateAll(); $('plotsArea').classList.remove('hidden'); $('resultsSummary').classList.remove('hidden'); buildAllTables(); });
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportPdfBtn').addEventListener('click', exportPdf);
  $('exportImgsBtn').addEventListener('click', exportAllChartsAsImages);
  $('toResults').addEventListener('click', ()=>{ saveState(); showPage('page-results'); });

  showPage('page-meta');
});

// ---------- Table & chart functions kept (same as before) ----------
function buildTableFor(tx, type){
  const containerId = `tbl_${tx}_${type}`;
  const elc = $(containerId);
  elc.innerHTML = '';
  const wrapper = el('div','tableScroll');
  const table = el('table','table');
  const thead = el('thead');
  const trh = el('tr');
  ['Angle','DDM','SDM','RF'].forEach(h=>{
    const th = el('th'); th.textContent = h; trh.appendChild(th);
  });
  thead.appendChild(trh); table.appendChild(thead);
  const tbody = el('tbody');
  state.values[tx][type].forEach((row, i)=>{
    const tr = el('tr');
    const tdAngle = el('td'); tdAngle.textContent = ANGLES[i]; tr.appendChild(tdAngle);
    const tdD = el('td'); tdD.textContent = (row.DDM===null)?'':row.DDM; tr.appendChild(tdD);
    const tdS = el('td'); tdS.textContent = (row.SDM===null)?'':row.SDM; tr.appendChild(tdS);
    const tdR = el('td'); tdR.textContent = (row.RF===null)?'':row.RF; tr.appendChild(tdR);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  elc.appendChild(wrapper);
}
function buildAllTables(){
  buildTableFor('tx1','present'); buildTableFor('tx1','reference');
  buildTableFor('tx2','present'); buildTableFor('tx2','reference');
}

// charts, calculations and exports are unchanged from previous implementation
let charts = {};
function calculateAll(){
  const compiled = {};
  ['tx1','tx2'].forEach(tx=>{
    compiled[tx] = {};
    ['present','reference'].forEach(t=>{
      const arr = state.values[tx][t];
      const ddm = arr.map(x => (x.DDM===null)? NaN : x.DDM);
      const sdm = arr.map(x => (x.SDM===null)? NaN : x.SDM);
      const rf  = arr.map(x => (x.RF===null)? NaN : x.RF);
      compiled[tx][t] = { ddm, sdm, rf };
    });
    const refDDM = compiled[tx].reference.ddm; const presDDM = compiled[tx].present.ddm;
    const ddm_diff = refDDM.map((v,i)=> (isNaN(v) || isNaN(presDDM[i]))? NaN : v - presDDM[i]);
    compiled[tx].ddm_diff = ddm_diff;
    const refSDM = compiled[tx].reference.sdm; const presSDM = compiled[tx].present.sdm;
    const sdm_diff = refSDM.map((v,i)=> (isNaN(v) || isNaN(presSDM[i]))? NaN : v - presSDM[i]);
    compiled[tx].sdm_diff = sdm_diff;
    const refRF = compiled[tx].reference.rf; const presRF = compiled[tx].present.rf;
    const rf_diff = refRF.map((v,i)=> (isNaN(v) || isNaN(presRF[i]))? NaN : v - presRF[i]);
    compiled[tx].rf_diff = rf_diff;
    const centerIdx = ANGLES.indexOf(0);
    const ddm_cl_dev = (!isNaN(presDDM[centerIdx]) && !isNaN(refDDM[centerIdx])) ? presDDM[centerIdx] - refDDM[centerIdx] : NaN;
    compiled[tx].ddm_cl_dev = ddm_cl_dev;
    const sector = 10;
    const maskIdxs = ANGLES.map((a,i)=> (a>=-sector && a<=sector)?i:-1).filter(i=>i>=0);
    const ddm_absvals = maskIdxs.map(i=> Math.abs(ddm_diff[i])).filter(v=>!isNaN(v));
    compiled[tx].ddm_sector_max = ddm_absvals.length ? Math.max(...ddm_absvals) : NaN;
    function slope(y){
      const xs = [], ys = [];
      for(let i=0;i<ANGLES.length;i++){ if(!isNaN(y[i])){ xs.push(ANGLES[i]); ys.push(y[i]); } }
      if(xs.length < 2) return NaN;
      const xm = xs.reduce((s,v)=>s+v,0)/xs.length, ym = ys.reduce((s,v)=>s+v,0)/ys.length;
      let num=0, den=0;
      for(let i=0;i<xs.length;i++){ num += (xs[i]-xm)*(ys[i]-ym); den += (xs[i]-xm)*(xs[i]-xm); }
      return den===0? NaN : num/den;
    }
    compiled[tx].sdm_ref_slope = slope(refSDM);
    compiled[tx].sdm_pres_slope = slope(presSDM);
    const rfAbs = compiled[tx].rf_diff.map(v => isNaN(v)? NaN : Math.abs(v)).filter(v=>!isNaN(v));
    compiled[tx].rf_max = rfAbs.length ? Math.max(...rfAbs) : NaN;
    compiled[tx].rf_mean = rfAbs.length ? rfAbs.reduce((s,v)=>s+v,0)/rfAbs.length : NaN;
  });
  state.compiled = compiled;
  saveState();
  plotAllCharts(compiled);
  renderSummary(compiled);
}

function plotAllCharts(compiled){
  function plotCanvas(id, refArr, presArr, diffArr, label){
    const c = document.getElementById(id);
    if(!c) return;
    const ctx = c.getContext('2d');
    if(charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, {
      type:'line',
      data:{ labels: ANGLES, datasets: [
        { label: label + '_REF', data: refArr, fill:false, borderColor:'blue', tension:0.2 },
        { label: label + '_PRES', data: presArr, fill:false, borderColor:'green', tension:0.2 },
        { label: label + '_DIFF', data: diffArr, fill:false, borderColor:'orange', borderDash:[6,4], tension:0.2 }
      ]},
      options:{ scales:{ x:{ title:{display:true, text:'Angle (°)'} } } }
    });
  }
  plotCanvas('chart_tx1_ddm', state.compiled.tx1.reference.ddm, state.compiled.tx1.present.ddm, state.compiled.tx1.ddm_diff, 'DDM');
  plotCanvas('chart_tx1_sdm', state.compiled.tx1.reference.sdm, state.compiled.tx1.present.sdm, state.compiled.tx1.sdm_diff, 'SDM');
  plotCanvas('chart_tx1_rf',  state.compiled.tx1.reference.rf, state.compiled.tx1.present.rf, state.compiled.tx1.rf_diff, 'RF');
  plotCanvas('chart_tx2_ddm', state.compiled.tx2.reference.ddm, state.compiled.tx2.present.ddm, state.compiled.tx2.ddm_diff, 'DDM');
  plotCanvas('chart_tx2_sdm', state.compiled.tx2.reference.sdm, state.compiled.tx2.present.sdm, state.compiled.tx2.sdm_diff, 'SDM');
  plotCanvas('chart_tx2_rf',  state.compiled.tx2.reference.rf, state.compiled.tx2.present.rf, state.compiled.tx2.rf_diff, 'RF');
  function plotCombined(id, refArr, presArr, label){
    const c = document.getElementById(id);
    if(!c) return;
    const ctx = c.getContext('2d');
    if(charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, {
      type:'line',
      data:{ labels: ANGLES, datasets:[
        { label: label + ' REF', data: refArr, borderColor:'blue', tension:0.2 },
        { label: label + ' PRES', data: presArr, borderColor:'green', tension:0.2 }
      ]},
      options:{ scales:{ x:{ title:{display:true, text:'Angle (°)'} } } }
    });
  }
  plotCombined('chart_tx1_comb', state.compiled.tx1.reference.ddm, state.compiled.tx1.present.ddm, 'DDM');
  plotCombined('chart_tx2_comb', state.compiled.tx2.reference.ddm, state.compiled.tx2.present.ddm, 'DDM');
  $('plotsArea').classList.remove('hidden');
}

function renderSummary(compiled){
  const out = [];
  ['tx1','tx2'].forEach(tx=>{
    out.push(`--- ${tx.toUpperCase()} ---`);
    out.push(`DDM centerline deviation (PRES - REF): ${isNaN(compiled[tx].ddm_cl_dev)?'NA':compiled[tx].ddm_cl_dev}`);
    out.push(`DDM max within sector: ${isNaN(compiled[tx].ddm_sector_max)?'NA':compiled[tx].ddm_sector_max}`);
    out.push(`SDM REF slope: ${isNaN(compiled[tx].sdm_ref_slope)?'NA':compiled[tx].sdm_ref_slope}`);
    out.push(`SDM PRES slope: ${isNaN(compiled[tx].sdm_pres_slope)?'NA':compiled[tx].sdm_pres_slope}`);
    out.push(`RF max |REF-PRES|: ${isNaN(compiled[tx].rf_max)?'NA':compiled[tx].rf_max}`);
    out.push(`RF mean |REF-PRES|: ${isNaN(compiled[tx].rf_mean)?'NA':compiled[tx].rf_mean}`);
    out.push('');
  });
  $('resultsSummary').textContent = out.join('\n');
}

// Export CSV / PDF / Images (same logic as before)
function exportCsv(){
  if(!state.compiled) calculateAll();
  const meta = state.meta;
  const rows = [];
  rows.push(`Station,${meta.station || ''}`);
  rows.push(`Frequency (MHz),${meta.freq || ''}`);
  rows.push(`Make,${meta.make || ''}`);
  rows.push(`Model,${meta.model || ''}`);
  rows.push(`REF Date,${meta.refDate || ''}`);
  rows.push(`PRES Date,${meta.presDate || ''}`);
  rows.push('');
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(type=>{
      rows.push(`${tx.toUpperCase()} - ${type.toUpperCase()}`);
      rows.push('Angle,DDM,SDM,RF');
      state.values[tx][type].forEach((r,i)=>{
        const a = ANGLES[i];
        const ddm = r.DDM === null ? '' : r.DDM;
        const sdm = r.SDM === null ? '' : r.SDM;
        const rf  = r.RF === null ? '' : r.RF;
        rows.push(`${a},${ddm},${sdm},${rf}`);
      });
      rows.push('');
    });
  });
  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'llz_export.csv'; a.click(); URL.revokeObjectURL(url);
}
async function exportPdf(){
  if(!state.compiled) calculateAll();
  const printDiv = el('div');
  printDiv.style.padding = '12px'; printDiv.style.fontFamily = 'monospace';
  const meta = state.meta;
  const header = el('div'); header.style.marginBottom='8px';
  header.innerHTML = `<div style="font-weight:700">${'Station: ' + (meta.station||'')}&nbsp;&nbsp;&nbsp;Freq: ${meta.freq||''}&nbsp;&nbsp;&nbsp;Make: ${meta.make||''}&nbsp;&nbsp;&nbsp;Model: ${meta.model||''}</div>
  <div>REF: ${meta.refDate||''}&nbsp;&nbsp;&nbsp;PRES: ${meta.presDate||''}</div><hr/>`;
  printDiv.appendChild(header);
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(type=>{
      const title = el('div'); title.innerHTML = `<h4>${tx.toUpperCase()} - ${type.toUpperCase()}</h4>`; printDiv.appendChild(title);
      state.values[tx][type].forEach((r,i)=>{
        const tr = el('div'); tr.style.display='flex'; tr.style.justifyContent='space-between'; tr.style.borderBottom='1px solid #eee'; tr.style.padding='2px 0';
        tr.innerHTML = `<div style="width:25%">${ANGLES[i]}</div><div style="width:25%">${r.DDM === null ? '' : r.DDM}</div><div style="width:25%">${r.SDM === null ? '' : r.SDM}</div><div style="width:25%">${r.RF === null ? '' : r.RF}</div>`;
        printDiv.appendChild(tr);
      });
      printDiv.appendChild(el('hr'));
    });
  });
  document.body.appendChild(printDiv);
  try{
    const canvas = await html2canvas(printDiv, { scale: 1.5, useCORS:true });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('llz_report.pdf');
  }catch(e){ alert('PDF generation failed: '+e); }
  finally{ document.body.removeChild(printDiv); }
}
function exportAllChartsAsImages(){
  const canvasIds = ['chart_tx1_ddm','chart_tx1_sdm','chart_tx1_rf','chart_tx2_ddm','chart_tx2_sdm','chart_tx2_rf','chart_tx1_comb','chart_tx2_comb'];
  canvasIds.forEach(id=>{
    const c = document.getElementById(id);
    if(c){
      const url = c.toDataURL('image/png');
      const a = document.createElement('a'); a.href = url; a.download = `${id}.png`; a.click();
    }
  });
}

// refresh tab visuals
function refreshTxTabs(){
  document.querySelectorAll('.tabbtn').forEach(b => b.classList.toggle('active', b.dataset.tx === state.current.tx));
  document.querySelectorAll('.subtabbtn').forEach(b => b.classList.toggle('active', b.dataset.type === state.current.type));
  $('angleDirection').value = state.current.direction || 'neg2pos';
}

// initial load: set UI values
document.addEventListener('DOMContentLoaded', ()=>{
  $('station').value = state.meta.station || '';
  $('freq').value = state.meta.freq || '';
  $('make').value = state.meta.make || '';
  $('model').value = state.meta.model || '';
  $('refDate').value = state.meta.refDate || '';
  $('presDate').value = state.meta.presDate || '';
  $('course').value = state.meta.course || '';

  $('btnHome').addEventListener('click', ()=> showPage('page-meta'));
  $('toField').addEventListener('click', ()=>{
    if(!applyHeaderCheck()) return;
    populateMetaFromUI();
    showPage('page-tx');
    refreshTxTabs();
  });
  $('clearAll').addEventListener('click', ()=>{ if(confirm('Clear all saved local entries?')){ clearSaved(); location.reload(); } });
  document.querySelectorAll('.tabbtn').forEach(btn=> btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.current.tx = btn.dataset.tx; refreshTxTabs();
  }));
  document.querySelectorAll('.subtabbtn').forEach(btn=> btn.addEventListener('click', ()=>{
    document.querySelectorAll('.subtabbtn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.current.type = btn.dataset.type;
  }));
  $('startWizard').addEventListener('click', ()=>{ if(!applyHeaderCheck()) return; populateMetaFromUI(); state.current.direction = $('angleDirection').value; state.current.idx = 0; showWizardForCurrent(); showPage('page-wizard'); });
  $('prevAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); wizardPrev(); });
  $('nextAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); wizardNext(); });
  $('saveAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); alert('Saved'); });
  $('finishWizard').addEventListener('click', ()=>{ if(!wizardSaveCurrent()) return; const tx=state.current.tx, type=state.current.type; showNextStepModal(tx,type); });
  $('showTables').addEventListener('click', ()=>{ buildAllTables(); $('tablesArea').classList.toggle('hidden'); });
  $('calcAll').addEventListener('click', ()=>{ calculateAll(); $('plotsArea').classList.remove('hidden'); $('resultsSummary').classList.remove('hidden'); buildAllTables(); });
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportPdfBtn').addEventListener('click', exportPdf);
  $('exportImgsBtn').addEventListener('click', exportAllChartsAsImages);
  $('toResults').addEventListener('click', ()=>{ saveState(); showPage('page-results'); });

  showPage('page-meta');
});
