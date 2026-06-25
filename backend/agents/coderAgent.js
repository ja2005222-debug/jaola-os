import { groq, ai } from './baseAgent.js';
import * as templateGenerator from '../lib/templateGenerator.js';

const generateTemplate = templateGenerator.generateTemplate || templateGenerator.default?.generateTemplate;

const handleApiError = (error) => {
    const msg = error.message || '';
    const isQuota = error.status === 429 || 
                    msg.toLowerCase().includes('quota') || 
                    msg.toLowerCase().includes('rate limit') || 
                    msg.toLowerCase().includes('limit');
    if (isQuota) {
        return { 
            error: 'API_QUOTA_EXHAUSTED', 
            details: 'لقد نفدت الحصة اليومية لتوليد الكود عبر الذكاء الاصطناعي. يرجى التعديل يدوياً أو استخدام مفتاح API آخر.' 
        };
    }
    return { error: 'API_ERROR', details: msg };
};

// إضافة المعامل الخامس "onChunk" لاستقبال دفق الأكواد لحظة بلحظة
export async function coreGenerateCodePlan(userPrompt, currentCodeContext, category, chatHistory, onChunk) {
    const safeCategory = category || 'default';
    const baseTemplate = (typeof generateTemplate === 'function') 
        ? generateTemplate(safeCategory, 'light') 
        : { html: '<h1>JAOLA OS Sandbox Ready</h1>', css: 'body { font-family: sans-serif; }' };

    const systemInstruction = `أنت مهندس البرمجيات الأول وخبير واجهات وتجربة المستخدم (Lead UI/UX Engineer) لمنصة JAOLA OS المتقدمة.
    دورك هو قيادة التطوير وصياغة الكود التنفيذي النهائي المكتوب بحرفية بالغة وجودة فائقة.

    🚨 [بروتوكول التطوير الصارم والقوانين الإلزامية]:

    1. مبدأ الحفاظ على المكتسبات (State Preservation):
    - يمنع منعاً باتاً إلغاء أو حذف أو تبسيط أي ميزات، أكواد، أو عناصر تم بناؤها في المراحل السابقة داخل "الكود الفعلي الحالي".
    - يمنع استخدام تعليقات نائبة مثل "// كودك السابق هنا" أو "// باقي الكود لا يتغير". يجب كتابة الكود كاملاً (كامل الملف) وبشكل جاهز تماماً للعمل فوراً دون أي قطع أو اختزال.

    2. مبدأ الحرفية البصرية والجمالية (UI/UX Craftsmanship):
    - التزم بتصميم عصري فخم وسريع الاستجابة (Responsive) ومريح للعين (استخدم خطوط عربية أنيقة مثل Cairo أو Tajawal عبر Google Fonts).
    - استخدم تنسيقات CSS حديثة: Flexbox و Grid لتنظيم المحاذاة، ألوان متناغمة، تباين لوني ممتاز، تأثيرات Hover تفاعلية، وانتقالات ناعمة (Transitions).
    - استخدم تدرجات لونية عصرية، تأثيرات Glassmorphism خفيفة، وظلال تمنح الواجهة عمقاً بصرياً فخماً.

    3. مبدأ التفاعل والصلابة (Interactive JS & Resilience):
    - اكتب كود JavaScript نظيف، خالي من الأخطاء المنطقية، ومبني لتفادي تعارض أحداث DOM.
    - أضف تفاعلات ديناميكية ملهمة (مثل حركات فتح القوائم، تحديثات حية للبيانات، رسائل تأكيدية Toast عصرية عند الحفظ، وتأثيرات تحميل Spinner).

    4. التعامل مع القوالب والمجالات:
    - في حال كان الكود الحالي فارغاً (بداية المشروع)، استخدم الهياكل الأساسية للقالب المصنعي المرفق كنتقة انطلاق قوية تتوافق مع هوية وطبيعة المجال المحدد (Category).
    - قم بحقن الميزات التي طلبها المستخدم مع دمجها بشكل متناسق مع القالب من حيث الألوان والنبرة البصرية.

    [القالب المصنعي المعتمد للمجال في حال البدء من الصفر]:
    HTML BASE: ${baseTemplate.html}
    CSS BASE: ${baseTemplate.css}

    رد بصيغة JSON صافية فقط بدون مقدمات أو شرح كالتالي:
    { "files": [ {"name": "index.html", "content": "..."} ] }`;

    let messagesPayload = [{ role: "system", content: systemInstruction }];

    chatHistory.forEach(hist => {
        messagesPayload.push({ role: hist.role, content: hist.content });
    });

    const userContent = `[الكود الفعلي الحالي في المجلد]:\n${currentCodeContext || ""}\n\n[طلب التعديل الجديد للعميل]: "${userPrompt}"`;
    messagesPayload.push({ role: "user", content: userContent });

    if (groq) {
        try {
            // تفعيل البث في محرك Groq
            const completion = await groq.chat.completions.create({
                messages: messagesPayload,
                model: "llama-3.3-70b-versatile",
                response_format: { type: "json_object" },
                stream: true 
            });
            
            let fullContent = "";
            for await (const chunk of completion) {
                const text = chunk.choices[0]?.delta?.content || "";
                fullContent += text;
                if (typeof onChunk === 'function' && text) {
                    onChunk(text); // إرسال الجزء المولد في نفس اللحظة
                }
            }

            chatHistory.push({ role: "user", content: userPrompt });
            chatHistory.push({ role: "assistant", content: fullContent });
            return JSON.parse(fullContent);
        } catch (e) { 
            console.log('⚠️ خطأ في بث Groq، جاري التحويل لـ Gemini البديل المتدفق...'); 
            const errRes = handleApiError(e);
            if (errRes.error === 'API_QUOTA_EXHAUSTED' && !ai) return errRes;
        }
    }

    if (ai) {
        try {
            // تفعيل البث في محرك Gemini
            const responseStream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents: geminiContents,
                config: { 
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json" 
                }
            });

            let fullContent = "";
            for await (const chunk of responseStream) {
                const text = chunk.text;
                fullContent += text;
                if (typeof onChunk === 'function' && text) {
                    onChunk(text); // إرسال الجزء المولد في نفس اللحظة
                }
            }

            chatHistory.push({ role: "user", content: userPrompt });
            chatHistory.push({ role: "assistant", content: fullContent });
            return JSON.parse(fullContent);
        } catch (e) { 
            console.log('⚠️ فشل البث عبر محرك Gemini البديل أيضاً:', e.message); 
            return handleApiError(e);
        }
    }

    return { 
        files: [
            { name: 'index.html', content: baseTemplate.html }, 
            { name: 'styles.css', content: baseTemplate.css }, 
            { name: 'script.js', content: '// default safety mode' }
        ]
    };
}
