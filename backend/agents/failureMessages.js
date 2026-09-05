/**
 * 💬 رسائل الفشل النهائية للشات — الشات لا يصمت أبداً عند فشل البناء.
 *
 * كانت أخطاء المهمة تظهر في سجلّ الخطوات فقط بينما فقاعات الشات تبقى صامتة
 * (خصوصاً حين يكون سبب الفشل نفسه هو تعطّل مزوّد الذكاء الاصطناعي، فلا يوجد
 * نموذج ليصيغ الرد). هذه الرسائل حتمية بلغة المستخدم — لا تحتاج أي نموذج.
 */

// 🔀 مصدرٌ واحد: كانت هذه العبارة مكتوبة هنا وفي `platformLessons.js`
// بقيمتين — هذه تنقص «رصيد المزوّد». لا أثر حيّ اليوم لأن الرسالة الفعلية
// (`AI_UNAVAILABLE_MSG` في `core/providers/llm.js`) تحمل العبارتين معاً فتُطابقهما كلتيهما،
// لكنه سؤالٌ واحد بجوابين ينتظر أن يفترقا. النسخة الأوسع هي المحفوظة.
import { isAiDownMessage } from '../services/platformLessons.js';

export function buildFailureChatMessage(lang = 'ar', error = {}) {
    const aiDown = !!error.aiUnavailable || isAiDownMessage(error.message);
    if (lang === 'en') {
        return aiDown
            ? '⛔ The AI service is temporarily unavailable (the provider ran out of credit or its keys are invalid). Your request is fine and your project files are untouched — please try again later, or let the platform admin know.'
            : '❌ The build could not be completed this time, and your project files are untouched. Try a simpler phrasing of your request, or try again in a few minutes.';
    }
    return aiDown
        ? '⛔ خدمة الذكاء الاصطناعي غير متاحة مؤقتاً (نفد رصيد المزوّد أو مفاتيحه غير صالحة). طلبك سليم وملفات مشروعك لم تُمسّ — حاول لاحقاً أو أبلغ إدارة المنصة.'
        : '❌ تعذّر إكمال البناء هذه المرّة، وملفات مشروعك لم تُمسّ. جرّب صياغة أبسط لطلبك أو أعد المحاولة بعد دقائق.';
}
