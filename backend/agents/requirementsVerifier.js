/**
 * 📋 Requirements Verifier — هل نُفِّذت متطلبات المشروع فعلاً؟
 *
 * الفجوة التي يسدّها: الـ App Blueprint كان يحدد المكوّنات الوظيفية
 * (بحث، حجز، سلة...) وتُحقن كسياق توليد — لكن لا أحد يتحقق بعد البناء
 * أنها نُفِّذت فعلاً وتعمل. النتيجة: مواقع "تبدو" صحيحة وميزاتها ناقصة.
 *
 * الدور:
 * - verifyRequirements: فحص LLM منظّم — لكل مكوّن وظيفي: نُفِّذ أم لا،
 *   ولماذا، وتعليمة إصلاح جاهزة للناقص.
 * - formatChecklist: قائمة تحقق صادقة تُعرض للمستخدم في الشات.
 *
 * llm قابل للحقن للاختبار. فشل النداء → null (المهمة لا تتعطل).
 */

import { smartChat } from './baseAgent.js';

const VERIFY_SYSTEM = `أنت مدقق جودة صارم لمواقع الويب. لديك متطلبات وظيفية وكود الموقع الفعلي.
لكل متطلب، افحص الكود بدقة: هل نُفِّذ **فعلاً بشكل عامل** (عناصر UI موجودة + منطق JavaScript حقيقي يعمل عليها ببيانات) — أم مجرد شكل/زخرفة/غير موجود؟

أعد JSON فقط:
{ "results": [ { "name": "اسم المتطلب", "implemented": true|false, "reason": "دليل موجز من الكود", "fixInstruction": "تعليمة تنفيذ كاملة (للناقص فقط، بالعربية، محددة قابلة للتنفيذ مباشرة)" } ] }

قواعد:
- زر بلا دالة تعمل = غير منفّذ. نموذج لا يعالج الإدخال = غير منفّذ. بحث لا يُصفّي بيانات حقيقية = غير منفّذ.
- كن صارماً لكن عادلاً: التنفيذ البسيط العامل يُحتسب منفّذاً.
- fixInstruction يجب أن تكفي وحدها لمحرر كود لتنفيذ المتطلب (اذكر الملفات والعناصر والسلوك المطلوب).`;

/**
 * @param {object} blueprint مخطط التطبيق (functionalComponents)
 * @param {Array<{name, content}>} files ملفات الموقع المبنية
 * @param {function} llm قابل للحقن (افتراضياً smartChat)
 * @returns {Promise<{results: Array, missing: Array, implementedCount: number} | null>}
 */
export async function verifyRequirements(blueprint, files, llm = smartChat) {
    const comps = blueprint?.functionalComponents || [];
    if (!comps.length || !Array.isArray(files) || !files.length) return null;

    // الكود ذو الصلة — مقصوص بحدود آمنة للسياق
    const html = files.filter(f => f.name.endsWith('.html'))
        .map(f => `// FILE: ${f.name}\n${(f.content || '').slice(0, 5000)}`).join('\n\n');
    const js = files.filter(f => f.name.endsWith('.js'))
        .map(f => `// FILE: ${f.name}\n${(f.content || '').slice(0, 7000)}`).join('\n\n');

    const reqList = comps.map((c, i) => `${i + 1}. ${c.name} — السلوك المطلوب: ${c.behavior || 'يعمل فعلياً'}`).join('\n');

    let parsed;
    try {
        const raw = await llm([
            { role: 'system', content: VERIFY_SYSTEM },
            { role: 'user', content: `## المتطلبات الوظيفية:\n${reqList}\n\n## HTML:\n${html}\n\n## JavaScript:\n${js}` },
        ], { max_tokens: 1200, temperature: 0, json: true });
        parsed = JSON.parse(raw);
    } catch (e) {
        return null; // فشل التحقق لا يُفشل المهمة
    }

    const results = Array.isArray(parsed?.results) ? parsed.results
        .filter(r => r && typeof r.name === 'string')
        .map(r => ({
            name: r.name,
            implemented: r.implemented === true,
            reason: typeof r.reason === 'string' ? r.reason : '',
            fixInstruction: typeof r.fixInstruction === 'string' ? r.fixInstruction : '',
        })) : [];
    if (!results.length) return null;

    const missing = results.filter(r => !r.implemented);
    return { results, missing, implementedCount: results.length - missing.length };
}

/** تعليمة إصلاح مجمّعة لكل النواقص — جولة تنفيذ واحدة */
export function buildFixInstruction(missing) {
    if (!missing?.length) return '';
    const items = missing
        .map((m, i) => `${i + 1}. ${m.name}: ${m.fixInstruction || `نفّذ "${m.name}" كميزة عاملة فعلياً (UI + منطق JS ببيانات حقيقية)`}`)
        .join('\n');
    return `نفّذ المتطلبات الوظيفية الناقصة التالية كميزات **عاملة فعلياً** (عناصر UI + منطق JavaScript حقيقي على بيانات وهمية واقعية — ليست زخرفة):\n${items}\nحافظ على كل ما هو موجود ويعمل كما هو.`;
}

/** قائمة تحقق صادقة للمستخدم */
export function formatChecklist(verdict, lang = 'ar', fixedNames = []) {
    if (!verdict?.results?.length) return '';
    const fixed = new Set(fixedNames);
    const lines = verdict.results.map(r => {
        if (r.implemented) return `✅ ${r.name}`;
        if (fixed.has(r.name)) return `🔧 ${r.name} — ${lang === 'ar' ? 'كان ناقصاً وأُصلح تلقائياً' : 'was missing, auto-fixed'}`;
        return `⚠️ ${r.name} — ${lang === 'ar' ? 'غير مكتمل' : 'incomplete'}${r.reason ? ` (${r.reason.slice(0, 80)})` : ''}`;
    });
    const header = lang === 'ar' ? '📋 **تحقق متطلبات المشروع:**' : '📋 **Project requirements check:**';
    return `${header}\n${lines.join('\n')}`;
}
