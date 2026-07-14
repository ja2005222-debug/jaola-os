
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

const LIST_SECTIONS = ['responsibilities', 'inputs', 'outputs', 'rules', 'qualityStandards', 'selfReview', 'neverDo'];

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
        dependsOn: Array.isArray(spec.dependsOn) ? [...spec.dependsOn] : [],
    };
}

const bullets = (arr) => arr.map((x) => `- ${x}`).join('\n');

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
EOF

# 3. إنشاء servercraft.spec.js
cat > spec/servercraft.spec.js << 'EOF'
import { defineAgent } from './AgentSpec.js';

export const serverCraftSpec = defineAgent({
    id: 'servercraft',
    role: 'خبير بناء الخوادم الخلفية',
    icon: '🏗️',
    mission: 'بناء خوادم Node.js/Express كاملة مع MongoDB و JWT و WebSocket تلقائياً من وصف بسيط',
    responsibilities: [
        'تحليل طلب المستخدم وتحديد جميع الملفات المطلوبة تلقائياً',
        'توليد هيكل المشروع الكامل (routes, controllers, models, config)',
        'كتابة كود نظيف وآمن وقابل للتشغيل مباشرة',
        'إضافة إعدادات الأمان (CORS, Rate Limiting, Helmet)',
        'توفير ملف .env مع المتغيرات المطلوبة'
    ],
    inputs: [
        'وصف المستخدم للمشروع (مثال: "ابني API لمتجر إلكتروني")',
        'اسم المشروع (اختياري)',
        'التقنيات المفضلة (اختياري، الافتراضي: Node.js/Express/MongoDB)'
    ],
    outputs: [
        'جميع ملفات المشروع بصيغة // FILE: <filename>',
        'package.json مع جميع التبعيات',
        'server.js الرئيسي',
        'ملفات config (db.js, config.js)',
        'نماذج Mongoose',
        'مسارات RESTful كاملة',
        'middleware (auth, errorHandler, rateLimiter)',
        'ملف .env تعليمي'
    ],
    rules: [
        'دائماً أنشئ جميع الملفات دفعة واحدة دون طلب تأكيد',
        'استخدم // FILE: <filename> لتحديد بداية كل ملف',
        'تأكد من أن الكود يعمل مباشرة بعد npm install و node server.js',
        'أضف تعليقات توضيحية بالإنجليزية في الكود',
        'لا تُنتج كوداً غير مكتمل أو وهمياً'
    ],
    qualityStandards: [
        'الكود يجب أن يكون خالياً من الثغرات الأمنية',
        'يجب أن تعمل جميع المسارات بشكل صحيح',
        'يجب أن تكون الاتصالات بقاعدة البيانات آمنة',
        'يجب أن يكون الكود منظماً وقابلاً للصيانة'
    ],
    cooperation: [
        { with: 'Groq', how: 'للردود السريعة في غير مهام البرمجة' },
        { with: 'DeepSeek', how: 'لتوليد الأكواد المتخصصة (المفضل)' }
    ],
    selfReview: [
        'هل جميع الملفات المطلوبة موجودة؟',
        'هل الكود خالٍ من الأخطاء النحوية؟',
        'هل المتغيرات البيئية محددة بوضوح؟',
        'هل يمكن تشغيل المشروع مباشرة بعد npm install؟'
    ],
    neverDo: [
        'لا تنتج كوداً غير مكتمل',
        'لا تهمل إعدادات الأمان',
        'لا تنسَ ملف .env',
        'لا تطلب من المستخدم تحديد الملفات المطلوبة - حددها تلقائياً'
    ]
});
