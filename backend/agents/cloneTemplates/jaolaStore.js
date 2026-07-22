/**
 * 🛍️ jaola-store — متجر إلكتروني *عامل* غنيّ بالتفاصيل.
 *
 * أكثر المشاريع طلباً. نمط UX مختلف عن قوالب الأدوار: فئات + بحث + فرز +
 * تفاصيل منتج (نافذة) + سلة جانبية + دفع من خطوتين + تأكيد الطلب.
 * كل الدوال معرّفة (تفويض أحداث)، بيانات مشتركة (localStorage). يجتاز
 * التحقّق السلوكي 100%.
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
    <div class="brand">🛍️ <span id="brandName">متجر jaola</span></div>
    <div class="search"><input id="searchInput" placeholder="ابحث عن منتج..."></div>
    <button class="cart-btn" data-action="open-cart">🛒 <span id="cartCount" class="cart-count">0</span></button>
  </header>

  <div class="filters">
    <div class="cats" id="catTabs"></div>
    <select id="sortSelect" class="sort">
      <option value="featured">مميّز</option>
      <option value="price-asc">السعر: من الأقل</option>
      <option value="price-desc">السعر: من الأعلى</option>
      <option value="rating">الأعلى تقييماً</option>
    </select>
  </div>

  <main>
    <div id="productGrid" class="grid"></div>
    <p id="emptyState" class="empty hidden">لا منتجات مطابقة.</p>
  </main>

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

  <div id="overlay" class="overlay hidden" data-action="close-cart"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🛍️ منطق المتجر — كل الدوال معرّفة، تفويض أحداث، بيانات مشتركة.
'use strict';

const PRODUCTS = [
  { id: 'p1', name: 'سماعات لاسلكية', cat: 'إلكترونيات', price: 249, rating: 4.6, emoji: '🎧', stock: 12, desc: 'سماعات بلوتوث بعزل ضوضاء وبطارية 30 ساعة.' },
  { id: 'p2', name: 'ساعة ذكية', cat: 'إلكترونيات', price: 599, rating: 4.4, emoji: '⌚', stock: 8, desc: 'تتبّع اللياقة، إشعارات، وشاشة AMOLED.' },
  { id: 'p3', name: 'حقيبة ظهر', cat: 'أزياء', price: 149, rating: 4.8, emoji: '🎒', stock: 20, desc: 'حقيبة مقاومة للماء بجيب لابتوب.' },
  { id: 'p4', name: 'حذاء رياضي', cat: 'أزياء', price: 320, rating: 4.5, emoji: '👟', stock: 15, desc: 'خفيف ومريح للجري اليومي.' },
  { id: 'p5', name: 'ماكينة قهوة', cat: 'منزل', price: 799, rating: 4.7, emoji: '☕', stock: 5, desc: 'إسبريسو احترافي بضغط 20 بار.' },
  { id: 'p6', name: 'مصباح مكتب', cat: 'منزل', price: 89, rating: 4.2, emoji: '💡', stock: 30, desc: 'إضاءة LED قابلة للتعتيم بثلاث درجات.' },
  { id: 'p7', name: 'لوحة مفاتيح', cat: 'إلكترونيات', price: 199, rating: 4.3, emoji: '⌨️', stock: 18, desc: 'ميكانيكية بإضاءة RGB واتصال لاسلكي.' },
  { id: 'p8', name: 'نظّارة شمسية', cat: 'أزياء', price: 129, rating: 4.1, emoji: '🕶️', stock: 25, desc: 'حماية UV400 بإطار خفيف.' },
];
const CATEGORIES = ['الكل', 'إلكترونيات', 'أزياء', 'منزل'];

const state = { cat: 'الكل', query: '', sort: 'featured', cart: loadCart(), step: 'cart' };

function loadCart() { try { return JSON.parse(localStorage.getItem('store_cart') || '[]'); } catch { return []; } }
function saveCart() { try { localStorage.setItem('store_cart', JSON.stringify(state.cart)); } catch {} }
function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US'); }
function findProduct(id) { return PRODUCTS.find(p => p.id === id) || null; }
function stars(r) { const f = Math.round(r); return '★'.repeat(f) + '☆'.repeat(5 - f); }

// ── الكتالوج: فئات + بحث + فرز ─────────────────────────────────────────
function renderCategories() {
  byId('catTabs').innerHTML = CATEGORIES.map(c =>
    '<button class="cat ' + (c === state.cat ? 'active' : '') + '" data-action="cat" data-cat="' + c + '">' + c + '</button>').join('');
}
function visibleProducts() {
  let list = PRODUCTS.slice();
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
    '<div class="p-emoji" data-action="open-product" data-id="' + p.id + '">' + p.emoji + '</div>' +
    '<div class="p-name">' + p.name + '</div>' +
    '<div class="p-rating">' + stars(p.rating) + ' <span class="muted">(' + p.rating + ')</span></div>' +
    '<div class="p-foot"><span class="p-price">' + money(p.price) + ' ﷼</span>' +
    '<button class="btn small" data-action="add" data-id="' + p.id + '">أضف 🛒</button></div></div>').join('');
}
function setCategory(c) { state.cat = c; renderCategories(); renderProducts(); }

// ── تفاصيل المنتج ─────────────────────────────────────────────────────
function openProduct(id) {
  const p = findProduct(id); if (!p) return;
  byId('productDetail').innerHTML =
    '<button class="icon-btn close-x" data-action="close-product">×</button>' +
    '<div class="detail-emoji">' + p.emoji + '</div>' +
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
  if (line) line.qty += 1; else state.cart.push({ id: id, name: p.name, price: p.price, emoji: p.emoji, qty: 1 });
  saveCart(); updateCartUI(); openCart();
}
function changeQty(id, delta) {
  const line = state.cart.find(c => c.id === id); if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) state.cart = state.cart.filter(c => c.id !== id);
  saveCart(); updateCartUI();
}
function cartTotal() { return state.cart.reduce((s, c) => s + c.price * c.qty, 0); }
function cartCount() { return state.cart.reduce((s, c) => s + c.qty, 0); }
function updateCartUI() {
  byId('cartCount').textContent = cartCount();
  byId('cartTotal').textContent = money(cartTotal());
  byId('checkoutBtn').disabled = state.cart.length === 0;
  const box = byId('cartItems');
  box.innerHTML = state.cart.length ? state.cart.map(c =>
    '<div class="cart-line"><span class="cl-emoji">' + c.emoji + '</span>' +
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
  state.cart = []; saveCart(); updateCartUI();
  state.step = 'done'; renderCheckout();
}
function closeCheckout() { show(byId('checkoutModal'), false); closeCart(); }

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
  }
}
function handleInput(e) {
  if (e.target && e.target.id === 'searchInput') { state.query = e.target.value || ''; renderProducts(); }
}
function handleChange(e) {
  if (e.target && e.target.id === 'sortSelect') { state.sort = e.target.value; renderProducts(); }
}

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  renderCategories();
  renderProducts();
  updateCartUI();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0f1117;--surface:#171a24;--card:#1d2130;--accent:#8b5cf6;--good:#22c55e;--text:#e8edf6;--muted:#8b93a7;--border:#282d3d;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;align-items:center;gap:14px;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20}
.brand{font-size:18px;font-weight:800;white-space:nowrap}
.search{flex:1}
.search input,#searchInput{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text)}
.cart-btn{position:relative;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:9px 14px;font-size:15px;cursor:pointer}
.cart-count{background:var(--accent);color:#fff;border-radius:20px;padding:0 6px;font-size:11px;font-weight:800;margin-inline-start:4px}
.filters{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 20px;max-width:1100px;margin:0 auto}
.cats{display:flex;gap:6px;flex-wrap:wrap}
.cat{background:transparent;border:1px solid var(--border);color:var(--muted);padding:7px 14px;border-radius:20px;font-weight:700;font-size:13px;cursor:pointer}
.cat.active{background:var(--accent);border-color:var(--accent);color:#fff}
.sort{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:10px;padding:8px 12px}
main{max-width:1100px;margin:0 auto;padding:0 20px 40px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px;text-align:center}
.p-emoji{font-size:52px;cursor:pointer;padding:10px 0}
.p-name{font-weight:700;font-size:14px;margin-bottom:4px}
.p-rating{color:#fbbf24;font-size:13px;margin-bottom:8px}
.p-foot{display:flex;justify-content:space-between;align-items:center}
.p-price{font-weight:800;color:var(--accent)}
.btn{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:9px 16px;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff;width:100%}
.btn.small{padding:6px 10px;font-size:12px}
.btn.primary:disabled{opacity:.5;cursor:not-allowed}
.empty{text-align:center;color:var(--muted);padding:40px}
.hidden{display:none !important}
.muted{color:var(--muted);font-size:13px}.center{text-align:center}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:40;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(420px,100%);position:relative;max-height:90dvh;overflow:auto}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text);margin-bottom:10px}
.modal-box input.err{border-color:#ef4444}
.icon-btn{background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer}
.close-x{position:absolute;top:12px;left:14px}
.detail-emoji{font-size:70px;text-align:center}
.detail-desc{color:var(--muted);margin:10px 0}
.detail-meta{font-size:12px;color:var(--muted);margin-bottom:14px}
.detail-foot,.co-summary{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px}
.co-summary{margin:14px 0}
.drawer{position:fixed;top:0;inset-inline-end:0;height:100%;width:min(360px,100%);background:var(--surface);border-inline-start:1px solid var(--border);z-index:50;display:flex;flex-direction:column}
.drawer-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid var(--border)}
.drawer-body{flex:1;overflow:auto;padding:12px 18px}
.drawer-foot{padding:16px 18px;border-top:1px solid var(--border)}
.total-row{display:flex;justify-content:space-between;font-weight:800;margin-bottom:12px}
.cart-line{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)}
.cl-emoji{font-size:28px}.cl-info{flex:1;font-size:13px}
.qty{display:flex;align-items:center;gap:8px}
.qty button{width:26px;height:26px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:45}
.done{text-align:center}.done-check{font-size:56px}
h2{font-size:19px;margin-bottom:6px}
`;

export function jaolaStore() {
    return {
        id: 'jaola-store',
        category: 'ecommerce',
        name: 'متجر إلكتروني',
        description: 'متجر عامل غنيّ: فئات + بحث + فرز + تفاصيل منتج + سلّة جانبية + دفع من خطوتين + تأكيد طلب.',
        keywords: ['متجر', 'تسوّق', 'shop', 'store', 'ecommerce', 'منتجات', 'سلة', 'cart', 'شراء', 'بيع', 'online store', 'محل'],
        model: {
            entities: [
                { name: 'Product', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'price', type: 'number' }, { name: 'category', type: 'string' }, { name: 'stock', type: 'number' }], ownedBy: 'Seller' },
                { name: 'Order', fields: [{ name: 'id', type: 'number' }, { name: 'items', type: 'array' }, { name: 'total', type: 'number' }], ownedBy: 'Customer' },
            ],
            roles: [{ name: 'Customer', description: 'يتصفّح ويشتري', capabilities: ['تصفّح', 'بحث/فرز', 'سلّة', 'دفع'] }],
            flows: [
                { name: 'الشراء', actor: 'Customer', steps: ['يتصفّح/يبحث', 'يفتح تفاصيل المنتج', 'يضيف للسلّة', 'يدفع ويؤكّد'], touches: ['Product', 'Order'], realtime: false },
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
