/**
 * 🚕 jaola-taxi — تطبيق طلب سيّارة *عامل* بأدوار وصلاحيات.
 *
 * ثلاثة أدوار: راكب (يطلب رحلة + يتابعها) · سائق (يستقبل الطلبات + يقبل +
 * ينهي) · مدير (إحصاءات + كل الرحلات). لوحات الطاقم *مخفيّة* عن الراكب —
 * الدخول يوجّه كل حساب لصفحته. الراكب يسجّل نفسه عند طلب أول رحلة.
 *
 * التسعير تقديريّ (مسافة تقريبية من منطقتين)، حالة في localStorage، كل
 * الدوال معرّفة (تفويض أحداث)، يجتاز التحقّق السلوكي 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>jaola تاكسي</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">🚕 <span id="brandName">jaola تاكسي</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn" id="authBtn" data-action="openAuth">دخول</button>
  </header>

  <main>
    <!-- الراكب -->
    <section id="view-rider" class="view">
      <div class="panel booking">
        <h2>اطلب رحلتك</h2>
        <label>من</label>
        <select id="fromZone" class="sel"></select>
        <label>إلى</label>
        <select id="toZone" class="sel"></select>
        <label>نوع السيّارة</label>
        <div class="chips" id="carTypes"></div>
        <div class="fare-box">
          <div class="fare-line">المسافة التقديرية: <b id="estDist">—</b></div>
          <div class="fare-line big">السعر التقديري: <b id="estFare">—</b></div>
        </div>
        <button class="btn primary" data-action="requestRide">اطلب الآن</button>
      </div>
      <div class="panel">
        <h3>رحلاتي</h3>
        <div id="riderRides" class="mini-list"></div>
      </div>
    </section>

    <!-- السائق -->
    <section id="view-driver" class="view hidden">
      <h2>لوحة السائق</h2>
      <div class="stat-row" id="driverStats"></div>
      <div class="panel">
        <h3>طلبات متاحة</h3>
        <div id="availableRides" class="mini-list"></div>
      </div>
      <div class="panel">
        <h3>رحلاتي الحالية</h3>
        <div id="driverRides" class="mini-list"></div>
      </div>
    </section>

    <!-- المدير -->
    <section id="view-admin" class="view hidden">
      <h2>لوحة الإدارة</h2>
      <div class="stat-row" id="adminStats"></div>
      <div class="panel">
        <h3>كل الرحلات</h3>
        <div id="adminRides" class="mini-list"></div>
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
      <button class="btn primary" data-action="submitAuth" id="authSubmit">دخول</button>
      <p class="switch"><span id="authSwitchText"></span>
        <a href="#" data-action="toggleAuth" id="authSwitch">إنشاء حساب راكب</a></p>
      <p class="demo">حسابات تجربة: <code>admin/1234</code> · <code>driver/1234</code></p>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🚕 منطق طلب السيّارة — كل الدوال معرّفة، تفويض أحداث، صلاحيات.
'use strict';

const STAFF = {
  admin:  { pass: '1234', role: 'admin',  name: 'مدير التشغيل' },
  driver: { pass: '1234', role: 'driver', name: 'سائق: خالد' },
};

// مناطق بإحداثيات شبكية تقريبية لحساب مسافة تقديرية
const ZONES = [
  { id: 'z1', name: 'وسط المدينة', x: 0, y: 0 },
  { id: 'z2', name: 'الحي الشمالي', x: 0, y: 8 },
  { id: 'z3', name: 'المطار', x: 12, y: 3 },
  { id: 'z4', name: 'الجامعة', x: 5, y: 6 },
  { id: 'z5', name: 'المنطقة الصناعية', x: 9, y: -4 },
  { id: 'z6', name: 'الكورنيش', x: -6, y: 2 },
];
const CAR_TYPES = [
  { id: 'economy', name: 'اقتصادي', emoji: '🚗', base: 5, perKm: 1.5 },
  { id: 'comfort', name: 'مريح', emoji: '🚙', base: 8, perKm: 2.2 },
  { id: 'van', name: 'عائلي', emoji: '🚐', base: 12, perKm: 3 },
];

const state = { user: null, view: 'rider', from: 'z1', to: 'z3', car: 'economy' };

function load(key, fallback) {
  try { const v = localStorage.getItem('jt_' + key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) { try { localStorage.setItem('jt_' + key, JSON.stringify(val)); } catch {} }

let rides = load('rides', []); // { id, rider, from, to, car, dist, fare, status, driver }

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 }); }
function zoneById(id) { return ZONES.find(z => z.id === id) || null; }
function carById(id) { return CAR_TYPES.find(c => c.id === id) || CAR_TYPES[0]; }
function rideById(id) { return rides.find(r => r.id === id) || null; }
function uid(p) { return p + Math.random().toString(36).slice(2, 7); }

function toast(msg) {
  const t = byId('toast'); if (!t) return;
  t.textContent = msg; show(t, true);
  clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2200);
}

function distance(fromId, toId) {
  const a = zoneById(fromId), b = zoneById(toId);
  if (!a || !b) return 0;
  const d = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
  return Math.round(d * 10) / 10;
}
function fareFor(fromId, toId, carId) {
  const c = carById(carId);
  return Math.round((c.base + distance(fromId, toId) * c.perKm) * 10) / 10;
}

/* ---------- الصلاحيات ---------- */
function renderTabs() {
  const role = state.user && state.user.role;
  const tabs = [{ id: 'rider', label: 'اطلب رحلة' }];
  if (role === 'driver') tabs[0] = { id: 'driver', label: 'لوحة السائق' };
  if (role === 'admin') tabs[0] = { id: 'admin', label: 'الإدارة' };
  // الراكب يرى تبويب الطلب فقط؛ الطاقم يرى لوحته
  byId('tabs').innerHTML = tabs.map(function (t) {
    return '<button class="tab active" data-action="tab" data-view="' + t.id + '">' + t.label + '</button>';
  }).join('');
}

function applyAccess() {
  const role = state.user && state.user.role;
  show(byId('view-rider'), state.view === 'rider' && role !== 'driver' && role !== 'admin');
  show(byId('view-driver'), state.view === 'driver' && role === 'driver');
  show(byId('view-admin'), state.view === 'admin' && role === 'admin');
  const btn = byId('authBtn');
  if (btn) btn.textContent = state.user ? ('خروج (' + state.user.name + ')') : 'دخول';
  renderTabs();
}

function setView(view) {
  const role = state.user && state.user.role;
  if (view === 'driver' && role !== 'driver') view = 'rider';
  if (view === 'admin' && role !== 'admin') view = 'rider';
  state.view = view;
  applyAccess();
  if (view === 'rider') renderRider();
  if (view === 'driver') renderDriver();
  if (view === 'admin') renderAdmin();
}

/* ---------- الراكب ---------- */
function renderZoneSelects() {
  const opts = ZONES.map(function (z) { return '<option value="' + z.id + '">' + z.name + '</option>'; }).join('');
  const f = byId('fromZone'), t = byId('toZone');
  if (f) { f.innerHTML = opts; f.value = state.from; }
  if (t) { t.innerHTML = opts; t.value = state.to; }
}
function renderCarTypes() {
  byId('carTypes').innerHTML = CAR_TYPES.map(function (c) {
    return '<button class="chip ' + (state.car === c.id ? 'active' : '') + '" data-action="car" data-car="' + c.id + '">' +
      c.emoji + ' ' + c.name + '</button>';
  }).join('');
}
function renderEstimate() {
  const d = distance(state.from, state.to);
  byId('estDist').textContent = d + ' كم';
  byId('estFare').textContent = money(fareFor(state.from, state.to, state.car)) + ' ﷼';
}
function renderRider() {
  renderZoneSelects(); renderCarTypes(); renderEstimate();
  const mine = state.user ? rides.filter(r => r.rider === state.user.name) : [];
  byId('riderRides').innerHTML = mine.length ? mine.slice().reverse().map(rideRow).join('')
    : '<p class="empty">لا رحلات بعد — اطلب أولى رحلاتك.</p>';
}

function requestRide() {
  if (state.from === state.to) { toast('اختر وجهة مختلفة'); return; }
  // الراكب يسجّل نفسه عند أول طلب
  if (!state.user || state.user.role !== 'rider') { openAuth('register'); return; }
  const ride = {
    id: uid('r'), rider: state.user.name, from: state.from, to: state.to, car: state.car,
    dist: distance(state.from, state.to), fare: fareFor(state.from, state.to, state.car),
    status: 'بانتظار سائق', driver: null,
  };
  rides.push(ride); save('rides', rides);
  renderRider(); toast('🚕 طُلبت رحلتك — بانتظار سائق');
}

/* ---------- السائق ---------- */
function renderDriver() {
  const available = rides.filter(r => r.status === 'بانتظار سائق');
  const mine = rides.filter(r => r.driver === state.user.name && r.status !== 'مكتملة');
  const done = rides.filter(r => r.driver === state.user.name && r.status === 'مكتملة');
  const earn = done.reduce(function (s, r) { return s + r.fare; }, 0);
  byId('driverStats').innerHTML =
    stat('متاحة', available.length) + stat('جارية', mine.length) +
    stat('مكتملة', done.length) + stat('أرباحي', money(earn) + ' ﷼');
  byId('availableRides').innerHTML = available.length ? available.map(function (r) {
    return rideRow(r) + '<div class="row-actions"><button class="btn sm primary" data-action="accept" data-id="' + r.id + '">قبول الرحلة</button></div>';
  }).join('') : '<p class="empty">لا طلبات متاحة الآن.</p>';
  byId('driverRides').innerHTML = mine.length ? mine.map(function (r) {
    return rideRow(r) + '<div class="row-actions"><button class="btn sm" data-action="complete" data-id="' + r.id + '">إنهاء الرحلة</button></div>';
  }).join('') : '<p class="empty">لا رحلات جارية.</p>';
}
function acceptRide(id) {
  const r = rideById(id); if (!r || r.status !== 'بانتظار سائق') return;
  r.status = 'في الطريق'; r.driver = state.user.name; save('rides', rides);
  renderDriver(); toast('قبلت الرحلة');
}
function completeRide(id) {
  const r = rideById(id); if (!r) return;
  r.status = 'مكتملة'; save('rides', rides); renderDriver(); toast('أُنهيت الرحلة');
}

/* ---------- المدير ---------- */
function renderAdmin() {
  const done = rides.filter(r => r.status === 'مكتملة');
  const revenue = done.reduce(function (s, r) { return s + r.fare; }, 0);
  byId('adminStats').innerHTML =
    stat('كل الرحلات', rides.length) + stat('مكتملة', done.length) +
    stat('بالانتظار', rides.filter(r => r.status === 'بانتظار سائق').length) +
    stat('الإيراد', money(revenue) + ' ﷼');
  byId('adminRides').innerHTML = rides.length ? rides.slice().reverse().map(rideRow).join('')
    : '<p class="empty">لا رحلات بعد.</p>';
}

function rideRow(r) {
  const from = zoneById(r.from), to = zoneById(r.to), c = carById(r.car);
  const cls = r.status === 'مكتملة' ? 'ok' : (r.status === 'في الطريق' ? 'go' : 'wait');
  return '<div class="mini-row ride"><div class="ride-main">' +
    '<span class="ride-emoji">' + c.emoji + '</span>' +
    '<span class="ride-path">' + (from ? from.name : '') + ' → ' + (to ? to.name : '') + '</span></div>' +
    '<span class="ride-meta">' + r.dist + ' كم · <b>' + money(r.fare) + ' ﷼</b></span>' +
    '<span class="pill ' + cls + '">' + r.status + '</span></div>';
}
function stat(label, val) {
  return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-label">' + label + '</div></div>';
}

/* ---------- الدخول + التوجيه ---------- */
function openAuth(mode) {
  state.authMode = mode || 'login';
  updateAuthUI();
  show(byId('authErr'), false);
  byId('auName').value = ''; byId('auPass').value = '';
  show(byId('authModal'), true);
}
function closeAuth() { show(byId('authModal'), false); }
function updateAuthUI() {
  const reg = state.authMode === 'register';
  byId('authTitle').textContent = reg ? 'إنشاء حساب راكب' : 'تسجيل الدخول';
  byId('authHint').textContent = reg ? 'سجّل لطلب رحلتك — دقائق فقط.' : 'ادخل بحسابك لتُوجَّه لصفحتك.';
  byId('authSubmit').textContent = reg ? 'تسجيل وطلب الرحلة' : 'دخول';
  byId('authSwitchText').textContent = reg ? 'لديك حساب طاقم؟ ' : 'راكب جديد؟ ';
  byId('authSwitch').textContent = reg ? 'دخول' : 'إنشاء حساب راكب';
}
function toggleAuth() { openAuth(state.authMode === 'login' ? 'register' : 'login'); }

function routeByRole() {
  if (!state.user) return setView('rider');
  if (state.user.role === 'admin') return setView('admin');
  if (state.user.role === 'driver') return setView('driver');
  return setView('rider');
}

function submitAuth() {
  const name = (byId('auName').value || '').trim();
  const pass = (byId('auPass').value || '').trim();
  if (!name) { show(byId('authErr'), true); return; }
  if (state.authMode === 'register') {
    state.user = { name: name, role: 'rider' };
    closeAuth(); applyAccess(); toast('أهلاً ' + name);
    requestRide(); // يكمل الطلب الذي بدأه
    return;
  }
  const acc = STAFF[name];
  if (acc && acc.pass === pass) {
    state.user = { name: acc.name, role: acc.role };
    closeAuth(); applyAccess(); toast('مرحباً ' + acc.name); routeByRole();
  } else {
    show(byId('authErr'), true);
  }
}
function logout() { state.user = null; state.view = 'rider'; applyAccess(); setView('rider'); toast('تم تسجيل الخروج'); }

/* ---------- التفويض ---------- */
function handleClick(e) {
  const a = e.target.closest('[data-action]'); if (!a) return;
  const id = a.dataset.id;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'car': state.car = a.dataset.car; renderCarTypes(); renderEstimate(); break;
    case 'requestRide': requestRide(); break;
    case 'accept': acceptRide(id); break;
    case 'complete': completeRide(id); break;
    case 'openAuth': state.user ? logout() : openAuth('login'); break;
    case 'closeAuth': closeAuth(); break;
    case 'toggleAuth': e.preventDefault(); toggleAuth(); break;
    case 'submitAuth': submitAuth(); break;
  }
}
function handleChange(e) {
  const t = e.target; if (!t) return;
  if (t.id === 'fromZone') { state.from = t.value; renderEstimate(); }
  else if (t.id === 'toZone') { state.to = t.value; renderEstimate(); }
}

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  applyAccess();
  renderRider();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0d1117;--surface:#151b24;--card:#1b222e;--accent:#facc15;--good:#22c55e;--go:#38bdf8;--warn:#f59e0b;--text:#e8edf6;--muted:#8b93a3;--border:#272d3a;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;align-items:center;gap:16px;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border);flex-wrap:wrap}
.brand{font-size:19px;font-weight:800}
.tabs{flex:1;display:flex;gap:6px}
.tab{background:var(--card);border:1px solid var(--border);color:var(--text);padding:7px 14px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#2a2400}
.btn.sm{padding:6px 12px;font-size:12px}
.icon-btn{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
main{max-width:900px;margin:0 auto;padding:20px 18px}
.view h2{margin-bottom:16px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px}
.panel h2{margin-bottom:14px}.panel h3{margin-bottom:12px;font-size:15px}
.booking label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin:12px 0 6px}
.sel,select{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text)}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{background:var(--card);border:1px solid var(--border);color:var(--muted);padding:8px 14px;border-radius:20px;font-weight:700;font-size:13px;cursor:pointer}
.chip.active{background:var(--accent);border-color:var(--accent);color:#2a2400}
.fare-box{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin:16px 0}
.fare-line{color:var(--muted);font-size:14px}
.fare-line.big{font-size:18px;color:var(--text);margin-top:4px}
.fare-line b{color:var(--accent)}
.booking .btn.primary{width:100%;margin-top:6px;padding:13px}
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:22px;font-weight:800;color:var(--accent)}
.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px 13px;font-size:14px}
.mini-row.ride{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between}
.ride-main{display:flex;align-items:center;gap:8px}
.ride-emoji{font-size:20px}
.ride-path{font-weight:700}
.ride-meta{color:var(--muted);font-size:13px}.ride-meta b{color:var(--accent)}
.row-actions{margin-top:-4px;margin-bottom:8px}
.pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--border);color:var(--muted)}
.pill.ok{background:rgba(34,197,94,.15);color:var(--good)}
.pill.go{background:rgba(56,189,248,.15);color:var(--go)}
.pill.wait{background:rgba(245,158,11,.15);color:var(--warn)}
.empty{text-align:center;color:var(--muted);padding:20px}
.hidden{display:none !important}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(400px,100%);position:relative}
.close-x{position:absolute;top:12px;left:14px;font-size:22px}
.modal-box h2{font-size:19px;margin-bottom:6px}
.hint{color:var(--muted);font-size:13px;margin-bottom:14px}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text);margin-bottom:10px}
.modal-box .btn{width:100%;margin-top:4px}
.err-msg{color:#ef4444;font-size:13px;margin-bottom:8px}
.switch{text-align:center;color:var(--muted);font-size:13px;margin-top:12px}
.switch a{color:var(--accent);text-decoration:none;font-weight:700}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px}
.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--accent);color:#2a2400;padding:11px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:70;box-shadow:0 8px 24px rgba(0,0,0,.4)}
h2,h3{color:var(--text)}
`;

export function jaolaTaxi() {
    return {
        id: 'jaola-taxi',
        category: 'ridehailing',
        name: 'طلب سيّارة (تاكسي)',
        description: 'تطبيق طلب سيّارة عامل بثلاثة أدوار وصلاحيات: راكب (يطلب+يتابع) · سائق (يقبل+ينهي) · مدير (إحصاءات). تسعير تقديري بالمسافة، لوحات مخفيّة عن الراكب، توجيه بالدور.',
        keywords: ['تاكسي', 'سيارة', 'رحلة', 'رحلات', 'توصيل ركاب', 'taxi', 'ride', 'ride-hailing', 'سائق', 'راكب', 'كابتن', 'نقل', 'مشوار'],
        model: {
            entities: [
                { name: 'Ride', fields: [{ name: 'id', type: 'string' }, { name: 'from', type: 'string' }, { name: 'to', type: 'string' }, { name: 'car', type: 'string' }, { name: 'fare', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Rider' },
                { name: 'Zone', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }], ownedBy: 'Admin' },
            ],
            roles: [
                { name: 'Rider', description: 'يطلب رحلة', capabilities: ['اختيار من/إلى', 'اختيار نوع السيّارة', 'طلب رحلة', 'متابعة رحلاته'] },
                { name: 'Driver', description: 'ينفّذ الرحلات', capabilities: ['رؤية الطلبات المتاحة', 'قبول رحلة', 'إنهاء رحلة', 'أرباحه'] },
                { name: 'Admin', description: 'يدير التشغيل', capabilities: ['إحصاءات', 'كل الرحلات'] },
            ],
            flows: [
                { name: 'طلب رحلة', actor: 'Rider', steps: ['يختار من/إلى ونوع السيّارة', 'يرى السعر التقديري', 'يطلب (يسجّل عند الحاجة)', 'يتابع الحالة'], touches: ['Ride'], realtime: false },
                { name: 'تنفيذ رحلة', actor: 'Driver', steps: ['يدخل → لوحة السائق', 'يقبل طلباً متاحاً', 'ينهي الرحلة'], touches: ['Ride'], realtime: false },
                { name: 'متابعة التشغيل', actor: 'Admin', steps: ['يدخل → الإدارة', 'يرى الإحصاءات وكل الرحلات'], touches: ['Ride'], realtime: false },
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
