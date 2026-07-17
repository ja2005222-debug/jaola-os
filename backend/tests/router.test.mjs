// 🧭 الموجّه الموحّد (#65): حواجزه فوق مخرجات الـ LLM هي خط الدفاع —
// سؤال لا يُنفَّذ أبداً، ثقة منخفضة → محادثة، كل فشل → null (احتياط).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeMessage } from '../agents/router.js';

const mock = (json) => async () => JSON.stringify(json);
const CTX = { projectName: 'naya-taxi', hasProject: true, lastAssistant: 'صفحة السائق وصفحة العميل' };

test('قرار edit سليم يمرّ بتعليمته', async () => {
    const r = await routeMessage('غير الالوان', CTX, mock({ action: 'edit', instruction: 'غيّر الألوان إلى أزرق', confidence: 95 }));
    assert.equal(r.action, 'edit');
    assert.match(r.instruction, /أزرق/);
});

test('حاجز: سؤال + قرار edit → chat قسراً', async () => {
    const r = await routeMessage('ماذا يمكن ان نضيف للمشروع؟', CTX, mock({ action: 'edit', instruction: 'x', confidence: 95 }));
    assert.equal(r.action, 'chat');
});

test('حاجز: سؤال + delete_project → chat', async () => {
    const r = await routeMessage('هل تستطيع مسح المشروع؟', CTX, mock({ action: 'delete_project', instruction: '', confidence: 95 }));
    assert.equal(r.action, 'chat');
});

test('حاجز: ثقة منخفضة → chat آمن', async () => {
    const r = await routeMessage('شي غريب', CTX, mock({ action: 'edit', instruction: '؟', confidence: 40 }));
    assert.equal(r.action, 'chat');
});

test('حاجز: edit بلا مشروع قائم → build', async () => {
    const r = await routeMessage('اضف صفحة', { ...CTX, hasProject: false }, mock({ action: 'edit', instruction: 'اضف صفحة', confidence: 90 }));
    assert.equal(r.action, 'build');
});

test('JSON فاسد → null (يسقط المستدعي للمسار القديم)', async () => {
    assert.equal(await routeMessage('اي شيء', CTX, async () => 'ليس json'), null);
});

test('فعل غير معروف → null', async () => {
    assert.equal(await routeMessage('اي شيء', CTX, mock({ action: 'fly_to_moon', confidence: 99 })), null);
});

test('استثناء من الـ LLM → null بلا انهيار', async () => {
    assert.equal(await routeMessage('اي شيء', CTX, async () => { throw new Error('timeout'); }), null);
});

test('stop يمرّ', async () => {
    const r = await routeMessage('توقف', CTX, mock({ action: 'stop', instruction: '', confidence: 95 }));
    assert.equal(r.action, 'stop');
});

test('الثقة تُقص إلى [0,100]', async () => {
    const r = await routeMessage('غير الخط', CTX, mock({ action: 'edit', instruction: 'غير الخط', confidence: 250 }));
    assert.equal(r.confidence, 100);
});
