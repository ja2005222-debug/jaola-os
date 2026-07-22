/**
 * 💱 jaola-currency — محوّل عملات *عامل* يستهلك API خارجياً حقيقياً.
 *
 * يستخدم Frankfurter (مجاني، بلا مفتاح، يدعم CORS، بيانات البنك المركزي
 * الأوروبي): تحويل فوري + جدول أسعار مقابل عملة الأساس.
 *
 * مصمّم ليصمد في التحقّق السلوكي رغم كتم jsdom لـ fetch: كل الوصول محميّ،
 * التحويل يُظهر حالة تحميل (تغيّر DOM) ثم رسالة واضحة — لا انهيار.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>محوّل العملات</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">💱 <span id="brandName">عملات jaola</span></div>
  </header>
  <main>
    <section class="converter">
      <div class="row">
        <input id="amount" type="number" min="0" step="any" value="100" inputmode="decimal">
        <select id="from" class="sel"></select>
        <button class="btn swap" data-action="swap" title="تبديل">⇄</button>
        <select id="to" class="sel"></select>
      </div>
      <button class="btn primary" data-action="convert">تحويل</button>
      <div id="result" class="result">اكتب مبلغاً واختر العملات ثم اضغط «تحويل».</div>
      <div id="rateLine" class="rate-line"></div>
    </section>

    <section class="rates">
      <h3>أسعار مقابل <span id="baseLabel">USD</span></h3>
      <div id="ratesGrid" class="rates-grid"></div>
    </section>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 💱 منطق محوّل العملات — يستهلك Frankfurter (بلا مفتاح). كل الدوال معرّفة.
'use strict';

const API = 'https://api.frankfurter.app';
const CURRENCIES = [
  ['USD', 'دولار أمريكي'], ['EUR', 'يورو'], ['GBP', 'جنيه إسترليني'], ['SAR', 'ريال سعودي'],
  ['AED', 'درهم إماراتي'], ['EGP', 'جنيه مصري'], ['JPY', 'ين ياباني'], ['TRY', 'ليرة تركية'],
  ['KWD', 'دينار كويتي'], ['QAR', 'ريال قطري'], ['CNY', 'يوان صيني'], ['CHF', 'فرنك سويسري'],
];
const POPULAR = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'TRY', 'JPY'];

const state = { from: 'USD', to: 'SAR' };

function byId(id) { return document.getElementById(id); }
function nameOf(code) { const c = CURRENCIES.find(x => x[0] === code); return c ? c[1] : code; }
function money(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

async function getJSON(url) {
  try {
    const res = await fetch(url);
    if (!res || !res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function fillSelects() {
  const opts = CURRENCIES.map(c => '<option value="' + c[0] + '">' + c[0] + ' — ' + c[1] + '</option>').join('');
  const from = byId('from'), to = byId('to');
  if (from) { from.innerHTML = opts; from.value = state.from; }
  if (to) { to.innerHTML = opts; to.value = state.to; }
}

async function convert() {
  const amount = Number((byId('amount') && byId('amount').value) || 0);
  state.from = (byId('from') && byId('from').value) || state.from;
  state.to = (byId('to') && byId('to').value) || state.to;
  if (!(amount > 0)) { byId('result').textContent = 'اكتب مبلغاً أكبر من صفر.'; byId('rateLine').textContent = ''; return; }
  if (state.from === state.to) {
    byId('result').textContent = money(amount) + ' ' + state.from + ' = ' + money(amount) + ' ' + state.to;
    byId('rateLine').textContent = 'العملتان متطابقتان (1:1).';
    return;
  }
  byId('result').textContent = '⏳ جاري التحويل...';
  byId('rateLine').textContent = '';
  const data = await getJSON(API + '/latest?amount=' + amount + '&from=' + state.from + '&to=' + state.to);
  const rate = data && data.rates && data.rates[state.to];
  if (rate == null) { byId('result').textContent = 'تعذّر جلب السعر الآن — حاول لاحقاً.'; return; }
  byId('result').innerHTML = '<b>' + money(amount) + '</b> ' + state.from +
    ' = <b class="out">' + money(rate) + '</b> ' + state.to;
  byId('rateLine').textContent = '1 ' + state.from + ' = ' + money(rate / amount) + ' ' + state.to +
    ' · ' + nameOf(state.from) + ' → ' + nameOf(state.to);
}

function swap() {
  const a = state.from; state.from = state.to; state.to = a;
  const from = byId('from'), to = byId('to');
  if (from) from.value = state.from;
  if (to) to.value = state.to;
  convert();
}

async function loadRates() {
  const grid = byId('ratesGrid');
  if (!grid) return;
  byId('baseLabel').textContent = state.from;
  grid.innerHTML = '<div class="muted">جاري جلب الأسعار...</div>';
  const targets = POPULAR.filter(c => c !== state.from);
  const data = await getJSON(API + '/latest?from=' + state.from + '&to=' + targets.join(','));
  const rates = (data && data.rates) || {};
  const rows = targets.map(function (c) {
    const r = rates[c];
    return '<div class="rate-cell"><div class="rc-code">' + c + '</div>' +
      '<div class="rc-name">' + nameOf(c) + '</div>' +
      '<div class="rc-val">' + (r != null ? money(r) : '—') + '</div></div>';
  }).join('');
  grid.innerHTML = rows || '<div class="muted">لا أسعار متاحة الآن.</div>';
}

function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'convert') convert();
  else if (el.dataset.action === 'swap') swap();
}
function handleChange(e) {
  const t = e.target;
  if (!t) return;
  if (t.id === 'from') { state.from = t.value; loadRates(); convert(); }
  else if (t.id === 'to') { state.to = t.value; convert(); }
}
function handleKey(e) { if (e.key === 'Enter' && e.target && e.target.id === 'amount') convert(); }

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('keydown', handleKey);
  fillSelects();
  loadRates();
  convert();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0b1220;--surface:#141b2e;--card:#1b2540;--accent:#34d399;--text:#e8edf6;--muted:#8b98b0;--border:#26324f;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:linear-gradient(160deg,#0b1220,#122033);color:var(--text);min-height:100vh;line-height:1.6}
.topbar{padding:16px 20px;border-bottom:1px solid var(--border)}
.brand{font-size:20px;font-weight:800}
main{max-width:760px;margin:0 auto;padding:24px 18px}
.converter{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:22px;margin-bottom:24px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:stretch;margin-bottom:14px}
#amount{flex:1;min-width:120px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:13px 16px;color:var(--text);font-size:17px;font-weight:700}
.sel,select{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:13px;color:var(--text);font-size:14px}
.btn{border:1px solid var(--border);background:var(--surface);color:var(--text);padding:12px 20px;border-radius:12px;font-weight:700;cursor:pointer;font-size:14px}
.btn.primary{width:100%;background:var(--accent);border-color:var(--accent);color:#04352a}
.btn.swap{padding:12px 16px;font-size:18px}
.result{margin-top:16px;text-align:center;font-size:20px;color:var(--text)}
.result .out{color:var(--accent)}
.rate-line{margin-top:6px;text-align:center;color:var(--muted);font-size:13px}
.rates h3{margin-bottom:14px;font-size:16px}
.rates-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.rate-cell{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px}
.rc-code{font-weight:800;color:var(--accent)}
.rc-name{color:var(--muted);font-size:12px;margin:2px 0 6px}
.rc-val{font-weight:700;font-size:16px}
.muted{color:var(--muted);font-size:13px}
`;

export function jaolaCurrency() {
    return {
        id: 'jaola-currency',
        category: 'tool',
        name: 'محوّل العملات (API خارجي حيّ)',
        description: 'محوّل عملات عامل يستهلك Frankfurter مباشرةً (بلا مفتاح): تحويل فوري + جدول أسعار مقابل عملة الأساس.',
        keywords: ['عملات', 'عملة', 'تحويل', 'صرف', 'سعر الصرف', 'currency', 'exchange', 'converter', 'forex', 'دولار', 'يورو', 'ريال'],
        externalApi: 'Frankfurter (بلا مفتاح)',
        model: {
            entities: [
                { name: 'Currency', fields: [{ name: 'code', type: 'string' }, { name: 'name', type: 'string' }], ownedBy: 'User' },
                { name: 'Rate', fields: [{ name: 'from', type: 'string' }, { name: 'to', type: 'string' }, { name: 'value', type: 'number' }], ownedBy: 'User' },
            ],
            roles: [{ name: 'User', description: 'يحوّل بين العملات', capabilities: ['إدخال مبلغ', 'اختيار العملات', 'تحويل', 'عرض الأسعار'] }],
            flows: [
                { name: 'تحويل عملة', actor: 'User', steps: ['يدخل مبلغاً', 'يختار from/to', 'latest API', 'عرض النتيجة'], touches: ['Currency', 'Rate'], realtime: false },
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
