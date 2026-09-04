/**
 * 🧾 jaola-pos — نظام نقطة بيع (كاشير) داخلي (track: system).
 *
 * شاشة بيع سريعة بشبكة منتجات، سلة، دفع نقدي/شبكة، طباعة إيصال حراري،
 * وإغلاق يومي (تحصيل الوردية). أدوار: مدير (منتجات + تقارير) / كاشير
 * (بيع + إغلاق). بلا اعتماد خارجي. الحالة في localStorage (jpos_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaPos() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام نقطة البيع</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🧾</span> <span id="brandName">متجر jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام نقطة البيع</h1>
        <p class="hint">بيع سريع · إيصال حراري · إغلاق وردية · تقارير.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="manager">مدير</option><option value="cashier">كاشير</option></select>
        <label>كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="login">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin».</p>
      </div>
    </section>

    <section id="view-pos" class="view hidden">
      <div class="pos-layout">
        <div class="pos-products" id="posProducts"></div>
        <div class="pos-cart">
          <h3>السلة</h3>
          <div id="cartLines" class="cart-lines"></div>
          <div class="cart-total" id="cartTotal">0</div>
          <div class="pay-row">
            <button class="btn primary block" data-action="payCash">💵 نقدي</button>
            <button class="btn ghost block" data-action="payCard">💳 شبكة</button>
          </div>
          <button class="btn tiny ghost" data-action="clearCart">تفريغ السلة</button>
        </div>
      </div>
    </section>

    <section id="view-products" class="view hidden">
      <div class="view-head"><h2>المنتجات</h2></div>
      <div class="panel form-row">
        <input id="prName" placeholder="اسم المنتج">
        <input id="prPrice" type="number" placeholder="السعر" min="0" step="0.01">
        <input id="prEmoji" placeholder="رمز (اختياري) 🥤" maxlength="2">
        <button class="btn primary" data-action="addProduct">إضافة منتج</button>
      </div>
      <div class="panel"><table class="tbl" id="productsTable"></table></div>
    </section>

    <section id="view-shift" class="view hidden">
      <div class="view-head"><h2>الوردية والإغلاق</h2></div>
      <div class="stats" id="shiftStats"></div>
      <div class="panel">
        <p class="hint">الإغلاق يصفّر عدّادات الوردية ويحفظ ملخّصها في التقارير.</p>
        <button class="btn primary" data-action="closeShift">🔒 إغلاق الوردية الآن</button>
      </div>
      <div class="panel"><h3>ورديات سابقة</h3><table class="tbl" id="shiftsTable"></table></div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportSalesCsv">⬇️ المبيعات CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>مبيعات آخر ٧ أيام</h3><div id="salesChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم المتجر</label><input id="stName">
        <label>العملة</label><input id="stCurrency">
        <label>كلمة المرور الحالية</label><input id="stPassCur" type="password" placeholder="مطلوبة لتغيير كلمة المرور">
        <label>كلمة المرور الجديدة</label><input id="stPass" type="password" placeholder="اتركها فارغة للإبقاء">
        <button class="btn primary" data-action="saveSettings">حفظ الإعدادات</button>
      </div>
    </section>
  </main>
  <div id="printArea" class="print-only"></div>
  <div id="toast" class="toast no-print hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 🧾 نظام نقطة البيع — jaola-pos */
const SEED_PRODUCTS = [
  { id: 'p1', name: 'قهوة', price: 12, emoji: '☕' },
  { id: 'p2', name: 'شاي', price: 8, emoji: '🍵' },
  { id: 'p3', name: 'عصير', price: 15, emoji: '🥤' },
  { id: 'p4', name: 'ماء', price: 3, emoji: '💧' },
  { id: 'p5', name: 'كيك', price: 18, emoji: '🍰' },
  { id: 'p6', name: 'ساندويتش', price: 22, emoji: '🥪' }
];
const ROLES = {
  manager: { name: 'المدير', tabs: ['pos', 'products', 'shift', 'reports', 'settings'] },
  cashier: { name: 'الكاشير', tabs: ['pos', 'shift'] }
};
const TAB_LABELS = { pos: 'البيع', products: 'المنتجات', shift: 'الوردية', reports: 'التقارير', settings: 'الإعدادات' };

function load(k, fb) { try { var v = localStorage.getItem('jpos_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jpos_' + k, JSON.stringify(val)); } catch (e) {} }
let products = load('products', SEED_PRODUCTS);
let sales = load('sales', []);
let shifts = load('shifts', []);
let settings = load('settings', { name: 'متجر jaola', currency: 'ر.س', pass: 'admin', receiptSeq: 1 });
let state = { user: null, view: 'login', cart: [] };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2200); }
function prodById(id) { for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i]; return null; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'pos') renderPos();
  if (v === 'products') renderProducts();
  if (v === 'shift') renderShift();
  if (v === 'reports') renderReports();
  if (v === 'settings') renderSettings();
}
function renderTabs() {
  var el = byId('tabs');
  if (!state.user) { el.innerHTML = ''; byId('userChip').innerHTML = ''; return; }
  el.innerHTML = ROLES[state.user.role].tabs.map(function (id) {
    return '<button class="tab ' + (state.view === id ? 'active' : '') + '" data-action="tab" data-view="' + id + '">' + TAB_LABELS[id] + '</button>';
  }).join('');
  byId('userChip').innerHTML = '👤 ' + ROLES[state.user.role].name + ' <button class="btn tiny ghost" data-action="logout">خروج</button>';
}
function login() {
  var role = byId('loginRole').value; var pass = byId('loginPass').value;
  function onOk() { show(byId('loginErr'), false); state.user = { role: role }; toast('مرحباً ' + ROLES[role].name); setView('pos'); }
  function onFail() { show(byId('loginErr'), true); }
  var sync = window.JAOLA_SYNC;
  if (!sync) { if (pass !== settings.pass) return onFail(); return onOk(); }
  fetch(sync.api + '/api/public/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: pass }) })
    .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) onOk(); else onFail(); }).catch(onFail);
}
function logout() { state.user = null; state.cart = []; setView('login'); }

/* ---------- شاشة البيع ---------- */
function renderPos() {
  byId('posProducts').innerHTML = products.map(function (p) {
    return '<button class="pos-item" data-action="addToCart" data-id="' + p.id + '">' +
      '<span class="pos-emoji">' + (p.emoji || '🛒') + '</span>' +
      '<span class="pos-name">' + esc(p.name) + '</span>' +
      '<span class="pos-price">' + money(p.price) + '</span></button>';
  }).join('');
  renderCart();
}
function renderCart() {
  var total = 0;
  byId('cartLines').innerHTML = state.cart.length ? state.cart.map(function (l, i) {
    var line = l.qty * l.price; total += line;
    return '<div class="cart-line"><span class="cl-name">' + esc(l.name) + '</span>' +
      '<span class="cl-ctrl"><button class="btn tiny ghost" data-action="decCart" data-idx="' + i + '">−</button>' +
      '<span class="cl-qty">' + l.qty + '</span>' +
      '<button class="btn tiny ghost" data-action="incCart" data-idx="' + i + '">+</button></span>' +
      '<span class="cl-sum">' + money(line) + '</span></div>';
  }).join('') : '<p class="hint" style="padding:16px 4px">اضغط منتجاً لإضافته للسلة.</p>';
  byId('cartTotal').textContent = money(total);
}
function addToCart(id) {
  var p = prodById(id); if (!p) return;
  for (var i = 0; i < state.cart.length; i++) if (state.cart[i].pid === id) { state.cart[i].qty++; renderCart(); return; }
  state.cart.push({ pid: id, name: p.name, price: p.price, qty: 1 }); renderCart();
}
function incCart(i) { state.cart[i].qty++; renderCart(); }
function decCart(i) { state.cart[i].qty--; if (state.cart[i].qty <= 0) state.cart.splice(i, 1); renderCart(); }
function clearCart() { state.cart = []; renderCart(); }
function cartTotal() { var t = 0; for (var i = 0; i < state.cart.length; i++) t += state.cart[i].qty * state.cart[i].price; return t; }
function pay(method) {
  if (!state.cart.length) { toast('السلة فارغة'); return; }
  var sale = { id: uid('s'), no: settings.receiptSeq++, items: state.cart.slice(), total: cartTotal(), method: method, date: today(), ts: Date.now(), cashier: state.user.role };
  sales.push(sale); save('sales', sales); save('settings', settings);
  printReceipt(sale);
  state.cart = []; renderCart();
  toast('تم البيع #' + sale.no + ' (' + (method === 'cash' ? 'نقدي' : 'شبكة') + ')');
}
function printReceipt(sale) {
  var rows = sale.items.map(function (l) {
    return '<div class="r-row"><span>' + esc(l.name) + ' ×' + l.qty + '</span><span>' + money(l.qty * l.price) + '</span></div>';
  }).join('');
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>إيصال #' + sale.no + '</span><span>' + sale.date + '</span></div><hr>' +
    rows + '<hr>' +
    '<div class="r-row"><b>الإجمالي</b><b>' + money(sale.total) + '</b></div>' +
    '<div class="r-row"><span>طريقة الدفع</span><span>' + (sale.method === 'cash' ? 'نقدي' : 'شبكة') + '</span></div><hr>' +
    '<p style="text-align:center">شكراً لزيارتكم 🙏</p></div>';
  window.print();
}

/* ---------- المنتجات ---------- */
function renderProducts() {
  var rows = products.map(function (p) {
    return '<tr><td>' + (p.emoji || '🛒') + ' ' + esc(p.name) + '</td><td>' + money(p.price) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delProduct" data-id="' + p.id + '">حذف</button></td></tr>';
  }).join('');
  byId('productsTable').innerHTML = '<tr><th>المنتج</th><th>السعر</th><th></th></tr>' +
    (rows || '<tr><td colspan="3" class="hint">لا منتجات بعد.</td></tr>');
}
function addProduct() {
  var name = byId('prName').value.trim(); if (!name) { toast('اكتب اسم المنتج'); return; }
  products.push({ id: uid('p'), name: name, price: Math.max(0, parseFloat(byId('prPrice').value) || 0), emoji: byId('prEmoji').value.trim() });
  save('products', products); byId('prName').value = ''; byId('prPrice').value = ''; byId('prEmoji').value = '';
  toast('أُضيف المنتج'); renderProducts();
}
function delProduct(id) { products = products.filter(function (p) { return p.id !== id; }); save('products', products); renderProducts(); }

/* ---------- الوردية ---------- */
function lastShiftTs() { return shifts.length ? shifts[shifts.length - 1].closedAt : 0; }
function currentShiftSales() { var since = lastShiftTs(); return sales.filter(function (s) { return s.ts > since; }); }
function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderShift() {
  var cur = currentShiftSales();
  var cash = 0, card = 0;
  for (var i = 0; i < cur.length; i++) { if (cur[i].method === 'cash') cash += cur[i].total; else card += cur[i].total; }
  byId('shiftStats').innerHTML =
    statCard('فواتير الوردية', String(cur.length), '') +
    statCard('تحصيل نقدي', money(cash), 'ok') +
    statCard('تحصيل شبكة', money(card), 'ok') +
    statCard('إجمالي الوردية', money(cash + card), 'ok');
  var rows = shifts.slice().reverse().slice(0, 30).map(function (sh) {
    return '<tr><td>' + new Date(sh.closedAt).toLocaleString('ar-EG') + '</td><td>' + sh.count + '</td><td>' + money(sh.cash) + '</td><td>' + money(sh.card) + '</td><td>' + money(sh.total) + '</td></tr>';
  }).join('');
  byId('shiftsTable').innerHTML = '<tr><th>وقت الإغلاق</th><th>الفواتير</th><th>نقدي</th><th>شبكة</th><th>الإجمالي</th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا ورديات مغلقة بعد.</td></tr>');
}
function closeShift() {
  var cur = currentShiftSales();
  if (!cur.length) { toast('لا مبيعات في الوردية الحالية'); return; }
  var cash = 0, card = 0;
  for (var i = 0; i < cur.length; i++) { if (cur[i].method === 'cash') cash += cur[i].total; else card += cur[i].total; }
  shifts.push({ id: uid('sh'), closedAt: Date.now(), count: cur.length, cash: cash, card: card, total: cash + card });
  save('shifts', shifts); toast('أُغلقت الوردية — إجمالي ' + money(cash + card)); renderShift();
}

/* ---------- التقارير ---------- */
function renderReports() {
  var t = today(); var todaySales = sales.filter(function (s) { return s.date === t; });
  var todayTotal = 0; for (var i = 0; i < todaySales.length; i++) todayTotal += todaySales[i].total;
  byId('reportStats').innerHTML =
    statCard('فواتير اليوم', String(todaySales.length), '') +
    statCard('مبيعات اليوم', money(todayTotal), 'ok') +
    statCard('إجمالي الفواتير', String(sales.length), '');
  var data = [];
  for (var d = 6; d >= 0; d--) {
    var dt = new Date(); dt.setDate(dt.getDate() - d); var ds = dt.toISOString().slice(0, 10);
    var r = 0; for (var j = 0; j < sales.length; j++) if (sales[j].date === ds) r += sales[j].total;
    data.push({ label: ds.slice(5), value: r });
  }
  byId('salesChart').innerHTML = barChart(data, 150);
}
function barChart(data, h) {
  var max = 1; for (var i = 0; i < data.length; i++) if (data[i].value > max) max = data[i].value;
  var bw = Math.floor(100 / data.length);
  return '<svg viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px">' +
    data.map(function (d, i) {
      var bh = Math.round((d.value / max) * (h - 30)); var x = i * bw;
      return '<g><rect x="' + (x + 2) + '%" y="' + (h - 20 - bh) + '" width="' + (bw - 4) + '%" height="' + bh + '" rx="3" class="bar"></rect>' +
        '<text x="' + (x + bw / 2) + '%" y="' + (h - 6) + '" class="bar-label">' + d.label + '</text></g>';
    }).join('') + '</svg>';
}
function csvDownload(name, rows) {
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function exportSalesCsv() {
  var rows = [['رقم', 'التاريخ', 'الطريقة', 'الإجمالي']];
  for (var i = 0; i < sales.length; i++) rows.push([sales[i].no, sales[i].date, sales[i].method === 'cash' ? 'نقدي' : 'شبكة', sales[i].total]);
  csvDownload('sales.csv', rows); toast('صُدّرت المبيعات CSV');
}

function renderSettings() { byId('stName').value = settings.name; byId('stCurrency').value = settings.currency; byId('stPass').value = ''; byId('stPassCur').value = ''; }
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  settings.currency = byId('stCurrency').value.trim() || settings.currency;
  var np = byId('stPass').value.trim();
  if (np) { var sync = window.JAOLA_SYNC; if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np, currentPassword: byId('stPassCur').value }) }).then(function (r) { if (!r.ok) toast('كلمة المرور الحالية غير صحيحة'); else toast('تم تغيير كلمة المرور'); }).catch(function () {}); } else settings.pass = np; }
  save('settings', settings); byId('brandName').textContent = settings.name; toast('حُفظت الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addToCart': addToCart(a.dataset.id); break;
    case 'incCart': incCart(parseInt(a.dataset.idx, 10)); break;
    case 'decCart': decCart(parseInt(a.dataset.idx, 10)); break;
    case 'clearCart': clearCart(); break;
    case 'payCash': pay('cash'); break;
    case 'payCard': pay('card'); break;
    case 'addProduct': addProduct(); break;
    case 'delProduct': delProduct(a.dataset.id); break;
    case 'closeShift': closeShift(); break;
    case 'exportSalesCsv': exportSalesCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.pos-layout{display:grid;grid-template-columns:1fr 320px;gap:16px}
@media(max-width:820px){.pos-layout{grid-template-columns:1fr}}
.pos-products{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;align-content:start}
.pos-item{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;transition:transform .1s,border-color .1s}
.pos-item:hover{border-color:var(--pri);transform:translateY(-2px)}
.pos-emoji{font-size:30px}
.pos-name{font-size:12px;font-weight:700}
.pos-price{font-size:11px;color:var(--mut)}
.pos-cart{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;position:sticky;top:80px;height:fit-content}
.cart-lines{min-height:120px;max-height:40vh;overflow-y:auto;margin:8px 0}
.cart-line{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(35,38,54,.5)}
.cl-name{flex:1;font-size:12px;font-weight:700}
.cl-ctrl{display:flex;align-items:center;gap:6px}
.cl-qty{min-width:20px;text-align:center;font-weight:800}
.cl-sum{font-size:12px;color:#c7d2fe;min-width:60px;text-align:end}
.cart-total{font-size:24px;font-weight:800;text-align:end;margin:10px 0;color:var(--ok)}
.pay-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
`;

    return {
        id: 'jaola-pos',
        track: 'system',
        category: 'system',
        name: 'نظام نقطة بيع (كاشير)',
        nameEn: 'POS / Cashier',
        description: 'سيستم نقطة بيع داخلي للمحلات والمقاهي: شاشة بيع سريعة بشبكة منتجات وسلة، دفع نقدي/شبكة، طباعة إيصال حراري، إغلاق وردية بتحصيلها، وتقارير مبيعات — بأدوار (مدير/كاشير).',
        descriptionEn: 'Internal point-of-sale system for shops and cafes: fast sell screen with product grid and cart, cash/card payment, thermal receipt printing, shift close with totals, and sales reports — with roles (manager/cashier).',
        keywords: ['نقطة بيع', 'كاشير', 'نقاط بيع', 'محل', 'مقهى', 'كافيه', 'إيصال', 'ايصال', 'فاتورة بيع سريعة', 'وردية', 'تحصيل', 'مبيعات كاشير', 'pos', 'cashier', 'point of sale', 'receipt', 'checkout counter', 'retail', 'till'],
        model: {
            roles: [{ name: 'مدير' }, { name: 'كاشير' }],
            entities: [{ name: 'منتج' }, { name: 'فاتورة بيع' }, { name: 'وردية' }],
            flows: [{ name: 'بيع سريع بسلة ودفع' }, { name: 'طباعة إيصال حراري' }, { name: 'إغلاق وردية بتحصيلها نقدي/شبكة' }, { name: 'تقرير مبيعات يومي' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
