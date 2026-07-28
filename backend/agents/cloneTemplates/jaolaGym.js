/**
 * 💪 jaola-gym — موقع نادٍ رياضي باشتراكات وحصص (track: site — لزوّار).
 *
 * باقات اشتراك، جدول حصص أسبوعي بحجز، اشتراك بتأكيد وبطاقة عضوية قابلة
 * للطباعة، ولوحة إدارة (باقات/حصص). أدوار: عضو (يشترك/يحجز) + إدارة.
 * بلا اعتماد خارجي. الحالة في localStorage (jgym_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaGym() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نادي jaola الرياضي</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">💪</span> <span id="brandName">نادي jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost no-print" id="authBtn" data-action="openAuth">دخول الإدارة</button>
  </header>
  <main class="no-print">
    <section id="view-home" class="view">
      <div class="hero"><div class="hero-in"><h1>ابدأ رحلتك نحو لياقتك</h1><p>باقات مرنة · حصص جماعية · مدرّبون معتمدون.</p></div></div>
      <h2>باقات الاشتراك</h2>
      <div id="plansGrid" class="plans-grid"></div>
    </section>

    <section id="view-schedule" class="view hidden">
      <div class="view-head"><h2>جدول الحصص</h2></div>
      <div id="classesGrid" class="classes-grid"></div>
    </section>

    <section id="view-join" class="view hidden">
      <div class="view-head"><h2 id="joinTitle">إتمام الاشتراك</h2><button class="btn ghost" data-action="backHome">→ الباقات</button></div>
      <div class="login-card" style="margin:0 auto">
        <div class="panel" id="joinSummary"></div>
        <label>الاسم الكامل</label><input id="jnName" placeholder="اسمك">
        <label>الهاتف</label><input id="jnPhone" placeholder="05xxxxxxxx">
        <button class="btn primary block" data-action="confirmJoin">تأكيد الاشتراك</button>
      </div>
    </section>

    <section id="view-members" class="view hidden">
      <div class="view-head"><h2>الأعضاء</h2></div>
      <div id="membersList"></div>
    </section>

    <section id="view-admin" class="view hidden">
      <div class="view-head"><h2>لوحة الإدارة</h2></div>
      <div class="stats" id="adminStats"></div>
      <div class="panel form-row">
        <input id="plName" placeholder="اسم الباقة">
        <input id="plPrice" type="number" placeholder="السعر/شهر" min="0">
        <input id="plPerks" placeholder="المزايا (يفصلها ,)">
        <button class="btn primary" data-action="addPlan">إضافة باقة</button>
      </div>
      <div class="panel form-row">
        <input id="clName" placeholder="اسم الحصة (يوغا/كارديو)">
        <input id="clDay" placeholder="اليوم (الأحد…)">
        <input id="clTime" type="time">
        <input id="clCoach" placeholder="المدرّب">
        <input id="clCap" type="number" placeholder="السعة" min="1">
        <button class="btn primary" data-action="addClass">إضافة حصة</button>
      </div>
      <div class="panel"><h3>الأعضاء</h3><table class="tbl" id="adminMembers"></table></div>
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

    const APP_JS = `/* 💪 موقع نادي jaola الرياضي — jaola-gym */
const SEED_PLANS = [
  { id: 'pl1', name: 'شهري', price: 200, perks: ['دخول غير محدود', 'حصة جماعية أسبوعياً'] },
  { id: 'pl2', name: 'ربع سنوي', price: 500, perks: ['دخول غير محدود', 'حصص جماعية', 'خصم على المكمّلات'] },
  { id: 'pl3', name: 'سنوي VIP', price: 1600, perks: ['دخول غير محدود', 'مدرّب شخصي', 'خزانة خاصة', 'تقييم لياقة'] }
];
const SEED_CLASSES = [
  { id: 'cl1', name: 'يوغا الصباح', day: 'الأحد', time: '07:00', coach: 'سارة', cap: 15 },
  { id: 'cl2', name: 'كارديو', day: 'الاثنين', time: '18:00', coach: 'خالد', cap: 20 },
  { id: 'cl3', name: 'حديد', day: 'الأربعاء', time: '19:00', coach: 'ماجد', cap: 12 }
];
function futureDate(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

function load(k, fb) { try { var v = localStorage.getItem('jgym_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jgym_' + k, JSON.stringify(val)); } catch (e) {} }
let plans = load('plans', SEED_PLANS);
let classes = load('classes', SEED_CLASSES);
let members = load('members', []); // { id, no, name, phone, planId, start, end, bookings:[] }
let settings = load('settings', { name: 'نادي jaola', pass: 'admin', currency: 'ر.س', memberSeq: 1 });
let state = { view: 'home', admin: false, activePlan: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function planById(id) { for (var i = 0; i < plans.length; i++) if (plans[i].id === id) return plans[i]; return null; }
function classById(id) { for (var i = 0; i < classes.length; i++) if (classes[i].id === id) return classes[i]; return null; }
function bookedCount(clsId) { var n = 0; for (var i = 0; i < members.length; i++) if ((members[i].bookings || []).indexOf(clsId) !== -1) n++; return n; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'home') renderPlans();
  if (v === 'schedule') renderSchedule();
  if (v === 'join') renderJoin();
  if (v === 'members') renderMembers();
  if (v === 'admin') renderAdmin();
}
function renderTabs() {
  var tabs = [['home', 'الباقات'], ['schedule', 'جدول الحصص'], ['members', 'الأعضاء']];
  if (state.admin) tabs.push(['admin', 'الإدارة']);
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  byId('authBtn').textContent = state.admin ? 'خروج' : 'دخول الإدارة';
}

function renderPlans() {
  byId('plansGrid').innerHTML = plans.map(function (p) {
    var perks = (p.perks || []).map(function (x) { return '<li>✓ ' + esc(x) + '</li>'; }).join('');
    return '<div class="plan-card"><h3>' + esc(p.name) + '</h3><div class="plan-price">' + money(p.price) + '<span>/شهر</span></div><ul class="plan-perks">' + perks + '</ul>' +
      '<button class="btn primary block" data-action="choosePlan" data-id="' + p.id + '">اشترك الآن</button></div>';
  }).join('') || '<p class="hint">لا باقات حالياً.</p>';
}
function choosePlan(id) { state.activePlan = id; setView('join'); }
function backHome() { setView('home'); }
function renderJoin() {
  var p = planById(state.activePlan); if (!p) { setView('home'); return; }
  byId('joinTitle').textContent = 'اشتراك — ' + p.name;
  byId('joinSummary').innerHTML = '<b>' + esc(p.name) + '</b> — ' + money(p.price) + '/شهر<br><span class="hint">' + (p.perks || []).map(esc).join(' · ') + '</span>';
}
function confirmJoin() {
  var p = planById(state.activePlan); if (!p) return;
  var name = byId('jnName').value.trim(); var phone = byId('jnPhone').value.trim();
  if (!name || !phone) { toast('اكتب الاسم والهاتف'); return; }
  var m = { id: uid('m'), no: settings.memberSeq++, name: name, phone: phone, planId: p.id, start: futureDate(0), end: futureDate(30), bookings: [] };
  members.push(m); save('members', members); save('settings', settings);
  byId('jnName').value = ''; byId('jnPhone').value = '';
  toast('تم الاشتراك #' + m.no + ' 🎉'); printCard(m.id); setView('members');
}
function printCard(id) {
  var m = null; for (var i = 0; i < members.length; i++) if (members[i].id === id) m = members[i];
  if (!m) return; var p = planById(m.planId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>بطاقة عضوية #' + m.no + '</span></div><hr>' +
    '<div class="r-row"><span>العضو</span><span>' + esc(m.name) + '</span></div>' +
    '<div class="r-row"><span>الباقة</span><span>' + esc(p ? p.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>البداية</span><span>' + m.start + '</span></div>' +
    '<div class="r-row"><span>النهاية</span><span>' + m.end + '</span></div><hr>' +
    '<p style="text-align:center">أهلاً بك في العائلة 💪</p></div>';
  window.print();
}

function renderSchedule() {
  byId('classesGrid').innerHTML = classes.map(function (c) {
    var booked = bookedCount(c.id); var full = booked >= c.cap;
    return '<div class="class-card"><div class="cl-head"><b>' + esc(c.name) + '</b><span class="cl-day">' + esc(c.day) + ' · ' + esc(c.time) + '</span></div>' +
      '<div class="cl-body">👤 ' + esc(c.coach) + '<br>💺 ' + booked + '/' + c.cap + (full ? ' — ممتلئة' : '') + '</div>' +
      '<button class="btn ' + (full ? 'ghost' : 'primary') + ' block" data-action="bookClass" data-id="' + c.id + '"' + (full ? ' disabled' : '') + '>' + (full ? 'ممتلئة' : 'احجز مقعدك') + '</button></div>';
  }).join('') || '<p class="hint">لا حصص مجدولة.</p>';
}
function bookClass(id) {
  if (!members.length) { toast('اشترك أولاً لتحجز حصة'); setView('home'); return; }
  var m = members[members.length - 1]; // آخر مشترك (تبسيط: عضو الجلسة الحالي)
  var c = classById(id); if (!c) return;
  if (bookedCount(id) >= c.cap) { toast('الحصة ممتلئة'); renderSchedule(); return; }
  m.bookings = m.bookings || [];
  if (m.bookings.indexOf(id) !== -1) { toast('محجوزة لديك بالفعل'); return; }
  m.bookings.push(id); save('members', members);
  toast('حُجز مقعدك في ' + c.name + ' 🎉'); renderSchedule();
}

function renderMembers() {
  byId('membersList').innerHTML = members.length ? members.slice().reverse().map(function (m) {
    var p = planById(m.planId);
    var books = (m.bookings || []).map(function (bid) { var c = classById(bid); return c ? esc(c.name) : ''; }).filter(Boolean).join('، ');
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>👤 ' + esc(m.name) + '</b><span>#' + m.no + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + esc(p ? p.name : '؟') + ' · ينتهي ' + m.end + (books ? '<br>🗓️ حصص: ' + books : '') + '</div>' +
      '<button class="btn tiny ghost" data-action="printCard" data-id="' + m.id + '">🖨️ بطاقة العضوية</button></div>';
  }).join('') : '<p class="hint">لا أعضاء بعد — اشترك من صفحة الباقات.</p>';
}

/* ---------- الإدارة ---------- */
function openAuth() { if (state.admin) { state.admin = false; toast('تم الخروج'); setView('home'); } else setView('auth'); }
function submitAuth() {
  if (byId('authPass').value !== settings.pass) { show(byId('authErr'), true); return; }
  show(byId('authErr'), false); state.admin = true; byId('authPass').value = ''; toast('مرحباً بالإدارة'); setView('admin');
}
function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderAdmin() {
  var rev = 0; for (var i = 0; i < members.length; i++) { var p = planById(members[i].planId); if (p) rev += p.price; }
  byId('adminStats').innerHTML =
    statCard('الأعضاء', String(members.length), 'ok') +
    statCard('الباقات', String(plans.length), '') +
    statCard('الحصص', String(classes.length), '') +
    statCard('إيراد الاشتراكات', money(rev), 'ok');
  var rows = members.map(function (m) {
    var p = planById(m.planId);
    return '<tr><td>#' + m.no + '</td><td>' + esc(m.name) + '</td><td>' + esc(m.phone) + '</td><td>' + esc(p ? p.name : '؟') + '</td><td>' + m.end + '</td></tr>';
  }).join('');
  byId('adminMembers').innerHTML = '<tr><th>رقم</th><th>الاسم</th><th>الهاتف</th><th>الباقة</th><th>ينتهي</th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا أعضاء بعد.</td></tr>');
}
function addPlan() {
  var name = byId('plName').value.trim(); if (!name) { toast('اكتب اسم الباقة'); return; }
  var perks = byId('plPerks').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  plans.push({ id: uid('pl'), name: name, price: Math.max(0, parseFloat(byId('plPrice').value) || 0), perks: perks });
  save('plans', plans); byId('plName').value = ''; byId('plPrice').value = ''; byId('plPerks').value = '';
  toast('أُضيفت الباقة'); renderAdmin();
}
function addClass() {
  var name = byId('clName').value.trim(); if (!name) { toast('اكتب اسم الحصة'); return; }
  classes.push({ id: uid('cl'), name: name, day: byId('clDay').value.trim() || 'الأحد', time: byId('clTime').value || '18:00', coach: byId('clCoach').value.trim() || 'مدرّب', cap: Math.max(1, parseInt(byId('clCap').value, 10) || 15) });
  save('classes', classes); byId('clName').value = ''; byId('clDay').value = ''; byId('clCoach').value = ''; byId('clCap').value = '';
  toast('أُضيفت الحصة'); renderAdmin();
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'choosePlan': choosePlan(a.dataset.id); break;
    case 'backHome': backHome(); break;
    case 'confirmJoin': confirmJoin(); break;
    case 'printCard': printCard(a.dataset.id); break;
    case 'bookClass': bookClass(a.dataset.id); break;
    case 'openAuth': openAuth(); break;
    case 'submitAuth': submitAuth(); break;
    case 'addPlan': addPlan(); break;
    case 'addClass': addClass(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('home'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.hero{border-radius:16px;background:linear-gradient(120deg,#065f46,#0891b2);padding:44px 26px;margin-bottom:22px}
.hero-in h1{font-size:28px;margin-bottom:8px}.hero-in p{opacity:.9;font-size:14px}
.plans-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.plan-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:12px}
.plan-card h3{font-size:17px;color:#fff}
.plan-price{font-size:26px;font-weight:800;color:var(--ok)}.plan-price span{font-size:12px;color:var(--mut);font-weight:600}
.plan-perks{list-style:none;display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--mut);flex:1}
.classes-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}
.class-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px}
.cl-head{display:flex;flex-direction:column;gap:4px}.cl-day{font-size:11px;color:#c7d2fe}
.cl-body{font-size:12px;color:var(--mut);line-height:1.8;flex:1}
`;

    return {
        id: 'jaola-gym',
        track: 'site',
        category: 'fitness',
        name: 'موقع نادٍ رياضي',
        nameEn: 'Gym & Fitness',
        description: 'موقع نادٍ رياضي للزوّار: باقات اشتراك، جدول حصص أسبوعي بحجز مقاعد، اشتراك بتأكيد وبطاقة عضوية قابلة للطباعة، ولوحة إدارة للباقات والحصص والأعضاء.',
        descriptionEn: 'Visitor-facing gym site: membership plans, weekly class schedule with seat booking, signup with confirmation and a printable membership card, plus an admin panel for plans, classes and members.',
        keywords: ['نادي رياضي', 'نادٍ رياضي', 'رياضي', 'جيم', 'صالة رياضية', 'لياقة', 'اشتراكات رياضية', 'اشتراكات', 'حصص رياضية', 'يوغا', 'كروسفت', 'كارديو', 'fitness', 'gym', 'membership', 'workout', 'classes schedule', 'crossfit'],
        model: {
            roles: [{ name: 'عضو' }, { name: 'إدارة' }],
            entities: [{ name: 'باقة' }, { name: 'حصة' }, { name: 'عضو' }],
            flows: [{ name: 'تصفّح الباقات والاشتراك' }, { name: 'حجز مقعد في حصة' }, { name: 'طباعة بطاقة العضوية' }, { name: 'إدارة الباقات والحصص والأعضاء' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
