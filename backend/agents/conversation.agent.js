import { queryGroq } from '../services/groqService.js';
import { JAOLA_IDENTITY } from '../services/systemPrompt.js';
import { getConversationHistory, getSessionContext } from '../services/conversationMemory.js';

export async function handleConversation(message, sessionId) {
    const history = await getConversationHistory(sessionId, 8);
    const historyText = history.map(h => `${h.role === 'user' ? 'مستخدم' : 'JAOLA'}: ${h.content}`).join('\n');
    const context = await getSessionContext(sessionId);
    let contextText = '';
    if (context.projectName) {
        contextText = `\nالمشروع الحالي: ${context.projectName} (الميزات المضافة: ${context.features?.join(', ') || 'لا توجد'}).`;
    }
    const systemInstruction = `أنت JAOLA OS، مساعد ذكي لتطوير البرمجيات. أجب بشكل طبيعي ومختصر، ولا تكرر التحية إذا كان هناك تاريخ محادثة. استخدم السياق للإجابة على الأسئلة المتعلقة بالمشروع الحالي.`;
    const userPrompt = `${systemInstruction}
${JAOLA_IDENTITY}
${contextText}

تاريخ المحادثة:
${historyText || '(بداية)'}

المستخدم: ${message}
JAOLA:`;
    const reply = await queryGroq(userPrompt, 0.7);
    return reply;
}
