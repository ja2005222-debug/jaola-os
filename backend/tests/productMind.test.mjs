// 🧠 PM/1 — «الاختيارُ بالفهم» (`PRODUCT_MIND.md`): العطبُ الأصل «مطعم → تاكسي» جذرُه أنّ مختارَ الكلون كان يقرّر
// بكلمةٍ واحدة (ERP يحمل «نظام إدارة») ويتجاهل نموذجَ الفهم ونماذجَ الكلونات. هنا التوصيف الذي يمنع عودته لأيّ مشروع:
// مفاهيمُ ثنائيّةُ اللغة، قربُ نموذجٍ من نموذج، الفيتو على كلونٍ لا يغطّي أدوارَ الفهم، عبارةُ المسار ليست تسميةَ منتج،
// الاختيارُ بالفهم وحده، بذرُ الفهم من المراجع بلا نموذجٍ لغويّ، والتفسيرُ المبثوث. ثم الحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { conceptOf, modelAffinity, normalizeConceptText } from '../agents/projectModel.js';
import { matchCloneTemplate, matchCloneTemplateDetailed, isTrackPhrase, getCloneById } from '../agents/cloneTemplates/index.js';
import { referenceModel, matchBlueprint } from '../agents/referenceBlueprints.js';
import { understandGoal } from '../agents/stages/understand.js';
import { selectBuildStrategy } from '../agents/stages/selectBuildStrategy.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { createExecutionContext } from '../core/runtime/ExecutionContext.js';
import { getDomainModel, setDomainModel } from '../agents/projectMemory.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { scenario, emptyProject, workingProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const TAXI_SYSTEM = 'ابنِ نظام إدارة وتشغيل تاكسي متعدد الواجهات';
const TAXI_MODEL = { roles: [{ name: 'Passenger' }, { name: 'Driver' }, { name: 'Admin' }], entities: [{ name: 'Trip' }, { name: 'Vehicle' }, { name: 'Fare' }], flows: [] };
const APP = { kind: 'webapp', category: 'business' };

test('المفاهيم: العربيّةُ والإنجليزيّة والجمعُ و«العميل (Passenger)» تلتقي في مفهومٍ واحد؛ الأطولُ يغلب؛ المجهولُ يبقى باسمه', () => {
    assert.equal(conceptOf('العميل (Passenger)'), 'passenger', 'ما بين القوسين هو المصطلحُ الأدقّ');
    assert.equal(conceptOf('Rider'), 'passenger'); assert.equal(conceptOf('ركاب'), 'passenger');
    for (const n of ['الإدارة (Admin)', 'مالك', 'مدير', 'SchoolAdmin', 'Management']) assert.equal(conceptOf(n), 'admin', n);
    assert.equal(conceptOf('مدير أسطول'), 'fleet_manager', 'المرادفُ الأطول يغلب «مدير»');
    assert.equal(conceptOf('مدير أسطول الشركة'), 'fleet_manager', 'المرادفُ المتعدّد يُلتقط مضمَّناً في اسمٍ أطول');
    assert.equal(conceptOf('Senior Fleet Manager'), 'fleet_manager');
    assert.equal(conceptOf('أمين المخزن'), 'storekeeper');
    for (const n of ['Instructor', 'معلم', 'مدرّس', 'Teacher']) assert.equal(conceptOf(n), 'teacher', n);
    for (const n of ['Ride', 'رحلات', 'مشوار', 'Trip']) assert.equal(conceptOf(n), 'trip', n);
    for (const n of ['صنف قائمة', 'MenuItem', 'منتجات']) assert.equal(conceptOf(n), 'product', n);
    assert.equal(conceptOf('فئة سيارة'), 'vehicle');
    assert.equal(conceptOf('منصة'), 'منصه', 'ما ليس في المعجم يطابق نفسَه فقط');
    assert.equal(conceptOf(''), '');
    assert.equal(normalizeConceptText('  الأَطبّاء / المرضى '), 'اطباء مرضي');
});

test('قربُ النماذج: فهمُ التاكسي ضدّ ERP يفقد راكباً وسائقاً؛ ضدّ كلون التاكسي مغطّىً؛ والنموذجُ العامّ (User/Item) بلا معنىً يُقارَن', () => {
    const erp = getCloneById('jaola-erp').model;
    const a = modelAffinity(TAXI_MODEL, erp);
    assert.deepEqual({ cov: a.roleCoverage, missing: a.missingRoles, ents: a.entityOverlap, sub: a.substantive },
        { cov: 1 / 3, missing: ['passenger', 'driver'], ents: 0, sub: true });
    const t = modelAffinity(TAXI_MODEL, getCloneById('jaola-taxi').model);
    assert.equal(t.roleCoverage, 1); assert.deepEqual(t.missingRoles, []); assert.deepEqual(t.sharedEntities, ['trip']);
    assert.ok(t.score > a.score);
    const generic = modelAffinity({ roles: [{ name: 'User' }], entities: [{ name: 'Item' }] }, erp);
    assert.equal(generic.substantive, false, 'User/Item لا يحملان معلومةَ منتج');
    assert.equal(generic.roleCoverage, null); assert.equal(generic.entityOverlap, null);
    assert.equal(modelAffinity(null, erp).substantive, false);
});

test('العطبُ الأصل: «نظام إدارة وتشغيل تاكسي» مع فهمٍ → لا ERP ولا أيُّ كلون سيستم، والسببُ مُسمّى؛ وبلا فهمٍ تبقى الكلماتُ وحدَها (مثبَّت كحدٍّ أدنى لا كمرغوب)', () => {
    const r = matchCloneTemplateDetailed(TAXI_SYSTEM, APP, TAXI_MODEL);
    assert.equal(r.clone, null); assert.equal(r.reason, 'rejected-by-understanding');
    const erp = r.rejected.find(x => x.id === 'jaola-erp');
    assert.deepEqual(erp, { id: 'jaola-erp', missingRoles: ['passenger', 'driver'] });
    assert.ok(r.rejected.every(x => getCloneById(x.id).track === 'system'), 'مسارُ السيستم وحده تُرشَّح كلوناتُه');
    assert.ok(!r.rejected.some(x => x.id === 'jaola-taxi'), 'كلونُ التاكسي (موقع) خارج المسار أصلاً لا مرفوض');
    assert.equal(matchCloneTemplate(TAXI_SYSTEM, APP, TAXI_MODEL), null, 'الغلافُ القديم يعيد الكلون فقط');
    assert.equal(matchCloneTemplateDetailed(TAXI_SYSTEM, APP, null).clone?.id, 'jaola-erp', 'بلا أيّ فهم: الكلمةُ العامّة ما زالت تختار — لهذا يُبذَر الفهمُ من المراجع (الاختبار التالي)');
});

test('عبارةُ المسار ليست تسميةَ منتج: «سيستم داخلي» لا ترفع الفيتو، و«تاكسي» ترفعه؛ التعادلُ بين كلونين يحسمه الفهم (مسار الموقع: تاكسي لا سوق)', () => {
    assert.equal(isTrackPhrase('نظام إدارة'), true); assert.equal(isTrackPhrase('سيستم داخلي'), true);
    assert.equal(isTrackPhrase('تاكسي'), false); assert.equal(isTrackPhrase('مخزون'), false);
    const sys = matchCloneTemplateDetailed('سيستم داخلي', APP, TAXI_MODEL);
    assert.equal(sys.clone, null); assert.ok(sys.rejected.some(x => x.id === 'jaola-erp'));
    // «متعدد» كلمةُ السوق و«تاكسي» كلمةُ التاكسي: تعادلٌ كلميّ (١٠ = ١٠) كان يحسمه ترتيبُ القائمة (السوق أوّلاً).
    // «متعدد» تسميةٌ من كلمات المستخدم فلا تُرفض السوقُ بالفيتو — لكنّ الفهمَ يرجّح التاكسي (قربُ النموذج ≤ ٨).
    const site = matchCloneTemplateDetailed('تطبيق تاكسي متعدد الواجهات', APP, TAXI_MODEL);
    assert.equal(site.clone?.id, 'jaola-taxi');
    assert.ok(!site.rejected.some(x => x.id === 'jaola-marketplace'), 'كلمةُ المستخدم تحمي السوقَ من الفيتو — والترتيبُ بالفهم يحسم');
    assert.equal(matchCloneTemplateDetailed('تطبيق تاكسي متعدد الواجهات', APP, null).clone?.id, 'jaola-marketplace', 'بلا فهم: ترتيبُ القائمة كان يعطي السوق — العطبُ نفسُه بوجهٍ آخر');
    assert.deepEqual(site.clone.matchReason.hits, ['تاكسي']);
    assert.equal(site.clone.matchReason.explicit, true);
    assert.equal(site.clone.matchReason.roleCoverage, 1);
});

test('كلماتُ المستخدم الحرفيّة التي تسمّي منتجاً تغلب نموذجاً مُهلوَساً — كما كان — والتفسيرُ يقول ذلك', () => {
    const hallucinated = { entities: [{ name: 'Program' }, { name: 'Student' }, { name: 'Grade' }],
        roles: [{ name: 'Parent' }, { name: 'Teacher' }, { name: 'SchoolAdmin' }, { name: 'Student' }], flows: [] };
    const r = matchCloneTemplateDetailed('موقع إدارة وتسجيل فعاليات', { kind: 'webapp', category: 'education' }, hallucinated);
    assert.equal(r.clone?.id, 'jaola-events');
    assert.equal(r.clone.matchReason.explicit, true, '«فعاليات» تسميةُ منتجٍ صريحة');
    assert.ok(r.rejected.some(x => x.id === 'jaola-school'), 'المدرسةُ بلا كلمةٍ صريحة تُرفض (Parent غير مغطّى)');
});

test('الفهمُ وحده يختار: «اكمل» بنموذج تاكسي → كلون التاكسي بسبب model-only؛ دورٌ واحد لا يكفي؛ ونموذجٌ بلا كيانٍ مشترك لا يكفي', () => {
    const r = matchCloneTemplateDetailed('اكمل', { kind: 'webapp' }, TAXI_MODEL);
    assert.equal(r.clone?.id, 'jaola-taxi'); assert.equal(r.reason, 'model-only');
    assert.deepEqual(r.clone.matchReason.hits, []);
    const one = matchCloneTemplateDetailed('اكمل', { kind: 'webapp' }, { roles: [{ name: 'Admin' }], entities: [{ name: 'Trip' }], flows: [] });
    assert.equal(one.clone, null, 'دورٌ واحد (Admin) يغطّيه كلُّ كلون — لا دليل');
    const noEnt = matchCloneTemplateDetailed('اكمل', { kind: 'webapp' }, { roles: [{ name: 'Passenger' }, { name: 'Driver' }], entities: [{ name: 'Coupon' }], flows: [] });
    assert.equal(noEnt.clone, null, 'الأدوارُ مغطّاة لكن لا كيانَ مشترك → لا اختيارَ بالفهم وحده');
    const partial = matchCloneTemplateDetailed('اكمل', { kind: 'webapp' }, { roles: TAXI_MODEL.roles, entities: [{ name: 'Trip' }, { name: 'Coupon' }, { name: 'Promo' }, { name: 'Wallet' }], flows: [] });
    assert.equal(partial.clone?.id, 'jaola-taxi', 'كيانٌ مشترك واحد يكفي — نماذجُ الكلونات جزئيّة');
});

test('المرجعُ يبذر الفهم بلا نموذجٍ لغويّ: طلبُ التاكسي يخرج من مرحلة الفهم بأدوار Passenger/Driver/Admin والسجلُّ يسمّي المرجع', async () => {
    const refTaxi = referenceModel(matchBlueprint(TAXI_SYSTEM));
    assert.deepEqual(refTaxi.roles, [{ name: 'Passenger', description: 'العميل' }, { name: 'Driver', description: 'السائق' }, { name: 'Admin', description: 'الإدارة' }]);
    assert.equal(refTaxi._source, 'reference'); assert.equal(refTaxi.reference, 'taxi_fleet');
    // PM/4: كان هذا التأكيدُ يثبّت `entities: []` — وهو بعينه ما تُصلحه الخطوة: المرجعُ يعرف
    // خمسَ صفحاتٍ وأربعةَ مكوّنات، فلا يجوز أن يخرج فهمُ التاكسي بلا «رحلة» ولا «مركبة».
    assert.ok(refTaxi.entities.some(e => e.name === 'trip') && refTaxi.entities.some(e => e.name === 'vehicle'),
        refTaxi.entities.map(e => e.name).join(','));
    assert.deepEqual(refTaxi.flows.map(f => f.name), ['تدفّق حالة الرحلة'], 'ما فيه سهمٌ تدفّق، وما سواه مكوّن');
    assert.equal(referenceModel(null), null);
    assert.equal(referenceModel({ id: 'x', roles: [] }), null);
    assert.deepEqual(referenceModel({ id: 'm', roles: ['المشتري'] }).roles, [{ name: 'المشتري' }], 'بلا قوسين: الاسمُ كما هو');

    const events = []; const reporter = new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p?.message ?? p]) }) });
    const s = scenario('pm');
    const out = await understandGoal(TAXI_SYSTEM, { ...s.ctx, projectPath: emptyProject() }, reporter);
    const model = getDomainModel(s.ctx.username, s.ctx.activeProject);
    const roles = model.roles.map(r => r.name);
    assert.ok(['Passenger', 'Driver', 'Admin'].every(r => roles.includes(r)), `أدوارُ المرجع في نموذج الفهم: ${roles}`);
    assert.equal(model.roles[0].description, 'العميل');
    assert.match(events.find(e => e[0] === 'log' && /نموذج المشروع/.test(e[1]))[1], /\(مرجع: إدارة وتشغيل تاكسي\)$/);
    assert.match(out.domainModelContext, /Passenger/);
    // هدفٌ بلا مرجع: لا بذرَ ولا لاحقة
    const e2 = []; const r2 = new RoomReporter({ to: () => ({ emit: (ev, p) => e2.push([ev, p?.message ?? p]) }) });
    const s2 = scenario('pmno');
    await understandGoal('أداة حاسبة بسيطة', { ...s2.ctx, projectPath: emptyProject() }, r2);
    assert.doesNotMatch(e2.find(e => e[0] === 'log' && /نموذج المشروع/.test(e[1]))[1], /مرجع:/);
});

function strategyHarness({ dir, track, lang = 'ar' } = {}) {
    const events = [];
    const reporter = new RoomReporter({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
    const built = { registry: [], clone: [], react: [] };
    const ops = {
        buildFromRegistry: async (goal, ctx) => { built.registry.push({ goal, ctx }); return { success: true, via: 'registry' }; },
        buildFromClone: async (clone, goal, ctx) => { built.clone.push({ clone, goal, ctx }); return { success: true, via: 'clone' }; },
        buildReactProject: async (goal, ctx, opts) => { built.react.push({ goal, ctx, opts }); return { success: true, via: 'react' }; },
        trackOf: () => track,
    };
    const username = `__pm_u${Date.now()}_${Math.random().toString(36).slice(2, 6)}__`;
    setUserLanguage(username, lang);
    const ctx = createExecutionContext({ username, roomName: `pm_room_${username}`, activeProject: 'pm-proj', projectPath: dir || emptyProject(), agents: {} });
    const logs = () => events.filter(e => e.ev === 'log').map(e => e.payload.message).join('\n');
    return { ctx, reporter, ops, built, logs, pick: (goal, bp = APP) => selectBuildStrategy(goal, bp, ctx, reporter, ops) };
}

test('من طرفٍ إلى طرف: فهمٌ مبذورٌ من المرجع + مسارُ سيستم → لا كلونَ يُبنى، والسجلُّ يقول «استُبعد بالفهم: jaola-erp (بلا passenger/driver)»؛ وعلى مسار الموقع يُختار التاكسي بدليله', async () => {
    const sys = strategyHarness({ dir: emptyProject(), track: 'system' });
    setDomainModel(sys.ctx.username, sys.ctx.activeProject, referenceModel(matchBlueprint(TAXI_SYSTEM)));
    const r = await sys.pick(TAXI_SYSTEM);
    assert.equal(sys.built.clone.length, 0, 'لا ERP ولا أيَّ كلون سيستم');
    assert.ok(r === null || r.via !== 'clone');
    assert.match(sys.logs(), /🧠 استُبعد بالفهم: jaola-erp \(بلا passenger\/driver\)/);
    assert.doesNotMatch(sys.logs(), /اختيارٌ بالفهم/);

    const site = strategyHarness({ dir: emptyProject(), track: undefined });
    setDomainModel(site.ctx.username, site.ctx.activeProject, referenceModel(matchBlueprint('تطبيق تاكسي للركاب والسائقين')));
    const r2 = await site.pick('تطبيق تاكسي للركاب والسائقين');
    assert.equal(r2?.via, 'clone'); assert.equal(site.built.clone[0].clone.id, 'jaola-taxi');
    assert.match(site.logs(), /🧠 اختيارٌ بالفهم: jaola-taxi — كلمات: تاكسي\/سائق، الأدوار 100٪/);
});

test('مشروعٌ قائمٌ يعمل لكنّه لا يغطّي أدوارَ الفهم: لا يُدهَس بكلون، والفجوةُ تُقال؛ والمعطّلُ فعلاً يُستبدَل كما كان', async () => {
    const goal = 'تطبيق توصيل طعام من مطاعم متعددة';
    const ok = strategyHarness({ dir: workingProject() });
    setDomainModel(ok.ctx.username, ok.ctx.activeProject, referenceModel(matchBlueprint(goal)));
    const r = await ok.pick(goal);
    assert.deepEqual(r, { success: true, skipped: 'works' });
    assert.equal(ok.built.clone.length, 0, 'فجوةُ الأدوار ليست عطلاً — لا دهسَ بلا «أعد البناء»');
    assert.match(ok.logs(), /🧠 يعمل لكنّه لا يغطّي كلَّ الأدوار — أدوار بلا واجهة\/تمثيل: /);
    assert.match(ok.logs(), /🧠 اختيارٌ بالفهم: jaola-delivery/);
    const broken = strategyHarness({ dir: (() => { const d = emptyProject(); fs.writeFileSync(path.join(d, 'index.html'), '<!DOCTYPE html><html><body><script src="missing.js"></script>' + '<p>x</p>'.repeat(30) + '</body></html>'); return d; })() });
    setDomainModel(broken.ctx.username, broken.ctx.activeProject, referenceModel(matchBlueprint(goal)));
    const rb = await broken.pick(goal);
    assert.equal(rb?.via, 'clone', 'سكربتٌ مفقود = معطّل → الكلونُ يُصلحه');
});

test('الحدود: matchCloneTemplate غلافٌ رقيق؛ الفيتو والترتيبُ والفهمُ وحده في المفصَّلة؛ المرحلةُ تستورد المفصَّلة وتبثّ ثلاثةَ أسطر فهم؛ مرحلةُ الفهم تستورد المرجع', () => {
    const idx = fs.readFileSync(path.join(HERE, '../agents/cloneTemplates/index.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(idx.includes("export function matchCloneTemplate(goal = '', blueprint = null, domainModel = null, opts = {}) {\n    return matchCloneTemplateDetailed(goal, blueprint, domainModel, opts).clone;\n}"));
    const fn = idx.slice(idx.indexOf('export function matchCloneTemplateDetailed('), idx.indexOf('\n}\n', idx.indexOf('export function matchCloneTemplateDetailed(')) + 3);
    const count = (re) => (fn.match(re) || []).length;
    assert.equal(count(/modelAffinity\(/g), 1); assert.equal(count(/isTrackPhrase\(/g), 1);
    assert.equal(count(/rejected\.push\(/g), 1, 'فيتو واحد');
    assert.equal(count(/Math\.round\(affinity\.score \* 8\)/g), 1, 'القربُ ترجيحٌ ≤ ٨ لا يغلب كلمةً (١٠)');
    assert.equal(count(/'model-only'/g), 2, 'الوسمُ والسبب'); assert.equal(count(/'keywords\+model'/g), 2);
    assert.equal(count(/sharedEntities\.length >= 1/g), 1, 'كيانٌ مشترك واحد لا نسبة');
    assert.ok(idx.includes("import { modelAffinity, conceptOf } from '../projectModel.js';"));
    const stage = fs.readFileSync(path.join(HERE, '../agents/stages/selectBuildStrategy.js'), 'utf8');
    assert.ok(stage.includes("import { matchCloneTemplateDetailed } from '../cloneTemplates/index.js';"));
    assert.ok(!/\bmatchCloneTemplate\(/.test(stage), 'المرحلةُ لا تستعمل الغلافَ الأعمى');
    assert.equal((stage.match(/'ProductMind'/g) || []).length, 3);
    const und = fs.readFileSync(path.join(HERE, '../agents/stages/understand.js'), 'utf8');
    assert.ok(und.includes("import { matchBlueprint, referenceModel } from '../referenceBlueprints.js';"));
    assert.ok(und.includes('if (refModel) model = mergeProjectModel(refModel, model);'));
    const pm = fs.readFileSync(path.join(HERE, '../agents/projectModel.js'), 'utf8');
    assert.ok(pm.includes("const GENERIC_CONCEPTS = new Set(['user', 'item', 'employee']);"));
});
