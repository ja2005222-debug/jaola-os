import { queryGroq } from '../services/groqService.js';

export async function resolveContext(message, projectCard, history) {
    // إذا لم يكن هناك مشروع محدد، نرجع null
    if (!projectCard || !projectCard.project_name) return null;
    
    const prompt = `أنت محلل سياقات لمشروع برمجي.
المشروع الحالي: ${projectCard.project_name}
الميزات المضافة حالياً: ${projectCard.features.join(', ') || 'لا توجد ميزات محددة بعد'}
دعم الفروع: ${projectCard.branches_enabled ? 'مفعل' : 'غير مفعل'}

المستخدم يسأل: "${message}"

بناءً على سياق المشروع، هل السؤال يتعلق بـ:
1. إضافة ميزة جديدة للمشروع (مثل دعم فروع متعددة، تطبيق جوال، لوحة تحكم)؟
2. استفسار عن ميزة موجودة بالفعل؟
3. سؤال عام غير مرتبط بالمشروع؟

إذا كان السؤال يتعلق بالمشروع، قم بإعادة صياغته بشكل واضح يتضمن سياق المشروع.
أخرج JSON بهذا التنسيق:
{
  "interpretation": "الصيغة المعاد صياغتها للسؤال مع السياق",
  "confidence": 0.0-1.0,
  "relatedToProject": true/false,
  "suggestedIntent": "command" أو "question" أو "business"
}

إذا كان السؤال غير مرتبط بالمشروع أو الثقة منخفضة، اجعل relatedToProject: false.`;

    try {
        const result = await queryGroq(prompt, 0.3);
        const parsed = JSON.parse(result);
        return parsed;
    } catch (error) {
        console.error('Context resolver failed', error);
        return null;
    }
}
