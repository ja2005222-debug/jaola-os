/**
 * 📈 jaola-stock-advisor — مستشار أسهم/فوركس داخلي (track: system).
 *
 * نفس بنية jaola-crypto-advisor بالضبط (مصادقة بكلمة مرور واحدة، تبديل
 * لغة عربي/إنجليزي حيّ، ticker "أقوى الفرص"، سجل أداء شفّاف، آلية أفلييت
 * اختيارية، تقييد حسب الخطة) مطبَّقة على أسهم وأزواج فوركس حقيقية بدل
 * عملات رقمية — بيانات من backend/services/stockMarket.js (Yahoo Finance،
 * بلا مفتاح). عرض وتحليل فقط، لا تنفيذ تداول آلي أبداً.
 *
 * أداة شخصية بمالك واحد — دخول بكلمة مرور واحدة فقط، لا أدوار متعددة.
 * قالب منفصل عمداً عن jaola-crypto-advisor (سوق مختلف تماماً)، تماماً
 * كما بُني jaola-budget-advisor منفصلاً رغم مشاركة الكثير من البنية.
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaStockAdvisor() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>مستشار الأسهم والفوركس</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">📈</span> <span id="brandName">مستشار الأسهم والفوركس</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
    <button class="btn tiny ghost" id="langToggle" data-action="toggleLang">English</button>
  </header>
  <main>
    <section id="view-login" class="view">
      <div class="login-card">
        <h1 id="loginH1">مستشار الأسهم والفوركس</h1>
        <p class="hint" id="loginHint">تحليل فني (SMA/RSI) لقائمة متابعتك من الأسهم وأزواج الفوركس + إشارة شراء/بيع/انتظار مفسَّرة.</p>
        <label id="passLabel">كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" id="loginBtn" data-action="login">دخول</button>
        <p class="hint tiny" id="loginTip">تجريبياً: كلمة المرور «admin». تنبيه: هذا تحليل آلي وليس نصيحة استثمارية.</p>
      </div>
    </section>

    <section id="view-dashboard" class="view hidden">
      <div class="ticker-wrap hidden" id="oppTicker"><div class="ticker-track" id="oppTrack"></div></div>
      <div class="view-head"><h2 id="dashH2">قائمة المتابعة</h2><button class="btn ghost tiny" id="refreshMarketsBtn" data-action="refreshMarkets">🔄 تحديث</button></div>
      <p class="hint" id="dashStatus"></p>
      <div class="coin-grid" id="coinGrid"></div>
      <p class="hint tiny disclaimer" id="dashDisclaimer">⚠️ تحليل إحصائي آلي وليس نصيحة استثمارية ملزمة — قرار التداول مسؤوليتك الكاملة.</p>
    </section>

    <section id="view-analysis" class="view hidden">
      <div class="view-head"><h2 id="anaTitle">تحليل</h2>
        <div>
          <button class="btn ghost tiny" id="refreshAnalysisBtn" data-action="refreshAnalysis">🔄 تحديث</button>
          <button class="btn ghost tiny" id="backDashboardBtn" data-action="backDashboard">→ القائمة</button>
        </div>
      </div>
      <div class="tf-tabs" id="tfTabs"></div>
      <div class="panel" id="anaBody"><p class="hint">⏳ جارٍ التحميل...</p></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2 id="settingsH2">الإعدادات</h2></div>
      <div class="panel form-col">
        <label id="currentWlLabel">قائمة المتابعة الحالية</label>
        <div id="watchlistCurrent" class="watchlist-box"></div>
        <label id="quickAddLabel">إضافة سريعة</label>
        <div id="quickAddCoins" class="quick-add"></div>
        <label id="searchLabel">بحث عن رمز آخر</label>
        <div class="form-row">
          <input id="coinSearchInput" placeholder="اكتب رمز السهم أو زوج الفوركس...">
          <button class="btn ghost tiny" id="searchBtn" data-action="searchCoin">بحث</button>
        </div>
        <div id="coinSearchResults" class="watchlist-box"></div>
      </div>
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

    const APP_JS = `/* 📈 مستشار الأسهم والفوركس — jaola-stock-advisor */
'use strict';
// رموز مقترحة (يجب أن تطابق SUPPORTED_SYMBOLS في backend/services/stockMarket.js)
var ALL_COINS = [
  { id: 'AAPL', symbol: 'AAPL', nameAr: 'أبل', nameEn: 'Apple', type: 'stock' },
  { id: 'MSFT', symbol: 'MSFT', nameAr: 'مايكروسوفت', nameEn: 'Microsoft', type: 'stock' },
  { id: 'GOOGL', symbol: 'GOOGL', nameAr: 'جوجل', nameEn: 'Google', type: 'stock' },
  { id: 'AMZN', symbol: 'AMZN', nameAr: 'أمازون', nameEn: 'Amazon', type: 'stock' },
  { id: 'TSLA', symbol: 'TSLA', nameAr: 'تسلا', nameEn: 'Tesla', type: 'stock' },
  { id: 'NVDA', symbol: 'NVDA', nameAr: 'إنفيديا', nameEn: 'Nvidia', type: 'stock' },
  { id: 'EURUSD=X', symbol: 'EURUSD', nameAr: 'يورو/دولار', nameEn: 'EUR/USD', type: 'forex' },
  { id: 'GBPUSD=X', symbol: 'GBPUSD', nameAr: 'إسترليني/دولار', nameEn: 'GBP/USD', type: 'forex' },
  { id: 'USDJPY=X', symbol: 'USDJPY', nameAr: 'دولار/ين ياباني', nameEn: 'USD/JPY', type: 'forex' },
  { id: 'USDSAR=X', symbol: 'USDSAR', nameAr: 'دولار/ريال سعودي', nameEn: 'USD/SAR', type: 'forex' }
];

// 🌐 تبديل لغة رانتايم — كل نص واجهة مصدره هذا القاموس، لا نص جاهز من الخادم أبداً.
var I18N = {
  ar: {
    brand: 'مستشار الأسهم والفوركس',
    loginHint: 'تحليل فني (SMA/RSI) لقائمة متابعتك من الأسهم وأزواج الفوركس + إشارة شراء/بيع/انتظار مفسَّرة.',
    passLabel: 'كلمة المرور',
    loginBtn: 'دخول',
    loginErrDefault: 'كلمة المرور غير صحيحة',
    loginTip: 'تجريبياً: كلمة المرور «admin». تنبيه: هذا تحليل آلي وليس نصيحة استثمارية.',
    connFail: 'تعذّر الاتصال بالخادم، تحقّق من الاتصال وحاول مجدداً',
    tabWatchlist: 'المتابعة',
    tabSettings: 'الإعدادات',
    logout: 'خروج',
    welcomeBack: 'أهلاً بك',
    loggedOut: 'تم الخروج',
    dashH2: 'قائمة المتابعة',
    refresh: '🔄 تحديث',
    dashDisclaimer: '⚠️ تحليل إحصائي آلي وليس نصيحة استثمارية ملزمة — قرار التداول مسؤوليتك الكاملة.',
    emptyWatchlist: 'أضف أسهماً أو أزواج فوركس لمتابعتها من الإعدادات.',
    liveAfterPublish: '🔌 التحليل الحي يعمل بعد تطبيق القالب على مشروع فعلي منشور.',
    updating: '⏳ جارٍ التحديث...',
    staleMarkets: '⚠️ بيانات قديمة — تعذّر التحديث الآن.',
    failMarkets: '⚠️ تعذّر جلب الأسعار الآن.',
    backList: '→ القائمة',
    loading: '⏳ جارٍ التحميل...',
    failAnalysis: '⚠️ تعذّر جلب التحليل الآن — حاول مجدداً.',
    staleAnalysis: '⚠️ بيانات قديمة (تعذّر التحديث الآن)',
    signalBuy: 'شراء', signalSell: 'بيع', signalHold: 'انتظار',
    smaLabel: 'متوسط',
    hourFew: 'ساعات', hourMany: 'ساعة',
    dayFew: 'أيام', dayMany: 'يوماً',
    typeStock: 'سهم', typeForex: 'فوركس',
    rsiOverbought: function (r) { return 'مؤشر القوة النسبية (RSI) في منطقة تشبّع شرائي (' + r + ') — احتمال تصحيح هابط.'; },
    rsiOversold: function (r) { return 'مؤشر القوة النسبية (RSI) في منطقة تشبّع بيعي (' + r + ') — احتمال ارتداد صاعد.'; },
    smaBullish: function (s, l) { return 'المتوسط المتحرك قصير المدى (' + s + ') أعلى من طويل المدى (' + l + ') — اتجاه صاعد.'; },
    smaBearish: function (s, l) { return 'المتوسط المتحرك قصير المدى (' + s + ') أدنى من طويل المدى (' + l + ') — اتجاه هابط.'; },
    noSignal: 'لا إشارة فنية واضحة حالياً — البيانات غير كافية أو السوق متذبذب.',
    disclaimerLong: 'تنبيه: هذا تحليل إحصائي آلي وليس نصيحة استثمارية ملزمة — قرار التداول ونتيجته مسؤوليتك الكاملة.',
    trackRecordLabel: 'دقة الإشارات السابقة',
    trackRecordNoData: 'لا توجد بيانات كافية بعد لقياس الدقة على هذا المدى.',
    trackRecordSummary: function (rate, hits, judged) { return 'نجحت ' + hits + ' من ' + judged + ' توقّعات محسومة (' + rate + '%) لهذا الرمز على هذا المدى.'; },
    tradeBtn: function (sym) { return 'تداول ' + sym + ' الآن ↗'; },
    affiliateDisclosure: 'رابط إحالة خارجي — قد نحصل على عمولة دون أي تكلفة إضافية عليك.',
    commentaryQuotaExhausted: 'انتهت حصة الذكاء الاصطناعي الشهرية لخطتك — رقِّ خطتك لقراءة تفسيرية آلية لكل رمز.',
    tfDay: 'يومي', tfWeek: 'أسبوعي', tfLong: 'طويل المدى',
    settingsH2: 'الإعدادات',
    currentWlLabel: 'قائمة المتابعة الحالية',
    noWatchlist: 'لا رموز متابَعة بعد.',
    quickAddLabel: 'إضافة سريعة',
    allAdded: 'كل الرموز الشائعة مضافة بالفعل.',
    searchLabel: 'بحث عن رمز آخر',
    searchPlaceholder: 'اكتب رمز السهم أو زوج الفوركس...',
    searchBtn: 'بحث',
    searchWorking: 'البحث يعمل بعد تطبيق القالب على مشروع فعلي منشور.',
    typeTwoChars: 'اكتب حرفين على الأقل',
    searching: '⏳ جارٍ البحث...',
    noResults: 'لا نتائج.',
    searchFail: '⚠️ تعذّر البحث الآن.',
    alreadyAdded: 'مُضافة',
    addBtn: '+ إضافة',
    newPassLabel: 'كلمة المرور الجديدة',
    passPlaceholder: 'اتركها فارغة للإبقاء',
    savePassBtn: 'حفظ كلمة المرور',
    passwordSaved: 'تم حفظ كلمة المرور',
    alreadyInWatchlist: 'الرمز مضاف بالفعل',
    maxWatchlist: function (n) { return 'وصلت للحد الأقصى لعدد الرموز المتابَعة في خطتك (' + n + ') — رقِّ خطتك للمزيد.'; },
    addedToWatchlist: 'أُضيف للمتابعة',
    keepAtLeastOne: 'يجب أن يبقى رمز واحد على الأقل للمتابعة',
    removedFromWatchlist: 'أُزيل من المتابعة'
  },
  en: {
    brand: 'Stocks & Forex Advisor',
    loginHint: 'Technical analysis using SMA/RSI for your stocks and forex watchlist, plus an explained buy/sell/hold signal.',
    passLabel: 'Password',
    loginBtn: 'Sign in',
    loginErrDefault: 'Incorrect password',
    loginTip: 'Try it with password «admin». Note: this is automated analysis, not investment advice.',
    connFail: 'Could not reach the server, check your connection and try again',
    tabWatchlist: 'Watchlist',
    tabSettings: 'Settings',
    logout: 'Log out',
    welcomeBack: 'Welcome back',
    loggedOut: 'Logged out',
    dashH2: 'Watchlist',
    refresh: '🔄 Refresh',
    dashDisclaimer: '⚠️ Automated statistical analysis, not binding investment advice — the trading decision is entirely your responsibility.',
    emptyWatchlist: 'Add stocks or forex pairs to follow from Settings.',
    liveAfterPublish: '🔌 Live analysis works once the template is applied to a real published project.',
    updating: '⏳ Updating...',
    staleMarkets: '⚠️ Stale data — could not refresh right now.',
    failMarkets: '⚠️ Could not fetch prices right now.',
    backList: '→ List',
    loading: '⏳ Loading...',
    failAnalysis: '⚠️ Could not fetch the analysis — try again.',
    staleAnalysis: '⚠️ Stale data — could not refresh right now',
    signalBuy: 'Buy', signalSell: 'Sell', signalHold: 'Hold',
    smaLabel: 'Average',
    hourFew: 'hours', hourMany: 'hours',
    dayFew: 'days', dayMany: 'days',
    typeStock: 'Stock', typeForex: 'Forex',
    rsiOverbought: function (r) { return 'RSI is overbought at ' + r + ' — a pullback is possible.'; },
    rsiOversold: function (r) { return 'RSI is oversold at ' + r + ' — a rebound is possible.'; },
    smaBullish: function (s, l) { return 'The short-term average over ' + s + ' is above the long-term average over ' + l + ' — an uptrend.'; },
    smaBearish: function (s, l) { return 'The short-term average over ' + s + ' is below the long-term average over ' + l + ' — a downtrend.'; },
    noSignal: 'No clear technical signal right now — insufficient data or a choppy market.',
    disclaimerLong: 'Note: this is automated statistical analysis, not binding investment advice — the trading decision and its outcome are entirely your responsibility.',
    trackRecordLabel: 'Past signal accuracy',
    trackRecordNoData: 'Not enough resolved predictions yet to measure accuracy for this timeframe.',
    trackRecordSummary: function (rate, hits, judged) { return hits + ' out of ' + judged + ' resolved predictions hit their target — ' + rate + '% for this symbol on this timeframe.'; },
    tradeBtn: function (sym) { return 'Trade ' + sym + ' now ↗'; },
    affiliateDisclosure: 'External affiliate link — we may earn a commission at no extra cost to you.',
    commentaryQuotaExhausted: 'Your plan’s monthly AI quota is used up — upgrade for an AI reading on every symbol.',
    tfDay: 'Daily', tfWeek: 'Weekly', tfLong: 'Long-term',
    settingsH2: 'Settings',
    currentWlLabel: 'Current watchlist',
    noWatchlist: 'No symbols followed yet.',
    quickAddLabel: 'Quick add',
    allAdded: 'All popular symbols are already added.',
    searchLabel: 'Search for another symbol',
    searchPlaceholder: 'Type a stock ticker or forex pair...',
    searchBtn: 'Search',
    searchWorking: 'Search works once the template is applied to a real published project.',
    typeTwoChars: 'Type at least two characters',
    searching: '⏳ Searching...',
    noResults: 'No results.',
    searchFail: '⚠️ Could not search right now.',
    alreadyAdded: 'Added',
    addBtn: '+ Add',
    newPassLabel: 'New password',
    passPlaceholder: 'Leave empty to keep it',
    savePassBtn: 'Save password',
    passwordSaved: 'Password saved',
    alreadyInWatchlist: 'Already in your watchlist',
    maxWatchlist: function (n) { return 'You reached your plan’s maximum of ' + n + ' followed symbols — upgrade for more.'; },
    addedToWatchlist: 'Added to watchlist',
    keepAtLeastOne: 'At least one symbol must remain in your watchlist',
    removedFromWatchlist: 'Removed from watchlist'
  }
};

function load(k, fb) { try { var v = localStorage.getItem('jstock_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jstock_' + k, JSON.stringify(val)); } catch (e) {} }

var MAX_WATCHLIST = 20; // سقف تقني مطلق (دفعة نداء واحدة) — الحد الفعلي (watchlistMax) قد يكون أقل حسب الخطة
var TIMEFRAME_ORDER = ['day', 'week', 'long'];
var settings = load('settings', { pass: 'admin' });
var watchlist = load('watchlist', ['AAPL', 'MSFT', 'EURUSD=X']);
var timeframe = load('timeframe', 'week');
// لغة الواجهة: يفضَّل اختيار المستخدم المحفوظ، وإلا لغة index.html المبنية
// أصلاً عبر templateLocalizer.js (lang="en" لو بُني الموقع بالإنجليزية).
var lang = load('lang', (document.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ar');
var session = load('session', null);
var watchlistMax = MAX_WATCHLIST; // يُحدَّث فعلياً من الخادم حسب خطة صاحب المشروع (loadLimits)
var marketsData = {};
var pollTimers = {};
var state = { view: 'login', activeCoin: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
// t(key, ...args): يعيد نص القاموس بلغة الحالة، ويقع للعربية إن غاب المفتاح بالإنجليزية.
function t() {
  var key = arguments[0];
  var args = Array.prototype.slice.call(arguments, 1);
  var dict = I18N[lang] || I18N.ar;
  var v = (dict[key] !== undefined) ? dict[key] : I18N.ar[key];
  if (v === undefined) return key;
  return (typeof v === 'function') ? v.apply(null, args) : v;
}
function coinMeta(id) { for (var i = 0; i < ALL_COINS.length; i++) if (ALL_COINS[i].id === id) return ALL_COINS[i]; return null; }
function displayName(id) { var c = coinMeta(id); if (c) return (lang === 'en') ? c.nameEn : c.nameAr; var m = marketsData[id]; return (m && m.name) || id; }
function displaySymbol(id) { var c = coinMeta(id); if (c) return c.symbol; var m = marketsData[id]; return (m && m.symbol) || id; }
// نوع الرمز (سهم/فوركس) — من القائمة المعروفة، أو استنتاج بسيط من صيغة رمز
// Yahoo لأزواج الفوركس (لاحقة =X) لأي رمز مُضاف عبر البحث.
function symbolType(id) { var c = coinMeta(id); if (c) return c.type; return /=X$/.test(id) ? 'forex' : 'stock'; }
function typeLabel(id) { return symbolType(id) === 'forex' ? t('typeForex') : t('typeStock'); }
// الفوركس نسبة تبادل (لا مبلغ دولاري) — تُعرض بلا رمز $ وبدقّة أعلى.
function fmtPrice(n, id) {
  if (n == null) return '—';
  if (id && symbolType(id) === 'forex') return Number(n).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 4 : 2 });
}
function fmtPct(n) { return (n == null) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function signalLabel(s) { return s === 'buy' ? t('signalBuy') : s === 'sell' ? t('signalSell') : t('signalHold'); }
function signalClass(s) { return s === 'buy' ? 'sig-buy' : s === 'sell' ? 'sig-sell' : 'sig-hold'; }
function timeframeLabel(tf) { return tf === 'day' ? t('tfDay') : tf === 'long' ? t('tfLong') : t('tfWeek'); }
function periodPhrase(n, unit) {
  if (unit === 'hour') return n + ' ' + (n <= 10 ? t('hourFew') : t('hourMany'));
  return n + ' ' + (n <= 10 ? t('dayFew') : t('dayMany'));
}
function reasonText(a) {
  var rsiTxt = (a.rsi != null) ? a.rsi.toFixed(0) : '—';
  var shortP = periodPhrase(a.smaShortPeriod, a.periodUnit);
  var longP = periodPhrase(a.smaLongPeriod, a.periodUnit);
  switch (a.reasonCode) {
    case 'rsi_overbought': return t('rsiOverbought', rsiTxt);
    case 'rsi_oversold': return t('rsiOversold', rsiTxt);
    case 'sma_bullish': return t('smaBullish', shortP, longP);
    case 'sma_bearish': return t('smaBearish', shortP, longP);
    default: return t('noSignal');
  }
}

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
function logout() { stopPolling(); session = null; save('session', null); toast(t('loggedOut')); setView('login'); }

function startPolling(name, fn, ms) { stopPolling(name); pollTimers[name] = setInterval(fn, ms); }
function stopPolling(name) {
  if (name) { if (pollTimers[name]) { clearInterval(pollTimers[name]); delete pollTimers[name]; } return; }
  for (var k in pollTimers) clearInterval(pollTimers[k]);
  pollTimers = {};
}

function toggleLang() {
  lang = (lang === 'ar') ? 'en' : 'ar';
  save('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  renderStaticText();
  renderTabs(); renderUserChip();
  if (state.view === 'dashboard') { renderWatchlistShell(); loadMarkets(); loadOpportunities(); }
  if (state.view === 'analysis') { renderTfTabs(); renderAnalysisShell(); loadAnalysis(state.activeCoin); }
  if (state.view === 'settings') { renderWatchlistSettings(); }
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
  byId('refreshMarketsBtn').textContent = t('refresh');
  byId('dashDisclaimer').textContent = t('dashDisclaimer');
  byId('refreshAnalysisBtn').textContent = t('refresh');
  byId('backDashboardBtn').textContent = t('backList');
  byId('settingsH2').textContent = t('settingsH2');
  byId('currentWlLabel').textContent = t('currentWlLabel');
  byId('quickAddLabel').textContent = t('quickAddLabel');
  byId('searchLabel').textContent = t('searchLabel');
  byId('coinSearchInput').placeholder = t('searchPlaceholder');
  byId('searchBtn').textContent = t('searchBtn');
  byId('newPassLabel').textContent = t('newPassLabel');
  byId('stPass').placeholder = t('passPlaceholder');
  byId('savePassBtn').textContent = t('savePassBtn');
  var langBtn = byId('langToggle'); if (langBtn) langBtn.textContent = (lang === 'ar') ? 'English' : 'العربية';
}

function setView(v) {
  if (v !== 'login' && !session) v = 'login';
  stopPolling();
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs(); renderUserChip();
  if (v === 'dashboard') {
    renderWatchlistShell(); loadMarkets(); loadOpportunities();
    startPolling('markets', loadMarkets, 60000);
    startPolling('opportunities', loadOpportunities, 180000);
  }
  if (v === 'analysis') {
    renderTfTabs(); renderAnalysisShell(); loadAnalysis(state.activeCoin);
    startPolling('analysis', function () { loadAnalysis(state.activeCoin); }, 60000);
  }
  if (v === 'settings') { renderWatchlistSettings(); byId('coinSearchInput').value = ''; byId('stPass').value = ''; byId('stPassCur').value = ''; loadLimits(); }
}
function renderTfTabs() {
  byId('tfTabs').innerHTML = TIMEFRAME_ORDER.map(function (tf) {
    return '<button class="tf-tab ' + (timeframe === tf ? 'active' : '') + '" data-action="setTimeframe" data-tf="' + tf + '">' + esc(timeframeLabel(tf)) + '</button>';
  }).join('');
}
function setTimeframe(tf) {
  if (TIMEFRAME_ORDER.indexOf(tf) === -1 || tf === timeframe) return;
  timeframe = tf; save('timeframe', timeframe);
  renderTfTabs();
  renderAnalysisShell();
  loadAnalysis(state.activeCoin);
}
function renderTabs() {
  if (!session) { byId('tabs').innerHTML = ''; return; }
  var tabs = [['dashboard', t('tabWatchlist')], ['settings', t('tabSettings')]];
  byId('tabs').innerHTML = tabs.map(function (tb) { return '<button class="tab ' + (state.view === tb[0] || (state.view === 'analysis' && tb[0] === 'dashboard') ? 'active' : '') + '" data-action="tab" data-view="' + tb[0] + '">' + esc(tb[1]) + '</button>'; }).join('');
}
function renderUserChip() { byId('userChip').innerHTML = session ? '<button class="btn tiny ghost" data-action="logout">' + esc(t('logout')) + '</button>' : ''; }

function renderWatchlistShell() {
  var el = byId('coinGrid');
  if (!watchlist.length) { el.innerHTML = '<p class="hint">' + esc(t('emptyWatchlist')) + '</p>'; return; }
  el.innerHTML = watchlist.map(function (id) {
    return '<div class="panel coin-card" data-action="openAnalysis" data-id="' + id + '">' +
      '<div class="coin-card-head"><b>' + esc(displayName(id)) + '</b><span class="hint">' + esc(displaySymbol(id)) + ' · ' + esc(typeLabel(id)) + '</span></div>' +
      '<div class="coin-price" id="price-' + id + '">…</div>' +
      '<div class="coin-chg" id="chg-' + id + '"></div></div>';
  }).join('');
}
// مهلات fetch للنقاط المتصلة بمصدر البيانات الخارجي (markets/opportunities/
// analysis/search) 22 ثانية كي تتّسع لمحاولة الخادم الثانية عند تعطّل عابر
// (انظر httpRetry.js) — بدل إظهار فشل للمستخدم بينما الخادم لا يزال ينجح.
function loadMarkets() {
  var sync = window.JAOLA_SYNC;
  var status = byId('dashStatus');
  if (!sync) { if (status) status.textContent = t('liveAfterPublish'); return; }
  if (!watchlist.length) return;
  if (status) status.textContent = t('updating');
  var ids = watchlist.join(',');
  fetch(sync.api + '/api/public/stock/markets?ids=' + encodeURIComponent(ids) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(22000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var symbols = (d && Array.isArray(d.symbols)) ? d.symbols : [];
      symbols.forEach(function (c) { marketsData[c.id] = c; });
      renderWatchlistShell();
      watchlist.forEach(function (id) {
        var c = marketsData[id];
        var pEl = byId('price-' + id), cEl = byId('chg-' + id);
        if (!pEl) return;
        pEl.textContent = fmtPrice(c ? c.price : null, id);
        if (cEl) { var chg = c ? c.change24h : null; cEl.textContent = fmtPct(chg); cEl.className = 'coin-chg ' + (chg != null && chg < 0 ? 'down' : 'up'); }
      });
      if (status) status.textContent = (d && d.stale) ? t('staleMarkets') : '';
    })
    .catch(function () { if (status) status.textContent = t('failMarkets'); });
}
// 🚀 شريط "أقوى الفرص" متحرّك أعلى اللوحة — نفس آلية مستشار الكريبتو تماماً.
function loadOpportunities() {
  var sync = window.JAOLA_SYNC;
  var wrap = byId('oppTicker');
  if (!wrap) return;
  if (!sync || !watchlist.length) { show(wrap, false); return; }
  fetch(sync.api + '/api/public/stock/opportunities?ids=' + encodeURIComponent(watchlist.join(',')) + '&timeframe=' + encodeURIComponent(timeframe) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(22000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var list = (d && Array.isArray(d.opportunities)) ? d.opportunities : [];
      if (!list.length) { show(wrap, false); return; }
      var items = list.map(function (o) {
        var icon = o.signal === 'buy' ? '🚀' : '📉';
        return '<span class="ticker-item ' + o.signal + '" data-action="openAnalysis" data-id="' + o.id + '">' + icon + ' ' + esc(displayName(o.id)) + ' — ' + esc(displaySymbol(o.id)) + ' — ' + esc(signalLabel(o.signal)) + '</span>';
      }).join('');
      byId('oppTrack').innerHTML = items + items;
      show(wrap, true);
    })
    .catch(function () { show(wrap, false); });
}

function openAnalysis(id) { state.activeCoin = id; setView('analysis'); }
function backDashboard() { setView('dashboard'); }
function renderAnalysisShell() {
  byId('anaTitle').textContent = displayName(state.activeCoin) + ' — ' + displaySymbol(state.activeCoin);
  byId('anaBody').innerHTML = '<p class="hint">' + esc(t('loading')) + '</p>';
}
function loadAnalysis(id) {
  var sync = window.JAOLA_SYNC;
  if (!sync) { byId('anaBody').innerHTML = '<p class="hint">' + esc(t('liveAfterPublish')) + '</p>'; return; }
  if (!id) return;
  fetch(sync.api + '/api/public/stock/analysis/' + encodeURIComponent(id) + '?timeframe=' + encodeURIComponent(timeframe) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(22000) })
    .then(function (r) { return r.json(); })
    .then(function (a) { renderAnalysis(a); if (a && !a.error) { loadCommentary(id); loadTrackRecord(id); loadAffiliate(id); } })
    .catch(function () { byId('anaBody').innerHTML = '<p class="hint">' + esc(t('failAnalysis')) + '</p>'; });
}
function sparklineSvg(values) {
  if (!values || values.length < 2) return '';
  var w = 280, h = 56, pad = 4;
  var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
  var range = (max - min) || 1;
  var stepX = (w - pad * 2) / (values.length - 1);
  var pts = values.map(function (v, i) {
    var x = pad + i * stepX;
    var y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var up = values[values.length - 1] >= values[0];
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="sparkline ' + (up ? 'up' : 'down') + '" preserveAspectRatio="none">' +
    '<polyline points="' + pts + '"></polyline></svg>';
}
function renderAnalysis(a) {
  if (!a || a.error || !a.id) { byId('anaBody').innerHTML = '<p class="hint">⚠️ ' + esc(a && a.error ? a.error : t('failAnalysis')) + '</p>'; return; }
  var reasons = [reasonText(a), t('disclaimerLong')];
  byId('anaBody').innerHTML =
    (a.stale ? '<p class="hint warn-text">⚠️ ' + esc(t('staleAnalysis')) + '</p>' : '') +
    '<div class="ana-price">' + fmtPrice(a.price, a.id) + '</div>' +
    sparklineSvg(a.recentCloses) +
    '<div class="ana-signal ' + signalClass(a.signal) + '">' + esc(signalLabel(a.signal)) + '</div>' +
    '<div class="ana-stats">' +
    '<div class="stat"><span class="stat-v">' + fmtPrice(a.smaShort, a.id) + '</span><span class="stat-l">' + esc(t('smaLabel')) + ' ' + esc(periodPhrase(a.smaShortPeriod, a.periodUnit)) + '</span></div>' +
    '<div class="stat"><span class="stat-v">' + fmtPrice(a.smaLong, a.id) + '</span><span class="stat-l">' + esc(t('smaLabel')) + ' ' + esc(periodPhrase(a.smaLongPeriod, a.periodUnit)) + '</span></div>' +
    '<div class="stat"><span class="stat-v">' + (a.rsi != null ? a.rsi.toFixed(0) : '—') + '</span><span class="stat-l">RSI-' + a.rsiPeriod + '</span></div>' +
    '</div>' +
    '<ul class="ana-reasons">' + reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
    '<div class="track-record" id="anaTrackRecord"></div>' +
    '<div class="affiliate-cta hidden" id="anaAffiliate"></div>' +
    '<div class="ai-commentary-box hidden" id="anaCommentary"></div>';
}
// 🔗 زر تداول اختياري (رابط أفلييت) — يظهر فقط إن ضبط صاحب النظام رابطاً حقيقياً على الخادم.
function loadAffiliate(id) {
  var sync = window.JAOLA_SYNC;
  var box = byId('anaAffiliate');
  if (!sync || !box) return;
  fetch(sync.api + '/api/public/stock/affiliate/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(8000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.url) { show(box, false); return; }
      box.innerHTML = '<a class="btn primary block" href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer sponsored">' + esc(t('tradeBtn', displaySymbol(id))) + '</a>' +
        '<p class="hint tiny affiliate-disclosure">' + esc(t('affiliateDisclosure')) + '</p>';
      show(box, true);
    })
    .catch(function () { show(box, false); });
}
// 📊 دقة الإشارات السابقة لهذا الرمز على هذا المدى — سجل حقيقي، لا رقم مُلفَّق.
function renderTrackRecord(tr) {
  var box = byId('anaTrackRecord');
  if (!box) return;
  var judged = tr ? (tr.hits || 0) + (tr.misses || 0) : 0;
  if (!tr || tr.hitRate == null || !judged) { box.innerHTML = '<p class="hint tiny">📊 ' + esc(t('trackRecordNoData')) + '</p>'; return; }
  box.innerHTML = '<p class="hint tiny">📊 ' + esc(t('trackRecordLabel')) + ': ' + esc(t('trackRecordSummary', tr.hitRate, tr.hits, judged)) + '</p>';
}
function loadTrackRecord(id) {
  var sync = window.JAOLA_SYNC;
  var box = byId('anaTrackRecord');
  if (!sync || !box) return;
  fetch(sync.api + '/api/public/stock/track-record/' + encodeURIComponent(id) + '?timeframe=' + encodeURIComponent(timeframe) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(8000) })
    .then(function (r) { return r.json(); })
    .then(function (d) { renderTrackRecord(d); })
    .catch(function () {});
}
// 🤖 قراءة سريعة من وكيل مخصّص — تجميلية بحتة، غيابها لا يعطّل التحليل الرقمي أعلاه.
function loadCommentary(id) {
  var sync = window.JAOLA_SYNC;
  var box = byId('anaCommentary');
  if (!sync || !box) return;
  fetch(sync.api + '/api/public/stock/commentary/' + encodeURIComponent(id) + '?symbol=' + encodeURIComponent(displaySymbol(id)) + '&timeframe=' + encodeURIComponent(timeframe) + '&lang=' + encodeURIComponent(lang) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(15000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.text) { box.innerHTML = '🤖 ' + esc(d.text); show(box, true); return; }
      if (d && d.quota === 'exhausted') { box.innerHTML = '🤖 ' + esc(t('commentaryQuotaExhausted')); show(box, true); return; }
      show(box, false);
    })
    .catch(function () { show(box, false); });
}

function renderWatchlistSettings() {
  byId('currentWlLabel').textContent = t('currentWlLabel') + ' (' + watchlist.length + ' / ' + watchlistMax + ')';
  byId('watchlistCurrent').innerHTML = watchlist.map(function (id) {
    return '<div class="wl-row"><span>' + esc(displayName(id)) + ' <span class="hint">' + esc(displaySymbol(id)) + ' · ' + esc(typeLabel(id)) + '</span></span>' +
      '<button class="btn tiny ghost" data-action="removeCoin" data-id="' + id + '">✕</button></div>';
  }).join('') || '<p class="hint tiny">' + esc(t('noWatchlist')) + '</p>';

  var quick = ALL_COINS.filter(function (c) { return watchlist.indexOf(c.id) === -1; });
  byId('quickAddCoins').innerHTML = quick.map(function (c) {
    var nm = displayName(c.id);
    return '<button class="btn tiny ghost" data-action="addCoin" data-id="' + c.id + '" data-symbol="' + c.symbol + '" data-name="' + esc(nm) + '">+ ' + esc(nm) + '</button>';
  }).join('') || '<p class="hint tiny">' + esc(t('allAdded')) + '</p>';
  byId('coinSearchResults').innerHTML = '';
}
function persistWatchlist() {
  save('watchlist', watchlist);
  var sync = window.JAOLA_SYNC;
  if (sync) {
    fetch(sync.api + '/api/public/stock/watchlist', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, watchlist: watchlist }), signal: AbortSignal.timeout(8000) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && Number.isFinite(d.watchlistMax)) watchlistMax = d.watchlistMax; })
      .catch(function () {});
  }
}
function loadLimits() {
  var sync = window.JAOLA_SYNC;
  if (!sync) return;
  fetch(sync.api + '/api/public/stock/limits?token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(8000) })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && Number.isFinite(d.watchlistMax)) { watchlistMax = d.watchlistMax; renderWatchlistSettings(); } })
    .catch(function () {});
}
function addCoinToWatchlist(id, symbol, name) {
  if (!id) return;
  if (watchlist.indexOf(id) !== -1) { toast(t('alreadyInWatchlist')); return; }
  if (watchlist.length >= watchlistMax) { toast(t('maxWatchlist', watchlistMax)); return; }
  watchlist.push(id);
  if (symbol || name) marketsData[id] = { id: id, symbol: symbol || id, name: name || id, price: null, change24h: null };
  persistWatchlist();
  renderWatchlistSettings();
  toast(t('addedToWatchlist'));
}
function removeCoinFromWatchlist(id) {
  if (watchlist.length <= 1) { toast(t('keepAtLeastOne')); return; }
  watchlist = watchlist.filter(function (x) { return x !== id; });
  persistWatchlist();
  renderWatchlistSettings();
  toast(t('removedFromWatchlist'));
}
function searchCoin() {
  var q = byId('coinSearchInput').value.trim();
  var sync = window.JAOLA_SYNC;
  var box = byId('coinSearchResults');
  if (!sync) { box.innerHTML = '<p class="hint tiny">' + esc(t('searchWorking')) + '</p>'; return; }
  if (q.length < 2) { toast(t('typeTwoChars')); return; }
  box.innerHTML = '<p class="hint tiny">' + esc(t('searching')) + '</p>';
  fetch(sync.api + '/api/public/stock/search?q=' + encodeURIComponent(q) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(22000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var coins = (d && Array.isArray(d.coins)) ? d.coins : [];
      if (!coins.length) { box.innerHTML = '<p class="hint tiny">' + esc(t('noResults')) + '</p>'; return; }
      box.innerHTML = coins.map(function (c) {
        var already = watchlist.indexOf(c.id) !== -1;
        return '<div class="wl-row"><span>' + esc(c.name) + ' <span class="hint">' + esc(c.symbol) + '</span></span>' +
          (already ? '<span class="hint tiny">' + esc(t('alreadyAdded')) + '</span>' : '<button class="btn tiny primary" data-action="addCoin" data-id="' + c.id + '" data-symbol="' + esc(c.symbol) + '" data-name="' + esc(c.name) + '">' + esc(t('addBtn')) + '</button>') +
          '</div>';
      }).join('');
    })
    .catch(function () { box.innerHTML = '<p class="hint tiny">' + esc(t('searchFail')) + '</p>'; });
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
    case 'openAnalysis': openAnalysis(a.dataset.id); break;
    case 'backDashboard': backDashboard(); break;
    case 'refreshAnalysis': loadAnalysis(state.activeCoin); break;
    case 'setTimeframe': setTimeframe(a.dataset.tf); break;
    case 'refreshMarkets': loadMarkets(); break;
    case 'addCoin': addCoinToWatchlist(a.dataset.id, a.dataset.symbol, a.dataset.name); break;
    case 'removeCoin': removeCoinFromWatchlist(a.dataset.id); break;
    case 'searchCoin': searchCoin(); break;
    case 'saveSettings': saveSettings(); break;
    case 'toggleLang': toggleLang(); break;
  }
}
function init() {
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
  renderStaticText();
  document.addEventListener('click', handleClick);
  setView(session ? 'dashboard' : 'login');
}
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.disclaimer{margin-top:14px;color:var(--warn)}
.warn-text{color:var(--warn)}
.coin-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.coin-card{cursor:pointer;transition:border-color .15s}
.coin-card:hover{border-color:var(--pri)}
.coin-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.coin-price{font-size:20px;font-weight:800}
.coin-chg{font-size:12px;font-weight:700;margin-top:4px}
.coin-chg.up{color:var(--ok)}.coin-chg.down{color:var(--bad)}
.ana-price{font-size:26px;font-weight:800;margin-bottom:8px}
.ana-signal{display:inline-block;padding:6px 16px;border-radius:999px;font-weight:800;font-size:13px;margin-bottom:16px}
.sig-buy{background:rgba(34,197,94,.15);color:var(--ok)}
.sig-sell{background:rgba(239,68,68,.15);color:var(--bad)}
.sig-hold{background:rgba(139,144,165,.15);color:var(--mut)}
.ana-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px}
.ana-reasons{padding-inline-start:20px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--txt)}
.watchlist-box{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
.wl-row{display:flex;justify-content:space-between;align-items:center;gap:10px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:9px;padding:8px 12px;font-size:13px}
.quick-add{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.sparkline{width:100%;max-width:280px;height:56px;display:block;margin:6px 0 14px}
.sparkline polyline{fill:none;stroke-width:2}
.sparkline.up polyline{stroke:var(--ok)}
.sparkline.down polyline{stroke:var(--bad)}
.track-record{margin-top:10px}
.affiliate-cta{margin-top:14px}
.affiliate-disclosure{margin-top:6px;text-align:center}
.ai-commentary-box{margin-top:14px;padding:12px 14px;background:rgba(99,102,241,.08);border:1px solid var(--line);border-radius:10px;font-size:13px;line-height:1.8}
.tf-tabs{display:flex;gap:6px;margin-bottom:14px}
.tf-tab{background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--mut);padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer}
.tf-tab.active{background:var(--pri);border-color:var(--pri);color:#fff}
.ticker-wrap{overflow:hidden;white-space:nowrap;background:rgba(99,102,241,.08);border:1px solid var(--line);border-radius:10px;padding:10px 0;margin-bottom:16px}
.ticker-track{display:inline-block;white-space:nowrap;animation:ticker-scroll 24s linear infinite}
.ticker-item{display:inline-flex;align-items:center;gap:4px;padding:0 22px;font-size:13px;font-weight:700;cursor:pointer}
.ticker-item.buy{color:var(--ok)}
.ticker-item.sell{color:var(--bad)}
@keyframes ticker-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
`;

    return {
        id: 'jaola-stock-advisor',
        track: 'system',
        category: 'system',
        name: 'مستشار أسهم وفوركس (تحليل فني وتوصيات)',
        nameEn: 'Stocks & Forex Advisor (Technical Analysis & Signals)',
        description: 'سيستم مستشار أسهم وفوركس داخلي: تحليل فني حقيقي (متوسطات متحركة ومؤشر القوة النسبية RSI) لقائمة متابعة تختارها من الأسهم وأزواج الفوركس (أي رمز عبر البحث، لا المقترحة فقط)، على مدىً زمني تختاره (يومي/أسبوعي/طويل المدى)، مع إشارة شراء/بيع/انتظار مفسَّرة بالعربية، شريط "أقوى الفرص" متحرّك أعلى اللوحة، سجل أداء شفّاف للإشارات السابقة، قراءة تفسيرية من وكيل ذكاء اصطناعي مخصّص، تبديل لغة عربي/إنجليزي حيّ، وتنبيهات بريدية عند فرص قوية — عرض وتحليل فقط، بلا تنفيذ تداول آلي.',
        descriptionEn: 'Internal stocks & forex advisor system: real technical analysis (moving averages and RSI) for a watchlist you choose from stocks and forex pairs (any symbol via search, not just the suggested ones), across a timeframe you pick (daily/weekly/long-term), with an explained buy/sell/hold signal, a scrolling "strongest opportunities" ticker atop the dashboard, a transparent track record of past signals, an AI-written short reading, a live Arabic/English language toggle, and email alerts on strong opportunities — analysis and display only, no automated trade execution.',
        keywords: ['تحليل فني', 'مستشار أسهم', 'مستشار فوركس', 'تحليل أسهم', 'تحليل فوركس', 'توصيات تداول', 'توصية تداول', 'إشارة شراء', 'إشارة بيع', 'مؤشر فني', 'RSI', 'مدى زمني', 'أقوى الفرص', 'سجل أداء', 'trading signal', 'stock advisor', 'forex advisor', 'technical analysis', 'buy sell signal'],
        model: {
            roles: [{ name: 'مالك الحساب' }],
            entities: [{ name: 'سهم أو زوج فوركس' }, { name: 'تحليل فني' }],
            flows: [{ name: 'اختيار قائمة متابعة من الأسهم والفوركس' }, { name: 'عرض السعر والتغيّر اليومي' }, { name: 'اختيار مدى زمني (يومي/أسبوعي/طويل المدى)' }, { name: 'تحليل فني مفصّل وإشارة شراء/بيع/انتظار' }, { name: 'استعراض أقوى الفرص في شريط متحرك' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
