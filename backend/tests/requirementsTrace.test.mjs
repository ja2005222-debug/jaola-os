// ⚖️ PM/7 — «لا PASS بمتطلّباتٍ متخطّاة» (`PRODUCT_MIND.md`): مساراتُ الاستراتيجيّة (Registry/Clone/React) كانت تسجّل
// `requirements-verify: skipped` حتميّاً — فوثيقةُ نقاطِ البيع (١٢ متطلّباً مسمّى بعد PM/6) على كلونٍ يمثّل سبعةً منها كانت PASS.
// هنا: `traceRequirements` تتتبّع أثرَ كلِّ متطلّبٍ في الملفّات بالمعجم نفسِه (PM/1، PM/3) بلا مزوّد — الغيابُ قاطعٌ فيُقال
// بالاسم، والحضورُ أثرٌ لا تنفيذ فيُكتب كذلك، وما لا مفردةَ له (عامّ/تدفّق/خارج المعجم) لا يُحسب له ولا عليه. ثمّ المسارُ كاملاً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
process.env.MISSION_LEDGER_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pm7-ledger-')), 'mission_ledger.json');
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { createExecutionContext } = await import('../core/runtime/ExecutionContext.js');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { traceRequirements, composeRequirements } = await import('../agents/requirementsVerifier.js');
const { requirementsTraceOutcome, strategyVerdict } = await import('../agents/stages/verify.js');
const { buildReactProject } = await import('../agents/stages/buildReact.js');
const { setDomainModel, getDomainModel } = await import('../agents/projectMemory.js');
const { RoomReporter } = await import('../core/runtime/RoomReporter.js');
const { transitionState, resetProjectState, STATES } = await import('../agents/stateMachine.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();
const HERE = import.meta.dirname;
const SPEC = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const gate = (v, name) => v.gates.find(g => g.name === name);

test('traceRequirements: دورٌ/كيانٌ في المعجم يُتتبَّع (له أثر أو بلا أثر)؛ العامُّ والتدفّقُ وما خارج المعجم لا يُتتبَّع — والتدفّقُ لا يُتتبَّع ولو حمل اسمُه مفردةً', () => {
    const files = [{ name: 'index.html', content: '<h1>قائمة المنتجات</h1><section>العميل</section>' }, { name: 'app.js', content: 'const rows = [];' }];
    const reqs = [
        { name: 'شاشة customer', _kind: 'role' }, { name: 'شاشة tenant', _kind: 'role' },
        { name: 'بيانات product', _kind: 'entity' }, { name: 'بيانات invoice', _kind: 'entity' }, { name: 'بيانات account', _kind: 'entity' },
        { name: 'شاشة User', _kind: 'role' }, { name: 'الميزة الأساسية التفاعلية' }, { name: 'تدفّق بيع بالمنتج', _kind: 'flow' },
        { name: '' }, null,
    ];
    assert.deepEqual(traceRequirements(reqs, files), {
        traced: ['شاشة customer', 'بيانات product'],
        missing: ['شاشة tenant', 'بيانات invoice', 'بيانات account'],
        untraceable: ['شاشة User', 'الميزة الأساسية التفاعلية', 'تدفّق بيع بالمنتج'],
        // 🔤 ⊆ traced: أثرُهما في نثر index.html وحدَه؛ و`app.js` هنا `const rows = []` لا ينطق بشيء.
        decorative: ['شاشة customer', 'بيانات product'],
        // 🔓 #١٩٨: قائمةٌ خامسة — «لم أتتبّعه بمفرداته». فارغةٌ هنا: هذه المتطلّباتُ بلا `_term`
        //    (طُعمٌ مكتوبٌ يدويّاً)، فالمعجمُ وحدَه يحكم عليها كما كان.
        unmatched: [],
    });
    assert.deepEqual(traceRequirements([{ name: 'تدفّق إغلاق وردية', _kind: 'flow' }], [{ name: 'a.js', content: 'وردية' }]).untraceable, ['تدفّق إغلاق وردية'], 'بلا _kind كانت ستُتتبَّع بمفردة «وردية» — التدفّقُ انتقالُ حالةٍ لا لفظ');
    assert.deepEqual(traceRequirements([{ name: 'بيانات وردية' }], [{ name: 'a.js', content: 'وردية' }]).traced, ['بيانات وردية'], 'بلا _kind: المعجمُ يقرّر');
    assert.deepEqual(traceRequirements([], files), { traced: [], missing: [], untraceable: [], decorative: [], unmatched: [] });
    assert.deepEqual(traceRequirements([{ name: 'بيانات product', _kind: 'entity' }], []), { traced: [], missing: ['بيانات product'], untraceable: [], decorative: [], unmatched: [] }, 'بلا ملفّات: كلُّ شيءٍ بلا أثر — والمستدعي يقرّر skipped قبل النداء');
    assert.deepEqual(traceRequirements(null, null), { traced: [], missing: [], untraceable: [], decorative: [], unmatched: [] });
});

test('requirementsTraceOutcome: لا متطلّبات/لا ملفّات → skipped بالسبب؛ كلُّها لا يُتتبَّع → skipped بعدده؛ بلا أثر → fail بالأسماء؛ كلُّه له أثر → pass «أثرٌ لا تنفيذ»', () => {
    const files = [{ name: 'index.html', content: 'منتج عميل' }];
    assert.deepEqual(requirementsTraceOutcome([], files, 'سبب'), { status: 'skipped', detail: 'سبب' });
    assert.deepEqual(requirementsTraceOutcome([{ name: 'بيانات product', _kind: 'entity' }], [], 'سبب'), { status: 'skipped', detail: 'سبب' });
    assert.deepEqual(requirementsTraceOutcome(null, null), { status: 'skipped', detail: 'لا محقّقَ متطلّبات على هذا المسار' });
    assert.deepEqual(requirementsTraceOutcome([{ name: 'شاشة Visitor', _kind: 'role' }, { name: 'x' }], files, 'سبب'), { status: 'skipped', detail: 'سبب — 2 متطلّب بلا مفردةٍ تُتتبَّع' });
    // 🔤 لا ذيلَ «لا يُتتبَّع» هنا؛ لكنّ الأثرَ نثرٌ (app.js في هذا الطُّعم `const rows = []`) فلا نجاح
    assert.deepEqual(requirementsTraceOutcome([{ name: 'بيانات product', _kind: 'entity' }, { name: 'شاشة customer', _kind: 'role' }], files, 'سبب'),
        { status: 'unverified', detail: '2/2 له أثر — أثرٌ لا تنفيذ؛ 2 أثرُه في نصٍّ لا يشغّله شيء: بيانات product، شاشة customer' },
        'بلا غيرِ متتبَّع: لا ذيلَ لهُ — والأثرُ لا يصل شفرةً تعمل');
    // وحين يصل الأثرُ شفرةً تعمل: نجاحٌ مكتوبٌ عليه «أثرٌ لا تنفيذ»
    assert.deepEqual(requirementsTraceOutcome([{ name: 'بيانات product', _kind: 'entity' }],
        [{ name: 'app.js', content: 'const المنتجات = []; render(المنتجات);' }], 'سبب'),
        { status: 'pass', detail: '1/1 له أثر — أثرٌ لا تنفيذ' });
    assert.deepEqual(requirementsTraceOutcome([{ name: 'بيانات product', _kind: 'entity' }, { name: 'شاشة tenant', _kind: 'role' }, { name: 'تدفّق x', _kind: 'flow' }], files, 'سبب'),
        { status: 'fail', detail: '1 متطلّب بلا أثر: شاشة tenant (1/2 له أثر — أثرٌ لا تنفيذ؛ 1 لا يُتتبَّع بالمفردات)' });
    // strategyVerdict يقرؤها بعينها: fail يُسقط الحكمَ إلى FAILED، وskipped لا يمنع PASS كما كان (deliveryVerdict)
    const ok = { ran: true, ok: true, summary: 'ok' };
    assert.equal(strategyVerdict({ filesCount: 1, behavior: ok, requirements: [{ name: 'شاشة tenant', _kind: 'role' }], files }).status, 'FAILED');
    // أثرُ «بيانات product» في هذا الطُّعم نثرٌ (`app.js` = `const rows = []`) → UNVERIFIED؛ ومع شفرةٍ تنطق به → PASS
    assert.equal(strategyVerdict({ filesCount: 1, behavior: ok, requirements: [{ name: 'بيانات product', _kind: 'entity' }], files }).status, 'UNVERIFIED');
    assert.equal(strategyVerdict({ filesCount: 1, behavior: ok, requirements: [{ name: 'بيانات product', _kind: 'entity' }],
        files: [{ name: 'app.js', content: 'const المنتجات = []; render(المنتجات);' }] }).status, 'PASS');
    assert.equal(strategyVerdict({ filesCount: 1, behavior: ok, requirements: [{ name: 'شاشة Visitor', _kind: 'role' }], files }).summary, 'guard-and-write ✓، requirements-verify –، behavior-verify ✓');
});

test('composeRequirements يسم كلَّ متطلّبٍ من الفهم بوجهه (`_kind`: role/entity/flow) — ومكوّناتُ المخطّط بلا وسمٍ فيقرّر المعجمُ وحدَه', () => {
    const m = { roles: [{ name: 'Driver' }], entities: [{ name: 'trip' }], flows: [{ name: 'حالة الرحلة' }] };
    const reqs = composeRequirements({ functionalComponents: [{ name: 'بحث' }] }, m);
    assert.deepEqual(reqs.map(r => [r.name, r._kind]), [['بحث', undefined], ['شاشة Driver', 'role'], ['بيانات trip', 'entity'], ['تدفّق حالة الرحلة', 'flow']]);
    assert.ok(reqs.slice(1).every(r => r._source === 'model'));
});

test('المسارُ كاملاً: وثيقةُ نقاطِ البيع على مجلّدٍ فارغ → كلون نقاط البيع → الحكمُ FAILED بأسماء ما طُلب ولا أثرَ له، في السجلّ وفي الشات — لا «✅ اكتمل» بحكم PASS', async () => {
    const s = scenario('pm7pos'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] }); // لا وراثةَ من جولةٍ سابقة
    try {
        const r = await s.rt._runMissionNow(SPEC, createExecutionContext({ ...s.ctx, projectPath: emptyProject(), agents: {} }));
        assert.equal(r.clone, 'jaola-pos'); assert.equal(r.success, true, 'المهمّةُ اكتملت — الحكمُ على المنتج شيءٌ آخر');
        assert.equal(r.verdict.status, 'FAILED', JSON.stringify(r.verdict));
        // PM/9: الوثيقةُ المرقّمة تُحاكَم بلغتها — بنودُها بعينها ومفاهيمُ الفهم ذيلاً (٧/١٠)
        // PM/21: ٣١/٤٤ ← ٢٦/٣٦ — أسطرُ «المرحلة N» جدولُ تسليمٍ لا مطالب، والحكمُ يقول لمَ نقص المقام.
        assert.equal(gate(r.verdict, 'requirements-verify').detail,
            '26 بنداً من 36 في وثيقتك بلا أثر: 1 الصلاحيات والأدوار (RBAC)، 3 الباركود، 7 المرتجعات، 8 دفتر المخزون، 9 المشتريات، 10 الموردون +20 (10/36 له أثر — أثرٌ لا تنفيذ؛ مفاهيمُ الفهم 8/10؛ 8 من أسطر خطّة التسليم لا تُحسَب (لا تُبنى))');   // PM/25: مفاهيمُ الفهم ٧ ← ٨ — أدوارُ صاحبِ الوثيقة يمثّلها الكلونُ فعلاً، بخلاف «customer/tenant» معجمِنا
        assert.match(s.logs(), /\[Judge\]: ⚖️ الحكم: FAILED — guard-and-write ✓، requirements-verify ✗، behavior-verify ✗/);
        // 👥 PM/25: فجوتان بأسماءِ معجمِنا ← فجوةٌ واحدةٌ باسمِ صاحبِ الوثيقة. وهي أصدق: الكلونُ
        //    يمثّل «مالك النظام» و«مدير الفرع» و«الكاشير»، ولا يمثّل «أمين المخزن» — وهذا ما يُقال له.
        assert.equal(gate(r.verdict, 'behavior-verify').detail, 'ثغراتٌ باقية: أدوار بلا واجهة/تمثيل: أمين المخزن', 'والسلوكُ يقول الشيءَ نفسَه من جهته بأسماء الأدوار (PM/10) لا باسم فحصه');
        const msg = s.replies().find(m => m.includes('بدأنا من قالب'));
        assert.match(msg, /^⚠️ اكتمل — بدأنا من قالب/);
        // 🗓️ PM/21: ٤٤ ← ٣٦ — أسطرُ «المرحلة N» جدولُ تسليمٍ لا مطالب، فتخرج من البسط والمقام معاً.
        assert.match(msg, /\n⚠️ التحقّق وجد ثغرات — requirements-verify: 26 بنداً من 36 في وثيقتك بلا أثر: 1 الصلاحيات والأدوار \(RBAC\)، 3 الباركود/);
        // الفهمُ المدمَج هو ما حُوكم إليه: أدوارُ الوثيقة الأربعة وكياناتُها الستّة + نموذجُ الكلون
        const stored = getDomainModel(s.ctx.username, s.ctx.activeProject);
        for (const n of ['مالك النظام', 'مدير الفرع', 'الكاشير', 'أمين المخزن']) assert.ok(stored.roles.some(x => x.name === n), n);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('مسارُ React: فهمٌ لا تنطق به المعاينةُ الثابتة → fail بأسمائه؛ وبلا فهمٍ → skipped بسببه المكتوب (لا «لا ينطبق» حتميّاً)', async () => {
    const run = async (prefix, model) => {
        const s = scenario(prefix); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
        transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
        setDomainModel(s.ctx.username, s.ctx.activeProject, model);
        try { const { reporter } = collect(); return await buildReactProject('مطعم البحر للمأكولات البحرية', { ...s.ctx, projectPath: dir }, { sections: ['الرئيسية', 'القائمة', 'تواصل'] }, reporter); }
        finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
    };
    const mismatch = await run('pm7rxm', { roles: [{ name: 'Driver' }], entities: [{ name: 'trip' }], flows: [{ name: 'حالة الرحلة' }] });
    assert.equal(mismatch.verdict.status, 'FAILED');
    assert.equal(gate(mismatch.verdict, 'requirements-verify').detail, '2 متطلّب بلا أثر: شاشة Driver، بيانات trip (0/2 له أثر — أثرٌ لا تنفيذ؛ 1 لا يُتتبَّع بالمفردات)');
    const none = await run('pm7rxn', { roles: [], entities: [], flows: [] });
    assert.deepEqual(gate(none.verdict, 'requirements-verify'), { name: 'requirements-verify', status: 'skipped', detail: 'مسارُ React — لا متطلّباتٍ من الفهم' });
    assert.equal(none.verdict.status, 'PASS');
});

test('الحدود: البناةُ الثلاثة يمرّرون requirements وfiles إلى strategyVerdict؛ الحكمُ يستورد المتتبِّعَ من المحقّق؛ والمتتبِّعُ يقرأ معجمَ projectModel لا قائمةً ثانية', () => {
    const src = (f) => fs.readFileSync(path.join(HERE, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    // PM/8: المتطلّباتُ تُؤلَّف مرّةً في الكلون (جولةُ الإكمال ثمّ الحكم) — المتغيّرُ نفسُه يصل الحكم
    const clone = src('../agents/stages/buildFromClone.js');
    // PM/15: الحكمُ يقرأ ما بُني كلَّه (`readBuiltFiles`) لا الصفحةَ وما تُحمّله — والقارئُ القائمُ يبقى للتعديل
    assert.ok(clone.includes('const requirements = composeRequirements(null, model);') && clone.includes('requirements, files: await readBuiltFiles(projectPath),'));
    assert.ok(src('../agents/stages/buildFromRegistry.js').includes('requirements: composeRequirements(null, registryModel), files,'));
    assert.ok(src('../agents/stages/buildReact.js').includes('requirements: composeRequirements(null, getDomainModel(username, activeProject)), files: await readBuiltFiles(projectPath),'));
    const verify = src('../agents/stages/verify.js');
    assert.ok(verify.includes("import { traceRequirements, traceSections, sectionLabel } from '../requirementsVerifier.js';"), 'PM/9 أضاف متتبِّعَ البنود وتسميتَها');
    assert.equal((verify.match(/requirementsTraceOutcome\(/g) || []).length, 2, 'تعريفٌ + نداءٌ واحد في strategyVerdict');
    const rv = src('../agents/requirementsVerifier.js');
    assert.ok(rv.includes("import { conceptOf, conceptKind, conceptsInText, isGenericConcept, normalizeConceptText, productText } from './projectModel.js';"), 'PM/9: التطبيعُ نفسُه لمفردات البنود؛ وPM/14: الإسقاطُ نفسُه للمتتبِّعَين');
    assert.equal((rv.match(/productCorpus\(files\)/g) || []).length, 2, 'PM/14: المتتبِّعان يقرآن نصَّ المنتج لا نصَّ الملفّ');
    // #١٩٨: الوسمُ يُكتب مرّةً ويُقرأ مرّة — والقراءةُ صارت في متغيّرٍ واحدٍ (`isFlow`) يُستهلك مرّتين.
    assert.equal((rv.match(/_kind/g) || []).length, 2, 'الوسمُ يُكتب مرّةً ويُقرأ مرّة');
    // #١٩٨: مطابقتان بسؤالَين مختلفَين، لكلٍّ مستهلكٌ واحدٌ ومكتوب:
    //   `matchTokens` حرفيّةٌ على حدّ كلمة — لبنود الوثيقة، وعناوينُها تُعاد بنصّها (PM/9، مقيسٌ صحيح).
    //   `matchTerm`   بصرفِ العربيّة — لمصطلح النموذج، وهو يظهر في الصفحة مصرَّفاً.
    // وقاعدةُ اللواصق نفسُها لها **موضعٌ واحد** في الشجرة: `keywordMatches`.
    // ولم تُوحَّد الاثنتان: تحويلُ بنود الوثيقة إلى الصرف يُرخي حارساً مقيساً، وذلك قياسٌ مستقلّ.
    assert.equal((rv.match(/matchTokens\(/g) || []).length, 2, 'تعريفٌ + مستهلكٌ واحد (بنودُ الوثيقة)');
    assert.equal((rv.match(/matchTerm\(/g) || []).length, 2, 'تعريفٌ + مستهلكٌ واحد (مصطلحُ النموذج)');
    assert.equal((rv.match(/keywordMatches\(/g) || []).length, 2, 'قاعدةُ اللواصق تُستورَد ولا تُنسَخ');
});

// ══════════════════════════════════════════════════════════════════════════════
// #١٩٨ — نصفُ ما يشتقّه الفهمُ من كلام صاحب المشروع كان يسقط من الحكم صامتاً
//
// قِيس على ثمانية مجالاتٍ عربيّة (٤٨ اسمَ كيانٍ ودور): المعجمُ يعرف **٢٢ فقط (٤٦٪)**،
// والباقي يخرج من البسط والمقام معاً. صيدليّة ٣/٦، ورشةُ سيارات ٢/٦، مزرعة ١/٦.
// والقاعدةُ السابعة في CLAUDE.md تسمّي هذا: قائمةٌ مغلقة تحكم على نصٍّ كتبه إنسان.
// ══════════════════════════════════════════════════════════════════════════════
test('#١٩٨: مصطلحُ صاحب المشروع خارجَ المعجم يُحاكَم بمفرداته — لا يخرج من العدّ صامتاً', () => {
    const files = [
        { name: 'index.html', content: '<h1>صيدلية</h1><section>الوصفات</section><section>المخزون</section><script src="s.js"></script>' },
        { name: 's.js', content: "const وصفات=[{اسم:'x'}]; const مخزون=[]; render(وصفات, مخزون);" },
    ];
    const reqs = composeRequirements(null, { entities: [{ name: 'وصفة' }, { name: 'مخزون' }, { name: 'تأمين' }], roles: [], flows: [] });
    // `_term` يحمل كلمتَه كما اشتُقّت — مجرّدةً من إطارِنا «بيانات»
    assert.deepEqual(reqs.map(r => r._term), ['وصفة', 'مخزون', 'تأمين']);
    const t = traceRequirements(reqs, files);
    // «وصفة» تُطابق «الوصفات» و«مخزون» تُطابق «المخزون» — صرفاً لا حرفاً
    assert.deepEqual(t.traced, ['بيانات وصفة', 'بيانات مخزون'], JSON.stringify(t));
    assert.deepEqual(t.unmatched, ['بيانات تأمين'], 'غائبٌ تماماً: يُقال ولا يُتَّهم');
    assert.deepEqual(t.untraceable, [], 'لا صمت');
});

test('#١٩٨: العامُّ واحتياطُنا يبقيان خارج الحكم — الانفتاحُ لكلمته لا لكلماتنا', () => {
    const files = [{ name: 'index.html', content: '<h1>صفحة تسويقية</h1>' }];
    // `Visitor` يفبركه مسارُ Registry حين لا فهم؛ والمعجمُ يردّه إلى `user` وهو عامّ
    const t = traceRequirements(composeRequirements(null, { roles: [{ name: 'Visitor' }], entities: [], flows: [] }), files);
    assert.deepEqual(t.untraceable, ['شاشة Visitor'], JSON.stringify(t));
    assert.deepEqual([...t.missing, ...t.unmatched], [], 'لا يُحكَم على بناءٍ بمتطلّبٍ اخترعناه');
});

test('#١٩٨: المعجمُ يبقى صاحبَ الكلمة حيث ينطق — المرادفُ لا يبلغه المقياسُ المفتوح', () => {
    // «زبون» في النموذج و«عميل» في الصفحة: مفهومٌ واحد. المطابقةُ الحرفيّةُ تعجز، والمعجمُ لا يعجز.
    const files = [{ name: 'index.html', content: '<h1>العميل</h1><script src="s.js"></script>' }, { name: 's.js', content: 'const عملاء=[];' }];
    const t = traceRequirements(composeRequirements(null, { roles: [{ name: 'زبون' }], entities: [], flows: [] }), files);
    assert.deepEqual(t.traced, ['شاشة زبون'], JSON.stringify(t));
});

test('#١٩٩: جمعُ التكسير الموثَّق يُطابَق — «كتاب» يتتبّع «الكتب» بمعجم Arramooz لا باشتقاق', () => {
    const files = [{ name: 'index.html', content: '<h1>فهرس الكتب</h1>' }];
    const t = traceRequirements(composeRequirements(null, { entities: [{ name: 'كتاب' }], roles: [], flows: [] }), files);
    assert.deepEqual(t.unmatched, [], 'صار له أثر — المعجم يعرف الجمعَ المكسَّر');
    assert.deepEqual(t.missing, [], 'النفيُ يحتاج يقيناً');
    assert.deepEqual(t.traced, ['بيانات كتاب'], JSON.stringify(t));
    const o = requirementsTraceOutcome(composeRequirements(null, { entities: [{ name: 'كتاب' }], roles: [], flows: [] }), files, 'n');
    assert.equal(o.status, 'unverified', o.detail); // decorative: الأثر في نثرٍ لا يشغّله سطرُ شفرة
    assert.match(o.detail, /أثرُه في نصٍّ لا يشغّله شيء: بيانات كتاب/, o.detail);
});

test('#١٩٩: ما بقي خارج معجم جمع التكسير يبقى «لم أتتبّعه» — لا يُدَّعى غيابُه', () => {
    const files = [{ name: 'index.html', content: '<h1>صفحةٌ عن شيءٍ آخر</h1>' }];
    const t = traceRequirements(composeRequirements(null, { entities: [{ name: 'زبرجد' }], roles: [], flows: [] }), files);
    assert.deepEqual(t.unmatched, ['بيانات زبرجد'], 'لم أتتبّعه — لا «بلا أثر»');
    assert.deepEqual(t.missing, [], 'النفيُ يحتاج يقيناً');
});
