/**
 * 🔔 cryptoAlerts.js — فهرس ملفّي لقوائم متابعة مستشار الكريبتو (لكل
 * مشروع) + حالة آخر إخطار لكل عملة، يغذّي حلقة فحص دورية في server.js
 * ترسل بريداً عند رصد إشارة شراء/بيع قوية — لا تكرار مزعج لنفس الإشارة
 * (فجوة زمنية دنيا بين إخطارين لنفس العملة/الإشارة).
 *
 * ملفّي بسيط (نفس فلسفة appData.js/appAssets.js) — لا Mongo، فشل صامت.
 * التوكن/الفهرسة هنا لا تحمل بيانات حسّاسة (قائمة رموز عملات فقط).
 */
import fs from 'fs';
import path from 'path';

const MAX_WATCHLIST = 20;
const slug = (u, p) => `${String(u || '').replace(/[^a-zA-Z0-9_-]/g, '_')}__${String(p || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
const storePath = (dir, u, p) => path.join(dir, slug(u, p) + '.json');

function readEntry(dir, user, project) {
    try {
        const s = JSON.parse(fs.readFileSync(storePath(dir, user, project), 'utf8'));
        return (s && typeof s === 'object' && !Array.isArray(s)) ? s : null;
    } catch { return null; }
}

/** يحفظ/يحدّث قائمة متابعة مشروع — يدمج مع سجل التنبيهات السابق (لا يفقده). */
export function saveWatchlistIndex(dir, user, project, watchlist) {
    if (!Array.isArray(watchlist)) return;
    const prev = readEntry(dir, user, project) || {};
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project), JSON.stringify({
        user, project, watchlist: watchlist.slice(0, MAX_WATCHLIST), updatedAt: Date.now(), alerted: prev.alerted || {},
    }));
}

/** كل مشاريع مستشار الكريبتو المفهرَسة — أساس حلقة فحص الفرص الدورية. */
export function listWatchlistIndex(dir) {
    try {
        return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
            try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; }
        }).filter(Boolean);
    } catch { return []; }
}

/** يُسجّل أن المالك أُخطِر بإشارة عملة معيّنة الآن. */
export function markAlerted(dir, user, project, coinId, signal) {
    const entry = readEntry(dir, user, project);
    if (!entry) return;
    entry.alerted = entry.alerted || {};
    entry.alerted[coinId] = { signal, notifiedAt: Date.now() };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project), JSON.stringify(entry));
}

/** هل يستحق إخطار المالك الآن؟ إشارة تغيّرت، أو مضت فجوة زمنية كافية منذ آخر إخطار لنفس الإشارة. */
export function shouldAlert(entry, coinId, signal, minGapMs = 12 * 60 * 60 * 1000) {
    const prev = entry?.alerted?.[coinId];
    if (!prev) return true;
    if (prev.signal !== signal) return true;
    return (Date.now() - prev.notifiedAt) > minGapMs;
}
