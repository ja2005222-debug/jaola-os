/**
 * 📈 jaola-crypto — قالب متابعة عملات رقمية *عامل* يستهلك API خارجياً.
 *
 * يستخدم CoinGecko (مجاني، بلا مفتاح، CORS): أسعار أعلى العملات + بحث +
 * تبديل عملة التسعير. مصمّم ليصمد في التحقّق السلوكي رغم كتم fetch في jsdom
 * (كل الوصول محميّ، والتفاعل يُحدث تغيّر DOM فوراً).
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>أسعار العملات الرقمية</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">📈 <span id="brandName">عملات jaola</span></div>
    <div class="currencies" id="currencyTabs">
      <button class="cur-tab active" data-action="currency" data-cur="usd">USD</button>
      <button class="cur-tab" data-action="currency" data-cur="eur">EUR</button>
      <button class="cur-tab" data-action="currency" data-cur="sar">SAR</button>
    </div>
  </header>
  <main>
    <div class="toolbar">
      <input id="searchInput" placeholder="ابحث عن عملة (Bitcoin, ETH...)">
      <button class="btn" data-action="refresh">🔄 تحديث</button>
    </div>
    <div id="status" class="status"></div>
    <div id="coinList" class="coins"></div>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 📈 منطق متابعة العملات — يستهلك CoinGecko (بلا مفتاح). كل الدوال معرّفة.
'use strict';

const API = 'https://api.coingecko.com/api/v3/coins/markets';
const SYMBOL = { usd: '$', eur: '€', sar: '﷼' };

const state = { currency: 'usd', coins: [], query: '' };

function byId(id) { return document.getElementById(id); }
function setStatus(msg) { const s = byId('status'); if (s) s.textContent = msg || ''; }
function fmt(n) { return (n == null) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 2 }); }

async function loadCoins() {
  setStatus('⏳ جاري تحديث الأسعار...');
  let data = null;
  try {
    const res = await fetch(API + '?vs_currency=' + state.currency + '&order=market_cap_desc&per_page=20&page=1&price_change_percentage=24h');
    if (res && res.ok) data = await res.json();
  } catch { data = null; }
  state.coins = Array.isArray(data) ? data : [];
  if (!state.coins.length) setStatus('تعذّر جلب الأسعار الآن — اضغط «تحديث» للمحاولة.');
  else setStatus('');
  renderCoins();
}

function renderCoins() {
  const el = byId('coinList');
  const q = state.query.toLowerCase();
  const list = state.coins.filter(function (c) {
    return !q || (c.name && c.name.toLowerCase().includes(q)) || (c.symbol && c.symbol.toLowerCase().includes(q));
  });
  if (!list.length) {
    el.innerHTML = '<p class="muted">' + (state.coins.length ? 'لا نتائج للبحث.' : 'لا بيانات بعد.') + '</p>';
    return;
  }
  const sym = SYMBOL[state.currency] || '';
  el.innerHTML = list.map(function (c) {
    const chg = c.price_change_percentage_24h || 0;
    const up = chg >= 0;
    return '<div class="coin-card">' +
      '<div class="coin-head"><span class="coin-rank">#' + (c.market_cap_rank || '-') + '</span>' +
      '<img class="coin-img" src="' + (c.image || '') + '" alt="" onerror="this.style.display=' + "'none'" + '">' +
      '<div><div class="coin-name">' + (c.name || '') + '</div><div class="coin-sym">' + ((c.symbol || '').toUpperCase()) + '</div></div></div>' +
      '<div class="coin-price">' + sym + fmt(c.current_price) + '</div>' +
      '<div class="coin-chg ' + (up ? 'up' : 'down') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(chg).toFixed(2) + '%</div>' +
      '<div class="coin-cap">القيمة السوقية: ' + sym + fmt(c.market_cap) + '</div></div>';
  }).join('');
}

function setCurrency(cur) {
  if (!SYMBOL[cur]) return;
  state.currency = cur;
  document.querySelectorAll('.cur-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.cur === cur); });
  loadCoins();
}

function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'refresh') loadCoins();
  if (el.dataset.action === 'currency') setCurrency(el.dataset.cur);
}
function handleInput(e) {
  if (e.target && e.target.id === 'searchInput') { state.query = e.target.value || ''; renderCoins(); }
}

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  loadCoins();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0a0f1c;--surface:#121a2e;--card:#18223c;--accent:#f7931a;--good:#22c55e;--bad:#ef4444;--text:#e8edf6;--muted:#8b98b0;--border:#243050;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:14px 20px;background:var(--surface);border-bottom:1px solid var(--border)}
.brand{font-size:20px;font-weight:800}
.currencies{display:flex;gap:6px}
.cur-tab{background:transparent;border:1px solid var(--border);color:var(--muted);padding:7px 14px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer}
.cur-tab.active{background:var(--accent);border-color:var(--accent);color:#1a1200}
main{max-width:960px;margin:0 auto;padding:22px 16px}
.toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.toolbar input,#searchInput{flex:1;min-width:200px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text)}
.btn{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:11px 18px;border-radius:10px;font-weight:700;cursor:pointer}
.btn:hover{border-color:var(--accent)}
.status{color:var(--muted);text-align:center;padding:12px;font-size:14px}
.coins{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.coin-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:16px}
.coin-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.coin-rank{color:var(--muted);font-size:12px}
.coin-img{width:32px;height:32px;border-radius:50%}
.coin-name{font-weight:800;font-size:14px}
.coin-sym{color:var(--muted);font-size:12px}
.coin-price{font-size:22px;font-weight:800}
.coin-chg{font-size:13px;font-weight:700;margin:4px 0}
.coin-chg.up{color:var(--good)}
.coin-chg.down{color:var(--bad)}
.coin-cap{color:var(--muted);font-size:12px}
.muted{color:var(--muted);font-size:14px;grid-column:1/-1;text-align:center;padding:20px}
`;

export function jaolaCrypto() {
    return {
        id: 'jaola-crypto',
        category: 'tool',
        name: 'أسعار العملات الرقمية (API خارجي حيّ)',
        description: 'متابعة عملات رقمية عاملة تستهلك CoinGecko مباشرةً (بلا مفتاح): أعلى العملات + بحث + تبديل عملة التسعير.',
        keywords: ['عملات', 'رقمية', 'كريبتو', 'crypto', 'bitcoin', 'بيتكوين', 'أسعار', 'coins', 'عملة', 'blockchain', 'ethereum'],
        externalApi: 'CoinGecko (بلا مفتاح)',
        model: {
            entities: [
                { name: 'Coin', fields: [{ name: 'name', type: 'string' }, { name: 'symbol', type: 'string' }, { name: 'current_price', type: 'number' }, { name: 'market_cap', type: 'number' }], ownedBy: 'User' },
            ],
            roles: [{ name: 'User', description: 'يتابع أسعار العملات', capabilities: ['عرض الأسعار', 'بحث', 'تبديل العملة'] }],
            flows: [
                { name: 'جلب الأسعار', actor: 'User', steps: ['يختار عملة التسعير', 'CoinGecko API', 'عرض القائمة', 'بحث/فلترة'], touches: ['Coin'], realtime: false },
            ],
            _source: 'clone',
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: STYLES_CSS },
        ],
    };
}
