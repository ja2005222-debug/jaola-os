// 🎨🧱 المصمّمُ وثلاثُ مراحلِ سكافولد تخرج من jcr (JCR/14):
//   `_stageDesigner` → `stages/designer.js#runDesigner(context, roomName, reporter)`
//   `_stageAdvancedModules/_stageFullStackScaffold/_stageProjectMemory` → `stages/scaffold.js#run*`
// لم يُطرق جسدُ أيٍّ منها في اختبارٍ من قبل. التوصيفُ بلا LLM: السجلُّ بحروفه، ما يُكتب على القرص،
// ما يتغيّر في `context.mentalModel` وذاكرة المشروع، ومساراتُ الصمت — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { runDesigner } from '../agents/stages/designer.js';
import { runAdvancedModules, runFullStackScaffold, runProjectMemory } from '../agents/stages/scaffold.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { getProjectMemory } from '../agents/projectMemory.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const NO_AI = 'تعذّر نداء المزوّد: لا يوجد مزود AI مُهيأ (GROQ_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY).';

// PM/5: السطرُ صار يقول النوعَ **ومن أين جاء** — من الفهم أم من كلمات الهدف. بلا نموذجٍ مخزّنٍ
// في هذين السيناريوهين فالمصدرُ الكلمات، وهذا هو السلوكُ القديم موصوفاً لا مغيَّراً.
test('المصمّم: لوحةٌ حتميّة (ocean للبحر)، السطرُ يقول إنّ تخصيصَ AI لم يجرِ ولماذا، design-brief.json على القرص، والهويّةُ في mentalModel', async () => {
    const s = scenario('dsg'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    const context = { ...s.ctx, projectPath: dir, goal: 'مطعم البحر للمأكولات البحرية مع قائمة طعام وحجز طاولة', mentalModel: {} };
    const { events, reporter } = collect();
    await runDesigner(context, s.ctx.roomName, reporter);
    assert.deepEqual(logs(events), [
        '[5. RUNTIME] ➔ [DesignerAgent]: 🎨 جاري توليد الـ Design Brief...',
        `[5. RUNTIME] ➔ [DesignerAgent]: ✅ Design Brief — ocean palette — النوع: restaurant (من كلمات الهدف) (بلا تخصيص AI: ${NO_AI})`,
    ]);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'design-brief.json'), 'utf8'));
    assert.equal(saved.paletteName, 'ocean'); assert.equal(saved.aiEnhanced, false);
    assert.equal(context.mentalModel.designBrief.paletteName, 'ocean');
    assert.equal(context.mentalModel.visualIdentity, saved.coderInstructions);
    assert.ok(context.mentalModel.visualIdentity.includes('## تعليمات التصميم الإلزامية:'));
});

test('المصمّم: وصفٌ قصير → تخطٍّ مقصودٌ بسببه (warm)؛ ومجلّدٌ غائب → الحفظُ يفشل بصمتٍ والسطرُ يبقى', async () => {
    const s = scenario('dsgs'); setUserLanguage(s.ctx.username, 'en');
    const context = { ...s.ctx, projectPath: path.join(emptyProject(), 'nope'), goal: 'مطعم', mentalModel: {} };
    const { events, reporter } = collect();
    await runDesigner(context, s.ctx.roomName, reporter);
    assert.equal(logs(events)[1], '[5. RUNTIME] ➔ [DesignerAgent]: ✅ Design Brief — warm palette — النوع: restaurant (من كلمات الهدف) (بلا تخصيص AI: الوصف أقصر من أن يُخصَّص)');
    assert.ok(!fs.existsSync(context.projectPath), 'saveDesignBrief لا يُنشئ المجلّد');
    assert.equal(context.mentalModel.designBrief.paletteName, 'warm');
});

test('الوحداتُ المتقدّمة: Stripe + Upload تُكتب بأسمائها والسطرُ يعدّها؛ Travelpayouts يحمل تنبيهَ المتغيّرات؛ وصفحةُ هبوط صمتٌ بلا ملفّات', async () => {
    const s = scenario('adv'); const a = emptyProject();
    const { events, reporter } = collect();
    await runAdvancedModules({ ...s.ctx, projectPath: a, originalGoal: 'متجر إلكتروني مع دفع Stripe ورفع صور وتسجيل دخول Google' }, s.ctx.roomName, reporter);
    assert.deepEqual(logs(events), ['[5. RUNTIME] ➔ [AdvancedAgent]: ✅ Stripe, Upload (3 ملف)']);
    assert.deepEqual(fs.readdirSync(a).sort(), ['STRIPE_README.md', 'api']);
    assert.deepEqual(fs.readdirSync(path.join(a, 'api')).sort(), ['stripe.js', 'upload.js']);
    const t = collect(); const b = emptyProject();
    await runAdvancedModules({ ...s.ctx, projectPath: b, originalGoal: 'موقع حجز طيران يبحث عن رحلات' }, s.ctx.roomName, t.reporter);
    assert.deepEqual(logs(t.events), ['[5. RUNTIME] ➔ [AdvancedAgent]: ✅ Travelpayouts (3 ملف) — يتطلّب ضبط: TRAVELPAYOUTS_TOKEN، TRAVELPAYOUTS_MARKER']);
    assert.ok(fs.existsSync(path.join(b, 'api', 'flights', 'search.js')));
    const n = collect(); const c = emptyProject();
    await runAdvancedModules({ ...s.ctx, projectPath: c, originalGoal: 'صفحة هبوط بسيطة' }, s.ctx.roomName, n.reporter);
    assert.deepEqual(n.events, []); assert.deepEqual(fs.readdirSync(c), []);
});

test('سكافولد Full-Stack: نيّةُ بياناتٍ + فئةٌ مدعومة → ١٦ ملفاً في fullstack/ والسطرُ بحروفه؛ بروشور → صمتٌ ولا مجلّد', async () => {
    const s = scenario('fst'); const a = emptyProject();
    const { events, reporter } = collect();
    await runFullStackScaffold({ ...s.ctx, projectPath: a, originalGoal: 'متجر مع قاعدة بيانات', blueprint: { category: 'ecommerce', kind: 'webapp' } }, s.ctx.roomName, reporter);
    assert.deepEqual(logs(events), ['[5. RUNTIME] ➔ [FullStackAgent]: 🏗️ نسخة Full-Stack (ecommerce) في مجلد fullstack/ — Next.js + API + Prisma (16 ملف)']);
    const fsDir = path.join(a, 'fullstack');
    for (const f of ['package.json', 'prisma/schema.prisma', 'app/page.js']) assert.ok(fs.existsSync(path.join(fsDir, f)), f);
    assert.deepEqual(fs.readdirSync(a), ['fullstack'], 'الموقعُ الثابت لا يُمَسّ');
    const q = collect(); const b = emptyProject();
    await runFullStackScaffold({ ...s.ctx, projectPath: b, originalGoal: 'متجر بسيط', blueprint: { category: 'ecommerce', kind: 'brochure' } }, s.ctx.roomName, q.reporter);
    assert.deepEqual(q.events, []); assert.deepEqual(fs.readdirSync(b), []);
});

// ذاكرةُ المشروع تبقى على القرص بين الجولات (أسماءُ scenario حتميّة) — فالقيمُ تُختَم بطابعِ الجولة حتّى لا تُرضي
// جولةٌ سابقة تأكيداتِ هذه الجولة (درسُ JCR/8: اختبارٌ نجح لسببٍ خاطئ).
test('ذاكرةُ المشروع: الأقسامُ والهويّةُ من mentalModel تُكتب؛ وبلا mentalModel لا رميَ ولا تغيير', async () => {
    const s = scenario('pmem'); const tag = `#${Date.now()}`;
    await runProjectMemory({ ...s.ctx, mentalModel: { templateSections: ['الرئيسية', `تواصل ${tag}`], visualIdentity: `هويّةٌ زرقاء ${tag}` } });
    const mem = getProjectMemory(s.ctx.username, s.ctx.activeProject);
    assert.deepEqual(mem.structure.sections, ['الرئيسية', `تواصل ${tag}`]); assert.equal(mem.design.style, `هويّةٌ زرقاء ${tag}`);
    await runProjectMemory({ ...s.ctx, mentalModel: { templateSections: [], visualIdentity: '' } });
    await runProjectMemory({ ...s.ctx });
    const after = getProjectMemory(s.ctx.username, s.ctx.activeProject);
    assert.deepEqual(after.structure.sections, ['الرئيسية', `تواصل ${tag}`]); assert.equal(after.design.style, `هويّةٌ زرقاء ${tag}`);
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — المصمّمُ بثّاً وقرصاً', async () => {
    const s = scenario('dsgq'); setUserLanguage(s.ctx.username, 'ar'); const a = emptyProject(); const b = emptyProject();
    const goal = 'مطعم البحر للمأكولات البحرية مع قائمة طعام وحجز طاولة';
    await s.rt._stageDesigner({ ...s.ctx, projectPath: a, goal, mentalModel: {} }, s.ctx.roomName);
    const { events, reporter } = collect();
    await runDesigner({ ...s.ctx, projectPath: b, goal, mentalModel: {} }, s.ctx.roomName, reporter);
    assert.deepEqual(logs(events), s.events.filter((e) => e.ev === 'log').map((e) => e.payload.message));
    const brief = (d) => { const j = JSON.parse(fs.readFileSync(path.join(d, 'design-brief.json'), 'utf8')); delete j.generatedAt; return j; };
    assert.deepEqual(brief(b), brief(a), 'الـbrief نفسُه بعد تجريد الطابع الزمنيّ');
});

test('الحدود: لا this، لا استيرادَ من jcr، أربعُ مفوِّضاتٍ بسطرٍ واحد، وأجسادُها لم تعد في jcr', () => {
    for (const f of ['designer.js', 'scaffold.js']) {
        const mod = fs.readFileSync(path.join(HERE, '../agents/stages', f), 'utf8');
        const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        assert.ok(!/\bthis\./.test(code), f); assert.ok(!/jcr\.js/.test(code), f); assert.ok(!/reporter\.io\b/.test(code), f);
    }
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    for (const [m, sig, call] of [['_stageDesigner', 'context, roomName', 'runDesigner(context, roomName, this.reporter)'], ['_stageAdvancedModules', 'context, roomName', 'runAdvancedModules(context, roomName, this.reporter)'], ['_stageFullStackScaffold', 'context, roomName', 'runFullStackScaffold(context, roomName, this.reporter)'], ['_stageProjectMemory', 'context', 'runProjectMemory(context)']]) {
        assert.ok(jcr.includes(`\n    async ${m}(${sig}) {\n        return ${call};\n    }\n`), m);
    }
    assert.equal((jcr.match(/\bgenerateDesignBrief\(|\bsaveDesignBrief\(|\bgenerateAdvancedModules\(|\brecommendFullStack\(|\bbuildFullStackProject\(|\bupdateDesign\(/g) || []).length, 0);
});
