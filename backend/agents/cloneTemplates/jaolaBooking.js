/**
 * 📅 jaola-booking — حجز مواعيد *عامل* غنيّ بالتفاصيل.
 *
 * من أكثر المشاريع طلباً (صالونات/عيادات/خدمات). نمط UX مختلف: اختيار خدمة →
 * اختيار يوم → فترات زمنية متاحة → تأكيد → لوحة إدارة بالحجوزات.
 * كل الدوال معرّفة، بيانات مشتركة (localStorage). يجتاز التحقّق السلوكي 100%.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>حجز المواعيد</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><span class="mk">📅</span> <span id="brandName">مواعيد jaola</span></div>
    <nav class="tabs" id="tabs">
      <button class="tab active" data-action="tab" data-view="book">حجز موعد</button>
      <button class="tab" data-action="tab" data-view="mine">حجوزاتي</button>
      <button class="tab staff hidden" data-action="tab" data-view="admin">🛠️ الإدارة</button>
    </nav>
    <div class="acct">
      <button class="btn ghost" id="adminBtn" data-action="admin-login">دخول الموظّف</button>
      <button class="btn ghost hidden" id="adminOut" data-action="admin-logout">خروج</button>
    </div>
  </header>

  <main>
    <!-- خطوات الحجز -->
    <section id="book-view" class="view active">
      <div class="hero">
        <div class="ph hero-bg"><img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80&auto=format&fit=crop" alt="" onerror="this.style.display='none'"></div>
        <div class="hero-in">
          <span class="eyebrow">احجز في دقيقة</span>
          <h1>موعدك<br><span class="accent">بين يديك</span></h1>
          <p>اختر خدمتك، ثم اليوم والوقت المناسب — نسخة تجريبية: تُحفظ الحجوزات في هذا المتصفح فقط.</p>
        </div>
      </div>
      <div class="steps-bar" id="stepsBar"></div>

      <div id="step-service" class="step active">
        <h2>1) اختر الخدمة</h2>
        <div id="serviceList" class="cards"></div>
      </div>

      <div id="step-date" class="step">
        <label for="bookingResource">الموظف أو المورد</label><select id="bookingResource" class="hidden"></select>
        <h2>2) اختر اليوم</h2>
        <div id="dateList" class="days"></div>
        <h2 style="margin-top:16px">3) اختر الوقت</h2>
        <div id="slotList" class="slots"></div>
      </div>

      <div id="step-confirm" class="step">
        <h2>4) أكّد الحجز</h2>
        <div id="bookingSummary" class="summary"></div>
        <p id="bookingError" class="err-msg" role="alert"></p>
        <input id="custName" placeholder="اسمك" maxlength="100">
        <input id="custPhone" placeholder="رقم جوّالك">
        <button class="btn primary" data-action="confirm-booking">تأكيد الحجز</button>
      </div>

      <div id="step-done" class="step">
        <div class="done"><div class="done-check">✅</div><h2>تم تأكيد موعدك!</h2>
        <p id="doneMsg" class="muted"></p>
        <button class="btn primary" data-action="new-booking">حجز جديد</button></div>
      </div>
    </section>

    <!-- حجوزاتي -->
    <section id="mine-view" class="view">
      <h2>حجوزاتي</h2>
      <div class="hidden" id="bookingRecovery">
        <p>لاستعادة حجوزاتك على جهاز آخر، احتفظ برمز الاستعادة سراً؛ من يملكه يستطيع عرض حجوزاتك وإلغاءها.</p>
        <button class="btn" data-action="show-recovery">إظهار رمز الاستعادة</button>
        <label for="recoveryCode">رمز الاستعادة</label><input id="recoveryCode" autocomplete="off" spellcheck="false">
        <button class="btn" data-action="restore-bookings">استعادة حجوزاتي</button><p id="recoveryMessage" role="status"></p>
      </div><div id="myBookings" class="list"></div>
    </section>

    <!-- الإدارة -->
    <section id="admin-view" class="view">
      <h2>🛠️ لوحة الإدارة — كل الحجوزات</h2>
      <div id="adminStats" class="stats"></div>
      <div id="adminBookings" class="list"></div>
      <div id="bookingSettings" class="hidden"></div>
    </section>
  </main>

  <div id="loginModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="close-login">×</button>
      <h3>دخول الموظّف</h3>
      <input id="admUser" placeholder="اسم المستخدم"><input id="admPass" type="password" placeholder="كلمة المرور">
      <p id="loginErr" class="err-msg hidden">بيانات غير صحيحة</p>
      <button class="btn primary" data-action="do-admin-login">دخول</button>
      <p class="muted">تجريبي: admin / 1234</p>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 📅 منطق حجز المواعيد — كل الدوال معرّفة، تفويض أحداث، حالة مشتركة.
'use strict';

let SERVICES = [
  { id: 's1', name: 'قصّ وتصفيف', emoji: '💇', dur: 45, price: 80 },
  { id: 's2', name: 'حلاقة ذقن', emoji: '🧔', dur: 30, price: 50 },
  { id: 's3', name: 'استشارة طبية', emoji: '🩺', dur: 30, price: 150 },
  { id: 's4', name: 'جلسة تدليك', emoji: '💆', dur: 60, price: 200 },
];
const SLOTS = ['10:00', '11:00', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00'];
const STEPS = ['service', 'date', 'confirm', 'done'];

const state = {
  view: 'book', step: 'service', isAdmin: false,
  service: null, date: null, slot: null,
  bookings: loadBookings(), busy: false, request: null, viewVersion: 0, resource: 'main', serverDays: null, timezone: 'UTC', configRevision: null,
};

const serverBooking = () => typeof window !== 'undefined' && window.jaolaBookingAPI;
const requiresServer = () => typeof document !== 'undefined' && document.documentElement?.dataset.bookingServer === 'true';
function bookingMessage(error) { if (error?.message === 'SERVICE_CHANGED') return 'تغيرت الخدمة أو السعر. أعد تحميل الصفحة واختر الخدمة من جديد.'; return error?.message === 'SLOT_TAKEN' ? 'هذا الموعد حُجز للتو. اختر وقتاً آخر.' : 'تعذّر إتمام الطلب. أعد المحاولة؛ لا تعتبر الحجز مؤكداً حتى يظهر التأكيد.'; }
function escapeBooking(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function loadBookings() { if (typeof document !== 'undefined' && document.documentElement?.dataset.bookingServer === 'true') return []; try { return JSON.parse(localStorage.getItem('bookings') || '[]'); } catch { return []; } }
function saveBookings() { localStorage.setItem('bookings', JSON.stringify(state.bookings)); }
function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function findService(id) { return SERVICES.find(s => s.id === id) || null; }

// أيام الأسبوع القادمة
function nextDays(n) {
  if (state.serverDays) return state.serverDays.slice(0, n).map(key => ({ key, label: new Date(key + 'T12:00:00Z').toLocaleDateString('ar', { weekday: 'long', timeZone: 'UTC' }), num: Number(key.slice(-2)) }));
  const names = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    if (requiresServer() || serverBooking()) { const utc = new Date(Date.now() + i * 86400000); out.push({ key: utc.toISOString().slice(0, 10), label: names[utc.getUTCDay()], num: utc.getUTCDate() }); continue; }
    out.push({ key: [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'), label: names[d.getDay()], num: d.getDate() });
  }
  return out;
}

// ── التنقّل بين الخطوات ────────────────────────────────────────────────
function renderSteps() {
  const labels = { service: 'الخدمة', date: 'الموعد', confirm: 'التأكيد', done: 'تمّ' };
  const idx = STEPS.indexOf(state.step);
  byId('stepsBar').innerHTML = STEPS.map((s, i) =>
    '<div class="step-dot ' + (i <= idx ? 'done' : '') + '">' + (i + 1) + '. ' + labels[s] + '</div>').join('');
  ['service', 'date', 'confirm', 'done'].forEach(s => {
    const el = byId('step-' + s); if (el) el.classList.toggle('active', s === state.step);
  });
}
function goStep(step) { state.step = step; renderSteps(); if (step === 'confirm') renderSummary(); }

// ── الخطوة 1: الخدمات ──────────────────────────────────────────────────
function renderServices() {
  byId('serviceList').innerHTML = SERVICES.map(s =>
    '<div class="card svc ' + (state.service === s.id ? 'sel' : '') + '" data-action="pick-service" data-id="' + s.id + '">' +
    '<div class="svc-emoji">' + escapeBooking(s.emoji) + '</div><div class="svc-name">' + escapeBooking(s.name) + '</div>' +
    '<div class="muted">' + s.dur + ' د · ' + s.price + ' ﷼</div></div>').join('');
}
function pickService(id) { state.service = id; renderServices(); goStep('date'); renderDates(); }

// ── الخطوة 2: التاريخ والوقت ───────────────────────────────────────────
function renderDates() {
  byId('dateList').innerHTML = nextDays(7).map(d =>
    '<button class="day ' + (state.date === d.key ? 'sel' : '') + '" data-action="pick-date" data-key="' + d.key + '">' +
    '<div class="day-name">' + d.label + '</div><div class="day-num">' + d.num + '</div></button>').join('');
  renderSlots();
}
async function renderSlots() {
  if (requiresServer() || serverBooking()) return renderServerSlots();
  const el = byId('slotList');
  if (!state.date) { el.innerHTML = '<p class="muted">اختر يوماً أولاً.</p>'; return; }
  const taken = state.bookings.filter(b => b.date === state.date).map(b => b.slot);
  el.innerHTML = SLOTS.map(s => {
    const busy = taken.includes(s);
    return '<button class="slot ' + (busy ? 'busy' : '') + ' ' + (state.slot === s ? 'sel' : '') + '"' +
      (busy ? ' disabled' : ' data-action="pick-slot" data-slot="' + s + '"') + '>' + s + (busy ? ' (محجوز)' : '') + '</button>';
  }).join('');
}
function pickDate(key) { state.date = key; state.slot = null; renderDates(); }
function pickSlot(slot) { state.request = null; state.slot = slot; renderSlots(); goStep('confirm'); }

// ── الخطوة 3: التأكيد ─────────────────────────────────────────────────
function renderSummary() {
  const s = findService(state.service);
  byId('bookingSummary').innerHTML = s ?
    '<div class="sum-row"><span>الخدمة</span><b>' + escapeBooking(s.emoji) + ' ' + escapeBooking(s.name) + '</b></div>' +
    '<div class="sum-row"><span>اليوم</span><b>' + (state.date || '') + '</b></div>' +
    '<div class="sum-row"><span>الوقت</span><b>' + (state.slot || '') + '</b></div>' +
    '<div class="sum-row"><span>السعر</span><b>' + s.price + ' ﷼</b></div>' : '';
}
async function confirmBooking() {
  if (requiresServer() && !serverBooking()) { byId('bookingError').textContent = 'تعذّر الاتصال بخدمة الحجز. أعد تحميل الصفحة.'; return; }
  if (serverBooking()) return confirmServerBooking();
  const name = (byId('custName') && byId('custName').value || '').trim();
  if (!name) { if (byId('custName')) byId('custName').classList.add('err'); return; }
  const s = findService(state.service);
  const error = byId('bookingError');
  error.textContent = '';
  if (state.step !== 'confirm') return;
  if (!s || name.length > 100 || !nextDays(7).some(d => d.key === state.date) || !SLOTS.includes(state.slot) || new Date(state.date + 'T' + state.slot).getTime() <= Date.now()) {
    error.textContent = 'اختر خدمة وموعداً متاحاً في المستقبل.'; return;
  }
  let latest;
  try {
    latest = JSON.parse(localStorage.getItem('bookings') || '[]');
    if (!Array.isArray(latest) || latest.some(b => !b || !Number.isSafeInteger(b.id) || b.id < 0)) throw new Error('invalid bookings');
  } catch { error.textContent = 'تعذّر قراءة الحجوزات. لم يتم تأكيد الموعد.'; return; }
  if (latest.some(b => b.date === state.date && b.slot === state.slot)) {
    error.textContent = 'هذا الموعد محجوز. اختر وقتاً آخر.'; return;
  }
  const id = Math.max(99, ...latest.map(b => b.id)) + 1;
  if (!Number.isSafeInteger(id)) { error.textContent = 'تعذّر إنشاء رقم الحجز.'; return; }
  const updated = latest.concat({
    id: id, service: s.name, emoji: s.emoji, price: s.price,
    date: state.date, slot: state.slot, customer: name, phone: (byId('custPhone') && byId('custPhone').value) || '',
    status: 'مؤكّد',
  });
  try { localStorage.setItem('bookings', JSON.stringify(updated)); }
  catch { error.textContent = 'تعذّر حفظ الحجز. حاول مرة أخرى.'; return; }
  state.bookings = updated;
  byId('doneMsg').textContent = 'رقم الحجز #' + id + ' — ' + (s ? s.name : '') + ' يوم ' + state.date + ' الساعة ' + state.slot;
  goStep('done');
}
function newBooking() { state.service = null; state.date = null; state.slot = null; goStep('service'); renderServices(); }

async function renderServerSlots() {
  const date = state.date;
  const el = byId('slotList');
  el.textContent = date ? 'جارٍ التحقق من المواعيد…' : 'اختر يوماً أولاً.';
  if (!date) return;
  try {
    const data = await serverBooking().availability(state.service, state.resource);
    state.serverDays = data.days; state.timezone = data.timezone;
    if (state.date !== date) return;
    el.innerHTML = data.slots.map(slot => {
      const busy = !data.offers.some(o => o.date === date && o.slot === slot && o.service === state.service && o.resource === state.resource);
      return '<button class="slot" ' + (busy ? 'disabled' : 'data-action="pick-slot" data-slot="' + escapeBooking(slot) + '"') + '>' + escapeBooking(slot) + (busy ? ' (غير متاح)' : '') + '</button>';
    }).join('');
  } catch { el.textContent = 'تعذّر التحقق من المواعيد. أعد اختيار اليوم للمحاولة.'; }
}
async function confirmServerBooking() {
  if (state.busy || state.step !== 'confirm') return;
  const selected = SERVICES.find(s => s.id === state.service);
  const payload = { quotedPrice: selected?.price, quotedDuration: selected?.dur, resource: state.resource, service: state.service, date: state.date, slot: state.slot, customer: byId('custName').value.trim(), phone: byId('custPhone').value.trim() };
  if (!payload.customer || !payload.phone) { byId('bookingError').textContent = 'أدخل الاسم ورقم الهاتف.'; return; }
  const fingerprint = JSON.stringify(payload);
  if (!state.request || state.request.fingerprint !== fingerprint) state.request = { fingerprint, id: crypto.randomUUID() };
  state.busy = true;
  byId('bookingError').textContent = 'جارٍ حفظ الحجز…';
  try {
    const saved = await serverBooking().create({ ...payload, requestId: state.request.id });
    byId('doneMsg').textContent = 'رقم الحجز ' + saved.id + ' — ' + saved.date + ' ' + saved.slot + ' ' + (saved.timezone || state.timezone) + ' — احفظ رمز الاستعادة من تبويب حجوزاتي.';
    byId('bookingError').textContent = '';
    goStep('done');
  } catch (error) { byId('bookingError').textContent = bookingMessage(error); }
  finally { state.busy = false; }
}

// ── حجوزاتي ───────────────────────────────────────────────────────────
async function renderMine() {
  if (requiresServer() || serverBooking()) {
    byId('myBookings').textContent = 'جارٍ تحميل حجوزاتك…';
    const version = state.viewVersion;
    try { const rows = await serverBooking().mine(); if (version !== state.viewVersion || state.view !== 'mine') return; state.bookings = rows; } catch { byId('myBookings').textContent = 'تعذّر تحميل الحجوزات.'; return; }
  }
  const el = byId('myBookings');
  el.innerHTML = state.bookings.length ? state.bookings.map(bookingCard).join('') : '<p class="muted">لا حجوزات بعد.</p>';
}

// ── الإدارة ───────────────────────────────────────────────────────────
async function renderAdmin() {
  if (requiresServer() || serverBooking()) {
    byId('adminBookings').textContent = 'جارٍ التحميل…';
    const version = state.viewVersion;
    try { const rows = await serverBooking().listAdmin(); if (version !== state.viewVersion || !state.isAdmin || state.view !== 'admin') return; state.bookings = rows; } catch { state.bookings = []; byId('adminStats').textContent = ''; byId('adminBookings').textContent = 'يلزم تسجيل دخول الإدارة مجدداً.'; return; }
  }
  if (serverBooking()) { await renderBookingSettings(); if (!state.isAdmin || state.view !== 'admin') return; }
  const total = state.bookings.length;
  const revenue = state.bookings.filter(b => b.status === 'مؤكّد').reduce((s, b) => s + (b.price || 0), 0);
  byId('adminStats').innerHTML =
    '<div class="stat"><div class="stat-val">' + total + '</div><div class="stat-label">الحجوزات</div></div>' +
    '<div class="stat"><div class="stat-val">' + revenue + ' ﷼</div><div class="stat-label">قيمة الحجوزات المؤكدة</div></div>' +
    '<div class="stat"><div class="stat-val">' + SERVICES.length + '</div><div class="stat-label">الخدمات</div></div>';
  byId('adminBookings').innerHTML = state.bookings.length ? state.bookings.map(b => bookingCard(b, true)).join('') : '<p class="muted">لا حجوزات.</p>';
}
async function cancelBooking(id) {
  if (requiresServer() || serverBooking()) {
    try { await serverBooking().cancel(id, state.view === 'admin'); if (state.view === 'admin') await renderAdmin(); else await renderMine(); }
    catch { alert('تعذّر إلغاء الحجز. أعد المحاولة.'); }
    return;
  }
  state.bookings = state.bookings.filter(b => b.id !== Number(id));
  saveBookings();
  if (state.view === 'admin') renderAdmin(); else renderMine();
}
function bookingCard(b, admin) {
  b = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, escapeBooking(v)]));
  return '<div class="booking"><span class="b-emoji">' + b.emoji + '</span>' +
    '<div class="b-info"><b>' + b.service + '</b><div class="muted">' + b.date + ' · ' + b.slot +
    ' · ' + (b.timezone || 'UTC') + ' · ' + (b.resource || 'main') + (admin ? ' · ' + b.customer + ' · ' + b.phone : '') + '</div></div>' +
    '<span class="badge">' + b.status + '</span>' +
    '<button class="btn small danger" data-action="cancel" data-id="' + b.id + '">إلغاء</button></div>';
}

// ── التبويبات والدخول ─────────────────────────────────────────────────
function switchView(view) {
  if (view === 'admin' && !state.isAdmin) { openLogin(); return; }
  state.viewVersion++;
  state.view = view;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = byId(view + '-view'); if (el) el.classList.add('active');
  if (view === 'mine') renderMine();
  if (view === 'admin') renderAdmin();
}
function openLogin() { show(byId('loginModal'), true); byId('loginErr').classList.add('hidden'); }
function closeLogin() { show(byId('loginModal'), false); }
async function doAdminLogin() {
  if (requiresServer() || serverBooking()) {
    try { await serverBooking().login(byId('admPass').value); byId('admPass').value = ''; state.isAdmin = true; closeLogin(); document.querySelector('.tab.staff').classList.remove('hidden'); show(byId('adminBtn'), false); show(byId('adminOut'), true); switchView('admin'); }
    catch { byId('admPass').value = ''; byId('loginErr').textContent = 'تعذّر الدخول. تأكد من كلمة المرور التي أعددتها في لوحة مشروعك.'; byId('loginErr').classList.remove('hidden'); }
    return;
  }
  const u = (byId('admUser') && byId('admUser').value || '').trim();
  const p = (byId('admPass') && byId('admPass').value || '').trim();
  if (u === 'admin' && p === '1234') {
    state.isAdmin = true; closeLogin();
    document.querySelector('.tab.staff').classList.remove('hidden');
    show(byId('adminBtn'), false); show(byId('adminOut'), true);
    switchView('admin');
  } else { byId('loginErr').classList.remove('hidden'); }
}
function adminLogout() {
  if (serverBooking()) serverBooking().logout();
  state.bookings = [];
  byId('bookingSettings').textContent = '';
  byId('adminBookings').textContent = ''; byId('adminStats').textContent = '';
  state.isAdmin = false;
  document.querySelector('.tab.staff').classList.add('hidden');
  show(byId('adminBtn'), true); show(byId('adminOut'), false);
  switchView('book');
}

async function refreshBookingCatalog() {
  try {
    const data = await serverBooking().availability();
    SERVICES = data.services; state.serverDays = data.days; state.timezone = data.timezone;
    state.resource = data.resources.some(r => r.id === state.resource) ? state.resource : data.resources[0].id;
    byId('bookingResource').innerHTML = data.resources.map(r => '<option value="' + escapeBooking(r.id) + '">' + escapeBooking(r.name) + '</option>').join('');
    byId('bookingResource').value = state.resource; show(byId('bookingResource'), true);
    document.querySelector('.hero p').textContent = 'حجز محفوظ على الخادم — التوقيت: ' + data.timezone;
    renderServices();
  } catch { document.querySelector('.hero p').textContent = 'تعذّر تحميل الخدمات. أعد تحميل الصفحة للمحاولة.'; }
}
async function restoreBookings() {
  try { await serverBooking().restore(byId('recoveryCode').value.trim()); byId('recoveryCode').value = ''; byId('recoveryMessage').textContent = 'تمت الاستعادة.'; await renderMine(); }
  catch { byId('recoveryMessage').textContent = 'تعذّرت الاستعادة. تحقق من الرمز والاتصال.'; }
}
function bookingSettingRow(kind, item) {
  return '<div data-setting-row="' + kind + '" data-id="' + escapeBooking(item.id) + '">' +
    '<label>الاسم<input data-field="name" maxlength="80" value="' + escapeBooking(item.name) + '"></label>' +
    (kind === 'services' ? '<label>المدة بالدقائق<input data-field="dur" type="number" min="5" max="240" value="' + item.dur + '"></label><label>السعر<input data-field="price" type="number" min="0" step="0.01" value="' + item.price + '"></label>' : '') +
    '<button class="btn" data-action="remove-booking-setting">حذف من القائمة</button></div>';
}
function addBookingSetting(kind) {
  const item = { id: 'b_' + crypto.randomUUID().slice(0, 8), name: '', dur: 30, price: 0 };
  byId('settings-' + kind).insertAdjacentHTML('beforeend', bookingSettingRow(kind, item));
}
async function renderBookingSettings() {
  const version = state.viewVersion;
  try {
    const data = await serverBooking().configuration();
    if (!state.isAdmin || version !== state.viewVersion || state.view !== 'admin') return;
    state.configRevision = data.revision;
    byId('bookingSettings').innerHTML = '<h2>إعدادات الحجز</h2><label>المنطقة الزمنية (مثل Africa/Khartoum أو Europe/Amsterdam)<input id="settings-timezone" value="' + escapeBooking(data.config.timezone) + '"></label>' +
      '<label>أوقات بدء المواعيد، مفصولة بفاصلة<input id="settings-slots" value="' + escapeBooking(data.config.slots.join(', ')) + '"></label>' +
      '<h3>الموظفون أو الموارد</h3><div id="settings-resources">' + data.config.resources.map(r => bookingSettingRow('resources', r)).join('') + '</div><button class="btn" data-action="add-booking-resource">إضافة موظف</button>' +
      '<h3>الخدمات</h3><div id="settings-services">' + data.config.services.map(r => bookingSettingRow('services', r)).join('') + '</div><button class="btn" data-action="add-booking-service">إضافة خدمة</button>' +
      '<button class="btn primary" data-action="save-booking-settings">حفظ الإعدادات</button><p id="settings-message" role="status"></p>';
    show(byId('bookingSettings'), true);
  } catch { byId('bookingSettings').textContent = 'تعذّر تحميل إعدادات الحجز.'; }
}
async function saveBookingSettings() {
  const config = { timezone: byId('settings-timezone').value.trim(), slots: byId('settings-slots').value.split(/[,،]/).map(v => v.trim()).filter(Boolean) };
  for (const kind of ['services', 'resources']) config[kind] = Array.from(document.querySelectorAll('[data-setting-row="' + kind + '"]')).map(row => {
    const item = { id: row.dataset.id, name: row.querySelector('[data-field="name"]').value };
    if (kind === 'services') Object.assign(item, { dur: Number(row.querySelector('[data-field="dur"]').value), price: Number(row.querySelector('[data-field="price"]').value), emoji: '📅' });
    return item;
  });
  try { await serverBooking().configure({ revision: state.configRevision, config }); await refreshBookingCatalog(); await renderAdmin(); byId('settings-message').textContent = 'تم الحفظ. الحجوزات السابقة تحتفظ بوقتها وسعرها.'; }
  catch { byId('settings-message').textContent = 'تعذّر الحفظ: راجع الحقول. عند تعارض التحديث أعد فتح الإدارة؛ لا يمكن حذف موظف لديه مواعيد قادمة.'; }
}

// ── تفويض الأحداث ─────────────────────────────────────────────────────
function handleClick(e) {
  const el = e.target.closest('[data-action]'); if (!el) return;
  switch (el.dataset.action) {
    case 'show-recovery': byId('recoveryCode').value = serverBooking().recoveryCode(); break;
    case 'restore-bookings': restoreBookings(); break;
    case 'save-booking-settings': saveBookingSettings(); break;
    case 'add-booking-service': addBookingSetting('services'); break;
    case 'add-booking-resource': addBookingSetting('resources'); break;
    case 'remove-booking-setting': el.closest('[data-setting-row]').remove(); break;
    case 'tab': switchView(el.dataset.view); break;
    case 'pick-service': pickService(el.dataset.id); break;
    case 'pick-date': pickDate(el.dataset.key); break;
    case 'pick-slot': pickSlot(el.dataset.slot); break;
    case 'confirm-booking': confirmBooking(); break;
    case 'new-booking': newBooking(); break;
    case 'cancel': cancelBooking(el.dataset.id); break;
    case 'admin-login': openLogin(); break;
    case 'do-admin-login': doAdminLogin(); break;
    case 'close-login': closeLogin(); break;
    case 'admin-logout': adminLogout(); break;
  }
}

function init() {
  if (requiresServer() || serverBooking()) {
    document.querySelector('.hero p').textContent = 'جارٍ تحميل الخدمات والمواعيد…';
    SERVICES = []; refreshBookingCatalog();
    show(byId('bookingRecovery'), true);
    byId('bookingResource').addEventListener('change', () => { state.resource = byId('bookingResource').value; state.slot = null; renderSlots(); });
    document.querySelector('#loginModal .muted').textContent = 'استخدم كلمة المرور التي أعددتها في لوحة مشروعك في JAOLA.';
    byId('admUser').classList.add('hidden');
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => { if (serverBooking()) adminLogout(); });
  document.addEventListener('click', handleClick);
  renderSteps();
  renderServices();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0a0f0d;--surface:#111814;--card:#16211b;--accent:#10b981;--accent2:#059669;--danger:#ef4444;--text:#e8f2ec;--muted:#8ba396;--border:#20302a;--line:rgba(16,185,129,.16);--font:'Segoe UI',Tahoma,system-ui,sans-serif;--shadow:0 30px 70px -24px rgba(0,0,0,.8)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(50% 40% at 85% 0%,rgba(16,185,129,.10),transparent 60%),radial-gradient(50% 40% at 0% 100%,rgba(5,150,105,.07),transparent 60%),var(--bg)}
.topbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between;padding:12px 20px;background:rgba(17,24,20,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:30}
.brand{font-size:19px;font-weight:800;display:flex;align-items:center;gap:9px}
.brand .mk{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-size:17px}
.tabs{display:flex;gap:6px}
.tab{background:transparent;border:1px solid var(--border);color:var(--muted);padding:8px 14px;border-radius:99px;font-weight:700;font-size:13px;cursor:pointer;font-family:var(--font)}
.tab.active{background:linear-gradient(105deg,var(--accent),var(--accent2));border-color:transparent;color:#04231a}
main{max-width:940px;margin:0 auto;padding:0 18px 40px}
.view{display:none}.view.active{display:block}
.view#mine-view.active,.view#admin-view.active{padding-top:24px}
.step{display:none}.step.active{display:block}
/* البطل */
.hero{position:relative;min-height:44vh;display:flex;align-items:center;overflow:hidden;border-radius:0 0 28px 28px;margin:0 -18px 18px}
.hero .hero-bg{position:absolute;inset:0;z-index:0}
.hero .hero-bg::after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(10,15,13,.94) 32%,rgba(10,15,13,.4))}
.hero-in{position:relative;z-index:3;padding:48px 30px}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:2.5px;color:var(--accent);text-transform:uppercase}
.accent{background:linear-gradient(105deg,var(--accent),var(--accent2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero h1{font-size:clamp(30px,5.5vw,52px);line-height:1.08;font-weight:800;margin:12px 0 12px;letter-spacing:-1px}
.hero p{font-size:16px;color:#d3e2d9;max-width:420px}
.ph{position:relative;overflow:hidden;background:linear-gradient(135deg,#16211b,#20302a)}
.ph img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;display:block}
.steps-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.step-dot{flex:1;min-width:90px;text-align:center;padding:9px;border-radius:10px;background:var(--surface);border:1px solid var(--border);color:var(--muted);font-size:12px;font-weight:700}
.step-dot.done{background:rgba(16,185,129,.12);border-color:var(--accent);color:var(--accent)}
h2{font-size:18px;margin-bottom:12px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;text-align:center;cursor:pointer;transition:.18s}
.card:hover{transform:translateY(-3px);border-color:rgba(16,185,129,.4)}
.card.sel{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.svc-emoji{font-size:40px}.svc-name{font-weight:700;margin:8px 0 4px}
.days{display:flex;gap:8px;flex-wrap:wrap}
.day{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:14px;padding:11px 15px;cursor:pointer;text-align:center;min-width:72px;transition:.15s}
.day:hover{border-color:rgba(16,185,129,.4)}
.day.sel{border-color:var(--accent);color:var(--accent)}
.day-name{font-size:12px;color:var(--muted)}.day-num{font-size:19px;font-weight:800}
.slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:9px}
.slot{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:11px;padding:11px;cursor:pointer;font-weight:700;transition:.15s}
.slot:hover{border-color:rgba(16,185,129,.4)}
.slot.sel{border-color:var(--accent);color:var(--accent)}
.slot.busy{opacity:.4;cursor:not-allowed;font-size:11px}
.summary{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:14px}
.sum-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)}
input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:11px;padding:12px;color:var(--text);margin-bottom:10px}
input.err{border-color:var(--danger)}
.btn{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:12px 18px;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer;transition:.18s;font-family:var(--font)}
.btn.primary{background:linear-gradient(105deg,var(--accent),var(--accent2));border-color:transparent;color:#04231a;width:100%}
.btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px -10px rgba(16,185,129,.5)}
.btn.ghost{padding:8px 13px;font-size:12px;background:rgba(255,255,255,.04)}
.btn.small{padding:7px 13px;font-size:12px}
.btn.danger{border-color:rgba(239,68,68,.4);color:#f87171;background:transparent}
.hidden{display:none !important}
.muted{color:var(--muted);font-size:13px}
.list{display:flex;flex-direction:column;gap:10px}
.booking{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:13px 15px}
.b-emoji{font-size:28px}.b-info{flex:1;font-size:14px}
.badge{background:rgba(16,185,129,.12);border:1px solid var(--accent);color:var(--accent);font-size:11px;padding:3px 9px;border-radius:20px}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:16px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:22px;font-weight:800;color:var(--accent)}.stat-label{font-size:12px;color:var(--muted)}
.done{text-align:center;padding:30px 0}.done-check{font-size:56px}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(360px,100%);position:relative}
.icon-btn{background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer}.close-x{position:absolute;top:10px;left:14px}
.err-msg{color:var(--danger);font-size:13px;margin-bottom:8px}
`;

export function jaolaBooking() {
    return {
        id: 'jaola-booking',
        category: 'appointments',
        name: 'حجز المواعيد',
        description: 'حجز مواعيد عامل غنيّ: خدمات → اختيار يوم → فترات متاحة (مع منع المحجوز) → تأكيد → حجوزاتي + لوحة إدارة بالإحصاءات.',
        nameEn: 'Appointment Booking',
        descriptionEn: 'Working booking flow: services, day picker, available slots (taken ones blocked), confirmation, my bookings, and an admin panel with stats.',
        keywords: ['حجز', 'موعد', 'مواعيد', 'booking', 'appointment', 'عيادة', 'صالون', 'reservation', 'reserve', 'schedule'],
        model: {
            entities: [
                { name: 'Service', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'duration', type: 'number' }, { name: 'price', type: 'number' }], ownedBy: 'Admin' },
                { name: 'Booking', fields: [{ name: 'id', type: 'number' }, { name: 'date', type: 'string' }, { name: 'slot', type: 'string' }, { name: 'customer', type: 'string' }, { name: 'status', type: 'string' }], ownedBy: 'Customer' },
            ],
            roles: [
                { name: 'Customer', description: 'يحجز موعداً', capabilities: ['اختيار خدمة', 'اختيار موعد', 'تأكيد', 'إلغاء'] },
                { name: 'Admin', description: 'يدير الحجوزات', capabilities: ['عرض كل الحجوزات', 'إحصاءات', 'إلغاء'] },
            ],
            flows: [
                { name: 'حجز موعد', actor: 'Customer', steps: ['يختار خدمة', 'يختار يوماً', 'يختار فترة متاحة', 'يؤكّد ببياناته'], touches: ['Service', 'Booking'], realtime: false },
                { name: 'إدارة الحجوزات', actor: 'Admin', steps: ['يدخل بصلاحية', 'يرى كل الحجوزات والإحصاءات', 'يلغي عند الحاجة'], touches: ['Booking'], realtime: false },
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
