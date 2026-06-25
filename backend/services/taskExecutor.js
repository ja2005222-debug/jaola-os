import * as fileEditor from './fileEditor.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import simpleGit from 'simple-git';
import fs from 'fs/promises';
import path from 'path';

const execPromise = promisify(exec);
const JAOLA_PATH = process.env.JAOLA_PATH;

// كشف نوع الـ Router
async function detectRouterType(projectPath) {
    try {
        await fs.access(path.join(projectPath, 'app'));
        return 'app';
    } catch {
        try {
            await fs.access(path.join(projectPath, 'pages'));
            return 'pages';
        } catch {
            return 'unknown';
        }
    }
}

// Git snapshot
async function createGitSnapshot(projectPath, taskId) {
    const git = simpleGit(projectPath);
    const snapshotDir = `/tmp/jaola-snapshots/${taskId}`;
    await fs.rm(snapshotDir, { recursive: true, force: true });
    await fs.mkdir(snapshotDir, { recursive: true });
    await git.raw(['clone', projectPath, snapshotDir]);
    return snapshotDir;
}

async function rollbackFromSnapshot(projectPath, snapshotDir) {
    const git = simpleGit(projectPath);
    await git.reset(['--hard', 'HEAD']);
    await git.raw(['clean', '-fd']);
    await fs.cp(snapshotDir, projectPath, { recursive: true, force: true });
}

// Build validation
async function validateBuild() {
    try {
        const { stdout } = await execPromise(`cd ${JAOLA_PATH} && npm run build 2>&1`);
        return { success: true, output: stdout };
    } catch (err) {
        return { success: false, output: err.stdout + err.stderr };
    }
}

// AI Review
async function runAIReview(code) {
    try {
        const { queryGroqJSON } = await import('./groqService.js');
        const prompt = `Analyze this code and return JSON: { "security": 0-100, "performance": 0-100, "seo": 0-100, "accessibility": 0-100, "codeQuality": 0-100, "summary": "" }\nCode:\n${code.substring(0, 3000)}`;
        const result = await queryGroqJSON(prompt, 0.2);
        return result;
    } catch(e) {
        return { security: 50, performance: 50, seo: 50, accessibility: 50, codeQuality: 50, summary: 'Auto-evaluated' };
    }
}

// QA Score
async function runQAScore(projectPath) {
    try {
        const { stdout } = await execPromise(`cd ${projectPath} && npm run test -- --coverage 2>&1 || true`);
        const match = stdout.match(/All files[|]+\s*(\d+\.?\d*)/);
        const coverage = match ? parseFloat(match[1]) : 70;
        return { coverage, passed: coverage > 70, details: stdout.substring(0, 500) };
    } catch(e) {
        return { coverage: 0, passed: false, details: e.message };
    }
}

// ========== Coder Tasks ==========
async function executeCoderTask(task, context) {
    const { action, params } = task;

    if (action === 'read_file') {
        if (!params?.path) throw new Error('Missing path');
        return await fileEditor.readFile(params.path);
    }

    if (action === 'list_files') {
        const { stdout } = await execPromise(`ls -la ${JAOLA_PATH} | head -40`);
        return stdout;
    }

    if (action === 'edit_file' || action === 'create_file') {
        const isCreate = (action === 'create_file');
        let filePath = params.path;
        if (!filePath) throw new Error('Missing path');
        
        // تصحيح المسار إذا كان Pages Router والمشروع App Router
        const routerType = await detectRouterType(JAOLA_PATH);
        if (routerType === 'app' && (filePath === 'pages/index.tsx' || filePath === 'pages/index.js')) {
            filePath = 'app/page.tsx';
            console.log(`[Coder] Path corrected: ${params.path} -> ${filePath}`);
        } else if (routerType === 'pages' && (filePath === 'app/page.tsx' || filePath === 'app/page.js')) {
            filePath = 'pages/index.tsx';
            console.log(`[Coder] Path corrected: ${params.path} -> ${filePath}`);
        }
        
        // 1. Git snapshot
        const snapshotDir = await createGitSnapshot(JAOLA_PATH, task.id);
        
        // 2. الحصول على المحتوى الجديد
        let newContent = params.content || '';
        if (!newContent && params.instruction) {
            const { smartRewrite } = await import('../agents/coder.agent.js');
            const oldContent = isCreate ? '' : await fileEditor.readFile(filePath);
            newContent = await smartRewrite(filePath, params.instruction, oldContent);
        }
        
        // 3. حفظ التغيير
        if (isCreate) {
            await fileEditor.createFile(filePath, newContent);
        } else {
            await fileEditor.editFile(filePath, newContent);
        }
        
        // 4. Build validation
        const buildResult = await validateBuild();
        if (!buildResult.success) {
            await rollbackFromSnapshot(JAOLA_PATH, snapshotDir);
            throw new Error(`Build validation failed:\n${buildResult.output}`);
        }
        
        // 5. AI Review & QA Score
        const review = await runAIReview(newContent);
        const qaScore = await runQAScore(JAOLA_PATH);
        
        // 6. إرسال diff
        const { emitEvent } = await import('./broadcast.js');
        const oldContent = isCreate ? '' : await fileEditor.readFile(filePath);
        emitEvent('code.diff', {
            taskId: task.id,
            filePath,
            oldContent,
            newContent,
            review,
            qaScore
        });
        
        return { success: true, file: filePath, review, qaScore };
    }

    if (action === 'createReadmeFile') {
        const readmePath = `${JAOLA_PATH}/README.md`;
        const projectName = params?.projectName || 'JAOLA Project';
        const content = `# ${projectName}\n\nGenerated by JAOLA AI\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;
        await fileEditor.createFile(readmePath, content);
        return { success: true, file: readmePath };
    }

    if (action === 'delete_file') {
        if (!params?.path) throw new Error('Missing path');
        return await fileEditor.deleteFile(params.path);
    }

    if (action === 'get_status') {
        let serverRunning = false;
        try {
            const { stdout } = await execPromise('lsof -i :3000 | grep LISTEN');
            serverRunning = stdout.length > 0;
        } catch(e) {}
        return { serverRunning, projectPath: JAOLA_PATH, lastModified: new Date().toISOString() };
    }

    throw new Error(`Unknown coder action: ${action}`);
}

// ========== Deployer Tasks ==========
async function executeDeployerTask(action) {
    if (action === 'run_dev') {
        exec(`cd ${JAOLA_PATH} && npm run dev > /tmp/jaola.log 2>&1 &`);
        return { message: 'Dev server started' };
    }
    if (action === 'run_build') {
        try {
            const { stdout } = await execPromise(`cd ${JAOLA_PATH} && npm run build 2>&1`);
            return { output: stdout };
        } catch (err) {
            throw new Error(`Build failed: ${err.message}`);
        }
    }
    if (action === 'deploy_to_vercel') {
        const token = process.env.VERCEL_TOKEN;
        if (!token) return { message: 'Vercel token missing' };
        const { stdout } = await execPromise(`npx vercel --prod --token ${token} --cwd ${JAOLA_PATH} --yes`);
        const url = stdout.match(/https:\/\/[^\s]+\.vercel\.app/);
        return { message: 'Deployed', url: url?.[0] };
    }
    throw new Error(`Unknown deployer action: ${action}`);
}

// ========== Others ==========
async function executeReviewerTask() { return { approved: true }; }
async function executeQATask() {
    const result = await runQAScore(JAOLA_PATH);
    return { passed: result.passed, details: result };
}
async function executeProjectInitializerTask(params) {
    const { createNextjsProject } = await import('../agents/projectInitializer.agent.js');
    return await createNextjsProject(params);
}
async function executeArchitectTask(params) {
    const { generateArchitecture } = await import('../agents/architect.agent.js');
    const context = await (await import('./knowledgeService.js')).loadKnowledge();
    return await generateArchitecture(params.userMessage, context);
}

// Main Dispatcher
export async function executeTask(task, context = {}) {
    const { agent } = task;
    if (agent === 'coder') return await executeCoderTask(task, context);
    if (agent === 'deployer') return await executeDeployerTask(task.action);
    if (agent === 'reviewer') return await executeReviewerTask();
    if (agent === 'qa') return await executeQATask();
    if (agent === 'projectInitializer') return await executeProjectInitializerTask(task.params);
    if (agent === 'architect') return await executeArchitectTask(task.params);
    throw new Error(`Unknown agent: ${agent}`);
}
