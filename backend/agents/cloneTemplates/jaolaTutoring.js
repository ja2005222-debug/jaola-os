/**
 * 📚 jaola-tutoring — موقع دروس خصوصية بحجز حصص (track: site — لزوّار).
 *
 * مواد بمدرّسين وسعر للحصة، اختيار تاريخ ووقت الحصة (يمنع حجز وقت
 * محجوز مسبقاً لنفس المدرّس)، تأكيد حجز قابل للطباعة، ولوحة إدارة
 * (مواد/حجوزات). أدوار: طالب (يحجز) + إدارة. بلا اعتماد خارجي.
 * الحالة في localStorage (jtutor_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaTutoring() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>منصّة jaola للدروس الخصوصية</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">📚</span> <span id="brandName">دروس jaola الخصوصية</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost no-print" id="authBtn" data-action="openAuth">دخول الإدارة</button>
  </header>
  <main class="no-print">
    <section id="view-home" class="view">
      <div class="hero"><div class="hero-in"><h1>مدرّسك الخاص على بعد حجز واحد</h1><p>مواد متنوّعة · مدرّسون متخصّصون · حجز حصة فوري بتأكيد لحظي.</p></div></div>
      <h2>المواد المتاحة</h2>
      <div id="subjectsGrid" class="subjects-grid"></div>
    </section>

    <section id="view-book" class="view hidden">
      <div class="view-head"><h2 id="bookTitle">إتمام الحجز</h2><button class="btn ghost" data-action="backHome">→ المواد</button></div>
      <div class="login-card" style="margin:0 auto;max-width:440px">
        <div class="panel" id="bookSubjectInfo"></div>
        <label>التاريخ</label><input id="bkDate" type="date">
        <label>وقت الحصة</label><input id="bkTime" type="time">
        <div class="panel" id="bookSummary"></div>
        <label>اسم الطالب</label><input id="bkName" placeholder="الاسم الكامل">
        <label>الهاتف</label><input id="bkPhone" placeholder="05xxxxxxxx">
        <p class="err hidden" id="bookErr"></p>
        <button class="btn primary block" data-action="confirmBooking">تأكيد الحجز</button>
      </div>
    </section>

    <section id="view-reservations" class="view hidden">
      <div class="view-head"><h2>حجوزاتي</h2></div>
      <div id="reservationsList"></div>
    </section>

    <section id="view-admin" class="view hidden">
      <div class="view-head"><h2>لوحة الإدارة</h2></div>
      <div class="stats" id="adminStats"></div>
      <div class="panel form-row">
        <input id="sjName" placeholder="اسم المادة">
        <input id="sjTeacher" placeholder="اسم المدرّس">
        <input id="sjPrice" type="number" placeholder="السعر للحصة" min="0">
        <button class="btn primary" data-action="addSubject">إضافة مادة</button>
      </div>
      <div class="panel"><h3>الحجوزات</h3><table class="tbl" id="adminReservations"></table></div>
    </section>

    <section id="view-auth" class="view hidden">
      <div class="login-card">
        <h1>دخول الإدارة</h1>
        <label>كلمة المرور</label>
        <input id="authPass" type="password" placeholder="admin">
        <p class="err hidden" id="authErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="submitAuth">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin».</p>
      </div>
    </section>
  </main>
  <div id="printArea" class="print-only"></div>
  <div id="toast" class="toast no-print hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 📚 منصّة jaola للدروس الخصوصية — jaola-tutoring */
const SEED_SUBJECTS = [
  { id: 'sj1', name: 'رياضيات', teacher: 'أ. سامي', price: 80, desc: 'من الابتدائي حتى الثانوي' },
  { id: 'sj2', name: 'فيزياء', teacher: 'أ. ليلى', price: 90, desc: 'مناهج الثانوية العامة' },
  { id: 'sj3', name: 'لغة إنجليزية', teacher: 'أ. نورة', price: 70, desc: 'محادثة وقواعد لجميع المستويات' }
];
function todayStr() { return new Date().toISOString().slice(0, 10); }
function toMinutes(hhmm) { var p = (hhmm || '00:00').split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
const SLOT_MIN = 60;

function load(k, fb) { try { var v = localStorage.getItem('jtutor_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jtutor_' + k, JSON.stringify(val)); } catch (e) {} }
let subjects = load('subjects', SEED_SUBJECTS);
let reservations = load('reservations', []); // { id, no, subjectId, student, phone, date, time, price, createdAt }
let settings = load('settings', { name: 'دروس jaola الخصوصية', pass: 'admin', currency: 'ر.س', resSeq: 1 });
let state = { view: 'home', admin: false, activeSubject: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function subjectById(id) { for (var i = 0; i < subjects.length; i++) if (subjects[i].id === id) return subjects[i]; return null; }

function isSlotTaken(subjectId, date, time) {
  var s = subjectById(subjectId); if (!s) return false;
  for (var i = 0; i < reservations.length; i++) {
    var r = reservations[i]; if (r.date !== date) continue;
    var rs = subjectById(r.subjectId); if (!rs || rs.teacher !== s.teacher) continue;
    if (Math.abs(toMinutes(r.time) - toMinutes(time)) < SLOT_MIN) return true;
  }
  return false;
}

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'home') renderSubjects();
  if (v === 'book') renderBook();
  if (v === 'reservations') renderReservations();
  if (v === 'admin') renderAdmin();
}
function renderTabs() {
  var tabs = [['home', 'المواد'], ['reservations', 'حجوزاتي']];
  if (state.admin) tabs.push(['admin', 'الإدارة']);
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  byId('authBtn').textContent = state.admin ? 'خروج' : 'دخول الإدارة';
}

function renderSubjects() {
  byId('subjectsGrid').innerHTML = subjects.map(function (s) {
    return '<div class="subj-card"><h3>' + esc(s.name) + '</h3><p class="hint">' + esc(s.desc || '') + '</p>' +
      '<div class="hint">👩‍🏫 ' + esc(s.teacher) + '</div>' +
      '<div class="plan-price">' + money(s.price) + '<span>/حصة</span></div>' +
      '<button class="btn primary block" data-action="chooseSubject" data-id="' + s.id + '">احجز الآن</button></div>';
  }).join('') || '<p class="hint">لا مواد متاحة حالياً.</p>';
}
function chooseSubject(id) {
  state.activeSubject = id;
  byId('bkDate').value = todayStr(); byId('bkTime').value = '16:00';
  setView('book');
}
function backHome() { setView('home'); }
function renderBook() {
  var s = subjectById(state.activeSubject); if (!s) { setView('home'); return; }
  byId('bookTitle').textContent = 'حجز — ' + s.name;
  byId('bookSubjectInfo').innerHTML = '<b>' + esc(s.name) + '</b> — ' + money(s.price) + '/حصة<br><span class="hint">👩‍🏫 ' + esc(s.teacher) + '</span>';
  updateBookSummary();
  byId('bkDate').oninput = updateBookSummary; byId('bkTime').oninput = updateBookSummary;
}
function updateBookSummary() {
  var s = subjectById(state.activeSubject); if (!s) return;
  var date = byId('bkDate').value, time = byId('bkTime').value;
  var errEl = byId('bookErr'); show(errEl, false);
  if (!date || !time) { byId('bookSummary').innerHTML = '<span class="hint">اختر تاريخ ووقت الحصة.</span>'; return; }
  if (isSlotTaken(s.id, date, time)) { errEl.textContent = 'هذا الوقت محجوز لدى المدرّس — اختر وقتاً آخر.'; show(errEl, true); byId('bookSummary').innerHTML = ''; return; }
  byId('bookSummary').innerHTML = '<div class="r-row"><span>الإجمالي</span><span>' + money(s.price) + '</span></div>';
}
function confirmBooking() {
  var s = subjectById(state.activeSubject); if (!s) return;
  var date = byId('bkDate').value, time = byId('bkTime').value;
  var errEl = byId('bookErr');
  if (!date || !time) { errEl.textContent = 'اختر تاريخ ووقت الحصة.'; show(errEl, true); return; }
  if (isSlotTaken(s.id, date, time)) { errEl.textContent = 'هذا الوقت محجوز لدى المدرّس — اختر وقتاً آخر.'; show(errEl, true); return; }
  var name = byId('bkName').value.trim(); var phone = byId('bkPhone').value.trim();
  if (!name || !phone) { errEl.textContent = 'اكتب الاسم والهاتف.'; show(errEl, true); return; }
  show(errEl, false);
  var res = { id: uid('res'), no: settings.resSeq++, subjectId: s.id, student: name, phone: phone, date: date, time: time, price: s.price, createdAt: new Date().toISOString() };
  reservations.push(res); save('reservations', reservations); save('settings', settings);
  byId('bkName').value = ''; byId('bkPhone').value = '';
  toast('تم تأكيد الحجز #' + res.no + ' 🎉'); printConfirmation(res.id); setView('reservations');
}
function printConfirmation(id) {
  var r = null; for (var i = 0; i < reservations.length; i++) if (reservations[i].id === id) r = reservations[i];
  if (!r) return; var s = subjectById(r.subjectId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>تأكيد حجز #' + r.no + '</span></div><hr>' +
    '<div class="r-row"><span>الطالب</span><span>' + esc(r.student) + '</span></div>' +
    '<div class="r-row"><span>المادة</span><span>' + esc(s ? s.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>المدرّس</span><span>' + esc(s ? s.teacher : '؟') + '</span></div>' +
    '<div class="r-row"><span>التاريخ</span><span>' + r.date + '</span></div>' +
    '<div class="r-row"><span>الوقت</span><span>' + r.time + '</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(r.price) + '</span></div><hr>' +
    '<p style="text-align:center">حصة موفّقة 📚</p></div>';
  window.print();
}

function renderReservations() {
  byId('reservationsList').innerHTML = reservations.length ? reservations.slice().reverse().map(function (r) {
    var s = subjectById(r.subjectId);
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>📚 ' + esc(s ? s.name : '؟') + '</b><span>#' + r.no + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + esc(r.student) + ' · ' + r.date + ' ' + r.time + '<br>الإجمالي: ' + money(r.price) + '</div>' +
      '<button class="btn tiny ghost" data-action="printConfirmation" data-id="' + r.id + '">🖨️ تأكيد الحجز</button></div>';
  }).join('') : '<p class="hint">لا حجوزات بعد — احجز من صفحة المواد.</p>';
}

/* ---------- الإدارة ---------- */
function openAuth() { if (state.admin) { state.admin = false; toast('تم الخروج'); setView('home'); } else setView('auth'); }
function submitAuth() {
  if (byId('authPass').value !== settings.pass) { show(byId('authErr'), true); return; }
  show(byId('authErr'), false); state.admin = true; byId('authPass').value = ''; toast('مرحباً بالإدارة'); setView('admin');
}
function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderAdmin() {
  var rev = 0; for (var i = 0; i < reservations.length; i++) rev += reservations[i].price;
  byId('adminStats').innerHTML =
    statCard('المواد', String(subjects.length), '') +
    statCard('الحجوزات', String(reservations.length), 'ok') +
    statCard('إيراد الحجوزات', money(rev), 'ok');
  var rows = reservations.slice().reverse().map(function (r) {
    var s = subjectById(r.subjectId);
    return '<tr><td>#' + r.no + '</td><td>' + esc(r.student) + '</td><td>' + esc(s ? s.name : '؟') + '</td><td>' + r.date + ' ' + r.time + '</td><td>' + money(r.price) + '</td></tr>';
  }).join('');
  byId('adminReservations').innerHTML = '<tr><th>رقم</th><th>الطالب</th><th>المادة</th><th>الموعد</th><th>السعر</th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا حجوزات بعد.</td></tr>');
}
function addSubject() {
  var name = byId('sjName').value.trim(); if (!name) { toast('اكتب اسم المادة'); return; }
  var teacher = byId('sjTeacher').value.trim() || 'مدرّس';
  subjects.push({ id: uid('sj'), name: name, teacher: teacher, price: Math.max(0, parseFloat(byId('sjPrice').value) || 0), desc: '' });
  save('subjects', subjects); byId('sjName').value = ''; byId('sjTeacher').value = ''; byId('sjPrice').value = '';
  toast('أُضيفت المادة'); renderAdmin();
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'chooseSubject': chooseSubject(a.dataset.id); break;
    case 'backHome': backHome(); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'printConfirmation': printConfirmation(a.dataset.id); break;
    case 'openAuth': openAuth(); break;
    case 'submitAuth': submitAuth(); break;
    case 'addSubject': addSubject(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('home'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.hero{border-radius:16px;background:linear-gradient(120deg,#164e63,#4338ca);padding:44px 26px;margin-bottom:22px}
.hero-in h1{font-size:28px;margin-bottom:8px}.hero-in p{opacity:.9;font-size:14px}
.subjects-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.subj-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:10px}
.subj-card h3{font-size:17px;color:#fff}
.plan-price{font-size:22px;font-weight:800;color:var(--ok)}.plan-price span{font-size:12px;color:var(--mut);font-weight:600}
`;

    return {
        id: 'jaola-tutoring',
        track: 'site',
        category: 'education',
        name: 'موقع دروس خصوصية',
        nameEn: 'Private Tutoring',
        description: 'موقع دروس خصوصية للزوّار: مواد بمدرّسين وسعر للحصة، اختيار تاريخ ووقت الحصة مع منع حجز وقت محجوز مسبقاً لدى نفس المدرّس، تأكيد حجز قابل للطباعة، ولوحة إدارة للمواد والحجوزات.',
        descriptionEn: 'Visitor-facing private tutoring site: subjects with assigned teachers and a per-session rate, date and time slot picking with double-booking prevention for the same teacher, a printable reservation confirmation, and an admin panel for subjects and reservations.',
        keywords: ['دروس خصوصية', 'درس خصوصي', 'معلم خصوصي', 'مدرّس خصوصي', 'بمدرّسين', 'حجز حصة تقوية', 'تقوية دراسية', 'منصّة دروس', 'private tutoring', 'tutor booking', 'tutoring session', 'private lessons', 'online tutor'],
        model: {
            roles: [{ name: 'طالب' }, { name: 'إدارة' }],
            entities: [{ name: 'مادة' }, { name: 'حجز' }],
            flows: [{ name: 'تصفّح المواد واختيار تاريخ ووقت الحصة' }, { name: 'منع حجز وقت محجوز مسبقاً لدى المدرّس' }, { name: 'تأكيد الحجز وطباعته' }, { name: 'إدارة المواد والحجوزات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
