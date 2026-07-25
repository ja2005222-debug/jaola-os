/**
 * 📊 عدّاد الاستهلاك الشهري — ملفّي وصامد (بلا اعتماد على Mongo).
 *
 * يعدّ وحدات الاستهلاك المقيسة بالخطة (مثل رسائل ذكاء البوت الحيّ) لكل
 * مستخدم في مفتاح شهر YYYY-MM. الأشهر القديمة تُقصّ تلقائياً (يبقى ١٢).
 */

import fs from 'fs';
import path from 'path';

const KEEP_MONTHS = 12;

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const fileOf = (dir, user) => path.join(dir, String(user || '').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');

function readAll(dir, user) {
    try { return JSON.parse(fs.readFileSync(fileOf(dir, user), 'utf8')) || {}; }
    catch { return {}; }
}

/** استهلاك metric لهذا الشهر. */
export function getUsageCount(dir, user, metric, now = new Date()) {
    const all = readAll(dir, user);
    return Number(all?.[metric]?.[monthKey(now)]) || 0;
}

/** يزيد استهلاك metric لهذا الشهر ويعيد العدّ الجديد. */
export function bumpUsage(dir, user, metric, now = new Date()) {
    const all = readAll(dir, user);
    const m = all[metric] && typeof all[metric] === 'object' ? all[metric] : {};
    const k = monthKey(now);
    m[k] = (Number(m[k]) || 0) + 1;
    const months = Object.keys(m).sort();
    while (months.length > KEEP_MONTHS) delete m[months.shift()];
    all[metric] = m;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fileOf(dir, user), JSON.stringify(all));
    return m[k];
}
