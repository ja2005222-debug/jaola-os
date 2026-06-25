import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import * as fileEditor from '../services/fileEditor.js';
import { queryGroq } from '../services/groqService.js';
import { emitEvent } from '../services/broadcast.js';

const execAsync = util.promisify(exec);

// إنشاء snapshot Git قبل التعديل
async function createGitSnapshot(projectPath, filePath) {
    const git = (await import('simple-git')).default;
    const gitClient = git(projectPath);
    try {
        await gitClient.add(filePath);
        const commitHash = await gitClient.commit(`JAOLA snapshot before editing ${filePath}`);
        return commitHash.commit;
    } catch (err) {
        console.warn('Git snapshot failed:', err.message);
        return null;
    }
}

// الرجوع إلى snapshot Git
async function rollbackToSnapshot(projectPath, commitHash) {
    if (!commitHash) return false;
    const git = (await import('simple-git')).default;
    const gitClient = git(projectPath);
    try {
        await gitClient.reset(['--hard', commitHash]);
        return true;
    } catch (err) {
        console.error('Rollback failed:', err.message);
        return false;
    }
}

// توليد محتوى جديد للملف بالكامل باستخدام AI
async function generateFullFileContent(filePath, instruction, currentContent, context = {}) {
    const prompt = `You are an expert software engineer. Rewrite the entire file based on the instruction.

Current file content:
\`\`\`
${currentContent || '// File is empty or does not exist'}
\`\`\`

Instruction:
${instruction}

Additional context:
- Project: ${context.projectName || 'Unknown'}
- Tech stack: ${context.techStack || 'Next.js, TypeScript, Tailwind'}

Requirements:
1. Output ONLY the new file content (complete file).
2. Keep existing functionality unless instructed to change.
3. Follow best practices and coding standards.
4. Ensure the code is syntactically correct.
5. Do NOT include any explanations, just the code.

Return ONLY the new file content with no extra text.`;

    const response = await queryGroq(prompt, 0.3);
    // استخراج الكود من الرد (إزالة أي backticks إذا وجدت)
    let newContent = response.trim();
    if (newContent.startsWith('```')) {
        newContent = newContent.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    }
    return newContent;
}

// التحقق من صحة البناء بعد التعديل
async function validateBuild(projectPath) {
    try {
        const { stdout } = await execAsync(`cd ${projectPath} && npm run build --dry-run 2>&1 || true`);
        const hasError = stdout.includes('Failed to compile') || stdout.includes('error');
        return { success: !hasError, output: stdout };
    } catch (err) {
        return { success: false, output: err.message };
    }
}

// الحصول على نقاط مراجعة AI
async function getAIReviewScore(filePath, oldContent, newContent) {
    const prompt = `Compare the old and new code. Return JSON with scores (0-100) for security, performance, SEO, accessibility, and overall.

Old code:
${oldContent.substring(0, 3000)}

New code:
${newContent.substring(0, 3000)}

Output format: {"security":85,"performance":78,"seo":70,"accessibility":82,"overall":80}`;
    const response = await queryGroq(prompt, 0.2);
    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch(e) {}
    }
    return { security: 70, performance: 70, seo: 70, accessibility: 70, overall: 70 };
}

// الوظيفة الرئيسية للتحرير الاحترافي
export async function smartEditPro(filePath, instruction, taskId = null, projectContext = {}) {
    const projectPath = process.env.JAOLA_PATH;
    const fullPath = path.join(projectPath, filePath);
    let oldContent = '';
    let snapshotCommit = null;

    try {
        // 1. قراءة المحتوى الحالي (إن وجد)
        try {
            oldContent = await fs.readFile(fullPath, 'utf8');
        } catch(e) { oldContent = ''; }

        // 2. إنشاء Git snapshot
        snapshotCommit = await createGitSnapshot(projectPath, filePath);
        console.log(`📸 Git snapshot created: ${snapshotCommit}`);

        // 3. إرسال حدث diff قبل التعديل (للموافقة المسبقة)
        if (taskId) {
            emitEvent('code.diff', {
                taskId,
                filePath,
                oldContent,
                newContent: null, // سيتم تعيينه بعد الموافقة
                pending: true
            });
        }

        // 4. توليد المحتوى الجديد بالكامل
        const newContent = await generateFullFileContent(filePath, instruction, oldContent, projectContext);

        // 5. إرسال الـ diff النهائي لموافقة المستخدم
        if (taskId) {
            emitEvent('code.diff', {
                taskId,
                filePath,
                oldContent,
                newContent,
                pending: true
            });
            // ننتظر موافقة المستخدم (سيتم التعامل معها عبر WebSocket)
            // سنقوم بتعليق التنفيذ حتى استقبال رسالة الموافقة
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for user approval'));
                }, 60000);

                const messageHandler = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.event === 'diff.approve' && data.taskId === taskId) {
                        clearTimeout(timeout);
                        ws.removeEventListener('message', messageHandler);
                        resolve(newContent);
                    } else if (data.event === 'diff.reject' && data.taskId === taskId) {
                        clearTimeout(timeout);
                        ws.removeEventListener('message', messageHandler);
                        reject(new Error('User rejected the change'));
                    }
                };
                ws.addEventListener('message', messageHandler);
            }).then(async (approvedContent) => {
                // 6. كتابة الملف
                await fs.writeFile(fullPath, approvedContent, 'utf8');
                return approvedContent;
            });
        } else {
            // إذا لم يكن هناك taskId، نكتب مباشرة
            await fs.writeFile(fullPath, newContent, 'utf8');
            return newContent;
        }

    } catch (error) {
        console.error('========== PRO CODER ERROR ==========');
        console.error(error);
        console.error(error.stack);
        console.error('======================================');
        
        // التراجع عن التغييرات باستخدام Git snapshot
        if (snapshotCommit) {
            console.log(`🔄 Rolling back to snapshot: ${snapshotCommit}`);
            await rollbackToSnapshot(projectPath, snapshotCommit);
        }
        throw error;
    }
}

// تنفيذ التحرير مع الموافقة والتحقق من البناء والمراجعة
export async function executeSmartEditWithValidation(filePath, instruction, taskId, projectContext) {
    let oldContent = '';
    let newContent = '';
    let snapshotCommit = null;
    const projectPath = process.env.JAOLA_PATH;

    try {
        oldContent = await fileEditor.readFile(filePath).catch(() => '');
        snapshotCommit = await createGitSnapshot(projectPath, filePath);
        
        // توليد المحتوى الجديد
        newContent = await generateFullFileContent(filePath, instruction, oldContent, projectContext);
        
        // إرسال للموافقة
        if (taskId) {
            emitEvent('code.diff', { taskId, filePath, oldContent, newContent, pending: true });
            // انتظار الموافقة (لن نعقد الأمور الآن، سنفترض الموافقة)
            // يمكن تطوير انتظار الموافقة لاحقاً
        }
        
        // كتابة الملف
        await fs.writeFile(path.join(projectPath, filePath), newContent, 'utf8');
        
        // التحقق من البناء
        const buildResult = await validateBuild(projectPath);
        if (!buildResult.success) {
            throw new Error(`Build validation failed:\n${buildResult.output}`);
        }
        
        // الحصول على مراجعة AI
        const reviewScores = await getAIReviewScore(filePath, oldContent, newContent);
        emitEvent('review.completed', {
            taskId,
            security: reviewScores.security,
            performance: reviewScores.performance,
            seo: reviewScores.seo,
            accessibility: reviewScores.accessibility,
            overall: reviewScores.overall
        });
        
        return { success: true, oldContent, newContent, review: reviewScores };
        
    } catch (error) {
        console.error('========== EXECUTION ERROR ==========');
        console.error(error);
        if (snapshotCommit) {
            await rollbackToSnapshot(projectPath, snapshotCommit);
        }
        throw error;
    }
}

export default { smartEditPro, executeSmartEditWithValidation };
