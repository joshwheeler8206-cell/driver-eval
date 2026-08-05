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

let records = loadRecords();
let current = null; // evaluation object being edited
let activeView = 'evaluate';

/* ============================== Storage ============================== */

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(records));
  } catch (e) {
    toast('Storage is full. Try exporting and deleting old records.');
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

  body.appendChild(el('button', { class: 'btn primary', onclick: () => exportQuarter(key) }, ['Export Quarter (JSON)']));
}

function exportQuarter(key) {
  const q = records.filter((r) => quarterKey(r.evalDate) === key);
  if (!q.length) { toast('Nothing in this quarter.'); return; }
  download('evaluations-' + key + '.json', JSON.stringify({ quarter: key, evaluations: q }, null, 2));
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

renderEvaluate();
registerSW();
