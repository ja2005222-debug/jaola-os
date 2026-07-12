/**
 * 🧩 Agent Spec — العقد الموحّد لوكلاء JAOLA
 *
 * كل وكيل متخصص يُعرّف بنفس الهيكل التسع (اقتراح المستخدم) — ما يجعل سلوكه
 * مستقراً مع أي نموذج ذكاء اصطناعي، لأن التعليمات تُصاغ دائماً بنفس البنية:
 *
 *   Mission · Responsibilities · Inputs · Outputs · Rules ·
 *   Quality Standards · Cooperation · Self Review · Never Do
 *
 * هذا الملف يوفّر:
 *   - defineAgent(spec): تحقّق + تطبيع الحقول
 *   - validateSpec(spec): إرجاع أخطاء البنية (قائمة نصية)
 *   - compileSpecToPrompt(spec, ctx): تحويل العقد إلى system prompt متّسق
 */

export const SPEC_SECTIONS = [
    'mission',
    'responsibilities',
    'inputs',
    'outputs',
    'rules',
    'qualityStandards',
    'cooperation',
    'selfReview',
    'neverDo',
];

// الأقسام التي يجب أن تكون قوائم غير فارغة
const LIST_SECTIONS = ['responsibilities', 'inputs', 'outputs', 'rules', 'qualityStandards', 'selfReview', 'neverDo'];

/** يتحقّق من اكتمال العقد ويُعيد قائمة الأخطاء (فارغة = صالح) */
export function validateSpec(spec) {
    const errors = [];
    if (!spec || typeof spec !== 'object') return ['العقد غير صالح (ليس كائناً)'];
    if (!spec.id || !/^[a-z][a-z0-9\-]*$/.test(spec.id)) errors.push('id مفقود أو غير صالح (a-z0-9- يبدأ بحرف)');
    if (!spec.role || typeof spec.role !== 'string') errors.push('role مفقود');
    if (!spec.mission || typeof spec.mission !== 'string' || spec.mission.trim().length < 10) {
        errors.push('mission مفقود أو قصير جداً');
    }
    for (const key of LIST_SECTIONS) {
        if (!Array.isArray(spec[key]) || spec[key].length === 0) {
            errors.push(`${key} يجب أن يكون قائمة غير فارغة`);
        } else if (spec[key].some((x) => typeof x !== 'string' || !x.trim())) {
            errors.push(`${key} يحتوي عنصراً فارغاً`);
        }
    }
    // cooperation: قائمة روابط {with, how}
    if (!Array.isArray(spec.cooperation)) {
        errors.push('cooperation يجب أن يكون قائمة');
    } else {
        spec.cooperation.forEach((c, i) => {
            if (!c || typeof c.with !== 'string' || typeof c.how !== 'string') {
                errors.push(`cooperation[${i}] يجب أن يكون { with, how }`);
            }
        });
    }
    return errors;
}

/** يتحقّق ويُطبّع العقد — يرمي خطأً واضحاً إن كان ناقصاً */
export function defineAgent(spec) {
    const errors = validateSpec(spec);
    if (errors.length) {
        throw new Error(`عقد الوكيل "${spec?.id || '?'}" غير صالح:\n- ${errors.join('\n- ')}`);
    }
    return {
        id: spec.id,
        role: spec.role,
        icon: spec.icon || '🧠',
        mission: spec.mission.trim(),
        responsibilities: [...spec.responsibilities],
        inputs: [...spec.inputs],
        outputs: [...spec.outputs],
        rules: [...spec.rules],
        qualityStandards: [...spec.qualityStandards],
        cooperation: spec.cooperation.map((c) => ({ with: c.with, how: c.how })),
        selfReview: [...spec.selfReview],
        neverDo: [...spec.neverDo],
        // اختياري: ترتيب التنفيذ ومتطلّباته
        dependsOn: Array.isArray(spec.dependsOn) ? [...spec.dependsOn] : [],
    };
}

const bullets = (arr) => arr.map((x) => `- ${x}`).join('\n');

/**
 * يحوّل العقد إلى system prompt بهيكل ثابت.
 * الثبات في البنية هو ما يجعل الوكيل مستقراً عبر النماذج المختلفة.
 */
export function compileSpecToPrompt(spec, ctx = {}) {
    const a = spec.id ? spec : defineAgent(spec);
    const coop = a.cooperation.length
        ? a.cooperation.map((c) => `- مع ${c.with}: ${c.how}`).join('\n')
        : '- يعمل مستقلاً في هذه المهمة';

    const langLine = ctx.lang && ctx.lang !== 'ar'
        ? `\nLANGUAGE: اكتب كل المخرجات النصية الموجّهة للمستخدم بلغة: ${ctx.lang}.`
        : '';

    return `أنت **${a.role}** ضمن فريق JAOLA الخلفي. التزم بهذا العقد حرفياً.${langLine}

## Mission
${a.mission}

## Responsibilities
${bullets(a.responsibilities)}

## Inputs
${bullets(a.inputs)}

## Outputs
${bullets(a.outputs)}

## Rules
${bullets(a.rules)}

## Quality Standards
${bullets(a.qualityStandards)}

## Cooperation
${coop}

## Self Review (راجع نفسك قبل التسليم)
${bullets(a.selfReview)}

## Never Do
${bullets(a.neverDo)}

التزم بالمخرجات المذكورة في قسم Outputs فقط، وبنفس الصيغة المطلوبة.`;
}
