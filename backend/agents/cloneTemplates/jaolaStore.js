/**
 * 🛍️ jaola-store — متجر إلكتروني *فاخر ومكتمل* بدورين وصلاحيات.
 *
 * عميل (عام): بطل + شريط ثقة + فئات + بحث + فرز + بطاقات بصور حقيقية (ببديل
 * تدرّجيّ) + تفاصيل منتج + سلّة منزلقة + دفع من خطوتين + تأكيد طلب + إشعار.
 * مدير (admin/1234، لوحة مخفيّة): إدارة المنتجات (إضافة/حذف) + إدارة حالة
 * الطلبات + إحصاءات (إيراد/متوسط الطلب/مخزون منخفض).
 * الصور من Unsplash مع بديل تدرّجيّ+رمز إن تعذّر التحميل (يعمل بلا إنترنت).
 * كل الدوال معرّفة (تفويض أحداث)، الحالة في localStorage، يجتاز التحقّق 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>متجر jaola</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><span class="mk">J</span> <span id="brandName">متجر jaola</span></div>
    <div class="search" id="searchWrap"><input id="searchInput" placeholder="ابحث عن منتج..."></div>
    <div class="top-r">
      <button class="cart-btn" data-action="open-cart">🛒 <span id="cartCount" class="cart-count" style="display:none">0</span></button>
      <button class="btn small ghost" id="authBtn" data-action="open-auth">دخول</button>
    </div>
  </header>

  <!-- واجهة العميل -->
  <div id="view-shop">
    <!-- البطل -->
    <section class="hero">
      <div class="ph hero-bg"><img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&q=80&auto=format&fit=crop" alt="" onerror="this.style.display='none'"></div>
      <div class="hero-in">
        <span class="eyebrow">تسوّق بذكاء</span>
        <h1>كل ما تحتاجه<br><span class="accent">بين يديك</span></h1>
        <p>منتجات مختارة بعناية، أسعار منافسة، وتوصيل سريع لبابك.</p>
        <div class="hero-cta">
          <a href="#catalog" class="btn primary lg">تسوّق الآن</a>
          <a href="#features" class="btn ghost lg">لماذا نحن؟ ▸</a>
        </div>
        <div class="rate">★★★★★ <b>4.8</b> · أكثر من 12,000 عميل سعيد</div>
      </div>
    </section>

    <!-- شريط الثقة -->
    <section id="features" class="feat-strip">
      <div class="feat"><span class="fi">🚚</span><div><b>شحن سريع</b><small>خلال 48 ساعة</small></div></div>
      <div class="feat"><span class="fi">↩️</span><div><b>إرجاع مجّاني</b><small>خلال 14 يوماً</small></div></div>
      <div class="feat"><span class="fi">🔒</span><div><b>دفع آمن</b><small>حماية كاملة</small></div></div>
      <div class="feat"><span class="fi">💬</span><div><b>دعم 24/7</b><small>نجيبك دائماً</small></div></div>
    </section>

    <!-- الكتالوج -->
    <section id="catalog" class="catalog">
      <div class="sec-head"><span class="eyebrow">متجرنا</span><h2>تصفّح المنتجات</h2></div>
      <div class="filters">
        <div class="cats" id="catTabs"></div>
        <select id="sortSelect" class="sort">
          <option value="featured">مميّز</option>
          <option value="price-asc">السعر: من الأقل</option>
          <option value="price-desc">السعر: من الأعلى</option>
          <option value="rating">الأعلى تقييماً</option>
        </select>
      </div>
      <div id="productGrid" class="grid"></div>
      <p id="emptyState" class="empty hidden">لا منتجات مطابقة.</p>
    </section>

    <footer class="site-foot">
      <div class="foot-in">
        <div class="brand" style="font-size:17px"><span class="mk" style="width:26px;height:26px;font-size:13px">J</span> <span>متجر jaola</span> © 2026</div>
        <div class="foot-links"><a href="#catalog">المنتجات</a><a href="#features">المزايا</a><a href="#">الخصوصية</a><a href="#">تواصل</a></div>
      </div>
    </footer>
  </div>

  <!-- لوحة المدير (مخفيّة) -->
  <section id="view-admin" class="admin-wrap hidden">
    <h2 class="sec-title">لوحة المدير</h2>
    <div class="stat-row" id="adminStats"></div>
    <div class="panel">
      <h3>إضافة منتج</h3>
      <div class="form-row">
        <input id="npName" placeholder="اسم المنتج">
        <input id="npPrice" type="number" min="0" placeholder="السعر">
        <input id="npStock" type="number" min="0" placeholder="المخزون">
        <input id="npEmoji" placeholder="رمز 🎁" maxlength="4">
        <select id="npCat" class="sort"></select>
        <button class="btn primary auto" data-action="add-product">إضافة</button>
      </div>
    </div>
    <div class="panel">
      <h3>المنتجات</h3>
      <div id="adminProducts" class="mini-list"></div>
    </div>
    <div class="panel">
      <h3>الطلبات <small class="muted">(اضغط الحالة لتحديثها)</small></h3>
      <div id="adminOrders" class="mini-list"></div>
    </div>
  </section>

  <!-- تفاصيل المنتج -->
  <div id="productModal" class="modal hidden">
    <div class="modal-box" id="productDetail"></div>
  </div>

  <!-- السلة -->
  <aside id="cartDrawer" class="drawer hidden">
    <div class="drawer-head"><h3>🛒 سلّتك</h3><button data-action="close-cart" class="icon-btn">×</button></div>
    <div id="cartItems" class="drawer-body"></div>
    <div class="drawer-foot">
      <div class="total-row">الإجمالي <span id="cartTotal">0</span> ﷼</div>
      <button class="btn primary" data-action="checkout" id="checkoutBtn" disabled>إتمام الشراء</button>
    </div>
  </aside>

  <!-- الدفع -->
  <div id="checkoutModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="close-checkout">×</button>
      <div id="checkoutBody"></div>
    </div>
  </div>

  <!-- دخول المدير -->
  <div id="authModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="close-auth">×</button>
      <h2>دخول المدير</h2>
      <p class="muted">العميل يتسوّق بلا تسجيل — هذا الدخول للإدارة فقط.</p>
      <input id="auName" placeholder="اسم المستخدم">
      <input id="auPass" type="password" placeholder="كلمة المرور">
      <p id="authErr" class="err-msg hidden">بيانات غير صحيحة.</p>
      <button class="btn primary" data-action="submit-auth">دخول</button>
      <p class="demo">تجربة: <code>admin / 1234</code></p>
    </div>
  </div>

  <div id="overlay" class="overlay hidden" data-action="close-cart"></div>
  <div class="toast" id="toast"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🛍️ منطق المتجر — عميل + مدير بصلاحيات. كل الدوال معرّفة، تفويض أحداث.
'use strict';

const PRODUCTS = [
  { id: 'p1', name: 'سماعات لاسلكية', cat: 'إلكترونيات', price: 249, rating: 4.6, emoji: '🎧', stock: 12, img: '1505740420928-5e560c06d30e', desc: 'سماعات بلوتوث بعزل ضوضاء وبطارية 30 ساعة.' },
  { id: 'p2', name: 'ساعة ذكية', cat: 'إلكترونيات', price: 599, rating: 4.4, emoji: '⌚', stock: 8, img: '1523275335684-37898b6baf30', desc: 'تتبّع اللياقة، إشعارات، وشاشة AMOLED.' },
  { id: 'p3', name: 'حقيبة ظهر', cat: 'أزياء', price: 149, rating: 4.8, emoji: '🎒', stock: 20, img: '1553062407-98eeb64c6a62', desc: 'حقيبة مقاومة للماء بجيب لابتوب.' },
  { id: 'p4', name: 'حذاء رياضي', cat: 'أزياء', price: 320, rating: 4.5, emoji: '👟', stock: 15, img: '1542291026-7eec264c27ff', desc: 'خفيف ومريح للجري اليومي.' },
  { id: 'p5', name: 'ماكينة قهوة', cat: 'منزل', price: 799, rating: 4.7, emoji: '☕', stock: 4, img: '1517668808822-9ebb02f2a0e6', desc: 'إسبريسو احترافي بضغط 20 بار.' },
  { id: 'p6', name: 'مصباح مكتب', cat: 'منزل', price: 89, rating: 4.2, emoji: '💡', stock: 30, img: '1507003211169-0a1dd7228f2d', desc: 'إضاءة LED قابلة للتعتيم بثلاث درجات.' },
  { id: 'p7', name: 'لوحة مفاتيح', cat: 'إلكترونيات', price: 199, rating: 4.3, emoji: '⌨️', stock: 18, img: '1587829741301-dc798b83add3', desc: 'ميكانيكية بإضاءة RGB واتصال لاسلكي.' },
  { id: 'p8', name: 'نظّارة شمسية', cat: 'أزياء', price: 129, rating: 4.1, emoji: '🕶️', stock: 3, img: '1511499767150-a48a237f0083', desc: 'حماية UV400 بإطار خفيف.' },
];
const CATEGORIES = ['الكل', 'إلكترونيات', 'أزياء', 'منزل'];
const STAFF = { admin: { pass: '1234', role: 'admin', name: 'مدير المتجر' } };
const ORDER_FLOW = ['جديد', 'قيد التجهيز', 'تم الشحن', 'مكتمل'];
const LOW_STOCK = 5;

function load(key, fb) { try { var v = localStorage.getItem('jstore_' + key); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function save(key, val) { try { localStorage.setItem('jstore_' + key, JSON.stringify(val)); } catch {} }

let products = load('products', PRODUCTS.slice());
let orders = load('orders', []);
const state = { cat: 'الكل', query: '', sort: 'featured', cart: load('cart', []), step: 'cart', user: null, view: 'shop' };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US'); }
function findProduct(id) { return products.find(p => p.id === id) || null; }
function stars(r) { var f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }
function uid(p) { return p + Math.random().toString(36).slice(2, 7); }
function imgUrl(id) { return 'https://images.unsplash.com/photo-' + id + '?w=600&q=80&auto=format&fit=crop'; }
// صورة داخل حاوية .ph: بديل تدرّجيّ+رمز خلفها؛ الصورة فوقها وتختفي إن فشلت.
function photo(p, cls) {
  var emoji = '<span class="ph-emoji">' + (p.emoji || '🛍️') + '</span>';
  var img = p.img ? '<img loading="lazy" src="' + imgUrl(p.img) + '" alt="' + p.name + '" onerror="this.style.display=&#39;none&#39;">' : '';
  return '<div class="ph ' + (cls || '') + '">' + emoji + img + '</div>';
}

// ── الكتالوج: فئات + بحث + فرز ─────────────────────────────────────────
function renderCategories() {
  byId('catTabs').innerHTML = CATEGORIES.map(c =>
    '<button class="cat ' + (c === state.cat ? 'active' : '') + '" data-action="cat" data-cat="' + c + '">' + c + '</button>').join('');
}
function visibleProducts() {
  let list = products.slice();
  if (state.cat !== 'الكل') list = list.filter(p => p.cat === state.cat);
  if (state.query) { const q = state.query.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q)); }
  if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (state.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
  return list;
}
function renderProducts() {
  const list = visibleProducts();
  show(byId('emptyState'), list.length === 0);
  byId('productGrid').innerHTML = list.map(p =>
    '<div class="card">' +
    '<div class="card-media" data-action="open-product" data-id="' + p.id + '">' + photo(p) +
    (p.stock <= 0 ? '<span class="tag out">نفد</span>' : (p.stock <= LOW_STOCK ? '<span class="tag low">آخر ' + p.stock + '</span>' : '')) + '</div>' +
    '<div class="card-b">' +
    '<div class="p-name">' + p.name + '</div>' +
    '<div class="p-rating">' + stars(p.rating) + ' <span class="muted">(' + p.rating + ')</span></div>' +
    '<div class="p-foot"><span class="p-price">' + money(p.price) + ' ﷼</span>' +
    '<button class="btn small" data-action="add" data-id="' + p.id + '">أضف 🛒</button></div></div></div>').join('');
}
function setCategory(c) { state.cat = c; renderCategories(); renderProducts(); }

// ── تفاصيل المنتج ─────────────────────────────────────────────────────
function openProduct(id) {
  const p = findProduct(id); if (!p) return;
  byId('productDetail').innerHTML =
    '<button class="icon-btn close-x" data-action="close-product">×</button>' +
    photo(p, 'detail-media') +
    '<h2>' + p.name + '</h2><div class="p-rating">' + stars(p.rating) + ' (' + p.rating + ')</div>' +
    '<p class="detail-desc">' + p.desc + '</p>' +
    '<div class="detail-meta">الفئة: ' + p.cat + ' · المتوفّر: ' + p.stock + '</div>' +
    '<div class="detail-foot"><span class="p-price">' + money(p.price) + ' ﷼</span>' +
    '<button class="btn primary" data-action="add" data-id="' + p.id + '">أضِف إلى السلّة</button></div>';
  show(byId('productModal'), true);
}
function closeProduct() { show(byId('productModal'), false); }

// ── السلّة ────────────────────────────────────────────────────────────
function addToCart(id) {
  const p = findProduct(id); if (!p) return;
  const line = state.cart.find(c => c.id === id);
  if (line) line.qty += 1; else state.cart.push({ id: id, name: p.name, price: p.price, emoji: p.emoji, img: p.img, qty: 1 });
  save('cart', state.cart); updateCartUI(); toast('أُضيف إلى السلّة'); openCart();
}
function changeQty(id, delta) {
  const line = state.cart.find(c => c.id === id); if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) state.cart = state.cart.filter(c => c.id !== id);
  save('cart', state.cart); updateCartUI();
}
function cartTotal() { return state.cart.reduce((s, c) => s + c.price * c.qty, 0); }
function cartCount() { return state.cart.reduce((s, c) => s + c.qty, 0); }
function updateCartUI() {
  const n = cartCount(); const badge = byId('cartCount');
  badge.textContent = n; badge.style.display = n ? 'grid' : 'none';
  byId('cartTotal').textContent = money(cartTotal());
  byId('checkoutBtn').disabled = state.cart.length === 0;
  const box = byId('cartItems');
  box.innerHTML = state.cart.length ? state.cart.map(c =>
    '<div class="cart-line">' + photo(c, 'cl-thumb') +
    '<div class="cl-info"><div>' + c.name + '</div><div class="muted">' + money(c.price) + ' ﷼</div></div>' +
    '<div class="qty"><button data-action="dec" data-id="' + c.id + '">−</button><span>' + c.qty + '</span>' +
    '<button data-action="inc" data-id="' + c.id + '">+</button></div></div>').join('')
    : '<p class="muted center">سلّتك فارغة</p>';
}
function openCart() { show(byId('cartDrawer'), true); show(byId('overlay'), true); }
function closeCart() { show(byId('cartDrawer'), false); show(byId('overlay'), false); }

// ── الدفع (خطوتان) ────────────────────────────────────────────────────
function openCheckout() {
  if (!state.cart.length) return;
  state.step = 'info';
  renderCheckout();
  show(byId('checkoutModal'), true);
}
function renderCheckout() {
  const body = byId('checkoutBody');
  if (state.step === 'info') {
    body.innerHTML = '<h2>بيانات التوصيل</h2>' +
      '<input id="coName" placeholder="الاسم الكامل"><input id="coPhone" placeholder="رقم الجوّال">' +
      '<input id="coAddr" placeholder="العنوان">' +
      '<div class="co-summary">الإجمالي: <b>' + money(cartTotal()) + ' ﷼</b> · ' + cartCount() + ' منتج</div>' +
      '<button class="btn primary" data-action="confirm-order">تأكيد الطلب</button>';
  } else if (state.step === 'done') {
    body.innerHTML = '<div class="done"><div class="done-check">✅</div><h2>تم تأكيد طلبك!</h2>' +
      '<p class="muted">رقم الطلب: #' + state.lastOrder + ' — سنتواصل معك للتوصيل.</p>' +
      '<button class="btn primary" data-action="close-checkout">متابعة التسوّق</button></div>';
  }
}
function confirmOrder() {
  const name = (byId('coName') && byId('coName').value || '').trim();
  if (!name) { if (byId('coName')) byId('coName').classList.add('err'); return; }
  state.lastOrder = 1000 + Math.floor(Math.random() * 9000);
  orders.push({ id: state.lastOrder, items: state.cart.slice(), total: cartTotal(), customer: name,
    phone: (byId('coPhone') && byId('coPhone').value || '').trim(), status: 'جديد' });
  save('orders', orders);
  state.cart = []; save('cart', state.cart); updateCartUI();
  state.step = 'done'; renderCheckout();
}
function closeCheckout() { show(byId('checkoutModal'), false); closeCart(); }

// ── الأدوار: دخول المدير + تبديل الواجهة ───────────────────────────────
function applyAccess() {
  const isAdmin = state.user && state.user.role === 'admin';
  show(byId('view-shop'), state.view === 'shop');
  show(byId('view-admin'), state.view === 'admin' && isAdmin);
  show(byId('searchWrap'), state.view === 'shop');
  const btn = byId('authBtn');
  if (btn) btn.textContent = isAdmin ? (state.view === 'admin' ? '🛍️ المتجر' : '⚙️ اللوحة') : 'دخول';
}
function openAuth() { show(byId('authErr'), false); byId('auName').value = ''; byId('auPass').value = ''; show(byId('authModal'), true); }
function closeAuth() { show(byId('authModal'), false); }
function submitAuth() {
  const name = (byId('auName').value || '').trim();
  const pass = (byId('auPass').value || '').trim();
  const acc = STAFF[name];
  if (acc && acc.pass === pass) { state.user = { name: acc.name, role: acc.role }; closeAuth(); setView('admin'); }
  else show(byId('authErr'), true);
}
function logout() { state.user = null; setView('shop'); }
function authBtnClick() {
  if (!state.user) { openAuth(); return; }
  setView(state.view === 'admin' ? 'shop' : 'admin');
}
function setView(v) {
  if (v === 'admin' && !(state.user && state.user.role === 'admin')) v = 'shop';
  state.view = v; applyAccess();
  if (v === 'shop') { renderCategories(); renderProducts(); }
  if (v === 'admin') renderAdmin();
}

// ── لوحة المدير ───────────────────────────────────────────────────────
function renderAdmin() {
  byId('npCat').innerHTML = CATEGORIES.filter(c => c !== 'الكل').map(c => '<option value="' + c + '">' + c + '</option>').join('');
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const avg = orders.length ? Math.round(revenue / orders.length) : 0;
  const low = products.filter(p => p.stock <= LOW_STOCK).length;
  byId('adminStats').innerHTML =
    stat('الإيراد', money(revenue) + ' ﷼') + stat('الطلبات', orders.length) +
    stat('متوسط الطلب', money(avg) + ' ﷼') + stat('المنتجات', products.length) +
    stat('مخزون منخفض', low, low ? 'warn' : '');
  byId('adminProducts').innerHTML = products.length ? products.map(p =>
    '<div class="mini-row"><span>' + p.emoji + ' ' + p.name + '</span>' +
    '<span class="mr-stock ' + (p.stock <= LOW_STOCK ? 'warn' : '') + '">مخزون: ' + p.stock + '</span>' +
    '<span class="mr-price">' + money(p.price) + ' ﷼</span>' +
    '<button class="btn small" data-action="del-product" data-id="' + p.id + '">🗑</button></div>').join('')
    : '<p class="muted">لا منتجات.</p>';
  byId('adminOrders').innerHTML = orders.length ? orders.slice().reverse().map(o =>
    '<div class="mini-row"><span>#' + o.id + ' · ' + o.customer + '</span>' +
    '<span class="mr-price">' + money(o.total) + ' ﷼</span>' +
    '<button class="pill ' + statusClass(o.status) + '" data-action="advance-order" data-id="' + o.id + '">' + o.status + ' ▸</button></div>').join('')
    : '<p class="muted">لا طلبات بعد.</p>';
}
function addProduct() {
  const name = (byId('npName').value || '').trim();
  const price = Number(byId('npPrice').value || 0);
  const stock = Number(byId('npStock').value || 0);
  const emoji = (byId('npEmoji').value || '📦').trim() || '📦';
  const cat = byId('npCat').value || CATEGORIES[1];
  if (!name || !(price > 0)) { byId('npName').classList.add('err'); return; }
  products.push({ id: uid('p'), name: name, cat: cat, price: price, rating: 5, emoji: emoji, stock: stock, img: '', desc: 'منتج جديد.' });
  save('products', products);
  byId('npName').value = ''; byId('npPrice').value = ''; byId('npStock').value = ''; byId('npEmoji').value = '';
  renderAdmin();
}
function deleteProduct(id) { products = products.filter(p => p.id !== id); save('products', products); renderAdmin(); }
function advanceOrder(id) {
  const o = orders.find(x => String(x.id) === String(id)); if (!o) return;
  const i = ORDER_FLOW.indexOf(o.status);
  o.status = ORDER_FLOW[(i + 1) % ORDER_FLOW.length];
  save('orders', orders); renderAdmin();
}
function statusClass(s) { return s === 'مكتمل' ? 'ok' : (s === 'تم الشحن' ? 'ship' : (s === 'قيد التجهيز' ? 'prep' : 'new')); }
function stat(label, val, cls) { return '<div class="stat"><div class="stat-val ' + (cls || '') + '">' + val + '</div><div class="stat-label">' + label + '</div></div>'; }

// ── تفويض الأحداث ─────────────────────────────────────────────────────
function handleClick(e) {
  const el = e.target.closest('[data-action]'); if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.action) {
    case 'cat': setCategory(el.dataset.cat); break;
    case 'open-product': openProduct(id); break;
    case 'close-product': closeProduct(); break;
    case 'add': addToCart(id); break;
    case 'inc': changeQty(id, 1); break;
    case 'dec': changeQty(id, -1); break;
    case 'open-cart': openCart(); break;
    case 'close-cart': closeCart(); break;
    case 'checkout': openCheckout(); break;
    case 'confirm-order': confirmOrder(); break;
    case 'close-checkout': closeCheckout(); break;
    case 'open-auth': authBtnClick(); break;
    case 'close-auth': closeAuth(); break;
    case 'submit-auth': submitAuth(); break;
    case 'add-product': addProduct(); break;
    case 'del-product': deleteProduct(id); break;
    case 'advance-order': advanceOrder(id); break;
  }
}
function handleInput(e) {
  if (e.target && e.target.id === 'searchInput') { state.query = e.target.value || ''; renderProducts(); }
}
function handleChange(e) {
  if (e.target && e.target.id === 'sortSelect') { state.sort = e.target.value; renderProducts(); }
}
var _toastT;
function toast(m) { const t = byId('toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(_toastT); _toastT = setTimeout(() => t.classList.remove('on'), 2000); }

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  applyAccess();
  renderCategories();
  renderProducts();
  updateCartUI();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0b0b12;--surface:#13131d;--card:#181826;--accent:#8b5cf6;--accent2:#6366f1;--good:#22c55e;--warn:#f59e0b;--danger:#ef4444;--text:#eceefb;--muted:#8b8fa7;--border:#242639;--line:rgba(139,92,246,.16);--font:'Segoe UI',Tahoma,system-ui,sans-serif;--shadow:0 30px 70px -24px rgba(0,0,0,.8)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(50% 40% at 85% 0%,rgba(139,92,246,.10),transparent 60%),radial-gradient(50% 40% at 0% 100%,rgba(99,102,241,.08),transparent 60%),var(--bg)}
.topbar{display:flex;align-items:center;gap:14px;padding:12px 22px;background:rgba(19,19,29,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:30}
.brand{font-size:18px;font-weight:800;white-space:nowrap;display:flex;align-items:center;gap:10px}
.brand .mk{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;color:#fff;font-weight:900}
.search{flex:1;max-width:520px}
.search input,#searchInput{width:100%;background:var(--card);border:1px solid var(--border);border-radius:11px;padding:10px 15px;color:var(--text)}
.top-r{display:flex;align-items:center;gap:10px;margin-inline-start:auto}
.cart-btn{position:relative;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:11px;padding:9px 14px;font-size:15px;cursor:pointer}
.cart-count{position:absolute;top:-7px;inset-inline-start:-7px;background:var(--accent);color:#fff;border-radius:20px;min-width:19px;height:19px;place-items:center;font-size:11px;font-weight:800}
/* أزرار */
.btn{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:10px 18px;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:7px;transition:.18s;font-family:var(--font)}
.btn.primary{background:linear-gradient(105deg,var(--accent),var(--accent2));border-color:transparent;color:#fff}
.btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px -10px rgba(139,92,246,.6)}
.btn.ghost{background:rgba(255,255,255,.04)}.btn.ghost:hover{background:rgba(255,255,255,.09)}
.btn.lg{padding:14px 28px;font-size:15px}
.btn.small{padding:7px 12px;font-size:12px}
.btn.auto{width:auto}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:2.5px;color:var(--accent);text-transform:uppercase}
.accent{background:linear-gradient(105deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.muted{color:var(--muted);font-size:13px}.center{text-align:center}
/* حاوية الصورة مع بديل تدرّجيّ */
.ph{position:relative;overflow:hidden;background:linear-gradient(135deg,#1c1c2b,#26263d)}
.ph .ph-emoji{position:absolute;inset:0;display:grid;place-items:center;font-size:52px;opacity:.85}
.ph img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}
/* البطل */
.hero{position:relative;min-height:64vh;display:flex;align-items:center;overflow:hidden;border-radius:0 0 30px 30px}
.hero .hero-bg{position:absolute;inset:0;z-index:0}
.hero .hero-bg::after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(11,11,18,.94) 32%,rgba(11,11,18,.4))}
.hero-in{position:relative;z-index:3;max-width:1140px;margin:0 auto;width:100%;padding:70px 24px}
.hero h1{font-size:clamp(36px,6.5vw,66px);line-height:1.06;font-weight:800;margin:14px 0 16px;letter-spacing:-1px}
.hero p{font-size:18px;color:#d7d9ee;max-width:460px;margin-bottom:26px}
.hero-cta{display:flex;gap:12px;flex-wrap:wrap}
.rate{margin-top:24px;color:var(--muted);font-size:14px}.rate b{color:var(--accent)}
/* شريط الثقة */
.feat-strip{max-width:1140px;margin:-34px auto 0;position:relative;z-index:5;padding:0 24px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
@media(max-width:760px){.feat-strip{grid-template-columns:1fr 1fr}}
.feat{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;align-items:center;gap:12px}
.feat .fi{font-size:26px}.feat b{font-size:14px;display:block}.feat small{color:var(--muted);font-size:12px}
/* أقسام */
.catalog{max-width:1140px;margin:0 auto;padding:64px 24px 20px}
.sec-head{text-align:center;margin-bottom:26px}
.sec-head h2{font-size:clamp(26px,4vw,40px);font-weight:800;letter-spacing:-.5px;margin-top:6px}
.filters{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.cats{display:flex;gap:8px;flex-wrap:wrap}
.cat{background:transparent;border:1px solid var(--border);color:var(--muted);padding:8px 18px;border-radius:99px;font-weight:700;font-size:13px;cursor:pointer;transition:.15s;font-family:var(--font)}
.cat.active{background:linear-gradient(105deg,var(--accent),var(--accent2));border-color:transparent;color:#fff}
.sort,select{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:11px;padding:9px 13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}
.card{background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;transition:.2s}
.card:hover{transform:translateY(-4px);border-color:rgba(139,92,246,.4)}
.card:hover .ph img{transform:scale(1.06)}
.card-media{position:relative;height:180px;cursor:pointer}
.card-media .ph{height:100%}
.tag{position:absolute;top:10px;inset-inline-start:10px;z-index:3;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px}
.tag.low{background:rgba(245,158,11,.9);color:#231603}.tag.out{background:rgba(239,68,68,.9);color:#fff}
.card-b{padding:14px 16px 16px}
.p-name{font-weight:700;font-size:15px;margin-bottom:4px}
.p-rating{color:#fbbf24;font-size:13px;margin-bottom:10px}
.p-foot{display:flex;justify-content:space-between;align-items:center}
.p-price{font-weight:800;color:var(--accent);font-size:17px}
.empty{text-align:center;color:var(--muted);padding:40px}
.hidden{display:none !important}
/* التذييل */
.site-foot{border-top:1px solid var(--border);margin-top:50px;padding:34px 24px}
.foot-in{max-width:1140px;margin:0 auto;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;color:var(--muted);font-size:14px}
.foot-links a{color:var(--muted);text-decoration:none;margin-inline-start:18px}.foot-links a:hover{color:var(--accent)}
/* لوحة المدير */
.admin-wrap{max-width:1000px;margin:0 auto;padding:26px 24px 40px}
.sec-title{margin-bottom:18px;font-size:22px}
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:19px;font-weight:800;color:var(--accent)}.stat-val.warn{color:var(--warn)}
.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px}
.panel h3{margin-bottom:12px;font-size:15px}
.form-row{display:flex;gap:8px;flex-wrap:wrap}
.form-row input,.form-row select{flex:1;min-width:110px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text)}
.form-row input.err{border-color:var(--danger)}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px}
.mr-price{color:var(--accent);font-weight:700}
.mr-stock{font-size:12px;color:var(--muted)}.mr-stock.warn{color:var(--warn)}
.pill{font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px;border:none;cursor:pointer;font-family:var(--font)}
.pill.new{background:rgba(139,92,246,.18);color:var(--accent)}
.pill.prep{background:rgba(245,158,11,.16);color:var(--warn)}
.pill.ship{background:rgba(99,102,241,.18);color:#a5b4fc}
.pill.ok{background:rgba(34,197,94,.16);color:var(--good)}
.err-msg{color:var(--danger);font-size:13px;margin-bottom:8px}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px}.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
/* النوافذ */
.modal{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(440px,100%);position:relative;max-height:90dvh;overflow:auto}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text);margin-bottom:10px}
.modal-box input.err{border-color:var(--danger)}
.icon-btn{background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer}
.close-x{position:absolute;top:12px;left:14px}
.detail-media{height:220px;border-radius:14px;margin-bottom:14px}
.detail-desc{color:var(--muted);margin:10px 0}
.detail-meta{font-size:12px;color:var(--muted);margin-bottom:14px}
.detail-foot,.co-summary{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px}
.co-summary{margin:14px 0}
/* السلّة */
.drawer{position:fixed;top:0;inset-inline-end:0;height:100%;width:min(370px,100%);background:var(--surface);border-inline-start:1px solid var(--border);z-index:70;display:flex;flex-direction:column;box-shadow:var(--shadow)}
.drawer-head{display:flex;justify-content:space-between;align-items:center;padding:18px;border-bottom:1px solid var(--border)}
.drawer-body{flex:1;overflow:auto;padding:12px 18px}
.drawer-foot{padding:18px;border-top:1px solid var(--border)}
.total-row{display:flex;justify-content:space-between;font-weight:800;margin-bottom:12px}
.cart-line{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid var(--border)}
.cl-thumb{width:50px;height:50px;border-radius:11px;flex-shrink:0}
.cl-info{flex:1;font-size:13px}
.qty{display:flex;align-items:center;gap:8px}
.qty button{width:27px;height:27px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:65}
.done{text-align:center}.done-check{font-size:56px}
.toast{position:fixed;bottom:22px;inset-inline-start:50%;transform:translateX(50%);background:linear-gradient(105deg,var(--accent),var(--accent2));color:#fff;padding:12px 22px;border-radius:12px;font-weight:800;z-index:90;opacity:0;pointer-events:none;transition:.25s}
html[dir=rtl] .toast{transform:translateX(-50%)}
.toast.on{opacity:1}
h2{font-size:19px;margin-bottom:6px}
`;

export function jaolaStore() {
    return {
        id: 'jaola-store',
        category: 'ecommerce',
        name: 'متجر إلكتروني',
        description: 'متجر فاخر مكتمل بدورين: عميل (بطل + شريط ثقة + فئات + بحث + فرز + بطاقات بصور حقيقية + تفاصيل + سلّة + دفع من خطوتين) ومدير (لوحة مخفيّة: إدارة المنتجات + إدارة حالة الطلبات + إحصاءات إيراد/متوسط/مخزون منخفض). الإدارة بدخول، والعميل يتسوّق بلا تسجيل.',
        keywords: ['متجر', 'تسوّق', 'shop', 'store', 'ecommerce', 'منتجات', 'سلة', 'cart', 'شراء', 'بيع', 'online store', 'محل'],
        model: {
            entities: [
                { name: 'Product', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'price', type: 'number' }, { name: 'category', type: 'string' }, { name: 'stock', type: 'number' }], ownedBy: 'Admin' },
                { name: 'Order', fields: [{ name: 'id', type: 'number' }, { name: 'items', type: 'array' }, { name: 'total', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Customer' },
            ],
            roles: [
                { name: 'Customer', description: 'يتصفّح ويشتري', capabilities: ['تصفّح', 'بحث/فرز', 'سلّة', 'دفع'] },
                { name: 'Admin', description: 'يدير المتجر', capabilities: ['إضافة/حذف منتج', 'إدارة حالة الطلبات', 'إحصاءات'] },
            ],
            flows: [
                { name: 'الشراء', actor: 'Customer', steps: ['يتصفّح/يبحث', 'يفتح تفاصيل المنتج', 'يضيف للسلّة', 'يدفع ويؤكّد'], touches: ['Product', 'Order'], realtime: false },
                { name: 'إدارة المتجر', actor: 'Admin', steps: ['يدخل بحسابه → اللوحة', 'يضيف/يحذف منتجاً', 'يحدّث حالة الطلبات ويتابع الإحصاءات'], touches: ['Product', 'Order'], realtime: false },
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
