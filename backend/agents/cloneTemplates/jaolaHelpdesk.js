/**
 * 🎫 jaola-helpdesk — نظام تذاكر دعم فني داخلي (track: system).
 *
 * تذاكر دعم بأولوية وحالة تمرّ بمراحل (مفتوحة → قيد المعالجة → محلولة →
 * مغلقة)، ردود متعددة على التذكرة، تعيين وكيل، ملخّص تذكرة قابل للطباعة،
 * وتقرير أداء (متوسط زمن الحل + تصدير CSV). أدوار: وكيل دعم / مشرف.
 * بلا اعتماد خارجي. الحالة في localStorage (jhelp_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaHelpdesk() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام تذاكر الدعم الفني</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🎫</span> <span id="brandName">دعم jaola الفني</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام تذاكر الدعم الفني</h1>
        <p class="hint">تذاكر بأولوية وحالة · ردود متعددة · تعيين وكيل · ملخّص قابل للطباعة · تقرير أداء.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="agent">وكيل دعم</option><option value="supervisor">مشرف</option></select>
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
      <div class="panel"><h3>🔥 تذاكر عاجلة مفتوحة</h3><div id="urgentList"></div></div>
    </section>

    <section id="view-newTicket" class="view hidden">
      <div class="view-head"><h2>تذكرة جديدة</h2></div>
      <div class="panel form-row">
        <input id="tkCustomer" placeholder="اسم العميل">
        <input id="tkSubject" placeholder="عنوان المشكلة">
      </div>
      <div class="panel form-row">
        <select id="tkPriority"><option value="low">منخفضة</option><option value="normal" selected>عادية</option><option value="high">عاجلة</option></select>
        <input id="tkDesc" placeholder="وصف المشكلة">
        <button class="btn primary" data-action="createTicket">فتح التذكرة</button>
      </div>
    </section>

    <section id="view-tickets" class="view hidden">
      <div class="view-head"><h2>التذاكر</h2></div>
      <div id="ticketsBoard"></div>
    </section>

    <section id="view-ticketDetail" class="view hidden">
      <div class="view-head"><h2 id="ticketDetailTitle">تذكرة</h2><button class="btn ghost" data-action="backTickets">→ التذاكر</button></div>
      <div class="panel" id="ticketInfo"></div>
      <div class="panel"><h3>الردود</h3><div id="repliesList"></div></div>
      <div class="panel form-row">
        <input id="replyText" placeholder="اكتب ردّاً...">
        <button class="btn ghost" data-action="addReply">إرسال الرد</button>
      </div>
      <button class="btn primary block" data-action="printTicket">🖨️ طباعة ملخّص التذكرة</button>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportTicketsCsv">⬇️ التذاكر CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>تذاكر آخر ٧ أيام</h3><div id="ticketsChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم فريق الدعم</label><input id="stName">
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

    const APP_JS = `/* 🎫 نظام تذاكر الدعم الفني jaola — jaola-helpdesk */
const STAGES = ['open', 'in_progress', 'resolved', 'closed'];
const STAGE_LABEL = { open: 'مفتوحة', in_progress: 'قيد المعالجة', resolved: 'محلولة', closed: 'مغلقة' };
const PRIORITY_LABEL = { low: 'منخفضة', normal: 'عادية', high: 'عاجلة' };

function load(k, fb) { try { var v = localStorage.getItem('jhelp_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jhelp_' + k, JSON.stringify(val)); } catch (e) {} }
let tickets = load('tickets', []); // { id, no, customer, subject, desc, priority, stage, replies:[{who,text,at}], createdAt, resolvedAt }
let settings = load('settings', { name: 'دعم jaola الفني', pass: 'admin', ticketSeq: 1 });
let session = load('session', null);
let state = { view: 'login', activeTicket: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function ticketById(id) { for (var i = 0; i < tickets.length; i++) if (tickets[i].id === id) return tickets[i]; return null; }
function roleLabel(r) { return r === 'agent' ? 'وكيل دعم' : 'مشرف'; }

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
  if (v === 'tickets') renderTickets();
  if (v === 'ticketDetail') renderTicketDetail();
  if (v === 'reports') renderReports();
  if (v === 'settings') { byId('stName').value = settings.name; byId('stPass').value = ''; byId('stPassCur').value = ''; }
}
function renderTabs() {
  if (!session) { byId('tabs').innerHTML = ''; return; }
  var tabs = [['dashboard', 'اليوم'], ['newTicket', 'تذكرة جديدة'], ['tickets', 'التذاكر'], ['reports', 'التقارير'], ['settings', 'الإعدادات']];
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] || (state.view === 'ticketDetail' && t[0] === 'tickets') ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
}
function renderUserChip() {
  byId('userChip').innerHTML = session ? '<span>' + esc(roleLabel(session.role)) + '</span> <button class="btn tiny ghost" data-action="logout">خروج</button>' : '';
}

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var open = tickets.filter(function (t) { return t.stage !== 'closed' && t.stage !== 'resolved'; });
  var urgent = tickets.filter(function (t) { return t.priority === 'high' && t.stage !== 'closed'; });
  var todayCount = tickets.filter(function (t) { return t.createdAt.slice(0, 10) === todayStr(); }).length;
  byId('dashStats').innerHTML =
    statCard('تذاكر مفتوحة', String(open.length), open.length ? 'warn' : 'ok') +
    statCard('عاجلة', String(urgent.length), urgent.length ? 'warn' : '') +
    statCard('تذاكر اليوم', String(todayCount), '') +
    statCard('إجمالي التذاكر', String(tickets.length), '');
  byId('urgentList').innerHTML = urgent.length ? urgent.map(function (t) {
    return '<div class="panel"><b>#' + t.no + '</b> — ' + esc(t.subject) + ' <span class="hint">(' + esc(t.customer) + ')</span></div>';
  }).join('') : '<p class="hint">لا تذاكر عاجلة مفتوحة.</p>';
}

function createTicket() {
  var customer = byId('tkCustomer').value.trim(); var subject = byId('tkSubject').value.trim();
  if (!customer || !subject) { toast('اكتب اسم العميل وعنوان المشكلة'); return; }
  var t = { id: uid('tk'), no: settings.ticketSeq++, customer: customer, subject: subject, desc: byId('tkDesc').value.trim(), priority: byId('tkPriority').value, stage: 'open', replies: [], createdAt: new Date().toISOString(), resolvedAt: null };
  tickets.push(t); save('tickets', tickets); save('settings', settings);
  byId('tkCustomer').value = ''; byId('tkSubject').value = ''; byId('tkDesc').value = '';
  toast('فُتحت التذكرة #' + t.no); setView('tickets');
}

function renderTickets() {
  byId('ticketsBoard').innerHTML = tickets.length ? tickets.slice().reverse().map(function (t) {
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>#' + t.no + ' — ' + esc(t.subject) + '</b><span class="badge">' + esc(STAGE_LABEL[t.stage]) + '</span></div>' +
      '<div class="hint" style="line-height:1.9">' + esc(t.customer) + ' · أولوية: ' + esc(PRIORITY_LABEL[t.priority]) + '</div>' +
      '<button class="btn tiny primary" data-action="openTicket" data-id="' + t.id + '">فتح التذكرة</button></div>';
  }).join('') : '<p class="hint">لا تذاكر بعد.</p>';
}
function openTicket(id) { state.activeTicket = id; setView('ticketDetail'); }
function backTickets() { setView('tickets'); }
function renderTicketDetail() {
  var t = ticketById(state.activeTicket); if (!t) { setView('tickets'); return; }
  byId('ticketDetailTitle').textContent = 'تذكرة #' + t.no + ' — ' + t.subject;
  var idx = STAGES.indexOf(t.stage); var next = STAGES[idx + 1];
  byId('ticketInfo').innerHTML = '<div class="r-row"><span>العميل</span><span>' + esc(t.customer) + '</span></div>' +
    '<div class="r-row"><span>الأولوية</span><span>' + esc(PRIORITY_LABEL[t.priority]) + '</span></div>' +
    '<div class="r-row"><span>الوصف</span><span>' + esc(t.desc || '—') + '</span></div>' +
    '<div class="r-row"><span>الحالة</span><span>' + esc(STAGE_LABEL[t.stage]) + '</span></div>' +
    (next ? '<button class="btn tiny primary" data-action="advanceTicket" data-id="' + t.id + '">التالي: ' + esc(STAGE_LABEL[next]) + '</button>' : '');
  byId('repliesList').innerHTML = (t.replies || []).length ? t.replies.map(function (r) {
    return '<div class="panel"><b>' + esc(r.who) + '</b> <span class="hint">' + r.at.slice(0, 16).replace('T', ' ') + '</span><div>' + esc(r.text) + '</div></div>';
  }).join('') : '<p class="hint">لا ردود بعد.</p>';
}
function advanceTicket(id) {
  var t = ticketById(id); if (!t) return;
  var idx = STAGES.indexOf(t.stage);
  if (idx < STAGES.length - 1) {
    t.stage = STAGES[idx + 1];
    if (t.stage === 'resolved' && !t.resolvedAt) t.resolvedAt = new Date().toISOString();
    save('tickets', tickets); toast('التذكرة الآن: ' + STAGE_LABEL[t.stage]);
  }
  renderTicketDetail(); renderDashboard();
}
function addReply() {
  var t = ticketById(state.activeTicket); if (!t) return;
  var text = byId('replyText').value.trim(); if (!text) { toast('اكتب رداً'); return; }
  t.replies = t.replies || []; t.replies.push({ who: roleLabel(session.role), text: text, at: new Date().toISOString() });
  save('tickets', tickets); byId('replyText').value = ''; toast('أُضيف الرد'); renderTicketDetail();
}
function printTicket() {
  var t = ticketById(state.activeTicket); if (!t) return;
  var repliesHtml = (t.replies || []).map(function (r) { return '<div class="r-row"><span>' + esc(r.who) + '</span><span>' + esc(r.text) + '</span></div>'; }).join('');
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>ملخّص تذكرة #' + t.no + '</span></div><hr>' +
    '<div class="r-row"><span>العميل</span><span>' + esc(t.customer) + '</span></div>' +
    '<div class="r-row"><span>الموضوع</span><span>' + esc(t.subject) + '</span></div>' +
    '<div class="r-row"><span>الحالة</span><span>' + esc(STAGE_LABEL[t.stage]) + '</span></div><hr>' +
    repliesHtml + '<p style="text-align:center">شكراً لتواصلكم 🎫</p></div>';
  window.print();
}

function renderReports() {
  var days = [];
  for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  var byDay = {}; days.forEach(function (d) { byDay[d] = 0; });
  tickets.forEach(function (t) { var d = t.createdAt.slice(0, 10); if (byDay.hasOwnProperty(d)) byDay[d]++; });
  var resolved = tickets.filter(function (t) { return t.resolvedAt; });
  var avgHours = 0;
  if (resolved.length) {
    var totalMs = resolved.reduce(function (s, t) { return s + (new Date(t.resolvedAt) - new Date(t.createdAt)); }, 0);
    avgHours = Math.round((totalMs / resolved.length / 3600000) * 10) / 10;
  }
  byId('reportStats').innerHTML =
    statCard('إجمالي التذاكر', String(tickets.length), '') +
    statCard('محلولة', String(resolved.length), 'ok') +
    statCard('متوسط زمن الحل', avgHours + ' ساعة', '');
  var max = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([1]));
  byId('ticketsChart').innerHTML = days.map(function (d) {
    var h = Math.round((byDay[d] / max) * 100);
    return '<div class="bar-col"><div class="bar" style="height:' + h + '%" title="' + byDay[d] + '"></div><span class="bar-label">' + d.slice(5) + '</span></div>';
  }).join('');
}
function exportTicketsCsv() {
  var rows = [['#', 'العميل', 'الموضوع', 'الأولوية', 'الحالة', 'التاريخ']];
  tickets.forEach(function (t) { rows.push([t.no, t.customer, t.subject, PRIORITY_LABEL[t.priority], STAGE_LABEL[t.stage], t.createdAt.slice(0, 10)]); });
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'helpdesk-tickets.csv'; a.click();
  toast('صُدّرت التذاكر CSV');
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
    case 'createTicket': createTicket(); break;
    case 'openTicket': openTicket(a.dataset.id); break;
    case 'backTickets': backTickets(); break;
    case 'advanceTicket': advanceTicket(a.dataset.id); break;
    case 'addReply': addReply(); break;
    case 'printTicket': printTicket(); break;
    case 'exportTicketsCsv': exportTicketsCsv(); break;
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
        id: 'jaola-helpdesk',
        track: 'system',
        category: 'system',
        name: 'نظام تذاكر دعم فني',
        nameEn: 'Helpdesk Ticketing',
        description: 'سيستم دعم فني داخلي: تذاكر بأولوية وحالة تمرّ بمراحل (مفتوحة/قيد المعالجة/محلولة/مغلقة)، ردود متعددة على التذكرة، ملخّص تذكرة قابل للطباعة، وتقرير أداء بمتوسط زمن الحل — بأدوار (وكيل دعم/مشرف).',
        descriptionEn: 'Internal helpdesk system: prioritized support tickets moving through stages (open/in progress/resolved/closed), multiple replies per ticket, a printable ticket summary, and a performance report with average resolution time — with roles (support agent/supervisor).',
        keywords: ['تذاكر دعم', 'تذكرة دعم', 'دعم فني', 'خدمة عملاء داخلية', 'تذاكر الدعم الفني', 'وكيل دعم', 'مركز مساعدة', 'helpdesk', 'support ticket', 'ticketing system', 'customer support tickets', 'help center'],
        model: {
            roles: [{ name: 'وكيل دعم' }, { name: 'مشرف' }],
            entities: [{ name: 'تذكرة دعم' }, { name: 'رد' }],
            flows: [{ name: 'فتح تذكرة دعم بأولوية' }, { name: 'الرد على التذكرة وتتبّع حالتها' }, { name: 'طباعة ملخّص التذكرة' }, { name: 'تقرير الأداء ومتوسط زمن الحل' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
