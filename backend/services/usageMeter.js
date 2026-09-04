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

// يضيف delta (سالباً أو موجباً) ويكتب — قراءةٌ فتعديلٌ فكتابةٌ **متزامنة
// كلُّها**، بلا await بينها، فلا يتخلّلها تدفّقٌ آخر في هذه العملية.
function addUsage(dir, user, metric, delta, now) {
    const all = readAll(dir, user);
    const m = all[metric] && typeof all[metric] === 'object' ? all[metric] : {};
    const k = monthKey(now);
    m[k] = Math.max(0, (Number(m[k]) || 0) + delta);
    const months = Object.keys(m).sort();
    while (months.length > KEEP_MONTHS) delete m[months.shift()];
    all[metric] = m;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fileOf(dir, user), JSON.stringify(all));
    return m[k];
}

/** يزيد استهلاك metric لهذا الشهر ويعيد العدّ الجديد. */
export function bumpUsage(dir, user, metric, now = new Date()) {
    return addUsage(dir, user, metric, 1, now);
}

/**
 * 🎟️ حجزٌ مُسبَق — الفرق بين «اسأل ثم خُذ» و«خُذ ثم اعمل».
 *
 * العدُّ **بعد** العمل يترك فجوةً بين السؤال والأخذ: تدفّقان متزامنان
 * يقرآن العدّ نفسه فيظنّ كلٌّ منهما أن كامل المتبقي له. وحين يكون العمل
 * نداءً مدفوعاً لمزوّد (صورةً صورةً) فالفجوة تُنفَق مالاً.
 *
 * `reserveUsage` يقرأ ويحجز ويكتب **في نَفَسٍ واحدٍ متزامن**، فيعود بما
 * مُنح فعلاً. ما لم يُستهلك منه يُعاد بـ`releaseUsage`.
 *
 * 📌 حدُّه: هذه العملية وحدها. المخزن ملفٌّ على قرصٍ محلّي، فنُسختان من
 *    الخادم على قرصَين مختلفَين تعدّان كلٌّ لنفسها — وذلك قائمٌ سلفاً في
 *    كل استعمالات هذا العدّاد، لا يزيده الحجز ولا ينقصه.
 *
 * @returns {number} عدد الوحدات الممنوحة (0 يعني: لا متّسع).
 */
export function reserveUsage(dir, user, metric, { limit = Infinity, want = 1 } = {}, now = new Date()) {
    const wanted = Math.max(0, Math.floor(Number(want) || 0));
    if (wanted === 0) return 0;
    const used = getUsageCount(dir, user, metric, now);
    const room = Number.isFinite(limit) ? Math.max(0, limit - used) : Infinity;
    const granted = Math.min(wanted, room);
    if (granted > 0) addUsage(dir, user, metric, granted, now);
    return granted;
}

/** يعيد وحداتٍ محجوزةً لم تُستهلك. لا ينزل بالعدّ تحت الصفر. */
export function releaseUsage(dir, user, metric, count, now = new Date()) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    if (n === 0) return getUsageCount(dir, user, metric, now);
    return addUsage(dir, user, metric, -n, now);
}
