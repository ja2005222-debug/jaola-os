/**
 * 💊 jaola-pharmacy — نظام صيدلية داخلي (track: system).
 *
 * أدوية بمخزون وتاريخ صلاحية، صرف بوصفة يُنقص المخزون ويصدر إيصالاً،
 * تنبيه نفاد وتنبيه قرب/انتهاء الصلاحية، تقارير مبيعات. أدوار: صيدلي /
 * مدير. بلا اعتماد خارجي. الحالة في localStorage (jphar_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaPharmacy() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام إدارة الصيدلية</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">💊</span> <span id="brandName">صيدلية jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام إدارة الصيدلية</h1>
        <p class="hint">أدوية · صرف بوصفة · تنبيه نفاد وانتهاء صلاحية · تقارير.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="manager">مدير</option><option value="pharmacist">صيدلي</option></select>
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
      <div class="grid2">
        <div class="panel"><h3>⚠️ نفاد المخزون</h3><div id="lowStock"></div></div>
        <div class="panel"><h3>⏳ قرب/انتهاء الصلاحية</h3><div id="expiring"></div></div>
      </div>
    </section>

    <section id="view-inventory" class="view hidden">
      <div class="view-head"><h2>الأدوية</h2></div>
      <div class="panel form-row">
        <input id="mdName" placeholder="اسم الدواء">
        <input id="mdQty" type="number" placeholder="الكمية" min="0">
        <input id="mdPrice" type="number" placeholder="سعر البيع" min="0" step="0.01">
        <input id="mdMin" type="number" placeholder="حد التنبيه" min="0">
        <input id="mdExpiry" type="date" title="تاريخ الصلاحية">
        <button class="btn primary" data-action="addMedicine">إضافة دواء</button>
      </div>
      <div class="panel"><table class="tbl" id="medsTable"></table></div>
    </section>

    <section id="view-dispense" class="view hidden">
      <div class="view-head"><h2>الصرف</h2></div>
      <div class="panel">
        <h3>صرف جديد</h3>
        <div class="form-row">
          <input id="dsPatient" placeholder="اسم المريض (اختياري)">
          <select id="dsMedicine"></select>
          <input id="dsQty" type="number" placeholder="الكمية" min="1">
          <button class="btn ghost" data-action="addDispenseLine">+ أضف</button>
        </div>
        <table class="tbl" id="dispenseLinesTable"></table>
        <div class="sale-foot"><span id="dispenseTotal"></span><button class="btn primary" data-action="saveDispense">صرف وإصدار إيصال</button></div>
      </div>
      <div class="panel"><h3>سجل الصرف</h3><table class="tbl" id="dispensesTable"></table></div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportSalesCsv">⬇️ المبيعات CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>مبيعات آخر ٧ أيام</h3><div id="salesChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم الصيدلية</label><input id="stName">
        <label>أيام التنبيه قبل انتهاء الصلاحية</label><input id="stExpiryDays" type="number" min="1">
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

    const APP_JS = `/* 💊 نظام إدارة الصيدلية — jaola-pharmacy */
function futureDate(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
const SEED_MEDS = [
  { id: 'm1', name: 'باراسيتامول', qty: 200, price: 12, min: 40, expiry: futureDate(200) },
  { id: 'm2', name: 'أموكسيسيلين', qty: 25, price: 30, min: 30, expiry: futureDate(20) },
  { id: 'm3', name: 'شراب سعال', qty: 60, price: 18, min: 20, expiry: futureDate(120) }
];
const ROLES = {
  manager: { name: 'المدير', tabs: ['dashboard', 'inventory', 'dispense', 'reports', 'settings'] },
  pharmacist: { name: 'الصيدلي', tabs: ['dashboard', 'inventory', 'dispense'] }
};
const TAB_LABELS = { dashboard: 'اللوحة', inventory: 'الأدوية', dispense: 'الصرف', reports: 'التقارير', settings: 'الإعدادات' };

function load(k, fb) { try { var v = localStorage.getItem('jphar_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jphar_' + k, JSON.stringify(val)); } catch (e) {} }
let meds = load('meds', SEED_MEDS);
let dispenses = load('dispenses', []);
let settings = load('settings', { name: 'صيدلية jaola', expiryDays: 30, currency: 'ر.س', pass: 'admin', receiptSeq: 1 });
let state = { user: null, view: 'login', lines: [] };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function medById(id) { for (var i = 0; i < meds.length; i++) if (meds[i].id === id) return meds[i]; return null; }
function daysToExpiry(d) { return Math.round((new Date(d) - new Date(today())) / 86400000); }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'dashboard') renderDashboard();
  if (v === 'inventory') renderInventory();
  if (v === 'dispense') renderDispense();
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
function logout() { state.user = null; state.lines = []; setView('login'); }

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var t = today();
  var todaySales = 0; for (var i = 0; i < dispenses.length; i++) if (dispenses[i].date === t) todaySales += dispenses[i].total;
  var lows = meds.filter(function (m) { return m.qty <= m.min; });
  var exp = meds.filter(function (m) { return daysToExpiry(m.expiry) <= settings.expiryDays; });
  byId('dashStats').innerHTML =
    statCard('أصناف الأدوية', String(meds.length), '') +
    statCard('مبيعات اليوم', money(todaySales), 'ok') +
    statCard('تنبيهات نفاد', String(lows.length), lows.length ? 'warn' : '') +
    statCard('قرب الانتهاء', String(exp.length), exp.length ? 'bad' : '');
  byId('lowStock').innerHTML = lows.length ? lows.map(function (m) { return '<div class="low-row">⚠️ <b>' + esc(m.name) + '</b> — المتبقي ' + m.qty + ' (الحد ' + m.min + ')</div>'; }).join('') : '<p class="hint">المخزون فوق الحدود ✅</p>';
  byId('expiring').innerHTML = exp.length ? exp.sort(function (a, b) { return daysToExpiry(a.expiry) - daysToExpiry(b.expiry); }).map(function (m) {
    var d = daysToExpiry(m.expiry);
    return '<div class="low-row">' + (d < 0 ? '❌ <b>' + esc(m.name) + '</b> — منتهٍ منذ ' + (-d) + ' يوم' : '⏳ <b>' + esc(m.name) + '</b> — ينتهي خلال ' + d + ' يوم') + '</div>';
  }).join('') : '<p class="hint">لا أدوية قرب الانتهاء ✅</p>';
}

function fillMedSelect() {
  var el = byId('dsMedicine'); if (!el) return;
  el.innerHTML = meds.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + ' (متاح: ' + m.qty + ')</option>'; }).join('');
}
function renderInventory() {
  var rows = meds.map(function (m) {
    var d = daysToExpiry(m.expiry);
    var expClass = d < 0 ? 'row-low' : d <= settings.expiryDays ? 'row-low' : '';
    return '<tr class="' + (m.qty <= m.min ? 'row-low' : expClass) + '"><td>' + esc(m.name) + '</td><td>' + m.qty + '</td><td>' + money(m.price) + '</td><td>' + m.min + '</td><td>' + m.expiry + ' (' + (d < 0 ? 'منتهٍ' : d + ' يوم') + ')</td>' +
      '<td><button class="btn tiny ghost" data-action="delMedicine" data-id="' + m.id + '">حذف</button></td></tr>';
  }).join('');
  byId('medsTable').innerHTML = '<tr><th>الدواء</th><th>الكمية</th><th>السعر</th><th>حد التنبيه</th><th>الصلاحية</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا أدوية بعد.</td></tr>');
  fillMedSelect();
}
function addMedicine() {
  var name = byId('mdName').value.trim(); if (!name) { toast('اكتب اسم الدواء'); return; }
  meds.push({ id: uid('m'), name: name, qty: Math.max(0, parseInt(byId('mdQty').value, 10) || 0), price: Math.max(0, parseFloat(byId('mdPrice').value) || 0), min: Math.max(0, parseInt(byId('mdMin').value, 10) || 0), expiry: byId('mdExpiry').value || futureDate(180) });
  save('meds', meds);
  byId('mdName').value = ''; byId('mdQty').value = ''; byId('mdPrice').value = ''; byId('mdMin').value = ''; byId('mdExpiry').value = '';
  toast('أُضيف الدواء'); renderInventory();
}
function delMedicine(id) { meds = meds.filter(function (m) { return m.id !== id; }); save('meds', meds); renderInventory(); }

function renderDispense() {
  fillMedSelect(); renderDispenseLines();
  var rows = dispenses.slice().reverse().slice(0, 60).map(function (d) {
    return '<tr><td>#' + d.no + '</td><td>' + d.date + '</td><td>' + esc(d.patient || 'عميل') + '</td><td>' + d.items.length + ' صنف</td><td>' + money(d.total) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="printDispense" data-id="' + d.id + '">🖨️ الإيصال</button></td></tr>';
  }).join('');
  byId('dispensesTable').innerHTML = '<tr><th>رقم</th><th>التاريخ</th><th>المريض</th><th>الأصناف</th><th>الإجمالي</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا صرف بعد.</td></tr>');
}
function renderDispenseLines() {
  var total = 0;
  byId('dispenseLinesTable').innerHTML = state.lines.length ? '<tr><th>الدواء</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>' +
    state.lines.map(function (l, i) { var line = l.qty * l.price; total += line; return '<tr><td>' + esc(l.name) + '</td><td>' + l.qty + '</td><td>' + money(l.price) + '</td><td>' + money(line) + '</td><td><button class="btn tiny ghost" data-action="delDispenseLine" data-idx="' + i + '">×</button></td></tr>'; }).join('') : '';
  byId('dispenseTotal').textContent = state.lines.length ? 'الإجمالي: ' + money(total) : '';
}
function addDispenseLine() {
  var mid = byId('dsMedicine').value; var qty = parseInt(byId('dsQty').value, 10) || 0; var m = medById(mid);
  if (!m || qty < 1) { toast('اختر الدواء والكمية'); return; }
  var already = 0; for (var i = 0; i < state.lines.length; i++) if (state.lines[i].mid === mid) already += state.lines[i].qty;
  if (qty + already > m.qty) { toast('الكمية أكبر من المتاح (' + (m.qty - already) + ')'); return; }
  state.lines.push({ mid: mid, name: m.name, qty: qty, price: m.price }); byId('dsQty').value = ''; renderDispenseLines();
}
function delDispenseLine(i) { state.lines.splice(i, 1); renderDispenseLines(); }
function saveDispense() {
  if (!state.lines.length) { toast('أضف صنفاً واحداً على الأقل'); return; }
  var total = 0;
  for (var i = 0; i < state.lines.length; i++) { var m = medById(state.lines[i].mid); if (!m || state.lines[i].qty > m.qty) { toast('الكمية لم تعد متاحة: ' + state.lines[i].name); return; } total += state.lines[i].qty * state.lines[i].price; }
  for (var j = 0; j < state.lines.length; j++) medById(state.lines[j].mid).qty -= state.lines[j].qty;
  var d = { id: uid('d'), no: settings.receiptSeq++, patient: byId('dsPatient').value.trim(), items: state.lines.slice(), total: total, date: today() };
  dispenses.push(d); state.lines = []; byId('dsPatient').value = '';
  save('dispenses', dispenses); save('meds', meds); save('settings', settings);
  toast('تم الصرف #' + d.no); printDispense(d.id); renderDispense();
}
function printDispense(id) {
  var d = null; for (var i = 0; i < dispenses.length; i++) if (dispenses[i].id === id) d = dispenses[i];
  if (!d) return;
  var rows = d.items.map(function (l) { return '<div class="r-row"><span>' + esc(l.name) + ' ×' + l.qty + '</span><span>' + money(l.qty * l.price) + '</span></div>'; }).join('');
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>إيصال صرف #' + d.no + '</span><span>' + d.date + '</span></div>' +
    (d.patient ? '<div class="r-row"><span>المريض</span><span>' + esc(d.patient) + '</span></div>' : '') + '<hr>' +
    rows + '<hr><div class="r-row"><b>الإجمالي</b><b>' + money(d.total) + '</b></div><hr>' +
    '<p style="text-align:center">سلامتكم أمانة 🙏</p></div>';
  window.print();
}

function renderReports() {
  var t = today(); var m = t.slice(0, 7); var mSales = 0;
  for (var i = 0; i < dispenses.length; i++) if (dispenses[i].date.slice(0, 7) === m) mSales += dispenses[i].total;
  byId('reportStats').innerHTML =
    statCard('عمليات صرف اليوم', String(dispenses.filter(function (d) { return d.date === t; }).length), '') +
    statCard('مبيعات الشهر', money(mSales), 'ok') +
    statCard('إجمالي الصرف', String(dispenses.length), '');
  var data = [];
  for (var dd = 6; dd >= 0; dd--) { var dt = new Date(); dt.setDate(dt.getDate() - dd); var ds = dt.toISOString().slice(0, 10); var r = 0; for (var j = 0; j < dispenses.length; j++) if (dispenses[j].date === ds) r += dispenses[j].total; data.push({ label: ds.slice(5), value: r }); }
  byId('salesChart').innerHTML = barChart(data, 150);
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
function exportSalesCsv() {
  var rows = [['رقم', 'التاريخ', 'المريض', 'الإجمالي']];
  for (var i = 0; i < dispenses.length; i++) rows.push([dispenses[i].no, dispenses[i].date, dispenses[i].patient || 'عميل', dispenses[i].total]);
  csvDownload('sales.csv', rows); toast('صُدّرت المبيعات CSV');
}

function renderSettings() { byId('stName').value = settings.name; byId('stExpiryDays').value = settings.expiryDays; byId('stCurrency').value = settings.currency; byId('stPass').value = ''; }
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  var ed = parseInt(byId('stExpiryDays').value, 10); if (ed >= 1) settings.expiryDays = ed;
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
    case 'addMedicine': addMedicine(); break;
    case 'delMedicine': delMedicine(a.dataset.id); break;
    case 'addDispenseLine': addDispenseLine(); break;
    case 'delDispenseLine': delDispenseLine(parseInt(a.dataset.idx, 10)); break;
    case 'saveDispense': saveDispense(); break;
    case 'printDispense': printDispense(a.dataset.id); break;
    case 'exportSalesCsv': exportSalesCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    return {
        id: 'jaola-pharmacy',
        track: 'system',
        category: 'system',
        name: 'نظام إدارة صيدلية',
        nameEn: 'Pharmacy Manager',
        description: 'سيستم صيدلية داخلي: أدوية بمخزون وتاريخ صلاحية، صرف بوصفة يُنقص المخزون ويصدر إيصالاً، تنبيه نفاد وتنبيه قرب/انتهاء الصلاحية، وتقارير مبيعات — بأدوار (مدير/صيدلي).',
        descriptionEn: 'Internal pharmacy system: medicines with stock and expiry date, prescription dispensing that reduces stock and prints a receipt, low-stock and expiry alerts, and sales reports — with roles (manager/pharmacist).',
        keywords: ['صيدلية', 'صيدليات', 'أدوية', 'دواء', 'صرف دواء', 'وصفة صيدلية', 'تاريخ صلاحية', 'انتهاء صلاحية', 'مخزون أدوية', 'pharmacy', 'medicine', 'drug', 'dispensing', 'expiry', 'pharmacist'],
        model: {
            roles: [{ name: 'مدير' }, { name: 'صيدلي' }],
            entities: [{ name: 'دواء' }, { name: 'عملية صرف' }],
            flows: [{ name: 'إضافة دواء بصلاحية' }, { name: 'صرف بوصفة يُنقص المخزون' }, { name: 'تنبيه نفاد المخزون' }, { name: 'تنبيه قرب/انتهاء الصلاحية' }, { name: 'طباعة إيصال صرف' }, { name: 'تقرير مبيعات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() },
        ],
    };
}
