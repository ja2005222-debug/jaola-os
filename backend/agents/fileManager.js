/**
 * 📁 File Manager Agent — JAOLA OS
 *
 * يُدير ملفات المشروع:
 * - قراءة وكتابة الملفات
 * - حذف وإعادة تسمية
 * - نسخ احتياطية تلقائية
 * - بحث في محتوى الملفات
 */

import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { PROJECT_DOTFILES } from '../core/runtime/workspacePaths.js';

// ═══════════════════════════════════════════════════════
// 📂 عمليات أساسية
// ═══════════════════════════════════════════════════════

/** قراءة محتوى ملف */
export async function readFile(projectPath, filename) {
    try {
        const filePath = path.join(projectPath, filename);
        if (!fs.existsSync(filePath)) return { success: false, error: 'الملف غير موجود' };
        const content = await fsPromises.readFile(filePath, 'utf-8');
        return { success: true, content, size: content.length };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** كتابة محتوى ملف */
export async function writeFile(projectPath, filename, content) {
    try {
        const filePath = path.join(projectPath, filename);
        // إنشاء مجلد إذا لم يكن موجوداً
        await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
        await fsPromises.writeFile(filePath, content, 'utf-8');
        return { success: true, path: filename, size: content.length };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** حذف ملف */
export async function deleteFile(projectPath, filename) {
    try {
        const filePath = path.join(projectPath, filename);
        if (!fs.existsSync(filePath)) return { success: false, error: 'الملف غير موجود' };
        // نسخة احتياطية قبل الحذف
        await backupFile(projectPath, filename);
        await fsPromises.unlink(filePath);
        return { success: true, deleted: filename };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** إعادة تسمية ملف */
export async function renameFile(projectPath, oldName, newName) {
    try {
        const oldPath = path.join(projectPath, oldName);
        const newPath = path.join(projectPath, newName);
        if (!fs.existsSync(oldPath)) return { success: false, error: 'الملف الأصلي غير موجود' };
        await fsPromises.rename(oldPath, newPath);
        return { success: true, from: oldName, to: newName };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** قائمة ملفات المشروع */
export async function listFiles(projectPath) {
    try {
        const files = [];
        const IGNORE = ['.git', 'node_modules', '.DS_Store', '.backups'];

        async function walk(dir, relative = '') {
            const entries = await fsPromises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (IGNORE.includes(entry.name)) continue;
                const relPath = relative ? `${relative}/${entry.name}` : entry.name;
                if (entry.isDirectory()) {
                    await walk(path.join(dir, entry.name), relPath);
                } else {
                    const stat = await fsPromises.stat(path.join(dir, entry.name));
                    files.push({
                        name: relPath,
                        size: stat.size,
                        modified: stat.mtime,
                        type: path.extname(entry.name).slice(1) || 'file',
                    });
                }
            }
        }

        await walk(projectPath);
        return { success: true, files, total: files.length };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** بحث في محتوى الملفات */
export async function searchInFiles(projectPath, query) {
    try {
        const results = [];
        const fileList = await listFiles(projectPath);
        if (!fileList.success) return fileList;

        const textFiles = fileList.files.filter(f =>
            ['html', 'css', 'js', 'json', 'md', 'txt'].includes(f.type)
        );

        for (const file of textFiles) {
            const content = await readFile(projectPath, file.name);
            if (!content.success) continue;

            const lines = content.content.split('\n');
            const matches = [];

            lines.forEach((line, i) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                    matches.push({ line: i + 1, content: line.trim() });
                }
            });

            if (matches.length > 0) {
                results.push({ file: file.name, matches });
            }
        }

        return { success: true, results, query };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** استبدال نص في ملف */
export async function findAndReplace(projectPath, filename, find, replace) {
    try {
        const file = await readFile(projectPath, filename);
        if (!file.success) return file;

        const newContent = file.content.replaceAll(find, replace);
        const count = (file.content.match(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

        if (count === 0) return { success: false, error: 'النص غير موجود في الملف' };

        await writeFile(projectPath, filename, newContent);
        return { success: true, replaced: count, file: filename };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ═══════════════════════════════════════════════════════
// 💾 النسخ الاحتياطية
// ═══════════════════════════════════════════════════════

/** نسخة احتياطية لملف واحد */
export async function backupFile(projectPath, filename) {
    try {
        const backupDir = path.join(projectPath, '.backups');
        await fsPromises.mkdir(backupDir, { recursive: true });

        const timestamp = Date.now();
        const backupName = `${filename.replace(/\//g, '_')}.${timestamp}.bak`;
        const source = path.join(projectPath, filename);
        const dest = path.join(backupDir, backupName);

        if (fs.existsSync(source)) {
            await fsPromises.copyFile(source, dest);
        }

        return { success: true, backup: backupName };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// مجلدات/حدود جمع ملفات النسخة — نفس فلسفة workspaceStore (سقف يمنع التضخم)
const BACKUP_SKIP_DIRS = new Set(['.backups', '.git', 'node_modules', '.next', 'dist']);

// 🔴 كان السقف 80 ملفاً يُقتطع بترتيب `readdir` — أي بترتيبٍ أبجديٍّ عملياً.
//    فمشروعٌ فيه 98 ملفاً وقع `index.html` منه في الموضع 98، فلم يدخل النسخة
//    أصلاً؛ ثم جاء أمرُ «تراجع» فأعاد ثمانين ملفاً **دون الملفّ الذي عُدّل**،
//    وأعلن «⏪ استُرجعت النسخة (80 ملف)». نجاحٌ مُعلَنٌ فوق استرجاعٍ لم يقع.
//    فالسقفُ صار على **الحجم** — وهو ما كان يُراد حمايته — لا على العدد وحده،
//    وما يسقط رغم ذلك يُعلَن ولا يُبتلع.
const BACKUP_MAX_FILES = 400;
const BACKUP_MAX_FILE_BYTES = 400 * 1024;
const BACKUP_MAX_TOTAL_BYTES = 8 * 1024 * 1024;

// `.env.example` يكتبه databaseAgent في كل مشروع، وليس فيه سرّ (فالسرُّ في
// `.env` وهو مستثنى). كان يسقط مع سائر الملفات المنقوطة فلا يُنسخ ولا يُسترجع.
const BACKUP_DOTFILES = new Set(PROJECT_DOTFILES);   // مصدرٌ واحدٌ — كانت هنا نسخةٌ ثانية

/**
 * يجمع ملفات النسخة ويصف ما تعذّر جمعه بدل ابتلاعه.
 * @returns {{files: string[], truncated: boolean, dropped: string[]}}
 */
function collectBackup(rootDir, dir = rootDir, st = { files: [], bytes: 0, truncated: false, dropped: [] }) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return st; }
    for (const e of entries) {
        if (st.files.length >= BACKUP_MAX_FILES || st.bytes >= BACKUP_MAX_TOTAL_BYTES) {
            st.truncated = true;
            break;
        }
        if (e.name.startsWith('.') && !BACKUP_DOTFILES.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!BACKUP_SKIP_DIRS.has(e.name)) collectBackup(rootDir, full, st);
        } else if (e.isFile()) {
            try {
                const size = fs.statSync(full).size;
                const rel = path.relative(rootDir, full).split(path.sep).join('/');
                // ملفٌّ أكبر من الحدّ يسقط — لكنّه يُسمّى، فلا يظنّ أحدٌ أنه محفوظ.
                if (size > BACKUP_MAX_FILE_BYTES) { st.dropped.push(rel); st.truncated = true; continue; }
                st.files.push(rel);
                st.bytes += size;
            } catch { /* تجاهل */ }
        }
    }
    return st;
}


/**
 * نسخة احتياطية كاملة للمشروع — كل الملفات (بمساراتها المتداخلة api/…)
 * لا الثلاثي الثابت القديم (index/styles/script) الذي كان يترك app.js
 * وبقية الصفحات خارج شبكة الأمان فيجعل الاسترجاع ناقصاً.
 */
export async function backupProject(projectPath, label = '') {
    try {
        const backupDir = path.join(projectPath, '.backups');
        await fsPromises.mkdir(backupDir, { recursive: true });

        const timestamp = Date.now();
        const snapshotDir = path.join(backupDir, `snapshot_${timestamp}${label ? '_' + label : ''}`);
        await fsPromises.mkdir(snapshotDir);

        const picked = collectBackup(projectPath);
        for (const rel of picked.files) {
            const dest = path.join(snapshotDir, rel);
            await fsPromises.mkdir(path.dirname(dest), { recursive: true });
            await fsPromises.copyFile(path.join(projectPath, rel), dest);
        }

        // تنظيف النسخ القديمة (احتفظ بآخر 5 فقط)
        const snapshots = (await fsPromises.readdir(backupDir))
            .filter(d => d.startsWith('snapshot_'))
            .sort();
        if (snapshots.length > 5) {
            for (const old of snapshots.slice(0, -5)) {
                const oldPath = path.join(backupDir, old);
                await fsPromises.rm(oldPath, { recursive: true, force: true });
            }
        }

        // النسخةُ تصف نفسها: كم حُفظ، وهل نقصت، وما الذي سقط بالاسم.
        return {
            success: true, snapshot: snapshotDir, timestamp,
            saved: picked.files.length, truncated: picked.truncated, dropped: picked.dropped,
        };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** استرجاع نسخة احتياطية (يدعم المسارات المتداخلة المحفوظة) */
export async function restoreSnapshot(projectPath, snapshotName) {
    try {
        const snapshotDir = path.join(projectPath, '.backups', snapshotName);
        if (!fs.existsSync(snapshotDir)) {
            return { success: false, error: 'النسخة الاحتياطية غير موجودة' };
        }

        const files = collectBackup(snapshotDir).files;
        for (const rel of files) {
            const dest = path.join(projectPath, rel);
            await fsPromises.mkdir(path.dirname(dest), { recursive: true });
            await fsPromises.copyFile(path.join(snapshotDir, rel), dest);
        }

        // 🔴 الاسترجاع **ينسخ ولا يحذف**: ملفٌّ أُنشئ بعد النسخة يبقى، وملفٌّ لم
        //    تسعه النسخةُ لا يعود. وكان كلاهما يُبتلع تحت «✅ استُرجعت النسخة».
        //    فما لم يُسترجَع يُسمّى الآن، ويقرّر المستخدمُ ما يفعل به.
        const inSnapshot = new Set(files);
        const notRestored = collectBackup(projectPath).files.filter((f) => !inSnapshot.has(f));

        return { success: true, restored: files, notRestored, from: snapshotName };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** قائمة النسخ الاحتياطية */
export async function listSnapshots(projectPath) {
    try {
        const backupDir = path.join(projectPath, '.backups');
        if (!fs.existsSync(backupDir)) return { success: true, snapshots: [] };

        const entries = await fsPromises.readdir(backupDir, { withFileTypes: true });
        const snapshots = entries
            .filter(e => e.isDirectory() && e.name.startsWith('snapshot_'))
            .map(e => ({
                name: e.name,
                timestamp: parseInt(e.name.split('_')[1]) || 0,
                date: new Date(parseInt(e.name.split('_')[1]) || 0).toLocaleString('ar-SA'),
            }))
            .sort((a, b) => b.timestamp - a.timestamp);

        return { success: true, snapshots };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
