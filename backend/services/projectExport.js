/**
 * 📦 تصدير المشروع — «كودك ملكك»: تنزيل المشروع كاملاً كملف zip.
 *
 * يستثني دائماً: node_modules (ثقيلة/قابلة للتثبيت)، ‎.git (داخلي)،
 * و‎.env وأخواتها (أسرار لا تُصدَّر أبداً).
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const SKIP_DIRS = new Set(['node_modules', '.git']);
const SKIP_FILES = /^\.env(\..+)?$/i;

/** يبني Buffer لملف zip من مجلد المشروع (بلا أسرار ولا داخليات). */
export function exportProjectZip(projectPath) {
    if (!projectPath || !fs.existsSync(projectPath)) {
        throw new Error('مجلد المشروع غير موجود.');
    }
    const zip = new AdmZip();
    const addDir = (dir, rel = '') => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                addDir(path.join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name);
            } else {
                if (SKIP_FILES.test(entry.name)) continue;
                zip.addFile(
                    rel ? `${rel}/${entry.name}` : entry.name,
                    fs.readFileSync(path.join(dir, entry.name))
                );
            }
        }
    };
    addDir(projectPath);
    return zip.toBuffer();
}
