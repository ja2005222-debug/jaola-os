/**
 * 🚗 duffelCarsProvider.js — مزوّد السيارات الحقيقي (Duffel Cars API)
 *
 * نفس حساب ونفس مفتاح Duffel المستخدَم للطيران والفنادق بالضبط
 * (duffel_test_/duffel_live_) — Duffel أطلقت "Cars" (أبريل ٢٠٢٦) بتسجيل
 * ذاتي كامل فوق أكثر من ٤٠ شركة تأجير (Avis, Sixt, Enterprise, Hertz,
 * Europcar...)، بلا اعتماد إضافي — نفس فلسفة "مزوّد واحد بمفتاح واحد"
 * التي نجحت مرتين (طيران ثم فنادق).
 *
 * ⚠️⚠️ صراحة أقوى من duffelStaysProvider.js: منتج Duffel Cars أُطلق بعد
 * حدّ معرفة هذا النموذج التدريبي، وduffel.com محجوب من بيئة التطوير
 * (سياسة وكيل الشبكة، لا علاقة لها بصحة الصيغة) — فمسارات الـAPI أدناه
 * **ليست منسوخة من توثيق مقروء فعلياً** كما هي حال duffelProvider.js/
 * duffelStaysProvider.js، بل **مُستنتَجة** من نمط Duffel الثابت عبر
 * منتجَيها الآخرين (بحث → قفل سعر/عرض → حجز → إلغاء)، وبمحاذاة تسمية
 * /stays/* لأقرب تخمين معقول (/cars/*). أول تشغيل بمفتاح Sandbox حقيقي
 * هو التحقق الفعلي الوحيد — أي رفض من Duffel يظهر برسالته الكاملة لا
 * فشلاً صامتاً، وقد يتطلب تصحيح مسارات/حقول بعد أول محاولة حقيقية.
 *
 * التدفق المُستنتَج (أربع خطوات، محاذاة لتدفق Stays):
 *   1. POST /cars/search — بحث بإحداثيات جغرافية لموقع الاستلام (نفس
 *      IATA/الإحداثيات المستخدَمة للفنادق) + وقتَي الاستلام والتسليم.
 *   2. POST /cars/quotes — يقفل سعر عرض محدد (rate id) قبل الحجز.
 *   3. GET /cars/quotes/:id — يجلب نفس عرض السعر القائم لإعادة التحقق
 *      دون إنشاء عرض جديد (تعادل getQuote لدى Stays).
 *   4. POST /cars/bookings — يحجز فعلياً من عرض سعر مؤكَّد (quote id) +
 *      بيانات السائق.
 */
import { createDuffelClient } from './duffelClient.js';
import { airportCoords } from '../airports.js';

export function normalizeDuffelCarResult(raw) {
    const rate = raw.cheapest_rate || (raw.rates || [])[0] || {};
    const vehicle = raw.vehicle || {};
    return {
        id: rate.id || raw.id,
        vehicleName: vehicle.name || 'سيارة',
        vehicleCategory: vehicle.acriss_code || vehicle.category || null,
        supplier: raw.supplier?.name || raw.vendor?.name || null,
        pickupLocation: raw.pickup?.location?.address?.city_name || null,
        netAmount: Number(rate.total_amount),
        currency: rate.total_currency,
        cancellable: !!rate.refundable_until || rate.payment_type === 'pay_at_pickup',
        expiresAt: rate.available_until || null,
    };
}

function normalizeQuote(quote) {
    return {
        id: quote.id,
        vehicleName: quote.vehicle?.name || 'سيارة',
        supplier: quote.supplier?.name || null,
        netAmount: Number(quote.total_amount),
        currency: quote.total_currency,
        pickupAt: quote.pickup_time,
        dropoffAt: quote.dropoff_time,
        expiresAt: quote.expires_at || null,
    };
}

export function createDuffelCarsProvider({ apiKey, apiUrl, fetchImpl }) {
    const client = createDuffelClient({ apiKey, apiUrl, fetchImpl });
    const duffel = client.request;

    return {
        name: 'duffel-cars',
        mode: client.mode,

        async searchCars({ iata, pickupAt, dropoffAt }) {
            const coords = airportCoords(iata);
            if (!coords) {
                throw new Error(`لا إحداثيات معروفة للوجهة ${iata} — بحث السيارات يحتاج مدينة مغطّاة.`);
            }
            const data = await duffel('POST', '/cars/search', {
                data: {
                    location: { geographic_coordinates: { latitude: coords.lat, longitude: coords.lon } },
                    pickup_time: pickupAt,
                    dropoff_time: dropoffAt,
                },
            });
            return (data.results || [])
                .map(normalizeDuffelCarResult)
                .filter(o => Number.isFinite(o.netAmount))
                .sort((a, b) => a.netAmount - b.netAmount)
                .slice(0, 10);
        },

        // rate_id (من searchCars) → يُنشئ عرض سعر (quote) جديداً ويقفله —
        // نفس تفرقة rate/quote لدى Stays بالضبط، لنفس السبب: quote id
        // المُعاد لا يُطعَم لهذه الدالة مرة أخرى، بل لـgetQuote أدناه.
        async getCarOffer(rateId) {
            try {
                const quote = await duffel('POST', '/cars/quotes', { data: { rate_id: rateId } });
                return normalizeQuote(quote);
            } catch (e) {
                if (/HTTP 404/.test(e.message)) return null;
                throw e;
            }
        },

        async getQuote(quoteId) {
            try {
                const quote = await duffel('GET', `/cars/quotes/${encodeURIComponent(quoteId)}`);
                return normalizeQuote(quote);
            } catch (e) {
                if (/HTTP 404/.test(e.message)) return null;
                throw e;
            }
        },

        async createCarOrder({ offerId, drivers, contact }) {
            const data = await duffel('POST', '/cars/bookings', {
                data: {
                    quote_id: offerId,
                    email: contact.email,
                    phone_number: contact.phone,
                    drivers: drivers.map(d => ({ given_name: d.givenName, family_name: d.familyName })),
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

        async cancelCarOrder(orderId) {
            const data = await duffel('POST', `/cars/bookings/${encodeURIComponent(orderId)}/actions/cancel`);
            return {
                status: 'cancelled',
                refundAmount: data.refund_amount != null ? Number(data.refund_amount) : null,
                currency: data.refund_currency || null,
            };
        },
    };
}
