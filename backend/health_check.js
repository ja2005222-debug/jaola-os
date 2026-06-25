import fs from 'fs';
import path from 'path';

// الهيكلية المحدثة: التأكد من المسارات الصحيحة من الجذر
const filesToCheck = [
    { name: 'server.js' },
    { name: 'services/db.js' },
    { name: 'services/orchestrator.js' },
    // تم تعديل المسار هنا ليكون '../utils/aiProvider.js' ليعكس أن الوكيل في مجلد والملف في الجذر
    { name: 'agents/planner.agent.js', export: 'run', importFile: '../utils/aiProvider.js' },
    { name: 'agents/coder.agent.js', export: 'run' },
    { name: 'utils/aiProvider.js', export: 'callAI' }
];

console.log("--- فحص سلامة الملفات (مُصحح المسارات النسبي) ---");

filesToCheck.forEach(file => {
    const filePath = path.join(process.cwd(), file.name);
    
    if (!fs.existsSync(filePath)) {
        console.log(`[خطأ] الملف مفقود: ${file.name}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // فحص مسارات الاستيراد النسبية
    if (file.importFile) {
        const importPath = path.resolve(path.dirname(filePath), file.importFile);
        if (!fs.existsSync(importPath)) {
            console.log(`[خطأ حرج] الملف الذي يحاول ${file.name} استيراده غير موجود في: ${importPath}`);
        } else {
            console.log(`[تأكيد] مسار الاستيراد سليم لـ ${file.name}`);
        }
    }

    if (content.length === 0) {
        console.log(`[تحذير] الملف فارغ: ${file.name}`);
    } else {
        console.log(`[سليم] الملف موجود: ${file.name}`);
        
        if (file.export) {
            const exportPattern = new RegExp(`export (async )?function ${file.export}|export const ${file.export}`);
            if (!exportPattern.test(content)) {
                console.log(`[خطأ في التصدير] ${file.name} لا يقوم بتصدير: ${file.export}`);
            } else {
                console.log(`[تصدير سليم] ${file.name} يصدر ${file.export}`);
            }
        }
    }
});
