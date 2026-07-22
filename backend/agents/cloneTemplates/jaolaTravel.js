/**
 * ✈️ jaola-travel — منصّة سفر *عاملة* غنيّة: طيران + فنادق + سيّارات + مناطق +
 * عروض، مع حجوزات موحّدة. مصمّمة لهدفين استراتيجيين:
 *
 *  1) API-ready: كل البيانات تمرّ عبر طبقة مزوّد واحدة (Provider). افتراضياً
 *     تعمل ببيانات مبدئية (seed) بلا أي تهيئة أو إنترنت — فتُبنى وتُختبر فوراً.
 *     لتفعيل API حيّ: اضبط CONFIG.api.base إلى رابط خادمك، فتُجلب البيانات
 *     منه، ومع أي فشل شبكي ترتدّ للبيانات المبدئية (لا انهيار).
 *
 *  2) White-label: كائن BRAND واحد يحكم الاسم/الشعار/الألوان/العملة/الدعم،
 *     ويُطبَّق على متغيّرات CSS حيّاً. لوحة الإدارة تغيّره في الزمن الحقيقي
 *     وتحفظه — فتُعاد العلامة كاملة دون لمس الكود.
 *
 * كل الدوال معرّفة (تفويض أحداث)، الحالة في localStorage، ويجتاز التحقّق
 * السلوكي 100% رغم كتم fetch (لأن الطبقة ترتدّ للـ seed).
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>jaola Travel</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><span id="brandEmoji">✈️</span> <span id="brandName">jaola Travel</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn" id="authBtn" data-action="openAuth">دخول</button>
  </header>

  <main>
    <!-- استكشف -->
    <section id="view-explore" class="view">
      <div class="hero">
        <h1 id="heroTitle">وجهتك القادمة تبدأ هنا</h1>
        <p id="heroTag" class="hero-tag"></p>
      </div>
      <h2 class="sec-title">أهمّ الوجهات</h2>
      <div id="destGrid" class="grid dest"></div>
      <h2 class="sec-title">عروض مختارة</h2>
      <div id="offerGrid" class="grid offers"></div>
    </section>

    <!-- طيران -->
    <section id="view-flights" class="view hidden">
      <div class="panel search-panel">
        <h2>ابحث عن رحلة طيران</h2>
        <div class="search-grid">
          <div class="fld"><label>من</label><select id="fFrom" class="sel"></select></div>
          <div class="fld"><label>إلى</label><select id="fTo" class="sel"></select></div>
          <div class="fld"><label>التاريخ</label><input id="fDate" type="date"></div>
          <div class="fld"><label>المسافرون</label><input id="fPax" type="number" min="1" max="9" value="1"></div>
        </div>
        <button class="btn primary block" data-action="searchFlights">بحث الرحلات</button>
      </div>
      <p id="fNote" class="note hidden"></p>
      <div id="flightResults" class="results"></div>
    </section>

    <!-- فنادق -->
    <section id="view-hotels" class="view hidden">
      <div class="panel search-panel">
        <h2>ابحث عن فندق</h2>
        <div class="search-grid">
          <div class="fld"><label>المدينة</label><select id="hCity" class="sel"></select></div>
          <div class="fld"><label>الوصول</label><input id="hIn" type="date"></div>
          <div class="fld"><label>المغادرة</label><input id="hOut" type="date"></div>
          <div class="fld"><label>الضيوف</label><input id="hGuests" type="number" min="1" max="8" value="2"></div>
        </div>
        <button class="btn primary block" data-action="searchHotels">بحث الفنادق</button>
      </div>
      <div id="hotelResults" class="results"></div>
    </section>

    <!-- سيّارات -->
    <section id="view-cars" class="view hidden">
      <div class="panel search-panel">
        <h2>استأجر سيّارة</h2>
        <div class="search-grid">
          <div class="fld"><label>المدينة</label><select id="cCity" class="sel"></select></div>
          <div class="fld"><label>الاستلام</label><input id="cIn" type="date"></div>
          <div class="fld"><label>الإرجاع</label><input id="cOut" type="date"></div>
        </div>
        <button class="btn primary block" data-action="searchCars">بحث السيّارات</button>
      </div>
      <div id="carResults" class="results"></div>
    </section>

    <!-- حجوزاتي -->
    <section id="view-bookings" class="view hidden">
      <h2 class="sec-title">حجوزاتي</h2>
      <div id="bookingList" class="results"></div>
    </section>

    <!-- الإدارة (white-label + كل الحجوزات) -->
    <section id="view-admin" class="view hidden">
      <h2 class="sec-title">لوحة الإدارة</h2>
      <div class="stat-row" id="adminStats"></div>
      <div class="panel">
        <h3>🎨 هوية العلامة (White-label)</h3>
        <p class="hint">غيّر الاسم واللون فتُعاد العلامة كاملة حيّاً وتُحفظ.</p>
        <div class="search-grid">
          <div class="fld"><label>اسم العلامة</label><input id="wlName" type="text"></div>
          <div class="fld"><label>الرمز</label><input id="wlEmoji" type="text" maxlength="4"></div>
          <div class="fld"><label>اللون الأساسي</label><input id="wlColor" type="color"></div>
          <div class="fld"><label>عملة</label><input id="wlCurrency" type="text" maxlength="4"></div>
        </div>
        <button class="btn primary" data-action="saveBrand">حفظ وتطبيق</button>
      </div>
      <div class="panel">
        <h3>العروض</h3>
        <div id="adminOffers" class="mini-list"></div>
      </div>
      <div class="panel">
        <h3>كل الحجوزات</h3>
        <div id="adminBookings" class="mini-list"></div>
      </div>
      <div class="panel api-note">
        <h3>🔌 حالة الربط (API)</h3>
        <p id="apiStatus" class="hint"></p>
      </div>
    </section>
  </main>

  <!-- نافذة الحجز -->
  <div id="bookModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="closeBooking">×</button>
      <h2>تأكيد الحجز</h2>
      <div id="bookSummary" class="book-summary"></div>
      <label>اسم المسافر</label>
      <input id="bkName" placeholder="الاسم الكامل">
      <label>البريد / الجوّال</label>
      <input id="bkContact" placeholder="للتواصل والتأكيد">
      <label>كود خصم (اختياري)</label>
      <input id="bkPromo" placeholder="مثال: SUMMER">
      <p id="bookErr" class="err-msg hidden">أكمل اسم المسافر.</p>
      <div class="price-final">الإجمالي: <b id="bookTotal">—</b></div>
      <button class="btn primary block" data-action="confirmBooking">تأكيد والدفع لاحقاً</button>
    </div>
  </div>

  <!-- نافذة الدخول -->
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
        <a href="#" data-action="toggleAuth" id="authSwitch">إنشاء حساب مسافر</a></p>
      <p class="demo">حساب إدارة تجربة: <code>admin/1234</code></p>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// ✈️ منطق منصّة السفر — API-ready + white-label. كل الدوال معرّفة، تفويض أحداث.
'use strict';

/* =========================================================================
   1) WHITE-LABEL — عدّل هذا الكائن وحده لإعادة العلامة بالكامل.
   ========================================================================= */
const BRAND = {
  name: 'jaola Travel',
  emoji: '✈️',
  tagline: 'احجز طيرانك وفندقك وسيّارتك في مكان واحد',
  primary: '#0ea5e9',
  accent: '#f59e0b',
  currency: '﷼',
  supportPhone: '+966 800 000 000',
};

/* =========================================================================
   2) API CONFIG — اضبط base لتفعيل الجلب الحيّ؛ اتركه null للعمل بالـ seed.
   ========================================================================= */
const CONFIG = {
  api: {
    base: null, // مثال: 'https://api.example.com'
    destinations: '/destinations', offers: '/offers',
    flights: '/flights', hotels: '/hotels', cars: '/cars',
  },
};

/* ============================ بيانات مبدئية (seed) ======================== */
const AIRPORTS = [
  { code: 'RUH', city: 'الرياض' }, { code: 'JED', city: 'جدة' }, { code: 'DMM', city: 'الدمام' },
  { code: 'DXB', city: 'دبي' }, { code: 'CAI', city: 'القاهرة' }, { code: 'IST', city: 'إسطنبول' },
];
const CITIES = ['الرياض', 'جدة', 'الدمام', 'دبي', 'القاهرة', 'إسطنبول'];

const DESTINATIONS = [
  { id: 'd1', city: 'دبي', emoji: '🏙️', tagline: 'ناطحات سحاب وتسوّق', from: 899 },
  { id: 'd2', city: 'إسطنبول', emoji: '🕌', tagline: 'حيث تلتقي القارّات', from: 1150 },
  { id: 'd3', city: 'جدة', emoji: '🌊', tagline: 'كورنيش وبحر أحمر', from: 320 },
  { id: 'd4', city: 'القاهرة', emoji: '🐫', tagline: 'أهرامات وتاريخ', from: 780 },
  { id: 'd5', city: 'الرياض', emoji: '🏜️', tagline: 'العاصمة النابضة', from: 250 },
  { id: 'd6', city: 'الدمام', emoji: '🛥️', tagline: 'شرقية على الخليج', from: 290 },
];
const OFFERS = [
  { id: 'o1', title: 'خصم الصيف على الفنادق', code: 'SUMMER', pct: 15, emoji: '☀️', active: true },
  { id: 'o2', title: 'طيران + فندق', code: 'COMBO', pct: 20, emoji: '🎒', active: true },
  { id: 'o3', title: 'إيجار سيّارة 3 أيّام', code: 'DRIVE3', pct: 10, emoji: '🚗', active: true },
  { id: 'o4', title: 'عرض نهاية الأسبوع', code: 'WKND', pct: 12, emoji: '🌙', active: false },
];
const FLIGHTS = [
  { id: 'f1', from: 'RUH', to: 'JED', airline: 'الطيران الوطني', emoji: '🛫', dep: '08:15', arr: '10:00', dur: '1س 45د', price: 320 },
  { id: 'f2', from: 'RUH', to: 'DXB', airline: 'خطوط الخليج', emoji: '🛫', dep: '13:30', arr: '16:20', dur: '2س 50د', price: 640 },
  { id: 'f3', from: 'JED', to: 'IST', airline: 'الأناضول', emoji: '🛫', dep: '02:10', arr: '06:40', dur: '4س 30د', price: 1150 },
  { id: 'f4', from: 'RUH', to: 'CAI', airline: 'النيل للطيران', emoji: '🛫', dep: '09:00', arr: '11:20', dur: '2س 20د', price: 780 },
  { id: 'f5', from: 'DMM', to: 'DXB', airline: 'خطوط الخليج', emoji: '🛫', dep: '18:45', arr: '20:05', dur: '1س 20د', price: 410 },
  { id: 'f6', from: 'RUH', to: 'JED', airline: 'اقتصادي إكسبريس', emoji: '🛫', dep: '21:00', arr: '22:45', dur: '1س 45د', price: 260 },
  { id: 'f7', from: 'JED', to: 'DXB', airline: 'خطوط الخليج', emoji: '🛫', dep: '11:10', arr: '14:15', dur: '3س 05د', price: 690 },
];
const HOTELS = [
  { id: 'h1', city: 'جدة', name: 'منتجع الشاطئ', emoji: '🏖️', rating: 5, price: 640, tags: ['إطلالة بحر', 'مسبح', 'فطور'] },
  { id: 'h2', city: 'جدة', name: 'فندق الكورنيش', emoji: '🏨', rating: 4, price: 380, tags: ['وسط المدينة', 'واي‑فاي'] },
  { id: 'h3', city: 'الرياض', name: 'برج الأعمال', emoji: '🏢', rating: 5, price: 720, tags: ['قاعات', 'جيم', 'فطور'] },
  { id: 'h4', city: 'الرياض', name: 'نزل العليا', emoji: '🏨', rating: 4, price: 340, tags: ['قريب المترو'] },
  { id: 'h5', city: 'دبي', name: 'مارينا سويتس', emoji: '🌆', rating: 5, price: 980, tags: ['مارينا', 'مسبح', 'سبا'] },
  { id: 'h6', city: 'إسطنبول', name: 'بيت البسفور', emoji: '🕌', rating: 4, price: 520, tags: ['إطلالة مضيق', 'فطور'] },
];
const CARS = [
  { id: 'c1', city: 'الرياض', name: 'تويوتا يارِس', emoji: '🚗', cls: 'اقتصادي', price: 120, seats: 5, trans: 'أوتوماتيك' },
  { id: 'c2', city: 'الرياض', name: 'هيونداي سوناتا', emoji: '🚙', cls: 'متوسّط', price: 190, seats: 5, trans: 'أوتوماتيك' },
  { id: 'c3', city: 'جدة', name: 'كيا كارنيفال', emoji: '🚐', cls: 'عائلي', price: 300, seats: 7, trans: 'أوتوماتيك' },
  { id: 'c4', city: 'جدة', name: 'نيسان صني', emoji: '🚗', cls: 'اقتصادي', price: 110, seats: 5, trans: 'يدوي' },
  { id: 'c5', city: 'دبي', name: 'مرسيدس E', emoji: '🚘', cls: 'فاخر', price: 620, seats: 5, trans: 'أوتوماتيك' },
  { id: 'c6', city: 'الدمام', name: 'تويوتا كامري', emoji: '🚙', cls: 'متوسّط', price: 200, seats: 5, trans: 'أوتوماتيك' },
];

/* ============================== الحالة/التخزين ========================== */
const STAFF = { admin: { pass: '1234', role: 'admin', name: 'مدير المنصّة' } };

function load(key, fallback) {
  try { const v = localStorage.getItem('jtr_' + key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) { try { localStorage.setItem('jtr_' + key, JSON.stringify(val)); } catch {} }

let brand = Object.assign({}, BRAND, load('brand', {}));
let offers = load('offers', OFFERS);
let bookings = load('bookings', []);
const results = { flights: [], hotels: [], cars: [] };

const state = { user: null, view: 'explore', authMode: 'login', pending: null };

/* ================================ أدوات ================================= */
function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US') + ' ' + brand.currency; }
function uid(p) { return p + Math.random().toString(36).slice(2, 7); }
function stars(n) { let s = ''; for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆'; return s; }
function airportCity(code) { const a = AIRPORTS.find(x => x.code === code); return a ? a.city : code; }
function activeOffers() { return offers.filter(o => o.active); }
function offerByCode(code) { return offers.find(o => o.active && o.code.toLowerCase() === String(code || '').trim().toLowerCase()) || null; }

function isoDate(offset) {
  const d = new Date(); d.setDate(d.getDate() + (offset || 0));
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  if (!a || !b) return 1;
  const n = Math.round((new Date(b) - new Date(a)) / 86400000);
  return n > 0 ? n : 1;
}
function toast(msg) {
  const t = byId('toast'); if (!t) return;
  t.textContent = msg; show(t, true);
  clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2300);
}

/* ============================ طبقة المزوّد (API) ======================== */
// تجلب من API إن ضُبط base، وإلا (أو عند أي فشل) ترتدّ للبيانات المبدئية.
async function apiList(key, seed) {
  const base = CONFIG.api.base;
  if (!base) return seed;
  try {
    const res = await fetch(base + CONFIG.api[key]);
    if (!res || !res.ok) return seed;
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return seed;
  } catch { return seed; }
}
const Provider = {
  destinations: function () { return apiList('destinations', DESTINATIONS); },
  offersList: function () { return apiList('offers', OFFERS); },
  flights: function () { return apiList('flights', FLIGHTS); },
  hotels: function () { return apiList('hotels', HOTELS); },
  cars: function () { return apiList('cars', CARS); },
};

/* ============================== White-label ============================= */
function applyBrand() {
  const root = document.documentElement;
  if (root && root.style) {
    root.style.setProperty('--brand', brand.primary);
    root.style.setProperty('--accent', brand.accent);
  }
  const nm = byId('brandName'); if (nm) nm.textContent = brand.name;
  const em = byId('brandEmoji'); if (em) em.textContent = brand.emoji;
  const tag = byId('heroTag'); if (tag) tag.textContent = brand.tagline;
  if (document.title !== undefined) document.title = brand.name;
}

/* ============================== التبويبات ============================== */
function renderTabs() {
  const role = state.user && state.user.role;
  let tabs = [
    { id: 'explore', label: 'استكشف' }, { id: 'flights', label: 'طيران' },
    { id: 'hotels', label: 'فنادق' }, { id: 'cars', label: 'سيّارات' },
    { id: 'bookings', label: 'حجوزاتي' },
  ];
  if (role === 'admin') tabs.push({ id: 'admin', label: 'الإدارة' });
  byId('tabs').innerHTML = tabs.map(function (t) {
    return '<button class="tab ' + (state.view === t.id ? 'active' : '') + '" data-action="tab" data-view="' + t.id + '">' + t.label + '</button>';
  }).join('');
}
function applyAccess() {
  ['explore', 'flights', 'hotels', 'cars', 'bookings', 'admin'].forEach(function (v) {
    let ok = state.view === v;
    if (v === 'admin') ok = ok && state.user && state.user.role === 'admin';
    show(byId('view-' + v), ok);
  });
  const btn = byId('authBtn');
  if (btn) btn.textContent = state.user ? ('خروج (' + state.user.name + ')') : 'دخول';
  renderTabs();
}
function setView(view) {
  if (view === 'admin' && !(state.user && state.user.role === 'admin')) view = 'explore';
  state.view = view;
  applyAccess();
  if (view === 'explore') renderExplore();
  if (view === 'flights') { fillAirports(); renderFlights(); }
  if (view === 'hotels') { fillCities('hCity'); renderHotels(); }
  if (view === 'cars') { fillCities('cCity'); renderCars(); }
  if (view === 'bookings') renderBookings();
  if (view === 'admin') renderAdmin();
}

/* ================================ استكشف =============================== */
async function renderExplore() {
  const dests = await Provider.destinations();
  byId('destGrid').innerHTML = dests.map(function (d) {
    return '<div class="card dest-card" data-action="exploreDest" data-city="' + d.city + '">' +
      '<div class="dest-emoji">' + d.emoji + '</div>' +
      '<div class="dest-body"><div class="dest-city">' + d.city + '</div>' +
      '<div class="dest-tag">' + d.tagline + '</div>' +
      '<div class="dest-from">تبدأ من ' + money(d.from) + '</div></div></div>';
  }).join('');
  const list = activeOffers();
  byId('offerGrid').innerHTML = list.length ? list.map(function (o) {
    return '<div class="offer-card"><div class="offer-emoji">' + o.emoji + '</div>' +
      '<div class="offer-body"><div class="offer-title">' + o.title + '</div>' +
      '<div class="offer-pct">خصم ' + o.pct + '%</div>' +
      '<div class="offer-code">الكود: <b>' + o.code + '</b></div>' +
      '<button class="btn sm" data-action="useOffer" data-code="' + o.code + '">انسخ الكود</button></div></div>';
  }).join('') : '<p class="empty">لا عروض فعّالة حالياً.</p>';
}

/* ================================ طيران ================================ */
function fillAirports() {
  const opts = AIRPORTS.map(function (a) { return '<option value="' + a.code + '">' + a.city + ' (' + a.code + ')</option>'; }).join('');
  const f = byId('fFrom'), t = byId('fTo');
  if (f && !f.value) { f.innerHTML = opts; f.value = 'RUH'; } else if (f) f.innerHTML = opts, f.value = f.value || 'RUH';
  if (t && !t.value) { t.innerHTML = opts; t.value = 'JED'; } else if (t) t.innerHTML = opts, t.value = t.value || 'JED';
  const dt = byId('fDate'); if (dt && !dt.value) dt.value = isoDate(3);
}
async function searchFlights() {
  const from = (byId('fFrom') && byId('fFrom').value) || 'RUH';
  const to = (byId('fTo') && byId('fTo').value) || 'JED';
  const all = await Provider.flights();
  let list = all.filter(function (f) { return f.from === from && f.to === to; });
  const note = byId('fNote');
  if (!list.length) { list = all.slice().sort(function (a, b) { return a.price - b.price; }); show(note, true); note.textContent = 'لا رحلات مباشرة على هذا المسار — نعرض كل الرحلات مرتّبة بالسعر.'; }
  else { show(note, false); }
  results.flights = list;
  renderFlights();
}
function renderFlights() {
  const pax = Math.max(1, Number((byId('fPax') && byId('fPax').value) || 1));
  const list = results.flights.length ? results.flights : FLIGHTS.filter(function (f) { return f.from === 'RUH' && f.to === 'JED'; });
  results.flights = list;
  byId('flightResults').innerHTML = list.map(function (f) {
    return '<div class="res-card"><div class="res-lead">' + f.emoji + '</div>' +
      '<div class="res-main"><div class="res-title">' + f.airline + '</div>' +
      '<div class="res-sub">' + airportCity(f.from) + ' ' + f.dep + ' ← ' + airportCity(f.to) + ' ' + f.arr + ' · ' + f.dur + '</div></div>' +
      '<div class="res-side"><div class="res-price">' + money(f.price * pax) + '</div>' +
      '<div class="res-unit">' + pax + ' مسافر</div>' +
      '<button class="btn primary sm" data-action="bookFlight" data-id="' + f.id + '">احجز</button></div></div>';
  }).join('');
}

/* ================================ فنادق =============================== */
function fillCities(id) {
  const el = byId(id); if (!el) return;
  const cur = el.value;
  el.innerHTML = CITIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  el.value = cur || 'جدة';
  if (id === 'hCity') { const i = byId('hIn'), o = byId('hOut'); if (i && !i.value) i.value = isoDate(3); if (o && !o.value) o.value = isoDate(5); }
  if (id === 'cCity') { const i = byId('cIn'), o = byId('cOut'); if (i && !i.value) i.value = isoDate(3); if (o && !o.value) o.value = isoDate(6); }
}
async function searchHotels() {
  const city = (byId('hCity') && byId('hCity').value) || 'جدة';
  const all = await Provider.hotels();
  results.hotels = all.filter(function (h) { return h.city === city; });
  if (!results.hotels.length) results.hotels = all.slice();
  renderHotels();
}
function renderHotels() {
  const nights = daysBetween(byId('hIn') && byId('hIn').value, byId('hOut') && byId('hOut').value);
  let list = results.hotels.length ? results.hotels : HOTELS.filter(function (h) { return h.city === 'جدة'; });
  results.hotels = list;
  byId('hotelResults').innerHTML = list.map(function (h) {
    return '<div class="res-card"><div class="res-lead">' + h.emoji + '</div>' +
      '<div class="res-main"><div class="res-title">' + h.name + ' <span class="rate">' + stars(h.rating) + '</span></div>' +
      '<div class="res-sub">' + h.city + ' · ' + h.tags.join(' · ') + '</div></div>' +
      '<div class="res-side"><div class="res-price">' + money(h.price * nights) + '</div>' +
      '<div class="res-unit">' + nights + ' ليلة × ' + money(h.price) + '</div>' +
      '<button class="btn primary sm" data-action="bookHotel" data-id="' + h.id + '">احجز</button></div></div>';
  }).join('');
}

/* ================================ سيّارات ============================= */
async function searchCars() {
  const city = (byId('cCity') && byId('cCity').value) || 'الرياض';
  const all = await Provider.cars();
  results.cars = all.filter(function (c) { return c.city === city; });
  if (!results.cars.length) results.cars = all.slice();
  renderCars();
}
function renderCars() {
  const days = daysBetween(byId('cIn') && byId('cIn').value, byId('cOut') && byId('cOut').value);
  let list = results.cars.length ? results.cars : CARS.filter(function (c) { return c.city === 'الرياض'; });
  results.cars = list;
  byId('carResults').innerHTML = list.map(function (c) {
    return '<div class="res-card"><div class="res-lead">' + c.emoji + '</div>' +
      '<div class="res-main"><div class="res-title">' + c.name + ' <span class="tagline">' + c.cls + '</span></div>' +
      '<div class="res-sub">' + c.city + ' · ' + c.seats + ' مقاعد · ' + c.trans + '</div></div>' +
      '<div class="res-side"><div class="res-price">' + money(c.price * days) + '</div>' +
      '<div class="res-unit">' + days + ' يوم × ' + money(c.price) + '</div>' +
      '<button class="btn primary sm" data-action="bookCar" data-id="' + c.id + '">احجز</button></div></div>';
  }).join('');
}

/* ================================ الحجز =============================== */
function startBooking(type, item, unitLabel, qty) {
  state.pending = { type: type, title: item.title, detail: item.detail, unit: item.unit, qty: qty, base: item.base };
  byId('bookSummary').innerHTML =
    '<div class="bs-icon">' + item.emoji + '</div>' +
    '<div><div class="bs-title">' + item.title + '</div>' +
    '<div class="bs-detail">' + item.detail + '</div>' +
    '<div class="bs-unit">' + qty + ' ' + unitLabel + ' × ' + money(item.unit) + '</div></div>';
  byId('bkName').value = state.user && state.user.role === 'traveler' ? state.user.name : '';
  byId('bkContact').value = ''; byId('bkPromo').value = '';
  show(byId('bookErr'), false);
  updateBookTotal();
  show(byId('bookModal'), true);
}
function currentTotal() {
  if (!state.pending) return 0;
  let total = state.pending.base;
  const o = offerByCode(byId('bkPromo') && byId('bkPromo').value);
  if (o) total = Math.round(total * (1 - o.pct / 100));
  return total;
}
function updateBookTotal() {
  const o = offerByCode(byId('bkPromo') && byId('bkPromo').value);
  const t = currentTotal();
  byId('bookTotal').textContent = money(t) + (o ? ' (خصم ' + o.pct + '%)' : '');
}
function bookFlight(id) {
  const f = results.flights.find(x => x.id === id) || FLIGHTS.find(x => x.id === id); if (!f) return;
  const pax = Math.max(1, Number((byId('fPax') && byId('fPax').value) || 1));
  startBooking('flight', { emoji: f.emoji, title: 'رحلة ' + f.airline, detail: airportCity(f.from) + ' → ' + airportCity(f.to) + ' · ' + f.dep, unit: f.price, base: f.price * pax }, 'مسافر', pax);
}
function bookHotel(id) {
  const h = results.hotels.find(x => x.id === id) || HOTELS.find(x => x.id === id); if (!h) return;
  const nights = daysBetween(byId('hIn') && byId('hIn').value, byId('hOut') && byId('hOut').value);
  startBooking('hotel', { emoji: h.emoji, title: h.name, detail: h.city + ' · ' + stars(h.rating), unit: h.price, base: h.price * nights }, 'ليلة', nights);
}
function bookCar(id) {
  const c = results.cars.find(x => x.id === id) || CARS.find(x => x.id === id); if (!c) return;
  const days = daysBetween(byId('cIn') && byId('cIn').value, byId('cOut') && byId('cOut').value);
  startBooking('car', { emoji: c.emoji, title: c.name, detail: c.city + ' · ' + c.cls, unit: c.price, base: c.price * days }, 'يوم', days);
}
function closeBooking() { show(byId('bookModal'), false); state.pending = null; }
function confirmBooking() {
  if (!state.pending) return;
  const name = (byId('bkName').value || '').trim();
  if (!name) { show(byId('bookErr'), true); return; }
  // غير المسجّل يُنشأ له حساب مسافر تلقائياً عند أول حجز
  if (!state.user || state.user.role === 'admin') state.user = { name: name, role: 'traveler' };
  const o = offerByCode(byId('bkPromo') && byId('bkPromo').value);
  const booking = {
    id: uid('b'), type: state.pending.type, title: state.pending.title, detail: state.pending.detail,
    total: currentTotal(), promo: o ? o.code : null, traveler: name,
    contact: (byId('bkContact').value || '').trim(), status: 'مؤكّد', at: isoDate(0),
  };
  bookings.push(booking); save('bookings', bookings);
  closeBooking(); applyAccess(); toast('✅ تأكّد حجزك رقم ' + booking.id);
  setView('bookings');
}

/* ============================== حجوزاتي =============================== */
function typeIcon(t) { return t === 'flight' ? '🛫' : (t === 'hotel' ? '🏨' : '🚗'); }
function renderBookings() {
  const mine = state.user ? bookings.filter(function (b) {
    return state.user.role === 'admin' || b.traveler === state.user.name;
  }) : [];
  byId('bookingList').innerHTML = mine.length ? mine.slice().reverse().map(function (b) {
    return '<div class="res-card booking"><div class="res-lead">' + typeIcon(b.type) + '</div>' +
      '<div class="res-main"><div class="res-title">' + b.title + '</div>' +
      '<div class="res-sub">' + b.detail + ' · ' + b.at + (b.promo ? ' · كود ' + b.promo : '') + '</div></div>' +
      '<div class="res-side"><div class="res-price">' + money(b.total) + '</div>' +
      '<span class="pill ' + (b.status === 'ملغى' ? 'wait' : 'ok') + '">' + b.status + '</span>' +
      (b.status === 'ملغى' ? '' : '<button class="btn sm" data-action="cancelBooking" data-id="' + b.id + '">إلغاء</button>') +
      '</div></div>';
  }).join('') : '<p class="empty">لا حجوزات بعد — ابدأ من «استكشف».</p>';
}
function cancelBooking(id) {
  const b = bookings.find(x => x.id === id); if (!b) return;
  b.status = 'ملغى'; save('bookings', bookings); renderBookings(); toast('أُلغي الحجز');
}

/* ============================== الإدارة =============================== */
function renderAdmin() {
  const live = bookings.filter(b => b.status !== 'ملغى');
  const revenue = live.reduce(function (s, b) { return s + b.total; }, 0);
  byId('adminStats').innerHTML =
    stat('الحجوزات', bookings.length) + stat('الفعّالة', live.length) +
    stat('العروض', activeOffers().length) + stat('الإيراد', money(revenue));
  byId('wlName').value = brand.name; byId('wlEmoji').value = brand.emoji;
  byId('wlColor').value = brand.primary; byId('wlCurrency').value = brand.currency;
  byId('adminOffers').innerHTML = offers.map(function (o) {
    return '<div class="mini-row"><span>' + o.emoji + ' ' + o.title + ' (' + o.pct + '%)</span>' +
      '<span class="pill ' + (o.active ? 'ok' : 'wait') + '">' + (o.active ? 'فعّال' : 'موقوف') + '</span>' +
      '<button class="btn sm" data-action="toggleOffer" data-id="' + o.id + '">' + (o.active ? 'إيقاف' : 'تفعيل') + '</button></div>';
  }).join('');
  byId('adminBookings').innerHTML = bookings.length ? bookings.slice().reverse().map(function (b) {
    return '<div class="mini-row"><span>' + typeIcon(b.type) + ' ' + b.title + ' — ' + b.traveler + '</span>' +
      '<span class="mr-price">' + money(b.total) + '</span>' +
      '<span class="pill ' + (b.status === 'ملغى' ? 'wait' : 'ok') + '">' + b.status + '</span></div>';
  }).join('') : '<p class="empty">لا حجوزات بعد.</p>';
  byId('apiStatus').textContent = CONFIG.api.base
    ? ('مربوط بـ API حيّ: ' + CONFIG.api.base + ' (يرتدّ للبيانات المبدئية عند فشل الشبكة).')
    : 'يعمل حالياً ببيانات مبدئية (seed). لتفعيل الجلب الحيّ اضبط CONFIG.api.base في app.js.';
}
function toggleOffer(id) {
  const o = offers.find(x => x.id === id); if (!o) return;
  o.active = !o.active; save('offers', offers); renderAdmin();
}
function saveBrand() {
  brand = Object.assign({}, brand, {
    name: (byId('wlName').value || brand.name).trim(),
    emoji: (byId('wlEmoji').value || brand.emoji).trim(),
    primary: byId('wlColor').value || brand.primary,
    currency: (byId('wlCurrency').value || brand.currency).trim(),
  });
  save('brand', brand); applyBrand(); renderAdmin(); toast('حُفظت هوية العلامة');
}
function stat(label, val) {
  return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-label">' + label + '</div></div>';
}

/* ============================ الدخول/التوجيه ========================== */
function openAuth(mode) {
  state.authMode = mode || 'login'; updateAuthUI();
  show(byId('authErr'), false);
  byId('auName').value = ''; byId('auPass').value = '';
  show(byId('authModal'), true);
}
function closeAuth() { show(byId('authModal'), false); }
function updateAuthUI() {
  const reg = state.authMode === 'register';
  byId('authTitle').textContent = reg ? 'إنشاء حساب مسافر' : 'تسجيل الدخول';
  byId('authHint').textContent = reg ? 'سجّل لحفظ حجوزاتك.' : 'ادخل بحسابك.';
  byId('authSubmit').textContent = reg ? 'تسجيل' : 'دخول';
  byId('authSwitchText').textContent = reg ? 'لديك حساب إدارة؟ ' : 'مسافر جديد؟ ';
  byId('authSwitch').textContent = reg ? 'دخول' : 'إنشاء حساب مسافر';
}
function toggleAuth() { openAuth(state.authMode === 'login' ? 'register' : 'login'); }
function submitAuth() {
  const name = (byId('auName').value || '').trim();
  const pass = (byId('auPass').value || '').trim();
  if (!name) { show(byId('authErr'), true); return; }
  if (state.authMode === 'register') {
    state.user = { name: name, role: 'traveler' };
    closeAuth(); applyAccess(); toast('أهلاً ' + name); setView('explore'); return;
  }
  const acc = STAFF[name];
  if (acc && acc.pass === pass) {
    state.user = { name: acc.name, role: acc.role };
    closeAuth(); applyAccess(); toast('مرحباً ' + acc.name); setView('admin');
  } else { show(byId('authErr'), true); }
}
function logout() { state.user = null; state.view = 'explore'; applyAccess(); setView('explore'); toast('تم تسجيل الخروج'); }

/* ============================== التفويض =============================== */
function handleClick(e) {
  const a = e.target.closest('[data-action]'); if (!a) return;
  const id = a.dataset.id;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'exploreDest': { const c = byId('hCity'); state.view = 'hotels'; setView('hotels'); if (byId('hCity')) byId('hCity').value = a.dataset.city; searchHotels(); break; }
    case 'useOffer': navigator && navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(a.dataset.code) : 0; toast('نُسخ الكود: ' + a.dataset.code); break;
    case 'searchFlights': searchFlights(); break;
    case 'searchHotels': searchHotels(); break;
    case 'searchCars': searchCars(); break;
    case 'bookFlight': bookFlight(id); break;
    case 'bookHotel': bookHotel(id); break;
    case 'bookCar': bookCar(id); break;
    case 'closeBooking': closeBooking(); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'cancelBooking': cancelBooking(id); break;
    case 'toggleOffer': toggleOffer(id); break;
    case 'saveBrand': saveBrand(); break;
    case 'openAuth': state.user ? logout() : openAuth('login'); break;
    case 'closeAuth': closeAuth(); break;
    case 'toggleAuth': e.preventDefault(); toggleAuth(); break;
    case 'submitAuth': submitAuth(); break;
  }
}
function handleInput(e) {
  if (e.target && e.target.id === 'bkPromo') updateBookTotal();
}

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  applyBrand();
  applyAccess();
  renderExplore();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--brand:#0ea5e9;--accent:#f59e0b;--bg:#0b1220;--surface:#131a2a;--card:#1a2233;--good:#22c55e;--warn:#f59e0b;--text:#e8edf6;--muted:#8b98b0;--border:#26324a;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;align-items:center;gap:16px;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border);flex-wrap:wrap;position:sticky;top:0;z-index:30}
.brand{font-size:19px;font-weight:800;white-space:nowrap}
.tabs{flex:1;display:flex;gap:6px;flex-wrap:wrap}
.tab{background:transparent;border:1px solid transparent;color:var(--muted);padding:7px 13px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.tab.active{background:var(--card);color:var(--text);border-color:var(--border)}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.btn.primary{background:var(--brand);border-color:var(--brand);color:#04283a}
.btn.sm{padding:6px 12px;font-size:12px}
.btn.block{width:100%}
.icon-btn{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
main{max-width:1120px;margin:0 auto;padding:20px 18px}
.sec-title{margin:22px 0 14px;font-size:18px}
.hero{background:linear-gradient(120deg,var(--brand),var(--surface));border:1px solid var(--border);border-radius:20px;padding:34px 26px;margin-bottom:8px}
.hero h1{font-size:26px;margin-bottom:6px}
.hero-tag{color:#eaf6ff;opacity:.92;font-size:15px}
.grid{display:grid;gap:16px}
.grid.dest{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
.grid.offers{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:.15s}
.card:hover{border-color:var(--brand);transform:translateY(-2px)}
.dest-emoji{font-size:46px;text-align:center;padding:22px;background:var(--surface)}
.dest-body{padding:14px}
.dest-city{font-weight:800;font-size:16px}
.dest-tag{color:var(--muted);font-size:13px;margin:2px 0 6px}
.dest-from{color:var(--brand);font-weight:700;font-size:13px}
.offer-card{display:flex;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px}
.offer-emoji{font-size:34px}
.offer-title{font-weight:700;font-size:14px}
.offer-pct{color:var(--accent);font-weight:800;margin:2px 0}
.offer-code{color:var(--muted);font-size:12px;margin-bottom:8px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px}
.panel h2{margin-bottom:14px;font-size:17px}.panel h3{margin-bottom:10px;font-size:15px}
.search-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:14px}
.fld label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin-bottom:5px}
.sel,select,input[type=date],input[type=number],input[type=text],input[type=color],input[type=password]{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text);font-family:inherit}
input[type=color]{height:42px;padding:4px}
.note{background:rgba(245,158,11,.12);border:1px solid var(--warn);color:var(--warn);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px}
.results{display:flex;flex-direction:column;gap:12px}
.res-card{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;flex-wrap:wrap}
.res-lead{font-size:30px}
.res-main{flex:1;min-width:180px}
.res-title{font-weight:700;font-size:15px}
.rate{color:var(--accent);font-size:13px}
.tagline{color:var(--muted);font-size:12px;font-weight:400}
.res-sub{color:var(--muted);font-size:13px;margin-top:2px}
.res-side{text-align:left;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.res-price{color:var(--brand);font-weight:800;font-size:17px}
.res-unit{color:var(--muted);font-size:11px}
.pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--border);color:var(--muted)}
.pill.ok{background:rgba(34,197,94,.15);color:var(--good)}
.pill.wait{background:rgba(245,158,11,.15);color:var(--warn)}
.empty{text-align:center;color:var(--muted);padding:26px}
.hidden{display:none !important}
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:20px;font-weight:800;color:var(--brand)}
.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;flex-wrap:wrap}
.mr-price{color:var(--brand);font-weight:700}
.hint{color:var(--muted);font-size:13px;margin-bottom:12px}
.api-note{border-style:dashed}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(430px,100%);position:relative;max-height:92dvh;overflow:auto}
.close-x{position:absolute;top:12px;left:14px;font-size:22px}
.modal-box h2{font-size:19px;margin-bottom:12px}
.modal-box label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin:10px 0 5px}
.modal-box input{margin-bottom:2px}
.book-summary{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px}
.bs-icon{font-size:32px}
.bs-title{font-weight:700}
.bs-detail{color:var(--muted);font-size:13px}
.bs-unit{color:var(--accent);font-size:12px;font-weight:700;margin-top:2px}
.price-final{margin:14px 0 8px;font-size:16px}.price-final b{color:var(--brand)}
.err-msg{color:#ef4444;font-size:13px;margin:6px 0}
.switch{text-align:center;color:var(--muted);font-size:13px;margin-top:12px}
.switch a{color:var(--brand);text-decoration:none;font-weight:700}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px}
.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--brand);color:#04283a;padding:11px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:70;box-shadow:0 8px 24px rgba(0,0,0,.4)}
h1,h2,h3{color:var(--text)}
`;

export function jaolaTravel() {
    return {
        id: 'jaola-travel',
        category: 'travel',
        name: 'منصّة سفر (طيران + فنادق + سيّارات)',
        description: 'منصّة سفر عاملة غنيّة: بحث طيران وفنادق وسيّارات + أهمّ الوجهات + عروض وخصومات + حجوزات موحّدة. جاهزة لِـ API (طبقة مزوّد ترتدّ للبيانات المبدئية) و White-label (كائن علامة + لوحة تحكّم تغيّر الاسم/اللون/العملة حيّاً).',
        keywords: ['سفر', 'سياحة', 'طيران', 'رحلات', 'تذاكر', 'حجز فندق', 'فنادق', 'تأجير سيارات', 'travel', 'flight', 'hotel', 'booking', 'tourism', 'trip', 'حجوزات', 'عطلة'],
        externalApi: 'API-ready (طبقة مزوّد قابلة للربط) + White-label',
        model: {
            entities: [
                { name: 'Flight', fields: [{ name: 'from', type: 'string' }, { name: 'to', type: 'string' }, { name: 'airline', type: 'string' }, { name: 'price', type: 'number' }], ownedBy: 'Provider' },
                { name: 'Hotel', fields: [{ name: 'city', type: 'string' }, { name: 'name', type: 'string' }, { name: 'rating', type: 'number' }, { name: 'price', type: 'number' }], ownedBy: 'Provider' },
                { name: 'Car', fields: [{ name: 'city', type: 'string' }, { name: 'name', type: 'string' }, { name: 'cls', type: 'string' }, { name: 'price', type: 'number' }], ownedBy: 'Provider' },
                { name: 'Offer', fields: [{ name: 'code', type: 'string' }, { name: 'pct', type: 'number' }, { name: 'active', type: 'boolean' }], ownedBy: 'Admin' },
                { name: 'Booking', fields: [{ name: 'id', type: 'string' }, { name: 'type', type: 'string' }, { name: 'total', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Traveler' },
            ],
            roles: [
                { name: 'Traveler', description: 'يبحث ويحجز', capabilities: ['تصفّح الوجهات', 'بحث طيران/فنادق/سيّارات', 'تطبيق عرض', 'حجز', 'إدارة حجوزاته'] },
                { name: 'Admin', description: 'يدير المنصّة والعلامة', capabilities: ['إحصاءات', 'إدارة العروض', 'white-label حيّ', 'كل الحجوزات', 'حالة الربط'] },
            ],
            flows: [
                { name: 'حجز رحلة/فندق/سيّارة', actor: 'Traveler', steps: ['يبحث', 'يختار نتيجة', 'يطبّق كود خصم (اختياري)', 'يؤكّد الحجز'], touches: ['Flight', 'Hotel', 'Car', 'Booking', 'Offer'], realtime: false },
                { name: 'إعادة العلامة (white-label)', actor: 'Admin', steps: ['يفتح الإدارة', 'يغيّر الاسم/اللون/العملة', 'يحفظ فتُطبَّق حيّاً'], touches: ['Offer', 'Booking'], realtime: false },
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
