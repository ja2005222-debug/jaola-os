import { callAI } from '../utils/aiProvider.js';
import { saveProject } from '../services/db.js';

/**
 * وكيل التخطيط (Planner Agent)
 * يستلم المهمة، يحللها، ويحفظها في قاعدة البيانات فوراً
 */
export async function run(context) {
    console.log(`[Planner] Processing mission for user ${context.userId || 'system'}: ${context.mission}`);
    
    // استدعاء النموذج اللغوي لتحليل المهمة
    const prompt = `Convert the following mission into a 3-step technical execution plan: ${context.mission}`;
    const plan = await callAI(prompt);
    
    // إعداد بيانات المشروع للتوثيق
    const projectId = context.projectId || Date.now().toString();
    const projectData = {
        id: projectId,
        userId: context.userId || 'system',
        mission: context.mission,
        plan: plan,
        status: 'planned'
    };

    // حفظ المشروع في قاعدة البيانات لضمان عدم ضياع العمل
    try {
        await saveProject(projectData);
        console.log(`[Planner] Project ${projectId} saved to DB.`);
    } catch (error) {
        console.error('[Planner] Database Error:', error);
    }
    
    // تحديث السياق الموحد
    context.plan = plan;
    context.status = 'planned';
    context.projectId = projectId;
    context.updatedAt = new Date().toISOString();
    
    return { 
        plan, 
        status: 'success',
        projectId: projectId 
    };
}
