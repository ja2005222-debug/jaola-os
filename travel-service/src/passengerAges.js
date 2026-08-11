/**
 * 👶 passengerAges.js — مصدر حقيقة واحد لعمر المسافر
 *
 * العطب الذي وُلد منه هذا الملف (رُصد في حجز إنتاج حقيقي):
 * البحث كان يعلن لـ Duffel `age: 8` لكل طفل — رقم مخترَع ثابت — ثم يرسل
 * الحجز تاريخ الميلاد الحقيقي، فيردّ Duffel بـ 422:
 *
 *     Field 'age' does not match date of birth for this passenger
 *
 * والرفض كان **نعمة**: الأخطر أن السعر المعروض كان تسعيرة طفلٍ بعمر ٨
 * مهما كان عمر الطفل فعلاً. فلو مرّ الحجز لبعنا برقمٍ لا علاقة له
 * بالحجز الحقيقي — خسارة صامتة على كل حجز عائلي تُكتشف في المحاسبة لا
 * في الشاشة.
 *
 * سبب العطب بنيوي لا حسابي: **مصدرا حقيقة لنفس المعلومة** — رقم يُخترع
 * وقت البحث، وتاريخ ميلاد حقيقي وقت الحجز. تناقضهما مسألة وقت لا احتمال.
 *
 * القاعدة هنا: **تاريخ الميلاد وحده مصدر الحقيقة**، والعمر يُشتقّ منه
 * دائماً — لا يُدخَل ولا يُخمَّن. رقمان لا يتناقضان حين يكونان رقماً واحداً.
 *
 * وتفصيل يسهل السهو عنه: العمر يُحسب **يوم السفر لا يوم البحث**. طفل
 * يبلغ عامه بين التاريخين يتغيّر تصنيفه وسعره، وحسابه باليوم الخطأ يعيد
 * نفس الرفض من باب آخر. Duffel يوثّق ذلك صراحةً: العمر على تاريخ مغادرة
 * أول قطاع.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** أقل عمر يعتبره الناقلون بالغاً — دونه راكب بعمر معلن لا `type: adult`. */
export const ADULT_MIN_AGE = 18;

/** أقصى عمر يُقبل كطفل في البحث — من بلغ 18 يُحجز بالغاً. */
export const CHILD_MAX_AGE = ADULT_MIN_AGE - 1;

/**
 * العمر بالسنوات الكاملة في تاريخ معيّن.
 *
 * حساب نصّي بحت بلا كائن Date: التحويل لـ Date يجرّ المنطقة الزمنية،
 * فيصير عمر مولودٍ في منتصف الليل مختلفاً باختلاف خادم التشغيل — وهو
 * بالضبط نوع الفرق الذي يعيد 422. ومقارنة "MM-DD" معجمياً صحيحة ما دام
 * الشهر واليوم بخانتين مصفَّرتين، وهو ما يضمنه DATE_RE.
 *
 * يُرجع null لتاريخ غير صالح — لا صفراً يُخلَط بعمر رضيع.
 */
export function ageOn(bornOn, onDate) {
    const born = String(bornOn || '').slice(0, 10);
    const on = String(onDate || '').slice(0, 10);
    if (!DATE_RE.test(born) || !DATE_RE.test(on)) return null;
    let age = Number(on.slice(0, 4)) - Number(born.slice(0, 4));
    if (on.slice(5) < born.slice(5)) age -= 1; // لم يبلغ عامه بعد في سنة السفر
    return age;
}

/**
 * يتحقق من تواريخ ميلاد الأطفال ويطبّعها — {error} أو {values}.
 *
 * التحقق على **تاريخ السفر** لا اليوم، لنفس السبب أعلاه.
 */
export function validateChildrenDobs(raw, departDate, max) {
    if (raw == null) return { values: [] };
    if (!Array.isArray(raw)) return { error: 'تواريخ ميلاد الأطفال يجب أن تكون قائمة.' };
    if (raw.length > max) return { error: `عدد الأطفال بين 0 و${max}.` };
    const values = [];
    for (const [i, item] of raw.entries()) {
        const born = String(item || '').trim();
        if (!DATE_RE.test(born) || isNaN(Date.parse(born))) {
            return { error: `الطفل ${i + 1}: تاريخ ميلاد صالح بصيغة YYYY-MM-DD.` };
        }
        const age = ageOn(born, departDate);
        if (age == null || age < 0) {
            return { error: `الطفل ${i + 1}: تاريخ الميلاد بعد تاريخ السفر.` };
        }
        if (age > CHILD_MAX_AGE) {
            return { error: `الطفل ${i + 1}: عمره ${age} سنة يوم السفر — يُحجز ضمن البالغين.` };
        }
        values.push(born);
    }
    return { values };
}

/**
 * ركّاب طلب العرض كما يفهمهم Duffel: البالغون بالنوع، والأطفال بالعمر
 * **المشتقّ** من تاريخ الميلاد.
 *
 * الترتيب (بالغون ثم أطفال) **جزء من العقد لا تفصيل تجميلي**: Duffel
 * يُرجع معرّفات الركاب بنفس ترتيب إرسالها، والحجز لاحقاً يطابق كل مسافر
 * بمعرّفه حسب الفهرس. قلبُ الترتيب يُلصق بيانات طفل بمقعد بالغ بلا أي
 * خطأ ظاهر.
 */
export function buildSearchPassengers({ adults, childrenDobs = [], departDate }) {
    return [
        ...Array.from({ length: adults }, () => ({ type: 'adult' })),
        ...childrenDobs.map(born => ({ age: ageOn(born, departDate) })),
    ];
}

/**
 * يتحقق أن تواريخ ميلاد الحجز تطابق الأعمار التي سُعِّر بها العرض.
 *
 * هذه الشبكة الأخيرة قبل المزوّد: بدونها يصل التناقض إلى Duffel فيعود
 * 422 بالإنجليزية إلى وجه المسافر (وهو ما حدث فعلاً). ووجودها يحوّل
 * الرفض إلى رسالة عربية تقول ما العمل.
 *
 * تُفحص الاتجاهات الثلاثة:
 *   • طفل سُعِّر بعمر س وتاريخ ميلاده يعطي عمراً آخر
 *   • مقعد بالغ يحمل تاريخ ميلاد طفل (العطب نفسه من الباب المقابل)
 *   • مقعد طفل يحمل تاريخ ميلاد بالغ
 *
 * يُرجع نص الخطأ أو null.
 */
export function checkPassengerAges({ passengers, offerPassengers, departAt }) {
    if (!Array.isArray(offerPassengers) || offerPassengers.length === 0) return null;
    const departDate = String(departAt || '').slice(0, 10);
    if (!DATE_RE.test(departDate)) return null; // بلا تاريخ سفر لا فحص مضلّل
    for (const [i, p] of passengers.entries()) {
        const expected = offerPassengers[i];
        if (!expected) continue;
        const age = ageOn(p.bornOn, departDate);
        if (age == null) continue; // صيغة التاريخ فُحصت سلفاً في validatePassengers
        if (expected.age != null) {
            if (age !== expected.age) {
                return `المسافر ${i + 1}: العرض سُعِّر لعمر ${expected.age} سنة وتاريخ الميلاد يعطي ${age} — أعد البحث بالعمر الصحيح.`;
            }
        } else if (expected.type === 'adult' && age < ADULT_MIN_AGE) {
            return `المسافر ${i + 1}: عمره ${age} سنة يوم السفر — أعد البحث وأضفه ضمن الأطفال ليُسعَّر بسعره.`;
        }
    }
    return null;
}
