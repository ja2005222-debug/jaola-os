/**
 * 📊 jaola-crypto-advisor — مستشار كريبتو داخلي (track: system).
 *
 * تحليل فني حقيقي (SMA7/SMA25/RSI14) لقائمة متابعة يختارها المالك، مع
 * إشارة شراء/بيع/انتظار مفسَّرة بالعربية — بيانات حقيقية من الخادم
 * (backend/services/cryptoMarket.js يستهلك CoinGecko). عرض وتحليل فقط،
 * لا تنفيذ تداول آلي أبداً — تنبيه "ليس نصيحة استثمارية" ظاهر دائماً.
 *
 * أداة شخصية بمالك واحد (لا أدوار متعددة كبقية أنظمة السيستم) — دخول
 * بكلمة مرور واحدة فقط. مختلف عن jaola-crypto (عرض أسعار عام بلا دخول
 * ولا تحليل، track: site) — قالب منفصل عمداً بدل توسيع ذاك، تماماً كما
 * أُضيف jaola-vetclinic-react بجانب jaola-vetclinic دون استبداله.
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaCryptoAdvisor() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>مستشار الكريبتو</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">📊</span> <span id="brandName">مستشار الكريبتو</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main>
    <section id="view-login" class="view">
      <div class="login-card">
        <h1>مستشار الكريبتو</h1>
        <p class="hint">تحليل فني (SMA/RSI) لقائمة متابعتك من العملات الرقمية + إشارة شراء/بيع/انتظار مفسَّرة.</p>
        <label>كلمة المرور</label>
        <input id="loginPass" type="password" placeholder="admin">
        <p class="err hidden" id="loginErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="login">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin». تنبيه: هذا تحليل آلي وليس نصيحة استثمارية.</p>
      </div>
    </section>

    <section id="view-dashboard" class="view hidden">
      <div class="view-head"><h2>قائمة المتابعة</h2><button class="btn ghost tiny" data-action="refreshMarkets">🔄 تحديث</button></div>
      <p class="hint" id="dashStatus"></p>
      <div class="coin-grid" id="coinGrid"></div>
      <p class="hint tiny disclaimer">⚠️ تحليل إحصائي آلي وليس نصيحة استثمارية ملزمة — قرار التداول مسؤوليتك الكاملة.</p>
    </section>

    <section id="view-analysis" class="view hidden">
      <div class="view-head"><h2 id="anaTitle">تحليل</h2>
        <div>
          <button class="btn ghost tiny" data-action="refreshAnalysis">🔄 تحديث</button>
          <button class="btn ghost tiny" data-action="backDashboard">→ القائمة</button>
        </div>
      </div>
      <div class="panel" id="anaBody"><p class="hint">⏳ جارٍ التحميل...</p></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>قائمة المتابعة الحالية</label>
        <div id="watchlistCurrent" class="watchlist-box"></div>
        <label>إضافة سريعة</label>
        <div id="quickAddCoins" class="quick-add"></div>
        <label>بحث عن عملة أخرى</label>
        <div class="form-row">
          <input id="coinSearchInput" placeholder="اكتب اسم العملة أو رمزها...">
          <button class="btn ghost tiny" data-action="searchCoin">بحث</button>
        </div>
        <div id="coinSearchResults" class="watchlist-box"></div>
      </div>
      <div class="panel form-col">
        <label>كلمة المرور الجديدة</label>
        <input id="stPass" type="password" placeholder="اتركها فارغة للإبقاء">
        <button class="btn primary" data-action="saveSettings">حفظ كلمة المرور</button>
      </div>
    </section>
  </main>
  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 📊 مستشار الكريبتو — jaola-crypto-advisor */
'use strict';
// قائمة العملات المدعومة (يجب أن تطابق SUPPORTED_COINS في backend/services/cryptoMarket.js)
var ALL_COINS = [
  { id: 'bitcoin', symbol: 'BTC', nameAr: 'بيتكوين' },
  { id: 'ethereum', symbol: 'ETH', nameAr: 'إيثيريوم' },
  { id: 'binancecoin', symbol: 'BNB', nameAr: 'بينانس كوين' },
  { id: 'ripple', symbol: 'XRP', nameAr: 'ريبل' },
  { id: 'solana', symbol: 'SOL', nameAr: 'سولانا' },
  { id: 'cardano', symbol: 'ADA', nameAr: 'كاردانو' },
  { id: 'dogecoin', symbol: 'DOGE', nameAr: 'دوجكوين' },
  { id: 'tron', symbol: 'TRX', nameAr: 'ترون' }
];

function load(k, fb) { try { var v = localStorage.getItem('jcrypto_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jcrypto_' + k, JSON.stringify(val)); } catch (e) {} }

var MAX_WATCHLIST = 20;
var settings = load('settings', { pass: 'admin' });
var watchlist = load('watchlist', ['bitcoin', 'ethereum', 'solana']);
var session = load('session', null);
var marketsData = {};
var pollTimer = null;
var state = { view: 'login', activeCoin: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function coinMeta(id) { for (var i = 0; i < ALL_COINS.length; i++) if (ALL_COINS[i].id === id) return ALL_COINS[i]; return null; }
// اسم/رمز العرض: العربي المألوف للعملات الشائعة، وإلا ما يعرفه الخادم عن أي عملة أخرى.
function displayName(id) { var c = coinMeta(id); if (c) return c.nameAr; var m = marketsData[id]; return (m && m.name) || id; }
function displaySymbol(id) { var c = coinMeta(id); if (c) return c.symbol; var m = marketsData[id]; return (m && m.symbol) || id.toUpperCase(); }
function fmtPrice(n) { return (n == null) ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 2 }); }
function fmtPct(n) { return (n == null) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function signalLabel(s) { return s === 'buy' ? 'شراء' : s === 'sell' ? 'بيع' : 'انتظار'; }
function signalClass(s) { return s === 'buy' ? 'sig-buy' : s === 'sell' ? 'sig-sell' : 'sig-hold'; }
// النص العربي هنا (لا في استجابة الخادم) كي تترجمه templateLocalizer.js لموقع بالإنجليزية —
// الخادم (cryptoMarket.js) يُعيد رمز سبب فقط (reasonCode)، لا جملة جاهزة.
var DISCLAIMER_TEXT = 'تنبيه: هذا تحليل إحصائي آلي وليس نصيحة استثمارية ملزمة — قرار التداول ونتيجته مسؤوليتك الكاملة.';
function reasonText(a) {
  var rsi = (a.rsi14 != null) ? a.rsi14.toFixed(0) : '—';
  switch (a.reasonCode) {
    case 'rsi_overbought': return 'مؤشر القوة النسبية (RSI) في منطقة تشبّع شرائي (' + rsi + ') — احتمال تصحيح هابط.';
    case 'rsi_oversold': return 'مؤشر القوة النسبية (RSI) في منطقة تشبّع بيعي (' + rsi + ') — احتمال ارتداد صاعد.';
    case 'sma_bullish': return 'المتوسط المتحرك قصير المدى (7 أيام) أعلى من طويل المدى (25 يوماً) — اتجاه صاعد.';
    case 'sma_bearish': return 'المتوسط المتحرك قصير المدى (7 أيام) أدنى من طويل المدى (25 يوماً) — اتجاه هابط.';
    default: return 'لا إشارة فنية واضحة حالياً — البيانات غير كافية أو السوق متذبذب.';
  }
}

function login() {
  var pass = byId('loginPass').value;
  function onOk() { show(byId('loginErr'), false); session = {}; save('session', session); byId('loginPass').value = ''; toast('أهلاً بك'); setView('dashboard'); }
  function onFail(msg) { var el = byId('loginErr'); el.textContent = msg || 'كلمة المرور غير صحيحة'; show(el, true); }
  var sync = window.JAOLA_SYNC;
  if (!sync) { if (pass !== settings.pass) return onFail(); return onOk(); }
  fetch(sync.api + '/api/public/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: pass }), signal: AbortSignal.timeout(8000) })
    .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
    .then(function (d) { if (d && d.ok) onOk(); else onFail(); })
    .catch(function () { onFail('تعذّر الاتصال بالخادم، تحقّق من الاتصال وحاول مجدداً'); });
}
function logout() { stopPolling(); session = null; save('session', null); toast('تم الخروج'); setView('login'); }

function startPolling(fn, ms) { stopPolling(); pollTimer = setInterval(fn, ms); }
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

function setView(v) {
  if (v !== 'login' && !session) v = 'login';
  stopPolling();
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs(); renderUserChip();
  if (v === 'dashboard') { renderWatchlistShell(); loadMarkets(); startPolling(loadMarkets, 60000); }
  if (v === 'analysis') { renderAnalysisShell(); loadAnalysis(state.activeCoin); startPolling(function () { loadAnalysis(state.activeCoin); }, 60000); }
  if (v === 'settings') { renderWatchlistSettings(); byId('coinSearchInput').value = ''; byId('stPass').value = ''; }
}
function renderTabs() {
  if (!session) { byId('tabs').innerHTML = ''; return; }
  var tabs = [['dashboard', 'المتابعة'], ['settings', 'الإعدادات']];
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] || (state.view === 'analysis' && t[0] === 'dashboard') ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
}
function renderUserChip() { byId('userChip').innerHTML = session ? '<button class="btn tiny ghost" data-action="logout">خروج</button>' : ''; }

function renderWatchlistShell() {
  var el = byId('coinGrid');
  if (!watchlist.length) { el.innerHTML = '<p class="hint">أضف عملات لمتابعتها من الإعدادات.</p>'; return; }
  el.innerHTML = watchlist.map(function (id) {
    return '<div class="panel coin-card" data-action="openAnalysis" data-id="' + id + '">' +
      '<div class="coin-card-head"><b>' + esc(displayName(id)) + '</b><span class="hint">' + esc(displaySymbol(id)) + '</span></div>' +
      '<div class="coin-price" id="price-' + id + '">…</div>' +
      '<div class="coin-chg" id="chg-' + id + '"></div></div>';
  }).join('');
}
function loadMarkets() {
  var sync = window.JAOLA_SYNC;
  var status = byId('dashStatus');
  if (!sync) { if (status) status.textContent = '🔌 التحليل الحي يعمل بعد تطبيق القالب على مشروع فعلي منشور.'; return; }
  if (!watchlist.length) return;
  if (status) status.textContent = '⏳ جارٍ التحديث...';
  var ids = watchlist.join(',');
  fetch(sync.api + '/api/public/crypto/markets?ids=' + encodeURIComponent(ids) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(8000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var coins = (d && Array.isArray(d.coins)) ? d.coins : [];
      coins.forEach(function (c) { marketsData[c.id] = c; });
      renderWatchlistShell(); // إعادة رسم بعد توفّر أسماء/أسعار حقيقية (قد تشمل عملات مُضافة بالبحث)
      watchlist.forEach(function (id) {
        var c = marketsData[id];
        var pEl = byId('price-' + id), cEl = byId('chg-' + id);
        if (!pEl) return;
        pEl.textContent = fmtPrice(c ? c.price : null);
        if (cEl) { var chg = c ? c.change24h : null; cEl.textContent = fmtPct(chg); cEl.className = 'coin-chg ' + (chg != null && chg < 0 ? 'down' : 'up'); }
      });
      if (status) status.textContent = (d && d.stale) ? '⚠️ بيانات قديمة — تعذّر التحديث الآن.' : '';
    })
    .catch(function () { if (status) status.textContent = '⚠️ تعذّر جلب الأسعار الآن.'; });
}

function openAnalysis(id) { state.activeCoin = id; setView('analysis'); }
function backDashboard() { setView('dashboard'); }
function renderAnalysisShell() {
  byId('anaTitle').textContent = displayName(state.activeCoin) + ' (' + displaySymbol(state.activeCoin) + ')';
  byId('anaBody').innerHTML = '<p class="hint">⏳ جارٍ التحميل...</p>';
}
function loadAnalysis(id) {
  var sync = window.JAOLA_SYNC;
  if (!sync) { byId('anaBody').innerHTML = '<p class="hint">🔌 التحليل الحي يعمل بعد تطبيق القالب على مشروع فعلي منشور.</p>'; return; }
  if (!id) return;
  fetch(sync.api + '/api/public/crypto/analysis/' + encodeURIComponent(id) + '?token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(10000) })
    .then(function (r) { return r.json(); })
    .then(function (a) { renderAnalysis(a); if (a && !a.error) loadCommentary(id); })
    .catch(function () { byId('anaBody').innerHTML = '<p class="hint">⚠️ تعذّر جلب التحليل الآن — حاول مجدداً.</p>'; });
}
// رسم بياني مصغّر (14 يوماً) من قيم مُعطاة — بلا أي نداء شبكة إضافي (البيانات مُرسَلة أصلاً مع التحليل).
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
  if (!a || a.error || !a.id) { byId('anaBody').innerHTML = '<p class="hint">⚠️ ' + esc(a && a.error ? a.error : 'تعذّر جلب التحليل الآن.') + '</p>'; return; }
  var reasons = [reasonText(a), DISCLAIMER_TEXT];
  byId('anaBody').innerHTML =
    (a.stale ? '<p class="hint warn-text">⚠️ بيانات قديمة (تعذّر التحديث الآن)</p>' : '') +
    '<div class="ana-price">' + fmtPrice(a.price) + '</div>' +
    sparklineSvg(a.recentCloses) +
    '<div class="ana-signal ' + signalClass(a.signal) + '">' + signalLabel(a.signal) + '</div>' +
    '<div class="ana-stats">' +
    '<div class="stat"><span class="stat-v">' + fmtPrice(a.sma7) + '</span><span class="stat-l">متوسط 7 أيام</span></div>' +
    '<div class="stat"><span class="stat-v">' + fmtPrice(a.sma25) + '</span><span class="stat-l">متوسط 25 يوماً</span></div>' +
    '<div class="stat"><span class="stat-v">' + (a.rsi14 != null ? a.rsi14.toFixed(0) : '—') + '</span><span class="stat-l">RSI-14</span></div>' +
    '</div>' +
    '<ul class="ana-reasons">' + reasons.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
    '<div class="ai-commentary-box hidden" id="anaCommentary"></div>';
}
// 🤖 قراءة سريعة من وكيل مخصّص (مهمته فقط كتابة الجمل، لا التوصية بالتنفيذ) — تجميلية بحتة،
// غيابها (لا مزوّد ذكاء اصطناعي/حصة منتهية) لا يعطّل التحليل الرقمي أعلاه إطلاقاً.
function loadCommentary(id) {
  var sync = window.JAOLA_SYNC;
  var box = byId('anaCommentary');
  if (!sync || !box) return;
  fetch(sync.api + '/api/public/crypto/commentary/' + encodeURIComponent(id) + '?symbol=' + encodeURIComponent(displaySymbol(id)) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(15000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d && d.text) { box.innerHTML = '🤖 ' + esc(d.text); show(box, true); }
      else show(box, false);
    })
    .catch(function () { show(box, false); });
}

function renderWatchlistSettings() {
  byId('watchlistCurrent').innerHTML = watchlist.map(function (id) {
    return '<div class="wl-row"><span>' + esc(displayName(id)) + ' <span class="hint">(' + esc(displaySymbol(id)) + ')</span></span>' +
      '<button class="btn tiny ghost" data-action="removeCoin" data-id="' + id + '">✕</button></div>';
  }).join('') || '<p class="hint tiny">لا عملات متابَعة بعد.</p>';

  var quick = ALL_COINS.filter(function (c) { return watchlist.indexOf(c.id) === -1; });
  byId('quickAddCoins').innerHTML = quick.map(function (c) {
    return '<button class="btn tiny ghost" data-action="addCoin" data-id="' + c.id + '" data-symbol="' + c.symbol + '" data-name="' + esc(c.nameAr) + '">+ ' + esc(c.nameAr) + '</button>';
  }).join('') || '<p class="hint tiny">كل العملات الشائعة مضافة بالفعل.</p>';
  byId('coinSearchResults').innerHTML = '';
}
// يُزامَن مع الخادم فوراً (لا زر "حفظ" منفصل لقائمة المتابعة) — نفس نمط
// jaola-data للتخزين، بالإضافة لفهرس مخصّص (crypto/watchlist) تستخدمه
// حلقة تنبيهات "الفرص القوية" في server.js لمعرفة أي المشاريع تتابع أي عملات.
function persistWatchlist() {
  save('watchlist', watchlist);
  var sync = window.JAOLA_SYNC;
  if (sync) {
    fetch(sync.api + '/api/public/crypto/watchlist', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, watchlist: watchlist }), signal: AbortSignal.timeout(8000) }).catch(function () {});
  }
}
function addCoinToWatchlist(id, symbol, name) {
  if (!id) return;
  if (watchlist.indexOf(id) !== -1) { toast('العملة مضافة بالفعل'); return; }
  if (watchlist.length >= MAX_WATCHLIST) { toast('وصلت للحد الأقصى لعدد العملات المتابَعة'); return; }
  watchlist.push(id);
  if (symbol || name) marketsData[id] = { id: id, symbol: symbol || id.toUpperCase(), name: name || id, price: null, change24h: null };
  persistWatchlist();
  renderWatchlistSettings();
  toast('أُضيفت للمتابعة');
}
function removeCoinFromWatchlist(id) {
  if (watchlist.length <= 1) { toast('يجب أن تبقى عملة واحدة على الأقل للمتابعة'); return; }
  watchlist = watchlist.filter(function (x) { return x !== id; });
  persistWatchlist();
  renderWatchlistSettings();
  toast('أُزيلت من المتابعة');
}
function searchCoin() {
  var q = byId('coinSearchInput').value.trim();
  var sync = window.JAOLA_SYNC;
  var box = byId('coinSearchResults');
  if (!sync) { box.innerHTML = '<p class="hint tiny">البحث يعمل بعد تطبيق القالب على مشروع فعلي منشور.</p>'; return; }
  if (q.length < 2) { toast('اكتب حرفين على الأقل'); return; }
  box.innerHTML = '<p class="hint tiny">⏳ جارٍ البحث...</p>';
  fetch(sync.api + '/api/public/crypto/search?q=' + encodeURIComponent(q) + '&token=' + encodeURIComponent(sync.token), { signal: AbortSignal.timeout(8000) })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var coins = (d && Array.isArray(d.coins)) ? d.coins : [];
      if (!coins.length) { box.innerHTML = '<p class="hint tiny">لا نتائج.</p>'; return; }
      box.innerHTML = coins.map(function (c) {
        var already = watchlist.indexOf(c.id) !== -1;
        return '<div class="wl-row"><span>' + esc(c.name) + ' <span class="hint">(' + esc(c.symbol) + ')</span></span>' +
          (already ? '<span class="hint tiny">مُضافة</span>' : '<button class="btn tiny primary" data-action="addCoin" data-id="' + c.id + '" data-symbol="' + esc(c.symbol) + '" data-name="' + esc(c.name) + '">+ إضافة</button>') +
          '</div>';
      }).join('');
    })
    .catch(function () { box.innerHTML = '<p class="hint tiny">⚠️ تعذّر البحث الآن.</p>'; });
}
function saveSettings() {
  var np = byId('stPass').value.trim();
  var sync = window.JAOLA_SYNC;
  if (np) {
    if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np }), signal: AbortSignal.timeout(8000) }).catch(function () {}); }
    else { settings.pass = np; save('settings', settings); }
    byId('stPass').value = '';
  }
  toast('تم حفظ كلمة المرور');
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
    case 'refreshMarkets': loadMarkets(); break;
    case 'addCoin': addCoinToWatchlist(a.dataset.id, a.dataset.symbol, a.dataset.name); break;
    case 'removeCoin': removeCoinFromWatchlist(a.dataset.id); break;
    case 'searchCoin': searchCoin(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() {
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
.ai-commentary-box{margin-top:14px;padding:12px 14px;background:rgba(99,102,241,.08);border:1px solid var(--line);border-radius:10px;font-size:13px;line-height:1.8}
`;

    return {
        id: 'jaola-crypto-advisor',
        track: 'system',
        category: 'system',
        name: 'مستشار كريبتو (تحليل فني وتوصيات)',
        nameEn: 'Crypto Advisor (Technical Analysis & Signals)',
        description: 'سيستم مستشار كريبتو داخلي: تحليل فني حقيقي (متوسطات متحركة SMA7/SMA25 ومؤشر القوة النسبية RSI14) لقائمة متابعة تختارها، مع إشارة شراء/بيع/انتظار مفسَّرة بالعربية وتحديث تلقائي — عرض وتحليل فقط، بلا تنفيذ تداول آلي.',
        descriptionEn: 'Internal crypto advisor system: real technical analysis (SMA7/SMA25 moving averages and RSI14) for a watchlist you choose, with an explained buy/sell/hold signal and auto-refresh — analysis and display only, no automated trade execution.',
        keywords: ['تحليل فني', 'تحليل كريبتو', 'مستشار كريبتو', 'توصيات تداول', 'توصية تداول', 'إشارة شراء', 'إشارة بيع', 'مؤشر فني', 'RSI', 'تحليل عملات رقمية', 'trading signal', 'crypto advisor', 'technical analysis', 'buy sell signal'],
        model: {
            roles: [{ name: 'مالك الحساب' }],
            entities: [{ name: 'عملة رقمية' }, { name: 'تحليل فني' }],
            flows: [{ name: 'اختيار قائمة متابعة من العملات' }, { name: 'عرض السعر والتغيّر اليومي' }, { name: 'تحليل فني مفصّل وإشارة شراء/بيع/انتظار' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
