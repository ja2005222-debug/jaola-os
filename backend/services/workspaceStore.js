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
    // 'utf8' نصوص، 'base64' ثنائيات (صور مولّدة/شعارات) — قراءة الثنائي
    // كنص كانت تتلفه فتعود الصور محطّمة بعد الاستعادة
    encoding: { type: String, default: 'utf8' },
    updatedAt: { type: Date, default: Date.now },
});
WorkspaceFileSchema.index({ username: 1, project: 1, filePath: 1 }, { unique: true });

const WorkspaceFile = mongoose.models.WorkspaceFile || mongoose.model('WorkspaceFile', WorkspaceFileSchema);

const online = () => mongoose.connection.readyState === 1;

const SKIP_DIRS = new Set(['.git', '.backups', 'node_modules', '.next', 'dist']);
const MAX_FILE_BYTES = 400 * 1024;  // 400KB لكل ملف
const MAX_FILES = 80;
const BINARY_EXT_RE = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf)$/i;

// جردُ ملفات المشروع بمساراتها النسبية (يشمل المجلدات الفرعية).
//
// 🔴 يُرجع ثلاثةَ أشياء لا واحداً، لأنّ الفرقَ بينها هو الفرقُ بين نسخةٍ
//    احتياطيةٍ وبين إتلاف:
//      files     — ما أمكن حملُه فعلاً
//      seen      — كلُّ ملفٍّ **رُئي** على القرص (ولو لم يُحمَل لكِبَره)
//      truncated — هل توقّف الجردُ عند السقف قبل أن يرى كلَّ شيء؟
//    كان الجردُ يُرجع `files` وحدها، فيُحذف من المخزن كلُّ ما ليس فيها —
//    أي أنّ الملفَّ الذي كبُر فوق الحدّ كانت نسختُه المحفوظة **تُمحى**
//    لأنّه كبُر. ومع مسحِ قرصِ Render لا يبقى منه شيء.
function collectFiles(rootDir, dir = rootDir, acc = { files: [], seen: [], truncated: false }) {
    if (acc.files.length >= MAX_FILES) { acc.truncated = true; return acc; }
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }

    for (const entry of entries) {
        if (acc.files.length >= MAX_FILES) { acc.truncated = true; break; }
        if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) collectFiles(rootDir, full, acc);
        } else if (entry.isFile()) {
            const rel = path.relative(rootDir, full).split(path.sep).join('/');
            acc.seen.push(rel);
            try {
                const stat = fs.statSync(full);
                if (stat.size > MAX_FILE_BYTES) continue;   // مرئيٌّ في seen فلا تُمحى نسختُه
                const binary = BINARY_EXT_RE.test(entry.name);
                acc.files.push({
                    filePath: rel,
                    content: binary ? fs.readFileSync(full).toString('base64') : fs.readFileSync(full, 'utf-8'),
                    encoding: binary ? 'base64' : 'utf8',
                });
            } catch { /* ملفٌّ تعذّرت قراءتُه — رُئي فلا يُحذف، ولم يُحمَل */ }
        }
    }
    return acc;
}

// حفظ لقطة (upsert لكل ملف + حذف ما أُزيل من القرص فعلاً — لا ما تعذّر حملُه)
export async function snapshotWorkspace(username, project, projectPath) {
    if (!online()) return { success: false, reason: 'db offline' };
    try {
        const { files, seen, truncated } = collectFiles(projectPath);
        // الحارسُ على **الرؤية** لا على الحمل: مجلدٌ فارغٌ أو تعذّرت قراءتُه
        //   لا يمسّ اللقطة (وإلا مسحَ خللٌ عابرٌ في القرص نسخةَ المستخدم كلَّها).
        //   أمّا مجلدٌ رأيناه كاملاً وكلُّ ملفاته أكبرُ من الحدّ فجردُه صحيح،
        //   فيُنقَّى منه ما حُذف فعلاً وإن لم يُحمَل شيء.
        if (!seen.length) return { success: false, reason: 'no files' };
        const skipped = seen.length - files.length;

        if (files.length) {
            const ops = files.map(f => ({
                updateOne: {
                    filter: { username, project, filePath: f.filePath },
                    update: { $set: { content: f.content, encoding: f.encoding || 'utf8', updatedAt: new Date() } },
                    upsert: true,
                },
            }));
            await WorkspaceFile.bulkWrite(ops, { ordered: false });
        }

        // 🔴 الحذفُ بجردٍ ناقصٍ إتلاف: `$nin` على قائمةٍ توقّفت عند السقف
        //    يمحو كلَّ ملفٍّ لم يبلغه الجرد. فلا نحذف إلا حين نكون قد رأينا
        //    المشروعَ كلَّه — وحينها بـ`seen` لا بـ`files`.
        if (truncated) {
            console.warn(`[WorkspaceStore] ${username}/${project}: المشروع تجاوز ${MAX_FILES} ملفاً — حُفظ ${files.length} ولم تُنقَّ اللقطة (الجرد ناقص)`);
        } else {
            await WorkspaceFile.deleteMany({ username, project, filePath: { $nin: seen } });
        }
        if (skipped) {
            console.warn(`[WorkspaceStore] ${username}/${project}: ${skipped} ملفاً تعذّر حملُه (يتجاوز ${MAX_FILE_BYTES / 1024}KB أو تعذّرت قراءته) — نسختُه السابقة باقية`);
        }

        return { success: true, count: files.length, seen: seen.length, skipped, truncated };
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

        // 🔴 يُعدُّ المكتوبُ لا المقروء: كان يُرجع `docs.length` ويطبعه، فيُقال
        //    للمالك «استُعيد مشروعك (٣ ملفات)» وقد كُتب اثنان — والثالثُ رُدَّ
        //    لخروج مساره عن الجذر. وسقطةُ ملفٍّ واحدٍ كانت تُجهض الباقين
        //    وتُرجع صفراً وقد كُتب بعضُهم.
        let restored = 0, blocked = 0, failed = 0;
        const root = path.resolve(projectPath);
        for (const doc of docs) {
            const target = path.resolve(projectPath, doc.filePath);
            if (target !== root && !target.startsWith(root + path.sep)) { blocked += 1; continue; }
            try {
                fs.mkdirSync(path.dirname(target), { recursive: true });
                if (doc.encoding === 'base64') fs.writeFileSync(target, Buffer.from(doc.content || '', 'base64'));
                else fs.writeFileSync(target, doc.content ?? '');
                restored += 1;
            } catch (e) {
                failed += 1;
                console.warn(`[WorkspaceStore] تعذّرت كتابة ${doc.filePath}: ${e.message}`);
            }
        }
        if (blocked) console.warn(`[WorkspaceStore] ${blocked} مساراً مخزَّناً يخرج عن جذر المشروع — لم يُكتب`);
        console.log(`🗄️ [WorkspaceStore] استُعيد ${restored} من ${docs.length} ملف لمشروع ${username}/${project}`);
        return { restored, blocked, failed, total: docs.length };
    } catch (e) {
        console.warn('[WorkspaceStore] فشل الاستعادة:', e.message);
        return { restored: 0, reason: e.message };
    }
}
