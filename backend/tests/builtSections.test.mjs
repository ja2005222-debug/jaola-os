// 🧱 PM/19 — «الذاكرةُ تسجّل ما بُني لا ما طُلب»: «🧱 الأقسام» في تقرير التسليم تُقرأ من ذاكرة المشروع،
// وذاكرةُ الهيكل لا تُكتب إلّا بقائمةٍ غيرِ فارغة (`updateStructure`: الفارغُ لا يمحو — عمداً، فلا يفقد
// المشروعُ هيكلَه بتحديثٍ جزئيّ). فمنتجٌ ثانٍ في المشروع نفسِه يرث أقسامَ الأوّل ما لم يكتبْ بانيه شيئاً.
// ومشروعُ الدخول واحدٌ لكلِّ مستخدم (`sandbox_app` في server.js) — فالمنتجُ الثاني هناك هو الحالةُ الشائعة لا النادرة.
// قِيس أنّ بانيَين لا يكتبان ما بنياه:
//   • `buildFromRegistry`: يركّب ١٠ بلوكاتٍ ويبثّها في السجلّ («رُكّبت … أقسام») ولا يسجّلها قطّ — فيُورَّث دائماً.
//   • `buildReactProject`: يسجّل الأقسامَ **المطلوبة** لا المبنيّة؛ وبلا مزوّدٍ يعود المخطّطُ الاحتياطيُّ
//     بـ`keySections: []` (appBlueprint.js) فلا يُكتب شيء، بينما السكافولد بنى أقسامَه الافتراضيّة فعلاً.
// المبدأُ نفسُه في PM/15 وPM/17: القيمةُ المعروضة تُؤخذ من مصدرها الحقيقيّ — ما بُني — لا من مدخلٍ سابقٍ عليه.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getProjectMemory, updateStructure } from '../agents/projectMemory.js';
import { generateNextScaffold, planSections } from '../agents/reactGenerator.js';
import { buildReactProject } from '../agents/stages/buildReact.js';
import { buildFromRegistry } from '../agents/stages/buildFromRegistry.js';
import { reportMissionSuccess } from '../agents/stages/reportMissionSuccess.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const PREV = ['قائمة الطعام', 'الطلبات', 'السلة']; // منتجٌ أوّل: مطعم
const LIB = 'نظام إدارة مكتبة: الأعضاء، الإعارة، الكتب، الغرامات';

/** مستخدمٌ ومشروعٌ واحد بنى فيه منتجاً أوّل — ثمّ يبني الثاني في المشروع نفسِه. */
function afterFirstProduct(prefix) {
    const s = scenario(prefix);
    setUserLanguage(s.ctx.username, 'ar');
    const ctx = { ...s.ctx, projectPath: emptyProject() };
    updateStructure(ctx.username, ctx.activeProject, PREV, ['سلة الشراء']);
    const events = [];
    const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) });
    const sections = () => getProjectMemory(ctx.username, ctx.activeProject).structure.sections;
    const reported = () => {
        events.length = 0;
        reportMissionSuccess(LIB, ctx, reporter);
        return (events.find(([ev]) => ev === 'chat_reply')[1].message.split('\n').find(l => l.startsWith('🧱')) || '');
    };
    return { ctx, reporter, events, sections, reported };
}

test('مسارُ React بلا أقسامٍ مسمّاة: الذاكرةُ تحمل ما بناه السكافولد — لا أقسامَ المنتج السابق', async () => {
    const t = afterFirstProduct('pm19r');
    // بلا مزوّد: `keySections` من المخطّط الاحتياطيّ فارغة — وهذا ما يمرّره selectBuildStrategy
    await buildReactProject(LIB, t.ctx, { sections: [], llm: async () => { throw new Error('لا مزوّد'); } }, t.reporter);
    const built = planSections([]).secs;
    assert.deepEqual(t.sections(), built, 'الذاكرة = أقسامُ السكافولد المبنيّة');
    for (const old of PREV) assert.ok(!t.reported().includes(old), `«${old}» من المطعم ما زالت تُبثّ لنظام المكتبة`);
    assert.ok(t.reported().includes(built[0]), 'السطرُ يسمّي ما بُني');
});

test('ومع أقسامٍ مسمّاة: تُسجَّل بأسمائها هي — لا بأسماءٍ افتراضيّة', async () => {
    const t = afterFirstProduct('pm19n');
    const named = ['الأعضاء', 'الإعارة', 'الكتب'];
    await buildReactProject(LIB, t.ctx, { sections: named, llm: async () => { throw new Error('لا مزوّد'); } }, t.reporter);
    for (const s of named) assert.ok(t.sections().includes(s), `«${s}» المسمّى في الذاكرة`);
    for (const old of PREV) assert.ok(!t.sections().includes(old), `«${old}» من المطعم بقيت`);
});

test('مسارُ Registry: ما رُكّب من بلوكات يُسجَّل — وكان يبثّه في السجلّ ولا يكتبه أبداً', async () => {
    const t = afterFirstProduct('pm19g');
    await buildFromRegistry(LIB, t.ctx, t.reporter);
    const line = t.events.map(([ev, p]) => (ev === 'log' ? p.message : '')).find(m => m.includes('رُكّبت')) || '';
    const composed = line.slice(line.lastIndexOf(': ') + 2).split(' · '); // السطرُ يحمل «[مرحلة] ➔ [وكيل]: 🧩 رُكّبت N أقسام: …»
    assert.ok(composed.length >= 3, 'السجلُّ يسمّي البلوكات المركّبة');
    assert.deepEqual(t.sections(), composed, 'الذاكرة = البلوكاتُ المركّبة نفسُها');
    for (const old of PREV) assert.ok(!t.reported().includes(old), `«${old}» من المطعم ما زالت تُبثّ`);
});

test('الحدّ: السكافولد يعلن أقسامَه في `meta.sections` — هي عينُها التي بنى منها مكوّناتِه', () => {
    for (const input of [[], ['الأعضاء', 'الإعارة']]) {
        const { meta } = generateNextScaffold({ projectName: 'مكتبة', sections: input, lang: 'ar', content: null });
        const { secs, comps } = planSections(input);
        assert.deepEqual(meta.sections, secs, `أقسامُ meta لمدخل ${JSON.stringify(input)}`);
        assert.deepEqual(meta.components, comps, 'المكوّناتُ مشتقّةٌ من الأقسام نفسِها');
        assert.ok(meta.sections.length, 'لا تعود فارغةً أبداً — فالفارغُ لا يمحو الموروث');
    }
});
