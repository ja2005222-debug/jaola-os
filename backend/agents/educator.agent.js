import { callAI } from '../utils/aiProvider.js';

/**
 * وكيل التخطيط (Planner Agent)
 * يستلم المهمة ويحولها إلى خطة تقنية تنفيذية
 */
export async function run(context) {
    console.log(`[Planner] Processing mission: ${context.mission}`);
    
    // استدعاء النموذج اللغوي لتحليل المهمة
    const prompt = `Convert the following mission into a 3-step technical execution plan: ${context.mission}`;
    const plan = await callAI(prompt);
    
    console.log(`[Planner] Plan generated successfully.`);
    return { plan, status: 'success' };
}
