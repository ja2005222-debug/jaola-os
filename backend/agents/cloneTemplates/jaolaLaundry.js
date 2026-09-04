/**
 * 🧺 jaola-laundry — نظام مغسلة داخلي (track: system).
 *
 * كتالوج أصناف غسيل بأسعار، طلب غسيل بعدة قطع وحساب إجمالي تلقائي،
 * تتبّع حالة الطلب عبر مراحل (استلام → غسيل → جاهز → تم التسليم)،
 * إيصال استلام وإيصال تسليم قابلان للطباعة، وتقرير إيرادات. أدوار:
 * موظف استقبال / مشغّل مغسلة. بلا اعتماد خارجي.
 * الحالة في localStorage (jlndry_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaLaundry() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام إدارة مغسلة</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🧺</span> <span id="brandName">مغسلة jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام إدارة مغسلة</h1>
        <p class="hint">طلبات غسيل بقطع متعددة · تتبّع حالة الطلب · إيصالات قابلة للطباعة · تقرير إيرادات.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="reception">موظف استقبال</option><option value="operator">مشغّل مغسلة</option></select>
        <label>كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="login">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin».</p>
      </div>
    </section>

    <section id="view-dashboard" class="view hidden">
      <h2>لوحة اليوم</h2>
      <div class="stats" id="dashStats"></div>
      <div class="panel"><h3>🔔 طلبات جاهزة للاستلام</h3><div id="readyList"></div></div>
    </section>

    <section id="view-newOrder" class="view hidden">
      <div class="view-head"><h2>طلب غسيل جديد</h2></div>
      <div class="panel form-row">
        <input id="ordCustomer" placeholder="اسم العميل">
        <input id="ordPhone" placeholder="الهاتف">
      </div>
      <div class="panel form-row">
        <select id="garmentSelect"></select>
        <input id="garmentQty" type="number" placeholder="الكمية" min="1" value="1">
        <button class="btn ghost" data-action="addOrderLine">+ أضف قطعة</button>
      </div>
      <div class="panel"><table class="tbl" id="orderLinesTable"></table></div>
      <div class="panel" id="orderTotal"></div>
      <button class="btn primary block" data-action="submitOrder">إنشاء الطلب وطباعة الإيصال</button>
    </section>

    <section id="view-orders" class="view hidden">
      <div class="view-head"><h2>الطلبات</h2></div>
      <div id="ordersBoard"></div>
    </section>

    <section id="view-catalog" class="view hidden">
      <div class="view-head"><h2>كتالوج القطع</h2></div>
      <div class="panel form-row">
        <input id="catName" placeholder="اسم الصنف (قميص/بنطلون...)">
        <input id="catPrice" type="number" placeholder="السعر" min="0">
        <button class="btn primary" data-action="addGarment">إضافة صنف</button>
      </div>
      <div class="panel"><table class="tbl" id="catalogTable"></table></div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportOrdersCsv">⬇️ الطلبات CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>إيراد آخر ٧ أيام</h3><div id="revChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم المغسلة</label><input id="stName">
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

    const APP_JS = `/* 🧺 نظام مغسلة jaola — jaola-laundry */
const SEED_CATALOG = [
  { id: 'g1', name: 'قميص', price: 8 },
  { id: 'g2', name: 'بنطلون', price: 10 },
  { id: 'g3', name: 'بدلة كاملة', price: 35 },
  { id: 'g4', name: 'فستان', price: 25 },
  { id: 'g5', name: 'ستارة', price: 40 }
];
const STAGES = ['received', 'washing', 'ready', 'delivered'];
const STAGE_LABEL = { received: 'تم الاستلام', washing: 'قيد الغسيل', ready: 'جاهز للاستلام', delivered: 'تم التسليم' };

function load(k, fb) { try { var v = localStorage.getItem('jlndry_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jlndry_' + k, JSON.stringify(val)); } catch (e) {} }
let catalog = load('catalog', SEED_CATALOG);
let orders = load('orders', []); // { id, no, customer, phone, lines:[{garmentId,name,price,qty}], total, stage, createdAt }
let settings = load('settings', { name: 'مغسلة jaola', pass: 'admin', currency: 'ر.س', orderSeq: 1 });
let session = load('session', null);
let state = { view: 'login', draftLines: [] };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function garmentById(id) { for (var i = 0; i < catalog.length; i++) if (catalog[i].id === id) return catalog[i]; return null; }
function orderById(id) { for (var i = 0; i < orders.length; i++) if (orders[i].id === id) return orders[i]; return null; }
function roleLabel(r) { return r === 'reception' ? 'موظف استقبال' : 'مشغّل مغسلة'; }

function login() {
  var role = byId('loginRole').value; var pass = byId('loginPass').value;
  function onOk() {
    show(byId('loginErr'), false); session = { role: role }; save('session', session);
    byId('loginPass').value = ''; toast('أهلاً ' + roleLabel(role)); setView('dashboard');
  }
  function onFail() { show(byId('loginErr'), true); }
  var sync = window.JAOLA_SYNC;
  if (!sync) { if (pass !== settings.pass) return onFail(); return onOk(); }
  fetch(sync.api + '/api/public/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: pass }) })
    .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) onOk(); else onFail(); }).catch(onFail);
}
function logout() { session = null; save('session', null); state.draftLines = []; toast('تم الخروج'); setView('login'); }

function setView(v) {
  if (v !== 'login' && !session) v = 'login';
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs(); renderUserChip();
  if (v === 'dashboard') renderDashboard();
  if (v === 'newOrder') renderNewOrder();
  if (v === 'orders') renderOrders();
  if (v === 'catalog') renderCatalog();
  if (v === 'reports') renderReports();
  if (v === 'settings') { byId('stName').value = settings.name; byId('stPass').value = ''; byId('stPassCur').value = ''; }
}
function renderTabs() {
  if (!session) { byId('tabs').innerHTML = ''; return; }
  var tabs = [['dashboard', 'اليوم'], ['newOrder', 'طلب جديد'], ['orders', 'الطلبات'], ['catalog', 'الكتالوج'], ['reports', 'التقارير'], ['settings', 'الإعدادات']];
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
}
function renderUserChip() {
  byId('userChip').innerHTML = session ? '<span>' + esc(roleLabel(session.role)) + '</span> <button class="btn tiny ghost" data-action="logout">خروج</button>' : '';
}

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var today = todayStr();
  var todayOrders = orders.filter(function (o) { return o.createdAt.slice(0, 10) === today; });
  var ready = orders.filter(function (o) { return o.stage === 'ready'; });
  var revToday = todayOrders.reduce(function (s, o) { return s + o.total; }, 0);
  byId('dashStats').innerHTML =
    statCard('طلبات اليوم', String(todayOrders.length), 'ok') +
    statCard('جاهزة للاستلام', String(ready.length), ready.length ? 'warn' : '') +
    statCard('إيراد اليوم', money(revToday), 'ok') +
    statCard('إجمالي الطلبات', String(orders.length), '');
  byId('readyList').innerHTML = ready.length ? ready.map(function (o) {
    return '<div class="panel"><b>#' + o.no + '</b> — ' + esc(o.customer) + ' <span class="hint">(' + o.phone + ')</span> — ' + money(o.total) + '</div>';
  }).join('') : '<p class="hint">لا طلبات جاهزة حالياً.</p>';
}

function fillGarmentSelect() {
  byId('garmentSelect').innerHTML = catalog.map(function (g) { return '<option value="' + g.id + '">' + esc(g.name) + ' — ' + money(g.price) + '</option>'; }).join('') || '<option value="">لا أصناف</option>';
}
function renderNewOrder() {
  fillGarmentSelect(); renderOrderLines();
}
function addOrderLine() {
  var gid = byId('garmentSelect').value; var g = garmentById(gid);
  if (!g) { toast('أضف صنفاً للكتالوج أولاً'); return; }
  var qty = Math.max(1, parseInt(byId('garmentQty').value, 10) || 1);
  state.draftLines.push({ garmentId: g.id, name: g.name, price: g.price, qty: qty });
  byId('garmentQty').value = '1'; renderOrderLines();
}
function delOrderLine(i) { state.draftLines.splice(i, 1); renderOrderLines(); }
function renderOrderLines() {
  var rows = state.draftLines.map(function (l, i) {
    return '<tr><td>' + esc(l.name) + '</td><td>' + l.qty + '</td><td>' + money(l.price) + '</td><td>' + money(l.price * l.qty) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delOrderLine" data-i="' + i + '">حذف</button></td></tr>';
  }).join('');
  byId('orderLinesTable').innerHTML = '<tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr>' + (rows || '<tr><td colspan="5" class="hint">لا قطع بعد.</td></tr>');
  var total = state.draftLines.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
  byId('orderTotal').innerHTML = '<div class="r-row"><span>الإجمالي</span><span>' + money(total) + '</span></div>';
}
function submitOrder() {
  var customer = byId('ordCustomer').value.trim(); var phone = byId('ordPhone').value.trim();
  if (!customer || !phone) { toast('اكتب اسم العميل والهاتف'); return; }
  if (!state.draftLines.length) { toast('أضف قطعة واحدة على الأقل'); return; }
  var total = state.draftLines.reduce(function (s, l) { return s + l.price * l.qty; }, 0);
  var o = { id: uid('ord'), no: settings.orderSeq++, customer: customer, phone: phone, lines: state.draftLines.slice(), total: total, stage: 'received', createdAt: new Date().toISOString() };
  orders.push(o); save('orders', orders); save('settings', settings);
  state.draftLines = []; byId('ordCustomer').value = ''; byId('ordPhone').value = '';
  toast('تم إنشاء الطلب #' + o.no); printReceipt(o.id, 'استلام'); setView('orders');
}
function printReceipt(id, kind) {
  var o = orderById(id); if (!o) return;
  var rows = o.lines.map(function (l) { return '<div class="r-row"><span>' + esc(l.name) + ' × ' + l.qty + '</span><span>' + money(l.price * l.qty) + '</span></div>'; }).join('');
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>إيصال ' + esc(kind) + ' #' + o.no + '</span></div><hr>' +
    '<div class="r-row"><span>العميل</span><span>' + esc(o.customer) + '</span></div>' +
    '<div class="r-row"><span>الهاتف</span><span>' + esc(o.phone) + '</span></div><hr>' +
    rows + '<hr><div class="r-row"><b>الإجمالي</b><b>' + money(o.total) + '</b></div>' +
    '<p style="text-align:center">شكراً لثقتكم 🧺</p></div>';
  window.print();
}

function renderOrders() {
  byId('ordersBoard').innerHTML = orders.length ? orders.slice().reverse().map(function (o) {
    var idx = STAGES.indexOf(o.stage);
    var next = STAGES[idx + 1];
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>#' + o.no + ' — ' + esc(o.customer) + '</b><span class="badge">' + esc(STAGE_LABEL[o.stage]) + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + o.lines.length + ' قطع · ' + money(o.total) + '</div>' +
      (next ? '<button class="btn tiny primary" data-action="advanceStage" data-id="' + o.id + '">التالي: ' + esc(STAGE_LABEL[next]) + '</button> ' : '') +
      '<button class="btn tiny ghost" data-action="printReceiptDeliver" data-id="' + o.id + '">🖨️ إيصال</button></div>';
  }).join('') : '<p class="hint">لا طلبات بعد.</p>';
}
function advanceStage(id) {
  var o = orderById(id); if (!o) return;
  var idx = STAGES.indexOf(o.stage);
  if (idx < STAGES.length - 1) { o.stage = STAGES[idx + 1]; save('orders', orders); toast('الطلب #' + o.no + ' الآن: ' + STAGE_LABEL[o.stage]); }
  if (o.stage === 'delivered') printReceipt(o.id, 'تسليم');
  renderOrders();
}

function renderCatalog() {
  var rows = catalog.map(function (g) { return '<tr><td>' + esc(g.name) + '</td><td>' + money(g.price) + '</td></tr>'; }).join('');
  byId('catalogTable').innerHTML = '<tr><th>الصنف</th><th>السعر</th></tr>' + (rows || '<tr><td colspan="2" class="hint">لا أصناف بعد.</td></tr>');
}
function addGarment() {
  var name = byId('catName').value.trim(); if (!name) { toast('اكتب اسم الصنف'); return; }
  catalog.push({ id: uid('g'), name: name, price: Math.max(0, parseFloat(byId('catPrice').value) || 0) });
  save('catalog', catalog); byId('catName').value = ''; byId('catPrice').value = '';
  toast('أُضيف الصنف'); renderCatalog();
}

function renderReports() {
  var days = [];
  for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  var byDay = {}; days.forEach(function (d) { byDay[d] = 0; });
  var totalRev = 0;
  orders.forEach(function (o) { var d = o.createdAt.slice(0, 10); if (byDay.hasOwnProperty(d)) byDay[d] += o.total; totalRev += o.total; });
  byId('reportStats').innerHTML =
    statCard('إجمالي الطلبات', String(orders.length), '') +
    statCard('إجمالي الإيراد', money(totalRev), 'ok') +
    statCard('أصناف الكتالوج', String(catalog.length), '');
  var max = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([1]));
  byId('revChart').innerHTML = days.map(function (d) {
    var h = Math.round((byDay[d] / max) * 100);
    return '<div class="bar-col"><div class="bar" style="height:' + h + '%" title="' + money(byDay[d]) + '"></div><span class="bar-label">' + d.slice(5) + '</span></div>';
  }).join('');
}
function exportOrdersCsv() {
  var rows = [['#', 'العميل', 'الهاتف', 'القطع', 'الإجمالي', 'الحالة', 'التاريخ']];
  orders.forEach(function (o) { rows.push([o.no, o.customer, o.phone, o.lines.length, o.total, STAGE_LABEL[o.stage], o.createdAt.slice(0, 10)]); });
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'laundry-orders.csv'; a.click();
  toast('صُدّرت الطلبات CSV');
}

function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  var np = byId('stPass').value.trim();
  if (np) { var sync = window.JAOLA_SYNC; if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np, currentPassword: byId('stPassCur').value }) }).then(function (r) { if (!r.ok) toast('كلمة المرور الحالية غير صحيحة'); else toast('تم تغيير كلمة المرور'); }).catch(function () {}); } else settings.pass = np; }
  save('settings', settings); byId('brandName').textContent = settings.name;
  toast('تم حفظ الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addOrderLine': addOrderLine(); break;
    case 'delOrderLine': delOrderLine(parseInt(a.dataset.i, 10)); break;
    case 'submitOrder': submitOrder(); break;
    case 'advanceStage': advanceStage(a.dataset.id); break;
    case 'printReceiptDeliver': printReceipt(a.dataset.id, 'متابعة'); break;
    case 'addGarment': addGarment(); break;
    case 'exportOrdersCsv': exportOrdersCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() {
  byId('brandName').textContent = settings.name;
  document.addEventListener('click', handleClick);
  setView(session ? 'dashboard' : 'login');
}
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.badge{background:#1e293b;border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:11px;color:#c7d2fe}
.bar-col{display:inline-flex;flex-direction:column;align-items:center;gap:6px;width:12%;vertical-align:bottom}
`;

    return {
        id: 'jaola-laundry',
        track: 'system',
        category: 'system',
        name: 'نظام إدارة مغسلة',
        nameEn: 'Laundry Management',
        description: 'سيستم مغسلة داخلي: كتالوج قطع بأسعار، طلب غسيل بعدة قطع وحساب إجمالي تلقائي، تتبّع حالة الطلب عبر مراحل (استلام/غسيل/جاهز/تسليم)، إيصالات استلام وتسليم قابلة للطباعة، وتقرير إيرادات — بأدوار (موظف استقبال/مشغّل مغسلة).',
        descriptionEn: 'Internal laundry system: priced garment catalog, multi-item laundry orders with automatic total calculation, order stage tracking (received/washing/ready/delivered), printable pickup and delivery receipts, and a revenue report — with roles (receptionist/laundry operator).',
        keywords: ['مغسلة', 'مغاسل', 'غسيل ملابس', 'تنظيف جاف', 'كي وغسيل', 'استلام وتسليم غسيل', 'قطع الغسيل', 'حالة الطلب', 'laundry', 'dry cleaning', 'garment', 'laundry order', 'wash and fold'],
        model: {
            roles: [{ name: 'موظف استقبال' }, { name: 'مشغّل مغسلة' }],
            entities: [{ name: 'صنف غسيل' }, { name: 'طلب غسيل' }],
            flows: [{ name: 'استلام طلب غسيل بعدة قطع' }, { name: 'تتبّع حالة الطلب عبر مراحل' }, { name: 'طباعة إيصال الاستلام والتسليم' }, { name: 'تقرير الإيرادات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
