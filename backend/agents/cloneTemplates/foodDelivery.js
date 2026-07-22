/**
 * 🍔 كلون توصيل الطعام — قالب تطبيق *عامل* كامل بنظام صلاحيات.
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
 * كل الدوال معرّفة (تفويض أحداث). index.html يشير إلى app.js الموجود. يمرّ
 * بالتحقّق السلوكي 100%.
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
    <div class="brand">🍔 <span id="brandName">توصيل الطعام</span></div>
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
      <div id="restaurantList" class="grid"></div>
      <div id="menuPanel" class="panel hidden">
        <button class="link" data-action="back-to-restaurants">← رجوع للمطاعم</button>
        <h2 id="menuTitle"></h2>
        <div id="menuItems" class="grid"></div>
      </div>
      <aside id="cartPanel" class="cart">
        <h3>🛒 سلّتك</h3>
        <div id="cartItems"></div>
        <div class="cart-total">الإجمالي: <span id="cartTotal">0</span> ﷼</div>
        <button id="placeOrderBtn" class="btn primary" data-action="checkout" disabled>تقديم الطلب</button>
      </aside>
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
      <button class="btn primary" data-action="submit-auth">دخول</button>
      <p class="muted" id="authHint">تجريبي: jamal / resto / driver — كلمة المرور 1234</p>
    </div>
  </div>

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
  { id: 'r1', name: 'مطعم البيت الشامي', cuisine: 'شامي', emoji: '🥙', menu: [
    { id: 'm1', name: 'شاورما دجاج', price: 18 }, { id: 'm2', name: 'فتّة حمّص', price: 22 }, { id: 'm3', name: 'تبولة', price: 12 },
  ]},
  { id: 'r2', name: 'بيتزا روما', cuisine: 'إيطالي', emoji: '🍕', menu: [
    { id: 'm4', name: 'بيتزا مارغريتا', price: 35 }, { id: 'm5', name: 'باستا الفريدو', price: 28 },
  ]},
  { id: 'r3', name: 'برجر هاوس', cuisine: 'أمريكي', emoji: '🍔', menu: [
    { id: 'm6', name: 'برجر لحم مزدوج', price: 30 }, { id: 'm7', name: 'بطاطس مقلية', price: 10 },
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
    '<div class="emoji">' + r.emoji + '</div><h3>' + r.name + '</h3><p>' + r.cuisine + '</p></div>').join('');
}
function openRestaurant(id) {
  const r = findRestaurant(id); if (!r) return;
  state.currentRestaurant = id;
  byId('menuTitle').textContent = r.emoji + ' ' + r.name;
  byId('menuItems').innerHTML = r.menu.map(m =>
    '<div class="card item"><h4>' + m.name + '</h4><p>' + money(m.price) + ' ﷼</p>' +
    '<button class="btn small" data-action="add-to-cart" data-id="' + m.id + '">+ أضف</button></div>').join('');
  byId('menuPanel').classList.remove('hidden');
}
function addToCart(mid) {
  const item = findItem(state.currentRestaurant, mid); if (!item) return;
  const line = state.cart.find(c => c.id === mid);
  if (line) line.qty += 1;
  else state.cart.push({ id: mid, name: item.name, price: item.price, qty: 1, restaurant: state.currentRestaurant });
  renderCart();
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
  alert('✅ تم تقديم طلبك برقم ' + id + ' — تابعه من تبويب «تتبّع».');
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

const STYLES_CSS = `:root{--bg:#0f1420;--surface:#161d2e;--card:#1e2740;--accent:#ff6b35;--good:#22c55e;--text:#e8edf6;--muted:#8b98b0;--border:#2a3550;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:12px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.brand{font-size:20px;font-weight:800}
.roles{display:flex;gap:6px;flex-wrap:wrap}
.role-tab{background:transparent;border:1px solid var(--border);color:var(--muted);padding:8px 14px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:.15s}
.role-tab:hover{color:var(--text)}
.role-tab.active{background:var(--accent);border-color:var(--accent);color:#fff}
.account{display:flex;align-items:center;gap:8px}
.whoami{font-size:12px;color:var(--good);font-weight:700}
main{max-width:1100px;margin:0 auto;padding:20px}
.view{display:none}
.view.active{display:block}
#customer-view.active{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
@media(max-width:760px){#customer-view.active{grid-template-columns:1fr}}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.card.restaurant{cursor:pointer;transition:.15s}
.card.restaurant:hover{border-color:var(--accent);transform:translateY(-2px)}
.card .emoji{font-size:38px}
.card h3,.card h4{margin:6px 0;font-size:15px}
.card p{color:var(--muted);font-size:13px}
.panel{margin-top:18px}.hidden{display:none !important}
.cart{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;position:sticky;top:80px}
.cart h3{margin-bottom:12px}
.cart-line{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px}
.cart-total{margin:14px 0;font-weight:800;font-size:16px}
.orders{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:16px}
.order-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px}
.order-head{display:flex;justify-content:space-between;align-items:center;font-weight:800;margin-bottom:8px}
.badge{background:var(--surface);border:1px solid var(--border);color:var(--accent);font-size:11px;padding:3px 8px;border-radius:20px}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center}
.stat-val{font-size:22px;font-weight:800;color:var(--accent)}
.stat-label{font-size:12px;color:var(--muted)}
.btn{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:9px 16px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px;transition:.15s}
.btn:hover{border-color:var(--accent)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;width:100%}
.btn.primary:disabled{opacity:.5;cursor:not-allowed}
.btn.ghost{padding:7px 12px;font-size:12px}
.btn.small{padding:6px 12px;font-size:12px;margin-top:8px}
.link{background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;text-decoration:underline}
.muted{color:var(--muted);font-size:13px}
.track-box{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap}
.track-box input,#trackInput{flex:1;min-width:180px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text)}
.track-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;margin-top:12px}
.steps{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.step{flex:1;min-width:90px;text-align:center;padding:8px;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--muted);font-size:12px}
.step.done{background:rgba(34,197,94,.15);border-color:var(--good);color:var(--good)}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;width:min(360px,100%);position:relative}
.modal-box h3{margin-bottom:16px}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text);margin-bottom:10px}
.modal-close{position:absolute;top:12px;left:14px;background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer}
.auth-error{color:#f87171;font-size:12px;margin-bottom:8px}
h2{margin-bottom:6px}
`;

/** يعيد قالب كلون توصيل الطعام: بيانات وصفية + نموذج المجال + الملفات العاملة. */
export function foodDeliveryClone() {
    return {
        id: 'jaola-delivery',
        category: 'restaurant',
        name: 'توصيل طعام من مطاعم متعددة',
        description: 'تطبيق توصيل عامل بصلاحيات: زبون (عام) · مطعم/سائق/إدارة (لوحات مخفية بدخول موجَّه حسب الصلاحية) · تتبّع.',
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
