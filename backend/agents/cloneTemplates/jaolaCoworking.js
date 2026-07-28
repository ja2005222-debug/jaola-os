/**
 * 🧑‍💻 jaola-coworking — موقع مساحة عمل مشتركة بحجز بالساعة (track: site — لزوّار).
 *
 * أنواع مساحات (مكتب مشترك/غرفة اجتماعات/مكتب خاص) بسعر للساعة، اختيار
 * تاريخ ووقت بداية/نهاية مع حساب عدد الساعات والسعر تلقائياً (يمنع
 * حجزاً متداخلاً لنفس المساحة)، تأكيد حجز قابل للطباعة، ولوحة إدارة
 * (مساحات/حجوزات). أدوار: عضو (يحجز) + إدارة. بلا اعتماد خارجي.
 * الحالة في localStorage (jcowork_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaCoworking() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>مساحة عمل jaola المشتركة</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🧑‍💻</span> <span id="brandName">مساحة jaola المشتركة</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost no-print" id="authBtn" data-action="openAuth">دخول الإدارة</button>
  </header>
  <main class="no-print">
    <section id="view-home" class="view">
      <div class="hero"><div class="hero-in"><h1>مساحة عملك جاهزة متى أردت</h1><p>مكاتب مشتركة · غرف اجتماعات · مكاتب خاصة · حجز فوري بالساعة.</p></div></div>
      <h2>مساحات العمل</h2>
      <div id="spacesGrid" class="spaces-grid"></div>
    </section>

    <section id="view-book" class="view hidden">
      <div class="view-head"><h2 id="bookTitle">إتمام الحجز</h2><button class="btn ghost" data-action="backHome">→ المساحات</button></div>
      <div class="login-card" style="margin:0 auto;max-width:440px">
        <div class="panel" id="bookSpaceInfo"></div>
        <label>التاريخ</label><input id="bkDate" type="date">
        <label>وقت البداية</label><input id="bkStart" type="time">
        <label>وقت النهاية</label><input id="bkEnd" type="time">
        <div class="panel" id="bookSummary"></div>
        <label>اسم العضو</label><input id="bkName" placeholder="الاسم الكامل">
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
        <input id="spName" placeholder="اسم المساحة">
        <input id="spPrice" type="number" placeholder="السعر للساعة" min="0">
        <input id="spCount" type="number" placeholder="عدد الوحدات" min="1">
        <button class="btn primary" data-action="addSpace">إضافة مساحة</button>
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

    const APP_JS = `/* 🧑‍💻 موقع مساحة عمل jaola المشتركة — jaola-coworking */
const SEED_SPACES = [
  { id: 'sp1', name: 'مكتب مشترك', price: 15, count: 12, desc: 'مقعد في الصالة المشتركة مع واي فاي وقهوة' },
  { id: 'sp2', name: 'غرفة اجتماعات', price: 60, count: 3, desc: 'غرفة مجهّزة بشاشة عرض تتّسع لـ٨ أشخاص' },
  { id: 'sp3', name: 'مكتب خاص', price: 35, count: 5, desc: 'مكتب مغلق هادئ لفرد أو فردين' }
];
function todayStr() { return new Date().toISOString().slice(0, 10); }
function toMinutes(hhmm) { var p = (hhmm || '00:00').split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }

function load(k, fb) { try { var v = localStorage.getItem('jcowork_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jcowork_' + k, JSON.stringify(val)); } catch (e) {} }
let spaces = load('spaces', SEED_SPACES);
let reservations = load('reservations', []); // { id, no, spaceId, member, phone, date, start, end, hours, total, createdAt }
let settings = load('settings', { name: 'مساحة jaola المشتركة', pass: 'admin', currency: 'ر.س', resSeq: 1 });
let state = { view: 'home', admin: false, activeSpace: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function spaceById(id) { for (var i = 0; i < spaces.length; i++) if (spaces[i].id === id) return spaces[i]; return null; }

function overlaps(aS, aE, bS, bE) { return aS < bE && bS < aE; }
function bookedInRange(spaceId, date, start, end) {
  var n = 0;
  for (var i = 0; i < reservations.length; i++) {
    var r = reservations[i];
    if (r.spaceId === spaceId && r.date === date && overlaps(start, end, r.start, r.end)) n++;
  }
  return n;
}

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'home') renderSpaces();
  if (v === 'book') renderBook();
  if (v === 'reservations') renderReservations();
  if (v === 'admin') renderAdmin();
}
function renderTabs() {
  var tabs = [['home', 'المساحات'], ['reservations', 'حجوزاتي']];
  if (state.admin) tabs.push(['admin', 'الإدارة']);
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  byId('authBtn').textContent = state.admin ? 'خروج' : 'دخول الإدارة';
}

function renderSpaces() {
  byId('spacesGrid').innerHTML = spaces.map(function (s) {
    return '<div class="space-card"><h3>' + esc(s.name) + '</h3><p class="hint">' + esc(s.desc || '') + '</p>' +
      '<div class="plan-price">' + money(s.price) + '<span>/ساعة</span></div>' +
      '<div class="hint">🪑 ' + s.count + ' وحدات متاحة</div>' +
      '<button class="btn primary block" data-action="chooseSpace" data-id="' + s.id + '">احجز الآن</button></div>';
  }).join('') || '<p class="hint">لا مساحات متاحة حالياً.</p>';
}
function chooseSpace(id) {
  state.activeSpace = id;
  byId('bkDate').value = todayStr(); byId('bkStart').value = '09:00'; byId('bkEnd').value = '11:00';
  setView('book');
}
function backHome() { setView('home'); }
function renderBook() {
  var s = spaceById(state.activeSpace); if (!s) { setView('home'); return; }
  byId('bookTitle').textContent = 'حجز — ' + s.name;
  byId('bookSpaceInfo').innerHTML = '<b>' + esc(s.name) + '</b> — ' + money(s.price) + '/ساعة<br><span class="hint">' + esc(s.desc || '') + '</span>';
  updateBookSummary();
  byId('bkDate').oninput = updateBookSummary; byId('bkStart').oninput = updateBookSummary; byId('bkEnd').oninput = updateBookSummary;
}
function updateBookSummary() {
  var s = spaceById(state.activeSpace); if (!s) return;
  var date = byId('bkDate').value, start = byId('bkStart').value, end = byId('bkEnd').value;
  var errEl = byId('bookErr'); show(errEl, false);
  if (!date || !start || !end) { byId('bookSummary').innerHTML = '<span class="hint">اختر التاريخ ووقت البداية والنهاية.</span>'; return; }
  var mins = toMinutes(end) - toMinutes(start);
  if (mins <= 0) { errEl.textContent = 'وقت النهاية يجب أن يكون بعد البداية.'; show(errEl, true); byId('bookSummary').innerHTML = ''; return; }
  var booked = bookedInRange(s.id, date, start, end);
  if (booked >= s.count) { errEl.textContent = 'لا تتوفر وحدات من هذه المساحة في هذا الوقت — جرّب وقتاً آخر.'; show(errEl, true); byId('bookSummary').innerHTML = ''; return; }
  var hours = mins / 60;
  var total = hours * s.price;
  byId('bookSummary').innerHTML = '<div class="r-row"><span>عدد الساعات</span><span>' + (Math.round(hours * 100) / 100) + '</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(total) + '</span></div>';
}
function confirmBooking() {
  var s = spaceById(state.activeSpace); if (!s) return;
  var date = byId('bkDate').value, start = byId('bkStart').value, end = byId('bkEnd').value;
  var mins = toMinutes(end) - toMinutes(start);
  var errEl = byId('bookErr');
  if (!date || !start || !end || mins <= 0) { errEl.textContent = 'وقت النهاية يجب أن يكون بعد البداية.'; show(errEl, true); return; }
  if (bookedInRange(s.id, date, start, end) >= s.count) { errEl.textContent = 'لا تتوفر وحدات من هذه المساحة في هذا الوقت — جرّب وقتاً آخر.'; show(errEl, true); return; }
  var name = byId('bkName').value.trim(); var phone = byId('bkPhone').value.trim();
  if (!name || !phone) { errEl.textContent = 'اكتب الاسم والهاتف.'; show(errEl, true); return; }
  show(errEl, false);
  var hours = mins / 60;
  var total = hours * s.price;
  var res = { id: uid('res'), no: settings.resSeq++, spaceId: s.id, member: name, phone: phone, date: date, start: start, end: end, hours: hours, total: total, createdAt: new Date().toISOString() };
  reservations.push(res); save('reservations', reservations); save('settings', settings);
  byId('bkName').value = ''; byId('bkPhone').value = '';
  toast('تم تأكيد الحجز #' + res.no + ' 🎉'); printConfirmation(res.id); setView('reservations');
}
function printConfirmation(id) {
  var r = null; for (var i = 0; i < reservations.length; i++) if (reservations[i].id === id) r = reservations[i];
  if (!r) return; var s = spaceById(r.spaceId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>تأكيد حجز #' + r.no + '</span></div><hr>' +
    '<div class="r-row"><span>العضو</span><span>' + esc(r.member) + '</span></div>' +
    '<div class="r-row"><span>المساحة</span><span>' + esc(s ? s.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>التاريخ</span><span>' + r.date + '</span></div>' +
    '<div class="r-row"><span>الوقت</span><span>' + r.start + ' → ' + r.end + '</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(r.total) + '</span></div><hr>' +
    '<p style="text-align:center">إنتاجية موفّقة 🧑‍💻</p></div>';
  window.print();
}

function renderReservations() {
  byId('reservationsList').innerHTML = reservations.length ? reservations.slice().reverse().map(function (r) {
    var s = spaceById(r.spaceId);
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>🧑‍💻 ' + esc(s ? s.name : '؟') + '</b><span>#' + r.no + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + esc(r.member) + ' · ' + r.date + ' · ' + r.start + ' → ' + r.end + '<br>الإجمالي: ' + money(r.total) + '</div>' +
      '<button class="btn tiny ghost" data-action="printConfirmation" data-id="' + r.id + '">🖨️ تأكيد الحجز</button></div>';
  }).join('') : '<p class="hint">لا حجوزات بعد — احجز من صفحة المساحات.</p>';
}

/* ---------- الإدارة ---------- */
function openAuth() { if (state.admin) { state.admin = false; toast('تم الخروج'); setView('home'); } else setView('auth'); }
function submitAuth() {
  if (byId('authPass').value !== settings.pass) { show(byId('authErr'), true); return; }
  show(byId('authErr'), false); state.admin = true; byId('authPass').value = ''; toast('مرحباً بالإدارة'); setView('admin');
}
function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderAdmin() {
  var rev = 0; for (var i = 0; i < reservations.length; i++) rev += reservations[i].total;
  byId('adminStats').innerHTML =
    statCard('أنواع المساحات', String(spaces.length), '') +
    statCard('الحجوزات', String(reservations.length), 'ok') +
    statCard('إجمالي الوحدات', String(spaces.reduce(function (s, x) { return s + x.count; }, 0)), '') +
    statCard('إيراد الحجوزات', money(rev), 'ok');
  var rows = reservations.slice().reverse().map(function (r) {
    var s = spaceById(r.spaceId);
    return '<tr><td>#' + r.no + '</td><td>' + esc(r.member) + '</td><td>' + esc(s ? s.name : '؟') + '</td><td>' + r.date + ' ' + r.start + '-' + r.end + '</td><td>' + money(r.total) + '</td></tr>';
  }).join('');
  byId('adminReservations').innerHTML = '<tr><th>رقم</th><th>العضو</th><th>المساحة</th><th>الموعد</th><th>الإجمالي</th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا حجوزات بعد.</td></tr>');
}
function addSpace() {
  var name = byId('spName').value.trim(); if (!name) { toast('اكتب اسم المساحة'); return; }
  spaces.push({ id: uid('sp'), name: name, price: Math.max(0, parseFloat(byId('spPrice').value) || 0), count: Math.max(1, parseInt(byId('spCount').value, 10) || 1), desc: '' });
  save('spaces', spaces); byId('spName').value = ''; byId('spPrice').value = ''; byId('spCount').value = '';
  toast('أُضيفت المساحة'); renderAdmin();
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'chooseSpace': chooseSpace(a.dataset.id); break;
    case 'backHome': backHome(); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'printConfirmation': printConfirmation(a.dataset.id); break;
    case 'openAuth': openAuth(); break;
    case 'submitAuth': submitAuth(); break;
    case 'addSpace': addSpace(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('home'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.hero{border-radius:16px;background:linear-gradient(120deg,#312e81,#0891b2);padding:44px 26px;margin-bottom:22px}
.hero-in h1{font-size:28px;margin-bottom:8px}.hero-in p{opacity:.9;font-size:14px}
.spaces-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.space-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:10px}
.space-card h3{font-size:17px;color:#fff}
.plan-price{font-size:24px;font-weight:800;color:var(--ok)}.plan-price span{font-size:12px;color:var(--mut);font-weight:600}
`;

    return {
        id: 'jaola-coworking',
        track: 'site',
        category: 'workspace',
        name: 'موقع مساحة عمل مشتركة',
        nameEn: 'Coworking Space',
        description: 'موقع مساحة عمل مشتركة للزوّار: أنواع مساحات (مكتب مشترك/غرفة اجتماعات/مكتب خاص) بسعر للساعة، اختيار تاريخ ووقت بداية ونهاية مع حساب عدد الساعات والسعر تلقائياً ومنع الحجز المتداخل، تأكيد حجز قابل للطباعة، ولوحة إدارة للمساحات والحجوزات.',
        descriptionEn: 'Visitor-facing coworking space site: space types (shared desk/meeting room/private office) with hourly rates, date and start/end time picking with automatic hours and total calculation and overlap prevention, a printable reservation confirmation, and an admin panel for spaces and reservations.',
        keywords: ['مساحة عمل مشتركة', 'مساحة عمل', 'كوورك', 'كوورکنغ', 'مكتب مشترك', 'غرفة اجتماعات', 'حجز مكتب بالساعة', 'حجز قاعة اجتماعات', 'coworking', 'coworking space', 'shared workspace', 'meeting room booking', 'hot desk', 'hourly booking'],
        model: {
            roles: [{ name: 'عضو' }, { name: 'إدارة' }],
            entities: [{ name: 'مساحة عمل' }, { name: 'حجز' }],
            flows: [{ name: 'تصفّح المساحات واختيار تاريخ ووقت' }, { name: 'حساب عدد الساعات والسعر تلقائياً' }, { name: 'تأكيد الحجز وطباعته' }, { name: 'إدارة المساحات والحجوزات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
