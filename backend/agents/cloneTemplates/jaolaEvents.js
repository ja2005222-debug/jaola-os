/**
 * 🎟️ jaola-events — منصّة بيع تذاكر مناسبات *عاملة* واحترافية ومترابطة.
 *
 * تدفّق حقيقي متماسك: استكشاف (فلاتر) → صفحة حدث بفئات تذاكر ومقاعد متبقّية →
 * سلّة تذاكر → دفع (كود خصم) → تذكرة مرئيّة في «تذاكري» (برمز حجز وحالة).
 *
 * ثلاثة أدوار وصلاحيات: زائر/مشترٍ (يتصفّح ويشتري ويرى تذاكره) · منظّم (لوحته:
 * ينشئ حدثاً بفئات تذاكر — يظهر فوراً في الاستكشاف — ويتابع مبيعاته وحضوره) ·
 * مدير (نشر/إخفاء الأحداث + إحصاءات). اللوحات مخفيّة عن المشتري، والدخول يوجّه
 * كل حساب لصفحته؛ المشتري يسجّل عند إتمام الشراء.
 *
 * الحالة في localStorage، كل الدوال معرّفة (تفويض أحداث)، يجتاز التحقّق السلوكي 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تذاكر jaola</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">🎟️ <span id="brandName">تذاكر jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn" id="authBtn" data-action="openAuth">دخول</button>
  </header>

  <main>
    <!-- استكشاف -->
    <section id="view-explore" class="view">
      <div class="hero">
        <h1>عِش اللحظة — احجز تذكرتك</h1>
        <p class="hero-tag">حفلات · رياضة · مؤتمرات · مسرح · ورش — كل المناسبات في مكان واحد.</p>
      </div>
      <div class="toolbar">
        <input id="search" class="search" placeholder="ابحث عن حدث أو مكان...">
        <div class="filters-row">
          <select id="cityFilter" class="sel"></select>
          <select id="sortFilter" class="sel">
            <option value="date">الأقرب تاريخاً</option>
            <option value="price">الأرخص</option>
          </select>
        </div>
        <div class="chips" id="catChips"></div>
      </div>
      <div id="eventGrid" class="grid"></div>
      <p id="emptyExplore" class="empty hidden">لا مناسبات مطابقة للبحث.</p>
    </section>

    <!-- صفحة الحدث -->
    <section id="view-event" class="view hidden">
      <button class="back-btn" data-action="backExplore">→ رجوع للمناسبات</button>
      <div id="eventDetail"></div>
    </section>

    <!-- تذاكري -->
    <section id="view-tickets" class="view hidden">
      <h2 class="sec-title">تذاكري</h2>
      <div id="ticketList" class="tickets"></div>
    </section>

    <!-- لوحة المنظّم -->
    <section id="view-organize" class="view hidden">
      <h2 class="sec-title">لوحة المنظّم</h2>
      <div class="stat-row" id="organizeStats"></div>
      <div class="panel">
        <h3>إنشاء مناسبة</h3>
        <div class="search-grid">
          <div class="fld"><label>العنوان</label><input id="neTitle" placeholder="اسم المناسبة"></div>
          <div class="fld"><label>الفئة</label><select id="neCat" class="sel"></select></div>
          <div class="fld"><label>المدينة</label><select id="neCity" class="sel"></select></div>
          <div class="fld"><label>المكان</label><input id="neVenue" placeholder="القاعة/الملعب"></div>
          <div class="fld"><label>التاريخ</label><input id="neDate" type="date"></div>
          <div class="fld"><label>الوقت</label><input id="neTime" type="time" value="20:00"></div>
          <div class="fld"><label>سعر التذكرة العادية</label><input id="nePrice" type="number" min="0" placeholder="﷼"></div>
          <div class="fld"><label>عدد التذاكر</label><input id="neQty" type="number" min="1" value="200"></div>
        </div>
        <button class="btn primary" data-action="addEvent">نشر المناسبة</button>
      </div>
      <div class="panel">
        <h3>مناسباتي</h3>
        <div id="organizeEvents" class="mini-list"></div>
      </div>
    </section>

    <!-- لوحة الإدارة -->
    <section id="view-admin" class="view hidden">
      <h2 class="sec-title">لوحة الإدارة</h2>
      <div class="stat-row" id="adminStats"></div>
      <div class="panel">
        <h3>كل المناسبات</h3>
        <div id="adminEvents" class="mini-list"></div>
      </div>
    </section>
  </main>

  <!-- نافذة الدفع -->
  <div id="checkoutModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="closeCheckout">×</button>
      <h2>إتمام الشراء</h2>
      <div id="checkoutSummary" class="co-summary"></div>
      <label>اسم المشترٍ</label>
      <input id="coName" placeholder="الاسم الكامل">
      <label>البريد / الجوّال</label>
      <input id="coContact" placeholder="لإرسال التذاكر">
      <label>كود خصم (اختياري)</label>
      <input id="coPromo" placeholder="مثال: EARLY">
      <p id="coErr" class="err-msg hidden">أكمل اسم المشترٍ.</p>
      <div class="co-total">الإجمالي: <b id="coTotal">—</b></div>
      <button class="btn primary block" data-action="confirmPurchase">تأكيد وإصدار التذاكر</button>
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
        <a href="#" data-action="toggleAuth" id="authSwitch">إنشاء حساب</a></p>
      <p class="demo">حسابات تجربة: <code>admin/1234</code> · <code>organizer/1234</code></p>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🎟️ منطق منصّة التذاكر — كل الدوال معرّفة، تفويض أحداث، صلاحيات، تدفّق مترابط.
'use strict';

const STAFF = {
  admin:     { pass: '1234', role: 'admin',     name: 'مدير المنصّة' },
  organizer: { pass: '1234', role: 'organizer', name: 'شركة الفعّاليات' },
};
const CATEGORIES = ['حفلات موسيقية', 'رياضة', 'مؤتمرات', 'مسرح', 'ورش عمل'];
const CITIES = ['الرياض', 'جدة', 'الدمام', 'أبها', 'المدينة'];
const PROMOS = [
  { code: 'EARLY', pct: 15 }, { code: 'VIP10', pct: 10 }, { code: 'JAOLA20', pct: 20 },
];

function grad(a, b) { return 'linear-gradient(135deg,' + a + ',' + b + ')'; }
const SEED_EVENTS = [
  { id: 'e1', title: 'ليلة الطرب العربي', category: 'حفلات موسيقية', city: 'الرياض', venue: 'المسرح الكبير', date: '2026-08-20', time: '21:00', emoji: '🎤', g: grad('#7c3aed', '#db2777'), organizer: 'شركة الفعّاليات', approved: true, featured: true,
    desc: 'أمسية غنائية استثنائية مع نخبة الفنانين وأوركسترا حيّة.',
    tiers: [{ id: 't1', name: 'عادي', price: 150, qty: 300 }, { id: 't2', name: 'VIP', price: 400, qty: 80 }, { id: 't3', name: 'بلاتيني', price: 750, qty: 20 }] },
  { id: 'e2', title: 'نهائي كأس المدينة', category: 'رياضة', city: 'جدة', venue: 'الملعب الأولمبي', date: '2026-09-05', time: '19:30', emoji: '⚽', g: grad('#059669', '#0ea5e9'), organizer: 'شركة الفعّاليات', approved: true, featured: true,
    desc: 'المباراة النهائية المرتقبة — أجواء حماسية ومدرّجات كاملة.',
    tiers: [{ id: 't1', name: 'مدرّج عام', price: 80, qty: 500 }, { id: 't2', name: 'الفئة الأولى', price: 200, qty: 150 }, { id: 't3', name: 'المقصورة', price: 500, qty: 40 }] },
  { id: 'e3', title: 'مؤتمر التقنية 2026', category: 'مؤتمرات', city: 'الرياض', venue: 'مركز المؤتمرات', date: '2026-10-12', time: '09:00', emoji: '💡', g: grad('#2563eb', '#7c3aed'), organizer: 'شركة الفعّاليات', approved: true, featured: false,
    desc: 'ثلاثة أيّام من الجلسات وورش العمل مع روّاد التقنية.',
    tiers: [{ id: 't1', name: 'حضور', price: 300, qty: 400 }, { id: 't2', name: 'محترف', price: 700, qty: 120 }] },
  { id: 'e4', title: 'مسرحية «الرحلة»', category: 'مسرح', city: 'الدمام', venue: 'مسرح الواجهة', date: '2026-08-28', time: '20:30', emoji: '🎭', g: grad('#b45309', '#dc2626'), organizer: 'شركة الفعّاليات', approved: true, featured: false,
    desc: 'عمل مسرحي كوميدي درامي يناسب العائلة.',
    tiers: [{ id: 't1', name: 'عادي', price: 100, qty: 200 }, { id: 't2', name: 'أمامي', price: 220, qty: 60 }] },
  { id: 'e5', title: 'ورشة التصوير الاحترافي', category: 'ورش عمل', city: 'أبها', venue: 'استوديو الضوء', date: '2026-09-18', time: '16:00', emoji: '📷', g: grad('#0891b2', '#4f46e5'), organizer: 'شركة الفعّاليات', approved: true, featured: false,
    desc: 'ورشة عملية ليوم كامل مع مدرّب معتمد — أدوات وشهادة.',
    tiers: [{ id: 't1', name: 'مقعد', price: 250, qty: 40 }] },
];

const state = {
  user: null, view: 'explore', cat: 'الكل', city: 'الكل', sort: 'date', search: '',
  authMode: 'login', openEvent: null, cart: {}, promo: null,
};

function load(key, fb) { try { var v = localStorage.getItem('jev_' + key); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function save(key, val) { try { localStorage.setItem('jev_' + key, JSON.stringify(val)); } catch {} }

let events = load('events', SEED_EVENTS);
let orders = load('orders', []); // { id, eventId, eventTitle, tierName, qty, unit, total, code, buyer, status, at }

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US') + ' ﷼'; }
function eventById(id) { return events.find(function (e) { return e.id === id; }) || null; }
function tierOf(ev, tid) { return ev ? ev.tiers.find(function (t) { return t.id === tid; }) || null : null; }
function uid(p) { return p + Math.random().toString(36).slice(2, 7); }
function ticketCode() { var s = 'JEV-'; var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function promoByCode(code) { var q = String(code || '').trim().toUpperCase(); return PROMOS.find(function (p) { return p.code === q; }) || null; }
function dayName(dateStr) { try { var d = new Date(dateStr); return ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d.getDay()]; } catch { return ''; } }
function soldOut(ev) { return ev.tiers.every(function (t) { return t.qty <= 0; }); }
function toast(msg) {
  var t = byId('toast'); if (!t) return;
  t.textContent = msg; show(t, true);
  clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400);
}

function isoDate(offset) { var d = new Date(); d.setDate(d.getDate() + (offset || 0)); return d.toISOString().slice(0, 10); }

/* ---------- الصلاحيات ---------- */
function renderTabs() {
  var role = state.user && state.user.role;
  var tabs = [{ id: 'explore', label: 'المناسبات' }];
  if (!role || role === 'buyer') tabs.push({ id: 'tickets', label: 'تذاكري' });
  if (role === 'organizer') tabs.push({ id: 'organize', label: 'لوحة المنظّم' });
  if (role === 'admin') tabs.push({ id: 'admin', label: 'الإدارة' });
  byId('tabs').innerHTML = tabs.map(function (t) {
    return '<button class="tab ' + (state.view === t.id ? 'active' : '') + '" data-action="tab" data-view="' + t.id + '">' + t.label + '</button>';
  }).join('');
}
function applyAccess() {
  var role = state.user && state.user.role;
  var buyerSide = !role || role === 'buyer';
  show(byId('view-explore'), state.view === 'explore');
  show(byId('view-event'), state.view === 'event');
  show(byId('view-tickets'), state.view === 'tickets' && buyerSide);
  show(byId('view-organize'), state.view === 'organize' && role === 'organizer');
  show(byId('view-admin'), state.view === 'admin' && role === 'admin');
  var btn = byId('authBtn');
  if (btn) btn.textContent = state.user ? ('خروج (' + state.user.name + ')') : 'دخول';
  renderTabs();
}
function setView(view) {
  var role = state.user && state.user.role;
  if (view === 'organize' && role !== 'organizer') view = 'explore';
  if (view === 'admin' && role !== 'admin') view = 'explore';
  if (view === 'tickets' && !(!role || role === 'buyer')) view = 'explore';
  state.view = view;
  applyAccess();
  if (view === 'explore') renderExplore();
  if (view === 'event') renderEvent();
  if (view === 'tickets') renderTickets();
  if (view === 'organize') renderOrganize();
  if (view === 'admin') renderAdmin();
}

/* ---------- استكشاف ---------- */
function renderFilters() {
  var chips = ['الكل'].concat(CATEGORIES);
  byId('catChips').innerHTML = chips.map(function (c) {
    return '<button class="chip ' + (state.cat === c ? 'active' : '') + '" data-action="cat" data-cat="' + c + '">' + c + '</button>';
  }).join('');
  byId('cityFilter').innerHTML = ['الكل'].concat(CITIES).map(function (c) {
    return '<option value="' + c + '">' + (c === 'الكل' ? 'كل المدن' : c) + '</option>';
  }).join('');
  byId('cityFilter').value = state.city;
}
function visibleEvents() {
  var list = events.filter(function (e) { return e.approved; });
  if (state.cat !== 'الكل') list = list.filter(function (e) { return e.category === state.cat; });
  if (state.city !== 'الكل') list = list.filter(function (e) { return e.city === state.city; });
  var q = state.search.trim().toLowerCase();
  if (q) list = list.filter(function (e) { return e.title.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q) || e.city.toLowerCase().includes(q); });
  if (state.sort === 'price') list.sort(function (a, b) { return minPrice(a) - minPrice(b); });
  else list.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return list;
}
function minPrice(ev) { return Math.min.apply(null, ev.tiers.map(function (t) { return t.price; })); }
function renderExplore() {
  renderFilters();
  var list = visibleEvents();
  show(byId('emptyExplore'), list.length === 0);
  byId('eventGrid').innerHTML = list.map(function (e) {
    var out = soldOut(e);
    return '<div class="card ' + (out ? 'is-out' : '') + '" data-action="openEvent" data-id="' + e.id + '">' +
      '<div class="poster" style="background:' + e.g + '"><span class="poster-emoji">' + e.emoji + '</span>' +
      (e.featured ? '<span class="badge-feat">مميّز</span>' : '') +
      (out ? '<span class="badge-out">نفدت التذاكر</span>' : '') + '</div>' +
      '<div class="ev-body"><div class="ev-cat">' + e.category + '</div>' +
      '<div class="ev-title">' + e.title + '</div>' +
      '<div class="ev-meta">📅 ' + dayName(e.date) + ' ' + e.date + ' · ' + e.time + '</div>' +
      '<div class="ev-meta">📍 ' + e.venue + '، ' + e.city + '</div>' +
      '<div class="ev-price">تبدأ من ' + money(minPrice(e)) + '</div></div></div>';
  }).join('');
}

/* ---------- صفحة الحدث ---------- */
function openEvent(id) { state.openEvent = id; state.cart = {}; setView('event'); }
function backExplore() { state.openEvent = null; setView('explore'); }
function renderEvent() {
  var e = eventById(state.openEvent); if (!e) { backExplore(); return; }
  var tiers = e.tiers.map(function (t) {
    var qty = state.cart[t.id] || 0;
    var out = t.qty <= 0;
    return '<div class="tier ' + (out ? 'is-out' : '') + '">' +
      '<div class="tier-info"><div class="tier-name">' + t.name + '</div>' +
      '<div class="tier-left">' + (out ? 'نفدت' : 'متبقّي ' + t.qty) + '</div></div>' +
      '<div class="tier-price">' + money(t.price) + '</div>' +
      (out ? '<span class="tier-out">—</span>' :
        '<div class="stepper"><button class="icon-btn" data-action="tierMinus" data-id="' + t.id + '">−</button>' +
        '<b>' + qty + '</b><button class="icon-btn" data-action="tierPlus" data-id="' + t.id + '">+</button></div>') +
      '</div>';
  }).join('');
  var total = eventCartTotal();
  var count = cartCount();
  byId('eventDetail').innerHTML =
    '<div class="event-hero" style="background:' + e.g + '"><span class="eh-emoji">' + e.emoji + '</span></div>' +
    '<div class="event-info">' +
    '<div class="ev-cat">' + e.category + '</div>' +
    '<h1 class="event-title">' + e.title + '</h1>' +
    '<div class="event-facts">' +
    '<div class="fact">📅 <b>' + dayName(e.date) + ' ' + e.date + '</b><span>' + e.time + '</span></div>' +
    '<div class="fact">📍 <b>' + e.venue + '</b><span>' + e.city + '</span></div>' +
    '<div class="fact">🎫 <b>' + e.tiers.length + ' فئات</b><span>تذاكر</span></div>' +
    '</div>' +
    '<p class="event-desc">' + e.desc + '</p>' +
    '<h3>اختر تذاكرك</h3>' +
    '<div class="tiers">' + tiers + '</div>' +
    '<div class="buy-bar"><div class="buy-total">' + (count ? count + ' تذكرة · ' + money(total) : 'لم تختر تذاكر بعد') + '</div>' +
    '<button class="btn primary" data-action="proceedCheckout"' + (count ? '' : ' disabled') + '>متابعة الشراء</button></div>' +
    '</div>';
}
function changeTier(tid, delta) {
  var e = eventById(state.openEvent); var t = tierOf(e, tid); if (!t) return;
  var cur = state.cart[tid] || 0;
  var next = cur + delta;
  if (next < 0) next = 0;
  if (next > t.qty) { toast('لم يتبقَّ سوى ' + t.qty + ' تذكرة'); next = t.qty; }
  if (next === 0) delete state.cart[tid]; else state.cart[tid] = next;
  renderEvent();
}
function cartCount() { return Object.keys(state.cart).reduce(function (s, k) { return s + state.cart[k]; }, 0); }
function eventCartTotal() {
  var e = eventById(state.openEvent); if (!e) return 0;
  return Object.keys(state.cart).reduce(function (s, tid) { var t = tierOf(e, tid); return s + (t ? t.price * state.cart[tid] : 0); }, 0);
}

/* ---------- الدفع ---------- */
function proceedCheckout() {
  if (!cartCount()) { toast('اختر تذكرة واحدة على الأقل'); return; }
  renderCheckout();
  byId('coName').value = state.user && state.user.role === 'buyer' ? state.user.name : '';
  byId('coContact').value = ''; byId('coPromo').value = '';
  show(byId('coErr'), false);
  show(byId('checkoutModal'), true);
}
function renderCheckout() {
  var e = eventById(state.openEvent); if (!e) return;
  var lines = Object.keys(state.cart).map(function (tid) {
    var t = tierOf(e, tid); var qty = state.cart[tid];
    return '<div class="co-line"><span>' + t.name + ' × ' + qty + '</span><span>' + money(t.price * qty) + '</span></div>';
  }).join('');
  byId('checkoutSummary').innerHTML =
    '<div class="co-event">' + e.emoji + ' <b>' + e.title + '</b><br><span>' + e.date + ' · ' + e.venue + '</span></div>' + lines;
  updateCoTotal();
}
function coTotal() {
  var base = eventCartTotal();
  var p = promoByCode(byId('coPromo') && byId('coPromo').value);
  return p ? Math.round(base * (1 - p.pct / 100)) : base;
}
function updateCoTotal() {
  var p = promoByCode(byId('coPromo') && byId('coPromo').value);
  byId('coTotal').textContent = money(coTotal()) + (p ? ' (خصم ' + p.pct + '%)' : '');
}
function closeCheckout() { show(byId('checkoutModal'), false); }
function confirmPurchase() {
  var e = eventById(state.openEvent); if (!e) return;
  var name = (byId('coName').value || '').trim();
  if (!name) { show(byId('coErr'), true); return; }
  // المشتري يسجّل نفسه عند الشراء
  if (!state.user || state.user.role !== 'buyer') state.user = { name: name, role: 'buyer' };
  var p = promoByCode(byId('coPromo') && byId('coPromo').value);
  var factor = p ? (1 - p.pct / 100) : 1;
  Object.keys(state.cart).forEach(function (tid) {
    var t = tierOf(e, tid); var qty = state.cart[tid];
    if (!t || qty <= 0) return;
    t.qty -= qty; if (t.qty < 0) t.qty = 0;
    orders.push({
      id: uid('o'), eventId: e.id, eventTitle: e.title, emoji: e.emoji, date: e.date, venue: e.venue, city: e.city,
      tierName: t.name, qty: qty, unit: t.price, total: Math.round(t.price * qty * factor),
      code: ticketCode(), buyer: name, status: 'صالحة', at: isoDate(0),
    });
  });
  save('events', events); save('orders', orders);
  state.cart = {};
  closeCheckout(); applyAccess();
  toast('🎉 تمّ إصدار تذاكرك!');
  setView('tickets');
}

/* ---------- تذاكري ---------- */
function renderTickets() {
  var mine = state.user ? orders.filter(function (o) { return o.buyer === state.user.name; }) : [];
  byId('ticketList').innerHTML = mine.length ? mine.slice().reverse().map(function (o) {
    var cancelled = o.status === 'ملغاة';
    return '<div class="ticket ' + (cancelled ? 'is-cancelled' : '') + '">' +
      '<div class="tk-stub"><div class="tk-emoji">' + o.emoji + '</div><div class="tk-code">' + o.code + '</div></div>' +
      '<div class="tk-body"><div class="tk-title">' + o.eventTitle + '</div>' +
      '<div class="tk-meta">' + o.tierName + ' × ' + o.qty + ' · ' + money(o.total) + '</div>' +
      '<div class="tk-meta">📅 ' + o.date + ' · 📍 ' + o.venue + '، ' + o.city + '</div>' +
      '<div class="tk-foot"><span class="pill ' + (cancelled ? 'wait' : 'ok') + '">' + o.status + '</span>' +
      (cancelled ? '' : '<button class="btn sm" data-action="cancelTicket" data-id="' + o.id + '">إلغاء</button>') +
      '</div></div></div>';
  }).join('') : '<p class="empty">لا تذاكر بعد — تصفّح «المناسبات» واحجز.</p>';
}
function cancelTicket(id) {
  var o = orders.find(function (x) { return x.id === id; }); if (!o || o.status === 'ملغاة') return;
  o.status = 'ملغاة';
  var e = eventById(o.eventId); var t = e ? e.tiers.find(function (x) { return x.name === o.tierName; }) : null;
  if (t) t.qty += o.qty; // إعادة المقاعد
  save('orders', orders); save('events', events);
  renderTickets(); toast('أُلغيت التذكرة واسترجعت المقاعد');
}

/* ---------- لوحة المنظّم ---------- */
function fillEventForm() {
  byId('neCat').innerHTML = CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  byId('neCity').innerHTML = CITIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  if (!byId('neDate').value) byId('neDate').value = isoDate(14);
}
function myEvents() { return state.user ? events.filter(function (e) { return e.organizer === state.user.name; }) : []; }
function salesOf(ev) { return orders.filter(function (o) { return o.eventId === ev.id && o.status !== 'ملغاة'; }); }
function renderOrganize() {
  fillEventForm();
  var mine = myEvents();
  var allSales = orders.filter(function (o) { return o.status !== 'ملغاة' && mine.some(function (e) { return e.id === o.eventId; }); });
  var revenue = allSales.reduce(function (s, o) { return s + o.total; }, 0);
  var attendees = allSales.reduce(function (s, o) { return s + o.qty; }, 0);
  byId('organizeStats').innerHTML =
    stat('مناسباتي', mine.length) + stat('التذاكر المُباعة', attendees) + stat('الإيراد', money(revenue));
  byId('organizeEvents').innerHTML = mine.length ? mine.map(function (e) {
    var s = salesOf(e); var sold = s.reduce(function (a, o) { return a + o.qty; }, 0);
    var left = e.tiers.reduce(function (a, t) { return a + t.qty; }, 0);
    return '<div class="mini-row"><span>' + e.emoji + ' ' + e.title + ' · ' + e.date + '</span>' +
      '<span class="pill">بيع ' + sold + ' · متبقّي ' + left + '</span>' +
      '<span class="pill ' + (e.approved ? 'ok' : 'wait') + '">' + (e.approved ? 'منشور' : 'موقوف') + '</span></div>';
  }).join('') : '<p class="empty">لا مناسبات بعد — أنشئ أولها.</p>';
}
function addEvent() {
  var title = (byId('neTitle').value || '').trim();
  var price = Number(byId('nePrice').value || 0);
  var qty = Number(byId('neQty').value || 0);
  if (!title || !(price > 0) || !(qty > 0)) { toast('أكمل العنوان والسعر وعدد التذاكر'); return; }
  var cat = byId('neCat').value, city = byId('neCity').value;
  var palettes = [['#7c3aed', '#db2777'], ['#059669', '#0ea5e9'], ['#2563eb', '#7c3aed'], ['#b45309', '#dc2626'], ['#0891b2', '#4f46e5']];
  var pal = palettes[Math.floor(Math.random() * palettes.length)];
  events.push({
    id: uid('e'), title: title, category: cat, city: city, venue: (byId('neVenue').value || 'يُحدّد لاحقاً').trim(),
    date: byId('neDate').value || isoDate(14), time: byId('neTime').value || '20:00', emoji: '🎫', g: grad(pal[0], pal[1]),
    organizer: state.user.name, approved: true, featured: false, desc: 'مناسبة من تنظيم ' + state.user.name + '.',
    tiers: [{ id: 't1', name: 'عادي', price: price, qty: qty }, { id: 't2', name: 'VIP', price: price * 2, qty: Math.max(10, Math.round(qty * 0.2)) }],
  });
  save('events', events);
  byId('neTitle').value = ''; byId('neVenue').value = ''; byId('nePrice').value = '';
  renderOrganize(); toast('نُشرت المناسبة — ظهرت في الاستكشاف');
}

/* ---------- لوحة الإدارة ---------- */
function renderAdmin() {
  var live = orders.filter(function (o) { return o.status !== 'ملغاة'; });
  var revenue = live.reduce(function (s, o) { return s + o.total; }, 0);
  byId('adminStats').innerHTML =
    stat('المناسبات', events.length) + stat('التذاكر المُباعة', live.reduce(function (s, o) { return s + o.qty; }, 0)) +
    stat('المنظّمون', uniqueOrganizers().length) + stat('الإيراد', money(revenue));
  byId('adminEvents').innerHTML = events.map(function (e) {
    return '<div class="mini-row"><span>' + e.emoji + ' ' + e.title + ' — ' + e.organizer + '</span>' +
      '<span class="pill ' + (e.approved ? 'ok' : 'wait') + '">' + (e.approved ? 'منشور' : 'موقوف') + '</span>' +
      '<button class="btn sm" data-action="toggleEvent" data-id="' + e.id + '">' + (e.approved ? 'إيقاف' : 'نشر') + '</button></div>';
  }).join('');
}
function uniqueOrganizers() { var set = {}; events.forEach(function (e) { set[e.organizer] = 1; }); return Object.keys(set); }
function toggleEvent(id) { var e = eventById(id); if (!e) return; e.approved = !e.approved; save('events', events); renderAdmin(); }
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
  byId('authTitle').textContent = reg ? 'إنشاء حساب' : 'تسجيل الدخول';
  byId('authHint').textContent = reg ? 'سجّل لحفظ تذاكرك ومتابعتها.' : 'ادخل بحسابك لتُوجَّه لصفحتك.';
  byId('authSubmit').textContent = reg ? 'تسجيل' : 'دخول';
  byId('authSwitchText').textContent = reg ? 'لديك حساب طاقم؟ ' : 'مستخدم جديد؟ ';
  byId('authSwitch').textContent = reg ? 'دخول' : 'إنشاء حساب';
}
function toggleAuth() { openAuth(state.authMode === 'login' ? 'register' : 'login'); }
function routeByRole() {
  if (!state.user) return setView('explore');
  if (state.user.role === 'admin') return setView('admin');
  if (state.user.role === 'organizer') return setView('organize');
  return setView('explore');
}
function submitAuth() {
  var name = (byId('auName').value || '').trim();
  var pass = (byId('auPass').value || '').trim();
  if (!name) { show(byId('authErr'), true); return; }
  if (state.authMode === 'register') {
    state.user = { name: name, role: 'buyer' };
    closeAuth(); applyAccess(); toast('أهلاً ' + name); setView('explore'); return;
  }
  var acc = STAFF[name];
  if (acc && acc.pass === pass) {
    state.user = { name: acc.name, role: acc.role };
    closeAuth(); applyAccess(); toast('مرحباً ' + acc.name); routeByRole();
  } else { show(byId('authErr'), true); }
}
function logout() { state.user = null; state.view = 'explore'; state.openEvent = null; applyAccess(); setView('explore'); toast('تم تسجيل الخروج'); }

/* ---------- التفويض ---------- */
function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'cat': state.cat = a.dataset.cat; renderExplore(); break;
    case 'openEvent': openEvent(a.dataset.id); break;
    case 'backExplore': backExplore(); break;
    case 'tierPlus': changeTier(a.dataset.id, 1); break;
    case 'tierMinus': changeTier(a.dataset.id, -1); break;
    case 'proceedCheckout': proceedCheckout(); break;
    case 'closeCheckout': closeCheckout(); break;
    case 'confirmPurchase': confirmPurchase(); break;
    case 'cancelTicket': cancelTicket(a.dataset.id); break;
    case 'addEvent': addEvent(); break;
    case 'toggleEvent': toggleEvent(a.dataset.id); break;
    case 'openAuth': state.user ? logout() : openAuth('login'); break;
    case 'closeAuth': closeAuth(); break;
    case 'toggleAuth': e.preventDefault(); toggleAuth(); break;
    case 'submitAuth': submitAuth(); break;
  }
}
function handleChange(e) {
  var t = e.target; if (!t) return;
  if (t.id === 'cityFilter') { state.city = t.value; renderExplore(); }
  else if (t.id === 'sortFilter') { state.sort = t.value; renderExplore(); }
}
function handleInput(e) {
  if (!e.target) return;
  if (e.target.id === 'search') { state.search = e.target.value; renderExplore(); }
  else if (e.target.id === 'coPromo') updateCoTotal();
}

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('input', handleInput);
  applyAccess();
  renderExplore();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0a0e17;--surface:#121826;--card:#18202f;--accent:#e11d48;--accent2:#7c3aed;--good:#22c55e;--warn:#f59e0b;--text:#eef2f8;--muted:#8a95a8;--border:#242d40;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;align-items:center;gap:16px;padding:12px 20px;background:rgba(18,24,38,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--border);flex-wrap:wrap;position:sticky;top:0;z-index:30}
.brand{font-size:19px;font-weight:800;white-space:nowrap}
.tabs{flex:1;display:flex;gap:6px;flex-wrap:wrap}
.tab{background:transparent;border:1px solid transparent;color:var(--muted);padding:7px 13px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.tab.active{background:var(--card);color:var(--text);border-color:var(--border)}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary[disabled]{opacity:.5;cursor:not-allowed}
.btn.sm{padding:5px 12px;font-size:12px}
.btn.block{width:100%;margin-top:6px}
.icon-btn{background:none;border:none;color:var(--text);font-size:19px;cursor:pointer;width:30px;height:30px;border-radius:8px}
.icon-btn:hover{background:var(--surface)}
main{max-width:1160px;margin:0 auto;padding:20px 18px}
.sec-title{margin-bottom:16px;font-size:18px}
.back-btn{background:none;border:none;color:var(--muted);font-weight:700;font-size:14px;cursor:pointer;margin-bottom:14px}
.hero{background:linear-gradient(120deg,var(--accent),var(--accent2));border-radius:22px;padding:36px 26px;margin-bottom:18px}
.hero h1{font-size:27px;margin-bottom:6px}
.hero-tag{color:#fce7ef;opacity:.95}
.toolbar{display:flex;flex-direction:column;gap:12px;margin-bottom:20px}
.search{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 16px;color:var(--text);font-size:15px}
.filters-row{display:flex;gap:10px;flex-wrap:wrap}
.sel,select{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;color:var(--text);flex:1;min-width:140px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{background:transparent;border:1px solid var(--border);color:var(--muted);padding:7px 14px;border-radius:20px;font-weight:700;font-size:12px;cursor:pointer}
.chip.active{background:var(--accent);border-color:var(--accent);color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}
.card{background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;cursor:pointer;transition:.18s}
.card:hover{border-color:var(--accent);transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,0,0,.35)}
.card.is-out{opacity:.72}
.poster{height:140px;position:relative;display:flex;align-items:center;justify-content:center}
.poster-emoji{font-size:60px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4))}
.badge-feat{position:absolute;top:10px;right:10px;background:rgba(0,0,0,.55);color:#ffd166;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px}
.badge-out{position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.7);color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px}
.ev-body{padding:14px}
.ev-cat{color:var(--accent);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
.ev-title{font-weight:800;font-size:16px;margin:3px 0 8px}
.ev-meta{color:var(--muted);font-size:12px}
.ev-price{color:var(--text);font-weight:800;font-size:15px;margin-top:8px}
.empty{text-align:center;color:var(--muted);padding:30px}
.hidden{display:none !important}
/* صفحة الحدث */
.event-hero{height:200px;border-radius:22px;display:flex;align-items:center;justify-content:center;margin-bottom:-40px}
.eh-emoji{font-size:96px;filter:drop-shadow(0 6px 18px rgba(0,0,0,.5))}
.event-info{background:var(--surface);border:1px solid var(--border);border-radius:22px;padding:26px 22px;position:relative}
.event-title{font-size:26px;margin:4px 0 16px}
.event-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px}
.fact{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;font-size:13px}
.fact b{display:block;font-size:14px}.fact span{color:var(--muted);font-size:12px}
.event-desc{color:#c7cfdc;margin-bottom:18px}
.event-info h3{margin-bottom:12px;font-size:16px}
.tiers{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.tier{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;flex-wrap:wrap}
.tier.is-out{opacity:.55}
.tier-info{flex:1;min-width:120px}
.tier-name{font-weight:800;font-size:15px}
.tier-left{color:var(--muted);font-size:12px}
.tier-price{color:var(--accent);font-weight:800;font-size:16px}
.tier-out{color:var(--muted)}
.stepper{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:2px 6px}
.stepper b{min-width:20px;text-align:center;font-size:15px}
.buy-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;flex-wrap:wrap;position:sticky;bottom:12px}
.buy-total{font-weight:800;font-size:15px}
/* تذاكري */
.tickets{display:flex;flex-direction:column;gap:14px}
.ticket{display:flex;background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden}
.ticket.is-cancelled{opacity:.55}
.tk-stub{background:linear-gradient(160deg,var(--accent),var(--accent2));width:120px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px;border-left:2px dashed rgba(255,255,255,.4);position:relative}
.tk-emoji{font-size:38px}
.tk-code{font-family:monospace;font-size:13px;font-weight:800;letter-spacing:1px;color:#fff;background:rgba(0,0,0,.28);padding:3px 8px;border-radius:6px}
.tk-body{flex:1;padding:16px}
.tk-title{font-weight:800;font-size:16px}
.tk-meta{color:var(--muted);font-size:13px;margin-top:3px}
.tk-foot{display:flex;align-items:center;gap:10px;margin-top:10px}
.pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--border);color:var(--muted)}
.pill.ok{background:rgba(34,197,94,.15);color:var(--good)}
.pill.wait{background:rgba(245,158,11,.15);color:var(--warn)}
/* لوحات */
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:21px;font-weight:800;color:var(--accent)}
.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px}
.panel h3{margin-bottom:12px;font-size:15px}
.search-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:14px}
.fld label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin-bottom:5px}
.fld input,.fld select{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text)}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;flex-wrap:wrap}
/* نوافذ */
.modal{position:fixed;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(440px,100%);position:relative;max-height:92dvh;overflow:auto}
.close-x{position:absolute;top:12px;left:14px;font-size:22px}
.modal-box h2{font-size:20px;margin-bottom:14px}
.modal-box label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin:10px 0 5px}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text)}
.co-summary{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px}
.co-event{margin-bottom:10px;font-size:14px}.co-event span{color:var(--muted);font-size:12px}
.co-line{display:flex;justify-content:space-between;font-size:14px;padding:4px 0;border-top:1px solid var(--border)}
.co-total{margin:14px 0 8px;font-size:16px}.co-total b{color:var(--accent)}
.err-msg{color:#ef4444;font-size:13px;margin:6px 0}
.hint{color:var(--muted);font-size:13px;margin-bottom:14px}
.switch{text-align:center;color:var(--muted);font-size:13px;margin-top:12px}
.switch a{color:var(--accent);text-decoration:none;font-weight:700}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px}
.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;padding:11px 22px;border-radius:12px;font-weight:700;font-size:14px;z-index:70;box-shadow:0 8px 24px rgba(0,0,0,.4)}
h1,h2,h3{color:var(--text)}
`;

export function jaolaEvents() {
    return {
        id: 'jaola-events',
        category: 'events',
        name: 'بيع تذاكر المناسبات',
        description: 'منصّة تذاكر مناسبات احترافية ومترابطة: استكشاف بفلاتر → صفحة حدث بفئات تذاكر ومقاعد متبقّية → دفع بكود خصم → تذكرة مرئيّة برمز حجز في «تذاكري». ثلاثة أدوار: مشترٍ · منظّم (ينشئ أحداثاً تظهر فوراً) · مدير (نشر+إحصاءات). لوحات مخفيّة عن المشتري وتوجيه بالدور.',
        keywords: ['تذاكر', 'تذكرة', 'مناسبات', 'مناسبة', 'فعاليات', 'فعالية', 'حفلات', 'حفلة', 'حجز تذاكر', 'ايفنت', 'إيفنت', 'event', 'events', 'ticket', 'tickets', 'ticketing', 'concert', 'venue', 'حضور', 'أمسية'],
        model: {
            entities: [
                { name: 'Event', fields: [{ name: 'id', type: 'string' }, { name: 'title', type: 'string' }, { name: 'category', type: 'string' }, { name: 'city', type: 'string' }, { name: 'date', type: 'string' }, { name: 'venue', type: 'string' }, { name: 'approved', type: 'boolean' }], ownedBy: 'Organizer' },
                { name: 'TicketTier', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'price', type: 'number' }, { name: 'qty', type: 'number' }], ownedBy: 'Organizer' },
                { name: 'Ticket', fields: [{ name: 'id', type: 'string' }, { name: 'eventId', type: 'string' }, { name: 'tierName', type: 'string' }, { name: 'qty', type: 'number' }, { name: 'code', type: 'string' }, { name: 'status', type: 'string' }], ownedBy: 'Buyer' },
            ],
            roles: [
                { name: 'Buyer', description: 'يشتري التذاكر', capabilities: ['تصفّح المناسبات', 'فلترة/بحث', 'اختيار فئات تذاكر', 'شراء بكود خصم', 'عرض/إلغاء تذاكره'] },
                { name: 'Organizer', description: 'ينظّم المناسبات', capabilities: ['إنشاء مناسبة', 'تحديد فئات التذاكر', 'متابعة المبيعات والحضور'] },
                { name: 'Admin', description: 'يدير المنصّة', capabilities: ['نشر/إيقاف مناسبة', 'إحصاءات', 'كل المبيعات'] },
            ],
            flows: [
                { name: 'شراء تذكرة', actor: 'Buyer', steps: ['يتصفّح ويفلتر', 'يفتح صفحة الحدث', 'يختار فئات التذاكر والكميات', 'يدفع (كود خصم)', 'يستلم تذكرته برمز حجز'], touches: ['Event', 'TicketTier', 'Ticket'], realtime: false },
                { name: 'تنظيم مناسبة', actor: 'Organizer', steps: ['يدخل → لوحة المنظّم', 'ينشئ مناسبة بفئات تذاكر', 'تظهر فوراً في الاستكشاف', 'يتابع المبيعات والحضور'], touches: ['Event', 'TicketTier', 'Ticket'], realtime: false },
                { name: 'إشراف المنصّة', actor: 'Admin', steps: ['يدخل → الإدارة', 'ينشر/يوقف مناسبة', 'يرى الإحصاءات والمبيعات'], touches: ['Event', 'Ticket'], realtime: false },
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
