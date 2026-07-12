// backend/agents/serverBuilder.js
import { groq, deepseek } from './baseAgent.js';
import { compileSpecToPrompt } from './spec/AgentSpec.js';
import { serverCraftSpec } from './spec/servercraft.spec.js';

/**
 * يبني خادم Node.js/Express/MongoDB كاملاً بناءً على تعليمات المستخدم
 * @param {string} instruction - وصف المستخدم للمشروع
 * @param {string} projectId - معرف المشروع (اختياري)
 * @returns {Promise<{success: boolean, files: Array, agent: string}>}
 */
export async function buildServer(instruction, projectId = 'default') {
    const ai = deepseek || groq;
    
    if (!ai) {
        return {
            success: false,
            error: 'لا يوجد محرك AI متاح. تأكد من إعداد GROQ_API_KEY أو DEEPSEEK_API_KEY في .env',
            agent: 'ServerCraft'
        };
    }

    try {
        // تحويل العقد إلى System Prompt متسق
        const systemPrompt = compileSpecToPrompt(serverCraftSpec, {
            projectId,
            lang: 'ar'
        });

        console.log(`[ServerCraft] 🏗️ بدء بناء الخادم للمشروع: ${projectId}`);
        console.log(`[ServerCraft] 📝 التعليمات: ${instruction.substring(0, 100)}...`);

        // استخدام DeepSeek Coder لتوليد الخادم (أفضل للبرمجة)
        const model = deepseek ? 'deepseek-coder' : 'llama-3.1-8b-instant';
        
        const completion = await ai.chat.completions.create({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { 
                    role: 'user', 
                    content: `قم ببناء خادم خلفي كامل وفق التعليمات التالية:\n\n${instruction}\n\nأنشئ جميع الملفات المطلوبة دفعة واحدة. استخدم الصيغة // FILE: <filename> لتحديد بداية كل ملف.` 
                }
            ],
            temperature: 0.2,
            max_tokens: 4000,
        });

        const response = completion.choices[0].message.content;
        
        // تحليل الملفات من الاستجابة
        const files = parseFiles(response);
        
        if (files.length === 0) {
            return {
                success: false,
                error: 'لم يتمكن الوكيل من توليد أي ملفات. حاول مرة أخرى بصياغة أوضح.',
                agent: 'ServerCraft',
                rawResponse: response.substring(0, 500)
            };
        }

        console.log(`[ServerCraft] ✅ تم توليد ${files.length} ملف:`);
        files.forEach(f => console.log(`  - ${f.name}`));

        return {
            success: true,
            agent: 'ServerCraft',
            model: model,
            projectId: projectId,
            files: files,
            fileCount: files.length,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[ServerCraft] ❌ فشل بناء الخادم:', error.message);
        
        // محاولة مع المحرك الآخر إذا فشل الأول
        const fallbackAI = ai === deepseek ? groq : deepseek;
        
        if (fallbackAI) {
            try {
                console.log('[ServerCraft] 🔄 محاولة مع المحرك الاحتياطي...');
                const fallbackCompletion = await fallbackAI.chat.completions.create({
                    model: fallbackAI === groq ? 'llama-3.1-8b-instant' : 'deepseek-coder',
                    messages: [
                        { role: 'system', content: 'أنت خبير Node.js. ابنِ خادماً كاملاً. استخدم // FILE: <filename> لكل ملف.' },
                        { role: 'user', content: instruction }
                    ],
                    temperature: 0.2,
                    max_tokens: 3000,
                });
                
                const response = fallbackCompletion.choices[0].message.content;
                const files = parseFiles(response);
                
                return {
                    success: files.length > 0,
                    agent: 'ServerCraft',
                    model: fallbackAI === groq ? 'llama-3.1-8b-instant' : 'deepseek-coder',
                    fallback: true,
                    files: files,
                    fileCount: files.length
                };
            } catch (fallbackError) {
                return {
                    success: false,
                    error: `جميع محاولات البناء فشلت: ${error.message} | ${fallbackError.message}`,
                    agent: 'ServerCraft'
                };
            }
        }
        
        return {
            success: false,
            error: error.message,
            agent: 'ServerCraft'
        };
    }
}

/**
 * تحليل استجابة النموذج إلى قائمة ملفات
 * @param {string} response - استجابة النموذج
 * @returns {Array<{name: string, content: string}>}
 */
function parseFiles(response) {
    const files = [];
    
    // البحث عن أنماط // FILE: filename متبوعة بالمحتوى
    const fileRegex = /\/\/\s*FILE:\s*(\S+)\s*\n([\s\S]*?)(?=\/\/\s*FILE:|$)/g;
    let match;
    
    while ((match = fileRegex.exec(response)) !== null) {
        const fileName = match[1].trim();
        const content = match[2].trim();
        
        if (fileName && content) {
            files.push({
                name: fileName,
                content: content
            });
        }
    }
    
    // إذا لم نجد أي ملفات، حاول البحث عن أنماط أخرى
    if (files.length === 0) {
        // البحث عن ```language:filename\n content ```
        const altRegex = /```[\w]*:?(\S+)?\s*\n([\s\S]*?)```/g;
        while ((match = altRegex.exec(response)) !== null) {
            const fileName = match[1] || `file_${files.length + 1}.js`;
            const content = match[2].trim();
            
            if (content) {
                files.push({
                    name: fileName,
                    content: content
                });
            }
        }
    }
    
    // إذا لم نجد أي شيء، ننشئ ملفاً واحداً بالمحتوى الكامل
    if (files.length === 0 && response.trim()) {
        files.push({
            name: 'server.js',
            content: response.trim()
        });
    }
    
    return files;
}

/**
 * حفظ الملفات المُولّدة في مسار المشروع
 * @param {Array} files - قائمة الملفات
 * @param {string} projectPath - مسار المشروع
 */
export async function saveGeneratedFiles(files, projectPath) {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    for (const file of files) {
        const filePath = path.join(projectPath, file.name);
        const dir = path.dirname(filePath);
        
        // إنشاء المجلدات الفرعية إذا لم تكن موجودة
        await fs.mkdir(dir, { recursive: true });
        
        // كتابة الملف
        await fs.writeFile(filePath, file.content, 'utf-8');
        console.log(`[ServerCraft] 💾 تم حفظ: ${file.name}`);
    }
}

/**
 * إنشاء ملخص بناءة للخادم الذي تم بناؤه
 * @param {Object} result - نتيجة buildServer
 * @returns {string} ملخص نصي
 */
export function summarizeBuild(result) {
    if (!result.success) {
        return `❌ فشل بناء الخادم: ${result.error}`;
    }
    
    const lines = [
        `✅ **تم بناء الخادم بنجاح!**`,
        ``,
        `📊 **إحصائيات:**`,
        `- عدد الملفات: ${result.fileCount}`,
        `- النموذج المستخدم: ${result.model}`,
        `- الوقت: ${result.timestamp}`,
        ``,
        `📁 **الملفات المُنشأة:**`,
    ];
    
    result.files.forEach((f, i) => {
        lines.push(`${i + 1}. \`${f.name}\` (${f.content.length} حرف)`);
    });
    
    lines.push(``);
    lines.push(`🚀 **للتشغيل:**`);
    lines.push(`\`\`\`bash`);
    lines.push(`cd المشروع`);
    lines.push(`npm install`);
    lines.push(`node server.js`);
    lines.push(`\`\`\``);
    
    return lines.join('\n');
}
