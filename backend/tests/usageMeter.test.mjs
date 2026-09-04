import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getUsageCount, bumpUsage, reserveUsage, releaseUsage } from '../services/usageMeter.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'usage-'));

test('العدّ يبدأ صفراً ويزيد بالوحدة', () => {
    const d = tmp();
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 0);
    assert.equal(bumpUsage(d, 'sara', 'aiImages'), 1);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 2 - 1);
});

test('العدّ لكل مستخدمٍ ولكل مقياسٍ على حدة', () => {
    const d = tmp();
    bumpUsage(d, 'sara', 'aiImages');
    assert.equal(getUsageCount(d, 'omar', 'aiImages'), 0);
    assert.equal(getUsageCount(d, 'sara', 'emails'), 0);
});

test('العدّ لكل شهرٍ على حدة', () => {
    const d = tmp();
    const jan = new Date('2026-01-15T00:00:00Z');
    const feb = new Date('2026-02-15T00:00:00Z');
    bumpUsage(d, 'sara', 'aiImages', jan);
    assert.equal(getUsageCount(d, 'sara', 'aiImages', feb), 0);
    assert.equal(getUsageCount(d, 'sara', 'aiImages', jan), 1);
});

// ═══════════════════════════════════════════════════════
// الحجز: يُؤخذ قبل العمل لا يُعدّ بعده
// ═══════════════════════════════════════════════════════

test('الحجز يمنح المطلوب ما دام في الحصة متّسع', () => {
    const d = tmp();
    assert.equal(reserveUsage(d, 'sara', 'aiImages', { limit: 6, want: 4 }), 4);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 4, 'الحجز لم يُقيَّد فوراً');
});

test('الحجز يُقصّ على ما بقي من الحصة', () => {
    const d = tmp();
    reserveUsage(d, 'sara', 'aiImages', { limit: 6, want: 4 });
    assert.equal(reserveUsage(d, 'sara', 'aiImages', { limit: 6, want: 8 }), 2);
    assert.equal(reserveUsage(d, 'sara', 'aiImages', { limit: 6, want: 8 }), 0, 'مُنح فوق الحصة');
});

test('خطةٌ بلا سقف تُمنح المطلوب كلَّه ويُعدّ استهلاكها', () => {
    const d = tmp();
    assert.equal(reserveUsage(d, 'sara', 'aiImages', { limit: Infinity, want: 8 }), 8);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 8);
});

test('ما حُجز ولم يُنفق يعود', () => {
    const d = tmp();
    const granted = reserveUsage(d, 'sara', 'aiImages', { limit: 6, want: 8 });
    assert.equal(granted, 6);
    releaseUsage(d, 'sara', 'aiImages', granted - 2);   // أُنفقت اثنتان
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 2);
    assert.equal(reserveUsage(d, 'sara', 'aiImages', { limit: 6, want: 8 }), 4, 'المتبقي لم يُستردّ');
});

test('الإفراج لا ينزل بالعدّ تحت الصفر', () => {
    const d = tmp();
    bumpUsage(d, 'sara', 'aiImages');
    releaseUsage(d, 'sara', 'aiImages', 99);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 0);
});

test('حجزُ صفرٍ لا يكتب شيئاً، والإفراجُ عن صفرٍ لا يغيّر', () => {
    const d = tmp();
    assert.equal(reserveUsage(d, 'sara', 'aiImages', { limit: 6, want: 0 }), 0);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 0);
    bumpUsage(d, 'sara', 'aiImages');
    releaseUsage(d, 'sara', 'aiImages', 0);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 1);
});

// ═══════════════════════════════════════════════════════
// العطب الذي دعا إلى الحجز: تدفّقان متزامنان ينفقان الحصة مرّتين.
// القفلُ في server.js بالمشروع، والحصةُ بالمستخدم — فمشروعان يفلتان.
// ═══════════════════════════════════════════════════════

const MONTHLY = 6, PER_CALL = 8;

// «اسأل ثم خُذ»: الصيغة القديمة — قراءةٌ، ثمّ عملٌ غير متزامن، ثمّ عدّ
async function askThenTake(dir, user, want) {
    const allowed = Math.max(0, MONTHLY - getUsageCount(dir, user, 'aiImages'));
    if (allowed === 0) return 0;
    const made = Math.min(want, allowed);
    await new Promise((r) => setTimeout(r, 5));            // نداءُ المزوّد
    for (let i = 0; i < made; i++) bumpUsage(dir, user, 'aiImages');
    return made;
}

// «خُذ ثم اعمل»: الصيغة الجديدة
async function takeThenWork(dir, user, want) {
    let reserved = 0, spent = 0;
    try {
        reserved = reserveUsage(dir, user, 'aiImages', { limit: MONTHLY, want: PER_CALL });
        if (reserved === 0) return 0;
        await new Promise((r) => setTimeout(r, 5));
        spent = Math.min(want, reserved);
        return spent;
    } finally { releaseUsage(dir, user, 'aiImages', reserved - spent); }
}

test('العدُّ بعد العمل: مشروعان متزامنان ينفقان الحصة مرّتين', async () => {
    const d = tmp();
    await Promise.all([askThenTake(d, 'sara', 6), askThenTake(d, 'sara', 6)]);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 12, 'العطب لم يُعَد إنتاجه — الاختبار لا يقيس شيئاً');
});

test('الحجزُ قبل العمل: ثلاثة تدفّقات متزامنة لا تتجاوز الحصة', async () => {
    const d = tmp();
    const made = await Promise.all([1, 2, 3].map(() => takeThenWork(d, 'sara', 6)));
    assert.equal(made.reduce((a, b) => a + b, 0), MONTHLY);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), MONTHLY);
});

test('الحجزُ يحجز المتّسع كلَّه، فيُردّ المتزامنُ معه — ولذلك يُسلسَل بالمستخدم', async () => {
    const d = tmp();
    // خاصّيةٌ تُقال صراحةً لا تُخفى: الحاجزُ يأخذ ما بقي كلَّه (want=8 > الحصة 6)،
    // فالثاني المتزامن يُمنع وإن لم يُنفق الأولُ إلا واحدة. ولهذا صار قفلُ
    // server.js بالمستخدم: يُسلسَل التوليد فلا يقع هذا التزامن أصلاً.
    const [a, b] = await Promise.all([takeThenWork(d, 'sara', 1), takeThenWork(d, 'sara', 1)]);
    assert.deepEqual([a, b].sort(), [0, 1]);
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 1, 'لم يُفرَج عمّا لم يُنفق');
});

test('بالتسلسل: ما أُفرج عنه يجده التالي', async () => {
    const d = tmp();
    assert.equal(await takeThenWork(d, 'sara', 1), 1);   // حجز 6، أنفق 1، أفرج 5
    assert.equal(getUsageCount(d, 'sara', 'aiImages'), 1);
    assert.equal(await takeThenWork(d, 'sara', 4), 4);   // وجد المتبقي
    assert.equal(await takeThenWork(d, 'sara', 4), 1);   // لم يبقَ إلا واحدة
    assert.equal(await takeThenWork(d, 'sara', 4), 0);   // نفدت فعلاً
});
