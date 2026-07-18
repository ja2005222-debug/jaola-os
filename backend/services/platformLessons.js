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

const MIN_COUNT_TO_TEACH = 3;  // درس لم يتكرر 3 مرات ليس نمطاً بعد
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

/**
 * كتلة الدروس المتراكمة للحقن في prompt المولّد.
 * ترجع '' عندما لا توجد دروس ناضجة — فلا أثر على الـ prompt إطلاقاً.
 */
export function buildLessonsPromptBlock() {
    const mature = [...lessons.values()]
        .filter(l => l.count >= MIN_COUNT_TO_TEACH)
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_TAUGHT_LESSONS);
    if (!mature.length) return '';

    const lines = [];
    for (const l of mature) {
        if (l.type === 'post_build_edit' && CATEGORY_DIRECTIVES[l.key]) {
            lines.push(`- ${CATEGORY_DIRECTIVES[l.key]}`);
        } else if (l.type === 'verifier_missing') {
            lines.push(`- متطلب "${l.key}" كثيراً ما يُسلَّم ناقصاً — إن طُلب مثله فنفّذه كوظيفة عاملة فعلاً (منطق JS حقيقي، ليس عنصراً شكلياً).`);
        } else if (l.type === 'qa_failure') {
            lines.push(`- فاحص الجودة كثيراً ما يرفض بسبب: ${l.key} — تجنّبه من البداية.`);
        }
    }
    if (!lines.length) return '';
    return `\n## 📚 دروس متراكمة من مشاريع سابقة على المنصة (طبّقها دون انتظار الطلب):\n${lines.join('\n')}`;
}

// ─── استعلامات (لوحة المشرف/الاختبارات) ────────────────────────────
export function topLessons(limit = 20) {
    return [...lessons.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function resetLessons() { lessons.clear(); } // للاختبارات فقط
