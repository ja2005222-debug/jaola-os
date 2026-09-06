// 🍔 ثاني بانٍ يخرج من jcr: `_buildFromClone` → `stages/buildFromClone.js#buildFromClone(clone, goal, ctx, reporter)` (JCR/12).
//
// خطُّ الأساس (jcrBuildStrategy/jcrMissionStrategy) **يستبدل** هذه الطريقةَ على النسخة ويختبر
// الاختيارَ لا البناء — فجسدُها لم يُطرق في اختبارٍ قطّ. هذا توصيفُه الأوّل بلا LLM: البصمةُ
// تُتخطّى بصمت (لا نداءَ ذكاء)، فيبقى مسارُ الكلون النظيف: الملفّاتُ، الهويّةُ، النشرُ الثابت، الذاكرة،
// الحالة، ترتيبُ البثّ، اللغة، ملاحظةُ الـAPI الخارجيّ، وتسريبُ `reporter.io` المعلَن، والحدود.
// مسارُ «البصمةُ كسرت → استرجاع» يحتاج نداءَ ذكاءٍ ولا شقَّ حقنٍ له — يبقى غيرَ مطروق، ويُقال ذلك صراحةً.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { buildFromClone } from '../agents/stages/buildFromClone.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { getProjectMemory } from '../agents/projectMemory.js';
import { getCloneById } from '../agents/cloneTemplates/index.js';
import { transitionState, getProjectState, resetProjectState, STATES } from '../agents/stateMachine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const GOAL = 'متجر إلكتروني لبيع العطور';
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
// الطوابعُ الزمنيّة والمقاييسُ تتغيّر بين نداءين — نقارن الأسماءَ ونصوصَ السجلّ/الردّ فقط.
const shape = (events) => events.map(([ev, p]) => [ev, typeof p?.message === 'string' ? p.message : (Array.isArray(p) ? [...p].sort() : null)]);
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const generating = (s) => transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 'test' });

test('الدالّةُ الحرّةُ بمُبلِّغٍ مُحقَن ≡ المفوِّضُ — ناتجاً وبثّاً (بلا طوابع) وملفّاتٍ', async () => {
    const s = scenario('clq'); setUserLanguage(s.ctx.username, 'ar'); const a = emptyProject(); const b = emptyProject();
    const clone = getCloneById('jaola-store');
    generating(s);
    const viaClass = await s.rt._buildFromClone(clone, GOAL, { ...s.ctx, projectPath: a });
    resetProjectState(s.ctx.username, s.ctx.activeProject); generating(s);
    const { events, reporter } = collect();
    const viaFree = await buildFromClone(clone, GOAL, { ...s.ctx, projectPath: b }, reporter);
    assert.deepEqual(viaFree, viaClass);
    assert.deepEqual(shape(events), shape(s.events.map((e) => [e.ev, e.payload])));
    for (const f of ['index.html', 'app.js', 'styles.css']) assert.equal(fs.readFileSync(path.join(b, f), 'utf8'), fs.readFileSync(path.join(a, f), 'utf8'), `${f} حرفاً بحرف`);
});

test('البناءُ الحقيقيّ بلا LLM: ٦ ملفّات، أيقونةٌ وتلميع، نشرٌ ثابت، ذاكرةٌ من نموذج الكلون، COMPLETED، وترتيبُ البثّ', async () => {
    const s = scenario('clbuild'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    generating(s);
    try {
        const { events, reporter } = collect();
        const r = await buildFromClone(getCloneById('jaola-store'), GOAL, { ...s.ctx, projectPath: dir }, reporter);
        const { verdict, ...rest } = r; // PM/2b: الكلونُ يعود بحكمٍ من تحقّقٍ نهائيّ على ما وصل القرص
        assert.deepEqual(rest, { success: true, clone: 'jaola-store' });
        assert.equal(verdict.status, 'PASS'); assert.deepEqual(verdict.gates.map(g => g.status), ['pass', 'skipped', 'pass']);
        assert.deepEqual(fs.readdirSync(dir).sort(), ['RENDER_README.md', 'app.js', 'brand.svg', 'index.html', 'render.yaml', 'styles.css']);
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        assert.ok(html.includes('brand.svg'), 'وسمُ الأيقونة محقون');
        assert.match(fs.readFileSync(path.join(dir, 'render.yaml'), 'utf8'), /env:\s*static/, 'الكلونُ التجريبيّ موقعٌ ثابت');
        assert.equal(getProjectState(s.ctx.username, s.ctx.activeProject).state, STATES.COMPLETED);
        const mem = getProjectMemory(s.ctx.username, s.ctx.activeProject);
        assert.deepEqual(mem.structure.sections, ['واجهة Customer', 'واجهة Admin'], 'الأقسامُ من أدوار نموذج الكلون');
        assert.ok(mem.history.some((h) => String(h.action || h.message || JSON.stringify(h)).includes('كلون jaola-store')), 'سطرُ التاريخ');
        assert.deepEqual(events.map(([ev]) => ev), ['agent_states', 'log', 'log', 'log', 'agent_states', 'preview_updated', 'workspace_files', 'project_metrics', 'chat_reply', 'log']);
        assert.deepEqual(logs(events), [
            '[5. RUNTIME] ➔ [JaolaTemplate]: 🧩 قالب jaola عامل: متجر إلكتروني (jaola-store) — نبدأ من تطبيق يعمل فعلاً (لا توليد من الصفر)',
            '[5. RUNTIME] ➔ [CloneTemplate]: 🎨 وضع البصمة — تخصيص المحتوى ليطابق طلبك...',
            '[5. RUNTIME] ➔ [CloneTemplate]: 🎨 أُضيفت هوية العلامة ولمسة احترافية (خطّ + حركات ظهور).',
            '[JCOS] ➔ [Kernel]: ✨ نجاح (قالب jaola عامل)',
        ], 'بلا LLM: البصمةُ تُفتَح ولا تُختَم بسطرٍ — لا نجاحَ ولا استرجاع');
        assert.equal(events[4][1].coder, 'completed'); assert.equal(events[4][1].deploy, 'completed');
        const reply = events[8][1].message;
        assert.ok(reply.startsWith('✅ اكتمل — بدأنا من قالب **متجر إلكتروني** (jaola) يعمل فعلاً — Customer · Admin ووضعنا بصمتك.'), reply);
        assert.equal(events[8][1].options, undefined, 'لا أزرارَ في ردّ الكلون');
        assert.ok('totalBuilds' in events[7][1]);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('اللغة: هدفٌ إنجليزيّ بجلسةٍ إنجليزيّة → ردٌّ إنجليزيّ + سطرُ Localizer؛ وهدفٌ عربيّ بجلسةٍ إنجليزيّة → عربيّ', async () => {
    const s = scenario('clen'); setUserLanguage(s.ctx.username, 'en');
    generating(s);
    const { events, reporter } = collect();
    await buildFromClone(getCloneById('jaola-store'), 'online perfume store', { ...s.ctx, projectPath: emptyProject() }, reporter);
    assert.ok(logs(events).includes('[5. RUNTIME] ➔ [Localizer]: 🌐 Template delivered in English (your selected language).'));
    assert.ok(events.find(([ev]) => ev === 'chat_reply')[1].message.startsWith('✅ Done — started from a working **متجر إلكتروني** jaola template and applied your brand.'));
    resetProjectState(s.ctx.username, s.ctx.activeProject); generating(s);
    const ar = collect();
    await buildFromClone(getCloneById('jaola-store'), GOAL, { ...s.ctx, projectPath: emptyProject() }, ar.reporter);
    assert.ok(!logs(ar.events).some((l) => l.includes('[Localizer]')), 'العربيّةُ أصلٌ فلا توطين');
    assert.ok(ar.events.find(([ev]) => ev === 'chat_reply')[1].message.startsWith('✅ اكتمل'), 'لا ردَّ إنجليزيّ على طلبٍ عربيّ');
    resetProjectState(s.ctx.username, s.ctx.activeProject);
});

test('كلونٌ بـAPI خارجيّ: الملاحظةُ في السجلّ والردّ', async () => {
    const s = scenario('clapi'); setUserLanguage(s.ctx.username, 'ar');
    generating(s);
    const { events, reporter } = collect();
    const r = await buildFromClone(getCloneById('jaola-weather'), 'تطبيق طقس', { ...s.ctx, projectPath: emptyProject() }, reporter);
    assert.equal(r.clone, 'jaola-weather');
    assert.ok(logs(events)[0].includes('— API خارجي: Open-Meteo (بلا مفتاح) —'));
    assert.ok(events.find(([ev]) => ev === 'chat_reply')[1].message.includes('(متصل بـ API خارجي حيّ: Open-Meteo (بلا مفتاح))'));
    resetProjectState(s.ctx.username, s.ctx.activeProject);
});

test('الحدود: لا this، لا استيرادَ من jcr، المفوِّضُ سطرٌ واحد، وتسريبُ io واحدٌ معلَن', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/buildFromClone.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    assert.equal((code.match(/reporter\.io\b/g) || []).length, 1, 'تسريبٌ واحدٌ للمقبس الخام — للدفع التلقائيّ فقط');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.match(jcr, /\n    async _buildFromClone\(clone, goal, ctx\) \{\n        return buildFromClone\(clone, goal, ctx, this\.reporter\);\n    \}\n/);
    assert.equal((jcr.match(/\bstampSeed\(|\blocalizeTemplateFiles\(|\bprepareRenderDeploy\(/g) || []).length, 0, 'أجسادُ الكلون لم تعد في jcr');
});
