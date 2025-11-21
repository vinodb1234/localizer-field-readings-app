/* app.js - new flow:
   - Meta -> Stage (Present/Reference) -> TX selection (cards) -> Direction -> Wizard
   - No automatic direction switching; user picks direction each time
   - DDM/SDM/RF left labels; NEXT buttons implemented
   - After finishing a TX (Finish TX and Back) -> returns to TX selection page
   - Saves state to localStorage; compute/export functions retained
*/

const ANGLES = [
  -35,-30,-25,-20,-14,-13,-12,-11,-10,
  -9,-8,-7,-6,-5,-4,-3,-2.5,-2,-1.5,-1,-0.5,
  0,0.5,1,1.5,2,2.5,3,4,5,6,7,8,9,10,11,12,13,14,20,25,30,35
];

const STORAGE_KEY = 'llz_data_v2';

// state
let state = {
  meta: { station:'', freq:'', make:'', model:'', refDate:'', presDate:'', course:'' },
  values: { tx1:{present:[], reference:[]}, tx2:{present:[], reference:[]} },
  current: { stage:'present', tx:null, direction:'neg2pos', idx:0 }
};

// init arrays
function initArrays(){
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(t=>{
      state.values[tx][t] = ANGLES.map(()=>({DDM:null,SDM:null,RF:null}));
    });
  });
}
initArrays();

// helpers
function $(id){ return document.getElementById(id); }
function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className=cls; return e; }
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{
      const loaded = JSON.parse(raw);
      if(loaded.meta) state.meta = Object.assign(state.meta, loaded.meta);
      if(loaded.values) state.values = Object.assign(state.values, loaded.values);
      if(loaded.current) state.current = Object.assign(state.current, loaded.current);
    }catch(e){ console.warn(e); initArrays(); }
  }
  // ensure arrays
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(t=>{
      if(!Array.isArray(state.values[tx][t]) || state.values[tx][t].length !== ANGLES.length){
        state.values[tx][t] = ANGLES.map(()=>({DDM:null,SDM:null,RF:null}));
      }
    });
  });
  saveState();
}
loadState();

// page control
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  const elp = $(id);
  if(elp) elp.classList.remove('hidden');
  window.scrollTo(0,0);
}

// basic meta handling
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
function formatDateOK(s){ return /^\d{2}-\d{2}-\d{4}$/.test(s); }
function applyHeaderCheck(){
  const ref = $('refDate').value.trim(), pres = $('presDate').value.trim();
  if(!formatDateOK(ref) || !formatDateOK(pres)){ alert('Enter dates in DD-MM-YYYY'); return false; }
  return true;
}

// bottom sheet and toast helpers (same pattern)
function createBottomSheetDOM(){
  if(document.querySelector('.bs-overlay')) return;
  const overlay = el('div','bs-overlay');
  overlay.innerHTML = `<div class="bottom-sheet" role="dialog" aria-modal="true"><div class="bs-handle"></div><div class="sheet-title" id="sheetTitle"></div><div class="sheet-sub" id="sheetSub"></div><div class="sheet-buttons" id="sheetButtons"></div><div class="sheet-actions" id="sheetActions"></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) hideBottomSheet(); });
}
function showBottomSheet(title,sub,buttons){
  createBottomSheetDOM();
  const overlay = document.querySelector('.bs-overlay');
  const sheet = overlay.querySelector('.bottom-sheet');
  overlay.classList.add('show'); setTimeout(()=> sheet.classList.add('show'),20);
  $('sheetTitle').textContent = title||''; $('sheetSub').textContent = sub||'';
  const container = $('sheetButtons'); container.innerHTML = '';
  buttons.forEach(b=>{
    const btn = el('button','sheet-btn'); btn.textContent = b.label;
    if(b.kind==='primary') btn.classList.add('primary');
    btn.onclick = ()=>{ hideBottomSheet(); setTimeout(()=> b.action && b.action(), 300); };
    container.appendChild(btn);
  });
  $('sheetActions').innerHTML = '<button class="btn" onclick="hideBottomSheet()">Close</button>';
}
function hideBottomSheet(){ const overlay=document.querySelector('.bs-overlay'); if(!overlay) return; const sheet=overlay.querySelector('.bottom-sheet'); sheet.classList.remove('show'); setTimeout(()=> overlay.classList.remove('show'),260); }

function showToast(msg,ms=1500){
  let t = document.querySelector('.toast');
  if(!t){ t = el('div','toast'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), ms);
}

// WIZARD helpers
function getOrderIndex(idx){
  return (state.current.direction === 'neg2pos') ? idx : (ANGLES.length - 1 - idx);
}
function showWizardForCurrent(){
  const tx = state.current.tx, type = state.current.stage;
  if(!tx){ alert('No transmitter selected'); return; }
  const total = ANGLES.length;
  if(state.current.idx < 0) state.current.idx = 0;
  if(state.current.idx >= total) state.current.idx = total-1;
  const orderIdx = getOrderIndex(state.current.idx);
  const angle = ANGLES[orderIdx];
  $('angleValue').textContent = angle;
  $('wizardTitle').textContent = `${tx.toUpperCase()} — ${type.toUpperCase()}`;
  $('wizardMeta').textContent = `Station: ${state.meta.station || '-'}  REF: ${state.meta.refDate||'-'}  PRES: ${state.meta.presDate||'-'}`;
  const saved = state.values[tx][type][orderIdx];
  $('ddmInput').value = (saved && saved.DDM!==null) ? Math.abs(saved.DDM) : '';
  $('sdmInput').value = (saved && saved.SDM!==null) ? Math.abs(saved.SDM) : '';
  $('rfInput').value = (saved && saved.RF!==null) ? Math.abs(saved.RF) : '';
  // show/hide next buttons
  updateNextButtonsVisibility();
  $('wizardProgress').textContent = `Angle ${state.current.idx + 1} of ${ANGLES.length}`;
}

function wizardSaveCurrent(){
  const tx = state.current.tx, type = state.current.stage;
  const orderIdx = getOrderIndex(state.current.idx);
  const angle = ANGLES[orderIdx];
  let ddm = $('ddmInput').value.trim(), sdm = $('sdmInput').value.trim(), rf = $('rfInput').value.trim();
  let ddmNum = ddm === '' ? null : Number(ddm);
  let sdmNum = sdm === '' ? null : Number(sdm);
  let rfNum  = rf  === '' ? null : Number(rf);
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
  state.values[tx][type][orderIdx] = { DDM: ddmNum, SDM: sdmNum, RF: rfNum };
  saveState();
  return true;
}

function wizardNext(){ if(!wizardSaveCurrent()) return; state.current.idx++; if(state.current.idx >= ANGLES.length) state.current.idx = ANGLES.length-1; showWizardForCurrent(); }
function wizardPrev(){ wizardSaveCurrent(); state.current.idx--; if(state.current.idx < 0) state.current.idx = 0; showWizardForCurrent(); }

// Next button visibility & handlers
function updateNextButtonsVisibility(){
  const ddmVal = $('ddmInput').value.trim();
  const sdmVal = $('sdmInput').value.trim();
  const rfVal  = $('rfInput').value.trim();
  const ddmNext = $('ddmNext'), sdmNext = $('sdmNext'), rfNext = $('rfNext');
  if(ddmNext) ddmVal !== '' ? ddmNext.classList.remove('hidden') : ddmNext.classList.add('hidden');
  if(sdmNext) sdmVal !== '' ? sdmNext.classList.remove('hidden') : sdmNext.classList.add('hidden');
  if(rfNext) rfVal !== '' ? rfNext.classList.remove('hidden') : rfNext.classList.add('hidden');
}

// Stage & navigation logic (new flow)
// After user chooses Present/Reference, we show TX selection page
function startStage(stage){
  state.current.stage = stage;
  state.current.tx = null;
  state.current.direction = 'neg2pos';
  state.current.idx = 0;
  saveState();
  showPage('page-txselect');
}

// When user picks a TX card
function onTxChosen(tx){
  state.current.tx = tx;
  // show direction selection screen
  // preselect current direction
  if(state.current.direction === 'pos2neg') $('dirPos2Neg').checked = true;
  else $('dirNeg2Pos').checked = true;
  $('dirHeader').textContent = `Select Angle Direction for ${tx.toUpperCase()} (${state.current.stage.toUpperCase()})`;
  showPage('page-direction');
}

// After user selects direction and continues
function onDirectionContinue(){
  const sel = document.querySelector('input[name="angleDir"]:checked');
  if(!sel){ alert('Select angle direction'); return; }
  state.current.direction = sel.value;
  state.current.idx = 0;
  saveState();
  showPage('page-wizard');
  showWizardForCurrent();
}

// When finish TX (Finish TX and Back) clicked
function finishTxAndBack(){
  if(!wizardSaveCurrent()) return;
  // optional: show bottom sheet summary or just return to TX selection
  showToast(`${state.current.tx.toUpperCase()} ${state.current.stage.toUpperCase()} saved`);
  // reset tx selection to allow user to choose next TX (or re-select same)
  state.current.tx = null;
  state.current.idx = 0;
  saveState();
  showPage('page-txselect');
}

// helper check if stage complete (all angles touched)
function isStageComplete(tx, stage){
  const arr = state.values[tx][stage];
  for(let i=0;i<arr.length;i++){
    const r = arr[i];
    if(r.DDM === null && r.SDM === null && r.RF === null) return false;
  }
  return true;
}

// simple table & compute functions (abbreviated)
function buildTableFor(tx, type){
  const dest = $(`tbl_${tx}_${type}`);
  if(!dest) return;
  dest.innerHTML = '';
  const tbl = document.createElement('table'); tbl.className='table';
  const thead = document.createElement('thead'); const hdr = document.createElement('tr');
  ['Angle','DDM','SDM','RF'].forEach(h=>{ const th = document.createElement('th'); th.textContent = h; hdr.appendChild(th); });
  thead.appendChild(hdr); tbl.appendChild(thead);
  const tbody = document.createElement('tbody');
  state.values[tx][type].forEach((r,i)=>{
    const tr = document.createElement('tr');
    const tdA = document.createElement('td'); tdA.textContent = ANGLES[i]; tr.appendChild(tdA);
    const tdD = document.createElement('td'); tdD.textContent = r.DDM===null?'':r.DDM; tr.appendChild(tdD);
    const tdS = document.createElement('td'); tdS.textContent = r.SDM===null?'':r.SDM; tr.appendChild(tdS);
    const tdR = document.createElement('td'); tdR.textContent = r.RF===null?'':r.RF; tr.appendChild(tdR);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody); dest.appendChild(tbl);
}
function buildAllTables(){ buildTableFor('tx1','present'); buildTableFor('tx1','reference'); buildTableFor('tx2','present'); buildTableFor('tx2','reference'); }

function calculateAll(){
  // lightweight compute (only DDM diffs)
  const compiled = {};
  ['tx1','tx2'].forEach(tx=>{
    compiled[tx] = {};
    ['present','reference'].forEach(t=>{
      const arr = state.values[tx][t];
      compiled[tx][t] = { ddm: arr.map(x=> x.DDM===null ? NaN : x.DDM ) };
    });
    // diff when both present & reference exist
    const ref = compiled[tx].reference.ddm, pres = compiled[tx].present.ddm;
    compiled[tx].ddm_diff = ref.map((v,i)=> (isNaN(v) || isNaN(pres[i]))? NaN : v - pres[i]);
  });
  state.compiled = compiled; saveState();
  // simple plotting - create charts if canvas present
  try{ plotAllCharts(compiled); }catch(e){ console.warn('plot error', e); }
  renderSummary(compiled);
}

let charts = {};
function plotAllCharts(compiled){
  function plot(id, arr){ const c = document.getElementById(id); if(!c) return; const ctx = c.getContext('2d'); if(charts[id]) charts[id].destroy(); charts[id] = new Chart(ctx,{ type:'line', data:{ labels: ANGLES, datasets:[{label:'values', data:arr}] }, options:{} }); }
  plot('chart_tx1_ddm', state.compiled.tx1.present.ddm);
  plot('chart_tx2_ddm', state.compiled.tx2.present.ddm);
}

function renderSummary(compiled){
  const out = [];
  ['tx1','tx2'].forEach(tx=>{
    out.push(`--- ${tx.toUpperCase()} ---`);
    out.push(`DDM diffs (sample): ${compiled[tx].ddm_diff.slice(0,5).map(v=> isNaN(v)?'NA':v).join(', ')}`);
    out.push('');
  });
  $('resultsSummary').textContent = out.join('\n');
  $('resultsSummary').classList.remove('hidden');
}

// export CSV
function exportCsv(){
  const meta = state.meta;
  const rows = [];
  rows.push(`Station,${meta.station||''}`);
  rows.push(`Frequency,${meta.freq||''}`);
  rows.push('');
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(type=>{
      rows.push(`${tx.toUpperCase()} - ${type.toUpperCase()}`);
      rows.push('Angle,DDM,SDM,RF');
      state.values[tx][type].forEach((r,i)=> rows.push(`${ANGLES[i]},${r.DDM===null?'':r.DDM},${r.SDM===null?'':r.SDM},${r.RF===null?'':r.RF}`));
      rows.push('');
    });
  });
  const csv = rows.join('\n'); const blob = new Blob([csv], { type:'text/csv' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'llz_export.csv'; a.click(); URL.revokeObjectURL(url);
}

// export pdf (simple)
async function exportPdf(){
  if(!state.compiled) calculateAll();
  const printDiv = el('div'); printDiv.style.padding='12px'; printDiv.style.fontFamily='monospace';
  const meta = state.meta;
  printDiv.innerHTML = `<div style="font-weight:700">Station: ${meta.station||''}  Freq: ${meta.freq||''}</div><hr/>`;
  document.body.appendChild(printDiv);
  try{
    const canvas = await html2canvas(printDiv, { scale:1.5 });
    const img = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    const props = pdf.getImageProperties(img);
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (props.height * pdfW) / props.width;
    pdf.addImage(img, 'PNG', 0, 0, pdfW, pdfH);
    pdf.save('llz_report.pdf');
  }catch(e){ alert('PDF error: '+e); }
  finally{ document.body.removeChild(printDiv); }
}

// wiring
document.addEventListener('DOMContentLoaded', ()=>{

  // load meta
  $('station').value = state.meta.station || '';
  $('freq').value = state.meta.freq || '';
  $('make').value = state.meta.make || '';
  $('model').value = state.meta.model || '';
  $('refDate').value = state.meta.refDate || '';
  $('presDate').value = state.meta.presDate || '';
  $('course').value = state.meta.course || '';

  // home
  $('btnHome').addEventListener('click', ()=> showPage('page-meta'));

  // stage buttons
  $('choosePresent').addEventListener('click', ()=>{ if(!applyHeaderCheck()) return; populateMetaFromUI(); startStage('present'); });
  $('chooseReference').addEventListener('click', ()=>{ if(!applyHeaderCheck()) return; populateMetaFromUI(); startStage('reference'); });

  // tx cards
  $('tx1Card').addEventListener('click', ()=> onTxChosen('tx1'));
  $('tx2Card').addEventListener('click', ()=> onTxChosen('tx2'));

  // direction page
  $('dirContinue').addEventListener('click', onDirectionContinue);
  $('dirBack').addEventListener('click', ()=> showPage('page-txselect'));

  // wizard nav
  $('prevAngle').addEventListener('click', ()=>{ wizardPrev(); });
  $('nextAngle').addEventListener('click', ()=>{ wizardNext(); });
  $('saveAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); showToast('Saved'); });
  $('finishWizard').addEventListener('click', finishTxAndBack);

  // Next-buttons (jump focus / next)
  if($('ddmNext')) $('ddmNext').addEventListener('click', ()=> $('sdmInput').focus());
  if($('sdmNext')) $('sdmNext').addEventListener('click', ()=> $('rfInput').focus());
  if($('rfNext')) $('rfNext').addEventListener('click', ()=> { wizardSaveCurrent(); wizardNext(); });

  // show/hide next buttons on input
  ['ddmInput','sdmInput','rfInput'].forEach(id=>{
    const elIn = $(id);
    if(!elIn) return;
    elIn.addEventListener('input', updateNextButtonsVisibility);
    elIn.addEventListener('keydown', ev=> {
      if(ev.key === 'Enter'){
        ev.preventDefault();
        if(id === 'ddmInput') $('sdmInput').focus();
        else if(id === 'sdmInput') $('rfInput').focus();
        else if(id === 'rfInput') { wizardSaveCurrent(); wizardNext(); }
      }
    });
  });

  // results
  $('showTables').addEventListener('click', ()=>{ buildAllTables(); $('tablesArea').classList.toggle('hidden'); });
  $('calcAll').addEventListener('click', ()=>{ calculateAll(); $('plotsArea').classList.remove('hidden'); });
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportPdfBtn').addEventListener('click', exportPdf);
  $('exportImgsBtn').addEventListener('click', ()=> alert('Image export in-progress') );

  // show meta page by default
  showPage('page-meta');
});
