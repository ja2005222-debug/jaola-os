/**
 * 🧭 Unified Router — الموجّه الموحّد لرسائل الشات
 *
 * يستبدل شبكة regex/بوابات متراكمة (كانت تُصلَّح علّة-علّة بعد كل سجل
 * مستخدم) بنداء LLM منظّم واحد يفهم السياق ويُخرج قراراً مصنّفاً.
 *
 * مبادئ التصميم:
 * - المسارات الحتمية الحسّاسة (تأكيد الحذف، قفل البناء، "اكمل"، تبديل
 *   اللغة، الـ clarifier) تعمل *قبل* هذا الموجّه ولا تعتمد عليه أبداً.
 * - حواجز صلبة فوق مخرجاته: سؤال لا يُنفَّذ تعديلاً مهما قال؛ ثقة منخفضة
 *   → محادثة آمنة؛ فشل/JSON فاسد → null فيسقط المستدعي للمسار القديم.
 * - أمثلة الـ few-shot مأخوذة من سجلات أخطاء حقيقية — كل درس مدفوع الثمن
 *   محفور هنا.
 */

import { smartChat } from './baseAgent.js';
import { isQuestionMessage } from './textNormalizer.js';

// الأفعال المسموحة من الموجّه — أي شيء خارجها يُرفض (fallback للمسار القديم)
const ACTIONS = new Set(['chat', 'edit', 'build', 'delete_project', 'stop']);

const SYSTEM = `أنت موجّه رسائل لمنصة بناء مواقع بالذكاء. صنّف رسالة المستخدم إلى فعل واحد. أعد JSON فقط:
{ "action": "chat|edit|build|delete_project|stop", "instruction": "التعليمة الكاملة للتنفيذ (لـ edit/build فقط، بلغة المستخدم، مكتفية بذاتها)", "confidence": 0-100 }

الأفعال:
- chat: سؤال، استفسار، رأي، تصحيح معلومة، حديث عام — أي شيء لا يطلب تغييراً ملموساً.
- edit: طلب تغيير/إضافة/حذف محتوى في الموقع القائم. إن كانت الرسالة إحالة مبهمة ("نفذهما"، "طبق ما قلته") فاكتب في instruction التغيير الفعلي مستخرجاً من "آخر رد للمساعد" في السياق.
- build: طلب بناء موقع جديد من الصفر بأمر صريح (ابني/اصنع/build...) — ليس مجرد ذكر فكرة.
- delete_project: طلب حذف/مسح المشروع أو الموقع كله (ليس عنصراً داخله).
- stop: أمر إيقاف/إلغاء العملية الجارية.

قواعد حاسمة (من أخطاء حقيقية سابقة):
- الأسئلة chat دائماً حتى لو ذكرت تعديلات: "ماذا يمكن أن نضيف؟" = chat وليست edit.
- الجملة الإخبارية/التصحيح chat: "ولكن قائمة الأصدقاء موجودة" = chat.
- وصف العمل الجاري ليس بناء: "نحن نعمل على موقع تاكسي" = chat.
- "امسح/احذف المشروع" = delete_project وليست edit. لكن "امسح القسم الأخير" = edit.
- أوامر التنفيذ المحالة تُفكّك: "تمام نفذهما" بعد نقاش عن صفحتين = edit مع instruction ينشئ الصفحتين.
- عند الشك الحقيقي: chat مع confidence منخفضة — التعديل الخاطئ أسوأ من محادثة زائدة.

أمثلة (لسياق: مشروع قائم فيه ملفات):
"غير الالوان الى ازرق" → {"action":"edit","instruction":"غيّر ألوان الموقع إلى درجات الأزرق","confidence":95}
"نسق حجم الموبايل" → {"action":"edit","instruction":"اجعل التصميم متجاوباً ومنسقاً على شاشات الجوال","confidence":90}
"قم بانشاء الصفحتين" (بعد نقاش صفحة سائق وصفحة عميل) → {"action":"edit","instruction":"أنشئ صفحة driver.html للسائق وصفحة client.html للعميل مع تسجيل دخول مشترك","confidence":90}
"ماذا ينقص المشروع؟" → {"action":"chat","instruction":"","confidence":95}
"ولكن قائمة الاصدقاء موجودة" → {"action":"chat","instruction":"","confidence":90}
"امسح المشروع" → {"action":"delete_project","instruction":"","confidence":95}
"ابني موقع مطعم فاخر" → {"action":"build","instruction":"موقع مطعم فاخر","confidence":95}
"توقف" → {"action":"stop","instruction":"","confidence":95}`;

/**
 * يوجّه رسالة مستخدم إلى فعل منظّم.
 * @param {string} message رسالة المستخدم
 * @param {object} ctx { projectName, hasProject, lastAssistant, lang }
 * @param {function} llm قابل للحقن للاختبار (افتراضياً smartChat)
 * @returns {Promise<{action, instruction, confidence, reason?} | null>}
 *          null = فشل الموجّه → على المستدعي استخدام المسار الاحتياطي.
 */
export async function routeMessage(message, ctx = {}, llm = smartChat) {
    const context = [
        `اسم المشروع الحالي: ${ctx.projectName || 'sandbox_app'}`,
        `المشروع فيه ملفات مبنية: ${ctx.hasProject ? 'نعم' : 'لا'}`,
        ctx.lastAssistant ? `آخر رد للمساعد (للإحالات المبهمة مثل "نفذهما"):\n${String(ctx.lastAssistant).slice(0, 400)}` : '',
    ].filter(Boolean).join('\n');

    let route;
    try {
        const raw = await llm([
            { role: 'system', content: SYSTEM },
            { role: 'user', content: `السياق:\n${context}\n\nرسالة المستخدم: "${message}"` },
        ], { max_tokens: 250, temperature: 0, json: true });
        route = JSON.parse(raw);
    } catch (e) {
        return null; // فشل النداء/JSON فاسد → المسار الاحتياطي
    }

    if (!route || !ACTIONS.has(route.action)) return null;
    route.confidence = Math.max(0, Math.min(100, Number(route.confidence) || 0));
    route.instruction = typeof route.instruction === 'string' ? route.instruction.trim() : '';

    // 🛡️ حاجز 1: السؤال لا يُنفَّذ تعديلاً/بناءً/حذفاً أبداً مهما قال الموجّه
    if (route.action !== 'chat' && route.action !== 'stop' && isQuestionMessage(message)) {
        return { action: 'chat', instruction: '', confidence: route.confidence, reason: 'سؤال — تجاوز قرار الموجّه' };
    }
    // 🛡️ حاجز 2: ثقة منخفضة → محادثة آمنة (التعديل الخاطئ أسوأ من محادثة زائدة)
    if (route.confidence < 60 && route.action !== 'chat') {
        return { action: 'chat', instruction: '', confidence: route.confidence, reason: 'ثقة منخفضة → محادثة آمنة' };
    }
    // 🛡️ حاجز 3: تعديل بلا مشروع قائم = طلب بناء في الحقيقة
    if (route.action === 'edit' && !ctx.hasProject) {
        return { action: 'build', instruction: route.instruction || message, confidence: route.confidence, reason: 'تعديل بلا مشروع → بناء' };
    }

    return route;
}
