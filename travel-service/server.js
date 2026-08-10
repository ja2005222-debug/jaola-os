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
import crypto from 'crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { buildVerifyToken } from './src/auth.js';
import { readMarkupPct, applyMarkup } from './src/pricing.js';
import { createBooking, getBooking, getBookingByProviderOrderId, listBookingsByUser, transitionBooking } from './src/bookings.js';
import { buildStore } from './src/store/index.js';
import { buildProvider, buildStaysProvider, buildCarsProvider } from './src/providers/index.js';
import { buildTravelAgent } from './src/agent/agent.js';
import { airportCoords, searchAirports, airportForTimezone } from './src/airports.js';
import { createPriceWatch, listPriceWatchesByUser, cancelPriceWatch } from './src/priceWatches.js';
import { checkWatches } from './src/priceWatchPoller.js';
import { getDestinationWeather, convertCurrency, MAX_FORECAST_DAYS_AHEAD } from './src/travelInfo.js';
import { buildTopDestinations } from './src/topDestinations.js';
import { sendMail, mailReady } from './src/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CABINS = ['economy', 'premium_economy', 'business', 'first'];
const SORTS = ['price', 'duration']; // الأرخص | الأسرع
const MAX_ADULTS = 9;
const MAX_CHILDREN = 8;
const MAX_ROOMS = 5;
const MAX_STAY_NIGHTS = 30;
const MAX_RENTAL_DAYS = 30;
const MAX_BOOKING_WINDOW_DAYS = 330; // أقصى ما تفتحه أنظمة الحجز عادةً
const MAX_AGENT_MESSAGES = 30;
const MAX_AGENT_MESSAGE_CHARS = 4000;
const MAX_FLEX_WINDOW_DAYS = 7;
const FLEX_CONCURRENCY = 3;
const FLEX_WINDOW_MS = 5 * 60 * 1000;
const FLEX_MAX_CALLS = 5; // أغلى من بحث عادي (نداءات مزوّد متعددة لكل طلب)

/** يلتقط أخطاء المسارات غير المتزامنة إلى معالج Express بدل ابتلاعها. */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const IATA_RE = /^[A-Za-z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const NAME_RE = /^[A-Za-z][A-Za-z' -]{0,39}$/; // لاتينية كما في الجواز — شرط المزوّدين
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// ⚠️ E.164 صارمة: `+` ورمز دولة إلزاميان (١–١٥ رقماً، أولها ليس صفراً).
// كانت `\+?` تجعل `+` اختيارية فيمرّ رقم محلي (05xxxxxxxx) من تحققنا ثم
// يرفضه Duffel بـ`HTTP 422: Field 'phone_number' is invalid` — **بعد**
// إنشاء سجل حجز يتحول failed، فيتراكم فشل في قائمة المستخدم بلا سبب
// مفهوم له. عُطل حقيقي رُصد من استخدام حي (١٠ أغسطس ٢٠٢٦).
const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;
const PHONE_HINT = 'هاتف بصيغة دولية يبدأ بـ+ ورمز الدولة (مثل +966501234567).';
const CURRENCY_RE = /^[A-Za-z]{3}$/;

/**
 * يطبّع الهاتف قبل التحقق: يزيل الفواصل الشكلية، ويحوّل بادئة الاتصال
 * الدولي `00` إلى `+` (نفس الرقم دولياً — من يكتب 00966… يقصد +966…)،
 * فلا يُرفض رقم صحيح لمجرد اختلاف صيغة كتابته.
 */
function normalizePhone(raw) {
    const cleaned = String(raw || '').replace(/[\s()\-.]/g, '');
    return cleaned.startsWith('00') ? '+' + cleaned.slice(2) : cleaned;
}

function todayUtc() {
    return new Date().toISOString().slice(0, 10);
}
function daysFromToday(dateStr) {
    return Math.round((new Date(dateStr + 'T00:00:00Z') - new Date(todayUtc() + 'T00:00:00Z')) / 86400000);
}

/**
 * ✅ تحقق توقيع Duffel webhook — الخوارزمية مؤكَّدة حرفياً من نموذج Python
 * الرسمي بدليل Duffel (Notifications) الذي قدَّمه المالك، لا تخمين (ميزة
 * أمنية — لا يُقبَل فيها نفس تساهل تخمين أشكال الأسعار في مزوّدات أخرى):
 *   هيدر X-Duffel-Signature بصيغة `t=<timestamp>,v1=<hex>`، والتوقيع =
 *   HMAC-SHA256(secret, `${t}.${rawBody}`) بترميز hex صغير الحروف.
 * مقارنة زمن ثابت (timingSafeEqual) — لا `===` عادية لمقارنة أسرار.
 */
export function verifyDuffelWebhookSignature(rawBody, signatureHeader, secret) {
    if (!signatureHeader || !secret) return false;
    const pairs = Object.fromEntries(
        String(signatureHeader).split(',').map(p => p.split('='))
    );
    const { t, v1 } = pairs;
    if (!t || !v1) return false;
    const signedPayload = Buffer.concat([Buffer.from(`${t}.`, 'utf8'), Buffer.from(rawBody)]);
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const actualBuf = Buffer.from(String(v1), 'utf8');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
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
    const sort = body?.sort ? String(body.sort) : 'price';
    if (!SORTS.includes(sort)) {
        return { error: `ترتيب غير معروف (المتاح: ${SORTS.join('، ')}).` };
    }
    return { values: { origin, destination, departDate, returnDate, adults, children, cabin, sort } };
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
    const phone = normalizePhone(body?.contact?.phone);
    if (!EMAIL_RE.test(email)) return { error: 'بريد تواصل صالح مطلوب.' };
    if (!PHONE_RE.test(phone)) return { error: PHONE_HINT };
    return { values: { passengers: clean, contact: { email, phone } } };
}

/** يتحقق من معايير بحث الفنادق ويطبّعها — {error} أو {values}. */
export function validateStaySearchParams(body) {
    const iata = String(body?.iata || '').trim().toUpperCase();
    if (!IATA_RE.test(iata)) {
        return { error: 'رمز الوجهة يجب أن يكون IATA من ثلاثة أحرف (مثل RUH وCAI).' };
    }
    if (!airportCoords(iata)) {
        return { error: `الوجهة ${iata} غير مغطّاة حالياً في بحث الفنادق.` };
    }
    const checkInDate = String(body?.checkInDate || '').trim();
    if (!DATE_RE.test(checkInDate) || isNaN(Date.parse(checkInDate))) {
        return { error: 'تاريخ الوصول بصيغة YYYY-MM-DD.' };
    }
    const checkInOffset = daysFromToday(checkInDate);
    if (checkInOffset < 0) return { error: 'تاريخ الوصول في الماضي.' };
    if (checkInOffset > MAX_BOOKING_WINDOW_DAYS) {
        return { error: `تاريخ الوصول أبعد من نافذة الحجز (${MAX_BOOKING_WINDOW_DAYS} يوماً).` };
    }
    const checkOutDate = String(body?.checkOutDate || '').trim();
    if (!DATE_RE.test(checkOutDate) || isNaN(Date.parse(checkOutDate))) {
        return { error: 'تاريخ المغادرة بصيغة YYYY-MM-DD.' };
    }
    if (checkOutDate <= checkInDate) return { error: 'تاريخ المغادرة يجب أن يكون بعد الوصول.' };
    const nights = Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000);
    if (nights > MAX_STAY_NIGHTS) return { error: `أقصى مدة إقامة ${MAX_STAY_NIGHTS} ليلة.` };
    const adults = body?.adults != null ? Number(body.adults) : 1;
    const rooms = body?.rooms != null ? Number(body.rooms) : 1;
    if (!Number.isInteger(adults) || adults < 1 || adults > MAX_ADULTS) {
        return { error: `عدد البالغين بين 1 و${MAX_ADULTS}.` };
    }
    if (!Number.isInteger(rooms) || rooms < 1 || rooms > MAX_ROOMS) {
        return { error: `عدد الغرف بين 1 و${MAX_ROOMS}.` };
    }
    return { values: { iata, checkInDate, checkOutDate, adults, rooms } };
}

/** يتحقق من بيانات ضيوف الفندق والتواصل — {error} أو {values}. */
export function validateGuests(body) {
    const guests = Array.isArray(body?.guests) ? body.guests : null;
    if (!guests || guests.length === 0) return { error: 'بيانات الضيوف مطلوبة.' };
    const clean = [];
    for (const [i, g] of guests.entries()) {
        const givenName = String(g?.givenName || '').trim();
        const familyName = String(g?.familyName || '').trim();
        if (!NAME_RE.test(givenName) || !NAME_RE.test(familyName)) {
            return { error: `الضيف ${i + 1}: الاسمان بالحروف اللاتينية (حتى 40 حرفاً).` };
        }
        clean.push({ givenName, familyName });
    }
    const email = String(body?.contact?.email || '').trim();
    const phone = normalizePhone(body?.contact?.phone);
    if (!EMAIL_RE.test(email)) return { error: 'بريد تواصل صالح مطلوب.' };
    if (!PHONE_RE.test(phone)) return { error: PHONE_HINT };
    return { values: { guests: clean, contact: { email, phone } } };
}

/** يتحقق من معايير بحث السيارات ويطبّعها — {error} أو {values}. */
export function validateCarSearchParams(body) {
    const iata = String(body?.iata || '').trim().toUpperCase();
    if (!IATA_RE.test(iata)) {
        return { error: 'رمز موقع الاستلام يجب أن يكون IATA من ثلاثة أحرف (مثل RUH وCAI).' };
    }
    if (!airportCoords(iata)) {
        return { error: `الوجهة ${iata} غير مغطّاة حالياً في بحث السيارات.` };
    }
    const pickupDate = String(body?.pickupDate || '').trim();
    if (!DATE_RE.test(pickupDate) || isNaN(Date.parse(pickupDate))) {
        return { error: 'تاريخ الاستلام بصيغة YYYY-MM-DD.' };
    }
    const pickupOffset = daysFromToday(pickupDate);
    if (pickupOffset < 0) return { error: 'تاريخ الاستلام في الماضي.' };
    if (pickupOffset > MAX_BOOKING_WINDOW_DAYS) {
        return { error: `تاريخ الاستلام أبعد من نافذة الحجز (${MAX_BOOKING_WINDOW_DAYS} يوماً).` };
    }
    const pickupTime = String(body?.pickupTime || '10:00').trim();
    if (!TIME_RE.test(pickupTime)) return { error: 'وقت الاستلام بصيغة HH:MM.' };
    const dropoffDate = String(body?.dropoffDate || '').trim();
    if (!DATE_RE.test(dropoffDate) || isNaN(Date.parse(dropoffDate))) {
        return { error: 'تاريخ التسليم بصيغة YYYY-MM-DD.' };
    }
    const dropoffTime = String(body?.dropoffTime || '10:00').trim();
    if (!TIME_RE.test(dropoffTime)) return { error: 'وقت التسليم بصيغة HH:MM.' };
    const pickupAt = `${pickupDate}T${pickupTime}:00Z`;
    const dropoffAt = `${dropoffDate}T${dropoffTime}:00Z`;
    if (dropoffAt <= pickupAt) return { error: 'وقت التسليم يجب أن يكون بعد الاستلام.' };
    const days = (new Date(dropoffAt) - new Date(pickupAt)) / 86400000;
    if (days > MAX_RENTAL_DAYS) return { error: `أقصى مدة استئجار ${MAX_RENTAL_DAYS} يوماً.` };
    return { values: { iata, pickupAt, dropoffAt } };
}

/** يتحقق من بيانات السائقين والتواصل — {error} أو {values}. */
export function validateDrivers(body) {
    const drivers = Array.isArray(body?.drivers) ? body.drivers : null;
    if (!drivers || drivers.length === 0) return { error: 'بيانات السائق مطلوبة.' };
    const clean = [];
    for (const [i, d] of drivers.entries()) {
        const givenName = String(d?.givenName || '').trim();
        const familyName = String(d?.familyName || '').trim();
        if (!NAME_RE.test(givenName) || !NAME_RE.test(familyName)) {
            return { error: `السائق ${i + 1}: الاسمان بالحروف اللاتينية (حتى 40 حرفاً).` };
        }
        clean.push({ givenName, familyName });
    }
    const email = String(body?.contact?.email || '').trim();
    const phone = normalizePhone(body?.contact?.phone);
    if (!EMAIL_RE.test(email)) return { error: 'بريد تواصل صالح مطلوب.' };
    if (!PHONE_RE.test(phone)) return { error: PHONE_HINT };
    return { values: { drivers: clean, contact: { email, phone } } };
}

/** عرض للعميل: sellAmount فقط — الصافي netAmount **لا يغادر الخادم**. */
function publicOffer(offer, markupPct) {
    const { netAmount, passengerIds, ...rest } = offer;
    return { ...rest, sellAmount: applyMarkup(netAmount, markupPct) };
}

function publicBooking(b) {
    return {
        id: b.id, at: b.at, updatedAt: b.updatedAt, status: b.status, kind: b.kind || 'flight',
        bookingReference: b.bookingReference,
        sellAmount: b.sellAmount, currency: b.currency,
        offer: b.offer, passengers: b.passengers, contact: b.contact,
        error: b.error, refund: b.refund,
    };
}

/** سطر ملخّص نصّي لحجز (بريد التأكيد/الإلغاء) — نفس منطق bookingBodyHtml في الواجهة. */
function bookingSummaryLine(b) {
    if (b.kind === 'stay') {
        return `🏨 ${b.offer?.name || 'فندق'} — ${b.offer?.city || ''} — ${b.offer?.checkInDate || ''} → ${b.offer?.checkOutDate || ''}`;
    }
    if (b.kind === 'car') {
        return `🚗 ${b.offer?.vehicleName || 'سيارة'} — ${b.offer?.supplier || ''} — ${b.offer?.pickupLocation || ''}`;
    }
    const slices = b.offer?.slices || [];
    const first = slices[0] || {};
    const last = slices[slices.length - 1] || first;
    return `✈️ ${first.origin || '؟'}→${last.destination || '؟'} — ${(first.departAt || '').slice(0, 16).replace('T', ' ')}`;
}

export function createApp({
    store,
    jwtSecret,
    provider,
    staysProvider = null,
    carsProvider = null,
    agent = null,
    markupPct = readMarkupPct(),
    travelInfoFetch = fetch, // قابل للحقن في الاختبارات (طقس/عملة بلا شبكة حقيقية)
    mailer = { sendMail, mailReady }, // قابل للحقن في الاختبارات (نفس نمط priceWatchPoller.js)
    duffelWebhookSecret = null, // بلا هذا: مسار الـwebhook يرد 503 بوضوح
}) {
    const app = express();
    // خلف وكيل عكسي واحد (Render وأمثالها) — بدونه req.ip هو عنوان الوكيل
    // نفسه لكل الطلبات، فيتشارك كل المستخدمين نفس سلة محدّد المعدل أدناه.
    app.set('trust proxy', 1);
    app.use(cors());
    // verify يحفظ البايتات الخام (req.rawBody) قبل التفكيك — تحقق توقيع
    // webhook يحتاج الجسم الخام بالضبط كما وصل، لا نسخة مُعاد تسلسلها من
    // JSON المُفكَّك (قد تختلف بايتاً بايت: ترتيب مفاتيح، مسافات...).
    app.use(express.json({ limit: '256kb', verify: (req, res, buf) => { req.rawBody = buf; } }));
    app.use(express.static(path.join(__dirname, 'public')));

    const verifyToken = buildVerifyToken(jwtSecret);
    const userOf = req => String(req.user?.username || '').trim().toLowerCase();

    // مفتاح محدّدات المعدل أدناه: اسم المستخدم لا عنوان IP — verifyToken
    // يعمل قبلها دوماً في كل مسار، والتصحيح بالمستخدم صحيح بصرف النظر عن
    // إعداد الوكيل العكسي (خلاف trust proxy وحده الذي لا يحل تشارك عنوان
    // NAT/شبكة شركة بين عدة مستخدمين حقيقيين).
    const byUser = req => userOf(req) || ipKeyGenerator(req.ip); // احتياطي IPv6-آمن قبل verifyToken
    // بحث المزوّدات مكلف/محدود المعدل لديهم — درع أمامي عندنا أولاً
    const searchLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, keyGenerator: byUser });
    const agentLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, keyGenerator: byUser });
    // نتيجة أهم الوجهات مُخزَّنة عالمياً (topDestinations.js) فلا تكلفة
    // حقيقية على المزوّد إلا أول طلب كل 6 ساعات — حد أخف من searchLimiter يكفي.
    const destinationsLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 15, standardHeaders: true, legacyHeaders: false, keyGenerator: byUser });

    // بريد تأكيد/إلغاء اختياري تماماً (RESEND_API_KEY) — فشل الإرسال أو
    // غياب البريد لا يكسر الحجز أبداً؛ sendMail الحقيقي لا يرمي استثناءً.
    async function notifyBookingIssued(booking) {
        if (!booking?.contact?.email || !mailer.mailReady()) return;
        await mailer.sendMail({
            to: booking.contact.email,
            subject: `✅ تأكيد حجزك — مرجع ${booking.bookingReference}`,
            text: `تم تأكيد حجزك بنجاح.\n\n${bookingSummaryLine(booking)}\nالمرجع: ${booking.bookingReference}\nالإجمالي: ${booking.sellAmount} ${booking.currency}\n\nراجع كل حجوزاتك من بوابة السفر.`,
        });
    }
    async function notifyBookingCancelled(booking) {
        if (!booking?.contact?.email || !mailer.mailReady()) return;
        const refundLine = booking.refund?.amount != null
            ? `مبلغ الاسترداد: ${booking.refund.amount} ${booking.refund.currency || ''}`
            : 'سيُحدَّد مبلغ الاسترداد قريباً من المزوّد.';
        await mailer.sendMail({
            to: booking.contact.email,
            subject: `↩️ تم إلغاء حجزك — مرجع ${booking.bookingReference}`,
            text: `تم إلغاء حجزك.\n\n${bookingSummaryLine(booking)}\nالمرجع: ${booking.bookingReference}\n${refundLine}`,
        });
    }
    // شركة الطيران غيّرت أو ألغت رحلة مُصدَرة (webhook من Duffel، لا مبادرة
    // منّا) — إشعار فوري لأن المسافر لن يعرف إلا بمراجعة حجوزاته يدوياً.
    async function notifyAirlineChange(booking) {
        if (!booking?.contact?.email || !mailer.mailReady()) return;
        await mailer.sendMail({
            to: booking.contact.email,
            subject: `⚠️ تغيير من شركة الطيران على حجزك — مرجع ${booking.bookingReference}`,
            text: `شركة الطيران أجرت تغييراً على رحلتك بعد الحجز (موعد أو مسار).\n\n${bookingSummaryLine(booking)}\nالمرجع: ${booking.bookingReference}\n\nراجع تفاصيل حجزك من بوابة السفر أو تواصل مع شركة الطيران مباشرةً بالمرجع أعلاه.`,
        });
    }

    // ─── منطق الخدمة المشترك: المسارات والايجنت يستهلكان نفس الدوال ───
    // (هذا ما يجعل الايجنت "بلا التفاف": أي حارس هنا يسري عليه حتماً)

    async function doSearch(params) {
        const check = validateSearchParams(params);
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });
        try {
            const offers = await provider.searchOffers(check.values);
            return offers.map(o => publicOffer(o, markupPct));
        } catch (e) {
            // بلا هذا: رفض المزوّد (403 Duffel، خطأ LiteAPI...) يسقط كخطأ
            // 500 عام مبهم — التفصيل الفعلي يضيع رغم وجوده (راجع تعليق
            // duffelProvider.js: "أي رفض يظهر بتفصيل رد Duffel لا فشلاً صامتاً").
            throw Object.assign(new Error(`تعذّر البحث: ${e.message}`), { status: 502 });
        }
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
            await notifyBookingIssued(issued);
            return publicBooking(issued);
        } catch (e) {
            await transitionBooking(store, booking.id, 'failed', { error: e.message });
            throw Object.assign(new Error(`تعذّر إصدار الحجز: ${e.message}`), { status: 502 });
        }
    }

    async function doCancel(username, bookingId) {
        const booking = await getBooking(store, String(bookingId || ''));
        // عزل صارم: حجز مستخدم آخر (أو من نوع مختلف) يُعامل كغير موجود (404 لا 403)
        if (!booking || booking.username !== username || (booking.kind || 'flight') !== 'flight') {
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
        const finalBooking = cancelled || await getBooking(store, booking.id);
        await notifyBookingCancelled(finalBooking);
        return publicBooking(finalBooking);
    }

    async function listMine(username) {
        const bookings = await listBookingsByUser(store, username);
        return bookings.map(publicBooking);
    }

    // ─── الفنادق (Duffel Stays) — محاذاة دوال الطيران أعلاه سطراً بسطر ──

    function requireStays() {
        if (!staysProvider) throw Object.assign(new Error('حجز الفنادق غير مفعَّل حالياً.'), { status: 503 });
    }

    async function doSearchStays(params) {
        requireStays();
        const check = validateStaySearchParams(params);
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });
        try {
            const offers = await staysProvider.searchStays(check.values);
            return offers.map(o => publicOffer(o, markupPct));
        } catch (e) {
            throw Object.assign(new Error(`تعذّر بحث الفنادق: ${e.message}`), { status: 502 });
        }
    }

    async function doGetStayOffer(offerId) {
        requireStays();
        const offer = await staysProvider.getStayOffer(String(offerId || ''));
        return offer ? publicOffer(offer, markupPct) : null;
    }

    // تفاصيل الفندق للعرض فقط (بلا أسعار — الأسعار حصراً من مسار البحث
    // المُسعَّر حتى لا يلتف أحد حول تطبيق الهامش). ليست كل المزوّدات
    // تدعمها (Duffel Stays لا يوفّر مساراً مكافئاً) — 501 صريح بدل تعطّل.
    async function doGetHotelDetails(hotelId) {
        requireStays();
        if (typeof staysProvider.getHotelDetails !== 'function') {
            throw Object.assign(new Error('تفاصيل الفنادق غير مدعومة لدى المزوّد الحالي.'), { status: 501 });
        }
        const id = String(hotelId || '').trim();
        if (!id) throw Object.assign(new Error('معرّف الفندق مطلوب.'), { status: 400 });
        try {
            return await staysProvider.getHotelDetails(id);
        } catch (e) {
            throw Object.assign(new Error(`تعذّر جلب تفاصيل الفندق: ${e.message}`), { status: 502 });
        }
    }

    async function doBookStay(username, { offerId, guests, contact }) {
        requireStays();
        // offerId هنا quote id (من get_stay_offer السابقة) — getQuote يجلبه
        // كما هو دون إنشاء quote جديد؛ getStayOffer كانت لتنشئ quote ثانياً
        // من نفس المعرّف بوصفه rate_id خطأً، فيفشل الحجز ضد Duffel الحقيقي.
        const offer = await staysProvider.getQuote(String(offerId || ''));
        if (!offer) throw Object.assign(new Error('عرض الفندق غير موجود أو انتهت صلاحيته — أعد البحث.'), { status: 404 });
        const check = validateGuests({ guests, contact });
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });

        const sellAmount = applyMarkup(offer.netAmount, markupPct);
        const { netAmount: _net, ...offerSummary } = offer;
        const booking = await createBooking(store, {
            username, provider: staysProvider.name, kind: 'stay',
            offer: offerSummary,
            passengers: check.values.guests,
            contact: check.values.contact,
            netAmount: offer.netAmount, sellAmount, currency: offer.currency,
        });
        try {
            const order = await staysProvider.createStayOrder({
                offerId: offer.id,
                guests: check.values.guests,
                contact: check.values.contact,
            });
            const issued = await transitionBooking(store, booking.id, 'issued', {
                providerOrderId: order.orderId,
                bookingReference: order.bookingReference,
            });
            await notifyBookingIssued(issued);
            return publicBooking(issued);
        } catch (e) {
            await transitionBooking(store, booking.id, 'failed', { error: e.message });
            throw Object.assign(new Error(`تعذّر إصدار حجز الفندق: ${e.message}`), { status: 502 });
        }
    }

    async function doCancelStay(username, bookingId) {
        requireStays();
        const booking = await getBooking(store, String(bookingId || ''));
        if (!booking || booking.username !== username || booking.kind !== 'stay') {
            throw Object.assign(new Error('الحجز غير موجود.'), { status: 404 });
        }
        if (booking.status !== 'issued') {
            throw Object.assign(new Error('الإلغاء متاح للحجوزات المُصدَرة فقط.'), { status: 400 });
        }
        const result = await staysProvider.cancelStayOrder(booking.providerOrderId);
        const cancelled = await transitionBooking(store, booking.id, 'cancelled', {
            refund: { amount: result.refundAmount ?? null, currency: result.currency ?? null },
        });
        const finalBooking = cancelled || await getBooking(store, booking.id);
        await notifyBookingCancelled(finalBooking);
        return publicBooking(finalBooking);
    }

    // ─── السيارات (Duffel Cars) — محاذاة دوال الفنادق أعلاه سطراً بسطر ──

    function requireCars() {
        if (!carsProvider) throw Object.assign(new Error('استئجار السيارات غير مفعَّل حالياً.'), { status: 503 });
    }

    async function doSearchCars(params) {
        requireCars();
        const check = validateCarSearchParams(params);
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });
        try {
            const offers = await carsProvider.searchCars(check.values);
            return offers.map(o => publicOffer(o, markupPct));
        } catch (e) {
            throw Object.assign(new Error(`تعذّر بحث السيارات: ${e.message}`), { status: 502 });
        }
    }

    async function doGetCarOffer(offerId) {
        requireCars();
        const offer = await carsProvider.getCarOffer(String(offerId || ''));
        return offer ? publicOffer(offer, markupPct) : null;
    }

    async function doBookCar(username, { offerId, drivers, contact }) {
        requireCars();
        // نفس تفرقة rate/quote لدى الفنادق: offerId هنا quote id — getQuote
        // يجلبه كما هو دون إنشاء quote جديد.
        const offer = await carsProvider.getQuote(String(offerId || ''));
        if (!offer) throw Object.assign(new Error('عرض السيارة غير موجود أو انتهت صلاحيته — أعد البحث.'), { status: 404 });
        const check = validateDrivers({ drivers, contact });
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });

        const sellAmount = applyMarkup(offer.netAmount, markupPct);
        const { netAmount: _net, ...offerSummary } = offer;
        const booking = await createBooking(store, {
            username, provider: carsProvider.name, kind: 'car',
            offer: offerSummary,
            passengers: check.values.drivers,
            contact: check.values.contact,
            netAmount: offer.netAmount, sellAmount, currency: offer.currency,
        });
        try {
            const order = await carsProvider.createCarOrder({
                offerId: offer.id,
                drivers: check.values.drivers,
                contact: check.values.contact,
            });
            const issued = await transitionBooking(store, booking.id, 'issued', {
                providerOrderId: order.orderId,
                bookingReference: order.bookingReference,
            });
            await notifyBookingIssued(issued);
            return publicBooking(issued);
        } catch (e) {
            await transitionBooking(store, booking.id, 'failed', { error: e.message });
            throw Object.assign(new Error(`تعذّر إصدار حجز السيارة: ${e.message}`), { status: 502 });
        }
    }

    async function doCancelCar(username, bookingId) {
        requireCars();
        const booking = await getBooking(store, String(bookingId || ''));
        if (!booking || booking.username !== username || booking.kind !== 'car') {
            throw Object.assign(new Error('الحجز غير موجود.'), { status: 404 });
        }
        if (booking.status !== 'issued') {
            throw Object.assign(new Error('الإلغاء متاح للحجوزات المُصدَرة فقط.'), { status: 400 });
        }
        const result = await carsProvider.cancelCarOrder(booking.providerOrderId);
        const cancelled = await transitionBooking(store, booking.id, 'cancelled', {
            refund: { amount: result.refundAmount ?? null, currency: result.currency ?? null },
        });
        const finalBooking = cancelled || await getBooking(store, booking.id);
        await notifyBookingCancelled(finalBooking);
        return publicBooking(finalBooking);
    }

    // ─── إيجاد الحلول (أدوات ايجنت فقط — لا مسارات HTTP مباشرة) ────────

    // عدّاد بسيط لكل مستخدم: find_flexible_dates تُصدر عدة نداءات مزوّد
    // لكل طلب واحد، فتحتاج سقفاً أشدّ من searchLimiter العام.
    const flexCallState = new Map();
    function checkFlexLimit(username) {
        const now = Date.now();
        const entry = flexCallState.get(username);
        if (!entry || now - entry.windowStart > FLEX_WINDOW_MS) {
            flexCallState.set(username, { count: 1, windowStart: now });
            return;
        }
        entry.count += 1;
        if (entry.count > FLEX_MAX_CALLS) {
            throw Object.assign(new Error('طلبات بحث التواريخ المرنة كثيرة جداً — انتظر قليلاً وحاول مجدداً.'), { status: 429 });
        }
    }

    async function doFindFlexibleDates(username, { origin, destination, aroundDate, windowDays, cabin }) {
        checkFlexLimit(username);
        const originU = String(origin || '').trim().toUpperCase();
        const destU = String(destination || '').trim().toUpperCase();
        if (!IATA_RE.test(originU) || !IATA_RE.test(destU)) {
            throw Object.assign(new Error('رمزا المطار يجب أن يكونا IATA من ثلاثة أحرف.'), { status: 400 });
        }
        const center = String(aroundDate || '').trim();
        if (!DATE_RE.test(center) || isNaN(Date.parse(center))) {
            throw Object.assign(new Error('تاريخ مركزي بصيغة YYYY-MM-DD.'), { status: 400 });
        }
        const win = Math.min(MAX_FLEX_WINDOW_DAYS, Math.max(1, Number(windowDays) || 3));
        const cab = CABINS.includes(cabin) ? cabin : 'economy';

        const dates = [];
        for (let d = -win; d <= win; d++) {
            const dt = new Date(center + 'T00:00:00Z');
            dt.setUTCDate(dt.getUTCDate() + d);
            const iso = dt.toISOString().slice(0, 10);
            if (daysFromToday(iso) >= 0) dates.push(iso);
        }

        const results = [];
        for (let i = 0; i < dates.length; i += FLEX_CONCURRENCY) {
            const batch = dates.slice(i, i + FLEX_CONCURRENCY);
            const batchResults = await Promise.all(batch.map(async date => {
                try {
                    const offers = await provider.searchOffers({ origin: originU, destination: destU, departDate: date, adults: 1, children: 0, cabin: cab });
                    if (offers.length === 0) return { date, price: null, currency: null };
                    const cheapestNet = Math.min(...offers.map(o => o.netAmount));
                    return { date, price: applyMarkup(cheapestNet, markupPct), currency: offers[0].currency };
                } catch {
                    return { date, price: null, currency: null };
                }
            }));
            results.push(...batchResults);
        }
        return results;
    }

    async function doCheckTripConflicts(username) {
        const bookings = (await listBookingsByUser(store, username)).filter(b => b.status === 'issued');
        const warnings = [];
        const flights = bookings.filter(b => (b.kind || 'flight') === 'flight' && (b.offer?.slices || []).length > 0);
        const stays = bookings.filter(b => b.kind === 'stay' && b.offer?.checkOutDate);

        for (let i = 0; i < flights.length; i++) {
            const aSlices = flights[i].offer.slices;
            const aStart = new Date(aSlices[0].departAt);
            const aEnd = new Date(aSlices[aSlices.length - 1].arriveAt);
            for (let j = i + 1; j < flights.length; j++) {
                const bSlices = flights[j].offer.slices;
                const bStart = new Date(bSlices[0].departAt);
                const bEnd = new Date(bSlices[bSlices.length - 1].arriveAt);
                if (aStart < bEnd && bStart < aEnd) {
                    warnings.push({ message: `رحلتان متداخلتا التوقيت: ${flights[i].bookingReference || flights[i].id} و${flights[j].bookingReference || flights[j].id}.` });
                }
            }
        }

        if (flights.length > 0) {
            const latestFlightDate = flights
                .map(f => f.offer.slices[f.offer.slices.length - 1].arriveAt?.slice(0, 10))
                .filter(Boolean)
                .sort()
                .pop();
            for (const stay of stays) {
                if (latestFlightDate && stay.offer.checkOutDate > latestFlightDate) {
                    warnings.push({ message: `مغادرة الفندق (${stay.offer.checkOutDate}) بعد آخر رحلة عودة (${latestFlightDate}) — تحقق من التواريخ.` });
                }
            }
        }
        return warnings;
    }

    async function doWatchPrice(username, params) {
        const check = validateSearchParams(params);
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });
        let targetPrice = null;
        if (params?.targetPrice != null) {
            targetPrice = Number(params.targetPrice);
            if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
                throw Object.assign(new Error('السعر الهدف يجب أن يكون رقماً موجباً.'), { status: 400 });
            }
        }
        let contactEmail = null;
        if (params?.contactEmail) {
            contactEmail = String(params.contactEmail).trim();
            if (!EMAIL_RE.test(contactEmail)) {
                throw Object.assign(new Error('بريد إشعار غير صالح.'), { status: 400 });
            }
        }
        return createPriceWatch(store, {
            username, origin: check.values.origin, destination: check.values.destination,
            departDate: check.values.departDate, returnDate: check.values.returnDate,
            cabin: check.values.cabin, targetPrice, contactEmail,
        });
    }

    async function doListPriceWatches(username) {
        return listPriceWatchesByUser(store, username);
    }

    async function doCancelPriceWatch(username, watchId) {
        const cancelled = await cancelPriceWatch(store, watchId, username);
        if (!cancelled) throw Object.assign(new Error('المراقبة غير موجودة أو غير نشطة.'), { status: 404 });
        return cancelled;
    }

    // ─── معلومات وفيرة (أدوات ايجنت فقط — بيانات حقيقية مصدرها API) ────

    async function doGetDestinationWeather({ iata, dateFrom, dateTo }) {
        const code = String(iata || '').trim().toUpperCase();
        if (!IATA_RE.test(code)) {
            throw Object.assign(new Error('رمز الوجهة يجب أن يكون IATA من ثلاثة أحرف.'), { status: 400 });
        }
        const coords = airportCoords(code);
        if (!coords) throw Object.assign(new Error(`الوجهة ${code} غير مغطّاة حالياً لتوقعات الطقس.`), { status: 400 });
        const from = String(dateFrom || '').trim();
        const to = String(dateTo || from).trim();
        if (!DATE_RE.test(from) || isNaN(Date.parse(from))) {
            throw Object.assign(new Error('تاريخ بداية بصيغة YYYY-MM-DD.'), { status: 400 });
        }
        if (!DATE_RE.test(to) || isNaN(Date.parse(to)) || to < from) {
            throw Object.assign(new Error('تاريخ نهاية صالح لا يسبق البداية.'), { status: 400 });
        }
        if (daysFromToday(from) < 0 || daysFromToday(to) > MAX_FORECAST_DAYS_AHEAD) {
            throw Object.assign(new Error(`التوقعات الجوية متاحة من اليوم حتى ${MAX_FORECAST_DAYS_AHEAD} يوماً قادماً فقط.`), { status: 400 });
        }
        const days = await getDestinationWeather({ lat: coords.lat, lon: coords.lon, dateFrom: from, dateTo: to, fetchImpl: travelInfoFetch });
        return { city: coords.city, country: coords.country, days };
    }

    async function doConvertCurrency({ amount, from, to }) {
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw Object.assign(new Error('المبلغ يجب أن يكون رقماً موجباً.'), { status: 400 });
        }
        const fromU = String(from || '').trim().toUpperCase();
        const toU = String(to || '').trim().toUpperCase();
        if (!CURRENCY_RE.test(fromU) || !CURRENCY_RE.test(toU)) {
            throw Object.assign(new Error('رمزا العملة يجب أن يكونا من ثلاثة أحرف (مثل USD وSAR).'), { status: 400 });
        }
        return convertCurrency({ amount: amt, from: fromU, to: toU, fetchImpl: travelInfoFetch });
    }

    // ─── خدمات مساعدة (concierge — حساب داخلي بحت، بلا API خارجي) ──────

    function bookingStartDate(b) {
        if (b.kind === 'stay') return b.offer?.checkInDate || null;
        return b.offer?.slices?.[0]?.departAt?.slice(0, 10) || null;
    }

    async function doGenerateTripSummary(username, { fromDate, toDate } = {}) {
        for (const [label, d] of [['fromDate', fromDate], ['toDate', toDate]]) {
            if (d != null && (!DATE_RE.test(d) || isNaN(Date.parse(d)))) {
                throw Object.assign(new Error(`${label} بصيغة YYYY-MM-DD.`), { status: 400 });
            }
        }
        const bookings = (await listBookingsByUser(store, username))
            .filter(b => b.status === 'issued')
            .map(b => ({ b, date: bookingStartDate(b) }))
            .filter(({ date }) => date && (!fromDate || date >= fromDate) && (!toDate || date <= toDate))
            .sort((a, c) => a.date.localeCompare(c.date))
            .map(({ b }) => b);

        if (bookings.length === 0) return { text: 'لا حجوزات مُصدَرة ضمن هذا المدى.', bookingCount: 0 };

        const lines = ['📋 ملخص الرحلة:'];
        for (const b of bookings) {
            if (b.kind === 'stay') {
                lines.push(`🏨 ${b.offer.name || 'فندق'} — ${b.offer.city || ''} — ${b.offer.checkInDate} → ${b.offer.checkOutDate} — ${b.sellAmount} ${b.currency} — مرجع ${b.bookingReference}`);
            } else {
                const first = b.offer.slices?.[0] || {};
                const last = b.offer.slices?.[b.offer.slices.length - 1] || {};
                lines.push(`✈️ ${first.origin || '؟'}→${last.destination || '؟'} — ${(first.departAt || '').slice(0, 16).replace('T', ' ')} — ${b.sellAmount} ${b.currency} — مرجع ${b.bookingReference}`);
            }
        }
        return { text: lines.join('\n'), bookingCount: bookings.length };
    }

    // ─── المسارات ─────────────────────────────────────────────────────

    app.get('/api/travel/health', (req, res) => {
        res.json({ ok: true, service: 'jaola-travel', provider: provider.name });
    });

    // ─── 🔔 Duffel webhooks — بلا verifyToken (Duffel لا يحمل توكن JWT
    // مستخدم؛ الحماية عبر توقيع HMAC وحده، راجع verifyDuffelWebhookSignature) ─
    app.post('/api/travel/webhooks/duffel', wrap(async (req, res) => {
        if (!duffelWebhookSecret) return res.status(503).json({ error: 'Duffel webhook غير مُهيَّأ.' });
        const valid = verifyDuffelWebhookSignature(req.rawBody, req.headers['x-duffel-signature'], duffelWebhookSecret);
        if (!valid) return res.status(400).json({ error: 'توقيع غير صالح.' });

        const event = req.body || {};
        if (event.type === 'order.airline_initiated_change_detected') {
            // ⚠️ شكل event.data.object لهذا النوع تحديداً غير مؤكَّد بمثال
            // حي (المثال الرسمي المُشاهَد كان لنوع order.created بجسم فارغ
            // {}) — مسارات استخراج مُعدَّدة احتياطاً بدل افتراض واحد.
            const orderId = event.data?.object?.id || event.data?.object?.order_id || event.data?.id || null;
            const booking = orderId ? await getBookingByProviderOrderId(store, orderId) : null;
            if (booking && booking.status === 'issued') {
                await notifyAirlineChange(booking);
            }
        }
        res.json({ received: true });
    }));

    // 🔤 بحث المطارات بالاسم/الدولة/الرمز — عربي أو إنجليزي.
    // بحث محلي بحت في airports.js: لا نداء مزوّد ولا تكلفة، فلا محدّد
    // معدّل خاص به (verifyToken وحده يكفي كبقية المسارات).
    app.get('/api/travel/airports', verifyToken, wrap(async (req, res) => {
        res.json({ airports: searchAirports(req.query.q, 8) });
    }));

    // مطار الانطلاق الافتراضي من المنطقة الزمنية للمتصفح — قيمة مقترحة
    // لا مفروضة: الواجهة تعبّئها ويغيّرها المستخدم متى شاء، وتحفظ اختياره.
    app.get('/api/travel/airports/default', verifyToken, wrap(async (req, res) => {
        res.json({ airport: airportForTimezone(req.query.tz) });
    }));

    app.get('/api/travel/config', verifyToken, wrap(async (req, res) => {
        res.json({
            cabins: CABINS,
            maxAdults: MAX_ADULTS,
            maxChildren: MAX_CHILDREN,
            maxRooms: MAX_ROOMS,
            provider: provider.name,
            // sandbox/mock → الواجهة تعرض لافتة "بيئة تجريبية" بصدق
            providerMode: provider.mode || 'live',
            staysEnabled: !!staysProvider,
            staysProviderMode: staysProvider?.mode || null,
            carsEnabled: !!carsProvider,
            carsProviderMode: carsProvider?.mode || null,
            agentEnabled: !!agent,
        });
    }));

    app.post('/api/travel/flights/search', verifyToken, searchLimiter, wrap(async (req, res) => {
        try {
            res.json({ offers: await doSearch(req.body) });
        } catch (e) {
            // كان يفحص 400 فقط — رفض مزوّد فعلي (502 الجديد أعلاه) كان يسقط
            // كخطأ 500 عام رغم تفصيل واضح متوفر، خلاف مساري الفنادق/السيارات.
            if (e.status) return res.status(e.status).json({ error: e.message });
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

    // ─── الفنادق (Duffel Stays) — محاذاة مسارات الطيران أعلاه ──────────

    app.post('/api/travel/stays/search', verifyToken, searchLimiter, wrap(async (req, res) => {
        try {
            res.json({ offers: await doSearchStays(req.body) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.get('/api/travel/stays/offers/:id', verifyToken, wrap(async (req, res) => {
        try {
            const offer = await doGetStayOffer(req.params.id);
            if (!offer) return res.status(404).json({ error: 'عرض الفندق غير موجود أو انتهت صلاحيته.' });
            res.json({ offer });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    // نداء مزوّد حقيقي لكل فتح تفاصيل — searchLimiter نفسه يحميه.
    app.get('/api/travel/stays/hotels/:hotelId', verifyToken, searchLimiter, wrap(async (req, res) => {
        try {
            const hotel = await doGetHotelDetails(req.params.hotelId);
            if (!hotel) return res.status(404).json({ error: 'تفاصيل الفندق غير متاحة.' });
            res.json({ hotel });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.post('/api/travel/stays/bookings', verifyToken, wrap(async (req, res) => {
        try {
            const booking = await doBookStay(userOf(req), req.body || {});
            res.json({ booking });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.post('/api/travel/stays/bookings/:id/cancel', verifyToken, wrap(async (req, res) => {
        try {
            res.json({ booking: await doCancelStay(userOf(req), req.params.id) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    // ─── السيارات (Duffel Cars) — محاذاة مسارات الفنادق أعلاه ──────────

    app.post('/api/travel/cars/search', verifyToken, searchLimiter, wrap(async (req, res) => {
        try {
            res.json({ offers: await doSearchCars(req.body) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.get('/api/travel/cars/offers/:id', verifyToken, wrap(async (req, res) => {
        try {
            const offer = await doGetCarOffer(req.params.id);
            if (!offer) return res.status(404).json({ error: 'عرض السيارة غير موجود أو انتهت صلاحيته.' });
            res.json({ offer });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.post('/api/travel/cars/bookings', verifyToken, wrap(async (req, res) => {
        try {
            const booking = await doBookCar(userOf(req), req.body || {});
            res.json({ booking });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.post('/api/travel/cars/bookings/:id/cancel', verifyToken, wrap(async (req, res) => {
        try {
            res.json({ booking: await doCancelCar(userOf(req), req.params.id) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    // ─── 🗺️ أهم الوجهات (صور Wikimedia + أرخص سعر حقيقي) ──────────────

    app.get('/api/travel/destinations/top', verifyToken, destinationsLimiter, wrap(async (req, res) => {
        const origin = String(req.query.origin || '').trim().toUpperCase();
        if (!IATA_RE.test(origin)) {
            return res.status(400).json({ error: 'رمز مطار الأصل يجب أن يكون IATA من ثلاثة أحرف (مثل RUH).' });
        }
        const destinations = await buildTopDestinations({ origin, provider, markupPct, fetchImpl: travelInfoFetch });
        res.json({ destinations });
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
            searchStays: staysProvider ? params => doSearchStays(params) : null,
            getStayOffer: staysProvider ? id => doGetStayOffer(id) : null,
            bookStay: staysProvider ? args => doBookStay(username, args) : null,
            cancelStay: staysProvider ? id => doCancelStay(username, id) : null,
            searchCars: carsProvider ? params => doSearchCars(params) : null,
            getCarOffer: carsProvider ? id => doGetCarOffer(id) : null,
            bookCar: carsProvider ? args => doBookCar(username, args) : null,
            cancelCar: carsProvider ? id => doCancelCar(username, id) : null,
            findFlexibleDates: params => doFindFlexibleDates(username, params),
            checkTripConflicts: () => doCheckTripConflicts(username),
            watchPrice: args => doWatchPrice(username, args),
            listPriceWatches: () => doListPriceWatches(username),
            cancelPriceWatch: id => doCancelPriceWatch(username, id),
            getDestinationWeather: args => doGetDestinationWeather(args),
            convertCurrency: args => doConvertCurrency(args),
            generateTripSummary: args => doGenerateTripSummary(username, args),
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
    const staysProvider = buildStaysProvider();
    const carsProvider = buildCarsProvider();
    const agent = buildTravelAgent();
    const markupPct = readMarkupPct();

    await store.init(); // ينشئ الجداول عند أول إقلاع — فشلٌ صاخب إن تعذّر

    const app = createApp({
        store,
        // السر السابق (اختياري) يُقبل أثناء تدوير المفتاح فقط — يُزال بعده.
        jwtSecret: [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS],
        provider,
        staysProvider,
        carsProvider,
        agent,
        markupPct,
        duffelWebhookSecret: process.env.DUFFEL_WEBHOOK_SECRET || null,
    });

    const port = Number(process.env.PORT || 4200);
    app.listen(port, () => {
        console.log(`✈️ بوابة السفر على المنفذ ${port} (المزوّد: ${provider.name}/${provider.mode || 'live'}، الفنادق: ${staysProvider.name}/${staysProvider.mode || 'live'}، السيارات: ${carsProvider.name}/${carsProvider.mode || 'live'}، التخزين: ${store.name}، الهامش: ${markupPct}%)`);
        if (!agent) console.warn('⚠️ الايجنت غير مفعَّل — اضبط TRAVEL_AGENT_API_KEY لتفعيل المساعد الحاجز.');
        if (provider.name === 'mock') console.warn('⚠️ مزوّد محاكاة — اضبط DUFFEL_API_KEY (يبدأ بـduffel_test للتجريبي).');
        if (store.name === 'file') {
            console.warn('⚠️ تخزين بالملفات — على منصة ذات قرص مؤقت تُمسح الحجوزات مع كل إعادة نشر. اضبط DATABASE_URL للإنتاج.');
        }
    });

    // 👁️ مراقب الأسعار: يعمل فقط أثناء يقظة الخدمة (لا setInterval يبقيها
    // مستيقظة عمداً) — على خطة استضافة مجانية تنام الخدمة بلا زيارات
    // فيتوقف الفحص حتى يوقظها أول طلب، وهذا حد منصة معروف لا خلل.
    async function runPriceWatchCheck() {
        try {
            const { checked, notified, errors } = await checkWatches({ store, provider, markupPct });
            if (checked > 0) {
                console.log(`👁️ فحص مراقبات الأسعار: ${checked} فُحصت، ${notified} إشعار أُرسل${errors.length ? `، ${errors.length} أخطاء` : ''}.`);
            }
        } catch (e) {
            console.error('⚠️ فشل فحص مراقبات الأسعار:', e.message);
        }
    }
    runPriceWatchCheck();
    setInterval(runPriceWatchCheck, 6 * 60 * 60 * 1000); // كل 6 ساعات
}
