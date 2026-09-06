// 🧭 ثاني استخراجٍ من jcr: `_understandGoal` → `stages/understand.js#understandGoal`.
//
// خطُّ الأساس القائم: jcrMissionStrategy (المخطّطُ من الاحتياط، الهدفُ المُثرى أطول)
// وjcrBuildStrategy (يستبدل الطريقةَ على النسخة — المفوِّضُ يُبقي ذلك ممكناً).
// هنا: التكافؤُ بمُبلِّغٍ مُحقَن، وسطرا البثّ بحروفهما، وسلوكُ «هويةٌ جديدة»
// (يستبدل النموذجَ القديم لا يدمجه — الطفرةُ التي تُسقط `!newIdentity` تُمسك
// هنا فقط لأنّ نموذجَ الاحتياط واحدٌ لكلّ هدف)، والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { understandGoal } from '../agents/stages/understand.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { getDomainModel, setDomainModel, updateStructure } from '../agents/projectMemory.js';
import { recordModel, _resetForTest as resetLibrary } from '../agents/modelLibrary.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const GOAL = 'أداة حاسبة بسيطة';

test('الدالّةُ الحرّةُ بمُبلِّغٍ مُحقَن ≡ المفوِّضُ في الصنف — ناتجاً وبثّاً', async () => {
    const s = scenario('und'); const dir = emptyProject();
    const viaClass = await s.rt._understandGoal(GOAL, { ...s.ctx, projectPath: dir });
    const classEvents = s.events.map((e) => [e.ev, e.payload?.message ?? e.payload]);

    const free = []; const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => free.push([ev, p?.message ?? p]) }) });
    // مستخدمٌ آخر: ذاكرةُ المشروع لكلِّ (مستخدم، مشروع) — وإلا ورث الثاني نموذجَ الأوّل
    const viaFree = await understandGoal(GOAL, { ...s.ctx, username: s.ctx.username + '_free', projectPath: dir }, reporter);

    assert.deepEqual(viaFree, viaClass);
    assert.deepEqual(free, classEvents, 'حدثاً بحدث');
    assert.equal(viaFree.blueprint._source, 'fallback', 'بلا LLM: الاحتياطُ الحتميّ');
    assert.equal(viaFree.enrichedGoal, GOAL, 'مستخدمٌ جديد بلا ذاكرةٍ ولا ملفّ: الهدفُ كما هو');
    assert.ok(viaFree.blueprintContext.length > 100 && viaFree.domainModelContext.length > 100);
});

test('سطرا البثّ بحروفهما كما يصلان المستخدم — التكافؤُ وحدَه أعمى عن تغيّر النصّ', async () => {
    const events = []; const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p?.message ?? p]) }) });
    const s = scenario('undtxt');
    await understandGoal(GOAL, { ...s.ctx, projectPath: emptyProject() }, reporter);
    assert.deepEqual(events, [
        ['log', '[BLUEPRINT] ➔ [AppAnalyzer]: 🧭 أداة حاسبة بسيطة — تطبيق تفاعلي (1 مكوّن وظيفي)'],
        ['log', '[MODEL] ➔ [DomainAnalyst]: 🧩 نموذج المشروع: 1 كيان (Item) • 1 دور (User) • 1 تدفّق'],
    ]);
});

test('«ابني …» هويةٌ جديدة: النموذجُ القديم يُستبدل؛ وبلا «ابني» يُدمج', async () => {
    const prior = { entities: [{ name: 'Driver' }], roles: [{ name: 'Courier' }], flows: [], _source: 'test' };
    const names = (m, k) => (m?.[k] || []).map((x) => x.name);

    const a = scenario('undnew'); const reporterA = new RoomReporter({ to: () => ({ emit: () => {} }) });
    setDomainModel(a.ctx.username, a.ctx.activeProject, prior);
    const evA = []; reporterA.send = (room, ev, p) => evA.push(p?.message);
    await understandGoal('ابني متجر عطور', { ...a.ctx, projectPath: emptyProject() }, reporterA);
    const replaced = getDomainModel(a.ctx.username, a.ctx.activeProject);
    assert.ok(!names(replaced, 'entities').includes('Driver'), `الهويةُ الجديدة لا ترث Driver: ${names(replaced, 'entities')}`);
    assert.ok(!names(replaced, 'roles').includes('Courier'));
    assert.ok(evA.some((m) => m?.includes('(هوية جديدة — استُبدل النموذج القديم)')), JSON.stringify(evA));

    const b = scenario('undmerge'); const reporterB = new RoomReporter({ to: () => ({ emit: () => {} }) });
    setDomainModel(b.ctx.username, b.ctx.activeProject, prior);
    await understandGoal('متجر عطور', { ...b.ctx, projectPath: emptyProject() }, reporterB);
    const merged = getDomainModel(b.ctx.username, b.ctx.activeProject);
    // PM/6: «متجر عطور» بلا مزوّد يُشتقّ من المعجم (`store`) لا من الحدّ الأدنى `Item`.
    assert.ok(names(merged, 'entities').includes('Driver') && names(merged, 'entities').includes('store'), `الدمجُ يُبقي القديمَ ويضيف الجديد: ${names(merged, 'entities')}`);
});

test('ذاكرةُ المشروع تُحقن في الهدف المُثرى — طفرةُ «الهدفُ كما هو دائماً» نجت قبل هذا', async () => {
    // المستخدمُ الجديد بلا ذاكرة، فالتكافؤُ لا يرى الحقنَ أصلاً. هنا ذاكرةٌ حقيقيّة.
    const s = scenario('undmem'); const reporter = new RoomReporter({ to: () => ({ emit: () => {} }) });
    updateStructure(s.ctx.username, s.ctx.activeProject, ['الرئيسية', 'تواصل'], ['بحث']);
    const r = await understandGoal(GOAL, { ...s.ctx, projectPath: emptyProject() }, reporter);
    assert.ok(r.enrichedGoal.startsWith(GOAL + '\n'), 'الهدفُ الأصليّ أوّلاً');
    assert.match(r.enrichedGoal, /## ذاكرة المشروع:/);
    assert.match(r.enrichedGoal, /الأقسام الموجودة: الرئيسية، تواصل/);
    assert.match(r.enrichedGoal, /الميزات المطلوبة: بحث/);
});

test('بذرةُ مكتبة الفئة تُدمج في النموذج — طفرةُ «تجاهل البذرة» نجت قبل هذا', async () => {
    resetLibrary();
    try {
        // المخطّطُ الاحتياطيّ فئتُه business دائماً؛ نبذر المكتبةَ لها بنموذجٍ لا يُشتقّ من الهدف
        recordModel('business', { entities: [{ name: 'Invoice' }], roles: [{ name: 'Accountant' }], flows: [] });
        const events = []; const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push(p?.message) }) });
        const s = scenario('undseed');
        // ⚠️ أسماءُ scenario ثابتةٌ عبر التشغيلات وذاكرةُ المشروع تُحفظ على القرص —
        // فبلا تصفيرٍ صريح يعود Invoice من الجولة السابقة عبر `prior` لا عبر البذرة،
        // ويمرّ الاختبارُ بالسبب الخطأ (نجت طفرةُ تجاهل البذرة هكذا مرّةً).
        setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] });
        await understandGoal(GOAL, { ...s.ctx, projectPath: emptyProject() }, reporter);
        const m = getDomainModel(s.ctx.username, s.ctx.activeProject);
        const ents = (m?.entities || []).map((e) => e.name);
        assert.ok(ents.includes('Invoice') && ents.includes('Item'), `البذرةُ + المشتقّ معاً: ${ents}`);
        assert.ok(events.some((x) => x?.includes('(مبذور من مكتبة الفئة)')), JSON.stringify(events));
    } finally { resetLibrary(); }
});

test('الحدود: لا this في الوحدة، لا استيرادَ من jcr، والمفوِّضُ سطرٌ واحد والأسماءُ السبعةُ رحلت من jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/understand.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code), 'الدالّةُ الحرّة لا تعرف this');
    assert.ok(!/jcr\.js/.test(code), 'لا دورةَ عودةٍ إلى jcr');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.match(jcr, /async _understandGoal\(goal, ctx\) \{\n\s+return understandGoal\(goal, ctx, this\.reporter\);\n\s+\}/, 'المفوِّضُ سطرٌ واحد');
    for (const n of ['generateBlueprint', 'buildBlueprintContext', 'deriveProjectModel', 'summarizeModel', 'getLibraryModel', 'buildMemoryContext', 'buildProfileContext']) {
        assert.equal((jcr.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length, 0, `${n} لم يعد لـjcr به شأن`);
    }
});
