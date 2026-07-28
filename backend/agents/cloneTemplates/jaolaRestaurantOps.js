/**
 * 🍽️ jaola-restaurant-ops — نظام تشغيل مطعم داخلي (track: system).
 *
 * ليس موقع حجز للزوّار — أداة تشغيل: طاولات بحالة، أخذ طلب لكل طاولة،
 * شاشة مطبخ (KDS) بمراحل (جديد → تحضير → جاهز)، إغلاق طاولة بفاتورة
 * مطبوعة، وتقرير مبيعات يومي. أدوار: مدير / نادل / مطبخ.
 * بلا اعتماد خارجي. الحالة في localStorage (jrest_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaRestaurantOps() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام تشغيل المطعم</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🍽️</span> <span id="brandName">مطعم jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام تشغيل المطعم</h1>
        <p class="hint">طاولات · طلبات · شاشة مطبخ · فواتير · تقارير.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="manager">مدير</option><option value="waiter">نادل</option><option value="kitchen">مطبخ</option></select>
        <label>كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="login">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin».</p>
      </div>
    </section>

    <section id="view-tables" class="view hidden">
      <div class="view-head"><h2>الطاولات</h2></div>
      <div id="tablesGrid" class="tables-grid"></div>
    </section>

    <section id="view-order" class="view hidden">
      <div class="view-head"><h2 id="orderTitle">الطلب</h2><button class="btn ghost" data-action="backTables">→ الطاولات</button></div>
      <div class="pos-layout">
        <div class="pos-products" id="menuGrid"></div>
        <div class="pos-cart">
          <h3>طلب الطاولة</h3>
          <div id="orderLines" class="cart-lines"></div>
          <div class="cart-total" id="orderTotal">0</div>
          <button class="btn primary block" data-action="sendKitchen">📨 أرسل للمطبخ</button>
          <button class="btn ghost block" data-action="closeTable">🧾 إغلاق وفاتورة</button>
        </div>
      </div>
    </section>

    <section id="view-kitchen" class="view hidden">
      <div class="view-head"><h2>شاشة المطبخ (KDS)</h2></div>
      <div id="kdsGrid" class="kds-grid"></div>
    </section>

    <section id="view-menu" class="view hidden">
      <div class="view-head"><h2>قائمة الطعام</h2></div>
      <div class="panel form-row">
        <input id="miName" placeholder="اسم الصنف">
        <input id="miPrice" type="number" placeholder="السعر" min="0" step="0.01">
        <input id="miEmoji" placeholder="رمز 🍔" maxlength="2">
        <button class="btn primary" data-action="addMenuItem">إضافة صنف</button>
      </div>
      <div class="panel"><table class="tbl" id="menuTable"></table></div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportBillsCsv">⬇️ الفواتير CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>مبيعات آخر ٧ أيام</h3><div id="salesChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم المطعم</label><input id="stName">
        <label>عدد الطاولات</label><input id="stTables" type="number" min="1" max="60">
        <label>العملة</label><input id="stCurrency">
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

    const APP_JS = `/* 🍽️ نظام تشغيل المطعم — jaola-restaurant-ops */
const SEED_MENU = [
  { id: 'm1', name: 'برجر لحم', price: 32, emoji: '🍔' },
  { id: 'm2', name: 'بيتزا', price: 45, emoji: '🍕' },
  { id: 'm3', name: 'دجاج مشوي', price: 38, emoji: '🍗' },
  { id: 'm4', name: 'سلطة', price: 18, emoji: '🥗' },
  { id: 'm5', name: 'بطاطس', price: 12, emoji: '🍟' },
  { id: 'm6', name: 'مشروب', price: 8, emoji: '🥤' }
];
const ROLES = {
  manager: { name: 'المدير', tabs: ['tables', 'kitchen', 'menu', 'reports', 'settings'] },
  waiter: { name: 'النادل', tabs: ['tables', 'kitchen'] },
  kitchen: { name: 'المطبخ', tabs: ['kitchen'] }
};
const TAB_LABELS = { tables: 'الطاولات', kitchen: 'المطبخ', menu: 'القائمة', reports: 'التقارير', settings: 'الإعدادات' };
const STAGES = { new: 'جديد', preparing: 'تحضير', ready: 'جاهز' };

function load(k, fb) { try { var v = localStorage.getItem('jrest_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jrest_' + k, JSON.stringify(val)); } catch (e) {} }
let menu = load('menu', SEED_MENU);
let orders = load('orders', {}); // tableNo → { lines:[], sentAt }
let tickets = load('tickets', []); // KDS: { id, table, items, stage }
let bills = load('bills', []);
let settings = load('settings', { name: 'مطعم jaola', tables: 8, currency: 'ر.س', pass: 'admin', billSeq: 1 });
let state = { user: null, view: 'login', activeTable: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2200); }
function menuById(id) { for (var i = 0; i < menu.length; i++) if (menu[i].id === id) return menu[i]; return null; }
function orderOf(tbl) { if (!orders[tbl]) orders[tbl] = { lines: [] }; return orders[tbl]; }
function orderTotal(tbl) { var o = orders[tbl]; if (!o) return 0; var t = 0; for (var i = 0; i < o.lines.length; i++) t += o.lines[i].qty * o.lines[i].price; return t; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'tables') renderTables();
  if (v === 'order') renderOrder();
  if (v === 'kitchen') renderKitchen();
  if (v === 'menu') renderMenu();
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
  var role = byId('loginRole').value;
  if (byId('loginPass').value !== settings.pass) { show(byId('loginErr'), true); return; }
  show(byId('loginErr'), false); state.user = { role: role };
  toast('مرحباً ' + ROLES[role].name);
  setView(role === 'kitchen' ? 'kitchen' : 'tables');
}
function logout() { state.user = null; setView('login'); }

/* ---------- الطاولات ---------- */
function renderTables() {
  var html = '';
  for (var i = 1; i <= settings.tables; i++) {
    var busy = orders[i] && orders[i].lines.length;
    html += '<button class="table-cell ' + (busy ? 'busy' : 'free') + '" data-action="openTable" data-table="' + i + '">' +
      '<span class="t-num">طاولة ' + i + '</span>' +
      '<span class="t-state">' + (busy ? money(orderTotal(i)) : 'متاحة') + '</span></button>';
  }
  byId('tablesGrid').innerHTML = html;
}
function openTable(tbl) { state.activeTable = tbl; setView('order'); }
function backTables() { state.activeTable = null; setView('tables'); }

/* ---------- الطلب ---------- */
function renderOrder() {
  var tbl = state.activeTable; if (!tbl) { setView('tables'); return; }
  byId('orderTitle').textContent = 'طلب طاولة ' + tbl;
  byId('menuGrid').innerHTML = menu.map(function (m) {
    return '<button class="pos-item" data-action="addLine" data-id="' + m.id + '">' +
      '<span class="pos-emoji">' + (m.emoji || '🍽️') + '</span><span class="pos-name">' + esc(m.name) + '</span>' +
      '<span class="pos-price">' + money(m.price) + '</span></button>';
  }).join('');
  renderOrderLines();
}
function renderOrderLines() {
  var o = orderOf(state.activeTable);
  byId('orderLines').innerHTML = o.lines.length ? o.lines.map(function (l, i) {
    return '<div class="cart-line"><span class="cl-name">' + esc(l.name) + '</span>' +
      '<span class="cl-ctrl"><button class="btn tiny ghost" data-action="decLine" data-idx="' + i + '">−</button>' +
      '<span class="cl-qty">' + l.qty + '</span>' +
      '<button class="btn tiny ghost" data-action="incLine" data-idx="' + i + '">+</button></span>' +
      '<span class="cl-sum">' + money(l.qty * l.price) + '</span></div>';
  }).join('') : '<p class="hint" style="padding:16px 4px">اضغط صنفاً لإضافته.</p>';
  byId('orderTotal').textContent = money(orderTotal(state.activeTable));
}
function addLine(id) {
  var m = menuById(id); if (!m) return; var o = orderOf(state.activeTable);
  for (var i = 0; i < o.lines.length; i++) if (o.lines[i].mid === id) { o.lines[i].qty++; save('orders', orders); renderOrderLines(); renderTablesIfVisible(); return; }
  o.lines.push({ mid: id, name: m.name, price: m.price, qty: 1 }); save('orders', orders); renderOrderLines();
}
function incLine(i) { var o = orderOf(state.activeTable); o.lines[i].qty++; save('orders', orders); renderOrderLines(); }
function decLine(i) { var o = orderOf(state.activeTable); o.lines[i].qty--; if (o.lines[i].qty <= 0) o.lines.splice(i, 1); save('orders', orders); renderOrderLines(); }
function renderTablesIfVisible() { if (state.view === 'tables') renderTables(); }
function sendKitchen() {
  var o = orderOf(state.activeTable);
  if (!o.lines.length) { toast('الطلب فارغ'); return; }
  tickets.push({ id: uid('t'), table: state.activeTable, items: o.lines.map(function (l) { return { name: l.name, qty: l.qty }; }), stage: 'new', at: Date.now() });
  save('tickets', tickets); toast('أُرسل طلب طاولة ' + state.activeTable + ' للمطبخ');
}
function closeTable() {
  var tbl = state.activeTable; var o = orders[tbl];
  if (!o || !o.lines.length) { toast('لا طلب على هذه الطاولة'); return; }
  var bill = { id: uid('b'), no: settings.billSeq++, table: tbl, items: o.lines.slice(), total: orderTotal(tbl), date: today(), ts: Date.now() };
  bills.push(bill);
  delete orders[tbl];
  tickets = tickets.filter(function (t) { return t.table !== tbl; });
  save('bills', bills); save('orders', orders); save('tickets', tickets); save('settings', settings);
  printBill(bill); toast('أُغلقت طاولة ' + tbl); backTables();
}
function printBill(bill) {
  var rows = bill.items.map(function (l) { return '<div class="r-row"><span>' + esc(l.name) + ' ×' + l.qty + '</span><span>' + money(l.qty * l.price) + '</span></div>'; }).join('');
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>فاتورة #' + bill.no + '</span><span>طاولة ' + bill.table + '</span></div>' +
    '<div class="r-row"><span>' + bill.date + '</span><span></span></div><hr>' + rows + '<hr>' +
    '<div class="r-row"><b>الإجمالي</b><b>' + money(bill.total) + '</b></div><hr>' +
    '<p style="text-align:center">شكراً لزيارتكم 🙏</p></div>';
  window.print();
}

/* ---------- شاشة المطبخ ---------- */
function renderKitchen() {
  var active = tickets.filter(function (t) { return t.stage !== 'ready' || (Date.now() - (t.readyAt || 0) < 90000); });
  byId('kdsGrid').innerHTML = active.length ? active.slice().reverse().map(function (t) {
    var items = t.items.map(function (it) { return '<li>' + it.qty + '× ' + esc(it.name) + '</li>'; }).join('');
    var next = t.stage === 'new' ? 'preparing' : t.stage === 'preparing' ? 'ready' : null;
    var btn = next ? '<button class="btn primary block" data-action="advanceTicket" data-id="' + t.id + '">→ ' + STAGES[next] + '</button>' : '<span class="hint">اكتمل ✅</span>';
    return '<div class="kds-card stage-' + t.stage + '"><div class="kds-head"><b>طاولة ' + t.table + '</b><span class="kds-badge">' + STAGES[t.stage] + '</span></div>' +
      '<ul class="kds-items">' + items + '</ul>' + btn + '</div>';
  }).join('') : '<p class="hint">لا طلبات في المطبخ الآن.</p>';
}
function advanceTicket(id) {
  for (var i = 0; i < tickets.length; i++) if (tickets[i].id === id) {
    tickets[i].stage = tickets[i].stage === 'new' ? 'preparing' : 'ready';
    if (tickets[i].stage === 'ready') tickets[i].readyAt = Date.now();
  }
  save('tickets', tickets); renderKitchen();
}

/* ---------- القائمة ---------- */
function renderMenu() {
  var rows = menu.map(function (m) {
    return '<tr><td>' + (m.emoji || '🍽️') + ' ' + esc(m.name) + '</td><td>' + money(m.price) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delMenuItem" data-id="' + m.id + '">حذف</button></td></tr>';
  }).join('');
  byId('menuTable').innerHTML = '<tr><th>الصنف</th><th>السعر</th><th></th></tr>' +
    (rows || '<tr><td colspan="3" class="hint">لا أصناف بعد.</td></tr>');
}
function addMenuItem() {
  var name = byId('miName').value.trim(); if (!name) { toast('اكتب اسم الصنف'); return; }
  menu.push({ id: uid('m'), name: name, price: Math.max(0, parseFloat(byId('miPrice').value) || 0), emoji: byId('miEmoji').value.trim() });
  save('menu', menu); byId('miName').value = ''; byId('miPrice').value = ''; byId('miEmoji').value = '';
  toast('أُضيف الصنف'); renderMenu();
}
function delMenuItem(id) { menu = menu.filter(function (m) { return m.id !== id; }); save('menu', menu); renderMenu(); }

/* ---------- التقارير ---------- */
function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderReports() {
  var t = today(); var todayBills = bills.filter(function (b) { return b.date === t; });
  var todayTotal = 0; for (var i = 0; i < todayBills.length; i++) todayTotal += todayBills[i].total;
  byId('reportStats').innerHTML =
    statCard('فواتير اليوم', String(todayBills.length), '') +
    statCard('مبيعات اليوم', money(todayTotal), 'ok') +
    statCard('إجمالي الفواتير', String(bills.length), '');
  var data = [];
  for (var d = 6; d >= 0; d--) {
    var dt = new Date(); dt.setDate(dt.getDate() - d); var ds = dt.toISOString().slice(0, 10);
    var r = 0; for (var j = 0; j < bills.length; j++) if (bills[j].date === ds) r += bills[j].total;
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
function exportBillsCsv() {
  var rows = [['رقم', 'التاريخ', 'الطاولة', 'الإجمالي']];
  for (var i = 0; i < bills.length; i++) rows.push([bills[i].no, bills[i].date, bills[i].table, bills[i].total]);
  csvDownload('bills.csv', rows); toast('صُدّرت الفواتير CSV');
}

function renderSettings() { byId('stName').value = settings.name; byId('stTables').value = settings.tables; byId('stCurrency').value = settings.currency; byId('stPass').value = ''; }
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  var tbls = parseInt(byId('stTables').value, 10); if (tbls >= 1 && tbls <= 60) settings.tables = tbls;
  settings.currency = byId('stCurrency').value.trim() || settings.currency;
  var np = byId('stPass').value.trim(); if (np) settings.pass = np;
  save('settings', settings); byId('brandName').textContent = settings.name; toast('حُفظت الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'openTable': openTable(parseInt(a.dataset.table, 10)); break;
    case 'backTables': backTables(); break;
    case 'addLine': addLine(a.dataset.id); break;
    case 'incLine': incLine(parseInt(a.dataset.idx, 10)); break;
    case 'decLine': decLine(parseInt(a.dataset.idx, 10)); break;
    case 'sendKitchen': sendKitchen(); break;
    case 'closeTable': closeTable(); break;
    case 'advanceTicket': advanceTicket(a.dataset.id); break;
    case 'addMenuItem': addMenuItem(); break;
    case 'delMenuItem': delMenuItem(a.dataset.id); break;
    case 'exportBillsCsv': exportBillsCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.tables-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.table-cell{border-radius:14px;padding:22px 10px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;border:1px solid var(--line);font-weight:800;transition:transform .1s}
.table-cell:hover{transform:translateY(-2px)}
.table-cell.free{background:rgba(34,197,94,.06);border-color:rgba(34,197,94,.3)}
.table-cell.busy{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.4)}
.t-num{font-size:14px}.t-state{font-size:12px;color:var(--mut)}
.table-cell.busy .t-state{color:var(--warn)}
.pos-layout{display:grid;grid-template-columns:1fr 320px;gap:16px}
@media(max-width:820px){.pos-layout{grid-template-columns:1fr}}
.pos-products{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;align-content:start}
.pos-item{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;transition:transform .1s,border-color .1s}
.pos-item:hover{border-color:var(--pri);transform:translateY(-2px)}
.pos-emoji{font-size:30px}.pos-name{font-size:12px;font-weight:700}.pos-price{font-size:11px;color:var(--mut)}
.pos-cart{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;position:sticky;top:80px;height:fit-content}
.cart-lines{min-height:120px;max-height:40vh;overflow-y:auto;margin:8px 0}
.cart-line{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(35,38,54,.5)}
.cl-name{flex:1;font-size:12px;font-weight:700}.cl-ctrl{display:flex;align-items:center;gap:6px}
.cl-qty{min-width:20px;text-align:center;font-weight:800}.cl-sum{font-size:12px;color:#c7d2fe;min-width:60px;text-align:end}
.cart-total{font-size:24px;font-weight:800;text-align:end;margin:10px 0;color:var(--ok)}
.kds-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.kds-card{border-radius:14px;padding:14px;border:1px solid var(--line);background:var(--panel)}
.kds-card.stage-new{border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.05)}
.kds-card.stage-preparing{border-color:rgba(245,158,11,.5);background:rgba(245,158,11,.05)}
.kds-card.stage-ready{border-color:rgba(34,197,94,.5);background:rgba(34,197,94,.05)}
.kds-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.kds-badge{font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.08)}
.kds-items{margin:0 18px 12px;font-size:13px;line-height:1.8}
`;

    return {
        id: 'jaola-restaurant-ops',
        track: 'system',
        category: 'system',
        name: 'نظام تشغيل مطعم',
        nameEn: 'Restaurant Ops',
        description: 'سيستم تشغيل مطعم داخلي (لا موقع حجز): طاولات بحالة، أخذ طلب لكل طاولة، شاشة مطبخ KDS بمراحل (جديد/تحضير/جاهز)، إغلاق طاولة بفاتورة مطبوعة، وتقارير مبيعات — بأدوار (مدير/نادل/مطبخ).',
        descriptionEn: 'Internal restaurant operations system (not a booking site): live table states, per-table order taking, kitchen display (KDS) with stages, table close with printed bill, and sales reports — with roles (manager/waiter/kitchen).',
        keywords: ['تشغيل مطعم', 'إدارة مطعم', 'ادارة مطعم', 'طاولات', 'شاشة مطبخ', 'مطبخ', 'كي دي اس', 'نادل', 'طلبات المطعم', 'كاشير مطعم', 'نظام مطعم داخلي', 'kds', 'restaurant ops', 'kitchen display', 'waiter', 'table management', 'pos restaurant'],
        model: {
            roles: [{ name: 'مدير' }, { name: 'نادل' }, { name: 'مطبخ' }],
            entities: [{ name: 'طاولة' }, { name: 'صنف قائمة' }, { name: 'طلب مطبخ' }, { name: 'فاتورة طاولة' }],
            flows: [{ name: 'أخذ طلب لكل طاولة' }, { name: 'إرسال الطلب لشاشة المطبخ KDS' }, { name: 'تقدّم الطلب: جديد ← تحضير ← جاهز' }, { name: 'إغلاق الطاولة بفاتورة مطبوعة' }, { name: 'تقرير مبيعات يومي' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
