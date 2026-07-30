/**
 * 🤖 cryptoCommentary.js — وكيل ضيّق مهمّته الوحيدة: كتابة 2-3 جمل قصيرة
 * (عربي أو إنجليزي، حسب لغة واجهة المستخدم) تفسّر أرقام تحليل فني حقيقي
 * (SMA/RSI/إشارة) بلغة مبسّطة، بلا أي أمر تنفيذي مباشر ("اشترِ الآن") —
 * وصف الزخم/الاتجاه فقط، لا توصية ملزمة. يستخدم نفس سلسلة الـfailover
 * الموجودة في baseAgent.js (لا مزوّد جديد)، ويصمت (يعيد null) عند أي عطل
 * — الميزة إضافية لا تُعطّل التحليل الرقمي الأساسي إن غاب الذكاء الاصطناعي.
 */
import { smartChat } from '../agents/baseAgent.js';

const TTL_MS = 5 * 60 * 1000; // يطابق مهلة كاش التحليل تقريباً
const cache = new Map(); // "id|timeframe|lang|signal|reasonCode" → { text, at }

const SIGNAL_LABEL = {
    ar: { buy: 'شراء', sell: 'بيع', hold: 'انتظار' },
    en: { buy: 'Buy', sell: 'Sell', hold: 'Hold' },
};
const TIMEFRAME_LABEL = {
    ar: { day: 'يومي (ساعات)', week: 'أسبوعي', long: 'طويل المدى' },
    en: { day: 'daily (hours)', week: 'weekly', long: 'long-term' },
};

const SYSTEM_PROMPT = {
    ar: 'أنت محلّل بيانات فقط. مهمتك الوحيدة: كتابة جملتين أو ثلاث جمل عربية قصيرة ' +
        'تصف زخم/اتجاه عملة رقمية بلغة مبسّطة، بناءً على الأرقام المُعطاة فقط (سعر، متوسطات متحركة، ' +
        'RSI، إشارة، والمدى الزمني المطلوب — يومي/أسبوعي/طويل المدى، فاذكر أن القراءة خاصة بهذا المدى). ' +
        'ممنوع منعاً باتاً إعطاء أمر تنفيذي مباشر مثل "اشترِ الآن" أو "بع الآن" أو أي ' +
        'توصية استثمارية ملزمة — صف الوضع فقط ودع القارئ يقرر بنفسه. لا تذكر أنك ذكاء اصطناعي ولا تكتب مقدمات، أجب بالجمل مباشرة.',
    en: 'You are a data analyst only. Your sole job: write two or three short English sentences ' +
        'describing the momentum/trend of a cryptocurrency in plain language, based only on the given numbers ' +
        '(price, moving averages, RSI, signal, and the requested timeframe — daily/weekly/long-term; mention that the reading is specific to that timeframe). ' +
        'It is strictly forbidden to give a direct execution order such as "buy now" or "sell now", or any ' +
        'binding investment recommendation — describe the situation only and let the reader decide for themselves. ' +
        'Do not mention that you are an AI and do not write any preamble, answer with the sentences directly.',
};

/** يبني نص تعليق قصير، أو null عند تعذّر توليده (لا مزوّد/رصيد/عطل شبكة). llm قابل للحقن للاختبار. */
export async function generateCommentary({ id, symbol, price, smaShort, smaLong, rsi, signal, reasonCode, timeframe, lang }, llm = smartChat) {
    if (!id || !signal) return null;
    const l = (lang === 'en') ? 'en' : 'ar';
    const key = `${id}|${timeframe || 'week'}|${l}|${signal}|${reasonCode}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.text;
    try {
        const text = await llm(
            [
                { role: 'system', content: SYSTEM_PROMPT[l] },
                { role: 'user', content: JSON.stringify({ symbol: symbol || id, price, smaShort, smaLong, rsi, signal: SIGNAL_LABEL[l][signal] || signal, timeframe: TIMEFRAME_LABEL[l][timeframe] || TIMEFRAME_LABEL[l].week }) },
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
