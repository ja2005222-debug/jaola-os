/**
 * ✈️ Travelpayouts Integration — JAOLA
 *
 * يولّد تكاملاً موثوقاً (حتمياً، لا يعتمد على LLM) لموقع طيران:
 *   - وسيط خلفي آمن api/flights/search.js يقرأ التوكن من process.env (لا يظهر في المتصفّح)
 *   - ينادي Travelpayouts Data API ويضيف marker الإحالة لروابط الحجز
 *   - أداة بحث أمامية flights-widget.js تنادي الوسيط وتعرض النتائج
 *
 * القاعدة الأمنية: التوكن على الخادم فقط. الواجهة لا تراه إطلاقاً.
 */

const FLIGHT_KEYWORDS = /travelpayout|طيران|رحلات\s*جو|flight|flights|aviasales|tickets?\s*(flight|طيران)|حجز\s*طيران|بحث\s*طيران/i;

/** هل يحتاج المشروع تكامل Travelpayouts للطيران؟ */
export function needsTravelpayouts(goal = '') {
    return FLIGHT_KEYWORDS.test(goal);
}

/** الوسيط الخلفي — يقرأ التوكن من البيئة، ينادي Travelpayouts، يضيف marker */
function proxyHandler() {
    return `// ✈️ وسيط بحث الطيران — Travelpayouts (التوكن يبقى على الخادم فقط)
const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
const MARKER = process.env.TRAVELPAYOUTS_MARKER || '';

export default async function handler(req, res) {
    if (!TOKEN) return res.status(500).json({ error: 'TRAVELPAYOUTS_TOKEN غير مضبوط على الخادم' });

    // معايير البحث من الواجهة
    const q = req.query || {};
    const origin = (q.origin || '').toString().toUpperCase().slice(0, 3);
    const destination = (q.destination || '').toString().toUpperCase().slice(0, 3);
    const departure_at = (q.departure_at || '').toString().slice(0, 10); // YYYY-MM أو YYYY-MM-DD
    const currency = (q.currency || 'usd').toString().slice(0, 3);
    if (!origin || !destination) return res.status(400).json({ error: 'origin و destination مطلوبان (رموز IATA)' });

    const url = new URL('https://api.travelpayouts.com/aviasales/v3/prices_for_dates');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    if (departure_at) url.searchParams.set('departure_at', departure_at);
    url.searchParams.set('currency', currency);
    url.searchParams.set('sorting', 'price');
    url.searchParams.set('limit', '30');
    url.searchParams.set('token', TOKEN);

    try {
        const r = await fetch(url.toString());
        const data = await r.json();
        if (!data || data.success === false) return res.status(502).json({ error: 'فشل جلب النتائج من Travelpayouts' });

        // تطبيع النتائج + رابط حجز بالإحالة (marker) — منه تربح عمولتك
        const results = (data.data || []).map((f) => ({
            origin: f.origin, destination: f.destination,
            departure_at: f.departure_at, return_at: f.return_at || null,
            airline: f.airline, flight_number: f.flight_number,
            price: f.price, currency,
            transfers: f.transfers,
            bookingUrl: 'https://www.aviasales.com' + (f.link || '') + (f.link && MARKER ? (f.link.includes('?') ? '&' : '?') + 'marker=' + MARKER : ''),
        }));
        res.json({ success: true, count: results.length, results });
    } catch (e) {
        res.status(502).json({ error: 'تعذّر الاتصال بـ Travelpayouts: ' + e.message });
    }
}
`;
}

/** أداة البحث الأمامية — تنادي الوسيط فقط (بلا توكن) */
function frontendWidget() {
    return `// ✈️ أداة بحث الطيران — تنادي الوسيط الخلفي (لا توكن في المتصفّح)
async function searchFlights({ origin, destination, departure_at, currency = 'usd' }) {
    const params = new URLSearchParams({ origin, destination, departure_at, currency });
    const res = await fetch('/api/flights/search?' + params.toString());
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'فشل البحث');
    return (await res.json()).results || [];
}

// مثال ربط بنموذج بحث في صفحتك:
// document.querySelector('#flight-form')?.addEventListener('submit', async (e) => {
//   e.preventDefault();
//   const box = document.querySelector('#flight-results');
//   box.innerHTML = 'جاري البحث...';
//   try {
//     const flights = await searchFlights({
//       origin: origin.value, destination: destination.value, departure_at: date.value,
//     });
//     box.innerHTML = flights.length ? flights.map(f =>
//       \`<div class="flight-card">
//         <b>\${f.origin} → \${f.destination}</b> · \${f.airline} · \${f.departure_at?.slice(0,10)}
//         <span>\${f.price} \${f.currency}</span>
//         <a href="\${f.bookingUrl}" target="_blank" rel="noopener">احجز</a>
//       </div>\`).join('') : 'لا نتائج.';
//   } catch (err) { box.textContent = err.message; }
// });
`;
}

function readme() {
    return `# ✈️ تكامل Travelpayouts (بحث الطيران)

## كيف يعمل (آمن)
المتصفّح ← \`/api/flights/search\` (خادمك) ← Travelpayouts (بالتوكن + marker) ← النتائج.
**التوكن يبقى على الخادم فقط** — لا يظهر في المتصفّح أبداً.

## الإعداد (مرة واحدة)
1. من لوحة Travelpayouts احصل على: **API Token** و **Marker** (معرّف الإحالة).
2. اضبط متغيّرَي البيئة على استضافتك (Render/Vercel):
   \`\`\`
   TRAVELPAYOUTS_TOKEN=your_token_here
   TRAVELPAYOUTS_MARKER=your_marker_here
   \`\`\`
   (أو أدخِلهما في إعدادات المشروع داخل JAOLA لتُكتب تلقائياً في \`.env\`.)

## الملفات المولّدة
- \`api/flights/search.js\` — الوسيط الخلفي الآمن
- \`flights-widget.js\` — دالة \`searchFlights()\` للواجهة + مثال ربط نموذج البحث

## ملاحظة العمولة
روابط \`bookingUrl\` تحمل \`marker\` الخاص بك — منها تُحتسب عمولتك عند الحجز.
`;
}

/** يولّد كل ملفات تكامل Travelpayouts */
export function generateTravelpayoutsModule() {
    return {
        files: [
            { name: 'api/flights/search.js', content: proxyHandler() },
            { name: 'flights-widget.js', content: frontendWidget() },
            { name: 'TRAVELPAYOUTS_README.md', content: readme() },
        ],
        env: ['TRAVELPAYOUTS_TOKEN', 'TRAVELPAYOUTS_MARKER'],
    };
}
