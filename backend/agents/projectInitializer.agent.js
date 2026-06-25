import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { addProject, setActiveProject, assignPort, startDevServer } from '../services/projectManager.js';

const execAsync = util.promisify(exec);

// تحويل الاسم إلى صيغة صالحة لـ npm
function sanitizeProjectName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'jaola-project';
}

export async function createNextjsProject(params = {}) {
    const originalName = params.name || 'jaola-app';
    const projectName = sanitizeProjectName(originalName);
    const rootPath = process.env.JAOLA_PATH || process.cwd();
    const projectPath = path.join(rootPath, projectName);

    try {
        // حذف المجلد إذا كان موجوداً
        try { await fs.rm(projectPath, { recursive: true, force: true }); } catch(e) {}

        console.log(`[ProjectInit] Creating project: ${originalName} -> ${projectName}`);
        const { stdout, stderr } = await execAsync(
            `npx create-next-app@latest ${projectName} --typescript --tailwind --eslint --app --yes --use-npm`,
            { cwd: rootPath, timeout: 120000 }
        );
        console.log('[ProjectInit] Output:', stdout);
        
        const newProject = addProject(originalName, projectPath);
        const projectId = newProject.id;
        setActiveProject(projectId);
        const port = assignPort(projectId);
        try { await startDevServer(projectId); } catch(e) {}
        
        return {
            success: true,
            id: projectId,
            path: projectPath,
            port: port,
            message: `✅ تم إنشاء مشروع ${originalName}`
        };
    } catch (error) {
        console.error('[ProjectInit] Error:', error);
        return { success: false, error: error.message };
    }
}
