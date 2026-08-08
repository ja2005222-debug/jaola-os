/**
 * ✈️ JAOLA Travel — بوابة السفر (المرحلة ١: طيران + ايجنت حاجز)
 *
 * خدمة مستقلة كلياً عن منصة JAOLA الرئيسية — نفس فلسفة خدمة الفيديو
 * حرفياً: صفر استيراد من backend/، الرابط الوحيد هو الدخول الموحّد
 * (نفس JWT_SECRET يتحقق محلياً من نفس التوكن).
 *
 * النموذج التجاري: عمولة بلا تحويل — المزوّد يعطي سعراً صافياً، نبيع
 * بسعر + هامش (pricing.js)، والفرق عمولتنا مسجَّلة على كل حجز.
 *
 * createApp({...}) مصنع قابل للحقن (المخزن/السر/المزوّد/الايجنت) —
 * الاختبارات تبنيه بمخزن مؤقت ومزوّد محاكاة وايجنت بنموذج مُسجَّل.
 */
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { buildVerifyToken } from './src/auth.js';
import { readMarkupPct, applyMarkup } from './src/pricing.js';
import { createBooking, getBooking, listBookingsByUser, transitionBooking } from './src/bookings.js';
import { buildStore } from './src/store/index.js';
import { buildProvider } from './src/providers/index.js';
import { buildTravelAgent } from './src/agent/agent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CABINS = ['economy', 'premium_economy', 'business', 'first'];
const MAX_ADULTS = 9;
const MAX_CHILDREN = 8;
const MAX_BOOKING_WINDOW_DAYS = 330; // أقصى ما تفتحه أنظمة الحجز عادةً
const MAX_AGENT_MESSAGES = 30;
const MAX_AGENT_MESSAGE_CHARS = 4000;

/** يلتقط أخطاء المسارات غير المتزامنة إلى معالج Express بدل ابتلاعها. */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const IATA_RE = /^[A-Za-z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NAME_RE = /^[A-Za-z][A-Za-z' -]{0,39}$/; // لاتينية كما في الجواز — شرط المزوّدين
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

function todayUtc() {
    return new Date().toISOString().slice(0, 10);
}
function daysFromToday(dateStr) {
    return Math.round((new Date(dateStr + 'T00:00:00Z') - new Date(todayUtc() + 'T00:00:00Z')) / 86400000);
}

/** يتحقق من معايير البحث ويطبّعها — {error} أو {values}. */
export function validateSearchParams(body) {
    const origin = String(body?.origin || '').trim().toUpperCase();
    const destination = String(body?.destination || '').trim().toUpperCase();
    if (!IATA_RE.test(origin) || !IATA_RE.test(destination)) {
        return { error: 'رمزا المطار يجب أن يكونا IATA من ثلاثة أحرف (مثل RUH وCAI).' };
    }
    if (origin === destination) return { error: 'مطار المغادرة والوصول متطابقان.' };
    const departDate = String(body?.departDate || '').trim();
    if (!DATE_RE.test(departDate) || isNaN(Date.parse(departDate))) {
        return { error: 'تاريخ الذهاب بصيغة YYYY-MM-DD.' };
    }
    const departOffset = daysFromToday(departDate);
    if (departOffset < 0) return { error: 'تاريخ الذهاب في الماضي.' };
    if (departOffset > MAX_BOOKING_WINDOW_DAYS) {
        return { error: `تاريخ الذهاب أبعد من نافذة الحجز (${MAX_BOOKING_WINDOW_DAYS} يوماً).` };
    }
    let returnDate = null;
    if (body?.returnDate) {
        returnDate = String(body.returnDate).trim();
        if (!DATE_RE.test(returnDate) || isNaN(Date.parse(returnDate))) {
            return { error: 'تاريخ العودة بصيغة YYYY-MM-DD.' };
        }
        if (returnDate < departDate) return { error: 'تاريخ العودة قبل الذهاب.' };
        if (daysFromToday(returnDate) > MAX_BOOKING_WINDOW_DAYS) {
            return { error: `تاريخ العودة أبعد من نافذة الحجز (${MAX_BOOKING_WINDOW_DAYS} يوماً).` };
        }
    }
    const adults = body?.adults != null ? Number(body.adults) : 1;
    const children = body?.children != null ? Number(body.children) : 0;
    if (!Number.isInteger(adults) || adults < 1 || adults > MAX_ADULTS) {
        return { error: `عدد البالغين بين 1 و${MAX_ADULTS}.` };
    }
    if (!Number.isInteger(children) || children < 0 || children > MAX_CHILDREN) {
        return { error: `عدد الأطفال بين 0 و${MAX_CHILDREN}.` };
    }
    const cabin = body?.cabin ? String(body.cabin) : 'economy';
    if (!CABINS.includes(cabin)) {
        return { error: `درجة غير معروفة (المتاح: ${CABINS.join('، ')}).` };
    }
    return { values: { origin, destination, departDate, returnDate, adults, children, cabin } };
}

/** يتحقق من بيانات الركاب والتواصل — {error} أو {values}. */
export function validatePassengers(body, expectedCount) {
    const passengers = Array.isArray(body?.passengers) ? body.passengers : null;
    if (!passengers || passengers.length === 0) return { error: 'بيانات الركاب مطلوبة.' };
    if (expectedCount && passengers.length !== expectedCount) {
        return { error: `العرض لعدد ${expectedCount} مسافرين — وصلت بيانات ${passengers.length}.` };
    }
    const clean = [];
    for (const [i, p] of passengers.entries()) {
        const title = String(p?.title || '').toLowerCase();
        if (!['mr', 'ms', 'mrs'].includes(title)) return { error: `المسافر ${i + 1}: اللقب mr أو ms أو mrs.` };
        const givenName = String(p?.givenName || '').trim();
        const familyName = String(p?.familyName || '').trim();
        if (!NAME_RE.test(givenName) || !NAME_RE.test(familyName)) {
            return { error: `المسافر ${i + 1}: الاسمان بالحروف اللاتينية كما في الجواز (حتى 40 حرفاً).` };
        }
        const bornOn = String(p?.bornOn || '').trim();
        if (!DATE_RE.test(bornOn) || isNaN(Date.parse(bornOn)) || bornOn >= todayUtc()) {
            return { error: `المسافر ${i + 1}: تاريخ ميلاد صالح بصيغة YYYY-MM-DD.` };
        }
        const gender = String(p?.gender || '').toLowerCase();
        if (!['m', 'f'].includes(gender)) return { error: `المسافر ${i + 1}: الجنس m أو f.` };
        clean.push({ title, givenName, familyName, bornOn, gender });
    }
    const email = String(body?.contact?.email || '').trim();
    const phone = String(body?.contact?.phone || '').replace(/[\s-]/g, '');
    if (!EMAIL_RE.test(email)) return { error: 'بريد تواصل صالح مطلوب.' };
    if (!PHONE_RE.test(phone)) return { error: 'هاتف تواصل صالح مطلوب (أرقام دولية).' };
    return { values: { passengers: clean, contact: { email, phone } } };
}

/** عرض للعميل: sellAmount فقط — الصافي netAmount **لا يغادر الخادم**. */
function publicOffer(offer, markupPct) {
    const { netAmount, passengerIds, ...rest } = offer;
    return { ...rest, sellAmount: applyMarkup(netAmount, markupPct) };
}

function publicBooking(b) {
    return {
        id: b.id, at: b.at, updatedAt: b.updatedAt, status: b.status,
        bookingReference: b.bookingReference,
        sellAmount: b.sellAmount, currency: b.currency,
        offer: b.offer, passengers: b.passengers, contact: b.contact,
        error: b.error, refund: b.refund,
    };
}

export function createApp({
    store,
    jwtSecret,
    provider,
    agent = null,
    markupPct = readMarkupPct(),
}) {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '256kb' }));
    app.use(express.static(path.join(__dirname, 'public')));

    const verifyToken = buildVerifyToken(jwtSecret);
    const userOf = req => String(req.user?.username || '').trim().toLowerCase();

    // بحث المزوّدات مكلف/محدود المعدل لديهم — درع أمامي عندنا أولاً
    const searchLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
    const agentLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

    // ─── منطق الخدمة المشترك: المسارات والايجنت يستهلكان نفس الدوال ───
    // (هذا ما يجعل الايجنت "بلا التفاف": أي حارس هنا يسري عليه حتماً)

    async function doSearch(params) {
        const check = validateSearchParams(params);
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });
        const offers = await provider.searchOffers(check.values);
        return offers.map(o => publicOffer(o, markupPct));
    }

    async function doGetOffer(offerId) {
        const offer = await provider.getOffer(String(offerId || ''));
        return offer ? publicOffer(offer, markupPct) : null;
    }

    async function doBook(username, { offerId, passengers, contact }) {
        const offer = await provider.getOffer(String(offerId || ''));
        if (!offer) throw Object.assign(new Error('العرض غير موجود أو انتهت صلاحيته — أعد البحث.'), { status: 404 });
        const check = validatePassengers({ passengers, contact }, offer.passengerCount);
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });

        const sellAmount = applyMarkup(offer.netAmount, markupPct);
        // ملخص العرض المخزَّن على الحجز: بلا صافٍ ولا معرّفات مزوّد داخلية
        const { netAmount: _net, passengerIds: _ids, ...offerSummary } = offer;
        const booking = await createBooking(store, {
            username, provider: provider.name,
            offer: offerSummary,
            passengers: check.values.passengers,
            contact: check.values.contact,
            netAmount: offer.netAmount, sellAmount, currency: offer.currency,
        });
        try {
            const order = await provider.createOrder({
                offerId: offer.id,
                passengers: check.values.passengers,
                contact: check.values.contact,
            });
            const issued = await transitionBooking(store, booking.id, 'issued', {
                providerOrderId: order.orderId,
                bookingReference: order.bookingReference,
            });
            return publicBooking(issued);
        } catch (e) {
            await transitionBooking(store, booking.id, 'failed', { error: e.message });
            throw Object.assign(new Error(`تعذّر إصدار الحجز: ${e.message}`), { status: 502 });
        }
    }

    async function doCancel(username, bookingId) {
        const booking = await getBooking(store, String(bookingId || ''));
        // عزل صارم: حجز مستخدم آخر يُعامل كغير موجود (404 لا 403)
        if (!booking || booking.username !== username) {
            throw Object.assign(new Error('الحجز غير موجود.'), { status: 404 });
        }
        if (booking.status !== 'issued') {
            throw Object.assign(new Error('الإلغاء متاح للحجوزات المُصدَرة فقط.'), { status: 400 });
        }
        const result = await provider.cancelOrder(booking.providerOrderId);
        const cancelled = await transitionBooking(store, booking.id, 'cancelled', {
            refund: { amount: result.refundAmount ?? null, currency: result.currency ?? null },
        });
        // سباق نادر: انتقال آخر سبقنا بعد نداء المزوّد — الحالة الفعلية أصدق
        return publicBooking(cancelled || await getBooking(store, booking.id));
    }

    async function listMine(username) {
        const bookings = await listBookingsByUser(store, username);
        return bookings.map(publicBooking);
    }

    // ─── المسارات ─────────────────────────────────────────────────────

    app.get('/api/travel/health', (req, res) => {
        res.json({ ok: true, service: 'jaola-travel', provider: provider.name });
    });

    app.get('/api/travel/config', verifyToken, wrap(async (req, res) => {
        res.json({
            cabins: CABINS,
            maxAdults: MAX_ADULTS,
            maxChildren: MAX_CHILDREN,
            provider: provider.name,
            // sandbox/mock → الواجهة تعرض لافتة "بيئة تجريبية" بصدق
            providerMode: provider.mode || 'live',
            agentEnabled: !!agent,
        });
    }));

    app.post('/api/travel/flights/search', verifyToken, searchLimiter, wrap(async (req, res) => {
        try {
            res.json({ offers: await doSearch(req.body) });
        } catch (e) {
            if (e.status === 400) return res.status(400).json({ error: e.message });
            throw e;
        }
    }));

    app.get('/api/travel/flights/offers/:id', verifyToken, wrap(async (req, res) => {
        const offer = await doGetOffer(req.params.id);
        if (!offer) return res.status(404).json({ error: 'العرض غير موجود أو انتهت صلاحيته.' });
        res.json({ offer });
    }));

    app.post('/api/travel/bookings', verifyToken, wrap(async (req, res) => {
        try {
            const booking = await doBook(userOf(req), req.body || {});
            res.json({ booking });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.get('/api/travel/bookings', verifyToken, wrap(async (req, res) => {
        res.json({ bookings: await listMine(userOf(req)) });
    }));

    app.get('/api/travel/bookings/:id', verifyToken, wrap(async (req, res) => {
        const booking = await getBooking(store, req.params.id);
        if (!booking || booking.username !== userOf(req)) {
            return res.status(404).json({ error: 'الحجز غير موجود.' });
        }
        res.json({ booking: publicBooking(booking) });
    }));

    app.post('/api/travel/bookings/:id/cancel', verifyToken, wrap(async (req, res) => {
        try {
            res.json({ booking: await doCancel(userOf(req), req.params.id) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    // ─── 🤖 الايجنت الحاجز ────────────────────────────────────────────

    app.post('/api/travel/agent/chat', verifyToken, agentLimiter, wrap(async (req, res) => {
        if (!agent) {
            return res.status(503).json({ error: 'المساعد غير مفعَّل — اضبط TRAVEL_AGENT_API_KEY.' });
        }
        const raw = Array.isArray(req.body?.messages) ? req.body.messages : null;
        if (!raw || raw.length === 0) return res.status(400).json({ error: 'الرسائل مطلوبة.' });
        if (raw.length > MAX_AGENT_MESSAGES) {
            return res.status(400).json({ error: `أقصى طول للمحادثة ${MAX_AGENT_MESSAGES} رسالة — ابدأ محادثة جديدة.` });
        }
        const messages = [];
        for (const m of raw) {
            const role = m?.role === 'assistant' ? 'assistant' : 'user';
            const content = String(m?.content || '').slice(0, MAX_AGENT_MESSAGE_CHARS);
            if (!content) return res.status(400).json({ error: 'رسالة فارغة في المحادثة.' });
            messages.push({ role, content });
        }
        const username = userOf(req);
        // services مربوطة بمستخدم هذا الطلب — الايجنت لا يرى ولا يلمس غيره
        const services = {
            searchFlights: params => doSearch(params),
            getOffer: id => doGetOffer(id),
            bookFlight: args => doBook(username, args),
            listBookings: () => listMine(username),
            cancelBooking: id => doCancel(username, id),
        };
        try {
            const result = await agent.chat({ messages, services });
            res.json(result);
        } catch (e) {
            res.status(502).json({ error: `تعذّر رد المساعد: ${e.message}` });
        }
    }));

    // معالج أخطاء أخير — لا تسريب تفاصيل داخلية للعميل.
    app.use((err, req, res, next) => {
        console.error('⚠️ خطأ غير متوقع في بوابة السفر:', err.message);
        res.status(500).json({ error: 'خطأ داخلي في الخدمة.' });
    });

    return app;
}

// ─── الإقلاع الفعلي (لا يعمل عند الاستيراد من الاختبارات) ──────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const store = buildStore({
        databaseUrl: process.env.DATABASE_URL,
        dataDir: process.env.TRAVEL_DATA_DIR || path.join(__dirname, '.travelportal'),
    });
    const provider = buildProvider();
    const agent = buildTravelAgent();
    const markupPct = readMarkupPct();

    await store.init(); // ينشئ الجداول عند أول إقلاع — فشلٌ صاخب إن تعذّر

    const app = createApp({
        store,
        // السر السابق (اختياري) يُقبل أثناء تدوير المفتاح فقط — يُزال بعده.
        jwtSecret: [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS],
        provider,
        agent,
        markupPct,
    });

    const port = Number(process.env.PORT || 4200);
    app.listen(port, () => {
        console.log(`✈️ بوابة السفر على المنفذ ${port} (المزوّد: ${provider.name}/${provider.mode || 'live'}، التخزين: ${store.name}، الهامش: ${markupPct}%)`);
        if (!agent) console.warn('⚠️ الايجنت غير مفعَّل — اضبط TRAVEL_AGENT_API_KEY لتفعيل المساعد الحاجز.');
        if (provider.name === 'mock') console.warn('⚠️ مزوّد محاكاة — اضبط DUFFEL_API_KEY (يبدأ بـduffel_test للتجريبي).');
        if (store.name === 'file') {
            console.warn('⚠️ تخزين بالملفات — على منصة ذات قرص مؤقت تُمسح الحجوزات مع كل إعادة نشر. اضبط DATABASE_URL للإنتاج.');
        }
    });
}
