/**
 * 🏨 jaola-hotel — موقع فندق بحجز غرف (track: site — لزوّار).
 *
 * أنواع غرف بأسعار لليلة، اختيار تاريخ الوصول/المغادرة مع حساب عدد
 * الليالي والسعر تلقائياً (يمنع تواريخ غير منطقية أو غرفة محجوزة بالكامل
 * في المدى)، تأكيد حجز قابل للطباعة، ولوحة إدارة (غرف/حجوزات). أدوار:
 * نزيل (يحجز) + إدارة. بلا اعتماد خارجي. الحالة في localStorage (jhtl_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaHotel() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>فندق jaola</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🏨</span> <span id="brandName">فندق jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost no-print" id="authBtn" data-action="openAuth">دخول الإدارة</button>
  </header>
  <main class="no-print">
    <section id="view-home" class="view">
      <div class="hero"><div class="hero-in"><h1>إقامة تستحقها</h1><p>غرف مريحة · إطلالات رائعة · حجز فوري بتأكيد لحظي.</p></div></div>
      <h2>أنواع الغرف</h2>
      <div id="roomsGrid" class="rooms-grid"></div>
    </section>

    <section id="view-book" class="view hidden">
      <div class="view-head"><h2 id="bookTitle">إتمام الحجز</h2><button class="btn ghost" data-action="backHome">→ الغرف</button></div>
      <div class="login-card" style="margin:0 auto;max-width:440px">
        <div class="panel" id="bookRoomInfo"></div>
        <label>تاريخ الوصول</label><input id="bkIn" type="date">
        <label>تاريخ المغادرة</label><input id="bkOut" type="date">
        <div class="panel" id="bookSummary"></div>
        <label>اسم النزيل</label><input id="bkName" placeholder="الاسم الكامل">
        <label>الهاتف</label><input id="bkPhone" placeholder="05xxxxxxxx">
        <p class="err hidden" id="bookErr"></p>
        <button class="btn primary block" data-action="confirmBooking">تأكيد الحجز</button>
      </div>
    </section>

    <section id="view-reservations" class="view hidden">
      <div class="view-head"><h2>الحجوزات</h2></div>
      <div id="reservationsList"></div>
    </section>

    <section id="view-admin" class="view hidden">
      <div class="view-head"><h2>لوحة الإدارة</h2></div>
      <div class="stats" id="adminStats"></div>
      <div class="panel form-row">
        <input id="rmName" placeholder="اسم نوع الغرفة">
        <input id="rmPrice" type="number" placeholder="السعر لليلة" min="0">
        <input id="rmCount" type="number" placeholder="عدد الغرف" min="1">
        <input id="rmCap" type="number" placeholder="سعة النزلاء" min="1">
        <button class="btn primary" data-action="addRoom">إضافة نوع غرفة</button>
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

    const APP_JS = `/* 🏨 موقع فندق jaola — jaola-hotel */
const SEED_ROOMS = [
  { id: 'rm1', name: 'غرفة قياسية', price: 250, count: 8, cap: 2, desc: 'سرير مزدوج، إطلالة على الحديقة' },
  { id: 'rm2', name: 'غرفة ديلوكس', price: 400, count: 5, cap: 3, desc: 'مساحة أوسع، إطلالة بحرية' },
  { id: 'rm3', name: 'جناح عائلي', price: 650, count: 3, cap: 5, desc: 'غرفتان متصلتان، صالة صغيرة' }
];
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDaysStr(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function load(k, fb) { try { var v = localStorage.getItem('jhtl_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jhtl_' + k, JSON.stringify(val)); } catch (e) {} }
let rooms = load('rooms', SEED_ROOMS);
let reservations = load('reservations', []); // { id, no, roomId, guest, phone, checkIn, checkOut, nights, total, createdAt }
let settings = load('settings', { name: 'فندق jaola', pass: 'admin', currency: 'ر.س', resSeq: 1 });
let state = { view: 'home', admin: false, activeRoom: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function roomById(id) { for (var i = 0; i < rooms.length; i++) if (rooms[i].id === id) return rooms[i]; return null; }

function overlaps(aIn, aOut, bIn, bOut) { return aIn < bOut && bIn < aOut; }
function bookedInRange(roomId, checkIn, checkOut) {
  var n = 0;
  for (var i = 0; i < reservations.length; i++) {
    var r = reservations[i];
    if (r.roomId === roomId && overlaps(checkIn, checkOut, r.checkIn, r.checkOut)) n++;
  }
  return n;
}

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'home') renderRooms();
  if (v === 'book') renderBook();
  if (v === 'reservations') renderReservations();
  if (v === 'admin') renderAdmin();
}
function renderTabs() {
  var tabs = [['home', 'الغرف'], ['reservations', 'الحجوزات']];
  if (state.admin) tabs.push(['admin', 'الإدارة']);
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  byId('authBtn').textContent = state.admin ? 'خروج' : 'دخول الإدارة';
}

function renderRooms() {
  byId('roomsGrid').innerHTML = rooms.map(function (r) {
    var avail = r.count - bookedInRange(r.id, todayStr(), addDaysStr(1));
    return '<div class="room-card"><h3>' + esc(r.name) + '</h3><p class="hint">' + esc(r.desc || '') + '</p>' +
      '<div class="plan-price">' + money(r.price) + '<span>/ليلة</span></div>' +
      '<div class="hint">👥 حتى ' + r.cap + ' نزلاء · 🚪 ' + r.count + ' غرف</div>' +
      '<button class="btn primary block" data-action="chooseRoom" data-id="' + r.id + '">احجز الآن</button></div>';
  }).join('') || '<p class="hint">لا غرف متاحة حالياً.</p>';
}
function chooseRoom(id) {
  state.activeRoom = id;
  byId('bkIn').value = todayStr(); byId('bkOut').value = addDaysStr(1);
  setView('book');
}
function backHome() { setView('home'); }
function renderBook() {
  var r = roomById(state.activeRoom); if (!r) { setView('home'); return; }
  byId('bookTitle').textContent = 'حجز — ' + r.name;
  byId('bookRoomInfo').innerHTML = '<b>' + esc(r.name) + '</b> — ' + money(r.price) + '/ليلة<br><span class="hint">' + esc(r.desc || '') + '</span>';
  updateBookSummary();
  byId('bkIn').oninput = updateBookSummary;
  byId('bkOut').oninput = updateBookSummary;
}
function updateBookSummary() {
  var r = roomById(state.activeRoom); if (!r) return;
  var ci = byId('bkIn').value, co = byId('bkOut').value;
  var errEl = byId('bookErr'); show(errEl, false);
  if (!ci || !co) { byId('bookSummary').innerHTML = '<span class="hint">اختر تاريخ الوصول والمغادرة.</span>'; return; }
  var nights = daysBetween(ci, co);
  if (nights <= 0) { errEl.textContent = 'تاريخ المغادرة يجب أن يكون بعد الوصول.'; show(errEl, true); byId('bookSummary').innerHTML = ''; return; }
  var booked = bookedInRange(r.id, ci, co);
  if (booked >= r.count) { errEl.textContent = 'لا تتوفر غرف من هذا النوع في هذا المدى — جرّب تواريخ أخرى.'; show(errEl, true); byId('bookSummary').innerHTML = ''; return; }
  var total = nights * r.price;
  byId('bookSummary').innerHTML = '<div class="r-row"><span>عدد الليالي</span><span>' + nights + '</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(total) + '</span></div>';
}
function confirmBooking() {
  var r = roomById(state.activeRoom); if (!r) return;
  var ci = byId('bkIn').value, co = byId('bkOut').value;
  var nights = daysBetween(ci, co);
  var errEl = byId('bookErr');
  if (!ci || !co || nights <= 0) { errEl.textContent = 'تاريخ المغادرة يجب أن يكون بعد الوصول.'; show(errEl, true); return; }
  if (bookedInRange(r.id, ci, co) >= r.count) { errEl.textContent = 'لا تتوفر غرف من هذا النوع في هذا المدى — جرّب تواريخ أخرى.'; show(errEl, true); return; }
  var name = byId('bkName').value.trim(); var phone = byId('bkPhone').value.trim();
  if (!name || !phone) { errEl.textContent = 'اكتب الاسم والهاتف.'; show(errEl, true); return; }
  show(errEl, false);
  var total = nights * r.price;
  var res = { id: uid('res'), no: settings.resSeq++, roomId: r.id, guest: name, phone: phone, checkIn: ci, checkOut: co, nights: nights, total: total, createdAt: new Date().toISOString() };
  reservations.push(res); save('reservations', reservations); save('settings', settings);
  byId('bkName').value = ''; byId('bkPhone').value = '';
  toast('تم تأكيد الحجز #' + res.no + ' 🎉'); printConfirmation(res.id); setView('reservations');
}
function printConfirmation(id) {
  var r = null; for (var i = 0; i < reservations.length; i++) if (reservations[i].id === id) r = reservations[i];
  if (!r) return; var room = roomById(r.roomId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>تأكيد حجز #' + r.no + '</span></div><hr>' +
    '<div class="r-row"><span>النزيل</span><span>' + esc(r.guest) + '</span></div>' +
    '<div class="r-row"><span>الغرفة</span><span>' + esc(room ? room.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>الوصول</span><span>' + r.checkIn + '</span></div>' +
    '<div class="r-row"><span>المغادرة</span><span>' + r.checkOut + '</span></div>' +
    '<div class="r-row"><span>عدد الليالي</span><span>' + r.nights + '</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(r.total) + '</span></div><hr>' +
    '<p style="text-align:center">بانتظار إقامتك 🏨</p></div>';
  window.print();
}

function renderReservations() {
  byId('reservationsList').innerHTML = reservations.length ? reservations.slice().reverse().map(function (r) {
    var room = roomById(r.roomId);
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>🏨 ' + esc(room ? room.name : '؟') + '</b><span>#' + r.no + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + esc(r.guest) + ' · ' + r.checkIn + ' → ' + r.checkOut + ' (' + r.nights + ' ليالٍ)<br>الإجمالي: ' + money(r.total) + '</div>' +
      '<button class="btn tiny ghost" data-action="printConfirmation" data-id="' + r.id + '">🖨️ تأكيد الحجز</button></div>';
  }).join('') : '<p class="hint">لا حجوزات بعد — احجز من صفحة الغرف.</p>';
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
    statCard('أنواع الغرف', String(rooms.length), '') +
    statCard('الحجوزات', String(reservations.length), 'ok') +
    statCard('إجمالي الغرف', String(rooms.reduce(function (s, r) { return s + r.count; }, 0)), '') +
    statCard('إيراد الحجوزات', money(rev), 'ok');
  var rows = reservations.slice().reverse().map(function (r) {
    var room = roomById(r.roomId);
    return '<tr><td>#' + r.no + '</td><td>' + esc(r.guest) + '</td><td>' + esc(room ? room.name : '؟') + '</td><td>' + r.checkIn + ' → ' + r.checkOut + '</td><td>' + money(r.total) + '</td></tr>';
  }).join('');
  byId('adminReservations').innerHTML = '<tr><th>رقم</th><th>النزيل</th><th>الغرفة</th><th>المدة</th><th>الإجمالي</th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا حجوزات بعد.</td></tr>');
}
function addRoom() {
  var name = byId('rmName').value.trim(); if (!name) { toast('اكتب اسم نوع الغرفة'); return; }
  rooms.push({ id: uid('rm'), name: name, price: Math.max(0, parseFloat(byId('rmPrice').value) || 0), count: Math.max(1, parseInt(byId('rmCount').value, 10) || 1), cap: Math.max(1, parseInt(byId('rmCap').value, 10) || 2), desc: '' });
  save('rooms', rooms); byId('rmName').value = ''; byId('rmPrice').value = ''; byId('rmCount').value = ''; byId('rmCap').value = '';
  toast('أُضيف نوع الغرفة'); renderAdmin();
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'chooseRoom': chooseRoom(a.dataset.id); break;
    case 'backHome': backHome(); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'printConfirmation': printConfirmation(a.dataset.id); break;
    case 'openAuth': openAuth(); break;
    case 'submitAuth': submitAuth(); break;
    case 'addRoom': addRoom(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('home'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.hero{border-radius:16px;background:linear-gradient(120deg,#1e3a8a,#0e7490);padding:44px 26px;margin-bottom:22px}
.hero-in h1{font-size:28px;margin-bottom:8px}.hero-in p{opacity:.9;font-size:14px}
.rooms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.room-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:10px}
.room-card h3{font-size:17px;color:#fff}
.plan-price{font-size:24px;font-weight:800;color:var(--ok)}.plan-price span{font-size:12px;color:var(--mut);font-weight:600}
`;

    return {
        id: 'jaola-hotel',
        track: 'site',
        category: 'hospitality',
        name: 'موقع حجز فندق',
        nameEn: 'Hotel Booking',
        description: 'موقع فندق للزوّار: أنواع غرف بأسعار لليلة، اختيار تاريخ الوصول والمغادرة مع حساب الليالي والسعر تلقائياً ومنع الحجز عند اكتمال الغرف، تأكيد حجز قابل للطباعة، ولوحة إدارة للغرف والحجوزات.',
        descriptionEn: 'Visitor-facing hotel site: room types with nightly rates, check-in/check-out date picking with automatic nights and total calculation and over-booking prevention, a printable reservation confirmation, and an admin panel for rooms and reservations.',
        keywords: ['فندق', 'فنادق', 'حجز فندق', 'حجز غرف', 'غرفة فندقية', 'نزيل', 'تشيك ان', 'تشك ان', 'وصول ومغادرة', 'ليالي الإقامة', 'استراحة', 'شقق فندقية', 'hotel', 'hotel booking', 'room booking', 'check-in check-out', 'nights stay', 'resort'],
        model: {
            roles: [{ name: 'نزيل' }, { name: 'إدارة' }],
            entities: [{ name: 'نوع غرفة' }, { name: 'حجز' }],
            flows: [{ name: 'تصفّح الغرف واختيار تاريخ الوصول والمغادرة' }, { name: 'حساب عدد الليالي والسعر تلقائياً' }, { name: 'تأكيد الحجز وطباعته' }, { name: 'إدارة الغرف والحجوزات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
