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

const AF_LOGO = 'data:image/png;base64,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';

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
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;border-bottom:2px solid #1d4ed8;padding-bottom:8px"><img src="' + AF_LOGO + '" width="40" height="40" style="border-radius:9px" alt="U.S. AutoForce"><div style="font-size:10px;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase;color:#1d4ed8">U.S. AutoForce</div></div>' +
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
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;border-bottom:2px solid #1d4ed8;padding-bottom:8px"><img src="' + AF_LOGO + '" width="40" height="40" style="border-radius:9px" alt="U.S. AutoForce"><div style="font-size:10px;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase;color:#1d4ed8">U.S. AutoForce</div></div>' +
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

/* ============================== Render: Scorecard / Trends ============================== */

function driverStats(name) {
  const evals = records.filter((r) => r.driverName === name);
  const perArea = {};
  const ni = new Map();
  let sat = 0, rated = 0;
  for (const r of evals) {
    for (const a of CHECKLIST) {
      if (!perArea[a.id]) perArea[a.id] = { sat: 0, rated: 0 };
      for (const it of a.items) {
        const v = r.areas[a.id] && r.areas[a.id].items[it];
        if (v === 'SAT') { sat++; rated++; perArea[a.id].sat++; perArea[a.id].rated++; }
        else if (v === 'NI') { rated++; perArea[a.id].rated++; ni.set(it, (ni.get(it) || 0) + 1); }
      }
    }
  }
  return { evals, sat, rated, pct: rated ? Math.round((sat / rated) * 100) : null, ni, perArea };
}

function quarterSeries(name) {
  const byQ = new Map();
  for (const r of records) {
    if (r.driverName !== name) continue;
    const q = quarterKey(r.evalDate);
    if (!byQ.has(q)) byQ.set(q, { sat: 0, rated: 0 });
    for (const a of CHECKLIST) {
      for (const it of a.items) {
        const v = r.areas[a.id] && r.areas[a.id].items[it];
        if (v === 'SAT') { byQ.get(q).sat++; byQ.get(q).rated++; }
        else if (v === 'NI') byQ.get(q).rated++;
      }
    }
  }
  return [...byQ.entries()].sort().map(([q, d]) => ({ q, pct: d.rated ? Math.round((d.sat / d.rated) * 100) : null, rated: d.rated }));
}

function qShort(key) {
  const [y, q] = key.split('-');
  return String(y).slice(2) + ' Q' + q;
}

function trendSvg(series) {
  const W = 320, H = 130, padL = 26, padR = 8, padT = 10, padB = 22;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = series.length;
  const x = (i) => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = (pct) => padT + ih - (pct / 100) * ih;
  let grid = '';
  for (const g of [0, 50, 100]) grid += '<line x1="' + padL + '" y1="' + y(g).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y(g).toFixed(1) + '" stroke="#e5e7eb" stroke-width="1"/>';
  const pts = series.map((s, i) => x(i).toFixed(1) + ',' + y(s.pct).toFixed(1));
  let extras = '';
  series.forEach((s, i) => {
    const cx = x(i).toFixed(1), cy = y(s.pct).toFixed(1);
    extras += '<circle cx="' + cx + '" cy="' + cy + '" r="3.2" fill="#1d4ed8"/>' +
      '<text x="' + cx + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#6b7280">' + esc(qShort(s.q)) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' + grid +
    '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#1d4ed8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    extras + '</svg>';
}

function renderTrends() {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const drivers = [...new Set(records.map((r) => r.driverName).filter(Boolean))].sort();
  view.appendChild(el('div', { class: 'page-head' }, [el('h2', { class: 'page-title' }, ['Driver Scorecard & Trends'])]));
  if (!drivers.length) {
    view.appendChild(el('div', { class: 'empty' }, ['No evaluations yet. Complete ride-alongs to build scorecards.']));
    return;
  }
  const selWrap = el('div', { class: 'sc-sel' });
  const sel = el('select', { onchange: (e) => renderScorecardFor(e.target.value) });
  for (const d of drivers) sel.appendChild(el('option', { value: d }, [d]));
  selWrap.appendChild(sel);
  view.appendChild(selWrap);
  const body = el('div');
  view.appendChild(body);
  renderScorecardFor(drivers[0], body);
}

function renderScorecardFor(name, body) {
  if (!body) body = document.getElementById('view').lastChild;
  body.innerHTML = '';
  const st = driverStats(name);
  if (!st.rated) {
    body.appendChild(el('div', { class: 'empty' }, ['No rated items for this driver yet.']));
    return;
  }

  body.appendChild(el('div', { class: 'sc-summary' }, [
    el('div', { class: 'sc-stat' }, [el('strong', {}, [st.pct + '%']), el('span', {}, ['SAT overall'])]),
    el('div', { class: 'sc-stat' }, [el('strong', {}, [String(st.evals.length)]), el('span', {}, ['evaluations'])]),
    el('div', { class: 'sc-stat' }, [el('strong', {}, [String(st.ni.size)]), el('span', {}, ['distinct NI items'])]),
  ]));

  const series = quarterSeries(name);
  body.appendChild(el('div', { class: 'sc-card sc-chart' }, [
    el('h3', {}, ['SAT % by Quarter']),
    el('div', { html: trendSvg(series) }),
    el('div', { class: 'sc-chart-note' }, ['Share of items rated Satisfactory per ride-along quarter.']),
  ]));

  const catCard = el('div', { class: 'sc-card' }, [el('h3', {}, ['Category Breakdown (SAT %)'])]);
  let minPct = 101, minArea = null;
  for (const a of CHECKLIST) {
    const p = st.perArea[a.id];
    if (!p || !p.rated) continue;
    const pct = Math.round((p.sat / p.rated) * 100);
    if (pct < minPct) { minPct = pct; minArea = a.title; }
    const cls = pct < 70 ? 'bad' : pct < 85 ? 'warn' : '';
    catCard.appendChild(el('div', { class: 'sc-cat' }, [
      el('div', { class: 'sc-cat-head' }, [
        el('span', {}, [a.num + '. ' + a.title]),
        el('span', { class: 'sc-cat-n ' + (cls || '') }, [pct + '%']),
      ]),
      el('div', { class: 'sc-cat-bar' }, [el('div', { class: 'sc-cat-fill ' + (cls || ''), style: 'width:' + pct + '%' })]),
    ]));
  }
  body.appendChild(catCard);

  const focus = el('div', { class: 'sc-card' }, [el('h3', {}, ['Coaching Focus for Next Ride-Along'])]);
  const sorted = [...st.ni.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    focus.appendChild(el('div', { class: 'sc-clean' }, ['No NI items flagged — keep doing what you are doing.']));
  } else {
    focus.appendChild(el('ul', { class: 'sc-focus' }, sorted.map(([item, n]) => el('li', {}, [item, el('span', { class: 'n' }, [n + 'x'])]))));
  }
  body.appendChild(focus);

  if (minArea && minPct < 85) {
    body.appendChild(el('div', { class: 'card', style: 'border-left:4px solid var(--red)' }, [
      el('strong', {}, ['Lowest category: ' + minArea]),
      el('div', { class: 'sc-chart-note' }, [minPct + '% SAT — make this the focus of the next ride-along.']),
    ]));
  }

  body.appendChild(el('button', { class: 'btn primary big', style: 'width:100%', onclick: () => openScorecardPrint(name) }, ['🖨️ Print / Save PDF']));
}

function openScorecardPrint(name) {
  const st = driverStats(name);
  const series = quarterSeries(name);
  let catRows = '';
  for (const a of CHECKLIST) {
    const p = st.perArea[a.id];
    if (!p || !p.rated) continue;
    const pct = Math.round((p.sat / p.rated) * 100);
    catRows += '<tr><td>' + a.num + '. ' + esc(a.title) + '</td><td>' + pct + '%</td><td>' + p.sat + '/' + p.rated + '</td></tr>';
  }
  const focusItems = [...st.ni.entries()].sort((a, b) => b[1] - a[1]);
  const focusRows = focusItems.length
    ? focusItems.map(([it, n]) => '<tr><td>' + esc(it) + '</td><td>' + n + '</td></tr>').join('')
    : '<tr><td colspan="2">No Needs Improvement items flagged.</td></tr>';
  const trendRows = series.length
    ? series.map((s) => '<tr><td>' + qShort(s.q) + '</td><td>' + s.pct + '%</td><td>' + s.rated + ' rated</td></tr>').join('')
    : '<tr><td colspan="3">No rated data.</td></tr>';

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Scorecard ' + esc(name) + '</title><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}' +
    'h1{margin:0;font-size:22px}.sub{color:#555;font-size:12px;margin:4px 0 18px}' +
    'h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #ccc;padding-bottom:3px}' +
    'table{width:100%;border-collapse:collapse;font-size:12px}' +
    'th,td{border:1px solid #999;padding:6px 8px;text-align:left}' +
    'th{background:#eee}' +
    '.big{font-size:20px;font-weight:700;color:#1d4ed8}' +
    '.foot{margin-top:30px;display:flex;gap:60px}' +
    '.sig{width:230px;border-top:1px solid #333;padding-top:4px;font-size:11px}' +
    '</style></head><body>' +
    '<h1>Driver Scorecard</h1>' +
    '<div class="sub">' + esc(name) + ' &bull; Overall SAT ' + st.pct + '% &bull; ' + st.evals.length + ' evaluation(s), ' + st.rated + ' rated items &bull; Generated for next ride-along</div>' +
    '<h2>SAT % Trend by Quarter</h2><table><tr><th>Quarter</th><th>SAT %</th><th>Rated</th></tr>' + trendRows + '</table>' +
    '<h2>Category Breakdown</h2><table><tr><th>Category</th><th>SAT %</th><th>SAT/Rated</th></tr>' + catRows + '</table>' +
    '<h2>Coaching Focus Items</h2><table><tr><th>Item</th><th>Times Flagged</th></tr>' + focusRows + '</table>' +
    '<div class="foot"><div class="sig">Assessor / Trainer Signature</div><div class="sig">Date</div></div>' +
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
  else if (name === 'trends') renderTrends();
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
