import test from 'node:test';
import assert from 'node:assert/strict';
import { runBackendTeam } from '../agents/backendTeam/backendTeam.js';
import { runAgent } from '../core/runtime/AgentRuntime.js';
import { orderTasks } from '../core/runtime/TaskGraph.js';
import { routeMessage } from '../agents/router.js';
import { withMissionUsage, missionUsageSnapshot, noteUsage } from '../core/providers/llm.js';
import { summarizePerformance, apiPerformance } from '../services/metricsStore.js';
import { BACKEND_TEAM } from '../agents/backendTeam/specs.js';
const spec = id => ({ ...BACKEND_TEAM[0], id, role: id, dependsOn: [] });
const reply = { summary: 'done', files: [], issues: [], selfReviewPassed: true };

test('retry only failed task and block dependents after exhausted attempts', async () => {
    let calls = 0;
    const result = await runBackendTeam('test', { team: [spec('a'), { ...spec('b'), dependsOn: ['a'] }], llm: async () => { calls++; if (calls === 1) throw Error('temporary'); return reply; } });
    assert.equal(calls, 3); assert.equal(result.results[0].attempts, 2); assert.equal(result.results[1].attempts, 1);
    assert.equal(result.performance.retries, 1); assert.equal(result.performance.firstPass, false);
    calls = 0;
    const failed = await runBackendTeam('test', { team: [spec('a'), { ...spec('b'), dependsOn: ['a'] }], llm: async () => { calls++; throw Error('offline'); } });
    assert.equal(calls, 2); assert.equal(failed.results[1].reason, 'dependency-failed'); assert.equal(failed.files.length, 0);
    assert.throws(() => orderTasks([spec('a'), spec('a')]), /مكررة/);
});

test('modifier sees full file and cannot replace omitted files', async () => {
    const content = 'x'.repeat(5000) + 'END_OF_FILE';
    const opts = { goal: 'fix', lang: 'ar', artifacts: {}, byId: {}, fileMap: { 'app.js': { path: 'app.js', content } } };
    await runAgent({ ...spec('fix'), modifier: true }, { ...opts, llm: async messages => { assert.ok(messages[1].content.includes(content)); return reply; } });
    await assert.rejects(runAgent({ ...spec('fix'), modifier: true }, { ...opts, contextBudget: 30, llm: async () => ({ ...reply, files: [{ path: 'app.js', content: 'truncated' }] }) }), /محتواه الكامل/);
});

test('Arabic rebuild retains current identity and ambiguous destructive references ask', async () => {
    const wrong = async () => JSON.stringify({ action: 'build', instruction: 'شركة بناء', confidence: 99 });
    for (const message of ['أعد البناء', 'اعد البناء ..', 'ابنيه من جديد', 'ابنيهو من جديد']) {
        const r = await routeMessage(message, { hasProject: true, projectName: 'hotel' }, wrong);
        assert.equal(r.action, 'edit'); assert.match(r.instruction, /الحفاظ على نوعه/);
    }
    for (const message of ['احذف ده', 'امسح هذا', 'شيل دا', 'بدل القديم']) {
        assert.equal((await routeMessage(message, { hasProject: true }, wrong)).requiresClarification, true);
    }
    assert.equal((await routeMessage('اعد البناء', {}, wrong)).requiresClarification, true);
});

test('concurrent missions retain separate usage and missing evidence stays unknown', async () => {
    const results = await Promise.all([10, 25].map(total => withMissionUsage(async () => {
        await Promise.resolve(); noteUsage('test', { usage: { total_tokens: total } });
        await Promise.resolve(); return missionUsageSnapshot();
    })));
    assert.deepEqual(results.map(r => r.total), [10, 25]); assert.equal(missionUsageSnapshot(), null);
    const empty = summarizePerformance([]); assert.equal(empty.firstPassRate, null); assert.equal(empty.costUsd, null);
    const stats = summarizePerformance([{ success: true, durationSec: 4, firstPass: true }, { success: false, durationSec: 10, firstPass: false }]);
    assert.equal(stats.firstPassRate, 0.5); assert.equal(stats.durationP95Sec, 10);
    assert.deepEqual(apiPerformance([{ durationMs: 8, status: 200 }, { durationMs: 90, status: 503 }]), { samples: 2, p95Ms: 90, serverErrors: 1 });
});
