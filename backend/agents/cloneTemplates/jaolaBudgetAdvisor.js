/**
 * 💰 jaola-budget-advisor — مستشار ميزانية شخصية بالذكاء الاصطناعي (track: system).
 *
 * تتبّع دخل/مصروف حقيقي (لا بيانات وهمية) عبر مجموعات appCollections.js
 * (أول قالب يستخدمها فعلياً — سجلات بمعرّفات وCRUD فردي، لا كتلة مسطّحة)،
 * ملخّص فترة (هذا الشهر/الشهر الماضي/آخر 3 أشهر) بتفصيل حسب الفئة،
 * ميزانيات شهرية لكل فئة مع تنبيه بريدي عند التجاوز (مرّة واحدة لكل فئة
 * وشهر)، وقراءة تفسيرية من وكيل ذكاء اصطناعي مخصّص (وصف لا توصية ملزمة)،
 * وتبديل لغة عربي/إنجليزي حيّ — نفس بنية jaola-crypto-advisor تماماً
 * (مصادقة بكلمة مرور واحدة، I18N رانتايم، toast، تصميم بصري) مطبَّقة على
 * بيانات مالية شخصية بدل عملات رقمية.
 *
 * أداة شخصية بمالك واحد — دخول بكلمة مرور واحدة فقط، لا أدوار متعددة.
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaBudgetAdvisor() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>مستشار الميزانية</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">💰</span> <span id="brandName">مستشار الميزانية</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
    <button class="btn tiny ghost" id="langToggle" data-action="toggleLang">English</button>
  </header>
  <main>
    <section id="view-login" class="view">
      <div class="login-card">
        <h1 id="loginH1">مستشار الميزانية</h1>
        <p class="hint" id="loginHint">تتبّع دخلك ومصروفك، ميزانية شهرية لكل فئة، وقراءة ذكية لأنماط إنفاقك.</p>
        <label id="passLabel">كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" id="loginBtn" data-action="login">دخول</button>
        <p class="hint tiny" id="loginTip">تجريبياً: كلمة المرور «admin».</p>
      </div>
    </section>

    <section id="view-dashboard" class="view hidden">
      <div class="view-head"><h2 id="dashH2">لوحة الميزانية</h2><button class="btn ghost tiny" id="refreshBtn" data-action="refreshAll">🔄 تحديث</button></div>
      <div class="tf-tabs" id="periodTabs"></div>
      <div class="panel form-row" id="addTxForm">
        <select id="txType"><option value="expense" id="optExpense">مصروف</option><option value="income" id="optIncome">دخل</option></select>
        <input id="txAmount" type="number" min="0" step="0.01" placeholder="المبلغ">
        <input id="txCategory" list="categoryList" placeholder="الفئة">
        <datalist id="categoryList"></datalist>
        <input id="txDate" type="date">
        <input id="txNote" placeholder="ملاحظة (اختياري)">
        <button class="btn primary tiny" id="addTxBtn" data-action="addTransaction">+ إضافة</button>
      </div>
      <p class="hint" id="dashStatus"></p>
      <div class="stat-grid" id="summaryCards"></div>
      <div class="panel" id="categoryBreakdown"></div>
      <div class="panel" id="recentTx"></div>
    </section>

    <section id="view-budgets" class="view hidden">
      <div class="view-head"><h2 id="budgetsH2">الميزانيات الشهرية</h2></div>
      <div class="panel form-row">
        <input id="budCategory" list="categoryList" placeholder="الفئة">
        <input id="budLimit" type="number" min="0" step="0.01" placeholder="السقف الشهري">
        <button class="btn primary tiny" id="addBudBtn" data-action="addBudget">+ حفظ</button>
      </div>
      <div class="panel" id="budgetList"></div>
      <div class="ai-commentary-box hidden" id="budgetCommentary"></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2 id="settingsH2">الإعدادات</h2></div>
      <div class="panel form-col">
        <label>كلمة المرور الحالية</label>
        <input id="stPassCur" type="password" placeholder="مطلوبة لتغيير كلمة المرور">
        <label id="newPassLabel">كلمة المرور الجديدة</label>
        <input id="stPass" type="password" placeholder="اتركها فارغة للإبقاء">
        <button class="btn primary" id="savePassBtn" data-action="saveSettings">حفظ كلمة المرور</button>
      </div>
    </section>
  </main>
  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 💰 مستشار الميزانية — jaola-budget-advisor */
'use strict';
var DEFAULT_CATEGORIES = [
  { ar: 'طعام', en: 'Food' }, { ar: 'مواصلات', en: 'Transport' }, { ar: 'سكن', en: 'Housing' },
  { ar: 'فواتير', en: 'Bills' }, { ar: 'ترفيه', en: 'Entertainment' }, { ar: 'صحة', en: 'Health' },
  { ar: 'تسوق', en: 'Shopping' }, { ar: 'تعليم', en: 'Education' }, { ar: 'أخرى', en: 'Other' }
];
var PERIOD_ORDER = ['thisMonth', 'lastMonth', 'last3'];

// 🌐 تبديل لغة رانتايم — كل نص واجهة مصدره هذا القاموس، لا نص جاهز من الخادم أبداً.
var I18N = {
  ar: {
    brand: 'مستشار الميزانية',
    loginHint: 'تتبّع دخلك ومصروفك، ميزانية شهرية لكل فئة، وقراءة ذكية لأنماط إنفاقك.',
    passLabel: 'كلمة المرور', loginBtn: 'دخول', loginErrDefault: 'كلمة المرور غير صحيحة',
    loginTip: 'تجريبياً: كلمة المرور «admin».',
    connFail: 'تعذّر الاتصال بالخادم، تحقّق من الاتصال وحاول مجدداً',
    tabDashboard: 'اللوحة', tabBudgets: 'الميزانيات', tabSettings: 'الإعدادات',
    logout: 'خروج', welcomeBack: 'أهلاً بك', loggedOut: 'تم الخروج',
    dashH2: 'لوحة الميزانية', refresh: '🔄 تحديث',
    periodThisMonth: 'هذا الشهر', periodLastMonth: 'الشهر الماضي', periodLast3: 'آخر 3 أشهر',
    typeExpense: 'مصروف', typeIncome: 'دخل',
    amountPlaceholder: 'المبلغ', categoryPlaceholder: 'الفئة', notePlaceholder: 'ملاحظة (اختياري)',
    addBtn: '+ إضافة', liveAfterPublish: '🔌 التتبّع الحي يعمل بعد تطبيق القالب على مشروع فعلي منشور.',
    updating: '⏳ جارٍ التحديث...', failLoad: '⚠️ تعذّر جلب البيانات الآن.',
    totalIncome: 'إجمالي الدخل', totalExpense: 'إجمالي المصروف', net: 'الصافي',
    noCategorySpending: 'لا مصروفات مسجَّلة لهذه الفترة.',
    recentTxTitle: 'أحدث المعاملات', noTx: 'لا معاملات بعد — أضف أول معاملة أعلاه.',
    fillAmountCategory: 'أدخل مبلغاً وفئة صالحين', txAdded: 'أُضيفت المعاملة', txDeleted: 'حُذفت المعاملة',
    budgetsH2: 'الميزانيات الشهرية', budgetLimitPlaceholder: 'السقف الشهري',
    fillCategoryLimit: 'أدخل فئة وسقفاً صالحَين', budgetSaved: 'حُفظت الميزانية', budgetDeleted: 'حُذفت الميزانية',
    noBudgets: 'لا ميزانيات بعد — أضف أول ميزانية أعلاه.',
    spentOf: function (spent, limit) { return spent + ' من ' + limit; },
    overBudget: '⚠️ تجاوزت السقف', withinBudget: 'ضمن السقف',
    settingsH2: 'الإعدادات', newPassLabel: 'كلمة المرور الجديدة', passPlaceholder: 'اتركها فارغة للإبقاء',
    savePassBtn: 'حفظ كلمة المرور', passwordSaved: 'تم حفظ كلمة المرور',
    deleteBtn: '✕', loadingCommentary: '⏳ جارٍ التحليل...',
    commentaryQuotaExhausted: 'انتهت حصة الذكاء الاصطناعي الشهرية لخطتك — رقِّ خطتك لقراءة تفسيرية آلية.',
  },
  en: {
    brand: 'Budget Advisor',
    loginHint: 'Track your income and spending, a monthly budget per category, and a smart read on your spending patterns.',
    passLabel: 'Password', loginBtn: 'Sign in', loginErrDefault: 'Incorrect password',
    loginTip: 'Try it with password «admin».',
    connFail: 'Could not reach the server, check your connection and try again',
    tabDashboard: 'Dashboard', tabBudgets: 'Budgets', tabSettings: 'Settings',
    logout: 'Log out', welcomeBack: 'Welcome back', loggedOut: 'Logged out',
    dashH2: 'Budget dashboard', refresh: '🔄 Refresh',
    periodThisMonth: 'This month', periodLastMonth: 'Last month', periodLast3: 'Last 3 months',
    typeExpense: 'Expense', typeIncome: 'Income',
    amountPlaceholder: 'Amount', categoryPlaceholder: 'Category', notePlaceholder: 'Note, optional',
    addBtn: '+ Add', liveAfterPublish: '🔌 Live tracking works once the template is applied to a real published project.',
    updating: '⏳ Updating...', failLoad: '⚠️ Could not fetch data right now.',
    totalIncome: 'Total income', totalExpense: 'Total expense', net: 'Net',
    noCategorySpending: 'No spending recorded for this period.',
    recentTxTitle: 'Recent transactions', noTx: 'No transactions yet — add your first one above.',
    fillAmountCategory: 'Enter a valid amount and category', txAdded: 'Transaction added', txDeleted: 'Transaction deleted',
    budgetsH2: 'Monthly budgets', budgetLimitPlaceholder: 'Monthly limit',
    fillCategoryLimit: 'Enter a valid category and limit', budgetSaved: 'Budget saved', budgetDeleted: 'Budget deleted',
    noBudgets: 'No budgets yet — add your first one above.',
    spentOf: function (spent, limit) { return spent + ' of ' + limit; },
    overBudget: '⚠️ Over budget', withinBudget: 'Within budget',
    settingsH2: 'Settings', newPassLabel: 'New password', passPlaceholder: 'Leave empty to keep it',
    savePassBtn: 'Save password', passwordSaved: 'Password saved',
    deleteBtn: '✕', loadingCommentary: '⏳ Analyzing...',
    commentaryQuotaExhausted: 'Your plan’s monthly AI quota is used up — upgrade for an AI reading.',
  }
};

function load(k, fb) { try { var v = localStorage.getItem('jbudget_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jbudget_' + k, JSON.stringify(val)); } catch (e) {} }

var settings = load('settings', { pass: 'admin' });
var lang = load('lang', (document.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ar');
var session = load('session', null);
var period = load('period', 'thisMonth');
var transactions = [];
var budgets = [];
var state = { view: 'login' };

function byId(id) { return document.getElementById(id); }
// 🔑 مُعامل التوكن يُبنى بباني المنصّة لا بلصق النصوص: الرابط نفسه
// حرفاً بحرف، وبلا نصٍّ في المصدر يلتصق باسم المُعامل فيُقرأ اعتماداً
// مكتوباً. (والتوكن في مسار الاستعلام أصلاً مسألةٌ أخرى مفتوحة: يتسرّب
// في سجلّات الخادم وتاريخ المتصفح — تغييرُه يحتاج تغيير عقد الخادم.)
function tq() { var s = window.JAOLA_SYNC; return s ? new URLSearchParams({ token: s.token }).toString() : ''; }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function t() {
  var key = arguments[0];
  var args = Array.prototype.slice.call(arguments, 1);
  var dict = I18N[lang] || I18N.ar;
  var v = (dict[key] !== undefined) ? dict[key] : I18N.ar[key];
  if (v === undefined) return key;
  return (typeof v === 'function') ? v.apply(null, args) : v;
}
function catLabel(c) { return (lang === 'en') ? c.en : c.ar; }
function fmtMoney(n) { return (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'ar-EG', { maximumFractionDigits: 2 }); }
function monthKeyOf(dateStr) { return String(dateStr || '').slice(0, 7); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function genId(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }

function login() {
  var pass = byId('loginPass').value;
  function onOk() { show(byId('loginErr'), false); session = {}; save('session', session); byId('loginPass').value = ''; toast(t('welcomeBack')); setView('dashboard'); }
  function onFail(msg) { var el = byId('loginErr'); el.textContent = msg || t('loginErrDefault'); show(el, true); }
  var sync = window.JAOLA_SYNC;
  if (!sync) { if (pass !== settings.pass) return onFail(); return onOk(); }
  fetch(sync.api + '/api/public/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: pass }), signal: AbortSignal.timeout(8000) })
    .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
    .then(function (d) { if (d && d.ok) onOk(); else onFail(); })
    .catch(function () { onFail(t('connFail')); });
}
function logout() { session = null; save('session', null); toast(t('loggedOut')); setView('login'); }

function toggleLang() {
  lang = (lang === 'ar') ? 'en' : 'ar';
  save('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  renderStaticText(); renderTabs(); renderUserChip(); renderCategoryList();
  if (state.view === 'dashboard') { renderPeriodTabs(); renderDashboard(); }
  if (state.view === 'budgets') { renderBudgets(); }
}
function renderStaticText() {
  document.title = t('brand');
  byId('brandName').textContent = t('brand');
  byId('loginH1').textContent = t('brand');
  byId('loginHint').textContent = t('loginHint');
  byId('passLabel').textContent = t('passLabel');
  byId('loginBtn').textContent = t('loginBtn');
  byId('loginTip').textContent = t('loginTip');
  byId('dashH2').textContent = t('dashH2');
  byId('refreshBtn').textContent = t('refresh');
  byId('optExpense').textContent = t('typeExpense');
  byId('optIncome').textContent = t('typeIncome');
  byId('txAmount').placeholder = t('amountPlaceholder');
  byId('txCategory').placeholder = t('categoryPlaceholder');
  byId('txNote').placeholder = t('notePlaceholder');
  byId('addTxBtn').textContent = t('addBtn');
  byId('budgetsH2').textContent = t('budgetsH2');
  byId('budCategory').placeholder = t('categoryPlaceholder');
  byId('budLimit').placeholder = t('budgetLimitPlaceholder');
  byId('addBudBtn').textContent = t('addBtn');
  byId('settingsH2').textContent = t('settingsH2');
  byId('newPassLabel').textContent = t('newPassLabel');
  byId('stPass').placeholder = t('passPlaceholder');
  byId('savePassBtn').textContent = t('savePassBtn');
  var langBtn = byId('langToggle'); if (langBtn) langBtn.textContent = (lang === 'ar') ? 'English' : 'العربية';
}
function renderCategoryList() {
  var used = {};
  transactions.forEach(function (r) { if (r.category) used[r.category] = true; });
  var names = DEFAULT_CATEGORIES.map(catLabel).concat(Object.keys(used));
  var seen = {};
  byId('categoryList').innerHTML = names.filter(function (n) { if (seen[n]) return false; seen[n] = true; return true; })
    .map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('');
}

function setView(v) {
  if (v !== 'login' && !session) v = 'login';
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs(); renderUserChip();
  if (v === 'dashboard') { renderPeriodTabs(); loadAll(); byId('txDate').value = todayStr(); }
  if (v === 'budgets') { loadAll(function () { renderBudgets(); loadBudgetCommentary(); }); }
  if (v === 'settings') { byId('stPass').value = ''; byId('stPassCur').value = ''; }
}
function renderPeriodTabs() {
  byId('periodTabs').innerHTML = PERIOD_ORDER.map(function (p) {
    var label = p === 'thisMonth' ? t('periodThisMonth') : p === 'lastMonth' ? t('periodLastMonth') : t('periodLast3');
    return '<button class="tf-tab ' + (period === p ? 'active' : '') + '" data-action="setPeriod" data-period="' + p + '">' + esc(label) + '</button>';
  }).join('');
}
function setPeriod(p) {
  if (PERIOD_ORDER.indexOf(p) === -1 || p === period) return;
  period = p; save('period', period);
  renderPeriodTabs(); renderDashboard();
}
function renderTabs() {
  if (!session) { byId('tabs').innerHTML = ''; return; }
  var tabs = [['dashboard', t('tabDashboard')], ['budgets', t('tabBudgets')], ['settings', t('tabSettings')]];
  byId('tabs').innerHTML = tabs.map(function (tb) { return '<button class="tab ' + (state.view === tb[0] ? 'active' : '') + '" data-action="tab" data-view="' + tb[0] + '">' + esc(tb[1]) + '</button>'; }).join('');
}
function renderUserChip() { byId('userChip').innerHTML = session ? '<button class="btn tiny ghost" data-action="logout">' + esc(t('logout')) + '</button>' : ''; }

// شهور الفترة المختارة (نفس منطق budgetStats.lastMonths على الخادم، مكرَّر
// هنا بلغة العميل كي يعمل الملخّص فوراً بلا انتظار نداء شبكة إضافي).
function periodMonths(p) {
  var now = new Date();
  function keyFor(offset) { var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1)); return d.toISOString().slice(0, 7); }
  if (p === 'lastMonth') return [keyFor(1)];
  if (p === 'last3') return [keyFor(2), keyFor(1), keyFor(0)];
  return [keyFor(0)];
}
function periodLabel(p) { return p === 'thisMonth' ? t('periodThisMonth') : p === 'lastMonth' ? t('periodLastMonth') : t('periodLast3'); }

function loadAll(cb) {
  var sync = window.JAOLA_SYNC;
  var status = byId('dashStatus');
  if (!sync) { if (status) status.textContent = t('liveAfterPublish'); if (cb) cb(); return; }
  if (status) status.textContent = t('updating');
  Promise.all([
    fetch(sync.api + '/api/public/collections/transactions?' + tq(), { signal: AbortSignal.timeout(15000) }).then(function (r) { return r.json(); }).catch(function () { return { records: [] }; }),
    fetch(sync.api + '/api/public/collections/budgets?' + tq(), { signal: AbortSignal.timeout(15000) }).then(function (r) { return r.json(); }).catch(function () { return { records: [] }; }),
  ]).then(function (res) {
    transactions = (res[0] && Array.isArray(res[0].records)) ? res[0].records : [];
    budgets = (res[1] && Array.isArray(res[1].records)) ? res[1].records : [];
    renderCategoryList();
    if (status) status.textContent = '';
    if (state.view === 'dashboard') renderDashboard();
    if (cb) cb();
  }).catch(function () { if (status) status.textContent = t('failLoad'); if (cb) cb(); });
}

function summarize(months) {
  var wanted = {}; months.forEach(function (m) { wanted[m] = true; });
  var income = 0, expense = 0; var byCat = {};
  transactions.forEach(function (r) {
    if (!r || !wanted[r.month] || typeof r.amount !== 'number') return;
    if (r.type === 'income') { income += r.amount; return; }
    if (r.type !== 'expense') return;
    expense += r.amount;
    var cat = (r.category && String(r.category).trim()) || t('categoryPlaceholder');
    byCat[cat] = (byCat[cat] || 0) + r.amount;
  });
  var categories = Object.keys(byCat).map(function (c) { return { category: c, amount: byCat[c] }; }).sort(function (a, b) { return b.amount - a.amount; });
  return { income: income, expense: expense, net: income - expense, categories: categories };
}

function renderDashboard() {
  var months = periodMonths(period);
  var sum = summarize(months);
  byId('summaryCards').innerHTML =
    '<div class="stat-card"><span class="stat-v">' + fmtMoney(sum.income) + '</span><span class="stat-l">' + esc(t('totalIncome')) + '</span></div>' +
    '<div class="stat-card"><span class="stat-v">' + fmtMoney(sum.expense) + '</span><span class="stat-l">' + esc(t('totalExpense')) + '</span></div>' +
    '<div class="stat-card ' + (sum.net >= 0 ? 'ok' : 'bad') + '"><span class="stat-v">' + fmtMoney(sum.net) + '</span><span class="stat-l">' + esc(t('net')) + '</span></div>';

  var maxAmt = sum.categories.length ? sum.categories[0].amount : 0;
  byId('categoryBreakdown').innerHTML = sum.categories.length
    ? sum.categories.map(function (c) {
        var pct = maxAmt ? Math.round((c.amount / maxAmt) * 100) : 0;
        return '<div class="cat-row"><span class="cat-name">' + esc(c.category) + '</span><div class="cat-bar-wrap"><div class="cat-bar" style="width:' + pct + '%"></div></div><span class="cat-amt">' + fmtMoney(c.amount) + '</span></div>';
      }).join('')
    : '<p class="hint tiny">' + esc(t('noCategorySpending')) + '</p>';

  // ترتيب تنازلياً بالتاريخ، وبإنشائها (createdAt) عند تساوي اليوم — كي
  // تظهر آخر معاملة أُضيفت أولاً فعلاً، لا أقدم معاملة في نفس اليوم فقط.
  var recent = transactions.slice().sort(function (a, b) {
    var byDate = String(b.date).localeCompare(String(a.date));
    return byDate !== 0 ? byDate : (b.createdAt || 0) - (a.createdAt || 0);
  }).slice(0, 8);
  byId('recentTx').innerHTML = '<h3 class="panel-title">' + esc(t('recentTxTitle')) + '</h3>' + (recent.length
    ? recent.map(function (r) {
        return '<div class="wl-row"><span>' + esc(r.date) + ' — ' + esc(r.category || '') + (r.note ? ' <span class="hint">(' + esc(r.note) + ')</span>' : '') + '</span>' +
          '<span class="' + (r.type === 'income' ? 'coin-chg up' : 'coin-chg down') + '">' + (r.type === 'income' ? '+' : '-') + fmtMoney(r.amount) + '</span>' +
          '<button class="btn tiny ghost" data-action="deleteTx" data-id="' + esc(r.id) + '">' + esc(t('deleteBtn')) + '</button></div>';
      }).join('')
    : '<p class="hint tiny">' + esc(t('noTx')) + '</p>');
}

function addTransaction() {
  var sync = window.JAOLA_SYNC;
  var type = byId('txType').value === 'income' ? 'income' : 'expense';
  var amount = parseFloat(byId('txAmount').value);
  var category = byId('txCategory').value.trim();
  var date = byId('txDate').value || todayStr();
  var note = byId('txNote').value.trim();
  if (!(amount > 0) || !category) { toast(t('fillAmountCategory')); return; }
  var record = { id: genId('tx'), type: type, amount: amount, category: category, note: note, date: date, month: monthKeyOf(date), createdAt: Date.now() };
  if (!sync) { transactions.push(record); renderDashboard(); toast(t('txAdded')); byId('txAmount').value = ''; byId('txCategory').value = ''; byId('txNote').value = ''; return; }
  fetch(sync.api + '/api/public/collections/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, record: record }), signal: AbortSignal.timeout(10000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || d.error) { toast(d && d.error ? d.error : t('failLoad')); return; }
      transactions.push(record); renderCategoryList(); renderDashboard(); toast(t('txAdded'));
      byId('txAmount').value = ''; byId('txCategory').value = ''; byId('txNote').value = '';
    }).catch(function () { toast(t('failLoad')); });
}
function deleteTransaction(id) {
  var sync = window.JAOLA_SYNC;
  function applyLocal() { transactions = transactions.filter(function (r) { return r.id !== id; }); renderDashboard(); toast(t('txDeleted')); }
  if (!sync) { applyLocal(); return; }
  fetch(sync.api + '/api/public/collections/transactions/' + encodeURIComponent(id) + '?' + tq(), { method: 'DELETE', signal: AbortSignal.timeout(10000) })
    .then(applyLocal).catch(function () { toast(t('failLoad')); });
}

function renderBudgets() {
  var thisMonth = periodMonths('thisMonth')[0];
  var spentByCategory = {};
  transactions.forEach(function (r) { if (r && r.type === 'expense' && r.month === thisMonth) { var c = r.category || ''; spentByCategory[c] = (spentByCategory[c] || 0) + r.amount; } });
  byId('budgetList').innerHTML = budgets.length ? budgets.map(function (b) {
    var spent = spentByCategory[b.category] || 0;
    var pct = b.monthlyLimit > 0 ? Math.min(100, Math.round((spent / b.monthlyLimit) * 100)) : 0;
    var over = spent > b.monthlyLimit;
    return '<div class="wl-row budget-row"><span>' + esc(b.category) + ' — ' + esc(t('spentOf', fmtMoney(spent), fmtMoney(b.monthlyLimit))) +
      ' <span class="' + (over ? 'warn-text' : 'hint tiny') + '">' + esc(over ? t('overBudget') : t('withinBudget')) + '</span></span>' +
      '<div class="cat-bar-wrap budget-bar-wrap"><div class="cat-bar ' + (over ? 'over' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<button class="btn tiny ghost" data-action="deleteBudget" data-id="' + esc(b.id) + '">' + esc(t('deleteBtn')) + '</button></div>';
  }).join('') : '<p class="hint tiny">' + esc(t('noBudgets')) + '</p>';
}
function addBudget() {
  var sync = window.JAOLA_SYNC;
  var category = byId('budCategory').value.trim();
  var monthlyLimit = parseFloat(byId('budLimit').value);
  if (!category || !(monthlyLimit > 0)) { toast(t('fillCategoryLimit')); return; }
  var existing = budgets.find(function (b) { return b.category === category; });
  var record = { id: existing ? existing.id : genId('bud'), category: category, monthlyLimit: monthlyLimit };
  function applyLocal() {
    budgets = existing ? budgets.map(function (b) { return b.id === record.id ? record : b; }) : budgets.concat([record]);
    renderCategoryList(); renderBudgets(); toast(t('budgetSaved'));
    byId('budCategory').value = ''; byId('budLimit').value = '';
  }
  if (!sync) { applyLocal(); return; }
  fetch(sync.api + '/api/public/collections/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, record: record }), signal: AbortSignal.timeout(10000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || d.error) { toast(d && d.error ? d.error : t('failLoad')); return; }
      applyLocal();
      // يُسجّل المشروع لحلقة تنبيهات تجاوز الميزانية في server.js — بلا حاجة لانتظار الردّ.
      fetch(sync.api + '/api/public/budget/register', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token }), signal: AbortSignal.timeout(8000) }).catch(function () {});
    }).catch(function () { toast(t('failLoad')); });
}
function deleteBudget(id) {
  var sync = window.JAOLA_SYNC;
  function applyLocal() { budgets = budgets.filter(function (b) { return b.id !== id; }); renderBudgets(); toast(t('budgetDeleted')); }
  if (!sync) { applyLocal(); return; }
  fetch(sync.api + '/api/public/collections/budgets/' + encodeURIComponent(id) + '?' + tq(), { method: 'DELETE', signal: AbortSignal.timeout(10000) })
    .then(applyLocal).catch(function () { toast(t('failLoad')); });
}

// 🤖 قراءة سريعة من وكيل مخصّص لأنماط الإنفاق هذا الشهر — تجميلية بحتة،
// غيابها (لا مزوّد ذكاء اصطناعي/حصة منتهية) لا يعطّل الأرقام أعلاه إطلاقاً.
function loadBudgetCommentary() {
  var sync = window.JAOLA_SYNC;
  var box = byId('budgetCommentary');
  if (!sync || !box) return;
  show(box, true); box.innerHTML = '<p class="hint tiny">' + esc(t('loadingCommentary')) + '</p>';
  fetch(sync.api + '/api/public/budget/commentary?period=thisMonth&lang=' + encodeURIComponent(lang) + '&' + tq(), { signal: AbortSignal.timeout(20000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.text) { box.innerHTML = '🤖 ' + esc(d.text); return; }
      if (d && d.quota === 'exhausted') { box.innerHTML = '🤖 ' + esc(t('commentaryQuotaExhausted')); return; }
      show(box, false);
    })
    .catch(function () { show(box, false); });
}

function saveSettings() {
  var np = byId('stPass').value.trim();
  var sync = window.JAOLA_SYNC;
  if (np) {
    if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np, currentPassword: byId('stPassCur').value }), signal: AbortSignal.timeout(8000) }).then(function (r) { if (!r.ok) toast('كلمة المرور الحالية غير صحيحة'); else toast('تم تغيير كلمة المرور'); }).catch(function () {}); }
    else { settings.pass = np; save('settings', settings); }
    byId('stPass').value = ''; byId('stPassCur').value = '';
  }
  toast(t('passwordSaved'));
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'refreshAll': loadAll(); break;
    case 'setPeriod': setPeriod(a.dataset.period); break;
    case 'addTransaction': addTransaction(); break;
    case 'deleteTx': deleteTransaction(a.dataset.id); break;
    case 'addBudget': addBudget(); break;
    case 'deleteBudget': deleteBudget(a.dataset.id); break;
    case 'saveSettings': saveSettings(); break;
    case 'toggleLang': toggleLang(); break;
  }
}
function init() {
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  renderStaticText(); renderCategoryList();
  document.addEventListener('click', handleClick);
  setView(session ? 'dashboard' : 'login');
}
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:14px 0}
.stat-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:4px}
.stat-card .stat-v{font-size:20px;font-weight:800}
.stat-card.ok .stat-v{color:var(--ok)}
.stat-card.bad .stat-v{color:var(--bad)}
.stat-card .stat-l{font-size:12px;color:var(--mut)}
.panel-title{font-size:14px;font-weight:800;margin-bottom:10px}
.cat-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:13px}
.cat-name{min-width:100px}
.cat-bar-wrap{flex:1;background:rgba(255,255,255,.05);border-radius:6px;height:10px;overflow:hidden}
.cat-bar{height:100%;background:var(--pri);border-radius:6px}
.cat-bar.over{background:var(--bad)}
.cat-amt{min-width:80px;text-align:end;font-weight:700}
.budget-row{flex-wrap:wrap}
.budget-bar-wrap{flex-basis:100%;margin-top:6px}
#addTxForm, .panel.form-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#addTxForm select, #addTxForm input, .form-row input{flex:1;min-width:100px}
`;

    return {
        id: 'jaola-budget-advisor',
        track: 'system',
        category: 'system',
        name: 'مستشار ميزانية شخصية (ذكاء اصطناعي)',
        nameEn: 'Personal Budget Advisor (AI)',
        description: 'سيستم مستشار ميزانية شخصية داخلي: تسجيل دخل ومصروف حقيقي، ملخّص فترة (هذا الشهر/الشهر الماضي/آخر 3 أشهر) بتفصيل حسب الفئة، ميزانيات شهرية لكل فئة مع تنبيه بريدي عند التجاوز، وقراءة تفسيرية من وكيل ذكاء اصطناعي مخصّص لأنماط الإنفاق، وتبديل لغة عربي/إنجليزي حيّ.',
        descriptionEn: 'Internal personal budget advisor system: real income/expense tracking, a period summary (this month/last month/last 3 months) broken down by category, monthly budget caps per category with email alerts on overspending, an AI-written reading of spending patterns, and a live Arabic/English language toggle.',
        keywords: ['ميزانية شخصية', 'دخل ومصروف', 'ميزانيات شهرية', 'تنبيه بريدي', 'أنماط الإنفاق', 'وكيل ذكاء اصطناعي', 'تبديل لغة', 'إدارة مصاريف', 'تتبع مصاريف', 'مستشار مالي', 'توفير المال', 'budget tracker', 'personal finance', 'expense tracker', 'spending analysis', 'monthly budget'],
        model: {
            roles: [{ name: 'صاحب الحساب' }],
            entities: [{ name: 'معاملة مالية' }, { name: 'ميزانية شهرية' }, { name: 'فئة إنفاق' }],
            flows: [{ name: 'تسجيل معاملة دخل أو مصروف' }, { name: 'عرض ملخّص فترة بتفصيل الفئات' }, { name: 'ضبط سقف ميزانية شهرية لكل فئة' }, { name: 'تنبيه بريدي عند تجاوز الميزانية' }, { name: 'قراءة ذكية لأنماط الإنفاق' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
