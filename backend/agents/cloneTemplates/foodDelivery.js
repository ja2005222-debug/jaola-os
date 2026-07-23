/**
 * 🍔 كلون توصيل الطعام — قالب تطبيق *عامل* كامل بنظام صلاحيات وتصميم فاخر.
 *
 * الجذر: توليد تطبيق متعدّد الأدوار من الصفر يفشل. الحلّ: نبدأ من كلون يعمل
 * فعلاً ويجتاز التحقّق السلوكي، ثم يضع الذكاء بصمته.
 *
 * الأدوار والوصول (حسب طلب المستخدم):
 * - Customer (عام): يتصفّح المطاعم ويضيف للسلّة بلا تسجيل؛ يُطلب التسجيل فقط
 *   عند إكمال الطلب.
 * - Restaurant / Driver / Admin (طاقم): لوحاتهم **مخفية** عن العميل. الدخول
 *   ببيانات الحساب يوجّه كلّاً إلى صفحته حسب صلاحيته.
 *
 * التصميم: هوية ذهبية داكنة فاخرة، بطل بصورة، صور أطباق حقيقية (Unsplash) مع
 * بديل تدرّجيّ+رمز إن تعذّر التحميل (يعمل بلا إنترنت). كل الدوال معرّفة (تفويض
 * أحداث). يمرّ بالتحقّق السلوكي 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>توصيل الطعام</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><span class="mk">🍔</span> <span id="brandName">توصيل الطعام</span></div>
    <nav class="roles" id="roleTabs">
      <button class="role-tab active" data-role="customer">🛒 الطلب</button>
      <button class="role-tab" data-role="track">📦 تتبّع</button>
      <button class="role-tab staff hidden" data-role="restaurant">🏪 المطعم</button>
      <button class="role-tab staff hidden" data-role="driver">🛵 التوصيل</button>
      <button class="role-tab staff hidden" data-role="admin">🛠️ الإدارة</button>
    </nav>
    <div class="account">
      <span id="whoami" class="whoami hidden"></span>
      <button id="staffLoginBtn" class="btn ghost" data-action="open-login">دخول الطاقم</button>
      <button id="logoutBtn" class="btn ghost hidden" data-action="logout">خروج</button>
    </div>
  </header>

  <main id="app">
    <!-- واجهة الزبون (عامة) -->
    <section id="customer-view" class="view active">
      <!-- البطل -->
      <div class="hero">
        <div class="ph hero-bg"><img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&q=80&auto=format&fit=crop" alt="" onerror="this.style.display='none'"></div>
        <div class="hero-in">
          <span class="eyebrow">توصيل خلال 30 دقيقة</span>
          <h1>ألذّ الأطباق<br><span class="gold">تصل إليك</span></h1>
          <p>اختر من مطاعمنا المميّزة، أضف لسلّتك، وتتبّع طلبك لحظةً بلحظة.</p>
          <a href="#restaurantList" class="btn gold lg">اطلب الآن</a>
          <div class="rate">★★★★★ <b>4.8</b> · أكثر من 8,000 طلب هذا الشهر</div>
        </div>
      </div>

      <div class="shop-grid">
        <div>
          <div class="sec-head"><span class="eyebrow">مطاعمنا</span><h2>اختر مطعمك</h2></div>
          <div id="restaurantList" class="grid"></div>
          <div id="menuPanel" class="panel hidden">
            <button class="link" data-action="back-to-restaurants">← رجوع للمطاعم</button>
            <h2 id="menuTitle"></h2>
            <div id="menuItems" class="grid"></div>
          </div>
        </div>
        <aside id="cartPanel" class="cart">
          <h3>🛒 سلّتك</h3>
          <div id="cartItems"></div>
          <div class="cart-total">الإجمالي: <span id="cartTotal">0</span> ﷼</div>
          <button id="placeOrderBtn" class="btn gold" data-action="checkout" disabled>تقديم الطلب</button>
        </aside>
      </div>
    </section>

    <!-- تتبّع الطلب (عام) -->
    <section id="track-view" class="view">
      <h2>📦 تتبّع طلبك</h2>
      <div class="track-box">
        <input id="trackInput" placeholder="رقم الطلب (مثال: 1001)">
        <button class="btn" data-action="track-order">تتبّع</button>
      </div>
      <div id="trackResult"></div>
    </section>

    <!-- لوحة المطعم (Restaurant — طاقم) -->
    <section id="restaurant-view" class="view">
      <h2>🏪 لوحة المطعم — الطلبات الواردة</h2>
      <div id="restaurantOrders" class="orders"></div>
    </section>

    <!-- لوحة السائق (Driver — طاقم) -->
    <section id="driver-view" class="view">
      <h2>🛵 لوحة التوصيل — طلبات جاهزة</h2>
      <div id="driverOrders" class="orders"></div>
    </section>

    <!-- لوحة الإدارة (Admin — طاقم) -->
    <section id="admin-view" class="view">
      <h2>🛠️ لوحة الإدارة</h2>
      <div id="adminStats" class="stats"></div>
      <h3 style="margin:16px 0 8px">كل الطلبات</h3>
      <div id="adminOrders" class="orders"></div>
    </section>
  </main>

  <!-- نافذة الدخول (للطاقم) / التسجيل (للعميل عند الطلب) -->
  <div id="authModal" class="modal hidden">
    <div class="modal-box">
      <button class="modal-close" data-action="close-auth">×</button>
      <h3 id="authTitle">دخول الطاقم</h3>
      <div id="authFields">
        <input id="authUser" placeholder="اسم المستخدم">
        <input id="authPass" type="password" placeholder="كلمة المرور">
      </div>
      <p id="authError" class="auth-error hidden"></p>
      <button class="btn gold" data-action="submit-auth">دخول</button>
      <p class="muted" id="authHint">تجريبي: jamal / resto / driver — كلمة المرور 1234</p>
    </div>
  </div>

  <div class="toast" id="toast"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🍔 منطق تطبيق توصيل الطعام بنظام صلاحيات — كل الدوال معرّفة وموصولة.
'use strict';

// ── حسابات الطاقم (تجريبية) — الدخول يوجّه لصفحة الدور ────────────────
const ACCOUNTS = [
  { user: 'jamal', pass: '1234', role: 'admin', name: 'جمال (مدير الموقع)' },
  { user: 'resto', pass: '1234', role: 'restaurant', name: 'مدير المطعم' },
  { user: 'driver', pass: '1234', role: 'driver', name: 'رجل التوصيل' },
];
const STAFF_ROLES = ['restaurant', 'driver', 'admin'];

const RESTAURANTS = [
  { id: 'r1', name: 'مطعم البيت الشامي', cuisine: 'شامي', emoji: '🥙', img: '1601050690597-df0568f70950', menu: [
    { id: 'm1', name: 'شاورما دجاج', price: 18, emoji: '🌯', img: '1561651823-34feb02250e4' },
    { id: 'm2', name: 'فتّة حمّص', price: 22, emoji: '🥣', img: '' },
    { id: 'm3', name: 'تبولة', price: 12, emoji: '🥗', img: '' },
  ]},
  { id: 'r2', name: 'بيتزا روما', cuisine: 'إيطالي', emoji: '🍕', img: '1513104890138-7c749659a591', menu: [
    { id: 'm4', name: 'بيتزا مارغريتا', price: 35, emoji: '🍕', img: '1513104890138-7c749659a591' },
    { id: 'm5', name: 'باستا الفريدو', price: 28, emoji: '🍝', img: '1621996346565-e3dbc646d9a9' },
  ]},
  { id: 'r3', name: 'برجر هاوس', cuisine: 'أمريكي', emoji: '🍔', img: '1571091718767-18b5b1457add', menu: [
    { id: 'm6', name: 'برجر لحم مزدوج', price: 30, emoji: '🍔', img: '1568901346375-23c9450c58cd' },
    { id: 'm7', name: 'بطاطس مقلية', price: 10, emoji: '🍟', img: '' },
  ]},
];
const STATUSES = ['جديد', 'قيد التحضير', 'جاهز للتوصيل', 'قيد التوصيل', 'تم التسليم'];

const state = {
  role: 'customer',
  currentUser: null,      // null = زائر (عميل)
  customer: loadCustomer(),
  currentRestaurant: null,
  cart: [],
  orders: loadOrders(),
  authMode: 'staff',      // staff | register
};

function loadOrders() { try { return JSON.parse(localStorage.getItem('fd_orders') || '[]'); } catch { return []; } }
function saveOrders() { try { localStorage.setItem('fd_orders', JSON.stringify(state.orders)); } catch {} }
function loadCustomer() { try { return JSON.parse(localStorage.getItem('fd_customer') || 'null'); } catch { return null; } }
function saveCustomer() { try { localStorage.setItem('fd_customer', JSON.stringify(state.customer)); } catch {} }
function money(n) { return Number(n || 0).toFixed(0); }
function findRestaurant(id) { return RESTAURANTS.find(r => r.id === id) || null; }
function findItem(rid, mid) { const r = findRestaurant(rid); return r ? r.menu.find(m => m.id === mid) : null; }
function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function imgUrl(id) { return 'https://images.unsplash.com/photo-' + id + '?w=600&q=80&auto=format&fit=crop'; }
// حاوية صورة .ph ببديل تدرّجيّ+رمز خلفها؛ الصورة فوقها وتختفي إن فشلت.
function photo(o, cls) {
  var emoji = '<span class="ph-emoji">' + (o.emoji || '🍽️') + '</span>';
  var img = o.img ? '<img loading="lazy" src="' + imgUrl(o.img) + '" alt="' + (o.name || '') + '" onerror="this.style.display=&#39;none&#39;">' : '';
  return '<div class="ph ' + (cls || '') + '">' + emoji + img + '</div>';
}
var _toastT;
function toast(m) { const t = byId('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove('on'), 2200); }

// ── الصلاحيات: يُظهر للطاقم صفحته فقط، ويخفيها عن العميل ───────────────
function applyAccess() {
  const staff = state.currentUser && STAFF_ROLES.includes(state.currentUser.role);
  document.querySelectorAll('.role-tab.staff').forEach(t => {
    // تبويبات الطاقم تظهر فقط لصاحب الدور المطابق
    const visible = staff && state.currentUser.role === t.dataset.role;
    t.classList.toggle('hidden', !visible);
  });
  // تبويبات العميل (الطلب/التتبّع) تظهر للزائر فقط
  document.querySelectorAll('.role-tab:not(.staff)').forEach(t => t.classList.toggle('hidden', !!staff));
  show(byId('staffLoginBtn'), !staff);
  show(byId('logoutBtn'), !!staff);
  const who = byId('whoami');
  show(who, !!staff);
  if (staff) who.textContent = '👤 ' + state.currentUser.name;
}

// ── التنقّل بين الأدوار ────────────────────────────────────────────────
function switchRole(role) {
  state.role = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.toggle('active', t.dataset.role === role));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = byId(role + '-view');
  if (view) view.classList.add('active');
  if (role === 'customer') renderRestaurants();
  if (role === 'restaurant') renderRestaurantOrders();
  if (role === 'driver') renderDriverOrders();
  if (role === 'admin') renderAdmin();
}

// ── الدخول/التسجيل ────────────────────────────────────────────────────
function openLogin(mode) {
  state.authMode = mode || 'staff';
  const isReg = state.authMode === 'register';
  byId('authTitle').textContent = isReg ? 'سجّل لإكمال طلبك' : 'دخول الطاقم';
  byId('authFields').innerHTML = isReg
    ? '<input id="authUser" placeholder="اسمك"><input id="authPass" placeholder="رقم جوّالك">'
    : '<input id="authUser" placeholder="اسم المستخدم"><input id="authPass" type="password" placeholder="كلمة المرور">';
  show(byId('authHint'), !isReg);
  byId('authError').classList.add('hidden');
  show(byId('authModal'), true);
}
function closeAuth() { show(byId('authModal'), false); }

function submitAuth() {
  const u = (byId('authUser').value || '').trim();
  const p = (byId('authPass').value || '').trim();
  if (state.authMode === 'register') {
    if (!u) { return authError('أدخل اسمك من فضلك'); }
    state.customer = { name: u, phone: p };
    saveCustomer();
    closeAuth();
    finalizeOrder();
    return;
  }
  const acc = ACCOUNTS.find(a => a.user === u && a.pass === p);
  if (!acc) { return authError('بيانات غير صحيحة'); }
  state.currentUser = acc;
  closeAuth();
  applyAccess();
  switchRole(acc.role); // 🔑 يوجّه كلّ حساب لصفحته حسب صلاحيته
}
function authError(msg) { const e = byId('authError'); e.textContent = msg; e.classList.remove('hidden'); }

function logout() {
  state.currentUser = null;
  applyAccess();
  switchRole('customer');
}

// ── واجهة الزبون ──────────────────────────────────────────────────────
function renderRestaurants() {
  const el = byId('restaurantList');
  byId('menuPanel').classList.add('hidden');
  el.innerHTML = RESTAURANTS.map(r =>
    '<div class="card restaurant" data-action="open-restaurant" data-id="' + r.id + '">' +
    photo(r, 'card-media') +
    '<div class="card-b"><h3>' + r.name + '</h3><p>' + r.emoji + ' ' + r.cuisine + '</p></div></div>').join('');
}
function openRestaurant(id) {
  const r = findRestaurant(id); if (!r) return;
  state.currentRestaurant = id;
  byId('menuTitle').textContent = r.emoji + ' ' + r.name;
  byId('menuItems').innerHTML = r.menu.map(m =>
    '<div class="card item">' + photo(m, 'card-media') +
    '<div class="card-b"><h4>' + m.name + '</h4><p class="price">' + money(m.price) + ' ﷼</p>' +
    '<button class="btn small" data-action="add-to-cart" data-id="' + m.id + '">+ أضف</button></div></div>').join('');
  byId('menuPanel').classList.remove('hidden');
}
function addToCart(mid) {
  const item = findItem(state.currentRestaurant, mid); if (!item) return;
  const line = state.cart.find(c => c.id === mid);
  if (line) line.qty += 1;
  else state.cart.push({ id: mid, name: item.name, price: item.price, qty: 1, restaurant: state.currentRestaurant });
  renderCart(); toast('أُضيف إلى سلّتك');
}
function renderCart() {
  const box = byId('cartItems');
  if (!state.cart.length) box.innerHTML = '<p class="muted">سلّتك فارغة</p>';
  else box.innerHTML = state.cart.map(c =>
    '<div class="cart-line"><span>' + c.name + ' ×' + c.qty + '</span><span>' + money(c.price * c.qty) + ' ﷼</span>' +
    '<button class="link" data-action="remove-from-cart" data-id="' + c.id + '">حذف</button></div>').join('');
  const total = state.cart.reduce((s, c) => s + c.price * c.qty, 0);
  byId('cartTotal').textContent = money(total);
  byId('placeOrderBtn').disabled = state.cart.length === 0;
}
function removeFromCart(mid) { state.cart = state.cart.filter(c => c.id !== mid); renderCart(); }

// إكمال الطلب — يُطلب تسجيل العميل فقط هنا (لا في التصفّح)
function checkout() {
  if (!state.cart.length) return;
  if (!state.customer || !state.customer.name) { openLogin('register'); return; }
  finalizeOrder();
}
function finalizeOrder() {
  if (!state.cart.length) return;
  const id = 1001 + state.orders.length;
  const total = state.cart.reduce((s, c) => s + c.price * c.qty, 0);
  const r = findRestaurant(state.cart[0].restaurant);
  state.orders.push({
    id: id, customer: state.customer ? state.customer.name : 'زائر',
    restaurant: r ? r.name : 'مطعم',
    items: state.cart.map(c => ({ name: c.name, qty: c.qty })),
    total: total, status: 'جديد', createdAt: Date.now(),
  });
  saveOrders();
  state.cart = []; renderCart();
  toast('✅ تم تقديم طلبك برقم ' + id + ' — تابعه من «تتبّع»');
}

// ── لوحة المطعم ───────────────────────────────────────────────────────
function renderRestaurantOrders() {
  const el = byId('restaurantOrders');
  el.innerHTML = state.orders.length ? state.orders.map(o => orderCard(o)).join('') : '<p class="muted">لا طلبات بعد.</p>';
}
function advanceOrder(id) {
  const o = state.orders.find(x => x.id === Number(id)); if (!o) return;
  const i = STATUSES.indexOf(o.status);
  if (i < STATUSES.length - 1) o.status = STATUSES[i + 1];
  saveOrders();
  if (state.role === 'restaurant') renderRestaurantOrders();
  if (state.role === 'driver') renderDriverOrders();
  if (state.role === 'admin') renderAdmin();
}

// ── لوحة السائق ───────────────────────────────────────────────────────
function renderDriverOrders() {
  const el = byId('driverOrders');
  const ready = state.orders.filter(o => o.status === 'جاهز للتوصيل' || o.status === 'قيد التوصيل');
  el.innerHTML = ready.length ? ready.map(o => orderCard(o)).join('') : '<p class="muted">لا طلبات جاهزة للتوصيل.</p>';
}

// ── لوحة الإدارة ──────────────────────────────────────────────────────
function renderAdmin() {
  const done = state.orders.filter(o => o.status === 'تم التسليم').length;
  const revenue = state.orders.reduce((s, o) => s + (o.total || 0), 0);
  byId('adminStats').innerHTML =
    stat('الطلبات', state.orders.length) + stat('مكتملة', done) +
    stat('المطاعم', RESTAURANTS.length) + stat('الإيراد', money(revenue) + ' ﷼');
  byId('adminOrders').innerHTML = state.orders.length ? state.orders.map(o => orderCard(o)).join('') : '<p class="muted">لا طلبات.</p>';
}
function stat(label, val) { return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-label">' + label + '</div></div>'; }

// ── تتبّع الطلب ────────────────────────────────────────────────────────
function trackOrder() {
  const id = Number((byId('trackInput').value || '').trim());
  const o = state.orders.find(x => x.id === id);
  const box = byId('trackResult');
  if (!o) { box.innerHTML = '<p class="muted">لا يوجد طلب بهذا الرقم.</p>'; return; }
  const step = STATUSES.indexOf(o.status);
  box.innerHTML = '<div class="track-card"><h3>طلب #' + o.id + ' — ' + o.restaurant + '</h3>' +
    '<div class="steps">' + STATUSES.map((s, i) => '<div class="step ' + (i <= step ? 'done' : '') + '">' + s + '</div>').join('') + '</div>' +
    '<p>الإجمالي: ' + money(o.total) + ' ﷼</p></div>';
}

// ── بطاقة طلب مشتركة ──────────────────────────────────────────────────
function orderCard(o) {
  const items = o.items.map(it => it.name + ' ×' + it.qty).join('، ');
  const done = o.status === 'تم التسليم';
  const btn = done ? '<p class="muted">مكتمل ✔</p>'
    : '<button class="btn small" data-action="advance-order" data-id="' + o.id + '">➡ ' + nextStatusLabel(o.status) + '</button>';
  return '<div class="order-card"><div class="order-head">#' + o.id + ' — ' + o.restaurant +
    '<span class="badge">' + o.status + '</span></div><p>' + items + '</p>' +
    '<p class="muted">' + (o.customer || '') + ' · ' + money(o.total) + ' ﷼</p>' + btn + '</div>';
}
function nextStatusLabel(status) { const i = STATUSES.indexOf(status); return i < STATUSES.length - 1 ? STATUSES[i + 1] : 'مكتمل'; }

// ── تفويض الأحداث ─────────────────────────────────────────────────────
function handleClick(e) {
  const roleTab = e.target.closest('.role-tab');
  if (roleTab) { switchRole(roleTab.dataset.role); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.action) {
    case 'open-restaurant': openRestaurant(id); break;
    case 'back-to-restaurants': renderRestaurants(); break;
    case 'add-to-cart': addToCart(id); break;
    case 'remove-from-cart': removeFromCart(id); break;
    case 'checkout': checkout(); break;
    case 'advance-order': advanceOrder(id); break;
    case 'track-order': trackOrder(); break;
    case 'open-login': openLogin('staff'); break;
    case 'submit-auth': submitAuth(); break;
    case 'close-auth': closeAuth(); break;
    case 'logout': logout(); break;
  }
}

function init() {
  document.addEventListener('click', handleClick);
  applyAccess();
  renderRestaurants();
  renderCart();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0c0a08;--surface:#15110c;--card:rgba(255,255,255,.03);--gold:#e9b872;--gold2:#c98f3c;--good:#22c55e;--text:#f7f3ec;--muted:#b3a999;--border:rgba(233,184,114,.16);--font:'Segoe UI',Tahoma,system-ui,sans-serif;--shadow:0 30px 70px -24px rgba(0,0,0,.8)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.7;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(50% 40% at 85% 0%,rgba(233,184,114,.10),transparent 60%),radial-gradient(50% 40% at 0% 100%,rgba(201,143,60,.08),transparent 60%),var(--bg)}
.topbar{background:rgba(21,17,12,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);padding:12px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:30}
.brand{font-size:20px;font-weight:800;display:flex;align-items:center;gap:9px}
.brand .mk{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--gold),var(--gold2));display:grid;place-items:center;font-size:18px}
.roles{display:flex;gap:6px;flex-wrap:wrap}
.role-tab{background:transparent;border:1px solid var(--border);color:var(--muted);padding:8px 14px;border-radius:99px;font-size:13px;font-weight:700;cursor:pointer;transition:.15s;font-family:var(--font)}
.role-tab:hover{color:var(--text)}
.role-tab.active{background:linear-gradient(105deg,var(--gold),var(--gold2));border-color:transparent;color:#2a1c07}
.account{display:flex;align-items:center;gap:8px}
.whoami{font-size:12px;color:var(--gold);font-weight:700}
main{max-width:1140px;margin:0 auto;padding:0 20px 40px}
.view{display:none}
.view.active{display:block}
#track-view.active,#restaurant-view.active,#driver-view.active,#admin-view.active{padding-top:26px}
/* البطل */
.hero{position:relative;min-height:56vh;display:flex;align-items:center;overflow:hidden;border-radius:0 0 30px 30px;margin:0 -20px 10px}
.hero .hero-bg{position:absolute;inset:0;z-index:0}
.hero .hero-bg::after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(12,10,8,.93) 32%,rgba(12,10,8,.4))}
.hero-in{position:relative;z-index:3;padding:60px 40px}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:2.5px;color:var(--gold);text-transform:uppercase}
.gold{color:var(--gold)}
.hero h1{font-size:clamp(34px,6vw,60px);line-height:1.07;font-weight:800;margin:14px 0 14px;letter-spacing:-1px}
.hero p{font-size:17px;color:#e6ddcf;max-width:440px;margin-bottom:22px}
.rate{margin-top:22px;color:var(--muted);font-size:14px}.rate b{color:var(--gold)}
/* صور ببديل تدرّجيّ */
.ph{position:relative;overflow:hidden;background:linear-gradient(135deg,#2a2114,#43301a)}
.ph .ph-emoji{position:absolute;inset:0;display:grid;place-items:center;font-size:46px;opacity:.9}
.ph img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}
/* شبكة الزبون */
.shop-grid{display:grid;grid-template-columns:1fr 320px;gap:22px;align-items:start;padding-top:14px}
@media(max-width:820px){.shop-grid{grid-template-columns:1fr}}
.sec-head{margin-bottom:16px}
.sec-head h2{font-size:clamp(24px,3.5vw,34px);font-weight:800;letter-spacing:-.5px;margin-top:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;transition:.2s}
.card.restaurant{cursor:pointer}
.card.restaurant:hover,.card.item:hover{transform:translateY(-4px);border-color:rgba(233,184,114,.4)}
.card:hover .ph img{transform:scale(1.06)}
.card-media{height:150px}
.card-b{padding:14px 16px 16px}
.card h3,.card h4{margin:0 0 4px;font-size:16px}
.card p{color:var(--muted);font-size:13px}
.card .price{color:var(--gold);font-weight:800;font-size:15px;margin-top:2px}
.panel{margin-top:22px}.hidden{display:none !important}
.cart{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px;position:sticky;top:84px}
.cart h3{margin-bottom:12px}
.cart-line{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px}
.cart-total{margin:14px 0;font-weight:800;font-size:16px}
.orders{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:16px}
.order-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px}
.order-head{display:flex;justify-content:space-between;align-items:center;font-weight:800;margin-bottom:8px;gap:8px}
.badge{background:rgba(233,184,114,.12);border:1px solid var(--border);color:var(--gold);font-size:11px;padding:3px 10px;border-radius:20px}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:22px;font-weight:800;color:var(--gold)}
.stat-label{font-size:12px;color:var(--muted)}
.btn{background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--text);padding:10px 18px;border-radius:12px;font-weight:700;cursor:pointer;font-size:13px;transition:.18s;font-family:var(--font);text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn:hover{background:rgba(255,255,255,.09)}
.btn.gold{background:linear-gradient(105deg,var(--gold),var(--gold2));border-color:transparent;color:#2a1c07;width:100%}
.btn.gold:hover{transform:translateY(-2px);box-shadow:0 12px 30px -10px rgba(233,184,114,.55)}
.btn.gold.lg{width:auto;padding:14px 30px;font-size:15px}
.btn.gold:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.btn.ghost{padding:8px 14px;font-size:12px}
.btn.small{padding:8px 14px;font-size:12px;margin-top:10px;width:100%}
.link{background:none;border:none;color:var(--gold);cursor:pointer;font-size:12px;text-decoration:underline}
.muted{color:var(--muted);font-size:13px}
.track-box{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap}
.track-box input,#trackInput{flex:1;min-width:180px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;color:var(--text)}
.track-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;margin-top:12px}
.steps{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.step{flex:1;min-width:90px;text-align:center;padding:8px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid var(--border);color:var(--muted);font-size:12px}
.step.done{background:rgba(34,197,94,.15);border-color:var(--good);color:var(--good)}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(380px,100%);position:relative}
.modal-box h3{margin-bottom:16px}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:11px;padding:12px;color:var(--text);margin-bottom:10px}
.modal-close{position:absolute;top:12px;left:14px;background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer}
.auth-error{color:#f87171;font-size:12px;margin-bottom:8px}
.toast{position:fixed;bottom:22px;inset-inline-start:50%;transform:translateX(50%);background:linear-gradient(105deg,var(--gold),var(--gold2));color:#2a1c07;padding:12px 22px;border-radius:12px;font-weight:800;z-index:120;opacity:0;pointer-events:none;transition:.25s}
html[dir=rtl] .toast{transform:translateX(-50%)}
.toast.on{opacity:1}
h2{margin-bottom:6px}
`;

/** يعيد قالب كلون توصيل الطعام: بيانات وصفية + نموذج المجال + الملفات العاملة. */
export function foodDeliveryClone() {
    return {
        id: 'jaola-delivery',
        category: 'restaurant',
        name: 'توصيل طعام من مطاعم متعددة',
        description: 'تطبيق توصيل فاخر بصلاحيات: زبون (عام، بطل + مطاعم بصور + سلّة) · مطعم/سائق/إدارة (لوحات مخفية بدخول موجَّه حسب الصلاحية) · تتبّع بخطوات.',
        keywords: ['توصيل', 'طعام', 'مطاعم', 'delivery', 'food', 'restaurant', 'order', 'طلب', 'talabat', 'ubereats'],
        model: {
            entities: [
                { name: 'Order', fields: [{ name: 'id', type: 'number' }, { name: 'items', type: 'array' }, { name: 'total', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Customer' },
                { name: 'Restaurant', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'menu', type: 'array' }], ownedBy: 'Restaurant' },
                { name: 'MenuItem', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'price', type: 'number' }], ownedBy: 'Restaurant' },
                { name: 'User', fields: [{ name: 'user', type: 'string' }, { name: 'role', type: 'string' }], ownedBy: 'Admin' },
            ],
            roles: [
                { name: 'Customer', description: 'يتصفّح ويطلب (عام، تسجيل عند الطلب فقط)', capabilities: ['تصفّح المطاعم', 'إضافة للسلة', 'تقديم الطلب', 'تتبّع'] },
                { name: 'Restaurant', description: 'يستقبل الطلبات وينفّذها', capabilities: ['استقبال الطلبات', 'تغيير الحالة'] },
                { name: 'Driver', description: 'يسلّم الطلبات', capabilities: ['رؤية الجاهز', 'التسليم'] },
                { name: 'Admin', description: 'يدير الموقع', capabilities: ['إحصاءات', 'كل الطلبات'] },
            ],
            flows: [
                { name: 'تقديم طلب', actor: 'Customer', steps: ['يختار مطعماً', 'يضيف أصنافاً', 'يسجّل عند الطلب', 'يصل للمطعم'], touches: ['Order', 'MenuItem'], realtime: true },
                { name: 'دخول موجَّه حسب الصلاحية', actor: 'Admin', steps: ['يسجّل الدخول', 'يُوجَّه لصفحة دوره'], touches: ['User'], realtime: false },
                { name: 'تنفيذ الطلب', actor: 'Restaurant', steps: ['يستقبل', 'تحضير', 'جاهز'], touches: ['Order'], realtime: true },
                { name: 'التوصيل', actor: 'Driver', steps: ['يستلم الجاهز', 'قيد التوصيل', 'تم التسليم'], touches: ['Order'], realtime: true },
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
