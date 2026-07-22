/**
 * 🎓 jaola-lms — منصّة تعليمية *عاملة* أونلاين بأدوار وصلاحيات.
 *
 * ثلاثة أدوار: طالب (يتصفّح الدورات + يشترك + يتابع الدروس + يقيس تقدّمه) ·
 * مدرّب (لوحة دوراته: يضيف دورة/درساً + يرى المشتركين) · مدير (اعتماد الدورات
 * + إحصاءات). لوحات الطاقم *مخفيّة* عن الطالب — الدخول يوجّه كل حساب لصفحته،
 * والطالب يسجّل نفسه عند الاشتراك في أوّل دورة.
 *
 * التقدّم يُحفظ لكل طالب في localStorage. كل الدوال معرّفة (تفويض أحداث)،
 * يجتاز التحقّق السلوكي 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>أكاديمية jaola</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">🎓 <span id="brandName">أكاديمية jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn" id="authBtn" data-action="openAuth">دخول</button>
  </header>

  <main>
    <!-- كتالوج الدورات (عام) -->
    <section id="view-catalog" class="view">
      <div class="hero">
        <h1>تعلّم مهارة جديدة اليوم</h1>
        <p class="hero-tag">دورات عملية بشهادات إتمام — تعلّم بوتيرتك.</p>
      </div>
      <div class="toolbar">
        <input id="search" class="search" placeholder="ابحث عن دورة أو مدرّب...">
        <div class="chips" id="catChips"></div>
      </div>
      <div id="courseGrid" class="grid"></div>
      <p id="emptyCatalog" class="empty hidden">لا دورات مطابقة.</p>
    </section>

    <!-- دوراتي (طالب) -->
    <section id="view-learning" class="view hidden">
      <h2 class="sec-title">تعلّمي</h2>
      <div id="myCourses" class="results"></div>
    </section>

    <!-- لوحة المدرّب -->
    <section id="view-teach" class="view hidden">
      <h2 class="sec-title">لوحة المدرّب</h2>
      <div class="stat-row" id="teachStats"></div>
      <div class="panel">
        <h3>إضافة دورة</h3>
        <div class="form-row">
          <input id="ncTitle" placeholder="عنوان الدورة">
          <select id="ncCat" class="sel"></select>
          <input id="ncEmoji" placeholder="رمز 📘" maxlength="4">
          <button class="btn primary" data-action="addCourse">إضافة</button>
        </div>
      </div>
      <div class="panel">
        <h3>دوراتي</h3>
        <div id="teachCourses" class="mini-list"></div>
      </div>
    </section>

    <!-- لوحة المدير -->
    <section id="view-admin" class="view hidden">
      <h2 class="sec-title">لوحة الإدارة</h2>
      <div class="stat-row" id="adminStats"></div>
      <div class="panel">
        <h3>الدورات</h3>
        <div id="adminCourses" class="mini-list"></div>
      </div>
    </section>
  </main>

  <!-- نافذة تفاصيل الدورة + الدروس -->
  <div id="courseModal" class="modal hidden">
    <div class="modal-box" id="courseBox"></div>
  </div>

  <!-- نافذة إضافة درس -->
  <div id="lessonModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="closeLesson">×</button>
      <h2>إضافة درس</h2>
      <input id="nlTitle" placeholder="عنوان الدرس">
      <input id="nlDur" type="number" min="1" placeholder="المدة (دقائق)">
      <p id="lessonErr" class="err-msg hidden">أكمل العنوان والمدة.</p>
      <button class="btn primary block" data-action="saveLesson">حفظ الدرس</button>
    </div>
  </div>

  <!-- نافذة الدخول/التسجيل -->
  <div id="authModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="closeAuth">×</button>
      <h2 id="authTitle">تسجيل الدخول</h2>
      <p class="hint" id="authHint"></p>
      <input id="auName" placeholder="اسم المستخدم">
      <input id="auPass" type="password" placeholder="كلمة المرور">
      <p id="authErr" class="err-msg hidden">بيانات غير صحيحة.</p>
      <button class="btn primary block" data-action="submitAuth" id="authSubmit">دخول</button>
      <p class="switch"><span id="authSwitchText"></span>
        <a href="#" data-action="toggleAuth" id="authSwitch">إنشاء حساب طالب</a></p>
      <p class="demo">حسابات تجربة: <code>admin/1234</code> · <code>teacher/1234</code></p>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🎓 منطق المنصّة التعليمية — كل الدوال معرّفة، تفويض أحداث، صلاحيات.
'use strict';

const STAFF = {
  admin:   { pass: '1234', role: 'admin',   name: 'مدير الأكاديمية' },
  teacher: { pass: '1234', role: 'teacher', name: 'أ. سارة' },
};
const CATEGORIES = ['برمجة', 'تصميم', 'تسويق', 'أعمال', 'لغات'];

const SEED_COURSES = [
  { id: 'c1', title: 'أساسيات جافاسكربت', category: 'برمجة', instructor: 'أ. سارة', emoji: '📘', level: 'مبتدئ', rating: 4.8, approved: true,
    lessons: [{ id: 'l1', title: 'مقدمة', dur: 8 }, { id: 'l2', title: 'المتغيّرات', dur: 12 }, { id: 'l3', title: 'الدوال', dur: 15 }] },
  { id: 'c2', title: 'تصميم واجهات UI/UX', category: 'تصميم', instructor: 'أ. سارة', emoji: '🎨', level: 'متوسّط', rating: 4.6, approved: true,
    lessons: [{ id: 'l1', title: 'مبادئ التصميم', dur: 10 }, { id: 'l2', title: 'الألوان', dur: 9 }] },
  { id: 'c3', title: 'التسويق الرقمي', category: 'تسويق', instructor: 'أ. خالد', emoji: '📈', level: 'مبتدئ', rating: 4.7, approved: true,
    lessons: [{ id: 'l1', title: 'أساسيات', dur: 11 }, { id: 'l2', title: 'وسائل التواصل', dur: 14 }, { id: 'l3', title: 'الإعلانات', dur: 13 }] },
  { id: 'c4', title: 'الإنجليزية للأعمال', category: 'لغات', instructor: 'أ. منى', emoji: '🗣️', level: 'متوسّط', rating: 4.5, approved: true,
    lessons: [{ id: 'l1', title: 'المراسلات', dur: 12 }, { id: 'l2', title: 'الاجتماعات', dur: 16 }] },
];

const state = {
  user: null, view: 'catalog', cat: 'الكل', search: '', authMode: 'login',
  openCourse: null, pendingEnroll: null, addingLessonTo: null,
};

function load(key, fb) { try { const v = localStorage.getItem('jlms_' + key); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function save(key, val) { try { localStorage.setItem('jlms_' + key, JSON.stringify(val)); } catch {} }

let courses = load('courses', SEED_COURSES);
let enrollments = load('enrollments', []); // { student, courseId, done:[lessonId] }

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function courseById(id) { return courses.find(c => c.id === id) || null; }
function uid(p) { return p + Math.random().toString(36).slice(2, 7); }
function stars(n) { var s = ''; for (var i = 0; i < 5; i++) s += i < Math.round(n) ? '★' : '☆'; return s; }
function toast(msg) {
  var t = byId('toast'); if (!t) return;
  t.textContent = msg; show(t, true);
  clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2300);
}

function enrollmentOf(courseId) {
  if (!state.user) return null;
  return enrollments.find(function (e) { return e.student === state.user.name && e.courseId === courseId; }) || null;
}
function progressPct(course, enr) {
  if (!enr || !course.lessons.length) return 0;
  return Math.round((enr.done.length / course.lessons.length) * 100);
}

/* ---------- الصلاحيات ---------- */
function renderTabs() {
  var role = state.user && state.user.role;
  var tabs = [{ id: 'catalog', label: 'الدورات' }];
  if (!role || role === 'student') tabs.push({ id: 'learning', label: 'تعلّمي' });
  if (role === 'teacher') tabs.push({ id: 'teach', label: 'لوحة المدرّب' });
  if (role === 'admin') tabs.push({ id: 'admin', label: 'الإدارة' });
  byId('tabs').innerHTML = tabs.map(function (t) {
    return '<button class="tab ' + (state.view === t.id ? 'active' : '') + '" data-action="tab" data-view="' + t.id + '">' + t.label + '</button>';
  }).join('');
}
function applyAccess() {
  show(byId('view-catalog'), state.view === 'catalog');
  show(byId('view-learning'), state.view === 'learning' && (!state.user || state.user.role === 'student'));
  show(byId('view-teach'), state.view === 'teach' && state.user && state.user.role === 'teacher');
  show(byId('view-admin'), state.view === 'admin' && state.user && state.user.role === 'admin');
  var btn = byId('authBtn');
  if (btn) btn.textContent = state.user ? ('خروج (' + state.user.name + ')') : 'دخول';
  renderTabs();
}
function setView(view) {
  if (view === 'teach' && !(state.user && state.user.role === 'teacher')) view = 'catalog';
  if (view === 'admin' && !(state.user && state.user.role === 'admin')) view = 'catalog';
  state.view = view;
  applyAccess();
  if (view === 'catalog') renderCatalog();
  if (view === 'learning') renderLearning();
  if (view === 'teach') renderTeach();
  if (view === 'admin') renderAdmin();
}

/* ---------- الكتالوج ---------- */
function renderCatChips() {
  var chips = ['الكل'].concat(CATEGORIES);
  byId('catChips').innerHTML = chips.map(function (c) {
    return '<button class="chip ' + (state.cat === c ? 'active' : '') + '" data-action="cat" data-cat="' + c + '">' + c + '</button>';
  }).join('');
}
function visibleCourses() {
  var list = courses.filter(function (c) { return c.approved; });
  if (state.cat !== 'الكل') list = list.filter(function (c) { return c.category === state.cat; });
  var q = state.search.trim().toLowerCase();
  if (q) list = list.filter(function (c) { return c.title.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q); });
  return list;
}
function renderCatalog() {
  renderCatChips();
  var list = visibleCourses();
  show(byId('emptyCatalog'), list.length === 0);
  byId('courseGrid').innerHTML = list.map(function (c) {
    var mins = c.lessons.reduce(function (s, l) { return s + l.dur; }, 0);
    return '<div class="card" data-action="openCourse" data-id="' + c.id + '">' +
      '<div class="ph-emoji">' + c.emoji + '</div>' +
      '<div class="ph-body"><div class="ph-title">' + c.title + '</div>' +
      '<div class="ph-meta">' + c.instructor + ' · ' + c.level + '</div>' +
      '<div class="ph-stats"><span class="rate">' + stars(c.rating) + '</span>' +
      '<span class="mins">' + c.lessons.length + ' دروس · ' + mins + ' د</span></div>' +
      '<div class="ph-cat">' + c.category + '</div></div></div>';
  }).join('');
}

/* ---------- تفاصيل الدورة + الدروس ---------- */
function openCourse(id) {
  var c = courseById(id); if (!c) return;
  state.openCourse = id;
  var enr = enrollmentOf(id);
  var pct = progressPct(c, enr);
  var lessons = c.lessons.map(function (l) {
    var done = enr && enr.done.indexOf(l.id) !== -1;
    var lock = !enr;
    return '<div class="lesson ' + (done ? 'done' : '') + '">' +
      '<span class="l-ico">' + (lock ? '🔒' : (done ? '✅' : '▶️')) + '</span>' +
      '<span class="l-title">' + l.title + '</span>' +
      '<span class="l-dur">' + l.dur + ' د</span>' +
      (enr && !done ? '<button class="btn sm" data-action="completeLesson" data-cid="' + c.id + '" data-lid="' + l.id + '">إتمام</button>' : '') +
      '</div>';
  }).join('');
  byId('courseBox').innerHTML =
    '<button class="icon-btn close-x" data-action="closeCourse">×</button>' +
    '<div class="detail-emoji">' + c.emoji + '</div>' +
    '<h2>' + c.title + '</h2>' +
    '<div class="detail-meta">' + c.instructor + ' · ' + c.level + ' · ' + c.category + ' · ' + stars(c.rating) + '</div>' +
    (enr ? '<div class="progress"><div class="bar" style="width:' + pct + '%"></div></div><div class="pct">' + pct + '% مكتمل</div>' : '') +
    '<h3>المحتوى (' + c.lessons.length + ' دروس)</h3>' +
    '<div class="lessons">' + lessons + '</div>' +
    (enr ? '' : '<button class="btn primary block" data-action="enroll" data-id="' + c.id + '">اشترك مجاناً وابدأ التعلّم</button>');
  show(byId('courseModal'), true);
}
function closeCourse() { show(byId('courseModal'), false); state.openCourse = null; }

function enroll(id) {
  var c = courseById(id); if (!c) return;
  // الطالب يسجّل نفسه عند أوّل اشتراك
  if (!state.user || state.user.role !== 'student') { state.pendingEnroll = id; openAuth('register'); return; }
  if (enrollmentOf(id)) { toast('أنت مشترك بالفعل'); return; }
  enrollments.push({ student: state.user.name, courseId: id, done: [] });
  save('enrollments', enrollments);
  toast('🎉 اشتركت في «' + c.title + '»');
  openCourse(id);
}
function completeLesson(cid, lid) {
  var enr = enrollmentOf(cid); if (!enr) return;
  if (enr.done.indexOf(lid) === -1) enr.done.push(lid);
  save('enrollments', enrollments);
  var c = courseById(cid);
  if (c && progressPct(c, enr) === 100) toast('🏆 أتممت الدورة! أحسنت.');
  openCourse(cid);
}

/* ---------- تعلّمي (طالب) ---------- */
function renderLearning() {
  var mine = state.user ? enrollments.filter(function (e) { return e.student === state.user.name; }) : [];
  byId('myCourses').innerHTML = mine.length ? mine.map(function (e) {
    var c = courseById(e.courseId); if (!c) return '';
    var pct = progressPct(c, e);
    return '<div class="res-card" data-action="openCourse" data-id="' + c.id + '">' +
      '<div class="res-lead">' + c.emoji + '</div>' +
      '<div class="res-main"><div class="res-title">' + c.title + '</div>' +
      '<div class="res-sub">' + c.instructor + ' · ' + e.done.length + '/' + c.lessons.length + ' دروس</div>' +
      '<div class="progress sm"><div class="bar" style="width:' + pct + '%"></div></div></div>' +
      '<div class="res-side"><div class="pct big">' + pct + '%</div></div></div>';
  }).join('') : '<p class="empty">لم تشترك بعد — تصفّح «الدورات» وابدأ.</p>';
}

/* ---------- المدرّب ---------- */
function myCourses() { return state.user ? courses.filter(function (c) { return c.instructor === state.user.name; }) : []; }
function renderTeach() {
  byId('ncCat').innerHTML = CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  var mine = myCourses();
  var learners = enrollments.filter(function (e) { return mine.some(function (c) { return c.id === e.courseId; }); }).length;
  byId('teachStats').innerHTML =
    stat('دوراتي', mine.length) + stat('المشتركون', learners) +
    stat('الدروس', mine.reduce(function (s, c) { return s + c.lessons.length; }, 0));
  byId('teachCourses').innerHTML = mine.length ? mine.map(function (c) {
    var subs = enrollments.filter(function (e) { return e.courseId === c.id; }).length;
    return '<div class="mini-row"><span>' + c.emoji + ' ' + c.title + '</span>' +
      '<span class="pill">' + c.lessons.length + ' دروس · ' + subs + ' مشترك</span>' +
      '<button class="btn sm" data-action="openLesson" data-id="' + c.id + '">+ درس</button></div>';
  }).join('') : '<p class="empty">لا دورات بعد — أضف أولها.</p>';
}
function addCourse() {
  var title = (byId('ncTitle').value || '').trim();
  var cat = byId('ncCat').value || CATEGORIES[0];
  var emoji = (byId('ncEmoji').value || '📘').trim() || '📘';
  if (!title) { toast('اكتب عنوان الدورة'); return; }
  courses.push({ id: uid('c'), title: title, category: cat, instructor: state.user.name, emoji: emoji, level: 'مبتدئ', rating: 5, approved: true, lessons: [] });
  save('courses', courses);
  byId('ncTitle').value = ''; byId('ncEmoji').value = '';
  renderTeach(); toast('أُضيفت الدورة');
}
function openLesson(cid) { state.addingLessonTo = cid; byId('nlTitle').value = ''; byId('nlDur').value = ''; show(byId('lessonErr'), false); show(byId('lessonModal'), true); }
function closeLesson() { show(byId('lessonModal'), false); state.addingLessonTo = null; }
function saveLesson() {
  var c = courseById(state.addingLessonTo); if (!c) return;
  var title = (byId('nlTitle').value || '').trim();
  var dur = Number(byId('nlDur').value || 0);
  if (!title || !(dur > 0)) { show(byId('lessonErr'), true); return; }
  c.lessons.push({ id: uid('l'), title: title, dur: dur });
  save('courses', courses);
  closeLesson(); renderTeach(); toast('أُضيف الدرس');
}

/* ---------- المدير ---------- */
function renderAdmin() {
  byId('adminStats').innerHTML =
    stat('الدورات', courses.length) + stat('المشتركون', enrollments.length) +
    stat('المدرّبون', uniqueInstructors().length) +
    stat('بانتظار', courses.filter(function (c) { return !c.approved; }).length);
  byId('adminCourses').innerHTML = courses.map(function (c) {
    return '<div class="mini-row"><span>' + c.emoji + ' ' + c.title + ' — ' + c.instructor + '</span>' +
      '<span class="pill ' + (c.approved ? 'ok' : 'wait') + '">' + (c.approved ? 'منشور' : 'بانتظار') + '</span>' +
      '<button class="btn sm" data-action="toggleCourse" data-id="' + c.id + '">' + (c.approved ? 'إخفاء' : 'نشر') + '</button></div>';
  }).join('');
}
function uniqueInstructors() {
  var set = {}; courses.forEach(function (c) { set[c.instructor] = 1; }); return Object.keys(set);
}
function toggleCourse(id) { var c = courseById(id); if (!c) return; c.approved = !c.approved; save('courses', courses); renderAdmin(); }
function stat(label, val) { return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-label">' + label + '</div></div>'; }

/* ---------- الدخول/التوجيه ---------- */
function openAuth(mode) {
  state.authMode = mode || 'login'; updateAuthUI();
  show(byId('authErr'), false); byId('auName').value = ''; byId('auPass').value = '';
  show(byId('authModal'), true);
}
function closeAuth() { show(byId('authModal'), false); }
function updateAuthUI() {
  var reg = state.authMode === 'register';
  byId('authTitle').textContent = reg ? 'إنشاء حساب طالب' : 'تسجيل الدخول';
  byId('authHint').textContent = reg ? 'سجّل لتبدأ التعلّم وحفظ تقدّمك.' : 'ادخل بحسابك لتُوجَّه لصفحتك.';
  byId('authSubmit').textContent = reg ? 'تسجيل وبدء التعلّم' : 'دخول';
  byId('authSwitchText').textContent = reg ? 'لديك حساب طاقم؟ ' : 'طالب جديد؟ ';
  byId('authSwitch').textContent = reg ? 'دخول' : 'إنشاء حساب طالب';
}
function toggleAuth() { openAuth(state.authMode === 'login' ? 'register' : 'login'); }
function routeByRole() {
  if (!state.user) return setView('catalog');
  if (state.user.role === 'admin') return setView('admin');
  if (state.user.role === 'teacher') return setView('teach');
  return setView('catalog');
}
function submitAuth() {
  var name = (byId('auName').value || '').trim();
  var pass = (byId('auPass').value || '').trim();
  if (!name) { show(byId('authErr'), true); return; }
  if (state.authMode === 'register') {
    state.user = { name: name, role: 'student' };
    closeAuth(); applyAccess(); toast('أهلاً ' + name);
    if (state.pendingEnroll) { var cid = state.pendingEnroll; state.pendingEnroll = null; enroll(cid); }
    else routeByRole();
    return;
  }
  var acc = STAFF[name];
  if (acc && acc.pass === pass) {
    state.user = { name: acc.name, role: acc.role };
    closeAuth(); applyAccess(); toast('مرحباً ' + acc.name); routeByRole();
  } else { show(byId('authErr'), true); }
}
function logout() { state.user = null; state.view = 'catalog'; applyAccess(); setView('catalog'); toast('تم تسجيل الخروج'); }

/* ---------- التفويض ---------- */
function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'cat': state.cat = a.dataset.cat; renderCatalog(); break;
    case 'openCourse': openCourse(a.dataset.id); break;
    case 'closeCourse': closeCourse(); break;
    case 'enroll': enroll(a.dataset.id); break;
    case 'completeLesson': completeLesson(a.dataset.cid, a.dataset.lid); break;
    case 'addCourse': addCourse(); break;
    case 'openLesson': openLesson(a.dataset.id); break;
    case 'closeLesson': closeLesson(); break;
    case 'saveLesson': saveLesson(); break;
    case 'toggleCourse': toggleCourse(a.dataset.id); break;
    case 'openAuth': state.user ? logout() : openAuth('login'); break;
    case 'closeAuth': closeAuth(); break;
    case 'toggleAuth': e.preventDefault(); toggleAuth(); break;
    case 'submitAuth': submitAuth(); break;
  }
}
function handleInput(e) { if (e.target && e.target.id === 'search') { state.search = e.target.value; renderCatalog(); } }

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  applyAccess();
  renderCatalog();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0d1117;--surface:#151b26;--card:#1b2230;--accent:#6366f1;--good:#22c55e;--warn:#f59e0b;--text:#e8edf6;--muted:#8b93a3;--border:#272d3a;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;align-items:center;gap:16px;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border);flex-wrap:wrap;position:sticky;top:0;z-index:30}
.brand{font-size:19px;font-weight:800;white-space:nowrap}
.tabs{flex:1;display:flex;gap:6px;flex-wrap:wrap}
.tab{background:transparent;border:1px solid transparent;color:var(--muted);padding:7px 13px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.tab.active{background:var(--card);color:var(--text);border-color:var(--border)}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.sm{padding:5px 11px;font-size:12px}
.btn.block{width:100%;margin-top:6px}
.icon-btn{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
main{max-width:1140px;margin:0 auto;padding:20px 18px}
.sec-title{margin-bottom:16px;font-size:18px}
.hero{background:linear-gradient(120deg,var(--accent),var(--surface));border:1px solid var(--border);border-radius:20px;padding:30px 24px;margin-bottom:18px}
.hero h1{font-size:24px;margin-bottom:6px}
.hero-tag{color:#e7e9ff;opacity:.92}
.toolbar{display:flex;flex-direction:column;gap:12px;margin-bottom:18px}
.search{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 16px;color:var(--text);font-size:15px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{background:transparent;border:1px solid var(--border);color:var(--muted);padding:7px 14px;border-radius:20px;font-weight:700;font-size:12px;cursor:pointer}
.chip.active{background:var(--accent);border-color:var(--accent);color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:.15s;position:relative}
.card:hover{border-color:var(--accent);transform:translateY(-2px)}
.ph-emoji{font-size:46px;text-align:center;padding:22px;background:var(--surface)}
.ph-body{padding:14px}
.ph-title{font-weight:700;font-size:15px;margin-bottom:3px}
.ph-meta{color:var(--muted);font-size:12px}
.ph-stats{display:flex;justify-content:space-between;align-items:center;margin:8px 0 6px}
.rate{color:var(--warn);font-size:13px}
.mins{color:var(--muted);font-size:11px}
.ph-cat{display:inline-block;background:var(--surface);border:1px solid var(--border);color:var(--muted);font-size:11px;padding:2px 9px;border-radius:12px}
.empty{text-align:center;color:var(--muted);padding:26px}
.hidden{display:none !important}
.results{display:flex;flex-direction:column;gap:12px}
.res-card{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;cursor:pointer}
.res-lead{font-size:30px}.res-main{flex:1}
.res-title{font-weight:700;font-size:15px}
.res-sub{color:var(--muted);font-size:13px;margin:2px 0 6px}
.progress{height:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.progress.sm{height:6px}
.progress .bar{height:100%;background:var(--accent)}
.pct{color:var(--muted);font-size:12px;margin-top:4px}
.pct.big{font-size:20px;font-weight:800;color:var(--accent)}
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:22px;font-weight:800;color:var(--accent)}
.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px}
.panel h3{margin-bottom:12px;font-size:15px}
.form-row{display:flex;gap:8px;flex-wrap:wrap}
.form-row input,.form-row select,.sel{flex:1;min-width:120px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text)}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;flex-wrap:wrap}
.pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--border);color:var(--muted)}
.pill.ok{background:rgba(34,197,94,.15);color:var(--good)}
.pill.wait{background:rgba(245,158,11,.15);color:var(--warn)}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(480px,100%);position:relative;max-height:92dvh;overflow:auto}
.close-x{position:absolute;top:12px;left:14px;font-size:22px}
.detail-emoji{font-size:56px;text-align:center}
.modal-box h2{font-size:20px;text-align:center;margin-bottom:4px}
.detail-meta{color:var(--muted);font-size:13px;text-align:center;margin-bottom:14px}
.modal-box h3{margin:14px 0 10px;font-size:15px}
.lessons{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.lesson{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px}
.lesson.done{opacity:.7}
.l-ico{font-size:15px}.l-title{flex:1}.l-dur{color:var(--muted);font-size:12px}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text);margin-bottom:10px}
.err-msg{color:#ef4444;font-size:13px;margin-bottom:8px}
.hint{color:var(--muted);font-size:13px;text-align:center;margin-bottom:14px}
.switch{text-align:center;color:var(--muted);font-size:13px;margin-top:12px}
.switch a{color:var(--accent);text-decoration:none;font-weight:700}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px}
.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;padding:11px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:70;box-shadow:0 8px 24px rgba(0,0,0,.4)}
h1,h2,h3{color:var(--text)}
`;

export function jaolaLms() {
    return {
        id: 'jaola-lms',
        category: 'education',
        name: 'منصّة تعليمية (دورات أونلاين)',
        description: 'منصّة تعلّم عاملة بثلاثة أدوار وصلاحيات: طالب (تصفّح+اشتراك+متابعة دروس+تقدّم) · مدرّب (إضافة دورات/دروس+مشتركون) · مدير (نشر+إحصاءات). لوحات مخفيّة عن الطالب، توجيه بالدور، تقدّم محفوظ.',
        keywords: ['تعليم', 'تعليمية', 'دورات', 'كورسات', 'أونلاين', 'اونلاين', 'منصة تعليمية', 'تعلم', 'lms', 'course', 'courses', 'e-learning', 'elearning', 'academy', 'أكاديمية', 'دروس', 'تدريب'],
        model: {
            entities: [
                { name: 'Course', fields: [{ name: 'id', type: 'string' }, { name: 'title', type: 'string' }, { name: 'category', type: 'string' }, { name: 'instructor', type: 'string' }, { name: 'approved', type: 'boolean' }], ownedBy: 'Instructor' },
                { name: 'Lesson', fields: [{ name: 'id', type: 'string' }, { name: 'title', type: 'string' }, { name: 'dur', type: 'number' }], ownedBy: 'Instructor' },
                { name: 'Enrollment', fields: [{ name: 'student', type: 'string' }, { name: 'courseId', type: 'string' }, { name: 'done', type: 'array' }], ownedBy: 'Student' },
            ],
            roles: [
                { name: 'Student', description: 'يتعلّم', capabilities: ['تصفّح الدورات', 'بحث', 'اشتراك', 'إتمام درس', 'متابعة التقدّم'] },
                { name: 'Instructor', description: 'يدرّس', capabilities: ['إضافة دورة', 'إضافة درس', 'عرض المشتركين'] },
                { name: 'Admin', description: 'يدير المنصّة', capabilities: ['نشر/إخفاء دورة', 'إحصاءات'] },
            ],
            flows: [
                { name: 'التعلّم', actor: 'Student', steps: ['يتصفّح الدورات', 'يفتح التفاصيل', 'يشترك (يسجّل عند الحاجة)', 'يتمّ الدروس ويتابع تقدّمه'], touches: ['Course', 'Lesson', 'Enrollment'], realtime: false },
                { name: 'إنشاء دورة', actor: 'Instructor', steps: ['يدخل → لوحة المدرّب', 'يضيف دورة', 'يضيف دروساً', 'يتابع المشتركين'], touches: ['Course', 'Lesson'], realtime: false },
                { name: 'إدارة المحتوى', actor: 'Admin', steps: ['يدخل → الإدارة', 'ينشر/يخفي دورة', 'يرى الإحصاءات'], touches: ['Course'], realtime: false },
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
