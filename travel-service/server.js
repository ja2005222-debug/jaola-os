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
import { buildProvider, buildStaysProvider } from './src/providers/index.js';
import { buildTravelAgent } from './src/agent/agent.js';
import { airportCoords } from './src/airports.js';
import { createPriceWatch, listPriceWatchesByUser, cancelPriceWatch } from './src/priceWatches.js';
import { checkWatches } from './src/priceWatchPoller.js';
import { getDestinationWeather, convertCurrency, MAX_FORECAST_DAYS_AHEAD } from './src/travelInfo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CABINS = ['economy', 'premium_economy', 'business', 'first'];
const MAX_ADULTS = 9;
const MAX_CHILDREN = 8;
const MAX_ROOMS = 5;
const MAX_STAY_NIGHTS = 30;
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
const NAME_RE = /^[A-Za-z][A-Za-z' -]{0,39}$/; // لاتينية كما في الجواز — شرط المزوّدين
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;

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
    const phone = String(body?.contact?.phone || '').replace(/[\s-]/g, '');
    if (!EMAIL_RE.test(email)) return { error: 'بريد تواصل صالح مطلوب.' };
    if (!PHONE_RE.test(phone)) return { error: 'هاتف تواصل صالح مطلوب (أرقام دولية).' };
    return { values: { guests: clean, contact: { email, phone } } };
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

export function createApp({
    store,
    jwtSecret,
    provider,
    staysProvider = null,
    agent = null,
    markupPct = readMarkupPct(),
    travelInfoFetch = fetch, // قابل للحقن في الاختبارات (طقس/عملة بلا شبكة حقيقية)
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
        return publicBooking(cancelled || await getBooking(store, booking.id));
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
        const offers = await staysProvider.searchStays(check.values);
        return offers.map(o => publicOffer(o, markupPct));
    }

    async function doGetStayOffer(offerId) {
        requireStays();
        const offer = await staysProvider.getStayOffer(String(offerId || ''));
        return offer ? publicOffer(offer, markupPct) : null;
    }

    async function doBookStay(username, { offerId, guests, contact }) {
        requireStays();
        const offer = await staysProvider.getStayOffer(String(offerId || ''));
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
        return publicBooking(cancelled || await getBooking(store, booking.id));
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
    const agent = buildTravelAgent();
    const markupPct = readMarkupPct();

    await store.init(); // ينشئ الجداول عند أول إقلاع — فشلٌ صاخب إن تعذّر

    const app = createApp({
        store,
        // السر السابق (اختياري) يُقبل أثناء تدوير المفتاح فقط — يُزال بعده.
        jwtSecret: [process.env.JWT_SECRET, process.env.JWT_SECRET_PREVIOUS],
        provider,
        staysProvider,
        agent,
        markupPct,
    });

    const port = Number(process.env.PORT || 4200);
    app.listen(port, () => {
        console.log(`✈️ بوابة السفر على المنفذ ${port} (المزوّد: ${provider.name}/${provider.mode || 'live'}، الفنادق: ${staysProvider.name}/${staysProvider.mode || 'live'}، التخزين: ${store.name}، الهامش: ${markupPct}%)`);
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
