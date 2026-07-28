import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// dotenv أولاً — كان يُستدعى بعد إنشاء العميل فلا يقرأ المفتاح من .env أبداً
dotenv.config();

// تهيئة كسولة: إنشاء العميل عند الحاجة فقط — يمنع انهيار الخادم كاملاً
// عند الإقلاع إذا كان DEEPSEEK_API_KEY غير مضبوط
let _deepseek = null;
export const deepseek = {
    chat: {
        completions: {
            create(...args) {
                if (!_deepseek) {
                    if (!process.env.DEEPSEEK_API_KEY) {
                        return Promise.reject(new Error('DEEPSEEK_API_KEY غير مضبوط — لا يمكن استخدام DeepSeek.'));
                    }
                    _deepseek = new OpenAI({
                        baseURL: 'https://api.deepseek.com/v1',
                        apiKey: process.env.DEEPSEEK_API_KEY,
                    });
                }
                return _deepseek.chat.completions.create(...args);
            }
        }
    }
};

export const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
export const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

if (groq) console.log('⚡ [AI Core - baseAgent]: محرك Groq نشط كخيار أول فائق السرعة.');
if (ai) console.log('♊ [AI Core - baseAgent]: محرك Gemini نشط كخطة بديلة لحالات الضغط.');

/**
 * 🔄 smartChat — استدعاء ذكي مع Fallback تلقائي
 * يحاول Groq أولاً، ثم DeepSeek إذا فشل (rate limit أو خطأ)
 */
export async function smartChat(messages, options = {}) {
    const { max_tokens = 1000, temperature = 0.3, json = false } = options;

    // المحاولة الأولى: Groq
    if (groq) {
        try {
            const params = {
                model: 'llama-3.3-70b-versatile',
                messages,
                max_tokens,
                temperature,
            };
            if (json) params.response_format = { type: 'json_object' };
            const res = await groq.chat.completions.create(params);
            return res.choices[0].message.content;
        } catch (e) {
            if (!e.message?.includes('429') && !e.message?.includes('rate_limit')) throw e;
            console.warn('[smartChat] Groq rate limit — switching to DeepSeek');
        }
    }

    // Fallback: DeepSeek
    const res = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages,
        max_tokens,
        temperature,
    });
    return res.choices[0].message.content;
}
