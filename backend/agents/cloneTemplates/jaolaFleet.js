/**
 * 🚚 jaola-fleet — نظام إدارة أسطول مركبات داخلي (track: system).
 *
 * مركبات بسائق معيّن وعداد مسافة، تنبيه استحقاق صيانة عند اقتراب
 * العداد من الحد المحدد، تسجيل عملية صيانة (نوع/تكلفة/عداد) يحدّث
 * موعد الصيانة القادم تلقائياً، إيصال صيانة قابل للطباعة، وتقرير
 * تكاليف. أدوار: مدير أسطول / سائق. بلا اعتماد خارجي.
 * الحالة في localStorage (jfleet_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaFleet() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام إدارة أسطول المركبات</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🚚</span> <span id="brandName">أسطول jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام إدارة أسطول المركبات</h1>
        <p class="hint">مركبات بسائقين · تنبيه استحقاق صيانة · إيصال صيانة قابل للطباعة · تقرير تكاليف.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="manager">مدير أسطول</option><option value="driver">سائق</option></select>
        <label>كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="login">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin».</p>
      </div>
    </section>

    <section id="view-dashboard" class="view hidden">
      <h2>لوحة اليوم</h2>
      <div class="stats" id="dashStats"></div>
      <div class="panel"><h3>🔧 مركبات تستحق صيانة</h3><div id="dueList"></div></div>
    </section>

    <section id="view-vehicles" class="view hidden">
      <div class="view-head"><h2>المركبات</h2></div>
      <div class="panel form-row">
        <input id="vhPlate" placeholder="رقم اللوحة">
        <input id="vhModel" placeholder="الموديل">
        <input id="vhDriver" placeholder="اسم السائق">
        <input id="vhOdo" type="number" placeholder="العداد الحالي (كم)" min="0">
        <button class="btn primary" data-action="addVehicle">إضافة مركبة</button>
      </div>
      <div class="panel"><table class="tbl" id="vehiclesTable"></table></div>
    </section>

    <section id="view-maintenance" class="view hidden">
      <div class="view-head"><h2>تسجيل صيانة</h2></div>
      <div class="panel form-row">
        <select id="mtVehicle"></select>
        <input id="mtType" placeholder="نوع الصيانة (زيت/إطارات...)">
      </div>
      <div class="panel form-row">
        <input id="mtOdo" type="number" placeholder="العداد عند الصيانة" min="0">
        <input id="mtCost" type="number" placeholder="التكلفة" min="0">
        <input id="mtNote" placeholder="ملاحظة">
        <button class="btn primary" data-action="postMaintenance">تسجيل وطباعة الإيصال</button>
      </div>
    </section>

    <section id="view-history" class="view hidden">
      <div class="view-head"><h2>سجل الصيانة</h2></div>
      <div class="panel"><table class="tbl" id="historyTable"></table></div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportMaintenanceCsv">⬇️ سجل الصيانة CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>تكلفة الصيانة آخر ٧ عمليات</h3><div id="costChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم الأسطول</label><input id="stName">
        <label>مسافة فاصل الصيانة (كم)</label><input id="stInterval" type="number" min="500">
        <label>كلمة المرور الجديدة</label><input id="stPass" type="password" placeholder="اتركها فارغة للإبقاء">
        <button class="btn primary" data-action="saveSettings">حفظ الإعدادات</button>
      </div>
    </section>
  </main>
  <div id="printArea" class="print-only"></div>
  <div id="toast" class="toast no-print hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 🚚 نظام أسطول jaola — jaola-fleet */
const SEED_VEHICLES = [
  { id: 'vh1', no: 1, plate: 'أ ب ج 1234', model: 'تويوتا هايلوكس 2022', driver: 'محمد العتيبي', odo: 42000, nextServiceOdo: 45000 },
  { id: 'vh2', no: 2, plate: 'د هـ و 5678', model: 'هيونداي H1 2021', driver: 'سالم القحطاني', odo: 61000, nextServiceOdo: 65000 }
];
const SEED_HISTORY = [
  { id: 'mt1', no: 1, vehicleId: 'vh1', type: 'تغيير زيت', odo: 40000, cost: 180, note: 'زيت + فلتر', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() }
];
function load(k, fb) { try { var v = localStorage.getItem('jfleet_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jfleet_' + k, JSON.stringify(val)); } catch (e) {} }
let vehicles = load('vehicles', SEED_VEHICLES); // { id, no, plate, model, driver, odo, nextServiceOdo }
let history = load('history', SEED_HISTORY); // { id, no, vehicleId, type, odo, cost, note, createdAt }
let settings = load('settings', { name: 'أسطول jaola', pass: 'admin', currency: 'ر.س', interval: 5000, vehicleSeq: 3, maintSeq: 2 });
let session = load('session', null);
let state = { view: 'login' };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function vehicleById(id) { for (var i = 0; i < vehicles.length; i++) if (vehicles[i].id === id) return vehicles[i]; return null; }
function roleLabel(r) { return r === 'manager' ? 'مدير أسطول' : 'سائق'; }
function isDue(v) { return v.odo >= v.nextServiceOdo - 300; }

function login() {
  var role = byId('loginRole').value; var pass = byId('loginPass').value;
  function onOk() {
    show(byId('loginErr'), false); session = { role: role }; save('session', session);
    byId('loginPass').value = ''; toast('أهلاً ' + roleLabel(role)); setView('dashboard');
  }
  function onFail() { show(byId('loginErr'), true); }
  var sync = window.JAOLA_SYNC;
  if (!sync) { if (pass !== settings.pass) return onFail(); return onOk(); }
  fetch(sync.api + '/api/public/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: pass }) })
    .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) onOk(); else onFail(); }).catch(onFail);
}
function logout() { session = null; save('session', null); toast('تم الخروج'); setView('login'); }

function setView(v) {
  if (v !== 'login' && !session) v = 'login';
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs(); renderUserChip();
  if (v === 'dashboard') renderDashboard();
  if (v === 'vehicles') renderVehicles();
  if (v === 'maintenance') renderMaintenance();
  if (v === 'history') renderHistory();
  if (v === 'reports') renderReports();
  if (v === 'settings') { byId('stName').value = settings.name; byId('stInterval').value = settings.interval; byId('stPass').value = ''; }
}
function renderTabs() {
  if (!session) { byId('tabs').innerHTML = ''; return; }
  var tabs = [['dashboard', 'اليوم'], ['vehicles', 'المركبات'], ['maintenance', 'تسجيل صيانة'], ['history', 'سجل الصيانة'], ['reports', 'التقارير'], ['settings', 'الإعدادات']];
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
}
function renderUserChip() {
  byId('userChip').innerHTML = session ? '<span>' + esc(roleLabel(session.role)) + '</span> <button class="btn tiny ghost" data-action="logout">خروج</button>' : '';
}

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var due = vehicles.filter(isDue);
  var thisMonth = new Date().toISOString().slice(0, 7);
  var costMonth = history.filter(function (h) { return h.createdAt.slice(0, 7) === thisMonth; }).reduce(function (s, h) { return s + h.cost; }, 0);
  byId('dashStats').innerHTML =
    statCard('إجمالي المركبات', String(vehicles.length), '') +
    statCard('تستحق صيانة', String(due.length), due.length ? 'warn' : 'ok') +
    statCard('تكلفة الشهر', money(costMonth), 'ok') +
    statCard('عمليات الصيانة', String(history.length), '');
  byId('dueList').innerHTML = due.length ? due.map(function (v) {
    return '<div class="panel"><b>' + esc(v.plate) + '</b> — ' + esc(v.model) + ' <span class="hint">(العداد ' + v.odo + ' / الاستحقاق ' + v.nextServiceOdo + ')</span></div>';
  }).join('') : '<p class="hint">لا مركبات تستحق صيانة حالياً.</p>';
}

function renderVehicles() {
  var rows = vehicles.map(function (v) {
    var due = isDue(v);
    return '<tr><td>#' + v.no + '</td><td>' + esc(v.plate) + '</td><td>' + esc(v.model) + '</td><td>' + esc(v.driver) + '</td><td>' + v.odo + '</td><td>' + (due ? '<span class="badge warn">تستحق صيانة</span>' : '<span class="badge">سليمة</span>') + '</td></tr>';
  }).join('');
  byId('vehiclesTable').innerHTML = '<tr><th>رقم</th><th>اللوحة</th><th>الموديل</th><th>السائق</th><th>العداد</th><th>الحالة</th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا مركبات بعد.</td></tr>');
  fillVehicleSelect();
}
function addVehicle() {
  var plate = byId('vhPlate').value.trim(); var model = byId('vhModel').value.trim(); var driver = byId('vhDriver').value.trim();
  var odo = Math.max(0, parseInt(byId('vhOdo').value, 10) || 0);
  if (!plate || !model) { toast('اكتب رقم اللوحة والموديل'); return; }
  vehicles.push({ id: uid('vh'), no: settings.vehicleSeq++, plate: plate, model: model, driver: driver || '—', odo: odo, nextServiceOdo: odo + settings.interval });
  save('vehicles', vehicles); save('settings', settings);
  byId('vhPlate').value = ''; byId('vhModel').value = ''; byId('vhDriver').value = ''; byId('vhOdo').value = '';
  toast('أُضيفت المركبة'); renderVehicles();
}
function fillVehicleSelect() {
  var sel = byId('mtVehicle'); if (!sel) return;
  sel.innerHTML = vehicles.map(function (v) { return '<option value="' + v.id + '">' + esc(v.plate) + ' — ' + esc(v.model) + '</option>'; }).join('') || '<option value="">أضف مركبة أولاً</option>';
}

function renderMaintenance() { fillVehicleSelect(); }
function postMaintenance() {
  var vId = byId('mtVehicle').value; var v = vehicleById(vId);
  if (!v) { toast('أضف مركبة أولاً'); return; }
  var type = byId('mtType').value.trim(); if (!type) { toast('اكتب نوع الصيانة'); return; }
  var odo = Math.max(v.odo, parseInt(byId('mtOdo').value, 10) || v.odo);
  var cost = Math.max(0, parseFloat(byId('mtCost').value) || 0);
  var note = byId('mtNote').value.trim();
  var rec = { id: uid('mt'), no: settings.maintSeq++, vehicleId: v.id, type: type, odo: odo, cost: cost, note: note, createdAt: new Date().toISOString() };
  history.push(rec); v.odo = odo; v.nextServiceOdo = odo + settings.interval;
  save('history', history); save('vehicles', vehicles); save('settings', settings);
  byId('mtType').value = ''; byId('mtOdo').value = ''; byId('mtCost').value = ''; byId('mtNote').value = '';
  toast('سُجّلت الصيانة #' + rec.no); printMaintenance(rec.id); setView('history');
}
function printMaintenance(id) {
  var r = null; for (var i = 0; i < history.length; i++) if (history[i].id === id) r = history[i];
  if (!r) return; var v = vehicleById(r.vehicleId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>إيصال صيانة #' + r.no + '</span></div><hr>' +
    '<div class="r-row"><span>المركبة</span><span>' + esc(v ? v.plate + ' — ' + v.model : '؟') + '</span></div>' +
    '<div class="r-row"><span>نوع الصيانة</span><span>' + esc(r.type) + '</span></div>' +
    '<div class="r-row"><span>العداد</span><span>' + r.odo + ' كم</span></div>' +
    '<div class="r-row"><span>التكلفة</span><span>' + money(r.cost) + '</span></div><hr>' +
    '<p style="text-align:center">قيادة آمنة 🚚</p></div>';
  window.print();
}

function renderHistory() {
  var rows = history.slice().reverse().map(function (r) {
    var v = vehicleById(r.vehicleId);
    return '<tr><td>#' + r.no + '</td><td>' + esc(v ? v.plate : '؟') + '</td><td>' + esc(r.type) + '</td><td>' + r.odo + '</td><td>' + money(r.cost) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="printMaintenance" data-id="' + r.id + '">🖨️</button></td></tr>';
  }).join('');
  byId('historyTable').innerHTML = '<tr><th>رقم</th><th>المركبة</th><th>النوع</th><th>العداد</th><th>التكلفة</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا عمليات صيانة بعد.</td></tr>');
}

function renderReports() {
  var last7 = history.slice(-7);
  var totalCost = history.reduce(function (s, h) { return s + h.cost; }, 0);
  byId('reportStats').innerHTML =
    statCard('إجمالي المركبات', String(vehicles.length), '') +
    statCard('عمليات الصيانة', String(history.length), '') +
    statCard('إجمالي التكلفة', money(totalCost), 'ok');
  var max = Math.max.apply(null, last7.map(function (h) { return h.cost; }).concat([1]));
  byId('costChart').innerHTML = last7.map(function (h) {
    var v = vehicleById(h.vehicleId);
    var hpct = Math.round((h.cost / max) * 100);
    return '<div class="bar-col"><div class="bar" style="height:' + hpct + '%" title="' + money(h.cost) + '"></div><span class="bar-label">' + esc(v ? v.plate : '؟') + '</span></div>';
  }).join('') || '<p class="hint">لا بيانات كافية بعد.</p>';
}
function exportMaintenanceCsv() {
  var rows = [['#', 'المركبة', 'النوع', 'العداد', 'التكلفة', 'التاريخ']];
  history.forEach(function (r) { var v = vehicleById(r.vehicleId); rows.push([r.no, v ? v.plate : '', r.type, r.odo, r.cost, r.createdAt.slice(0, 10)]); });
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fleet-maintenance.csv'; a.click();
  toast('صُدّر سجل الصيانة CSV');
}

function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  settings.interval = Math.max(500, parseInt(byId('stInterval').value, 10) || settings.interval);
  var np = byId('stPass').value.trim();
  if (np) { var sync = window.JAOLA_SYNC; if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np }) }).catch(function () {}); } else settings.pass = np; }
  save('settings', settings); byId('brandName').textContent = settings.name;
  toast('تم حفظ الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addVehicle': addVehicle(); break;
    case 'postMaintenance': postMaintenance(); break;
    case 'printMaintenance': printMaintenance(a.dataset.id); break;
    case 'exportMaintenanceCsv': exportMaintenanceCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() {
  byId('brandName').textContent = settings.name;
  document.addEventListener('click', handleClick);
  setView(session ? 'dashboard' : 'login');
}
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.badge{background:#1e293b;border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:11px;color:#c7d2fe}
.badge.warn{background:#78350f;color:#fde68a}
.bar-col{display:inline-flex;flex-direction:column;align-items:center;gap:6px;width:12%;vertical-align:bottom}
`;

    return {
        id: 'jaola-fleet',
        track: 'system',
        category: 'system',
        name: 'نظام إدارة أسطول مركبات',
        nameEn: 'Fleet Maintenance Management',
        description: 'سيستم أسطول مركبات داخلي: مركبات بسائق معيّن وعداد مسافة، تنبيه استحقاق صيانة عند اقتراب العداد من الحد المحدد، تسجيل عملية صيانة تحدّث موعد الصيانة القادم تلقائياً، إيصال صيانة قابل للطباعة، وتقرير تكاليف — بأدوار (مدير أسطول/سائق).',
        descriptionEn: 'Internal vehicle fleet system: vehicles with an assigned driver and odometer, maintenance-due alerts as the odometer approaches the set threshold, logging a service that auto-updates the next due mileage, a printable service receipt, and a cost report — with roles (fleet manager/driver).',
        keywords: ['أسطول مركبات', 'إدارة أسطول', 'صيانة مركبات', 'صيانة سيارات الشركة', 'عداد المسافة', 'استحقاق صيانة', 'سجل صيانة', 'fleet management', 'vehicle fleet', 'fleet maintenance', 'odometer', 'company vehicles'],
        model: {
            roles: [{ name: 'مدير أسطول' }, { name: 'سائق' }],
            entities: [{ name: 'مركبة' }, { name: 'عملية صيانة' }],
            flows: [{ name: 'تسجيل مركبة بسائق وعداد' }, { name: 'تنبيه استحقاق الصيانة' }, { name: 'تسجيل عملية صيانة وطباعة إيصالها' }, { name: 'تقرير تكاليف الصيانة' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
