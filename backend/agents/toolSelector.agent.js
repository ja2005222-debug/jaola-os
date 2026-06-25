import { queryGroqJSON } from '../services/groqService.js';

export async function selectTools(userMessage) {
    const prompt = `
أنت وكيل اختيار الأدوات (Tool Selection Agent). بناءً على طلب المستخدم، حدد الأدوات المناسبة من القائمة:
- read_file (قراءة ملف)
- write_file (كتابة ملف)
- search_project (البحث في المشروع)
- run_command (تنفيذ أمر)
- build (بناء المشروع)
- deploy (نشر)

أخرج JSON بالصيغة:
{
  "primaryTool": "write_file",
  "secondaryTools": ["search_project"],
  "reason": "لإنشاء ملف جديد نحتاج أولاً البحث عن مسار مناسب"
}
`;
    return await queryGroqJSON(prompt, 0.2);
}
