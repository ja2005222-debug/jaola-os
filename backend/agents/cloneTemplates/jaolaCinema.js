/**
 * 🎬 jaola-cinema — موقع سينما لحجز التذاكر (track: site — لزوّار).
 *
 * أفلام بعروض مؤقّتة، اختيار مقاعد على شبكة، حجز تذاكر بتأكيد وتذكرة
 * قابلة للطباعة، ولوحة إدارة (إضافة أفلام/عروض). أدوار: مشاهد (يحجز) +
 * إدارة. بلا اعتماد خارجي. الحالة في localStorage (jcin_*).
 */
import { sharedSystemStyles } from './jaolaClinic.js';

export function jaolaCinema() {
    const INDEX_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>سينما jaola — احجز تذكرتك</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar no-print">
    <div class="brand"><span class="mk">🎬</span> <span id="brandName">سينما jaola</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost no-print" id="authBtn" data-action="openAuth">دخول الإدارة</button>
  </header>
  <main class="no-print">
    <section id="view-now" class="view">
      <div class="hero"><div class="hero-in"><h1>احجز تذكرتك الآن</h1><p>أحدث الأفلام · اختر مقعدك · تذكرة فورية لكل مشاهد.</p></div></div>
      <h2>يُعرض الآن</h2>
      <div id="moviesGrid" class="movies-grid"></div>
    </section>

    <section id="view-showtimes" class="view hidden">
      <div class="view-head"><h2 id="stTitle">العروض</h2><button class="btn ghost" data-action="backNow">→ الأفلام</button></div>
      <div id="showtimesList" class="showtimes"></div>
    </section>

    <section id="view-seats" class="view hidden">
      <div class="view-head"><h2 id="seatTitle">اختر مقاعدك</h2><button class="btn ghost" data-action="backShowtimes">→ العروض</button></div>
      <div class="screen">الشاشة</div>
      <div id="seatMap" class="seat-map"></div>
      <div class="seat-legend"><span><i class="s-free"></i> متاح</span><span><i class="s-sel"></i> مختار</span><span><i class="s-taken"></i> محجوز</span></div>
      <div class="book-foot"><span id="seatSummary"></span><button class="btn primary" data-action="confirmBooking">تأكيد الحجز</button></div>
    </section>

    <section id="view-mytickets" class="view hidden">
      <div class="view-head"><h2>تذاكري</h2></div>
      <div id="myTickets"></div>
    </section>

    <section id="view-admin" class="view hidden">
      <div class="view-head"><h2>لوحة الإدارة</h2></div>
      <div class="panel form-row">
        <input id="mvTitle" placeholder="اسم الفيلم">
        <input id="mvGenre" placeholder="التصنيف (أكشن/دراما)">
        <input id="mvEmoji" placeholder="رمز 🎥" maxlength="2">
        <input id="mvPrice" type="number" placeholder="سعر التذكرة" min="0">
        <button class="btn primary" data-action="addMovie">إضافة فيلم</button>
      </div>
      <div class="panel form-row">
        <select id="shMovie"></select>
        <input id="shDate" type="date">
        <input id="shTime" type="time">
        <input id="shHall" placeholder="القاعة (1/2/VIP)">
        <button class="btn primary" data-action="addShowtime">إضافة عرض</button>
      </div>
      <div class="panel"><table class="tbl" id="adminMovies"></table></div>
    </section>

    <section id="view-auth" class="view hidden">
      <div class="login-card">
        <h1>دخول الإدارة</h1>
        <label>كلمة المرور</label>
        <input id="authPass" type="password" placeholder="admin">
        <p class="err hidden" id="authErr">كلمة المرور غير صحيحة</p>
        <button class="btn primary block" data-action="submitAuth">دخول</button>
        <p class="hint tiny">تجريبياً: كلمة المرور «admin».</p>
      </div>
    </section>
  </main>
  <div id="printArea" class="print-only"></div>
  <div id="toast" class="toast no-print hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

    const APP_JS = `/* 🎬 موقع سينما jaola — jaola-cinema */
function futureDate(days) { var d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
const SEED_MOVIES = [
  { id: 'f1', title: 'المهمة الأخيرة', genre: 'أكشن', emoji: '💥', price: 45 },
  { id: 'f2', title: 'قلوب لا تنسى', genre: 'دراما', emoji: '🎭', price: 40 },
  { id: 'f3', title: 'كوكب المغامرة', genre: 'مغامرة', emoji: '🚀', price: 50 }
];
const SEED_SHOWTIMES = [
  { id: 's1', movieId: 'f1', date: futureDate(0), time: '18:00', hall: 'قاعة 1' },
  { id: 's2', movieId: 'f1', date: futureDate(0), time: '21:00', hall: 'قاعة 1' },
  { id: 's3', movieId: 'f2', date: futureDate(1), time: '19:30', hall: 'قاعة 2' },
  { id: 's4', movieId: 'f3', date: futureDate(0), time: '20:00', hall: 'VIP' }
];
const ROWS = ['A', 'B', 'C', 'D', 'E'];
const COLS = 8;

function load(k, fb) { try { var v = localStorage.getItem('jcin_' + k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function save(k, val) { try { localStorage.setItem('jcin_' + k, JSON.stringify(val)); } catch (e) {} }
let movies = load('movies', SEED_MOVIES);
let showtimes = load('showtimes', SEED_SHOWTIMES);
let bookings = load('bookings', []); // { id, no, showId, seats:[], total, date }
let settings = load('settings', { name: 'سينما jaola', pass: 'admin', currency: 'ر.س', ticketSeq: 1 });
let state = { view: 'now', admin: false, activeMovie: null, activeShow: null, picked: [] };

function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return (Math.round(n * 100) / 100).toLocaleString('ar-EG') + ' ' + settings.currency; }
function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 999); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(m) { var t = byId('toast'); t.textContent = m; show(t, true); clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2400); }
function movieById(id) { for (var i = 0; i < movies.length; i++) if (movies[i].id === id) return movies[i]; return null; }
function showById(id) { for (var i = 0; i < showtimes.length; i++) if (showtimes[i].id === id) return showtimes[i]; return null; }
function takenSeats(showId) { var out = []; for (var i = 0; i < bookings.length; i++) if (bookings[i].showId === showId) out = out.concat(bookings[i].seats); return out; }

function setView(v) {
  state.view = v;
  var vs = document.querySelectorAll('.view'); for (var i = 0; i < vs.length; i++) show(vs[i], false);
  show(byId('view-' + v), true); renderTabs();
  if (v === 'now') renderMovies();
  if (v === 'showtimes') renderShowtimes();
  if (v === 'seats') renderSeats();
  if (v === 'mytickets') renderMyTickets();
  if (v === 'admin') renderAdmin();
}
function renderTabs() {
  var tabs = [['now', 'الأفلام'], ['mytickets', 'تذاكري']];
  if (state.admin) tabs.push(['admin', 'الإدارة']);
  byId('tabs').innerHTML = tabs.map(function (t) { return '<button class="tab ' + (state.view === t[0] ? 'active' : '') + '" data-action="tab" data-view="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  byId('authBtn').textContent = state.admin ? 'خروج' : 'دخول الإدارة';
}

/* ---------- الزائر: أفلام ← عروض ← مقاعد ---------- */
function renderMovies() {
  byId('moviesGrid').innerHTML = movies.map(function (m) {
    var count = showtimes.filter(function (s) { return s.movieId === m.id; }).length;
    return '<button class="movie-card" data-action="openMovie" data-id="' + m.id + '">' +
      '<span class="mv-emoji">' + (m.emoji || '🎬') + '</span>' +
      '<span class="mv-title">' + esc(m.title) + '</span>' +
      '<span class="mv-genre">' + esc(m.genre) + ' · ' + money(m.price) + '</span>' +
      '<span class="mv-shows">' + count + ' عرض</span></button>';
  }).join('') || '<p class="hint">لا أفلام حالياً.</p>';
}
function openMovie(id) { state.activeMovie = id; setView('showtimes'); }
function backNow() { setView('now'); }
function renderShowtimes() {
  var m = movieById(state.activeMovie); if (!m) { setView('now'); return; }
  byId('stTitle').textContent = m.emoji + ' ' + m.title;
  var list = showtimes.filter(function (s) { return s.movieId === m.id; });
  byId('showtimesList').innerHTML = list.length ? list.map(function (s) {
    var taken = takenSeats(s.id).length; var total = ROWS.length * COLS;
    return '<button class="show-row" data-action="openSeats" data-id="' + s.id + '">' +
      '<span>🗓️ ' + s.date + ' · 🕐 ' + esc(s.time) + '</span><span>' + esc(s.hall) + '</span>' +
      '<span>' + (total - taken) + ' مقعد متاح</span></button>';
  }).join('') : '<p class="hint">لا عروض لهذا الفيلم بعد.</p>';
}
function backShowtimes() { setView('showtimes'); }
function openSeats(showId) { state.activeShow = showId; state.picked = []; setView('seats'); }
function renderSeats() {
  var s = showById(state.activeShow); if (!s) { setView('now'); return; }
  var m = movieById(s.movieId);
  byId('seatTitle').textContent = 'مقاعد — ' + (m ? m.title : '') + ' (' + s.time + ')';
  var taken = takenSeats(s.id);
  var html = '';
  for (var r = 0; r < ROWS.length; r++) {
    html += '<div class="seat-row"><span class="row-lbl">' + ROWS[r] + '</span>';
    for (var c = 1; c <= COLS; c++) {
      var id = ROWS[r] + c;
      var cls = taken.indexOf(id) !== -1 ? 's-taken' : (state.picked.indexOf(id) !== -1 ? 's-sel' : 's-free');
      html += '<button class="seat ' + cls + '" data-action="toggleSeat" data-seat="' + id + '"' + (cls === 's-taken' ? ' disabled' : '') + '>' + c + '</button>';
    }
    html += '</div>';
  }
  byId('seatMap').innerHTML = html;
  updateSeatSummary();
}
function toggleSeat(id) {
  var i = state.picked.indexOf(id);
  if (i !== -1) state.picked.splice(i, 1); else state.picked.push(id);
  renderSeats();
}
function updateSeatSummary() {
  var s = showById(state.activeShow); var m = s ? movieById(s.movieId) : null;
  var price = m ? m.price : 0;
  byId('seatSummary').textContent = state.picked.length ? state.picked.length + ' مقعد × ' + money(price) + ' = ' + money(state.picked.length * price) : 'اختر مقعداً واحداً على الأقل';
}
function confirmBooking() {
  var s = showById(state.activeShow); if (!s || !state.picked.length) { toast('اختر مقاعدك أولاً'); return; }
  var m = movieById(s.movieId);
  var taken = takenSeats(s.id);
  for (var i = 0; i < state.picked.length; i++) if (taken.indexOf(state.picked[i]) !== -1) { toast('أحد المقاعد حُجز للتو'); renderSeats(); return; }
  var b = { id: uid('b'), no: settings.ticketSeq++, showId: s.id, movieTitle: m ? m.title : '', date: s.date, time: s.time, hall: s.hall, seats: state.picked.slice(), total: state.picked.length * (m ? m.price : 0), bookedAt: new Date().toISOString().slice(0, 10) };
  bookings.push(b); save('bookings', bookings); save('settings', settings);
  state.picked = [];
  toast('تم الحجز #' + b.no + ' 🎉'); printTicket(b.id); setView('mytickets');
}
function renderMyTickets() {
  byId('myTickets').innerHTML = bookings.length ? bookings.slice().reverse().map(function (b) {
    return '<div class="panel ticket-card"><div class="tk-head"><b>🎬 ' + esc(b.movieTitle) + '</b><span>#' + b.no + '</span></div>' +
      '<div class="tk-body">🗓️ ' + b.date + ' · 🕐 ' + esc(b.time) + ' · ' + esc(b.hall) + '<br>💺 ' + b.seats.join('، ') + ' · ' + money(b.total) + '</div>' +
      '<button class="btn tiny ghost" data-action="printTicket" data-id="' + b.id + '">🖨️ طباعة التذكرة</button></div>';
  }).join('') : '<p class="hint">لا تذاكر بعد — احجز من صفحة الأفلام.</p>';
}
function printTicket(id) {
  var b = null; for (var i = 0; i < bookings.length; i++) if (bookings[i].id === id) b = bookings[i];
  if (!b) return;
  byId('printArea').innerHTML = '<div class="receipt"><h2>' + esc(settings.name) + '</h2>' +
    '<div class="r-row"><span>تذكرة #' + b.no + '</span><span>' + b.bookedAt + '</span></div><hr>' +
    '<div class="r-row"><b>' + esc(b.movieTitle) + '</b></div>' +
    '<div class="r-row"><span>التاريخ</span><span>' + b.date + '</span></div>' +
    '<div class="r-row"><span>الوقت</span><span>' + esc(b.time) + '</span></div>' +
    '<div class="r-row"><span>القاعة</span><span>' + esc(b.hall) + '</span></div>' +
    '<div class="r-row"><span>المقاعد</span><span>' + b.seats.join('، ') + '</span></div><hr>' +
    '<div class="r-row"><b>الإجمالي</b><b>' + money(b.total) + '</b></div><hr>' +
    '<p style="text-align:center">استمتع بالمشاهدة 🍿</p></div>';
  window.print();
}

/* ---------- الإدارة ---------- */
function openAuth() { if (state.admin) { state.admin = false; toast('تم الخروج'); setView('now'); } else setView('auth'); }
function submitAuth() {
  if (byId('authPass').value !== settings.pass) { show(byId('authErr'), true); return; }
  show(byId('authErr'), false); state.admin = true; byId('authPass').value = ''; toast('مرحباً بالإدارة'); setView('admin');
}
function renderAdmin() {
  byId('shMovie').innerHTML = movies.map(function (m) { return '<option value="' + m.id + '">' + esc(m.title) + '</option>'; }).join('');
  var rows = movies.map(function (m) {
    var shows = showtimes.filter(function (s) { return s.movieId === m.id; }).map(function (s) { return s.date + ' ' + s.time + ' (' + esc(s.hall) + ')'; }).join('، ');
    return '<tr><td>' + (m.emoji || '🎬') + ' ' + esc(m.title) + '</td><td>' + esc(m.genre) + '</td><td>' + money(m.price) + '</td><td class="hint">' + (shows || '—') + '</td>' +
      '<td><button class="btn tiny ghost" data-action="delMovie" data-id="' + m.id + '">حذف</button></td></tr>';
  }).join('');
  byId('adminMovies').innerHTML = '<tr><th>الفيلm</th><th>التصنيف</th><th>السعر</th><th>العروض</th><th></th></tr>'.replace('الفيلm', 'الفيلم') +
    (rows || '<tr><td colspan="5" class="hint">لا أفلام بعد.</td></tr>');
}
function addMovie() {
  var title = byId('mvTitle').value.trim(); if (!title) { toast('اكتب اسم الفيلم'); return; }
  movies.push({ id: uid('f'), title: title, genre: byId('mvGenre').value.trim() || 'عام', emoji: byId('mvEmoji').value.trim(), price: Math.max(0, parseFloat(byId('mvPrice').value) || 40) });
  save('movies', movies); byId('mvTitle').value = ''; byId('mvGenre').value = ''; byId('mvEmoji').value = ''; byId('mvPrice').value = '';
  toast('أُضيف الفيلم'); renderAdmin();
}
function delMovie(id) { movies = movies.filter(function (m) { return m.id !== id; }); showtimes = showtimes.filter(function (s) { return s.movieId !== id; }); save('movies', movies); save('showtimes', showtimes); renderAdmin(); }
function addShowtime() {
  var mid = byId('shMovie').value; if (!mid) { toast('اختر الفيلم'); return; }
  showtimes.push({ id: uid('s'), movieId: mid, date: byId('shDate').value || futureDate(0), time: byId('shTime').value || '20:00', hall: byId('shHall').value.trim() || 'قاعة 1' });
  save('showtimes', showtimes); byId('shHall').value = ''; toast('أُضيف العرض'); renderAdmin();
}

function handleClick(e) {
  var a = e.target.closest('[data-action]'); if (!a) return;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'openMovie': openMovie(a.dataset.id); break;
    case 'backNow': backNow(); break;
    case 'openSeats': openSeats(a.dataset.id); break;
    case 'backShowtimes': backShowtimes(); break;
    case 'toggleSeat': toggleSeat(a.dataset.seat); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'printTicket': printTicket(a.dataset.id); break;
    case 'openAuth': openAuth(); break;
    case 'submitAuth': submitAuth(); break;
    case 'addMovie': addMovie(); break;
    case 'delMovie': delMovie(a.dataset.id); break;
    case 'addShowtime': addShowtime(); break;
  }
}
function init() { byId('brandName').textContent = settings.name; document.addEventListener('click', handleClick); setView('now'); }
document.addEventListener('DOMContentLoaded', init);
`;

    const EXTRA_CSS = `
.hero{border-radius:16px;background:linear-gradient(120deg,#4c1d95,#be185d);padding:44px 26px;margin-bottom:22px;position:relative;overflow:hidden}
.hero-in h1{font-size:28px;margin-bottom:8px}.hero-in p{opacity:.9;font-size:14px}
.movies-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}
.movie-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:transform .12s,border-color .12s}
.movie-card:hover{transform:translateY(-3px);border-color:var(--pri)}
.mv-emoji{font-size:38px}.mv-title{font-size:14px;font-weight:800;text-align:center}.mv-genre{font-size:11px;color:var(--mut)}
.mv-shows{font-size:10px;color:#c7d2fe;background:rgba(99,102,241,.12);border-radius:6px;padding:2px 8px}
.showtimes{display:flex;flex-direction:column;gap:8px}
.show-row{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:14px 16px;cursor:pointer;font-size:13px;font-weight:700;flex-wrap:wrap}
.show-row:hover{border-color:var(--pri)}
.screen{background:linear-gradient(#e2e8f0,#64748b);color:#0b0c14;text-align:center;font-weight:800;font-size:12px;border-radius:0 0 40px 40px/0 0 12px 12px;padding:6px;margin:0 auto 20px;max-width:420px}
.seat-map{display:flex;flex-direction:column;gap:8px;align-items:center;margin-bottom:16px}
.seat-row{display:flex;gap:6px;align-items:center}
.row-lbl{width:18px;color:var(--mut);font-size:11px;font-weight:800}
.seat{width:30px;height:30px;border-radius:7px 7px 4px 4px;border:1px solid var(--line);font-size:10px;cursor:pointer;color:var(--txt)}
.seat.s-free{background:rgba(255,255,255,.05)}
.seat.s-free:hover{border-color:var(--pri)}
.seat.s-sel{background:var(--pri);border-color:var(--pri);color:#fff}
.seat.s-taken{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.4);cursor:not-allowed;opacity:.6}
.seat-legend{display:flex;gap:16px;justify-content:center;font-size:11px;color:var(--mut);margin-bottom:16px}
.seat-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:4px;vertical-align:middle}
.seat-legend .s-free{background:rgba(255,255,255,.15)}.seat-legend .s-sel{background:var(--pri)}.seat-legend .s-taken{background:rgba(239,68,68,.35)}
.book-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;font-weight:800}
.ticket-card .tk-head{display:flex;justify-content:space-between;margin-bottom:6px}
.ticket-card .tk-body{font-size:12px;color:var(--mut);line-height:1.9;margin-bottom:10px}
`;

    return {
        id: 'jaola-cinema',
        track: 'site',
        category: 'entertainment',
        name: 'موقع سينما وحجز تذاكر',
        nameEn: 'Cinema & Ticketing',
        description: 'موقع سينما للزوّار: أفلام يُعرض الآن بعروض مؤقّتة، اختيار المقاعد على خريطة القاعة، حجز تذاكر بتأكيد وتذكرة قابلة للطباعة، ولوحة إدارة لإضافة الأفلام والعروض.',
        descriptionEn: 'Visitor-facing cinema site: now-showing movies with showtimes, seat selection on a hall map, ticket booking with confirmation and a printable ticket, plus an admin panel to add movies and showtimes.',
        keywords: ['سينما', 'سينمات', 'أفلام', 'فيلم', 'حجز تذاكر سينما', 'تذاكر أفلام', 'تذاكر الأفلام', 'اختيار مقاعد', 'المقاعد', 'مقاعد', 'عروض سينما', 'صالة عرض', 'cinema', 'movie', 'movies', 'film', 'showtimes', 'seat selection', 'ticket booking', 'theater'],
        model: {
            roles: [{ name: 'مشاهد' }, { name: 'إدارة' }],
            entities: [{ name: 'فيلم' }, { name: 'عرض' }, { name: 'حجز تذكرة' }],
            flows: [{ name: 'تصفّح الأفلام والعروض' }, { name: 'اختيار المقاعد على خريطة القاعة' }, { name: 'تأكيد الحجز وطباعة التذكرة' }, { name: 'إدارة الأفلام والعروض' }],
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: sharedSystemStyles() + EXTRA_CSS },
        ],
    };
}
