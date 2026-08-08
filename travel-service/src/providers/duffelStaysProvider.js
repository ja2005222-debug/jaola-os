/**
 * 🏨 duffelStaysProvider.js — مزوّد الفنادق الحقيقي (Duffel Stays API)
 *
 * نفس حساب ونفس مفتاح Duffel المستخدَم للطيران بالضبط (duffel_test_/
 * duffel_live_) — Duffel وسّعت من طيران فقط إلى "Stays" بتسجيل ذاتي
 * كامل، فلا اعتماد جديد ولا اتفاقية شريك مطلوبة (خلاف RateHawk/Hotelbeds
 * التقليديين). التدفق أربع خطوات وفق التوثيق المنشور:
 *   1. POST /stays/search — بحث بإحداثيات جغرافية (لا رمز مدينة نصي)
 *      + تواريخ الإقامة، يُعيد نتائج بها أرخص سعر لكل عقار.
 *   2. GET /stays/accommodation/:id — تفاصيل الأسعار الكاملة لعقار محدد.
 *   3. POST /stays/quotes — يقفل سعر معدل محدد (rate id) قبل الحجز
 *      (الأسعار تنتهي كعروض الطيران تماماً).
 *   4. POST /stays/bookings — يحجز فعلياً من عرض سعر مؤكَّد (quote id) +
 *      بيانات الضيوف.
 *
 * ⚠️ نفس صراحة duffelProvider.js بالضبط: الصيغ أعلاه من التوثيق المنشور
 * ولم تُجرَّب ضد Sandbox حي من هذه البيئة — أول تشغيل بمفتاح حقيقي هو
 * الاختبار الفعلي، وأي رفض يظهر بتفصيل رد Duffel لا فشلاً صامتاً.
 */
import { createDuffelClient } from './duffelClient.js';
import { airportCoords } from '../airports.js';

const SEARCH_RADIUS_KM = 15;

/** يطبّع نتيجة بحث Duffel Stays الخام إلى شكل العرض الموحّد. */
export function normalizeDuffelStayResult(raw) {
    const rate = raw.cheapest_rate || (raw.rates || [])[0] || {};
    return {
        id: rate.id || raw.id,
        accommodationId: raw.accommodation?.id || raw.id,
        name: raw.accommodation?.name || raw.name || 'فندق',
        city: raw.accommodation?.location?.address?.city_name || null,
        country: raw.accommodation?.location?.address?.country_code || null,
        rating: raw.accommodation?.rating ?? null,
        netAmount: Number(rate.total_amount),
        currency: rate.total_currency,
        cancellable: !!rate.refundable_until || rate.payment_type === 'pay_at_property',
        expiresAt: rate.available_until || null,
    };
}

/** يطبّع رد Duffel لعرض سعر (quote) خام — نفس الشكل من إنشاء أو جلب. */
function normalizeQuote(quote) {
    return {
        id: quote.id,
        accommodationId: quote.accommodation?.id || null,
        name: quote.accommodation?.name || 'فندق',
        netAmount: Number(quote.total_amount),
        currency: quote.total_currency,
        checkInDate: quote.check_in_date,
        checkOutDate: quote.check_out_date,
        expiresAt: quote.expires_at || null,
    };
}

export function createDuffelStaysProvider({ apiKey, apiUrl, fetchImpl }) {
    const client = createDuffelClient({ apiKey, apiUrl, fetchImpl });
    const duffel = client.request;

    return {
        name: 'duffel-stays',
        mode: client.mode,

        async searchStays({ iata, checkInDate, checkOutDate, adults = 1, rooms = 1 }) {
            const coords = airportCoords(iata);
            if (!coords) {
                throw new Error(`لا إحداثيات معروفة للوجهة ${iata} — بحث الفنادق يحتاج مدينة مغطّاة.`);
            }
            const data = await duffel('POST', '/stays/search', {
                data: {
                    location: {
                        geographic_coordinates: { latitude: coords.lat, longitude: coords.lon },
                        radius: SEARCH_RADIUS_KM,
                    },
                    check_in_date: checkInDate,
                    check_out_date: checkOutDate,
                    rooms,
                    guests: Array.from({ length: adults }, () => ({ type: 'adult' })),
                },
            });
            return (data.results || [])
                .map(normalizeDuffelStayResult)
                .filter(o => Number.isFinite(o.netAmount))
                .sort((a, b) => a.netAmount - b.netAmount)
                .slice(0, 10);
        },

        // rate_id (من searchStays) → يُنشئ عرض سعر (quote) جديداً ويقفله.
        // معرّف العرض المُعاد بعد هذه النقطة هو quote id لا rate id — لا
        // يُطعَم لهذه الدالة مرة أخرى (كل نداء يُنشئ quote منفصلاً)، بل
        // لـgetQuote أدناه عند الحاجة لإعادة التحقق قبل الحجز.
        async getStayOffer(rateId) {
            try {
                const quote = await duffel('POST', '/stays/quotes', { data: { rate_id: rateId } });
                return normalizeQuote(quote);
            } catch (e) {
                if (/HTTP 404/.test(e.message)) return null;
                throw e;
            }
        },

        // quote_id (من getStayOffer) → يجلب نفس عرض السعر القائم دون
        // إنشاء quote جديد — تستخدمها doBookStay لإعادة التحقق من السعر
        // قبل الحجز مباشرة (نظير getOffer لدى الطيران، لكن بنقطة نهاية
        // مختلفة لأن Duffel Stays تفرّق بين إنشاء العرض وجلبه).
        async getQuote(quoteId) {
            try {
                const quote = await duffel('GET', `/stays/quotes/${encodeURIComponent(quoteId)}`);
                return normalizeQuote(quote);
            } catch (e) {
                if (/HTTP 404/.test(e.message)) return null;
                throw e;
            }
        },

        async createStayOrder({ offerId, guests, contact }) {
            const data = await duffel('POST', '/stays/bookings', {
                data: {
                    quote_id: offerId,
                    email: contact.email,
                    phone_number: contact.phone,
                    guests: guests.map(g => ({ given_name: g.givenName, family_name: g.familyName })),
                    payment: { type: 'balance' },
                },
            });
            return {
                orderId: data.id,
                bookingReference: data.reference || data.id,
                status: 'issued',
                netAmount: Number(data.total_amount),
                currency: data.total_currency,
            };
        },

        async cancelStayOrder(orderId) {
            const data = await duffel('POST', `/stays/bookings/${encodeURIComponent(orderId)}/actions/cancel`);
            return {
                status: 'cancelled',
                refundAmount: data.refund_amount != null ? Number(data.refund_amount) : null,
                currency: data.refund_currency || null,
            };
        },
    };
}
