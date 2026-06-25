import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
// ... (الاستيرادات الأخرى كما هي)

export const coderAgent = async (taskDescription) => {
  const templatesDir = path.join('workspace', 'templates');
  
  // 1. فحص هل هناك قالب جاهز؟
  try {
    const files = await fs.readdir(templatesDir);
    // منطق بسيط: هل المهمة تشبه اسم ملف موجود؟
    const match = files.find(f => taskDescription.toLowerCase().includes(f.replace('.html', '')));
    
    if (match) {
      const templateContent = await fs.readFile(path.join(templatesDir, match), 'utf-8');
      await axios.post('http://localhost:3000/api/coder/write-file', { fileName: 'index.html', content: templateContent });
      await logActivity(`تم استدعاء قالب جاهز: ${match}`, 'CoderAgent');
      return "تم تحميل القالب من المكتبة!";
    }
  } catch (e) { console.log("لا توجد مكتبة قوالب بعد."); }

  // 2. إذا لم يوجد قالب، كمل بالـ AI كما فعلنا سابقاً...
  // (ضع كود الاستدعاء للـ AI هنا)
};
