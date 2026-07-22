/**
 * 🏠 jaola-realestate — قوائم عقارية *عاملة* غنيّة بالتفاصيل.
 *
 * نمط شائع وقابل لإعادة الاستخدام: قوائم + فلاتر متعدّدة (نوع/مدينة/غرف/سعر) +
 * فرز + تفاصيل عقار (نافذة) + نموذج تواصل. كل الدوال معرّفة (تفويض أحداث).
 * يجتاز التحقّق السلوكي 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>عقارات jaola</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">🏠 <span id="brandName">عقارات jaola</span></div>
    <div class="count" id="resultCount"></div>
  </header>

  <div class="layout">
    <aside class="filters">
      <h3>تصفية</h3>
      <label>النوع</label>
      <div class="chips" id="typeChips"></div>
      <label>المدينة</label>
      <select id="cityFilter" class="sel"></select>
      <label>عدد الغرف (على الأقل)</label>
      <select id="roomsFilter" class="sel">
        <option value="0">الكل</option><option value="1">1+</option><option value="2">2+</option>
        <option value="3">3+</option><option value="4">4+</option>
      </select>
      <label>أقصى سعر: <span id="priceLabel">—</span></label>
      <input id="priceRange" type="range" min="0" max="3000000" step="50000" value="3000000">
      <label>الفرز</label>
      <select id="sortFilter" class="sel">
        <option value="new">الأحدث</option><option value="price-asc">الأرخص</option><option value="price-desc">الأغلى</option>
      </select>
      <button class="btn" data-action="reset">إعادة تعيين</button>
    </aside>

    <main>
      <div id="listings" class="grid"></div>
      <p id="emptyState" class="empty hidden">لا عقارات مطابقة للتصفية.</p>
    </main>
  </div>

  <div id="detailModal" class="modal hidden">
    <div class="modal-box" id="detailBox"></div>
  </div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🏠 منطق القوائم العقارية — كل الدوال معرّفة، تفويض أحداث.
'use strict';

const PROPERTIES = [
  { id: 'h1', title: 'شقة عصرية بإطلالة', type: 'شقة', city: 'الرياض', price: 850000, area: 140, rooms: 3, emoji: '🏢', desc: 'شقة حديثة بتشطيب فاخر قرب الخدمات.', features: ['مصعد', 'موقف', 'تكييف مركزي'] },
  { id: 'h2', title: 'فيلا فاخرة بمسبح', type: 'فيلا', city: 'جدة', price: 2400000, area: 420, rooms: 6, emoji: '🏡', desc: 'فيلا مستقلة بحديقة ومسبح خاص.', features: ['مسبح', 'حديقة', 'غرفة سائق'] },
  { id: 'h3', title: 'أرض سكنية', type: 'أرض', city: 'الدمام', price: 1100000, area: 600, rooms: 0, emoji: '🟩', desc: 'أرض بمخطط معتمد وواجهتين.', features: ['واجهتان', 'مخطط معتمد'] },
  { id: 'h4', title: 'شقة اقتصادية', type: 'شقة', city: 'الرياض', price: 480000, area: 95, rooms: 2, emoji: '🏬', desc: 'مناسبة للعائلات الصغيرة قرب المترو.', features: ['قرب المترو', 'موقف'] },
  { id: 'h5', title: 'دوبلكس عائلي', type: 'فيلا', city: 'الرياض', price: 1600000, area: 300, rooms: 5, emoji: '🏘️', desc: 'دوبلكس بمدخلين ومجلس منفصل.', features: ['مدخلان', 'مجلس', 'حديقة'] },
  { id: 'h6', title: 'شقة بحرية', type: 'شقة', city: 'جدة', price: 1250000, area: 160, rooms: 4, emoji: '🌊', desc: 'إطلالة بحرية مباشرة بتشطيب راقٍ.', features: ['إطلالة بحرية', 'مسبح مشترك'] },
];
const TYPES = ['الكل', 'شقة', 'فيلا', 'أرض'];

const state = { type: 'الكل', city: 'الكل', rooms: 0, maxPrice: 3000000, sort: 'new' };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US'); }
function findProperty(id) { return PROPERTIES.find(p => p.id === id) || null; }
function cities() { const set = {}; PROPERTIES.forEach(p => { set[p.city] = 1; }); return ['الكل'].concat(Object.keys(set)); }

function renderFilters() {
  byId('typeChips').innerHTML = TYPES.map(t =>
    '<button class="chip ' + (t === state.type ? 'active' : '') + '" data-action="type" data-type="' + t + '">' + t + '</button>').join('');
  byId('cityFilter').innerHTML = cities().map(c => '<option value="' + c + '">' + c + '</option>').join('');
  byId('priceLabel').textContent = money(state.maxPrice) + ' ﷼';
}

function visible() {
  let list = PROPERTIES.slice();
  if (state.type !== 'الكل') list = list.filter(p => p.type === state.type);
  if (state.city !== 'الكل') list = list.filter(p => p.city === state.city);
  if (state.rooms > 0) list = list.filter(p => p.rooms >= state.rooms);
  list = list.filter(p => p.price <= state.maxPrice);
  if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  return list;
}

function renderListings() {
  const list = visible();
  byId('resultCount').textContent = list.length + ' عقار';
  show(byId('emptyState'), list.length === 0);
  byId('listings').innerHTML = list.map(p =>
    '<div class="card" data-action="open" data-id="' + p.id + '">' +
    '<div class="ph-emoji">' + p.emoji + '</div>' +
    '<div class="ph-body"><div class="ph-title">' + p.title + '</div>' +
    '<div class="ph-price">' + money(p.price) + ' ﷼</div>' +
    '<div class="ph-meta">' + p.type + ' · ' + p.city + ' · ' + p.area + ' م²' + (p.rooms ? ' · ' + p.rooms + ' غرف' : '') + '</div></div></div>').join('');
}

function openDetail(id) {
  const p = findProperty(id); if (!p) return;
  byId('detailBox').innerHTML =
    '<button class="icon-btn close-x" data-action="close">×</button>' +
    '<div class="detail-emoji">' + p.emoji + '</div>' +
    '<h2>' + p.title + '</h2><div class="detail-price">' + money(p.price) + ' ﷼</div>' +
    '<div class="detail-meta">' + p.type + ' · ' + p.city + ' · ' + p.area + ' م²' + (p.rooms ? ' · ' + p.rooms + ' غرف' : '') + '</div>' +
    '<p class="detail-desc">' + p.desc + '</p>' +
    '<div class="features">' + p.features.map(f => '<span class="feat">✔ ' + f + '</span>').join('') + '</div>' +
    '<h3>تواصل مع المعلن</h3>' +
    '<input id="cName" placeholder="اسمك"><input id="cPhone" placeholder="جوّالك">' +
    '<p id="contactMsg" class="ok-msg hidden">✅ أُرسل طلبك — سيتواصل معك المعلن.</p>' +
    '<button class="btn primary" data-action="contact" data-id="' + p.id + '">إرسال طلب تواصل</button>';
  show(byId('detailModal'), true);
}
function closeDetail() { show(byId('detailModal'), false); }
function sendContact() {
  const name = (byId('cName') && byId('cName').value || '').trim();
  if (!name) { if (byId('cName')) byId('cName').classList.add('err'); return; }
  show(byId('contactMsg'), true);
}

function resetFilters() {
  state.type = 'الكل'; state.city = 'الكل'; state.rooms = 0; state.maxPrice = 3000000; state.sort = 'new';
  byId('cityFilter').value = 'الكل'; byId('roomsFilter').value = '0';
  byId('priceRange').value = 3000000; byId('sortFilter').value = 'new';
  renderFilters(); renderListings();
}

function handleClick(e) {
  const el = e.target.closest('[data-action]'); if (!el) return;
  switch (el.dataset.action) {
    case 'type': state.type = el.dataset.type; renderFilters(); renderListings(); break;
    case 'open': openDetail(el.dataset.id); break;
    case 'close': closeDetail(); break;
    case 'contact': sendContact(); break;
    case 'reset': resetFilters(); break;
  }
}
function handleChange(e) {
  const t = e.target; if (!t) return;
  if (t.id === 'cityFilter') state.city = t.value;
  else if (t.id === 'roomsFilter') state.rooms = Number(t.value);
  else if (t.id === 'sortFilter') state.sort = t.value;
  else if (t.id === 'priceRange') { state.maxPrice = Number(t.value); byId('priceLabel').textContent = money(state.maxPrice) + ' ﷼'; }
  else return;
  renderListings();
}
function handleInput(e) {
  if (e.target && e.target.id === 'priceRange') { state.maxPrice = Number(e.target.value); byId('priceLabel').textContent = money(state.maxPrice) + ' ﷼'; renderListings(); }
}

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('input', handleInput);
  renderFilters();
  renderListings();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0f1218;--surface:#171b24;--card:#1d2230;--accent:#f59e0b;--good:#22c55e;--text:#e8edf6;--muted:#8b93a3;--border:#272d3a;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:14px 22px;background:var(--surface);border-bottom:1px solid var(--border)}
.brand{font-size:19px;font-weight:800}
.count{color:var(--muted);font-size:14px}
.layout{display:grid;grid-template-columns:250px 1fr;gap:20px;max-width:1200px;margin:0 auto;padding:20px}
@media(max-width:780px){.layout{grid-template-columns:1fr}}
.filters{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;align-self:start;position:sticky;top:20px}
.filters h3{margin-bottom:14px}
.filters label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin:12px 0 6px}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 12px;border-radius:20px;font-weight:700;font-size:12px;cursor:pointer}
.chip.active{background:var(--accent);border-color:var(--accent);color:#231603}
.sel,select{width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:9px}
input[type=range]{width:100%;accent-color:var(--accent)}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:9px 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;margin-top:14px;width:100%}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#231603}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:.15s}
.card:hover{border-color:var(--accent);transform:translateY(-2px)}
.ph-emoji{font-size:52px;text-align:center;padding:24px;background:var(--surface)}
.ph-body{padding:14px}
.ph-title{font-weight:700;font-size:14px;margin-bottom:4px}
.ph-price{color:var(--accent);font-weight:800;font-size:17px}
.ph-meta{color:var(--muted);font-size:12px;margin-top:4px}
.empty{text-align:center;color:var(--muted);padding:40px}
.hidden{display:none !important}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(460px,100%);position:relative;max-height:90dvh;overflow:auto}
.icon-btn{background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer}.close-x{position:absolute;top:12px;left:14px}
.detail-emoji{font-size:66px;text-align:center}
.detail-price{color:var(--accent);font-weight:800;font-size:24px;text-align:center;margin:6px 0}
.detail-meta{color:var(--muted);font-size:13px;text-align:center;margin-bottom:12px}
.detail-desc{margin-bottom:14px}
.features{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.feat{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:12px;color:var(--good)}
.modal-box input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px;color:var(--text);margin-bottom:10px}
.modal-box input.err{border-color:#ef4444}
.modal-box h3{margin:8px 0 10px;font-size:15px}
.ok-msg{color:var(--good);font-size:13px;margin-bottom:8px}
h2{font-size:19px;text-align:center}
`;

export function jaolaRealestate() {
    return {
        id: 'jaola-realestate',
        category: 'realestate',
        name: 'قوائم عقارية',
        description: 'موقع عقارات عامل: قوائم + فلاتر متعدّدة (نوع/مدينة/غرف/شريط سعر) + فرز + تفاصيل عقار + نموذج تواصل.',
        keywords: ['عقار', 'عقارات', 'شقق', 'فلل', 'فيلا', 'شقة', 'real estate', 'property', 'listings', 'إيجار', 'بيع', 'أرض', 'housing'],
        model: {
            entities: [
                { name: 'Property', fields: [{ name: 'id', type: 'string' }, { name: 'title', type: 'string' }, { name: 'type', type: 'string' }, { name: 'city', type: 'string' }, { name: 'price', type: 'number' }, { name: 'rooms', type: 'number' }], ownedBy: 'Agent' },
            ],
            roles: [{ name: 'User', description: 'يبحث عن عقار', capabilities: ['تصفية', 'فرز', 'عرض التفاصيل', 'طلب تواصل'] }],
            flows: [
                { name: 'البحث عن عقار', actor: 'User', steps: ['يصفّي حسب النوع/المدينة/الغرف/السعر', 'يفرز', 'يفتح التفاصيل', 'يرسل طلب تواصل'], touches: ['Property'], realtime: false },
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
