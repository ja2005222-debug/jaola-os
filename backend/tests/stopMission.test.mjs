// ⏹️ زرُّ الإيقاف — يقول النظامُ للمستخدم «⏳ مهمتك في الصف (المركز N)»
// ثمّ يقول عن المهمة نفسِها «لا توجد مهمة نشطة»، وتبدأ وتُكمل.
//
// السببُ أنّ الزرّ كان يمرّ بـ`abortMission` وحدها، وهي لا ترى إلّا مهمةً
// بلغت `registerMission` داخل `_runMissionNow`. والصفُّ خارجَ مداها كلِّه.
import { test } from 'node:test';
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';
process.env.MISSION_LEDGER_PATH = path.join(os.tmpdir(), `jaola-ledger-${process.pid}.json`);

const { enqueueMission, isMissionActive, cancelWaiting, queueStatus } =
    await import('../core/runtime/ExecutionQueue.js');
const { registerMission, abortMission, clearMission, isAborted, stopMission, throwIfAborted } =
    await import('../core/runtime/AbortRegistry.js');

const room = (u, p) => `${u}-${p}`;
let n = 0;
const fresh = () => { n += 1; return [`u${n}`, `p${n}`]; };
/**
 * تُشغل كلَّ خانات التوازي بمهامٍّ معلَّقة، وتُعيد دالةَ تحرير.
 * بلا التحرير تبقى الخانات مشغولةً فتفسد الاختباراتُ التالية —
 * وهو ما أوقعني فيه أوّلَ مرّة: قِستُ «الصفّ» ظانّاً أنّي أقيس «بدأت».
 */
async function fillSlots() {
    const releases = [];
    for (let i = 0; i < queueStatus().maxConcurrent; i++) {
        const [bu, bp] = fresh();
        enqueueMission({ username: bu, project: bp, run: () => new Promise((r) => releases.push(r)) });
    }
    // `pump` يبدأ المهمة عبر `Promise.resolve().then(job.run)` — أي في دورةٍ
    // لاحقة. فجمعُ دوالّ التحرير قبل ذلك يعطي مصفوفةً فارغة (وقعتُ فيه).
    await tick();
    return async () => { releases.forEach((r) => r()); await tick(); };
}
const tick = () => new Promise((r) => setTimeout(r, 5));
const never = () => new Promise(() => {});

test('مهمةٌ مسجَّلةٌ تعمل: الزرّ يوقفها', () => {
    const [u, p] = fresh();
    registerMission(room(u, p));
    assert.strictEqual(stopMission(u, p, room(u, p)), 'aborted');
    assert.strictEqual(isAborted(room(u, p)), true);
    assert.throws(() => throwIfAborted(room(u, p)), /MISSION_ABORTED/);
    clearMission(room(u, p));
});

test('العطب: مهمةٌ في الصفّ كانت تُجاب بـ«لا توجد مهمة نشطة» ثمّ تبدأ', async () => {
    const release = await fillSlots();   // كلُّ الخانات مشغولة ⇒ التالية تنتظر
    const [u, p] = fresh();
    let started = false;
    const r = enqueueMission({ username: u, project: p, run: async () => { started = true; } });
    assert.strictEqual(r.waited, true, 'المهمة في الصفّ فعلاً');
    assert.strictEqual(isMissionActive(u, p), true, 'والنظام يعدّها نشطة');

    // القديم: abortMission وحدها لا ترى شيئاً
    assert.strictEqual(abortMission(room(u, p)), false);
    // الجديد: الزرّ يبلغ الصفّ
    assert.strictEqual(stopMission(u, p, room(u, p)), 'cancelled');
    assert.strictEqual(isMissionActive(u, p), false, 'لم تعد منتظرة');
    assert.strictEqual(started, false, 'ولن تبدأ');
    await release();
});

test('العطب: النافذة العمياء — بدأت ولم تبلغ registerMission بعد', async () => {
    const [u, p] = fresh();
    let signalAborted = null;
    let reached = false;
    const gate = { resolve: null };
    const held = new Promise((res) => { gate.resolve = res; });

    enqueueMission({
        username: u, project: p,
        run: async () => {
            await held;                       // نحن الآن داخل النافذة العمياء
            const sig = registerMission(room(u, p));
            reached = true;
            signalAborted = sig.aborted;
            clearMission(room(u, p));
        },
    });

    await tick();   // تُلتقط من الصفّ وتبدأ فعلاً
    // المهمةُ تعمل، ولا شيء مسجَّلٌ بعد
    assert.strictEqual(abortMission(room(u, p)), false, 'لا يجدها الزرُّ القديم');
    assert.strictEqual(isMissionActive(u, p), true, 'لكنّ الصفَّ يعرف أنّها تعمل');
    assert.strictEqual(cancelWaiting(u, p), false, 'وليست منتظرة — بل بدأت');

    assert.strictEqual(stopMission(u, p, room(u, p)), 'pending');

    gate.resolve();
    await tick();
    assert.strictEqual(reached, true, 'المهمة بلغت التسجيل');
    assert.strictEqual(signalAborted, true, 'ووجدت طلبَ الإيقاف بانتظارها');
});

test('لا مهمةَ أصلاً: الجواب «none» لا دعوى إيقاف', () => {
    const [u, p] = fresh();
    assert.strictEqual(stopMission(u, p, room(u, p)), 'none');
});

test('طلبٌ معلَّقٌ لم يُستهلَك يُمحى بالتنظيف، فلا يقتل الوافدَ التالي', async () => {
    const [u, p] = fresh();
    const gate = {};
    const held = new Promise((r) => { gate.go = r; });
    enqueueMission({
        username: u, project: p,
        run: async () => {
            await held;
            // المهمةُ تموت قبل أن تبلغ `registerMission` — فالطلبُ المعلَّق
            // يبقى مسلَّحاً، و`clearMission` في `finally` هو ما يجب أن يمحوه.
            try { throw new Error('سقطت قبل التسجيل'); }
            finally { clearMission(room(u, p)); }
        },
    });
    await tick();
    assert.strictEqual(stopMission(u, p, room(u, p)), 'pending', 'سُلّح طلبٌ معلَّق');
    gate.go();
    await tick();

    // وافدٌ جديدٌ تماماً على الغرفة نفسِها — لا علاقة له بالطلب الميّت
    const sig = registerMission(room(u, p));
    assert.strictEqual(sig.aborted, false, 'لم يقتله طلبٌ لمهمةٍ أخرى');
    clearMission(room(u, p));
});

test('إلغاءُ المنتظرة ثمّ تسجيلُ مهمةٍ جديدة: لا أثرَ متبقٍّ', async () => {
    const [u, p] = fresh();
    const release = await fillSlots();
    enqueueMission({ username: u, project: p, run: never });
    assert.strictEqual(stopMission(u, p, room(u, p)), 'cancelled');
    clearMission(room(u, p));                 // التنظيف يمحو أيَّ طلبٍ معلَّق

    const sig = registerMission(room(u, p));  // مهمةٌ جديدةٌ تماماً
    assert.strictEqual(sig.aborted, false, 'لم يُقتل الوافدُ الجديد');
    clearMission(room(u, p));
    await release();
});

test('الترتيب: المسجَّلةُ العاملة أوّلاً، فالصفّ، فالنافذة العمياء', () => {
    const [u, p] = fresh();
    registerMission(room(u, p));
    enqueueMission({ username: u, project: p, run: never });
    assert.strictEqual(stopMission(u, p, room(u, p)), 'aborted', 'العاملةُ المسجَّلة تتقدّم');
    clearMission(room(u, p));
});
