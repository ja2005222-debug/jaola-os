// 🧭 `_selectBuildStrategy` — يختار مسارَ البناء: سجلُّ البلوكات التسويقيّة /
// كلونٌ عامل / React-Next للمشاريع الكبيرة / أو `null` = النواةُ الافتراضيّة.
// ١١٠ أسطر بلا اختبارٍ يذكرها — وفيها ثلاثةُ حرّاسٍ وُلدوا من أعطالٍ إنتاجيّة:
//   • تطبيقٌ قائمٌ **يعمل** لا يُستبدل بصفحة هبوطٍ ثابتة بجملة بناءٍ عاديّة.
//   • «اكمل» على كلونٍ عامل لا يُعيد البناءَ فيدهسه.
//   • الاستئنافُ ([استئناف]) لا يُقرأ إعادةَ بناء ولا يُطابَق كلوناً.
// اختباراتُ توصيف: المسارُ الحقيقيّ حتى قرارِ التفرّع، والبناةُ مسجِّلات.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenario, tempProject, workingProject, emptyProject } from './helpers/jcrScenario.mjs';
import { createExecutionContext } from '../core/runtime/ExecutionContext.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { getProjectState, STATES } from '../agents/stateMachine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

function strategy(prefix, dir) {
    const s = scenario(prefix);
    setUserLanguage(s.ctx.username, 'ar');
    const built = { registry: [], clone: [], react: [] };
    s.rt._buildFromRegistry = async (goal, ctx) => { built.registry.push({ goal, ctx }); return { success: true, via: 'registry' }; };
    s.rt._buildFromClone = async (clone, goal, ctx) => { built.clone.push({ clone, goal, ctx }); return { success: true, via: 'clone' }; };
    s.rt._buildReactProject = async (goal, ctx, opts) => { built.react.push({ goal, ctx, opts }); return { success: true, via: 'react' }; };
    const ctx = createExecutionContext({ ...s.ctx, projectPath: dir, agents: {} });
    // 🔎 في عزلةٍ تبقى الحالةُ idle، وآلةُ الحالة ترفض idle→completed — فحارسُ «يعمل»
    //    لا يبلغ COMPLETED إلّا من موضعه في `_runMissionNow`. كان ذلك الموضعُ
    //    **بعد** هذه الطريقة (عطبٌ مقيسٌ في JCR/1: خمسةُ نداءاتٍ مرفوضة)، وصار قبلها.
    //    الاختبارُ الأخير أدناه يُثبت المسارَ الحقيقيّ؛ وهذه الاختباراتُ تُثبت العزلة.
    const pick = (goal, blueprint = null) => s.rt._selectBuildStrategy(goal, blueprint, ctx);
    const state = () => getProjectState(s.ctx.username, s.ctx.activeProject).state;
    return { ...s, dir, built, pick, state };
}
const noneBuilt = (b) => b.registry.length + b.clone.length + b.react.length === 0;

// ── صفحاتٌ تسويقيّة ────────────────────────────────────────────────────

test('بناءٌ جديد + هدفٌ تسويقيّ → سجلُّ البلوكات', async () => {
    const s = strategy('strat', emptyProject());
    const r = await s.pick('صفحة هبوط لشركة استشارات', { kind: 'landing' });
    assert.equal(r.via, 'registry');
    assert.equal(s.built.registry[0].goal, 'صفحة هبوط لشركة استشارات');
});

test('تطبيقٌ قائمٌ يعمل + هدفٌ تسويقيّ بلا «أعد البناء» → لا يُستبدل، ويُبلَّغ المستخدم', async () => {
    const s = strategy('strat', workingProject());
    const r = await s.pick('صمم صفحة تعريفية للمطعم', { kind: 'brochure' });
    assert.deepEqual(r, { success: true, skipped: 'works' });
    assert.ok(noneBuilt(s.built), 'لا بانيَ استُدعي');
    assert.match(s.replies().at(-1), /تطبيقك الحالي يعمل، فلن أستبدله بصفحة تسويقية/);
    assert.match(s.logs(), /لا يُستبدل بصفحة تسويقية دون «أعد البناء» صريحة/);
    assert.equal(s.state(), STATES.IDLE, 'الانتقالُ إلى COMPLETED مرفوضٌ من idle — يبقى خاملاً');
});

test('تطبيقٌ قائمٌ يعمل + «أعد البناء» صريحة → يُستبدل بصفحةٍ من السجلّ', async () => {
    const s = strategy('strat', workingProject());
    const r = await s.pick('أعد البناء كصفحة هبوط للمطعم', { kind: 'landing' });
    assert.equal(r.via, 'registry');
});

// ── الكلونات ───────────────────────────────────────────────────────────

test('بناءٌ جديد + تطبيقٌ يطابق كلوناً → نبدأ من الكلون العامل', async () => {
    const s = strategy('strat', emptyProject());
    const r = await s.pick('تطبيق توصيل طعام من المطاعم', { kind: 'webapp' });
    assert.equal(r.via, 'clone');
    assert.ok(s.built.clone[0].clone?.id, 'كلونٌ فعليّ مُرِّر');
    assert.match(String(s.built.clone[0].clone.id), /food|delivery/i);
});

test('كلونٌ مطابق على مشروعٍ قائمٍ يعمل → لا نُعيد البناء، ونُرشد إلى التعديل الجراحيّ', async () => {
    const s = strategy('strat', workingProject());
    const r = await s.pick('تطبيق توصيل طعام', { kind: 'webapp' });
    assert.deepEqual(r, { success: true, skipped: 'works' });
    assert.match(s.replies().at(-1), /تطبيقك يعمل بالفعل/);
    assert.match(s.logs(), /تفادينا إعادة بناء تدهسه/);
    assert.equal(s.state(), STATES.IDLE, 'الانتقالُ إلى COMPLETED مرفوضٌ من idle — يبقى خاملاً');
    assert.ok(noneBuilt(s.built));
});

test('كلونٌ مطابق على مشروعٍ قائمٍ **معطّل** → نُصلح المكسورَ بالكلون', async () => {
    // tempProject يشير إلى script.js غيرِ موجود → «معطّل» بمعيار التحقّق الساكن
    const s = strategy('strat', tempProject());
    const r = await s.pick('تطبيق توصيل طعام', { kind: 'webapp' });
    assert.equal(r.via, 'clone');
});

test('استئنافٌ ([استئناف]) على مشروعٍ قائم → لا كلون ولا React، بل النواةُ الافتراضيّة', async () => {
    // «لا تبدأ من الصفر» كانت تُطابق «من الصفر» فتدهس المشروع — الوسمُ يحميه.
    const s = strategy('strat', workingProject());
    const r = await s.pick('[استئناف] تابع تطوير المشروع القائم — لا تبدأ من الصفر. تطبيق توصيل طعام', { kind: 'webapp' });
    assert.equal(r, null);
    assert.ok(noneBuilt(s.built), 'الاستئنافُ يكمل الموجود لا يستبدله');
    assert.match(s.logs(), /مسار سريع → Vanilla/);
});

// ── الموجّه الهجين ─────────────────────────────────────────────────────

test('بناءٌ جديد + فئةٌ كبيرة من النموذج → React/Next بأقسام المخطّط', async () => {
    const s = strategy('strat', emptyProject());
    const r = await s.pick('منصة تجارة إلكترونية', { category: 'ecommerce', keySections: ['Hero', 'Products', 'Cart'] });
    assert.equal(r.via, 'react');
    assert.deepEqual(s.built.react[0].opts, { sections: ['Hero', 'Products', 'Cart'] });
    assert.match(s.logs(), /مشروع كبير → React\/Next/);
});

test('فئةٌ كبيرة لكن من الاحتياط (_source=fallback) → تُهمل، والهدفُ يقرّر', async () => {
    // Sprint 2e: الاحتياطُ كان يضع 'business' دائماً فيُعطّل الموجّه؛ والعكسُ
    // كذلك لا يُصدَّق — فئةٌ لم تأتِ من النموذج ليست دليلاً.
    const s = strategy('strat', emptyProject());
    const r = await s.pick('موقع لمطعم صغير', { category: 'ecommerce', _source: 'fallback' });
    assert.equal(r, null);
    assert.equal(s.built.react.length, 0);
    assert.match(s.logs(), /مسار سريع → Vanilla/);
});

test('بناءٌ جديد عاديّ → null (النواةُ الافتراضيّة) بلا أيّ بانٍ', async () => {
    const s = strategy('strat', emptyProject());
    const r = await s.pick('موقع لمطعم صغير', { category: 'business' });
    assert.equal(r, null);
    assert.ok(noneBuilt(s.built));
    assert.match(s.logs(), /مسار سريع → Vanilla/);
});

// ── المسارُ الحقيقيّ: عبر _runMissionNow، ARCHITECTURE ثمّ COMPLETED ────────

test('عبر _runMissionNow: حارسُ «يعمل» يبلغ COMPLETED فعلاً — وكان يُرفض', async () => {
    const s = strategy('strat', workingProject());
    // فهمُ الهدف يحتاج نموذجاً لغويّاً؛ هدفُ الاختبار ترتيبُ الانتقالات لا الفهم.
    s.rt._understandGoal = async (goal) => ({ enrichedGoal: goal, blueprint: { kind: 'webapp' }, blueprintContext: '', domainModelContext: '' });
    // 🔴 كنتُ أمرّر s.ctx.projectPath (= /nonexistent) فقُرئ المشروعُ جديداً وذهب للكلون.
    const ctx = createExecutionContext({ ...s.ctx, projectPath: s.dir, agents: {} });
    const r = await s.rt._runMissionNow('تطبيق توصيل طعام', ctx);
    assert.deepEqual(r, { success: true, skipped: 'works' });
    const st = getProjectState(s.ctx.username, s.ctx.activeProject);
    assert.equal(st.state, STATES.COMPLETED, 'كان يبقى idle: COMPLETED مرفوضٌ من idle');
    assert.equal(st.previousState, STATES.ARCHITECTURE, 'ARCHITECTURE سبقت اختيارَ الاستراتيجيّة');
});
