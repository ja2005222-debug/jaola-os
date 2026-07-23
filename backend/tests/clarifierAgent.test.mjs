// 🚫 حوار الأسئلة (السؤال 1/5…) مُعطّل: كل طلب بناء يمضي مباشرةً للبناء.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsStrategicClarification, startClarification } from '../agents/clarifierAgent.js';

test('needsStrategicClarification: مُعطّل دائماً (لا حوار أسئلة)', () => {
    assert.equal(needsStrategicClarification('متجر عطور', 'ecommerce'), false);
    assert.equal(needsStrategicClarification('منصة', 'saas'), false);
    assert.equal(needsStrategicClarification('ابني موقع', 'ecommerce'), false);
    assert.equal(needsStrategicClarification('تطبيق مفصّل جداً بكلمات كثيرة هنا', 'app'), false);
});

test('startClarification: يعيد بناءً مباشراً لا حوار توضيح', async () => {
    const r = await startClarification('test_user_clarify', 'ابني متجر عطور فخم');
    assert.notEqual(r.type, 'clarification', 'لا حوار أسئلة');
    assert.equal(r.type, 'build_direct', 'بناء مباشر');
    assert.equal(r.readyToBuild, true);
});
