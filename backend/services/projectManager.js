import { getDB } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
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
        // 🛡️ **بلا صدفة**: كان هذا يُركّب اسمَ المشروع داخل سلسلةِ أمرٍ تُنفَّذ
        //    بـ`exec` — والاسمُ من المستخدم، و`replace(/\s/g,'-')` يُبدّل
        //    الفراغاتِ وحدها. فاسمٌ مثل `x; rm -rf ~` يصير `x;-rm-rf-~`
        //    و**الفاصلةُ المنقوطة تنجو**: أمرٌ ثانٍ يُنفَّذ بصلاحيّات الخادم.
        //    `execFile` يمرّر المعاملاتِ مصفوفةً، فلا صدفةَ تفسّرها أصلاً.
        const { stdout, stderr } = await execFileAsync(
            'npx',
            ['create-next-app@latest', projectName, '--typescript', '--tailwind',
             '--eslint', '--app', '--yes', '--use-npm'],
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
    // 🛡️ **بلا صدفة** هنا أيضاً: كان مسارُ المشروع ومعرّفُه يُركَّبان في سلسلةٍ
    //    فيها `cd` و`&&` وإعادةُ توجيهٍ و`&` — كلُّها تحتاج صدفةً تفسّرها، وأيُّ
    //    اقتباسٍ في المسار يكسر التقييد. البدائلُ الأصليّة تكفي:
    //    `cwd` بدل `cd`، و`detached` بدل `&`، و`stdio` إلى واصفِ ملفٍّ بدل `>`.
    const logPath = path.join(os.tmpdir(), `jaola-${String(projectId).replace(/[^\w-]/g, '_')}.log`);
    const out = fs.openSync(logPath, 'a');
    const child = spawn('npm', ['run', 'dev', '--', '--port', String(port)], {
        cwd: project.path, detached: true, stdio: ['ignore', out, out],
    });
    child.unref();
    fs.closeSync(out);
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
