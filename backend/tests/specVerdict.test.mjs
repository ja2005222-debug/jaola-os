// 📋 PM/9 — «الحكمُ بلغة الوثيقة» (`PRODUCT_MIND.md`): بعد PM/6–8 أعيد قياسُ مواصفة نقاط البيع عبر المسار كاملاً — الفهمُ ٦/٤،
// الاختيارُ jaola-pos، الحكمُ FAILED «٣ متطلّبات بلا أثر» — بينما في كلمات المستخدم نفسِه ٤٤ بنداً مرقّماً، ١٣ منها فقط له أثرٌ
// بمفردات عنوانه في ملفّات الكلون. المعجمُ يرى ما يعرفه؛ الوثيقةُ تعرف ما طُلب. هنا: بنودُ الوثيقة تُقرأ كما كُتبت (`specSections`)،
// وتُتتبَّع بمفرداتها (`traceSections`)، والحكمُ يسمّي الغائبَ برقمه وعنوانه، والإكمالُ يطلبه بنصّه لا بصياغةٍ عامّة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
process.env.MISSION_LEDGER_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pm9-ledger-')), 'mission_ledger.json');
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { setUserLanguage } = await import('../agents/languageDetector.js');
const { specSections, isFullSpecification } = await import('../agents/textNormalizer.js');
const { traceSections, sectionLabel, buildSectionFixInstruction } = await import('../agents/requirementsVerifier.js');
const { requirementsTraceOutcome, strategyVerdict } = await import('../agents/stages/verify.js');
const { buildFromClone } = await import('../agents/stages/buildFromClone.js');
const { getCloneById } = await import('../agents/cloneTemplates/index.js');
const { deriveProjectModel } = await import('../agents/projectModel.js');
const { setDomainModel } = await import('../agents/projectMemory.js');
const { RoomReporter } = await import('../core/runtime/RoomReporter.js');
const { transitionState, resetProjectState, STATES } = await import('../agents/stateMachine.js');
const { divertConsoleToStderr } = await import('./helpers/reportChannel.mjs');

divertConsoleToStderr();
const HERE = import.meta.dirname;
const SPEC = fs.readFileSync(path.join(HERE, 'fixtures/pos_spec.txt'), 'utf8');
const POS = getCloneById('jaola-pos');
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const reply = (events) => events.find(([ev]) => ev === 'chat_reply')[1].message;
const gate = (v, name) => v.gates.find(g => g.name === name);

test('specSections: البنودُ كما كُتبت — ٤٤ بنداً برقمٍ وعنوانٍ ومتن؛ أرقامٌ عربيّة؛ جملةٌ بلا ترقيم → لا بنود', () => {
    const secs = specSections(SPEC);
    assert.equal(secs.length, 44); assert.ok(isFullSpecification(SPEC));
    assert.deepEqual(secs[2], { n: 3, title: 'الباركود:', body: '- قراءة الباركود بالماسح وبالكاميرا، وتوليد الباركود وطباعته للمنتجات.' });
    assert.equal(secs[0].n, 1); assert.equal(secs[43].n, 44); assert.match(secs[43].title, /^المرحلة 8/);
    assert.deepEqual(specSections('٣. الباركود:\nمسح\n\n٤) الدفع'), [{ n: 3, title: 'الباركود:', body: 'مسح' }, { n: 4, title: 'الدفع', body: '' }]);
    assert.deepEqual(specSections('غيّر اللون إلى أزرق'), []); assert.deepEqual(specSections(''), []);
});

test('traceSections على كلون نقاط البيع: ١٣ من ٤٤ له أثرٌ بمفردات عنوانه، ٣١ بلا أثر بأسمائها — والعنوانُ من كلمات الإطار وحدَها لا يُتتبَّع', () => {
    const t = traceSections(specSections(SPEC), POS.files);
    assert.equal(t.traced.length, 13); assert.equal(t.missing.length, 31); assert.deepEqual(t.untraceable, []);
    assert.deepEqual(t.missing.slice(0, 8).map(sectionLabel), ['1 الصلاحيات والأدوار (RBAC)', '3 الباركود', '7 المرتجعات', '8 دفتر المخزون', '9 المشتريات', '10 الموردون', '11 العملاء', '12 الخصومات']);
    assert.ok(t.traced.some(x => x.n === 4) && t.traced.some(x => x.n === 6), 'شاشة الكاشير والفواتير لهما أثر');
    const u = traceSections([{ n: 1, title: 'النظام:' }, { n: 2, title: 'دعم كل النظام' }, { n: 3, title: 'الباركود' }, { n: 4, title: 'دعم كل شيء' }], [{ name: 'a.js', content: 'باركود' }]);
    assert.deepEqual({ t: u.traced.map(sectionLabel), m: u.missing.map(sectionLabel), u: u.untraceable.map(sectionLabel) }, { t: ['3 الباركود'], m: ['4 دعم كل شيء'], u: ['1 النظام', '2 دعم كل النظام'] }, '«شيء» مفردةٌ حقيقيّة فتُتتبَّع ولا تُوجَد');
    assert.deepEqual(traceSections([], POS.files), { traced: [], missing: [], untraceable: [] });
});

test('buildSectionFixInstruction: البنودُ بنصّها كما كُتبت، ثمانيةٌ في الجولة وبقيّتُها مذكورة، وإرشادُ النموذج — وبلا بنودٍ لا تعليمة', () => {
    const secs = specSections(SPEC); const t = traceSections(secs, POS.files);
    const i = buildSectionFixInstruction(t.missing, secs, { roles: [{ name: 'staff' }], entities: [{ name: 'product' }] });
    assert.match(i, /^نفّذ البنودَ التالية من مواصفة المستخدم/);
    assert.ok(i.includes('3. الباركود:\n- قراءة الباركود بالماسح وبالكاميرا'), 'المتنُ كما كُتب');
    assert.ok(i.includes('12. الخصومات:') && !i.includes('13. الضريبة'), 'ثمانيةٌ فقط بترتيب الوثيقة');
    assert.ok(i.includes('(وبقي 23 بنداً لجولةٍ لاحقة.)')); assert.ok(i.includes('الأدوار [staff] والكيانات [product]'));
    assert.equal(buildSectionFixInstruction([], secs), '');
    assert.ok(!buildSectionFixInstruction(t.missing.slice(0, 2), secs, null).includes('نموذج المشروع'), 'بلا نموذج لا إرشاد');
});

test('requirementsTraceOutcome بوثيقة: fail برقمٍ وعنوان (ستّةٌ ثمّ +N) ضمن ٣٠٠ حرف؛ pass حين تنطق الملفّاتُ بالبنود كلِّها؛ ومفاهيمُ الفهم ذيلاً؛ وبلا بنودٍ صالحة يعود إلى المعجم', () => {
    const secs = specSections(SPEC);
    const f = requirementsTraceOutcome([{ name: 'شاشة customer', _kind: 'role' }, { name: 'بيانات product', _kind: 'entity' }], POS.files, 'n', secs);
    assert.equal(f.status, 'fail'); assert.ok(f.detail.length <= 300, String(f.detail.length));
    assert.equal(f.detail, '31 بنداً من 44 في وثيقتك بلا أثر: 1 الصلاحيات والأدوار (RBAC)، 3 الباركود، 7 المرتجعات، 8 دفتر المخزون، 9 المشتريات، 10 الموردون +25 (13/44 له أثر — أثرٌ لا تنفيذ؛ مفاهيمُ الفهم 1/2)');
    const all = [{ name: 'index.html', content: secs.map(s => s.title).join(' ') }];
    assert.deepEqual(requirementsTraceOutcome(null, all, 'n', secs), { status: 'pass', detail: '44/44 بنداً من وثيقتك له أثر — أثرٌ لا تنفيذ' });
    assert.deepEqual(requirementsTraceOutcome([{ name: 'بيانات product', _kind: 'entity' }], [{ name: 'a.js', content: 'منتج' }], 'n', [{ n: 1, title: 'النظام:' }]),
        { status: 'pass', detail: '1/1 له أثر — أثرٌ لا تنفيذ' }, 'بنودٌ كلُّها كلماتُ إطار → المعجمُ يحكم');
    assert.deepEqual(requirementsTraceOutcome(null, [], 'n', secs), { status: 'skipped', detail: 'n' });
    assert.equal(strategyVerdict({ filesCount: 3, behavior: { ran: true, ok: true, summary: 'ok' }, files: POS.files, sections: secs }).status, 'FAILED');
});

test('الكلون بوثيقة: الإكمالُ يطلب البنودَ بنصّها، ورقعةٌ تُعطي أثراً لثلاثةٍ → «أُكمل من وثيقتك (3/31)» والحكمُ يعدّ ما بقي بلغة الوثيقة', async () => {
    const s = scenario('pm9clone'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    setDomainModel(s.ctx.username, s.ctx.activeProject, await deriveProjectModel(SPEC, { kind: 'webapp' }));
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
    let seen = '';
    const complete = async (instruction, files) => {
        seen = instruction; const idx = files.find(f => f.name === 'index.html');
        return { ok: true, applied: 1, files: [{ name: 'index.html', content: idx.content.replace('</body>', '<section id="pm9"><h2>الباركود · المرتجعات · المخزون</h2></section></body>') }] };
    };
    try {
        const { events, reporter } = collect();
        const r = await buildFromClone(POS, SPEC, { ...s.ctx, projectPath: dir }, reporter, { complete });
        assert.ok(seen.includes('3. الباركود:\n- قراءة الباركود بالماسح') && seen.includes('(وبقي 23 بنداً لجولةٍ لاحقة.)'), 'التعليمةُ من نصّ الوثيقة');
        const L = logs(events).filter(l => l.includes('CloneCompletion'));
        assert.match(L[0], /🏗️ إكمالُ ما لا أثرَ له من وثيقتك \(31 بنداً؛ تُطلب أوّلُ 8 بنصّها\): 1 الصلاحيات والأدوار \(RBAC\)، 3 الباركود/);
        assert.equal(L[1], '[5. RUNTIME] ➔ [CloneCompletion]: ✅ أُكمل من وثيقتك (3/31): 3 الباركود، 7 المرتجعات، 8 دفتر المخزون — وبقي بلا أثر 28 بنداً.');
        assert.equal(gate(r.verdict, 'requirements-verify').detail, '28 بنداً من 44 في وثيقتك بلا أثر: 1 الصلاحيات والأدوار (RBAC)، 9 المشتريات، 10 الموردون، 11 العملاء، 12 الخصومات، 13 الضريبة +22 (16/44 له أثر — أثرٌ لا تنفيذ؛ مفاهيمُ الفهم 7/10)');
        assert.match(reply(events), /\n🏗️ أُكمل تلقائيّاً على القالب: 3 الباركود، 7 المرتجعات، 8 دفتر المخزون\.\n⚠️ التحقّق وجد ثغرات — requirements-verify: 28 بنداً من 44/);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('الحدود: الكلونُ وReact يمرّران بنودَ الوثيقة إلى الحكم، والوثيقةُ وحدَها تُشغّل فرعَها، والبنودُ تُقرأ من textNormalizer', () => {
    const src = (f) => fs.readFileSync(path.join(HERE, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const clone = src('../agents/stages/buildFromClone.js');
    assert.ok(clone.includes('const sections = isFullSpecification(goal) ? specSections(goal) : [];') && clone.includes('requirements, files: await readProjectFiles(projectPath), sections,'));
    assert.ok(clone.includes("import { isExplicitNewBuild, isFullSpecification, specSections } from '../textNormalizer.js';"));
    assert.ok(src('../agents/stages/buildReact.js').includes('sections: isFullSpecification(goal) ? specSections(goal) : [],'));
    assert.ok(!src('../agents/stages/buildFromRegistry.js').includes('specSections'), 'البروشورُ ليس وثيقة');
    const verify = src('../agents/stages/verify.js');
    assert.ok(verify.includes('if (sections?.length && files?.length) {') && verify.includes("import { traceRequirements, traceSections, sectionLabel } from '../requirementsVerifier.js';"));
    assert.ok(src('../agents/requirementsVerifier.js').includes('export function traceSections(sections, files) {'));
});
