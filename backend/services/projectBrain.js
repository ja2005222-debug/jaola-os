/**
 * 🧠 Project Brain — فهم المشروع كاملاً (لا الرسالة الأخيرة فقط)
 *
 * يدمج ثلاثة مصادر في صورة واحدة يجيب منها الشات:
 *   1) الملفات الفعلية على القرص  2) ذاكرة المشروع (قرارات/تاريخ)  3) دفتر ما أُنجز/ما تبقّى
 *
 * buildProjectBrain دالة نقية (تقبل mem + files) → قابلة للاختبار بلا قرص.
 */

import { promises as fsp } from 'fs';
import path from 'path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage']);
const kindOf = (p) => {
    if (/\.html?$/i.test(p)) return 'html';
    if (/\.(css|scss)$/i.test(p)) return 'style';
    if (/\.(jsx?|mjs|cjs|tsx?)$/i.test(p)) return 'script';
    if (/\.json$/i.test(p)) return 'config';
    if (/\.(sql|prisma)$/i.test(p)) return 'schema';
    if (/\.md$/i.test(p)) return 'doc';
    return 'other';
};

/** يمسح ملفات المشروع على القرص (يتخطّى مجلدات الضجيج) */
export async function scanProjectFiles(projectPath, { maxFiles = 500 } = {}) {
    const out = [];
    async function walk(dir, rel) {
        if (out.length >= maxFiles) return;
        let entries;
        try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            if (out.length >= maxFiles) break;
            if (e.name.startsWith('.') && e.name !== '.env.example') continue;
            const abs = path.join(dir, e.name);
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) {
                if (SKIP_DIRS.has(e.name)) continue;
                await walk(abs, r);
            } else if (e.isFile()) {
                let size = 0;
                try { size = (await fsp.stat(abs)).size; } catch {}
                out.push({ path: r, size, kind: kindOf(r) });
            }
        }
    }
    await walk(projectPath, '');
    return out.sort((a, b) => a.path.localeCompare(b.path));
}

const has = (files, re) => files.some((f) => re.test(f.path));

/**
 * حقائق ملفات دقيقة من القرص (لا من الخطة): إجمالي الملفات، صفحات HTML، أكبر
 * ملف، والأكبر حجماً. تُمكّن الشات من الإجابة عن «كم صفحة / كم ملف / أكبر ملف»
 * بدل «غير محدد في السجل». دالة نقية.
 * @param {Array} files [{ path, size, kind }]
 */
export function projectFacts(files = []) {
    const real = files.filter((f) => f && f.path && !f.path.startsWith('.'));
    const html = real.filter((f) => /\.html?$/i.test(f.path)).map((f) => f.path);
    const sorted = real.slice().sort((a, b) => (b.size || 0) - (a.size || 0));
    const largest = sorted[0] || null;
    return {
        totalFiles: real.length,
        htmlPages: html,
        largest: largest ? { path: largest.path, size: largest.size || 0 } : null,
        top: sorted.slice(0, 5).map((f) => ({ path: f.path, size: f.size || 0 })),
    };
}

/** يصوغ كتلة حقائق الملفات لسياق الشات (عربي/إنجليزي). */
export function summarizeFacts(files = [], lang = 'ar') {
    const f = projectFacts(files);
    if (!f.totalFiles) return '';
    const kb = (n) => (n / 1024).toFixed(1) + 'KB';
    const pages = f.htmlPages.length;
    if (lang === 'ar') {
        let s = `\n\n📁 حقائق الملفات (من القرص، دقيقة — استعملها للإجابة عن عدد الصفحات/الملفات/أكبر ملف):`;
        s += `\n- إجمالي الملفات: ${f.totalFiles}`;
        s += `\n- صفحات HTML: ${pages}${pages ? ' (' + f.htmlPages.join('، ') + ')' : ''}`;
        if (f.largest) s += `\n- أكبر ملف: ${f.largest.path} (${kb(f.largest.size)})`;
        if (f.top.length) s += `\n- الأكبر حجماً: ${f.top.map((t) => `${t.path} ${kb(t.size)}`).join(' · ')}`;
        return s;
    }
    let s = `\n\n📁 File facts (from disk, exact — use for questions about page/file count or largest file):`;
    s += `\n- Total files: ${f.totalFiles}`;
    s += `\n- HTML pages: ${pages}${pages ? ' (' + f.htmlPages.join(', ') + ')' : ''}`;
    if (f.largest) s += `\n- Largest file: ${f.largest.path} (${kb(f.largest.size)})`;
    if (f.top.length) s += `\n- Biggest: ${f.top.map((t) => `${t.path} ${kb(t.size)}`).join(' · ')}`;
    return s;
}

/**
 * يبني صورة المشروع من الذاكرة + الملفات (نقية وقابلة للاختبار).
 * @param {object} mem ذاكرة المشروع (design/tech/structure/history)
 * @param {Array} files [{ path, size, kind }]
 */
export function buildProjectBrain(mem = {}, files = []) {
    const design = mem.design || {};
    const tech = mem.tech || {};
    const structure = mem.structure || {};
    const plannedFeatures = structure.features || [];

    // أدلّة الإنجاز من الملفات الفعلية
    const evidence = {
        frontend: has(files, /(^|\/)index\.html$/i),
        styles: has(files, /\.css$/i),
        script: has(files, /(^|\/)script\.js$/i) || has(files, /\.jsx?$/i),
        backend: has(files, /(^|\/)api\//i) || !!tech.hasBackend,
        database: has(files, /(^|\/)(db|prisma)\//i) || has(files, /schema\.(sql|prisma)$/i),
        auth: has(files, /auth/i),
        tests: has(files, /(^|\/)(tests?|__tests__)\//i) || has(files, /\.test\.[jt]sx?$/i),
        deploy: has(files, /(^|\/)Dockerfile/i) || has(files, /render\.yaml$/i) || has(files, /\.github\/workflows/i),
    };

    const done = [];
    if (evidence.frontend) done.push('واجهة أساسية (index.html)');
    if (evidence.styles) done.push('تنسيقات CSS');
    if (evidence.script) done.push('تفاعل JavaScript');
    if (evidence.backend) done.push('خادم / واجهات API');
    if (evidence.database) done.push('قاعدة بيانات / مخطط');
    if (evidence.auth) done.push('نظام مصادقة');
    if (evidence.tests) done.push('اختبارات');
    if (evidence.deploy) done.push('تجهيز نشر');

    // ما تبقّى: ميزات مخطّطة بلا دليل + خطوات جوهرية ناقصة
    const remaining = [];
    for (const feat of plannedFeatures) {
        const f = String(feat).toLowerCase();
        const covered =
            (/(auth|login|تسجيل|مصادقة)/.test(f) && evidence.auth) ||
            (/(cart|checkout|سلة|دفع|payment)/.test(f) && evidence.backend) ||
            (/(booking|حجز|reservation)/.test(f) && evidence.backend);
        if (!covered) remaining.push(feat);
    }
    if (tech.hasBackend && !evidence.database) remaining.push('قاعدة بيانات للخادم');
    if (evidence.backend && !evidence.tests) remaining.push('اختبارات للـ APIs');
    if (files.length > 0 && !evidence.deploy) remaining.push('تجهيز النشر (Docker/CI)');
    const remainingUnique = [...new Set(remaining)];

    // القرارات المتّخذة (للنقطة: شرح القرارات)
    const decisions = [];
    if (design.style) decisions.push(`الأسلوب البصري: ${design.style}`);
    if (design.colors) decisions.push(`الألوان: ${design.colors}`);
    if (tech.framework && tech.framework !== 'vanilla') decisions.push(`الإطار: ${tech.framework}`);
    if (tech.apis?.length) decisions.push(`واجهات API: ${tech.apis.join('، ')}`);

    const denom = done.length + remainingUnique.length;
    return {
        filesCount: files.length,
        files: files.map((f) => f.path),
        structure: {
            sections: structure.sections || [],
            features: plannedFeatures,
            pages: structure.pages || [],
        },
        decisions,
        progress: {
            done,
            remaining: remainingUnique,
            percent: denom > 0 ? Math.round((done.length / denom) * 100) : 0,
        },
        lastActivity: (mem.history || []).slice(-3),
        updatedAt: mem.updatedAt || null,
    };
}

/** ملخّص نصّي موجز يُحقن في سياق الشات (يفهم كامل المشروع) */
export function summarizeBrain(brain, lang = 'ar') {
    if (!brain || brain.filesCount === 0) {
        return lang === 'ar' ? 'المشروع فارغ — لم يُبنَ بعد.' : 'Project is empty — nothing built yet.';
    }
    const L = lang === 'ar';
    const lines = [];
    // إن توفّر تحقّق فعلي من الكود (works=false) لا نعرض نسبة مخترعة — التطبيق
    // لا يعمل فعلاً مهما بلغت "نسبة الخطة". الصدق أهمّ من رقمٍ يطمئن زوراً.
    if (brain.progress.works === false) {
        lines.push(L
            ? `📦 المشروع: ${brain.filesCount} ملف — ⚠️ لا يعمل بعد (ثغرات حقيقية في الكود، ليست نسبة خطة)`
            : `📦 Project: ${brain.filesCount} files — ⚠️ NOT working yet (real code gaps, not a plan percentage)`);
    } else if (brain.progress.works === true) {
        lines.push(L ? `📦 المشروع: ${brain.filesCount} ملف — ✅ يعمل (اجتاز التحقّق السلوكي)` : `📦 Project: ${brain.filesCount} files — ✅ working (passed behavior check)`);
    } else {
        lines.push(L ? `📦 المشروع: ${brain.filesCount} ملف (${brain.progress.percent}% مكتمل)` : `📦 Project: ${brain.filesCount} files (${brain.progress.percent}% complete)`);
    }
    if (brain.progress.done.length) lines.push((L ? '✅ أُنجز: ' : '✅ Done: ') + brain.progress.done.join('، '));
    if (brain.progress.remaining.length) lines.push((L ? '🔜 متبقٍّ (من الكود الفعلي): ' : '🔜 Remaining (from actual code): ') + brain.progress.remaining.join(' | '));
    if (brain.decisions.length) lines.push((L ? '🧭 قرارات: ' : '🧭 Decisions: ') + brain.decisions.join('، '));
    return lines.join('\n');
}
