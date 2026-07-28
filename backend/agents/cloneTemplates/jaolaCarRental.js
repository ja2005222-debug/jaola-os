/**
 * 🚗 jaola-carrental — موقع تأجير سيارات (track: site — لزوّار).
 *
 * فئات سيارات بسعر لليوم، اختيار تاريخ استلام/تسليم مع حساب عدد الأيام
 * والسعر تلقائياً (يمنع تواريخ غير منطقية أو سيارة محجوزة بالكامل في
 * المدى)، تأكيد حجز قابل للطباعة، ولوحة إدارة (سيارات/حجوزات). أدوار:
 * مستأجر (يحجز) + إدارة. بلا اعتماد خارجي. الحالة في localStorage (jcar_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaCarRental() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>تأجير سيارات jaola</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🚗</span> <span id="brandName">تأجير سيارات jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost no-print" id="authBtn" data-action="openAuth">دخول الإدارة</button>
  </header>
  <main class="no-print">
    <section id="view-home" class="view">
      <div class="hero"><div class="hero-in"><h1>استأجر سيارتك بضغطة زر</h1><p>أسطول متنوّع · أسعار يومية واضحة · حجز فوري بتأكيد لحظي.</p></div></div>
      <h2>فئات السيارات</h2>
      <div id="carsGrid" class="cars-grid"></div>
    </section>

    <section id="view-book" class="view hidden">
      <div class="view-head"><h2 id="bookTitle">إتمام الحجز</h2><button class="btn ghost" data-action="backHome">→ السيارات</button></div>
      <div class="login-card" style="margin:0 auto;max-width:440px">
        <div class="panel" id="bookCarInfo"></div>
        <label>تاريخ الاستلام</label><input id="bkStart" type="date">
        <label>تاريخ التسليم</label><input id="bkEnd" type="date">
        <div class="panel" id="bookSummary"></div>
        <label>اسم المستأجر</label><input id="bkName" placeholder="الاسم الكامل">
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
        <input id="crName" placeholder="اسم/فئة السيارة">
        <input id="crPrice" type="number" placeholder="السعر لليوم" min="0">
        <input id="crCount" type="number" placeholder="عدد السيارات" min="1">
        <button class="btn primary" data-action="addCar">إضافة فئة سيارة</button>
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

    const APP_JS = `/* 🚗 موقع تأجير سيارات jaola — jaola-carrental */
const SEED_CARS = [
  { id: 'c1', name: 'اقتصادية', price: 120, count: 10, cap: 4, desc: 'سيدان صغيرة موفّرة للوقود' },
  { id: 'c2', name: 'عائلية', price: 200, count: 6, cap: 5, desc: 'SUV متوسطة مريحة للعائلة' },
  { id: 'c3', name: 'فاخرة', price: 450, count: 3, cap: 4, desc: 'سيدان فاخرة بمواصفات كاملة' }
];
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDaysStr(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function load(k, fb) { try { var v = localStorage.getItem('jcar_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jcar_' + k, JSON.stringify(val)); } catch (e) {} }
let cars = load('cars', SEED_CARS);
let reservations = load('reservations', []); // { id, no, carId, renter, phone, start, end, days, total, createdAt }
let settings = load('settings', { name: 'تأجير سيارات jaola', pass: 'admin', currency: 'ر.س', resSeq: 1 });
let state = { view: 'home', admin: false, activeCar: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function carById(id) { for (var i = 0; i < cars.length; i++) if (cars[i].id === id) return cars[i]; return null; }

function overlaps(aIn, aOut, bIn, bOut) { return aIn < bOut && bIn < aOut; }
function bookedInRange(carId, start, end) {
  var n = 0;
  for (var i = 0; i < reservations.length; i++) {
    var r = reservations[i];
    if (r.carId === carId && overlaps(start, end, r.start, r.end)) n++;
  }
  return n;
}

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'home') renderCars();
  if (v === 'book') renderBook();
  if (v === 'reservations') renderReservations();
  if (v === 'admin') renderAdmin();
}
function renderTabs() {
  var tabs = [['home', 'السيارات'], ['reservations', 'حجوزاتي']];
  if (state.admin) tabs.push(['admin', 'الإدارة']);
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  byId('authBtn').textContent = state.admin ? 'خروج' : 'دخول الإدارة';
}

function renderCars() {
  byId('carsGrid').innerHTML = cars.map(function (c) {
    var avail = c.count - bookedInRange(c.id, todayStr(), addDaysStr(1));
    return '<div class="car-card"><h3>' + esc(c.name) + '</h3><p class="hint">' + esc(c.desc || '') + '</p>' +
      '<div class="plan-price">' + money(c.price) + '<span>/يوم</span></div>' +
      '<div class="hint">👥 حتى ' + c.cap + ' ركاب · 🚗 ' + c.count + ' سيارات</div>' +
      '<button class="btn primary block" data-action="chooseCar" data-id="' + c.id + '">احجز الآن</button></div>';
  }).join('') || '<p class="hint">لا سيارات متاحة حالياً.</p>';
}
function chooseCar(id) {
  state.activeCar = id;
  byId('bkStart').value = todayStr(); byId('bkEnd').value = addDaysStr(1);
  setView('book');
}
function backHome() { setView('home'); }
function renderBook() {
  var c = carById(state.activeCar); if (!c) { setView('home'); return; }
  byId('bookTitle').textContent = 'حجز — ' + c.name;
  byId('bookCarInfo').innerHTML = '<b>' + esc(c.name) + '</b> — ' + money(c.price) + '/يوم<br><span class="hint">' + esc(c.desc || '') + '</span>';
  updateBookSummary();
  byId('bkStart').oninput = updateBookSummary;
  byId('bkEnd').oninput = updateBookSummary;
}
function updateBookSummary() {
  var c = carById(state.activeCar); if (!c) return;
  var s = byId('bkStart').value, e = byId('bkEnd').value;
  var errEl = byId('bookErr'); show(errEl, false);
  if (!s || !e) { byId('bookSummary').innerHTML = '<span class="hint">اختر تاريخ الاستلام والتسليم.</span>'; return; }
  var days = daysBetween(s, e);
  if (days <= 0) { errEl.textContent = 'تاريخ التسليم يجب أن يكون بعد الاستلام.'; show(errEl, true); byId('bookSummary').innerHTML = ''; return; }
  var booked = bookedInRange(c.id, s, e);
  if (booked >= c.count) { errEl.textContent = 'لا تتوفر سيارات من هذه الفئة في هذا المدى — جرّب تواريخ أخرى.'; show(errEl, true); byId('bookSummary').innerHTML = ''; return; }
  var total = days * c.price;
  byId('bookSummary').innerHTML = '<div class="r-row"><span>عدد الأيام</span><span>' + days + '</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(total) + '</span></div>';
}
function confirmBooking() {
  var c = carById(state.activeCar); if (!c) return;
  var s = byId('bkStart').value, e = byId('bkEnd').value;
  var days = daysBetween(s, e);
  var errEl = byId('bookErr');
  if (!s || !e || days <= 0) { errEl.textContent = 'تاريخ التسليم يجب أن يكون بعد الاستلام.'; show(errEl, true); return; }
  if (bookedInRange(c.id, s, e) >= c.count) { errEl.textContent = 'لا تتوفر سيارات من هذه الفئة في هذا المدى — جرّب تواريخ أخرى.'; show(errEl, true); return; }
  var name = byId('bkName').value.trim(); var phone = byId('bkPhone').value.trim();
  if (!name || !phone) { errEl.textContent = 'اكتب الاسم والهاتف.'; show(errEl, true); return; }
  show(errEl, false);
  var total = days * c.price;
  var res = { id: uid('res'), no: settings.resSeq++, carId: c.id, renter: name, phone: phone, start: s, end: e, days: days, total: total, createdAt: new Date().toISOString() };
  reservations.push(res); save('reservations', reservations); save('settings', settings);
  byId('bkName').value = ''; byId('bkPhone').value = '';
  toast('تم تأكيد الحجز #' + res.no + ' 🎉'); printConfirmation(res.id); setView('reservations');
}
function printConfirmation(id) {
  var r = null; for (var i = 0; i < reservations.length; i++) if (reservations[i].id === id) r = reservations[i];
  if (!r) return; var c = carById(r.carId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>تأكيد حجز #' + r.no + '</span></div><hr>' +
    '<div class="r-row"><span>المستأجر</span><span>' + esc(r.renter) + '</span></div>' +
    '<div class="r-row"><span>السيارة</span><span>' + esc(c ? c.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>الاستلام</span><span>' + r.start + '</span></div>' +
    '<div class="r-row"><span>التسليم</span><span>' + r.end + '</span></div>' +
    '<div class="r-row"><span>عدد الأيام</span><span>' + r.days + '</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(r.total) + '</span></div><hr>' +
    '<p style="text-align:center">قيادة موفّقة 🚗</p></div>';
  window.print();
}

function renderReservations() {
  byId('reservationsList').innerHTML = reservations.length ? reservations.slice().reverse().map(function (r) {
    var c = carById(r.carId);
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>🚗 ' + esc(c ? c.name : '؟') + '</b><span>#' + r.no + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + esc(r.renter) + ' · ' + r.start + ' → ' + r.end + ' (' + r.days + ' أيام)<br>الإجمالي: ' + money(r.total) + '</div>' +
      '<button class="btn tiny ghost" data-action="printConfirmation" data-id="' + r.id + '">🖨️ تأكيد الحجز</button></div>';
  }).join('') : '<p class="hint">لا حجوزات بعد — احجز من صفحة السيارات.</p>';
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
    statCard('فئات السيارات', String(cars.length), '') +
    statCard('الحجوزات', String(reservations.length), 'ok') +
    statCard('إجمالي السيارات', String(cars.reduce(function (s, c) { return s + c.count; }, 0)), '') +
    statCard('إيراد الحجوزات', money(rev), 'ok');
  var rows = reservations.slice().reverse().map(function (r) {
    var c = carById(r.carId);
    return '<tr><td>#' + r.no + '</td><td>' + esc(r.renter) + '</td><td>' + esc(c ? c.name : '؟') + '</td><td>' + r.start + ' → ' + r.end + '</td><td>' + money(r.total) + '</td></tr>';
  }).join('');
  byId('adminReservations').innerHTML = '<tr><th>رقم</th><th>المستأجر</th><th>السيارة</th><th>المدة</th><th>الإجمالي</th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا حجوزات بعد.</td></tr>');
}
function addCar() {
  var name = byId('crName').value.trim(); if (!name) { toast('اكتب اسم فئة السيارة'); return; }
  cars.push({ id: uid('c'), name: name, price: Math.max(0, parseFloat(byId('crPrice').value) || 0), count: Math.max(1, parseInt(byId('crCount').value, 10) || 1), cap: 4, desc: '' });
  save('cars', cars); byId('crName').value = ''; byId('crPrice').value = ''; byId('crCount').value = '';
  toast('أُضيفت فئة السيارة'); renderAdmin();
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'chooseCar': chooseCar(a.dataset.id); break;
    case 'backHome': backHome(); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'printConfirmation': printConfirmation(a.dataset.id); break;
    case 'openAuth': openAuth(); break;
    case 'submitAuth': submitAuth(); break;
    case 'addCar': addCar(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('home'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.hero{border-radius:16px;background:linear-gradient(120deg,#7c2d12,#a16207);padding:44px 26px;margin-bottom:22px}
.hero-in h1{font-size:28px;margin-bottom:8px}.hero-in p{opacity:.9;font-size:14px}
.cars-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.car-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:10px}
.car-card h3{font-size:17px;color:#fff}
.plan-price{font-size:24px;font-weight:800;color:var(--ok)}.plan-price span{font-size:12px;color:var(--mut);font-weight:600}
`;

    return {
        id: 'jaola-carrental',
        track: 'site',
        category: 'automotive',
        name: 'موقع تأجير سيارات',
        nameEn: 'Car Rental',
        description: 'موقع تأجير سيارات للزوّار: فئات سيارات بسعر لليوم، اختيار تاريخ الاستلام والتسليم مع حساب عدد الأيام والسعر تلقائياً ومنع الحجز عند اكتمال السيارات، تأكيد حجز قابل للطباعة، ولوحة إدارة للسيارات والحجوزات.',
        descriptionEn: 'Visitor-facing car rental site: car categories with daily rates, pickup/return date picking with automatic day count and total calculation and over-booking prevention, a printable reservation confirmation, and an admin panel for cars and reservations.',
        keywords: ['تأجير سيارات', 'تأجير سيارة', 'استئجار سيارة', 'إيجار سيارات', 'ايجار سيارات', 'حجز سيارة', 'استلام وتسليم سيارة', 'مستأجر سيارة', 'أسطول سيارات', 'car rental', 'rent a car', 'car hire', 'pickup and return', 'rental fleet'],
        model: {
            roles: [{ name: 'مستأجر' }, { name: 'إدارة' }],
            entities: [{ name: 'فئة سيارة' }, { name: 'حجز' }],
            flows: [{ name: 'تصفّح السيارات واختيار تاريخ الاستلام والتسليم' }, { name: 'حساب عدد الأيام والسعر تلقائياً' }, { name: 'تأكيد الحجز وطباعته' }, { name: 'إدارة السيارات والحجوزات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
