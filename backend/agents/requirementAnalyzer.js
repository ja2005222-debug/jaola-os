/**
 * 🧠 Smart Requirement Analyzer — JAOLA OS
 *
 * يُحلل طلب المستخدم بعمق ويستخرج:
 * - المتطلبات الصريحة (ما قاله المستخدم)
 * - المتطلبات الضمنية (ما يحتاجه بالضرورة ولم يقله)
 * - التعقيد التقني (بسيط / متوسط / متقدم)
 * - المخاطر والتحذيرات
 * - اقتراحات ذكية لتحسين المشروع
 *
 * يعمل بعد Clarifier ويُثري الـ goal قبل التنفيذ.
 */

import { smartChat } from './baseAgent.js';

// ═══════════════════════════════════════════════════════
// 🔍 تحليل ثابت سريع (بدون AI)
// ═══════════════════════════════════════════════════════
export function staticAnalysis(userGoal, projectType, clarifierAnswers = []) {
    const goal = (userGoal || '').toLowerCase();
    const analysis = {
        explicitRequirements: [],
        implicitRequirements: [],
        technicalComplexity: 'simple',
        warnings: [],
        suggestions: [],
    };

    // ── المتطلبات الضمنية حسب نوع المشروع ──
    const implicitMap = {
        ecommerce: [
            'صفحة تفاصيل المنتج',
            'سلة تسوق تفاعلية',
            'صفحة إتمام الشراء',
            'نظام تصفية وبحث',
            'عرض حالة المخزون',
        ],
        restaurant: [
            'قائمة طعام منظمة بفئات',
            'زر الاتصال المباشر',
            'ساعات العمل واضحة',
            'خريطة الموقع',
        ],
        medical: [
            'نموذج حجز موعد',
            'معلومات الطوارئ',
            'أوقات العيادة',
            'قسم التخصصات',
        ],
        hotel: [
            'تاريخ الوصول والمغادرة',
            'مقارنة الغرف والأسعار',
            'سياسة الإلغاء',
            'صور المرافق',
        ],
        education: [
            'مستوى الدورة (مبتدئ/متقدم)',
            'مدة الدورة',
            'شهادة الإتمام',
            'معلومات المدرب',
        ],
        gym: [
            'جدول الحصص الأسبوعي',
            'باقات العضوية والأسعار',
            'معلومات المدربين',
            'صور الأجهزة والمرافق',
        ],
        portfolio: [
            'معرض أعمال مع تصنيفات',
            'نموذج تواصل مباشر',
            'روابط التواصل الاجتماعي',
            'سيرة ذاتية قابلة للتحميل',
        ],
    };

    analysis.implicitRequirements = implicitMap[projectType] || [
        'قسم من نحن',
        'معلومات التواصل',
        'تصميم متجاوب للجوال',
    ];

    // ── تحديد التعقيد التقني ──
    const complexKeywords = [
        'دفع', 'payment', 'cart', 'سلة', 'حجز', 'booking',
        'لوحة تحكم', 'dashboard', 'admin', 'مستخدمين', 'users',
        'api', 'قاعدة بيانات', 'database', 'اشتراك', 'subscription'
    ];
    const advancedCount = complexKeywords.filter(kw => goal.includes(kw)).length;

    if (advancedCount >= 3) analysis.technicalComplexity = 'advanced';
    else if (advancedCount >= 1) analysis.technicalComplexity = 'medium';
    else analysis.technicalComplexity = 'simple';

    // ── تحذيرات ذكية ──
    if (goal.includes('فوري') || goal.includes('سريع') || goal.includes('quick')) {
        analysis.warnings.push('طلب سريع — قد تكون بعض الأقسام مختصرة');
    }
    if (goal.length < 20) {
        analysis.warnings.push('الوصف قصير — النتيجة ستكون نموذجاً عاماً');
    }
    if (advancedCount >= 3 && !goal.includes('قاعدة بيانات') && !goal.includes('database')) {
        analysis.warnings.push('المشروع يحتاج قاعدة بيانات — سيتم إضافتها تلقائياً');
    }

    // ── اقتراحات ذكية ──
    if (projectType === 'ecommerce' && !goal.includes('seo') && !goal.includes('سيو')) {
        analysis.suggestions.push('إضافة meta tags للـ SEO ستزيد ظهور المتجر في جوجل');
    }
    if (projectType === 'medical' && !goal.includes('whatsapp') && !goal.includes('واتساب')) {
        analysis.suggestions.push('زر واتساب للحجز السريع يزيد التحويلات بشكل كبير');
    }
    if (['restaurant', 'hotel'].includes(projectType)) {
        analysis.suggestions.push('إضافة قسم آراء العملاء يبني الثقة ويزيد الحجوزات');
    }

    return analysis;
}

// ═══════════════════════════════════════════════════════
// 🤖 تحليل AI عميق
// ═══════════════════════════════════════════════════════
export async function deepAnalysis(userGoal, projectType, clarifierAnswers = []) {
    const answersText = clarifierAnswers.length > 0
        ? `\nإجابات المستخدم على الأسئلة:\n${clarifierAnswers.join('\n')}`
        : '';

    try {
        const response = await smartChat([{
            role: 'system',
            content: `أنت محلل متطلبات ويب خبير. حلّل الطلب واستخرج المعلومات المطلوبة بـ JSON فقط.`
        }, {
            role: 'user',
            content: `المشروع: "${userGoal}"
النوع: ${projectType}${answersText}

أعطني JSON:
{
  "projectName": "اسم مناسب للمشروع",
  "targetAudience": "الجمهور المستهدف",
  "mainGoal": "الهدف الرئيسي من الموقع في جملة واحدة",
  "keyFeatures": ["ميزة جوهرية 1", "ميزة جوهرية 2", "ميزة جوهرية 3"],
  "contentSuggestions": ["محتوى مقترح 1", "محتوى مقترح 2"],
  "colorPersonality": "وصف شخصية الألوان المناسبة"
}`
        }], { max_tokens: 400, temperature: 0.4, json: true });

        return JSON.parse(response);
    } catch (e) {
        return null;
    }
}

// ═══════════════════════════════════════════════════════
// 🚀 التحليل الكامل
// ═══════════════════════════════════════════════════════
export async function analyzeRequirements(userGoal, projectType, clarifierAnswers = []) {
    const static_analysis = staticAnalysis(userGoal, projectType, clarifierAnswers);
    const ai_analysis = await deepAnalysis(userGoal, projectType, clarifierAnswers);

    return {
        ...static_analysis,
        projectName: ai_analysis?.projectName || null,
        targetAudience: ai_analysis?.targetAudience || null,
        mainGoal: ai_analysis?.mainGoal || null,
        keyFeatures: ai_analysis?.keyFeatures || [],
        contentSuggestions: ai_analysis?.contentSuggestions || [],
        colorPersonality: ai_analysis?.colorPersonality || null,
    };
}

// ═══════════════════════════════════════════════════════
// 📝 توليد نص سياق مُثرى للـ Coder
// ═══════════════════════════════════════════════════════
export function buildRequirementsContext(analysis) {
    const parts = [];

    if (analysis.mainGoal) {
        parts.push(`الهدف الرئيسي: ${analysis.mainGoal}`);
    }
    if (analysis.targetAudience) {
        parts.push(`الجمهور المستهدف: ${analysis.targetAudience}`);
    }
    if (analysis.implicitRequirements.length > 0) {
        parts.push(`متطلبات ضمنية يجب تضمينها:\n${analysis.implicitRequirements.map(r => `  - ${r}`).join('\n')}`);
    }
    if (analysis.keyFeatures.length > 0) {
        parts.push(`الميزات الجوهرية:\n${analysis.keyFeatures.map(f => `  - ${f}`).join('\n')}`);
    }
    if (analysis.contentSuggestions.length > 0) {
        parts.push(`محتوى مقترح:\n${analysis.contentSuggestions.map(s => `  - ${s}`).join('\n')}`);
    }
    if (analysis.colorPersonality) {
        parts.push(`شخصية الألوان: ${analysis.colorPersonality}`);
    }
    if (analysis.suggestions.length > 0) {
        parts.push(`اقتراحات لتحسين المشروع:\n${analysis.suggestions.map(s => `  💡 ${s}`).join('\n')}`);
    }

    return parts.length > 0
        ? `\n## تحليل المتطلبات (Smart Analyzer):\n${parts.join('\n\n')}\n`
        : '';
}
