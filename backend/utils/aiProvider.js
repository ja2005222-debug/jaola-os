import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

/**
 * المحرك الأساسي للاتصال بـ Groq API
 */
export async function callAI(prompt) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("API Key غير موجود في ملف .env");
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        } else {
            throw new Error(data.error?.message || "فشل الاتصال بـ Groq API");
        }
    } catch (error) {
        console.error("AI Provider Error:", error.message);
        throw error;
    }
}
