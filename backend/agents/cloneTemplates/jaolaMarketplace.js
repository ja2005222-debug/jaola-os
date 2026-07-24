/**
 * 🛒 jaola-marketplace — سوق *عامل* متعدّد البائعين مع صلاحيات، بتصميم فاخر.
 *
 * ثلاثة أدوار: زائر/عميل (تصفّح + سلة + طلب) · بائع (لوحة متجره: منتجاته +
 * طلباته) · مدير (اعتماد المتاجر + إحصاءات). الصفحات الإدارية *مخفيّة* عن
 * العميل — تسجيل الدخول يوجّه كل حساب لصفحته حسب دوره. العميل يُطلب منه
 * التسجيل فقط عند إتمام الطلب.
 *
 * التصميم: هوية بنفسجية داكنة فاخرة، بطل بصورة، منتجات بصور حقيقية (Unsplash)
 * مع بديل تدرّجيّ+رمز إن تعذّر التحميل. كل الدوال معرّفة (تفويض أحداث)، حالة
 * في localStorage، يجتاز التحقّق السلوكي 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>سوق jaola</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><span class="mk">🛒</span> <span id="brandName">سوق jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="top-actions">
      <button class="icon-btn cart" data-action="openCart">🛍️ <span id="cartCount" class="badge">0</span></button>
      <button class="btn ghost" id="authBtn" data-action="openAuth">دخول</button>
    </div>
  </header>

  <main>
    <!-- سوق العميل (عام) -->
    <section id="view-shop" class="view">
      <div class="hero">
        <div class="ph hero-bg"><img src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1400&q=80&auto=format&fit=crop" alt="" onerror="this.style.display='none'"></div>
        <div class="hero-in">
          <span class="eyebrow">سوق واحد · متاجر لا تُحصى</span>
          <h1>كل المتاجر<br><span class="accent">في مكان واحد</span></h1>
          <p>تسوّق من عشرات البائعين المعتمدين، وأضف من متاجر مختلفة لسلّة واحدة.</p>
          <a href="#grid" class="btn primary lg">ابدأ التسوّق</a>
        </div>
      </div>
      <div class="toolbar">
        <input id="search" class="search" placeholder="ابحث عن منتج أو متجر...">
        <div class="chips" id="storeChips"></div>
      </div>
      <div id="grid" class="grid"></div>
      <p id="emptyShop" class="empty hidden">لا منتجات مطابقة.</p>
    </section>

    <!-- لوحة البائع -->
    <section id="view-seller" class="view hidden">
      <h2>لوحة متجري</h2>
      <div class="stat-row" id="sellerStats"></div>
      <div class="panel">
        <h3>إضافة منتج</h3>
        <div class="form-row">
          <input id="pName" placeholder="اسم المنتج">
          <input id="pPrice" type="number" min="0" placeholder="السعر">
          <input id="pEmoji" placeholder="رمز 🍰" maxlength="4">
          <button class="btn primary" data-action="addProduct">إضافة</button>
        </div>
      </div>
      <div class="panel">
        <h3>منتجاتي</h3>
        <div id="sellerProducts" class="mini-list"></div>
      </div>
      <div class="panel">
        <h3>طلبات متجري</h3>
        <div id="sellerOrders" class="mini-list"></div>
      </div>
    </section>

    <!-- لوحة المدير -->
    <section id="view-admin" class="view hidden">
      <h2>لوحة الإدارة</h2>
      <div class="stat-row" id="adminStats"></div>
      <div class="panel">
        <h3>المتاجر</h3>
        <div id="adminStores" class="mini-list"></div>
      </div>
      <div class="panel">
        <h3>كل الطلبات</h3>
        <div id="adminOrders" class="mini-list"></div>
      </div>
    </section>
  </main>

  <!-- سلة العميل -->
  <aside id="cartDrawer" class="drawer hidden">
    <div class="drawer-head"><h3>سلّتك</h3><button class="icon-btn" data-action="closeCart">×</button></div>
    <div id="cartItems" class="cart-items"></div>
    <div class="drawer-foot">
      <div class="total">الإجمالي: <span id="cartTotal">0</span> ﷼</div>
      <button class="btn primary" data-action="checkout">إتمام الطلب</button>
    </div>
  </aside>

  <!-- نافذة الدخول/التسجيل -->
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
        <a href="#" data-action="toggleAuth" id="authSwitch">إنشاء حساب عميل</a></p>
      <p class="demo">حسابات تجربة: <code>admin/1234</code> · <code>seller/1234</code></p>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🛒 منطق السوق متعدّد البائعين — كل الدوال معرّفة، تفويض أحداث, صلاحيات.
'use strict';

// حسابات الطاقم (العميل يسجّل نفسه). كلمة المرور للتجربة فقط.
const STAFF = {
  admin:  { pass: '1234', role: 'admin',  name: 'مدير السوق' },
  seller: { pass: '1234', role: 'seller', name: 'متجر الحلويات', storeId: 's1' },
};
const STAFF_ROLES = ['admin', 'seller'];

const SEED_STORES = [
  { id: 's1', name: 'متجر الحلويات', emoji: '🍰', approved: true },
  { id: 's2', name: 'ركن القهوة', emoji: '☕', approved: true },
  { id: 's3', name: 'يدويات', emoji: '🧶', approved: false },
];
const SEED_PRODUCTS = [
  { id: 'p1', storeId: 's1', name: 'كيكة شوكولاتة', price: 45, emoji: '🍰', img: '1565958011703-44f9829ba187' },
  { id: 'p2', storeId: 's1', name: 'دونات', price: 12, emoji: '🍩', img: '1551024601-bec78aea704b' },
  { id: 'p3', storeId: 's2', name: 'لاتيه', price: 18, emoji: '☕', img: '1541167760496-1628856ab772' },
  { id: 'p4', storeId: 's2', name: 'كوكيز', price: 9, emoji: '🍪', img: '1499636136210-6f4ee915583e' },
];

const state = {
  user: null,            // { name, role, storeId }
  view: 'shop',
  cart: {},              // productId -> qty
  storeFilter: 'all',
  search: '',
  authMode: 'login',     // login | register
};

function load(key, fallback) {
  try { const v = localStorage.getItem('jm_' + key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) { try { localStorage.setItem('jm_' + key, JSON.stringify(val)); } catch {} }

let stores = load('stores', SEED_STORES);
let products = load('products', SEED_PRODUCTS);
let orders = load('orders', []);      // { id, items:[{name,price,qty,storeId}], total, customer, status }

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US'); }
function storeById(id) { return stores.find(s => s.id === id) || null; }
function productById(id) { return products.find(p => p.id === id) || null; }
function uid(p) { return p + Math.random().toString(36).slice(2, 8); }
function imgUrl(id) { return 'https://images.unsplash.com/photo-' + id + '?w=600&q=80&auto=format&fit=crop'; }
// حاوية صورة .ph ببديل تدرّجيّ+رمز خلفها؛ الصورة فوقها وتختفي إن فشلت.
function photo(p, cls) {
  var emoji = '<span class="ph-emoji">' + (p.emoji || '🛍️') + '</span>';
  var img = p.img ? '<img loading="lazy" src="' + imgUrl(p.img) + '" alt="' + (p.name || '') + '" onerror="this.style.display=&#39;none&#39;">' : '';
  return '<div class="ph ' + (cls || '') + '">' + emoji + img + '</div>';
}

function toast(msg) {
  const t = byId('toast'); if (!t) return;
  t.textContent = msg; show(t, true);
  clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2200);
}

/* ---------- الصلاحيات: من يرى ماذا ---------- */
function renderTabs() {
  const role = state.user && state.user.role;
  const tabs = [];
  tabs.push({ id: 'shop', label: 'السوق' });          // متاح للجميع
  if (role === 'seller') tabs.push({ id: 'seller', label: 'لوحة متجري' });
  if (role === 'admin') tabs.push({ id: 'admin', label: 'الإدارة' });
  byId('tabs').innerHTML = tabs.map(function (t) {
    return '<button class="tab ' + (state.view === t.id ? 'active' : '') + '" data-action="tab" data-view="' + t.id + '">' + t.label + '</button>';
  }).join('');
}

function applyAccess() {
  // يخفي كل اللوحات ثم يُظهر المسموح للدور الحالي فقط
  show(byId('view-shop'), state.view === 'shop');
  show(byId('view-seller'), state.view === 'seller' && state.user && state.user.role === 'seller');
  show(byId('view-admin'), state.view === 'admin' && state.user && state.user.role === 'admin');
  const btn = byId('authBtn');
  if (btn) btn.textContent = state.user ? ('خروج (' + state.user.name + ')') : 'دخول';
  renderTabs();
}

function setView(view) {
  // حماية: لا يدخل العميل للوحات الطاقم
  if (view === 'seller' && !(state.user && state.user.role === 'seller')) view = 'shop';
  if (view === 'admin' && !(state.user && state.user.role === 'admin')) view = 'shop';
  state.view = view;
  applyAccess();
  if (view === 'shop') renderShop();
  if (view === 'seller') renderSeller();
  if (view === 'admin') renderAdmin();
}

/* ---------- سوق العميل ---------- */
function renderStoreChips() {
  const chips = [{ id: 'all', name: 'كل المتاجر', emoji: '🛒' }]
    .concat(stores.filter(s => s.approved));
  byId('storeChips').innerHTML = chips.map(function (s) {
    return '<button class="chip ' + (state.storeFilter === s.id ? 'active' : '') + '" data-action="storeFilter" data-store="' + s.id + '">' + s.emoji + ' ' + s.name + '</button>';
  }).join('');
}

function shopProducts() {
  const approved = {};
  stores.forEach(function (s) { if (s.approved) approved[s.id] = 1; });
  let list = products.filter(p => approved[p.storeId]);
  if (state.storeFilter !== 'all') list = list.filter(p => p.storeId === state.storeFilter);
  const q = state.search.trim().toLowerCase();
  if (q) list = list.filter(function (p) {
    const st = storeById(p.storeId);
    return p.name.toLowerCase().includes(q) || (st && st.name.toLowerCase().includes(q));
  });
  return list;
}

function renderShop() {
  renderStoreChips();
  const list = shopProducts();
  show(byId('emptyShop'), list.length === 0);
  byId('grid').innerHTML = list.map(function (p) {
    const st = storeById(p.storeId);
    return '<div class="card">' +
      '<div class="card-media">' + photo(p) + (st ? '<span class="store-tag">' + st.emoji + ' ' + st.name + '</span>' : '') + '</div>' +
      '<div class="ph-body"><div class="ph-title">' + p.name + '</div>' +
      '<div class="ph-price">' + money(p.price) + ' ﷼</div>' +
      '<button class="btn primary sm" data-action="add" data-id="' + p.id + '">أضف للسلة</button></div></div>';
  }).join('');
  renderCartCount();
}

/* ---------- السلة ---------- */
function cartLines() {
  return Object.keys(state.cart).map(function (id) {
    const p = productById(id); if (!p) return null;
    return { p: p, qty: state.cart[id] };
  }).filter(Boolean);
}
function cartTotal() { return cartLines().reduce(function (s, l) { return s + l.p.price * l.qty; }, 0); }
function renderCartCount() {
  const n = cartLines().reduce(function (s, l) { return s + l.qty; }, 0);
  const b = byId('cartCount'); b.textContent = n; b.style.display = n ? 'block' : 'none';
}
function addToCart(id) {
  if (!productById(id)) return;
  state.cart[id] = (state.cart[id] || 0) + 1;
  renderCartCount(); renderCart(); toast('أُضيف للسلة');
}
function changeQty(id, delta) {
  if (!state.cart[id]) return;
  state.cart[id] += delta;
  if (state.cart[id] <= 0) delete state.cart[id];
  renderCart(); renderCartCount();
}
function renderCart() {
  const lines = cartLines();
  byId('cartItems').innerHTML = lines.length ? lines.map(function (l) {
    return '<div class="cart-row">' + photo(l.p, 'ci-thumb') +
      '<span class="ci-name">' + l.p.name + '</span>' +
      '<span class="qty"><button class="icon-btn" data-action="dec" data-id="' + l.p.id + '">−</button>' +
      '<b>' + l.qty + '</b><button class="icon-btn" data-action="inc" data-id="' + l.p.id + '">+</button></span>' +
      '<span class="ci-price">' + money(l.p.price * l.qty) + '</span></div>';
  }).join('') : '<p class="empty">سلّتك فارغة.</p>';
  byId('cartTotal').textContent = money(cartTotal());
}
function openCart() { renderCart(); show(byId('cartDrawer'), true); }
function closeCart() { show(byId('cartDrawer'), false); }

function checkout() {
  const lines = cartLines();
  if (!lines.length) { toast('السلة فارغة'); return; }
  // العميل يُطلب منه التسجيل فقط عند إتمام الطلب
  if (!state.user || state.user.role === 'admin' || state.user.role === 'seller') {
    if (!state.user || state.user.role !== 'customer') { openAuth('register'); return; }
  }
  const order = {
    id: uid('o'), items: lines.map(function (l) {
      return { name: l.p.name, price: l.p.price, qty: l.qty, storeId: l.p.storeId };
    }), total: cartTotal(), customer: state.user.name, status: 'جديد',
  };
  orders.push(order); save('orders', orders);
  state.cart = {}; renderCart(); renderCartCount(); closeCart();
  toast('✅ تم استلام طلبك رقم ' + order.id);
}

/* ---------- لوحة البائع ---------- */
function myStoreId() { return state.user && state.user.storeId; }
function renderSeller() {
  const sid = myStoreId();
  const myProducts = products.filter(p => p.storeId === sid);
  const myOrders = orders.filter(function (o) { return o.items.some(function (it) { return it.storeId === sid; }); });
  const revenue = myOrders.reduce(function (s, o) {
    return s + o.items.filter(function (it) { return it.storeId === sid; })
      .reduce(function (ss, it) { return ss + it.price * it.qty; }, 0);
  }, 0);
  byId('sellerStats').innerHTML =
    stat('منتجاتي', myProducts.length) + stat('طلباتي', myOrders.length) + stat('مبيعاتي', money(revenue) + ' ﷼');
  byId('sellerProducts').innerHTML = myProducts.length ? myProducts.map(function (p) {
    return '<div class="mini-row"><span>' + p.emoji + ' ' + p.name + '</span>' +
      '<span class="mr-price">' + money(p.price) + ' ﷼</span>' +
      '<button class="icon-btn" data-action="delProduct" data-id="' + p.id + '">🗑</button></div>';
  }).join('') : '<p class="empty">لا منتجات بعد — أضف أولها.</p>';
  byId('sellerOrders').innerHTML = myOrders.length ? myOrders.map(function (o) {
    return '<div class="mini-row"><span>#' + o.id + ' · ' + o.customer + '</span>' +
      '<span class="mr-price">' + money(o.total) + ' ﷼</span>' +
      '<span class="pill">' + o.status + '</span></div>';
  }).join('') : '<p class="empty">لا طلبات بعد.</p>';
}
function addProduct() {
  const sid = myStoreId(); if (!sid) return;
  const name = (byId('pName').value || '').trim();
  const price = Number(byId('pPrice').value || 0);
  const emoji = (byId('pEmoji').value || '📦').trim() || '📦';
  if (!name || !(price > 0)) { toast('أكمل اسم المنتج وسعره'); return; }
  products.push({ id: uid('p'), storeId: sid, name: name, price: price, emoji: emoji, img: '' });
  save('products', products);
  byId('pName').value = ''; byId('pPrice').value = ''; byId('pEmoji').value = '';
  renderSeller(); toast('أُضيف المنتج');
}
function delProduct(id) {
  products = products.filter(p => p.id !== id); save('products', products); renderSeller();
}

/* ---------- لوحة المدير ---------- */
function renderAdmin() {
  const revenue = orders.reduce(function (s, o) { return s + o.total; }, 0);
  byId('adminStats').innerHTML =
    stat('المتاجر', stores.length) + stat('المنتجات', products.length) +
    stat('الطلبات', orders.length) + stat('الإيراد', money(revenue) + ' ﷼');
  byId('adminStores').innerHTML = stores.map(function (s) {
    return '<div class="mini-row"><span>' + s.emoji + ' ' + s.name + '</span>' +
      '<span class="pill ' + (s.approved ? 'ok' : 'wait') + '">' + (s.approved ? 'معتمد' : 'بانتظار') + '</span>' +
      '<button class="btn sm" data-action="toggleStore" data-id="' + s.id + '">' + (s.approved ? 'تعليق' : 'اعتماد') + '</button></div>';
  }).join('');
  byId('adminOrders').innerHTML = orders.length ? orders.map(function (o) {
    return '<div class="mini-row"><span>#' + o.id + ' · ' + o.customer + '</span>' +
      '<span class="mr-price">' + money(o.total) + ' ﷼</span></div>';
  }).join('') : '<p class="empty">لا طلبات بعد.</p>';
}
function toggleStore(id) {
  const s = storeById(id); if (!s) return;
  s.approved = !s.approved; save('stores', stores); renderAdmin();
}
function stat(label, val) {
  return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-label">' + label + '</div></div>';
}

/* ---------- الدخول/التسجيل + التوجيه بالصلاحيات ---------- */
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
  byId('authTitle').textContent = reg ? 'إنشاء حساب عميل' : 'تسجيل الدخول';
  byId('authHint').textContent = reg ? 'سجّل لإتمام طلبك — دقائق فقط.' : 'ادخل بحسابك لتُوجَّه لصفحتك.';
  byId('authSubmit').textContent = reg ? 'تسجيل ومتابعة' : 'دخول';
  byId('authSwitchText').textContent = reg ? 'لديك حساب طاقم؟ ' : 'عميل جديد؟ ';
  byId('authSwitch').textContent = reg ? 'دخول' : 'إنشاء حساب عميل';
  show(byId('auPass'), !reg ? true : true);
}
function toggleAuth() { openAuth(state.authMode === 'login' ? 'register' : 'login'); }

function routeByRole() {
  // كل حساب يُوجَّه لصفحته حسب الصلاحية
  if (!state.user) return setView('shop');
  if (state.user.role === 'admin') return setView('admin');
  if (state.user.role === 'seller') return setView('seller');
  return setView('shop'); // العميل → السوق
}

function submitAuth() {
  const name = (byId('auName').value || '').trim();
  const pass = (byId('auPass').value || '').trim();
  if (!name) { show(byId('authErr'), true); return; }
  if (state.authMode === 'register') {
    // العميل يسجّل نفسه (بلا تحقّق طاقم)
    state.user = { name: name, role: 'customer' };
    closeAuth(); applyAccess(); toast('أهلاً ' + name);
    if (cartLines().length) checkout(); else routeByRole();
    return;
  }
  const acc = STAFF[name];
  if (acc && acc.pass === pass) {
    state.user = { name: acc.name, role: acc.role, storeId: acc.storeId };
    closeAuth(); applyAccess(); toast('مرحباً ' + acc.name); routeByRole();
  } else {
    show(byId('authErr'), true);
  }
}
function logout() { state.user = null; state.view = 'shop'; applyAccess(); setView('shop'); toast('تم تسجيل الخروج'); }

/* ---------- التفويض ---------- */
function handleClick(e) {
  const a = e.target.closest('[data-action]'); if (!a) return;
  const id = a.dataset.id;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'storeFilter': state.storeFilter = a.dataset.store; renderShop(); break;
    case 'add': addToCart(id); break;
    case 'openCart': openCart(); break;
    case 'closeCart': closeCart(); break;
    case 'inc': changeQty(id, 1); break;
    case 'dec': changeQty(id, -1); break;
    case 'checkout': checkout(); break;
    case 'addProduct': addProduct(); break;
    case 'delProduct': delProduct(id); break;
    case 'toggleStore': toggleStore(id); break;
    case 'openAuth': state.user ? logout() : openAuth('login'); break;
    case 'closeAuth': closeAuth(); break;
    case 'toggleAuth': e.preventDefault(); toggleAuth(); break;
    case 'submitAuth': submitAuth(); break;
  }
}
function handleInput(e) {
  if (e.target && e.target.id === 'search') { state.search = e.target.value; renderShop(); }
}

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  applyAccess();
  renderShop();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0b0b12;--surface:#13131d;--card:#181826;--accent:#8b5cf6;--accent2:#6366f1;--good:#22c55e;--warn:#f59e0b;--danger:#ef4444;--text:#eceefb;--muted:#8b8fa7;--border:#242639;--line:rgba(139,92,246,.16);--font:'Segoe UI',Tahoma,system-ui,sans-serif;--shadow:0 30px 70px -24px rgba(0,0,0,.8)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(50% 40% at 85% 0%,rgba(139,92,246,.10),transparent 60%),radial-gradient(50% 40% at 0% 100%,rgba(99,102,241,.08),transparent 60%),var(--bg)}
.topbar{display:flex;align-items:center;gap:16px;padding:12px 20px;background:rgba(19,19,29,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);flex-wrap:wrap;position:sticky;top:0;z-index:30}
.brand{font-size:19px;font-weight:800;display:flex;align-items:center;gap:9px}
.brand .mk{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-size:17px}
.tabs{display:flex;gap:6px;flex:1}
.tab{background:transparent;border:1px solid transparent;color:var(--muted);padding:7px 14px;border-radius:99px;font-weight:700;font-size:13px;cursor:pointer;font-family:var(--font)}
.tab.active{background:var(--card);color:var(--text);border-color:var(--border)}
.top-actions{display:flex;gap:8px;align-items:center}
.icon-btn{background:none;border:none;color:var(--text);font-size:18px;cursor:pointer;position:relative}
.icon-btn.cart{background:var(--card);border:1px solid var(--border);border-radius:11px;padding:8px 13px}
.badge{position:absolute;top:-6px;inset-inline-start:-8px;background:var(--accent);color:#fff;font-size:10px;font-weight:800;border-radius:10px;padding:1px 5px}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:9px 17px;border-radius:11px;font-weight:700;font-size:13px;cursor:pointer;transition:.18s;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:var(--font)}
.btn.primary{background:linear-gradient(105deg,var(--accent),var(--accent2));border-color:transparent;color:#fff}
.btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px -10px rgba(139,92,246,.6)}
.btn.ghost{background:rgba(255,255,255,.04)}.btn.ghost:hover{background:rgba(255,255,255,.09)}
.btn.sm{padding:7px 12px;font-size:12px}
.btn.lg{padding:14px 28px;font-size:15px}
main{max-width:1180px;margin:0 auto;padding:0 18px 40px}
.view h2{margin:22px 0 16px}
/* البطل */
.hero{position:relative;min-height:48vh;display:flex;align-items:center;overflow:hidden;border-radius:0 0 28px 28px;margin:0 -18px 8px}
.hero .hero-bg{position:absolute;inset:0;z-index:0}
.hero .hero-bg::after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(11,11,18,.94) 32%,rgba(11,11,18,.4))}
.hero-in{position:relative;z-index:3;padding:54px 32px}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:2.5px;color:var(--accent);text-transform:uppercase}
.accent{background:linear-gradient(105deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero h1{font-size:clamp(32px,5.5vw,54px);line-height:1.08;font-weight:800;margin:12px 0 12px;letter-spacing:-1px}
.hero p{font-size:16px;color:#d7d9ee;max-width:430px;margin-bottom:20px}
/* صور ببديل تدرّجيّ */
.ph{position:relative;overflow:hidden;background:linear-gradient(135deg,#1c1c2b,#26263d)}
.ph .ph-emoji{position:absolute;inset:0;display:grid;place-items:center;font-size:46px;opacity:.9}
.ph img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}
.toolbar{display:flex;flex-direction:column;gap:12px;margin-bottom:18px;padding-top:8px}
.search{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 16px;color:var(--text);font-size:15px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{background:transparent;border:1px solid var(--border);color:var(--muted);padding:7px 15px;border-radius:99px;font-weight:700;font-size:12px;cursor:pointer;transition:.15s}
.chip.active{background:linear-gradient(105deg,var(--accent),var(--accent2));border-color:transparent;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:18px}
.card{background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;transition:.2s}
.card:hover{transform:translateY(-4px);border-color:rgba(139,92,246,.4)}
.card:hover .ph img{transform:scale(1.06)}
.card-media{position:relative;height:160px}
.card-media .ph{height:100%}
.store-tag{position:absolute;bottom:10px;inset-inline-start:10px;z-index:3;background:rgba(11,11,18,.82);border:1px solid var(--line);color:#cdb6ff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px}
.ph-body{padding:14px 16px 16px}
.ph-title{font-weight:700;font-size:15px}
.ph-price{color:var(--accent);font-weight:800;font-size:17px;margin:6px 0 12px}
.empty{text-align:center;color:var(--muted);padding:24px}
.hidden{display:none !important}
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:22px;font-weight:800;color:var(--accent)}
.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px}
.panel h3{margin-bottom:12px;font-size:15px}
.form-row{display:flex;gap:8px;flex-wrap:wrap}
.form-row input{flex:1;min-width:120px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text)}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px}
.mr-price{color:var(--accent);font-weight:700}
.pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--border);color:var(--muted)}
.pill.ok{background:rgba(34,197,94,.15);color:var(--good)}
.pill.wait{background:rgba(245,158,11,.15);color:var(--warn)}
.drawer{position:fixed;top:0;inset-inline-end:0;height:100dvh;width:min(380px,100%);background:var(--surface);border-inline-start:1px solid var(--border);display:flex;flex-direction:column;z-index:40;box-shadow:var(--shadow)}
.drawer-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid var(--border)}
.cart-items{flex:1;overflow:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px}
.cart-row{display:flex;align-items:center;gap:9px;font-size:14px}
.ci-thumb{width:44px;height:44px;border-radius:10px;flex-shrink:0}.ci-name{flex:1}
.qty{display:flex;align-items:center;gap:8px}
.ci-price{color:var(--accent);font-weight:700;min-width:52px;text-align:left}
.drawer-foot{padding:16px 18px;border-top:1px solid var(--border)}
.total{font-weight:800;margin-bottom:10px}.drawer-foot .btn{width:100%}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(400px,100%);position:relative}
.close-x{position:absolute;top:12px;left:14px;font-size:22px;color:var(--muted)}
.modal-box h2{font-size:19px;margin-bottom:6px}
.hint{color:var(--muted);font-size:13px;margin-bottom:14px}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text);margin-bottom:10px}
.modal-box .btn{width:100%;margin-top:4px}
.err-msg{color:var(--danger);font-size:13px;margin-bottom:8px}
.switch{text-align:center;color:var(--muted);font-size:13px;margin-top:12px}
.switch a{color:var(--accent);text-decoration:none;font-weight:700}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px}
.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
.toast{position:fixed;bottom:20px;inset-inline-start:50%;transform:translateX(-50%);background:linear-gradient(105deg,var(--accent),var(--accent2));color:#fff;padding:11px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:70;box-shadow:var(--shadow)}
h2,h3{color:var(--text)}
`;

export function jaolaMarketplace() {
    return {
        id: 'jaola-marketplace',
        category: 'marketplace',
        name: 'سوق متعدّد البائعين',
        description: 'سوق فاخر بثلاثة أدوار وصلاحيات: عميل (بطل+تصفّح+سلة+طلب) · بائع (لوحة متجره) · مدير (اعتماد المتاجر+إحصاءات). اللوحات مخفيّة عن العميل، والتوجيه حسب الدور.',
        keywords: ['سوق', 'ماركت', 'marketplace', 'بائعين', 'متعدد', 'multi-vendor', 'vendor', 'متاجر', 'باعة', 'منصة بيع', 'تجار'],
        model: {
            entities: [
                { name: 'Store', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'approved', type: 'boolean' }], ownedBy: 'Seller' },
                { name: 'Product', fields: [{ name: 'id', type: 'string' }, { name: 'storeId', type: 'string' }, { name: 'name', type: 'string' }, { name: 'price', type: 'number' }], ownedBy: 'Seller' },
                { name: 'Order', fields: [{ name: 'id', type: 'string' }, { name: 'items', type: 'array' }, { name: 'total', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Customer' },
            ],
            roles: [
                { name: 'Customer', description: 'يتصفّح ويطلب', capabilities: ['تصفّح', 'بحث', 'سلة', 'إتمام طلب'] },
                { name: 'Seller', description: 'يدير متجره', capabilities: ['إضافة منتج', 'حذف منتج', 'عرض طلبات متجره', 'مبيعاته'] },
                { name: 'Admin', description: 'يدير السوق', capabilities: ['اعتماد/تعليق متجر', 'إحصاءات', 'كل الطلبات'] },
            ],
            flows: [
                { name: 'شراء من السوق', actor: 'Customer', steps: ['يتصفّح المتاجر', 'يضيف للسلة', 'يتمّ الطلب (يسجّل عند الحاجة)'], touches: ['Product', 'Order'], realtime: false },
                { name: 'إدارة متجر', actor: 'Seller', steps: ['يدخل بحسابه → لوحة متجره', 'يضيف منتجاً', 'يتابع طلباته'], touches: ['Store', 'Product', 'Order'], realtime: false },
                { name: 'اعتماد متجر', actor: 'Admin', steps: ['يدخل → الإدارة', 'يعتمد/يعلّق متجراً'], touches: ['Store'], realtime: false },
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
