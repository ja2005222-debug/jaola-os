import { getDB } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const JAOLA_PATH = process.env.JAOLA_PATH || './tenants';

// إنشاء مشروع جديد (يسجل في قاعدة البيانات فقط)
export function createProject(userId, name) {
    const db = getDB();
    const id = uuidv4();
    const projectPath = path.join(JAOLA_PATH, userId, name.replace(/\s/g, '-').toLowerCase());
    if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
    }
    const stmt = db.prepare(`
        INSERT INTO projects (id, user_id, name, path, status)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, name, projectPath, 'idle');
    return { id, name, path: projectPath };
}

// تهيئة المشروع فعلياً (إنشاء Next.js باستخدام create-next-app)
export async function initProject(projectId) {
    const project = getProjectById(projectId);
    if (!project) throw new Error('Project not found');
    const projectName = project.name.replace(/\s/g, '-').toLowerCase();
    const parentDir = path.dirname(project.path);
    try {
        console.log(`[initProject] Creating Next.js project: ${projectName} at ${parentDir}`);
        const { stdout, stderr } = await execAsync(
            `npx create-next-app@latest ${projectName} --typescript --tailwind --eslint --app --yes --use-npm`,
            { cwd: parentDir, timeout: 120000 }
        );
        console.log('[initProject] stdout:', stdout);
        if (stderr) console.log('[initProject] stderr:', stderr);
        // تحديث حالة المشروع إلى 'active'
        const db = getDB();
        db.prepare(`UPDATE projects SET status = 'active' WHERE id = ?`).run(projectId);
        return { success: true, path: project.path };
    } catch (error) {
        console.error('[initProject] Error:', error);
        return { success: false, error: error.message };
    }
}

// تشغيل خادم التطوير
export async function startDevServer(projectId) {
    const project = getProjectById(projectId);
    if (!project) throw new Error('Project not found');
    const port = 3000 + Math.floor(Math.random() * 1000);
    const cmd = `cd "${project.path}" && npm run dev -- --port ${port} > /tmp/jaola-${projectId}.log 2>&1 &`;
    exec(cmd);
    const db = getDB();
    db.prepare(`UPDATE projects SET port = ? WHERE id = ?`).run(port, projectId);
    return { port };
}

export function getProjects(userId) {
    const db = getDB();
    return db.prepare(`SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
}

export function getActiveProject(userId) {
    const db = getDB();
    return db.prepare(`SELECT * FROM projects WHERE user_id = ? AND status = 'active' LIMIT 1`).get(userId);
}

export function setActiveProject(userId, projectId) {
    const db = getDB();
    db.prepare(`UPDATE projects SET status = 'idle' WHERE user_id = ? AND status = 'active'`).run(userId);
    db.prepare(`UPDATE projects SET status = 'active' WHERE id = ? AND user_id = ?`).run(projectId, userId);
}

export function getProjectById(id) {
    const db = getDB();
    return db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
}
