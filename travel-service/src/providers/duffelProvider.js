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
import { buildSearchPassengers } from '../passengerAges.js';

const MAX_RESULTS = 10; // ما يكفي شاشة النتائج — Duffel قد يعيد المئات

// ⚠️ إثراء اختياري (المرحلة ٢ج): Duffel يُرجع أمتعة كل راكب لكل قطاع عبر
// slice.segments[].passengers[].baggages وفق التوثيق العام — لم يُتحقَّق
// منه ضد رد حي بعد (نفس صراحة الملف كله). غياب الحقل لا يكسر شيئاً —
// baggage تبقى null والوكيل يعتذر بدل اختلاق معلومة.
function extractBaggage(seg) {
    const baggages = seg.passengers?.[0]?.baggages;
    if (!Array.isArray(baggages) || baggages.length === 0) return null;
    return baggages.map(b => ({ type: b.type || null, quantity: b.quantity ?? null }));
}

/**
 * يوحّد قائمة ركاب Duffel: قد تصل معرّفات مجرّدة (نصوص) أو كائنات تحمل
 * `type`/`age` معها. الأعمار هي ما سُعِّر به العرض فعلاً، ويطابقها الخادم
 * بتواريخ الميلاد قبل الحجز — فغيابها يعطّل الفحص ولا يكسره.
 */
function normalizePassengerRefs(list) {
    return (list || []).map(p => (typeof p === 'string'
        ? { id: p, type: null, age: null }
        : { id: p?.id ?? null, type: p?.type ?? null, age: p?.age ?? null }));
}

/** يطبّع عرض Duffel الخام إلى شكل العرض الموحّد الذي يفهمه بقية النظام. */
export function normalizeDuffelOffer(raw, passengerRefs) {
    const passengers = normalizePassengerRefs(passengerRefs);
    const passengerIds = passengers.map(p => p.id);
    const slices = (raw.slices || []).map(slice => {
        const segments = (slice.segments || []).map(seg => ({
            origin: seg.origin?.iata_code,
            destination: seg.destination?.iata_code,
            departAt: seg.departing_at,
            arriveAt: seg.arriving_at,
            carrier: seg.marketing_carrier?.name || seg.operating_carrier?.name || '',
            flightNumber: `${seg.marketing_carrier?.iata_code || ''}${seg.marketing_carrier_flight_number || ''}`,
            baggage: extractBaggage(seg),
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
        // ⚠️ شعار الناقل: Duffel يوثّق logo_symbol_url على كائن شركة
        // الطيران، لكنه **غير مُتحقَّق منه ضد رد حي** من هذه البيئة. غيابه
        // غير ضار إطلاقاً: null ← الواجهة تعرض البديل النصي كما كانت،
        // بلا صورة مكسورة (نفس مبدأ baggage: نعرضه إن وصل لا نختلقه).
        ownerLogo: raw.owner?.logo_symbol_url || raw.owner?.logo_lockup_url || null,
        ownerIata: raw.owner?.iata_code || null,
        netAmount: Number(raw.total_amount),
        currency: raw.total_currency,
        cabin: raw.cabin_class || null,
        passengerCount: (raw.passengers || []).length || passengerIds.length,
        expiresAt: raw.expires_at || null,
        totalDurationMin: totalDurationMin(slices),
        passengerIds,
        passengers,
        slices,
    };
}

/** إجمالي زمن الرحلة (كل الاتجاهات) — أساس الترتيب بـ"الأسرع". */
export function totalDurationMin(slices) {
    const mins = (slices || []).map(s => s.durationMin).filter(Number.isFinite);
    return mins.length ? mins.reduce((a, b) => a + b, 0) : null;
}

/**
 * ترتيب العروض قبل الاقتطاع — الترتيب بعد الاقتطاع كان سيعطي "الأسرع من
 * بين الأرخص" لا الأسرع فعلاً. العروض بلا مدة معروفة تُدفع لآخر القائمة
 * بدل أن تتصدّرها بقيمة صفرية مضلّلة.
 */
export function sortOffers(offers, sort = 'price') {
    const copy = offers.slice();
    if (sort === 'duration') {
        return copy.sort((a, b) => {
            const da = a.totalDurationMin ?? Infinity;
            const db = b.totalDurationMin ?? Infinity;
            return da - db || a.netAmount - b.netAmount; // تعادل المدة → الأرخص أولاً
        });
    }
    return copy.sort((a, b) => a.netAmount - b.netAmount);
}

export function createDuffelProvider({ apiKey, apiUrl, fetchImpl }) {
    const client = createDuffelClient({ apiKey, apiUrl, fetchImpl });
    const duffel = client.request;

    return {
        name: 'duffel',
        mode: client.mode,

        async searchOffers({ origin, destination, departDate, returnDate = null, adults = 1, childrenDobs = [], cabin = 'economy', sort = 'price' }) {
            const slices = [{ origin, destination, departure_date: departDate }];
            if (returnDate) slices.push({ origin: destination, destination: origin, departure_date: returnDate });
            // كان هنا `age: 8` ثابتاً لكل طفل — رقم مخترَع يناقض تاريخ
            // الميلاد وقت الحجز (422) ويسعّر الرحلة لعمر خاطئ. الآن العمر
            // مشتقّ من تاريخ الميلاد على تاريخ السفر. راجع passengerAges.js.
            const passengers = buildSearchPassengers({ adults, childrenDobs, departDate });
            const data = await duffel('POST', '/air/offer_requests?return_offers=true', {
                data: { slices, passengers, cabin_class: cabin },
            });
            // الكائنات كاملةً لا معرّفاتها وحدها: `age` المُعاد هو ما سُعِّر
            // به العرض، ويطابقه الخادم بتاريخ الميلاد قبل الحجز.
            const requestPassengers = data.passengers || [];
            // ⚠️ التطبيع قبل الترتيب متعمَّد: المدة لا تُعرف إلا بعده، ولو
            // اقتطعنا الأرخص عشرة أولاً (كما كان) لأعطى ترتيبُ "الأسرع"
            // أسرعَ العشرة الأرخص لا الأسرع فعلاً. Duffel قد يعيد المئات،
            // والتطبيع حساب محلي رخيص فلا مشكلة في تطبيقه على الكل.
            const normalized = (data.offers || [])
                .map(o => normalizeDuffelOffer(o, requestPassengers))
                .filter(o => Number.isFinite(o.netAmount));
            return sortOffers(normalized, sort).slice(0, MAX_RESULTS);
        },

        async getOffer(offerId) {
            try {
                const raw = await duffel('GET', `/air/offers/${encodeURIComponent(offerId)}`);
                return normalizeDuffelOffer(raw, raw.passengers || []);
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
