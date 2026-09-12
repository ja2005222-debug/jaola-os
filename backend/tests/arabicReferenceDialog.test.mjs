import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rememberReference, resumeReference } from '../agents/arabicReferenceDialog.js';
import { getBuildDecision, updateBuildDecision } from '../agents/projectMemory.js';
import { routeMessage } from '../agents/router.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
divertConsoleToStderr();

function harness() {
    const ctx = { username: `ref-${randomUUID()}`, activeProject: 'one', roomName: 'room' };
    const replies = [], edits = [];
    return { ctx, replies, edits, reporter: { send: (_, __, payload) => replies.push(payload.message) },
        edit: (goal, context) => edits.push({ goal, context }) };
}
test('answer preserves original constraints and cannot cross project or user boundaries', async () => {
    const h = harness();
    rememberReference(h.ctx.username, 'one', 'عدّل الثانية بدون حذف البيانات', 'أي صفحة؟');
    const resolve = async (answer, context) => {
        assert.equal(context.reference.original, 'عدّل الثانية بدون حذف البيانات');
        assert.equal(answer, 'صفحة العملاء');
        return { action: 'edit', instruction: 'عدّل صفحة العملاء', confidence: 90 };
    };
    assert.equal(await resumeReference('صفحة العملاء', { ...h.ctx, activeProject: 'two' }, h.reporter, h.edit, resolve), false);
    assert.equal(await resumeReference('صفحة العملاء', { ...h.ctx, username: 'different' }, h.reporter, h.edit, resolve), false);
    assert.equal(await resumeReference('صفحة العملاء', h.ctx, h.reporter, h.edit, resolve), true);
    assert.equal(h.edits.length, 1);
    assert.ok(h.edits[0].goal.includes('بدون حذف البيانات'));
    assert.equal(getBuildDecision(h.ctx.username, 'one').reference, null);
});
test('bare consent and model failure never guess an unresolved target', async () => {
    const h = harness();
    rememberReference(h.ctx.username, 'one', 'شيل ده', 'أي عنصر؟');
    await resumeReference('نعم', h.ctx, h.reporter, h.edit, () => { throw Error('must not call'); });
    await resumeReference('الزر', h.ctx, h.reporter, h.edit, async () => { throw Error('provider unavailable'); });
    assert.equal(h.edits.length, 0);
    assert.ok(getBuildDecision(h.ctx.username, 'one').reference);
});
test('cancellation wins over an in-flight answer', async () => {
    const h = harness();
    rememberReference(h.ctx.username, 'one', 'عدّل ده', 'أي عنصر؟');
    let finish;
    const pending = resumeReference('الهيدر', h.ctx, h.reporter, h.edit, () => new Promise(resolve => { finish = resolve; }));
    await resumeReference('إلغاء', h.ctx, h.reporter, h.edit);
    finish({ action: 'edit', instruction: 'عدّل الهيدر', confidence: 90 });
    await pending;
    assert.equal(h.edits.length, 0);
});
test('concurrent answers launch at most one edit in this process', async () => {
    const h = harness();
    rememberReference(h.ctx.username, 'one', 'عدّل ده', 'أي عنصر؟');
    const resolve = async () => ({ action: 'edit', instruction: 'عدّل الهيدر', confidence: 90 });
    await Promise.all([1, 2].map(() => resumeReference('الهيدر', h.ctx, h.reporter, h.edit, resolve)));
    assert.equal(h.edits.length, 1);
});
test('expired references never execute', async () => {
    const h = harness();
    const ref = rememberReference(h.ctx.username, 'one', 'عدّل ده', 'أي عنصر؟');
    updateBuildDecision(h.ctx.username, 'one', { reference: { ...ref, createdAt: 0 } });
    await resumeReference('الهيدر', h.ctx, h.reporter, h.edit, () => { throw Error('must not call'); });
    assert.equal(h.edits.length, 0);
});
test('successive clarification retains earlier answers and replaces the active question', async () => {
    const h = harness();
    rememberReference(h.ctx.username, 'one', 'عدّل ده بدون تغيير اللون', 'أي صفحة؟');
    await resumeReference('صفحة العملاء', h.ctx, h.reporter, h.edit, async () => ({
        action: 'chat', requiresClarification: true, question: 'أي زر في صفحة العملاء؟',
    }));
    const pending = getBuildDecision(h.ctx.username, 'one').reference;
    assert.equal(pending.question, 'أي زر في صفحة العملاء؟');
    assert.equal(pending.answers[0].answer, 'صفحة العملاء');
    await resumeReference('زر الحفظ', h.ctx, h.reporter, h.edit, async () => ({
        action: 'edit', instruction: 'عدّل زر الحفظ', confidence: 90,
    }));
    assert.ok(h.edits[0].goal.includes('صفحة العملاء'));
    assert.ok(h.edits[0].goal.includes('بدون تغيير اللون'));
});
test('router receives the old request separately from the current answer', async () => {
    await routeMessage('زر الحفظ', { hasProject: true, reference: { original: 'عدّل ده', question: 'أي عنصر؟' } }, async messages => {
        assert.ok(messages[1].content.includes('عدّل ده'));
        assert.ok(messages[1].content.includes('زر الحفظ'));
        return JSON.stringify({ action: 'edit', instruction: 'عدّل زر الحفظ', confidence: 90 });
    });
});
