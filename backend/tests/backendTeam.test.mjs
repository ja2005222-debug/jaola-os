// 👥 فريق الخلفية — صدق التقرير حين لا يُنجز أحد (مزوّد غائب/أعطال)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runBackendTeam } from '../agents/backendTeam/index.js';
import { syntaxCheckFiles } from '../agents/backendTeam/backendVerify.js';

test('كل الوكلاء يرمون → mode execute بصفر ملفات، لا فحص (verification=null) ولا حدث verify_done، والملخّص بلا «فحص: نجح»', async () => {
    const events = [];
    const team = await runBackendTeam('تطبيق توصيل', {
        lang: 'ar', verify: true,
        llm: async () => { throw new Error('لا مزوّد'); },
        onEvent: (e) => events.push(e.type),
    });
    assert.equal(team.mode, 'execute');
    assert.equal(team.files.length, 0);
    assert.equal(team.verification, null);
    assert.ok(!events.includes('verify_done'), events.join(','));
    assert.ok(!events.includes('verify_failed'));
    assert.ok(events.filter(t => t === 'agent_error').length >= 1);
    assert.doesNotMatch(team.summary, /فحص/);
    assert.match(team.summary, /0 ملف/);
});

test('بلا llm → وضع الخطة فقط (لا تنفيذ ولا فحص)', async () => {
    const team = await runBackendTeam('متجر', {});
    assert.equal(team.mode, 'plan');
    assert.ok(Array.isArray(team.order) && team.order.length > 0);
});

test('syntaxCheckFiles على قائمة فارغة: ok=true لكن checked=0 — لهذا لا يُستدعى أصلاً بلا ملفات', async () => {
    const r = await syntaxCheckFiles([]);
    assert.deepEqual(r, { ok: true, checked: 0, failures: [] });
});
