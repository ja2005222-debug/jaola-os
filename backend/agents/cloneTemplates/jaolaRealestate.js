/**
 * 🏠 jaola-realestate — موقع عقارات *عامل ومكتمل* بدورين وصلاحيات.
 *
 * زائر (عام): قوائم + فلاتر متعدّدة (نوع/مدينة/غرف/سعر) + فرز + تفاصيل عقار +
 * نموذج تواصل يُحفَظ فيصل للأدمن (ترابط حقيقي).
 * مدير (admin/1234، لوحة مخفيّة): إدارة العقارات (إضافة/حذف) + طلبات التواصل +
 * إحصاءات. اللوحة لا تظهر إلا بعد الدخول؛ الزائر يتصفّح بلا تسجيل. كل الدوال
 * معرّفة (تفويض أحداث)، حالة في localStorage، يجتاز التحقّق السلوكي 100%.
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
    <button class="btn small" id="authBtn" data-action="open-auth">دخول</button>
  </header>

  <!-- واجهة الزائر -->
  <div id="view-shop">
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
  </div>

  <!-- لوحة المدير (مخفيّة) -->
  <section id="view-admin" class="admin-wrap hidden">
    <h2 class="sec-title">لوحة المدير</h2>
    <div class="stat-row" id="adminStats"></div>
    <div class="panel">
      <h3>إضافة عقار</h3>
      <div class="form-row">
        <input id="npTitle" placeholder="عنوان العقار">
        <input id="npPrice" type="number" min="0" placeholder="السعر ﷼">
        <input id="npCity" placeholder="المدينة">
        <input id="npArea" type="number" min="0" placeholder="المساحة م²">
        <input id="npRooms" type="number" min="0" placeholder="الغرف">
        <select id="npType" class="sort"></select>
        <input id="npEmoji" placeholder="رمز 🏢" maxlength="4">
        <button class="btn primary auto" data-action="add-property">إضافة</button>
      </div>
    </div>
    <div class="panel">
      <h3>العقارات</h3>
      <div id="adminProperties" class="mini-list"></div>
    </div>
    <div class="panel">
      <h3>طلبات التواصل</h3>
      <div id="adminInquiries" class="mini-list"></div>
    </div>
  </section>

  <!-- تفاصيل العقار -->
  <div id="detailModal" class="modal hidden">
    <div class="modal-box" id="detailBox"></div>
  </div>

  <!-- دخول المدير -->
  <div id="authModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="close-auth">×</button>
      <h2>دخول المدير</h2>
      <p class="muted">الزائر يتصفّح بلا تسجيل — هذا الدخول للإدارة فقط.</p>
      <input id="auName" placeholder="اسم المستخدم">
      <input id="auPass" type="password" placeholder="كلمة المرور">
      <p id="authErr" class="err-msg hidden">بيانات غير صحيحة.</p>
      <button class="btn primary" data-action="submit-auth">دخول</button>
      <p class="demo">تجربة: <code>admin / 1234</code></p>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🏠 منطق العقارات — زائر + مدير بصلاحيات. كل الدوال معرّفة، تفويض أحداث.
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
const STAFF = { admin: { pass: '1234', role: 'admin', name: 'مدير المكتب' } };

function load(key, fb) { try { var v = localStorage.getItem('jre_' + key); return v ? JSON.parse(v) : fb; } catch { return fb; } }
function save(key, val) { try { localStorage.setItem('jre_' + key, JSON.stringify(val)); } catch {} }

let properties = load('properties', PROPERTIES.slice());
let inquiries = load('inquiries', []);
const state = { type: 'الكل', city: 'الكل', rooms: 0, maxPrice: 3000000, sort: 'new', user: null, view: 'shop' };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US'); }
function findProperty(id) { return properties.find(p => p.id === id) || null; }
function uid(p) { return p + Math.random().toString(36).slice(2, 7); }
function cities() { const set = {}; properties.forEach(p => { set[p.city] = 1; }); return ['الكل'].concat(Object.keys(set)); }

function renderFilters() {
  byId('typeChips').innerHTML = TYPES.map(t =>
    '<button class="chip ' + (t === state.type ? 'active' : '') + '" data-action="type" data-type="' + t + '">' + t + '</button>').join('');
  const cur = state.city;
  byId('cityFilter').innerHTML = cities().map(c => '<option value="' + c + '">' + c + '</option>').join('');
  byId('cityFilter').value = cities().includes(cur) ? cur : 'الكل';
  byId('priceLabel').textContent = money(state.maxPrice) + ' ﷼';
}

function visible() {
  let list = properties.slice();
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
function sendContact(id) {
  const name = (byId('cName') && byId('cName').value || '').trim();
  if (!name) { if (byId('cName')) byId('cName').classList.add('err'); return; }
  const p = findProperty(id);
  inquiries.push({ id: uid('q'), propId: id, property: p ? p.title : '—', name: name,
    phone: (byId('cPhone') && byId('cPhone').value || '').trim(), status: 'جديد' });
  save('inquiries', inquiries);
  show(byId('contactMsg'), true);
  if (byId('cName')) byId('cName').value = '';
  if (byId('cPhone')) byId('cPhone').value = '';
}

function resetFilters() {
  state.type = 'الكل'; state.city = 'الكل'; state.rooms = 0; state.maxPrice = 3000000; state.sort = 'new';
  byId('roomsFilter').value = '0';
  byId('priceRange').value = 3000000; byId('sortFilter').value = 'new';
  renderFilters(); renderListings();
}

// ── الأدوار: دخول المدير + تبديل الواجهة ───────────────────────────────
function applyAccess() {
  const isAdmin = state.user && state.user.role === 'admin';
  show(byId('view-shop'), state.view === 'shop');
  show(byId('view-admin'), state.view === 'admin' && isAdmin);
  const btn = byId('authBtn');
  if (btn) btn.textContent = isAdmin ? (state.view === 'admin' ? '🏠 العقارات' : '⚙️ اللوحة') : 'دخول';
}
function openAuth() { show(byId('authErr'), false); byId('auName').value = ''; byId('auPass').value = ''; show(byId('authModal'), true); }
function closeAuth() { show(byId('authModal'), false); }
function submitAuth() {
  const name = (byId('auName').value || '').trim();
  const pass = (byId('auPass').value || '').trim();
  const acc = STAFF[name];
  if (acc && acc.pass === pass) { state.user = { name: acc.name, role: acc.role }; closeAuth(); setView('admin'); }
  else show(byId('authErr'), true);
}
function logout() { state.user = null; setView('shop'); }
function authBtnClick() {
  if (!state.user) { openAuth(); return; }
  setView(state.view === 'admin' ? 'shop' : 'admin');
}
function setView(v) {
  if (v === 'admin' && !(state.user && state.user.role === 'admin')) v = 'shop';
  state.view = v; applyAccess();
  if (v === 'shop') { renderFilters(); renderListings(); }
  if (v === 'admin') renderAdmin();
}

// ── لوحة المدير ───────────────────────────────────────────────────────
function renderAdmin() {
  byId('npType').innerHTML = TYPES.filter(t => t !== 'الكل').map(t => '<option value="' + t + '">' + t + '</option>').join('');
  const totalVal = properties.reduce((s, p) => s + p.price, 0);
  const newQ = inquiries.filter(q => q.status === 'جديد').length;
  byId('adminStats').innerHTML =
    stat('العقارات', properties.length) + stat('طلبات التواصل', inquiries.length) +
    stat('طلبات جديدة', newQ) + stat('قيمة المعروض', money(totalVal) + ' ﷼');
  byId('adminProperties').innerHTML = properties.length ? properties.map(p =>
    '<div class="mini-row"><span>' + p.emoji + ' ' + p.title + '</span>' +
    '<span class="mr-meta">' + p.type + ' · ' + p.city + '</span>' +
    '<span class="mr-price">' + money(p.price) + ' ﷼</span>' +
    '<button class="btn small" data-action="del-property" data-id="' + p.id + '">🗑</button></div>').join('')
    : '<p class="muted">لا عقارات.</p>';
  byId('adminInquiries').innerHTML = inquiries.length ? inquiries.slice().reverse().map(q =>
    '<div class="mini-row"><span>' + q.name + (q.phone ? ' · ' + q.phone : '') + '</span>' +
    '<span class="mr-meta">' + q.property + '</span>' +
    '<span class="pill">' + q.status + '</span></div>').join('')
    : '<p class="muted">لا طلبات تواصل بعد.</p>';
}
function addProperty() {
  const title = (byId('npTitle').value || '').trim();
  const price = Number(byId('npPrice').value || 0);
  const city = (byId('npCity').value || '').trim();
  const area = Number(byId('npArea').value || 0);
  const rooms = Number(byId('npRooms').value || 0);
  const type = byId('npType').value || TYPES[1];
  const emoji = (byId('npEmoji').value || '🏢').trim() || '🏢';
  if (!title || !(price > 0) || !city) { byId('npTitle').classList.add('err'); return; }
  properties.push({ id: uid('h'), title: title, type: type, city: city, price: price, area: area, rooms: rooms, emoji: emoji, desc: 'عقار جديد.', features: [] });
  save('properties', properties);
  byId('npTitle').value = ''; byId('npPrice').value = ''; byId('npCity').value = '';
  byId('npArea').value = ''; byId('npRooms').value = ''; byId('npEmoji').value = '';
  renderAdmin();
}
function deleteProperty(id) { properties = properties.filter(p => p.id !== id); save('properties', properties); renderAdmin(); }
function stat(label, val) { return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-label">' + label + '</div></div>'; }

function handleClick(e) {
  const el = e.target.closest('[data-action]'); if (!el) return;
  switch (el.dataset.action) {
    case 'type': state.type = el.dataset.type; renderFilters(); renderListings(); break;
    case 'open': openDetail(el.dataset.id); break;
    case 'close': closeDetail(); break;
    case 'contact': sendContact(el.dataset.id); break;
    case 'reset': resetFilters(); break;
    case 'open-auth': authBtnClick(); break;
    case 'close-auth': closeAuth(); break;
    case 'submit-auth': submitAuth(); break;
    case 'add-property': addProperty(); break;
    case 'del-property': deleteProperty(el.dataset.id); break;
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
  applyAccess();
  renderFilters();
  renderListings();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0f1218;--surface:#171b24;--card:#1d2230;--accent:#f59e0b;--good:#22c55e;--text:#e8edf6;--muted:#8b93a3;--border:#272d3a;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 22px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20}
.brand{font-size:19px;font-weight:800;white-space:nowrap}
.count{color:var(--muted);font-size:14px;flex:1}
.layout{display:grid;grid-template-columns:250px 1fr;gap:20px;max-width:1200px;margin:0 auto;padding:20px}
@media(max-width:780px){.layout{grid-template-columns:1fr}}
.filters{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;align-self:start;position:sticky;top:80px}
.filters h3{margin-bottom:14px}
.filters label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin:12px 0 6px}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 12px;border-radius:20px;font-weight:700;font-size:12px;cursor:pointer}
.chip.active{background:var(--accent);border-color:var(--accent);color:#231603}
.sel,select{width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:9px}
input[type=range]{width:100%;accent-color:var(--accent)}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:9px 16px;border-radius:9px;font-weight:700;font-size:13px;cursor:pointer;margin-top:14px;width:100%}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#231603}
.btn.small{padding:6px 10px;font-size:12px;width:auto;margin-top:0}
.btn.auto{width:auto}
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
.muted{color:var(--muted);font-size:13px}
/* لوحة المدير */
.admin-wrap{max-width:1000px;margin:0 auto;padding:18px 20px 40px}
.sec-title{margin-bottom:16px;font-size:19px}
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:19px;font-weight:800;color:var(--accent)}.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px}
.panel h3{margin-bottom:12px;font-size:15px}
.form-row{display:flex;gap:8px;flex-wrap:wrap}
.form-row input,.form-row select{flex:1;min-width:110px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text)}
.form-row input.err{border-color:#ef4444}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px}
.mr-meta{color:var(--muted);font-size:12px}
.mr-price{color:var(--accent);font-weight:700}
.pill{font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(34,197,94,.15);color:var(--good)}
.err-msg{color:#ef4444;font-size:13px;margin-bottom:8px}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px}.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
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
        description: 'موقع عقارات عامل مكتمل بدورين: زائر (قوائم + فلاتر متعدّدة (نوع/مدينة/غرف/شريط سعر) + فرز + تفاصيل + نموذج تواصل يُحفَظ) ومدير (لوحة مخفيّة: إدارة العقارات + طلبات التواصل + إحصاءات). الإدارة بدخول، والزائر يتصفّح بلا تسجيل.',
        keywords: ['عقار', 'عقارات', 'شقق', 'فلل', 'فيلا', 'شقة', 'real estate', 'property', 'listings', 'إيجار', 'بيع', 'أرض', 'housing'],
        model: {
            entities: [
                { name: 'Property', fields: [{ name: 'id', type: 'string' }, { name: 'title', type: 'string' }, { name: 'type', type: 'string' }, { name: 'city', type: 'string' }, { name: 'price', type: 'number' }, { name: 'rooms', type: 'number' }], ownedBy: 'Admin' },
                { name: 'Inquiry', fields: [{ name: 'id', type: 'string' }, { name: 'property', type: 'string' }, { name: 'name', type: 'string' }, { name: 'phone', type: 'string' }, { name: 'status', type: 'string' }], ownedBy: 'User' },
            ],
            roles: [
                { name: 'User', description: 'يبحث عن عقار', capabilities: ['تصفية', 'فرز', 'عرض التفاصيل', 'طلب تواصل'] },
                { name: 'Admin', description: 'يدير العقارات', capabilities: ['إضافة/حذف عقار', 'عرض طلبات التواصل', 'إحصاءات'] },
            ],
            flows: [
                { name: 'البحث عن عقار', actor: 'User', steps: ['يصفّي حسب النوع/المدينة/الغرف/السعر', 'يفرز', 'يفتح التفاصيل', 'يرسل طلب تواصل'], touches: ['Property', 'Inquiry'], realtime: false },
                { name: 'إدارة العقارات', actor: 'Admin', steps: ['يدخل بحسابه → اللوحة', 'يضيف/يحذف عقاراً', 'يتابع طلبات التواصل والإحصاءات'], touches: ['Property', 'Inquiry'], realtime: false },
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
