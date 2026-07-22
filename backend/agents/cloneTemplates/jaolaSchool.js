/**
 * 🏫 jaola-school — بوّابة مدرسة *عاملة* بأدوار وصلاحيات.
 *
 * ثلاثة أدوار: طالب (يرى جدوله + درجاته + واجباته + الإعلانات) · معلّم (يرصد
 * الدرجات + يضيف واجباً + ينشر إعلاناً) · مدير (إحصاءات + كل الطلاب + الإعلانات).
 * لوحات الطاقم *مخفيّة* عن الطالب — الدخول يوجّه كل حساب لصفحته حسب دوره.
 *
 * حالة في localStorage، كل الدوال معرّفة (تفويض أحداث)، يجتاز التحقّق السلوكي 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>مدرسة jaola</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">🏫 <span id="brandName">مدرسة jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn" id="authBtn" data-action="openAuth">دخول</button>
  </header>

  <main>
    <!-- الطالب: الرئيسية -->
    <section id="view-home" class="view">
      <h2 class="sec-title">أهلاً بك <span id="studentName"></span></h2>
      <div class="grid2">
        <div class="panel">
          <h3>📢 الإعلانات</h3>
          <div id="homeAnnounce" class="mini-list"></div>
        </div>
        <div class="panel">
          <h3>📅 حصص اليوم</h3>
          <div id="homeToday" class="mini-list"></div>
        </div>
      </div>
    </section>

    <!-- الطالب: الجدول -->
    <section id="view-schedule" class="view hidden">
      <h2 class="sec-title">الجدول الأسبوعي</h2>
      <div class="table-wrap"><table id="scheduleTable" class="grid-table"></table></div>
    </section>

    <!-- الطالب: الدرجات -->
    <section id="view-grades" class="view hidden">
      <h2 class="sec-title">درجاتي</h2>
      <div id="gradesList" class="mini-list"></div>
      <div class="gpa" id="gpaBox"></div>
    </section>

    <!-- الطالب: الواجبات -->
    <section id="view-assignments" class="view hidden">
      <h2 class="sec-title">الواجبات</h2>
      <div id="assignList" class="mini-list"></div>
    </section>

    <!-- المعلّم -->
    <section id="view-teacher" class="view hidden">
      <h2 class="sec-title">لوحة المعلّم</h2>
      <div class="stat-row" id="teacherStats"></div>
      <div class="panel">
        <h3>رصد درجة</h3>
        <div class="form-row">
          <select id="grStudent" class="sel"></select>
          <select id="grSubject" class="sel"></select>
          <input id="grScore" type="number" min="0" max="100" placeholder="الدرجة /100">
          <button class="btn primary" data-action="addGrade">رصد</button>
        </div>
      </div>
      <div class="panel">
        <h3>إضافة واجب</h3>
        <div class="form-row">
          <select id="asSubject" class="sel"></select>
          <input id="asTitle" placeholder="عنوان الواجب">
          <input id="asDue" type="date">
          <button class="btn primary" data-action="addAssignment">إضافة</button>
        </div>
      </div>
      <div class="panel">
        <h3>نشر إعلان</h3>
        <div class="form-row">
          <input id="anText" placeholder="نص الإعلان">
          <button class="btn primary" data-action="addAnnounce">نشر</button>
        </div>
      </div>
    </section>

    <!-- المدير -->
    <section id="view-admin" class="view hidden">
      <h2 class="sec-title">لوحة الإدارة</h2>
      <div class="stat-row" id="adminStats"></div>
      <div class="panel">
        <h3>الطلاب</h3>
        <div id="adminStudents" class="mini-list"></div>
      </div>
      <div class="panel">
        <h3>الإعلانات المنشورة</h3>
        <div id="adminAnnounce" class="mini-list"></div>
      </div>
    </section>
  </main>

  <div id="authModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="closeAuth">×</button>
      <h2 id="authTitle">تسجيل الدخول</h2>
      <p class="hint" id="authHint"></p>
      <input id="auName" placeholder="اسم المستخدم">
      <input id="auPass" type="password" placeholder="كلمة المرور">
      <p id="authErr" class="err-msg hidden">بيانات غير صحيحة.</p>
      <button class="btn primary block" data-action="submitAuth" id="authSubmit">دخول</button>
      <p class="demo">حسابات تجربة: <code>admin/1234</code> · <code>teacher/1234</code> · <code>student/1234</code></p>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🏫 منطق بوّابة المدرسة — كل الدوال معرّفة، تفويض أحداث، صلاحيات.
'use strict';

const STAFF = {
  admin:   { pass: '1234', role: 'admin',   name: 'إدارة المدرسة' },
  teacher: { pass: '1234', role: 'teacher', name: 'أ. أحمد' },
  student: { pass: '1234', role: 'student', name: 'سالم' },
};
const SUBJECTS = ['الرياضيات', 'العلوم', 'اللغة العربية', 'الإنجليزية', 'الحاسب'];
const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const PERIODS = ['1', '2', '3', '4', '5'];
const SEED_STUDENTS = ['سالم', 'نورة', 'فهد', 'ليان'];

// جدول ثابت: [يوم][حصّة] = مادة
const SCHEDULE = [
  ['الرياضيات', 'العلوم', 'اللغة العربية', 'الإنجليزية', 'الحاسب'],
  ['العلوم', 'الرياضيات', 'الحاسب', 'اللغة العربية', 'الإنجليزية'],
  ['اللغة العربية', 'الإنجليزية', 'الرياضيات', 'الحاسب', 'العلوم'],
  ['الإنجليزية', 'الحاسب', 'العلوم', 'الرياضيات', 'اللغة العربية'],
  ['الحاسب', 'اللغة العربية', 'الإنجليزية', 'العلوم', 'الرياضيات'],
];

const state = { user: null, view: 'home', authMode: 'login' };

function load(key, fb) { try { var v = localStorage.getItem('jsch_' + key); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function save(key, val) { try { localStorage.setItem('jsch_' + key, JSON.stringify(val)); } catch {} }

let grades = load('grades', [
  { student: 'سالم', subject: 'الرياضيات', score: 92 },
  { student: 'سالم', subject: 'العلوم', score: 85 },
  { student: 'سالم', subject: 'اللغة العربية', score: 78 },
]);
let assignments = load('assignments', [
  { id: 'a1', subject: 'الرياضيات', title: 'تمارين الفصل الثالث', due: '' },
  { id: 'a2', subject: 'العلوم', title: 'تقرير عن الخلية', due: '' },
]);
let announcements = load('announcements', [
  { id: 'n1', text: 'اجتماع أولياء الأمور الخميس القادم.', at: '' },
  { id: 'n2', text: 'بداية الاختبارات الأسبوع المقبل.', at: '' },
]);

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function uid(p) { return p + Math.random().toString(36).slice(2, 7); }
function todayIdx() { var d = new Date().getDay(); return d >= 0 && d <= 4 ? d : 0; } // الأحد..الخميس
function studentName() { return state.user && state.user.role === 'student' ? state.user.name : 'سالم'; }
function toast(msg) {
  var t = byId('toast'); if (!t) return;
  t.textContent = msg; show(t, true);
  clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2300);
}

/* ---------- الصلاحيات ---------- */
function renderTabs() {
  var role = state.user && state.user.role;
  var tabs;
  if (role === 'teacher') tabs = [{ id: 'teacher', label: 'لوحة المعلّم' }];
  else if (role === 'admin') tabs = [{ id: 'admin', label: 'الإدارة' }];
  else tabs = [{ id: 'home', label: 'الرئيسية' }, { id: 'schedule', label: 'الجدول' }, { id: 'grades', label: 'الدرجات' }, { id: 'assignments', label: 'الواجبات' }];
  byId('tabs').innerHTML = tabs.map(function (t) {
    return '<button class="tab ' + (state.view === t.id ? 'active' : '') + '" data-action="tab" data-view="' + t.id + '">' + t.label + '</button>';
  }).join('');
}
function applyAccess() {
  var role = state.user && state.user.role;
  var isStudent = !role || role === 'student';
  show(byId('view-home'), state.view === 'home' && isStudent);
  show(byId('view-schedule'), state.view === 'schedule' && isStudent);
  show(byId('view-grades'), state.view === 'grades' && isStudent);
  show(byId('view-assignments'), state.view === 'assignments' && isStudent);
  show(byId('view-teacher'), state.view === 'teacher' && role === 'teacher');
  show(byId('view-admin'), state.view === 'admin' && role === 'admin');
  var btn = byId('authBtn');
  if (btn) btn.textContent = state.user ? ('خروج (' + state.user.name + ')') : 'دخول';
  renderTabs();
}
function setView(view) {
  var role = state.user && state.user.role;
  var isStudent = !role || role === 'student';
  if ((view === 'teacher' && role !== 'teacher') || (view === 'admin' && role !== 'admin')) view = 'home';
  if (['home', 'schedule', 'grades', 'assignments'].indexOf(view) !== -1 && !isStudent) view = role === 'teacher' ? 'teacher' : 'admin';
  state.view = view;
  applyAccess();
  if (view === 'home') renderHome();
  if (view === 'schedule') renderSchedule();
  if (view === 'grades') renderGrades();
  if (view === 'assignments') renderAssignments();
  if (view === 'teacher') renderTeacher();
  if (view === 'admin') renderAdmin();
}

/* ---------- الطالب ---------- */
function renderHome() {
  byId('studentName').textContent = studentName();
  byId('homeAnnounce').innerHTML = announcements.length ? announcements.slice().reverse().map(function (n) {
    return '<div class="mini-row"><span>📢 ' + n.text + '</span></div>';
  }).join('') : '<p class="empty">لا إعلانات.</p>';
  var today = SCHEDULE[todayIdx()];
  byId('homeToday').innerHTML = today.map(function (subj, i) {
    return '<div class="mini-row"><span>الحصّة ' + PERIODS[i] + '</span><span class="pill">' + subj + '</span></div>';
  }).join('');
}
function renderSchedule() {
  var head = '<tr><th>الحصّة</th>' + DAYS.map(function (d) { return '<th>' + d + '</th>'; }).join('') + '</tr>';
  var rows = PERIODS.map(function (p, pi) {
    return '<tr><td class="period">' + p + '</td>' + DAYS.map(function (d, di) {
      return '<td>' + SCHEDULE[di][pi] + '</td>';
    }).join('') + '</tr>';
  }).join('');
  byId('scheduleTable').innerHTML = head + rows;
}
function myGrades() { var n = studentName(); return grades.filter(function (g) { return g.student === n; }); }
function renderGrades() {
  var mine = myGrades();
  byId('gradesList').innerHTML = mine.length ? mine.map(function (g) {
    var cls = g.score >= 85 ? 'ok' : (g.score >= 60 ? 'wait' : 'bad');
    return '<div class="mini-row"><span>' + g.subject + '</span>' +
      '<span class="score ' + cls + '">' + g.score + '/100</span></div>';
  }).join('') : '<p class="empty">لا درجات مرصودة بعد.</p>';
  if (mine.length) {
    var avg = Math.round(mine.reduce(function (s, g) { return s + g.score; }, 0) / mine.length);
    byId('gpaBox').innerHTML = 'المعدّل العام: <b>' + avg + '/100</b>';
  } else byId('gpaBox').innerHTML = '';
}
function renderAssignments() {
  byId('assignList').innerHTML = assignments.length ? assignments.slice().reverse().map(function (a) {
    return '<div class="mini-row"><span>📝 ' + a.title + '</span>' +
      '<span class="pill">' + a.subject + (a.due ? ' · تسليم ' + a.due : '') + '</span></div>';
  }).join('') : '<p class="empty">لا واجبات حالياً.</p>';
}

/* ---------- المعلّم ---------- */
function fillTeacherSelects() {
  byId('grStudent').innerHTML = SEED_STUDENTS.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
  var subjOpts = SUBJECTS.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
  byId('grSubject').innerHTML = subjOpts;
  byId('asSubject').innerHTML = subjOpts;
}
function renderTeacher() {
  fillTeacherSelects();
  byId('teacherStats').innerHTML =
    stat('الطلاب', SEED_STUDENTS.length) + stat('الدرجات', grades.length) +
    stat('الواجبات', assignments.length) + stat('الإعلانات', announcements.length);
}
function addGrade() {
  var st = byId('grStudent').value, subj = byId('grSubject').value, score = Number(byId('grScore').value);
  if (!(score >= 0 && score <= 100)) { toast('أدخل درجة صحيحة 0-100'); return; }
  var ex = grades.find(function (g) { return g.student === st && g.subject === subj; });
  if (ex) ex.score = score; else grades.push({ student: st, subject: subj, score: score });
  save('grades', grades); byId('grScore').value = '';
  renderTeacher(); toast('رُصدت درجة ' + st);
}
function addAssignment() {
  var subj = byId('asSubject').value, title = (byId('asTitle').value || '').trim(), due = byId('asDue').value || '';
  if (!title) { toast('اكتب عنوان الواجب'); return; }
  assignments.push({ id: uid('a'), subject: subj, title: title, due: due });
  save('assignments', assignments); byId('asTitle').value = '';
  renderTeacher(); toast('أُضيف الواجب');
}
function addAnnounce() {
  var text = (byId('anText').value || '').trim();
  if (!text) { toast('اكتب نص الإعلان'); return; }
  announcements.push({ id: uid('n'), text: text, at: '' });
  save('announcements', announcements); byId('anText').value = '';
  renderTeacher(); toast('نُشر الإعلان');
}

/* ---------- المدير ---------- */
function renderAdmin() {
  var avgAll = grades.length ? Math.round(grades.reduce(function (s, g) { return s + g.score; }, 0) / grades.length) : 0;
  byId('adminStats').innerHTML =
    stat('الطلاب', SEED_STUDENTS.length) + stat('المواد', SUBJECTS.length) +
    stat('متوسّط الدرجات', avgAll) + stat('الإعلانات', announcements.length);
  byId('adminStudents').innerHTML = SEED_STUDENTS.map(function (s) {
    var gs = grades.filter(function (g) { return g.student === s; });
    var avg = gs.length ? Math.round(gs.reduce(function (a, g) { return a + g.score; }, 0) / gs.length) : '—';
    return '<div class="mini-row"><span>👤 ' + s + '</span><span class="pill">المعدّل: ' + avg + '</span></div>';
  }).join('');
  byId('adminAnnounce').innerHTML = announcements.length ? announcements.slice().reverse().map(function (n) {
    return '<div class="mini-row"><span>📢 ' + n.text + '</span>' +
      '<button class="icon-btn" data-action="delAnnounce" data-id="' + n.id + '">🗑</button></div>';
  }).join('') : '<p class="empty">لا إعلانات.</p>';
}
function delAnnounce(id) { announcements = announcements.filter(function (n) { return n.id !== id; }); save('announcements', announcements); renderAdmin(); }
function stat(label, val) { return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-label">' + label + '</div></div>'; }

/* ---------- الدخول/التوجيه ---------- */
function openAuth(mode) {
  state.authMode = mode || 'login';
  byId('authTitle').textContent = 'تسجيل الدخول';
  byId('authHint').textContent = 'ادخل بحسابك لتُوجَّه لصفحتك حسب دورك.';
  show(byId('authErr'), false); byId('auName').value = ''; byId('auPass').value = '';
  show(byId('authModal'), true);
}
function closeAuth() { show(byId('authModal'), false); }
function routeByRole() {
  if (!state.user) return setView('home');
  if (state.user.role === 'admin') return setView('admin');
  if (state.user.role === 'teacher') return setView('teacher');
  return setView('home');
}
function submitAuth() {
  var name = (byId('auName').value || '').trim();
  var pass = (byId('auPass').value || '').trim();
  var acc = STAFF[name];
  if (acc && acc.pass === pass) {
    state.user = { name: acc.name, role: acc.role };
    closeAuth(); applyAccess(); toast('مرحباً ' + acc.name); routeByRole();
  } else { show(byId('authErr'), true); }
}
function logout() { state.user = null; state.view = 'home'; applyAccess(); setView('home'); toast('تم تسجيل الخروج'); }

/* ---------- التفويض ---------- */
function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'addGrade': addGrade(); break;
    case 'addAssignment': addAssignment(); break;
    case 'addAnnounce': addAnnounce(); break;
    case 'delAnnounce': delAnnounce(a.dataset.id); break;
    case 'openAuth': state.user ? logout() : openAuth('login'); break;
    case 'closeAuth': closeAuth(); break;
    case 'submitAuth': submitAuth(); break;
  }
}

function init() {
  document.addEventListener('click', handleClick);
  applyAccess();
  renderHome();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0d1220;--surface:#141b2b;--card:#1a2334;--accent:#0ea5e9;--good:#22c55e;--warn:#f59e0b;--bad:#ef4444;--text:#e8edf6;--muted:#8b97ad;--border:#26314a;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;align-items:center;gap:16px;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border);flex-wrap:wrap;position:sticky;top:0;z-index:30}
.brand{font-size:19px;font-weight:800;white-space:nowrap}
.tabs{flex:1;display:flex;gap:6px;flex-wrap:wrap}
.tab{background:transparent;border:1px solid transparent;color:var(--muted);padding:7px 13px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.tab.active{background:var(--card);color:var(--text);border-color:var(--border)}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#04283a}
.btn.block{width:100%;margin-top:6px}
.icon-btn{background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer}
main{max-width:1040px;margin:0 auto;padding:20px 18px}
.sec-title{margin-bottom:16px;font-size:18px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:720px){.grid2{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px}
.panel h3{margin-bottom:12px;font-size:15px}
.form-row{display:flex;gap:8px;flex-wrap:wrap}
.form-row input,.form-row select,.sel{flex:1;min-width:120px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text)}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px}
.pill{font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--border);color:var(--muted)}
.score{font-weight:800;font-size:14px}
.score.ok{color:var(--good)}.score.wait{color:var(--warn)}.score.bad{color:var(--bad)}
.gpa{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center;margin-top:6px;font-size:15px}
.gpa b{color:var(--accent);font-size:18px}
.table-wrap{overflow-x:auto}
.grid-table{width:100%;border-collapse:collapse;min-width:520px}
.grid-table th,.grid-table td{border:1px solid var(--border);padding:10px;text-align:center;font-size:13px}
.grid-table th{background:var(--surface);color:var(--muted);font-weight:700}
.grid-table td{background:var(--card)}
.grid-table .period{background:var(--surface);font-weight:800;color:var(--accent)}
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:22px;font-weight:800;color:var(--accent)}
.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.empty{text-align:center;color:var(--muted);padding:20px}
.hidden{display:none !important}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(400px,100%);position:relative}
.close-x{position:absolute;top:12px;left:14px;font-size:22px}
.modal-box h2{font-size:19px;margin-bottom:6px}
.hint{color:var(--muted);font-size:13px;margin-bottom:14px}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text);margin-bottom:10px}
.err-msg{color:#ef4444;font-size:13px;margin-bottom:8px}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px;line-height:1.9}
.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--accent);color:#04283a;padding:11px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:70;box-shadow:0 8px 24px rgba(0,0,0,.4)}
h2,h3{color:var(--text)}
`;

export function jaolaSchool() {
    return {
        id: 'jaola-school',
        category: 'education',
        name: 'بوّابة مدرسة',
        description: 'بوّابة مدرسة عاملة بثلاثة أدوار وصلاحيات: طالب (جدول+درجات+واجبات+إعلانات) · معلّم (رصد درجات+إضافة واجب+نشر إعلان) · مدير (إحصاءات+الطلاب+الإعلانات). لوحات مخفيّة عن الطالب، توجيه بالدور.',
        keywords: ['مدرسة', 'مدارس', 'school', 'طلاب', 'معلم', 'معلّم', 'درجات', 'جدول حصص', 'واجبات', 'بوابة مدرسية', 'تعليم مدرسي', 'صف', 'حصص', 'روضة', 'ثانوية'],
        model: {
            entities: [
                { name: 'Grade', fields: [{ name: 'student', type: 'string' }, { name: 'subject', type: 'string' }, { name: 'score', type: 'number' }], ownedBy: 'Teacher' },
                { name: 'Assignment', fields: [{ name: 'id', type: 'string' }, { name: 'subject', type: 'string' }, { name: 'title', type: 'string' }, { name: 'due', type: 'string' }], ownedBy: 'Teacher' },
                { name: 'Announcement', fields: [{ name: 'id', type: 'string' }, { name: 'text', type: 'string' }], ownedBy: 'Admin' },
            ],
            roles: [
                { name: 'Student', description: 'يتابع دراسته', capabilities: ['عرض الجدول', 'عرض الدرجات', 'عرض الواجبات', 'قراءة الإعلانات'] },
                { name: 'Teacher', description: 'يدير صفّه', capabilities: ['رصد درجة', 'إضافة واجب', 'نشر إعلان'] },
                { name: 'Admin', description: 'يدير المدرسة', capabilities: ['إحصاءات', 'عرض الطلاب', 'إدارة الإعلانات'] },
            ],
            flows: [
                { name: 'متابعة الطالب', actor: 'Student', steps: ['يدخل → الرئيسية', 'يرى الجدول والدرجات والواجبات والإعلانات'], touches: ['Grade', 'Assignment', 'Announcement'], realtime: false },
                { name: 'إدارة الصف', actor: 'Teacher', steps: ['يدخل → لوحة المعلّم', 'يرصد درجة', 'يضيف واجباً', 'ينشر إعلاناً'], touches: ['Grade', 'Assignment', 'Announcement'], realtime: false },
                { name: 'الإشراف', actor: 'Admin', steps: ['يدخل → الإدارة', 'يرى الطلاب والإحصاءات', 'يدير الإعلانات'], touches: ['Announcement'], realtime: false },
            ],
            _source: 'clone',
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: STYLES_CSS },
        ],
    };
}
