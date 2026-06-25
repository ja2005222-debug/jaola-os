import { queryGroqJSON } from './groqService.js';

export async function detectIntent(message) {
    const prompt = `You are an intent classification engine for JAOLA OS (supports Arabic and English). Classify the user message into one of these types:
- "chat": greetings, thanks, casual talk, social phrases
- "question": asking for information, explanation, how-to, what is, difference between
- "command": create, edit, delete, deploy, build, run, generate, modify, add, change, make, update
- "bug": error, broken, not working, crash, fix
- "deploy": deploy, publish, go live, vercel, production
- "business": revenue, profit, strategy, business plan, monetize

Also output a confidence score between 0 and 1.

Output JSON: { "type": "string", "confidence": 0.0-1.0, "reasoning": "short" }

User message: "${message}"`;

    try {
        const result = await queryGroqJSON(prompt, 0.1);
        const validTypes = ['chat', 'question', 'command', 'bug', 'deploy', 'business'];
        if (!validTypes.includes(result.type)) result.type = 'command';
        return result;
    } catch (err) {
        console.warn('Intent classification failed, defaulting to command', err);
        return { type: 'command', confidence: 0.5, reasoning: 'fallback' };
    }
}
