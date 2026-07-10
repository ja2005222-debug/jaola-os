/**
 * 📁 File Service — طبقة موحّدة وآمنة لعمليات الملفات
 *
 * كانت عمليات الملفات مبعثرة (fsPromises.writeFile في كل مكان) بلا حماية
 * موحّدة. هذه الخدمة مركز واحد آمن: كل مسار يمرّ عبر sanitizePath، وتدعم
 * المسارات المتداخلة (api/auth.js)، والنسخ الاحتياطي، والحدود.
 */

import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { sanitizePath } from '../middleware/security.js';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB لكل ملف

// حل آمن للمسار داخل جذر المشروع (يرمي عند التجاوز)
function resolveSafe(projectRoot, relPath) {
    return sanitizePath(relPath, projectRoot);
}

export async function readFile(projectRoot, relPath) {
    const abs = resolveSafe(projectRoot, relPath);
    if (!fs.existsSync(abs)) return null;
    return fsp.readFile(abs, 'utf-8');
}

export async function writeFile(projectRoot, relPath, content, { backup = false } = {}) {
    const abs = resolveSafe(projectRoot, relPath);
    if (typeof content !== 'string') throw new Error('المحتوى يجب أن يكون نصاً.');
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
        throw new Error('حجم الملف يتجاوز الحد المسموح.');
    }
    if (backup && fs.existsSync(abs)) {
        await snapshotBackup(projectRoot, relPath, abs);
    }
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, content);
    return { path: relPath, bytes: Buffer.byteLength(content, 'utf8') };
}

export async function deleteFile(projectRoot, relPath) {
    const abs = resolveSafe(projectRoot, relPath);
    if (fs.existsSync(abs)) {
        await fsp.rm(abs, { force: true });
        return true;
    }
    return false;
}

export function exists(projectRoot, relPath) {
    try {
        return fs.existsSync(resolveSafe(projectRoot, relPath));
    } catch {
        return false;
    }
}

// قائمة ملفات المشروع (بمساراتها النسبية، تتخطى مجلدات النظام)
const SKIP = new Set(['.git', '.backups', 'node_modules', '.next', 'dist']);

export function listFiles(projectRoot, dir = projectRoot, acc = []) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
    for (const e of entries) {
        if (e.name.startsWith('.') && e.name !== '.gitignore') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!SKIP.has(e.name)) listFiles(projectRoot, full, acc);
        } else if (e.isFile()) {
            acc.push(path.relative(projectRoot, full).split(path.sep).join('/'));
        }
    }
    return acc;
}

async function snapshotBackup(projectRoot, relPath, abs) {
    try {
        const backupDir = path.join(projectRoot, '.backups');
        await fsp.mkdir(backupDir, { recursive: true });
        const flat = relPath.split('/').join('__');
        const dest = path.join(backupDir, `${flat}.${Date.now()}.bak`);
        await fsp.copyFile(abs, dest);
        // احتفظ بآخر 5 نسخ لكل ملف
        const backups = (await fsp.readdir(backupDir))
            .filter(f => f.startsWith(flat))
            .map(f => ({ name: f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t);
        await Promise.all(backups.slice(5).map(b => fsp.rm(path.join(backupDir, b.name), { force: true })));
    } catch { /* النسخ الاحتياطي أفضل جهد */ }
}

export default { readFile, writeFile, deleteFile, exists, listFiles };
