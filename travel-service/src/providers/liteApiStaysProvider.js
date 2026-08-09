/**
 * 🏨 liteApiStaysProvider.js — مزوّد فنادق حقيقي (LiteAPI/Nuitee Connect)
 *
 * بديل مستقل تماماً عن Duffel Stays (حساب/مفاتيح منفصلة) — Sandbox key
 * يُصدر تلقائياً عند التسجيل بلا موافقة مبيعات (خلاف Duffel Stays وRateHawk
 * التقليديين). صيغ البحث أدناه مأخوذة **حرفياً** من Code Snippets حقيقية
 * ورد Sandbox فعلي حي شُوهدا مباشرة بلوحة العميل (API Playground) —
 * ليست من توثيق مقروء وحده كـduffelStaysProvider، بل مُختبَرة فعلاً قبل
 * كتابة هذا الملف:
 *   1. GET /data/hotels?latitude=&longitude=&radius=&limit= — قائمة فنادق
 *      قرب إحداثيات (⚠️ شكل رد هذا المسار تحديداً **غير مؤكَّد بلقطة
 *      شاشة** خلاف بقية الملف — استُنتج بالقياس على /data/hotel المفرد
 *      الموثَّق فعلاً في دليل "Displaying Essential Hotel Details"، لأن
 *      كلا المسارين REST متجانسان تحت فئة Hotel Data نفسها).
 *   2. POST /hotels/rates — بحث أسعار فعلي بمعرّفات الفنادق أعلاه؛
 *      **الطلب والرد كلاهما مؤكَّدان حرفياً** من رد Sandbox حي حقيقي.
 *
 * ⚠️ الحجز الفعلي (checkout session/prebook + complete booking عبر
 * book.liteapi.travel) والإلغاء **لم تصل صيغتهما بعد** — getQuote/
 * createStayOrder/cancelStayOrder ترمي خطأً صريحاً بدل تخمين صيغة لم
 * تُر: نفس معيار الصراحة المتّبع في كل مزوّد بهذا المجلد، لا استثناء.
 */
import { createLiteApiClient } from './liteApiClient.js';
import { airportCoords } from '../airports.js';

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

export function createLiteApiStaysProvider({ apiKey, apiUrl, fetchImpl }) {
    const client = createLiteApiClient({ apiKey, apiUrl, fetchImpl });
    const liteApi = client.request;
    const offerCache = new Map(); // offerId → { offer, expiresAt }

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

        // ⚠️ غير مُنفَّذة بعد: تحتاج صيغة "Create a checkout session
        // (PREBOOK)" الحقيقية لإعادة قفل/تحقق السعر قبل الحجز — لا نُخمّن
        // صيغتها. حالياً ترمي خطأً واضحاً بدل ادّعاء دعم غير حقيقي.
        async getQuote() {
            throw new Error('حجز فنادق LiteAPI: خطوة تأكيد السعر (checkout session) لم تُبنَ بعد — التوثيق الفعلي لم يصل.');
        },
        async createStayOrder() {
            throw new Error('حجز فنادق LiteAPI: خطوة إتمام الحجز (complete booking) لم تُبنَ بعد — التوثيق الفعلي لم يصل.');
        },
        async cancelStayOrder() {
            throw new Error('إلغاء حجوزات LiteAPI لم يُبنَ بعد — التوثيق الفعلي لم يصل.');
        },
    };
}
