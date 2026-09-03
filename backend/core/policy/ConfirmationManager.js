/**
 * 🛂 ConfirmationManager — بوّابة الموافقة البشرية (Sprint 3 / محور Policy).
 *
 * المبدأ الثاني عند المالك: «العمليات عالية الخطورة تحتاج Human Confirmation».
 * وأخطر ما في بوّابة التأكيد ليس أن ترفض موافقةً صحيحة — بل أن **تقرأ موافقةً
 * لم تُقَل**: فتبدأ بناءً كاملاً لأن المستخدم سأل سؤالاً.
 *
 * ⚠️ العطب الذي يصلحه هذا الملف (مُثبَت بالتشغيل على `isConfirmation` القديمة
 * في `agents/clarifierAgent.js`): كانت مطابقةَ **بادئةٍ** بلا حدود كلمات
 * (`/^(ابدأ|نعم|اه|go|ok|…)/i`)، فكانت تقرأ تأكيداً في:
 *   «نعمل إيه؟» · «اهلا» · «صحيح؟» · «goodbye» · «okay but wait» ·
 *   «اكملت المشروع أمس»
 * كلها تبدأ بحروف كلمةٍ مُثبِتة، ولا واحدة منها موافقة.
 *
 * 📌 ولماذا لم يستعمل الكاتب الأصلي حدود الكلمات؟ لأن `\b` في JavaScript
 * مبنيّة على ASCII فلا تعمل مع العربية إطلاقاً: `/\bاه\b/` لا تطابق حتى
 * «اه» المجرّدة (تحقّقتُ بالتشغيل). البديل الصحيح قطات Unicode:
 * `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` مع الراية `u` — تعمل للعربية
 * واللاتينية معاً، وعليها بُني هذا الملف.
 *
 * والنتيجة **ثلاثية لا ثنائية**: «لا أعرف» ليست «نعم» — وهي وحدها التي تمنع
 * تحويل الصمت أو الغموض إلى إذن.
 */

/** ثلاث نتائج صريحة: لا يُبدأ عملٌ خطر إلا على `confirm`. */
export const CONSENT = Object.freeze({
    CONFIRM: 'confirm',   // موافقة صريحة
    DECLINE: 'decline',   // رفض صريح
    UNKNOWN: 'unknown',   // لا هذا ولا ذاك — لا تُعامَل معاملة الموافقة أبداً
});

/** حدّ Unicode: يمنع «اهلا» من أن تُقرأ «اه»، و«goodbye» من أن تُقرأ «go». */
const bounded = (alts) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?![\\p{L}\\p{N}])`, 'iu');

// المفردات المُثبِتة **منقولة حرفياً** من CONFIRM_PATTERNS القديمة — لا تضييق
// لما كان مقبولاً، فالإصلاح في آلية المطابقة لا في قائمة الكلمات.
const AFFIRM = 'ابدأ|ابدا|ابد|نفذ|تمام|موافق|نعم|اكمل|يلا|امشي|هيا|اوكي|اوك|يس|go|yes|ok|okay|start|proceed|build|let\'s go|do it|اكيد|صح|بالتوفيق|كمل|هيه|اه|آه|يي|yep|sure|alright|begin|execute|run|launch|deploy|lets go|let go|هلا';

// الرفض يسبق الإثبات دائماً: «لا تبدأ» تبدأ بـ«لا» لا بـ«ابدأ».
const DECLINE_WORDS = 'لا|لأ|كلا|مش|ليس|توقف|قف|الغِ|الغ|ألغِ|إلغاء|no|nope|stop|cancel|abort|don\'t|dont|never';

// ⏸️ التردّد ليس رفضاً ولا موافقة: «okay but wait» تبدأ بـokay وتنتهي بتردّد.
// إدراجها هنا هو ما يمنع أخطر الحالات: موافقةٌ ظاهرها نعم وباطنها تحفّظ.
const HESITATE = 'لكن|بس|انتظر|استنى|لسه|لحظة|شوي|مؤقتا|مؤقتاً|but|wait|hold on|not sure|maybe|ربما|يمكن';

const AFFIRM_ANYWHERE = bounded(AFFIRM);
const AFFIRM_START = new RegExp(`^\\s*(?:${AFFIRM})(?![\\p{L}\\p{N}])`, 'iu');
const DECLINE_RE = bounded(DECLINE_WORDS);
const HESITATE_RE = bounded(HESITATE);
const QUESTION_RE = /[?؟]/;

// جملةٌ طويلة ليست «نعم»: من يوافق يوجز، ومن يشرح يطلب شيئاً آخر.
const MAX_WORDS = 6;

/**
 * يقرأ نيّة الموافقة من رسالة. **لا يخمّن**: ما ليس موافقةً بيّنة `UNKNOWN`.
 * @returns {'confirm'|'decline'|'unknown'}
 */
export function readConsent(message) {
    const text = String(message ?? '').trim();
    if (!text) return CONSENT.UNKNOWN;
    if (DECLINE_RE.test(text)) return CONSENT.DECLINE;
    // سؤالٌ ليس إذناً — «نعمل إيه؟» كانت تُقرأ «نعم» بالبادئة
    if (QUESTION_RE.test(text)) return CONSENT.UNKNOWN;
    if (HESITATE_RE.test(text)) return CONSENT.UNKNOWN;
    if (text.split(/\s+/).length > MAX_WORDS) return CONSENT.UNKNOWN;
    return AFFIRM_START.test(text) ? CONSENT.CONFIRM : CONSENT.UNKNOWN;
}

/** اختصار للمواضع التي تسأل «هل وافق؟» وحدها. */
export function isConfirmed(message) {
    return readConsent(message) === CONSENT.CONFIRM;
}

// المفردات المجرّدة **كما هي اليوم حرفياً** في `chatCommands.isBareYes` —
// سؤالٌ مختلف («هل الرسالة *ليست إلا* نعم؟») فتبقى قائمته مستقلة عمداً.
const BARE_ONLY = /^\s*(نعم|ايوه|أيوه|اه|آه|تمام|طيب|يلا|ok|okay|yes|sure|yep|go)\s*[.!؟?]*\s*$/i;

/** هل الرسالة موافقةٌ مجرّدة لا تحمل طلباً آخر؟ (سلوك مطابق لما قبله) */
export function isBareConsent(message) {
    return BARE_ONLY.test(String(message ?? ''));
}
