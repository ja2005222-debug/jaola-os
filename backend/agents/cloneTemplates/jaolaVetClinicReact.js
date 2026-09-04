/**
 * 🐾⚛️ jaola-vetclinic-react — نفس نظام العيادة البيطرية الداخلي
 * (jaola-vetclinic) لكن بمخرجات React حقيقية بدل vanilla JS — قالب
 * تجريبي منفصل (لا يستبدل jaola-vetclinic) للمقارنة قبل قرار التوسّع
 * لبقية قوالب السيستم.
 *
 * React 18 + ReactDOM عبر CDN، وBabel standalone لتحويل JSX في المتصفح
 * مباشرة (بلا خطوة بناء/حزم) — يبقى المشروع موقعاً ثابتاً يُنشر كما هو،
 * تماماً كبقية القوالب. jaola-data.js يكتشف type="text/babel" في وسم
 * app.js تلقائياً ويتولّى الجلب والتحويل والتنفيذ بنفسه (انظر dataSync.js).
 *
 * نفس المصادقة الحقيقية (bcrypt عبر /api/public/auth) ونفس مزامنة
 * jaola-data للبيانات — بلا أي تغيير في الخادم، فقط في طبقة العرض.
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaVetClinicReact() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>نظام عيادة بيطرية (React)</title>
  <link rel="stylesheet" href="styles.css">
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <div id="printArea" class="print-only"></div>
  <div id="toast" class="toast no-print hidden"></div>
  <script type="text/babel" src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 🐾⚛️ نظام عيادة jaola البيطرية — jaola-vetclinic-react (React 18، بلا خطوة بناء) */
const { useState, useEffect, useMemo } = React;

const SEED_OWNERS = [
  { id: 'own1', no: 1, name: 'نورة الحربي', phone: '0501234567' },
  { id: 'own2', no: 2, name: 'خالد الدوسري', phone: '0559876543' }
];
const SEED_PETS = [
  { id: 'pet1', ownerId: 'own1', name: 'لولو', species: 'قط', age: 2, lastVaccineAt: new Date(Date.now() - 60 * 86400000).toISOString() },
  { id: 'pet2', ownerId: 'own2', name: 'ريكس', species: 'كلب', age: 4, lastVaccineAt: null }
];

function load(k, fb) { try { var v = localStorage.getItem('jvetr_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jvetr_' + k, JSON.stringify(val)); } catch (e) {} }

function money(n, currency) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function roleLabel(r) { return r === 'vet' ? 'طبيب بيطري' : 'استقبال'; }
function daysSince(iso) { if (!iso) return 9999; return Math.round((Date.now() - new Date(iso)) / 86400000); }
function dueForVaccine(p) { return daysSince(p.lastVaccineAt) >= 300; }

let toastTimer = null;
function toast(m) {
  var t = document.getElementById('toast'); if (!t) return;
  t.textContent = m; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 2400);
}

function printVisit(v, pet, owner, clinicName, currency) {
  var el = document.getElementById('printArea'); if (!el) return;
  el.innerHTML = '<div class="receipt"><h2>' + clinicName + '</h2>' +
    '<div class="r-row"><span>فاتورة كشف #' + v.no + '</span></div><hr>' +
    '<div class="r-row"><span>الحيوان</span><span>' + (pet ? pet.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>المالك</span><span>' + (owner ? owner.name : '؟') + '</span></div>' +
    '<div class="r-row"><span>التشخيص</span><span>' + v.diagnosis + '</span></div>' +
    (v.vaccine ? '<div class="r-row"><span>التطعيم</span><span>' + v.vaccine + '</span></div>' : '') + '<hr>' +
    '<div class="r-row"><b>الرسوم</b><b>' + money(v.fee, currency) + '</b></div>' +
    '<p style="text-align:center">صحة دائمة لصديقك 🐾</p></div>';
  window.print();
}

function Login({ onLogin }) {
  const [role, setRole] = useState('vet');
  const [pass, setPass] = useState('');
  const [curPass, setCurPass] = useState(''); // 🔒 إثبات الاعتماد القائم — التوكن منشورٌ في الصفحة
  const [err, setErr] = useState(false);

  function submit(e) {
    e.preventDefault();
    const sync = window.JAOLA_SYNC;
    const settings = load('settings', { pass: 'admin' });
    function ok() { setErr(false); setPass(''); onLogin(role); }
    function fail(msg) { setErr(msg || true); }
    if (!sync) { if (pass !== settings.pass) return fail(); return ok(); }
    fetch(sync.api + '/api/public/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sync.token, password: pass }),
      signal: AbortSignal.timeout(8000),
    }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (d) { if (d && d.ok) ok(); else fail(); })
      .catch(function () { fail('تعذّر الاتصال بالخادم، تحقّق من الاتصال وحاول مجدداً'); });
  }

  return (
    <section className="view">
      <div className="login-card">
        <h1>نظام عيادة بيطرية (React)</h1>
        <p className="hint">أصحاب حيوانات وحيواناتهم · زيارات بتشخيص وتطعيم · سجل تطعيمات · فاتورة كشف قابلة للطباعة.</p>
        <form onSubmit={submit}>
          <label>الدور</label>
          <select value={role} onChange={function (e) { setRole(e.target.value); }}>
            <option value="vet">طبيب بيطري</option>
            <option value="reception">استقبال</option>
          </select>
          <label>كلمة المرور</label>
          <input type="password" placeholder="admin" value={pass} onChange={function (e) { setPass(e.target.value); }} />
          {err && <p className="err">{typeof err === 'string' ? err : 'كلمة المرور غير صحيحة'}</p>}
          <button className="btn primary block" type="submit">دخول</button>
          <p className="hint tiny">تجريبياً: كلمة المرور «admin».</p>
        </form>
      </div>
    </section>
  );
}

function StatCard({ label, value, tone }) {
  return <div className={'stat ' + (tone || '')}><span className="stat-v">{value}</span><span className="stat-l">{label}</span></div>;
}

function Dashboard({ pets, owners, visits, currency }) {
  const due = useMemo(function () { return pets.filter(dueForVaccine); }, [pets]);
  const today = todayStr();
  const todayVisits = useMemo(function () { return visits.filter(function (v) { return v.createdAt.slice(0, 10) === today; }); }, [visits]);
  const revToday = todayVisits.reduce(function (s, v) { return s + v.fee; }, 0);
  const ownerById = function (id) { return owners.find(function (o) { return o.id === id; }) || null; };
  return (
    <section className="view">
      <h2>لوحة اليوم</h2>
      <div className="stats">
        <StatCard label="إجمالي الحيوانات" value={String(pets.length)} />
        <StatCard label="تحتاج تطعيماً" value={String(due.length)} tone={due.length ? 'warn' : 'ok'} />
        <StatCard label="زيارات اليوم" value={String(todayVisits.length)} />
        <StatCard label="إيراد اليوم" value={money(revToday, currency)} tone="ok" />
      </div>
      <div className="panel">
        <h3>💉 حيوانات تحتاج تطعيماً قريباً</h3>
        {due.length ? due.map(function (p) {
          const o = ownerById(p.ownerId);
          return <div className="panel" key={p.id}><b>{p.name}</b> — {p.species} <span className="hint">(المالك: {o ? o.name : '؟'})</span></div>;
        }) : <p className="hint">لا حيوانات تحتاج تطعيماً حالياً.</p>}
      </div>
    </section>
  );
}

function Owners({ owners, addOwner }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  function submit() {
    if (!name.trim() || !phone.trim()) { toast('اكتب اسم صاحب الحيوان والهاتف'); return; }
    addOwner(name.trim(), phone.trim());
    setName(''); setPhone('');
  }
  return (
    <section className="view">
      <div className="view-head"><h2>أصحاب الحيوانات</h2></div>
      <div className="panel form-row">
        <input placeholder="اسم صاحب الحيوان" value={name} onChange={function (e) { setName(e.target.value); }} />
        <input placeholder="الهاتف" value={phone} onChange={function (e) { setPhone(e.target.value); }} />
        <button className="btn primary" onClick={submit}>إضافة صاحب</button>
      </div>
      <div className="panel">
        <table className="tbl" id="ownersTable">
          <tbody>
            <tr><th>رقم</th><th>الاسم</th><th>الهاتف</th></tr>
            {owners.length ? owners.map(function (o) {
              return <tr key={o.id}><td>#{o.no}</td><td>{o.name}</td><td>{o.phone}</td></tr>;
            }) : <tr><td colSpan="3" className="hint">لا أصحاب بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Pets({ pets, owners, addPet, openVisitForm }) {
  const [ownerId, setOwnerId] = useState(owners[0] ? owners[0].id : '');
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [age, setAge] = useState('');
  const ownerById = function (id) { return owners.find(function (o) { return o.id === id; }) || null; };

  function submit() {
    if (!ownerId) { toast('أضف صاحب حيوان أولاً'); return; }
    if (!name.trim() || !species.trim()) { toast('اكتب اسم الحيوان ونوعه'); return; }
    addPet(ownerId, name.trim(), species.trim(), Math.max(0, parseInt(age, 10) || 0));
    setName(''); setSpecies(''); setAge('');
  }

  return (
    <section className="view">
      <div className="view-head"><h2>الحيوانات الأليفة</h2></div>
      <div className="panel form-row">
        <select value={ownerId} onChange={function (e) { setOwnerId(e.target.value); }}>
          {owners.length ? owners.map(function (o) { return <option value={o.id} key={o.id}>{o.name}</option>; }) : <option value="">أضف صاحب حيوان أولاً</option>}
        </select>
        <input placeholder="اسم الحيوان" value={name} onChange={function (e) { setName(e.target.value); }} />
        <input placeholder="النوع (قط/كلب...)" value={species} onChange={function (e) { setSpecies(e.target.value); }} />
        <input type="number" min="0" placeholder="العمر (سنوات)" value={age} onChange={function (e) { setAge(e.target.value); }} />
        <button className="btn primary" onClick={submit}>إضافة حيوان</button>
      </div>
      <div>
        {pets.length ? pets.slice().reverse().map(function (p) {
          const o = ownerById(p.ownerId); const due = dueForVaccine(p);
          return (
            <div className="panel" key={p.id}>
              <div className="tk-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>🐾 {p.name}</b>
                {due ? <span className="badge warn">يحتاج تطعيماً</span> : <span className="badge">محدّث</span>}
              </div>
              <div className="hint" style={{ lineHeight: 1.9 }}>{p.species} · العمر {p.age} · المالك: {o ? o.name : '؟'}</div>
              <button className="btn tiny primary" onClick={function () { openVisitForm(p.id); }}>🩺 تسجيل زيارة</button>
            </div>
          );
        }) : <p className="hint">لا حيوانات بعد — أضف حيواناً من الأعلى.</p>}
      </div>
    </section>
  );
}

function VisitForm({ pet, onBack, saveVisit }) {
  const [diagnosis, setDiagnosis] = useState('');
  const [vaccine, setVaccine] = useState('');
  const [fee, setFee] = useState('');
  function submit() {
    if (!diagnosis.trim()) { toast('اكتب التشخيص'); return; }
    saveVisit(diagnosis.trim(), vaccine.trim(), Math.max(0, parseFloat(fee) || 0));
  }
  return (
    <section className="view">
      <div className="view-head"><h2>تسجيل زيارة — {pet ? pet.name : ''}</h2><button className="btn ghost" onClick={onBack}>→ الحيوانات</button></div>
      <div className="login-card" style={{ margin: '0 auto', maxWidth: 440 }}>
        <label>التشخيص</label><input placeholder="التشخيص" value={diagnosis} onChange={function (e) { setDiagnosis(e.target.value); }} />
        <label>تطعيم أُعطي (اختياري)</label><input placeholder="اسم التطعيم" value={vaccine} onChange={function (e) { setVaccine(e.target.value); }} />
        <label>رسوم الكشف</label><input type="number" min="0" placeholder="0" value={fee} onChange={function (e) { setFee(e.target.value); }} />
        <button className="btn primary block" onClick={submit}>حفظ وطباعة الفاتورة</button>
      </div>
    </section>
  );
}

function Reports({ pets, visits, currency, exportCsv }) {
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  const byDay = {}; days.forEach(function (d) { byDay[d] = 0; });
  let totalRev = 0;
  visits.forEach(function (v) { const d = v.createdAt.slice(0, 10); if (byDay.hasOwnProperty(d)) byDay[d] += v.fee; totalRev += v.fee; });
  const max = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([1]));
  return (
    <section className="view">
      <div className="view-head"><h2>التقارير</h2><button className="btn ghost" onClick={exportCsv}>⬇️ الزيارات CSV</button></div>
      <div className="stats">
        <StatCard label="إجمالي الزيارات" value={String(visits.length)} />
        <StatCard label="إجمالي الإيراد" value={money(totalRev, currency)} tone="ok" />
        <StatCard label="إجمالي الحيوانات" value={String(pets.length)} />
      </div>
      <div className="panel">
        <h3>إيراد آخر ٧ أيام</h3>
        <div className="chart">
          {days.map(function (d) {
            const h = Math.round((byDay[d] / max) * 100);
            return <div className="bar-col" key={d}><div className="bar" style={{ height: h + '%' }} title={money(byDay[d], currency)}></div><span className="bar-label">{d.slice(5)}</span></div>;
          })}
        </div>
      </div>
    </section>
  );
}

function Settings({ settings, saveSettings }) {
  const [name, setName] = useState(settings.name);
  const [pass, setPass] = useState('');
  function submit() {
    const sync = window.JAOLA_SYNC;
    if (pass.trim()) {
      if (sync) {
        fetch(sync.api + '/api/public/auth/set-password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: sync.token, password: pass.trim(), currentPassword: curPass }),
          signal: AbortSignal.timeout(8000),
        }).then(function (r) { if (!r.ok) alert('كلمة المرور الحالية غير صحيحة'); }).catch(function () {});
      }
    }
    saveSettings(name.trim() || settings.name, sync ? null : (pass.trim() || null));
    setPass(''); setCurPass('');
    toast('تم حفظ الإعدادات');
  }
  return (
    <section className="view">
      <div className="view-head"><h2>الإعدادات</h2></div>
      <div className="panel form-col">
        <label>اسم العيادة</label><input value={name} onChange={function (e) { setName(e.target.value); }} />
        <label>كلمة المرور الحالية</label><input type="password" placeholder="مطلوبة لتغيير كلمة المرور" value={curPass} onChange={function (e) { setCurPass(e.target.value); }} />
        <label>كلمة المرور الجديدة</label><input type="password" placeholder="اتركها فارغة للإبقاء" value={pass} onChange={function (e) { setPass(e.target.value); }} />
        <button className="btn primary" onClick={submit}>حفظ الإعدادات</button>
      </div>
    </section>
  );
}

function Shell({ session, view, setView, onLogout, children }) {
  const tabs = [['dashboard', 'اليوم'], ['owners', 'الأصحاب'], ['pets', 'الحيوانات'], ['reports', 'التقارير'], ['settings', 'الإعدادات']];
  return (
    <React.Fragment>
      <header className="topbar no-print">
        <div className="brand"><span className="mk">🐾</span> <span id="brandName">عيادة jaola البيطرية</span></div>
        <nav className="tabs">
          {tabs.map(function (t) {
            const active = view === t[0] || (view === 'visitForm' && t[0] === 'pets');
            return <button className={'tab ' + (active ? 'active' : '')} key={t[0]} onClick={function () { setView(t[0]); }}>{t[1]}</button>;
          })}
        </nav>
        <div className="user-chip">
          <span>{roleLabel(session.role)}</span> <button className="btn tiny ghost" onClick={onLogout}>خروج</button>
        </div>
      </header>
      <main className="no-print">{children}</main>
    </React.Fragment>
  );
}

function App() {
  const [session, setSession] = useState(function () { return load('session', null); });
  const [view, setView] = useState('dashboard');
  const [owners, setOwners] = useState(function () { return load('owners', SEED_OWNERS); });
  const [pets, setPets] = useState(function () { return load('pets', SEED_PETS); });
  const [visits, setVisits] = useState(function () { return load('visits', []); });
  const [settings, setSettings] = useState(function () {
    return load('settings', { name: 'عيادة jaola البيطرية', pass: 'admin', currency: 'ر.س', ownerSeq: 3, visitSeq: 1 });
  });
  const [activePetId, setActivePetId] = useState(null);

  useEffect(function () { document.getElementById('brandName') && (document.getElementById('brandName').textContent = settings.name); }, [settings.name]);

  function handleLogin(role) {
    const s = { role: role }; setSession(s); save('session', s);
    toast('أهلاً ' + roleLabel(role)); setView('dashboard');
  }
  function handleLogout() { setSession(null); save('session', null); toast('تم الخروج'); }

  function addOwner(name, phone) {
    const next = owners.concat([{ id: uid('own'), no: settings.ownerSeq, name: name, phone: phone }]);
    const nextSettings = Object.assign({}, settings, { ownerSeq: settings.ownerSeq + 1 });
    setOwners(next); setSettings(nextSettings);
    save('owners', next); save('settings', nextSettings);
    toast('أُضيف صاحب الحيوان');
  }

  function addPet(ownerId, name, species, age) {
    const next = pets.concat([{ id: uid('pet'), ownerId: ownerId, name: name, species: species, age: age, lastVaccineAt: null }]);
    setPets(next); save('pets', next);
    toast('أُضيف الحيوان');
  }

  function openVisitForm(petId) { setActivePetId(petId); setView('visitForm'); }

  function saveVisit(diagnosis, vaccine, fee) {
    const pet = pets.find(function (p) { return p.id === activePetId; });
    if (!pet) { setView('pets'); return; }
    const visit = { id: uid('vs'), no: settings.visitSeq, petId: pet.id, diagnosis: diagnosis, vaccine: vaccine, fee: fee, createdAt: new Date().toISOString() };
    const nextVisits = visits.concat([visit]);
    const nextPets = pets.map(function (p) { return p.id === pet.id && vaccine ? Object.assign({}, p, { lastVaccineAt: visit.createdAt }) : p; });
    const nextSettings = Object.assign({}, settings, { visitSeq: settings.visitSeq + 1 });
    setVisits(nextVisits); setPets(nextPets); setSettings(nextSettings);
    save('visits', nextVisits); save('pets', nextPets); save('settings', nextSettings);
    toast('حُفظت الزيارة #' + visit.no);
    const owner = owners.find(function (o) { return o.id === pet.ownerId; }) || null;
    printVisit(visit, pet, owner, settings.name, settings.currency);
    setView('pets');
  }

  function exportCsv() {
    const rows = [['#', 'الحيوان', 'المالك', 'التشخيص', 'التطعيم', 'الرسوم', 'التاريخ']];
    visits.forEach(function (v) {
      const p = pets.find(function (x) { return x.id === v.petId; }) || null;
      const o = p ? owners.find(function (x) { return x.id === p.ownerId; }) : null;
      rows.push([v.no, p ? p.name : '', o ? o.name : '', v.diagnosis, v.vaccine || '—', v.fee, v.createdAt.slice(0, 10)]);
    });
    const csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\\n');
    const blob = new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'vetclinic-visits.csv'; a.click();
    toast('صُدّرت الزيارات CSV');
  }

  function saveSettingsHandler(name, localPass) {
    const next = Object.assign({}, settings, { name: name });
    if (localPass) next.pass = localPass;
    setSettings(next); save('settings', next);
  }

  if (!session) return <Login onLogin={handleLogin} />;

  const activePet = pets.find(function (p) { return p.id === activePetId; }) || null;

  return (
    <Shell session={session} view={view} setView={setView} onLogout={handleLogout}>
      {view === 'dashboard' && <Dashboard pets={pets} owners={owners} visits={visits} currency={settings.currency} />}
      {view === 'owners' && <Owners owners={owners} addOwner={addOwner} />}
      {view === 'pets' && <Pets pets={pets} owners={owners} addPet={addPet} openVisitForm={openVisitForm} />}
      {view === 'visitForm' && <VisitForm pet={activePet} onBack={function () { setView('pets'); }} saveVisit={saveVisit} />}
      {view === 'reports' && <Reports pets={pets} visits={visits} currency={settings.currency} exportCsv={exportCsv} />}
      {view === 'settings' && <Settings settings={settings} saveSettings={saveSettingsHandler} />}
    </Shell>
  );
}

function init() {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
}
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.badge{background:#1e293b;border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:11px;color:#c7d2fe}
.badge.warn{background:#78350f;color:#fde68a}
.bar-col{display:inline-flex;flex-direction:column;align-items:center;gap:6px;width:12%;vertical-align:bottom}
`;

    return {
        id: 'jaola-vetclinic-react',
        track: 'system',
        category: 'system',
        name: 'نظام عيادة بيطرية (React، تجريبي)',
        nameEn: 'Veterinary Clinic (React pilot)',
        description: 'نفس نظام العيادة البيطرية الداخلي (jaola-vetclinic) بمخرجات React حقيقية بدل vanilla JS — قالب تجريبي للمقارنة قبل توسيع النهج لبقية قوالب السيستم. React عبر CDN + Babel في المتصفح، بلا خطوة بناء.',
        descriptionEn: 'The same internal veterinary clinic system (jaola-vetclinic) with real React output instead of vanilla JS — a pilot template to compare before expanding the approach to other system templates. React via CDN + in-browser Babel, no build step.',
        keywords: ['عيادة بيطرية رياكت', 'react عيادة بيطرية', 'veterinary react', 'vet clinic react'],
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
