// 🏗️ PM/8 — «الحكمُ يسمّي الفجوةَ ثمّ يسدّها» (`PRODUCT_MIND.md`): بعد PM/7 صار الكلونُ يقول للمستخدم «٣ متطلّب بلا أثر: customer،
// tenant، account» — ويقف. قِيس قبل الكتابة: بوّابةُ الإكمال في الحلقة (`requirementsVerify` → `coreEditCodePlan`) تعيد الملفَّ
// كاملاً بعد قصّ مدخله عند ٨٠٠٠ حرف، و`app.js` في الكلونات ١٣–١٥ ألفاً — عينُ «الملف الكبير يُبتَر فتُفقد الدوال» الممنوع في الكلون.
// هنا: جولةُ إكمالٍ **واحدة** بالرقعة الموضعيّة (`patchEditPlan`، حقنٌ للاختبار) بحارس البصمة نفسِه — فقدُ دالّة أو عطلٌ جديد →
// استرجاعُ ما كان على القرص؛ وما أُكمل يُقال للمستخدم بالاسم، وما بقي يقوله الحكمُ كما يقيسه.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
process.env.MISSION_LEDGER_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pm8-ledger-')), 'mission_ledger.json');
const { scenario, emptyProject } = await import('./helpers/jcrScenario.mjs');
const { createExecutionContext } = await import('../core/runtime/ExecutionContext.js');
const { setUserLanguage } = await import('../agents/languageDetector.js');
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
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const reply = (events) => events.find(([ev]) => ev === 'chat_reply')[1].message;
const gate = (v, name) => v.gates.find(g => g.name === name);
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

/** بناءٌ حقيقيّ لكلون نقاط البيع على فهم الوثيقة (PM/6) بمُكمِلٍ محقون. */
async function buildPos(prefix, complete) {
    const s = scenario(prefix); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    setDomainModel(s.ctx.username, s.ctx.activeProject, await deriveProjectModel(SPEC, { kind: 'webapp' }));
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
    const { events, reporter } = collect();
    try { const r = await buildFromClone(getCloneById('jaola-pos'), SPEC, { ...s.ctx, projectPath: dir }, reporter, complete ? { complete } : {}); return { r, events, dir }; }
    finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
}
const SECTION = (names) => `\n<section id="pm8"><h2>${names.join(' · ')}</h2></section>\n`;
/** مُكمِلٌ يضيف قسماً بمفردات المطلوب إلى index.html فقط (كما تفعل رقعةٌ موضعيّة سليمة). */
const adder = (names) => async (instruction, files) => {
    const idx = files.find(f => f.name === 'index.html');
    return { ok: true, applied: 1, files: [{ name: 'index.html', content: idx.content.replace('</body>', `${SECTION(names)}</body>`) }] };
};

test('القياسُ قبل الكتابة: بوّابةُ الإكمال في الحلقة تقصّ المدخلَ عند ٨٠٠٠ حرف وتعيد الملفَّ كاملاً — وapp.js في الكلونات أكبرُ من ذلك، فلا يُعاد استعمالُها على الكلون', () => {
    const coder = fs.readFileSync(path.join(HERE, '../agents/coderAgent.js'), 'utf8');
    assert.ok(coder.includes("(f.content || '').slice(0, 8000)"), 'القصُّ عند ٨٠٠٠ حرف قائم');
    assert.ok(coder.includes('أعِد **فقط الملفات التي تغيّرت فعلاً**، كل ملف كاملاً'), 'وإعادةُ الملفّ كاملاً هي الصيغة');
    for (const id of ['jaola-pos', 'jaola-store']) {
        const app = getCloneById(id).files.find(f => f.name === 'app.js');
        assert.ok(app.content.length > 8000, `${id}: app.js ${app.content.length} حرفاً — يُبتَر`);
    }
    const stage = fs.readFileSync(path.join(HERE, '../agents/stages/requirementsVerify.js'), 'utf8');
    assert.ok(stage.includes('agents.coreEditCodePlan(') && !stage.includes('patchEditPlan'), 'حلقةُ الإكمال هناك بإعادة الكتابة لا بالرقعة');
});

test('جولةُ إكمالٍ واحدة: ما لا أثرَ له يُطلب بالاسم وبسلوكه المطلوب، على ملفّات القرص كلِّها؛ رقعةٌ سليمة → «أُكمل» في السجلّ والشات، والحكمُ يقول ما بقي', async () => {
    const seen = [];
    const { r, events, dir } = await buildPos('pm8ok', async (instruction, files, lang) => { seen.push({ instruction, names: files.map(f => f.name).sort(), lang }); return adder(['العميل', 'المستأجر'])(instruction, files); });
    assert.equal(seen.length, 1, 'نداءٌ واحد — لا حلقة');
    assert.deepEqual(seen[0].names, ['app.js', 'index.html', 'styles.css']); assert.equal(seen[0].lang, 'ar');
    assert.match(seen[0].instruction, /1\. شاشة customer: قسمٌ\/صفحةٌ مستقلّة للدور «customer» تعمل فعلاً/);
    assert.match(seen[0].instruction, /2\. شاشة tenant: /); assert.match(seen[0].instruction, /3\. بيانات account: تمثيلٌ فعليّ للكيان «account»/);
    assert.match(seen[0].instruction, /نموذج المشروع: الأدوار \[staff، customer، admin، tenant\]/, 'وإرشادُ النموذج المدمَج');
    const L = logs(events).filter(l => l.includes('CloneCompletion'));
    assert.deepEqual(L, [
        '[5. RUNTIME] ➔ [CloneCompletion]: 🏗️ إكمالُ ما لا أثرَ له (3): شاشة customer، شاشة tenant، بيانات account — رقعةٌ موضعيّة، لا إعادةَ كتابة.',
        '[5. RUNTIME] ➔ [CloneCompletion]: ✅ أُكمل (2/3): شاشة customer، شاشة tenant — وبقي بلا أثر: بيانات account.',
    ]);
    assert.ok(read(dir, 'index.html').includes('<section id="pm8">'), 'الرقعةُ على القرص');
    // ٤ لا ٥: النداءُ المباشر يمرّ بمخطّطٍ بلا مكوّنات فلا تدفّقَ «الفعل الأساسي» — في المسار الكامل خمسة (اختبارُ المسار أدناه)
    assert.equal(gate(r.verdict, 'requirements-verify').detail, '1 متطلّب بلا أثر: بيانات account (9/10 له أثر — أثرٌ لا تنفيذ؛ 4 لا يُتتبَّع بالمفردات)');
    assert.equal(r.verdict.status, 'FAILED');
    const msg = reply(events);
    assert.match(msg, /^⚠️ اكتمل — بدأنا من قالب/);
    assert.match(msg, /\n🏗️ أُكمل تلقائيّاً على القالب: شاشة customer، شاشة tenant\.\n⚠️ التحقّق وجد ثغرات — requirements-verify: 1 متطلّب بلا أثر: بيانات account/);
});

test('رقعةٌ تسدّ الثلاثةَ → requirements-verify pass «10/10 له أثر»؛ والسلوكُ يحكم من جهته على ما وصل القرص', async () => {
    const { r, events } = await buildPos('pm8all', adder(['العميل', 'المستأجر', 'الحساب']));
    assert.equal(gate(r.verdict, 'requirements-verify').status, 'pass');
    assert.equal(gate(r.verdict, 'requirements-verify').detail, '10/10 له أثر — أثرٌ لا تنفيذ؛ 4 لا يُتتبَّع بالمفردات');
    assert.match(logs(events).find(l => l.includes('✅ أُكمل')), /✅ أُكمل \(3\/3\): شاشة customer، شاشة tenant، بيانات account\.$/);
    assert.match(reply(events), /\n🏗️ أُكمل تلقائيّاً على القالب: شاشة customer، شاشة tenant، بيانات account\.\n/);
});

test('حارسُ الارتداد: رقعةٌ تُفقد دالّةً أو تُدخل عطلاً سلوكيّاً جديداً → استرجاعُ ما كان على القرص حرفاً بحرف، ولا «أُكمل» في الشات، والحكمُ كما كان (٣ بلا أثر)', async () => {
    const cases = [
        // «تبسيطٌ» يحذف ميزةً ونداءها معاً (جذرُ «حُذفت المحاسبة»): لا خطأَ ربطٍ يراه السلوك — عقدُ الحفظ وحدَه يراه
        ['pm8lost', async (i, files) => { const app = files.find(f => f.name === 'app.js');
            const withoutFn = app.content.replace(/function csvDownload\([^]*?\n\}\n/, '').replace(/csvDownload\([^;]*\);/, '/* removed */;');
            assert.ok(!withoutFn.includes('csvDownload'), 'الميزةُ ونداؤها أُزيلا معاً');
            return { ok: true, applied: 2, files: [{ name: 'app.js', content: withoutFn }, ...(await adder(['العميل', 'المستأجر', 'الحساب'])(i, files)).files] }; }, /↩️ الإكمالُ أدخل عطلاً \(فقد دوال \(csvDownload، csv، blob\)\)/],
        ['pm8break', async (i, files) => { const idx = files.find(f => f.name === 'index.html');
            return { ok: true, applied: 1, files: [{ name: 'index.html', content: idx.content.replace('</body>', `${SECTION(['العميل', 'المستأجر', 'الحساب'])}<button onclick="pm8Missing()">x</button></body>`) }] }; }, /↩️ الإكمالُ أدخل عطلاً \(فشل جديد: /],
    ];
    for (const [prefix, complete, why] of cases) {
        const { r, events, dir } = await buildPos(prefix, complete);
        const L = logs(events).filter(l => l.includes('CloneCompletion'));
        assert.equal(L.length, 2, L.join('\n')); assert.match(L[1], why);
        assert.ok(!read(dir, 'index.html').includes('pm8'), `${prefix}: الرقعةُ استُرجعت`);
        assert.ok(read(dir, 'app.js').includes('function csvDownload('), `${prefix}: app.js كما كان`);
        assert.equal(gate(r.verdict, 'requirements-verify').detail, '3 متطلّب بلا أثر: شاشة customer، شاشة tenant، بيانات account (7/10 له أثر — أثرٌ لا تنفيذ؛ 4 لا يُتتبَّع بالمفردات)');
        assert.ok(!reply(events).includes('أُكمل تلقائيّاً'), `${prefix}: لا ادّعاءَ إكمال`);
    }
});

test('الحارسُ قبل الكتابة: رقعةٌ أسقطت رابطَ التنسيق وDOCTYPE تُصحَّح (ensureEditIntegrity) فتبقى الصفحةُ بتصميمها؛ ورقعةٌ «ناجحة» بلا ملفّات تُعدّ غيرَ مطبَّقة', async () => {
    const dropped = await buildPos('pm8guard', async (i, files) => { const idx = files.find(f => f.name === 'index.html');
        const content = idx.content.replace(/^\s*<!doctype html>\s*/i, '').replace(/<link[^>]*styles\.css[^>]*>\s*/i, '').replace('</body>', `${SECTION(['العميل', 'المستأجر', 'الحساب'])}</body>`);
        assert.ok(!/styles\.css/.test(content) && !/<!doctype/i.test(content));
        return { ok: true, applied: 1, files: [{ name: 'index.html', content }] }; });
    const html = read(dropped.dir, 'index.html');
    assert.match(html, /^<!DOCTYPE html>/); assert.ok(html.includes('<section id="pm8">'));
    assert.ok(logs(dropped.events).some(l => /\[CodeGuard\].*DOCTYPE/.test(l)), logs(dropped.events).filter(l => l.includes('CodeGuard')).join('\n'));
    // 📏 حقيقةٌ مقيسة (ديْنٌ مكتوب في CONTRACTS): رابطُ التنسيق المحلّيّ **لا** يُستعاد على كلونٍ ملمَّع — شرطُ الاستعادة في
    // `ensureEditIntegrity` هو «لا روابطَ ولا <style>» بينما باقةُ التلميع تحقن <style data-jaola-polish> وروابطَ خطوطٍ بعيدة، فيظنّ الحارسُ الصفحةَ منسَّقة
    assert.ok(!/href="styles\.css"/.test(html), 'يُثبَّت كما قِيس — إصلاحُه في codeGuard قرارٌ لا انزلاق');
    assert.equal(gate(dropped.r.verdict, 'requirements-verify').status, 'pass');
    const empty = await buildPos('pm8empty', async () => ({ ok: true, applied: 0, files: [] }));
    const E = logs(empty.events).filter(l => l.includes('CloneCompletion'));
    assert.equal(E.length, 2, E.join('\n')); assert.match(E[0], /🏗️ إكمالُ ما لا أثرَ له \(3\)/); assert.match(E[1], /ℹ️ لم تُطبَّق رقعةٌ \(لا مزوّد أو لا مطابقة\)/);
});

test('بلا مزوّد (الافتراضُ patchEditPlan): يُطلب الإكمالُ ثمّ يُقال إنّ الرقعةَ لم تُطبَّق — والحكمُ FAILED بالأسماء كما في PM/7؛ وبلا فجوةٍ (متجرٌ) لا نداءَ ولا سطر', async () => {
    const { r, events } = await buildPos('pm8none');
    assert.deepEqual(logs(events).filter(l => l.includes('CloneCompletion')), [
        '[5. RUNTIME] ➔ [CloneCompletion]: 🏗️ إكمالُ ما لا أثرَ له (3): شاشة customer، شاشة tenant، بيانات account — رقعةٌ موضعيّة، لا إعادةَ كتابة.',
        '[5. RUNTIME] ➔ [CloneCompletion]: ℹ️ لم تُطبَّق رقعةٌ (لا مزوّد أو لا مطابقة) — الحكمُ يقول ما بقي بالاسم.',
    ]);
    assert.equal(r.verdict.status, 'FAILED'); assert.match(gate(r.verdict, 'requirements-verify').detail, /^3 متطلّب بلا أثر: شاشة customer، شاشة tenant، بيانات account/);
    // متجرٌ بلا فجوة: المُكمِلُ لا يُنادى أصلاً
    const s = scenario('pm8store'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
    let calls = 0;
    try {
        const { events: ev, reporter } = collect();
        const r2 = await buildFromClone(getCloneById('jaola-store'), 'متجر عطور', { ...s.ctx, projectPath: dir }, reporter, { complete: async () => { calls++; return { ok: false }; } });
        assert.equal(calls, 0); assert.equal(logs(ev).filter(l => l.includes('CloneCompletion')).length, 0); assert.equal(r2.verdict.status, 'PASS');
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('المسارُ كاملاً بلا مزوّد (كما يراه المستخدم): الوثيقة → كلون نقاط البيع → سطرا الإكمال ثمّ الحكمُ FAILED بالأسماء — لا صمتَ بين التسمية والحكم', async () => {
    const s = scenario('pm8full'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject, { entities: [], roles: [], flows: [] });
    try {
        const r = await s.rt._runMissionNow(SPEC, createExecutionContext({ ...s.ctx, projectPath: emptyProject(), agents: {} }));
        assert.equal(r.clone, 'jaola-pos'); assert.equal(r.verdict.status, 'FAILED');
        const seq = s.logs().split('\n').filter(l => /CloneCompletion|\[Judge\]/.test(l)).map(l => l.replace(/^.*➔ /, ''));
        assert.equal(seq.length, 3, seq.join('\n'));
        assert.match(seq[0], /^\[CloneCompletion\]: 🏗️ إكمالُ ما لا أثرَ له \(3\)/); assert.match(seq[1], /^\[CloneCompletion\]: ℹ️ لم تُطبَّق رقعةٌ/);
        assert.match(seq[2], /^\[Judge\]: ⚖️ الحكم: FAILED — guard-and-write ✓، requirements-verify ✗/);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('الحدود: المُكمِلُ محقونٌ بافتراضٍ هو رقعةُ الكلون نفسُها؛ المفوِّضُ في jcr كما كان؛ جولةٌ واحدة بلا حلقة؛ والاسترجاعُ إلى لقطة القرص لا إلى القالب النظيف', () => {
    const src = fs.readFileSync(path.join(HERE, '../agents/stages/buildFromClone.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(src.includes('export async function buildFromClone(clone, goal, ctx, reporter, { complete = patchEditPlan } = {}) {'));
    assert.equal((src.match(/await complete\(/g) || []).length, 1, 'نداءٌ واحد — لا حلقة');
    assert.ok(!/for \([^)]*round/.test(src), 'لا جولات');
    assert.ok(src.includes('for (const f of snapshot) await writeProjectFile(projectPath, f.name, f.content);'), 'الاسترجاعُ إلى ما كان على القرص');
    assert.equal((src.match(/'CloneCompletion'/g) || []).length, 5, 'خمسةُ مواضع: طلب/استرجاع/أُكمل-أو-بلا-أثر/لم تُطبَّق/تخطّي');
    assert.ok(src.includes("import { composeRequirements, traceRequirements, buildFixInstruction } from '../requirementsVerifier.js';"));
    assert.ok(!src.includes('coreEditCodePlan'), 'لا إعادةَ كتابةٍ كاملة على الكلون');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.match(jcr, /async _buildFromClone\(clone, goal, ctx\) \{\n\s+return buildFromClone\(clone, goal, ctx, this\.reporter\);\n\s+\}/);
});
