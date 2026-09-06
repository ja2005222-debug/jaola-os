// 🧭 الاختصارُ التسويقيّ يقرأ الفهمَ قبل الكلمات (`PRODUCT_MIND.md`): قِيس بعد PM/8 — سبعةٌ من تسعة أهدافٍ قصيرة تذكر لفظَ
// عميل («شركة»، «company»، «وكالة»، «ستارت اب») كانت تذهب إلى **صفحة هبوطٍ من الـRegistry** بحكم PASS رغم أنّ المخطّطَ يقول
// `kind=webapp` — منها «متجر إلكتروني لشركة ملابس» بعينه، المثالُ الذي كتبه `appBlueprint` حين أخرج ألفاظَ العميل من قائمته
// («شركة تصف الطالب لا المطلوب»). `blockRegistry` احتفظ بنسخةٍ ثانية من القائمة القديمة، ولم يكن يقرأ حكمَ المخطّط إلّا حين
// يقول «بروشور». هنا: الفهمُ (kind) يسبق الكلمات، وألفاظُ العميل تخرج من القائمة الثانية أيضاً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
process.env.MISSION_LEDGER_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mk-ledger-')), 'mission_ledger.json');
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { createExecutionContext } = await import('../core/runtime/ExecutionContext.js');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { isMarketingPageGoal } = await import('../agents/blockRegistry.js');
const { generateBlueprint } = await import('../agents/appBlueprint.js');
const { setDomainModel } = await import('../agents/projectMemory.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();
const HERE = import.meta.dirname;

/** بعثةٌ حقيقيّة بلا مزوّد على مجلّدٍ فارغ — البناةُ مستبدَلون فنقرأ أيَّهم اختير. */
async function route(prefix, goal) {
    const s = scenario(prefix); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] });
    const strat = { registry: 0, clone: null, react: 0, kernel: 0 };
    s.rt._buildFromRegistry = async () => { strat.registry++; return { success: true, registry: true }; };
    s.rt._buildFromClone = async (clone) => { strat.clone = clone.id; return { success: true, clone: clone.id }; };
    s.rt._buildReactProject = async () => { strat.react++; return { success: true, react: true }; };
    s.rt.runDynamicMultiAgentRuntime = async () => { strat.kernel++; return { success: true }; };
    await s.rt._runMissionNow(goal, createExecutionContext({ ...s.ctx, projectPath: emptyProject(), agents: {} }));
    return { chosen: strat.clone ? `clone:${strat.clone}` : strat.registry ? 'registry' : strat.react ? 'react' : 'kernel', logs: s.logs() };
}

const HIJACKED = [
    'متجر إلكتروني لشركة ملابس', 'تطبيق حجز مواعيد لشركة صيانة', 'منصة لستارت اب لتوصيل الطعام', 'لوحة تحكم مبيعات لشركة عقارات',
    'تطبيق توصيل طلبات مع تتبع للسائق لشركة لوجستية', 'company dashboard for inventory tracking',
];

test('الحقيقةُ المقيسة (أُغلقت): تطبيقٌ يذكر لفظَ عميل — المخطّطُ يقول webapp والاختصارُ لا يجعله بروشوراً', async () => {
    for (const goal of HIJACKED) {
        const bp = await generateBlueprint(goal);
        assert.equal(bp.kind, 'webapp', goal);
        assert.equal(isMarketingPageGoal(goal, bp), false, `${goal}: كان true بلفظ العميل`);
    }
});

test('المسارُ كاملاً: الأهدافُ الستّة لا تذهب إلى الـRegistry — كلونٌ يطابق أو النواة، ولا صفحةَ هبوط', async () => {
    let i = 0;
    for (const goal of HIJACKED) {
        const r = await route('mkh' + (i++), goal);
        assert.notEqual(r.chosen, 'registry', `${goal} → ${r.chosen}`);
        assert.ok(!/JaolaRegistry/.test(r.logs), `${goal}: لا Registry في السجلّ`);
    }
});

test('البروشوراتُ كما كانت: ألفاظُ المنتج (هبوط/تعريفي/بورتفوليو/landing) ومخطّطُ brochure → Registry', async () => {
    let i = 0;
    for (const goal of ['موقع تعريفي لشركة محاماة', 'صفحة هبوط لشركة استشارات', 'بورتفوليو لمصمّم', 'landing page for a startup']) {
        const bp = await generateBlueprint(goal);
        assert.equal(isMarketingPageGoal(goal, bp), true, goal);
        const r = await route('mkb' + (i++), goal);
        assert.equal(r.chosen, 'registry', `${goal} → ${r.chosen}`);
    }
});

test('الدالّةُ النقيّة: الفهمُ قبل الكلمات — kind webapp/tool يردّ false ولو ذُكر «هبوط»؛ landing/brochure true؛ بلا مخطّطٍ تحكم ألفاظُ المنتج وحدَها', () => {
    assert.equal(isMarketingPageGoal('تطبيق إدارة مع صفحة هبوط', { kind: 'webapp' }), false, 'التطبيقُ يغلب لفظَ الهبوط');
    assert.equal(isMarketingPageGoal('حاسبة زكاة', { kind: 'tool' }), false);
    assert.equal(isMarketingPageGoal('أي هدف', { kind: 'landing' }), true); assert.equal(isMarketingPageGoal('أي هدف', { kind: 'brochure' }), true);
    // بلا مخطّط: ألفاظُ العميل لا تكفي، وألفاظُ المنتج تكفي
    for (const g of ['موقع شركة تجارية', 'company site', 'وكالة عقارية', 'startup', 'ستارت اب للتقنية', 'corporate portal', 'agency']) assert.equal(isMarketingPageGoal(g), false, g);
    for (const g of ['صفحة هبوط', 'موقع تعريفي', 'بروشور', 'portfolio', 'landing', 'coming soon page', 'one page site']) assert.equal(isMarketingPageGoal(g), true, g);
    assert.equal(isMarketingPageGoal('موقع شركة تجارية', { kind: 'brochure' }), true, 'والمخطّطُ يحسم حين يقول بروشور');
});

test('الحدود: لا لفظَ عميلٍ في MARKETING_HINTS؛ حكمُ المخطّط يُقرأ بوجهَيه؛ المستهلكُ الوحيد selectBuildStrategy كما كان', () => {
    const src = fs.readFileSync(path.join(HERE, '../agents/blockRegistry.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const list = /const MARKETING_HINTS = \[([^\]]*)\];/.exec(src)[1];
    for (const w of ["'شركة'", "'company'", "'corporate'", "'وكالة'", "'agency'", "'startup'", "'ستارت اب'"]) assert.ok(!list.includes(w), `${w} لفظُ عميلٍ لا منتج`);
    assert.ok(src.includes("if (k === 'webapp' || k === 'tool') return false;"), 'الفهمُ قبل الكلمات');
    assert.ok(src.includes("if (k === 'landing' || k === 'brochure') return true;"));
    const strat = fs.readFileSync(path.join(HERE, '../agents/stages/selectBuildStrategy.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.equal((strat.match(/isMarketingPageGoal\(goal, blueprint\)/g) || []).length, 2, 'المستهلكان كما كانا (الاستثناءُ والاختصار)');
});
