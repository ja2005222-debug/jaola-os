/**
 * 📚 ذاكرة دروس المنصة — تراكم المعرفة عبر كل المشاريع والمستخدمين
 *
 * إجابة سؤال المستخدم «هل تتراكم التجارب والتعديلات كمعرفة؟» كانت: لا —
 * كل مشروع كان يبدأ من صفر المعرفة. هذه الوحدة تغلق الحلقة:
 *
 * تُسجّل ثلاثة أنواع من الدروس:
 * - post_build_edit: ما يطلبه المستخدمون تعديلاً بعد البناء (موبايل، ألوان...)
 * - verifier_missing: متطلبات وظيفية يفشل المولّد في تنفيذها تكراراً
 * - qa_failure: أسباب رفض فاحص الجودة المتكررة
 *
 * والدروس التي تتجاوز عتبة التكرار تُحقن تلقائياً كتوجيهات في prompt
 * المولّد — فيبني من البداية ما تعوّد الناس طلبه لاحقاً.
 *
 * حتمية بالكامل (لا LLM)، دائمة عبر طبقة الـ persistence (Mongo)،
 * وآمنة تماماً عند غياب قاعدة البيانات.
 */

import { persistEntry, hydrateStore, onMongoReady } from './persistence.js';

// ─── المخزن ─────────────────────────────────────────────────────────
const lessons = new Map(); // `${type}:${key}` → { type, key, count, lastAt, samples[] }

onMongoReady(() => hydrateStore('platformLessons', (key, value) => {
    const current = lessons.get(key);
    if (!current || (value?.count || 0) > (current.count || 0)) lessons.set(key, value);
}));

export const MIN_COUNT_TO_TEACH = 3;  // درس لم يتكرر 3 مرات ليس نمطاً بعد
const MAX_TAUGHT_LESSONS = 6;  // لا نضخّم الـ prompt — الأثقل تكراراً فقط

export function recordLesson(type, key, sample = '') {
    const cleanKey = (key || '').toString().trim().toLowerCase().slice(0, 60);
    if (!cleanKey) return null;
    const k = `${type}:${cleanKey}`;
    const entry = lessons.get(k) || { type, key: cleanKey, count: 0, lastAt: 0, samples: [] };
    entry.count += 1;
    entry.lastAt = Date.now();
    if (sample && entry.samples.length < 3) entry.samples.push(sample.slice(0, 80));
    lessons.set(k, entry);
    persistEntry('platformLessons', k, entry);
    return entry;
}

// ─── تصنيف تعديلات ما بعد البناء (حتمي، آمن مع العربية — لا \b) ─────
// الفئات مستخرجة من سجلات مستخدمين حقيقية («نسق حجم الموبايل»...)
const EDIT_CATEGORIES = [
    ['responsive', /موبايل|جوال|الهاتف|الجوال|شاشة\s*صغيرة|تجاوب|mobile|responsive|small\s*screen/iu],
    ['colors', /لون|ألوان|الوان|تدرج|خلفي[ةه]|color|gradient|background/iu],
    ['typography', /خط|الخطوط|حجم\s*النص|font|typograph/iu],
    ['layout', /نسّ?ق|تنسيق|ترتيب|محاذا[ةه]|مسافات|تباعد|layout|align|spacing|margin|padding/iu],
    ['add_section', /(?:أضف|اضف|ضيف|زد|add).{0,20}(?:قسم|section)|قسم\s*جديد|new\s*section/iu],
    ['contact', /واتساب|whatsapp|تواصل|اتصال|contact|هاتف|رقم/iu],
    ['images', /صور[ةه]?|الصور|image|photo|picture/iu],
    ['text_content', /نص|عنوان|كلم[ةه]|فقر[ةه]|text|title|heading|wording/iu],
    ['animations', /حرك[ةه]|أنيميشن|انيميشن|animation|تأثير|effect/iu],
];

export function classifyEditInstruction(instruction = '') {
    const t = (instruction || '').trim();
    if (!t) return null;
    for (const [category, re] of EDIT_CATEGORIES) {
        if (re.test(t)) return category;
    }
    return null;
}

// تسجيل درس من تعديل ما بعد البناء — سطر واحد في نقطة recordEdit المركزية
export function recordEditLesson(instruction = '') {
    const category = classifyEditInstruction(instruction);
    if (!category) return null;
    return recordLesson('post_build_edit', category, instruction);
}

// ─── دروس مآلات المهام — تحلّ محلّ «التأمل» و«الفضول» الوهميين في jcr ──
// كان jcr يكتب {success, takeaways:'نجحت'|'فشلت'} في ملف JSON لا يقرؤه أحد.
// الآن: سبب الفشل الحقيقي يُصنَّف حتمياً (لا LLM) إلى فئة ثابتة تتراكم،
// والفئات التي يستطيع المولّد تجنّبها تُحقن توجيهاتٍ بعد النضج، والبقية
// (عطل مزوّد، مهلة) تبقى مرئية للمشرف في topLessons دون تلويث الـ prompt.
const FAILURE_CATEGORIES = [
    ['no_files', /لم يتم استخراج أي ملفات|لم يُنتج ملف|no files (were )?(extracted|produced)/i],
    ['debate_exhausted', /فشل الفريق بعد \d+ دورات|بعد \d+ محاولة/i],
    ['budget_exhausted', /budget exhausted|الميزانية استنفدت/i],
    ['syntax', /syntaxerror|unexpected token|unexpected end of input/i],
    ['rate_limited', /rate.?limit|too many requests|momentarily busy|\b429\b/i],
    ['timeout', /timed? ?out|etimedout|مهلة/i],
];
const AI_DOWN_HINT = /غير متاحة حالياً|رصيد المزوّد|insufficient_quota|exceeded your current quota|invalid api key|incorrect api key/i;

/** تصنيف حتمي لسبب فشل مهمة — null للإيقاف بطلب المستخدم (ليس درساً). */
export function classifyMissionFailure(error) {
    if (!error || error.aborted) return null;
    const msg = String(error?.message ?? error ?? '').slice(0, 400);
    if (msg === 'MISSION_ABORTED') return null;
    if (error.aiUnavailable || AI_DOWN_HINT.test(msg)) return 'ai_unavailable';
    for (const [category, re] of FAILURE_CATEGORIES) {
        if (re.test(msg)) return category;
    }
    return 'other';
}

/** يُستدعى مرة واحدة عند نهاية كل مهمة — النجاح ليس درساً، الفشل المصنَّف درس. */
export function recordMissionOutcome({ success = false, error = null } = {}) {
    if (success) return null;
    const category = classifyMissionFailure(error);
    if (!category) return null;
    return recordLesson('mission_failure', category, String(error?.message ?? error ?? ''));
}

/** ثغرات التحقّق السلوكي التي بقيت بعد الإصلاح التلقائي — ما يستلمه المستخدم فعلاً. */
export function recordBehaviorGaps(verdict) {
    if (!verdict?.ran || verdict.skipped) return [];
    return (verdict.checks || [])
        .filter(c => c?.status === 'fail' && c.name)
        .map(c => recordLesson('behavior_gap', c.name, c.detail || ''))
        .filter(Boolean);
}

// فقط ما يستطيع المولّد تجنّبه فعلاً — عطل المزوّد أو المهلة ليسا خطأه
const FAILURE_DIRECTIVES = {
    no_files: 'كثيراً ما فشل البناء لأن الرد لم يحوِ أي ملف قابل للاستخراج — أعد الملفات بالصيغة المطلوبة حرفياً (اسم الملف ثم محتواه كاملاً)، ولا تختصر ولا تشرح خارجها.',
    debate_exhausted: 'كثيراً ما تُرفض المخرجات عدة دورات متتالية حتى تنفد المحاولات — التزم بملاحظات النقّاد المرفقة من الدورة الأولى ولا تكرّر الخطأ نفسه.',
    syntax: 'كثيراً ما وصل الكود بأخطاء صياغة (أقواس/فواصل ناقصة، توكن غير متوقع) — راجع صياغة كل ملف قبل إعادته.',
};

/** الدروس الناضجة (≥ العتبة) مرتبة بالتكرار ومحدودة العدد — المصدر الواحد للحقن والعرض. */
export function matureLessons() {
    return [...lessons.values()]
        .filter(l => l.count >= MIN_COUNT_TO_TEACH)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_TAUGHT_LESSONS);
}

// ─── تحويل الفئات المتكررة إلى توجيهات جاهزة للمولّد ───────────────
// صياغات مكتوبة يدوياً (لا توليد) — جودة ثابتة وحجم محدود
const CATEGORY_DIRECTIVES = {
    responsive: 'المستخدمون كثيراً ما يطلبون إصلاح عرض الموبايل بعد التسليم — اجعل التجاوب ممتازاً من البداية (اختبر عقلياً عرض 360px: القوائم، الشبكات، أحجام النصوص).',
    colors: 'طلبات تغيير الألوان/الخلفيات متكررة بعد التسليم — اختر لوحة متناسقة بتباين ممتاز من أول مرة، وضعها كلها في CSS Variables ليسهل تعديلها.',
    typography: 'طلبات تحسين الخطوط متكررة — استخدم خطاً عربياً/لاتينياً عالي الجودة بأحجام متدرجة واضحة (clamp للعناوين).',
    layout: 'طلبات إعادة التنسيق والمحاذاة متكررة بعد التسليم — اضبط المسافات والمحاذاة بدقة (Grid/Flexbox، إيقاع مسافات موحد 8px).',
    add_section: 'المستخدمون كثيراً ما يضيفون أقساماً بعد البناء — غطِّ الأقسام الجوهرية لنوع المشروع كاملة من البداية (لا تبنِ صفحة مختصرة).',
    contact: 'قسم التواصل/واتساب يُطلب كثيراً بعد التسليم — ضمّن قسم تواصل حقيقياً (نموذج + زر واتساب/هاتف) افتراضياً.',
    images: 'طلبات تحسين الصور متكررة — استخدم صور Unsplash مناسبة فعلاً للمحتوى مع alt وأحجام محسّنة.',
    text_content: 'طلبات تعديل النصوص متكررة — اكتب محتوى واقعياً مفصّلاً خاصاً بالمشروع (لا عبارات عامة).',
    animations: 'طلبات إضافة الحركة متكررة — ضمّن transitions وscroll animations خفيفة افتراضياً.',
};

/** التوجيه الجاهز لدرسٍ ما، أو null إن كان الدرس للمشرف فقط (لا يُحقن). */
export function lessonDirective(l) {
    if (!l) return null;
    if (l.type === 'post_build_edit') return CATEGORY_DIRECTIVES[l.key] || null;
    if (l.type === 'verifier_missing') return `متطلب "${l.key}" كثيراً ما يُسلَّم ناقصاً — إن طُلب مثله فنفّذه كوظيفة عاملة فعلاً (منطق JS حقيقي، ليس عنصراً شكلياً).`;
    if (l.type === 'qa_failure') return `فاحص الجودة كثيراً ما يرفض بسبب: ${l.key} — تجنّبه من البداية.`;
    if (l.type === 'mission_failure') return FAILURE_DIRECTIVES[l.key] || null;
    if (l.type === 'behavior_gap') {
        const sample = l.samples?.[0] ? ` (مثال: ${l.samples[0]})` : '';
        return `التحقّق السلوكي بعد التسليم كثيراً ما يفشل في فحص "${l.key}"${sample} — اجعل هذا يعمل فعلاً من أول مرة.`;
    }
    return null;
}

/**
 * كتلة الدروس المتراكمة للحقن في prompt المولّد.
 * ترجع '' عندما لا توجد دروس ناضجة — فلا أثر على الـ prompt إطلاقاً.
 */
export function buildLessonsPromptBlock() {
    const mature = matureLessons();
    if (!mature.length) return '';

    const lines = [];
    for (const l of mature) {
        const directive = lessonDirective(l);
        if (directive) lines.push(`- ${directive}`);
    }
    if (!lines.length) return '';
    return `\n## 📚 دروس متراكمة من مشاريع سابقة على المنصة (طبّقها دون انتظار الطلب):\n${lines.join('\n')}`;
}

// ─── استعلامات (لوحة المشرف/الاختبارات) ────────────────────────────
export function topLessons(limit = 20) {
    return [...lessons.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function resetLessons() { lessons.clear(); } // للاختبارات فقط
