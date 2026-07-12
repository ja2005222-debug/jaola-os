/**
 * ✅ Backend Verify — فحص تنفيذي حقيقي للكود المولّد
 *
 * يشغّل `node --check` على كل ملف JS مولّد (في عملية فرعية معزولة)، فيكتشف
 * أخطاء البنية فعلياً بدل الاكتفاء بالثقة في النموذج. الأخطاء تُغذّى لوكيل Debug.
 *
 * ESM-aware: الملفات ذات import/export تُفحص كـ module.
 */

import { spawn } from 'child_process';
import { promises as fsp } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const JS_RE = /\.(mjs|cjs|js)$/i;

function looksESM(content = '') {
    return /^\s*import\s.+from\s|^\s*export\s|^\s*import\s*\{/m.test(content);
}

/** يفحص محتوى ملف واحد عبر node --check — يُرجع { ok, error } */
export async function checkSyntax(content, hintPath = 'file.js') {
    const isESM = /\.mjs$/i.test(hintPath) || (!/\.cjs$/i.test(hintPath) && looksESM(content));
    const ext = isESM ? '.mjs' : '.cjs';
    const tmp = path.join(os.tmpdir(), `jaola-check-${crypto.randomBytes(6).toString('hex')}${ext}`);
    await fsp.writeFile(tmp, content);
    try {
        return await new Promise((resolve) => {
            const child = spawn(process.execPath, ['--check', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
            let stderr = '';
            child.stderr.on('data', (d) => { stderr += d.toString(); });
            child.on('close', (code) => {
                if (code === 0) resolve({ ok: true });
                else {
                    // نظّف مسار الملف المؤقت من الرسالة
                    const msg = stderr.split('\n').filter(Boolean).slice(0, 4).join(' ').replace(new RegExp(tmp, 'g'), hintPath);
                    resolve({ ok: false, error: msg || `node --check فشل (code ${code})` });
                }
            });
            child.on('error', (e) => resolve({ ok: false, error: `تعذّر تشغيل الفحص: ${e.message}` }));
        });
    } finally {
        fsp.unlink(tmp).catch(() => {});
    }
}

/** يفحص قائمة ملفات {path, content} — يُرجع تقريراً { ok, checked, failures[] } */
export async function syntaxCheckFiles(files) {
    const jsFiles = (files || []).filter((f) => f.path && JS_RE.test(f.path) && typeof f.content === 'string');
    const failures = [];
    for (const f of jsFiles) {
        const res = await checkSyntax(f.content, f.path);
        if (!res.ok) failures.push({ path: f.path, error: res.error });
    }
    return { ok: failures.length === 0, checked: jsFiles.length, failures };
}
