/**
 * ✈️ Jatrava — بوابة السفر (المرحلة ١: طيران + ايجنت حاجز)
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
import { readMarkupPct, readPackageMarkupPct, readCategoryMarkupPct, applyMarkup } from './src/pricing.js';
import { quotePackage, bookPackage, cancelPackage, retryPackageCompensations } from './src/packages.js';
import {
    normalizeFixedPackage, priceFixedPackage, publicFixedPackage,
    bookFixedPackage, cancelFixedPackageBooking, seatsLeft as fixedSeatsLeft,
    SEAT_SOURCING,
} from './src/fixedPackages.js';
import { submitReview, publicReview, aggregateRating } from './src/reviews.js';
import { sendBalanceReminders } from './src/balanceReminders.js';
import { fxRate, DISPLAY_CURRENCIES } from './src/fx.js';
import { computeLoyalty } from './src/loyalty.js';
import { createStripeClient, verifyStripeWebhookSignature } from './src/payments/stripeClient.js';
import { normalizeContract } from './src/contracts.js';
import { createContractedStaysProvider, withContractedStays } from './src/providers/contractedStaysProvider.js';
import { createBooking, getBooking, getBookingByProviderOrderId, listBookingsByUser, transitionBooking } from './src/bookings.js';
import { buildStore } from './src/store/index.js';
import { buildProvider, buildStaysProvider, buildCarsProvider } from './src/providers/index.js';
import { buildTravelAgent } from './src/agent/agent.js';
import {
    buildInsight, buildStayInsight, buildCarInsight, buildPackageInsight,
    renderInsight, sanitizeFindings,
} from './src/agent/insights.js';
import {
    createNotifier, renderAirlineChangeNotice, normalizeNotificationPrefs,
    defaultNotificationPrefs, NOTIFICATION_CATEGORIES,
} from './src/notifications.js';
import {
    defaultProfile, mergeProfile, normalizeTraveller, buildAgentMemory,
    trimConversation, MAX_TRAVELLERS,
} from './src/profile.js';
import { airportCoords, searchAirports, airportForTimezone } from './src/airports.js';
import { validateChildrenDobs, checkPassengerAges } from './src/passengerAges.js';
import { createPriceWatch, listPriceWatchesByUser, cancelPriceWatch } from './src/priceWatches.js';
import { checkWatches } from './src/priceWatchPoller.js';
import { sendTripReminders } from './src/tripReminders.js';
import { getDestinationWeather, convertCurrency, MAX_FORECAST_DAYS_AHEAD } from './src/travelInfo.js';
import { buildTopDestinations, CURATED_DESTINATIONS } from './src/topDestinations.js';
import { sendMail, mailReady } from './src/mailer.js';
import { sendWhatsAppTemplate, whatsappReady, isWhatsAppPhone } from './src/whatsapp.js';
import { deriveShareSecret, signShareToken, verifyShareToken, clampShareHours } from './src/shareLinks.js';
import { newCalendarKey, encodeFeedToken, parseFeedToken, calendarKeyMatches, bookingIcs, buildFeedIcs } from './src/calendarFeed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CABINS = ['economy', 'premium_economy', 'business', 'first'];
const SORTS = ['price', 'duration']; // الأرخص | الأسرع
const MAX_ADULTS = 9;
const MAX_CHILDREN = 8;
const MAX_ROOMS = 5;
const MAX_STAY_NIGHTS = 30;
const MAX_RENTAL_DAYS = 30;
const MAX_BOOKING_WINDOW_DAYS = 330; // أقصى ما تفتحه أنظمة الحجز عادةً
const MAX_NOTIFICATIONS = 50; // صندوق يُقرأ لا أرشيف يُنقَّب
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
/**
 * مقارنة سرّ بزمن ثابت. `timingSafeEqual` ترمي عند اختلاف الطول، فيُوازَن
 * الطرفان بالتجزئة أولاً — بلا هذا يتسرّب طول السرّ من فرق التوقيت.
 */
export function secretMatches(provided, expected) {
    if (!provided || !expected) return false;
    const a = crypto.createHash('sha256').update(String(provided)).digest();
    const b = crypto.createHash('sha256').update(String(expected)).digest();
    return crypto.timingSafeEqual(a, b);
}

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
    if (!Number.isInteger(adults) || adults < 1 || adults > MAX_ADULTS) {
        return { error: `عدد البالغين بين 1 و${MAX_ADULTS}.` };
    }
    // الأطفال بتواريخ ميلادهم لا بعددهم: العدد وحده يُجبر المزوّد على
    // تخمين عمر، والتخمين يناقض تاريخ الميلاد وقت الحجز. راجع
    // passengerAges.js — العطب الذي وُلد منه هذا التغيير موثّق هناك.
    //
    // ورفض `children` القديم صراحةً لا تجاهله: عميل لم يُحدَّث (صفحة
    // مخبوءة، أو ايجنت بمخطط أدوات قديم) يرسل children:2 فيبحث بلا
    // أطفال أصلاً — نفس الخطأ الصامت في التسعير من باب آخر. الفشل
    // المعلن أرخص.
    if (body?.children != null) {
        return { error: 'أرسل childrenDobs (تواريخ ميلاد الأطفال) بدل children — سعر تذكرة الطفل يتبع عمره يوم السفر.' };
    }
    const childrenCheck = validateChildrenDobs(body?.childrenDobs, departDate, MAX_CHILDREN);
    if (childrenCheck.error) return { error: childrenCheck.error };
    const childrenDobs = childrenCheck.values;
    const cabin = body?.cabin ? String(body.cabin) : 'economy';
    if (!CABINS.includes(cabin)) {
        return { error: `درجة غير معروفة (المتاح: ${CABINS.join('، ')}).` };
    }
    const sort = body?.sort ? String(body.sort) : 'price';
    if (!SORTS.includes(sort)) {
        return { error: `ترتيب غير معروف (المتاح: ${SORTS.join('، ')}).` };
    }
    // 🔍 فلاتر اختيارية (فجوة أمام OTAs الكبرى) — تُطبَّق داخل المزوّد
    // **قبل** اقتطاع أفضل النتائج (نفس درس الترتيب الموثق: فلترة العشرة
    // المقتطعة تُخفي رحلات مباشرة موجودة خارج العشرة الأرخص).
    let maxStops = null;
    if (body?.maxStops != null && body.maxStops !== '') {
        maxStops = Number(body.maxStops);
        if (!Number.isInteger(maxStops) || maxStops < 0 || maxStops > 3) {
            return { error: 'حد التوقفات عدد صحيح بين 0 (مباشر) و3.' };
        }
    }
    let airline = null;
    if (body?.airline != null && body.airline !== '') {
        airline = String(body.airline).trim().slice(0, 60);
        if (!airline) airline = null;
    }
    let maxPrice = null;
    if (body?.maxPrice != null && body.maxPrice !== '') {
        maxPrice = Number(body.maxPrice);
        if (!Number.isFinite(maxPrice) || maxPrice <= 0) {
            return { error: 'سقف السعر رقم موجب.' };
        }
    }
    return { values: { origin, destination, departDate, returnDate, adults, childrenDobs, cabin, sort, maxStops, airline, maxPrice } };
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
/**
 * أعمار الركاب تصل الواجهة، ومعرّفات المزوّد لا.
 * الواجهة تحتاج أن تعرف أيّ مقعد لطفل لتملأ تاريخ ميلاده وتقفله (فلا
 * يناقض ما سُعِّر به العرض) — والمعرّف الداخلي لا شأن لها به، كحال
 * passengerIds تماماً.
 */
function publicPassengers(passengers) {
    if (!Array.isArray(passengers)) return undefined;
    return passengers.map(p => ({ type: p.type ?? null, age: p.age ?? null }));
}

/**
 * الهامش الفعلي لعرض بعينه: عقد فندقي بهامش خاص (`offer.marginPct`)
 * يتقدّم على هامش فئته العام — امتداد المستوى الثاني من التحكّم
 * (لكل عقد على حدة) فوق المستوى الأول (لكل فئة منتج). `null` يعني لم
 * يُخصَّص شيء فيسقط على `categoryPct` كأي عرض آخر من نفس الفئة.
 */
function effectiveMarkupPct(offer, categoryPct) {
    return offer.marginPct != null ? offer.marginPct : categoryPct;
}

function publicOffer(offer, categoryPct) {
    const { netAmount, passengerIds, passengers, marginPct: _mp, ...rest } = offer;
    const pub = { ...rest, sellAmount: applyMarkup(netAmount, effectiveMarkupPct(offer, categoryPct)) };
    const safe = publicPassengers(passengers);
    if (safe) pub.passengers = safe;
    return pub;
}

function publicBooking(b) {
    return {
        id: b.id, at: b.at, updatedAt: b.updatedAt, status: b.status, kind: b.kind || 'flight',
        bookingReference: b.bookingReference,
        sellAmount: b.sellAmount, currency: b.currency,
        offer: b.offer, passengers: b.passengers, contact: b.contact,
        error: b.error, refund: b.refund,
        // 🎫 أرقام التذاكر الإلكترونية ووقت الدفع — تفاصيل يسأل عنها المسافر
        // فعلاً («متى تأكد؟ وأين تذكرتي؟»)، وليست أسراراً كالصافي.
        tickets: b.tickets, paidAt: b.paidAt,
        // 💱 ما حُصِّل فعلاً حين تختلف عملة التحصيل عن عملة البيع — يُعرض
        // للمسافر بسعره ومصدره، فلا يفاجئه رقمٌ آخر في كشف بطاقته
        billing: b.billing || null,
        packageId: b.packageId || null, // الواجهة تجمع أبناء الباقة تحت أبيهم
        // حقول الباقات المجدولة — undefined لغيرها فلا تظهر في JSON أصلاً
        paymentPlan: b.paymentPlan,
        seats: b.seats,
        namesDeadline: b.namesDeadline,
    };
}

/**
 * 🔗 نسخة الحجز التي يراها **حاملُ رابط المشاركة** — أضيقُ من publicBooking.
 *
 * الوعد المكتوب في الواجهة منذ زرّ المشاركة النصّية: «تُشارَك خطة الرحلة
 * والمرجع فقط — بلا بريدك ولا هاتفك ولا أرقام تذاكرك». الرابط قناةٌ ثانية
 * لنفس الوعد، فيلتزم به حرفياً: لا contact ولا tickets ولا أسماء ركّاب
 * (عددهم يكفي لفهم القسيمة)، ولا billing — كشفُ بطاقة صاحبها لا يخصّ من
 * أُرسل له الرابط. والصافي لا يقترب من هنا أصلاً كعادة كل مسار عام.
 */
function sharedBooking(b) {
    return {
        id: b.id, at: b.at, status: b.status, kind: b.kind || 'flight',
        bookingReference: b.bookingReference,
        sellAmount: b.sellAmount, currency: b.currency,
        offer: b.offer,
        passengerCount: Array.isArray(b.passengers) ? b.passengers.length : null,
        seats: b.seats,
    };
}

/** سطر ملخّص نصّي لحجز (بريد التأكيد/الإلغاء) — نفس منطق bookingBodyHtml في الواجهة. */
function bookingSummaryLine(b) {
    if (b.kind === 'fixed_package') {
        return `🎒 باقة مجدولة: ${b.offer?.title || '؟'} — 🏨 ${b.offer?.hotelName || 'فندق'} — انطلاق ${b.offer?.departDate || '؟'} (${b.seats || '؟'} مقاعد)`;
    }
    if (b.kind === 'package') {
        const outbound = b.offer?.flight?.slices?.[0] || {};
        return `🎁 باقة: ✈️ ${outbound.origin || '؟'}⇄${outbound.destination || '؟'} + 🏨 ${b.offer?.stay?.name || 'فندق'}`;
    }
    if (b.kind === 'stay') {
        return `🏨 ${b.offer?.name || 'فندق'} — ${b.offer?.city || ''} — ${b.offer?.checkInDate || ''} → ${b.offer?.checkOutDate || ''}`;
    }
    if (b.kind === 'car') {
        return `🚗 ${b.offer?.vehicleName || 'سيارة'} — ${b.offer?.supplier || ''} — ${b.offer?.pickupLocation || ''}`;
    }
    // ⚠️ الوجهة من شريحة الذهاب لا من آخر شريحة: في رحلة ذهاب وعودة تكون
    // آخر شريحة عائدة إلى مطار الانطلاق، فكان السطر يقرأ «AMS→AMS»
    // ويُخفي الوجهة الحقيقية كلياً — عيبٌ ظهر في تنبيه إلغاء حقيقي.
    const slices = b.offer?.slices || [];
    const outbound = slices[0] || {};
    const arrow = slices.length > 1 ? '⇄' : '→'; // ⇄ يقول «ذهاب وعودة» بلا كلمة
    return `✈️ ${outbound.origin || '؟'}${arrow}${outbound.destination || '؟'} — ${(outbound.departAt || '').slice(0, 16).replace('T', ' ')}`;
}

export function createApp({
    store,
    jwtSecret,
    provider,
    staysProvider = null,
    carsProvider = null,
    agent = null,
    markupPct = readMarkupPct(),  // الافتراض العام: تسقط عليه كل فئة لم تُخصَّص لها قيمة
    flightMarkupPct = null,       // يُشتق من markupPct إن لم يُمرَّر (TRAVEL_MARKUP_PCT_FLIGHT)
    stayMarkupPct = null,         // كذلك (TRAVEL_MARKUP_PCT_STAY) — وفندق التعاقد يتقدّم عليه بهامشه الخاص إن وُجد
    carMarkupPct = null,          // كذلك (TRAVEL_MARKUP_PCT_CAR)
    packageMarkupPct = null,      // يُشتق من markupPct إن لم يُمرَّر — محروس أدنى منه
    adminUsers = [],              // أسماء مستخدمي الأدمن (من TRAVEL_ADMIN_USERS)
    travelInfoFetch = fetch, // قابل للحقن في الاختبارات (طقس/عملة بلا شبكة حقيقية)
    mailer = { sendMail, mailReady }, // قابل للحقن في الاختبارات (نفس نمط priceWatchPoller.js)
    whatsapp = { sendWhatsAppTemplate, whatsappReady }, // نفس العقد بالضبط — قناة لا تعرفها deliver عن أختها
    duffelWebhookSecret = null, // بلا هذا: مسار الـwebhook يرد 503 بوضوح
    cronSecret = null,          // وبلا هذا: مسار المُطلِق الزمني يرد 503
    // 💳 الدفع الإلكتروني (Stripe Checkout) — كله اختياري: بلا عميل تبقى
    // الباقات المجدولة على سلوكها السابق (إصدار فوري ودفع خارج المنصة)
    stripeClient = null,          // من STRIPE_SECRET_KEY (قابل للحقن في الاختبارات)
    stripeWebhookSecret = null,   // من STRIPE_WEBHOOK_SECRET — بلا هذا يرد المسار 503
    publicUrl = null,             // من TRAVEL_PUBLIC_URL — روابط العودة من صفحة الدفع
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

    // 🎚️ المستوى الأول: هامش كل فئة منتج على حدة — قبل هذا كانت applyMarkup
    // تُنادى بنفس markupPct للطيران والفندق والسيارة حرفياً في كل مسار
    // (تحقّق: كل نداء applyMarkup في هذا الملف). بلا أي متغيّر بيئة جديد
    // تتساوى الثلاثة بـmarkupPct كما كانت — توافق خلفي كامل.
    const flightMkt = flightMarkupPct != null ? flightMarkupPct : readCategoryMarkupPct('flight', process.env, markupPct);
    const stayMkt = stayMarkupPct != null ? stayMarkupPct : readCategoryMarkupPct('stay', process.env, markupPct);
    const carMkt = carMarkupPct != null ? carMarkupPct : readCategoryMarkupPct('car', process.env, markupPct);

    // هامش الباقة النهائي — محروس أن يبقى أدنى من **الأضيق** بين هامشَي
    // مكوّنَيها (لا الهامش العام وحده): فبعد فصل الفئات لم يعد هناك رقم
    // واحد يمثّل «الهامش العادي»، والضمان يجب أن يصمد أمام كليهما معاً.
    const pkgCeiling = Math.min(flightMkt, stayMkt);
    const pkgMarkupPct = packageMarkupPct != null && packageMarkupPct < pkgCeiling
        ? packageMarkupPct
        : readPackageMarkupPct(process.env, pkgCeiling);

    // مزوّد الفنادق المُركَّب: عقودنا المباشرة أولاً ثم المزوّد العام —
    // التوجيه ببادئة المعرّف، وفشل جانبٍ لا يُسقط الآخر.
    const staysBase = staysProvider;
    if (staysBase) {
        staysProvider = withContractedStays(staysBase, createContractedStaysProvider({ store }));
    }

    // الأدمن: قائمة أسماء صريحة من البيئة — ومسار أدمن لغير المخوَّل 404
    // لا 403 (نفس فلسفة عزل الملكية: لا نؤكد وجود ما لا يخصّك)
    const adminSet = new Set((adminUsers || []).map(u => String(u).trim().toLowerCase()).filter(Boolean));
    const isAdmin = req => adminSet.has(userOf(req));
    const requireAdmin = (req, res, next) => {
        if (!isAdmin(req)) return res.status(404).json({ error: 'غير موجود.' });
        next();
    };

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

    // 🔗 سرّ توقيع روابط المشاركة — مشتقّ من jwtSecret بفصلٍ نطاقي، فلا
    // متغيّر بيئة جديد ولا يصلح توكن مشاركةٍ توكنَ دخول (انظر shareLinks.js).
    const shareSecretKey = deriveShareSecret(jwtSecret);
    // المسار العام الوحيد بلا verifyToken: المفتاح IP إجباراً، والحدّ ضيق
    // لأن كل طلب فاشل هنا محاولة تخمين توقيع.
    const shareLimiter = rateLimit({
        windowMs: 5 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false,
        keyGenerator: req => ipKeyGenerator(req.ip),
    });
    // تطبيقات التقويم تُحدِّث دورياً وبلا توكن — حدٌّ أوسع، وموجود.
    const calendarLimiter = rateLimit({
        windowMs: 5 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
        keyGenerator: req => ipKeyGenerator(req.ip),
    });

    // كل تنبيه في البوابة يمر من هنا: يفحص تفضيلات المستخدم، يحفظ سجلاً
    // داخل البوابة، ويرسل بريداً إن رغب. قبل هذا كان كل مصدر يرسل بريده
    // بنفسه — بلا سجل يراه المستخدم ولا خيار يوقفه.
    // ⚠️ صياغة الايجنت تُمرَّر للتنبيهات الحدثية فقط (تغيير طيران، انخفاض
    // سعر). تأكيد الحجز وإلغاؤه يبقيان بالنص الحتمي حرفياً: إيصالٌ بمبلغ
    // ومرجع لا يُعاد صوغه بنموذج لغوي.
    const notifier = createNotifier({ store, mailer, whatsapp });
    const eventNotifier = createNotifier({
        store, mailer, whatsapp,
        phrase: agent ? text => agent.phraseNotice(text) : null,
    });

    async function notifyBookingIssued(booking) {
        await notifier.deliver({
            username: booking?.username,
            category: 'booking_issued',
            title: `✅ تأكيد حجزك — مرجع ${booking.bookingReference}`,
            body: `تم تأكيد حجزك بنجاح.\n\n${bookingSummaryLine(booking)}\nالمرجع: ${booking.bookingReference}\nالإجمالي: ${booking.sellAmount} ${booking.currency}\n\nراجع كل حجوزاتك من بوابة السفر.`,
            email: booking?.contact?.email || null,
            // متغيّرات القالب بترتيبها المعتمَد {{1}}{{2}}{{3}} — تُغيَّر
            // بتغيير القالب لدى Meta معاً، لا هنا وحدها.
            whatsappParams: [
                bookingSummaryLine(booking),
                booking.bookingReference || '—',
                `${booking.sellAmount} ${booking.currency}`,
            ],
            meta: { bookingId: booking.id },
        });
    }
    async function notifyBookingCancelled(booking) {
        const refundLine = booking.refund?.amount != null
            ? `مبلغ الاسترداد: ${booking.refund.amount} ${booking.refund.currency || ''}`
            : 'سيُحدَّد مبلغ الاسترداد قريباً من المزوّد.';
        await notifier.deliver({
            username: booking?.username,
            category: 'booking_cancelled',
            title: `↩️ تم إلغاء حجزك — مرجع ${booking.bookingReference}`,
            body: `تم إلغاء حجزك.\n\n${bookingSummaryLine(booking)}\nالمرجع: ${booking.bookingReference}\n${refundLine}`,
            email: booking?.contact?.email || null,
            whatsappParams: [bookingSummaryLine(booking), booking.bookingReference || '—', refundLine],
            meta: { bookingId: booking.id },
        });
    }

    /**
     * تعويض باقة عالق (فشل إلغاء الفندق بعد فشل الطيران): تنبيه فوري لكل
     * أدمن — فالغرفة مُصدَرة على مالنا حتى يُحلّ. المُطلِق الزمني يعيد
     * المحاولة تلقائياً، لكن الأدمن يجب أن يعلم لا أن يكتشف في التقارير.
     */
    async function notifyCompensationStuck(parent, stayChild) {
        for (const admin of adminSet) {
            await notifier.deliver({
                username: admin,
                category: 'admin_alert',
                title: `🧯 تعويض باقة عالق — ${parent.id}`,
                body: `فشل الطيران في باقة ${parent.id} وفشل إلغاء الفندق (${stayChild.bookingReference || stayChild.id}) بعده.\nالمُطلِق الزمني سيعيد المحاولة كل ساعة، ويمكنك «إعادة التعويضات الآن» من صفحة الإدارة.`,
                meta: { bookingId: parent.id, stayChildId: stayChild.id },
            });
        }
    }

    /**
     * شركة الطيران غيّرت رحلة مُصدَرة (webhook من Duffel، لا مبادرة منّا).
     *
     * الجديد هنا ليس البريد بل **أثر التغيير على بقية الخطة**: يُفحص
     * تعارضُ الحجوزات فعلياً (نفس دالة check_trip_conflicts التي يناديها
     * الايجنت) فيعرف المسافر أن تأخّر وصوله يصطدم بحجز فندقه — بدل خبرٍ
     * مجرّد يتركه يكتشف ذلك بنفسه.
     */
    async function notifyAirlineChange(booking) {
        let warnings = [];
        try {
            // ترجع مصفوفة تحذيرات مباشرةً لا كائناً يلفّها
            warnings = await doCheckTripConflicts(booking.username);
        } catch (e) {
            // فحص التعارض إثراء لا شرط — فشله لا يمنع التنبيه بالتغيير
            console.error('⚠️ تعذّر فحص تعارض الرحلة عند تغيير الطيران:', e.message);
        }
        await eventNotifier.deliver({
            username: booking?.username,
            category: 'airline_change',
            title: `⚠️ تغيير من شركة الطيران على حجزك — مرجع ${booking.bookingReference}`,
            body: renderAirlineChangeNotice({
                summaryLine: bookingSummaryLine(booking),
                bookingReference: booking.bookingReference,
                warnings,
            }),
            email: booking?.contact?.email || null,
            // النص المُرسَل هنا يمرّ على النموذج لإعادة الصياغة — ومتغيّرات
            // واتساب لا تمرّ عليه: القالب المعتمَد نصّه ثابت.
            whatsappParams: [
                bookingSummaryLine(booking),
                booking.bookingReference || '—',
                warnings.length > 0 ? `وهذا يصطدم بـ${warnings.length} من حجوزاتك — راجع البوابة.` : 'لا تعارض مع بقية حجوزاتك.',
            ],
            meta: { bookingId: booking.id, conflicts: warnings.length },
        });
    }

    // ─── منطق الخدمة المشترك: المسارات والايجنت يستهلكان نفس الدوال ───
    // (هذا ما يجعل الايجنت "بلا التفاف": أي حارس هنا يسري عليه حتماً)

    async function doSearch(params) {
        const check = validateSearchParams(params);
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });
        try {
            // سقف السعر يصل من المستخدم بسعر **البيع** — المزوّد يفلتر
            // بالصافي (لا يعرف الهامش ولا يجب): التحويل هنا، والهامش
            // رتيب فالتكافؤ محفوظ.
            const { maxPrice, ...vals } = check.values;
            // ⚠️ عطب حقيقي أصلحه هذا السطر: القسمة العكسية المباشرة
            // (maxPrice / 1.08) تُنزل السقف تحت صافي أرخص عرضٍ بأجزاءِ
            // سنتٍ عائمة، فمن يضع سقفاً **يساوي أرخص سعر معروض** لا يرى
            // شيئاً. applyMarkup يحسب بالسنتات ويقرّب لأعلى، فالعكس يجب
            // أن يحسب بالسنتات ويقرّب لأسفل — عندها يتكافأ الطرفان تماماً.
            if (maxPrice != null) {
                vals.maxNetAmount = Math.floor(Math.round(maxPrice * 100) / (1 + flightMkt / 100) + 1e-6) / 100;
            }
            const offers = await provider.searchOffers(vals);
            return offers.map(o => publicOffer(o, flightMkt));
        } catch (e) {
            // بلا هذا: رفض المزوّد (403 Duffel، خطأ LiteAPI...) يسقط كخطأ
            // 500 عام مبهم — التفصيل الفعلي يضيع رغم وجوده (راجع تعليق
            // duffelProvider.js: "أي رفض يظهر بتفصيل رد Duffel لا فشلاً صامتاً").
            throw Object.assign(new Error(`تعذّر البحث: ${e.message}`), { status: 502 });
        }
    }

    async function doGetOffer(offerId) {
        const offer = await provider.getOffer(String(offerId || ''));
        return offer ? publicOffer(offer, flightMkt) : null;
    }

    async function doBook(username, { offerId, passengers, contact }, baseUrl = null) {
        const offer = await provider.getOffer(String(offerId || ''));
        if (!offer) throw Object.assign(new Error('العرض غير موجود أو انتهت صلاحيته — أعد البحث.'), { status: 404 });
        const check = validatePassengers({ passengers, contact }, offer.passengerCount);
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });

        // شبكة أخيرة قبل المزوّد: تاريخ ميلاد يناقض العمر الذي سُعِّر به
        // العرض كان يصل إلى Duffel فيعود 422 بالإنجليزية إلى وجه المسافر.
        // الآن يُوقَف هنا برسالة عربية تقول ما العمل — ولا يُنشأ حجز
        // pending لطلبٍ نعرف سلفاً أنه سيُرفض.
        const ageError = checkPassengerAges({
            passengers: check.values.passengers,
            offerPassengers: offer.passengers,
            departAt: offer.slices?.[0]?.departAt,
        });
        if (ageError) throw Object.assign(new Error(ageError), { status: 400 });

        const sellAmount = applyMarkup(offer.netAmount, flightMkt);
        // ملخص العرض المخزَّن على الحجز: بلا صافٍ ولا معرّفات مزوّد داخلية
        const { netAmount: _net, passengerIds: _ids, passengers: _pax, ...offerSummary } = offer;
        const booking = await createBooking(store, {
            username, provider: provider.name,
            offer: offerSummary,
            passengers: check.values.passengers,
            contact: check.values.contact,
            netAmount: offer.netAmount, sellAmount, currency: offer.currency,
        });
        // 💳 الدفع قبل الإصدار — لا نلمس المزوّد قبل وصول المال (انظر
        // startBookingCheckout: تذكرة تُصدر بلا مقابل خسارة نقدية فورية)
        if (stripeClient) {
            return startBookingCheckout({
                booking, baseUrl,
                title: `${offer.slices?.[0]?.origin || ''}→${offer.slices?.[0]?.destination || ''} · ${offer.owner || 'رحلة'}`,
            });
        }
        try {
            const order = await provider.createOrder({
                offerId: offer.id,
                passengers: check.values.passengers,
                contact: check.values.contact,
            });
            const issued = await transitionBooking(store, booking.id, 'issued', {
                providerOrderId: order.orderId,
                bookingReference: order.bookingReference,
                tickets: order.tickets || [],
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
        // 💳 ما دفعه المسافر إلينا يُرد منّا — رد المزوّد يحدد القدر لا الوجهة
        const stripeRefund = await refundCancelledBooking(booking, { amount: result.refundAmount });
        const cancelled = await transitionBooking(store, booking.id, 'cancelled', {
            refund: { amount: result.refundAmount ?? null, currency: result.currency ?? null, ...(stripeRefund || {}) },
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
            return offers.map(o => publicOffer(o, stayMkt));
        } catch (e) {
            throw Object.assign(new Error(`تعذّر بحث الفنادق: ${e.message}`), { status: 502 });
        }
    }

    async function doGetStayOffer(offerId) {
        requireStays();
        const offer = await staysProvider.getStayOffer(String(offerId || ''));
        return offer ? publicOffer(offer, stayMkt) : null;
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
            if (e.status) throw e; // 501 من غلاف العقود حين لا يدعمها الأساسي
            throw Object.assign(new Error(`تعذّر جلب تفاصيل الفندق: ${e.message}`), { status: 502 });
        }
    }

    async function doBookStay(username, { offerId, guests, contact }, baseUrl = null) {
        requireStays();
        // offerId هنا quote id (من get_stay_offer السابقة) — getQuote يجلبه
        // كما هو دون إنشاء quote جديد؛ getStayOffer كانت لتنشئ quote ثانياً
        // من نفس المعرّف بوصفه rate_id خطأً، فيفشل الحجز ضد Duffel الحقيقي.
        const offer = await staysProvider.getQuote(String(offerId || ''));
        if (!offer) throw Object.assign(new Error('عرض الفندق غير موجود أو انتهت صلاحيته — أعد البحث.'), { status: 404 });
        const check = validateGuests({ guests, contact });
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });

        // فندق التعاقد يتقدّم بهامشه الخاص إن ضبطه المالك — نفس منطق
        // publicOffer، مكرَّر هنا لأن الحجز لا يمرّ عبرها (نداء مباشر لـ
        // applyMarkup لا عبر عرض بحث مُطبَّع).
        const sellAmount = applyMarkup(offer.netAmount, effectiveMarkupPct(offer, stayMkt));
        const { netAmount: _net, marginPct: _mp, ...offerSummary } = offer;
        const booking = await createBooking(store, {
            username, provider: staysProvider.name, kind: 'stay',
            offer: offerSummary,
            passengers: check.values.guests,
            contact: check.values.contact,
            netAmount: offer.netAmount, sellAmount, currency: offer.currency,
        });
        if (stripeClient) {
            return startBookingCheckout({
                booking, baseUrl,
                title: `${offer.name || 'فندق'} · ${offer.checkIn || ''}→${offer.checkOut || ''}`,
            });
        }
        try {
            const order = await staysProvider.createStayOrder({
                offerId: offer.id,
                guests: check.values.guests,
                contact: check.values.contact,
            });
            const issued = await transitionBooking(store, booking.id, 'issued', {
                providerOrderId: order.orderId,
                bookingReference: order.bookingReference,
                tickets: order.tickets || [],
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
        const stripeRefund = await refundCancelledBooking(booking, { amount: result.refundAmount });
        const cancelled = await transitionBooking(store, booking.id, 'cancelled', {
            refund: { amount: result.refundAmount ?? null, currency: result.currency ?? null, ...(stripeRefund || {}) },
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
            return offers.map(o => publicOffer(o, carMkt));
        } catch (e) {
            throw Object.assign(new Error(`تعذّر بحث السيارات: ${e.message}`), { status: 502 });
        }
    }

    async function doGetCarOffer(offerId) {
        requireCars();
        const offer = await carsProvider.getCarOffer(String(offerId || ''));
        return offer ? publicOffer(offer, carMkt) : null;
    }

    async function doBookCar(username, { offerId, drivers, contact }, baseUrl = null) {
        requireCars();
        // نفس تفرقة rate/quote لدى الفنادق: offerId هنا quote id — getQuote
        // يجلبه كما هو دون إنشاء quote جديد.
        const offer = await carsProvider.getQuote(String(offerId || ''));
        if (!offer) throw Object.assign(new Error('عرض السيارة غير موجود أو انتهت صلاحيته — أعد البحث.'), { status: 404 });
        const check = validateDrivers({ drivers, contact });
        if (check.error) throw Object.assign(new Error(check.error), { status: 400 });

        const sellAmount = applyMarkup(offer.netAmount, carMkt);
        const { netAmount: _net, ...offerSummary } = offer;
        const booking = await createBooking(store, {
            username, provider: carsProvider.name, kind: 'car',
            offer: offerSummary,
            passengers: check.values.drivers,
            contact: check.values.contact,
            netAmount: offer.netAmount, sellAmount, currency: offer.currency,
        });
        if (stripeClient) {
            return startBookingCheckout({
                booking, baseUrl,
                title: `${offer.vehicleName || 'سيارة'} · ${offer.pickUpAt || ''}`,
            });
        }
        try {
            const order = await carsProvider.createCarOrder({
                offerId: offer.id,
                drivers: check.values.drivers,
                contact: check.values.contact,
            });
            const issued = await transitionBooking(store, booking.id, 'issued', {
                providerOrderId: order.orderId,
                bookingReference: order.bookingReference,
                tickets: order.tickets || [],
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
        const stripeRefund = await refundCancelledBooking(booking, { amount: result.refundAmount });
        const cancelled = await transitionBooking(store, booking.id, 'cancelled', {
            refund: { amount: result.refundAmount ?? null, currency: result.currency ?? null, ...(stripeRefund || {}) },
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

    // 📅 كاش أرخص سعر لليوم (مسار، تاريخ، درجة) — تقويم الأسعار يطلب
    // نفس الأيام تكراراً من مستخدمين مختلفين، وكل يوم نداء مزوّد فعلي.
    // 6 ساعات = نفس فاصل topDestinations/priceWatchPoller (تناسق منطقي).
    // النجاح فقط يُكيَّش — فشلُ لحظةٍ لا يُخلَّد 6 ساعات.
    const FLEX_PRICE_TTL_MS = 6 * 60 * 60 * 1000;
    const flexPriceCache = new Map();

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
                const cacheKey = `${originU}_${destU}_${date}_${cab}`;
                const cached = flexPriceCache.get(cacheKey);
                if (cached && Date.now() - cached.at < FLEX_PRICE_TTL_MS) {
                    return { date, price: cached.price, currency: cached.currency, cached: true };
                }
                try {
                    const offers = await provider.searchOffers({ origin: originU, destination: destU, departDate: date, adults: 1, childrenDobs: [], cabin: cab });
                    if (offers.length === 0) return { date, price: null, currency: null };
                    const cheapestNet = Math.min(...offers.map(o => o.netAmount));
                    const row = { price: applyMarkup(cheapestNet, flightMkt), currency: offers[0].currency, at: Date.now() };
                    flexPriceCache.set(cacheKey, row);
                    return { date, price: row.price, currency: row.currency };
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
        res.json({ ok: true, service: 'jatrava', provider: provider.name });
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
            packagesEnabled: !!staysProvider, // الباقة = طيران + فندق؛ الطيران موجود دوماً
            paymentsEnabled: !!stripeClient, // 💳 حجز الباقات المجدولة يتحول لدفع فعلي
            isAdmin: isAdmin(req), // رابط ⚙️ الإدارة يظهر لأصحابه فقط
        });
    }));

    // 🌐 لغة واجهة الطالب — هيدر يرسله العميل مع كل نداء. قائمة بيضاء
    // صريحة: أي قيمة غير 'en' تعني العربية، فلا يمرّر هيدرٌ عابث شيئاً
    // إلى قوالب النصوص أو تعليمات النموذج.
    const uiLangOf = req => (req.headers['x-ui-lang'] === 'en' ? 'en' : 'ar');

    app.post('/api/travel/flights/search', verifyToken, searchLimiter, wrap(async (req, res) => {
        try {
            const offers = await doSearch(req.body);
            // قراءة الايجنت تُحسب هنا حتمياً (دوال نقية، بلا شبكة) فلا تضيف
            // زمناً على المسار الأهم في البوابة. صياغة النموذج — إن فُعّل —
            // تأتي بنداء منفصل بعد ظهور النتائج، لا قبلها.
            res.json({ offers, insight: buildInsight(offers, uiLangOf(req)) });
        } catch (e) {
            // كان يفحص 400 فقط — رفض مزوّد فعلي (502 الجديد أعلاه) كان يسقط
            // كخطأ 500 عام رغم تفصيل واضح متوفر، خلاف مساري الفنادق/السيارات.
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    // 📅 تقويم الأسعار: أرخص سعر حقيقي لكل يوم حول تاريخ (ميزة Skyscanner
    // /Google Flights) — كان حكراً على أداة الايجنت find_flexible_dates،
    // الآن للواجهة أيضاً. نفس المنطق حرفياً: حارس checkFlexLimit الأشدّ
    // (نداءات مزوّد متعددة لكل طلب) + كاش الأسعار أعلاه يمتصّ التكرار.
    app.post('/api/travel/flights/calendar', verifyToken, wrap(async (req, res) => {
        try {
            const days = await doFindFlexibleDates(userOf(req), {
                origin: req.body?.origin, destination: req.body?.destination,
                aroundDate: req.body?.aroundDate, windowDays: req.body?.windowDays,
                cabin: req.body?.cabin,
            });
            res.json({ days });
        } catch (e) {
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
            const booking = await doBook(userOf(req), req.body || {}, requestBaseUrl(req));
            // checkoutUrl (إن وُجد) على الجذر أيضاً — نفس عقد مسار الباقات
            res.json({ booking, ...(booking.checkoutUrl ? { checkoutUrl: booking.checkoutUrl } : {}) });
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

    // ─── 🔗 رابط المشاركة المؤقّت ────────────────────────────────────
    // إنشاء الرابط يتطلّب ملكية الحجز؛ فتحُه لا يتطلّب حساباً إطلاقاً —
    // هذا هو بيت القصيد (يُرسَل لمرافقٍ أو لمكتب تأشيرات). انظر
    // src/shareLinks.js لسبب انعدام الحالة ولثمنه المُعلَن (لا إلغاء مبكّر).

    app.post('/api/travel/bookings/:id/share', verifyToken, wrap(async (req, res) => {
        const booking = await getBooking(store, String(req.params.id || ''));
        if (!booking || booking.username !== userOf(req)) {
            return res.status(404).json({ error: 'الحجز غير موجود.' });
        }
        const hours = clampShareHours(req.body?.hours);
        const expiresAt = Date.now() + hours * 60 * 60 * 1000;
        const token = signShareToken({ bookingId: booking.id, expiresAt, secret: shareSecretKey });
        res.json({
            url: `${requestBaseUrl(req)}/share.html#${token}`,
            expiresAt: new Date(expiresAt).toISOString(),
            hours,
        });
    }));

    // مسار عام بلا توكن — محدّد المعدل هنا بالـIP لا بالمستخدم (لا مستخدم
    // أصلاً)، ودرعٌ ضروري: بلا هذا يصير المسار مِقْصَلة تخمينٍ للتواقيع.
    app.get('/api/travel/share/:token', shareLimiter, wrap(async (req, res) => {
        const result = verifyShareToken(req.params.token, { secret: shareSecretKey });
        if (result.error === 'expired') {
            // 410 لا 404: «كان صحيحاً وانتهى» معلومة مفيدة لصاحب الرابط،
            // ولا تكشف شيئاً — التوقيع أثبت أنّا نحن من أصدره.
            return res.status(410).json({ error: 'انتهت صلاحية هذا الرابط. اطلب من صاحب الحجز رابطاً جديداً.' });
        }
        if (result.error) return res.status(404).json({ error: 'رابط غير صالح.' });
        const booking = await getBooking(store, result.bookingId);
        if (!booking) return res.status(404).json({ error: 'رابط غير صالح.' });
        res.json({ booking: sharedBooking(booking), expiresAt: new Date(result.expiresAt).toISOString() });
    }));

    // ─── 📆 التقويم: تنزيل حجزٍ واحد + اشتراك دائم ────────────────────
    // كلا المسارين يبنيان الملفّ من `src/calendarFeed.js` نفسه، فلا
    // يمكن أن يفترق ما يُنزَّل عمّا يُشترَك فيه (انظر تعليق الملف).

    const icsResponse = (res, body, filename) => res
        .type('text/calendar; charset=utf-8')
        .set('Content-Disposition', `attachment; filename="${filename}"`)
        .send(body);

    app.get('/api/travel/bookings/:id/calendar.ics', verifyToken, wrap(async (req, res) => {
        const booking = await getBooking(store, String(req.params.id || ''));
        if (!booking || booking.username !== userOf(req)) {
            return res.status(404).json({ error: 'الحجز غير موجود.' });
        }
        const ics = bookingIcs(booking, { lang: uiLangOf(req) });
        if (!ics) return res.status(400).json({ error: 'لا مواعيد قابلة للإضافة في هذا الحجز.' });
        icsResponse(res, ics, `jatrava-${booking.bookingReference || booking.id}.ics`);
    }));

    /** يضمن وجود مفتاح تقويم للمستخدم — يولّده عند أول اشتراك فقط. */
    async function ensureCalendarKey(username, { rotate = false } = {}) {
        const profile = await loadProfile(username);
        if (profile.calendarKey && !rotate) return profile.calendarKey;
        const calendarKey = newCalendarKey();
        await store.setProfile(username, mergeProfile(profile, { calendarKey }));
        return calendarKey;
    }

    const feedUrls = (req, token) => {
        const base = requestBaseUrl(req);
        // 🌐 اللغة تُخبَز في الرابط لا تُقرأ من ترويسة: تطبيق التقويم يجلب
        // التغذية بنفسه ولا يرسل X-UI-Lang أبداً، فمشتركٌ إنجليزيّ كان
        // يستقبل تقويماً عربياً كل مرة. الاستعلام يبقى في الرابط المحفوظ
        // لدى التطبيق فيصمد عبر كل تحديث. (كشفه فحصٌ بمتصفح حقيقي.)
        const lang = uiLangOf(req) === 'en' ? '?lang=en' : '';
        const httpUrl = `${base}/api/travel/calendar/${token}.ics${lang}`;
        // webcal:// ليس بروتوكولاً حقيقياً بل إشارة للنظام «افتح هذا في
        // التقويم واشترك به» — نفس الرابط بمخطّط مختلف. نعطي الاثنين:
        // الأول للنقر على الهاتف، والثاني للّصق في تقويم سطح المكتب.
        return { webcalUrl: httpUrl.replace(/^https?:/, 'webcal:'), httpUrl };
    };

    app.post('/api/travel/calendar/subscribe', verifyToken, wrap(async (req, res) => {
        const username = userOf(req);
        const key = await ensureCalendarKey(username, { rotate: req.body?.rotate === true });
        res.json(feedUrls(req, encodeFeedToken(username, key)));
    }));

    app.delete('/api/travel/calendar', verifyToken, wrap(async (req, res) => {
        const username = userOf(req);
        const profile = await loadProfile(username);
        await store.setProfile(username, mergeProfile(profile, { calendarKey: null }));
        res.json({ ok: true });
    }));

    // عام بلا توكن دخول — تطبيق التقويم لا يحمل واحداً. محدّد المعدل
    // بالـIP: أجهزة كثيرة قد تُحدِّث من نفس الشبكة، فالحدّ أوسع من رابط
    // المشاركة لكنه موجود.
    app.get('/api/travel/calendar/:token.ics', calendarLimiter, wrap(async (req, res) => {
        const parsed = parseFeedToken(req.params.token);
        if (!parsed) return res.status(404).json({ error: 'رابط تقويم غير صالح.' });
        const profile = await store.getProfile(parsed.username);
        if (!profile?.calendarKey || !calendarKeyMatches(profile.calendarKey, parsed.key)) {
            // 404 واحد لكل الحالات: مفتاح خاطئ، أو مُلغى، أو مستخدم لا
            // وجود له — لا نفرّق فنؤكّد لحاملِ رابطٍ قديم أن الحساب قائم.
            return res.status(404).json({ error: 'رابط تقويم غير صالح.' });
        }
        const bookings = await listBookingsByUser(store, parsed.username, 200);
        // لغة التغذية من الرابط نفسه (انظر feedUrls) — والترويسة احتياطٌ
        // لمن يجلبها من متصفّح.
        const lang = req.query.lang === 'en' ? 'en' : uiLangOf(req);
        icsResponse(res, buildFeedIcs(bookings, { lang }), 'jatrava-trips.ics');
    }));

    // ─── الفنادق (Duffel Stays) — محاذاة مسارات الطيران أعلاه ──────────

    app.post('/api/travel/stays/search', verifyToken, searchLimiter, wrap(async (req, res) => {
        try {
            const offers = await doSearchStays(req.body);
            res.json({ offers, insight: buildStayInsight(offers, uiLangOf(req)) });
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
            const booking = await doBookStay(userOf(req), req.body || {}, requestBaseUrl(req));
            res.json({ booking, ...(booking.checkoutUrl ? { checkoutUrl: booking.checkoutUrl } : {}) });
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
            const offers = await doSearchCars(req.body);
            res.json({ offers, insight: buildCarInsight(offers, uiLangOf(req)) });
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
            const booking = await doBookCar(userOf(req), req.body || {}, requestBaseUrl(req));
            res.json({ booking, ...(booking.checkoutUrl ? { checkoutUrl: booking.checkoutUrl } : {}) });
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

    // ─── 🎁 الباقات (طيران + فندق — خصم حقيقي من التنازل عن جزء من العمولة) ──

    function requirePackages() {
        if (!staysProvider) {
            throw Object.assign(new Error('الباقات تتطلب مزوّد فنادق مُفعّلاً.'), { status: 503 });
        }
    }

    /** التقييم للعميل: أرقام البيع فقط — الصافي وتقسيمه الداخلي لا يغادران الخادم. */
    function publicQuote(q, lang = 'ar') {
        const { netAmount: _nf, passengerIds: _ids, passengers, ...flight } = q.flight;
        const { netAmount: _ns, marginPct: _mp, ...stay } = q.stay;
        return {
            flight: { ...flight, passengers: publicPassengers(passengers) },
            stay,
            sellAmount: q.sellAmount,
            separateTotal: q.separateTotal,
            savings: q.savings,
            savingsPct: q.savingsPct,
            currency: q.currency,
            insight: buildPackageInsight(q, lang),
        };
    }

    app.post('/api/travel/packages/quote', verifyToken, wrap(async (req, res) => {
        requirePackages();
        try {
            const q = await quotePackage({
                provider, staysProvider,
                flightOfferId: req.body?.flightOfferId, stayOfferId: req.body?.stayOfferId,
                flightMarkupPct: flightMkt, stayMarkupPct: stayMkt, packageMarkupPct: pkgMarkupPct,
            });
            res.json({ quote: publicQuote(q, uiLangOf(req)) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.post('/api/travel/packages/bookings', verifyToken, wrap(async (req, res) => {
        requirePackages();
        try {
            const result = await bookPackage({
                store, provider, staysProvider,
                username: userOf(req),
                flightOfferId: req.body?.flightOfferId, stayOfferId: req.body?.stayOfferId,
                passengers: req.body?.passengers, contact: req.body?.contact,
                flightMarkupPct: flightMkt, stayMarkupPct: stayMkt, packageMarkupPct: pkgMarkupPct,
                validatePassengers, validateGuests, checkPassengerAges,
                onCompensationStuck: notifyCompensationStuck,
            });
            await notifyBookingIssued(result.parent);
            res.json({
                booking: publicBooking(result.parent),
                children: [publicBooking(result.stayChild), publicBooking(result.flightChild)],
            });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.post('/api/travel/packages/bookings/:id/cancel', verifyToken, wrap(async (req, res) => {
        requirePackages();
        try {
            const cancelled = await cancelPackage({
                store, provider, staysProvider,
                username: userOf(req), packageId: req.params.id,
            });
            await notifyBookingCancelled(cancelled);
            res.json({ booking: publicBooking(cancelled) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    // ─── 🎒 الباقات المجدولة (مخزون مملوك — تأكيد فوري بلا مزوّد) ──────

    /** تحقق وسيلة التواصل لحجز باقة مجدولة — نفس معايير بقية البوابة. */
    function validateFixedContact(raw) {
        const email = String(raw?.email || '').trim();
        const phone = normalizePhone(raw?.phone);
        if (!email && !phone) return { error: 'وسيلة تواصل مطلوبة: بريد أو هاتف.' };
        if (email && !EMAIL_RE.test(email)) return { error: 'صيغة البريد غير صحيحة.' };
        if (phone && !PHONE_RE.test(phone)) return { error: PHONE_HINT };
        return { value: { email: email || null, phone: phone || null } };
    }

    /**
     * مقاعد تحرّرت (إلغاء حجز أو زيادة سعة من الأدمن) → إبلاغ قائمة
     * الانتظار تلقائياً وتعليم كل مُبلَّغ حتى لا يتكرر إزعاجه. الإشعار
     * إثراء: فشله لا يُفشل العملية الأصلية.
     */
    async function notifyWaitlistSeatsFreed(pkg) {
        try {
            if (!pkg || pkg.active === false || fixedSeatsLeft(pkg) <= 0) return;
            const waiting = await store.listWaitlistByPackage(pkg.id);
            for (const entry of waiting) {
                await notifier.deliver({
                    username: entry.username,
                    category: 'booking_issued',
                    title: `🔔 توفّرت مقاعد — ${pkg.title}`,
                    body: `توفّرت مقاعد في الباقة التي انتظرتها:\n\n🎒 ${pkg.title} — 🏨 ${pkg.hotelName}\nانطلاق ${pkg.departDate} (${pkg.nights} ليالٍ) — المتبقي الآن ${fixedSeatsLeft(pkg)} مقاعد.\n\nسارع بالحجز من بوابة السفر قبل نفادها مجدداً.`,
                    email: entry.email || null,
                    meta: { fixedPackageId: pkg.id },
                });
                await store.updatePackageInterest(entry.id, { status: 'notified' });
            }
        } catch { /* الإشعار إثراء — لا يُفشل الإلغاء/التعديل */ }
    }

    app.get('/api/travel/fixed-packages', verifyToken, wrap(async (req, res) => {
        const today = todayUtc();
        const all = await store.listFixedPackages();
        const username = userOf(req);
        const wishlist = new Set((await store.listWishlistByUser(username)).map(w => w.packageId));
        const upcoming = all.filter(p => p.active !== false && p.departDate > today);
        // ⭐ تقييم كل باقة يُجمع من مراجعاتها الموثقة + ❤️ حالة مفضلة المستخدم
        const packages = [];
        for (const p of upcoming) {
            const reviews = await store.listReviewsByPackage(p.id);
            packages.push({
                ...publicFixedPackage(p),
                ...aggregateRating(reviews),
                wishlisted: wishlist.has(p.id),
            });
        }
        res.json({ packages });
    }));

    // ─── ⭐ مراجعات موثقة: لا يراجع إلا من حجز فعلاً وانطلقت رحلته ──────

    app.get('/api/travel/fixed-packages/:id/reviews', verifyToken, wrap(async (req, res) => {
        const pkg = await store.getFixedPackage(String(req.params.id || ''));
        if (!pkg) return res.status(404).json({ error: 'الباقة غير موجودة.' });
        const reviews = await store.listReviewsByPackage(pkg.id);
        res.json({
            ...aggregateRating(reviews),
            reviews: reviews.map(publicReview),
            myReview: (await store.getReviewByUser(userOf(req), pkg.id)) ? true : false,
        });
    }));

    app.post('/api/travel/fixed-packages/:id/reviews', verifyToken, wrap(async (req, res) => {
        try {
            const saved = await submitReview({
                store, username: userOf(req), packageId: req.params.id,
                review: { rating: req.body?.rating, title: req.body?.title, text: req.body?.text },
            });
            res.json({ review: publicReview(saved), message: '⭐ شكراً — مراجعتك الموثقة نُشرت.' });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    // ─── ❤️ المفضلة ────────────────────────────────────────────────────

    app.put('/api/travel/wishlist/:packageId', verifyToken, wrap(async (req, res) => {
        const pkg = await store.getFixedPackage(String(req.params.packageId || ''));
        if (!pkg || pkg.active === false) return res.status(404).json({ error: 'الباقة غير موجودة.' });
        await store.addWishlist(userOf(req), pkg.id);
        res.json({ wishlisted: true });
    }));

    app.delete('/api/travel/wishlist/:packageId', verifyToken, wrap(async (req, res) => {
        await store.removeWishlist(userOf(req), String(req.params.packageId || ''));
        res.json({ wishlisted: false });
    }));

    app.post('/api/travel/fixed-packages/:id/quote', verifyToken, wrap(async (req, res) => {
        const pkg = await store.getFixedPackage(String(req.params.id || ''));
        if (!pkg || pkg.active === false) return res.status(404).json({ error: 'الباقة غير موجودة.' });
        try {
            const q = priceFixedPackage(pkg, {
                adults: req.body?.adults, singles: req.body?.singles ?? 0,
                children: req.body?.children ?? 0, pay: req.body?.pay || 'deposit',
            });
            // الصافي كلفة داخلية — لا يغادر للجمهور حتى في عرض السعر
            const { netAmount: _net, ...publicQuote } = q;
            res.json({ quote: publicQuote, package: publicFixedPackage(pkg) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    // رابط العودة من صفحة دفع Stripe — TRAVEL_PUBLIC_URL أولاً، وإلا يُشتق
    // من الطلب نفسه (خلف وكيل Render يصل البروتوكول في x-forwarded-proto)
    function requestBaseUrl(req) {
        if (publicUrl) return String(publicUrl).replace(/\/$/, '');
        const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
        return `${proto}://${req.get('host')}`;
    }

    app.post('/api/travel/fixed-packages/:id/bookings', verifyToken, wrap(async (req, res) => {
        const contactCheck = validateFixedContact(req.body?.contact);
        if (contactCheck.error) return res.status(400).json({ error: contactCheck.error });
        try {
            const { booking, quote } = await bookFixedPackage({
                store, packageId: req.params.id, username: userOf(req),
                adults: req.body?.adults, singles: req.body?.singles ?? 0,
                children: req.body?.children ?? 0, pay: req.body?.pay || 'deposit',
                leadName: req.body?.leadName, contact: contactCheck.value,
                deferIssue: !!stripeClient, // مع بوابة دفع: الإصدار بعد الدفع الفعلي
            });
            if (!stripeClient) {
                await notifyBookingIssued(booking);
                return res.json({ booking: publicBooking(booking) });
            }
            // 💳 جلسة دفع للمطلوب الآن (عربون أو كامل) — المقاعد محجوزة للحجز
            // المعلّق، وانتهاء الجلسة (30 دقيقة) يحرّرها عبر webhook/المصالحة
            const base = requestBaseUrl(req);
            const fxBilling = await resolveBilling(quote.paidNow, quote.currency);
            let session;
            try {
                session = await stripeClient.createCheckoutSession({
                    amount: fxBilling?.amount ?? quote.paidNow,
                    currency: fxBilling?.currency ?? quote.currency,
                    title: `${booking.offer?.title || 'باقة مجدولة'} — ${quote.pay === 'deposit' ? `عربون ${quote.depositPct}%` : 'دفع كامل'} (${booking.bookingReference})`,
                    bookingId: booking.id, purpose: 'fixed_booking',
                    customerEmail: contactCheck.value.email,
                    successUrl: `${base}/?payment=success&booking=${booking.id}`,
                    cancelUrl: `${base}/?payment=cancelled&booking=${booking.id}`,
                });
            } catch (e) {
                // فشل إنشاء الجلسة: لا نترك حجزاً معلقاً يحبس مقاعد بلا طريق دفع
                await transitionBooking(store, booking.id, 'failed', { error: `تعذّر فتح صفحة الدفع: ${e.message}` });
                const pkgId = booking.offer?.fixedPackageId;
                if (pkgId && booking.seats > 0) await store.releaseFixedSeats(pkgId, booking.seats).catch(() => {});
                return res.status(502).json({ error: `تعذّر فتح صفحة الدفع: ${e.message}. لم تُحاسَب على شيء.` });
            }
            await store.transitionBooking(booking.id, {
                from: ['pending'], to: 'pending',
                patch: { stripeSessionId: session.id, checkoutExpiresAt: session.expiresAt, billing: fxBilling },
            });
            res.json({ booking: publicBooking(await getBooking(store, booking.id)), checkoutUrl: session.url });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    /**
     * 💳 استئناف دفعٍ لم يكتمل — «كيف أكمل الدفع؟» أول ما يسأله مسافر
     * أغلق صفحة الدفع أو انقطع اتصاله. بلا هذا المسار يبقى حجزه معلّقاً
     * بلا طريق: لا يُصدر ولا يُلغى حتى تنتهي المهلة، فيُعيد الحجز من الصفر.
     *
     * ⚠️ يُعاد استخدام الجلسة المفتوحة إن كانت ما تزال حيّة، ولا تُفتح
     * ثانية أبداً: جلستان مفتوحتان للحجز نفسه تعنيان تحصيلاً مرتين إن
     * أكملهما المسافر — وردّ إحداهما لاحقاً لا يمحو الإزعاج.
     */
    app.post('/api/travel/bookings/:id/pay', verifyToken, wrap(async (req, res) => {
        if (!stripeClient) return res.status(503).json({ error: 'الدفع الإلكتروني غير مفعَّل على هذا الخادم.' });
        const booking = await getBooking(store, String(req.params.id || ''));
        if (!booking || booking.username !== userOf(req)) {
            return res.status(404).json({ error: 'الحجز غير موجود.' });
        }
        if (booking.status !== 'pending') {
            return res.status(400).json({
                error: booking.status === 'issued'
                    ? 'هذا الحجز مدفوع ومُصدَر بالفعل.'
                    : 'هذا الحجز لم يعد بانتظار الدفع — ابدأ حجزاً جديداً.',
            });
        }
        if (booking.stripeSessionId) {
            try {
                const s = await stripeClient.getCheckoutSession(booking.stripeSessionId);
                if (s.paymentStatus === 'paid') {
                    // دُفع فعلاً وضاع الـwebhook — نسوّي فوراً بدل مطالبته مجدداً
                    const settled = booking.kind === 'fixed_package'
                        ? await settleFixedBookingPaid(booking.id, s.paymentIntent)
                        : await settleProviderBookingPaid(booking.id, s.paymentIntent);
                    return res.status(400).json({
                        error: settled
                            ? 'دفعتك وصلت — الحجز مُصدَر الآن. حدّث الصفحة.'
                            : 'دفعتك وصلت ونعالجها الآن — حدّث الصفحة بعد لحظات.',
                    });
                }
                if (s.status === 'open' && s.url) return res.json({ checkoutUrl: s.url });
            } catch (e) {
                console.warn('⚠️ تعذّر فحص جلسة الدفع القائمة:', e.message);
            }
        }
        const isFixed = booking.kind === 'fixed_package';
        const amount = isFixed ? (booking.paymentPlan?.paidNow ?? booking.sellAmount) : booking.sellAmount;
        const base = requestBaseUrl(req);
        const billing = await resolveBilling(amount, booking.currency);
        try {
            const session = await stripeClient.createCheckoutSession({
                amount: billing?.amount ?? amount,
                currency: billing?.currency ?? booking.currency,
                title: `${bookingSummaryLine(booking).slice(0, 200)} (${booking.bookingReference || booking.id})`,
                bookingId: booking.id,
                purpose: isFixed ? 'fixed_booking' : 'issue_booking',
                customerEmail: booking.contact?.email,
                successUrl: `${base}/?payment=success&booking=${booking.id}`,
                cancelUrl: `${base}/?payment=cancelled&booking=${booking.id}`,
            });
            await store.transitionBooking(booking.id, {
                from: ['pending'], to: 'pending',
                patch: { stripeSessionId: session.id, checkoutExpiresAt: session.expiresAt, billing },
            });
            res.json({ checkoutUrl: session.url });
        } catch (e) {
            res.status(502).json({ error: `تعذّر فتح صفحة الدفع: ${e.message}` });
        }
    }));

    // 💳 سداد المتبقي لحجز عربون مُصدَر — يكمل نموذجنا الفريد بتحصيل فعلي
    app.post('/api/travel/fixed-packages/bookings/:id/pay-balance', verifyToken, wrap(async (req, res) => {
        if (!stripeClient) return res.status(503).json({ error: 'الدفع الإلكتروني غير مفعَّل على هذا الخادم.' });
        const booking = await getBooking(store, String(req.params.id || ''));
        if (!booking || booking.username !== userOf(req) || booking.kind !== 'fixed_package') {
            return res.status(404).json({ error: 'الحجز غير موجود.' });
        }
        if (booking.status !== 'issued') return res.status(400).json({ error: 'سداد المتبقي متاح للحجوزات المُصدَرة فقط.' });
        const remaining = booking.paymentPlan?.remaining || 0;
        if (!(remaining > 0)) return res.status(400).json({ error: 'لا متبقٍّ على هذا الحجز — مدفوع بالكامل.' });
        const base = requestBaseUrl(req);
        // سعر الصرف يُحسب لحظة كل تحصيل — عربونٌ اليوم ومتبقٍّ بعد شهرين
        // لا يشتركان في سعر واحد، وادّعاء ذلك تجميدٌ لخطر لا نملكه.
        const balanceBilling = await resolveBilling(remaining, booking.currency);
        const session = await stripeClient.createCheckoutSession({
            amount: balanceBilling?.amount ?? remaining,
            currency: balanceBilling?.currency ?? booking.currency,
            title: `سداد متبقي ${booking.offer?.title || 'باقة'} (${booking.bookingReference})`,
            bookingId: booking.id, purpose: 'fixed_balance',
            customerEmail: booking.contact?.email,
            successUrl: `${base}/?payment=success&booking=${booking.id}`,
            cancelUrl: `${base}/?payment=cancelled&booking=${booking.id}`,
        });
        res.json({ checkoutUrl: session.url });
    }));

    app.post('/api/travel/fixed-packages/bookings/:id/cancel', verifyToken, wrap(async (req, res) => {
        try {
            const cancelled = await cancelFixedPackageBooking({
                store, username: userOf(req), bookingId: req.params.id,
            });
            // 💳 مع بوابة دفع ودفعة حقيقية مسجَّلة: الاسترداد فعلي عبر Stripe —
            // لا سجل يدّعي استرداداً لم يحدث. فشل الاسترداد لا يعكس الإلغاء
            // (المقاعد تحررت) — يُسجَّل صراحةً ويُنبَّه الأدمن ليسترد يدوياً.
            if (stripeClient && cancelled.paymentIntentId) {
                try {
                    const refund = await stripeClient.createRefund({ paymentIntentId: cancelled.paymentIntentId });
                    await store.transitionBooking(cancelled.id, {
                        from: ['cancelled'], to: 'cancelled',
                        patch: { refund: { amount: refund.amount, currency: refund.currency || cancelled.currency, stripeRefundId: refund.id } },
                    });
                } catch (e) {
                    await store.transitionBooking(cancelled.id, {
                        from: ['cancelled'], to: 'cancelled',
                        patch: { refund: { amount: null, currency: cancelled.currency, error: `تعذّر الاسترداد الآلي: ${e.message} — سيُسترد يدوياً.` } },
                    });
                    for (const admin of adminSet) {
                        await notifier.deliver({
                            username: admin, category: 'admin_alert',
                            title: `🧯 استرداد يدوي مطلوب — ${cancelled.bookingReference}`,
                            body: `أُلغي حجز الباقة ${cancelled.id} وفشل الاسترداد الآلي عبر Stripe: ${e.message}`,
                            meta: { bookingId: cancelled.id },
                        }).catch(() => {});
                    }
                }
            }
            const finalBooking = await getBooking(store, cancelled.id);
            await notifyBookingCancelled(finalBooking);
            // المقاعد المتحررة قد تُسعد منتظرين — أبلغهم الآن
            const pkgId = cancelled.offer?.fixedPackageId;
            if (pkgId) await notifyWaitlistSeatsFreed(await store.getFixedPackage(pkgId));
            res.json({ booking: publicBooking(finalBooking) });
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.post('/api/travel/fixed-packages/:id/waitlist', verifyToken, wrap(async (req, res) => {
        const pkg = await store.getFixedPackage(String(req.params.id || ''));
        if (!pkg || pkg.active === false) return res.status(404).json({ error: 'الباقة غير موجودة.' });
        if (fixedSeatsLeft(pkg) > 0) {
            return res.status(400).json({ error: `ما زالت هناك ${fixedSeatsLeft(pkg)} مقاعد متاحة — احجز مباشرةً.` });
        }
        const email = String(req.body?.email || '').trim();
        if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'صيغة البريد غير صحيحة.' });
        const entry = await store.createPackageInterest({
            kind: 'waitlist', packageId: pkg.id, username: userOf(req),
            email: email || null,
            packageTitle: pkg.title, departDate: pkg.departDate,
        });
        res.json({
            waitlisted: true, duplicate: !!entry.duplicate,
            message: entry.duplicate
                ? 'أنت في قائمة الانتظار مسبقاً — سنبلغك فور توفّر مقاعد.'
                : 'أُضفت لقائمة الانتظار — سنبلغك فور توفّر مقاعد.',
        });
    }));

    // ─── 💳 تسوية مدفوعات Stripe: webhook موقَّع + مصالحة دورية ─────────

    /**
     * 💳 الدفع قبل الإصدار — لحجوزات مخزون المزوّد (طيران/فندق/سيارة).
     *
     * ⚠️ الفارق الجوهري عن الباقات المجدولة ليس تفصيلاً تقنياً بل مالياً:
     * مقعد الباقة **ملكنا** (متعاقَد سلفاً) فنحجزه للمعلّق ونؤجل الإصدار
     * بلا خسارة. أما تذكرة Duffel/غرفة LiteAPI فتُشترى لحظة النداء
     * ويُخصم ثمنها من رصيدنا فوراً — فنداء المزوّد قبل وصول المال يعني
     * تذكرة مدفوعة من جيبنا إن هجر المسافر صفحة الدفع. لذلك: لا نداء
     * للمزوّد إطلاقاً قبل نجاح الدفع، والإصدار يجري في webhook/المصالحة.
     *
     * والثمن المقبول لهذا الترتيب: قد ينتهي أجل العرض بين الدفع والإصدار
     * (عروض Duffel قصيرة الأجل، والحد الأدنى لجلسة Stripe 30 دقيقة) —
     * فيُرد المبلغ كاملاً آلياً في settleProviderBookingPaid أدناه.
     */
    /**
     * 💱 عملة التحصيل — الحاجز الأول أمام أي تقسيط خليجي.
     *
     * نبيع بعملة المزوّد (يورو Duffel، دولار LiteAPI) ونحصّل بها. لكن
     * **Tabby وTamara لا يقبلان إلا الريال والدرهم** (وكذلك مدى وأغلب
     * وسائل الدفع المحلية) — فالفوترة بعملة أجنبية تُقصينا عنها كلها،
     * وتُحمّل المسافر الخليجي رسوم تحويل بنكه فوق سعرنا.
     *
     * الضبط بمتغيّر بيئة واحد (`TRAVEL_BILLING_CURRENCY=SAR`): غيابه يُبقي
     * السلوك كما هو حرفياً. والتحويل يحمل **هامش صرف معلَن** لا مخفياً
     * (`TRAVEL_FX_BUFFER_PCT`، 2% افتراضاً): بين لحظة التحصيل ولحظة
     * تسوية بطاقتنا مع المزوّد يتحرك السعر، ومن يبيع بعملة ويشتري بأخرى
     * بلا هامش يخسر على كل حركة. الرقم يظهر للمسافر بمصدره ونسبته —
     * فلا «رقم مُختلَق» ولا كلفة مستترة.
     *
     * وفشل الصرف لا يمنع بيعاً: نسقط إلى عملة المزوّد ونُكمل.
     */
    const billingCurrency = String(process.env.TRAVEL_BILLING_CURRENCY || '').trim().toUpperCase() || null;
    const fxBufferPct = (() => {
        const raw = Number(process.env.TRAVEL_FX_BUFFER_PCT);
        return Number.isFinite(raw) && raw >= 0 && raw <= 10 ? raw : 2;
    })();

    async function resolveBilling(amount, currency) {
        const from = String(currency || '').toUpperCase();
        if (!billingCurrency || !from || billingCurrency === from) return null;
        try {
            const fx = await fxRate({ from, to: billingCurrency, fetchImpl: travelInfoFetch });
            const converted = Math.ceil(amount * fx.rate * (1 + fxBufferPct / 100) * 100) / 100;
            return {
                amount: converted, currency: billingCurrency,
                rate: fx.rate, source: fx.source, bufferPct: fxBufferPct,
                fromAmount: amount, fromCurrency: from, at: Date.now(),
            };
        } catch (e) {
            console.warn(`⚠️ تعذّر تحويل ${from}→${billingCurrency} للتحصيل (${e.message}) — سنحصّل بعملة المزوّد.`);
            return null;
        }
    }

    async function startBookingCheckout({ booking, baseUrl, title }) {
        const base = baseUrl || publicUrl || '';
        const billing = await resolveBilling(booking.sellAmount, booking.currency);
        let session;
        try {
            session = await stripeClient.createCheckoutSession({
                amount: billing?.amount ?? booking.sellAmount,
                currency: billing?.currency ?? booking.currency,
                title: `${title} (${booking.id})`.slice(0, 250),
                bookingId: booking.id, purpose: 'issue_booking',
                customerEmail: booking.contact?.email,
                successUrl: `${base}/?payment=success&booking=${booking.id}`,
                cancelUrl: `${base}/?payment=cancelled&booking=${booking.id}`,
            });
        } catch (e) {
            // لا حجز معلّق بلا طريق دفع — ولا مقاعد محجوزة هنا أصلاً
            await transitionBooking(store, booking.id, 'failed', { error: `تعذّر فتح صفحة الدفع: ${e.message}` });
            throw Object.assign(new Error(`تعذّر فتح صفحة الدفع: ${e.message}. لم تُحاسَب على شيء.`), { status: 502 });
        }
        await store.transitionBooking(booking.id, {
            from: ['pending'], to: 'pending',
            patch: { stripeSessionId: session.id, checkoutExpiresAt: session.expiresAt, billing },
        });
        return { ...publicBooking(await getBooking(store, booking.id)), checkoutUrl: session.url };
    }

    /** نداء المزوّد المناسب لنوع الحجز — نفس الوسائط المحفوظة على الحجز. */
    async function issueBookingWithProvider(booking) {
        const offerId = booking.offer?.id;
        const contact = booking.contact;
        if (booking.kind === 'stay') {
            requireStays();
            return staysProvider.createStayOrder({ offerId, guests: booking.passengers, contact });
        }
        if (booking.kind === 'car') {
            requireCars();
            return carsProvider.createCarOrder({ offerId, drivers: booking.passengers, contact });
        }
        return provider.createOrder({ offerId, passengers: booking.passengers, contact });
    }

    const KIND_LABEL = { stay: 'الفندق', car: 'السيارة' };

    /**
     * دفع حجز مزوّد اكتمل → الإصدار الآن (النداء الوحيد للمزوّد في الرحلة
     * كلها). آمن التكرار: الانتقال من pending محروس، فإعادة إرسال Stripe
     * لا تُصدر تذكرتين.
     *
     * وفشل الإصدار بعد الدفع هو الحالة التي تُحكم بها جودة أي بوابة:
     * المال وصل والخدمة لم تُقدَّم، فالرد **آلي فوري** لا مطالبة يدوية —
     * وإن تعذّر الرد نفسه يُنبَّه المالك لأنها الحالة الوحيدة التي نحتفظ
     * فيها بمال بلا مقابل ولو لدقائق.
     */
    async function settleProviderBookingPaid(bookingId, paymentIntentId = null) {
        const booking = await getBooking(store, bookingId);
        if (!booking || booking.status !== 'pending' || booking.kind === 'fixed_package') return false;
        const label = KIND_LABEL[booking.kind] || 'الرحلة';
        try {
            const order = await issueBookingWithProvider(booking);
            const issued = await transitionBooking(store, booking.id, 'issued', {
                providerOrderId: order.orderId,
                bookingReference: order.bookingReference,
                tickets: order.tickets || [],
                paymentIntentId, paidAt: Date.now(),
            });
            if (issued) await notifyBookingIssued(issued);
            return !!issued;
        } catch (e) {
            let refund = { amount: null, error: e.message };
            if (paymentIntentId) {
                try {
                    const r = await stripeClient.createRefund({ paymentIntentId });
                    refund = { amount: r.amount, currency: r.currency, stripeRefundId: r.id, reason: e.message };
                } catch (re) {
                    refund = { amount: null, error: `تعذّر الرد الآلي: ${re.message}`, reason: e.message };
                    for (const admin of adminSet) {
                        await notifier.deliver({
                            username: admin, category: 'admin_alert',
                            title: `🧯 استرداد يدوي مطلوب — ${booking.id}`,
                            body: `دُفع حجز ${label} ولم يُصدَر (${e.message})، وفشل الرد الآلي (${re.message}).\nالمبلغ: ${booking.sellAmount} ${booking.currency}\npayment_intent: ${paymentIntentId}`,
                            meta: { bookingId: booking.id },
                        });
                    }
                }
            }
            await transitionBooking(store, booking.id, 'failed', {
                error: `تعذّر إصدار حجز ${label} بعد الدفع: ${e.message}`,
                refund,
            });
            await notifier.deliver({
                username: booking.username, category: 'booking_cancelled',
                title: `↩️ تعذّر إصدار حجزك — أُعيد المبلغ`,
                body: `تعذّر إصدار حجز ${label} بعد الدفع (${e.message}).\n`
                    + (refund.stripeRefundId
                        ? `أُعيد المبلغ ${refund.amount} ${refund.currency} إلى بطاقتك — قد يستغرق ظهوره أياماً قليلة لدى البنك.`
                        : 'سنعيد المبلغ إليك يدوياً خلال وقت قصير.')
                    + '\nيمكنك إعادة البحث والحجز من جديد متى شئت.',
                email: booking.contact?.email || null,
                meta: { bookingId: booking.id },
            });
            return false;
        }
    }

    /** جلسة دفع حجز مزوّد انتهت بلا سداد → فشل صريح (لا مخزون محجوزاً يُحرَّر). */
    async function expireProviderBookingPayment(bookingId) {
        const booking = await getBooking(store, bookingId);
        if (!booking || booking.status !== 'pending' || booking.kind === 'fixed_package') return false;
        const failed = await transitionBooking(store, booking.id, 'failed', {
            error: 'انتهت مهلة الدفع دون سداد — لم يُصدر الحجز ولم تُحاسَب على شيء.',
        });
        return !!failed;
    }

    /**
     * مبلغ ما يُرد للمسافر عند إلغاء حجز مدفوع — يتناسب مع ما ردّه
     * المزوّد فعلاً: رد كامل ⇒ رد كامل بهامشنا، جزئي ⇒ نفس النسبة،
     * صفر ⇒ صفر (وهو ما أعلناه له قبل الحجز: «غير قابل للاسترداد»).
     *
     * ⚠️ ومزوّد صامت عن المبلغ حالة حقيقية لا فرضية (LiteAPI أعاد `null`
     * في إلغاء مُجرَّب): لا نخمّن — إن كنا وعدنا بإلغاء مجاني نرد كاملاً،
     * وإلا نترك القرار للمالك بتنبيه صريح بدل رقمٍ مخترَع.
     */
    function refundPlanFor(booking, providerRefund) {
        // ⚠️ المرجع هو ما **حُصِّل فعلاً** لا ما بِيع به: مع الفوترة بعملة
        // محلية يختلف الرقمان، ورد نسبةٍ من سعر البيع كان سيرد بعملة أخرى
        // مبلغاً لا علاقة له بما خرج من بطاقة المسافر.
        const paid = Number(booking.billing?.amount ?? booking.sellAmount);
        const net = Number(booking.netAmount);
        const back = Number(providerRefund?.amount);
        if (Number.isFinite(back) && Number.isFinite(net) && net > 0) {
            const share = Math.max(0, Math.min(1, back / net));
            return { amount: Math.round(paid * share * 100) / 100, manual: false };
        }
        if (booking.offer?.cancellable === true) return { amount: paid, manual: false };
        return { amount: null, manual: true };
    }

    /**
     * يُرجع المال بعد إلغاء ناجح لدى المزوّد. يُستدعى من مسارات الإلغاء
     * الثلاثة — منطق واحد فلا تفترق سياسة الرد بين طيران وفندق وسيارة.
     */
    async function refundCancelledBooking(booking, providerRefund) {
        if (!stripeClient || !booking.paymentIntentId) return null;
        const plan = refundPlanFor(booking, providerRefund);
        if (plan.manual || !(plan.amount > 0)) {
            for (const admin of adminSet) {
                await notifier.deliver({
                    username: admin, category: 'admin_alert',
                    title: `🧯 مراجعة استرداد — ${booking.bookingReference || booking.id}`,
                    body: `أُلغي حجز مدفوع ولم يُحدَّد مبلغ الرد آلياً (المزوّد لم يصرّح بالمبلغ وسياسة العرض ليست إلغاءً مجانياً).\n`
                        + `المدفوع: ${booking.sellAmount} ${booking.currency}\npayment_intent: ${booking.paymentIntentId}`,
                    meta: { bookingId: booking.id },
                });
            }
            return { amount: null, pendingReview: true };
        }
        const charged = Number(booking.billing?.amount ?? booking.sellAmount);
        try {
            const r = await stripeClient.createRefund({
                paymentIntentId: booking.paymentIntentId,
                amount: plan.amount < charged ? plan.amount : null,
            });
            return { amount: r.amount, currency: r.currency, stripeRefundId: r.id };
        } catch (e) {
            for (const admin of adminSet) {
                await notifier.deliver({
                    username: admin, category: 'admin_alert',
                    title: `🧯 استرداد يدوي مطلوب — ${booking.bookingReference || booking.id}`,
                    body: `فشل رد ${plan.amount} ${booking.currency} آلياً: ${e.message}\npayment_intent: ${booking.paymentIntentId}`,
                    meta: { bookingId: booking.id },
                });
            }
            return { amount: null, error: `تعذّر الرد الآلي — سيُسترد يدوياً: ${e.message}` };
        }
    }

    /** دفع حجز باقة اكتمل → إصدار + إشعار. آمن التكرار (الانتقال محروس). */
    async function settleFixedBookingPaid(bookingId, paymentIntentId = null) {
        const booking = await getBooking(store, bookingId);
        if (!booking || booking.kind !== 'fixed_package' || booking.status !== 'pending') return false;
        const issued = await transitionBooking(store, booking.id, 'issued', {
            paymentIntentId, paidAt: Date.now(),
        });
        if (issued) await notifyBookingIssued(issued);
        return !!issued;
    }

    /** دفع المتبقي اكتمل → تصفير الخطة + إشعار. آمن التكرار (يفحص المتبقي). */
    async function settleFixedBalancePaid(bookingId) {
        const booking = await getBooking(store, bookingId);
        if (!booking || booking.kind !== 'fixed_package' || booking.status !== 'issued') return false;
        const plan = booking.paymentPlan;
        if (!plan || !(plan.remaining > 0)) return false; // سُوّي سلفاً — تكرار webhook
        await store.transitionBooking(booking.id, {
            from: ['issued'], to: 'issued',
            patch: { paymentPlan: { ...plan, paidNow: plan.paidNow + plan.remaining, remaining: 0, balancePaidAt: Date.now() } },
        });
        await notifier.deliver({
            username: booking.username,
            category: 'booking_issued',
            title: `💳 اكتمل سداد باقتك — ${booking.bookingReference}`,
            body: `استلمنا سداد المتبقي لحجزك «${booking.offer?.title || ''}» (${booking.bookingReference}).\nالحجز مدفوع بالكامل — رحلة سعيدة!`,
            email: booking.contact?.email || null,
            meta: { bookingId: booking.id },
        });
        return true;
    }

    /** جلسة دفع حجزٍ انتهت بلا سداد → فشل + تحرير المقاعد لمن ينتظر. */
    async function expireFixedBookingPayment(bookingId) {
        const booking = await getBooking(store, bookingId);
        if (!booking || booking.kind !== 'fixed_package' || booking.status !== 'pending') return false;
        const failed = await transitionBooking(store, booking.id, 'failed', {
            error: 'انتهت مهلة الدفع (30 دقيقة) دون سداد — تحررت المقاعد. احجز من جديد متى شئت.',
        });
        if (failed) {
            const pkgId = booking.offer?.fixedPackageId;
            if (pkgId && booking.seats > 0) {
                await store.releaseFixedSeats(pkgId, booking.seats).catch(() => {});
                await notifyWaitlistSeatsFreed(await store.getFixedPackage(pkgId));
            }
        }
        return !!failed;
    }

    // نفس عمارة webhook Duffel حرفياً: مسار عام بلا verifyToken (Stripe خادم
    // لا مستخدم)، محمي حصراً بتوقيع HMAC على الجسم الخام (req.rawBody).
    app.post('/api/travel/webhooks/stripe', wrap(async (req, res) => {
        if (!stripeWebhookSecret) return res.status(503).json({ error: 'webhook الدفع غير مُهيَّأ.' });
        const ok = verifyStripeWebhookSignature({
            rawBody: req.rawBody?.toString('utf8'),
            header: req.headers['stripe-signature'],
            secret: stripeWebhookSecret,
        });
        if (!ok) return res.status(401).json({ error: 'توقيع غير صالح.' });

        const event = req.body || {};
        const session = event?.data?.object || {};
        const bookingId = session?.metadata?.bookingId;
        const purpose = session?.metadata?.purpose;
        if (bookingId) {
            if (event.type === 'checkout.session.completed') {
                if (purpose === 'fixed_balance') await settleFixedBalancePaid(bookingId);
                else if (purpose === 'issue_booking') await settleProviderBookingPaid(bookingId, session.payment_intent || null);
                else await settleFixedBookingPaid(bookingId, session.payment_intent || null);
            } else if (event.type === 'checkout.session.expired') {
                if (purpose === 'issue_booking') await expireProviderBookingPayment(bookingId);
                else if (purpose === 'fixed_booking') await expireFixedBookingPayment(bookingId);
            }
        }
        res.json({ received: true }); // غير المعروف يُقَرّ به بصمت — Stripe يعيد الإرسال وإلا
    }));

    /**
     * مصالحة المدفوعات المعلّقة — شبكة أمان لضياع webhook (انقطاع، خدمة
     * نائمة على استضافة مجانية): حجوزات pending بجلسة دفع تُستفسر حالتها
     * من Stripe مباشرة: مدفوعة → تُصدر، منتهية → تفشل وتتحرر مقاعدها.
     * يستدعيها المُطلِق الزمني — فشل حجز واحد لا يوقف البقية.
     */
    async function reconcilePendingPayments(limit = 100) {
        if (!stripeClient) return { checked: 0, settled: 0, expired: 0 };
        const all = await store.listAllBookings(500);
        // كل الأنواع: مقاعد الباقة تُحرَّر، وحجوزات المزوّد تُصدر بعد الدفع
        const pending = all.filter(b => b.status === 'pending' && b.stripeSessionId).slice(0, limit);
        let settled = 0, expired = 0;
        const errors = [];
        for (const b of pending) {
            const isFixed = b.kind === 'fixed_package';
            try {
                const s = await stripeClient.getCheckoutSession(b.stripeSessionId);
                if (s.paymentStatus === 'paid') {
                    const done = isFixed
                        ? await settleFixedBookingPaid(b.id, s.paymentIntent)
                        : await settleProviderBookingPaid(b.id, s.paymentIntent);
                    if (done) settled += 1;
                } else if (s.status === 'expired') {
                    const done = isFixed
                        ? await expireFixedBookingPayment(b.id)
                        : await expireProviderBookingPayment(b.id);
                    if (done) expired += 1;
                }
                // open وغير منتهية: ما زال المسافر على صفحة الدفع — تُترك
            } catch (e) {
                errors.push({ bookingId: b.id, error: e.message });
            }
        }
        return { checked: pending.length, settled, expired, errors };
    }

    app.post('/api/travel/quote-requests', verifyToken, wrap(async (req, res) => {
        const destination = String(req.body?.destination || '').trim().slice(0, 80);
        if (!destination) return res.status(400).json({ error: 'الوجهة مطلوبة.' });
        const date = String(req.body?.date || '').trim();
        if (date && !DATE_RE.test(date)) return res.status(400).json({ error: 'التاريخ بصيغة YYYY-MM-DD.' });
        const pax = Number(req.body?.pax ?? 2);
        if (!Number.isInteger(pax) || pax < 1 || pax > 100) {
            return res.status(400).json({ error: 'عدد المسافرين عدد صحيح بين 1 و100.' });
        }
        const contactCheck = validateFixedContact(req.body?.contact);
        if (contactCheck.error) return res.status(400).json({ error: contactCheck.error });
        await store.createPackageInterest({
            kind: 'quote', username: userOf(req),
            destination, date: date || null, pax,
            note: String(req.body?.note || '').trim().slice(0, 400) || null,
            ...contactCheck.value,
        });
        res.json({ requested: true, message: '🎯 استلمنا طلبك — سيصلك عرض خاص على مقاسك قريباً.' });
    }));

    // ─── 💵 سعر صرف للعرض + 🎁 الولاء ──────────────────────────────────

    // كاش سعر الصرف 12 ساعة لكل زوج — Frankfurter يتحدّث يومياً أصلاً،
    // وأزواج الربط الرسمي تُخدَم بلا شبكة إطلاقاً (fx.js).
    const FX_TTL_MS = 12 * 60 * 60 * 1000;
    const fxCache = new Map();

    app.get('/api/travel/fx', verifyToken, wrap(async (req, res) => {
        const from = String(req.query.from || '').trim().toUpperCase();
        const to = String(req.query.to || '').trim().toUpperCase();
        const key = `${from}_${to}`;
        const cached = fxCache.get(key);
        if (cached && Date.now() - cached.at < FX_TTL_MS) {
            return res.json({ ...cached.data, cached: true });
        }
        try {
            const data = await fxRate({ from, to, fetchImpl: travelInfoFetch });
            // النجاح فقط يُكيَّش — فشل شبكة لحظي لا يُخلَّد 12 ساعة
            fxCache.set(key, { at: Date.now(), data });
            res.json(data);
        } catch (e) {
            if (e.status) return res.status(e.status).json({ error: e.message });
            throw e;
        }
    }));

    app.get('/api/travel/fx/currencies', verifyToken, (req, res) => {
        res.json({ currencies: DISPLAY_CURRENCIES });
    });

    app.get('/api/travel/loyalty', verifyToken, wrap(async (req, res) => {
        const bookings = await store.listBookingsByUser(userOf(req), 500);
        res.json({ loyalty: computeLoyalty(bookings) });
    }));

    // ─── 🗺️ أهم الوجهات (صور Wikimedia + أرخص سعر حقيقي) ──────────────

    app.get('/api/travel/destinations/top', verifyToken, destinationsLimiter, wrap(async (req, res) => {
        const origin = String(req.query.origin || '').trim().toUpperCase();
        if (!IATA_RE.test(origin)) {
            return res.status(400).json({ error: 'رمز مطار الأصل يجب أن يكون IATA من ثلاثة أحرف (مثل RUH).' });
        }
        const rawLimit = req.query.limit;
        let limit;
        if (rawLimit !== undefined) {
            limit = Number(rawLimit);
            if (!Number.isInteger(limit) || limit < 1 || limit > CURATED_DESTINATIONS.length) {
                return res.status(400).json({ error: `limit يجب أن يكون عدداً صحيحاً بين 1 و${CURATED_DESTINATIONS.length}.` });
            }
        }
        const destinations = await buildTopDestinations({ origin, provider, markupPct: flightMkt, fetchImpl: travelInfoFetch, limit });
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
            bookFlight: args => doBook(username, args, requestBaseUrl(req)),
            listBookings: () => listMine(username),
            cancelBooking: id => doCancel(username, id),
            searchStays: staysProvider ? params => doSearchStays(params) : null,
            getStayOffer: staysProvider ? id => doGetStayOffer(id) : null,
            bookStay: staysProvider ? args => doBookStay(username, args, requestBaseUrl(req)) : null,
            cancelStay: staysProvider ? id => doCancelStay(username, id) : null,
            searchCars: carsProvider ? params => doSearchCars(params) : null,
            getCarOffer: carsProvider ? id => doGetCarOffer(id) : null,
            bookCar: carsProvider ? args => doBookCar(username, args, requestBaseUrl(req)) : null,
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
        // 🧠 ذاكرة الايجنت: تفضيلات ووجهات متكررة وعددُ المسافرين — بلا
        // اسم ولا تاريخ ميلاد (راجع الخط الأحمر في profile.js).
        let memory = '';
        let profile = null;
        try {
            profile = await loadProfile(username);
            memory = buildAgentMemory(profile, await listMine(username));
        } catch (e) {
            console.error('⚠️ تعذّر تحميل ذاكرة المسافر:', e.message);
        }
        try {
            const result = await agent.chat({ messages, services, memory, lang: uiLangOf(req) });
            // آخر محادثة تُحفظ لتُستأنف — والحفظ لا يُسقط رداً نجح فعلاً
            try {
                await store.setProfile(username, mergeProfile(profile, {
                    conversation: trimConversation([...messages, { role: 'assistant', content: result.reply }]),
                }));
            } catch (e) {
                console.error('⚠️ تعذّر حفظ المحادثة:', e.message);
            }
            res.json(result);
        } catch (e) {
            res.status(502).json({ error: `تعذّر رد المساعد: ${e.message}` });
        }
    }));

    // آخر محادثة محفوظة — تُستأنف عند فتح تبويب المساعد بدل البدء من صفر
    app.get('/api/travel/agent/conversation', verifyToken, wrap(async (req, res) => {
        res.json({ messages: (await loadProfile(userOf(req))).conversation || [] });
    }));

    // صياغة قراءة النتائج بأسلوب الايجنت. مسار منفصل عن البحث عمداً:
    // النتائج تظهر فوراً بالقراءة الحتمية، وهذا النداء يحسّن الصياغة بعدها
    // — فلا ينتظر أحدٌ نموذجاً لغوياً ليرى أسعار رحلته.
    app.post('/api/travel/insights/phrase', verifyToken, agentLimiter, wrap(async (req, res) => {
        const findings = sanitizeFindings(req.body?.findings);
        if (findings.length === 0) return res.status(400).json({ error: 'لا نتائج تحليل صالحة للصياغة.' });
        // يُعاد التوليد من القوالب — نص العميل لا يصل النموذج إطلاقاً
        const lang = uiLangOf(req);
        const text = renderInsight(findings, lang);
        if (!agent) return res.json({ text, phrased: false });
        res.json({ text: await agent.phraseInsight(text, lang), phrased: true });
    }));

    // ─── ⏰ المُطلِق الزمني ────────────────────────────────────────────
    //
    // الخطة المجانية على Render **تنام** بلا زيارات، فـsetInterval داخل
    // العملية يتوقف معها — وهو حدّ منصة موثَّق لا خلل. المُطلِق الخارجي
    // (GitHub Actions cron) يوقظ الخدمة ثم ينادي هذا المسار، فيعمل الفحص
    // الدوري وتذكيرُ ما قبل السفر فعلياً لا نظرياً.
    //
    // 🔒 سرٌّ مشترك لا توكن مستخدم: هذا ليس فعل مستخدم بل فعل نظام،
    // ومقارنته بزمن ثابت (timingSafeEqual) كتوقيع الـwebhook.
    app.post('/api/travel/cron/run', wrap(async (req, res) => {
        if (!cronSecret) return res.status(503).json({ error: 'المُطلِق الزمني غير مُهيَّأ.' });
        if (!secretMatches(req.headers['x-cron-secret'], cronSecret)) {
            return res.status(401).json({ error: 'سرّ المُطلِق غير صحيح.' });
        }
        const summary = {};
        // كل مهمة معزولة: فشل إحداها لا يمنع الأخرى من العمل هذه الدورة
        try {
            summary.priceWatches = await checkWatches({ store, provider, markupPct: flightMkt, mailer });
        } catch (e) {
            summary.priceWatches = { error: e.message };
        }
        try {
            summary.tripReminders = await sendTripReminders({
                store, notifier: eventNotifier, fetchImpl: travelInfoFetch,
            });
        } catch (e) {
            summary.tripReminders = { error: e.message };
        }
        try {
            summary.packageCompensations = await retryPackageCompensations({ store, staysProvider });
        } catch (e) {
            summary.packageCompensations = { error: e.message };
        }
        try {
            // 💳 تذكير سداد متبقي العربون — يجعل نموذجنا الفريد ذاتي التشغيل
            summary.balanceReminders = await sendBalanceReminders({ store, notifier });
        } catch (e) {
            summary.balanceReminders = { error: e.message };
        }
        try {
            // 💳 مصالحة مدفوعات معلّقة — شبكة أمان لضياع webhook
            summary.paymentReconcile = await reconcilePendingPayments();
        } catch (e) {
            summary.paymentReconcile = { error: e.message };
        }
        res.json(summary);
    }));

    // ─── ⚙️ الإدارة (TRAVEL_ADMIN_USERS فقط — لغيرهم المسارات غير موجودة) ──

    /**
     * النظرة العامة: كل رقم فيها جمعٌ من سجلات netAmount/sellAmount التي
     * تُكتب مع كل حجز — لا استنتاج رجعي. أبناء الباقات يُستثنون من
     * الإيراد (sellAmount=null أصلاً: الهامش على الأب وحده فلا عدّ مزدوج).
     */
    app.get('/api/travel/admin/overview', verifyToken, requireAdmin, wrap(async (req, res) => {
        const bookings = await store.listAllBookings(1000);
        const byStatus = {};
        const byKind = {};
        let revenue = 0;
        let unknownCost = 0; // حجوزات مُصدَرة بلا كلفة مسجَّلة — تُعلَن ولا تُخمَّن
        let revenueCurrencies = new Set();
        for (const b of bookings) {
            byStatus[b.status] = (byStatus[b.status] || 0) + 1;
            byKind[b.kind || 'flight'] = (byKind[b.kind || 'flight'] || 0) + 1;
            // كلفة غير مسجَّلة تُستثنى من الربح ولا تُحسب صفراً: باقةٌ بلا
            // كلفة كانت ستظهر ربحاً بكامل سعرها فتكذب النظرة المالية كلها.
            if (b.status === 'issued' && b.sellAmount != null && b.netAmount != null) {
                revenue += b.sellAmount - b.netAmount;
                revenueCurrencies.add(b.currency);
            } else if (b.status === 'issued' && b.sellAmount != null) {
                unknownCost += 1;
            }
        }
        const contracts = await store.listContracts();
        const compensationPending = await store.listCompensationPending(50);
        res.json({
            bookings: {
                total: bookings.length, byStatus, byKind,
                // ⚠️ صادق لا مبسَّط: الإيراد جمعُ هوامش، وإن تعددت العملات
                // يُعلَن ذلك بدل جمع عملات مختلفة في رقم واحد كاذب
                revenue: Math.round(revenue * 100) / 100,
                revenueCurrencies: [...revenueCurrencies],
                revenueMixedCurrencies: revenueCurrencies.size > 1,
                // حجوزات خارج حساب الربح لغياب كلفتها — تُعلَن كي لا يُقرأ
                // الإيراد على أنه شامل بينما هو ناقص
                unknownCostBookings: unknownCost,
            },
            contracts: {
                total: contracts.length,
                active: contracts.filter(c => c.active !== false).length,
                roomsUsed: contracts.reduce((s, c) => s + (c.usedRooms || 0), 0),
                roomsTotal: contracts.reduce((s, c) => s + (c.allotment || 0), 0),
            },
            compensationPending: compensationPending.map(b => ({
                id: b.id, username: b.username, at: b.at, pending: b.compensation?.pending || [],
            })),
            config: {
                provider: provider.name, providerMode: provider.mode || 'live',
                staysProvider: staysBase?.name || null, staysProviderMode: staysBase?.mode || null,
                carsEnabled: !!carsProvider,
                markupPct, // الافتراض العام — يظهر لتوضيح ما تسقط عليه فئة لم تُخصَّص
                flightMarkupPct: flightMkt, stayMarkupPct: stayMkt, carMarkupPct: carMkt,
                packageMarkupPct: pkgMarkupPct,
                agentEnabled: !!agent,
                mailReady: !!mailer?.mailReady?.(),
                whatsappReady: !!whatsapp?.whatsappReady?.(),
                cronConfigured: !!cronSecret,
                webhooksConfigured: !!duffelWebhookSecret,
            },
        });
    }));

    app.get('/api/travel/admin/bookings', verifyToken, requireAdmin, wrap(async (req, res) => {
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const bookings = await store.listAllBookings(limit);
        // للأدمن — وله وحده — يظهر الصافي والهامش: قاعدة «الصافي لا يغادر
        // الخادم» تحمي الهامش من المسافر، والأدمن هو صاحب الهامش نفسه.
        res.json({
            bookings: bookings.map(b => ({
                ...publicBooking(b),
                username: b.username,
                netAmount: b.netAmount,
                // كلفة فارغة تعني «غير مسجَّلة» لا صفراً — و(800 - null) في
                // جافاسكربت = 800، أي هامشٌ مُختلَق بكامل السعر. null أصدق.
                margin: (b.sellAmount != null && b.netAmount != null)
                    ? Math.round((b.sellAmount - b.netAmount) * 100) / 100 : null,
                compensation: b.compensation || null,
            })),
        });
    }));

    app.get('/api/travel/admin/contracts', verifyToken, requireAdmin, wrap(async (req, res) => {
        res.json({ contracts: await store.listContracts() });
    }));

    app.post('/api/travel/admin/contracts', verifyToken, requireAdmin, wrap(async (req, res) => {
        const check = normalizeContract(req.body || {});
        if (check.error) return res.status(400).json({ error: check.error });
        res.json({ contract: await store.createContract(check.value) });
    }));

    app.put('/api/travel/admin/contracts/:id', verifyToken, requireAdmin, wrap(async (req, res) => {
        const existing = await store.getContract(req.params.id);
        if (!existing) return res.status(404).json({ error: 'العقد غير موجود.' });
        // التعديل يمرّ على نفس منقّي الإنشاء — عقدٌ لا يصلح إنشاؤه لا يصلح تعديلاً إليه
        const check = normalizeContract({ ...existing, ...req.body });
        if (check.error) return res.status(400).json({ error: check.error });
        res.json({ contract: await store.updateContract(req.params.id, check.value) });
    }));

    app.delete('/api/travel/admin/contracts/:id', verifyToken, requireAdmin, wrap(async (req, res) => {
        const deleted = await store.deleteContract(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'العقد غير موجود.' });
        res.json({ deleted: true });
    }));

    app.post('/api/travel/admin/compensations/retry', verifyToken, requireAdmin, wrap(async (req, res) => {
        res.json(await retryPackageCompensations({ store, staysProvider }));
    }));

    // ─── 🎒 إدارة الباقات المجدولة ────────────────────────────────────

    app.get('/api/travel/admin/fixed-packages', verifyToken, requireAdmin, wrap(async (req, res) => {
        const all = await store.listFixedPackages();
        // نظرة المالك الكاملة: الصافي والهامش ومصدر التعاقد وقائمة الانتظار
        const packages = [];
        for (const p of all) {
            const waiting = await store.listWaitlistByPackage(p.id);
            packages.push({
                ...p,
                seatsLeft: fixedSeatsLeft(p),
                sourcingLabel: SEAT_SOURCING[p.sourcing] || p.sourcing,
                waitlistCount: waiting.length,
                marginPerSeat: p.netPerSeat != null
                    ? Math.round((p.pricePerSeat - p.netPerSeat) * 100) / 100 : null,
            });
        }
        res.json({ packages, sourcingOptions: SEAT_SOURCING });
    }));

    app.post('/api/travel/admin/fixed-packages', verifyToken, requireAdmin, wrap(async (req, res) => {
        const check = normalizeFixedPackage(req.body || {});
        if (check.error) return res.status(400).json({ error: check.error });
        res.json({ package: await store.createFixedPackage(check.value) });
    }));

    app.put('/api/travel/admin/fixed-packages/:id', verifyToken, requireAdmin, wrap(async (req, res) => {
        const existing = await store.getFixedPackage(req.params.id);
        if (!existing) return res.status(404).json({ error: 'الباقة غير موجودة.' });
        // التعديل يمرّ على نفس منقّي الإنشاء — باقة لا يصلح إنشاؤها لا يصلح تعديلٌ إليها
        const check = normalizeFixedPackage({ ...existing, ...req.body });
        if (check.error) return res.status(400).json({ error: check.error });
        const updated = await store.updateFixedPackage(req.params.id, check.value);
        // سعة زادت أو باقة أُعيد فتحها → مقاعد متاحة لمنتظرين — أبلغهم
        const seatsFreed = fixedSeatsLeft(updated) > fixedSeatsLeft(existing)
            || (existing.active === false && updated.active !== false);
        if (seatsFreed) await notifyWaitlistSeatsFreed(updated);
        res.json({ package: updated });
    }));

    app.delete('/api/travel/admin/fixed-packages/:id', verifyToken, requireAdmin, wrap(async (req, res) => {
        const deleted = await store.deleteFixedPackage(req.params.id);
        if (!deleted) {
            return res.status(400).json({ error: 'تعذّر الحذف — باقة عليها حجوزات تُغلق (active=false) ولا تُحذف، أو المعرّف غير موجود.' });
        }
        res.json({ deleted: true });
    }));

    app.get('/api/travel/admin/package-interests', verifyToken, requireAdmin, wrap(async (req, res) => {
        res.json({ interests: await store.listPackageInterests(200) });
    }));

    // ─── 🧠 ملف المسافر (الذاكرة) ─────────────────────────────────────

    async function loadProfile(username) {
        return (await store.getProfile(username)) || defaultProfile();
    }

    app.get('/api/travel/profile', verifyToken, wrap(async (req, res) => {
        const profile = await loadProfile(userOf(req));
        // المحادثة المحفوظة لا تُرسَل هنا — لها مسارها، وحجمها لا يخصّ
        // شاشة الإعدادات التي تستدعي هذا كثيراً.
        res.json({ prefs: profile.prefs, travellers: profile.travellers });
    }));

    app.put('/api/travel/profile/prefs', verifyToken, wrap(async (req, res) => {
        const username = userOf(req);
        const current = await loadProfile(username);
        // رقم فاسد يسقط إلى null في التنقية — وسقوطه صامتاً يترك المستخدم
        // يظن أنه فعّل واتساب بينما لا رقم محفوظاً. يُقال له صراحةً.
        const rawPhone = req.body?.prefs?.whatsappPhone;
        if (rawPhone && !isWhatsAppPhone(rawPhone)) {
            return res.status(400).json({ error: PHONE_HINT });
        }
        const next = mergeProfile(current, { prefs: req.body?.prefs || {} });
        await store.setProfile(username, next);
        res.json({ prefs: next.prefs });
    }));

    app.post('/api/travel/profile/travellers', verifyToken, wrap(async (req, res) => {
        const username = userOf(req);
        const current = await loadProfile(username);
        // ⚠️ الحفظ باختيار صريح: لا يُحفظ مسافر لمجرد أنه حجز
        if (!current.prefs.savePassengers) {
            return res.status(403).json({ error: 'حفظ المسافرين غير مُفعَّل — فعّله من إعدادات ملفك أولاً.' });
        }
        if (current.travellers.length >= MAX_TRAVELLERS) {
            return res.status(400).json({ error: `الحد الأقصى ${MAX_TRAVELLERS} مسافرين محفوظين.` });
        }
        // نفس مُتحقِّق الحجز — مسافر محفوظ لا يصلح للحجز عيبٌ لا ميزة
        const check = normalizeTraveller(req.body?.traveller, validatePassengers);
        if (check.error) return res.status(400).json({ error: check.error });
        const traveller = { id: 'tvl_' + crypto.randomBytes(8).toString('hex'), ...check.value };
        const next = mergeProfile(current, { travellers: [...current.travellers, traveller] });
        await store.setProfile(username, next);
        res.json({ traveller, travellers: next.travellers });
    }));

    app.delete('/api/travel/profile/travellers/:id', verifyToken, wrap(async (req, res) => {
        const username = userOf(req);
        const current = await loadProfile(username);
        const travellers = current.travellers.filter(t => t.id !== req.params.id);
        if (travellers.length === current.travellers.length) {
            return res.status(404).json({ error: 'المسافر غير موجود في ملفك.' });
        }
        await store.setProfile(username, mergeProfile(current, { travellers }));
        res.json({ travellers });
    }));

    // 🔒 المسح الكامل: حقٌّ لا ميزة، وفوريٌّ لا مجدوَل. صفٌّ واحد يُزال
    // فلا تبقى بقايا موزّعة (وهو سبب تجميع الملف في صفٍّ واحد أصلاً).
    app.delete('/api/travel/profile', verifyToken, wrap(async (req, res) => {
        res.json({ deleted: await store.deleteProfile(userOf(req)) });
    }));

    // ─── 🔔 التنبيهات وتفضيلاتها ──────────────────────────────────────

    app.get('/api/travel/notifications', verifyToken, wrap(async (req, res) => {
        const username = userOf(req);
        const [notifications, unread] = await Promise.all([
            store.listNotificationsByUser(username, MAX_NOTIFICATIONS),
            store.countUnreadNotifications(username),
        ]);
        res.json({ notifications, unread });
    }));

    app.post('/api/travel/notifications/read-all', verifyToken, wrap(async (req, res) => {
        res.json({ marked: await store.markAllNotificationsRead(userOf(req)) });
    }));

    // اسم المستخدم يمرَّر للمخزن ليدخل شرط التحديث نفسه — لا فحص ملكية
    // منفصل يمكن أن يُنسى (نفس عزل transitionBooking).
    app.post('/api/travel/notifications/:id/read', verifyToken, wrap(async (req, res) => {
        const row = await store.markNotificationRead(String(req.params.id), userOf(req));
        if (!row) return res.status(404).json({ error: 'التنبيه غير موجود.' });
        res.json({ notification: row });
    }));

    app.get('/api/travel/notifications/prefs', verifyToken, wrap(async (req, res) => {
        const stored = await store.getNotificationPrefs(userOf(req));
        // الواجهة تحتاج تعرف هل القناة صالحة أصلاً: مفتاح غير مضبوط على
        // الخادم، أو رقم لم يُسجَّل — كلاهما يجعل المفتاح كذبة بصرية.
        const profile = await loadProfile(userOf(req));
        res.json({
            prefs: stored ? normalizeNotificationPrefs(stored) : defaultNotificationPrefs(),
            categories: NOTIFICATION_CATEGORIES,
            whatsapp: {
                enabled: !!whatsapp?.whatsappReady?.(),
                phone: profile.prefs?.whatsappPhone || null,
            },
        });
    }));

    app.put('/api/travel/notifications/prefs', verifyToken, wrap(async (req, res) => {
        // التنقية تُعيد بناء الكائن كاملاً من قائمة بيضاء: فئة مجهولة أو
        // قيمة غير منطقية تسقط، والفئة الغائبة تأخذ افتراضها بدل الاختفاء.
        const prefs = normalizeNotificationPrefs(req.body?.prefs);
        await store.setNotificationPrefs(userOf(req), prefs);
        res.json({ prefs });
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
    // مراقب الأسعار أدناه يعمل خارج نطاق createApp، فيحتاج نسخته الخاصة من
    // هامش الطيران — نفس الحساب الذي تجريه createApp داخلياً بلا حقن صريح
    const flightMktBoot = readCategoryMarkupPct('flight', process.env, markupPct);

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
        // أدمن البوابة: أسماء مستخدمين مفصولة بفواصل — بلا ضبط لا صفحة إدارة
        adminUsers: String(process.env.TRAVEL_ADMIN_USERS || '').split(',').map(s => s.trim()).filter(Boolean),
        duffelWebhookSecret: process.env.DUFFEL_WEBHOOK_SECRET || null,
        cronSecret: process.env.CRON_SECRET || null,
        // 💳 Stripe Checkout — sk_test_ للتجربة وsk_live_ للإنتاج، والسر
        // الثاني من إعداد الـwebhook في لوحة Stripe (whsec_...)
        stripeClient: createStripeClient({ secretKey: process.env.STRIPE_SECRET_KEY || null }),
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
        publicUrl: process.env.TRAVEL_PUBLIC_URL || null,
    });

    const port = Number(process.env.PORT || 4200);
    app.listen(port, () => {
        console.log(`✈️ بوابة السفر على المنفذ ${port} (المزوّد: ${provider.name}/${provider.mode || 'live'}، الفنادق: ${staysProvider.name}/${staysProvider.mode || 'live'}، السيارات: ${carsProvider.name}/${carsProvider.mode || 'live'}، التخزين: ${store.name}، الهامش: ${markupPct}%)`);
        if (!agent) console.warn('⚠️ الايجنت غير مفعَّل — اضبط TRAVEL_AGENT_API_KEY لتفعيل المساعد الحاجز.');
        if (provider.name === 'mock') console.warn('⚠️ مزوّد محاكاة — اضبط DUFFEL_API_KEY (يبدأ بـduffel_test للتجريبي).');
        if (process.env.STRIPE_SECRET_KEY) {
            const live = process.env.STRIPE_SECRET_KEY.startsWith('sk_live_');
            console.log(`💳 الدفع مفعَّل عبر Stripe (${live ? 'حساب حي' : 'وضع تجريبي sk_test'})${process.env.STRIPE_WEBHOOK_SECRET ? '' : ' — ⚠️ STRIPE_WEBHOOK_SECRET غير مضبوط: التسوية ستعتمد على المصالحة الدورية فقط'}.`);
            const bc = String(process.env.TRAVEL_BILLING_CURRENCY || '').trim().toUpperCase();
            console.log(bc
                ? `💱 التحصيل بعملة ${bc} (تحويل من عملة المزوّد بهامش صرف ${process.env.TRAVEL_FX_BUFFER_PCT || 2}% معلَن).`
                : '💱 التحصيل بعملة المزوّد — اضبط TRAVEL_BILLING_CURRENCY=SAR للتحصيل بالريال (شرط أي تقسيط خليجي لاحقاً).');
        } else {
            console.warn('⚠️ الدفع الإلكتروني غير مفعَّل — اضبط STRIPE_SECRET_KEY وSTRIPE_WEBHOOK_SECRET لتحصيل حجوزات الباقات فعلياً.');
        }
        if (store.name === 'file') {
            console.warn('⚠️ تخزين بالملفات — على منصة ذات قرص مؤقت تُمسح الحجوزات مع كل إعادة نشر. اضبط DATABASE_URL للإنتاج.');
        }
    });

    // 👁️ مراقب الأسعار: يعمل فقط أثناء يقظة الخدمة (لا setInterval يبقيها
    // مستيقظة عمداً) — على خطة استضافة مجانية تنام الخدمة بلا زيارات
    // فيتوقف الفحص حتى يوقظها أول طلب، وهذا حد منصة معروف لا خلل.
    async function runPriceWatchCheck() {
        try {
            const { checked, notified, errors } = await checkWatches({ store, provider, markupPct: flightMktBoot });
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
