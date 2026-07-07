/**
 * 📊 Metrics Store — ذكاء الأعمال الحقيقي
 *
 * كانت لوحة Intelligence تعرض أرقاماً ثابتة وهمية بينما الوكلاء
 * (Security/Review/SEO) يخرجون درجات فعلية تضيع في السجل.
 * هذا المخزن يجمعها لكل مشروع، دائم عبر طبقة persistence،
 * ويُبث للواجهة كحدث project_metrics.
 */

import os from 'os';
import { persistEntry, hydrateStore, onMongoReady } from './persistence.js';

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

export function recordBuild(username, project, { success, durationSec = 0, filesCount = 0, goal = '' }) {
    const m = getMetrics(username, project);
    m.totalBuilds += 1;
    m.builds.unshift({
        at: Date.now(),
        success: !!success,
        durationSec,
        filesCount,
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

// الحمولة الكاملة المُرسلة للواجهة (درجات المشروع + مؤشرات النظام الحقيقية)
export function buildMetricsPayload(username, project) {
    const m = getMetrics(username, project);
    const cores = os.cpus()?.length || 1;
    return {
        seo: m.seo,
        security: m.security,
        quality: m.quality,
        totalBuilds: m.totalBuilds,
        totalEdits: m.totalEdits,
        lastBuild: m.builds[0] || null,
        builds: m.builds,
        system: {
            rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
            cpuPct: Math.min(100, Math.round((os.loadavg()[0] / cores) * 100)),
            uptimeSec: Math.floor(process.uptime()),
        },
    };
}

// 💾 استرجاع المقاييس الدائمة عند توفر Mongo
onMongoReady(() => hydrateStore('projectMetrics', (key, value) => {
    const current = metricsCache.get(key);
    if (!current || (value?.updatedAt || 0) > (current.updatedAt || 0)) {
        metricsCache.set(key, value);
    }
}));
