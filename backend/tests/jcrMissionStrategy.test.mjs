// 🧠 شبكة الأمان الثالثة لـ jcr.js — اختيار استراتيجية البناء في _runMissionNow
// (ARCHITECTURE_MIGRATION.md، القرار 3-ب). أربعة مسارات وحمايات الاستئناف:
//   Registry (صفحة تسويقية من بلوكات) · Clone (تطبيق عامل مطابق) ·
//   React/Next (مشروع كبير جديد) · Vanilla (النواة: runDynamicMultiAgentRuntime)
// الاستراتيجيات الأربع تُستبدل بمسجِّلات — فالمُثبَّت هو *قرار الاختيار* نفسه
// بمدخلاته الحقيقية (نصّ الهدف، حالة المجلد على القرص، التحقّق الساكن)، بلا LLM:
// المخطّط ونموذج المجال يسقطان فوراً إلى احتياطهما الحتمي لغياب المزوّد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionContext } from '../core/runtime/ExecutionContext.js';
import { scenario, tempProject, workingProject, emptyProject } from './helpers/jcrScenario.mjs';
import { getProjectState, STATES, isBuilding } from '../agents/stateMachine.js';
import { analyzeProjectStatic } from '../agents/behaviorVerifier.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

function missionScenario(prefix) {
    const s = scenario(prefix);
    // في المسار الحقيقي تُهيّأ لغة المستخدم في handleUserMessage قبل executeMission؛
    // هنا نستدعي _runMissionNow مباشرة فنثبّتها (الافتراضي عند الغياب 'en').
    setUserLanguage(s.ctx.username, 'ar');
    const strat = { registry: [], clone: [], react: [], kernel: [] };
    s.rt._buildFromRegistry = async (...a) => { strat.registry.push(a); return { success: true, registry: true }; };
    s.rt._buildFromClone = async (clone, ...a) => { strat.clone.push([clone, ...a]); return { success: true, clone: clone.id }; };
    s.rt._buildReactProject = async (...a) => { strat.react.push(a); return { success: true, react: true }; };
    s.rt.runDynamicMultiAgentRuntime = async (context) => { strat.kernel.push(context); return { success: true }; };
    const run = (goal, projectPath, agents = {}) =>
        s.rt._runMissionNow(goal, createExecutionContext({ ...s.ctx, projectPath, agents }));
    const chosen = () => Object.entries(strat).filter(([, v]) => v.length).map(([k]) => k);
    const state = () => getProjectState(s.ctx.username, s.ctx.activeProject).state;
    return { ...s, strat, run, chosen, state };
}

const DELIVERY_GOAL = 'تطبيق توصيل طعام للمطاعم مع تتبع الطلب';
const LANDING_GOAL = 'صفحة هبوط لمطعم بحري';
// مشروع كبير (saas) لا يطابق أي كلون؛ وأداة بسيطة (tool) لا تطابق كلوناً ولا تلميحاً تسويقياً
const BIG_GOAL = 'منصة تداول أسهم ومحافظ استثمارية';
const SMALL_TOOL_GOAL = 'أداة حاسبة زكاة بسيطة';

test('شرط الاختبار: مشروع «يعمل» بمعيار التحقّق الساكن مقابل مشروع «معطّل» (سكربت مفقود)', async () => {
    const ok = await analyzeProjectStatic({ projectPath: workingProject() });
    assert.equal(ok.hasProject, true);
    assert.equal(ok.checks.some(c => c.status === 'fail'), false);
    const broken = await analyzeProjectStatic({ projectPath: tempProject() });
    assert.equal(broken.checks.some(c => c.status === 'fail'), true, 'script.js المفقود = عطل');
});

// ── 🧱 Registry: صفحة تسويقية ─────────────────────────────────────────────
test('هدف تسويقي على مجلد فارغ → JAOLA Registry حصراً، بالمعاملات الكاملة', async () => {
    const s = missionScenario('reg');
    const dir = emptyProject();
    const r = await s.run(LANDING_GOAL, dir);
    assert.deepEqual(s.chosen(), ['registry']);
    // العقد الجديد: (goal, ExecutionContext) — نفس القيم، في كائن واحد
    const [goal, ec] = s.strat.registry[0];
    assert.equal(goal, LANDING_GOAL);
    assert.equal(ec.projectPath, dir);
    assert.equal(ec.username, s.ctx.username);
    assert.equal(ec.activeProject, s.ctx.activeProject);
    assert.equal(ec.roomName, s.ctx.roomName);
    assert.ok(Object.isFrozen(ec), 'السياق مجمَّد');
    assert.equal(r.registry, true);
});

test('«ابني صفحة هبوط…» (بناء جديد صريح) على تطبيق قائم *يعمل* → لا يُستبدل بصفحة ثابتة (skipped: works)', async () => {
    const s = missionScenario('regw');
    const r = await s.run('ابني صفحة هبوط لمطعم بحري', workingProject());
    assert.deepEqual(s.chosen(), [], 'لا استراتيجية تُشغَّل');
    assert.deepEqual(r, { success: true, skipped: 'works' });
    assert.match(s.replies().join('\n'), /فلن أستبدله بصفحة تسويقية ثابتة/);
    assert.match(s.logs(), /المشروع القائم يعمل — لا يُستبدل بصفحة تسويقية/);
    // من IDLE لا يوجد انتقال إلى COMPLETED (تبقى idle) — المهم: لا قفل «مهمة تعمل» معلّق
    assert.equal(isBuilding(s.ctx.username, s.ctx.activeProject), false, 'لا قفل بناء يبقى معلّقاً');
});

test('هدف تسويقي *عادي* (بلا فعل بناء) على مشروع قائم → لا Registry: تطوير الموجود تزايدياً عبر النواة', async () => {
    const s = missionScenario('regi');
    await s.run(LANDING_GOAL, workingProject());
    assert.deepEqual(s.chosen(), ['kernel']);
});

test('«أعد البناء» صريحة على تطبيق قائم يعمل → Registry رغم أنه يعمل (قرار المستخدم)', async () => {
    const s = missionScenario('regr');
    await s.run('أعد البناء من الصفر كصفحة هبوط لمطعم بحري', workingProject());
    assert.deepEqual(s.chosen(), ['registry']);
});

// ── 🍔 Clone: تطبيق عامل مطابق ───────────────────────────────────────────
test('تطبيق مطابق لكلون على مجلد فارغ → البدء من الكلون العامل (jaola-delivery)', async () => {
    const s = missionScenario('cln');
    const r = await s.run(DELIVERY_GOAL, emptyProject());
    assert.deepEqual(s.chosen(), ['clone']);
    assert.equal(s.strat.clone[0][0].id, 'jaola-delivery');
    assert.equal(s.strat.clone[0][1], DELIVERY_GOAL);
    assert.equal(r.clone, 'jaola-delivery');
});

test('كلون مطابق + مشروع قائم *معطّل* (سكربت مفقود) → نُصلح المكسور بالكلون', async () => {
    const s = missionScenario('clnb');
    await s.run(DELIVERY_GOAL, tempProject());
    assert.deepEqual(s.chosen(), ['clone']);
});

test('كلون مطابق + مشروع قائم *يعمل* → لا نكلبره (skipped: works) ونبلّغ بتعديل محدّد بدل إعادة البناء', async () => {
    const s = missionScenario('clnw');
    const r = await s.run(DELIVERY_GOAL, workingProject());
    assert.deepEqual(s.chosen(), []);
    assert.deepEqual(r, { success: true, skipped: 'works' });
    assert.match(s.replies().join('\n'), /تطبيقك يعمل بالفعل/);
    assert.match(s.logs(), /المشروع يعمل — تفادينا إعادة بناء تدهسه/);
    assert.equal(isBuilding(s.ctx.username, s.ctx.activeProject), false, 'لا قفل بناء يبقى معلّقاً');
});

test('استئناف [استئناف] على مشروع قائم → لا كلون يستبدله؛ المسار التزايدي (النواة) هو الذي يعمل', async () => {
    const s = missionScenario('clnc');
    const r = await s.run(`[استئناف] تابع تطوير المشروع. الهدف الأصلي: ${DELIVERY_GOAL}`, workingProject());
    assert.deepEqual(s.chosen(), ['kernel'], 'الاستئناف يكمل الموجود لا يستبدله');
    assert.equal(r.success, true);
});

// ── ⚛️ React/Next مقابل Vanilla ─────────────────────────────────────────
test('مشروع كبير (saas) على مجلد فارغ → React/Next بأقسام المخطّط — حتى مع مخطّط احتياطي (لا LLM)', async () => {
    const s = missionScenario('react');
    await s.run(BIG_GOAL, emptyProject());
    assert.deepEqual(s.chosen(), ['react']);
    assert.match(s.logs(), /مشروع كبير → React\/Next/);
    const opts = s.strat.react[0][2]; // (goal, ctx, opts)
    assert.ok(Array.isArray(opts.sections), 'أقسام المخطّط تُمرَّر');
});

test('مشروع كبير لكن على مشروع قائم → لا React (البناء الجديد فقط) → النواة التزايدية', async () => {
    const s = missionScenario('reactx');
    await s.run(BIG_GOAL, workingProject());
    assert.deepEqual(s.chosen(), ['kernel']);
});

test('أداة بسيطة على مجلد فارغ → Vanilla: النواة تعمل بسياق مُثرى، وتقرير تسليم، وحالة COMPLETED، وstream_done دائماً', async () => {
    const s = missionScenario('van');
    const goal = SMALL_TOOL_GOAL;
    const r = await s.run(goal, emptyProject());
    assert.deepEqual(s.chosen(), ['kernel']);
    assert.match(s.logs(), /مسار سريع → Vanilla/);

    const context = s.strat.kernel[0];
    assert.equal(context.originalGoal, goal, 'الهدف الأصلي محفوظ حرفياً');
    assert.ok(context.goal.length > goal.length, 'الهدف المُثرى يحوي سياق المخطّط/النموذج/المتطلبات');
    assert.ok(context.blueprint && context.blueprint._source === 'fallback', 'المخطّط من الاحتياط الحتمي (لا LLM)');
    assert.ok(context.budget?.maxApiCalls >= 7, 'ميزانية جاهزة للنواة');

    assert.equal(r.success, true);
    assert.equal(s.state(), STATES.COMPLETED);
    const replies = s.replies().join('\n');
    assert.match(replies, /اكتملت المهمة — تقرير التسليم/);
    assert.ok(s.events.some(e => e.ev === 'stream_done'), 'إنهاء بث الكود دائماً');
    assert.ok(s.events.some(e => e.ev === 'preview_updated'));
    assert.match(s.logs(), /✨ نجاح/);
});

test('فشل النواة → FAILED فوراً (لا قفل معلّق)، رسالة فشل حتمية، درس مسجَّل، وstream_done', async () => {
    const s = missionScenario('vanf');
    s.rt.runDynamicMultiAgentRuntime = async () => { throw new Error('لم يتم استخراج أي ملفات من رد النموذج'); };
    const r = await s.run(SMALL_TOOL_GOAL, emptyProject());
    assert.equal(r.success, false);
    assert.equal(s.state(), STATES.FAILED);
    assert.match(s.replies().join('\n'), /⛔|❌|تعذّر|فشل/);
    assert.match(s.logs(), /فشل نهائياً/);
    assert.match(s.logs(), /درس مسجَّل: no_files/);
    assert.ok(s.events.some(e => e.ev === 'stream_done'));
    assert.ok(s.events.some(e => e.ev === 'agent_states' && e.payload.coder === 'error'));
});

// ── ⏳ الطابور: مهمة واحدة نشطة لكل مشروع ─────────────────────────────────
// (آخر اختبار في الملف: التشغيلات لا تنتهي عمداً فتشغل خانات الطابور لبقية العملية)
test('executeMission: القبول، ثم رفض تكرار المشروع نفسه برسالة انشغال، ثم الانتظار في الصف عند امتلاء الخانات', () => {
    const s = scenario('queue');
    setUserLanguage(s.ctx.username, 'ar');
    delete s.rt.executeMission; // المساعد يستبدلها بمسجِّل — هنا نختبر الأصلية من الـprototype
    s.rt._runMissionNow = () => new Promise(() => {});
    const go = (project) => s.rt.executeMission('ابني موقعاً', createExecutionContext({ ...s.ctx, activeProject: project }));

    assert.equal(go('q-a').accepted, true);
    assert.equal(go('q-a').accepted, false, 'المشروع نفسه نشط');
    assert.match(s.replies().join('\n'), /يوجد بناء جارٍ لهذا المشروع بالفعل/);

    assert.equal(go('q-b').accepted, true, 'خانة ثانية (MAX_CONCURRENT_MISSIONS الافتراضي 2)');
    const third = go('q-c');
    assert.equal(third.accepted, true, 'مقبول لكن ينتظر');
    assert.match(s.replies().join('\n'), /مهمتك في الصف \(المركز 1\)/);
});
