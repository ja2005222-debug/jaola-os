/**
 * ⚖️ jaola-lawfirm — نظام مكتب محاماة داخلي (track: system).
 *
 * عملاء وقضايا تمرّ بمراحل (جديدة → قيد النظر → جلسة محددة → منتهية)،
 * جلسات مرتبطة بالقضية مع تاريخ ومحكمة، فاتورة أتعاب قابلة للطباعة،
 * وتقرير إيرادات. أدوار: محامٍ / سكرتير قانوني. بلا اعتماد خارجي.
 * الحالة في localStorage (jlaw_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaLawfirm() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام مكتب محاماة</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">⚖️</span> <span id="brandName">مكتب jaola للمحاماة</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام مكتب محاماة</h1>
        <p class="hint">عملاء وقضايا بمراحل · جلسات · فواتير أتعاب قابلة للطباعة · تقرير إيرادات.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="lawyer">محامٍ</option><option value="secretary">سكرتير قانوني</option></select>
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
      <div class="panel"><h3>📅 جلسات قادمة</h3><div id="upcomingHearings"></div></div>
    </section>

    <section id="view-clients" class="view hidden">
      <div class="view-head"><h2>العملاء</h2></div>
      <div class="panel form-row">
        <input id="clName" placeholder="اسم العميل">
        <input id="clPhone" placeholder="الهاتف">
        <button class="btn primary" data-action="addClient">إضافة عميل</button>
      </div>
      <div class="panel"><table class="tbl" id="clientsTable"></table></div>
    </section>

    <section id="view-cases" class="view hidden">
      <div class="view-head"><h2>القضايا</h2></div>
      <div class="panel form-row">
        <select id="caseClient"></select>
        <input id="caseTitle" placeholder="عنوان القضية">
        <input id="caseType" placeholder="النوع (تجارية/جنائية...)">
        <button class="btn primary" data-action="addCase">فتح قضية</button>
      </div>
      <div id="casesBoard"></div>
    </section>

    <section id="view-hearingForm" class="view hidden">
      <div class="view-head"><h2 id="hearingTitle">جدولة جلسة</h2><button class="btn ghost" data-action="backCases">→ القضايا</button></div>
      <div class="login-card" style="margin:0 auto;max-width:440px">
        <label>تاريخ الجلسة</label><input id="hrDate" type="date">
        <label>المحكمة</label><input id="hrCourt" placeholder="اسم المحكمة">
        <label>ملاحظة</label><input id="hrNote" placeholder="ملاحظة اختيارية">
        <button class="btn primary block" data-action="saveHearing">حفظ الجلسة</button>
      </div>
    </section>

    <section id="view-invoiceForm" class="view hidden">
      <div class="view-head"><h2 id="invoiceTitle">فاتورة أتعاب</h2><button class="btn ghost" data-action="backCases">→ القضايا</button></div>
      <div class="login-card" style="margin:0 auto;max-width:440px">
        <label>الوصف</label><input id="invDesc" placeholder="أتعاب استشارة/ترافع...">
        <label>المبلغ</label><input id="invAmount" type="number" placeholder="0" min="0">
        <button class="btn primary block" data-action="saveInvoice">حفظ وطباعة الفاتورة</button>
      </div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportInvoicesCsv">⬇️ الفواتير CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>إيراد آخر ٧ أيام</h3><div id="revChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم المكتب</label><input id="stName">
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

    const APP_JS = `/* ⚖️ نظام مكتب محاماة jaola — jaola-lawfirm */
const STAGES = ['open', 'in_progress', 'hearing_set', 'closed'];
const STAGE_LABEL = { open: 'جديدة', in_progress: 'قيد النظر', hearing_set: 'جلسة محددة', closed: 'منتهية' };

function load(k, fb) { try { var v = localStorage.getItem('jlaw_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jlaw_' + k, JSON.stringify(val)); } catch (e) {} }
let clients = load('clients', []); // { id, no, name, phone }
let cases = load('cases', []); // { id, no, clientId, title, type, stage, openedAt }
let hearings = load('hearings', []); // { id, caseId, date, court, note }
let invoices = load('invoices', []); // { id, no, caseId, clientId, desc, amount, createdAt }
let settings = load('settings', { name: 'مكتب jaola للمحاماة', pass: 'admin', currency: 'ر.س', clientSeq: 1, caseSeq: 1, invoiceSeq: 1 });
let session = load('session', null);
let state = { view: 'login', activeCase: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function clientById(id) { for (var i = 0; i < clients.length; i++) if (clients[i].id === id) return clients[i]; return null; }
function caseById(id) { for (var i = 0; i < cases.length; i++) if (cases[i].id === id) return cases[i]; return null; }
function roleLabel(r) { return r === 'lawyer' ? 'محامٍ' : 'سكرتير قانوني'; }

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
function logout() { session = null; save('session', null); toast('تم الخروج'); setView('login'); }

function setView(v) {
  if (v !== 'login' && !session) v = 'login';
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs(); renderUserChip();
  if (v === 'dashboard') renderDashboard();
  if (v === 'clients') renderClients();
  if (v === 'cases') renderCases();
  if (v === 'reports') renderReports();
  if (v === 'settings') { byId('stName').value = settings.name; byId('stPass').value = ''; }
}
function renderTabs() {
  if (!session) { byId('tabs').innerHTML = ''; return; }
  var tabs = [['dashboard', 'اليوم'], ['clients', 'العملاء'], ['cases', 'القضايا'], ['reports', 'التقارير'], ['settings', 'الإعدادات']];
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
}
function renderUserChip() {
  byId('userChip').innerHTML = session ? '<span>' + esc(roleLabel(session.role)) + '</span> <button class="btn tiny ghost" data-action="logout">خروج</button>' : '';
}

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var active = cases.filter(function (c) { return c.stage !== 'closed'; });
  var today = todayStr();
  var todayHearings = hearings.filter(function (h) { return h.date === today; });
  var revMonth = invoices.filter(function (i) { return i.createdAt.slice(0, 7) === today.slice(0, 7); }).reduce(function (s, i) { return s + i.amount; }, 0);
  byId('dashStats').innerHTML =
    statCard('قضايا نشطة', String(active.length), 'ok') +
    statCard('جلسات اليوم', String(todayHearings.length), todayHearings.length ? 'warn' : '') +
    statCard('إيراد الشهر', money(revMonth), 'ok') +
    statCard('إجمالي العملاء', String(clients.length), '');
  var upcoming = hearings.filter(function (h) { return h.date >= today; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 8);
  byId('upcomingHearings').innerHTML = upcoming.length ? upcoming.map(function (h) {
    var c = caseById(h.caseId);
    return '<div class="panel"><b>' + h.date + '</b> — ' + esc(c ? c.title : '؟') + ' <span class="hint">(' + esc(h.court) + ')</span></div>';
  }).join('') : '<p class="hint">لا جلسات قادمة.</p>';
}

function renderClients() {
  var rows = clients.map(function (c) { return '<tr><td>#' + c.no + '</td><td>' + esc(c.name) + '</td><td>' + esc(c.phone) + '</td></tr>'; }).join('');
  byId('clientsTable').innerHTML = '<tr><th>رقم</th><th>الاسم</th><th>الهاتف</th></tr>' + (rows || '<tr><td colspan="3" class="hint">لا عملاء بعد.</td></tr>');
  fillCaseClientSelect();
}
function addClient() {
  var name = byId('clName').value.trim(); var phone = byId('clPhone').value.trim();
  if (!name || !phone) { toast('اكتب اسم العميل والهاتف'); return; }
  clients.push({ id: uid('cl'), no: settings.clientSeq++, name: name, phone: phone });
  save('clients', clients); save('settings', settings);
  byId('clName').value = ''; byId('clPhone').value = '';
  toast('أُضيف العميل'); renderClients();
}
function fillCaseClientSelect() {
  var sel = byId('caseClient'); if (!sel) return;
  sel.innerHTML = clients.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('') || '<option value="">أضف عميلاً أولاً</option>';
}

function renderCases() {
  fillCaseClientSelect();
  byId('casesBoard').innerHTML = cases.length ? cases.slice().reverse().map(function (c) {
    var cl = clientById(c.clientId);
    var idx = STAGES.indexOf(c.stage); var next = STAGES[idx + 1];
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>#' + c.no + ' — ' + esc(c.title) + '</b><span class="badge">' + esc(STAGE_LABEL[c.stage]) + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + esc(cl ? cl.name : '؟') + ' · ' + esc(c.type || '') + '</div>' +
      (next ? '<button class="btn tiny primary" data-action="advanceCase" data-id="' + c.id + '">التالي: ' + esc(STAGE_LABEL[next]) + '</button> ' : '') +
      '<button class="btn tiny ghost" data-action="openHearingForm" data-id="' + c.id + '">📅 جدولة جلسة</button> ' +
      '<button class="btn tiny ghost" data-action="openInvoiceForm" data-id="' + c.id + '">🧾 فاتورة أتعاب</button></div>';
  }).join('') : '<p class="hint">لا قضايا بعد — افتح قضية من الأعلى.</p>';
}
function addCase() {
  var clientId = byId('caseClient').value; var title = byId('caseTitle').value.trim(); var type = byId('caseType').value.trim();
  if (!clientId) { toast('أضف عميلاً أولاً'); return; }
  if (!title) { toast('اكتب عنوان القضية'); return; }
  cases.push({ id: uid('cs'), no: settings.caseSeq++, clientId: clientId, title: title, type: type, stage: 'open', openedAt: new Date().toISOString() });
  save('cases', cases); save('settings', settings);
  byId('caseTitle').value = ''; byId('caseType').value = '';
  toast('فُتحت القضية'); renderCases();
}
function advanceCase(id) {
  var c = caseById(id); if (!c) return;
  var idx = STAGES.indexOf(c.stage);
  if (idx < STAGES.length - 1) { c.stage = STAGES[idx + 1]; save('cases', cases); toast('القضية الآن: ' + STAGE_LABEL[c.stage]); }
  renderCases();
}
function openHearingForm(id) { state.activeCase = id; var c = caseById(id); byId('hearingTitle').textContent = 'جدولة جلسة — ' + (c ? c.title : ''); byId('hrDate').value = todayStr(); byId('hrCourt').value = ''; byId('hrNote').value = ''; setView('hearingForm'); }
function backCases() { setView('cases'); }
function saveHearing() {
  var c = caseById(state.activeCase); if (!c) { setView('cases'); return; }
  var date = byId('hrDate').value; var court = byId('hrCourt').value.trim();
  if (!date || !court) { toast('اكتب التاريخ والمحكمة'); return; }
  hearings.push({ id: uid('hr'), caseId: c.id, date: date, court: court, note: byId('hrNote').value.trim() });
  save('hearings', hearings);
  c.stage = 'hearing_set'; save('cases', cases);
  toast('حُفظت الجلسة'); setView('cases');
}
function openInvoiceForm(id) { state.activeCase = id; var c = caseById(id); byId('invoiceTitle').textContent = 'فاتورة أتعاب — ' + (c ? c.title : ''); byId('invDesc').value = ''; byId('invAmount').value = ''; setView('invoiceForm'); }
function saveInvoice() {
  var c = caseById(state.activeCase); if (!c) { setView('cases'); return; }
  var desc = byId('invDesc').value.trim(); var amount = Math.max(0, parseFloat(byId('invAmount').value) || 0);
  if (!desc || amount <= 0) { toast('اكتب الوصف والمبلغ'); return; }
  var inv = { id: uid('inv'), no: settings.invoiceSeq++, caseId: c.id, clientId: c.clientId, desc: desc, amount: amount, createdAt: new Date().toISOString() };
  invoices.push(inv); save('invoices', invoices); save('settings', settings);
  toast('حُفظت الفاتورة #' + inv.no); printInvoice(inv.id); setView('cases');
}
function printInvoice(id) {
  var inv = null; for (var i = 0; i < invoices.length; i++) if (invoices[i].id === id) inv = invoices[i];
  if (!inv) return; var c = caseById(inv.caseId); var cl = clientById(inv.clientId);
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>فاتورة أتعاب #' + inv.no + '</span></div><hr>' +
    '<div class="r-row"><span>العميل</span><span>' + esc(cl ? cl.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>القضية</span><span>' + esc(c ? c.title : '؟') + '</span></div>' +
    '<div class="r-row"><span>الوصف</span><span>' + esc(inv.desc) + '</span></div><hr>' +
    '<div class="r-row"><b>المبلغ</b><b>' + money(inv.amount) + '</b></div>' +
    '<p style="text-align:center">شكراً لثقتكم ⚖️</p></div>';
  window.print();
}

function renderReports() {
  var days = [];
  for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  var byDay = {}; days.forEach(function (d) { byDay[d] = 0; });
  var totalRev = 0;
  invoices.forEach(function (inv) { var d = inv.createdAt.slice(0, 10); if (byDay.hasOwnProperty(d)) byDay[d] += inv.amount; totalRev += inv.amount; });
  byId('reportStats').innerHTML =
    statCard('إجمالي القضايا', String(cases.length), '') +
    statCard('إجمالي الفواتير', String(invoices.length), '') +
    statCard('إجمالي الإيراد', money(totalRev), 'ok');
  var max = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([1]));
  byId('revChart').innerHTML = days.map(function (d) {
    var h = Math.round((byDay[d] / max) * 100);
    return '<div class="bar-col"><div class="bar" style="height:' + h + '%" title="' + money(byDay[d]) + '"></div><span class="bar-label">' + d.slice(5) + '</span></div>';
  }).join('');
}
function exportInvoicesCsv() {
  var rows = [['#', 'العميل', 'القضية', 'الوصف', 'المبلغ', 'التاريخ']];
  invoices.forEach(function (inv) {
    var c = caseById(inv.caseId); var cl = clientById(inv.clientId);
    rows.push([inv.no, cl ? cl.name : '', c ? c.title : '', inv.desc, inv.amount, inv.createdAt.slice(0, 10)]);
  });
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lawfirm-invoices.csv'; a.click();
  toast('صُدّرت الفواتير CSV');
}

function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  var np = byId('stPass').value.trim();
  if (np) { var sync = window.JAOLA_SYNC; if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np }) }).catch(function () {}); } else settings.pass = np; }
  save('settings', settings); byId('brandName').textContent = settings.name;
  toast('تم حفظ الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addClient': addClient(); break;
    case 'addCase': addCase(); break;
    case 'advanceCase': advanceCase(a.dataset.id); break;
    case 'openHearingForm': openHearingForm(a.dataset.id); break;
    case 'openInvoiceForm': openInvoiceForm(a.dataset.id); break;
    case 'backCases': backCases(); break;
    case 'saveHearing': saveHearing(); break;
    case 'saveInvoice': saveInvoice(); break;
    case 'exportInvoicesCsv': exportInvoicesCsv(); break;
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
        id: 'jaola-lawfirm',
        track: 'system',
        category: 'system',
        name: 'نظام مكتب محاماة',
        nameEn: 'Law Firm Case Management',
        description: 'سيستم مكتب محاماة داخلي: عملاء وقضايا تمرّ بمراحل (جديدة/قيد النظر/جلسة محددة/منتهية)، جلسات مرتبطة بالقضية بتاريخ ومحكمة، فاتورة أتعاب قابلة للطباعة، وتقرير إيرادات — بأدوار (محامٍ/سكرتير قانوني).',
        descriptionEn: 'Internal law firm system: clients and cases moving through stages (open/in progress/hearing set/closed), hearings linked to a case with date and court, printable legal fee invoices, and a revenue report — with roles (lawyer/legal secretary).',
        keywords: ['مكتب محاماة', 'محاماة', 'محامٍ', 'قضية', 'قضايا', 'جلسة محكمة', 'أتعاب محاماة', 'شؤون قانونية', 'استشارات قانونية', 'law firm', 'legal case', 'attorney', 'lawyer', 'court hearing', 'legal fees'],
        model: {
            roles: [{ name: 'محامٍ' }, { name: 'سكرتير قانوني' }],
            entities: [{ name: 'عميل' }, { name: 'قضية' }, { name: 'جلسة' }],
            flows: [{ name: 'فتح قضية لعميل' }, { name: 'جدولة جلسة مرتبطة بالقضية' }, { name: 'تسجيل فاتورة أتعاب وطباعتها' }, { name: 'تقرير الإيرادات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
