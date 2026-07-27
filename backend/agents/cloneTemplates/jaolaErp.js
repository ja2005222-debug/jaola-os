/**
 * 🏭 jaola-erp — نظام إدارة منشأة داخلي كامل (مصنع/ورشة/مستودع).
 *
 * أول قالب في مسار «السيستم الداخلي» (track: system) — ليس موقعاً للزوار
 * بل أداة عمل يومية للمالك وفريقه: منصرفات، إنتاج يغذّي المخزون، مبيعات
 * بفواتير قابلة للطباعة، تنبيه نفاد، تقارير برسوم SVG صرفة وتصدير CSV.
 * بلا أي اعتماد خارجي (CDN محجوبة لدى شريحة من المستخدمين).
 *
 * الأدوار: مالك (كل شيء) / محاسب (مبيعات+منصرفات+تقارير) / أمين مخزن
 * (مخزون+إنتاج). الحالة في localStorage (jerp_*)، تفويض أحداث data-action.
 */

export function jaolaErp() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام إدارة المنشأة</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🏭</span> <span id="brandName">منشأة jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>

  <main class="no-print">
    <!-- دخول بالأدوار -->
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام إدارة المنشأة</h1>
        <p class="hint">منصرفات · إنتاج · مبيعات وفواتير · مخزون · تقارير — في مكان واحد.</p>
        <label>الدور</label>
        <select id="loginRole">
          <option value="owner">المالك</option>
          <option value="accountant">المحاسب</option>
          <option value="storekeeper">أمين المخزن</option>
        </select>
        <label>كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="login">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin» لكل الأدوار — غيّرها من الإعدادات.</p>
      </div>
    </section>

    <!-- اللوحة -->
    <section id="view-dashboard" class="view hidden">
      <h2>لوحة اليوم</h2>
      <div class="stats" id="dashStats"></div>
      <div class="grid2">
        <div class="panel">
          <h3>مبيعات آخر ٧ أيام</h3>
          <div id="salesChart" class="chart"></div>
        </div>
        <div class="panel">
          <h3>⚠️ تنبيهات المخزون</h3>
          <div id="lowStock"></div>
        </div>
      </div>
    </section>

    <!-- المخزون -->
    <section id="view-inventory" class="view hidden">
      <div class="view-head"><h2>المخزون</h2></div>
      <div class="panel form-row">
        <input id="prName" placeholder="اسم الصنف">
        <input id="prUnit" placeholder="الوحدة (كرتونة/قطعة)">
        <input id="prQty" type="number" placeholder="الكمية" min="0">
        <input id="prCost" type="number" placeholder="التكلفة" min="0" step="0.01">
        <input id="prPrice" type="number" placeholder="سعر البيع" min="0" step="0.01">
        <input id="prMin" type="number" placeholder="حد التنبيه" min="0">
        <button class="btn primary" data-action="addProduct">إضافة صنف</button>
      </div>
      <div class="panel"><table class="tbl" id="productsTable"></table></div>
    </section>

    <!-- الإنتاج -->
    <section id="view-production" class="view hidden">
      <div class="view-head"><h2>الإنتاج</h2></div>
      <div class="panel form-row">
        <select id="pdProduct"></select>
        <input id="pdQty" type="number" placeholder="الكمية المنتجة" min="1">
        <input id="pdNote" placeholder="ملاحظة (خط الإنتاج، الوردية…)">
        <button class="btn primary" data-action="addProduction">تسجيل دفعة إنتاج</button>
      </div>
      <div class="panel"><table class="tbl" id="productionTable"></table></div>
    </section>

    <!-- المبيعات -->
    <section id="view-sales" class="view hidden">
      <div class="view-head"><h2>المبيعات والفواتير</h2></div>
      <div class="panel">
        <h3>فاتورة جديدة</h3>
        <div class="form-row">
          <input id="slCustomer" placeholder="اسم العميل">
          <select id="slProduct"></select>
          <input id="slQty" type="number" placeholder="الكمية" min="1">
          <button class="btn ghost" data-action="addSaleLine">+ أضف البند</button>
        </div>
        <table class="tbl" id="saleLinesTable"></table>
        <div class="sale-foot">
          <span id="saleTotal"></span>
          <button class="btn primary" data-action="saveSale">حفظ الفاتورة</button>
        </div>
      </div>
      <div class="panel"><h3>الفواتير</h3><table class="tbl" id="salesTable"></table></div>
    </section>

    <!-- المنصرفات -->
    <section id="view-expenses" class="view hidden">
      <div class="view-head"><h2>المنصرفات</h2></div>
      <div class="panel form-row">
        <input id="exTitle" placeholder="البيان (كهرباء، رواتب…)">
        <select id="exCat">
          <option>تشغيل</option><option>رواتب</option><option>خامات</option>
          <option>صيانة</option><option>نقل</option><option>أخرى</option>
        </select>
        <input id="exAmount" type="number" placeholder="المبلغ" min="0" step="0.01">
        <button class="btn primary" data-action="addExpense">تسجيل منصرف</button>
      </div>
      <div class="panel"><table class="tbl" id="expensesTable"></table></div>
    </section>

    <!-- التقارير -->
    <section id="view-reports" class="view hidden">
      <div class="view-head">
        <h2>التقارير</h2>
        <div>
          <button class="btn ghost" data-action="exportSalesCsv">⬇️ مبيعات CSV</button>
          <button class="btn ghost" data-action="exportExpensesCsv">⬇️ منصرفات CSV</button>
        </div>
      </div>
      <div class="stats" id="reportStats"></div>
      <div class="panel">
        <h3>الإيراد مقابل المنصرف — آخر ٦ أشهر</h3>
        <div id="reportChart" class="chart"></div>
      </div>
    </section>

    <!-- الإعدادات -->
    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم المنشأة</label><input id="stName">
        <label>العملة</label><input id="stCurrency">
        <label>كلمة المرور الجديدة</label><input id="stPass" type="password" placeholder="اتركها فارغة للإبقاء">
        <button class="btn primary" data-action="saveSettings">حفظ الإعدادات</button>
      </div>
    </section>
  </main>

  <!-- منطقة طباعة الفاتورة -->
  <div id="printArea" class="print-only"></div>

  <div id="toast" class="toast no-print hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 🏭 نظام إدارة المنشأة — jaola-erp */

/* ---------- البيانات الأولية ---------- */
const SEED_PRODUCTS = [
  { id: 'p1', name: 'المنتج الأول', unit: 'كرتونة', qty: 120, cost: 18, price: 30, min: 30 },
  { id: 'p2', name: 'المنتج الثاني', unit: 'كرتونة', qty: 45, cost: 10, price: 18, min: 50 },
  { id: 'p3', name: 'المنتج الثالث', unit: 'قطعة', qty: 300, cost: 3.5, price: 7, min: 100 }
];
const ROLES = {
  owner: { name: 'المالك', tabs: ['dashboard', 'inventory', 'production', 'sales', 'expenses', 'reports', 'settings'] },
  accountant: { name: 'المحاسب', tabs: ['dashboard', 'sales', 'expenses', 'reports'] },
  storekeeper: { name: 'أمين المخزن', tabs: ['dashboard', 'inventory', 'production'] }
};
const TAB_LABELS = {
  dashboard: 'اللوحة', inventory: 'المخزون', production: 'الإنتاج',
  sales: 'المبيعات', expenses: 'المنصرفات', reports: 'التقارير', settings: 'الإعدادات'
};

/* ---------- الحالة ---------- */
function load(key, fb) { try { var v = localStorage.getItem('jerp_' + key); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(key, val) { try { localStorage.setItem('jerp_' + key, JSON.stringify(val)); } catch (e) {} }

let products = load('products', SEED_PRODUCTS);
let sales = load('sales', []);
let expenses = load('expenses', []);
let production = load('production', []);
let settings = load('settings', { name: 'منشأة jaola', currency: 'ر.س', pass: 'admin', invoiceSeq: 1 });
let state = { user: null, view: 'login', saleLines: [] };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(msg) {
  var t = byId('toast'); t.textContent = msg; show(t, true);
  clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2600);
}
function productById(id) { for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i]; return null; }

/* ---------- التنقل والأدوار ---------- */
function setView(v) {
  state.view = v;
  var views = document.querySelectorAll('.view');
  for (var i = 0; i < views.length; i++) show(views[i], false);
  show(byId('view-' + v), true);
  renderTabs();
  if (v === 'dashboard') renderDashboard();
  if (v === 'inventory') renderInventory();
  if (v === 'production') renderProduction();
  if (v === 'sales') renderSales();
  if (v === 'expenses') renderExpenses();
  if (v === 'reports') renderReports();
  if (v === 'settings') renderSettings();
}
function renderTabs() {
  var el = byId('tabs');
  if (!state.user) { el.innerHTML = ''; byId('userChip').innerHTML = ''; return; }
  var tabs = ROLES[state.user.role].tabs;
  el.innerHTML = tabs.map(function (tId) {
    return '<button class="tab ' + (state.view === tId ? 'active' : '') + '" data-action="tab" data-view="' + tId + '">' + TAB_LABELS[tId] + '</button>';
  }).join('');
  byId('userChip').innerHTML = '👤 ' + ROLES[state.user.role].name +
    ' <button class="btn tiny ghost" data-action="logout">خروج</button>';
}
function login() {
  var role = byId('loginRole').value;
  var pass = byId('loginPass').value;
  if (pass !== settings.pass) { show(byId('loginErr'), true); return; }
  show(byId('loginErr'), false);
  state.user = { role: role };
  toast('مرحباً ' + ROLES[role].name);
  setView('dashboard');
}
function logout() { state.user = null; setView('login'); }

/* ---------- اللوحة ---------- */
function sumOn(list, dateStr) {
  var s = 0; for (var i = 0; i < list.length; i++) if (list[i].date === dateStr) s += list[i].total || list[i].amount || 0;
  return s;
}
function statCard(label, value, tone) {
  return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + value + '</span><span class="stat-l">' + label + '</span></div>';
}
function renderDashboard() {
  var t = today();
  var month = t.slice(0, 7);
  var mSales = 0, mExp = 0;
  for (var i = 0; i < sales.length; i++) if (sales[i].date.slice(0, 7) === month) mSales += sales[i].total;
  for (var j = 0; j < expenses.length; j++) if (expenses[j].date.slice(0, 7) === month) mExp += expenses[j].amount;
  byId('dashStats').innerHTML =
    statCard('مبيعات اليوم', money(sumOn(sales, t)), 'ok') +
    statCard('منصرفات اليوم', money(sumOn(expenses, t)), 'warn') +
    statCard('مبيعات الشهر', money(mSales), 'ok') +
    statCard('ربح الشهر التقريبي', money(mSales - mExp), mSales - mExp >= 0 ? 'ok' : 'bad') +
    statCard('أصناف المخزون', String(products.length), '');
  byId('salesChart').innerHTML = barChart(last7DaysSales(), 150);
  var lows = products.filter(function (p) { return p.qty <= p.min; });
  byId('lowStock').innerHTML = lows.length
    ? lows.map(function (p) { return '<div class="low-row">⚠️ <b>' + esc(p.name) + '</b> — المتبقي ' + p.qty + ' ' + esc(p.unit) + ' (الحد ' + p.min + ')</div>'; }).join('')
    : '<p class="hint">لا تنبيهات — المخزون فوق حدود الأمان ✅</p>';
}
function last7DaysSales() {
  var out = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(); d.setDate(d.getDate() - i);
    var ds = d.toISOString().slice(0, 10);
    out.push({ label: ds.slice(5), value: sumOn(sales, ds) });
  }
  return out;
}
/* رسم أعمدة SVG صرف — بلا أي مكتبة خارجية */
function barChart(data, height) {
  var max = 1; for (var i = 0; i < data.length; i++) if (data[i].value > max) max = data[i].value;
  var bw = Math.floor(100 / data.length);
  var bars = data.map(function (d, idx) {
    var h = Math.round((d.value / max) * (height - 30));
    var x = idx * bw;
    return '<g><rect x="' + (x + 2) + '%" y="' + (height - 20 - h) + '" width="' + (bw - 4) + '%" height="' + h + '" rx="3" class="bar"></rect>' +
      '<text x="' + (x + bw / 2) + '%" y="' + (height - 6) + '" class="bar-label">' + d.label + '</text></g>';
  }).join('');
  return '<svg viewBox="0 0 100 ' + height + '" preserveAspectRatio="none" style="width:100%;height:' + height + 'px">' + bars + '</svg>';
}

/* ---------- المخزون ---------- */
function renderInventory() {
  var rows = products.map(function (p) {
    return '<tr class="' + (p.qty <= p.min ? 'row-low' : '') + '"><td>' + esc(p.name) + '</td><td>' + esc(p.unit) + '</td>' +
      '<td>' + p.qty + '</td><td>' + money(p.cost) + '</td><td>' + money(p.price) + '</td><td>' + p.min + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delProduct" data-id="' + p.id + '">حذف</button></td></tr>';
  }).join('');
  byId('productsTable').innerHTML =
    '<tr><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>التكلفة</th><th>السعر</th><th>حد التنبيه</th><th></th></tr>' +
    (rows || '<tr><td colspan="7" class="hint">لا أصناف بعد — أضف أول صنف من الأعلى.</td></tr>');
  fillProductSelects();
}
function addProduct() {
  var name = byId('prName').value.trim();
  if (!name) { toast('اكتب اسم الصنف'); return; }
  products.push({
    id: uid('p'), name: name,
    unit: byId('prUnit').value.trim() || 'وحدة',
    qty: Math.max(0, parseInt(byId('prQty').value, 10) || 0),
    cost: Math.max(0, parseFloat(byId('prCost').value) || 0),
    price: Math.max(0, parseFloat(byId('prPrice').value) || 0),
    min: Math.max(0, parseInt(byId('prMin').value, 10) || 0)
  });
  save('products', products);
  byId('prName').value = ''; byId('prQty').value = ''; byId('prCost').value = ''; byId('prPrice').value = ''; byId('prMin').value = '';
  toast('أُضيف الصنف'); renderInventory();
}
function delProduct(id) {
  products = products.filter(function (p) { return p.id !== id; });
  save('products', products); toast('حُذف الصنف'); renderInventory();
}
function fillProductSelects() {
  var opts = products.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + ' (متاح: ' + p.qty + ')</option>'; }).join('');
  var pd = byId('pdProduct'); if (pd) pd.innerHTML = opts;
  var sl = byId('slProduct'); if (sl) sl.innerHTML = opts;
}

/* ---------- الإنتاج ---------- */
function renderProduction() {
  fillProductSelects();
  var rows = production.slice().reverse().slice(0, 50).map(function (b) {
    var p = productById(b.pid);
    return '<tr><td>' + b.date + '</td><td>' + esc(p ? p.name : '؟') + '</td><td>+' + b.qty + '</td><td>' + esc(b.note || '—') + '</td></tr>';
  }).join('');
  byId('productionTable').innerHTML =
    '<tr><th>التاريخ</th><th>الصنف</th><th>الكمية</th><th>ملاحظة</th></tr>' +
    (rows || '<tr><td colspan="4" class="hint">لا دفعات إنتاج بعد.</td></tr>');
}
function addProduction() {
  var pid = byId('pdProduct').value;
  var qty = parseInt(byId('pdQty').value, 10) || 0;
  var p = productById(pid);
  if (!p || qty < 1) { toast('اختر الصنف والكمية'); return; }
  p.qty += qty;
  production.push({ id: uid('b'), pid: pid, qty: qty, note: byId('pdNote').value.trim(), date: today() });
  save('products', products); save('production', production);
  byId('pdQty').value = ''; byId('pdNote').value = '';
  toast('سُجّلت دفعة الإنتاج (+' + qty + ')'); renderProduction();
}

/* ---------- المبيعات والفواتير ---------- */
function renderSales() {
  fillProductSelects();
  renderSaleLines();
  var rows = sales.slice().reverse().slice(0, 60).map(function (s) {
    return '<tr><td>#' + s.no + '</td><td>' + s.date + '</td><td>' + esc(s.customer || 'عميل نقدي') + '</td>' +
      '<td>' + s.items.length + ' بند</td><td>' + money(s.total) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="printSale" data-id="' + s.id + '">🖨️ طباعة</button></td></tr>';
  }).join('');
  byId('salesTable').innerHTML =
    '<tr><th>رقم</th><th>التاريخ</th><th>العميل</th><th>البنود</th><th>الإجمالي</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا فواتير بعد.</td></tr>');
}
function renderSaleLines() {
  var total = 0;
  var rows = state.saleLines.map(function (l, i) {
    var line = l.qty * l.price; total += line;
    return '<tr><td>' + esc(l.name) + '</td><td>' + l.qty + '</td><td>' + money(l.price) + '</td><td>' + money(line) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delSaleLine" data-idx="' + i + '">×</button></td></tr>';
  }).join('');
  byId('saleLinesTable').innerHTML = state.saleLines.length
    ? '<tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>' + rows
    : '';
  byId('saleTotal').textContent = state.saleLines.length ? 'الإجمالي: ' + money(total) : '';
}
function addSaleLine() {
  var pid = byId('slProduct').value;
  var qty = parseInt(byId('slQty').value, 10) || 0;
  var p = productById(pid);
  if (!p || qty < 1) { toast('اختر الصنف والكمية'); return; }
  var already = 0;
  for (var i = 0; i < state.saleLines.length; i++) if (state.saleLines[i].pid === pid) already += state.saleLines[i].qty;
  if (qty + already > p.qty) { toast('الكمية أكبر من المتاح (' + (p.qty - already) + ')'); return; }
  state.saleLines.push({ pid: pid, name: p.name, qty: qty, price: p.price });
  byId('slQty').value = '';
  renderSaleLines();
}
function delSaleLine(idx) { state.saleLines.splice(idx, 1); renderSaleLines(); }
function saveSale() {
  if (!state.saleLines.length) { toast('أضف بنداً واحداً على الأقل'); return; }
  var total = 0;
  for (var i = 0; i < state.saleLines.length; i++) {
    var l = state.saleLines[i];
    var p = productById(l.pid);
    if (!p || l.qty > p.qty) { toast('الكمية لم تعد متاحة: ' + l.name); return; }
    total += l.qty * l.price;
  }
  for (var j = 0; j < state.saleLines.length; j++) productById(state.saleLines[j].pid).qty -= state.saleLines[j].qty;
  var inv = {
    id: uid('s'), no: settings.invoiceSeq++, customer: byId('slCustomer').value.trim(),
    items: state.saleLines.slice(), total: total, date: today()
  };
  sales.push(inv);
  state.saleLines = [];
  byId('slCustomer').value = '';
  save('sales', sales); save('products', products); save('settings', settings);
  toast('حُفظت الفاتورة #' + inv.no);
  renderSales();
}
function printSale(id) {
  var s = null; for (var i = 0; i < sales.length; i++) if (sales[i].id === id) s = sales[i];
  if (!s) return;
  var rows = s.items.map(function (l) {
    return '<tr><td>' + esc(l.name) + '</td><td>' + l.qty + '</td><td>' + money(l.price) + '</td><td>' + money(l.qty * l.price) + '</td></tr>';
  }).join('');
  byId('printArea').innerHTML =
    '<div class="inv"><h1>' + esc(settings.name) + '</h1>' +
    '<div class="inv-meta"><span>فاتورة #' + s.no + '</span><span>' + s.date + '</span><span>العميل: ' + esc(s.customer || 'عميل نقدي') + '</span></div>' +
    '<table><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>' + rows + '</table>' +
    '<p class="inv-total">الإجمالي: ' + money(s.total) + '</p>' +
    '<p class="inv-foot">شكراً لتعاملكم معنا</p></div>';
  window.print();
}

/* ---------- المنصرفات ---------- */
function renderExpenses() {
  var rows = expenses.slice().reverse().slice(0, 60).map(function (x) {
    return '<tr><td>' + x.date + '</td><td>' + esc(x.title) + '</td><td>' + esc(x.cat) + '</td><td>' + money(x.amount) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delExpense" data-id="' + x.id + '">حذف</button></td></tr>';
  }).join('');
  byId('expensesTable').innerHTML =
    '<tr><th>التاريخ</th><th>البيان</th><th>الفئة</th><th>المبلغ</th><th></th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا منصرفات مسجّلة.</td></tr>');
}
function addExpense() {
  var title = byId('exTitle').value.trim();
  var amount = parseFloat(byId('exAmount').value) || 0;
  if (!title || amount <= 0) { toast('اكتب البيان والمبلغ'); return; }
  expenses.push({ id: uid('x'), title: title, cat: byId('exCat').value, amount: amount, date: today() });
  save('expenses', expenses);
  byId('exTitle').value = ''; byId('exAmount').value = '';
  toast('سُجّل المنصرف'); renderExpenses();
}
function delExpense(id) {
  expenses = expenses.filter(function (x) { return x.id !== id; });
  save('expenses', expenses); renderExpenses();
}

/* ---------- التقارير ---------- */
function monthKeyList(n) {
  var out = [];
  for (var i = n - 1; i >= 0; i--) {
    var d = new Date(); d.setMonth(d.getMonth() - i);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}
function renderReports() {
  var months = monthKeyList(6);
  var rev = {}, exp = {};
  for (var i = 0; i < sales.length; i++) { var mk = sales[i].date.slice(0, 7); rev[mk] = (rev[mk] || 0) + sales[i].total; }
  for (var j = 0; j < expenses.length; j++) { var mk2 = expenses[j].date.slice(0, 7); exp[mk2] = (exp[mk2] || 0) + expenses[j].amount; }
  var thisM = months[months.length - 1];
  byId('reportStats').innerHTML =
    statCard('إيراد الشهر', money(rev[thisM] || 0), 'ok') +
    statCard('منصرف الشهر', money(exp[thisM] || 0), 'warn') +
    statCard('صافي الشهر', money((rev[thisM] || 0) - (exp[thisM] || 0)), (rev[thisM] || 0) - (exp[thisM] || 0) >= 0 ? 'ok' : 'bad') +
    statCard('عدد الفواتير', String(sales.length), '');
  var data = [];
  for (var k = 0; k < months.length; k++) {
    data.push({ label: months[k].slice(2), value: rev[months[k]] || 0 });
    data.push({ label: '−', value: exp[months[k]] || 0 });
  }
  byId('reportChart').innerHTML = barChart(data, 180);
}
function csvDownload(name, rows) {
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}
function exportSalesCsv() {
  var rows = [['رقم', 'التاريخ', 'العميل', 'الإجمالي']];
  for (var i = 0; i < sales.length; i++) rows.push([sales[i].no, sales[i].date, sales[i].customer || 'عميل نقدي', sales[i].total]);
  csvDownload('sales.csv', rows); toast('صُدّرت المبيعات CSV');
}
function exportExpensesCsv() {
  var rows = [['التاريخ', 'البيان', 'الفئة', 'المبلغ']];
  for (var i = 0; i < expenses.length; i++) rows.push([expenses[i].date, expenses[i].title, expenses[i].cat, expenses[i].amount]);
  csvDownload('expenses.csv', rows); toast('صُدّرت المنصرفات CSV');
}

/* ---------- الإعدادات ---------- */
function renderSettings() {
  byId('stName').value = settings.name;
  byId('stCurrency').value = settings.currency;
  byId('stPass').value = '';
}
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  settings.currency = byId('stCurrency').value.trim() || settings.currency;
  var np = byId('stPass').value.trim();
  if (np) settings.pass = np;
  save('settings', settings);
  byId('brandName').textContent = settings.name;
  toast('حُفظت الإعدادات');
}

/* ---------- التفويض ---------- */
function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addProduct': addProduct(); break;
    case 'delProduct': delProduct(a.dataset.id); break;
    case 'addProduction': addProduction(); break;
    case 'addSaleLine': addSaleLine(); break;
    case 'delSaleLine': delSaleLine(parseInt(a.dataset.idx, 10)); break;
    case 'saveSale': saveSale(); break;
    case 'printSale': printSale(a.dataset.id); break;
    case 'addExpense': addExpense(); break;
    case 'delExpense': delExpense(a.dataset.id); break;
    case 'exportSalesCsv': exportSalesCsv(); break;
    case 'exportExpensesCsv': exportExpensesCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() {
  byId('brandName').textContent = settings.name;
  document.addEventListener('click', handleClick);
  setView('login');
}
document.addEventListener('DOMContentLoaded', init);
`;

    const STYLES = `:root{--bg:#0b0c14;--panel:#12141f;--line:#232636;--txt:#e7e9f2;--mut:#8b90a5;--pri:#6366f1;--ok:#22c55e;--warn:#f59e0b;--bad:#ef4444}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:system-ui,'Segoe UI',Tahoma,sans-serif;min-height:100vh}
.topbar{display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--line);background:rgba(18,20,31,.9);position:sticky;top:0;z-index:10}
.brand{font-weight:800;font-size:16px;display:flex;align-items:center;gap:8px}
.mk{font-size:20px}
.tabs{display:flex;gap:4px;flex:1;flex-wrap:wrap}
.tab{background:transparent;border:none;color:var(--mut);padding:8px 13px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700}
.tab.active,.tab:hover{background:rgba(99,102,241,.14);color:#c7d2fe}
.user-chip{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut)}
main{max-width:1080px;margin:0 auto;padding:22px 16px}
h2{font-size:20px;margin-bottom:14px}
h3{font-size:14px;margin-bottom:10px;color:#c7d2fe}
.view-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px}
.hidden{display:none!important}
.hint{color:var(--mut);font-size:12px}
.tiny{font-size:10px}
.err{color:var(--bad);font-size:12px;margin:6px 0}
.login-card{max-width:380px;margin:8vh auto;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:8px}
.login-card h1{font-size:20px}
.login-card label{font-size:12px;color:var(--mut);margin-top:8px}
input,select{background:#0a0e17;border:1px solid var(--line);border-radius:9px;padding:10px 12px;color:var(--txt);font-size:13px;outline:none}
input:focus,select:focus{border-color:var(--pri)}
.btn{border:none;border-radius:9px;padding:10px 16px;font-size:13px;font-weight:800;cursor:pointer}
.btn.primary{background:var(--pri);color:#fff}
.btn.ghost{background:rgba(255,255,255,.05);color:var(--txt);border:1px solid var(--line)}
.btn.tiny{padding:4px 10px;font-size:11px}
.btn.block{width:100%;margin-top:10px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:16px}
.form-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.form-row input,.form-row select{flex:1;min-width:120px}
.form-col{display:flex;flex-direction:column;gap:8px;max-width:420px}
.form-col label{font-size:12px;color:var(--mut)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:4px}
.stat-v{font-size:18px;font-weight:800}
.stat-l{font-size:11px;color:var(--mut)}
.stat.ok .stat-v{color:var(--ok)}
.stat.warn .stat-v{color:var(--warn)}
.stat.bad .stat-v{color:var(--bad)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:760px){.grid2{grid-template-columns:1fr}}
.tbl{width:100%;border-collapse:collapse;font-size:12px}
.tbl th{color:var(--mut);text-align:start;padding:8px 6px;border-bottom:1px solid var(--line);font-size:11px}
.tbl td{padding:8px 6px;border-bottom:1px solid rgba(35,38,54,.5)}
.row-low td{background:rgba(245,158,11,.06)}
.low-row{padding:8px 4px;border-bottom:1px solid rgba(35,38,54,.5);font-size:12px}
.sale-foot{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-weight:800}
.chart .bar{fill:#6366f1}
.chart .bar-label{fill:#8b90a5;font-size:6px;text-anchor:middle}
.toast{position:fixed;bottom:22px;inset-inline-start:50%;transform:translateX(50%);background:#1c1f2e;border:1px solid var(--line);border-radius:10px;padding:10px 18px;font-size:13px;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.4)}
/* الطباعة: الفاتورة وحدها */
.print-only{display:none}
@media print{
  .no-print{display:none!important}
  .print-only{display:block}
  body{background:#fff;color:#000}
  .inv{max-width:640px;margin:0 auto;font-family:system-ui,Tahoma,sans-serif}
  .inv h1{font-size:22px;margin-bottom:8px}
  .inv-meta{display:flex;gap:18px;font-size:13px;margin-bottom:14px;color:#333}
  .inv table{width:100%;border-collapse:collapse;font-size:13px}
  .inv th,.inv td{border:1px solid #999;padding:7px 9px;text-align:start}
  .inv-total{margin-top:12px;font-size:16px;font-weight:800;text-align:end}
  .inv-foot{margin-top:20px;text-align:center;color:#555;font-size:12px}
}
`;

    return {
        id: 'jaola-erp',
        track: 'system',
        category: 'system',
        name: 'نظام إدارة منشأة',
        nameEn: 'Facility ERP',
        description: 'سيستم داخلي كامل لمصنع/ورشة/مستودع: منصرفات، إنتاج يغذّي المخزون، مبيعات بفواتير قابلة للطباعة، تنبيه نفاد المخزون، تقارير شهرية وتصدير CSV — بأدوار (مالك/محاسب/أمين مخزن).',
        descriptionEn: 'Complete internal system for a factory/workshop/warehouse: expenses, production feeding inventory, sales with printable invoices, low-stock alerts, monthly reports and CSV export — with roles (owner/accountant/storekeeper).',
        keywords: ['سيستم', 'سيستم داخلي', 'نظام داخلي', 'نظام إدارة', 'نظام ادارة', 'إدارة مصنع', 'ادارة مصنع', 'مصنع', 'منشأة', 'منشاة', 'مستودع', 'ورشة', 'منصرفات', 'مصروفات', 'استوك', 'مخزون', 'جرد', 'فوترة', 'فواتير', 'محاسبة', 'erp', 'inventory', 'invoicing', 'accounting', 'factory', 'warehouse', 'internal system', 'management system'],
        model: {
            roles: [{ name: 'مالك' }, { name: 'محاسب' }, { name: 'أمين مخزن' }],
            entities: [{ name: 'صنف' }, { name: 'منصرف' }, { name: 'دفعة إنتاج' }, { name: 'فاتورة بيع' }],
            flows: [
                { name: 'تسجيل منصرف' }, { name: 'دفعة إنتاج تزيد المخزون' },
                { name: 'فاتورة بيع تنقص المخزون وتُطبع' }, { name: 'تنبيه نفاد المخزون' }, { name: 'تقرير شهري وتصدير CSV' },
            ],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: STYLES },
        ],
    };
}
