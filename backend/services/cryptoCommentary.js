/**
 * 🤖 cryptoCommentary.js — وكيل ضيّق مهمّته الوحيدة: كتابة 2-3 جمل عربية
 * قصيرة تفسّر أرقام تحليل فني حقيقي (SMA/RSI/إشارة) بلغة مبسّطة، بلا أي
 * أمر تنفيذي مباشر ("اشترِ الآن") — وصف الزخم/الاتجاه فقط، لا توصية
 * ملزمة. يستخدم نفس سلسلة الـfailover الموجودة في baseAgent.js (لا مزوّد
 * جديد)، ويصمت (يعيد null) عند أي عطل — الميزة إضافية لا تُعطّل التحليل
 * الرقمي الأساسي إن غاب الذكاء الاصطناعي.
 */
import { smartChat } from '../agents/baseAgent.js';

const TTL_MS = 5 * 60 * 1000; // يطابق مهلة كاش التحليل تقريباً
const cache = new Map(); // "id|signal|reasonCode" → { text, at }

const SIGNAL_AR = { buy: 'شراء', sell: 'بيع', hold: 'انتظار' };

const SYSTEM_PROMPT = 'أنت محلّل بيانات فقط. مهمتك الوحيدة: كتابة جملتين أو ثلاث جمل عربية قصيرة ' +
    'تصف زخم/اتجاه عملة رقمية بلغة مبسّطة، بناءً على الأرقام المُعطاة فقط (سعر، متوسطات متحركة، ' +
    'RSI، إشارة). ممنوع منعاً باتاً إعطاء أمر تنفيذي مباشر مثل "اشترِ الآن" أو "بع الآن" أو أي ' +
    'توصية استثمارية ملزمة — صف الوضع فقط ودع القارئ يقرر بنفسه. لا تذكر أنك ذكاء اصطناعي ولا تكتب مقدمات، أجب بالجمل مباشرة.';

/** يبني نص تعليق قصير، أو null عند تعذّر توليده (لا مزوّد/رصيد/عطل شبكة). llm قابل للحقن للاختبار. */
export async function generateCommentary({ id, symbol, price, sma7, sma25, rsi14, signal, reasonCode }, llm = smartChat) {
    if (!id || !signal) return null;
    const key = `${id}|${signal}|${reasonCode}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.text;
    try {
        const text = await llm(
            [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: JSON.stringify({ symbol: symbol || id, price, sma7, sma25, rsi14, signal: SIGNAL_AR[signal] || signal }) },
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
export function resetCommentaryCache() {
    cache.clear();
}
