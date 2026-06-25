import { queryGroq } from '../services/groqService.js';

export async function askForClarification(message, intent, confidence) {
    const prompt = `المستخدم قال: "${message}"
النظام يعتقد أن نوع الطلب هو "${intent}" بثقة ${Math.round(confidence*100)}%.

قم بإنشاء سؤال قصير (جملة واحدة) توضح للمستخدم ما إذا كان يقصد أمراً أم سؤالاً، واسأله ليؤكد.
مثال: "هل تقصد أن تطلب إنشاء صفحة جديدة أم تريد شرحاً عن كيفية إنشائها؟"
أخرج النص فقط.`;
    return await queryGroq(prompt, 0.5);
}
