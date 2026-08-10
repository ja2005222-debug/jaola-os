/**
 * 🏨 liteApiStaysProvider.js — مزوّد فنادق حقيقي (LiteAPI/Nuitee Connect)
 *
 * بديل مستقل تماماً عن Duffel Stays (حساب/مفاتيح منفصلة) — Sandbox key
 * يُصدر تلقائياً عند التسجيل بلا موافقة مبيعات (خلاف Duffel Stays وRateHawk
 * التقليديين).
 *
 * ✅ **مُتحقَّق منه حياً (١٠ أغسطس ٢٠٢٦)**: بحث فنادق أمستردام أعاد فنادق
 * وأسعاراً حقيقية، ثم اكتمل حجز فعلي بمرجع صادر من LiteAPI — أي أن
 * الخطوات ١–٤ أدناه (طلباتها **وردود نجاحها**) صحيحة كما هي مكتوبة، بما
 * فيها ما كان مُخمَّناً وقت الكتابة:
 *   1. GET api.liteapi.travel/v3.0/data/hotels — قائمة فنادق قرب إحداثيات.
 *      (كان شكل الرد مُستنتَجاً بالقياس على /data/hotel المفرد — أكّده
 *      البحث الحي.)
 *   2. POST api.liteapi.travel/v3.0/hotels/rates — أسعار؛ الطلب والرد
 *      مؤكَّدان من رد Sandbox حي.
 *   3. POST book.liteapi.travel/v3.0/rates/prebook — قفل السعر؛ استخراج
 *      `prebookId` كان تخميناً مبنياً على شكل رد الخطأ، وأثبته نجاح الحجز.
 *   4. POST book.liteapi.travel/v3.0/rates/book — إتمام الحجز؛ استخراج
 *      `bookingId`/المرجع كان تخميناً كذلك، وأثبته نفس الحجز الناجح.
 *      ملاحظة: `payment.gateway=STRIPE` إلزامي في صيغة الطلب، لكن الحجز
 *      نجح فعلياً على Sandbox **بلا تهيئة Stripe** — الافتراض السابق بأن
 *      التجربة تنتظر Stripe كان خاطئاً (يبقى الإنتاج الحقيقي بحاجة إليه).
 *   5. PUT book.liteapi.travel/v3.0/bookings/{bookingId} — إلغاء؛ **نجح
 *      حياً** (الحجز انتقل إلى cancelled فعلياً). ⚠️ لكن **مبلغ الاسترداد
 *      عاد null** في ذلك الإلغاء الحي — إما أن مسارات الحقول المُخمَّنة
 *      أدناه (`refundAmount`/`refund.amount`) لا تطابق الشكل الحقيقي، أو
 *      أن LiteAPI لا يُعيد مبلغاً في رد الإلغاء أصلاً. لم نميّز بين
 *      الاحتمالين بعد (يلزم رصد الرد الخام لإلغاء حي)، فالسلوك الحالي
 *      متعمَّد: null صريح بدل رقم مُختلَق. خلاف Duffel الذي أعاد مبلغ
 *      استرداد فعلياً في نفس الجولة.
 */
import { createLiteApiClient } from './liteApiClient.js';
import { airportCoords } from '../airports.js';

const DEFAULT_BOOK_API_URL = 'https://book.liteapi.travel/v3.0';
const SEARCH_RADIUS_M = 15000;
const MAX_HOTELS_PER_SEARCH = 20;
const MAX_RESULTS = 10;
const OFFER_TTL_MS = 3 * 60 * 60 * 1000; // مطابق لـet:10800 (ثانية) بالرد الحقيقي المُشاهَد

function nightsBetween(checkIn, checkOut) {
    return Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
}

/** يبني occupancies بشكل غرفة واحدة لكل عنصر — نفس بنية المثال الحقيقي المُشاهَد. */
function buildOccupancies(adults, rooms) {
    const perRoom = Math.max(1, Math.round(adults / rooms));
    return Array.from({ length: rooms }, () => ({ rooms: 1, adults: perRoom }));
}

export function createLiteApiStaysProvider({ apiKey, apiUrl, bookApiUrl, fetchImpl }) {
    const client = createLiteApiClient({ apiKey, apiUrl, fetchImpl });
    const bookClient = createLiteApiClient({ apiKey, apiUrl: bookApiUrl || DEFAULT_BOOK_API_URL, fetchImpl });
    const liteApi = client.request;
    const liteApiBook = bookClient.request;
    const offerCache = new Map(); // offerId (بحث) → { offer, expiresAt }
    const quoteCache = new Map(); // prebookId → { offerId, offer, expiresAt }

    return {
        name: 'liteapi-stays',
        mode: client.mode,

        async searchStays({ iata, checkInDate, checkOutDate, adults = 1, rooms = 1 }) {
            const coords = airportCoords(iata);
            if (!coords) {
                throw new Error(`لا إحداثيات معروفة للوجهة ${iata} — بحث الفنادق يحتاج مدينة مغطّاة.`);
            }
            const hotelsRes = await liteApi('GET',
                `/data/hotels?latitude=${coords.lat}&longitude=${coords.lon}&radius=${SEARCH_RADIUS_M}&limit=${MAX_HOTELS_PER_SEARCH}`);
            const hotels = hotelsRes.data || [];
            if (hotels.length === 0) return [];
            const hotelMeta = new Map(hotels.map(h => [h.id, h]));

            const ratesRes = await liteApi('POST', '/hotels/rates', {
                hotelIds: hotels.map(h => h.id),
                occupancies: buildOccupancies(adults, rooms),
                currency: 'USD',
                guestNationality: 'US',
                checkin: checkInDate,
                checkout: checkOutDate,
                timeout: 6,
                roomMapping: true,
            });

            const nights = nightsBetween(checkInDate, checkOutDate);
            const now = Date.now();
            const results = [];
            for (const hotelEntry of ratesRes.data || []) {
                const meta = hotelMeta.get(hotelEntry.hotelId);
                const expiresAt = new Date(now + (Number(hotelEntry.et) || 10800) * 1000).toISOString();
                for (const roomType of hotelEntry.roomTypes || []) {
                    const firstRate = (roomType.rates || [])[0] || {};
                    const offer = {
                        id: roomType.offerId,
                        name: [meta?.name, firstRate.name].filter(Boolean).join(' — ') || 'فندق',
                        city: meta?.city || coords.city,
                        country: meta?.country || coords.country,
                        rating: meta?.starRating ?? meta?.rating ?? null,
                        checkInDate, checkOutDate, nights, adults, rooms,
                        netAmount: Number(roomType.offerRetailRate?.amount),
                        currency: roomType.offerRetailRate?.currency,
                        cancellable: firstRate.cancellationPolicies?.refundableTag === 'RFN',
                        expiresAt,
                    };
                    if (!Number.isFinite(offer.netAmount)) continue;
                    offerCache.set(offer.id, { offer, expiresAt: now + OFFER_TTL_MS });
                    results.push(offer);
                }
            }
            return results.sort((a, b) => a.netAmount - b.netAmount).slice(0, MAX_RESULTS);
        },

        async getStayOffer(offerId) {
            const cached = offerCache.get(String(offerId || ''));
            if (!cached || cached.expiresAt < Date.now()) return null;
            return { ...cached.offer };
        },

        // rate offerId (من searchStays) → يقفل السعر عبر /rates/prebook.
        // معرّف العرض المُعاد (prebookId) هو ما تستخدمه createStayOrder
        // لاحقاً — نفس تفرقة rate/quote لدى Duffel Stays بالضبط.
        async getQuote(offerId) {
            const cached = offerCache.get(String(offerId || ''));
            if (!cached || cached.expiresAt < Date.now()) return null;
            const data = await liteApiBook('POST', '/rates/prebook', {
                offerId: cached.offer.id,
                usePaymentSdk: false,
                voucherCode: '',
                addons: [],
                bedTypeIds: [],
                includeCreditBalance: false,
                payment: { gateway: 'STRIPE', useOwnSecretKey: false },
            });
            // ⚠️ مسار الحقول أدناه غير مُتحقَّق ضد رد نجاح فعلي (راجع
            // التحذير أعلى الملف) — احتياط دفاعي بمسارات محتملة متعددة
            // بدل افتراض واحد قد يكون خاطئاً بصمت.
            const prebookId = data?.data?.prebookId || data?.prebookId;
            if (!prebookId) {
                throw new Error('رد /rates/prebook بلا prebookId — راجع الشكل الفعلي وحدّث الصيغة (لم يصل رد نجاح حقيقي بعد وقت كتابة هذا الكود).');
            }
            const quote = { ...cached.offer, id: prebookId };
            quoteCache.set(prebookId, { offerId: cached.offer.id, offer: quote, expiresAt: Date.now() + OFFER_TTL_MS });
            return quote;
        },

        // prebookId (من getQuote) → يُتمّ الحجز فعلياً عبر /rates/book.
        // ⚠️ يتطلب Stripe مُهيَّأ فعلياً (payment.gateway=STRIPE عند
        // prebook) — لا يُختبَر حياً حتى تُضبط بيانات الدفع الحقيقية.
        async createStayOrder({ offerId, guests, contact }) {
            const cached = quoteCache.get(String(offerId || ''));
            if (!cached) throw new Error('عرض الفندق غير موجود أو انتهت صلاحيته — أعد البحث والتحقق من السعر.');
            const holderName = guests[0] || {};
            const data = await liteApiBook('POST', '/rates/book', {
                prebookId: offerId,
                holder: {
                    firstName: holderName.givenName || '',
                    lastName: holderName.familyName || '',
                    email: contact.email,
                    phone: contact.phone,
                },
                guests: guests.map((g, i) => ({
                    occupancyNumber: i + 1,
                    firstName: g.givenName,
                    lastName: g.familyName,
                    email: contact.email,
                })),
                payment: { method: 'ACC_CREDIT_CARD' },
            });
            // ⚠️ نفس تحذير getQuote أعلاه — مسار الحقول تخمين مبني على
            // تناسق الشكل العام لردود LiteAPI، لا رد نجاح فعلي مُشاهَد.
            const booking = data?.data || data?.booking || data;
            const bookingId = booking?.bookingId || booking?.id;
            if (!bookingId) {
                throw new Error('رد /rates/book بلا معرّف حجز واضح — راجع الشكل الفعلي وحدّث الصيغة (لم يصل رد نجاح حقيقي بعد وقت كتابة هذا الكود).');
            }
            return {
                orderId: bookingId,
                bookingReference: booking.bookingReference || booking.confirmationNumber || String(bookingId),
                status: 'issued',
                netAmount: cached.offer.netAmount,
                currency: cached.offer.currency,
            };
        },

        // bookingId (من createStayOrder) → إلغاء عبر PUT /bookings/{id}.
        async cancelStayOrder(orderId) {
            const data = await liteApiBook('PUT', `/bookings/${encodeURIComponent(orderId)}`);
            // ⚠️ نفس تحذير getQuote/createStayOrder — مسار الحقول تخمين
            // مبني على تناسق شكل ردود LiteAPI، لا رد نجاح فعلي مُشاهَد.
            const result = data?.data || data;
            return {
                status: 'cancelled',
                refundAmount: result?.refundAmount ?? result?.refund?.amount ?? null,
                currency: result?.currency ?? result?.refund?.currency ?? null,
            };
        },
    };
}
