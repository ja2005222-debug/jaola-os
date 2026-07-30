/**
 * 📊 signalTrackRecord.js — سجل أداء حقيقي وشفّاف لإشارات مستشار الكريبتو:
 * كل إشارة شراء/بيع (لا "انتظار") تُسجَّل بسعرها ووقتها، وبعد أفق زمني
 * يناسب المدى (يوم للمدى اليومي، 5 أيام للأسبوعي، 21 يوماً لطويل المدى)
 * تُحسَم بمقارنة السعر الفعلي وقتها: نجحت (تحرّك السعر بالاتجاه المتوقَّع)
 * أو أخفقت أو محايدة (تحرّك ضئيل جداً لا يُحسَب اتجاهاً حقيقياً).
 *
 * سجل عام لكل (عملة، مدى) — لا لكل مشروع — لأن التحليل نفسه مشترك بين
 * كل المستخدمين (نفس فلسفة كاش cryptoMarket.js)، فالسجل التراكمي عبر كل
 * المستخدمين أدلّ إحصائياً من عيّنة صغيرة لكل مشروع على حدة.
 *
 * ملفّي بسيط (نفس فلسفة appData.js) — لا Mongo، فشل صامت دائماً.
 */
import fs from 'fs';
import path from 'path';

const HORIZON_MS = { day: 24 * 3600 * 1000, week: 5 * 86400 * 1000, long: 21 * 86400 * 1000 };
const NEUTRAL_THRESHOLD = 0.003; // تحرّك أقل من 0.3% يُحسب "محايداً" — ضجيج لا اتجاهاً حقيقياً
const MAX_RECORDS_PER_KEY = 200; // أحدث 200 تنبّؤ محفوظ لكل (عملة، مدى) — يمنع نمواً غير محدود

function storeFile(dir) { return path.join(dir, 'predictions.json'); }

function readAll(dir) {
    try {
        const v = JSON.parse(fs.readFileSync(storeFile(dir), 'utf8'));
        return Array.isArray(v) ? v : [];
    } catch { return []; }
}
function writeAll(dir, records) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storeFile(dir), JSON.stringify(records));
}

/** يسجّل إشارة جديدة إن اختلفت عن آخر إشارة غير محسومة لنفس (عملة، مدى) — لا تكرار عند كل تحديث كاش. */
export function recordSignal(dir, { id, timeframe, signal, price }) {
    if (!id || !timeframe || (signal !== 'buy' && signal !== 'sell') || price == null) return;
    const records = readAll(dir);
    let lastForKey = null;
    for (const r of records) if (r.id === id && r.timeframe === timeframe) lastForKey = r;
    if (lastForKey && !lastForKey.resolved && lastForKey.signal === signal) return; // نفس الإشارة قائمة أصلاً

    records.push({
        id, timeframe, signal, price,
        createdAt: Date.now(),
        resolveAt: Date.now() + (HORIZON_MS[timeframe] || HORIZON_MS.week),
        resolved: false, outcome: null, resolvedPrice: null,
    });

    const sameKeyIdx = [];
    records.forEach((r, i) => { if (r.id === id && r.timeframe === timeframe) sameKeyIdx.push(i); });
    if (sameKeyIdx.length > MAX_RECORDS_PER_KEY) {
        const dropCount = sameKeyIdx.length - MAX_RECORDS_PER_KEY;
        const dropIdx = new Set(sameKeyIdx.slice(0, dropCount));
        writeAll(dir, records.filter((_, i) => !dropIdx.has(i)));
        return;
    }
    writeAll(dir, records);
}

/** كل معرّفات العملات التي لديها تنبّؤ مستحق الحسم الآن — أساس نداء أسعار مُجمَّع واحد بدل نداء لكل تنبّؤ. */
export function getDueCoinIds(dir) {
    const now = Date.now();
    const ids = new Set();
    for (const r of readAll(dir)) if (!r.resolved && r.resolveAt <= now) ids.add(r.id);
    return [...ids];
}

/** يحسم كل التنبّؤات المستحقة بمقارنة السعر الحالي (priceById: {coinId: price}) — لا نداء شبكة هنا. */
export function resolveDue(dir, priceById) {
    const records = readAll(dir);
    const now = Date.now();
    let changed = false;
    for (const r of records) {
        if (r.resolved || r.resolveAt > now) continue;
        const cur = priceById?.[r.id];
        if (cur == null) continue;
        const pct = (cur - r.price) / r.price;
        r.resolved = true;
        r.resolvedPrice = cur;
        r.outcome = Math.abs(pct) < NEUTRAL_THRESHOLD
            ? 'neutral'
            : (((r.signal === 'buy' && pct > 0) || (r.signal === 'sell' && pct < 0)) ? 'hit' : 'miss');
        changed = true;
    }
    if (changed) writeAll(dir, records);
}

/** إحصاء الدقة — لعملة+مدى محدَّدين، أو لكل عملة ضمن مدى، أو للكل. neutral مُستبعَدة من hitRate (لا اتجاه حقيقي لتقييمه). */
export function getAccuracy(dir, { id, timeframe } = {}) {
    const records = readAll(dir).filter(r => r.resolved && (!id || r.id === id) && (!timeframe || r.timeframe === timeframe));
    const hits = records.filter(r => r.outcome === 'hit').length;
    const misses = records.filter(r => r.outcome === 'miss').length;
    const neutral = records.filter(r => r.outcome === 'neutral').length;
    const judged = hits + misses;
    return { hits, misses, neutral, total: records.length, hitRate: judged ? Math.round((hits / judged) * 1000) / 10 : null };
}

/** لإعادة الضبط بين الاختبارات فقط. */
export function resetTrackRecordForTest(dir) {
    try { fs.rmSync(storeFile(dir), { force: true }); } catch { /* لا شيء */ }
}
