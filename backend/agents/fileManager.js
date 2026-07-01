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

/** نسخة احتياطية كاملة للمشروع */
export async function backupProject(projectPath, label = '') {
    try {
        const backupDir = path.join(projectPath, '.backups');
        await fsPromises.mkdir(backupDir, { recursive: true });

        const timestamp = Date.now();
        const snapshotDir = path.join(backupDir, `snapshot_${timestamp}${label ? '_' + label : ''}`);
        await fsPromises.mkdir(snapshotDir);

        const files = ['index.html', 'styles.css', 'script.js'];
        for (const file of files) {
            const src = path.join(projectPath, file);
            if (fs.existsSync(src)) {
                await fsPromises.copyFile(src, path.join(snapshotDir, file));
            }
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

        return { success: true, snapshot: snapshotDir, timestamp };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/** استرجاع نسخة احتياطية */
export async function restoreSnapshot(projectPath, snapshotName) {
    try {
        const snapshotDir = path.join(projectPath, '.backups', snapshotName);
        if (!fs.existsSync(snapshotDir)) {
            return { success: false, error: 'النسخة الاحتياطية غير موجودة' };
        }

        const files = await fsPromises.readdir(snapshotDir);
        for (const file of files) {
            await fsPromises.copyFile(
                path.join(snapshotDir, file),
                path.join(projectPath, file)
            );
        }

        return { success: true, restored: files, from: snapshotName };
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
