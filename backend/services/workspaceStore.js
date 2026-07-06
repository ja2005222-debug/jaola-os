/**
 * 🗄️ Workspace Store — نسخ ملفات المشاريع المبنية إلى MongoDB
 *
 * قرص Render مؤقت: كل المواقع المبنية تُمسح مع إعادة النشر.
 * هذه الخدمة:
 * - snapshotWorkspace: تحفظ لقطة كاملة من ملفات المشروع بعد كل بناء/حفظ ناجح
 * - restoreWorkspaceIfEmpty: تستعيد الملفات من Mongo عندما يكون مجلد المشروع
 *   فارغاً (أول انضمام بعد إعادة نشر) — فيعود موقع المستخدم كما تركه
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const WorkspaceFileSchema = new mongoose.Schema({
    username: { type: String, required: true },
    project:  { type: String, required: true },
    filePath: { type: String, required: true },  // نسبي داخل المشروع (يدعم التداخل api/auth.js)
    content:  { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now },
});
WorkspaceFileSchema.index({ username: 1, project: 1, filePath: 1 }, { unique: true });

const WorkspaceFile = mongoose.models.WorkspaceFile || mongoose.model('WorkspaceFile', WorkspaceFileSchema);

const online = () => mongoose.connection.readyState === 1;

const SKIP_DIRS = new Set(['.git', '.backups', 'node_modules', '.next', 'dist']);
const MAX_FILE_BYTES = 400 * 1024;  // 400KB لكل ملف
const MAX_FILES = 80;

// جمع الملفات النصية للمشروع (بمساراتها النسبية، يشمل المجلدات الفرعية)
function collectFiles(rootDir, dir = rootDir, acc = []) {
    if (acc.length >= MAX_FILES) return acc;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return acc; }

    for (const entry of entries) {
        if (acc.length >= MAX_FILES) break;
        if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) collectFiles(rootDir, full, acc);
        } else if (entry.isFile()) {
            try {
                const stat = fs.statSync(full);
                if (stat.size > MAX_FILE_BYTES) continue;
                acc.push({
                    filePath: path.relative(rootDir, full).split(path.sep).join('/'),
                    content: fs.readFileSync(full, 'utf-8'),
                });
            } catch (e) {}
        }
    }
    return acc;
}

// حفظ لقطة كاملة (upsert لكل ملف + حذف ما أُزيل من القرص)
export async function snapshotWorkspace(username, project, projectPath) {
    if (!online()) return { success: false, reason: 'db offline' };
    try {
        const files = collectFiles(projectPath);
        if (!files.length) return { success: false, reason: 'no files' };

        const ops = files.map(f => ({
            updateOne: {
                filter: { username, project, filePath: f.filePath },
                update: { $set: { content: f.content, updatedAt: new Date() } },
                upsert: true,
            },
        }));
        await WorkspaceFile.bulkWrite(ops, { ordered: false });

        // إزالة السجلات لملفات حُذفت من القرص
        const keep = files.map(f => f.filePath);
        await WorkspaceFile.deleteMany({ username, project, filePath: { $nin: keep } });

        return { success: true, count: files.length };
    } catch (e) {
        console.warn('[WorkspaceStore] فشل snapshot:', e.message);
        return { success: false, reason: e.message };
    }
}

// استعادة الملفات إذا كان مجلد المشروع فارغاً (بعد إعادة نشر)
export async function restoreWorkspaceIfEmpty(username, project, projectPath) {
    if (!online()) return { restored: 0 };
    try {
        const existing = fs.readdirSync(projectPath).filter(f => !f.startsWith('.'));
        if (existing.length > 0) return { restored: 0, reason: 'not empty' };

        const docs = await WorkspaceFile.find({ username, project }).lean();
        if (!docs.length) return { restored: 0, reason: 'no snapshot' };

        for (const doc of docs) {
            // حماية من مسارات خبيثة مخزنة
            const target = path.resolve(projectPath, doc.filePath);
            if (target !== path.resolve(projectPath) && !target.startsWith(path.resolve(projectPath) + path.sep)) continue;
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, doc.content ?? '');
        }
        console.log(`🗄️ [WorkspaceStore] استُعيد ${docs.length} ملف لمشروع ${username}/${project}`);
        return { restored: docs.length };
    } catch (e) {
        console.warn('[WorkspaceStore] فشل الاستعادة:', e.message);
        return { restored: 0, reason: e.message };
    }
}
