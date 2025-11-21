/* Final app.js implementing:
   - Meta -> Stage -> TX selection -> Direction -> Wizard
   - Enforced full completion per reading type before switching automatically to the other type
   - User can re-open TX anytime (Q4 = B)
   - DDM/SDM/RF labels, narrower inputs, NEXT buttons
   - UPLOADED_FILE_URL constant available at top of index.html
*/

const ANGLES = [
  -35,-30,-25,-20,-14,-13,-12,-11,-10,
  -9,-8,-7,-6,-5,-4,-3,-2.5,-2,-1.5,-1,-0.5,
  0,0.5,1,1.5,2,2.5,3,4,5,6,7,8,9,10,11,12,13,14,20,25,30,35
];

const STORAGE_KEY = 'llz_final_v1';

let state = {
  meta: { station:'', freq:'', make:'', model:'', refDate:'', presDate:'', course:'' },
  values: { tx1:{present:[], reference:[]}, tx2:{present:[], reference:[]} },
  current: { stage:'present', tx:null, direction:'neg2pos', idx:0 }
};

// init arrays
function initArrays(){ ['tx1','tx2'].forEach(tx=>{ ['present','reference'].forEach(t=>{ state.values[tx][t] = ANGLES.map(()=>({DDM:null,SDM:null,RF:null})); }); }); }
initArrays();

// helpers
function $(id){ return document.getElementById(id); }
function el(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw) {
    try {
      const l = JSON.parse(raw);
      if(l.meta) state.meta = Object.assign(state.meta, l.meta);
      if(l.values) state.values = Object.assign(state.values, l.values);
      if(l.current) state.current = Object.assign(state.current, l.current);
    } catch(e){ console.warn(e); initArrays(); }
  }
  // ensure arrays correct length
  ['tx1','tx2'].forEach(tx=>{ ['present','reference'].forEach(t=>{
    if(!Array.isArray(state.values[tx][t]) || state.values[tx][t].length !== ANGLES.length){
      state.values[tx][t] = ANGLES.map(()=>({DDM:null,SDM:null,RF:null}));
    }
  })});
  saveState();
}
loadState();

// pages
function showPage(id){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); const p = $(id); if(p) p.classList.remove('hidden'); window.scrollTo(0,0); }

// meta
function populateMetaFromUI(){ state.meta.station = $('station').value.trim(); state.meta.freq = $('freq').value.trim(); state.meta.make = $('make').value.trim(); state.meta.model = $('model').value.trim(); state.meta.refDate = $('refDate').value.trim(); state.meta.presDate = $('presDate').value.trim(); state.meta.course = $('course').value.trim(); saveState(); }
function formatDateOK(s){ return /^\d{2}-\d{2}-\d{4}$/.test(s); }
function applyHeaderCheck(){ const ref = $('refDate').value.trim(), pres = $('presDate').value.trim(); if(!formatDateOK(ref) || !formatDateOK(pres)){ alert('Enter dates in DD-MM-YYYY'); return false; } return true; }

// bottom sheet / toast
function createBottomSheetDOM(){ if(document.querySelector('.bs-overlay')) return; const overlay = el('div','bs-overlay'); overlay.innerHTML = `<div class="bottom-sheet" role="dialog" aria-modal="true"><div class="bs-handle"></div><div class="sheet-title" id="sheetTitle"></div><div class="sheet-sub" id="sheetSub"></div><div class="sheet-buttons" id="sheetButtons"></div><div class="sheet-actions" id="sheetActions"></div></div>`; document.body.appendChild(overlay); overlay.addEventListener('click', e=>{ if(e.target===overlay) hideBottomSheet(); }); }
function showBottomSheet(title, sub, buttons){ createBottomSheetDOM(); const overlay = document.querySelector('.bs-overlay'); const sheet = overlay.querySelector('.bottom-sheet'); overlay.classList.add('show'); setTimeout(()=> sheet.classList.add('show'), 20); $('sheetTitle').textContent = title || ''; $('sheetSub').textContent = sub || ''; const container = $('sheetButtons'); container.innerHTML = ''; buttons.forEach(b=>{ const btn = el('button','sheet-btn'); btn.textContent = b.label; if(b.kind==='primary') btn.classList.add('primary'); btn.onclick = ()=>{ hideBottomSheet(); setTimeout(()=> b.action && b.action(), 300); }; container.appendChild(btn); }); $('sheetActions').innerHTML = '<button class="btn" onclick="hideBottomSheet()">Close</button>'; }
function hideBottomSheet(){ const overlay=document.querySelector('.bs-overlay'); if(!overlay) return; const sheet=overlay.querySelector('.bottom-sheet'); sheet.classList.remove('show'); setTimeout(()=> overlay.classList.remove('show'),260); }

function showToast(msg,ms=1500){ let t = document.querySelector('.toast'); if(!t){ t = el('div','toast'); document.body.appendChild(t); } t.textContent = msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), ms); }

// wizard helpers
function getOrderIndex(idx){ return (state.current.direction === 'neg2pos') ? idx : (ANGLES.length - 1 - idx); }
function showWizardForCurrent(){
  if(!state.current.tx){ alert('Please select a transmitter'); return; }
  const type = state.current.stage;
  const total = ANGLES.length;
  if(state.current.idx < 0) state.current.idx = 0;
  if(state.current.idx >= total) state.current.idx = total-1;
  const orderIdx = getOrderIndex(state.current.idx);
  const angle = ANGLES[orderIdx];
  $('angleValue').textContent = angle;
  $('wizardTitle').textContent = `${state.current.tx.toUpperCase()} — ${type.toUpperCase()}`;
  $('wizardMeta').textContent = `Station: ${state.meta.station || '-'}  REF: ${state.meta.refDate || '-'}  PRES: ${state.meta.presDate || '-'}`;
  const saved = state.values[state.current.tx][type][orderIdx];
  $('ddmInput').value = (saved && saved.DDM!==null) ? Math.abs(saved.DDM) : '';
  $('sdmInput').value = (saved && saved.SDM!==null) ? Math.abs(saved.SDM) : '';
  $('rfInput').value = (saved && saved.RF!==null) ? Math.abs(saved.RF) : '';
  updateNextButtonsVisibility();
  $('wizardProgress').textContent = `Angle ${state.current.idx+1} of ${ANGLES.length}`;
}

function wizardSaveCurrent(){
  if(!state.current.tx){ alert('No transmitter selected'); return false; }
  const orderIdx = getOrderIndex(state.current.idx);
  const angle = ANGLES[orderIdx];
  let ddm = $('ddmInput').value.trim(), sdm = $('sdmInput').value.trim(), rf = $('rfInput').value.trim();
  let ddmNum = ddm === '' ? null : Number(ddm);
  let sdmNum = sdm === '' ? null : Number(sdm);
  let rfNum  = rf === '' ? null : Number(rf);
  if(ddmNum !== null && isNaN(ddmNum)){ alert('DDM must be numeric'); return false; }
  if(sdmNum !== null && isNaN(sdmNum)){ alert('SDM must be numeric'); return false; }
  if(rfNum !== null && isNaN(rfNum)){ alert('RF must be numeric'); return false; }

  if(ddmNum !== null){
    if(angle < 0) ddmNum = -Math.abs(ddmNum);
    else if(angle > 0) ddmNum = Math.abs(ddmNum);
    else ddmNum = Math.abs(ddmNum);
  }
  if(sdmNum !== null) sdmNum = Math.abs(sdmNum);
  if(rfNum !== null) rfNum = -Math.abs(rfNum);

  state.values[state.current.tx][state.current.stage][orderIdx] = { DDM: ddmNum, SDM: sdmNum, RF: rfNum };
  saveState();
  return true;
}

function wizardNext(){ if(!wizardSaveCurrent()) return; state.current.idx++; if(state.current.idx >= ANGLES.length) state.current.idx = ANGLES.length-1; showWizardForCurrent(); }
function wizardPrev(){ wizardSaveCurrent(); state.current.idx--; if(state.current.idx < 0) state.current.idx = 0; showWizardForCurrent(); }

function updateNextButtonsVisibility(){
  const ddmVal = $('ddmInput').value.trim();
  const sdmVal = $('sdmInput').value.trim();
  const rfVal  = $('rfInput').value.trim();
  const ddn = $('ddmNext'), sdn = $('sdmNext'), rfn = $('rfNext');
  if(ddn) ddmVal !== '' ? ddn.classList.remove('hidden') : ddn.classList.add('hidden');
  if(sdn) sdmVal !== '' ? sdn.classList.remove('hidden') : sdn.classList.add('hidden');
  if(rfn) rfVal !== '' ? rfn.classList.remove('hidden') : rfn.classList.add('hidden');
}

// flow control: start stage -> show tx select
function startStage(stage){
  state.current.stage = stage;
  state.current.tx = null;
  state.current.direction = 'neg2pos';
  state.current.idx = 0;
  saveState();
  updateTxCardStatus();
  $('txselectHeader').textContent = `${stage.toUpperCase()} — choose transmitter`;
  showPage('page-txselect');
}

// tx selection handlers
function updateTxCardStatus(){
  // show simple progress indicator inside cards
  ['tx1','tx2'].forEach(tx=>{
    const presentDone = isStageComplete(tx,'present');
    const refDone = isStageComplete(tx,'reference');
    const elId = tx === 'tx1' ? 'tx1Status' : 'tx2Status';
    const el = $(elId);
    if(el) el.textContent = `P:${presentDone? '✓':'—'}  R:${refDone? '✓':'—'}`;
  });
}

function onTxChosen(tx){
  state.current.tx = tx;
  // direction page header
  $('dirHeader').textContent = `Select Angle Direction for ${tx.toUpperCase()} (${state.current.stage.toUpperCase()})`;
  // pre-select previous direction for convenience
  if(state.current.direction === 'pos2neg') $('dirPos2Neg').checked = true;
  else $('dirNeg2Pos').checked = true;
  showPage('page-direction');
}

function onDirectionContinue(){
  const sel = document.querySelector('input[name="angleDir"]:checked');
  if(!sel){ alert('Choose direction'); return; }
  state.current.direction = sel.value;
  state.current.idx = 0;
  saveState();
  showPage('page-wizard');
  showWizardForCurrent();
}

// finish tx: save and return to tx selection
function finishTxAndBack(){
  if(!wizardSaveCurrent()) return;
  showToast(`${state.current.tx.toUpperCase()} ${state.current.stage.toUpperCase()} saved`);
  // check if both TXs done for this stage
  const otherTx = state.current.tx === 'tx1' ? 'tx2' : 'tx1';
  const bothDone = isStageComplete('tx1', state.current.stage) && isStageComplete('tx2', state.current.stage);
  // reset selection
  state.current.tx = null;
  state.current.idx = 0;
  saveState();
  updateTxCardStatus();
  if(bothDone){
    // show bottom sheet prompting to continue with other reading type
    const nextStage = state.current.stage === 'present' ? 'reference' : 'present';
    showBottomSheet(
      `${state.current.stage.toUpperCase()} readings completed`,
      `Proceed to ${nextStage.toUpperCase()} readings?`,
      [
        { label: `Start ${nextStage.toUpperCase()}`, kind:'primary', action: ()=> { startStage(nextStage); } },
        { label: 'Stay here', kind:'secondary', action: ()=> { showPage('page-txselect'); } },
        { label: 'View Results', kind:'ghost', action: ()=> { showPage('page-results'); populateResultsMeta(); buildAllTables(); } }
      ]
    );
  } else {
    // not both done -> go back to TX selection to continue
    showPage('page-txselect');
  }
}

// check completion per tx per stage
function isStageComplete(tx, stage){
  const arr = state.values[tx][stage];
  for(let i=0;i<arr.length;i++){
    const r = arr[i];
    if(r.DDM === null && r.SDM === null && r.RF === null) return false;
  }
  return true;
}

// results & tables
function populateResultsMeta(){
  const m = state.meta;
  const el = $('resultsMeta');
  if(el) el.textContent = `Station: ${m.station||''}   Freq: ${m.freq||''} MHz   REF: ${m.refDate||''}   PRES: ${m.presDate||''}   Make: ${m.make||''}   Model: ${m.model||''}`;
}

function buildTableFor(tx, type){
  const container = $('tablesArea');
  if(!container) return;
  // create a section for this table
  const sectId = `tbl_${tx}_${type}`;
  // remove existing for same combination
  const old = document.getElementById(sectId);
  if(old) old.remove();
  const sec = el('div','tableCard'); sec.id = sectId;
  const title = el('h4'); title.textContent = `${tx.toUpperCase()} - ${type.toUpperCase()}`; sec.appendChild(title);
  const tbl = el('table'); tbl.className = 'table';
  const thead = el('thead'); const trh = el('tr'); ['Angle','DDM','SDM','RF'].forEach(h=>{ const th = el('th'); th.textContent = h; trh.appendChild(th); }); thead.appendChild(trh); tbl.appendChild(thead);
  const tbody = el('tbody');
  state.values[tx][type].forEach((r,i)=>{ const tr = el('tr'); [ANGLES[i], r.DDM===null?'':r.DDM, r.SDM===null?'':r.SDM, r.RF===null?'':r.RF].forEach(v=>{ const td = el('td'); td.textContent = v; tr.appendChild(td); }); tbody.appendChild(tr); });
  tbl.appendChild(tbody); sec.appendChild(tbl);
  container.appendChild(sec);
}

function buildAllTables(){
  const container = $('tablesArea'); container.innerHTML = '';
  buildTableFor('tx1','present'); buildTableFor('tx1','reference'); buildTableFor('tx2','present'); buildTableFor('tx2','reference');
  container.classList.remove('hidden');
}

// compute & plot (minimal)
let charts = {};
function calculateAll(){
  const compiled = {};
  ['tx1','tx2'].forEach(tx=>{
    compiled[tx] = {};
    ['present','reference'].forEach(t=>{
      const arr = state.values[tx][t];
      compiled[tx][t] = { ddm: arr.map(x=> x.DDM===null ? NaN : x.DDM) };
    });
    compiled[tx].ddm_diff = compiled[tx].reference.ddm.map((v,i)=> (isNaN(v) || isNaN(compiled[tx].present.ddm[i])) ? NaN : v - compiled[tx].present.ddm[i]);
  });
  state.compiled = compiled; saveState();
  try{ plotAllCharts(compiled); }catch(e){ console.warn(e); }
  renderSummary(compiled);
}

function plotAllCharts(compiled){
  function plot(id, arr){ const c = document.getElementById(id); if(!c) return; const ctx = c.getContext('2d'); if(charts[id]) charts[id].destroy(); charts[id] = new Chart(ctx,{ type:'line', data:{ labels: ANGLES, datasets:[{label:'DDM', data:arr}] }, options:{ scales:{ x:{ title:{display:true,text:'Angle (°)'} } } } }); }
  plot('chart_tx1_ddm', state.compiled.tx1.present.ddm || []);
  plot('chart_tx2_ddm', state.compiled.tx2.present.ddm || []);
}

function renderSummary(compiled){
  const out = [];
  ['tx1','tx2'].forEach(tx=>{
    out.push(`--- ${tx.toUpperCase()} ---`);
    out.push(`Sample DDM diffs: ${compiled[tx].ddm_diff.slice(0,5).map(v=> isNaN(v)?'NA':v).join(', ')}`);
    out.push('');
  });
  $('resultsSummary').textContent = out.join('\n');
  $('resultsSummary').classList.remove('hidden');
}

// export CSV
function exportCsv(){
  const m = state.meta;
  const rows = []; rows.push(`Station,${m.station||''}`); rows.push(`Frequency,${m.freq||''}`); rows.push('');
  ['tx1','tx2'].forEach(tx=>{ ['present','reference'].forEach(type=>{ rows.push(`${tx.toUpperCase()} - ${type.toUpperCase()}`); rows.push('Angle,DDM,SDM,RF'); state.values[tx][type].forEach((r,i)=> rows.push(`${ANGLES[i]},${r.DDM===null?'':r.DDM},${r.SDM===null?'':r.SDM},${r.RF===null?'':r.RF}`)); rows.push(''); }); });
  const csv = rows.join('\n'); const blob = new Blob([csv], { type:'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'llz_export.csv'; a.click(); URL.revokeObjectURL(url);
}

async function exportPdf(){
  if(!state.compiled) calculateAll();
  const printDiv = el('div'); printDiv.style.padding='12px'; printDiv.style.fontFamily='monospace';
  const m = state.meta;
  printDiv.innerHTML = `<div style="font-weight:700">Station: ${m.station||''}   Freq: ${m.freq||''} MHz   REF: ${m.refDate||''}   PRES: ${m.presDate||''}</div><hr/>`;
  document.body.appendChild(printDiv);
  try{ const canvas = await html2canvas(printDiv, { scale:1.5 }); const img = canvas.toDataURL('image/png'); const { jsPDF } = window.jspdf; const pdf = new jsPDF('p','pt','a4'); const props = pdf.getImageProperties(img); const pdfW = pdf.internal.pageSize.getWidth(); const pdfH = (props.height * pdfW) / props.width; pdf.addImage(img, 'PNG', 0, 0, pdfW, pdfH); pdf.save('llz_report.pdf'); }catch(e){ alert('PDF error: '+e); } finally{ document.body.removeChild(printDiv); }
}

// wiring UI
document.addEventListener('DOMContentLoaded', ()=>{

  // populate meta
  $('station').value = state.meta.station || '';
  $('freq').value = state.meta.freq || '';
  $('make').value = state.meta.make || '';
  $('model').value = state.meta.model || '';
  $('refDate').value = state.meta.refDate || '';
  $('presDate').value = state.meta.presDate || '';
  $('course').value = state.meta.course || '';

  // home
  $('btnHome').addEventListener('click', ()=> showPage('page-meta'));

  // meta next (full width button)
  $('metaNext').addEventListener('click', ()=>{ if(!applyHeaderCheck()) return; populateMetaFromUI(); showPage('page-stage'); });

  // clear saved
  $('clearAll').addEventListener('click', ()=>{ if(confirm('Clear all saved local entries?')){ localStorage.removeItem(STORAGE_KEY); location.reload(); } });

  // choose stage
  $('choosePresent').addEventListener('click', ()=>{ if(!applyHeaderCheck()) return; populateMetaFromUI(); startStage('present'); });
  $('chooseReference').addEventListener('click', ()=>{ if(!applyHeaderCheck()) return; populateMetaFromUI(); startStage('reference'); });

  // tx cards
  $('tx1Card').addEventListener('click', ()=> onTxChosen('tx1'));
  $('tx2Card').addEventListener('click', ()=> onTxChosen('tx2'));

  // direction page
  $('dirContinue').addEventListener('click', onDirectionContinue);
  $('dirBack').addEventListener('click', ()=> showPage('page-txselect'));

  // wizard nav
  $('prevAngle').addEventListener('click', ()=> wizardPrev());
  $('nextAngle').addEventListener('click', ()=> wizardNext());
  $('saveAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); showToast('Saved'); });
  $('finishWizard').addEventListener('click', ()=> finishTxAndBack());

  // NEXT small buttons
  if($('ddmNext')) $('ddmNext').addEventListener('click', ()=> $('sdmInput').focus());
  if($('sdmNext')) $('sdmNext').addEventListener('click', ()=> $('rfInput').focus());
  if($('rfNext')) $('rfNext').addEventListener('click', ()=> { wizardSaveCurrent(); wizardNext(); });

  // show/hide next buttons on input
  ['ddmInput','sdmInput','rfInput'].forEach(id=>{
    const e = $(id);
    if(!e) return;
    e.addEventListener('input', updateNextButtonsVisibility);
    e.addEventListener('keydown', ev=> {
      if(ev.key === 'Enter'){
        ev.preventDefault();
        if(id === 'ddmInput') $('sdmInput').focus();
        else if(id === 'sdmInput') $('rfInput').focus();
        else if(id === 'rfInput') { wizardSaveCurrent(); wizardNext(); }
      }
    });
  });

  // results actions
  $('showTables').addEventListener('click', ()=> { buildAllTables(); $('tablesArea').classList.toggle('hidden'); });
  $('calcAll').addEventListener('click', ()=> { calculateAll(); $('plotsArea').classList.remove('hidden'); });
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportPdfBtn').addEventListener('click', exportPdf);
  $('exportImgsBtn').addEventListener('click', ()=> exportPdf());

  // init UI
  updateTxCardStatus();
  showPage('page-meta');
});
