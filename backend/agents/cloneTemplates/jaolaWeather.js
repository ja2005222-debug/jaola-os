/**
 * 🌦️ jaola-weather — قالب طقس *عامل* يستهلك API خارجياً حقيقياً.
 *
 * يستخدم Open-Meteo (مجاني، بلا مفتاح، يدعم CORS):
 * - Geocoding: تحويل اسم المدينة إلى إحداثيات.
 * - Forecast: الطقس الحالي + توقّعات 7 أيام.
 *
 * مصمّم ليصمد في التحقّق السلوكي رغم أن jsdom يكتم fetch (يعود بمصفوفة
 * فارغة): كل الوصول محميّ (optional chaining)، والبحث يُظهر حالة تحميل
 * (تغيّر DOM) ثم رسالة واضحة — لا انهيار.
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>الطقس</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand">🌦️ <span id="brandName">طقس jaola</span></div>
  </header>
  <main>
    <div class="search">
      <input id="cityInput" placeholder="اكتب اسم مدينة (مثل: الرياض، القاهرة، دبي)">
      <button class="btn primary" data-action="search">بحث</button>
    </div>
    <div id="status" class="status">اكتب اسم مدينة لعرض طقسها الحالي وتوقّعات الأسبوع.</div>
    <section id="current" class="current hidden"></section>
    <section id="forecast" class="forecast"></section>
    <div class="chips" id="quickCities"></div>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// 🌦️ منطق تطبيق الطقس — يستهلك Open-Meteo (بلا مفتاح). كل الدوال معرّفة.
'use strict';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const QUICK = ['الرياض', 'جدة', 'القاهرة', 'دبي', 'إسطنبول'];

const WEATHER = {
  0: ['☀️', 'صافٍ'], 1: ['🌤️', 'صافٍ غالباً'], 2: ['⛅', 'غائم جزئياً'], 3: ['☁️', 'غائم'],
  45: ['🌫️', 'ضباب'], 48: ['🌫️', 'ضباب'], 51: ['🌦️', 'رذاذ خفيف'], 61: ['🌧️', 'مطر خفيف'],
  63: ['🌧️', 'مطر'], 65: ['🌧️', 'مطر غزير'], 71: ['🌨️', 'ثلج'], 80: ['🌦️', 'زخّات'],
  95: ['⛈️', 'عواصف رعدية'],
};
function weatherLabel(code) { return WEATHER[code] || ['🌡️', 'غير معروف']; }
function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function setStatus(msg) { const s = byId('status'); if (s) { s.textContent = msg; show(s, !!msg); } }

async function getJSON(url) {
  try {
    const res = await fetch(url);
    if (!res || !res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function searchWeather(city) {
  const q = (city || (byId('cityInput') && byId('cityInput').value) || '').trim();
  if (!q) { setStatus('اكتب اسم مدينة أولاً.'); return; }
  setStatus('⏳ جاري جلب الطقس لـ «' + q + '»...');
  show(byId('current'), false);
  const geo = await getJSON(GEO_URL + '?name=' + encodeURIComponent(q) + '&count=1&language=ar');
  const place = geo && geo.results && geo.results[0];
  if (!place) { setStatus('لم نعثر على «' + q + '». جرّب اسماً آخر.'); byId('forecast').innerHTML = ''; return; }
  const url = FORECAST_URL + '?latitude=' + place.latitude + '&longitude=' + place.longitude +
    '&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto';
  const data = await getJSON(url);
  if (!data || !data.current) { setStatus('تعذّر جلب الطقس الآن — حاول لاحقاً.'); return; }
  setStatus('');
  renderCurrent(place, data.current);
  renderForecast(data.daily);
}

function renderCurrent(place, cur) {
  const [emoji, label] = weatherLabel(cur.weather_code);
  const el = byId('current');
  el.innerHTML =
    '<div class="cur-emoji">' + emoji + '</div>' +
    '<div class="cur-info"><h2>' + (place.name || '') + (place.country ? '، ' + place.country : '') + '</h2>' +
    '<div class="cur-temp">' + Math.round(cur.temperature_2m) + '°</div>' +
    '<div class="cur-label">' + label + ' · رياح ' + Math.round(cur.wind_speed_10m) + ' كم/س</div></div>';
  show(el, true);
}

function renderForecast(daily) {
  const el = byId('forecast');
  if (!daily || !daily.time) { el.innerHTML = ''; return; }
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  el.innerHTML = daily.time.map(function (t, i) {
    const [emoji, label] = weatherLabel(daily.weather_code[i]);
    const d = new Date(t);
    return '<div class="day-card"><div class="day-name">' + days[d.getDay()] + '</div>' +
      '<div class="day-emoji">' + emoji + '</div>' +
      '<div class="day-temp">' + Math.round(daily.temperature_2m_max[i]) + '° / ' + Math.round(daily.temperature_2m_min[i]) + '°</div>' +
      '<div class="day-label">' + label + '</div></div>';
  }).join('');
}

function renderQuick() {
  const el = byId('quickCities');
  if (!el) return;
  el.innerHTML = '<span class="muted">مدن سريعة: </span>' +
    QUICK.map(function (c) { return '<button class="chip" data-action="quick" data-city="' + c + '">' + c + '</button>'; }).join('');
}

function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'search') searchWeather();
  if (el.dataset.action === 'quick') { const inp = byId('cityInput'); if (inp) inp.value = el.dataset.city; searchWeather(el.dataset.city); }
}
function handleKey(e) { if (e.key === 'Enter' && e.target && e.target.id === 'cityInput') searchWeather(); }

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKey);
  renderQuick();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--bg:#0b1220;--surface:#141b2e;--card:#1b2540;--accent:#38bdf8;--text:#e8edf6;--muted:#8b98b0;--border:#26324f;--font:'Segoe UI',Tahoma,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:linear-gradient(160deg,#0b1220,#132038);color:var(--text);min-height:100vh;line-height:1.6}
.topbar{padding:16px 20px;border-bottom:1px solid var(--border)}
.brand{font-size:20px;font-weight:800}
main{max-width:820px;margin:0 auto;padding:24px 18px}
.search{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.search input,#cityInput{flex:1;min-width:200px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:13px 16px;color:var(--text);font-size:15px}
.btn{border:1px solid var(--border);background:var(--surface);color:var(--text);padding:12px 22px;border-radius:12px;font-weight:700;cursor:pointer;font-size:14px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#04263a}
.status{color:var(--muted);text-align:center;padding:20px;font-size:15px}
.hidden{display:none !important}
.current{display:flex;align-items:center;gap:20px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:24px;margin-bottom:20px}
.cur-emoji{font-size:64px}
.cur-info h2{font-size:18px;margin-bottom:4px}
.cur-temp{font-size:44px;font-weight:800;color:var(--accent);line-height:1}
.cur-label{color:var(--muted);font-size:14px;margin-top:4px}
.forecast{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px}
.day-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center}
.day-name{font-weight:700;font-size:13px}
.day-emoji{font-size:30px;margin:6px 0}
.day-temp{font-weight:700;font-size:13px}
.day-label{color:var(--muted);font-size:11px}
.chips{margin-top:18px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.chip{background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:20px;padding:6px 14px;font-size:13px;cursor:pointer}
.chip:hover{border-color:var(--accent)}
.muted{color:var(--muted);font-size:13px}
`;

export function jaolaWeather() {
    return {
        id: 'jaola-weather',
        category: 'tool',
        name: 'الطقس (API خارجي حيّ)',
        description: 'تطبيق طقس عامل يستهلك Open-Meteo مباشرةً (بلا مفتاح): بحث مدينة → الطقس الحالي + توقّعات 7 أيام.',
        keywords: ['طقس', 'الجو', 'مناخ', 'weather', 'forecast', 'توقعات', 'حرارة', 'الطقس', 'temperature', 'climate'],
        externalApi: 'Open-Meteo (بلا مفتاح)',
        model: {
            entities: [
                { name: 'Location', fields: [{ name: 'name', type: 'string' }, { name: 'latitude', type: 'number' }, { name: 'longitude', type: 'number' }], ownedBy: 'User' },
                { name: 'Forecast', fields: [{ name: 'temperature', type: 'number' }, { name: 'code', type: 'number' }], ownedBy: 'User' },
            ],
            roles: [{ name: 'User', description: 'يبحث عن طقس مدينة', capabilities: ['بحث مدينة', 'عرض الطقس الحالي', 'عرض التوقّعات'] }],
            flows: [
                { name: 'جلب الطقس', actor: 'User', steps: ['يكتب مدينة', 'geocoding API', 'forecast API', 'عرض النتيجة'], touches: ['Location', 'Forecast'], realtime: false },
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
