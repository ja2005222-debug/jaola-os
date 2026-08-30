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
import { normalizeFareConditions } from '../fareConditions.js';
import { checkedBaggage, instant } from '../itinerary.js';

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
 * 🧳 أمتعة إضافية قابلة للشراء (المرحلة ٢د): Duffel يُرجع `available_services`
 * على العرض وفق توثيقها العام — كائن لكل خدمة يحمل `id`/`type`/
 * `total_amount`/`total_currency`/`maximum_quantity`، وحقيبةٌ إضافية
 * نوعها `baggage`. **لم يُتحقَّق من هذا الشكل ضد رد حي بعد** (نفس صراحة
 * الملف كله) — غيابه أو اختلافه لا يكسر شيئاً: قائمة فارغة فتختفي
 * خطوة «أمتعة إضافية» من الواجهة بدل أن تعرض خياراً وهمياً أو تُسقط.
 * فلترة `type === 'baggage'` فقط: خدمات أخرى (مقعد، وجبة...) قد تصل
 * لاحقاً بنفس الشكل ولا نعرضها بعد كأمتعة.
 *
 * ⚠️ بلا وصفٍ نصّي جاهز عمداً: `type`/`maxWeightKg` بنيويان تصوغ منهما
 * الواجهة تسميتها بلغتها عبر T() — نفس درس mockProvider.js (نصٌّ عربي
 * جاهز من الخادم يصل لغةً أخرى نصف مترجم بمترجم DOM الجزئي).
 */
function extractAvailableServices(raw) {
    const list = Array.isArray(raw.available_services) ? raw.available_services : [];
    return list
        .filter(s => s?.type === 'baggage' && s?.id && Number.isFinite(Number(s.total_amount)))
        .map(s => ({
            id: s.id,
            type: s.metadata?.type === 'carry_on' ? 'carry_on_bag' : 'checked_bag',
            maxWeightKg: Number.isFinite(Number(s.metadata?.maximum_weight_kg)) ? Number(s.metadata.maximum_weight_kg) : null,
            netAmount: Number(s.total_amount),
            currency: s.total_currency,
            maxQuantity: Number.isFinite(Number(s.maximum_quantity)) ? Number(s.maximum_quantity) : 1,
        }));
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

/**
 * 🕰️ يفكّ مدة ISO 8601 (`PT3H50M`) إلى دقائق — صيغة `slice.duration` عند
 * Duffel (موثَّقة في SDKها الرسمي ومشتقّاتها؛ راجع الملاحظة أعلى هذا
 * الملف عن مستوى التحقق العام لصيغ Duffel هنا). تدعم الأيام احتياطاً
 * (`P1DT...`) رغم ندرتها في شريحة واحدة، وترفض أي صيغة لا تطابق بدل
 * تخمين رقم.
 */
function parseIsoDurationMin(iso) {
    const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(String(iso || '').trim());
    if (!m || !(m[1] || m[2] || m[3] || m[4])) return null;
    const total = Number(m[1] || 0) * 1440 + Number(m[2] || 0) * 60 + Number(m[3] || 0) + Number(m[4] || 0) / 60;
    return Number.isFinite(total) ? Math.round(total) : null;
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
        // 🔴 عطبٌ حقيقي رُصد ووُثِّق قبل إصلاحه: الافتراض القديم («فرق
        // التوقيتين يكفي، لا حاجة لتفكيك ISO8601») كان خاطئاً. توقيتا
        // Duffel محليّان بلا إزاحة (راجع itinerary.js) — فرقهما صحيحٌ حين
        // يتشارك الطرفان مطاراً واحداً (توقّف) لأن الإزاحة تُلغي نفسها،
        // وخاطئٌ بين مطارين مختلفين بفارق منطقةٍ زمنية: رحلة AMS→RAK
        // المباشرة (فرق ساعة) كانت تظهر ٢س٥٠د بدل ٣س٥٠د فعلياً — لا خطأ
        // تقريب، بل نقصانٌ بمقدار فرق المنطقتين بالضبط.
        // العلاج: `slice.duration` يصل من Duffel نفسه بصيغة ISO 8601
        // محسوبةً بمنطقتي المطارين الحقيقيتين — لا نُخمّنها. وحين تغيب
        // (رد قديم أو توثيقٌ غير مطابق تماماً؛ انظر تحفّظ الملف العام) نسقط
        // لطريقة الطرح القديمة **بعد تثبيتها UTC صراحةً** (`instant` من
        // itinerary.js) بدل تركها تتغيّر بمنطقة خادم النشر كما كانت — وهي
        // تبقى تقريبية بين مطارين مختلفين، لكنها الآن حتمية لا عشوائية.
        const isoDurationMin = parseIsoDurationMin(slice.duration);
        const durationMin = isoDurationMin ?? (first.departAt && last.arriveAt
            ? Math.round((instant(last.arriveAt) - instant(first.departAt)) / 60000)
            : null);
        return {
            origin: first.origin, destination: last.destination,
            departAt: first.departAt, arriveAt: last.arriveAt,
            durationMin, stops: Math.max(0, segments.length - 1), segments,
            // 🎟️ عائلة السعر: Duffel يضعها على الشريحة لا على العرض
            // (`slice.fare_brand_name`، سلسلة نصية اختيارية — مؤكَّدة من
            // سِجلّ تغييرات Duffel ومن SDKها الرسمي). غيابها ← null،
            // والواجهة تسكت عنها بدل أن تخترع اسماً.
            fareBrand: slice.fare_brand_name || null,
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
        // 🎟️ شرطا التغيير والاسترداد قبل المغادرة. ثلاثيّان لا ثنائيّان:
        // انظر src/fareConditions.js لسبب ذلك ولخطورة اختزالهما.
        conditions: normalizeFareConditions(raw.conditions),
        availableServices: extractAvailableServices(raw),
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

/**
 * 🔍 فلترة العروض قبل الترتيب والاقتطاع — نفس درس sortOffers أعلاه: فلترة
 * العشرة المقتطعة كانت ستُخفي رحلات مباشرة موجودة خارج العشرة الأرخص.
 * دالة نقية يتشاركها المزوّدان (الحي والمحاكاة) فيسري العقد عليهما معاً.
 * - maxStops: أقصى توقفات لأي قطاع من قطاعات العرض (0 = مباشر فقط)
 * - airline: اسم الناقل (احتواء، غير حساس لحالة الأحرف) أو رمز IATA مطابق
 * - maxNetAmount: سقف الصافي (الخادم يحوّل سقف البيع إليه قبل التمرير —
 *   الهامش لا يعرفه المزوّد ولا يجب أن يعرفه)
 * - checkedBagOnly: يُسقط ما **نعرف** خلوّه من حقيبة مسجَّلة (انظر أدناه)
 */
export function applyOfferFilters(offers, { maxStops = null, airline = null, maxNetAmount = null, checkedBagOnly = false } = {}) {
    let list = offers;
    if (maxStops != null) {
        list = list.filter(o => (o.slices || []).every(s => (s.stops || 0) <= maxStops));
    }
    if (airline) {
        const q = String(airline).trim().toLowerCase();
        const qIata = q.toUpperCase();
        list = list.filter(o =>
            String(o.owner || '').toLowerCase().includes(q)
            || (o.ownerIata && o.ownerIata === qIata));
    }
    if (maxNetAmount != null) {
        list = list.filter(o => o.netAmount <= maxNetAmount);
    }
    if (checkedBagOnly) {
        // 🧳 **ثلاثيّة لا ثنائية**: `null` تعني «المزوّد لم يصرّح» لا «لا
        // حقيبة». نُسقط المعروفَ خلوُّه فقط، ونُبقي غيرَ المصرَّح **موسوماً**
        // في الواجهة. الإسقاطُ الصارم كان سيُفرغ القائمة كلها كلما صمت
        // المزوّد عن الأمتعة — وهو الغالب (انظر extractBaggage) — فيظنّ
        // المسافر أن لا رحلة بحقيبة أصلاً. والإبقاءُ بلا وسمٍ يَعِد بما
        // لا نعرفه. الوسمُ هو المخرج الصادق الوحيد.
        list = list.filter(o => checkedBaggage(o) !== false);
    }
    return list;
}

export function createDuffelProvider({ apiKey, apiUrl, fetchImpl }) {
    const client = createDuffelClient({ apiKey, apiUrl, fetchImpl });
    const duffel = client.request;

    return {
        name: 'duffel',
        mode: client.mode,

        async searchOffers({ origin, destination, departDate, returnDate = null, adults = 1, childrenDobs = [], cabin = 'economy', sort = 'price', maxStops = null, airline = null, maxNetAmount = null, checkedBagOnly = false }) {
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
            // الفلترة قبل الترتيب والاقتطاع — انظر تعليق applyOfferFilters
            const filtered = applyOfferFilters(normalized, { maxStops, airline, maxNetAmount, checkedBagOnly });
            return sortOffers(filtered, sort).slice(0, MAX_RESULTS);
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

        async createOrder({ offerId, passengers, contact, services = [] }) {
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
            // 🧳 أمتعة إضافية مُختارة وقت الحجز — وفق توثيق Duffel العام
            // (غير مُتحقَّق منه ضد رد حي، انظر extractAvailableServices):
            // `services: [{ id, quantity }]` على نفس نداء إنشاء الطلب. المبلغ
            // الإجمالي المرسل في payments **لا يُعدَّل هنا يدوياً** — الصافي
            // المخزَّن على الحجز (booking.netAmount) يشمل الإضافات أصلاً
            // (server.js:doBook)، وDuffel نفسه يحتسب سعر الخدمات على الطلب.
            const data = await duffel('POST', '/air/orders', {
                data: {
                    selected_offers: [offerId],
                    passengers: duffelPassengers,
                    payments: [{ type: 'balance', amount: String(offer.netAmount), currency: offer.currency }],
                    ...(services.length ? { services: services.map(s => ({ id: s.id, quantity: s.quantity })) } : {}),
                },
            });
            return {
                orderId: data.id,
                bookingReference: data.booking_reference,
                status: 'issued',
                netAmount: Number(data.total_amount),
                currency: data.total_currency,
                // 🎫 أرقام التذاكر الإلكترونية: هي «شكل التذكرة النهائي» فعلياً
                // (لا ملف PDF) — بها يُراجَع الناقل ويُسجَّل الوصول. الحقل
                // اختياري في رد Duffel وقد يصل لاحقاً بعد الإصدار، فالغياب
                // ليس خطأً: نعرض المرجع (PNR) وحده حينها.
                tickets: Array.isArray(data.documents)
                    ? data.documents
                        .filter(d => d?.unique_identifier)
                        .map(d => ({ type: d.type || 'ticket', number: d.unique_identifier }))
                    : [],
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
