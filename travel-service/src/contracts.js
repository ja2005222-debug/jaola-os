/**
 * 🤝 contracts.js — العقود الفندقية المباشرة (أسعار خاصة متفاوَض عليها)
 *
 * جوهر تميّز الباقات: سعرٌ لا يستطيع المسافر تركيبه بنفسه من أي موقع.
 * الفندق يمنحنا سعراً صافياً خاصاً و**حصة غرف نبيعها دون الرجوع إليه**
 * (Free-sale ضمن allotment) — فالتأكيد فوري من طرفنا والأتمتة كاملة.
 * عقدٌ بلا هذا الشرط يجعل كل حجز عمليةً يدوية، لذا هو أول بنود التفاوض.
 *
 * نموذج الحصة عمداً **متحفّظ وبسيط**: allotment = عدد الغرف المحجوزة
 * تزامناً عبر كامل مدة العقد، لا تقويم توفر لكل ليلة. لا يبيع أبداً فوق
 * الحصة (قد يبيع أقل من الممكن نظرياً) — والبيع الزائد كارثة تشغيلية
 * بينما البيع الناقص كلفة فرصة فقط. يُراجَع عند نموّ حقيقي.
 *
 * معرّف العرض **يُعاد بناؤه من مكوّناته** (`ctr_<عقد>_<وصول>_<مغادرة>_
 * <بالغون>_<غرف>`) بدل خريطة في الذاكرة: إعادة تشغيل الخادم بين البحث
 * والحجز لا تُفقد العرض — بخلاف مزوّدات المحاكاة التي تتعمّد الذاكرة.
 *
 * 🎚️ هامش كل عقد قابل للتخصيص على حدة (`marginPct`، اختياري): كل عقد
 * أصلاً مساومة فردية على السعر الصافي — فهامش فردي امتدادٌ طبيعي لنفس
 * الفكرة لا مفهومٌ جديد، خلافاً لهامش الفئات (طيران/فندق/سيارة) الذي
 * يبقى بمتغيّر بيئة (راجع pricing.js). و`null` تعني «ورّث هامش الفنادق
 * الافتراضي» — لا سقفاً اتجاهياً هنا (لا يُشترط أن يكون أدنى من العام):
 * فندق حصري نادر المقارنة قد يستحق هامشاً **أعلى** من المعتاد، والمالك
 * يقرّره صراحةً لا البنية.
 */

import { MAX_MARKUP_PCT } from './pricing.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const MAX_ALLOTMENT = 500;
const MAX_NAME = 80;

export const CONTRACT_OFFER_PREFIX = 'ctr_';
export const CONTRACT_ORDER_PREFIX = 'ctro_';
export const CONTRACT_HOTEL_PREFIX = 'ctrh_';

/** ينقّي عقداً جديداً/معدَّلاً — {error} أو {value}. */
export function normalizeContract(raw) {
    const hotelName = String(raw?.hotelName || '').trim().slice(0, MAX_NAME);
    if (!hotelName) return { error: 'اسم الفندق مطلوب.' };
    const iata = String(raw?.iata || '').trim().toUpperCase();
    if (!IATA_RE.test(iata)) return { error: 'وجهة العقد رمز IATA من ثلاثة أحرف (مثل DXB).' };
    const netPerNight = Number(raw?.netPerNight);
    if (!Number.isFinite(netPerNight) || netPerNight <= 0) {
        return { error: 'السعر الصافي لليلة رقم موجب.' };
    }
    const currency = String(raw?.currency || '').trim().toUpperCase();
    if (!CURRENCY_RE.test(currency)) return { error: 'العملة رمز من ثلاثة أحرف (مثل USD).' };
    const allotment = Number(raw?.allotment);
    if (!Number.isInteger(allotment) || allotment < 1 || allotment > MAX_ALLOTMENT) {
        return { error: `حصة الغرف عدد صحيح بين 1 و${MAX_ALLOTMENT}.` };
    }
    const startDate = String(raw?.startDate || '').trim();
    const endDate = String(raw?.endDate || '').trim();
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
        return { error: 'تاريخا بداية العقد ونهايته بصيغة YYYY-MM-DD.' };
    }
    if (endDate <= startDate) return { error: 'نهاية العقد يجب أن تكون بعد بدايته.' };
    let marginPct = null;
    if (raw?.marginPct !== null && raw?.marginPct !== undefined && raw?.marginPct !== '') {
        const m = Number(raw.marginPct);
        if (!Number.isFinite(m) || m < 0 || m > MAX_MARKUP_PCT) {
            return { error: `هامش الفندق الخاص بين 0 و${MAX_MARKUP_PCT} (أو اتركه فارغاً ليرث هامش الفنادق).` };
        }
        marginPct = m;
    }
    const blackoutRaw = raw?.blackoutDates;
    const blackoutDates = [];
    if (blackoutRaw != null) {
        if (!Array.isArray(blackoutRaw)) return { error: 'تواريخ الحظر قائمة تواريخ.' };
        for (const d of blackoutRaw) {
            const day = String(d || '').trim();
            if (!DATE_RE.test(day)) return { error: `تاريخ حظر غير صالح: ${day}` };
            blackoutDates.push(day);
        }
    }
    return {
        value: {
            hotelName,
            city: String(raw?.city || '').trim().slice(0, MAX_NAME) || null,
            iata, netPerNight, currency, allotment, startDate, endDate,
            blackoutDates, marginPct,
            active: raw?.active !== false,
        },
    };
}

/** هل يغطي العقد إقامة كاملة؟ كل الليالي داخل النافذة وخارج الحظر. */
export function contractCoversStay(contract, checkInDate, checkOutDate) {
    if (!DATE_RE.test(String(checkInDate)) || !DATE_RE.test(String(checkOutDate))) return false;
    if (checkInDate < contract.startDate) return false;
    // آخر ليلة إقامة هي ليلة (المغادرة - 1) — المغادرة نفسها قد تساوي نهاية العقد
    if (checkOutDate > contract.endDate) return false;
    const blackout = new Set(contract.blackoutDates || []);
    if (blackout.size > 0) {
        // فحص كل ليلة: ليلة واحدة محظورة تكفي لإسقاط العرض كله
        let night = new Date(checkInDate + 'T00:00:00Z');
        const out = new Date(checkOutDate + 'T00:00:00Z');
        while (night < out) {
            if (blackout.has(night.toISOString().slice(0, 10))) return false;
            night = new Date(night.getTime() + 86400000);
        }
    }
    return true;
}

export function nightsBetween(checkInDate, checkOutDate) {
    return Math.max(1, Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000));
}

export function contractOfferId(contractId, checkInDate, checkOutDate, adults, rooms) {
    return `${CONTRACT_OFFER_PREFIX}${contractId}_${checkInDate}_${checkOutDate}_${adults}_${rooms}`;
}

/** يفكّ معرّف عرض عقد — null لمعرّف لا يخصّنا أو مُشوَّه. */
export function parseContractOfferId(offerId) {
    const id = String(offerId || '');
    if (!id.startsWith(CONTRACT_OFFER_PREFIX)) return null;
    const m = id.slice(CONTRACT_OFFER_PREFIX.length)
        .match(/^(.+)_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_(\d+)_(\d+)$/);
    if (!m) return null;
    return {
        contractId: m[1],
        checkInDate: m[2],
        checkOutDate: m[3],
        adults: Number(m[4]),
        rooms: Number(m[5]),
    };
}
