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
import { declaredNumber } from '../declaredNumber.js';

const DEFAULT_BOOK_API_URL = 'https://book.liteapi.travel/v3.0';
const SEARCH_RADIUS_M = 15000;
const MAX_HOTELS_PER_SEARCH = 20;
const MAX_RESULTS = 10;
const MAX_DETAIL_IMAGES = 8;      // كفاية لمعرض مصغَّر بلا إثقال الرد
const MAX_DETAIL_FACILITIES = 30; // بعض الفنادق تُعيد مئات المرافق
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
                // ⏳ «صلاحية السعر حتى ...» تُقال للمسافر سطراً جازماً، فلا
                // تُختلق: مدّةٌ **مُعلَنةٌ موجبة** وحدها تُعرض، وما عداها
                // (سكوتٌ أو صفر) لا يُقال فيه شيء — نفس ما يفعله مزوّدو
                // Duffel الثلاثة (`|| null`) ومزوّد العقود أصلاً.
                // 📌 ولا يقرّر هذا معنى `et: 0` عند المزوّد: `OFFER_TTL_MS`
                // الذي يحكم بقاء العرض قابلاً للحجز لم يُمَسّ.
                const etSeconds = declaredNumber(hotelEntry.et);
                const expiresAt = etSeconds !== null && etSeconds > 0
                    ? new Date(now + etSeconds * 1000).toISOString()
                    : null;
                for (const roomType of hotelEntry.roomTypes || []) {
                    const firstRate = (roomType.rates || [])[0] || {};
                    const policy = firstRate.cancellationPolicies || {};
                    const offer = {
                        id: roomType.offerId,
                        name: [meta?.name, firstRate.name].filter(Boolean).join(' — ') || 'فندق',
                        hotelId: hotelEntry.hotelId, // لجلب تفاصيل الفندق لاحقاً
                        hotelName: meta?.name || null,
                        roomName: firstRate.name || null,
                        city: meta?.city || coords.city,
                        country: meta?.country || coords.country,
                        rating: meta?.starRating ?? meta?.rating ?? null,
                        checkInDate, checkOutDate, nights, adults, rooms,
                        netAmount: Number(roomType.offerRetailRate?.amount),
                        currency: roomType.offerRetailRate?.currency,
                        cancellable: policy.refundableTag === 'RFN',
                        // تفاصيل تصل من المزوّد وكانت تُهمَل: نوع الإقامة،
                        // سعة الغرفة، موعد آخر إلغاء مجاني، والرسوم
                        // **غير المشمولة** بالسعر (تُدفع في الفندق مباشرةً —
                        // لا هامش عليها لأنها ليست جزءاً مما نبيعه).
                        boardName: firstRate.boardName || null,
                        maxOccupancy: firstRate.maxOccupancy ?? null,
                        cancelPolicy: (policy.cancelPolicyInfos || []).map(p => ({
                            before: p.cancelTime || null,
                            amount: p.amount ?? null,
                            currency: p.currency || null,
                        })),
                        feesAtProperty: (firstRate.retailRate?.taxesAndFees || [])
                            .filter(f => f && f.included === false)
                            .map(f => ({
                                description: f.description || null,
                                amount: f.amount ?? null,
                                currency: f.currency || null,
                            })),
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

        /**
         * تفاصيل فندق للعرض (صور/وصف/مرافق/تقييم/أوقات الدخول والخروج).
         * ✅ شكل الرد **موثَّق حرفياً** في دليل LiteAPI المنشور
         * ("Displaying Essential Hotel Details") — لا تخمين: كل حقل
         * مقروء أدناه ورد في مثال JSON الرسمي الكامل.
         * بلا سعر إطلاقاً — الأسعار تأتي حصراً من مسار البحث المُسعَّر
         * (فلا يلتف أحد حول تطبيق الهامش من هنا).
         */
        async getHotelDetails(hotelId) {
            const res = await liteApi('GET', `/data/hotel?hotelId=${encodeURIComponent(hotelId)}`);
            const d = res.data;
            if (!d) return null;
            return {
                id: d.id || hotelId,
                name: d.name || null,
                description: d.hotelDescription || null,
                importantInformation: d.hotelImportantInformation || null,
                address: d.address || null,
                city: d.city || null,
                country: d.country || null,
                starRating: d.starRating ?? null,
                reviewRating: d.rating ?? null,
                reviewCount: d.reviewCount ?? null,
                checkinTime: d.checkinCheckoutTimes?.checkin || null,
                checkoutTime: d.checkinCheckoutTimes?.checkout || null,
                location: d.location?.latitude != null && d.location?.longitude != null
                    ? { lat: d.location.latitude, lon: d.location.longitude }
                    : null,
                images: (d.hotelImages || [])
                    .slice(0, MAX_DETAIL_IMAGES)
                    .map(i => ({ url: i.url || null, caption: i.caption || null }))
                    .filter(i => i.url),
                facilities: (d.hotelFacilities || []).slice(0, MAX_DETAIL_FACILITIES),
            };
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
            // ✅ صار مُتحقَّقاً: الحجز الحي الناجح (راجع رأس الملف) أثبت أن
            // استخراج `prebookId` أدناه صحيح. تعدّد المسارات باقٍ احتياطاً
            // دفاعياً لا شكّاً — كان تخميناً وقت الكتابة فأكّدته التجربة.
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
            // ✅ نفس حال getQuote: كان تخميناً، وأثبته حجزٌ حيّ ناجح بمرجع
            // فعلي صادر من LiteAPI (راجع رأس الملف).
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
            // ⚠️ الإلغاء نفسه **نجح حياً** (الحجز انتقل إلى cancelled)، لكن
            // `refundAmount` عاد `null` — ولم نميّز بعدُ: أمسارات الحقول
            // أدناه خاطئة أم أن LiteAPI لا يُعيد مبلغاً أصلاً؟ لذلك يبقى
            // `null` صريحاً بدل رقمٍ مخترَع.
            //
            // 💸 وهذا `null` **ليس صفراً**: `refundPlanFor` في `server.js`
            // يميّزهما صراحةً ويسقط على جدول الغرامة المعلن للمسافر.
            const result = data?.data || data;
            return {
                status: 'cancelled',
                refundAmount: result?.refundAmount ?? result?.refund?.amount ?? null,
                currency: result?.currency ?? result?.refund?.currency ?? null,
            };
        },
    };
}
