/**
 * 💇 jaola-salon — موقع صالون تجميل/حلاقة بحجز مواعيد (track: site — لزوّار).
 *
 * خدمات بأسعار ومدد، أخصّائيون، حجز موعد (خدمة + أخصائي + وقت) بتأكيد
 * وتذكرة قابلة للطباعة، ولوحة إدارة (خدمات/فريق/مواعيد). أدوار: عميل +
 * إدارة. بلا اعتماد خارجي. الحالة في localStorage (jsal_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaSalon() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>صالون jaola — احجز موعدك</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">💇</span> <span id="brandName">صالون jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost no-print" id="authBtn" data-action="openAuth">دخول الإدارة</button>
  </header>
  <main class="no-print">
    <section id="view-home" class="view">
      <div class="hero"><div class="hero-in"><h1>إطلالتك تبدأ من هنا</h1><p>خدمات احترافية · فريق ماهر · حجز في دقيقة.</p></div></div>
      <h2>خدماتنا</h2>
      <div id="servicesGrid" class="plans-grid"></div>
    </section>

    <section id="view-book" class="view hidden">
      <div class="view-head"><h2 id="bookTitle">حجز موعد</h2><button class="btn ghost" data-action="backHome">→ الخدمات</button></div>
      <div class="login-card" style="margin:0 auto">
        <div class="panel" id="bookSummary"></div>
        <label>الأخصائي</label><select id="bkStaff"></select>
        <label>التاريخ</label><input id="bkDate" type="date">
        <label>الوقت</label><input id="bkTime" type="time">
        <label>اسمك</label><input id="bkName" placeholder="اسمك">
        <label>الهاتف</label><input id="bkPhone" placeholder="05xxxxxxxx">
        <button class="btn primary block" data-action="confirmBooking">تأكيد الحجز</button>
      </div>
    </section>

    <section id="view-appointments" class="view hidden">
      <div class="view-head"><h2>مواعيدي</h2></div>
      <div id="myAppts"></div>
    </section>

    <section id="view-admin" class="view hidden">
      <div class="view-head"><h2>لوحة الإدارة</h2></div>
      <div class="stats" id="adminStats"></div>
      <div class="panel form-row">
        <input id="svName" placeholder="اسم الخدمة">
        <input id="svPrice" type="number" placeholder="السعر" min="0">
        <input id="svDur" type="number" placeholder="المدة (دقيقة)" min="5">
        <input id="svEmoji" placeholder="رمز ✂️" maxlength="2">
        <button class="btn primary" data-action="addService">إضافة خدمة</button>
      </div>
      <div class="panel form-row">
        <input id="stfName" placeholder="اسم الأخصائي">
        <input id="stfRole" placeholder="التخصص (حلاقة/مكياج)">
        <button class="btn primary" data-action="addStaff">إضافة عضو فريق</button>
      </div>
      <div class="panel"><h3>مواعيد اليوم فأكثر</h3><table class="tbl" id="adminAppts"></table></div>
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

    const APP_JS = `/* 💇 موقع صالون jaola — jaola-salon */
const SEED_SERVICES = [
  { id: 'sv1', name: 'قص شعر', price: 60, dur: 30, emoji: '✂️' },
  { id: 'sv2', name: 'صبغة', price: 180, dur: 90, emoji: '🎨' },
  { id: 'sv3', name: 'مكياج', price: 250, dur: 60, emoji: '💄' },
  { id: 'sv4', name: 'عناية بالبشرة', price: 150, dur: 45, emoji: '✨' }
];
const SEED_STAFF = [
  { id: 'st1', name: 'ليلى', role: 'مصفّفة شعر' },
  { id: 'st2', name: 'نورة', role: 'خبيرة مكياج' }
];
function futureDate(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

function load(k, fb) { try { var v = localStorage.getItem('jsal_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jsal_' + k, JSON.stringify(val)); } catch (e) {} }
let services = load('services', SEED_SERVICES);
let staff = load('staff', SEED_STAFF);
let appts = load('appts', []); // { id, no, svcId, staffId, name, phone, date, time }
let settings = load('settings', { name: 'صالون jaola', pass: 'admin', currency: 'ر.س', apptSeq: 1 });
let state = { view: 'home', admin: false, activeSvc: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function svcById(id) { for (var i = 0; i < services.length; i++) if (services[i].id === id) return services[i]; return null; }
function staffById(id) { for (var i = 0; i < staff.length; i++) if (staff[i].id === id) return staff[i]; return null; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'home') renderServices();
  if (v === 'book') renderBook();
  if (v === 'appointments') renderMyAppts();
  if (v === 'admin') renderAdmin();
}
function renderTabs() {
  var tabs = [['home', 'الخدمات'], ['appointments', 'مواعيدي']];
  if (state.admin) tabs.push(['admin', 'الإدارة']);
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  byId('authBtn').textContent = state.admin ? 'خروج' : 'دخول الإدارة';
}

function renderServices() {
  byId('servicesGrid').innerHTML = services.map(function (s) {
    return '<div class="plan-card"><h3>' + (s.emoji || '💇') + ' ' + esc(s.name) + '</h3>' +
      '<div class="plan-price">' + money(s.price) + '</div>' +
      '<p class="hint">⏱️ ' + s.dur + ' دقيقة</p>' +
      '<button class="btn primary block" data-action="chooseService" data-id="' + s.id + '">احجز الآن</button></div>';
  }).join('') || '<p class="hint">لا خدمات حالياً.</p>';
}
function chooseService(id) { state.activeSvc = id; setView('book'); }
function backHome() { setView('home'); }
function renderBook() {
  var s = svcById(state.activeSvc); if (!s) { setView('home'); return; }
  byId('bookTitle').textContent = 'حجز — ' + s.name;
  byId('bookSummary').innerHTML = '<b>' + (s.emoji || '') + ' ' + esc(s.name) + '</b> — ' + money(s.price) + ' · ⏱️ ' + s.dur + ' دقيقة';
  byId('bkStaff').innerHTML = staff.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + ' — ' + esc(t.role) + '</option>'; }).join('');
  byId('bkDate').value = byId('bkDate').value || futureDate(0);
}
function confirmBooking() {
  var s = svcById(state.activeSvc); if (!s) return;
  var name = byId('bkName').value.trim(), phone = byId('bkPhone').value.trim();
  if (!name || !phone) { toast('اكتب اسمك وهاتفك'); return; }
  var staffId = byId('bkStaff').value; var date = byId('bkDate').value || futureDate(0); var time = byId('bkTime').value || '12:00';
  for (var i = 0; i < appts.length; i++) if (appts[i].staffId === staffId && appts[i].date === date && appts[i].time === time) { toast('هذا الوقت محجوز لدى الأخصائي — اختر وقتاً آخر'); return; }
  var ap = { id: uid('ap'), no: settings.apptSeq++, svcId: s.id, staffId: staffId, name: name, phone: phone, date: date, time: time };
  appts.push(ap); save('appts', appts); save('settings', settings);
  byId('bkName').value = ''; byId('bkPhone').value = '';
  toast('تم الحجز #' + ap.no + ' 🎉'); printTicket(ap.id); setView('appointments');
}
function printTicket(id) {
  var ap = null; for (var i = 0; i < appts.length; i++) if (appts[i].id === id) ap = appts[i];
  if (!ap) return; var s = svcById(ap.svcId); var t = staffById(ap.staffId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>موعد #' + ap.no + '</span></div><hr>' +
    '<div class="r-row"><span>الخدمة</span><span>' + esc(s ? s.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>الأخصائي</span><span>' + esc(t ? t.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>التاريخ</span><span>' + ap.date + '</span></div>' +
    '<div class="r-row"><span>الوقت</span><span>' + esc(ap.time) + '</span></div>' +
    '<div class="r-row"><b>السعر</b><b>' + money(s ? s.price : 0) + '</b></div><hr>' +
    '<p style="text-align:center">في انتظارك 💖</p></div>';
  window.print();
}
function renderMyAppts() {
  byId('myAppts').innerHTML = appts.length ? appts.slice().reverse().map(function (ap) {
    var s = svcById(ap.svcId); var t = staffById(ap.staffId);
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>' + (s ? s.emoji + ' ' : '') + esc(s ? s.name : '؟') + '</b><span>#' + ap.no + '</span></div>' +
      '<div class="hint" style="line-height:1.9">👤 ' + esc(t ? t.name : '؟') + '<br>🗓️ ' + ap.date + ' · 🕐 ' + esc(ap.time) + ' · ' + money(s ? s.price : 0) + '</div>' +
      '<button class="btn tiny ghost" data-action="printTicket" data-id="' + ap.id + '">🖨️ طباعة الموعد</button></div>';
  }).join('') : '<p class="hint">لا مواعيد بعد — احجز من صفحة الخدمات.</p>';
}

/* ---------- الإدارة ---------- */
function openAuth() { if (state.admin) { state.admin = false; toast('تم الخروج'); setView('home'); } else setView('auth'); }
function submitAuth() {
  if (byId('authPass').value !== settings.pass) { show(byId('authErr'), true); return; }
  show(byId('authErr'), false); state.admin = true; byId('authPass').value = ''; toast('مرحباً بالإدارة'); setView('admin');
}
function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderAdmin() {
  var today = futureDate(0);
  var todayCount = appts.filter(function (a) { return a.date === today; }).length;
  var rev = 0; for (var i = 0; i < appts.length; i++) { var s = svcById(appts[i].svcId); if (s) rev += s.price; }
  byId('adminStats').innerHTML =
    statCard('مواعيد اليوم', String(todayCount), 'ok') +
    statCard('إجمالي المواعيد', String(appts.length), '') +
    statCard('الخدمات', String(services.length), '') +
    statCard('إيراد متوقّع', money(rev), 'ok');
  var upcoming = appts.filter(function (a) { return a.date >= today; }).sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
  var rows = upcoming.map(function (a) {
    var s = svcById(a.svcId); var t = staffById(a.staffId);
    return '<tr><td>#' + a.no + '</td><td>' + a.date + ' ' + esc(a.time) + '</td><td>' + esc(s ? s.name : '؟') + '</td><td>' + esc(t ? t.name : '؟') + '</td><td>' + esc(a.name) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="cancelAppt" data-id="' + a.id + '">إلغاء</button></td></tr>';
  }).join('');
  byId('adminAppts').innerHTML = '<tr><th>رقم</th><th>الموعد</th><th>الخدمة</th><th>الأخصائي</th><th>العميل</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا مواعيد قادمة.</td></tr>');
}
function addService() {
  var name = byId('svName').value.trim(); if (!name) { toast('اكتب اسم الخدمة'); return; }
  services.push({ id: uid('sv'), name: name, price: Math.max(0, parseFloat(byId('svPrice').value) || 0), dur: Math.max(5, parseInt(byId('svDur').value, 10) || 30), emoji: byId('svEmoji').value.trim() });
  save('services', services); byId('svName').value = ''; byId('svPrice').value = ''; byId('svDur').value = ''; byId('svEmoji').value = '';
  toast('أُضيفت الخدمة'); renderAdmin(); renderServices();
}
function addStaff() {
  var name = byId('stfName').value.trim(); if (!name) { toast('اكتب اسم الأخصائي'); return; }
  staff.push({ id: uid('st'), name: name, role: byId('stfRole').value.trim() || 'أخصائي' });
  save('staff', staff); byId('stfName').value = ''; byId('stfRole').value = ''; toast('أُضيف عضو الفريق'); renderAdmin();
}
function cancelAppt(id) { appts = appts.filter(function (a) { return a.id !== id; }); save('appts', appts); toast('أُلغي الموعد'); renderAdmin(); }

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'chooseService': chooseService(a.dataset.id); break;
    case 'backHome': backHome(); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'printTicket': printTicket(a.dataset.id); break;
    case 'openAuth': openAuth(); break;
    case 'submitAuth': submitAuth(); break;
    case 'addService': addService(); break;
    case 'addStaff': addStaff(); break;
    case 'cancelAppt': cancelAppt(a.dataset.id); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('home'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.hero{border-radius:16px;background:linear-gradient(120deg,#9d174d,#7c3aed);padding:44px 26px;margin-bottom:22px}
.hero-in h1{font-size:28px;margin-bottom:8px}.hero-in p{opacity:.9;font-size:14px}
.plans-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.plan-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:10px}
.plan-card h3{font-size:16px;color:#fff}
.plan-price{font-size:22px;font-weight:800;color:var(--ok)}
.tk-head{display:flex;justify-content:space-between;margin-bottom:6px}
`;

    return {
        id: 'jaola-salon',
        track: 'site',
        category: 'beauty',
        name: 'موقع صالون تجميل بحجز',
        nameEn: 'Salon Booking',
        description: 'موقع صالون تجميل/حلاقة للزوّار: خدمات بأسعار ومدد، فريق أخصائيين، حجز موعد (خدمة + أخصائي + وقت) مع منع التعارض وتذكرة موعد قابلة للطباعة، ولوحة إدارة للخدمات والفريق والمواعيد.',
        descriptionEn: 'Visitor-facing salon/barber site: services with prices and durations, staff specialists, appointment booking (service + specialist + time) with conflict prevention and a printable appointment ticket, plus an admin panel for services, team and appointments.',
        keywords: ['صالون', 'صالون تجميل', 'حلاقة', 'حلاق', 'كوافير', 'تجميل', 'مكياج', 'حجز موعد صالون', 'حجز مواعيد', 'مواعيد', 'خدمات تجميل', 'سبا', 'salon', 'barber', 'beauty', 'hair', 'makeup', 'spa', 'booking appointment', 'stylist'],
        model: {
            roles: [{ name: 'عميل' }, { name: 'إدارة' }],
            entities: [{ name: 'خدمة' }, { name: 'أخصائي' }, { name: 'موعد' }],
            flows: [{ name: 'تصفّح الخدمات' }, { name: 'حجز موعد (خدمة + أخصائي + وقت) مع منع التعارض' }, { name: 'طباعة تذكرة الموعد' }, { name: 'إدارة الخدمات والفريق والمواعيد' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
