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
      'GPS used for every stop (Elite GPS)',
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
    id: 'post-trip',
    num: '6',
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

/* ============================== Driver Roster (shared) ============================== */
// usaf_roster_db / usaf_roster_v1 — the SAME IndexedDB all six AutoForce apps read,
// so a driver profile added in the Driver Hub autofills here too.
const ROSTER_DB = 'usaf_roster_db';
const ROSTER_KEY = 'usaf_roster_v1';
let roster = [];

function rosterOpen() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(ROSTER_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) { reject(e); }
  });
}

async function rosterGet() {
  try {
    const db = await rosterOpen();
    return await new Promise((resolve) => {
      const req = db.transaction('kv', 'readonly').objectStore('kv').get(ROSTER_KEY);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) { return []; }
}

function rosterPut(list) {
  const snapshot = JSON.parse(JSON.stringify(list));
  if (canIdb) {
    return rosterOpen().then((db) => new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(snapshot, ROSTER_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    })).catch(() => {});
  }
  try { localStorage.setItem(ROSTER_DB + ':' + ROSTER_KEY, JSON.stringify(snapshot)); } catch (e) {}
  return Promise.resolve();
}

function rosterFind(name) {
  const n = String(name || '').trim().toLowerCase();
  return roster.find((r) => String(r.name || '').trim().toLowerCase() === n) || null;
}

function rosterUpsert(entry) {
  const name = String((entry && entry.name) || '').trim();
  if (!name) return;
  const existing = rosterFind(name);
  if (existing) {
    for (const k of ['license', 'warehouse', 'hireDate', 'trainer']) {
      const v = String((entry && entry[k]) || '').trim();
      if (v) existing[k] = v;
    }
  } else {
    roster.push({
      name,
      license: String((entry && entry.license) || '').trim(),
      warehouse: String((entry && entry.warehouse) || '').trim(),
      hireDate: String((entry && entry.hireDate) || '').trim(),
      trainer: String((entry && entry.trainer) || '').trim(),
    });
  }
  rosterPut(roster);
}

function ensureRosterDatalist() {
  let dl = document.getElementById('roster-names');
  if (!dl) {
    dl = el('datalist', { id: 'roster-names' });
    document.body.appendChild(dl);
  }
  dl.innerHTML = '';
  for (const r of roster) dl.appendChild(el('option', { value: r.name }));
  return dl;
}

function rosterField(labelText, id, value, fields, extra = {}) {
  const input = el('input', { type: 'text', id, value, list: 'roster-names', autocomplete: 'off', ...extra });
  const fill = () => {
    const r = rosterFind(input.value);
    if (!r) return;
    for (const [fid, prop] of Object.entries(fields)) {
      const n = document.getElementById(fid);
      if (n && !n.value) n.value = r[prop] || '';
    }
  };
  input.addEventListener('input', fill);
  input.addEventListener('change', fill);
  return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, [labelText]), input]);
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
    warehouse: '',
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
  ensureRosterDatalist();
  const form = el('form', { id: 'eval-form' });

  form.appendChild(el('section', { class: 'card info-card' }, [
    el('h2', { class: 'card-title' }, ['Driver Information']),
    rosterField('Driver Name', 'driverName', current.driverName, { driverId: 'license', warehouse: 'warehouse', assessor: 'trainer' }, { required: true }),
    field('Driver ID# / Lic.#', 'driverId', 'text', current.driverId),
    field('Warehouse / Location', 'warehouse', 'text', current.warehouse),
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
  current.warehouse = formValue('warehouse');
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
  rosterUpsert({ name: current.driverName, license: current.driverId, warehouse: current.warehouse, trainer: current.assessor });
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

const AF_LOGO = 'data:image/jpeg;base64,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';

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
    '<div style="margin-bottom:12px;border-bottom:2px solid #1d4ed8;padding-bottom:8px"><img src="' + AF_LOGO + '" style="height:44px;width:auto;border-radius:6px" alt="U.S. AutoForce"></div>' +
    '<div class="head"><h1>' + title + '</h1><p>U.S. AutoForce &bull; Confidential &bull; SAT = Satisfactory | NI = Needs Improvement</p></div>' +
    '<table class="meta"><tr>' +
    '<td class="lbl">DRIVER NAME</td><td>' + esc(r.driverName) + '</td>' +
    '<td class="lbl">DRIVER ID#</td><td>' + esc(r.driverId) + '</td></tr><tr>' +
    '<td class="lbl">EVALUATION DATE</td><td>' + esc(r.evalDate) + '</td>' +
    '<td class="lbl">ASSESSOR / TRAINER</td><td>' + esc(r.assessor) + '</td></tr>' +
    (r.warehouse ? '<tr><td class="lbl">WAREHOUSE / LOCATION</td><td>' + esc(r.warehouse) + '</td></tr>' : '') +
    '</table>' +
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
    '<div style="margin-bottom:12px;border-bottom:2px solid #1d4ed8;padding-bottom:8px"><img src="' + AF_LOGO + '" style="height:44px;width:auto;border-radius:6px" alt="U.S. AutoForce"></div>' +
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
