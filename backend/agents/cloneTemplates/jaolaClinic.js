/**
 * 🏥 jaola-clinic — نظام إدارة عيادة/مركز طبي داخلي (track: system).
 *
 * أداة عمل يومية: مرضى بملف مختصر، مواعيد بجدول اليوم، زيارات (تشخيص +
 * وصفة)، فواتير كشف قابلة للطباعة، تقرير يومي. أدوار: طبيب / استقبال /
 * محاسب. بلا أي اعتماد خارجي. الحالة في localStorage (jclin_*).
 */

export function jaolaClinic() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام إدارة العيادة</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🏥</span> <span id="brandName">عيادة jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام إدارة العيادة</h1>
        <p class="hint">مرضى · مواعيد · زيارات ووصفات · فواتير كشف · تقارير.</p>
        <label>الدور</label>
        <select id="loginRole">
          <option value="doctor">الطبيب</option>
          <option value="reception">الاستقبال</option>
          <option value="accountant">المحاسب</option>
        </select>
        <label>كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="login">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin» لكل الأدوار.</p>
      </div>
    </section>

    <section id="view-dashboard" class="view hidden">
      <h2>لوحة اليوم</h2>
      <div class="stats" id="dashStats"></div>
      <div class="panel"><h3>مواعيد اليوم</h3><div id="todayAppts"></div></div>
    </section>

    <section id="view-patients" class="view hidden">
      <div class="view-head"><h2>المرضى</h2></div>
      <div class="panel form-row">
        <input id="ptName" placeholder="اسم المريض">
        <input id="ptPhone" placeholder="الهاتف">
        <input id="ptAge" type="number" placeholder="العمر" min="0">
        <select id="ptGender"><option>ذكر</option><option>أنثى</option></select>
        <input id="ptNote" placeholder="ملاحظة (حساسية، أمراض مزمنة…)">
        <button class="btn primary" data-action="addPatient">إضافة مريض</button>
      </div>
      <div class="panel"><table class="tbl" id="patientsTable"></table></div>
    </section>

    <section id="view-appointments" class="view hidden">
      <div class="view-head"><h2>المواعيد</h2></div>
      <div class="panel form-row">
        <select id="apPatient"></select>
        <input id="apDate" type="date">
        <input id="apTime" type="time">
        <input id="apReason" placeholder="سبب الزيارة">
        <button class="btn primary" data-action="addAppt">حجز موعد</button>
      </div>
      <div class="panel"><table class="tbl" id="apptsTable"></table></div>
    </section>

    <section id="view-visits" class="view hidden">
      <div class="view-head"><h2>الزيارات والوصفات</h2></div>
      <div class="panel">
        <h3>زيارة جديدة</h3>
        <div class="form-row">
          <select id="vsPatient"></select>
          <input id="vsFee" type="number" placeholder="رسوم الكشف" min="0" step="0.01">
        </div>
        <textarea id="vsDiagnosis" rows="2" placeholder="التشخيص"></textarea>
        <textarea id="vsRx" rows="3" placeholder="الوصفة (دواء وجرعة في كل سطر)"></textarea>
        <button class="btn primary" data-action="saveVisit">حفظ الزيارة وإصدار الفاتورة</button>
      </div>
      <div class="panel"><h3>سجل الزيارات</h3><table class="tbl" id="visitsTable"></table></div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportVisitsCsv">⬇️ الزيارات CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>إيراد آخر ٧ أيام</h3><div id="revChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم العيادة</label><input id="stName">
        <label>اسم الطبيب</label><input id="stDoctor">
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

    const APP_JS = `/* 🏥 نظام إدارة العيادة — jaola-clinic */
const SEED_PATIENTS = [
  { id: 'p1', name: 'المريض الأول', phone: '0500000001', age: 34, gender: 'ذكر', note: '' },
  { id: 'p2', name: 'المريضة الثانية', phone: '0500000002', age: 28, gender: 'أنثى', note: 'حساسية بنسلين' }
];
const ROLES = {
  doctor: { name: 'الطبيب', tabs: ['dashboard', 'patients', 'appointments', 'visits', 'reports', 'settings'] },
  reception: { name: 'الاستقبال', tabs: ['dashboard', 'patients', 'appointments'] },
  accountant: { name: 'المحاسب', tabs: ['dashboard', 'visits', 'reports'] }
};
const TAB_LABELS = { dashboard: 'اللوحة', patients: 'المرضى', appointments: 'المواعيد', visits: 'الزيارات', reports: 'التقارير', settings: 'الإعدادات' };

function load(k, fb) { try { var v = localStorage.getItem('jclin_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jclin_' + k, JSON.stringify(val)); } catch (e) {} }
let patients = load('patients', SEED_PATIENTS);
let appts = load('appts', []);
let visits = load('visits', []);
let settings = load('settings', { name: 'عيادة jaola', doctor: 'د. جاولا', currency: 'ر.س', pass: 'admin', invoiceSeq: 1 });
let state = { user: null, view: 'login' };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2600); }
function patientById(id) { for (var i = 0; i < patients.length; i++) if (patients[i].id === id) return patients[i]; return null; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true);
  renderTabs();
  if (v === 'dashboard') renderDashboard();
  if (v === 'patients') renderPatients();
  if (v === 'appointments') renderAppts();
  if (v === 'visits') renderVisits();
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
  var role = byId('loginRole').value;
  if (byId('loginPass').value !== settings.pass) { show(byId('loginErr'), true); return; }
  show(byId('loginErr'), false); state.user = { role: role }; toast('مرحباً ' + ROLES[role].name); setView('dashboard');
}
function logout() { state.user = null; setView('login'); }

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var t = today();
  var todayAppt = appts.filter(function (a) { return a.date === t; });
  var todayVisits = visits.filter(function (v) { return v.date === t; });
  var rev = 0; for (var i = 0; i < todayVisits.length; i++) rev += todayVisits[i].fee;
  byId('dashStats').innerHTML =
    statCard('مواعيد اليوم', String(todayAppt.length), '') +
    statCard('زيارات اليوم', String(todayVisits.length), 'ok') +
    statCard('إيراد اليوم', money(rev), 'ok') +
    statCard('إجمالي المرضى', String(patients.length), '');
  byId('todayAppts').innerHTML = todayAppt.length
    ? todayAppt.sort(function (a, b) { return a.time < b.time ? -1 : 1; }).map(function (a) {
        var p = patientById(a.pid);
        return '<div class="low-row">🕐 <b>' + esc(a.time) + '</b> — ' + esc(p ? p.name : '؟') + ' (' + esc(a.reason || '') + ')</div>';
      }).join('')
    : '<p class="hint">لا مواعيد اليوم.</p>';
}

function fillPatientSelects() {
  var opts = patients.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + ' — ' + esc(p.phone) + '</option>'; }).join('');
  ['apPatient', 'vsPatient'].forEach(function (id) { var el = byId(id); if (el) el.innerHTML = opts; });
}
function renderPatients() {
  var rows = patients.map(function (p) {
    return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.phone) + '</td><td>' + p.age + '</td><td>' + esc(p.gender) + '</td><td>' + esc(p.note || '—') + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delPatient" data-id="' + p.id + '">حذف</button></td></tr>';
  }).join('');
  byId('patientsTable').innerHTML = '<tr><th>الاسم</th><th>الهاتف</th><th>العمر</th><th>الجنس</th><th>ملاحظة</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا مرضى بعد.</td></tr>');
  fillPatientSelects();
}
function addPatient() {
  var name = byId('ptName').value.trim(); if (!name) { toast('اكتب اسم المريض'); return; }
  patients.push({ id: uid('p'), name: name, phone: byId('ptPhone').value.trim(), age: parseInt(byId('ptAge').value, 10) || 0, gender: byId('ptGender').value, note: byId('ptNote').value.trim() });
  save('patients', patients);
  byId('ptName').value = ''; byId('ptPhone').value = ''; byId('ptAge').value = ''; byId('ptNote').value = '';
  toast('أُضيف المريض'); renderPatients();
}
function delPatient(id) { patients = patients.filter(function (p) { return p.id !== id; }); save('patients', patients); renderPatients(); }

function renderAppts() {
  fillPatientSelects();
  var rows = appts.slice().sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? 1 : -1; }).slice(0, 60).map(function (a) {
    var p = patientById(a.pid);
    return '<tr><td>' + a.date + '</td><td>' + esc(a.time) + '</td><td>' + esc(p ? p.name : '؟') + '</td><td>' + esc(a.reason || '—') + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delAppt" data-id="' + a.id + '">إلغاء</button></td></tr>';
  }).join('');
  byId('apptsTable').innerHTML = '<tr><th>التاريخ</th><th>الوقت</th><th>المريض</th><th>السبب</th><th></th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا مواعيد بعد.</td></tr>');
}
function addAppt() {
  var pid = byId('apPatient').value, date = byId('apDate').value || today(), time = byId('apTime').value || '09:00';
  if (!pid) { toast('اختر المريض'); return; }
  appts.push({ id: uid('a'), pid: pid, date: date, time: time, reason: byId('apReason').value.trim() });
  save('appts', appts); byId('apReason').value = ''; toast('حُجز الموعد'); renderAppts();
}
function delAppt(id) { appts = appts.filter(function (a) { return a.id !== id; }); save('appts', appts); renderAppts(); }

function renderVisits() {
  fillPatientSelects();
  var rows = visits.slice().reverse().slice(0, 60).map(function (v) {
    var p = patientById(v.pid);
    return '<tr><td>#' + v.no + '</td><td>' + v.date + '</td><td>' + esc(p ? p.name : '؟') + '</td><td>' + esc(v.diagnosis || '—') + '</td><td>' + money(v.fee) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="printVisit" data-id="' + v.id + '">🖨️ الفاتورة</button></td></tr>';
  }).join('');
  byId('visitsTable').innerHTML = '<tr><th>رقم</th><th>التاريخ</th><th>المريض</th><th>التشخيص</th><th>الرسوم</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا زيارات بعد.</td></tr>');
}
function saveVisit() {
  var pid = byId('vsPatient').value; if (!pid) { toast('اختر المريض'); return; }
  var fee = parseFloat(byId('vsFee').value) || 0;
  var v = { id: uid('v'), no: settings.invoiceSeq++, pid: pid, fee: fee, diagnosis: byId('vsDiagnosis').value.trim(), rx: byId('vsRx').value.trim(), date: today() };
  visits.push(v); save('visits', visits); save('settings', settings);
  byId('vsFee').value = ''; byId('vsDiagnosis').value = ''; byId('vsRx').value = '';
  toast('حُفظت الزيارة #' + v.no); renderVisits();
}
function printVisit(id) {
  var v = null; for (var i = 0; i < visits.length; i++) if (visits[i].id === id) v = visits[i];
  if (!v) return; var p = patientById(v.pid);
  var rx = (v.rx || '').split('\\n').filter(Boolean).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
  byId('printArea').innerHTML = '<div class="inv"><h1>' + esc(settings.name) + '</h1>' +
    '<div class="inv-meta"><span>' + esc(settings.doctor) + '</span><span>فاتورة #' + v.no + '</span><span>' + v.date + '</span></div>' +
    '<p><b>المريض:</b> ' + esc(p ? p.name : '؟') + (p ? ' — ' + esc(p.phone) : '') + '</p>' +
    '<p><b>التشخيص:</b> ' + esc(v.diagnosis || '—') + '</p>' +
    (rx ? '<p><b>الوصفة:</b></p><ul>' + rx + '</ul>' : '') +
    '<p class="inv-total">رسوم الكشف: ' + money(v.fee) + '</p>' +
    '<p class="inv-foot">سلامتك تهمّنا</p></div>';
  window.print();
}

function renderReports() {
  var t = today(); var m = t.slice(0, 7); var mRev = 0;
  for (var i = 0; i < visits.length; i++) if (visits[i].date.slice(0, 7) === m) mRev += visits[i].fee;
  byId('reportStats').innerHTML =
    statCard('زيارات الشهر', String(visits.filter(function (v) { return v.date.slice(0, 7) === m; }).length), '') +
    statCard('إيراد الشهر', money(mRev), 'ok') +
    statCard('إجمالي الزيارات', String(visits.length), '');
  var data = [];
  for (var d = 6; d >= 0; d--) {
    var dt = new Date(); dt.setDate(dt.getDate() - d); var ds = dt.toISOString().slice(0, 10);
    var r = 0; for (var j = 0; j < visits.length; j++) if (visits[j].date === ds) r += visits[j].fee;
    data.push({ label: ds.slice(5), value: r });
  }
  byId('revChart').innerHTML = barChart(data, 150);
}
function barChart(data, h) {
  var max = 1; for (var i = 0; i < data.length; i++) if (data[i].value > max) max = data[i].value;
  var bw = Math.floor(100 / data.length);
  return '<svg viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px">' +
    data.map(function (d, i) {
      var bh = Math.round((d.value / max) * (h - 30)); var x = i * bw;
      return '<g><rect x="' + (x + 2) + '%" y="' + (h - 20 - bh) + '" width="' + (bw - 4) + '%" height="' + bh + '" rx="3" class="bar"></rect>' +
        '<text x="' + (x + bw / 2) + '%" y="' + (h - 6) + '" class="bar-label">' + d.label + '</text></g>';
    }).join('') + '</svg>';
}
function csvDownload(name, rows) {
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function exportVisitsCsv() {
  var rows = [['رقم', 'التاريخ', 'المريض', 'التشخيص', 'الرسوم']];
  for (var i = 0; i < visits.length; i++) { var p = patientById(visits[i].pid); rows.push([visits[i].no, visits[i].date, p ? p.name : '', visits[i].diagnosis, visits[i].fee]); }
  csvDownload('visits.csv', rows); toast('صُدّرت الزيارات CSV');
}

function renderSettings() { byId('stName').value = settings.name; byId('stDoctor').value = settings.doctor; byId('stCurrency').value = settings.currency; byId('stPass').value = ''; }
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  settings.doctor = byId('stDoctor').value.trim() || settings.doctor;
  settings.currency = byId('stCurrency').value.trim() || settings.currency;
  var np = byId('stPass').value.trim(); if (np) settings.pass = np;
  save('settings', settings); byId('brandName').textContent = settings.name; toast('حُفظت الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addPatient': addPatient(); break;
    case 'delPatient': delPatient(a.dataset.id); break;
    case 'addAppt': addAppt(); break;
    case 'delAppt': delAppt(a.dataset.id); break;
    case 'saveVisit': saveVisit(); break;
    case 'printVisit': printVisit(a.dataset.id); break;
    case 'exportVisitsCsv': exportVisitsCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const STYLES = sharedSystemStyles('🏥');

    return {
        id: 'jaola-clinic',
        track: 'system',
        category: 'system',
        name: 'نظام إدارة عيادة',
        nameEn: 'Clinic Manager',
        description: 'سيستم داخلي لعيادة/مركز طبي: ملفات المرضى، مواعيد بجدول اليوم، زيارات بتشخيص ووصفة، فواتير كشف قابلة للطباعة، وتقارير إيراد — بأدوار (طبيب/استقبال/محاسب).',
        descriptionEn: 'Internal system for a clinic/medical center: patient records, day-schedule appointments, visits with diagnosis and prescription, printable consultation invoices, and revenue reports — with roles (doctor/reception/accountant).',
        keywords: ['عيادة', 'عيادات', 'مركز طبي', 'مركز صحي', 'مستوصف', 'طبيب', 'مرضى', 'مريض', 'مواعيد طبية', 'حجز موعد طبي', 'وصفة', 'وصفات', 'تشخيص', 'ملف طبي', 'كشف طبي', 'أسنان', 'clinic', 'medical', 'patient', 'appointment', 'prescription', 'diagnosis', 'ehr', 'emr', 'healthcare'],
        model: {
            roles: [{ name: 'طبيب' }, { name: 'استقبال' }, { name: 'محاسب' }],
            entities: [{ name: 'مريض' }, { name: 'موعد' }, { name: 'زيارة' }, { name: 'فاتورة كشف' }],
            flows: [{ name: 'تسجيل مريض' }, { name: 'حجز موعد بجدول اليوم' }, { name: 'زيارة بتشخيص ووصفة تُصدر فاتورة' }, { name: 'طباعة فاتورة الكشف' }, { name: 'تقرير إيراد يومي' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: STYLES },
        ],
    };
}

/** أنماط موحّدة لأنظمة jaola الداخلية — مصدر واحد يتشاركه كل قالب system. */
export function sharedSystemStyles() {
    return `:root{--bg:#0b0c14;--panel:#12141f;--line:#232636;--txt:#e7e9f2;--mut:#8b90a5;--pri:#6366f1;--ok:#22c55e;--warn:#f59e0b;--bad:#ef4444}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:system-ui,'Segoe UI',Tahoma,sans-serif;min-height:100vh}
.topbar{display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--line);background:rgba(18,20,31,.9);position:sticky;top:0;z-index:10}
.brand{font-weight:800;font-size:16px;display:flex;align-items:center;gap:8px}
.mk{font-size:20px}
.tabs{display:flex;gap:4px;flex:1;flex-wrap:wrap}
.tab{background:transparent;border:none;color:var(--mut);padding:8px 13px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700}
.tab.active,.tab:hover{background:rgba(99,102,241,.14);color:#c7d2fe}
.user-chip{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut)}
main{max-width:1080px;margin:0 auto;padding:22px 16px}
h2{font-size:20px;margin-bottom:14px}h3{font-size:14px;margin-bottom:10px;color:#c7d2fe}
.view-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px}
.hidden{display:none!important}.hint{color:var(--mut);font-size:12px}.tiny{font-size:10px}
.err{color:var(--bad);font-size:12px;margin:6px 0}
.login-card{max-width:380px;margin:8vh auto;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:8px}
.login-card h1{font-size:20px}.login-card label{font-size:12px;color:var(--mut);margin-top:8px}
input,select,textarea{background:#0a0e17;border:1px solid var(--line);border-radius:9px;padding:10px 12px;color:var(--txt);font-size:13px;outline:none;font-family:inherit;width:100%}
input:focus,select:focus,textarea:focus{border-color:var(--pri)}
.btn{border:none;border-radius:9px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer}
.btn.primary{background:var(--pri);color:#fff}
.btn.ghost{background:rgba(255,255,255,.05);color:var(--txt);border:1px solid var(--line)}
.btn.tiny{padding:4px 10px;font-size:11px}.btn.block{width:100%;margin-top:10px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:16px}
.panel textarea{margin:8px 0}
.form-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.form-row input,.form-row select{flex:1;min-width:120px}
.form-col{display:flex;flex-direction:column;gap:8px;max-width:420px}.form-col label{font-size:12px;color:var(--mut)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:4px}
.stat-v{font-size:18px;font-weight:800}.stat-l{font-size:11px;color:var(--mut)}
.stat.ok .stat-v{color:var(--ok)}.stat.warn .stat-v{color:var(--warn)}.stat.bad .stat-v{color:var(--bad)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.grid2{grid-template-columns:1fr}}
.tbl{width:100%;border-collapse:collapse;font-size:12px}
.tbl th{color:var(--mut);text-align:start;padding:8px 6px;border-bottom:1px solid var(--line);font-size:11px}
.tbl td{padding:8px 6px;border-bottom:1px solid rgba(35,38,54,.5)}
.row-low td{background:rgba(245,158,11,.06)}
.low-row{padding:8px 4px;border-bottom:1px solid rgba(35,38,54,.5);font-size:12px}
.sale-foot{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-weight:800}
.chart .bar{fill:#6366f1}.chart .bar-label{fill:#8b90a5;font-size:6px;text-anchor:middle}
.toast{position:fixed;bottom:22px;inset-inline-start:50%;transform:translateX(50%);background:#1c1f2e;border:1px solid var(--line);border-radius:10px;padding:10px 18px;font-size:13px;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.print-only{display:none}
@media print{
  .no-print{display:none!important}.print-only{display:block}
  body{background:#fff;color:#000}
  .inv{max-width:640px;margin:0 auto;font-family:system-ui,Tahoma,sans-serif}
  .inv h1{font-size:22px;margin-bottom:8px}
  .inv-meta{display:flex;gap:18px;font-size:13px;margin-bottom:14px;color:#333;flex-wrap:wrap}
  .inv table{width:100%;border-collapse:collapse;font-size:13px}
  .inv th,.inv td{border:1px solid #999;padding:7px 9px;text-align:start}
  .inv ul{margin:6px 20px}
  .inv-total{margin-top:12px;font-size:16px;font-weight:800;text-align:end}
  .inv-foot{margin-top:20px;text-align:center;color:#555;font-size:12px}
  .receipt{max-width:300px;margin:0 auto;font-family:'Courier New',monospace;font-size:12px;color:#000}
  .receipt h2{text-align:center;font-size:16px;margin-bottom:4px}
  .receipt .r-row{display:flex;justify-content:space-between;padding:2px 0}
  .receipt hr{border:none;border-top:1px dashed #000;margin:6px 0}
}`;
}
