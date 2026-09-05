/**
 * 🩺 System Doctor — وكيل فحص صحة النظام
 *
 * يفحص المكوّنات الحيّة ويُخرج تقريراً منظّماً بالحالة والمشاكل والتوصيات:
 * - قاعدة البيانات (اتصال Mongo)
 * - مزوّدو الذكاء (Groq / DeepSeek / OpenAI / Gemini)
 * - صف المهام (تكدّس؟)
 * - الذاكرة والقرص (استهلاك)
 * - الإضافات (أخطاء تحميل)
 * - متغيرات البيئة الحرجة
 *
 * يُستدعى من مسار /api/admin/health أو دورياً. لا يستهلك LLM.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { queueStatus } from '../core/runtime/ExecutionQueue.js';
import { orchestrator } from '../core/PluginOrchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OK = 'ok', WARN = 'warn', CRIT = 'critical';

function check(name, status, detail, fix = null) {
    return { name, status, detail, ...(fix ? { fix } : {}) };
}

export function runSystemDiagnostics() {
    const checks = [];

    // ── قاعدة البيانات ──
    const dbReady = mongoose.connection.readyState === 1;
    checks.push(check(
        'قاعدة البيانات (MongoDB)',
        dbReady ? OK : WARN,
        dbReady ? 'متصلة' : 'غير متصلة — النظام يعمل بوضع الصمود (الذاكرة الدائمة معطّلة)',
        dbReady ? null : 'اضبط MONGO_URI في متغيرات البيئة وتأكد من وصول الشبكة.'
    ));

    // ── مزوّدو الذكاء ──
    const providers = [
        ['Groq', process.env.GROQ_API_KEY],
        ['DeepSeek', process.env.DEEPSEEK_API_KEY],
        ['OpenAI', process.env.OPENAI_API_KEY],
        ['Gemini', process.env.GEMINI_API_KEY],
    ];
    const active = providers.filter(([, k]) => !!k).map(([n]) => n);
    checks.push(check(
        'مزوّدو الذكاء الاصطناعي',
        active.length >= 2 ? OK : active.length === 1 ? WARN : CRIT,
        active.length ? `نشط: ${active.join('، ')}` : 'لا مزوّد مُهيأ',
        active.length >= 2 ? null : 'أضف مفتاحاً ثانياً على الأقل (DEEPSEEK_API_KEY) ليعمل الـ failover عند نفاد حصة Groq.'
    ));

    // ── صف المهام ──
    const q = queueStatus();
    checks.push(check(
        'صف المهام',
        q.waiting > 5 ? WARN : OK,
        `قيد التنفيذ: ${q.running} | منتظر: ${q.waiting} | الحد الأقصى: ${q.maxConcurrent}`,
        q.waiting > 5 ? 'تكدّس ملحوظ — فكّر برفع MAX_CONCURRENT_MISSIONS أو مراجعة بطء المزوّد.' : null
    ));

    // ── الذاكرة ──
    const rssMb = Math.round(process.memoryUsage().rss / (1024 * 1024));
    const limit = memoryLimitMb();
    checks.push(check(
        'الذاكرة (RAM)',
        rssMb > limit.mb * 0.85 ? CRIT : rssMb > limit.mb * 0.7 ? WARN : OK,
        `المستخدَم: ${rssMb} MB من ${limit.mb} MB (${limit.source})`,
        rssMb > limit.mb * 0.7 ? 'استهلاك مرتفع — راقب تسريبات الذاكرة أو ارفع خطة الاستضافة.' : null
    ));

    // ── القرص (مساحة الـ workspace) ──
    // 🔴 كان يعدّ **عناصر** المجلّد ويقول `ok` دائماً، بينما ترويسةُ الملفّ
    //    تَعِد بقياس «الذاكرة والقرص (استهلاك)». فحصٌ لا يفشل ليس فحصاً.
    const wsPath = path.resolve(__dirname, '../../workspace');
    const disk = diskFree(wsPath);
    if (disk) {
        const usedPct = Math.round((1 - disk.freeGb / disk.totalGb) * 100);
        checks.push(check(
            'مساحة القرص (workspace)',
            usedPct >= 95 ? CRIT : usedPct >= 85 ? WARN : OK,
            `متاح: ${disk.freeGb} GB من ${disk.totalGb} GB (مستخدَم ${usedPct}%) | عناصر: ${countDir(wsPath)}`,
            usedPct >= 85 ? 'القرص يوشك أن يمتلئ — نظّف مشاريع قديمة أو ارفع حجم القرص.' : null
        ));
    } else {
        checks.push(check('مساحة القرص (workspace)', WARN, 'تعذّر قياس المساحة على هذه المنصّة'));
    }

    // ── الإضافات ──
    // 🔴 كان الصفُّ يُحذف كلَّه إن لم يُهيّأ المنسّق. و`init()` يُستدعى قبل
    //    `listen` لكنّ فشلَه لا يمنع الإقلاع، فحالةُ إخفاقِه هي بالضبط الحالةُ
    //    التي يختفي فيها الصفّ — ويقول الملخّصُ «كل الأنظمة سليمة ✅».
    //    الغيابُ لا يُقرأ سلامةً: يبقى الصفُّ ويقول إنّه لا يعلم.
    if (orchestrator.initialized) {
        const st = orchestrator.status();
        checks.push(check(
            'نظام الإضافات',
            st.errors.length ? WARN : OK,
            `محمّلة: ${st.count} | وكلاء مسجّلون: ${st.registeredAgents.length}${st.errors.length ? ` | أخطاء: ${st.errors.length}` : ''}`,
            st.errors.length ? `راجع الإضافات المعطوبة: ${st.errors.map(e => e.error).join(' ؛ ').slice(0, 200)}` : null
        ));
    } else {
        checks.push(check(
            'نظام الإضافات',
            WARN,
            'لم يُهيّأ بعد — إمّا أنّ الإقلاع لم يكتمل أو أنّ `orchestrator.init()` أخفق',
            'راجع سجلّ الإقلاع: فشلُ التهيئة لا يمنع الخادم من العمل، فيمرّ صامتاً.'
        ));
    }

    // ── متغيرات البيئة الحرجة ──
    const missing = [];
    if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
    if (!process.env.PAT_ENCRYPTION_KEY) missing.push('PAT_ENCRYPTION_KEY (يُستخدم JWT_SECRET كاحتياط)');
    checks.push(check(
        'متغيرات البيئة الحرجة',
        missing.some(m => m === 'JWT_SECRET') ? CRIT : missing.length ? WARN : OK,
        missing.length ? `ناقص: ${missing.join('، ')}` : 'كل المتغيرات الحرجة مضبوطة',
        missing.length ? 'اضبط المتغيرات الناقصة في بيئة الاستضافة.' : null
    ));

    // ── الملخص ──
    const critical = checks.filter(c => c.status === CRIT).length;
    const warnings = checks.filter(c => c.status === WARN).length;
    const overall = critical ? CRIT : warnings ? WARN : OK;

    return {
        overall,
        summary: overall === OK ? 'كل الأنظمة سليمة ✅'
            : overall === WARN ? `${warnings} تحذير — النظام يعمل`
            : `${critical} مشكلة حرجة تحتاج تدخلاً`,
        uptimeSec: Math.floor(process.uptime()),
        checks,
        checkedAt: Date.now(),
    };
}

// حدُّ ذاكرة العملية: الحاويةُ إن حدّت، وإلا ذاكرةُ المضيف.
// 🔴 كان المقامُ `os.totalmem()` — ذاكرةَ **المضيف** لا حدَّ الحاوية. وقياسٌ
//    فعليّ: العمليةُ ٧٩ MB من ١٦٠٧٥ MB، أي أنّ التحذير (٧٠٪) يلزمه ١١٢٥٣ MB
//    في عمليةٍ واحدة — وحاويةُ Render تقتلها عند ٥١٢. فالفحصُ الموضوعُ لالتقاط
//    ضغط الذاكرة كان عاجزاً عن الوقوع في المنصّة التي كُتب لها.
const CGROUP_MEM_PATHS = ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes'];

/**
 * القرارُ وحدَه، مفصولاً عن القرص كي يُختبَر: أيُّ حدٍّ يحكم، ومن أين؟
 * (لولا الفصلُ لبقي الإصلاحُ بلا حارسٍ على آلةٍ بلا حاوية — وقد ثبت ذلك:
 *  طفرةُ «المضيفُ دائماً» نجت أوّلَ مرّة حتى فُصل القرار.)
 */
export function resolveMemoryLimit(rawCandidates, hostMb) {
    for (const raw of rawCandidates || []) {
        if (raw === null || raw === undefined) continue;
        const t = String(raw).trim();
        if (!t || t === 'max') continue;                 // «بلا حدّ» في cgroup v2
        const mb = Math.round(Number(t) / (1024 * 1024));
        // القيمةُ الحارسة لـ«بلا حدّ» في v1 رقمٌ فلكيّ — تُرفض بمقارنتها بالمضيف
        if (Number.isFinite(mb) && mb > 0 && mb <= hostMb) return { mb, source: 'الحاوية' };
    }
    return { mb: hostMb, source: 'المضيف' };
}

function memoryLimitMb() {
    const hostMb = Math.round(os.totalmem() / (1024 * 1024));
    const raws = CGROUP_MEM_PATHS.map((f) => {
        try { return fs.readFileSync(f, 'utf8'); } catch { return null; }
    });
    return resolveMemoryLimit(raws, hostMb);
}

// المساحة الحرّة على القسم الحاوي للمسار (statfs متاحة في Node ≥ 18.15)
function diskFree(target) {
    try {
        const dir = fs.existsSync(target) ? target : path.dirname(target);
        const st = fs.statfsSync(dir);
        const totalGb = +(st.blocks * st.bsize / 1073741824).toFixed(1);
        const freeGb = +(st.bavail * st.bsize / 1073741824).toFixed(1);
        if (!Number.isFinite(totalGb) || totalGb <= 0) return null;
        return { totalGb, freeGb };
    } catch { return null; }
}

function countDir(dir) {
    try { return fs.readdirSync(dir).length; } catch { return 0; }
}

// نسخة نصية موجزة للبث في سجل الشات
export function formatDiagnostics(report) {
    const emoji = { ok: '✅', warn: '⚠️', critical: '❌' };
    const lines = [`🩺 تقرير صحة النظام — ${report.summary}`];
    for (const c of report.checks) {
        lines.push(`${emoji[c.status]} ${c.name}: ${c.detail}`);
        if (c.fix) lines.push(`   ↳ ${c.fix}`);
    }
    return lines.join('\n');
}

export default { runSystemDiagnostics, formatDiagnostics };
