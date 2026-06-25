import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from 'axios';
import { logActivity } from '../utils.js'; // استيراد دالة التسجيل
async function tryGemini(task) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(task);
  return result.response.text();
}

async function tryGroq(task) {
  const response = await axios.post('[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)', {
    model: "llama3-8b-8192",
    messages: [{ role: "user", content: task }]
  }, { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` } });
  return response.data.choices[0].message.content;
}

export async function debuggerAgent(errorDetails, fileContent) {
  const prompt = `أصلح الكود التالي بناءً على الخطأ: ${errorDetails}. الكود: ${fileContent}`;
  const strategies = [tryGemini, tryGroq];

  for (const strategy of strategies) {
    try {
      const code = await strategy(prompt);
      const cleanCode = code.replace(/```/g, "").replace(/html|javascript/g, "").trim();
      
      // تسجيل النشاط
      await logActivity(`تم إصلاح خطأ في ملف index.html`, 'DebuggerAgent');
      return cleanCode;
    } catch (error) {
      console.warn("⚠️ فشل المصدر، سأحاول التالي...");
    }
  }
  return fileContent;
}
