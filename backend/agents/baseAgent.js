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

const openaiClient = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

if (groqClient) console.log('⚡ [AI Core]: Groq نشط كخيار أول فائق السرعة.');
if (hasDeepseek) console.log('🐋 [AI Core]: DeepSeek نشط كخط ثانٍ تلقائي (failover).');
if (openaiClient) console.log('🧠 [AI Core]: OpenAI نشط كخط ثالث أخير.');
if (ai) console.log('♊ [AI Core]: محرك Gemini نشط كخطة بديلة لحالات الضغط.');

// ═══════════════════════════════════════════════════════
// 🔄 Failover تلقائي: Groq → DeepSeek → OpenAI
//
// نُصدّر كائن groq بنفس واجهة SDK الأصلية (chat.completions.create)
// لكنه يحوّل تلقائياً للمزود التالي عند rate limit أو أعطال الخادم —
// وبذلك يستفيد كل وكيل يستورد groq بدون تعديل أي موقع استدعاء.
// ═══════════════════════════════════════════════════════
async function createWithFailover(params, opts) {
    let lastError = null;

    // 1️⃣ Groq — الأسرع. أي فشل (rate limit/مفتاح/شبكة) → المزود التالي فوراً
    if (groqClient) {
        try {
            return await groqClient.chat.completions.create(params, opts);
        } catch (e) {
            lastError = e;
            console.warn(`[AI Failover] Groq فشل (${e.status || ''} ${String(e.message).slice(0, 80)}) → DeepSeek`);
        }
    }

    // 2️⃣ DeepSeek — الاشتراك المدفوع، نفس واجهة OpenAI ويدعم البث و JSON mode
    if (hasDeepseek) {
        try {
            return await deepseek.chat.completions.create({ ...params, model: 'deepseek-chat' }, opts);
        } catch (e) {
            lastError = e;
            console.warn(`[AI Failover] DeepSeek فشل (${e.status || ''} ${String(e.message).slice(0, 80)}) → ${openaiClient ? 'OpenAI' : 'لا بديل متبقٍ'}`);
        }
    }

    // 3️⃣ OpenAI — الخط الأخير
    if (openaiClient) {
        return await openaiClient.chat.completions.create({ ...params, model: 'gpt-4o-mini' }, opts);
    }

    throw lastError || new Error('لا يوجد مزود AI مُهيأ (GROQ_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY).');
}

// كائن متوافق مع واجهة Groq SDK — non-null ما دام أي مزود متاحاً
export const groq = (groqClient || hasDeepseek || openaiClient)
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
