/**
 * 📒 jaola-accounting — نظام محاسبة داخلي بقيد مزدوج (track: system).
 *
 * دليل حسابات (أصول/خصوم/حقوق/إيراد/مصروف)، قيود يومية متوازنة
 * (مدين=دائن)، دفتر أستاذ لكل حساب، ميزان مراجعة، وقائمة دخل مبسّطة.
 * أدوار: محاسب / مدير مالي. بلا اعتماد خارجي. الحالة localStorage (jacc_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaAccounting() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام المحاسبة</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">📒</span> <span id="brandName">محاسبة jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>نظام المحاسبة</h1>
        <p class="hint">دليل حسابات · قيود يومية متوازنة · دفتر أستاذ · ميزان مراجعة · قائمة دخل.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="cfo">مدير مالي</option><option value="accountant">محاسب</option></select>
        <label>كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="login">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin».</p>
      </div>
    </section>

    <section id="view-dashboard" class="view hidden">
      <h2>لوحة مالية</h2>
      <div class="stats" id="dashStats"></div>
      <div class="panel"><h3>آخر القيود</h3><div id="recentEntries"></div></div>
    </section>

    <section id="view-accounts" class="view hidden">
      <div class="view-head"><h2>دليل الحسابات</h2></div>
      <div class="panel form-row">
        <input id="acName" placeholder="اسم الحساب">
        <select id="acType">
          <option value="asset">أصول</option><option value="liability">خصوم</option>
          <option value="equity">حقوق ملكية</option><option value="revenue">إيراد</option><option value="expense">مصروف</option>
        </select>
        <button class="btn primary" data-action="addAccount">إضافة حساب</button>
      </div>
      <div class="panel"><table class="tbl" id="accountsTable"></table></div>
    </section>

    <section id="view-journal" class="view hidden">
      <div class="view-head"><h2>قيد يومية</h2></div>
      <div class="panel">
        <div class="form-row">
          <input id="jeDesc" placeholder="بيان القيد" style="flex:2">
          <input id="jeDate" type="date">
        </div>
        <table class="tbl" id="jeLinesTable"></table>
        <div class="form-row">
          <select id="jeAccount"></select>
          <input id="jeDebit" type="number" placeholder="مدين" min="0" step="0.01">
          <input id="jeCredit" type="number" placeholder="دائن" min="0" step="0.01">
          <button class="btn ghost" data-action="addJeLine">+ أضف سطراً</button>
        </div>
        <div class="sale-foot"><span id="jeBalance"></span><button class="btn primary" data-action="postEntry">ترحيل القيد</button></div>
      </div>
      <div class="panel"><h3>القيود المرحّلة</h3><table class="tbl" id="entriesTable"></table></div>
    </section>

    <section id="view-ledger" class="view hidden">
      <div class="view-head"><h2>دفتر الأستاذ</h2><select id="ledgerAccount"></select></div>
      <div class="panel"><table class="tbl" id="ledgerTable"></table></div>
    </section>

    <section id="view-trial" class="view hidden">
      <div class="view-head"><h2>ميزان المراجعة</h2><button class="btn ghost" data-action="exportTrialCsv">⬇️ CSV</button></div>
      <div class="stats" id="incomeStats"></div>
      <div class="panel"><table class="tbl" id="trialTable"></table></div>
    </section>

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
  <div id="toast" class="toast no-print hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 📒 نظام المحاسبة — jaola-accounting */
const TYPE_LABELS = { asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيراد', expense: 'مصروف' };
// طبيعة الرصيد: أصول/مصروف مدينة (+debit)، والبقية دائنة
const DEBIT_NATURE = { asset: 1, expense: 1, liability: -1, equity: -1, revenue: -1 };
const SEED_ACCOUNTS = [
  { id: 'a1', name: 'الصندوق', type: 'asset' },
  { id: 'a2', name: 'البنك', type: 'asset' },
  { id: 'a3', name: 'العملاء (مدينون)', type: 'asset' },
  { id: 'a4', name: 'الموردون (دائنون)', type: 'liability' },
  { id: 'a5', name: 'رأس المال', type: 'equity' },
  { id: 'a6', name: 'المبيعات', type: 'revenue' },
  { id: 'a7', name: 'المصروفات', type: 'expense' }
];
const ROLES = {
  cfo: { name: 'المدير المالي', tabs: ['dashboard', 'accounts', 'journal', 'ledger', 'trial', 'settings'] },
  accountant: { name: 'المحاسب', tabs: ['dashboard', 'journal', 'ledger', 'trial'] }
};
const TAB_LABELS = { dashboard: 'اللوحة', accounts: 'الحسابات', journal: 'القيود', ledger: 'الأستاذ', trial: 'الميزان', settings: 'الإعدادات' };

function load(k, fb) { try { var v = localStorage.getItem('jacc_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jacc_' + k, JSON.stringify(val)); } catch (e) {} }
let accounts = load('accounts', SEED_ACCOUNTS);
let entries = load('entries', []); // { id, no, date, desc, lines:[{accId, debit, credit}] }
let settings = load('settings', { name: 'منشأة jaola', currency: 'ر.س', pass: 'admin', entrySeq: 1 });
let state = { user: null, view: 'login', draft: [], ledgerAcc: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function today() { return new Date().toISOString().slice(0, 10); }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2600); }
function accById(id) { for (var i = 0; i < accounts.length; i++) if (accounts[i].id === id) return accounts[i]; return null; }
function accBalance(accId) {
  var a = accById(accId); if (!a) return 0;
  var d = 0, c = 0;
  for (var i = 0; i < entries.length; i++) for (var j = 0; j < entries[i].lines.length; j++) if (entries[i].lines[j].accId === accId) { d += entries[i].lines[j].debit; c += entries[i].lines[j].credit; }
  return (d - c) * DEBIT_NATURE[a.type];
}

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'dashboard') renderDashboard();
  if (v === 'accounts') renderAccounts();
  if (v === 'journal') renderJournal();
  if (v === 'ledger') renderLedger();
  if (v === 'trial') renderTrial();
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
  function onOk() { show(byId('loginErr'), false); state.user = { role: role }; toast('مرحباً ' + ROLES[role].name); setView('dashboard'); }
  function onFail() { show(byId('loginErr'), true); }
  var sync = window.JAOLA_SYNC;
  if (!sync) { if (pass !== settings.pass) return onFail(); return onOk(); }
  fetch(sync.api + '/api/public/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: pass }) })
    .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) onOk(); else onFail(); }).catch(onFail);
}
function logout() { state.user = null; state.draft = []; setView('login'); }

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function sumType(type) { var s = 0; for (var i = 0; i < accounts.length; i++) if (accounts[i].type === type) s += accBalance(accounts[i].id); return s; }
function renderDashboard() {
  var rev = sumType('revenue'), exp = sumType('expense');
  byId('dashStats').innerHTML =
    statCard('إجمالي الأصول', money(sumType('asset')), 'ok') +
    statCard('الإيرادات', money(rev), 'ok') +
    statCard('المصروفات', money(exp), 'warn') +
    statCard('صافي الربح', money(rev - exp), (rev - exp) >= 0 ? 'ok' : 'bad');
  byId('recentEntries').innerHTML = entries.length ? entries.slice().reverse().slice(0, 8).map(function (e) {
    var t = 0; for (var i = 0; i < e.lines.length; i++) t += e.lines[i].debit;
    return '<div class="low-row">📝 <b>#' + e.no + '</b> — ' + esc(e.desc || 'قيد') + ' · ' + money(t) + ' · ' + e.date + '</div>';
  }).join('') : '<p class="hint">لا قيود بعد.</p>';
}

function renderAccounts() {
  var rows = accounts.map(function (a) {
    return '<tr><td>' + esc(a.name) + '</td><td>' + TYPE_LABELS[a.type] + '</td><td>' + money(accBalance(a.id)) + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delAccount" data-id="' + a.id + '">حذف</button></td></tr>';
  }).join('');
  byId('accountsTable').innerHTML = '<tr><th>الحساب</th><th>النوع</th><th>الرصيد</th><th></th></tr>' +
    (rows || '<tr><td colspan="4" class="hint">لا حسابات بعد.</td></tr>');
}
function addAccount() {
  var name = byId('acName').value.trim(); if (!name) { toast('اكتب اسم الحساب'); return; }
  accounts.push({ id: uid('a'), name: name, type: byId('acType').value });
  save('accounts', accounts); byId('acName').value = ''; toast('أُضيف الحساب'); renderAccounts();
}
function delAccount(id) {
  for (var i = 0; i < entries.length; i++) for (var j = 0; j < entries[i].lines.length; j++) if (entries[i].lines[j].accId === id) { toast('لا يمكن حذف حساب له قيود'); return; }
  accounts = accounts.filter(function (a) { return a.id !== id; }); save('accounts', accounts); renderAccounts();
}

function fillAccountSelects() {
  var opts = accounts.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + ' (' + TYPE_LABELS[a.type] + ')</option>'; }).join('');
  var je = byId('jeAccount'); if (je) je.innerHTML = opts;
  var lg = byId('ledgerAccount'); if (lg) { lg.innerHTML = opts; if (state.ledgerAcc) lg.value = state.ledgerAcc; }
}
function draftTotals() { var d = 0, c = 0; for (var i = 0; i < state.draft.length; i++) { d += state.draft[i].debit; c += state.draft[i].credit; } return { d: d, c: c }; }
function renderJournal() {
  fillAccountSelects();
  byId('jeDate').value = byId('jeDate').value || today();
  renderDraft();
  var rows = entries.slice().reverse().slice(0, 40).map(function (e) {
    var t = 0; for (var i = 0; i < e.lines.length; i++) t += e.lines[i].debit;
    return '<tr><td>#' + e.no + '</td><td>' + e.date + '</td><td>' + esc(e.desc || '—') + '</td><td>' + e.lines.length + ' سطر</td><td>' + money(t) + '</td></tr>';
  }).join('');
  byId('entriesTable').innerHTML = '<tr><th>رقم</th><th>التاريخ</th><th>البيان</th><th>الأسطر</th><th>القيمة</th></tr>' +
    (rows || '<tr><td colspan="5" class="hint">لا قيود مرحّلة بعد.</td></tr>');
}
function renderDraft() {
  var t = draftTotals();
  byId('jeLinesTable').innerHTML = state.draft.length ? '<tr><th>الحساب</th><th>مدين</th><th>دائن</th><th></th></tr>' +
    state.draft.map(function (l, i) { var a = accById(l.accId); return '<tr><td>' + esc(a ? a.name : '؟') + '</td><td>' + (l.debit ? money(l.debit) : '—') + '</td><td>' + (l.credit ? money(l.credit) : '—') + '</td><td><button class="btn tiny ghost" data-action="delJeLine" data-idx="' + i + '">×</button></td></tr>'; }).join('') +
    '<tr style="font-weight:800"><td>الإجمالي</td><td>' + money(t.d) + '</td><td>' + money(t.c) + '</td><td></td></tr>' : '';
  var balanced = state.draft.length && Math.abs(t.d - t.c) < 0.005;
  byId('jeBalance').innerHTML = state.draft.length ? (balanced ? '<span style="color:var(--ok)">متوازن ✅</span>' : '<span style="color:var(--bad)">غير متوازن: فرق ' + money(Math.abs(t.d - t.c)) + '</span>') : '';
}
function addJeLine() {
  var accId = byId('jeAccount').value; var debit = parseFloat(byId('jeDebit').value) || 0; var credit = parseFloat(byId('jeCredit').value) || 0;
  if (!accId || (debit <= 0 && credit <= 0)) { toast('اختر الحساب وأدخل مبلغاً في مدين أو دائن'); return; }
  if (debit > 0 && credit > 0) { toast('السطر إمّا مدين أو دائن — لا الاثنين'); return; }
  state.draft.push({ accId: accId, debit: debit, credit: credit });
  byId('jeDebit').value = ''; byId('jeCredit').value = ''; renderDraft();
}
function delJeLine(i) { state.draft.splice(i, 1); renderDraft(); }
function postEntry() {
  if (state.draft.length < 2) { toast('القيد يحتاج سطرين على الأقل'); return; }
  var t = draftTotals();
  if (Math.abs(t.d - t.c) >= 0.005) { toast('القيد غير متوازن — مدين يجب أن يساوي دائن'); return; }
  var e = { id: uid('e'), no: settings.entrySeq++, date: byId('jeDate').value || today(), desc: byId('jeDesc').value.trim(), lines: state.draft.slice() };
  entries.push(e); state.draft = []; byId('jeDesc').value = '';
  save('entries', entries); save('settings', settings);
  toast('رُحّل القيد #' + e.no); renderJournal();
}

function renderLedger() {
  fillAccountSelects();
  var accId = state.ledgerAcc || (accounts[0] && accounts[0].id);
  state.ledgerAcc = accId; if (byId('ledgerAccount')) byId('ledgerAccount').value = accId;
  var rows = []; var running = 0; var a = accById(accId);
  for (var i = 0; i < entries.length; i++) for (var j = 0; j < entries[i].lines.length; j++) if (entries[i].lines[j].accId === accId) {
    var l = entries[i].lines[j]; running += (l.debit - l.credit) * (a ? DEBIT_NATURE[a.type] : 1);
    rows.push('<tr><td>' + entries[i].date + '</td><td>' + esc(entries[i].desc || '—') + '</td><td>' + (l.debit ? money(l.debit) : '—') + '</td><td>' + (l.credit ? money(l.credit) : '—') + '</td><td>' + money(running) + '</td></tr>');
  }
  byId('ledgerTable').innerHTML = '<tr><th>التاريخ</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr>' +
    (rows.join('') || '<tr><td colspan="5" class="hint">لا حركات على هذا الحساب.</td></tr>');
}
function pickLedger() { state.ledgerAcc = byId('ledgerAccount').value; renderLedger(); }

function renderTrial() {
  var totalD = 0, totalC = 0;
  var rows = accounts.map(function (a) {
    var bal = accBalance(a.id); var debit = 0, credit = 0;
    if (DEBIT_NATURE[a.type] === 1) { if (bal >= 0) debit = bal; else credit = -bal; }
    else { if (bal >= 0) credit = bal; else debit = -bal; }
    totalD += debit; totalC += credit;
    if (Math.abs(bal) < 0.005) return '';
    return '<tr><td>' + esc(a.name) + '</td><td>' + (debit ? money(debit) : '—') + '</td><td>' + (credit ? money(credit) : '—') + '</td></tr>';
  }).join('');
  byId('trialTable').innerHTML = '<tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr>' +
    (rows || '<tr><td colspan="3" class="hint">لا أرصدة بعد.</td></tr>') +
    '<tr style="font-weight:800"><td>الإجمالي</td><td>' + money(totalD) + '</td><td>' + money(totalC) + '</td></tr>';
  var rev = sumType('revenue'), exp = sumType('expense');
  byId('incomeStats').innerHTML =
    statCard('الإيرادات', money(rev), 'ok') + statCard('المصروفات', money(exp), 'warn') +
    statCard('صافي الدخل', money(rev - exp), (rev - exp) >= 0 ? 'ok' : 'bad') +
    statCard('توازن الميزان', Math.abs(totalD - totalC) < 0.01 ? 'متوازن ✅' : 'خلل ❌', Math.abs(totalD - totalC) < 0.01 ? 'ok' : 'bad');
}
function csvDownload(name, rows) {
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
function exportTrialCsv() {
  var rows = [['الحساب', 'النوع', 'الرصيد']];
  for (var i = 0; i < accounts.length; i++) rows.push([accounts[i].name, TYPE_LABELS[accounts[i].type], accBalance(accounts[i].id)]);
  csvDownload('trial-balance.csv', rows); toast('صُدّر الميزان CSV');
}

function renderSettings() { byId('stName').value = settings.name; byId('stCurrency').value = settings.currency; byId('stPass').value = ''; }
function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  settings.currency = byId('stCurrency').value.trim() || settings.currency;
  var np = byId('stPass').value.trim();
  if (np) { var sync = window.JAOLA_SYNC; if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np }) }).catch(function () {}); } else settings.pass = np; }
  save('settings', settings); byId('brandName').textContent = settings.name; toast('حُفظت الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addAccount': addAccount(); break;
    case 'delAccount': delAccount(a.dataset.id); break;
    case 'addJeLine': addJeLine(); break;
    case 'delJeLine': delJeLine(parseInt(a.dataset.idx, 10)); break;
    case 'postEntry': postEntry(); break;
    case 'exportTrialCsv': exportTrialCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function handleChange(e) { if (e.target && e.target.id === 'ledgerAccount') pickLedger(); }
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); document.addEventListener('change', handleChange); setView('login'); }
document.addEventListener('DOMContentLoaded', init);
`;

    return {
        id: 'jaola-accounting',
        track: 'system',
        category: 'system',
        name: 'نظام محاسبة',
        nameEn: 'Accounting Ledger',
        description: 'سيستم محاسبة داخلي بقيد مزدوج: دليل حسابات (أصول/خصوم/حقوق/إيراد/مصروف)، قيود يومية متوازنة (مدين=دائن)، دفتر أستاذ لكل حساب، ميزان مراجعة، وقائمة دخل — بأدوار (مدير مالي/محاسب).',
        descriptionEn: 'Internal double-entry accounting system: chart of accounts (asset/liability/equity/revenue/expense), balanced journal entries (debit=credit), per-account ledger, trial balance, and income summary — with roles (CFO/accountant).',
        keywords: ['محاسبة', 'محاسب', 'قيود', 'قيد يومية', 'قيد مزدوج', 'دفتر أستاذ', 'ميزان مراجعة', 'دليل حسابات', 'مدين دائن', 'قائمة دخل', 'حسابات مالية', 'accounting', 'ledger', 'journal', 'trial balance', 'double entry', 'chart of accounts', 'bookkeeping', 'debit credit'],
        model: {
            roles: [{ name: 'مدير مالي' }, { name: 'محاسب' }],
            entities: [{ name: 'حساب' }, { name: 'قيد يومية' }, { name: 'سطر قيد' }],
            flows: [{ name: 'بناء دليل الحسابات' }, { name: 'ترحيل قيد يومية متوازن (مدين=دائن)' }, { name: 'عرض دفتر الأستاذ لكل حساب' }, { name: 'ميزان مراجعة متوازن' }, { name: 'قائمة دخل (إيراد − مصروف)' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() },
        ],
    };
}
