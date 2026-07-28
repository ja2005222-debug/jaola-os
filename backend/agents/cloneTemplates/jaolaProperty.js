/**
 * 🏢 jaola-property — نظام إدارة عقارات وإيجارات داخلي (track: system).
 *
 * وحدات بحالة (شاغرة/مؤجّرة)، مستأجرون بعقود (بداية/نهاية/إيجار شهري)،
 * تحصيل دفعات إيجار بإيصال مطبوع، تنبيه استحقاق/تأخّر، تقارير تحصيل.
 * أدوار: مالك / محاسب. بلا اعتماد خارجي. الحالة في localStorage (jprop_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaProperty() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام إدارة العقارات</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🏢</span> <span id="brandName">عقارات jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام إدارة العقارات</h1>
        <p class="hint">وحدات · عقود · تحصيل إيجار · تنبيه استحقاق · تقارير.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="owner">المالك</option><option value="accountant">المحاسب</option></select>
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
      <div class="panel"><h3>⏳ إيجارات مستحقّة/متأخّرة</h3><div id="dueRents"></div></div>
    </section>

    <section id="view-units" class="view hidden">
      <div class="view-head"><h2>الوحدات</h2></div>
      <div class="panel form-row">
        <input id="unName" placeholder="اسم/رقم الوحدة">
        <input id="unType" placeholder="النوع (شقة/محل/مكتب)">
        <input id="unRent" type="number" placeholder="الإيجار الشهري" min="0">
        <button class="btn primary" data-action="addUnit">إضافة وحدة</button>
      </div>
      <div class="panel"><table class="tbl" id="unitsTable"></table></div>
    </section>

    <section id="view-tenants" class="view hidden">
      <div class="view-head"><h2>المستأجرون والعقود</h2></div>
      <div class="panel form-row">
        <input id="tnName" placeholder="اسم المستأجر">
        <input id="tnPhone" placeholder="الهاتف">
        <select id="tnUnit"></select>
        <input id="tnStart" type="date" title="بداية العقد">
        <input id="tnMonths" type="number" placeholder="مدة العقد (شهر)" min="1">
        <button class="btn primary" data-action="addTenant">إنشاء عقد</button>
      </div>
      <div class="panel"><table class="tbl" id="tenantsTable"></table></div>
    </section>

    <section id="view-payments" class="view hidden">
      <div class="view-head"><h2>تحصيل الإيجار</h2></div>
      <div class="panel form-row">
        <select id="pyContract"></select>
        <input id="pyAmount" type="number" placeholder="المبلغ" min="0" step="0.01">
        <input id="pyForMonth" type="month" title="عن شهر">
        <button class="btn primary" data-action="collectRent">تحصيل وإصدار إيصال</button>
      </div>
      <div class="panel"><table class="tbl" id="paymentsTable"></table></div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportPaymentsCsv">⬇️ التحصيل CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>تحصيل آخر ٦ أشهر</h3><div id="collectChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم المكتب</label><input id="stName">
        <label>العملة</label><input id="stCurrency">
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

    const APP_JS = `/* 🏢 نظام إدارة العقارات — jaola-property */
const SEED_UNITS = [
  { id: 'u1', name: 'شقة 101', type: 'شقة', rent: 2500, tenantId: null },
  { id: 'u2', name: 'محل A', type: 'محل', rent: 4000, tenantId: null },
  { id: 'u3', name: 'مكتب 3', type: 'مكتب', rent: 3200, tenantId: null }
];
const ROLES = {
  owner: { name: 'المالك', tabs: ['dashboard', 'units', 'tenants', 'payments', 'reports', 'settings'] },
  accountant: { name: 'المحاسب', tabs: ['dashboard', 'payments', 'reports'] }
};
const TAB_LABELS = { dashboard: 'اللوحة', units: 'الوحدات', tenants: 'المستأجرون', payments: 'التحصيل', reports: 'التقارير', settings: 'الإعدادات' };

function load(k, fb) { try { var v = localStorage.getItem('jprop_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jprop_' + k, JSON.stringify(val)); } catch (e) {} }
let units = load('units', SEED_UNITS);
let contracts = load('contracts', []); // { id, tenant, phone, unitId, rent, start, months }
let payments = load('payments', []);   // { id, no, contractId, amount, forMonth, date }
let settings = load('settings', { name: 'مكتب jaola العقاري', currency: 'ر.س', pass: 'admin', receiptSeq: 1 });
let state = { user: null, view: 'login' };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return today().slice(0, 7); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function unitById(id) { for (var i = 0; i < units.length; i++) if (units[i].id === id) return units[i]; return null; }
function contractById(id) { for (var i = 0; i < contracts.length; i++) if (contracts[i].id === id) return contracts[i]; return null; }
function paidForMonth(cid, mo) { for (var i = 0; i < payments.length; i++) if (payments[i].contractId === cid && payments[i].forMonth === mo) return true; return false; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'dashboard') renderDashboard();
  if (v === 'units') renderUnits();
  if (v === 'tenants') renderTenants();
  if (v === 'payments') renderPayments();
  if (v === 'reports') renderReports();
  if (v === 'settings') renderSettings();
}
function renderTabs() {
  var el = byId('tabs');
  if (!state.user) { el.innerHTML = ''; byId('userChip').innerHTML = ''; return; }
  el.innerHTML = ROLES[state.user.role].tabs.map(function (id) {
    return '<button class="tab ' + (state.view === id ? 'active' : '') + '" data-action="tab" data-view="' + id + '">' + TAB_LABELS[id] + '</button>';
  }).join('');
  byId('userChip').innerHTML = '👤 ' + ROLES[state.user.role].name + ' <button class="btn tiny ghost" data-action="logout">خروج</button>';
}
function login() {
  var role = byId('loginRole').value; var pass = byId('loginPass').value;
  function onOk() { show(byId('loginErr'), false); state.user = { role: role }; toast('مرحباً ' + ROLES[role].name); setView('dashboard'); }
  function onFail() { show(byId('loginErr'), true); }
  var sync = window.JAOLA_SYNC;
  if (!sync) { if (pass !== settings.pass) return onFail(); return onOk(); }
  fetch(sync.api + '/api/public/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: pass }) })
    .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) onOk(); else onFail(); }).catch(onFail);
}
function logout() { state.user = null; setView('login'); }

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var mo = thisMonth();
  var occupied = units.filter(function (u) { return u.tenantId; }).length;
  var due = contracts.filter(function (c) { return !paidForMonth(c.id, mo); });
  var mCollected = 0; for (var i = 0; i < payments.length; i++) if (payments[i].forMonth === mo) mCollected += payments[i].amount;
  byId('dashStats').innerHTML =
    statCard('إجمالي الوحدات', String(units.length), '') +
    statCard('مؤجّرة', String(occupied) + ' / ' + units.length, 'ok') +
    statCard('تحصيل الشهر', money(mCollected), 'ok') +
    statCard('مستحقّة هذا الشهر', String(due.length), due.length ? 'warn' : '');
  byId('dueRents').innerHTML = due.length ? due.map(function (c) {
    var u = unitById(c.unitId);
    return '<div class="low-row">⏳ <b>' + esc(c.tenant) + '</b> — ' + esc(u ? u.name : '؟') + ' · ' + money(c.rent) + ' عن ' + mo + '</div>';
  }).join('') : '<p class="hint">كل إيجارات الشهر محصّلة ✅</p>';
}

function renderUnits() {
  var rows = units.map(function (u) {
    var t = u.tenantId ? contractById(u.tenantId) : null;
    return '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.type) + '</td><td>' + money(u.rent) + '</td>' +
      '<td>' + (t ? '<span style="color:var(--ok)">مؤجّرة — ' + esc(t.tenant) + '</span>' : '<span class="hint">شاغرة</span>') + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delUnit" data-id="' + u.id + '">حذف</button></td></tr>';
  }).join('');
  byId('unitsTable').innerHTML = '<tr><th>الوحدة</th><th>النوع</th><th>الإيجار</th><th>الحالة</th><th></th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا وحدات بعد.</td></tr>');
}
function addUnit() {
  var name = byId('unName').value.trim(); if (!name) { toast('اكتب اسم الوحدة'); return; }
  units.push({ id: uid('u'), name: name, type: byId('unType').value.trim() || 'شقة', rent: Math.max(0, parseFloat(byId('unRent').value) || 0), tenantId: null });
  save('units', units); byId('unName').value = ''; byId('unType').value = ''; byId('unRent').value = '';
  toast('أُضيفت الوحدة'); renderUnits();
}
function delUnit(id) { units = units.filter(function (u) { return u.id !== id; }); contracts = contracts.filter(function (c) { return c.unitId !== id; }); save('units', units); save('contracts', contracts); renderUnits(); }

function fillUnitSelect() {
  var vacant = units.filter(function (u) { return !u.tenantId; });
  var el = byId('tnUnit'); if (el) el.innerHTML = vacant.length ? vacant.map(function (u) { return '<option value="' + u.id + '">' + esc(u.name) + ' — ' + money(u.rent) + '</option>'; }).join('') : '<option value="">لا وحدات شاغرة</option>';
}
function fillContractSelect() {
  var el = byId('pyContract'); if (!el) return;
  el.innerHTML = contracts.map(function (c) { var u = unitById(c.unitId); return '<option value="' + c.id + '">' + esc(c.tenant) + ' — ' + esc(u ? u.name : '؟') + ' (' + money(c.rent) + ')</option>'; }).join('');
}
function renderTenants() {
  fillUnitSelect();
  var rows = contracts.map(function (c) {
    var u = unitById(c.unitId);
    return '<tr><td>' + esc(c.tenant) + '</td><td>' + esc(c.phone || '—') + '</td><td>' + esc(u ? u.name : '؟') + '</td><td>' + money(c.rent) + '</td><td>' + c.start + ' (' + c.months + ' شهر)</td>' +
      '<td><button class="btn tiny ghost" data-action="endContract" data-id="' + c.id + '">إنهاء</button></td></tr>';
  }).join('');
  byId('tenantsTable').innerHTML = '<tr><th>المستأجر</th><th>الهاتف</th><th>الوحدة</th><th>الإيجار</th><th>العقد</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا عقود بعد.</td></tr>');
}
function addTenant() {
  var name = byId('tnName').value.trim(); var unitId = byId('tnUnit').value;
  if (!name || !unitId) { toast('اكتب الاسم واختر وحدة شاغرة'); return; }
  var u = unitById(unitId); if (!u || u.tenantId) { toast('الوحدة غير متاحة'); return; }
  var c = { id: uid('c'), tenant: name, phone: byId('tnPhone').value.trim(), unitId: unitId, rent: u.rent, start: byId('tnStart').value || today(), months: Math.max(1, parseInt(byId('tnMonths').value, 10) || 12) };
  contracts.push(c); u.tenantId = c.id;
  save('contracts', contracts); save('units', units);
  byId('tnName').value = ''; byId('tnPhone').value = ''; byId('tnMonths').value = '';
  toast('أُنشئ العقد'); renderTenants();
}
function endContract(id) {
  var c = contractById(id); if (!c) return;
  var u = unitById(c.unitId); if (u) u.tenantId = null;
  contracts = contracts.filter(function (x) { return x.id !== id; });
  save('contracts', contracts); save('units', units); toast('أُنهي العقد'); renderTenants();
}

function renderPayments() {
  fillContractSelect();
  byId('pyForMonth').value = byId('pyForMonth').value || thisMonth();
  var rows = payments.slice().reverse().slice(0, 60).map(function (p) {
    var c = contractById(p.contractId);
    return '<tr><td>#' + p.no + '</td><td>' + p.date + '</td><td>' + esc(c ? c.tenant : '؟') + '</td><td>' + p.forMonth + '</td><td>' + money(p.amount) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="printReceipt" data-id="' + p.id + '">🖨️ الإيصال</button></td></tr>';
  }).join('');
  byId('paymentsTable').innerHTML = '<tr><th>رقم</th><th>التاريخ</th><th>المستأجر</th><th>عن شهر</th><th>المبلغ</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا تحصيل بعد.</td></tr>');
}
function collectRent() {
  var cid = byId('pyContract').value; var c = contractById(cid); if (!c) { toast('اختر العقد'); return; }
  var mo = byId('pyForMonth').value || thisMonth();
  if (paidForMonth(cid, mo)) { toast('محصّل بالفعل عن ' + mo); return; }
  var amount = parseFloat(byId('pyAmount').value) || c.rent;
  var p = { id: uid('p'), no: settings.receiptSeq++, contractId: cid, amount: amount, forMonth: mo, date: today() };
  payments.push(p); save('payments', payments); save('settings', settings);
  byId('pyAmount').value = '';
  toast('حُصّل الإيجار #' + p.no); printReceipt(p.id); renderPayments();
}
function printReceipt(id) {
  var p = null; for (var i = 0; i < payments.length; i++) if (payments[i].id === id) p = payments[i];
  if (!p) return; var c = contractById(p.contractId); var u = c ? unitById(c.unitId) : null;
  byId('printArea').innerHTML = '<div class="inv"><h1>' + esc(settings.name) + '</h1>' +
    '<div class="inv-meta"><span>إيصال إيجار #' + p.no + '</span><span>' + p.date + '</span></div>' +
    '<p><b>المستأجر:</b> ' + esc(c ? c.tenant : '؟') + '</p>' +
    '<p><b>الوحدة:</b> ' + esc(u ? u.name : '؟') + '</p>' +
    '<p><b>عن شهر:</b> ' + p.forMonth + '</p>' +
    '<p class="inv-total">المبلغ المحصّل: ' + money(p.amount) + '</p>' +
    '<p class="inv-foot">شكراً لالتزامكم</p></div>';
  window.print();
}

function renderReports() {
  var mo = thisMonth(); var mColl = 0; for (var i = 0; i < payments.length; i++) if (payments[i].forMonth === mo) mColl += payments[i].amount;
  var potential = 0; for (var j = 0; j < contracts.length; j++) potential += contracts[j].rent;
  byId('reportStats').innerHTML =
    statCard('تحصيل الشهر', money(mColl), 'ok') +
    statCard('الإيجار المتوقّع', money(potential), '') +
    statCard('نسبة الإشغال', (units.length ? Math.round(units.filter(function (u) { return u.tenantId; }).length / units.length * 100) : 0) + '%', '') +
    statCard('إجمالي العقود', String(contracts.length), '');
  var data = [];
  for (var m = 5; m >= 0; m--) { var d = new Date(); d.setMonth(d.getMonth() - m); var mk = d.toISOString().slice(0, 7); var r = 0; for (var k = 0; k < payments.length; k++) if (payments[k].forMonth === mk) r += payments[k].amount; data.push({ label: mk.slice(2), value: r }); }
  byId('collectChart').innerHTML = barChart(data, 160);
}
function barChart(data, h) {
  var max = 1; for (var i = 0; i < data.length; i++) if (data[i].value > max) max = data[i].value;
  var bw = Math.floor(100 / data.length);
  return '<svg viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px">' +
    data.map(function (d, i) { var bh = Math.round((d.value / max) * (h - 30)); var x = i * bw; return '<g><rect x="' + (x + 2) + '%" y="' + (h - 20 - bh) + '" width="' + (bw - 4) + '%" height="' + bh + '" rx="3" class="bar"></rect><text x="' + (x + bw / 2) + '%" y="' + (h - 6) + '" class="bar-label">' + d.label + '</text></g>'; }).join('') + '</svg>';
}
function csvDownload(name, rows) {
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function exportPaymentsCsv() {
  var rows = [['رقم', 'التاريخ', 'المستأجر', 'عن شهر', 'المبلغ']];
  for (var i = 0; i < payments.length; i++) { var c = contractById(payments[i].contractId); rows.push([payments[i].no, payments[i].date, c ? c.tenant : '', payments[i].forMonth, payments[i].amount]); }
  csvDownload('payments.csv', rows); toast('صُدّر التحصيل CSV');
}

function renderSettings() { byId('stName').value = settings.name; byId('stCurrency').value = settings.currency; byId('stPass').value = ''; }
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  settings.currency = byId('stCurrency').value.trim() || settings.currency;
  var np = byId('stPass').value.trim();
  if (np) { var sync = window.JAOLA_SYNC; if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np }) }).catch(function () {}); } else settings.pass = np; }
  save('settings', settings); byId('brandName').textContent = settings.name; toast('حُفظت الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addUnit': addUnit(); break;
    case 'delUnit': delUnit(a.dataset.id); break;
    case 'addTenant': addTenant(); break;
    case 'endContract': endContract(a.dataset.id); break;
    case 'collectRent': collectRent(); break;
    case 'printReceipt': printReceipt(a.dataset.id); break;
    case 'exportPaymentsCsv': exportPaymentsCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    return {
        id: 'jaola-property',
        track: 'system',
        category: 'system',
        name: 'نظام إدارة عقارات',
        nameEn: 'Property Manager',
        description: 'سيستم إدارة عقارات وإيجارات داخلي: وحدات بحالة (شاغرة/مؤجّرة)، مستأجرون بعقود، تحصيل دفعات إيجار بإيصال مطبوع، تنبيه استحقاق/تأخّر، وتقارير تحصيل وإشغال — بأدوار (مالك/محاسب).',
        descriptionEn: 'Internal property and rentals management system: units with status (vacant/rented), tenants with contracts, rent collection with printed receipt, due/overdue alerts, and collection/occupancy reports — with roles (owner/accountant).',
        keywords: ['إدارة عقارات', 'ادارة عقارات', 'إيجارات', 'ايجارات', 'إيجار', 'مستأجر', 'مستأجرين', 'عقود إيجار', 'تحصيل إيجار', 'وحدات', 'شقق للإيجار', 'عمارة', 'property management', 'rentals', 'tenant', 'lease', 'rent collection', 'landlord'],
        model: {
            roles: [{ name: 'مالك' }, { name: 'محاسب' }],
            entities: [{ name: 'وحدة' }, { name: 'عقد إيجار' }, { name: 'دفعة تحصيل' }],
            flows: [{ name: 'إضافة وحدة' }, { name: 'إنشاء عقد يشغل الوحدة' }, { name: 'تحصيل إيجار شهري بإيصال' }, { name: 'تنبيه إيجار مستحق/متأخر' }, { name: 'تقرير تحصيل وإشغال' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() },
        ],
    };
}
