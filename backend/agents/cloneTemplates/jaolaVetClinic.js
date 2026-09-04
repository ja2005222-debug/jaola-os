/**
 * 🐾 jaola-vetclinic — نظام عيادة بيطرية داخلي (track: system).
 *
 * أصحاب حيوانات وحيواناتهم الأليفة (نوع/سلالة/عمر)، زيارات بتشخيص
 * وتطعيم وسجل تطعيمات لكل حيوان، فاتورة كشف قابلة للطباعة، وتقرير
 * إيرادات. أدوار: طبيب بيطري / استقبال. بلا اعتماد خارجي.
 * الحالة في localStorage (jvet_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaVetClinic() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام عيادة بيطرية</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🐾</span> <span id="brandName">عيادة jaola البيطرية</span></div>
    <nav class="tabs" id="tabs"></nav>
    <div class="user-chip" id="userChip"></div>
  </header>
  <main class="no-print">
    <section id="view-login" class="view">
      <div class="login-card">
        <img id="clinicPhotoImg" class="clinic-photo hidden" alt="صورة العيادة">
        <h1>نظام عيادة بيطرية</h1>
        <p class="hint">أصحاب حيوانات وحيواناتهم · زيارات بتشخيص وتطعيم · سجل تطعيمات · فاتورة كشف قابلة للطباعة.</p>
        <label>الدور</label>
        <select id="loginRole"><option value="vet">طبيب بيطري</option><option value="reception">استقبال</option></select>
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
      <div class="panel"><h3>💉 حيوانات تحتاج تطعيماً قريباً</h3><div id="dueVaccineList"></div></div>
    </section>

    <section id="view-owners" class="view hidden">
      <div class="view-head"><h2>أصحاب الحيوانات</h2></div>
      <div class="panel form-row">
        <input id="ownName" placeholder="اسم صاحب الحيوان">
        <input id="ownPhone" placeholder="الهاتف">
        <button class="btn primary" data-action="addOwner">إضافة صاحب</button>
      </div>
      <div class="panel"><table class="tbl" id="ownersTable"></table></div>
    </section>

    <section id="view-pets" class="view hidden">
      <div class="view-head"><h2>الحيوانات الأليفة</h2></div>
      <div class="panel form-row">
        <select id="petOwner"></select>
        <input id="petName" placeholder="اسم الحيوان">
        <input id="petSpecies" placeholder="النوع (قط/كلب...)">
        <input id="petAge" type="number" placeholder="العمر (سنوات)" min="0">
        <button class="btn primary" data-action="addPet">إضافة حيوان</button>
      </div>
      <div id="petsBoard"></div>
    </section>

    <section id="view-visitForm" class="view hidden">
      <div class="view-head"><h2 id="visitTitle">تسجيل زيارة</h2><button class="btn ghost" data-action="backPets">→ الحيوانات</button></div>
      <div class="login-card" style="margin:0 auto;max-width:440px">
        <label>التشخيص</label><input id="vsDiagnosis" placeholder="التشخيص">
        <label>تطعيم أُعطي (اختياري)</label><input id="vsVaccine" placeholder="اسم التطعيم">
        <label>رسوم الكشف</label><input id="vsFee" type="number" placeholder="0" min="0">
        <button class="btn primary block" data-action="saveVisit">حفظ وطباعة الفاتورة</button>
      </div>
    </section>

    <section id="view-reports" class="view hidden">
      <div class="view-head"><h2>التقارير</h2><button class="btn ghost" data-action="exportVisitsCsv">⬇️ الزيارات CSV</button></div>
      <div class="stats" id="reportStats"></div>
      <div class="panel"><h3>إيراد آخر ٧ أيام</h3><div id="revChart" class="chart"></div></div>
    </section>

    <section id="view-settings" class="view hidden">
      <div class="view-head"><h2>الإعدادات</h2></div>
      <div class="panel form-col">
        <label>اسم العيادة</label><input id="stName">
        <label>كلمة المرور الحالية</label><input id="stPassCur" type="password" placeholder="مطلوبة لتغيير كلمة المرور">
        <label>كلمة المرور الحالية</label><input id="stPassCur" type="password" placeholder="مطلوبة لتغيير كلمة المرور">
        <label>كلمة المرور الجديدة</label><input id="stPass" type="password" placeholder="اتركها فارغة للإبقاء">
        <label>صورة العيادة (اختياري)</label>
        <input id="stPhotoFile" type="file" accept="image/*">
        <img id="stPhotoPreview" class="clinic-photo hidden" alt="معاينة صورة العيادة">
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

    const APP_JS = `/* 🐾 نظام عيادة jaola البيطرية — jaola-vetclinic */
const SEED_OWNERS = [
  { id: 'own1', no: 1, name: 'نورة الحربي', phone: '0501234567' },
  { id: 'own2', no: 2, name: 'خالد الدوسري', phone: '0559876543' }
];
const SEED_PETS = [
  { id: 'pet1', ownerId: 'own1', name: 'لولو', species: 'قط', age: 2, lastVaccineAt: new Date(Date.now() - 60 * 86400000).toISOString() },
  { id: 'pet2', ownerId: 'own2', name: 'ريكس', species: 'كلب', age: 4, lastVaccineAt: null }
];
function load(k, fb) { try { var v = localStorage.getItem('jvet_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jvet_' + k, JSON.stringify(val)); } catch (e) {} }
let owners = load('owners', SEED_OWNERS); // { id, no, name, phone }
let pets = load('pets', SEED_PETS); // { id, ownerId, name, species, age, lastVaccineAt }
let visits = load('visits', []); // { id, no, petId, diagnosis, vaccine, fee, createdAt }
let settings = load('settings', { name: 'عيادة jaola البيطرية', pass: 'admin', currency: 'ر.س', ownerSeq: 3, visitSeq: 1 });
let session = load('session', null);
let state = { view: 'login', activePet: null };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function ownerById(id) { for (var i = 0; i < owners.length; i++) if (owners[i].id === id) return owners[i]; return null; }
function petById(id) { for (var i = 0; i < pets.length; i++) if (pets[i].id === id) return pets[i]; return null; }
function roleLabel(r) { return r === 'vet' ? 'طبيب بيطري' : 'استقبال'; }
function daysSince(iso) { if (!iso) return 9999; return Math.round((Date.now() - new Date(iso)) / 86400000); }
function dueForVaccine(p) { return daysSince(p.lastVaccineAt) >= 300; }

function login() {
  var role = byId('loginRole').value; var pass = byId('loginPass').value;
  function onOk() {
    show(byId('loginErr'), false); session = { role: role }; save('session', session);
    byId('loginPass').value = ''; toast('أهلاً ' + roleLabel(role)); setView('dashboard');
  }
  function onFail(msg) { var el = byId('loginErr'); el.textContent = msg || 'كلمة المرور غير صحيحة'; show(el, true); }
  var sync = window.JAOLA_SYNC;
  if (!sync) { if (pass !== settings.pass) return onFail(); return onOk(); }
  fetch(sync.api + '/api/public/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: pass }), signal: AbortSignal.timeout(8000) })
    .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
    .then(function (d) { if (d && d.ok) onOk(); else onFail(); })
    .catch(function () { onFail('تعذّر الاتصال بالخادم، تحقّق من الاتصال وحاول مجدداً'); });
}
function logout() { session = null; save('session', null); toast('تم الخروج'); setView('login'); }

function setView(v) {
  if (v !== 'login' && !session) v = 'login';
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs(); renderUserChip();
  if (v === 'dashboard') renderDashboard();
  if (v === 'owners') renderOwners();
  if (v === 'pets') renderPets();
  if (v === 'reports') renderReports();
  if (v === 'settings') { byId('stName').value = settings.name; byId('stPass').value = ''; byId('stPassCur').value = ''; pendingPhotoDataUrl = null; byId('stPhotoFile').value = ''; show(byId('stPhotoPreview'), false); }
}
function renderTabs() {
  if (!session) { byId('tabs').innerHTML = ''; return; }
  var tabs = [['dashboard', 'اليوم'], ['owners', 'الأصحاب'], ['pets', 'الحيوانات'], ['reports', 'التقارير'], ['settings', 'الإعدادات']];
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] || (state.view === 'visitForm' && t[0] === 'pets') ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
}
function renderUserChip() {
  byId('userChip').innerHTML = session ? '<span>' + esc(roleLabel(session.role)) + '</span> <button class="btn tiny ghost" data-action="logout">خروج</button>' : '';
}

function statCard(l, v, tone) { return '<div class="stat ' + (tone || '') + '"><span class="stat-v">' + v + '</span><span class="stat-l">' + l + '</span></div>'; }
function renderDashboard() {
  var due = pets.filter(dueForVaccine);
  var today = todayStr();
  var todayVisits = visits.filter(function (v) { return v.createdAt.slice(0, 10) === today; });
  var revToday = todayVisits.reduce(function (s, v) { return s + v.fee; }, 0);
  byId('dashStats').innerHTML =
    statCard('إجمالي الحيوانات', String(pets.length), '') +
    statCard('تحتاج تطعيماً', String(due.length), due.length ? 'warn' : 'ok') +
    statCard('زيارات اليوم', String(todayVisits.length), '') +
    statCard('إيراد اليوم', money(revToday), 'ok');
  byId('dueVaccineList').innerHTML = due.length ? due.map(function (p) {
    var o = ownerById(p.ownerId);
    return '<div class="panel"><b>' + esc(p.name) + '</b> — ' + esc(p.species) + ' <span class="hint">(المالك: ' + esc(o ? o.name : '؟') + ')</span></div>';
  }).join('') : '<p class="hint">لا حيوانات تحتاج تطعيماً حالياً.</p>';
}

function renderOwners() {
  var rows = owners.map(function (o) { return '<tr><td>#' + o.no + '</td><td>' + esc(o.name) + '</td><td>' + esc(o.phone) + '</td></tr>'; }).join('');
  byId('ownersTable').innerHTML = '<tr><th>رقم</th><th>الاسم</th><th>الهاتف</th></tr>' + (rows || '<tr><td colspan="3" class="hint">لا أصحاب بعد.</td></tr>');
  fillPetOwnerSelect();
}
function addOwner() {
  var name = byId('ownName').value.trim(); var phone = byId('ownPhone').value.trim();
  if (!name || !phone) { toast('اكتب اسم صاحب الحيوان والهاتف'); return; }
  owners.push({ id: uid('own'), no: settings.ownerSeq++, name: name, phone: phone });
  save('owners', owners); save('settings', settings);
  byId('ownName').value = ''; byId('ownPhone').value = '';
  toast('أُضيف صاحب الحيوان'); renderOwners();
}
function fillPetOwnerSelect() {
  var sel = byId('petOwner'); if (!sel) return;
  sel.innerHTML = owners.map(function (o) { return '<option value="' + o.id + '">' + esc(o.name) + '</option>'; }).join('') || '<option value="">أضف صاحب حيوان أولاً</option>';
}

function renderPets() {
  fillPetOwnerSelect();
  byId('petsBoard').innerHTML = pets.length ? pets.slice().reverse().map(function (p) {
    var o = ownerById(p.ownerId); var due = dueForVaccine(p);
    return '<div class="panel"><div class="tk-head" style="display:flex;justify-content:space-between"><b>🐾 ' + esc(p.name) + '</b>' + (due ? '<span class="badge warn">يحتاج تطعيماً</span>' : '<span class="badge">محدّث</span>') + '</div>' +
      '<div class="hint" style="line-height:1.9">' + esc(p.species) + ' · العمر ' + p.age + ' · المالك: ' + esc(o ? o.name : '؟') + '</div>' +
      '<button class="btn tiny primary" data-action="openVisitForm" data-id="' + p.id + '">🩺 تسجيل زيارة</button></div>';
  }).join('') : '<p class="hint">لا حيوانات بعد — أضف حيواناً من الأعلى.</p>';
}
function addPet() {
  var ownerId = byId('petOwner').value; var name = byId('petName').value.trim(); var species = byId('petSpecies').value.trim();
  var age = Math.max(0, parseInt(byId('petAge').value, 10) || 0);
  if (!ownerId) { toast('أضف صاحب حيوان أولاً'); return; }
  if (!name || !species) { toast('اكتب اسم الحيوان ونوعه'); return; }
  pets.push({ id: uid('pet'), ownerId: ownerId, name: name, species: species, age: age, lastVaccineAt: null });
  save('pets', pets);
  byId('petName').value = ''; byId('petSpecies').value = ''; byId('petAge').value = '';
  toast('أُضيف الحيوان'); renderPets();
}
function openVisitForm(id) { state.activePet = id; var p = petById(id); byId('visitTitle').textContent = 'تسجيل زيارة — ' + (p ? p.name : ''); byId('vsDiagnosis').value = ''; byId('vsVaccine').value = ''; byId('vsFee').value = ''; setView('visitForm'); }
function backPets() { setView('pets'); }
function saveVisit() {
  var p = petById(state.activePet); if (!p) { setView('pets'); return; }
  var diagnosis = byId('vsDiagnosis').value.trim(); if (!diagnosis) { toast('اكتب التشخيص'); return; }
  var vaccine = byId('vsVaccine').value.trim();
  var fee = Math.max(0, parseFloat(byId('vsFee').value) || 0);
  var visit = { id: uid('vs'), no: settings.visitSeq++, petId: p.id, diagnosis: diagnosis, vaccine: vaccine, fee: fee, createdAt: new Date().toISOString() };
  visits.push(visit); if (vaccine) p.lastVaccineAt = visit.createdAt;
  save('visits', visits); save('pets', pets); save('settings', settings);
  toast('حُفظت الزيارة #' + visit.no); printVisit(visit.id); setView('pets');
}
function printVisit(id) {
  var v = null; for (var i = 0; i < visits.length; i++) if (visits[i].id === id) v = visits[i];
  if (!v) return; var p = petById(v.petId); var o = p ? ownerById(p.ownerId) : null;
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>فاتورة كشف #' + v.no + '</span></div><hr>' +
    '<div class="r-row"><span>الحيوان</span><span>' + esc(p ? p.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>المالك</span><span>' + esc(o ? o.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>التشخيص</span><span>' + esc(v.diagnosis) + '</span></div>' +
    (v.vaccine ? '<div class="r-row"><span>التطعيم</span><span>' + esc(v.vaccine) + '</span></div>' : '') + '<hr>' +
    '<div class="r-row"><b>الرسوم</b><b>' + money(v.fee) + '</b></div>' +
    '<p style="text-align:center">صحة دائمة لصديقك 🐾</p></div>';
  window.print();
}

function renderReports() {
  var days = [];
  for (var i = 6; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  var byDay = {}; days.forEach(function (d) { byDay[d] = 0; });
  var totalRev = 0;
  visits.forEach(function (v) { var d = v.createdAt.slice(0, 10); if (byDay.hasOwnProperty(d)) byDay[d] += v.fee; totalRev += v.fee; });
  byId('reportStats').innerHTML =
    statCard('إجمالي الزيارات', String(visits.length), '') +
    statCard('إجمالي الإيراد', money(totalRev), 'ok') +
    statCard('إجمالي الحيوانات', String(pets.length), '');
  var max = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([1]));
  byId('revChart').innerHTML = days.map(function (d) {
    var h = Math.round((byDay[d] / max) * 100);
    return '<div class="bar-col"><div class="bar" style="height:' + h + '%" title="' + money(byDay[d]) + '"></div><span class="bar-label">' + d.slice(5) + '</span></div>';
  }).join('');
}
function exportVisitsCsv() {
  var rows = [['#', 'الحيوان', 'المالك', 'التشخيص', 'التطعيم', 'الرسوم', 'التاريخ']];
  visits.forEach(function (v) {
    var p = petById(v.petId); var o = p ? ownerById(p.ownerId) : null;
    rows.push([v.no, p ? p.name : '', o ? o.name : '', v.diagnosis, v.vaccine || '—', v.fee, v.createdAt.slice(0, 10)]);
  });
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
  var blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vetclinic-visits.csv'; a.click();
  toast('صُدّرت الزيارات CSV');
}

// 🖼️ صورة العيادة الحقيقية (لا Unsplash ولا AI) — تُصغَّر عبر canvas قبل
// الرفع (أقصى بُعد 1200px، JPEG 0.8) فلا تُبطئ تحميل الموقع، وتُعرَض عبر
// <img src> مباشرة بتوكن المزامنة (فشل التحميل يخفيها بصمت — لا خطأ ظاهر).
var pendingPhotoDataUrl = null;
function clinicPhotoSrc() {
  var sync = window.JAOLA_SYNC;
  if (!sync) return '';
  return sync.api + '/api/public/assets/clinicPhoto?token=' + encodeURIComponent(sync.token) + '&t=' + Date.now();
}
function loadClinicPhoto() {
  var src = clinicPhotoSrc(); if (!src) return;
  var img = byId('clinicPhotoImg');
  img.onload = function () { show(img, true); };
  img.onerror = function () { show(img, false); };
  img.src = src;
}
function resizeImageToDataUrl(file, cb) {
  var reader = new FileReader();
  reader.onload = function () {
    var im = new Image();
    im.onload = function () {
      var max = 1200, w = im.width, h = im.height;
      if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(im, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.8));
    };
    im.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function onPhotoFileChange(e) {
  var file = e.target.files && e.target.files[0]; if (!file) return;
  resizeImageToDataUrl(file, function (dataUrl) {
    pendingPhotoDataUrl = dataUrl;
    var prev = byId('stPhotoPreview'); prev.src = dataUrl; show(prev, true);
  });
}

function saveSettings() {
  settings.name = byId('stName').value.trim() || settings.name;
  var np = byId('stPass').value.trim();
  var sync = window.JAOLA_SYNC;
  if (np) { if (sync) { fetch(sync.api + '/api/public/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, password: np, currentPassword: byId('stPassCur').value }), signal: AbortSignal.timeout(8000) }).then(function (r) { if (!r.ok) toast('كلمة المرور الحالية غير صحيحة'); else toast('تم تغيير كلمة المرور'); }).catch(function () {}); } else settings.pass = np; }
  if (pendingPhotoDataUrl && sync) {
    fetch(sync.api + '/api/public/assets/clinicPhoto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sync.token, dataUrl: pendingPhotoDataUrl }), signal: AbortSignal.timeout(15000) })
      .then(function () { pendingPhotoDataUrl = null; loadClinicPhoto(); }).catch(function () {});
  }
  save('settings', settings); byId('brandName').textContent = settings.name;
  toast('تم حفظ الإعدادات');
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'login': login(); break;
    case 'logout': logout(); break;
    case 'tab': setView(a.dataset.view); break;
    case 'addOwner': addOwner(); break;
    case 'addPet': addPet(); break;
    case 'openVisitForm': openVisitForm(a.dataset.id); break;
    case 'backPets': backPets(); break;
    case 'saveVisit': saveVisit(); break;
    case 'exportVisitsCsv': exportVisitsCsv(); break;
    case 'saveSettings': saveSettings(); break;
  }
}
function init() {
  byId('brandName').textContent = settings.name;
  document.addEventListener('click', handleClick);
  var photoInput = byId('stPhotoFile'); if (photoInput) photoInput.addEventListener('change', onPhotoFileChange);
  loadClinicPhoto();
  setView(session ? 'dashboard' : 'login');
}
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.badge{background:#1e293b;border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:11px;color:#c7d2fe}
.badge.warn{background:#78350f;color:#fde68a}
.bar-col{display:inline-flex;flex-direction:column;align-items:center;gap:6px;width:12%;vertical-align:bottom}
.clinic-photo{display:block;max-width:100%;max-height:180px;object-fit:cover;border-radius:12px;margin:0 auto 14px;border:1px solid var(--line)}
`;

    return {
        id: 'jaola-vetclinic',
        track: 'system',
        category: 'system',
        name: 'نظام عيادة بيطرية',
        nameEn: 'Veterinary Clinic',
        description: 'سيستم عيادة بيطرية داخلي: أصحاب حيوانات وحيواناتهم الأليفة (نوع/سلالة/عمر)، زيارات بتشخيص وتطعيم وتنبيه استحقاق تطعيم، فاتورة كشف قابلة للطباعة، وتقرير إيرادات — بأدوار (طبيب بيطري/استقبال).',
        descriptionEn: 'Internal veterinary clinic system: pet owners and their pets (species/breed/age), visits with diagnosis and vaccination plus vaccine-due alerts, a printable examination invoice, and a revenue report — with roles (veterinarian/reception).',
        keywords: ['عيادة بيطرية', 'طبيب بيطري', 'بيطري', 'بيطرية', 'حيوانات أليفة', 'تطعيم حيوانات', 'عيادة حيوانات', 'صحة الحيوان', 'veterinary', 'vet clinic', 'veterinarian', 'pet clinic', 'animal hospital', 'pet vaccination'],
        model: {
            roles: [{ name: 'طبيب بيطري' }, { name: 'استقبال' }],
            entities: [{ name: 'صاحب حيوان' }, { name: 'حيوان أليف' }, { name: 'زيارة' }],
            flows: [{ name: 'تسجيل صاحب حيوان وحيوانه الأليف' }, { name: 'تسجيل زيارة بتشخيص وتطعيم' }, { name: 'تنبيه استحقاق التطعيم' }, { name: 'طباعة فاتورة الكشف وتقرير الإيرادات' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
