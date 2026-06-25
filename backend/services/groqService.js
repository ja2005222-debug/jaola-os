import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

export const usageStats = {
    Groq: { requests: 0, tokens: 0 },
    Gemini: { requests: 0, tokens: 0 },
    GitHub: { requests: 0, tokens: 0 },
};

function recordUsage(provider, tokens = 0) {
    if (usageStats[provider]) {
        usageStats[provider].requests++;
        usageStats[provider].tokens += tokens;
    }
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

let genAI = null;
if (process.env.GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Google Gemini client initialized');
    } catch (err) { console.warn('⚠️ Gemini init failed'); }
}

let githubClient = null;
if (process.env.GITHUB_TOKEN) {
    try {
        githubClient = new OpenAI({
            baseURL: 'https://models.inference.ai.azure.com',
            apiKey: process.env.GITHUB_TOKEN,
        });
        console.log('✅ GitHub Models client initialized');
    } catch (err) { console.warn('⚠️ GitHub Models init failed'); }
}

async function callGroq(prompt, temperature, systemPrompt, startTime) {
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });
    const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature,
        messages
    });
    const usage = response.usage?.total_tokens || 0;
    recordUsage('Groq', usage);
    const duration = Date.now() - startTime;
    console.log(`✅ Groq responded in ${duration}ms (tokens: ${usage})`);
    return response.choices[0].message.content;
}

async function callGemini(prompt, temperature, systemPrompt, startTime) {
    if (!genAI) throw new Error('Gemini not configured');
    // تحديث أسماء النماذج إلى الإصدارات المدعومة
    const modelNames = ['gemini-2.0-flash', 'gemini-2.0-pro-exp', 'gemini-1.5-flash'];
    let lastError = null;
    for (const modelName of modelNames) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            let fullPrompt = prompt;
            if (systemPrompt) fullPrompt = `${systemPrompt}\n\n${prompt}`;
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
                generationConfig: { temperature }
            });
            const response = await result.response;
            const usage = response.usageMetadata?.totalTokenCount || 0;
            recordUsage('Gemini', usage);
            const duration = Date.now() - startTime;
            console.log(`✅ Gemini (${modelName}) responded in ${duration}ms (tokens: ${usage})`);
            return response.text();
        } catch (err) {
            lastError = err;
            console.warn(`Gemini model ${modelName} failed: ${err.message}`);
        }
    }
    throw new Error(`All Gemini models failed: ${lastError.message}`);
}

async function callGitHub(prompt, temperature, systemPrompt, startTime) {
    if (!githubClient) throw new Error('GitHub Models not configured');
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });
    const response = await githubClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature
    });
    const usage = response.usage?.total_tokens || 0;
    recordUsage('GitHub', usage);
    const duration = Date.now() - startTime;
    console.log(`✅ GitHub responded in ${duration}ms (tokens: ${usage})`);
    return response.choices[0].message.content;
}

export async function queryGroq(prompt, temperature = 0.2, systemPrompt = null) {
    const startTime = Date.now();
    const providers = [
        { name: 'Groq', fn: () => callGroq(prompt, temperature, systemPrompt, startTime) },
        { name: 'Gemini', fn: () => callGemini(prompt, temperature, systemPrompt, startTime) },
        { name: 'GitHub', fn: () => callGitHub(prompt, temperature, systemPrompt, startTime) },
    ];
    for (const provider of providers) {
        try {
            const result = await provider.fn();
            if (result && typeof result === 'string' && result.trim().length > 0) {
                return result;
            } else {
                throw new Error('Provider returned invalid result');
            }
        } catch (err) {
            console.warn(`${provider.name} failed: ${err.message}`);
        }
    }
    console.error('All AI providers failed, returning fallback message');
    return "عذراً، لم أتمكن من معالجة طلبك حالياً. يرجى المحاولة لاحقاً.";
}

export function cleanAndParseJSON(rawText) {
    try {
        const firstOpenBrace = rawText.indexOf('{');
        const lastCloseBrace = rawText.lastIndexOf('}');
        if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
            const jsonCandidate = rawText.substring(firstOpenBrace, lastCloseBrace + 1);
            return JSON.parse(jsonCandidate);
        }
        const firstOpenBracket = rawText.indexOf('[');
        const lastCloseBracket = rawText.lastIndexOf(']');
        if (firstOpenBracket !== -1 && lastCloseBracket !== -1) {
            const jsonCandidate = rawText.substring(firstOpenBracket, lastCloseBracket + 1);
            return JSON.parse(jsonCandidate);
        }
        return JSON.parse(rawText);
    } catch (err) {
        throw new Error(`JSON extraction/parse failed: ${err.message}`);
    }
}

export async function queryGroqJSON(prompt, temperature = 0.1, systemPrompt = null) {
    const response = await queryGroq(prompt, temperature, systemPrompt);
    try {
        return cleanAndParseJSON(response);
    } catch (err) {
        console.error("JSON parsing failed. Falling back to empty object.");
        return { affectedModules: [], newFiles: [], dependencies: [], risks: [], suggestions: [] };
    }
}

export async function safeQueryGroq(prompt, temperature = 0.2, systemPrompt = null) {
    const result = await queryGroq(prompt, temperature, systemPrompt);
    if (typeof result === 'string' && result.trim().length > 0) return result;
    return "عذراً، لم أستطع معالجة طلبك حالياً.";
}
