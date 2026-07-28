/**
 * 👥 jaola-hr — نظام موارد بشرية داخلي (track: system).
 *
 * موظفون، حضور وانصراف يومي، إجازات بموافقة، رواتب شهرية بقسائم قابلة
 * للطباعة. أدوار: مدير (كل شيء + موافقات + رواتب) / موظف (حضوره وإجازاته).
 * بلا اعتماد خارجي. الحالة في localStorage (jhr_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaHr() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام الموارد البشرية</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">👥</span> <span id="brandName">شركة jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام الموارد البشرية</h1>
        <p class="hint">موظفون · حضور · إجازات · رواتب بقسائم.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="manager">مدير</option><option value="employee">موظف</option></select>
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
      <div class="panel"><h3>الحاضرون اليوم</h3><div id="todayPresent"></div></div>
    </section>

    <section id="view-employees" class="view hidden">
      <div class="view-head"><h2>الموظفون</h2></div>
      <div class="panel form-row">
        <input id="emName" placeholder="الاسم">
        <input id="emRole" placeholder="المسمّى الوظيفي">
        <input id="emDept" placeholder="القسم">
        <input id="emSalary" type="number" placeholder="الراتب الأساسي" min="0">
        <button class="btn primary" data-action="addEmployee">إضافة موظف</button>
      </div>
      <div class="panel"><table class="tbl" id="employeesTable"></table></div>
    </section>

    <section id="view-attendance" class="view hidden">
      <div class="view-head"><h2>الحضور والانصراف</h2></div>
      <div class="panel form-row">
        <select id="atEmployee"></select>
        <button class="btn primary" data-action="checkIn">تسجيل حضور اليوم</button>
        <button class="btn ghost" data-action="checkOut">تسجيل انصراف</button>
      </div>
      <div class="panel"><table class="tbl" id="attendanceTable"></table></div>
    </section>

    <section id="view-leaves" class="view hidden">
      <div class="view-head"><h2>الإجازات</h2></div>
      <div class="panel form-row">
        <select id="lvEmployee"></select>
        <input id="lvFrom" type="date">
        <input id="lvTo" type="date">
        <input id="lvReason" placeholder="السبب">
        <button class="btn primary" data-action="requestLeave">طلب إجازة</button>
      </div>
      <div class="panel"><table class="tbl" id="leavesTable"></table></div>
    </section>

    <section id="view-payroll" class="view hidden">
      <div class="view-head"><h2>الرواتب</h2></div>
      <div class="panel form-row">
        <select id="pyEmployee"></select>
        <input id="pyBonus" type="number" placeholder="بدلات/مكافأة" min="0">
        <input id="pyDeduct" type="number" placeholder="خصومات" min="0">
        <button class="btn primary" data-action="runPayroll">إصدار قسيمة راتب</button>
      </div>
      <div class="panel"><table class="tbl" id="payrollTable"></table></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم الشركة</label><input id="stName">
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

    const APP_JS = `/* 👥 نظام الموارد البشرية — jaola-hr */
const SEED_EMPLOYEES = [
  { id: 'e1', name: 'الموظف الأول', role: 'محاسب', dept: 'المالية', salary: 6000 },
  { id: 'e2', name: 'الموظفة الثانية', role: 'مسوّقة', dept: 'التسويق', salary: 5500 }
];
const ROLES = {
  manager: { name: 'المدير', tabs: ['dashboard', 'employees', 'attendance', 'leaves', 'payroll', 'settings'] },
  employee: { name: 'الموظف', tabs: ['dashboard', 'attendance', 'leaves'] }
};
const TAB_LABELS = { dashboard: 'اللوحة', employees: 'الموظفون', attendance: 'الحضور', leaves: 'الإجازات', payroll: 'الرواتب', settings: 'الإعدادات' };

function load(k, fb) { try { var v = localStorage.getItem('jhr_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jhr_' + k, JSON.stringify(val)); } catch (e) {} }
let employees = load('employees', SEED_EMPLOYEES);
let attendance = load('attendance', []);
let leaves = load('leaves', []);
let payslips = load('payslips', []);
let settings = load('settings', { name: 'شركة jaola', currency: 'ر.س', pass: 'admin' });
let state = { user: null, view: 'login' };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function nowTime() { return new Date().toTimeString().slice(0, 5); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2600); }
function empById(id) { for (var i = 0; i < employees.length; i++) if (employees[i].id === id) return employees[i]; return null; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'dashboard') renderDashboard();
  if (v === 'employees') renderEmployees();
  if (v === 'attendance') renderAttendance();
  if (v === 'leaves') renderLeaves();
  if (v === 'payroll') renderPayroll();
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
  var t = today();
  var present = attendance.filter(function (a) { return a.date === t && a.in; });
  var pendingLeaves = leaves.filter(function (l) { return l.status === 'pending'; });
  var totalSalaries = 0; for (var i = 0; i < employees.length; i++) totalSalaries += employees[i].salary;
  byId('dashStats').innerHTML =
    statCard('إجمالي الموظفين', String(employees.length), '') +
    statCard('حاضرون اليوم', String(present.length), 'ok') +
    statCard('إجازات معلّقة', String(pendingLeaves.length), pendingLeaves.length ? 'warn' : '') +
    statCard('كتلة الرواتب', money(totalSalaries), '');
  byId('todayPresent').innerHTML = present.length
    ? present.map(function (a) { var e = empById(a.eid); return '<div class="low-row">✅ <b>' + esc(e ? e.name : '؟') + '</b> — حضور ' + esc(a.in) + (a.out ? ' · انصراف ' + esc(a.out) : '') + '</div>'; }).join('')
    : '<p class="hint">لا حضور مسجّل اليوم.</p>';
}

function fillEmpSelects() {
  var opts = employees.map(function (e) { return '<option value="' + e.id + '">' + esc(e.name) + ' — ' + esc(e.dept) + '</option>'; }).join('');
  ['atEmployee', 'lvEmployee', 'pyEmployee'].forEach(function (id) { var el = byId(id); if (el) el.innerHTML = opts; });
}
function renderEmployees() {
  var rows = employees.map(function (e) {
    return '<tr><td>' + esc(e.name) + '</td><td>' + esc(e.role) + '</td><td>' + esc(e.dept) + '</td><td>' + money(e.salary) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delEmployee" data-id="' + e.id + '">حذف</button></td></tr>';
  }).join('');
  byId('employeesTable').innerHTML = '<tr><th>الاسم</th><th>المسمّى</th><th>القسم</th><th>الراتب</th><th></th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا موظفين بعد.</td></tr>');
  fillEmpSelects();
}
function addEmployee() {
  var name = byId('emName').value.trim(); if (!name) { toast('اكتب اسم الموظف'); return; }
  employees.push({ id: uid('e'), name: name, role: byId('emRole').value.trim() || 'موظف', dept: byId('emDept').value.trim() || 'عام', salary: Math.max(0, parseFloat(byId('emSalary').value) || 0) });
  save('employees', employees);
  byId('emName').value = ''; byId('emRole').value = ''; byId('emDept').value = ''; byId('emSalary').value = '';
  toast('أُضيف الموظف'); renderEmployees();
}
function delEmployee(id) { employees = employees.filter(function (e) { return e.id !== id; }); save('employees', employees); renderEmployees(); }

function renderAttendance() {
  fillEmpSelects();
  var rows = attendance.slice().reverse().slice(0, 60).map(function (a) {
    var e = empById(a.eid);
    return '<tr><td>' + a.date + '</td><td>' + esc(e ? e.name : '؟') + '</td><td>' + esc(a.in || '—') + '</td><td>' + esc(a.out || '—') + '</td></tr>';
  }).join('');
  byId('attendanceTable').innerHTML = '<tr><th>التاريخ</th><th>الموظف</th><th>حضور</th><th>انصراف</th></tr>' +
    (rows || '<tr><td colspan="4" class="hint">لا سجل حضور بعد.</td></tr>');
}
function todayRec(eid) { var t = today(); for (var i = 0; i < attendance.length; i++) if (attendance[i].eid === eid && attendance[i].date === t) return attendance[i]; return null; }
function checkIn() {
  var eid = byId('atEmployee').value; if (!eid) { toast('اختر الموظف'); return; }
  if (todayRec(eid)) { toast('مسجّل حضوره اليوم بالفعل'); return; }
  attendance.push({ id: uid('a'), eid: eid, date: today(), in: nowTime(), out: '' });
  save('attendance', attendance); toast('سُجّل الحضور'); renderAttendance();
}
function checkOut() {
  var eid = byId('atEmployee').value; var r = todayRec(eid);
  if (!r) { toast('لا حضور مسجّل اليوم'); return; }
  r.out = nowTime(); save('attendance', attendance); toast('سُجّل الانصراف'); renderAttendance();
}

function renderLeaves() {
  fillEmpSelects();
  var canApprove = state.user && state.user.role === 'manager';
  var rows = leaves.slice().reverse().slice(0, 60).map(function (l) {
    var e = empById(l.eid);
    var badge = l.status === 'approved' ? '<span style="color:var(--ok)">موافَق</span>' : l.status === 'rejected' ? '<span style="color:var(--bad)">مرفوض</span>' : '<span style="color:var(--warn)">معلّق</span>';
    var actions = (canApprove && l.status === 'pending')
      ? '<button class="btn tiny primary" data-action="approveLeave" data-id="' + l.id + '">موافقة</button> <button class="btn tiny ghost" data-action="rejectLeave" data-id="' + l.id + '">رفض</button>'
      : '';
    return '<tr><td>' + esc(e ? e.name : '؟') + '</td><td>' + l.from + '</td><td>' + l.to + '</td><td>' + esc(l.reason || '—') + '</td><td>' + badge + '</td><td>' + actions + '</td></tr>';
  }).join('');
  byId('leavesTable').innerHTML = '<tr><th>الموظف</th><th>من</th><th>إلى</th><th>السبب</th><th>الحالة</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا طلبات إجازة بعد.</td></tr>');
}
function requestLeave() {
  var eid = byId('lvEmployee').value; var from = byId('lvFrom').value, to = byId('lvTo').value;
  if (!eid || !from || !to) { toast('اختر الموظف والتواريخ'); return; }
  leaves.push({ id: uid('l'), eid: eid, from: from, to: to, reason: byId('lvReason').value.trim(), status: 'pending' });
  save('leaves', leaves); byId('lvReason').value = ''; toast('قُدّم طلب الإجازة'); renderLeaves();
}
function setLeave(id, status) { for (var i = 0; i < leaves.length; i++) if (leaves[i].id === id) leaves[i].status = status; save('leaves', leaves); toast(status === 'approved' ? 'تمت الموافقة' : 'رُفض الطلب'); renderLeaves(); }

function renderPayroll() {
  fillEmpSelects();
  var rows = payslips.slice().reverse().slice(0, 60).map(function (s) {
    var e = empById(s.eid);
    return '<tr><td>' + s.month + '</td><td>' + esc(e ? e.name : '؟') + '</td><td>' + money(s.base) + '</td><td>' + money(s.bonus) + '</td><td>' + money(s.deduct) + '</td><td>' + money(s.net) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="printPayslip" data-id="' + s.id + '">🖨️ القسيمة</button></td></tr>';
  }).join('');
  byId('payrollTable').innerHTML = '<tr><th>الشهر</th><th>الموظف</th><th>الأساسي</th><th>بدلات</th><th>خصومات</th><th>الصافي</th><th></th></tr>' +
    (rows || '<tr><td colspan="7" class="hint">لا قسائم بعد.</td></tr>');
}
function runPayroll() {
  var eid = byId('pyEmployee').value; var e = empById(eid); if (!e) { toast('اختر الموظف'); return; }
  var bonus = parseFloat(byId('pyBonus').value) || 0, deduct = parseFloat(byId('pyDeduct').value) || 0;
  var month = today().slice(0, 7);
  var net = e.salary + bonus - deduct;
  payslips.push({ id: uid('s'), eid: eid, month: month, base: e.salary, bonus: bonus, deduct: deduct, net: net });
  save('payslips', payslips); byId('pyBonus').value = ''; byId('pyDeduct').value = '';
  toast('صدرت قسيمة راتب ' + e.name); renderPayroll();
}
function printPayslip(id) {
  var s = null; for (var i = 0; i < payslips.length; i++) if (payslips[i].id === id) s = payslips[i];
  if (!s) return; var e = empById(s.eid);
  byId('printArea').innerHTML = '<div class="inv"><h1>' + esc(settings.name) + '</h1>' +
    '<div class="inv-meta"><span>قسيمة راتب</span><span>شهر ' + s.month + '</span></div>' +
    '<p><b>الموظف:</b> ' + esc(e ? e.name : '؟') + ' — ' + esc(e ? e.role : '') + ' (' + esc(e ? e.dept : '') + ')</p>' +
    '<table><tr><th>البند</th><th>المبلغ</th></tr>' +
    '<tr><td>الراتب الأساسي</td><td>' + money(s.base) + '</td></tr>' +
    '<tr><td>بدلات ومكافآت</td><td>' + money(s.bonus) + '</td></tr>' +
    '<tr><td>خصومات</td><td>- ' + money(s.deduct) + '</td></tr></table>' +
    '<p class="inv-total">صافي الراتب: ' + money(s.net) + '</p>' +
    '<p class="inv-foot">هذه قسيمة رسمية صادرة من نظام الموارد البشرية</p></div>';
  window.print();
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
    case 'addEmployee': addEmployee(); break;
    case 'delEmployee': delEmployee(a.dataset.id); break;
    case 'checkIn': checkIn(); break;
    case 'checkOut': checkOut(); break;
    case 'requestLeave': requestLeave(); break;
    case 'approveLeave': setLeave(a.dataset.id, 'approved'); break;
    case 'rejectLeave': setLeave(a.dataset.id, 'rejected'); break;
    case 'runPayroll': runPayroll(); break;
    case 'printPayslip': printPayslip(a.dataset.id); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    return {
        id: 'jaola-hr',
        track: 'system',
        category: 'system',
        name: 'نظام موارد بشرية',
        nameEn: 'HR System',
        description: 'سيستم موارد بشرية داخلي: ملفات الموظفين، حضور وانصراف يومي، إجازات بموافقة المدير، رواتب شهرية بقسائم قابلة للطباعة — بأدوار (مدير/موظف).',
        descriptionEn: 'Internal HR system: employee records, daily attendance, manager-approved leaves, monthly payroll with printable payslips — with roles (manager/employee).',
        keywords: ['موارد بشرية', 'موظفين', 'موظفون', 'رواتب', 'راتب', 'حضور وانصراف', 'حضور', 'انصراف', 'إجازات', 'اجازات', 'قسيمة راتب', 'كشف رواتب', 'شؤون موظفين', 'hr', 'payroll', 'attendance', 'employees', 'leave', 'human resources'],
        model: {
            roles: [{ name: 'مدير' }, { name: 'موظف' }],
            entities: [{ name: 'موظف' }, { name: 'سجل حضور' }, { name: 'طلب إجازة' }, { name: 'قسيمة راتب' }],
            flows: [{ name: 'إضافة موظف' }, { name: 'تسجيل حضور وانصراف' }, { name: 'طلب إجازة بموافقة المدير' }, { name: 'إصدار قسيمة راتب قابلة للطباعة' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() },
        ],
    };
}
