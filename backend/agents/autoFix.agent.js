// autoFix.agent.js محدث
import { queryGroq } from '../services/groqService.js';
import * as fileEditor from '../services/fileEditor.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
// أضف هذه الدالة الجديدة
export async function analyzeAndFixMultipleErrors(errorMessage) {
  const prompt = `
لديك قائمة بأخطاء البناء التالية:
${errorMessage.substring(0, 2000)}

أخرج مصفوفة من الإصلاحات المقترحة (حتى 3 إصلاحات) بصيغة JSON:
[
  {"fileToEdit": "app/deals/page.tsx", "newContent": "...", "explanation": "..."},
  {"fileToEdit": "app/globals.css", "newContent": "...", "explanation": "..."}
]
إذا كان هناك خطأ واحد فقط، أخرج مصفوفة تحتوي على إصلاح واحد.
إذا تعذر الإصلاح، أخرج {"cannotFix": true}
`;
  const response = await queryGroq(prompt, 0.2);
  return extractJSONArray(response); // تحتاج دالة لاستخراج مصفوفة JSON
}

const execPromise = promisify(exec);
const JAOLA_PATH = process.env.JAOLA_PATH;

// دالة لتنفيذ البناء وجمع الأخطاء
export async function runBuildAndCaptureError() {
  try {
    const { stdout, stderr } = await execPromise(`cd ${JAOLA_PATH} && npm run build 2>&1`);
    return { success: true, output: stdout };
  } catch (err) {
    return { success: false, error: err.message, details: err.stderr || err.stdout };
  }
}

// دالة لاستخراج JSON من النص، حتى لو كان مع markdown أو نص إضافي
function extractJSON(text) {
  // إزالة markdown code blocks
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  // البحث عن أول { وآخر }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  let jsonStr = cleaned.substring(start, end + 1);
  // محاولة إصلاح الأخطاء الشائعة: استبدال ' ب " فقط للخصائص
  jsonStr = jsonStr.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');
  // إزالة فواصل إضافية
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  // محاولة إزالة التعليقات
  jsonStr = jsonStr.replace(/\/\/.*?\n/g, '').replace(/\/\*.*?\*\//g, '');
  // إذا كان النص يحتوي على عدة أسطر، حاول التحليل
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // قد يكون هناك نص بعد JSON؟ نأخذ أول جزء صالح
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw e;
  }
}

// دالة لتحليل الخطأ وإرجاع خطة إصلاح
export async function analyzeAndFixBuildError(errorMessage) {
  const prompt = `
أنت خبير في Next.js و TypeScript. المهمة: تحليل خطأ البناء التالي واقتراح إصلاح محدد.

خطأ البناء:
${errorMessage.substring(0, 1500)}

الأخطاء الشائعة وحلولها:
- "Export getFlightDeals doesn't exist" → استبدل بـ searchFlights في الاستيراد.
- "Unknown word المحتوى" في globals.css → استبدل المحتوى بـ CSS صحيح.
- "next.config.js not found" → أنشئ ملف next.config.js بالمحتوى: 
  /** @type {import('next').NextConfig} */
  const nextConfig = {};
  module.exports = nextConfig;
- "Missing script build" في package.json → أضف سكريبت build: "next build" مع الاحتفاظ ببقية package.json كما هو. أخرج المحتوى الكامل لـ package.json بعد التعديل.

أخرج JSON بالصيغة:
{"fileToEdit": "app/deals/page.tsx", "newContent": "المحتوى الكامل للملف بعد التعديل", "explanation": "شرح التعديل"}
إذا لم يمكن الإصلاح، أخرج {"cannotFix": true}

تنبيه مهم: newContent يجب أن يكون المحتوى الكامل للملف المعدل، وليس جزءًا منه. إذا كان الملف هو package.json، فاكتب الكائن الكامل لـ package.json مع التعديلات.
`;

  const response = await queryGroq(prompt, 0.2);
  console.log("Groq raw response for autoFix:", response);
  const fixPlan = extractJSON(response);
  if (fixPlan.cannotFix) throw new Error("لا يمكن إصلاح هذا الخطأ تلقائياً");
  
  // تصحيح المسار: قد يبدأ بـ "jaola-travel/" أو مسار مطلق
  let filePath = fixPlan.fileToEdit;
  if (filePath.startsWith(JAOLA_PATH)) {
    filePath = path.relative(JAOLA_PATH, filePath);
  } else if (filePath.startsWith('jaola-travel/')) {
    filePath = filePath.replace('jaola-travel/', '');
  }
  fixPlan.fileToEdit = filePath;
  return fixPlan;
}

// تنفيذ الإصلاح
export async function autoFixBuild() {
  console.log("🔧 AutoFix: Running build to capture errors...");
  const buildResult = await runBuildAndCaptureError();
  if (buildResult.success) {
    return { fixed: false, message: "البناء ناجح أصلاً، لا حاجة للإصلاح" };
  }

  console.log("🔧 AutoFix: Build failed, analyzing error...");
  const errorMsg = buildResult.error + "\n" + (buildResult.details || "");
  let fix;
  try {
    fix = await analyzeAndFixBuildError(errorMsg);
  } catch (err) {
    console.error("AutoFix analysis error:", err);
    return { fixed: false, message: `فشل تحليل الخطأ: ${err.message}` };
  }
  
// تطبيق الإصلاح
console.log(`🔧 AutoFix: Applying fix to ${filePath}`);
try {
  // استخدام editFile مباشرة (يتعامل مع المسار ووجود الملف)
  await fileEditor.editFile(filePath, fix.newContent);
  console.log(`✅ Applied fix: ${fix.explanation}`);
} catch (err) {
  console.error(`❌ Failed to apply fix: ${err.message}`);
  // إذا فشل editFile (مثلاً لأن الملف غير موجود)، نحاول createFile
  try {
    await fileEditor.createFile(filePath, fix.newContent);
    console.log(`✅ Created file instead: ${filePath}`);
  } catch (err2) {
    console.error(`❌ Also failed to create file: ${err2.message}`);
    if (attempt === maxAttempts) break;
    continue;
  }
}

  
  // إعادة محاولة البناء
  const retry = await runBuildAndCaptureError();
  return {
    fixed: retry.success,
    appliedFix: fix,
    retryResult: retry
  };
}
