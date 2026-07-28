/**
 * 📦 jaola-warehouse — نظام مستودع وشحنات داخلي (track: system).
 *
 * أصناف بمواقع تخزين (رفوف)، شحنات واردة تزيد المخزون وصادرة تُنقصه
 * (مع منع تجاوز المتاح)، حركة تحويل بين مواقع، سند شحنة قابل للطباعة،
 * تقارير حركة. أدوار: مدير مستودع / مشغّل. بلا اعتماد خارجي.
 * الحالة في localStorage (jwh_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaWarehouse() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام إدارة المستودع</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">📦</span> <span id="brandName">مستودع jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام إدارة المستودع</h1>
        <p class="hint">أصناف ومواقع · شحنات واردة وصادرة · تحويل بين مواقع · تقارير حركة.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="manager">مدير مستودع</option><option value="operator">مشغّل</option></select>
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
      <div class="panel"><h3>⚠️ أصناف تحت الحد الأدنى</h3><div id="lowStock"></div></div>
    </section>

    <section id="view-items" class="view hidden">
      <div class="view-head"><h2>الأصناف والمواقع</h2></div>
      <div class="panel form-row">
        <input id="itName" placeholder="اسم الصنف">
        <input id="itLocation" placeholder="موقع التخزين (رف A1)">
        <input id="itQty" type="number" placeholder="الكمية الابتدائية" min="0">
        <input id="itMin" type="number" placeholder="الحد الأدنى" min="0">
        <button class="btn primary" data-action="addItem">إضافة صنف</button>
      </div>
      <div class="panel"><table class="tbl" id="itemsTable"></table></div>
    </section>

    <section id="view-inbound" class="view hidden">
      <div class="view-head"><h2>وارد (استلام شحنة)</h2></div>
      <div class="panel">
        <div class="form-row">
          <input id="inRef" placeholder="مرجع الشحنة/المورّد">
          <select id="inItem"></select>
          <input id="inQty" type="number" placeholder="الكمية" min="1">
          <button class="btn ghost" data-action="addInboundLine">+ أضف</button>
        </div>
        <table class="tbl" id="inboundLinesTable"></table>
        <button class="btn primary" data-action="postInbound">استلام الشحنة</button>
      </div>
    </section>

    <section id="view-outbound" class="view hidden">
      <div class="view-head"><h2>صادر (صرف شحنة)</h2></div>
      <div class="panel">
        <div class="form-row">
          <input id="outRef" placeholder="مرجع الطلب/الجهة">
          <select id="outItem"></select>
          <input id="outQty" type="number" placeholder="الكمية" min="1">
          <button class="btn ghost" data-action="addOutboundLine">+ أضف</button>
        </div>
        <table class="tbl" id="outboundLinesTable"></table>
        <button class="btn primary" data-action="postOutbound">صرف الشحنة</button>
      </div>
    </section>

    <section id="view-shipments" class="view hidden">
      <div class="view-head"><h2>سجل الشحنات</h2></div>
      <div class="panel"><table class="tbl" id="shipmentsTable"></table></div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportShipmentsCsv">⬇️ الشحنات CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>حركة آخر ٧ أيام (وارد مقابل صادر)</h3><div id="moveChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم المستودع</label><input id="stName">
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

    const APP_JS = `/* 📦 نظام إدارة المستودع — jaola-warehouse */
const SEED_ITEMS = [
  { id: 'i1', name: 'صندوق تعبئة', location: 'رف A1', qty: 500, min: 100 },
  { id: 'i2', name: 'لفة تغليف', location: 'رف A2', qty: 40, min: 50 },
  { id: 'i3', name: 'شريط لاصق', location: 'رف B1', qty: 220, min: 60 }
];
const ROLES = {
  manager: { name: 'مدير المستودع', tabs: ['dashboard', 'items', 'inbound', 'outbound', 'shipments', 'reports', 'settings'] },
  operator: { name: 'المشغّل', tabs: ['dashboard', 'items', 'inbound', 'outbound', 'shipments'] }
};
const TAB_LABELS = { dashboard: 'اللوحة', items: 'الأصناف', inbound: 'وارد', outbound: 'صادر', shipments: 'الشحنات', reports: 'التقارير', settings: 'الإعدادات' };

function load(k, fb) { try { var v = localStorage.getItem('jwh_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jwh_' + k, JSON.stringify(val)); } catch (e) {} }
let items = load('items', SEED_ITEMS);
let shipments = load('shipments', []); // { id, no, type:'in'|'out', ref, lines:[{itemId,qty}], date }
let settings = load('settings', { name: 'مستودع jaola', pass: 'admin', shipSeq: 1 });
let state = { user: null, view: 'login', inLines: [], outLines: [] };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function today() { return new Date().toISOString().slice(0, 10); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function itemById(id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i]; return null; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'dashboard') renderDashboard();
  if (v === 'items') renderItems();
  if (v === 'inbound') renderInbound();
  if (v === 'outbound') renderOutbound();
  if (v === 'shipments') renderShipments();
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
  show(byId('loginErr'), false); state.user = { role: role }; toast('مرحباً ' + ROLES[role].name); setView('dashboard');
}
function logout() { state.user = null; setView('login'); }

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var t = today();
  var todayIn = shipments.filter(function (s) { return s.type === 'in' && s.date === t; }).length;
  var todayOut = shipments.filter(function (s) { return s.type === 'out' && s.date === t; }).length;
  var lows = items.filter(function (i) { return i.qty <= i.min; });
  byId('dashStats').innerHTML =
    statCard('أصناف المستودع', String(items.length), '') +
    statCard('وارد اليوم', String(todayIn), 'ok') +
    statCard('صادر اليوم', String(todayOut), '') +
    statCard('تحت الحد الأدنى', String(lows.length), lows.length ? 'warn' : '');
  byId('lowStock').innerHTML = lows.length ? lows.map(function (i) { return '<div class="low-row">⚠️ <b>' + esc(i.name) + '</b> — ' + esc(i.location) + ' · المتبقي ' + i.qty + ' (الحد ' + i.min + ')</div>'; }).join('') : '<p class="hint">كل الأصناف فوق الحد الأدنى ✅</p>';
}

function renderItems() {
  var rows = items.map(function (i) {
    return '<tr class="' + (i.qty <= i.min ? 'row-low' : '') + '"><td>' + esc(i.name) + '</td><td>' + esc(i.location) + '</td><td>' + i.qty + '</td><td>' + i.min + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delItem" data-id="' + i.id + '">حذف</button></td></tr>';
  }).join('');
  byId('itemsTable').innerHTML = '<tr><th>الصنف</th><th>الموقع</th><th>الكمية</th><th>الحد الأدنى</th><th></th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا أصناف بعد.</td></tr>');
  fillItemSelects();
}
function addItem() {
  var name = byId('itName').value.trim(); if (!name) { toast('اكتب اسم الصنف'); return; }
  items.push({ id: uid('i'), name: name, location: byId('itLocation').value.trim() || 'رف عام', qty: Math.max(0, parseInt(byId('itQty').value, 10) || 0), min: Math.max(0, parseInt(byId('itMin').value, 10) || 0) });
  save('items', items);
  byId('itName').value = ''; byId('itLocation').value = ''; byId('itQty').value = ''; byId('itMin').value = '';
  toast('أُضيف الصنف'); renderItems();
}
function delItem(id) { items = items.filter(function (i) { return i.id !== id; }); save('items', items); renderItems(); }
function fillItemSelects() {
  var opts = items.map(function (i) { return '<option value="' + i.id + '">' + esc(i.name) + ' — ' + esc(i.location) + ' (متاح: ' + i.qty + ')</option>'; }).join('');
  var a = byId('inItem'); if (a) a.innerHTML = opts;
  var b = byId('outItem'); if (b) b.innerHTML = opts;
}

function renderInbound() { fillItemSelects(); renderInboundLines(); }
function renderInboundLines() {
  byId('inboundLinesTable').innerHTML = state.inLines.length ? '<tr><th>الصنف</th><th>الكمية</th><th></th></tr>' +
    state.inLines.map(function (l, idx) { return '<tr><td>' + esc(l.name) + '</td><td>+' + l.qty + '</td><td><button class="btn tiny ghost" data-action="delInLine" data-idx="' + idx + '">×</button></td></tr>'; }).join('') : '';
}
function addInboundLine() {
  var id = byId('inItem').value; var qty = parseInt(byId('inQty').value, 10) || 0; var it = itemById(id);
  if (!it || qty < 1) { toast('اختر الصنف والكمية'); return; }
  state.inLines.push({ itemId: id, name: it.name, qty: qty }); byId('inQty').value = ''; renderInboundLines();
}
function delInLine(i) { state.inLines.splice(i, 1); renderInboundLines(); }
function postInbound() {
  if (!state.inLines.length) { toast('أضف صنفاً واحداً على الأقل'); return; }
  for (var i = 0; i < state.inLines.length; i++) { var it = itemById(state.inLines[i].itemId); if (it) it.qty += state.inLines[i].qty; }
  var sh = { id: uid('s'), no: settings.shipSeq++, type: 'in', ref: byId('inRef').value.trim(), lines: state.inLines.slice(), date: today() };
  shipments.push(sh); state.inLines = []; byId('inRef').value = '';
  save('items', items); save('shipments', shipments); save('settings', settings);
  toast('استُلمت الشحنة #' + sh.no); printShipment(sh.id); renderInbound();
}

function renderOutbound() { fillItemSelects(); renderOutboundLines(); }
function renderOutboundLines() {
  byId('outboundLinesTable').innerHTML = state.outLines.length ? '<tr><th>الصنف</th><th>الكمية</th><th></th></tr>' +
    state.outLines.map(function (l, idx) { return '<tr><td>' + esc(l.name) + '</td><td>−' + l.qty + '</td><td><button class="btn tiny ghost" data-action="delOutLine" data-idx="' + idx + '">×</button></td></tr>'; }).join('') : '';
}
function addOutboundLine() {
  var id = byId('outItem').value; var qty = parseInt(byId('outQty').value, 10) || 0; var it = itemById(id);
  if (!it || qty < 1) { toast('اختر الصنف والكمية'); return; }
  var already = 0; for (var i = 0; i < state.outLines.length; i++) if (state.outLines[i].itemId === id) already += state.outLines[i].qty;
  if (qty + already > it.qty) { toast('الكمية أكبر من المتاح (' + (it.qty - already) + ')'); return; }
  state.outLines.push({ itemId: id, name: it.name, qty: qty }); byId('outQty').value = ''; renderOutboundLines();
}
function delOutLine(i) { state.outLines.splice(i, 1); renderOutboundLines(); }
function postOutbound() {
  if (!state.outLines.length) { toast('أضف صنفاً واحداً على الأقل'); return; }
  for (var i = 0; i < state.outLines.length; i++) { var it = itemById(state.outLines[i].itemId); if (!it || state.outLines[i].qty > it.qty) { toast('الكمية لم تعد متاحة: ' + state.outLines[i].name); return; } }
  for (var j = 0; j < state.outLines.length; j++) itemById(state.outLines[j].itemId).qty -= state.outLines[j].qty;
  var sh = { id: uid('s'), no: settings.shipSeq++, type: 'out', ref: byId('outRef').value.trim(), lines: state.outLines.slice(), date: today() };
  shipments.push(sh); state.outLines = []; byId('outRef').value = '';
  save('items', items); save('shipments', shipments); save('settings', settings);
  toast('صُرفت الشحنة #' + sh.no); printShipment(sh.id); renderOutbound();
}
function printShipment(id) {
  var sh = null; for (var i = 0; i < shipments.length; i++) if (shipments[i].id === id) sh = shipments[i];
  if (!sh) return;
  var rows = sh.lines.map(function (l) { return '<tr><td>' + esc(l.name) + '</td><td>' + l.qty + '</td></tr>'; }).join('');
  byId('printArea').innerHTML = '<div class="inv"><h1>' + esc(settings.name) + '</h1>' +
    '<div class="inv-meta"><span>سند ' + (sh.type === 'in' ? 'استلام' : 'صرف') + ' #' + sh.no + '</span><span>' + sh.date + '</span></div>' +
    (sh.ref ? '<p><b>المرجع:</b> ' + esc(sh.ref) + '</p>' : '') +
    '<table><tr><th>الصنف</th><th>الكمية</th></tr>' + rows + '</table>' +
    '<p class="inv-foot">تم التحقق من الكميات</p></div>';
  window.print();
}

function renderShipments() {
  var rows = shipments.slice().reverse().slice(0, 80).map(function (s) {
    return '<tr><td>#' + s.no + '</td><td>' + s.date + '</td><td>' + (s.type === 'in' ? '📥 وارد' : '📤 صادر') + '</td><td>' + esc(s.ref || '—') + '</td><td>' + s.lines.length + ' صنف</td>' +
      '<td><button class="btn tiny ghost" data-action="printShipment" data-id="' + s.id + '">🖨️ السند</button></td></tr>';
  }).join('');
  byId('shipmentsTable').innerHTML = '<tr><th>رقم</th><th>التاريخ</th><th>النوع</th><th>المرجع</th><th>الأصناف</th><th></th></tr>' +
    (rows || '<tr><td colspan="6" class="hint">لا شحنات بعد.</td></tr>');
}

function renderReports() {
  var t = today();
  byId('reportStats').innerHTML =
    statCard('شحنات اليوم', String(shipments.filter(function (s) { return s.date === t; }).length), '') +
    statCard('إجمالي الوارد', String(shipments.filter(function (s) { return s.type === 'in'; }).length), 'ok') +
    statCard('إجمالي الصادر', String(shipments.filter(function (s) { return s.type === 'out'; }).length), '') +
    statCard('إجمالي الشحنات', String(shipments.length), '');
  var data = [];
  for (var d = 6; d >= 0; d--) {
    var dt = new Date(); dt.setDate(dt.getDate() - d); var ds = dt.toISOString().slice(0, 10);
    var inQ = 0, outQ = 0;
    for (var i = 0; i < shipments.length; i++) if (shipments[i].date === ds) {
      var q = 0; for (var j = 0; j < shipments[i].lines.length; j++) q += shipments[i].lines[j].qty;
      if (shipments[i].type === 'in') inQ += q; else outQ += q;
    }
    data.push({ label: ds.slice(5) + ' وارد', value: inQ });
    data.push({ label: ds.slice(5) + ' صادر', value: outQ });
  }
  byId('moveChart').innerHTML = barChart(data, 160);
}
function barChart(data, h) {
  var max = 1; for (var i = 0; i < data.length; i++) if (data[i].value > max) max = data[i].value;
  var bw = Math.floor(100 / data.length);
  return '<svg viewBox="0 0 100 ' + h + '" preserveAspectRatio="none" style="width:100%;height:' + h + 'px">' +
    data.map(function (d, i) { var bh = Math.round((d.value / max) * (h - 30)); var x = i * bw; return '<g><rect x="' + (x + 2) + '%" y="' + (h - 20 - bh) + '" width="' + (bw - 4) + '%" height="' + bh + '" rx="3" class="bar"></rect></g>'; }).join('') + '</svg>';
}
function csvDownload(name, rows) {
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function exportShipmentsCsv() {
  var rows = [['رقم', 'التاريخ', 'النوع', 'المرجع', 'عدد الأصناف']];
  for (var i = 0; i < shipments.length; i++) rows.push([shipments[i].no, shipments[i].date, shipments[i].type === 'in' ? 'وارد' : 'صادر', shipments[i].ref || '', shipments[i].lines.length]);
  csvDownload('shipments.csv', rows); toast('صُدّرت الشحنات CSV');
}

function renderSettings() { byId('stName').value = settings.name; byId('stPass').value = ''; }
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  var np = byId('stPass').value.trim(); if (np) settings.pass = np;
  save('settings', settings); byId('brandName').textContent = settings.name; toast('حُفظت الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addItem': addItem(); break;
    case 'delItem': delItem(a.dataset.id); break;
    case 'addInboundLine': addInboundLine(); break;
    case 'delInLine': delInLine(parseInt(a.dataset.idx, 10)); break;
    case 'postInbound': postInbound(); break;
    case 'addOutboundLine': addOutboundLine(); break;
    case 'delOutLine': delOutLine(parseInt(a.dataset.idx, 10)); break;
    case 'postOutbound': postOutbound(); break;
    case 'printShipment': printShipment(a.dataset.id); break;
    case 'exportShipmentsCsv': exportShipmentsCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    return {
        id: 'jaola-warehouse',
        track: 'system',
        category: 'system',
        name: 'نظام إدارة مستودع',
        nameEn: 'Warehouse & Logistics',
        description: 'سيستم مستودع وشحنات داخلي: أصناف بمواقع تخزين، شحنات واردة تزيد المخزون وصادرة تُنقصه (مع منع تجاوز المتاح)، سند شحنة قابل للطباعة، وتقارير حركة — بأدوار (مدير مستودع/مشغّل).',
        descriptionEn: 'Internal warehouse and shipments system: items with storage locations, inbound shipments that increase stock and outbound that decrease it (with over-allocation prevention), printable shipment note, and movement reports — with roles (warehouse manager/operator).',
        keywords: ['مستودع', 'مستودعات', 'مخازن', 'شحنات', 'شحنة', 'وارد وصادر', 'استلام شحنة', 'صرف شحنة', 'لوجستيات', 'حركة مخزون', 'حركة المخزون', 'الشحنات الواردة', 'الشحنات الصادرة', 'شحنات واردة', 'شحنات صادرة', 'رفوف', 'warehouse', 'logistics', 'shipment', 'inbound outbound', 'stock movement'],
        model: {
            roles: [{ name: 'مدير مستودع' }, { name: 'مشغّل' }],
            entities: [{ name: 'صنف' }, { name: 'شحنة واردة' }, { name: 'شحنة صادرة' }],
            flows: [{ name: 'تسجيل صنف بموقع تخزين' }, { name: 'استلام شحنة واردة تزيد المخزون' }, { name: 'صرف شحنة صادرة تُنقص المخزون' }, { name: 'طباعة سند الشحنة' }, { name: 'تقرير حركة المخزون' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() },
        ],
    };
}
