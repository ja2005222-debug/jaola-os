// 🤖 AgentRuntime: منفّذ الوكيل الواحد بعد استخراجه من فريق الخلفية.
// يُختبر مباشرةً بـllm مُسجَّل — لا نموذج حيّ ولا فريق بعينه.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent, gatherCooperationInputs } from '../core/runtime/AgentRuntime.js';
import { compileSpecToPrompt, defineAgent } from '../core/runtime/AgentSpec.js';
import { teamPlan } from '../agents/backendTeam/backendTeam.js';
import { frontendTeamPlan } from '../agents/frontendTeam/index.js';

const SPEC = defineAgent({
    id: 'a1', role: 'مهندس', icon: '🔧', mission: 'ابنِ شيئاً',
    responsibilities: ['ابنِ'], inputs: ['هدف'], outputs: ['ملفات'],
    rules: ['التزم'], qualityStandards: ['نظيف'], cooperation: [],
    selfReview: ['راجع'], neverDo: ['لا تكذب'], dependsOn: ['dep1'],
});
const reply = obj => async () => JSON.stringify(obj);

test('التعاون يسمّي الدور من الخريطة الممرَّرة — لا من فريق افتراضي', () => {
    const artifacts = { dep1: { summary: 'أنجزتُ المخطط' } };
    const byId = { dep1: { id: 'dep1', role: 'مصمّم قواعد البيانات' } };
    const out = gatherCooperationInputs(SPEC, artifacts, byId);
    assert.match(out, /مصمّم قواعد البيانات/);
    assert.match(out, /أنجزتُ المخطط/);
    // اعتماديةٌ بلا مخرجات بعد → تُتخطّى بلا سطر فارغ
    assert.equal(gatherCooperationInputs(SPEC, {}, byId), '');
    // معرّفٌ غائب عن الخريطة → يُستعمل المعرّف نفسه، لا انهيار
    assert.match(gatherCooperationInputs(SPEC, artifacts, {}), /### مخرجات dep1:/);
});

test('runAgent يطهّر كل مسار عائد ويُسقط ما لا محتوى له', async () => {
    const res = await runAgent(SPEC, {
        goal: 'متجر', lang: 'ar', artifacts: {}, fileMap: {}, byId: {},
        llm: reply({
            summary: 'تمّ', selfReviewPassed: true, issues: [],
            files: [
                { path: 'api/users.js', kind: 'code', action: 'create', content: 'ok' },
                { path: '../escape.js', content: 'BAD' },          // هروب → يُرفض
                { path: 'a<b.js', content: 'BAD' },                // حرف ممنوع → يُرفض
                { path: 'empty.js', content: '' },                 // بلا محتوى → يُسقَط
                { path: '\\win\\style.js', content: 'ok' },        // يُوحَّد الفاصل
            ],
        }),
    });
    assert.deepEqual(res.files.map(f => f.path), ['api/users.js', 'win/style.js']);
    assert.equal(res.agent, 'a1');
    assert.equal(res.role, 'مهندس');
    assert.equal(res.selfReviewPassed, true);
    assert.deepEqual(res.artifacts, [{ name: 'api/users.js', kind: 'code' }, { name: 'win/style.js', kind: 'code' }]);
});

test('ردٌّ ليس JSON: لا يرمي — يُسجَّل كمشكلة ويسقط التقييم الذاتي', async () => {
    const res = await runAgent(SPEC, {
        goal: 'متجر', artifacts: {}, fileMap: {}, byId: {},
        llm: async () => 'اعتذر، لا أستطيع',
    });
    assert.equal(res.selfReviewPassed, false);
    assert.deepEqual(res.issues, ['رد غير صالح JSON']);
    assert.deepEqual(res.files, []);
    assert.match(res.summary, /اعتذر/);
});

test('المُعدِّل يرى الملفات الحالية، ووكيل الإصلاح يرى أخطاء QA المرتبطة به', async () => {
    let sentUser = null;
    const spy = async (messages) => { sentUser = messages[1].content; return JSON.stringify({ summary: 's', files: [] }); };
    const plain = await runAgent({ ...SPEC, dependsOn: [] }, {
        goal: 'g', artifacts: {}, fileMap: { 'x.js': { path: 'x.js', content: 'محتوى' } }, byId: {}, llm: spy,
    });
    assert.ok(plain);
    assert.ok(!sentUser.includes('الملفات الحالية'), 'غير المُعدِّل لا يُثقَل بها');

    await runAgent({ ...SPEC, dependsOn: [], modifier: true, debugFor: 'qa1' }, {
        goal: 'g', fileMap: { 'x.js': { path: 'x.js', content: 'محتوى' } }, byId: {}, llm: spy,
        artifacts: { qa1: { issues: ['اختبار ساقط'] } },
    });
    assert.match(sentUser, /الملفات الحالية/);
    assert.match(sentUser, /محتوى/);
    assert.match(sentUser, /أخطاء لإصلاحها/);
    assert.match(sentUser, /اختبار ساقط/);
});

test('🐛 خطة كل فريق من فريقه — لا من خريطة فريقٍ آخر', () => {
    // الفخّ المؤجَّل: كان TEAM_BY_ID (الخلفية) يُستشار أولاً حتى لخطة الواجهة
    const fe = frontendTeamPlan();
    assert.ok(fe.length > 0);
    for (const a of fe) assert.match(a.id, /^(frontend|component|uiux|accessibility)/, a.id);

    const custom = teamPlan([
        { id: 'backend-architect', role: 'دورٌ مختلف تماماً', icon: '🎨', mission: 'm', dependsOn: [], outputs: [] },
    ]);
    assert.equal(custom[0].role, 'دورٌ مختلف تماماً', 'الفريق الممرَّر هو المصدر لا الخريطة العامة');
});

test('🐛 عقدٌ ناقص يُقابَل برسالة العقد لا بانهيار غامض', () => {
    // كان `spec.id` وحده دليلَ التطبيع، فعقدٌ بـid وبلا cooperation ينهار
    // بـ«Cannot read properties of undefined» لا يذكر الحقل الناقص.
    assert.throws(
        () => compileSpecToPrompt({ id: 'half', role: 'ناقص', mission: 'm' }),
        /عقد الوكيل "half" غير صالح/,
    );
    // والعقد المُطبَّع يمرّ كما كان — التطبيع مُتساوي القوى
    assert.match(compileSpecToPrompt(SPEC), /أنت \*\*مهندس\*\*/);
});
