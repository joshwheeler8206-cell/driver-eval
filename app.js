'use strict';

/* ============================== Data model ============================== */

const CHECKLIST = [
  {
    id: 'pre-trip',
    num: '1',
    title: 'Pre-Trip Inspection',
    items: [
      'Valid Driver License & Medical Card in possession',
      'Corrective lenses or hearing aid (if restrictions apply)',
      'In-cab paperwork (Registration / Insurance / UCR / Hazmat, etc.)',
      'Fire Extinguisher & Warning Triangles',
      'Horn',
      'Air Brake System and Operation (If Applicable)',
      'Annual DOT inspection current',
      'Lights',
      'Checking Oil / Fluids Daily + Belts and Hoses (open hood)',
      'Windshield',
      'Battery Cover and fuel caps secured',
      'Tires',
      'Brakes',
      'Air or oil (fluid) leaks – including wheel seals',
      'Leaf Spring / Air bags and Frame bolts',
      'Load Securement',
      'Lift gate operation (If Applicable)',
    ],
  },
  {
    id: 'safe-driving',
    num: '2',
    title: 'Safe Driving',
    items: [
      'Turn signals used properly and in advance',
      'Backing – safe procedure, mirrors, awareness',
      'Mirror usage & continuous scanning',
      'Analyze surroundings / situational awareness',
      'Correct following distance maintained',
    ],
  },
  {
    id: 'customer',
    num: '3',
    title: 'Customer Interactions',
    items: [
      'Professional greeting & demeanor',
      'Delivery process – accurate, efficient, clean',
      'Returns handled correctly & documented',
    ],
  },
  {
    id: 'tablet',
    num: '4',
    title: 'Correct Tablet Usage',
    items: [
      'First and last name entered correctly',
      'Clear, accurate pictures taken & uploaded',
    ],
  },
  {
    id: 'delivery',
    num: '5',
    title: 'Delivery Performance',
    items: [
      'Efficiency – route flow & time management',
      'Accuracy – right product, location, quantity',
    ],
  },
  {
    id: 'gps',
    num: '6',
    title: 'GPS Usage',
    items: [
      'GPS used for every stop (Elite GPS)',
    ],
  },
  {
    id: 'post-trip',
    num: '7',
    title: 'Post-Trip Inspection',
    items: [
      'Horn',
      'Lights',
      'Checking Oil / Fluids + Belts and Hoses (open hood)',
      'Windshield',
      'Tires',
      'Brakes',
      'Air or oil (fluid) leaks – including wheel seals',
      'Leaf Spring / Air bags, Frame bolts & Lift gate (If Applicable)',
      'Any issues / defects reported properly',
    ],
  },
];

const RATINGS = ['SAT', 'NI'];
const STORE_KEY = 'usaf_driver_evals_v1';

/* ============================== State ============================== */

let records = [];
let current = null; // evaluation object being edited
let activeView = 'evaluate';

/* ============================== Storage (IndexedDB + fallback) ============================== */

const DB_NAME = 'usaf_driver_evals_db';
const canIdb = typeof indexedDB !== 'undefined';
let dbReady = idbOpen();
let _writeQueue = Promise.resolve();

function idbOpen() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

async function idbGet(key) {
  try {
    const db = await dbReady;
    return await new Promise((resolve) => {
      const req = db.transaction('kv', 'readonly').objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}

async function idbSet(key, value) {
  try {
    const db = await dbReady;
    return await new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) { return false; }
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

// Writes are serialized so a slow save can't overwrite a newer one.
function persist() {
  const snapshot = JSON.parse(JSON.stringify(records));
  if (canIdb) {
    _writeQueue = _writeQueue.then(() => idbSet(STORE_KEY, snapshot)).catch(() => {});
    return _writeQueue;
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    toast('Storage is full. Try exporting and deleting old records.');
  }
  return Promise.resolve();
}

async function initStorage() {
  records = canIdb ? (await idbGet(STORE_KEY)) || [] : loadRecords();
  if (canIdb && !records.length) {
    const legacy = loadRecords();
    if (legacy.length) { records = legacy; await persist(); }
  }
}

/* ============================== Helpers ============================== */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

function quarterOf(isoDate) {
  const d = isoDate ? new Date(isoDate + 'T00:00:00') : new Date();
  if (isNaN(d)) return 'Unknown';
  return 'Q' + (Math.floor(d.getMonth() / 3) + 1);
}

function quarterKey(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d)) return '0000-Q0';
  return d.getFullYear() + '-' + (Math.floor(d.getMonth() / 3) + 1);
}

function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function newEval() {
  const areas = {};
  for (const a of CHECKLIST) {
    const items = {};
    for (const it of a.items) items[it] = null;
    areas[a.id] = { items, notes: '' };
  }
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    driverName: '',
    driverId: '',
    evalDate: todayISO(),
    assessor: '',
    areas,
    overallNotes: '',
    driverSig: null,
    assessorSig: null,
  };
}

function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ============================== Signature pad ============================== */

function makeSigPad(label) {
  const wrap = el('div', { class: 'sigpad-wrap' });
  const canvas = el('canvas', { class: 'sigpad', width: 600, height: 200 });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111827';

  let drawing = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * (canvas.width / r.width), y: (src.clientY - r.top) * (canvas.height / r.height) };
  };
  const down = (e) => { e.preventDefault(); drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const up = () => (drawing = false);

  canvas.addEventListener('mousedown', down);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mouseup', up);
  canvas.addEventListener('mouseleave', up);
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', up);

  const bar = el('div', { class: 'sigpad-bar' });
  const clearBtn = el('button', { class: 'btn ghost small', onclick: () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); } }, ['Clear']);
  bar.appendChild(el('span', { class: 'sigpad-label' }, [label]));
  bar.appendChild(clearBtn);
  wrap.appendChild(bar);
  wrap.appendChild(canvas);
  return { wrap, canvas, get: () => (ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0) ? canvas.toDataURL() : null) };
}

/* ============================== Render: Evaluate ============================== */

function renderEvaluate() {
  if (!current) current = newEval();
  const view = document.getElementById('view');
  view.innerHTML = '';
  const form = el('form', { id: 'eval-form' });

  form.appendChild(el('section', { class: 'card info-card' }, [
    el('h2', { class: 'card-title' }, ['Driver Information']),
    field('Driver Name', 'driverName', 'text', current.driverName, { required: true }),
    field('Driver ID#', 'driverId', 'text', current.driverId),
    field('Evaluation Date', 'evalDate', 'date', current.evalDate, { required: true }),
    field('Assessor / Trainer', 'assessor', 'text', current.assessor),
  ]));

  const progress = el('div', { class: 'progress' });
  view.appendChild(progress);

  for (const area of CHECKLIST) {
    const state = current.areas[area.id];
    const itemsHtml = [];
    for (const item of area.items) {
      const val = state.items[item];
      itemsHtml.push(el('div', { class: 'item' }, [
        el('span', { class: 'item-label' }, [item]),
        el('div', { class: 'rating' }, RATINGS.map((r) =>
          el('button', {
            type: 'button',
            class: 'rate ' + r + (val === r ? ' on' : ''),
            'data-area': area.id,
            'data-item': item,
            'data-rating': r,
            onclick: (e) => setRating(area.id, item, r, e.currentTarget),
          }, [r])
        )),
      ]));
    }
    itemsHtml.push(el('textarea', {
      class: 'notes',
      rows: 2,
      placeholder: 'Comments / notes for this section…',
      'data-area': area.id,
      oninput: (e) => { state.notes = e.target.value; },
    }, [state.notes]));

    form.appendChild(el('section', { class: 'card' }, [
      el('h2', { class: 'card-title' }, [area.num + '. ' + area.title]),
      ...itemsHtml,
    ]));
  }

  form.appendChild(el('section', { class: 'card' }, [
    el('h2', { class: 'card-title' }, ['Overall Performance Notes / Coaching Points']),
    el('textarea', {
      class: 'notes overall',
      rows: 5,
      placeholder: 'Write coaching observations, strengths, or improvement plans here…',
      oninput: (e) => { current.overallNotes = e.target.value; },
    }, [current.overallNotes]),
  ]));

  const sigDriver = makeSigPad('Driver Signature');
  const sigAssessor = makeSigPad('Assessor Signature');
  current._sigDriver = sigDriver;
  current._sigAssessor = sigAssessor;

  form.appendChild(el('section', { class: 'card' }, [
    el('h2', { class: 'card-title' }, ['Signatures']),
    el('label', { class: 'field' }, [
      el('span', { class: 'field-label' }, ['Signature Date']),
      el('input', { type: 'date', id: 'sigDate', value: current.sigDate || todayISO(), onchange: (e) => { current.sigDate = e.target.value; } }),
    ]),
    sigDriver.wrap,
    sigAssessor.wrap,
  ]));

  form.appendChild(el('div', { class: 'actions' }, [
    el('button', { type: 'button', class: 'btn primary big', onclick: () => saveEval() }, ['Save Evaluation']),
    el('button', { type: 'button', class: 'btn ghost big', onclick: () => resetEval() }, ['Reset']),
  ]));

  view.appendChild(form);

  updateProgress();
}

function field(labelText, id, type, value, extra = {}) {
  const input = el('input', { type, id, value, ...extra });
  return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, [labelText]), input]);
}

function setRating(areaId, item, rating, btn) {
  const state = current.areas[areaId];
  state.items[item] = rating;
  const container = btn.parentNode;
  for (const b of container.querySelectorAll('.rate')) b.classList.toggle('on', b.dataset.rating === rating);
  updateProgress();
}

function updateProgress() {
  let done = 0, total = 0;
  for (const a of CHECKLIST) for (const it of a.items) { total++; if (current.areas[a.id].items[it]) done++; }
  const pct = total ? Math.round((done / total) * 100) : 0;
  const bar = document.querySelector('.progress');
  if (bar) bar.innerHTML = '<div class="progress-fill" style="width:' + pct + '%"></div><span>' + pct + '% rated</span>';
}

function saveEval() {
  current.driverName = formValue('driverName');
  current.driverId = formValue('driverId');
  current.evalDate = formValue('evalDate');
  current.assessor = formValue('assessor');
  const sigDate = document.getElementById('sigDate');
  if (sigDate) current.sigDate = sigDate.value;

  if (!current.driverName.trim()) { toast('Driver Name is required.'); return; }
  if (!current.evalDate) { toast('Evaluation Date is required.'); return; }

  current.driverSig = current._sigDriver ? current._sigDriver.get() : null;
  current.assessorSig = current._sigAssessor ? current._sigAssessor.get() : null;

  const niCount = countNI(current);

  const idx = records.findIndex((r) => r.id === current.id);
  if (idx >= 0) records[idx] = JSON.parse(JSON.stringify(current));
  else records.push(JSON.parse(JSON.stringify(current)));

  persist();
  toast('Saved' + (niCount ? ' – ' + niCount + ' item(s) marked Needs Improvement' : '') + '.');
  current = null;
  renderEvaluate();
}

function formValue(id) {
  const node = document.getElementById(id);
  return node ? node.value : '';
}

function resetEval() {
  if (!confirm('Clear this form and start a new evaluation?')) return;
  current = null;
  renderEvaluate();
}

function countNI(ev) {
  let n = 0;
  for (const a of CHECKLIST) for (const it of a.items) if (ev.areas[a.id].items[it] === 'NI') n++;
  return n;
}

/* ============================== Render: Records ============================== */

function renderRecords() {
  const view = document.getElementById('view');
  view.innerHTML = '';

  const sorted = [...records].sort((a, b) => (b.evalDate || '').localeCompare(a.evalDate || ''));
  const head = el('div', { class: 'page-head' }, [
    el('h2', { class: 'page-title' }, ['Saved Evaluations (' + sorted.length + ')']),
    el('button', { class: 'btn ghost', onclick: exportAll }, ['Export All (JSON)']),
  ]);
  view.appendChild(head);

  if (!sorted.length) {
    view.appendChild(el('div', { class: 'empty' }, ['No evaluations saved yet. Complete one from the Evaluate tab.']));
    return;
  }

  const list = el('div', { class: 'rec-list' });
  for (const r of sorted) {
    const ni = countNI(r);
    list.appendChild(el('div', { class: 'card rec' }, [
      el('div', { class: 'rec-main' }, [
        el('div', { class: 'rec-name' }, [r.driverName || '(no name)']),
        el('div', { class: 'rec-meta' }, [
          'ID ' + (r.driverId || '–') + '  •  ' + (r.evalDate || 'no date') + '  •  ' + quarterOf(r.evalDate),
        ]),
        el('span', { class: 'badge ' + (ni ? 'bad-ni' : 'bad-ok') }, [ni ? ni + ' NI' : 'OK']),
      ]),
      el('div', { class: 'rec-actions' }, [
        el('button', { class: 'btn ghost small', onclick: () => loadEval(r.id) }, ['Open']),
        el('button', { class: 'btn ghost small primary-outline', onclick: () => openPrint(r) }, ['Print / PDF']),
        el('button', { class: 'btn ghost small', onclick: () => exportOne(r) }, ['Export']),
        el('button', { class: 'btn ghost small danger', onclick: () => deleteEval(r.id) }, ['Delete']),
      ]),
    ]));
  }
  view.appendChild(list);
}

function loadEval(id) {
  const r = records.find((x) => x.id === id);
  if (!r) return;
  current = JSON.parse(JSON.stringify(r));
  switchView('evaluate');
  renderEvaluate();
  toast('Loaded evaluation. Edit and Save to update.');
}

function deleteEval(id) {
  const r = records.find((x) => x.id === id);
  if (!r) return;
  if (!confirm('Delete evaluation for ' + (r.driverName || 'this driver') + '?')) return;
  records = records.filter((x) => x.id !== id);
  persist();
  renderRecords();
  toast('Deleted.');
}

function exportOne(r) {
  download('eval-' + (r.driverName.replace(/\s+/g, '_') || 'driver') + '-' + (r.evalDate || 'nodate') + '.json', JSON.stringify(r, null, 2));
}

function exportAll() {
  if (!records.length) { toast('Nothing to export yet.'); return; }
  download('driver-evaluations-' + todayISO() + '.json', JSON.stringify(records, null, 2));
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reportHtml(r, mode) {
  const sigImg = (data) => (data ? '<div class="sigbox"><img src="' + data + '" alt="signature"></div>' : '<div class="sigbox ns">(unsigned)</div>');
  const cell = (val) => (val === 'NI' ? 'NI' : val === 'SAT' ? 'SAT' : '');
  let areas = '';
  for (const a of CHECKLIST) {
    const rows = a.items.map((it) => {
      const v = r.areas[a.id].items[it];
      return '<tr class="' + (v === 'NI' ? 'ni' : '') + '"><td class="it">' + esc(it) + '</td>' +
        '<td class="mark on">' + (v === 'SAT' ? '\u2611' : '\u2610') + '</td>' +
        '<td class="mark2">SAT</td>' +
        '<td class="mark on">' + (v === 'NI' ? '\u2611' : '\u2610') + '</td>' +
        '<td class="mark2">NI</td></tr>';
    }).join('');
    const notes = r.areas[a.id].notes;
    areas += '<section class="area"><h3>' + a.num + '. ' + esc(a.title) + '</h3>' +
      '<table>' + rows + '</table>' +
      (notes ? '<p class="notes"><strong>Notes:</strong> ' + esc(notes) + '</p>' : '') +
      '</section>';
  }
  const title = mode === 'quarter' ? 'Quarterly Driver Evaluation Summary' : 'Quarterly Driver Evaluation';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title>' +
    '<style>' +
    '@page { size: Letter; margin: 14mm 12mm; }' +
    '* { box-sizing: border-box; }' +
    'body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 12px; }' +
    '.head { text-align: center; margin-bottom: 14px; }' +
    '.head h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: .5px; }' +
    '.head p { margin: 0; font-size: 11px; color: #444; }' +
    'table.meta { width: 100%; border-collapse: collapse; margin-bottom: 14px; }' +
    'table.meta td { border: 1px solid #333; padding: 6px 8px; font-size: 12px; }' +
    'table.meta .lbl { font-weight: 700; width: 22%; background: #eef; }' +
    '.area { page-break-inside: avoid; margin-bottom: 12px; border: 1px solid #333; }' +
    '.area h3 { margin: 0; padding: 6px 8px; background: #dde7f7; border-bottom: 1px solid #333; font-size: 13px; }' +
    'table { width: 100%; border-collapse: collapse; }' +
    'td { padding: 4px 8px; font-size: 12px; }' +
    'tr + tr td, tr + tr { border-top: 1px solid #ccc; }' +
    'td.it { width: 70%; }' +
    'td.mark { width: 3.5%; text-align: center; font-size: 15px; }' +
    'td.mark2 { width: 11.5%; font-size: 10px; color: #555; font-weight: 700; }' +
    'tr.ni td { background: #fff0f0; }' +
    '.notes { margin: 6px 8px; font-size: 12px; }' +
    '.overall { margin: 14px 0; border: 1px solid #333; }' +
    '.overall h3 { margin: 0; padding: 6px 8px; background: #dde7f7; border-bottom: 1px solid #333; font-size: 13px; }' +
    '.overall p { margin: 0; padding: 10px 8px; min-height: 40px; }' +
    '.sigs { width: 100%; border-collapse: collapse; margin-top: 14px; }' +
    '.sigs td { width: 33.3%; vertical-align: top; padding: 6px; }' +
    '.sigbox { height: 56px; display: flex; align-items: flex-end; justify-content: flex-start; }' +
    '.sigbox img { max-height: 52px; max-width: 100%; }' +
    '.sigbox.ns { color: #999; font-size: 11px; align-items: center; }' +
    '.sigline { border-top: 1px solid #333; margin-top: 4px; font-size: 10px; color: #444; }' +
    '.foot { margin-top: 16px; font-size: 9.5px; color: #555; border-top: 1px solid #aaa; padding-top: 5px; }' +
    '@media print { .noprint { display: none; } }' +
    '</style></head><body>' +
    '<div class="head"><h1>' + title + '</h1><p>U.S. AutoForce &bull; Confidential &bull; SAT = Satisfactory | NI = Needs Improvement</p></div>' +
    '<table class="meta"><tr>' +
    '<td class="lbl">DRIVER NAME</td><td>' + esc(r.driverName) + '</td>' +
    '<td class="lbl">DRIVER ID#</td><td>' + esc(r.driverId) + '</td></tr><tr>' +
    '<td class="lbl">EVALUATION DATE</td><td>' + esc(r.evalDate) + '</td>' +
    '<td class="lbl">ASSESSOR / TRAINER</td><td>' + esc(r.assessor) + '</td></tr></table>' +
    areas +
    '<div class="overall"><h3>Overall Performance Notes / Coaching Points</h3><p>' + (r.overallNotes ? esc(r.overallNotes) : '&nbsp;') + '</p></div>' +
    '<table class="sigs"><tr>' +
    '<td><div class="sigbox">' + sigImg(r.driverSig) + '</div><div class="sigline">DRIVER SIGNATURE</div></td>' +
    '<td><div class="sigbox">' + sigImg(r.assessorSig) + '</div><div class="sigline">ASSESSOR SIGNATURE</div></td>' +
    '<td><div class="sigbox"><span style="line-height:52px">' + esc(r.sigDate || r.evalDate || '') + '</span></div><div class="sigline">DATE</div></td>' +
    '</tr></table>' +
    '<div class="foot">U.S. AutoForce &bull; Quarterly Driver Evaluation &bull; Confidential &bull; SAT = Satisfactory | NI = Needs Improvement &bull; Elite GPS for every stop &bull; App pictures show hood open for fluids</div>' +
    '<div class="noprint" style="text-align:center; margin-top:20px"><button onclick="window.print()" style="font-size:16px;padding:10px 24px">Print / Save as PDF</button></div>' +
    '</body></html>';
}

function openPrint(r) {
  const w = window.open('', '_blank');
  if (!w) { toast('Popup blocked. Allow popups for this site.'); return; }
  w.document.open();
  w.document.write(reportHtml(r, 'eval'));
  w.document.close();
}

/* ============================== Render: Quarterly ============================== */

function renderQuarterly() {
  const view = document.getElementById('view');
  view.innerHTML = '';

  const keys = [...new Set(records.map((r) => quarterKey(r.evalDate)))].sort().reverse();
  const selected = keys[0] || quarterKey(todayISO());

  const head = el('div', { class: 'page-head' }, [
    el('h2', { class: 'page-title' }, ['Quarterly Summary']),
  ]);
  view.appendChild(head);

  const qselect = el('div', { class: 'qsel' });
  const sel = el('select', { class: 'qsel-select', onchange: (e) => renderQuarterlyFor(e.target.value) });
  const allKeys = keys.length ? keys : [quarterKey(todayISO())];
  for (const k of allKeys) sel.appendChild(el('option', { value: k }, [k]));
  sel.value = selected;
  qselect.appendChild(sel);
  view.appendChild(qselect);

  const body = el('div');
  view.appendChild(body);
  renderQuarterlyFor(selected, body);
}

function renderQuarterlyFor(key, body) {
  if (!body) body = document.getElementById('view').lastChild;
  body.innerHTML = '';

  const inQuarter = records.filter((r) => quarterKey(r.evalDate) === key);

  if (!inQuarter.length) {
    body.appendChild(el('div', { class: 'empty' }, ['No evaluations in this quarter.']));
    return;
  }

  // Per-driver rollup: count evals, list every NI item that appeared
  const byDriver = new Map();
  for (const r of inQuarter) {
    if (!byDriver.has(r.driverName)) byDriver.set(r.driverName, { evals: [], ni: new Map(), names: new Set() });
    const d = byDriver.get(r.driverName);
    d.evals.push(r);
    d.names.add(r.driverName);
    for (const a of CHECKLIST) {
      for (const it of a.items) {
        if (r.areas[a.id].items[it] === 'NI') d.ni.set(it, (d.ni.get(it) || 0) + 1);
      }
    }
  }

  const summary = el('div', { class: 'q-summary' }, [
    el('div', { class: 'q-stat' }, [el('strong', {}, [String(inQuarter.length)]), el('span', {}, ['evaluations'])]),
    el('div', { class: 'q-stat' }, [el('strong', {}, [String(byDriver.size)]), el('span', {}, ['drivers'])]),
  ]);
  body.appendChild(summary);

  const card = el('div', { class: 'card' });
  for (const [driver, d] of [...byDriver.entries()].sort()) {
    const evalsOfDriver = d.evals;
    const niItems = [...d.ni.entries()].sort((a, b) => b[1] - a[1]);
    card.appendChild(el('div', { class: 'q-driver' }, [
      el('div', { class: 'q-driver-head' }, [
        el('strong', {}, [driver]),
        el('span', {}, [evalsOfDriver.length + ' eval(s)']),
      ]),
      niItems.length
        ? el('ul', { class: 'q-ni' }, niItems.map(([item, n]) => el('li', {}, [item, el('span', { class: 'q-ni-n' }, [n + 'x'])])))
        : el('div', { class: 'q-clean' }, ['No Needs Improvement items recorded.']),
    ]));
  }
  body.appendChild(card);

  body.appendChild(el('div', { class: 'actions', style: 'grid-template-columns:1fr 1fr; margin-top:12px' }, [
    el('button', { class: 'btn primary', onclick: () => printQuarter(key) }, ['Print Quarter (PDF)']),
    el('button', { class: 'btn ghost', onclick: () => exportQuarter(key) }, ['Export (JSON)']),
  ]));
}

function exportQuarter(key) {
  const q = records.filter((r) => quarterKey(r.evalDate) === key);
  if (!q.length) { toast('Nothing in this quarter.'); return; }
  download('evaluations-' + key + '.json', JSON.stringify({ quarter: key, evaluations: q }, null, 2));
}

function printQuarter(key) {
  const q = records.filter((r) => quarterKey(r.evalDate) === key);
  if (!q.length) { toast('Nothing in this quarter.'); return; }

  const byDriver = new Map();
  for (const r of q) {
    if (!byDriver.has(r.driverName)) byDriver.set(r.driverName, { evals: [], ni: new Map() });
    const d = byDriver.get(r.driverName);
    d.evals.push(r);
    for (const a of CHECKLIST) for (const it of a.items) {
      if (r.areas[a.id].items[it] === 'NI') d.ni.set(it, (d.ni.get(it) || 0) + 1);
    }
  }

  const rows = [];
  for (const [driver, d] of [...byDriver.entries()].sort()) {
    rows.push('<section class="area"><h3>' + esc(driver) + ' &mdash; ' + d.evals.length + ' evaluation(s)</h3><table>');
    const niItems = [...d.ni.entries()].sort((a, b) => b[1] - a[1]);
    if (niItems.length) {
      for (const [item, n] of niItems) {
        rows.push('<tr class="ni"><td class="it">' + esc(item) + '</td><td class="mark2" style="width:auto">Needs Improvement &times; ' + n + '</td></tr>');
      }
    } else {
      rows.push('<tr><td class="it">No Needs Improvement items recorded</td><td class="mark2" style="width:auto;color:#167a2e">OK</td></tr>');
    }
    rows.push('</table></section>');
  }

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quarterly Summary ' + esc(key) + '</title><style>' +
    '@page { size: Letter; margin: 14mm 12mm; }' +
    'body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; }' +
    '.head { text-align: center; margin-bottom: 14px; }' +
    '.head h1 { font-size: 20px; margin: 0 0 2px; }' +
    '.head p { margin: 0; font-size: 11px; color: #444; }' +
    '.area { page-break-inside: avoid; margin-bottom: 12px; border: 1px solid #333; }' +
    '.area h3 { margin: 0; padding: 6px 8px; background: #dde7f7; border-bottom: 1px solid #333; font-size: 13px; }' +
    'table { width: 100%; border-collapse: collapse; }' +
    'td { padding: 4px 8px; font-size: 12px; }' +
    'tr + tr td, tr + tr { border-top: 1px solid #ccc; }' +
    'tr.ni td { background: #fff0f0; }' +
    'td.it { width: 70%; }' +
    '.foot { margin-top: 16px; font-size: 9.5px; color: #555; border-top: 1px solid #aaa; padding-top: 5px; }' +
    '</style></head><body>' +
    '<div class="head"><h1>Quarterly Driver Evaluation Summary</h1><p>' + esc(key) + ' &bull; U.S. AutoForce &bull; Confidential</p></div>' +
    rows.join('') +
    '<div class="foot">Needs Improvement items flagged during ' + esc(key) + ' ride-alongs. Use as coaching focus areas.</div>' +
    '</body></html>';

  const w = window.open('', '_blank');
  if (!w) { toast('Popup blocked. Allow popups for this site.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ============================== Navigation ============================== */

function switchView(name) {
  activeView = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'evaluate') renderEvaluate();
  else if (name === 'records') renderRecords();
  else renderQuarterly();
}

/* ============================== Boot ============================== */

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) switchView(tab.dataset.view);
});

window.addEventListener('beforeunload', () => {
  if (current && current.driverName && records.findIndex((r) => r.id === current.id) === -1) {
    records.push(JSON.parse(JSON.stringify(current)));
    persist();
  }
});

initStorage().then(() => {
  renderEvaluate();
  registerSW();
});
