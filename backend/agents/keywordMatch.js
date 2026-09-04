/**
 * 🔤 مطابقةُ كلماتٍ مفتاحية بلغتين — أداةٌ واحدة لعلّةٍ تكرّرت خمس مرّات
 *
 * 🔴 العلّة: `goal.includes(كلمة)` أو `/كلمة|.../.test(goal)` يقرأ الكلمةَ
 * داخل كلمةٍ أخرى لا علاقة لها بها. وقعت في:
 *   • `detectProjectType` — «طبي» داخل «تطبيق»
 *   • `needsBackend`      — `api` داخل *therapist*، `store` داخل *restore*
 *   • `needsPostgres`     — «مالي» داخل «جمالي» و«الشمالي» و«أعمالي»
 *   • `detectAdvancedFeatures` — «كاش» داخل «كاشير» و«الكاشمير»
 *   • حارسُ الارتداد في `jcr` — «شيل» داخل «تشيلي»
 * خمسةُ إصلاحاتٍ منفصلة لعلّةٍ واحدة. فصارت الأداةُ واحدة.
 *
 * 📐 قاعدتان لأن الصرف يختلف:
 *
 * • **العربية**: البدايةُ مقيَّدة بالسوابق المعروفة، والنهايةُ بلواحقَ
 *   **من مجموعةٍ مغلقة**. السوابقُ واللواحق تلتصق بالكلمة («الحساب»،
 *   «حسابات»، «للمستخدمين»)، فحدُّ الكلمة الكامل يُسقط المطابقات الصحيحة —
 *   لكنّ اللاحقةَ الحرّة تقبل «كاشير» و«الكاشمير» على أنهما «كاش».
 *   فالسابقةُ من [و ف] ثمّ [ب ك] ثمّ [لل ال ل]، واللاحقةُ من قائمةٍ
 *   معدودة ثمّ حدُّ كلمة. وما عداهما حرفٌ أصليّ يُبطل المطابقة.
 *   📌 حدُّه المعلوم: التمييزُ صرفيٌّ لا معجميّ، فكلمةٌ تنتهي صدفةً بلاحقةٍ
 *   صحيحة تمرّ. وهو أضيقُ بكثير من الاحتواء المجرّد، وهذا ما يُشترى.
 *
 * • **اللاتينية**: حدودُ كلمات مع لاحقة جمعٍ إنجليزية اختيارية.
 */

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** لاتينيّ؟ — ASCII قابلٌ للطباعة وحده */
export const isLatin = (kw) => /^[\x20-\x7E]+$/.test(kw);

// اللواحقُ العربية المعدودة — الأطولُ أوّلاً ليأخذ المُطابِقُ أطولَ ما يصحّ
const AR_SUFFIX = '(?:يات|ات|ين|ون|ان|ية|هم|هن|كم|كن|ها|نا|ة|ه|ك|ي|ا|وا|و)?';

export const arabicMatcher = (kw) =>
    new RegExp(
        `(?<![\\p{L}\\p{N}])(?:[وف])?(?:[بك])?(?:لل|ال|ل)?${escapeRe(kw)}${AR_SUFFIX}(?![\\p{L}\\p{N}])`,
        'u',
    );

export const latinMatcher = (kw) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(kw)}(?:es|s)?(?![\\p{L}\\p{N}])`, 'iu');

/** يبني مُطابِقاً لكل كلمة بالقاعدة المناسبة للغتها */
export const matchersFor = (keywords) =>
    keywords.map((kw) => (isLatin(kw) ? latinMatcher(kw) : arabicMatcher(kw)));

/** هل يحوي النصُّ أياً من الكلمات — بحدودها لا باحتوائها؟ */
export function matchesAny(matchers, text) {
    const s = String(text ?? '').toLowerCase();
    if (!s) return false;
    return matchers.some((re) => re.test(s));
}

/** الشكلُ المختصر: قائمةُ كلمات + نصّ → boolean (يبني المُطابِقات في كل نداء) */
export function hasKeyword(text, keywords) {
    return matchesAny(matchersFor(keywords), text);
}

export default { isLatin, arabicMatcher, latinMatcher, matchersFor, matchesAny, hasKeyword };
