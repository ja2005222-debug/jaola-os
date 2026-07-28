/**
 * 📸 jaola-photography — موقع استوديو تصوير بحجز جلسات (track: site — لزوّار).
 *
 * باقات جلسات تصوير (بورتريه/زفاف/منتجات) بسعر ثابت، اختيار تاريخ ووقت
 * الجلسة (يمنع حجز وقت محجوز مسبقاً لنفس اليوم)، تأكيد حجز قابل
 * للطباعة، ولوحة إدارة (باقات/حجوزات). أدوار: عميل (يحجز) + إدارة.
 * بلا اعتماد خارجي. الحالة في localStorage (jphoto_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaPhotography() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>استوديو jaola للتصوير</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">📸</span> <span id="brandName">استوديو jaola للتصوير</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost no-print" id="authBtn" data-action="openAuth">دخول الإدارة</button>
  </header>
  <main class="no-print">
    <section id="view-home" class="view">
      <div class="hero"><div class="hero-in"><h1>لحظاتك تستحق عدسة محترفة</h1><p>بورتريه · زفاف · منتجات · حجز جلسة فوري بتأكيد لحظي.</p></div></div>
      <h2>باقات التصوير</h2>
      <div id="packagesGrid" class="packages-grid"></div>
    </section>

    <section id="view-book" class="view hidden">
      <div class="view-head"><h2 id="bookTitle">إتمام الحجز</h2><button class="btn ghost" data-action="backHome">→ الباقات</button></div>
      <div class="login-card" style="margin:0 auto;max-width:440px">
        <div class="panel" id="bookPkgInfo"></div>
        <label>تاريخ الجلسة</label><input id="bkDate" type="date">
        <label>وقت الجلسة</label><input id="bkTime" type="time">
        <div class="panel" id="bookSummary"></div>
        <label>اسم العميل</label><input id="bkName" placeholder="الاسم الكامل">
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
        <input id="pkName" placeholder="اسم الباقة">
        <input id="pkPrice" type="number" placeholder="السعر" min="0">
        <input id="pkDuration" type="number" placeholder="المدة (دقيقة)" min="15">
        <button class="btn primary" data-action="addPackage">إضافة باقة</button>
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

    const APP_JS = `/* 📸 موقع استوديو jaola للتصوير — jaola-photography */
const SEED_PACKAGES = [
  { id: 'pk1', name: 'بورتريه شخصي', price: 300, duration: 45, desc: 'جلسة تصوير فردية في الاستوديو مع ٥ صور معالجة' },
  { id: 'pk2', name: 'تصوير زفاف', price: 2500, duration: 240, desc: 'تغطية كاملة ليوم الزفاف مع ألبوم مطبوع' },
  { id: 'pk3', name: 'تصوير منتجات', price: 500, duration: 90, desc: 'جلسة تصوير منتجات تجارية بخلفية بيضاء' }
];
function todayStr() { return new Date().toISOString().slice(0, 10); }
function toMinutes(hhmm) { var p = (hhmm || '00:00').split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }

function load(k, fb) { try { var v = localStorage.getItem('jphoto_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jphoto_' + k, JSON.stringify(val)); } catch (e) {} }
let packages = load('packages', SEED_PACKAGES);
let reservations = load('reservations', []); // { id, no, pkgId, customer, phone, date, time, price, createdAt }
let settings = load('settings', { name: 'استوديو jaola للتصوير', pass: 'admin', currency: 'ر.س', resSeq: 1 });
let state = { view: 'home', admin: false, activePkg: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function pkgById(id) { for (var i = 0; i < packages.length; i++) if (packages[i].id === id) return packages[i]; return null; }

function overlapsSlot(dur, aStart, bStart, bDur) { var aEnd = aStart + dur; var bEnd = bStart + (bDur || 60); return aStart < bEnd && bStart < aEnd; }
function isSlotTaken(date, start, dur) {
  for (var i = 0; i < reservations.length; i++) {
    var r = reservations[i]; if (r.date !== date) continue;
    var rPkg = pkgById(r.pkgId); var rDur = rPkg ? rPkg.duration : 60;
    if (overlapsSlot(dur, start, toMinutes(r.time), rDur)) return true;
  }
  return false;
}

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'home') renderPackages();
  if (v === 'book') renderBook();
  if (v === 'reservations') renderReservations();
  if (v === 'admin') renderAdmin();
}
function renderTabs() {
  var tabs = [['home', 'الباقات'], ['reservations', 'حجوزاتي']];
  if (state.admin) tabs.push(['admin', 'الإدارة']);
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  byId('authBtn').textContent = state.admin ? 'خروج' : 'دخول الإدارة';
}

function renderPackages() {
  byId('packagesGrid').innerHTML = packages.map(function (p) {
    return '<div class="pkg-card"><h3>' + esc(p.name) + '</h3><p class="hint">' + esc(p.desc || '') + '</p>' +
      '<div class="plan-price">' + money(p.price) + '</div>' +
      '<div class="hint">⏱️ ' + p.duration + ' دقيقة</div>' +
      '<button class="btn primary block" data-action="choosePkg" data-id="' + p.id + '">احجز الآن</button></div>';
  }).join('') || '<p class="hint">لا باقات متاحة حالياً.</p>';
}
function choosePkg(id) {
  state.activePkg = id;
  byId('bkDate').value = todayStr(); byId('bkTime').value = '10:00';
  setView('book');
}
function backHome() { setView('home'); }
function renderBook() {
  var p = pkgById(state.activePkg); if (!p) { setView('home'); return; }
  byId('bookTitle').textContent = 'حجز — ' + p.name;
  byId('bookPkgInfo').innerHTML = '<b>' + esc(p.name) + '</b> — ' + money(p.price) + '<br><span class="hint">' + esc(p.desc || '') + ' · ⏱️ ' + p.duration + ' دقيقة</span>';
  updateBookSummary();
  byId('bkDate').oninput = updateBookSummary; byId('bkTime').oninput = updateBookSummary;
}
function updateBookSummary() {
  var p = pkgById(state.activePkg); if (!p) return;
  var date = byId('bkDate').value, time = byId('bkTime').value;
  var errEl = byId('bookErr'); show(errEl, false);
  if (!date || !time) { byId('bookSummary').innerHTML = '<span class="hint">اختر تاريخ ووقت الجلسة.</span>'; return; }
  if (isSlotTaken(date, toMinutes(time), p.duration)) { errEl.textContent = 'هذا الوقت محجوز — اختر وقتاً آخر.'; show(errEl, true); byId('bookSummary').innerHTML = ''; return; }
  byId('bookSummary').innerHTML = '<div class="r-row"><span>المدة</span><span>' + p.duration + ' دقيقة</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(p.price) + '</span></div>';
}
function confirmBooking() {
  var p = pkgById(state.activePkg); if (!p) return;
  var date = byId('bkDate').value, time = byId('bkTime').value;
  var errEl = byId('bookErr');
  if (!date || !time) { errEl.textContent = 'اختر تاريخ ووقت الجلسة.'; show(errEl, true); return; }
  if (isSlotTaken(date, toMinutes(time), p.duration)) { errEl.textContent = 'هذا الوقت محجوز — اختر وقتاً آخر.'; show(errEl, true); return; }
  var name = byId('bkName').value.trim(); var phone = byId('bkPhone').value.trim();
  if (!name || !phone) { errEl.textContent = 'اكتب الاسم والهاتف.'; show(errEl, true); return; }
  show(errEl, false);
  var res = { id: uid('res'), no: settings.resSeq++, pkgId: p.id, customer: name, phone: phone, date: date, time: time, price: p.price, createdAt: new Date().toISOString() };
  reservations.push(res); save('reservations', reservations); save('settings', settings);
  byId('bkName').value = ''; byId('bkPhone').value = '';
  toast('تم تأكيد الحجز #' + res.no + ' 🎉'); printConfirmation(res.id); setView('reservations');
}
function printConfirmation(id) {
  var r = null; for (var i = 0; i < reservations.length; i++) if (reservations[i].id === id) r = reservations[i];
  if (!r) return; var p = pkgById(r.pkgId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>تأكيد حجز #' + r.no + '</span></div><hr>' +
    '<div class="r-row"><span>العميل</span><span>' + esc(r.customer) + '</span></div>' +
    '<div class="r-row"><span>الباقة</span><span>' + esc(p ? p.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>التاريخ</span><span>' + r.date + '</span></div>' +
    '<div class="r-row"><span>الوقت</span><span>' + r.time + '</span></div>' +
    '<div class="r-row"><span>الإجمالي</span><span>' + money(r.price) + '</span></div><hr>' +
    '<p style="text-align:center">نتطلّع لجلستكم 📸</p></div>';
  window.print();
}

function renderReservations() {
  byId('reservationsList').innerHTML = reservations.length ? reservations.slice().reverse().map(function (r) {
    var p = pkgById(r.pkgId);
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>📸 ' + esc(p ? p.name : '؟') + '</b><span>#' + r.no + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + esc(r.customer) + ' · ' + r.date + ' ' + r.time + '<br>الإجمالي: ' + money(r.price) + '</div>' +
      '<button class="btn tiny ghost" data-action="printConfirmation" data-id="' + r.id + '">🖨️ تأكيد الحجز</button></div>';
  }).join('') : '<p class="hint">لا حجوزات بعد — احجز من صفحة الباقات.</p>';
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
    statCard('الباقات', String(packages.length), '') +
    statCard('الحجوزات', String(reservations.length), 'ok') +
    statCard('إيراد الحجوزات', money(rev), 'ok');
  var rows = reservations.slice().reverse().map(function (r) {
    var p = pkgById(r.pkgId);
    return '<tr><td>#' + r.no + '</td><td>' + esc(r.customer) + '</td><td>' + esc(p ? p.name : '؟') + '</td><td>' + r.date + ' ' + r.time + '</td><td>' + money(r.price) + '</td></tr>';
  }).join('');
  byId('adminReservations').innerHTML = '<tr><th>رقم</th><th>العميل</th><th>الباقة</th><th>الموعد</th><th>السعر</th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا حجوزات بعد.</td></tr>');
}
function addPackage() {
  var name = byId('pkName').value.trim(); if (!name) { toast('اكتب اسم الباقة'); return; }
  packages.push({ id: uid('pk'), name: name, price: Math.max(0, parseFloat(byId('pkPrice').value) || 0), duration: Math.max(15, parseInt(byId('pkDuration').value, 10) || 60), desc: '' });
  save('packages', packages); byId('pkName').value = ''; byId('pkPrice').value = ''; byId('pkDuration').value = '';
  toast('أُضيفت الباقة'); renderAdmin();
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'choosePkg': choosePkg(a.dataset.id); break;
    case 'backHome': backHome(); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'printConfirmation': printConfirmation(a.dataset.id); break;
    case 'openAuth': openAuth(); break;
    case 'submitAuth': submitAuth(); break;
    case 'addPackage': addPackage(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('home'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.hero{border-radius:16px;background:linear-gradient(120deg,#18181b,#7c3aed);padding:44px 26px;margin-bottom:22px}
.hero-in h1{font-size:28px;margin-bottom:8px}.hero-in p{opacity:.9;font-size:14px}
.packages-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.pkg-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:10px}
.pkg-card h3{font-size:17px;color:#fff}
.plan-price{font-size:24px;font-weight:800;color:var(--ok)}
`;

    return {
        id: 'jaola-photography',
        track: 'site',
        category: 'creative',
        name: 'موقع استوديو تصوير',
        nameEn: 'Photography Studio',
        description: 'موقع استوديو تصوير للزوّار: باقات جلسات تصوير (بورتريه/زفاف/منتجات) بسعر ثابت، اختيار تاريخ ووقت الجلسة مع منع حجز وقت محجوز مسبقاً، تأكيد حجز قابل للطباعة، ولوحة إدارة للباقات والحجوزات.',
        descriptionEn: 'Visitor-facing photography studio site: photo session packages (portrait/wedding/product) with flat rates, date and time slot picking with double-booking prevention, a printable reservation confirmation, and an admin panel for packages and reservations.',
        keywords: ['استوديو تصوير', 'تصوير فوتوغرافي', 'جلسة تصوير', 'جلسات تصوير', 'تصوير بورتريه', 'تصوير زفاف', 'مصور فوتوغرافي', 'حجز جلسة تصوير', 'photography studio', 'photo session', 'photographer booking', 'portrait photography', 'wedding photography'],
        model: {
            roles: [{ name: 'عميل' }, { name: 'إدارة' }],
            entities: [{ name: 'باقة تصوير' }, { name: 'حجز' }],
            flows: [{ name: 'تصفّح الباقات واختيار تاريخ ووقت الجلسة' }, { name: 'منع حجز وقت محجوز مسبقاً' }, { name: 'تأكيد الحجز وطباعته' }, { name: 'إدارة الباقات والحجوزات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
