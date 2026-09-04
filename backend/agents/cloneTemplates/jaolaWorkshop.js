/**
 * 🔧 jaola-workshop — نظام ورشة سيارات داخلي (track: system).
 *
 * عملاء بسياراتهم، بطاقات عمل (job cards) بحالة (بالانتظار → قيد الإصلاح
 * → جاهز → مُسلّم) تجمع خدمات وقطع غيار، فاتورة إصلاح قابلة للطباعة،
 * تقارير. أدوار: مدير / فنّي / استقبال. الحالة في localStorage (jwork_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaWorkshop() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام إدارة الورشة</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🔧</span> <span id="brandName">ورشة jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام إدارة الورشة</h1>
        <p class="hint">عملاء وسيارات · بطاقات عمل · خدمات وقطع · فواتير · تقارير.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="manager">مدير</option><option value="tech">فنّي</option><option value="reception">استقبال</option></select>
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
      <div class="panel"><h3>بطاقات قيد العمل</h3><div id="activeJobs"></div></div>
    </section>

    <section id="view-customers" class="view hidden">
      <div class="view-head"><h2>العملاء والسيارات</h2></div>
      <div class="panel form-row">
        <input id="cuName" placeholder="اسم العميل">
        <input id="cuPhone" placeholder="الهاتف">
        <input id="cuCar" placeholder="السيارة (نوع/موديل)">
        <input id="cuPlate" placeholder="اللوحة">
        <button class="btn primary" data-action="addCustomer">إضافة عميل</button>
      </div>
      <div class="panel"><table class="tbl" id="customersTable"></table></div>
    </section>

    <section id="view-jobs" class="view hidden">
      <div class="view-head"><h2>بطاقات العمل</h2></div>
      <div class="panel form-row">
        <select id="jbCustomer"></select>
        <input id="jbComplaint" placeholder="العطل/الطلب">
        <button class="btn primary" data-action="openJob">فتح بطاقة عمل</button>
      </div>
      <div class="panel"><table class="tbl" id="jobsTable"></table></div>
    </section>

    <section id="view-jobcard" class="view hidden">
      <div class="view-head"><h2 id="jcTitle">بطاقة عمل</h2><button class="btn ghost" data-action="backJobs">→ البطاقات</button></div>
      <div class="panel" id="jcInfo"></div>
      <div class="panel">
        <h3>إضافة بند (خدمة/قطعة)</h3>
        <div class="form-row">
          <input id="itDesc" placeholder="الوصف (تغيير زيت / فلتر…)">
          <input id="itQty" type="number" placeholder="الكمية" min="1" value="1">
          <input id="itPrice" type="number" placeholder="السعر" min="0" step="0.01">
          <button class="btn ghost" data-action="addJobItem">+ أضف</button>
        </div>
        <table class="tbl" id="jobItemsTable"></table>
        <div class="sale-foot"><span id="jobTotal"></span>
          <span>
            <button class="btn ghost" data-action="advanceJob">→ المرحلة التالية</button>
            <button class="btn primary" data-action="printInvoice">🖨️ فاتورة</button>
          </span>
        </div>
      </div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportJobsCsv">⬇️ البطاقات CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>إيراد آخر ٧ أيام</h3><div id="revChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم الورشة</label><input id="stName">
        <label>العملة</label><input id="stCurrency">
        <label>كلمة المرور الحالية</label><input id="stPassCur" type="password" placeholder="مطلوبة لتغيير كلمة المرور">
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

    const APP_JS = `/* 🔧 نظام إدارة الورشة — jaola-workshop */
const SEED_CUSTOMERS = [
  { id: 'c1', name: 'العميل الأول', phone: '0500000001', car: 'تويوتا كامري', plate: 'أ ب ج 1234' },
  { id: 'c2', name: 'العميل الثاني', phone: '0500000002', car: 'نيسان باترول', plate: 'د هـ و 5678' }
];
const ROLES = {
  manager: { name: 'المدير', tabs: ['dashboard', 'customers', 'jobs', 'reports', 'settings'] },
  tech: { name: 'الفنّي', tabs: ['dashboard', 'jobs'] },
  reception: { name: 'الاستقبال', tabs: ['dashboard', 'customers', 'jobs'] }
};
const TAB_LABELS = { dashboard: 'اللوحة', customers: 'العملاء', jobs: 'البطاقات', reports: 'التقارير', settings: 'الإعدادات' };
const STAGES = ['waiting', 'repairing', 'ready', 'delivered'];
const STAGE_LABELS = { waiting: 'بالانتظار', repairing: 'قيد الإصلاح', ready: 'جاهزة', delivered: 'مُسلّمة' };

function load(k, fb) { try { var v = localStorage.getItem('jwork_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jwork_' + k, JSON.stringify(val)); } catch (e) {} }
let customers = load('customers', SEED_CUSTOMERS);
let jobs = load('jobs', []); // { id, no, custId, complaint, items:[], stage, date }
let settings = load('settings', { name: 'ورشة jaola', currency: 'ر.س', pass: 'admin', jobSeq: 1 });
let state = { user: null, view: 'login', activeJob: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function custById(id) { for (var i = 0; i < customers.length; i++) if (customers[i].id === id) return customers[i]; return null; }
function jobById(id) { for (var i = 0; i < jobs.length; i++) if (jobs[i].id === id) return jobs[i]; return null; }
function jobTotal(j) { var t = 0; for (var i = 0; i < j.items.length; i++) t += j.items[i].qty * j.items[i].price; return t; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'dashboard') renderDashboard();
  if (v === 'customers') renderCustomers();
  if (v === 'jobs') renderJobs();
  if (v === 'jobcard') renderJobCard();
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
  var active = jobs.filter(function (j) { return j.stage !== 'delivered'; });
  var t = today(); var todayRev = 0;
  for (var i = 0; i < jobs.length; i++) if (jobs[i].stage === 'delivered' && jobs[i].date === t) todayRev += jobTotal(jobs[i]);
  byId('dashStats').innerHTML =
    statCard('بطاقات مفتوحة', String(active.length), active.length ? 'warn' : '') +
    statCard('جاهزة للتسليم', String(jobs.filter(function (j) { return j.stage === 'ready'; }).length), 'ok') +
    statCard('إيراد اليوم', money(todayRev), 'ok') +
    statCard('إجمالي العملاء', String(customers.length), '');
  byId('activeJobs').innerHTML = active.length ? active.map(function (j) {
    var c = custById(j.custId);
    return '<div class="low-row">🔧 <b>#' + j.no + '</b> — ' + esc(c ? c.car : '؟') + ' · ' + esc(STAGE_LABELS[j.stage]) + ' · ' + money(jobTotal(j)) + '</div>';
  }).join('') : '<p class="hint">لا بطاقات مفتوحة ✅</p>';
}

function fillCustomerSelect() {
  var el = byId('jbCustomer'); if (!el) return;
  el.innerHTML = customers.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + ' — ' + esc(c.car) + ' (' + esc(c.plate) + ')</option>'; }).join('');
}
function renderCustomers() {
  var rows = customers.map(function (c) {
    return '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.phone) + '</td><td>' + esc(c.car) + '</td><td>' + esc(c.plate) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delCustomer" data-id="' + c.id + '">حذف</button></td></tr>';
  }).join('');
  byId('customersTable').innerHTML = '<tr><th>الاسم</th><th>الهاتف</th><th>السيارة</th><th>اللوحة</th><th></th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا عملاء بعد.</td></tr>');
  fillCustomerSelect();
}
function addCustomer() {
  var name = byId('cuName').value.trim(); if (!name) { toast('اكتب اسم العميل'); return; }
  customers.push({ id: uid('c'), name: name, phone: byId('cuPhone').value.trim(), car: byId('cuCar').value.trim() || 'سيارة', plate: byId('cuPlate').value.trim() });
  save('customers', customers);
  byId('cuName').value = ''; byId('cuPhone').value = ''; byId('cuCar').value = ''; byId('cuPlate').value = '';
  toast('أُضيف العميل'); renderCustomers();
}
function delCustomer(id) { customers = customers.filter(function (c) { return c.id !== id; }); save('customers', customers); renderCustomers(); }

function renderJobs() {
  fillCustomerSelect();
  var rows = jobs.slice().reverse().slice(0, 60).map(function (j) {
    var c = custById(j.custId);
    return '<tr><td>#' + j.no + '</td><td>' + j.date + '</td><td>' + esc(c ? c.car : '؟') + '</td><td>' + esc(j.complaint || '—') + '</td><td>' + esc(STAGE_LABELS[j.stage]) + '</td><td>' + money(jobTotal(j)) + '</td>' +
      '<td><button class="btn tiny primary" data-action="openJobCard" data-id="' + j.id + '">فتح</button></td></tr>';
  }).join('');
  byId('jobsTable').innerHTML = '<tr><th>رقم</th><th>التاريخ</th><th>السيارة</th><th>العطل</th><th>الحالة</th><th>الإجمالي</th><th></th></tr>' +
    (rows || '<tr><td colspan="7" class="hint">لا بطاقات بعد.</td></tr>');
}
function openJob() {
  var custId = byId('jbCustomer').value; if (!custId) { toast('اختر العميل'); return; }
  var j = { id: uid('j'), no: settings.jobSeq++, custId: custId, complaint: byId('jbComplaint').value.trim(), items: [], stage: 'waiting', date: today() };
  jobs.push(j); save('jobs', jobs); save('settings', settings);
  byId('jbComplaint').value = '';
  state.activeJob = j.id; toast('فُتحت بطاقة #' + j.no); setView('jobcard');
}
function openJobCard(id) { state.activeJob = id; setView('jobcard'); }
function backJobs() { state.activeJob = null; setView('jobs'); }
function renderJobCard() {
  var j = jobById(state.activeJob); if (!j) { setView('jobs'); return; }
  var c = custById(j.custId);
  byId('jcTitle').textContent = 'بطاقة عمل #' + j.no;
  byId('jcInfo').innerHTML = '<p><b>العميل:</b> ' + esc(c ? c.name : '؟') + ' — ' + esc(c ? c.phone : '') + '</p>' +
    '<p><b>السيارة:</b> ' + esc(c ? c.car : '') + ' (' + esc(c ? c.plate : '') + ')</p>' +
    '<p><b>العطل:</b> ' + esc(j.complaint || '—') + '</p>' +
    '<p><b>الحالة:</b> <span style="color:var(--ok);font-weight:800">' + esc(STAGE_LABELS[j.stage]) + '</span></p>';
  renderJobItems();
}
function renderJobItems() {
  var j = jobById(state.activeJob); if (!j) return;
  byId('jobItemsTable').innerHTML = j.items.length ? '<tr><th>الوصف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>' +
    j.items.map(function (it, i) { return '<tr><td>' + esc(it.desc) + '</td><td>' + it.qty + '</td><td>' + money(it.price) + '</td><td>' + money(it.qty * it.price) + '</td><td><button class="btn tiny ghost" data-action="delJobItem" data-idx="' + i + '">×</button></td></tr>'; }).join('') : '<tr><td colspan="5" class="hint">لا بنود بعد.</td></tr>';
  byId('jobTotal').textContent = 'الإجمالي: ' + money(jobTotal(j));
}
function addJobItem() {
  var j = jobById(state.activeJob); if (!j) return;
  var desc = byId('itDesc').value.trim(); if (!desc) { toast('اكتب الوصف'); return; }
  j.items.push({ desc: desc, qty: Math.max(1, parseInt(byId('itQty').value, 10) || 1), price: Math.max(0, parseFloat(byId('itPrice').value) || 0) });
  save('jobs', jobs); byId('itDesc').value = ''; byId('itQty').value = '1'; byId('itPrice').value = '';
  renderJobItems();
}
function delJobItem(i) { var j = jobById(state.activeJob); if (!j) return; j.items.splice(i, 1); save('jobs', jobs); renderJobItems(); }
function advanceJob() {
  var j = jobById(state.activeJob); if (!j) return;
  var idx = STAGES.indexOf(j.stage);
  if (idx >= STAGES.length - 1) { toast('البطاقة مُسلّمة بالفعل'); return; }
  j.stage = STAGES[idx + 1]; save('jobs', jobs); toast('الحالة: ' + STAGE_LABELS[j.stage]); renderJobCard();
}
function printInvoice() {
  var j = jobById(state.activeJob); if (!j) return; var c = custById(j.custId);
  var rows = j.items.map(function (it) { return '<tr><td>' + esc(it.desc) + '</td><td>' + it.qty + '</td><td>' + money(it.price) + '</td><td>' + money(it.qty * it.price) + '</td></tr>'; }).join('');
  byId('printArea').innerHTML = '<div class="inv"><h1>' + esc(settings.name) + '</h1>' +
    '<div class="inv-meta"><span>فاتورة إصلاح #' + j.no + '</span><span>' + today() + '</span></div>' +
    '<p><b>العميل:</b> ' + esc(c ? c.name : '؟') + '</p><p><b>السيارة:</b> ' + esc(c ? c.car : '') + ' (' + esc(c ? c.plate : '') + ')</p>' +
    '<p><b>العطل:</b> ' + esc(j.complaint || '—') + '</p>' +
    '<table><tr><th>الوصف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>' + (rows || '<tr><td colspan="4">لا بنود</td></tr>') + '</table>' +
    '<p class="inv-total">الإجمالي: ' + money(jobTotal(j)) + '</p>' +
    '<p class="inv-foot">شكراً لثقتكم بنا</p></div>';
  window.print();
}

function renderReports() {
  var t = today(); var m = t.slice(0, 7); var mRev = 0, delivered = 0;
  for (var i = 0; i < jobs.length; i++) if (jobs[i].stage === 'delivered') { delivered++; if (jobs[i].date.slice(0, 7) === m) mRev += jobTotal(jobs[i]); }
  byId('reportStats').innerHTML =
    statCard('بطاقات هذا الشهر', String(jobs.filter(function (j) { return j.date.slice(0, 7) === m; }).length), '') +
    statCard('إيراد الشهر (مُسلّمة)', money(mRev), 'ok') +
    statCard('إجمالي المُسلّمة', String(delivered), '') +
    statCard('إجمالي البطاقات', String(jobs.length), '');
  var data = [];
  for (var d = 6; d >= 0; d--) { var dt = new Date(); dt.setDate(dt.getDate() - d); var ds = dt.toISOString().slice(0, 10); var r = 0; for (var j = 0; j < jobs.length; j++) if (jobs[j].stage === 'delivered' && jobs[j].date === ds) r += jobTotal(jobs[j]); data.push({ label: ds.slice(5), value: r }); }
  byId('revChart').innerHTML = barChart(data, 150);
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
function exportJobsCsv() {
  var rows = [['رقم', 'التاريخ', 'السيارة', 'الحالة', 'الإجمالي']];
  for (var i = 0; i < jobs.length; i++) { var c = custById(jobs[i].custId); rows.push([jobs[i].no, jobs[i].date, c ? c.car : '', STAGE_LABELS[jobs[i].stage], jobTotal(jobs[i])]); }
  csvDownload('jobs.csv', rows); toast('صُدّرت البطاقات CSV');
}

function renderSettings() { byId('stName').value = settings.name; byId('stCurrency').value = settings.currency; byId('stPass').value = ''; byId('stPassCur').value = ''; }
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  settings.currency = byId('stCurrency').value.trim() || settings.currency;
  var np = byId('stPass').value.trim();
  if (np) { var sync = window.JAOLA_SYNC; if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np, currentPassword: byId('stPassCur').value }) }).then(function (r) { if (!r.ok) toast('كلمة المرور الحالية غير صحيحة'); else toast('تم تغيير كلمة المرور'); }).catch(function () {}); } else settings.pass = np; }
  save('settings', settings); byId('brandName').textContent = settings.name; toast('حُفظت الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addCustomer': addCustomer(); break;
    case 'delCustomer': delCustomer(a.dataset.id); break;
    case 'openJob': openJob(); break;
    case 'openJobCard': openJobCard(a.dataset.id); break;
    case 'backJobs': backJobs(); break;
    case 'addJobItem': addJobItem(); break;
    case 'delJobItem': delJobItem(parseInt(a.dataset.idx, 10)); break;
    case 'advanceJob': advanceJob(); break;
    case 'printInvoice': printInvoice(); break;
    case 'exportJobsCsv': exportJobsCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    return {
        id: 'jaola-workshop',
        track: 'system',
        category: 'system',
        name: 'نظام إدارة ورشة سيارات',
        nameEn: 'Auto Workshop',
        description: 'سيستم ورشة سيارات داخلي: عملاء بسياراتهم، بطاقات عمل بحالة (بالانتظار→قيد الإصلاح→جاهزة→مُسلّمة) تجمع خدمات وقطع غيار، فاتورة إصلاح قابلة للطباعة، وتقارير إيراد — بأدوار (مدير/فنّي/استقبال).',
        descriptionEn: 'Internal auto workshop system: customers with their cars, job cards with stages (waiting→repairing→ready→delivered) collecting services and parts, printable repair invoice, and revenue reports — with roles (manager/technician/reception).',
        keywords: ['ورشة', 'ورش', 'ورشة سيارات', 'إصلاح سيارات', 'صيانة سيارات', 'بطاقة عمل', 'بطاقات عمل', 'قطع غيار', 'ميكانيكا', 'كراج', 'workshop', 'garage', 'auto repair', 'job card', 'mechanic', 'car service'],
        model: {
            roles: [{ name: 'مدير' }, { name: 'فنّي' }, { name: 'استقبال' }],
            entities: [{ name: 'عميل' }, { name: 'سيارة' }, { name: 'بطاقة عمل' }, { name: 'بند خدمة/قطعة' }],
            flows: [{ name: 'تسجيل عميل وسيارته' }, { name: 'فتح بطاقة عمل بعطل' }, { name: 'إضافة خدمات وقطع للبطاقة' }, { name: 'تقدّم الحالة: بالانتظار→قيد الإصلاح→جاهزة→مُسلّمة' }, { name: 'طباعة فاتورة الإصلاح' }, { name: 'تقرير إيراد' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() },
        ],
    };
}
