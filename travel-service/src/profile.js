/**
 * 🧠 profile.js — ذاكرة المسافر عبر الجلسات (المستوى الثالث)
 *
 * الايجنت كان بلا ذاكرة خارج المحادثة الواحدة: يسأل عن مطار الانطلاق كل
 * مرة، ويُملي المسافر بيانات جوازه في كل حجز. هذا الملف يعطي البوابة
 * ذاكرة من ثلاث طبقات:
 *   1. تفضيلات (مطار الانطلاق، الدرجة) — تملأ النماذج مسبقاً.
 *   2. مسافرون محفوظون — أكبر احتكاك في البوابة: عائلة من أربعة تعني
 *      إدخال ٢٠ حقلاً في كل حجز.
 *   3. آخر محادثة مع الايجنت — تُستأنف بدل أن تبدأ من الصفر.
 *
 * 🔒 خطّان أحمران في الخصوصية، مفروضان بالبنية لا بالنية:
 *
 *   أ) **بيانات المسافرين لا تصل النموذج اللغوي أبداً.** `buildAgentMemory`
 *      أدناه تُخرج تفضيلات ووجهات متكررة و**عدداً** من المسافرين — لا
 *      اسماً ولا تاريخ ميلاد. هذه بيانات جواز، وإرسالها لمزوّد خارجي
 *      لأجل «سياق» أثقل بكثير مما تشتريه.
 *
 *   ب) **الحفظ باختيار صريح.** `savePassengers` تبدأ `false`: لا يُحفظ
 *      مسافر لمجرد أنه حجز. والمسح الكامل متاح دوماً وفوري.
 */

import { isWhatsAppPhone, normalizeWhatsAppPhone } from './whatsapp.js';

const CABINS = ['economy', 'premium_economy', 'business', 'first'];
const IATA_RE = /^[A-Z]{3}$/;
export const MAX_TRAVELLERS = 8;      // عائلة كبيرة، لا دفتر عناوين
export const MAX_MEMORY_MESSAGES = 20; // آخر محادثة تُستأنف، لا أرشيف يُنقَّب
const MAX_LABEL = 40;

export function defaultProfile() {
    return {
        prefs: { homeAirport: null, cabin: null, savePassengers: false, whatsappPhone: null },
        travellers: [],
        conversation: [],
        // 📆 مفتاح اشتراك التقويم — يُولَّد عند أول اشتراك ويبقى null قبله
        calendarKey: null,
    };
}

/** ينقّي التفضيلات: قيمة غير صالحة تسقط إلى null بدل أن تُخزَّن فاسدة. */
export function normalizePrefs(raw) {
    const homeAirport = String(raw?.homeAirport || '').trim().toUpperCase();
    const cabin = String(raw?.cabin || '').trim().toLowerCase();
    // رقم واتساب: موافقة صريحة على مراسلة شخصية — رقم فاسد يسقط إلى null
    // بدل أن يُخزَّن فيفشل الإرسال صامتاً كل مرة.
    const phone = normalizeWhatsAppPhone(raw?.whatsappPhone);
    return {
        homeAirport: IATA_RE.test(homeAirport) ? homeAirport : null,
        cabin: CABINS.includes(cabin) ? cabin : null,
        savePassengers: raw?.savePassengers === true,
        whatsappPhone: isWhatsAppPhone(phone) ? phone : null,
    };
}

/**
 * ينقّي مسافراً محفوظاً — يُمرَّر عليه **نفس** مُتحقِّق الحجز
 * (`validatePassengers` مُحقَنة) فلا يمكن أن يُحفظ مسافر لا يصلح للحجز،
 * ولا أن يفترق تحققان لنفس البيانات.
 */
export function normalizeTraveller(raw, validate) {
    const check = validate({ passengers: [raw], contact: { email: 'x@x.xx', phone: '+966500000000' } }, 1);
    if (check.error) return { error: check.error };
    const p = check.values.passengers[0];
    const label = String(raw?.label || '').trim().slice(0, MAX_LABEL)
        || `${p.givenName} ${p.familyName}`.trim();
    return { value: { ...p, label } };
}

/** يدمج تعديلاً جزئياً على ملف قائم — الحقول الغائبة تبقى كما هي. */
export function mergeProfile(current, patch) {
    const base = current || defaultProfile();
    return {
        prefs: patch.prefs ? normalizePrefs({ ...base.prefs, ...patch.prefs }) : base.prefs,
        travellers: patch.travellers !== undefined ? patch.travellers : base.travellers,
        conversation: patch.conversation !== undefined ? patch.conversation : base.conversation,
        // ⚠️ كل حقل جديد يجب أن يُذكر هنا صراحةً. هذه الدالة تبني كائناً
        // جديداً لا تدمج فوق القديم، فحقلٌ منسيٌّ **يُمحى صامتاً** عند أول
        // حفظٍ لأي شيء آخر (يحفظ المستخدم تفضيلاً فيموت اشتراك تقويمه).
        // نفس صنف العطب الذي أسقط الحقول غير المُدرَجة في transitionBooking.
        calendarKey: patch.calendarKey !== undefined ? patch.calendarKey : (base.calendarKey ?? null),
    };
}

/** أكثر الوجهات تكراراً في حجوزات المستخدم — إشارة سلوك لا بيانات شخصية. */
export function frequentDestinations(bookings, limit = 3) {
    const counts = new Map();
    for (const b of bookings || []) {
        if ((b.kind || 'flight') !== 'flight' || b.status !== 'issued') continue;
        const slices = b.offer?.slices || [];
        const dest = slices[0]?.destination;
        if (!dest) continue;
        counts.set(dest, (counts.get(dest) || 0) + 1);
    }
    return [...counts.entries()]
        .filter(([, n]) => n >= 2) // مرة واحدة ليست عادة
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([iata, n]) => ({ iata, count: n }));
}

/**
 * سياق الذاكرة الذي **يُسمح** بوصوله للنموذج.
 *
 * ⚠️ لاحظ ما ليس هنا: لا اسم مسافر ولا تاريخ ميلاد ولا جنس ولا بريد ولا
 * هاتف. الايجنت يعرف أن لديه ٣ مسافرين محفوظين ليقترح استخدامهم، ولا
 * يعرف من هم — والحجز الفعلي يقرأ بياناتهم من المخزن مباشرةً لا من كلام
 * النموذج. يعيد '' حين لا ذاكرة تُذكر، فلا تُحقَن جملة فارغة في التعليمة.
 */
export function buildAgentMemory(profile, bookings = []) {
    const lines = [];
    const prefs = profile?.prefs || {};
    if (prefs.homeAirport) lines.push(`مطار انطلاقه المعتاد: ${prefs.homeAirport}.`);
    if (prefs.cabin) lines.push(`درجته المفضّلة: ${prefs.cabin}.`);
    const count = (profile?.travellers || []).length;
    if (count > 0) {
        lines.push(`لديه ${count} مسافر${count > 2 ? 'اً' : 'ين'} محفوظين في ملفه — اعرض عليه استخدامهم بدل طلب بياناتهم من جديد، ولا تطلب أسماءهم منه؛ الخادم يقرأها من الملف عند الحجز.`);
    }
    const frequent = frequentDestinations(bookings);
    if (frequent.length > 0) {
        lines.push(`وجهات يتكرّر سفره إليها: ${frequent.map(f => `${f.iata} (${f.count} مرات)`).join('، ')}.`);
    }
    if (lines.length === 0) return '';
    return `ما تعرفه عن هذا المسافر من رحلاته السابقة (استعمله بلا أن تسأل عمّا تعرفه سلفاً):\n${lines.join('\n')}`;
}

/** يقصّ المحادثة المحفوظة على آخر ما يفيد الاستئناف. */
export function trimConversation(messages) {
    const clean = [];
    for (const m of Array.isArray(messages) ? messages : []) {
        const role = m?.role === 'assistant' ? 'assistant' : 'user';
        const content = String(m?.content || '').slice(0, 4000);
        if (content) clean.push({ role, content });
    }
    return clean.slice(-MAX_MEMORY_MESSAGES);
}
