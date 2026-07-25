import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// ═══════════════════════════════════════════════════════
// 🔌 العملاء الفعليون
// ═══════════════════════════════════════════════════════
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

export const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    // مفتاح بديل وهمي يمنع انهيار الإقلاع إذا لم يُضبط — الاستدعاء سيفشل بوضوح بدلاً من ذلك
    apiKey: process.env.DEEPSEEK_API_KEY || 'ds-key-not-configured',
});
const hasDeepseek = !!process.env.DEEPSEEK_API_KEY;

// موديل DeepSeek — الافتراضي deepseek-chat: موديل deepseek-coder القديم
// أُلغي نهائياً (دُمج في V2.5) وأي استدعاء به يفشل بـ Model Not Exist
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

if (groqClient) console.log('⚡ [AI Core]: Groq نشط كخيار أول فائق السرعة.');
if (hasDeepseek) console.log('🐋 [AI Core]: DeepSeek نشط كخط ثانٍ تلقائي (failover).');
if (openaiClient) console.log('🧠 [AI Core]: OpenAI نشط كخط ثالث أخير.');
if (ai) console.log('♊ [AI Core]: محرك Gemini نشط كخطة بديلة لحالات الضغط.');

// ═══════════════════════════════════════════════════════
// 🔄 Failover تلقائي: Groq → DeepSeek → Gemini → OpenAI
//
// نُصدّر كائن groq بنفس واجهة SDK الأصلية (chat.completions.create)
// لكنه يحوّل تلقائياً للمزود التالي عند rate limit أو أعطال الخادم —
// وبذلك يستفيد كل وكيل يستورد groq بدون تعديل أي موقع استدعاء.
// ═══════════════════════════════════════════════════════
// ── تصنيف أعطال المزوّدين — عطل دائم (رصيد/مفاتيح) لا يُجدى معه التكرار ──
export const AI_UNAVAILABLE_MSG = 'خدمة الذكاء الاصطناعي غير متاحة حالياً (رصيد المزوّد منتهٍ أو مفاتيح غير صالحة) — طلبك سليم ولا فائدة من إعادة المحاولة الآن.';

export function classifyAIError(e) {
    if (e?.aiUnavailable) return 'quota';
    const status = e?.status || e?.response?.status || 0;
    const msg = String(e?.message || '').toLowerCase();
    if (/insufficient_quota|exceeded your current quota|billing|payment required/.test(msg) || status === 402) return 'quota';
    if (/invalid api key|incorrect api key|api key not valid|no auth credentials/.test(msg) || status === 401 || status === 403) return 'auth';
    if (status === 429) return 'ratelimit';
    if (/غير مُفعّل|لا يوجد مزود|not configured/.test(msg)) return 'config';
    return 'transient';
}

/** عطل لا يزول بإعادة المحاولة: رصيد منتهٍ، مفتاح غير صالح، أو مزوّد غير مُهيأ. */
export const isPermanentAIError = (e) => ['quota', 'auth', 'config'].includes(classifyAIError(e));

async function createWithFailover(params, opts) {
    let lastError = null;
    const failures = [];

    // 1️⃣ Groq — الأسرع. أي فشل (rate limit/مفتاح/شبكة) → المزود التالي فوراً
    if (groqClient) {
        try {
            return await groqClient.chat.completions.create(params, opts);
        } catch (e) {
            lastError = e; failures.push(e);
            console.warn(`[AI Failover] Groq فشل (${e.status || ''} ${String(e.message).slice(0, 80)}) → DeepSeek`);
        }
    }

    // 2️⃣ DeepSeek — الاشتراك المدفوع، نفس واجهة OpenAI ويدعم البث و JSON mode
    if (hasDeepseek) {
        try {
            return await deepseek.chat.completions.create({ ...params, model: DEEPSEEK_MODEL }, opts);
        } catch (e) {
            lastError = e; failures.push(e);
            console.warn(`[AI Failover] DeepSeek فشل (${e.status || ''} ${String(e.message).slice(0, 80)}) → ${openaiClient ? 'OpenAI' : 'لا بديل متبقٍ'}`);
        }
    }

    // 3️⃣ Gemini — واجهة مختلفة تُغلَّف بشكل OpenAI؛ لا يدعم بثّنا فيُتخطّى للبث
    if (ai && !params.stream) {
        try {
            const wantJson = params.response_format?.type === 'json_object';
            const text = (params.messages || [])
                .map(m => (m.role === 'system' ? `تعليمات النظام:\n${m.content}` : m.content))
                .join('\n\n');
            const r = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{ role: 'user', parts: [{ text }] }],
                ...(wantJson ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
            });
            const out = r.response?.text?.() || r.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (!out) throw new Error('Gemini أعاد رداً فارغاً');
            return { choices: [{ message: { content: out } }] };
        } catch (e) {
            lastError = e; failures.push(e);
            console.warn(`[AI Failover] Gemini فشل (${String(e.message).slice(0, 80)}) → ${openaiClient ? 'OpenAI' : 'لا بديل متبقٍ'}`);
        }
    }

    // 4️⃣ OpenAI — الخط الأخير
    if (openaiClient) {
        try {
            return await openaiClient.chat.completions.create({ ...params, model: 'gpt-4o-mini' }, opts);
        } catch (e) {
            lastError = e; failures.push(e);
            console.warn(`[AI Failover] OpenAI فشل (${e.status || ''} ${String(e.message).slice(0, 80)}) — لا بديل متبقٍ`);
        }
    }

    // كل المزوّدين المتاحين فشلوا بأعطال دائمة → إشارة صريحة تُوقف دورات
    // إعادة المحاولة العبثية أعلى السلسلة (كانت تحرق 7 دورات على مزوّد ميت)
    if (failures.length && failures.every(isPermanentAIError)) {
        const err = new Error(AI_UNAVAILABLE_MSG);
        err.aiUnavailable = true;
        err.causes = failures.map(f => String(f.message).slice(0, 120));
        throw err;
    }

    throw lastError || new Error('لا يوجد مزود AI مُهيأ (GROQ_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY).');
}

// كائن متوافق مع واجهة Groq SDK — non-null ما دام أي مزود متاحاً
export const groq = (groqClient || hasDeepseek || ai || openaiClient)
    ? { chat: { completions: { create: createWithFailover } } }
    : null;

/**
 * 🔄 smartChat — استدعاء ذكي مبسط (يرجع نص الرد مباشرة)
 * يستخدم نفس سلسلة الـ failover أعلاه
 */
export async function smartChat(messages, options = {}) {
    const { max_tokens = 1000, temperature = 0.3, json = false } = options;
    const params = {
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens,
        temperature,
    };
    if (json) params.response_format = { type: 'json_object' };
    const res = await createWithFailover(params);
    return res.choices[0].message.content;
}
