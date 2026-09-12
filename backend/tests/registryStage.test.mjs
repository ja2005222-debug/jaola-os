// 🧱 أوّلُ بانٍ يخرج من jcr: `_buildFromRegistry` → `stages/buildFromRegistry.js#buildFromRegistry(goal, ctx, reporter)`.
//
// خطُّ الأساس القائم (jcrBuildStrategy/jcrMissionStrategy) **يستبدل** هذه الطريقةَ على النسخة
// ويختبر الاختيار لا البناء — فجسدُها لم يُطرق في اختبارٍ قطّ. هذا الملفّ توصيفُه الأوّل:
// تكافؤٌ (بعد تجريد الطوابع الزمنيّة)، النتيجةُ على القرص، ترتيبُ البثّ بحروفه، اللغة،
// الحالة، وتسريبُ `reporter.io` المعلَن للدفع التلقائيّ، والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { buildFromRegistry } from '../agents/stages/buildFromRegistry.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { transitionState, getProjectState, resetProjectState, STATES } from '../agents/stateMachine.js';
import { setDomainModel, getDomainModel } from '../agents/projectMemory.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const GOAL = 'صفحة هبوط لشركة استشارات';
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
// الطوابعُ الزمنيّة والمقاييسُ تتغيّر بين نداءين — نقارن الأسماءَ ونصوصَ السجلّ/الردّ فقط.
const shape = (events) => events.map(([ev, p]) => [ev, typeof p?.message === 'string' ? p.message : (Array.isArray(p) ? [...p].sort() : null)]);

test('الدالّةُ الحرّةُ بمُبلِّغٍ مُحقَن ≡ المفوِّضُ — ناتجاً وبثّاً (بلا طوابع) وملفّاتٍ', async () => {
    const s = scenario('regq'); setUserLanguage(s.ctx.username, 'ar'); const a = emptyProject(); const b = emptyProject();
    const viaClass = await s.rt._buildFromRegistry(GOAL, { ...s.ctx, projectPath: a });
    const { events, reporter } = collect();
    const viaFree = await buildFromRegistry(GOAL, { ...s.ctx, projectPath: b }, reporter);
    assert.deepEqual(viaFree, viaClass);
    assert.deepEqual(shape(events), shape(s.events.map((e) => [e.ev, e.payload])));
    assert.equal(fs.readFileSync(path.join(b, 'index.html'), 'utf8'), fs.readFileSync(path.join(a, 'index.html'), 'utf8'), 'الصفحةُ حرفاً بحرف');
});

test('البناءُ الحقيقيّ على مجلّدٍ فارغ: ٨ أقسام، ٦ ملفّات، بصمةٌ وأيقونة، وترتيبُ البثّ بحروفه', async () => {
    const s = scenario('regbuild'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 'test' });
    try {
        const { events, reporter } = collect();
        const r = await buildFromRegistry(GOAL, { ...s.ctx, projectPath: dir }, reporter);
        const { verdict, ...rest } = r; // PM/2b: الصفحةُ المركّبة تُتحقَّق فعلاً وتعود بحكم
        assert.deepEqual(rest, { success: true, registry: true, blocks: ['nav', 'hero', 'logos', 'features', 'stats', 'testimonials', 'cta', 'footer'] });
        assert.equal(verdict.status, 'PASS', JSON.stringify(verdict));
        assert.deepEqual(fs.readdirSync(dir).sort(), ['.jaola-generated.json', 'RENDER_README.md', 'brand.svg', 'index.html', 'render.yaml', 'styles.css']);
        const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
        assert.match(html, /brand\.svg/, 'وسمُ الأيقونة حُقن'); assert.match(html, /استشارات/, 'العلامةُ من الهدف');
        assert.match(fs.readFileSync(path.join(dir, 'render.yaml'), 'utf8'), /env: static/);
        assert.deepEqual(events.map(([ev]) => ev), ['agent_states', 'log', 'log', 'agent_states', 'workspace_files', 'preview_updated', 'project_metrics', 'chat_reply', 'log']);
        assert.deepEqual(events[0][1], { planner: 'completed', architect: 'completed', coder: 'running', qa: 'waiting', deploy: 'waiting' });
        assert.equal(events[1][1].message, '[5. RUNTIME] ➔ [JaolaRegistry]: 🧱 إعادة تركيب صفحة احترافية من JAOLA Registry (بلوكات جاهزة) — لا توليد من الصفر');
        assert.equal(events[2][1].message, '[5. RUNTIME] ➔ [JaolaRegistry]: 🧩 رُكّبت 8 أقسام: nav · hero · logos · features · stats · testimonials · cta · footer');
        assert.deepEqual(events[3][1], { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
        assert.deepEqual([...events[4][1]].sort(), ['RENDER_README.md', 'brand.svg', 'index.html', 'render.yaml', 'styles.css'], 'قائمةُ الملفّات بلا المخفيّة');
        assert.equal(events[7][1].message, '✅ اكتمل — ركّبنا صفحة احترافية **كاملة** لـ «استشارات» من مكوّنات JAOLA الجاهزة (8 قسم) ووضعنا بصمتك وهويتك البصرية. جرّبها في المعاينة، ثم اطلب أي تعديل.' + '\n⚖️ التحقّق: guard-and-write ✓، requirements-verify –، behavior-verify ✓'); // PM/2b: سطرُ التحقّق يلحق الرسالة
        assert.equal(events[8][1].message, '[JCOS] ➔ [Kernel]: ✨ نجاح (إعادة تركيب من Registry)');
        assert.equal(getProjectState(s.ctx.username, s.ctx.activeProject)?.state, STATES.COMPLETED);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('لا ردَّ إنجليزيّ على طلبٍ عربيّ واضح وإن كانت الجلسةُ إنجليزيّة — والعكسُ بالإنجليزيّة', async () => {
    const s = scenario('reglang'); setUserLanguage(s.ctx.username, 'en');
    const a = collect();
    await buildFromRegistry(GOAL, { ...s.ctx, projectPath: emptyProject() }, a.reporter);
    assert.match(a.events.find(([ev]) => ev === 'chat_reply')[1].message, /^✅ اكتمل — ركّبنا/, 'resolveGoalLanguage: العربيّةُ الواضحة تغلب جلسةً إنجليزيّة');
    const b = collect();
    await buildFromRegistry('landing page for a consulting firm', { ...s.ctx, projectPath: emptyProject() }, b.reporter);
    assert.match(b.events.find(([ev]) => ev === 'chat_reply')[1].message, /^✅ Done — composed a \*\*complete\*\* professional page/);
});

test('الحدود: لا this، لا استيرادَ من jcr، المفوِّضُ سطرٌ واحد، تسريبُ io معلَنٌ وواحد، والأسماءُ اليتيمة رحلت', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/buildFromRegistry.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    assert.equal((code.match(/reporter\.io\b/g) || []).length, 1, 'المقبسُ الخام يُمرَّر في موضعٍ واحدٍ فقط — للدفع التلقائيّ');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.match(jcr, /async _buildFromRegistry\(goal, ctx\) \{\n\s+return buildFromRegistry\(goal, ctx, this\.reporter\);\n\s+\}/);
    for (const n of ['composePage', 'selectBlocks', 'pickPalette']) assert.equal((jcr.match(new RegExp(`\\b${n}\\b`, 'g')) || []).length, 0, `${n} لم يعد لـjcr به شأن`);
});

// ══════════════════════════════════════════════════════════════════════════════
// #196 — «نجاح» يُعلَن وبوّابةُ «هل نُفِّذ ما طلبتَ؟» متخطّاة
//
// مقيسٌ على سجلّ صاحب المشروع حرفيّاً: «أبغى منصّة لجمعية خيرية» بأربعة أدوارٍ مسمّاة
// خرج صفحةَ تسويقٍ من عشرة بلوكات (pricing/testimonials/logos) والحكمُ **PASS**، لأنّ
// هذا المسارَ وحدَه — من البناة الثلاثة — كان **يفبرك نموذجَه** `{roles: [Visitor]}` ويكتبه
// فوق ما فهمتْه بوّابةُ الفهم. فلا يصل البوّابةَ من طلبه شيء، ومتطلّبُ «شاشة Visitor»
// اسمُه لاتينيٌّ لا يُتتبَّع في نصٍّ عربيّ → `skipped` → و`skipped` محايدٌ → PASS.
// ══════════════════════════════════════════════════════════════════════════════
test('#196: النموذجُ المفهوم يصل بوّابةَ المتطلّبات — فصفحةُ Registry على طلبِ منصّةٍ تُحكَم FAILED لا PASS', async () => {
    const s = scenario('reg196'); setUserLanguage(s.ctx.username, 'ar');
    const goal = 'أبغى منصّة لجمعية خيرية. الأدوار: مدير الجمعية، مسؤول الحملات، محاسب، متطوع';
    setDomainModel(s.ctx.username, s.ctx.activeProject, {
        entities: [{ name: 'حملة' }, { name: 'تبرع' }],
        roles: [{ name: 'مدير الجمعية' }, { name: 'مسؤول الحملات' }, { name: 'محاسب' }, { name: 'متطوع' }],
        flows: [],
    });
    const { reporter } = collect();
    const r = await buildFromRegistry(goal, { ...s.ctx, projectPath: emptyProject() }, reporter);

    assert.equal(r.verdict.status, 'FAILED', JSON.stringify(r.verdict));
    const gate = r.verdict.gates.find(g => g.name === 'requirements-verify');
    assert.equal(gate.status, 'fail', gate.detail);
    for (const name of ['مدير الجمعية', 'مسؤول الحملات', 'محاسب', 'متطوع', 'حملة', 'تبرع'])
        assert.match(gate.detail, new RegExp(name), `البوّابةُ تسمّي «${name}» ناقصاً`);

    // والبوّابةُ السلوكيّةُ تقرأ النموذجَ نفسَه — فتسمّي الأدوارَ التي لا واجهةَ لها في الصفحة المركّبة.
    const beh = r.verdict.gates.find(g => g.name === 'behavior-verify');
    assert.equal(beh.status, 'fail', beh.detail);
    assert.match(beh.detail, /محاسب|متطوع/, 'الأدوارُ بلا واجهةٍ تُسمّى: ' + beh.detail);

    // والفهمُ لا يُدهَس: ما فُهم يبقى في الذاكرة بعد البناء — لا يُكتب فوقه نموذجُ زائرٍ عامّ.
    const kept = getDomainModel(s.ctx.username, s.ctx.activeProject);
    assert.deepEqual(kept.roles.map(x => x.name),
        ['مدير الجمعية', 'مسؤول الحملات', 'محاسب', 'متطوع'], 'الأدوارُ المفهومة باقية');
});

// فهمٌ بكياناتٍ بلا أدوار فهمٌ أيضاً — والطفرةُ التي تقصر الشرطَ على `roles` نجت بلا هذا.
test('#196: كياناتٌ بلا أدوارٍ فهمٌ يُحاكَم — لا يسقط إلى نموذج الزائر', async () => {
    const s = scenario('reg196d'); setUserLanguage(s.ctx.username, 'ar');
    setDomainModel(s.ctx.username, s.ctx.activeProject,
        { entities: [{ name: 'وصفة' }, { name: 'مريض' }], roles: [], flows: [] });
    const { reporter } = collect();
    const r = await buildFromRegistry('منصة للصيدليات', { ...s.ctx, projectPath: emptyProject() }, reporter);
    const gate = r.verdict.gates.find(g => g.name === 'requirements-verify');
    assert.equal(gate.status, 'fail', gate.detail);
    // «مريض» يُتتبَّع بالمفردات، و«وصفة» لا يُغطّيها المعجمُ اليوم (بندٌ مفتوح: تغطيةُ المعجم) —
    // والبوّابةُ تقول ذلك بعدده لا تصمت عنه. المهمُّ هنا أنّها **حكمت** بدل أن تُتخطّى.
    assert.match(gate.detail, /مريض/, gate.detail);
    assert.deepEqual(getDomainModel(s.ctx.username, s.ctx.activeProject).entities.map(x => x.name),
        ['وصفة', 'مريض'], 'الكياناتُ المفهومة باقية');
});

test('#196 (الحدُّ المقابل): بلا فهمٍ سابق يبقى نموذجُ الزائر ويُكتب — والصفحةُ التسويقيّة تمرّ كما كانت', async () => {
    const s = scenario('reg196b'); setUserLanguage(s.ctx.username, 'ar');
    const { reporter } = collect();
    const r = await buildFromRegistry(GOAL, { ...s.ctx, projectPath: emptyProject() }, reporter);
    assert.equal(r.verdict.status, 'PASS', JSON.stringify(r.verdict));
    assert.equal(r.verdict.gates.find(g => g.name === 'requirements-verify').status, 'skipped');
    assert.deepEqual(getDomainModel(s.ctx.username, s.ctx.activeProject)?.roles.map(x => x.name), ['Visitor']);
});
