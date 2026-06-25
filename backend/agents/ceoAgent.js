import { groq, ai } from './baseAgent.js';
import * as templateGenerator from '../lib/templateGenerator.js';

const extractCategory = templateGenerator.extractCategory || templateGenerator.default?.extractCategory;

// دالة ذكية لفحص وحصر أخطاء الـ API وحظر الحصص
const handleApiError = (error) => {
    const msg = error.message || '';
    const isQuota = error.status === 429 || 
                    msg.toLowerCase().includes('quota') || 
                    msg.toLowerCase().includes('rate limit') || 
                    msg.toLowerCase().includes('limit');
    if (isQuota) {
        return { 
            error: 'API_QUOTA_EXHAUSTED', 
            details: 'لقد نفدت حصة طلبات الذكاء الاصطناعي اليومية المتاحة. يرجى محاولة استخدام مفتاح API آخر أو الانتظار للغد.' 
        };
    }
    return { error: 'API_ERROR', details: msg };
};

export async function coreClassifyIntent(userPrompt) {
    const lowerPrompt = userPrompt.toLowerCase().trim();
    
    // فحص موافقة النشر التلقائي السحابي
    const deployWords = ['انشر', 'موافق', 'اعتمد', 'deploy', 'publish', 'النموذج النهائي'];
    const isDeployApproval = deployWords.some(w => lowerPrompt.includes(w));
    
    if (isDeployApproval) {
        return { 
            type: "DEPLOY_APPROVAL", 
            reply: "🚀 جاري النشر السحابي للنموذج المعتمد...",
            category: (typeof extractCategory === 'function' ? extractCategory(userPrompt) : 'default')
        };
    }

    if (lowerPrompt.includes('توقف') || lowerPrompt.includes('إلغاء') || lowerPrompt.includes('stop')) {
        return { 
            type: "GENERAL_CHAT", 
            reply: "🛑 تم إيقاف كافة العمليات التنفيذية فوراً يا رئيس. أنا في وضع الاستعداد التام.",
            category: (typeof extractCategory === 'function' ? extractCategory(userPrompt) : 'default')
        };
    }

    const systemInstruction = `أنت الموجه والمهندس الرئيسي (Router & Architect) لمنصة JAOLA OS الذكية لتطوير الويب.
    مهمتك هي تحليل نص المستخدم بدقة متناهية وفرز النوايا البرمجية والتشغيلية:

    1. تصنيف النوايا (Intent Classification):
    - "INCREMENTAL_BUILD": إذا طلب المستخدم أي تعديل في التصميم، تغيير ألوان، إضافة ميزات، إنشاء صفحات جديدة، ربط أزرار، تعديل نصوص في الواجهة، بناء تطبيقات، أو تصليح أخطاء برمجية.
    - "GENERAL_CHAT": إذا كان النص عبارة عن نقاش، سلام وترحيب، استفسار تقني نظري بحت لا يتطلب تعديل الكود، أو طلب نصيحة برمجية دون لمس الملفات الحالية.

    2. قواعد الاستجابة:
    - في حال كان التصنيف "INCREMENTAL_BUILD"، اجعل حقل الـ "reply" فارغاً تماماً "".
    - في حال كان التصنيف "GENERAL_CHAT"، اكتب رداً احترافياً باللغة العربية بأسلوب استشاري تقني راقٍ ولبق يجيب على استفساره مباشرة.

    صيغة الرد الإلزامية هي JSON صافٍ ومغلق تماماً كما يلي:
    {
      "type": "INCREMENTAL_BUILD" أو "GENERAL_CHAT",
      "reply": "نص الرد هنا إن وجد أو تركه فارغاً"
    }`;

    const detectedCategory = (typeof extractCategory === 'function' ? extractCategory(userPrompt) : 'default');

    if (groq) {
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: "system", content: systemInstruction }, { role: "user", content: userPrompt }],
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" }
            });
            const parsedResult = JSON.parse(completion.choices[0].message.content);
            return {
                type: parsedResult.type,
                reply: parsedResult.reply,
                category: detectedCategory
            };
        } catch (e) { 
            console.log('⚠️ خطأ في تصنيف Groq، تجربة Gemini البديل...'); 
            const errorResult = handleApiError(e);
            if (errorResult.error === 'API_QUOTA_EXHAUSTED' && !ai) return errorResult;
        }
    }

    if (ai) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `نص المستخدم: "${userPrompt}"`,
                config: { 
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json" 
                }
            });
            const parsedResult = JSON.parse(response.text.trim());
            return {
                type: parsedResult.type,
                reply: parsedResult.reply,
                category: detectedCategory
            };
        } catch (e) { 
            console.log('⚠️ فشل محرك Gemini البديل أيضاً:', e.message); 
            return handleApiError(e);
        }
    }

    const actionWords = ['ابن', 'عدل', 'غير', 'احقن', 'أضف', 'صمم', 'تحديث', 'build', 'create', 'موقع', 'صفحة', 'بيتزا'];
    const isBuild = actionWords.some(w => lowerPrompt.includes(w));
    
    return { 
        type: isBuild ? "INCREMENTAL_BUILD" : "GENERAL_CHAT", 
        reply: "🤖 خوادم المعالجة في وضع الاستعداد لحمل أفكارك الاستراتيجية الكبرى.",
        category: detectedCategory
    };
}
