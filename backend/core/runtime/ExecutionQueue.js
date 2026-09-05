/**
 * 🚦 Mission Queue — صف تنفيذ المهام
 *
 * كانت المهام تنفذ فورياً بلا تنسيق: مستخدمان يبنيان معاً = تنافس على
 * حصة الـ LLM (rate limits) وذاكرة العملية. هذا الصف:
 *
 * - يمنع بنائين متوازيين لنفس المشروع (username:project)
 * - يحد التوازي الكلي عبر MAX_CONCURRENT_MISSIONS (افتراضي 2)
 * - يخبر المستخدم بمركزه في الصف بدل صمت الانتظار
 * - 🧾 سجلّ دائم (memory/mission_ledger.json): المهام الجارية/المنتظرة تُكتب
 *   على القرص، فعند إعادة تشغيل العملية لا تختفي بلا أثر — تُقرأ كـ«مهام
 *   ساقطة» ويُخبَر صاحبها في أول رسالة (كانت الحالة كلها في الذاكرة فتضيع صامتة).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_FILE = process.env.MISSION_LEDGER_PATH || path.join(__dirname, '../../memory/mission_ledger.json');

const waiting = [];               // المهام المنتظرة
let runningCount = 0;
const activeKeys = new Set();     // مشاريع قيد التنفيذ الآن
const inflight = new Map();       // key → { username, project, goal, roomName, state, enqueuedAt } (للسجلّ)
const lostMissions = new Map();   // key → ما تركته العملية السابقة بلا إكمال

function writeLedger() {
    try {
        fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
        fs.writeFileSync(LEDGER_FILE, JSON.stringify([...inflight.values()], null, 2));
    } catch (e) { console.warn('[MissionQueue] تعذّر كتابة سجلّ المهام:', e.message); }
}

// عند التحميل: كل ما بقي في السجلّ هو مهمة لم تُكمل — العملية السابقة ماتت فوقها
function restoreLedger() {
    try {
        if (!fs.existsSync(LEDGER_FILE)) return;
        const rows = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf-8') || '[]');
        for (const r of Array.isArray(rows) ? rows : []) noteLostMission(r);
        if (lostMissions.size) console.warn(`[MissionQueue] ${lostMissions.size} مهمة سقطت مع إعادة التشغيل السابقة — ستُبلَّغ لأصحابها.`);
        fs.writeFileSync(LEDGER_FILE, '[]');
    } catch (e) { console.warn('[MissionQueue] تعذّر قراءة سجلّ المهام:', e.message); }
}
/** تسجيل مهمة ساقطة (من السجلّ عند التحميل، أو من الاختبارات) */
export function noteLostMission(entry) {
    if (!entry?.username || !entry?.project) return false;
    lostMissions.set(`${entry.username}:${entry.project}`, entry);
    return true;
}
restoreLedger();

const MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT_MISSIONS) || 2);

function pump() {
    while (runningCount < MAX_CONCURRENT && waiting.length > 0) {
        // أول مهمة لمشروع غير نشط حالياً
        const idx = waiting.findIndex(j => !activeKeys.has(j.key));
        if (idx === -1) break;

        const job = waiting.splice(idx, 1)[0];
        runningCount++;
        activeKeys.add(job.key);
        const entry = inflight.get(job.key);
        if (entry) { entry.state = 'running'; entry.startedAt = Date.now(); writeLedger(); }

        Promise.resolve()
            .then(job.run)
            .catch(e => console.error(`[MissionQueue] مهمة ${job.key} انتهت بخطأ:`, e.message))
            .finally(() => {
                runningCount--;
                activeKeys.delete(job.key);
                inflight.delete(job.key);
                writeLedger();
                pump();
            });
    }
}

/**
 * إدراج مهمة — تنفذ فوراً إن توفرت سعة، وإلا تنتظر بدورها.
 * onWait(position) يُستدعى فقط عند الانتظار الفعلي.
 */
export function enqueueMission({ username, project, run, onWait, goal = '', roomName = '' }) {
    const key = `${username}:${project}`;

    // نفس المشروع يبني الآن؟ ارفض — الحماية من التوازي الذاتي
    if (activeKeys.has(key)) {
        return { accepted: false, reason: 'already_running' };
    }
    // نفس المشروع منتظر في الصف؟ لا تكدس طلبات مكررة
    if (waiting.some(j => j.key === key)) {
        return { accepted: false, reason: 'already_queued' };
    }

    const willWait = runningCount >= MAX_CONCURRENT;
    waiting.push({ key, run, enqueuedAt: Date.now() });
    inflight.set(key, { username, project, goal: String(goal || '').slice(0, 200), roomName, state: 'waiting', enqueuedAt: Date.now() });
    writeLedger();

    if (willWait && onWait) {
        onWait(waiting.length);
    }

    pump();
    return { accepted: true, waited: willWait };
}

/**
 * إلغاء مهمةٍ ما تزال منتظرةً في الصف (لم تبدأ بعد).
 *
 * 🔴 كان زرّ ⏹ يمرّ بـ`abortMission` وحدها، وهي لا ترى إلّا مهمةً بلغت
 *    `registerMission` داخل `_runMissionNow`. فالمهمة التي قال لها النظامُ
 *    للتوّ «⏳ مهمتك في الصف (المركز N)» يُجاب عنها «لا توجد مهمة نشطة»،
 *    ثمّ تبدأ وتُكمل. الصفُّ كان خارج مدى الزرّ كلَّه.
 *
 * @returns {boolean} أأُلغيت مهمةٌ منتظرة فعلاً؟
 */
export function cancelWaiting(username, project) {
    const key = `${username}:${project}`;
    const i = waiting.findIndex((j) => j.key === key);
    if (i === -1) return false;
    waiting.splice(i, 1);
    inflight.delete(key);
    writeLedger();
    return true;
}

export function queueStatus() {
    return { running: runningCount, waiting: waiting.length, maxConcurrent: MAX_CONCURRENT };
}

/**
 * هل يوجد بناء *فعلي* جارٍ لهذا المشروع الآن؟ (المصدر الحقيقي للحقيقة)
 * يعتمد على حالة العملية الحالية — يعود false بعد أي إعادة تشغيل/تعطّل،
 * بعكس حالة الآلة المُخزّنة التي قد تبقى عالقة عند GENERATING.
 */
export function isMissionActive(username, project) {
    const key = `${username}:${project}`;
    return activeKeys.has(key) || waiting.some(j => j.key === key);
}

/**
 * 🧾 مهمة سقطت مع إعادة تشغيل سابقة لهذا المشروع؟ تُؤخذ مرة واحدة (تُحذف)
 * — يستعملها jcr ليُخبر المستخدم بصدق بدل الصمت، ثم لا يكرّر الإشعار.
 */
export function takeLostMission(username, project) {
    const key = `${username}:${project}`;
    const lost = lostMissions.get(key) || null;
    if (lost) lostMissions.delete(key);
    return lost;
}

/** مسار السجلّ الفعلي (للاختبارات والتشخيص) */
export function ledgerPath() { return LEDGER_FILE; }

