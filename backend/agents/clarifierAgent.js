import { groq } from './baseAgent.js';

export async function clarifyProject(userPrompt) {
  const systemMessage = `أنت وكيل استفسار ذكي لمشاريع تطوير الويب. مهمتك:
1. قراءة وصف المستخدم.
2. إذا كان الوصف غامضًا أو ينقصه تفاصيل أساسية (مثل نوع المشروع، الجمهور المستهدف، الميزات الرئيسية، الهوية البصرية)، قم بإرجاع مصفوفة من الأسئلة التوضيحية القصيرة بالعربية. لا تطرح أكثر من 3 أسئلة.
3. إذا كان الوصف كافيًا للبدء، قم بإرجاع وصف محسّن (clarifiedPrompt) يشمل كل التفاصيل المذكورة.

أعد JSON دائمًا بهذا الشكل:
{
  "needsClarification": true/false,
  "clarificationQuestions": ["سؤال 1", "سؤال 2"],
  "clarifiedPrompt": "وصف كامل ومفصل"
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userPrompt }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    });
    const result = JSON.parse(completion.choices[0].message.content);
    return result;
  } catch (e) {
    return { needsClarification: false, clarifiedPrompt: userPrompt, clarificationQuestions: [] };
  }
}
