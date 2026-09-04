/**
 * 🧠 Requirement Analyzer — JAOLA OS
 *
 * يُثري هدف البناء بما لم يقله المستخدم ويحتاجه:
 * - المتطلبات الضمنية: جدولٌ ثابتٌ حسب نوع المشروع
 * - اقتراحات لتحسين المشروع
 * - حقولُ الذكاء (اسم، جمهور، هدف، ميزات، محتوى، شخصية ألوان) — نداءٌ واحد
 *
 * 📌 الترويسةُ كانت تَعِد بأربعةٍ ويُسلَّم اثنان. «المتطلبات الصريحة» حقلٌ
 *    لم يُملأ قطّ، و«التعقيد التقني» و«التحذيرات» كانا يُحسبان ولا يقرأهما
 *    أحد — لا في هذه الوحدة ولا في الريبو كلّه. حُذفت الثلاثة، ولكلٍّ سببه
 *    في CONTRACTS.md (Sprint 2k). فما بقي هنا هو ما يصل البناءَ فعلاً.
 *
 * ملاحظةٌ على المدخلات: إجاباتُ المُوضِّح تصل داخل نصّ الهدف نفسه
 * (getFinalGoal يدمج «س/ج» في الهدف)، فلا تُمرَّر مصفوفةً منفصلة.
 */

import { smartChat } from './baseAgent.js';

// ═══════════════════════════════════════════════════════
// 🔍 تحليل ثابت سريع (بدون AI)
// ═══════════════════════════════════════════════════════
export function staticAnalysis(userGoal, projectType) {
    const goal = (userGoal || '').toLowerCase();
    const analysis = {
        implicitRequirements: [],
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

    // 📌 هنا كان مسحٌ لكلماتٍ «متقدّمة» يحسب حقلَ التعقيد وثلاثةَ
    // تحذيرات. أُزيل كلُّه، ولكلِّ قطعةٍ سببها:
    //
    // • حقلُ التعقيد — لا يقرأه أحد، وتوصيلُه اليوم يصنع إشارةَ تعقيدٍ
    //   ثانية بجانب needsBackend — وهو المصدر الواحد الذي وُحِّد في Sprint 7/1.
    // • «طلب سريع»: يستنتج عَجَلةَ الطالب من لفظٍ يصف المنتج. «مطعم وجبات
    //   سريعة» كان يُقرأ استعجالاً. هو بعينه عطبُ Sprint 2f.
    // • «يحتاج قاعدة بيانات»: حكمٌ يملكه needsBackend وحده.
    // • «الوصف قصير»: صحيحٌ في ذاته، لكن قناته كانت prompt المبرمج — وهي
    //   ليست مكان مخاطبة المستخدم. إن أُريد قولُه له فمن قناة السجلّ الحيّ،
    //   وذلك قرارُ منتجٍ لم يُتَّخذ هنا.
    // والمسحُ نفسه كان بـ includes الخام: «سلسلة مطاعم» يحوي «سلة»،
    // و«capital» يحوي «api».

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
    const static_analysis = staticAnalysis(userGoal, projectType);
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
export function buildRequirementsContext(analysis = {}) {
    const parts = [];
    // كلُّ حقلٍ يُقرأ بحارسه: الدالّتان مُصدَّرتان، وتركيبُهما الطبيعي
    // buildRequirementsContext(staticAnalysis(...)) كان **يرمي** لأن
    // keyFeatures وcontentSuggestions لا يضيفهما إلا مسارُ الذكاء.
    const list = (v) => (Array.isArray(v) ? v : []);

    if (analysis.mainGoal) {
        parts.push(`الهدف الرئيسي: ${analysis.mainGoal}`);
    }
    if (analysis.targetAudience) {
        parts.push(`الجمهور المستهدف: ${analysis.targetAudience}`);
    }
    if (list(analysis.implicitRequirements).length > 0) {
        parts.push(`متطلبات ضمنية يجب تضمينها:\n${list(analysis.implicitRequirements).map(r => `  - ${r}`).join('\n')}`);
    }
    if (list(analysis.keyFeatures).length > 0) {
        parts.push(`الميزات الجوهرية:\n${list(analysis.keyFeatures).map(f => `  - ${f}`).join('\n')}`);
    }
    if (list(analysis.contentSuggestions).length > 0) {
        parts.push(`محتوى مقترح:\n${list(analysis.contentSuggestions).map(s => `  - ${s}`).join('\n')}`);
    }
    if (analysis.colorPersonality) {
        parts.push(`شخصية الألوان: ${analysis.colorPersonality}`);
    }
    if (list(analysis.suggestions).length > 0) {
        parts.push(`اقتراحات لتحسين المشروع:\n${list(analysis.suggestions).map(s => `  💡 ${s}`).join('\n')}`);
    }

    return parts.length > 0
        ? `\n## تحليل المتطلبات (Smart Analyzer):\n${parts.join('\n\n')}\n`
        : '';
}
