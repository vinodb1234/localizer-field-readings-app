/* app.js - final: combined horizontal tables and PDF export including graphs + combined tables.
   - Uses UPLOADED_FILE_URL for future import: "/mnt/data/LLZ Field Reading.xls"
   - Charts show all angle labels (autoSkip: false, rotated)
   - PDF export (Option 1): Basic details, TX1 Graph, TX1 Combined Table, TX2 Graph, TX2 Combined Table
*/

const ANGLES = [
  -35,-30,-25,-20,-14,-13,-12,-11,-10,
  -9,-8,-7,-6,-5,-4,-3,-2.5,-2,-1.5,-1,-0.5,
  0,0.5,1,1.5,2,2.5,3,4,5,6,7,8,9,10,11,12,13,14,20,25,30,35
];

const STORAGE_KEY = 'llz_final_v5';

let state = {
  meta: { station:'', freq:'', make:'', model:'', refDate:'', presDate:'', course:'' },
  values: { tx1:{present:[], reference:[]}, tx2:{present:[], reference:[]} },
  current: { stage:'present', tx:null, direction:'neg2pos', idx:0 }
};

function initArrays(){
  ['tx1','tx2'].forEach(tx=>{
    ['present','reference'].forEach(stage=>{
      state.values[tx][stage] = ANGLES.map(()=>({DDM:null, SDM:null, RF:null}));
    });
  });
}
initArrays();

function $(id){ return document.getElementById(id); }
function el(tag, cls){ const e=document.createElement(tag); if(cls) e.className = cls; return e; }
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{
      const l = JSON.parse(raw);
      if(l.meta) state.meta = Object.assign(state.meta, l.meta);
      if(l.values) state.values = Object.assign(state.values, l.values);
      if(l.current) state.current = Object.assign(state.current, l.current);
    }catch(e){ console.warn(e); initArrays(); }
  }
  ['tx1','tx2'].forEach(tx=>{ ['present','reference'].forEach(stage=>{
    if(!Array.isArray(state.values[tx][stage]) || state.values[tx][stage].length !== ANGLES.length) state.values[tx][stage] = ANGLES.map(()=>({DDM:null, SDM:null, RF:null}));
  })});
  saveState();
}
loadState();

// page helpers
function showPage(id){ document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden')); const e=$(id); if(e) e.classList.remove('hidden'); window.scrollTo(0,0); }

// meta
function populateMetaFromUI(){ state.meta.station = $('station').value.trim(); state.meta.freq = $('freq').value.trim(); state.meta.make = $('make').value.trim(); state.meta.model = $('model').value.trim(); state.meta.refDate = $('refDate').value.trim(); state.meta.presDate = $('presDate').value.trim(); state.meta.course = $('course').value.trim(); saveState(); updateDashboardButtons(); }
function formatDateOK(s){ return /^\d{2}-\d{2}-\d{4}$/.test(s); }
function applyHeaderCheck(){ const ref = $('refDate').value.trim(), pres = $('presDate').value.trim(); if(!formatDateOK(ref) || !formatDateOK(pres)){ alert('Enter dates in DD-MM-YYYY'); return false; } return true; }

// bottom sheet / toast
function createBottomSheet(){ if(document.querySelector('.bs-overlay')) return; const overlay = el('div','bs-overlay'); overlay.innerHTML = `<div class="bottom-sheet"><div class="bs-handle"></div><div class="sheet-title" id="sheetTitle"></div><div class="sheet-sub" id="sheetSub"></div><div class="sheet-buttons" id="sheetButtons"></div></div>`; document.body.appendChild(overlay); overlay.addEventListener('click', e=>{ if(e.target===overlay) hideBottomSheet(); }); }
function showBottomSheet(title, sub, buttons){ createBottomSheet(); const overlay = document.querySelector('.bs-overlay'); const sheet = overlay.querySelector('.bottom-sheet'); overlay.classList.add('show'); setTimeout(()=> sheet.classList.add('show'),20); $('sheetTitle').textContent = title||''; $('sheetSub').textContent = sub||''; const c = $('sheetButtons'); c.innerHTML=''; buttons.forEach(b=>{ const btn = el('button','sheet-btn'); btn.textContent = b.label; if(b.kind==='primary') btn.classList.add('primary'); btn.onclick = ()=>{ hideBottomSheet(); setTimeout(()=> b.action && b.action(),240); }; c.appendChild(btn); }); }
function hideBottomSheet(){ const overlay=document.querySelector('.bs-overlay'); if(!overlay) return; const sheet=overlay.querySelector('.bottom-sheet'); sheet.classList.remove('show'); setTimeout(()=> overlay.classList.remove('show'),260); }
function showToast(msg,ms=1500){ let t = document.querySelector('.toast'); if(!t){ t = el('div','toast'); document.body.appendChild(t); } t.textContent = msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), ms); }

// wizard helpers
function getOrderIndex(idx){ return state.current.direction === 'neg2pos' ? idx : (ANGLES.length - 1 - idx); }

function updateDDMSignUI(angle, saved){
  const prefix = $('ddmSignPrefix');
  const signGroup = $('ddmSignGroup');
  if(angle === 0){
    prefix.style.display = 'none';
    signGroup.style.display = 'block';
    if(saved && saved.DDM !== null){
      if(saved.DDM < 0) $('ddmMinus').checked = true;
      else $('ddmPlus').checked = true;
    } else {
      $('ddmPlus').checked = true;
    }
  } else {
    signGroup.style.display = 'none';
    prefix.style.display = 'inline-block';
    prefix.textContent = angle < 0 ? '−' : '+';
  }
}

function showWizardForCurrent(){
  if(!state.current.tx){ alert('Please select a transmitter'); return; }
  const tx = state.current.tx;
  const stage = state.current.stage;
  const total = ANGLES.length;
  if(state.current.idx < 0) state.current.idx = 0;
  if(state.current.idx >= total) state.current.idx = total - 1;
  const orderIdx = getOrderIndex(state.current.idx);
  const angle = ANGLES[orderIdx];
  $('angleValue').textContent = angle;
  $('wizardTitle').textContent = `${tx.toUpperCase()} — ${stage.toUpperCase()}`;
  $('wizardMeta').textContent = `Station: ${state.meta.station || '-'}  REF: ${state.meta.refDate || '-'}  PRES: ${state.meta.presDate || '-'}`;
  const saved = state.values[tx][stage][orderIdx];
  $('ddmInput').value = (saved && saved.DDM !== null) ? Math.abs(saved.DDM) : '';
  $('sdmInput').value = (saved && saved.SDM !== null) ? Math.abs(saved.SDM) : '';
  $('rfInput').value = (saved && saved.RF !== null) ? Math.abs(saved.RF) : '';
  updateDDMSignUI(angle, saved);
  updateNextButtonsVisibility();
  $('wizardProgress').textContent = `Angle ${state.current.idx + 1} of ${ANGLES.length}`;
}

function wizardSaveCurrent(){
  if(!state.current.tx){ alert('No transmitter selected'); return false; }
  const tx = state.current.tx;
  const stage = state.current.stage;
  const orderIdx = getOrderIndex(state.current.idx);
  const angle = ANGLES[orderIdx];

  let ddm = $('ddmInput').value.trim(), sdm = $('sdmInput').value.trim(), rf = $('rfInput').value.trim();
  let ddmNum = ddm === '' ? null : Number(ddm);
  let sdmNum = sdm === '' ? null : Number(sdm);
  let rfNum  = rf === '' ? null : Number(rf);
  if(ddmNum !== null && isNaN(ddmNum)){ alert('DDM must be numeric'); return false; }
  if(sdmNum !== null && isNaN(sdmNum)){ alert('SDM must be numeric'); return false; }
  if(rfNum !== null && isNaN(rfNum)){ alert('RF must be numeric'); return false; }

  // sign rules
  if(ddmNum !== null){
    if(angle < 0) ddmNum = -Math.abs(ddmNum);
    else if(angle > 0) ddmNum = Math.abs(ddmNum);
    else {
      const sel = document.querySelector('input[name="ddmSign"]:checked');
      if(sel && sel.value === '-') ddmNum = -Math.abs(ddmNum);
      else ddmNum = Math.abs(ddmNum);
    }
  }
  if(sdmNum !== null) sdmNum = Math.abs(sdmNum);
  if(rfNum !== null) rfNum = -Math.abs(rfNum);

  state.values[tx][stage][orderIdx] = { DDM: ddmNum, SDM: sdmNum, RF: rfNum };
  saveState();
  return true;
}

function wizardNext(){ if(!wizardSaveCurrent()) return; state.current.idx++; if(state.current.idx >= ANGLES.length) state.current.idx = ANGLES.length - 1; showWizardForCurrent(); }
function wizardPrev(){ wizardSaveCurrent(); state.current.idx--; if(state.current.idx < 0) state.current.idx = 0; showWizardForCurrent(); }

function updateNextButtonsVisibility(){
  const ddmVal = $('ddmInput').value.trim();
  const sdmVal = $('sdmInput').value.trim();
  const rfVal = $('rfInput').value.trim();
  const ddn = $('ddmNext'), sdn = $('sdmNext'), rfn = $('rfNext');
  if(ddn) ddn.classList.toggle('hidden', ddmVal === '');
  if(sdn) sdn.classList.toggle('hidden', sdmVal === '');
  if(rfn) rfn.classList.toggle('hidden', rfVal === '');
}

// dashboard & flow
function updateDashboardButtons(){
  const anyPresent = isStageComplete('tx1','present') || isStageComplete('tx2','present');
  const anyRef = isStageComplete('tx1','reference') || isStageComplete('tx2','reference');
  const chooseResults = $('chooseResults');
  if(chooseResults){
    chooseResults.style.display = (anyPresent || anyRef) ? 'inline-block' : 'none';
  }
  const progress = $('stageProgress');
  if(progress){
    progress.textContent = `Status — P: TX1 ${isStageComplete('tx1','present')?'✓':'—'}  TX2 ${isStageComplete('tx2','present')?'✓':'—'}  |  R: TX1 ${isStageComplete('tx1','reference')?'✓':'—'}  TX2 ${isStageComplete('tx2','reference')?'✓':'—'}`;
  }
}

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

function updateTxCardStatus(){
  ['tx1','tx2'].forEach(tx=>{
    const elId = tx === 'tx1' ? 'tx1Card' : 'tx2Card';
    const card = $(elId);
    const presentDone = isStageComplete(tx,'present');
    const refDone = isStageComplete(tx,'reference');
    const foot = tx === 'tx1' ? $('tx1Status') : $('tx2Status');
    if(foot) foot.textContent = `P:${presentDone? '✓':'—'}  R:${refDone? '✓':'—'}`;
    if(card){ card.classList.toggle('completed', presentDone && refDone); }
  });
}

function onTxChosen(tx){
  state.current.tx = tx;
  $('dirHeader').textContent = `Select Angle Direction for ${tx.toUpperCase()} (${state.current.stage.toUpperCase()})`;
  if(state.current.direction === 'pos2neg') $('dirPos2Neg').checked = true; else $('dirNeg2Pos').checked = true;
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

function finishTxAndBack(){
  if(!wizardSaveCurrent()) return;
  const finishedTx = state.current.tx;
  const stage = state.current.stage;
  showToast(`${finishedTx.toUpperCase()} ${stage.toUpperCase()} saved`);
  state.current.tx = null;
  state.current.idx = 0;
  saveState();
  updateTxCardStatus();

  const bothDoneThisStage = isStageComplete('tx1', stage) && isStageComplete('tx2', stage);
  if(bothDoneThisStage){
    const otherStage = (stage === 'present') ? 'reference' : 'present';
    const allDone = isStageComplete('tx1','present') && isStageComplete('tx2','present') && isStageComplete('tx1','reference') && isStageComplete('tx2','reference');
    if(allDone){
      showBottomSheet(
        `All readings completed`,
        `All Present and Reference readings for both TXs completed.`,
        [
          { label: 'View Results', kind:'primary', action: ()=> { populateResultsMeta(); buildAllTables(); showPage('page-results'); } },
          { label: 'Back to Dashboard', kind:'secondary', action: ()=> { showPage('page-stage'); updateDashboardButtons(); } }
        ]
      );
      return;
    }
    showBottomSheet(
      `${stage.toUpperCase()} readings completed`,
      `Proceed to ${otherStage.toUpperCase()} readings?`,
      [
        { label: `Start ${otherStage.toUpperCase()}`, kind:'primary', action: ()=> { startStage(otherStage); } },
        { label: 'Stay here', kind:'secondary', action: ()=> { showPage('page-txselect'); } },
        { label: 'View Results', kind:'ghost', action: ()=> { populateResultsMeta(); buildAllTables(); showPage('page-results'); } }
      ]
    );
  } else {
    showBottomSheet(
      `${finishedTx.toUpperCase()} ${stage.toUpperCase()} completed`,
      `What would you like to do next for ${stage.toUpperCase()}?`,
      [
        { label: `Enter other TX (${ finishedTx === 'tx1' ? 'TX2' : 'TX1' })`, kind:'primary', action: ()=> { startStage(stage); } },
        { label: `Redo ${finishedTx.toUpperCase()}`, kind:'secondary', action: ()=> { state.current.tx = finishedTx; showPage('page-direction'); } },
        { label: 'View Results', kind:'ghost', action: ()=> { populateResultsMeta(); buildAllTables(); showPage('page-results'); } }
      ]
    );
  }
}

function isStageComplete(tx, stage){
  const arr = state.values[tx][stage];
  for(let i=0;i<arr.length;i++){
    const r = arr[i];
    if(r.DDM === null && r.SDM === null && r.RF === null) return false;
  }
  return true;
}

// RESULTS: combined tables & compute
function populateResultsMeta(){
  const m = state.meta;
  const el = $('resultsMeta');
  if(el) el.textContent = `Station: ${m.station||''}   Freq: ${m.freq||''} MHz   REF: ${m.refDate||''}   PRES: ${m.presDate||''}   Make: ${m.make||''}   Model: ${m.model||''}`;
}

// Build combined horizontal table for a transmitter (A-style order)
function buildCombinedTable(tx){
  const container = $(`table_${tx}_combined`) || $( `table_${tx}_combined` );
  const targetId = tx === 'tx1' ? 'table_tx1_combined' : 'table_tx2_combined';
  const wrapper = $(targetId);
  if(!wrapper) return;
  wrapper.innerHTML = ''; // clear

  // build table element
  const tbl = el('table');
  // header row: first cell "ANGLE" then all angle headers
  const thead = el('thead');
  const headRow = el('tr');
  const th0 = el('th'); th0.textContent = 'ANGLE';
  headRow.appendChild(th0);
  ANGLES.forEach(a=>{ const th = el('th'); th.textContent = a; headRow.appendChild(th); });
  thead.appendChild(headRow);
  tbl.appendChild(thead);

  // helper to create row
  const addRow = (label, arrValues) => {
    const tr = el('tr');
    const th = el('th'); th.textContent = label; tr.appendChild(th);
    arrValues.forEach(v=>{ const td = el('td'); td.textContent = (v === null || v === undefined) ? '' : v; tr.appendChild(td); });
    return tr;
  };

  // fetch signed arrays for ref and present
  const refArr = state.values[tx].reference.map(o => o); // objects
  const presArr = state.values[tx].present.map(o => o);

  // rows in requested order:
  // 1 DDM REF (% or units)
  // 2 DDM PRESENT
  // 3 SDM REF
  // 4 SDM PRESENT
  // 5 RF REF
  // 6 RF PRESENT

  const tbody = el('tbody');
  const ddmRef = refArr.map(x => x.DDM === null ? '' : x.DDM);
  const ddmPres = presArr.map(x => x.DDM === null ? '' : x.DDM);
  const sdmRef = refArr.map(x => x.SDM === null ? '' : x.SDM);
  const sdmPres = presArr.map(x => x.SDM === null ? '' : x.SDM);
  const rfRef = refArr.map(x => x.RF === null ? '' : x.RF);
  const rfPres = presArr.map(x => x.RF === null ? '' : x.RF);

  tbody.appendChild(addRow(`DDM REF (${state.meta.refDate||''})`, ddmRef));
  tbody.appendChild(addRow(`DDM PRES (${state.meta.presDate||''})`, ddmPres));
  tbody.appendChild(addRow(`SDM REF (${state.meta.refDate||''})`, sdmRef));
  tbody.appendChild(addRow(`SDM PRES (${state.meta.presDate||''})`, sdmPres));
  tbody.appendChild(addRow(`RF REF (${state.meta.refDate||''})`, rfRef));
  tbody.appendChild(addRow(`RF PRES (${state.meta.presDate||''})`, rfPres));

  tbl.appendChild(tbody);
  wrapper.appendChild(tbl);
}

// Build both combined tables
function buildAllCombinedTables(){
  buildCombinedTable('tx1');
  buildCombinedTable('tx2');
}

// compute absolute arrays and prepare for plotting
let charts = {};
function calculateAll(){
  const compiled = {};
  ['tx1','tx2'].forEach(tx=>{
    compiled[tx] = {};
    ['present','reference'].forEach(t=>{
      const arr = state.values[tx][t];
      compiled[tx][t] = {
        ddm_abs: arr.map(x => x.DDM === null ? NaN : Math.abs(x.DDM)),
        sdm_abs: arr.map(x => x.SDM === null ? NaN : Math.abs(x.SDM)),
        rf_abs:  arr.map(x => x.RF  === null ? NaN : Math.abs(x.RF))
      };
    });
    const refSigned = state.values[tx].reference.map(x => x.DDM === null ? NaN : x.DDM);
    const presSigned = state.values[tx].present.map(x => x.DDM === null ? NaN : x.DDM);
    compiled[tx].ddm_diff_signed = refSigned.map((v,i) => (isNaN(v) || isNaN(presSigned[i])) ? NaN : v - presSigned[i]);
  });
  state.compiled = compiled;
  saveState();
  plotCombinedGraphs(compiled);
  renderSummary(compiled);
  buildAllCombinedTables();
}

// Plot combined graphs with all angle labels shown
function plotCombinedGraphs(compiled){
  const colors = {
    ddm_pres: 'rgb(2, 119, 189)',
    ddm_ref:  'rgba(2,119,189,0.45)',
    sdm_pres: 'rgb(22, 160, 133)',
    sdm_ref:  'rgba(22,160,133,0.45)',
    rf_pres:  'rgb(192, 57, 43)',
    rf_ref:   'rgba(192,57,43,0.45)'
  };
  const makeDataset = (label, data, color, dash=false) => ({
    label,
    data,
    fill: false,
    borderColor: color,
    backgroundColor: color,
    tension: 0.12,
    pointRadius: 2,
    borderDash: dash ? [6,4] : []
  });

  // TX1
  const tx1 = compiled.tx1;
  const ds1 = [
    makeDataset('DDM Present', tx1.present.ddm_abs, colors.ddm_pres),
    makeDataset('DDM Reference', tx1.reference.ddm_abs, colors.ddm_ref, false),
    makeDataset('SDM Present', tx1.present.sdm_abs, colors.sdm_pres),
    makeDataset('SDM Reference', tx1.reference.sdm_abs, colors.sdm_ref, false),
    makeDataset('RF Present', tx1.present.rf_abs, colors.rf_pres),
    makeDataset('RF Reference', tx1.reference.rf_abs, colors.rf_ref, false)
  ];
  const c1 = document.getElementById('chart_tx1_all');
  if(c1){
    if(charts['chart_tx1_all']) charts['chart_tx1_all'].destroy();
    const ctx1 = c1.getContext('2d');
    charts['chart_tx1_all'] = new Chart(ctx1, {
      type: 'line',
      data: { labels: ANGLES, datasets: ds1 },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        stacked: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: {
            title: { display:true, text: 'Angle (°)' },
            ticks: { autoSkip: false, maxRotation: 90, minRotation: 90 }
          },
          y: { title: { display:true, text: 'Magnitude (absolute values)' }, beginAtZero: true }
        }
      }
    });
  }

  // TX2
  const tx2 = compiled.tx2;
  const ds2 = [
    makeDataset('DDM Present', tx2.present.ddm_abs, colors.ddm_pres),
    makeDataset('DDM Reference', tx2.reference.ddm_abs, colors.ddm_ref, false),
    makeDataset('SDM Present', tx2.present.sdm_abs, colors.sdm_pres),
    makeDataset('SDM Reference', tx2.reference.sdm_abs, colors.sdm_ref, false),
    makeDataset('RF Present', tx2.present.rf_abs, colors.rf_pres),
    makeDataset('RF Reference', tx2.reference.rf_abs, colors.rf_ref, false)
  ];
  const c2 = document.getElementById('chart_tx2_all');
  if(c2){
    if(charts['chart_tx2_all']) charts['chart_tx2_all'].destroy();
    const ctx2 = c2.getContext('2d');
    charts['chart_tx2_all'] = new Chart(ctx2, {
      type: 'line',
      data: { labels: ANGLES, datasets: ds2 },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        stacked: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          x: {
            title: { display:true, text: 'Angle (°)' },
            ticks: { autoSkip: false, maxRotation: 90, minRotation: 90 }
          },
          y: { title: { display:true, text: 'Magnitude (absolute values)' }, beginAtZero: true }
        }
      }
    });
  }

  $('plotsArea').classList.remove('hidden');
}

// render summary
function renderSummary(compiled){
  const out = [];
  ['tx1','tx2'].forEach(tx=>{
    out.push(`--- ${tx.toUpperCase()} ---`);
    out.push(`Sample DDM signed diffs (first 6): ${compiled[tx].ddm_diff_signed.slice(0,6).map(v=> isNaN(v)?'NA':v).join(', ')}`);
    out.push('');
  });
  $('resultsSummary').textContent = out.join('\n');
  $('resultsSummary').classList.remove('hidden');
}

// CSV (same as before)
function exportCsv(){
  const m = state.meta;
  const rows = [];
  rows.push(`Station,${m.station||''}`);
  rows.push(`Frequency,${m.freq||''}`);
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

// PDF export: include graphs then their combined tables (Option 1)
async function exportPdf(){
  if(!state.compiled) calculateAll();
  // ensure charts are rendered
  await new Promise(r => setTimeout(r, 200));

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','pt','a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 28;

  // Add header
  pdf.setFontSize(12);
  const header = `Station: ${state.meta.station||''}   Freq: ${state.meta.freq||''} MHz   REF: ${state.meta.refDate||''}   PRES: ${state.meta.presDate||''}   Make: ${state.meta.make||''}   Model: ${state.meta.model||''}`;
  pdf.text(header, margin, 40);

  let cursorY = 60;

  // Helper: draw canvas to PDF at cursorY, returns new cursorY
  const addCanvasImage = (canvas, maxW, yPos) => {
    const dataUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.src = dataUrl;
    return new Promise((resolve)=>{
      img.onload = ()=>{
        const imgW = img.width;
        const imgH = img.height;
        // scale to fit width (maxW)
        const scale = Math.min(1, maxW / imgW);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        // page break if needed
        if(yPos + drawH + 60 > pageH){
          pdf.addPage();
          yPos = margin;
        }
        pdf.addImage(dataUrl, 'PNG', margin, yPos, drawW, drawH);
        resolve(yPos + drawH + 12);
      };
      img.onerror = ()=> resolve(yPos + 12);
    });
  };

  // Helper: capture an element (table wrapper) to image via html2canvas and add to PDF
  const addElementImage = (elNode, maxW, yPos) => {
    return html2canvas(elNode, { scale: 1.25 }).then(canvas =>{
      const dataUrl = canvas.toDataURL('image/png');
      const img = new Image();
      img.src = dataUrl;
      return new Promise((resolve)=>{
        img.onload = ()=>{
          const imgW = img.width;
          const imgH = img.height;
          const scale = Math.min(1, maxW / imgW);
          const drawW = imgW * scale;
          const drawH = imgH * scale;
          if(yPos + drawH + 60 > pageH){
            pdf.addPage();
            yPos = margin;
          }
          pdf.addImage(dataUrl, 'PNG', margin, yPos, drawW, drawH);
          resolve(yPos + drawH + 12);
        };
        img.onerror = ()=> resolve(yPos + 12);
      });
    });
  };

  const maxImgWidth = pageW - margin*2;

  // TX1: add chart then combined table
  const c1 = document.getElementById('chart_tx1_all');
  if(c1){
    cursorY = await addCanvasImage(c1, maxImgWidth, cursorY);
  }
  const table1 = document.getElementById('table_tx1_combined');
  if(table1){
    cursorY = await addElementImage(table1, maxImgWidth, cursorY);
  }

  // TX2: add chart then combined table
  const c2 = document.getElementById('chart_tx2_all');
  if(c2){
    cursorY = await addCanvasImage(c2, maxImgWidth, cursorY);
  }
  const table2 = document.getElementById('table_tx2_combined');
  if(table2){
    cursorY = await addElementImage(table2, maxImgWidth, cursorY);
  }

  // finalize
  pdf.save('llz_report_graphs_tables.pdf');
}

// wiring
document.addEventListener('DOMContentLoaded', ()=>{

  // populate meta
  $('station').value = state.meta.station || '';
  $('freq').value = state.meta.freq || '';
  $('make').value = state.meta.make || '';
  $('model').value = state.meta.model || '';
  $('refDate').value = state.meta.refDate || '';
  $('presDate').value = state.meta.presDate || '';
  $('course').value = state.meta.course || '';

  // HOME
  $('btnHome').addEventListener('click', ()=>{
    if(state.meta && state.meta.station) { updateDashboardButtons(); showPage('page-stage'); }
    else showPage('page-meta');
  });

  // meta Next
  $('metaNext').addEventListener('click', ()=>{
    if(!applyHeaderCheck()) return;
    populateMetaFromUI();
    updateDashboardButtons();
    showPage('page-stage');
  });

  // clear saved
  $('clearAll').addEventListener('click', ()=>{ if(confirm('Clear all saved local entries?')){ localStorage.removeItem(STORAGE_KEY); location.reload(); } });

  // stage dashboard handlers
  $('choosePresent').addEventListener('click', ()=>{ if(!applyHeaderCheck()) return; populateMetaFromUI(); startStage('present'); });
  $('chooseReference').addEventListener('click', ()=>{ if(!applyHeaderCheck()) return; populateMetaFromUI(); startStage('reference'); });
  $('chooseResults').addEventListener('click', ()=>{ populateResultsMeta(); buildAllCombinedTables(); showPage('page-results'); });

  // tx cards
  $('tx1Card').addEventListener('click', ()=> onTxChosen('tx1'));
  $('tx2Card').addEventListener('click', ()=> onTxChosen('tx2'));

  // direction
  $('dirContinue').addEventListener('click', onDirectionContinue);
  $('dirBack').addEventListener('click', ()=> showPage('page-txselect'));

  // wizard nav
  $('prevAngle').addEventListener('click', ()=> wizardPrev());
  $('nextAngle').addEventListener('click', ()=> wizardNext());
  $('saveAngle').addEventListener('click', ()=>{ wizardSaveCurrent(); showToast('Saved'); });
  $('finishWizard').addEventListener('click', ()=> finishTxAndBack());

  // next small buttons
  if($('ddmNext')) $('ddmNext').addEventListener('click', ()=> $('sdmInput').focus());
  if($('sdmNext')) $('sdmNext').addEventListener('click', ()=> $('rfInput').focus());
  if($('rfNext')) $('rfNext').addEventListener('click', ()=> { wizardSaveCurrent(); wizardNext(); });

  // inputs: toggles
  ['ddmInput','sdmInput','rfInput'].forEach(id=>{
    const e = $(id); if(!e) return;
    e.addEventListener('input', updateNextButtonsVisibility);
    e.addEventListener('keydown', ev=>{
      if(ev.key === 'Enter'){
        ev.preventDefault();
        if(id === 'ddmInput') $('sdmInput').focus();
        else if(id === 'sdmInput') $('rfInput').focus();
        else if(id === 'rfInput') { wizardSaveCurrent(); wizardNext(); }
      }
    });
  });

  // results actions
  $('showTables').addEventListener('click', ()=> { buildAllCombinedTables(); $('tablesArea').classList.toggle('hidden'); });
  $('calcAll').addEventListener('click', ()=> { calculateAll(); $('plotsArea').classList.remove('hidden'); });
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportPdfBtn').addEventListener('click', exportPdf);
  $('exportImgsBtn').addEventListener('click', ()=> exportPdf());

  // init UI
  updateTxCardStatus();
  updateDashboardButtons();
  if(state.meta && state.meta.station) showPage('page-stage'); else showPage('page-meta');
});
