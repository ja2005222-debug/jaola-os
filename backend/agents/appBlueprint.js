/**
 * 🧭 App Blueprint — يفهم "نوع التطبيق" ومكوّناته الوظيفية
 *
 * المشكلة: كل مشروع كان يخرج كصفحة بروشور واحدة (navbar/hero/خدمات/footer)
 * بغضّ النظر عن نوعه — تطبيق طيران بلا حقل بحث عامل، تطبيق جوال يخرج كعيادة.
 *
 * الحل: قبل البناء، LLM يحلل الطلب ويُخرج مخططاً منظّماً:
 * - kind: هل هو تطبيق تفاعلي (webapp) أم أداة (tool) أم هبوط (landing) أم بروشور؟
 * - functionalComponents: المكوّنات التي يجب أن تعمل فعلاً (بحث، فلترة، حاسبة...)
 * - primaryAction: الفعل الأساسي للمستخدم
 * ثم يُحقن هذا في سياق المولّد ليبني ميزات عاملة لا زخارف.
 */

import { smartChat } from './baseAgent.js';

// تصنيف احتياطي سريع (بدون LLM) — يميّز التطبيقات التفاعلية عن البروشورات
function staticKind(goal) {
    const g = (goal || '').toLowerCase();
    const appHints = /تطبيق|اب |app|application|منصة|platform|نظام|system|أداة|tool|حاسبة|calculator|محول|converter|لوحة تحكم|dashboard|بحث|search|حجز طيران|طيران|flight|رحلات|booking|متجر|store|shop|سلة|cart|to.?do|قائمة مهام|chat|محادثة|خريطة|map|لعبة|game|تتبع|tracker/;
    const brochureHints = /تعريفي|بروشور|brochure|صفحة هبوط بسيطة|شركة|مؤسسة|عيادة|مطعم تعريفي/;
    if (appHints.test(g) && !brochureHints.test(g)) return 'webapp';
    return 'brochure';
}

const BLUEPRINT_SYSTEM = `أنت محلل منتجات برمجية خبير. مهمتك تحويل طلب المستخدم (بأي لغة) إلى مخطط بناء منظّم.
فكّر: ما نوع هذا المنتج فعلاً؟ وما الميزات التي يجب أن *تعمل* لا أن تكون مجرد زينة؟

أرجع JSON فقط بهذا الشكل الحرفي:
{
  "appType": "وصف دقيق ومحدد للنوع (مثل: تطبيق حجز طيران، أداة حساب قروض، لوحة تحكم مبيعات)",
  "category": "الفئة العامة (travel|ecommerce|medical|restaurant|saas|tool|social|education|realestate|portfolio|dashboard|game|business|other)",
  "kind": "webapp أو tool أو landing أو brochure — webapp=تطبيق تفاعلي بحالة وبيانات، tool=أداة مدخلات/مخرجات، landing=هبوط لمنتج/تطبيق، brochure=موقع تعريفي",
  "coreValue": "القيمة الأساسية بجملة واحدة",
  "primaryAction": "الفعل الرئيسي للمستخدم (مثل: يبحث عن رحلة ويحجزها)",
  "functionalComponents": [
    { "name": "اسم المكوّن (مثل: نموذج بحث الرحلات)", "behavior": "ماذا يفعل بالضبط عند التفاعل — بتفصيل يكفي لبرمجته بـ JavaScript على بيانات وهمية واقعية" }
  ],
  "keySections": ["الأقسام الرئيسية للصفحة بالترتيب"],
  "mockData": "وصف البيانات الوهمية الواقعية المطلوبة لتشغيل المكوّنات (مثل: 8 رحلات طيران بمدن وأسعار ومواعيد)"
}

قواعد:
- إذا كان المنتج تطبيقاً/أداة، يجب أن تحتوي functionalComponents على 2-4 مكوّنات *تفاعلية حقيقية* (بحث، فلترة، حساب، إضافة/حذف، تبديل...).
- لا تحوّل كل شيء إلى بروشور. تطبيق طيران محوره حقل بحث يعمل ويعرض نتائج مفلترة.
- اجعل mockData واقعية ومحددة.`;

export async function generateBlueprint(goal) {
    const fallbackKind = staticKind(goal);

    try {
        const raw = await smartChat([
            { role: 'system', content: BLUEPRINT_SYSTEM },
            { role: 'user', content: `الطلب: "${goal}"` },
        ], { max_tokens: 900, temperature: 0.3, json: true });

        const bp = JSON.parse(raw);
        // تحصين الحقول
        bp.kind = bp.kind || fallbackKind;
        bp.category = bp.category || 'business';
        bp.functionalComponents = Array.isArray(bp.functionalComponents) ? bp.functionalComponents.slice(0, 5) : [];
        bp.keySections = Array.isArray(bp.keySections) ? bp.keySections : [];
        bp._source = 'llm';
        return bp;
    } catch (e) {
        // مخطط احتياطي أدنى — يحافظ على معرفة أنه تطبيق وليس بروشور
        return {
            appType: goal.slice(0, 60),
            category: 'business',
            kind: fallbackKind,
            coreValue: goal.slice(0, 80),
            primaryAction: '',
            functionalComponents: fallbackKind !== 'brochure'
                ? [{ name: 'الميزة الأساسية التفاعلية', behavior: 'نفّذ الوظيفة الجوهرية للتطبيق بـ JavaScript على بيانات وهمية واقعية' }]
                : [],
            keySections: [],
            mockData: 'بيانات وهمية واقعية مناسبة للمنتج',
            _source: 'fallback',
        };
    }
}

// يبني فقرة سياق تُحقن في هدف البناء وتوجّه المولّد لبناء ميزات عاملة
export function buildBlueprintContext(bp) {
    if (!bp) return '';

    const isInteractive = bp.kind === 'webapp' || bp.kind === 'tool';
    const comps = (bp.functionalComponents || [])
        .map((c, i) => `   ${i + 1}. ${c.name} — ${c.behavior}`)
        .join('\n');

    const lines = [
        '\n## 🧭 مخطط التطبيق (App Blueprint) — التزم به:',
        `**النوع:** ${bp.appType} (فئة: ${bp.category} | صنف: ${bp.kind})`,
        `**القيمة الأساسية:** ${bp.coreValue}`,
        bp.primaryAction ? `**الفعل الرئيسي للمستخدم:** ${bp.primaryAction}` : '',
    ];

    if (isInteractive && comps) {
        lines.push(
            '',
            '### ⚙️ مكوّنات وظيفية *يجب أن تعمل فعلاً* (ليست زخرفية):',
            comps,
            '',
            '**قواعد إلزامية للمكوّنات الوظيفية:**',
            '- كل مكوّن أعلاه يُبنى كميزة تفاعلية حقيقية في script.js — أحداث، حالة، تحديث DOM.',
            '- عرّف بيانات وهمية واقعية في script.js (مصفوفة كائنات) لتشغيلها فعلياً.',
            '- حقل البحث/الفلترة يجب أن يُصفّي ويعرض نتائج حقيقية من البيانات عند التفاعل.',
            '- النماذج تتحقق من المدخلات وتعرض استجابة واضحة (نجاح/نتيجة) لا مجرد alert.',
            `- بيانات وهمية مطلوبة: ${bp.mockData || 'بيانات واقعية مناسبة'}.`,
            '- هذا **تطبيق تفاعلي** — لا تبنِه كصفحة تعريفية ساكنة.',
        );
    }

    if (bp.keySections?.length) {
        lines.push('', `### الأقسام الرئيسية: ${bp.keySections.join(' • ')}`);
    }

    return lines.filter(Boolean).join('\n');
}
