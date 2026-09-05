// ⚛️ ثالثُ بانٍ يخرج من jcr: `_buildReactProject` → `stages/buildReact.js#buildReactProject(goal, ctx, { sections }, reporter)` (JCR/19).
//
// خطُّ الأساس (jcrBuildStrategy/jcrMissionStrategy) يستبدل هذه الطريقةَ ويختبر الاختيارَ لا البناء — فجسدُها لم يُطرق.
// التوصيفُ الأوّل بلا LLM: كاتبُ المحتوى يعود فارغاً فتبقى الأقسامُ افتراضيّةً ويُحاوَل تخصيصُ كلِّ صفحةٍ فرديّاً (بلا جدوى، بلا كسر)؛
// السكافولد + المعاينةُ الثابتة + لوحةُ التحكّم على القرص، الحالة، الذاكرة، ترتيبُ البثّ بحروفه، التقريرُ بلغته، تحقّقٌ بلا إصلاح،
// وتسريبُ `reporter.io` المعلَن — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { buildReactProject } from '../agents/stages/buildReact.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { getProjectMemory, updateStructure } from '../agents/projectMemory.js';
import { transitionState, getProjectState, resetProjectState, STATES } from '../agents/stateMachine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const GOAL = 'مطعم البحر للمأكولات البحرية';
const SECTIONS = ['الرئيسية', 'من نحن', 'الخدمات', 'تواصل'];
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const shape = (events) => events.map(([ev, p]) => [ev, typeof p?.message === 'string' ? p.message : (Array.isArray(p) ? [...p].sort() : null)]);
const generating = (s) => transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 'test' });

test('البناءُ الحقيقيّ بلا LLM: سكافولدُ Next كاملٌ + معاينةٌ ثابتة لكلِّ مسار + لوحةُ تحكّم، COMPLETED، الذاكرةُ من الأقسام والمكوّنات، والتقريرُ العربيّ بحروفه', async () => {
    const s = scenario('rx1'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject(); generating(s);
    // الذاكرةُ تبقى على القرص بين الجولات (أسماءُ scenario حتميّة) — علامةٌ قديمة تُزرع أوّلاً حتّى لا تُرضي جولةٌ سابقة تأكيدَ هذه الجولة
    updateStructure(s.ctx.username, s.ctx.activeProject, ['قديم'], ['Stale']);
    try {
        const { events, reporter } = collect();
        const r = await buildReactProject(GOAL, { ...s.ctx, projectPath: dir }, { sections: SECTIONS }, reporter);
        assert.equal(r.success, true); assert.equal(r.stack, 'react-next');
        for (const f of ['package.json', 'tailwind.config.js', 'app/layout.jsx', 'app/about/page.jsx', 'components/Navbar.jsx', 'lib/content.js', 'README.md',
            'index.html', 'home.html', 'about.html', 'services.html', 'twasl.html', 'dashboard.html']) assert.ok(fs.existsSync(path.join(dir, f)), f);
        assert.deepEqual([...r.files].sort(), fs.readdirSync(dir).filter((f) => !f.startsWith('.')).sort(), 'قائمةُ الملفّات من القرص');
        assert.match(fs.readFileSync(path.join(dir, 'lib/content.js'), 'utf8'), /^\/\/ محتوى الموقع — عدّله بحرّية\. يملؤه JAOLA بالذكاء حسب مشروعك\.\nexport const content = \{/, 'lib/content.js أُعيدت كتابتُه بالمحتوى المُثرى (ولو بقي افتراضيّاً)');
        assert.equal(getProjectState(s.ctx.username, s.ctx.activeProject).state, STATES.COMPLETED);
        const mem = getProjectMemory(s.ctx.username, s.ctx.activeProject);
        assert.deepEqual(mem.structure.sections, SECTIONS); assert.deepEqual(mem.structure.features, ['Navbar', 'Hero', 'Home', 'About', 'Services', 'Twasl', 'Footer']);
        assert.ok(mem.history.some((h) => JSON.stringify(h).includes('بناء React/Next: ' + GOAL)));
        const names = events.map(([ev]) => ev);
        assert.deepEqual(names.filter((n) => n !== 'log'), ['agent_states', 'agent_states', 'preview_updated', 'workspace_files', 'project_metrics', 'chat_reply']);
        const L = logs(events);
        assert.deepEqual(L.slice(0, 6), [
            '[5. RUNTIME] ➔ [ReactGen]: ⚛️ توليد مشروع Next.js + Tailwind...',
            '[5. RUNTIME] ➔ [ContentWriter]: ✍️ كتابة محتوى المشروع...',
            '[5. RUNTIME] ➔ [ContentWriter]: ✍️ محتوى صفحة: الرئيسية...',
            '[5. RUNTIME] ➔ [ContentWriter]: ✍️ محتوى صفحة: من نحن...',
            '[5. RUNTIME] ➔ [ContentWriter]: ✍️ محتوى صفحة: الخدمات...',
            '[5. RUNTIME] ➔ [ContentWriter]: ✍️ محتوى صفحة: تواصل...',
        ], 'بلا LLM كلُّ صفحةٍ تبقى افتراضيّةً فتُحاوَل فرديّاً — وتبقى');
        assert.ok(L.some((m) => m.startsWith('[6. VERIFY] ➔ [BehaviorVerifier]: 🔬')), 'تحقّقٌ سلوكيّ على المعاينة');
        assert.ok(!L.some((m) => m.includes('جولة إصلاح')), 'بلا إصلاح — canFix=false وagents=null');
        assert.equal(L.at(-1), '[JCOS] ➔ [Kernel]: ✨ نجاح');
        const reply = events.find(([ev]) => ev === 'chat_reply')[1];
        assert.deepEqual(reply.message.split('\n').slice(0, 2), ['✅ مشروع React/Next جاهز — معاينة متعدّدة الصفحات تعمل الآن.', '⚛️ Next.js + Tailwind · 5 صفحة · 7 مكوّن']);
        assert.deepEqual(reply.options, ['➕ أضف صفحة', '🚀 انشر على Vercel', '🐙 ادفع إلى GitHub', '✏️ عدّل قسماً']);
        assert.ok('totalBuilds' in events.find(([ev]) => ev === 'project_metrics')[1]);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('جلسةٌ إنجليزيّة وبلا أقسام: يُبنى بأقلّ هيكل، التقريرُ والأزرارُ بالإنجليزيّة (بلا سطر اللوحة)', async () => {
    const s = scenario('rx2'); setUserLanguage(s.ctx.username, 'en'); const dir = emptyProject(); generating(s);
    try {
        const { events, reporter } = collect();
        const r = await buildReactProject('sea food restaurant', { ...s.ctx, projectPath: dir }, {}, reporter);
        assert.equal(r.success, true); assert.ok(fs.existsSync(path.join(dir, 'index.html')) && fs.existsSync(path.join(dir, 'dashboard.html')));
        const reply = events.find(([ev]) => ev === 'chat_reply')[1];
        assert.equal(reply.message.split('\n')[0], '✅ React/Next project ready — multi-page preview running now.');
        assert.equal(reply.message.split('\n').length, 4, 'التقريرُ الإنجليزيّ بلا سطر لوحة التحكّم — أربعةُ أسطر');
        assert.deepEqual(reply.options, ['➕ Add a page', '🚀 Deploy to Vercel', '🐙 Push to GitHub', '✏️ Edit a section']);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — ناتجاً وبثّاً (بلا طوابع) وملفّاتٍ', async () => {
    const s = scenario('rxq'); setUserLanguage(s.ctx.username, 'ar'); const a = emptyProject(); const b = emptyProject(); generating(s);
    try {
        const viaClass = await s.rt._buildReactProject(GOAL, { ...s.ctx, projectPath: a }, { sections: SECTIONS });
        resetProjectState(s.ctx.username, s.ctx.activeProject); generating(s);
        const { events, reporter } = collect();
        const viaFree = await buildReactProject(GOAL, { ...s.ctx, projectPath: b }, { sections: SECTIONS }, reporter);
        assert.deepEqual(viaFree, viaClass);
        assert.deepEqual(shape(events), shape(s.events.map((e) => [e.ev, e.payload])));
        assert.equal(fs.readFileSync(path.join(b, 'about.html'), 'utf8'), fs.readFileSync(path.join(a, 'about.html'), 'utf8'));
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('الحدود: لا this، لا استيرادَ من jcr، المفوِّضُ سطرٌ واحد، تسريبُ io واحدٌ معلَن، والتحقّقُ يُستورد لا يُفوَّض', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/buildReact.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    assert.equal((code.match(/reporter\.io\b/g) || []).length, 1, 'تسريبٌ واحدٌ للمقبس الخام — للدفع التلقائيّ فقط');
    assert.equal((code.match(/\}, reporter\);/g) || []).length, 1, 'التحقّقُ يمرَّر إليه المُبلِّغُ نفسُه');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes('\n    async _buildReactProject(goal, ctx, opts = {}) {\n        return buildReactProject(goal, ctx, opts, this.reporter);\n    }\n'));
    assert.equal((jcr.replace(/^import .*$/gm, '').match(/\bgenerateNextScaffold\(|\bgenerateContentModel\(|\bbuildDashboardPage\(|\bupdateStructure\(/g) || []).length, 0);
});
