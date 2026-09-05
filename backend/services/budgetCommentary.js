/**
 * 🤖 budgetCommentary.js — وكيل ضيّق مهمّته الوحيدة: كتابة 2-3 جمل قصيرة
 * (عربي أو إنجليزي) تصف نمط الإنفاق لفترة مُعطاة بلغة مبسّطة، بناءً على
 * أرقام حقيقية محسوبة من معاملات المستخدم فعلياً (لا أرقام مُلفَّقة) —
 * وصف واعٍ فقط، لا أمر تنفيذي ملزم ("أوقف الإنفاق على X فوراً"). يصمت
 * (يعيد null) عند أي عطل — الميزة إضافية لا تُعطّل الملخّص الرقمي الأساسي.
 */
import { smartChat } from '../core/providers/llm.js';

const TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // "periodLabel|lang|income|expense|topCategory" → { text, at }

const SYSTEM_PROMPT = {
    ar: 'أنت مساعد مالي شخصي فقط. مهمتك الوحيدة: كتابة جملتين أو ثلاث جمل عربية قصيرة ' +
        'تصف نمط الإنفاق والدخل للفترة المطلوبة بلغة مبسّطة، بناءً على الأرقام المُعطاة فقط ' +
        '(إجمالي الدخل، إجمالي المصروف، الصافي، وأبرز فئات الإنفاق). يمكنك الإشارة بلطف إلى ' +
        'فئة إنفاق بارزة تستحق المراجعة، لكن ممنوع منعاً باتاً إعطاء أمر تنفيذي مباشر مثل "أوقف ' +
        'الإنفاق على X فوراً" أو أي توصية مالية ملزمة — صف الوضع فقط ودع القارئ يقرر بنفسه. ' +
        'لا تذكر أنك ذكاء اصطناعي ولا تكتب مقدمات، أجب بالجمل مباشرة.',
    en: 'You are a personal finance assistant only. Your sole job: write two or three short English ' +
        'sentences describing the income/spending pattern for the requested period in plain language, ' +
        'based only on the given numbers (total income, total expense, net, and the top spending categories). ' +
        'You may gently note a spending category worth reviewing, but it is strictly forbidden to give a direct ' +
        'command such as "stop spending on X immediately" or any binding financial recommendation — describe ' +
        'the situation only and let the reader decide for themselves. Do not mention that you are an AI and ' +
        'do not write any preamble, answer with the sentences directly.',
};

/** يبني نص تعليق قصير، أو null عند تعذّر توليده. llm قابل للحقن للاختبار. */
export async function generateBudgetCommentary({ periodLabel, income, expense, net, categories, lang }, llm = smartChat) {
    if (income == null || expense == null) return null;
    const l = (lang === 'en') ? 'en' : 'ar';
    const topCats = (Array.isArray(categories) ? categories : []).slice(0, 3);
    const key = `${periodLabel}|${l}|${income}|${expense}|${topCats.map(c => c.category + ':' + c.amount).join(',')}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.text;
    try {
        const text = await llm(
            [
                { role: 'system', content: SYSTEM_PROMPT[l] },
                { role: 'user', content: JSON.stringify({ period: periodLabel, income, expense, net, topCategories: topCats }) },
            ],
            { max_tokens: 220, temperature: 0.5 }
        );
        const clean = (text || '').toString().trim().slice(0, 600) || null;
        if (clean) cache.set(key, { text: clean, at: Date.now() });
        return clean;
    } catch {
        return cached ? cached.text : null;
    }
}

/** لإعادة ضبط الكاش بين الاختبارات فقط. */
export function resetBudgetCommentaryCache() {
    cache.clear();
}
