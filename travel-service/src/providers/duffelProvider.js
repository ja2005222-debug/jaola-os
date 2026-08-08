/**
 * ✈️ duffelProvider.js — مزوّد الطيران الحقيقي (Duffel API v2)
 *
 * لماذا Duffel أولاً: أسهل onboarding في السوق (Sandbox فوري بلا شركة)،
 * وبحث+حجز+إلغاء كلها REST API واحد حديث — لا حاجة لاعتماد IATA.
 *
 * التدفق (وفق توثيق Duffel المنشور):
 *   1. POST /air/offer_requests?return_offers=true — يُرجع العروض **مع
 *      معرّفات ركاب** ولّدها Duffel؛ الحجز لاحقاً يجب أن يستخدم نفس
 *      المعرّفات، لذا يحملها العرض المطبَّع (passengerIds) ويخزنها الحجز.
 *   2. GET /air/offers/:id — تسعير مُحدَّث قبل الحجز (العروض تنتهي).
 *   3. POST /air/orders — payments بنوع balance (رصيد Duffel: في Sandbox
 *      وهمي دوماً، وفي الإنتاج يُشحن مسبقاً) — لا بطاقات في المرحلة ١.
 *   4. POST /air/order_cancellations ثم /:id/actions/confirm — إلغاء
 *      على خطوتين (عرض مبلغ الاسترداد ثم تأكيد) نختصرهما هنا بخطوة واحدة.
 *
 * ⚠️ الصيغ أعلاه من توثيق Duffel الرسمي ولم تُجرَّب من هذه الخدمة ضد
 * Sandbox حي بعد (لا مفتاح في بيئة التطوير) — نفس صراحة ملاحظات Shotstack
 * غير المجرَّبة. أول تشغيل بمفتاح حقيقي هو الاختبار الفعلي، وأي رفض يظهر
 * بتفصيل رد Duffel لا فشلاً صامتاً.
 */

import { createDuffelClient } from './duffelClient.js';

/** يطبّع عرض Duffel الخام إلى شكل العرض الموحّد الذي يفهمه بقية النظام. */
export function normalizeDuffelOffer(raw, passengerIds) {
    const slices = (raw.slices || []).map(slice => {
        const segments = (slice.segments || []).map(seg => ({
            origin: seg.origin?.iata_code,
            destination: seg.destination?.iata_code,
            departAt: seg.departing_at,
            arriveAt: seg.arriving_at,
            carrier: seg.marketing_carrier?.name || seg.operating_carrier?.name || '',
            flightNumber: `${seg.marketing_carrier?.iata_code || ''}${seg.marketing_carrier_flight_number || ''}`,
        }));
        const first = segments[0] || {};
        const last = segments[segments.length - 1] || {};
        // مدة الرحلة من فرق التوقيتين الفعليين — duration الخام صيغة ISO8601
        // نصية (PT2H30M) لا نحتاج تفكيكها ما دام لدينا الطرفان.
        const durationMin = first.departAt && last.arriveAt
            ? Math.round((new Date(last.arriveAt) - new Date(first.departAt)) / 60000)
            : null;
        return {
            origin: first.origin, destination: last.destination,
            departAt: first.departAt, arriveAt: last.arriveAt,
            durationMin, stops: Math.max(0, segments.length - 1), segments,
        };
    });
    return {
        id: raw.id,
        owner: raw.owner?.name || '',
        netAmount: Number(raw.total_amount),
        currency: raw.total_currency,
        cabin: raw.cabin_class || null,
        passengerCount: (raw.passengers || []).length || passengerIds.length,
        expiresAt: raw.expires_at || null,
        passengerIds,
        slices,
    };
}

export function createDuffelProvider({ apiKey, apiUrl, fetchImpl }) {
    const client = createDuffelClient({ apiKey, apiUrl, fetchImpl });
    const duffel = client.request;

    return {
        name: 'duffel',
        mode: client.mode,

        async searchOffers({ origin, destination, departDate, returnDate = null, adults = 1, children = 0, cabin = 'economy' }) {
            const slices = [{ origin, destination, departure_date: departDate }];
            if (returnDate) slices.push({ origin: destination, destination: origin, departure_date: returnDate });
            const passengers = [
                ...Array.from({ length: adults }, () => ({ type: 'adult' })),
                ...Array.from({ length: children }, () => ({ age: 8 })),
            ];
            const data = await duffel('POST', '/air/offer_requests?return_offers=true', {
                data: { slices, passengers, cabin_class: cabin },
            });
            const passengerIds = (data.passengers || []).map(p => p.id);
            // أرخص 10 عروض تكفي شاشة النتائج — Duffel قد يعيد المئات
            return (data.offers || [])
                .slice()
                .sort((a, b) => Number(a.total_amount) - Number(b.total_amount))
                .slice(0, 10)
                .map(o => normalizeDuffelOffer(o, passengerIds));
        },

        async getOffer(offerId) {
            try {
                const raw = await duffel('GET', `/air/offers/${encodeURIComponent(offerId)}`);
                const passengerIds = (raw.passengers || []).map(p => p.id);
                return normalizeDuffelOffer(raw, passengerIds);
            } catch (e) {
                // عرض منتهي/مجهول = null (يعامله الخادم 404) — أخطاء أخرى تصعد
                if (/HTTP 404/.test(e.message)) return null;
                throw e;
            }
        },

        async createOrder({ offerId, passengers, contact }) {
            const offer = await this.getOffer(offerId);
            if (!offer) throw new Error('العرض غير موجود أو انتهت صلاحيته.');
            const duffelPassengers = passengers.map((p, i) => ({
                id: offer.passengerIds[i],
                title: p.title,
                given_name: p.givenName,
                family_name: p.familyName,
                born_on: p.bornOn,
                gender: p.gender,
                email: contact.email,
                phone_number: contact.phone,
            }));
            const data = await duffel('POST', '/air/orders', {
                data: {
                    selected_offers: [offerId],
                    passengers: duffelPassengers,
                    payments: [{ type: 'balance', amount: String(offer.netAmount), currency: offer.currency }],
                },
            });
            return {
                orderId: data.id,
                bookingReference: data.booking_reference,
                status: 'issued',
                netAmount: Number(data.total_amount),
                currency: data.total_currency,
            };
        },

        async cancelOrder(orderId) {
            const quote = await duffel('POST', '/air/order_cancellations', {
                data: { order_id: orderId },
            });
            const confirmed = await duffel('POST', `/air/order_cancellations/${quote.id}/actions/confirm`);
            return {
                status: 'cancelled',
                refundAmount: confirmed.refund_amount != null ? Number(confirmed.refund_amount) : null,
                currency: confirmed.refund_currency || null,
            };
        },
    };
}
