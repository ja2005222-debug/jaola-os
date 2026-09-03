// 📐 عقود المرحلة الأولى — الجزء التشغيلي منها فقط (assertBuildAgents).
// التصميم الكامل بالأدلة في backend/CONTRACTS.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BUILD_AGENTS_REQUIRED, BUILD_AGENTS_OPTIONAL, missingBuildAgents, assertBuildAgents,
} from '../agents/contracts.js';

const full = { coreGenerateCodePlan: async () => ({}), architectReview: () => ({}), qaVerify: () => ({}) };

test('الحزمة الكاملة تجتاز، والإلزامية ثلاثة بالضبط ولا تتقاطع مع الاختيارية', () => {
    assert.deepEqual(missingBuildAgents(full), []);
    assert.doesNotThrow(() => assertBuildAgents(full));
    assert.deepEqual([...BUILD_AGENTS_REQUIRED], ['coreGenerateCodePlan', 'architectReview', 'qaVerify']);
    for (const k of BUILD_AGENTS_REQUIRED) assert.ok(!BUILD_AGENTS_OPTIONAL.includes(k), k);
});

test('عضو غائب أو غير دالة → يُسمّى بالاسم في الخطأ مع contract=Agent', () => {
    assert.deepEqual(missingBuildAgents({ ...full, qaVerify: undefined }), ['qaVerify']);
    assert.deepEqual(missingBuildAgents({ ...full, architectReview: 'nope' }), ['architectReview']);
    assert.deepEqual(missingBuildAgents(null), [...BUILD_AGENTS_REQUIRED]);
    assert.throws(() => assertBuildAgents({ architectReview: () => ({}) }), (e) => {
        assert.equal(e.contract, 'Agent');
        assert.deepEqual(e.missing, ['coreGenerateCodePlan', 'qaVerify']);
        assert.match(e.message, /coreGenerateCodePlan, qaVerify/);
        return true;
    });
});
