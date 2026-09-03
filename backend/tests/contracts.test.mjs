// 📐 عقود المرحلة الأولى — الجزء التشغيلي منها فقط (assertBuildAgents).
// التصميم الكامل بالأدلة في backend/CONTRACTS.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BUILD_AGENTS_REQUIRED, BUILD_AGENTS_OPTIONAL, missingBuildAgents, assertBuildAgents,
} from '../core/contracts/index.js';

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

test('عقد Task: DELIVERY_STAGES قائمة مسمّاة مرتّبة، كل مرحلة دالة حقيقية على النواة بالترتيب الحرفي السابق', async () => {
    const { DELIVERY_STAGES } = await import('../core/contracts/index.js');
    const { JaolaCognitiveRuntime } = await import('../agents/jcr.js');
    assert.equal(DELIVERY_STAGES.length, 15);
    assert.deepEqual(DELIVERY_STAGES.map(s => s.run), [
        '_stageGuardAndWrite', '_stageReview', '_stageRefactor', '_stageTesting', '_stageRequirementsVerify',
        '_stageExecutiveMemory', '_stageSEO', '_stageSecurity', '_stageGitBackup', '_stageProjectMemory',
        '_stageBackend', '_stageAdvancedModules', '_stageFullStackScaffold', '_stageRenderConfig', '_stageBehaviorVerify',
    ]);
    for (const s of DELIVERY_STAGES) {
        assert.equal(typeof JaolaCognitiveRuntime.prototype[s.run], 'function', s.run);
        assert.match(s.name, /^[a-z][a-z0-9-]*$/, s.name);
        assert.equal(s.optional, true);
    }
    assert.equal(new Set(DELIVERY_STAGES.map(s => s.name)).size, 15);
    assert.ok(Object.isFrozen(DELIVERY_STAGES) && Object.isFrozen(DELIVERY_STAGES[0]));
});
