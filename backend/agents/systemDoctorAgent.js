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
import { queueStatus } from '../services/missionQueue.js';
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
    const totalMb = Math.round(os.totalmem() / (1024 * 1024));
    checks.push(check(
        'الذاكرة (RAM)',
        rssMb > totalMb * 0.85 ? CRIT : rssMb > totalMb * 0.7 ? WARN : OK,
        `المستخدَم: ${rssMb} MB من ${totalMb} MB`,
        rssMb > totalMb * 0.7 ? 'استهلاك مرتفع — راقب تسريبات الذاكرة أو ارفع خطة الاستضافة.' : null
    ));

    // ── القرص (مساحة الـ workspace) ──
    try {
        const wsPath = path.resolve(__dirname, '../../workspace');
        const exists = fs.existsSync(wsPath);
        checks.push(check(
            'مساحة العمل (workspace)',
            OK,
            exists ? `موجودة (${countDir(wsPath)} عنصر)` : 'ستُنشأ عند أول مشروع',
        ));
    } catch (e) {
        checks.push(check('مساحة العمل', WARN, `تعذّر الفحص: ${e.message}`));
    }

    // ── الإضافات ──
    if (orchestrator.initialized) {
        const st = orchestrator.status();
        checks.push(check(
            'نظام الإضافات',
            st.errors.length ? WARN : OK,
            `محمّلة: ${st.count} | وكلاء مسجّلون: ${st.registeredAgents.length}${st.errors.length ? ` | أخطاء: ${st.errors.length}` : ''}`,
            st.errors.length ? `راجع الإضافات المعطوبة: ${st.errors.map(e => e.error).join(' ؛ ').slice(0, 200)}` : null
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
