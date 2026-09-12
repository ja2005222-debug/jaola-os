/**
 * 📊 Metrics Store — ذكاء الأعمال الحقيقي
 *
 * كانت لوحة Intelligence تعرض أرقاماً ثابتة وهمية بينما الوكلاء
 * (Security/Review/SEO) يخرجون درجات فعلية تضيع في السجل.
 * هذا المخزن يجمعها لكل مشروع، دائم عبر طبقة persistence،
 * ويُبث للواجهة كحدث project_metrics.
 */

import os from 'os';
import { missionUsageSnapshot } from '../core/providers/llm.js';
import { persistEntry, removeEntry, hydrateStore, onMongoReady } from './persistence.js';

const metricsCache = new Map(); // `${username}:${project}` → metrics

function createMetrics() {
    return {
        seo: null,        // { grade, score, at }
        security: null,   // { grade, score, at }
        quality: null,    // { grade, score, at }
        totalBuilds: 0,
        totalEdits: 0,
        builds: [],       // آخر 15 بناء: { at, success, durationSec, filesCount, goal }
        updatedAt: Date.now(),
    };
}

const getKey = (u, p) => `${u}:${p}`;

export function getMetrics(username, project) {
    const key = getKey(username, project);
    if (!metricsCache.has(key)) metricsCache.set(key, createMetrics());
    return metricsCache.get(key);
}

function save(username, project) {
    const key = getKey(username, project);
    const m = metricsCache.get(key);
    if (m) {
        m.updatedAt = Date.now();
        persistEntry('projectMetrics', key, m);
    }
}

// kind: 'seo' | 'security' | 'quality'
export function recordScore(username, project, kind, { grade, score }) {
    const m = getMetrics(username, project);
    m[kind] = { grade: grade ?? null, score: score ?? null, at: Date.now() };
    save(username, project);
}

export function recordBuild(username, project, { success, durationSec = 0, filesCount = 0, goal = '', repairRounds = null, firstPass = null }) {
    const m = getMetrics(username, project);
    m.totalBuilds += 1;
    m.builds.unshift({
        at: Date.now(),
        success: !!success,
        durationSec,
        filesCount,
        usage: missionUsageSnapshot(),
        repairRounds,
        firstPass: typeof firstPass === 'boolean' ? firstPass : null,
        goal: goal.slice(0, 80),
    });
    m.builds = m.builds.slice(0, 15);
    save(username, project);
}

export function recordEditAction(username, project) {
    const m = getMetrics(username, project);
    m.totalEdits += 1;
    save(username, project);
}

/**
 * 🔴 درجةٌ قيست قبل آخر بناءٍ تصف كوداً لم يعد موجوداً.
 *
 * `recordScore` يُستدعى داخل `try` في jcr.js، ووكيلُ SEO يُخطَّى بصمت
 * («⚠️ تخطّي») إن أخفق أو لم يُنتج ملفات. فيبقى البناءُ الأوّل معروضاً
 * درجةً للبناء الثاني — ولوحةٌ عنوانُها «صحّة الموقع» تُفتي في موقعٍ
 * لم تفحصه. الطابعُ `at` كان يُرسَل ولا يقرؤه أحد؛ فصار الحكمُ يُشتقّ
 * هنا من بيانات موجودة أصلاً بدل أن يُترك لكلِّ مستهلكٍ يستنتجه.
 */
function withAge(score, lastBuildAt) {
    if (!score) return null;
    return { ...score, stale: !!lastBuildAt && (score.at || 0) < lastBuildAt };
}

/** محوُ مقاييس مشروعٍ حُذف — وإلّا ورثها مشروعٌ جديد بالاسم نفسه. */
export async function clearMetrics(username, project) {
    const key = getKey(username, project);
    const existed = metricsCache.delete(key);
    const removed = await removeEntry('projectMetrics', key);
    return { existed, removed };
}

// الحمولة الكاملة المُرسلة للواجهة (درجات المشروع + مؤشرات النظام الحقيقية)
export function buildMetricsPayload(username, project) {
    const m = getMetrics(username, project);
    const cores = os.cpus()?.length || 1;
    const lastBuildAt = m.builds[0]?.at || 0;
    return {
        seo: withAge(m.seo, lastBuildAt),
        security: withAge(m.security, lastBuildAt),
        quality: withAge(m.quality, lastBuildAt),
        totalBuilds: m.totalBuilds,
        totalEdits: m.totalEdits,
        lastBuild: m.builds[0] || null,
        builds: m.builds,
        performance: summarizePerformance(m.builds),
        apiPerformance: apiPerformance(m.apiSamples),
        system: {
            rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
            cpuPct: Math.min(100, Math.round((os.loadavg()[0] / cores) * 100)),
            uptimeSec: Math.floor(process.uptime()),
        },
    };
}

export function recordApiSample(username, project, sample) {
    const m = getMetrics(username, project);
    m.apiSamples = [...(m.apiSamples || []), { route: sample.route, durationMs: Math.max(0, sample.durationMs), status: sample.status }].slice(-100);
    // Ephemeral request window; avoid a database write for every request.
}

export function apiPerformance(samples = []) {
    const times = samples.map(s => s.durationMs).sort((a, b) => a - b);
    return { samples: times.length, p95Ms: times.length ? times[Math.ceil(times.length * 0.95) - 1] : null,
        serverErrors: samples.filter(s => s.status >= 500).length };
}

/** Observed window only; missing usage and repair evidence are not invented. */
export function summarizePerformance(builds) {
    const durations = builds.map(b => b.durationSec).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
    const known = builds.filter(b => typeof b.firstPass === 'boolean');
    return {
        windowSize: builds.length,
        successRate: builds.length ? builds.filter(b => b.success).length / builds.length : null,
        firstPassSamples: known.length,
        firstPassRate: known.length ? known.filter(b => b.firstPass).length / known.length : null,
        durationP50Sec: durations.length ? durations[Math.ceil(durations.length * 0.5) - 1] : null,
        durationP95Sec: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null,
        observedTokens: builds.reduce((n, b) => n + (b.usage?.total || 0), 0),
        uncountedCalls: builds.reduce((n, b) => n + Math.max(0, (b.usage?.calls || 0) - (b.usage?.counted || 0)), 0),
        costUsd: null,
    };
}

// 💾 استرجاع المقاييس الدائمة عند توفر Mongo
onMongoReady(() => hydrateStore('projectMetrics', (key, value) => {
    const current = metricsCache.get(key);
    if (!current || (value?.updatedAt || 0) > (current.updatedAt || 0)) {
        metricsCache.set(key, value);
    }
}));
