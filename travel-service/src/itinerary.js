/**
 * 🧭 itinerary.js — حقائق مشتقّة من **شكل العرض** لا من رأي أحد
 *
 * دوالٌّ نقية تقرأ العرض الموحَّد (slices → segments) وتُخرج ما تحتاجه
 * الفلترةُ والواجهةُ والمساعد معاً — فمصدرُ الحقيقة واحد لا ثلاثة.
 *
 * ⚠️ **توقيتات المزوّد محلية بلا إزاحة**: Duffel يُرجع `departing_at`
 * بصيغة `"2026-09-02T14:45:00"` — توقيتُ المطار نفسه بلا Z ولا `+02:00`
 * (ومزوّد المحاكاة يقلّده حرفياً). لهذا قاعدتان لا واحدة:
 *
 * - ما يُحسب **بين مطارين مختلفين** (مدة الرحلة) لا يصحّ طرحاً مباشراً:
 *   الإزاحتان مختلفتان فيضيع الفرق. (انظر الملاحظة في `layoverMinutes`.)
 * - ما يُحسب **داخل المطار الواحد** (مدة التوقف) يصحّ: الإزاحة واحدة
 *   فتُلغي نفسها.
 * - وفارقُ **يوم** الوصول يُقرأ من التقويم لا من الطرح — وهو ما تعرضه
 *   شركات الطيران فعلاً على التذكرة.
 */

/**
 * يحوّل توقيتاً محلياً بلا إزاحة إلى مللي‑ثانية **بتثبيت UTC**.
 * بلا التثبيت يفسّره Node بتوقيت الخادم، فتتغيّر النتيجة بتغيّر منطقة
 * النشر — عطبٌ لا يظهر في الاختبارات ويظهر بعد أول ترحيل.
 */
function instant(iso) {
    const s = String(iso || '');
    if (!s) return null;
    const t = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s + 'Z');
    return Number.isFinite(t) ? t : null;
}

/** رقم اليوم التقويمي (بلا أي تفسيرٍ زمني) — أساس فارق يوم الوصول. */
function dayNumber(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
}

/**
 * 🛬 فارق يوم الوصول عن يوم المغادرة: `1` تعني «يصل في اليوم التالي».
 *
 * ⚠️ **ليس تزييناً**: رحلةٌ تقلع ٢٣:٤٠ وتصل ٠٦:٠٠ كنا نعرضها كأنها تصل
 * صباح اليوم نفسه. من يحجز فندقاً أو موعداً على هذا الأساس يخسر ليلةً
 * كاملة — والخطأ صامتٌ تماماً لأن الساعة المعروضة صحيحة، والناقصُ يومُها.
 *
 * والقيمة **قد تكون سالبة** بحقّ: عبورُ خطّ التاريخ غرباً (طوكيو →
 * هونولولو) يصل «قبل» أن يقلع بالتقويم المحلي. لا نُصفّرها كذباً.
 */
export function arrivalDayOffset(slice) {
    const segs = slice?.segments || [];
    if (segs.length === 0) return 0;
    const from = dayNumber(segs[0]?.departAt ?? slice?.departAt);
    const to = dayNumber(segs[segs.length - 1]?.arriveAt ?? slice?.arriveAt);
    return from == null || to == null ? 0 : to - from;
}

/**
 * ⏱️ مدة التوقف بين قطاعين بالدقائق.
 *
 * صحيحةٌ رغم غياب الإزاحة لأن الطرفين **من نفس المطار**: يهبط في X ثم
 * يقلع من X، فأيّاً كانت إزاحته فهي واحدة في الطرفين وتُلغي نفسها. وهذا
 * بالضبط ما لا يصحّ في مدة الرحلة كلها (مطار إلى آخر، إزاحتان مختلفتان).
 */
export function layoverMinutes(arriveAt, departAt) {
    const a = instant(arriveAt);
    const d = instant(departAt);
    return a == null || d == null ? null : Math.round((d - a) / 60000);
}

/** توقفات الشريحة: مدينةُ كلٍّ ومدته — `[{ airport, minutes }]`. */
export function layovers(slice) {
    const segs = slice?.segments || [];
    const out = [];
    for (let i = 1; i < segs.length; i++) {
        out.push({
            airport: segs[i - 1]?.destination || segs[i]?.origin || null,
            minutes: layoverMinutes(segs[i - 1]?.arriveAt, segs[i]?.departAt),
        });
    }
    return out;
}

/**
 * 🧳 هل يشمل العرض حقيبة مسجَّلة؟ `true` / `false` / **`null`**.
 *
 * `null` ليست تفصيلاً: Duffel قد لا يصرّح بالأمتعة إطلاقاً (موثَّق في
 * duffelProvider.js). «لا نعرف» تختلف عن «لا توجد» — وادّعاء الثانية
 * مكان الأولى يجعل المسافر يدفع رسوم حقيبة لم نحذّره منها.
 */
export function checkedBaggage(offer) {
    let sawAny = false;
    for (const slice of offer?.slices || []) {
        for (const seg of slice?.segments || []) {
            if (!Array.isArray(seg?.baggage)) continue;
            sawAny = true;
            for (const b of seg.baggage) {
                if (b?.type === 'checked' && Number(b.quantity) > 0) return true;
            }
        }
    }
    return sawAny ? false : null;
}
