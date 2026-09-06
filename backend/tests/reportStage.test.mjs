// 📣 `_reportMissionSuccess` → `stages/reportMissionSuccess.js#reportMissionSuccess(goal, ctx, reporter)` (JCR/11).
// خطُّ الأساس (jcrMissionStrategy/jcrRuntimePipeline) يمرّ به عبر _runMissionNow ويطابق «تقرير التسليم»
// بالعموم. هنا التوصيفُ الدقيق: التقريرُ بحروفه (مدّة، ملفّات، أقسام) بالعربيّة والإنجليزيّة، الأزرار،
// قائمةُ الملفّات، المقاييس، وhook afterBuild بملفّاته — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { reportMissionSuccess } from '../agents/stages/reportMissionSuccess.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { updateStructure } from '../agents/projectMemory.js';
import { orchestrator } from '../core/PluginOrchestrator.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const project = () => { const d = emptyProject(); fs.writeFileSync(path.join(d, 'index.html'), '<h1>x</h1>'); fs.writeFileSync(path.join(d, 'styles.css'), 'body{}'); fs.mkdirSync(path.join(d, '.backups')); return d; };
const shape = (events) => events.map(([ev, p]) => [ev, typeof p?.message === 'string' ? [p.message, p.options ?? null] : (Array.isArray(p) ? [...p].sort() : null)]);

test('الدالّةُ الحرّةُ ≡ المفوِّض — بثّاً (بلا مقاييس) — والدالّةُ متزامنةٌ كما كانت', () => {
    const s = scenario('rpq'); setUserLanguage(s.ctx.username, 'ar'); const dir = project();
    const viaClass = s.rt._reportMissionSuccess('متجر عطور', { ...s.ctx, projectPath: dir });
    const { events, reporter } = collect();
    const viaFree = reportMissionSuccess('متجر عطور', { ...s.ctx, projectPath: dir }, reporter);
    assert.equal(viaClass, undefined); assert.equal(viaFree, undefined, 'لا وعدَ يُعاد — متزامنة');
    assert.deepEqual(shape(events), shape(s.events.map((e) => [e.ev, e.payload])));
});

// 🔎 اكتشافٌ من التوصيف (لا يُغيَّر هنا — نقلٌ حرفيّ): السطرُ الفارغ `''` في المصفوفة يسقط بـ`.filter(Boolean)`
// فلا فاصلَ قبل سطر المعاينة؛ والتقريرُ الإنجليزيّ يحمل وحدةَ الثواني العربيّة «ث». مثبَّتان كما هما.
test('تقريرُ التسليم بحروفه بالعربيّة: المدّة، الملفّاتُ بلا المخفيّة، الأقسامُ من الذاكرة، والأزرار', () => {
    const s = scenario('rpar'); setUserLanguage(s.ctx.username, 'ar'); const dir = project();
    updateStructure(s.ctx.username, s.ctx.activeProject, ['الرئيسية', 'تواصل'], []);
    const { events, reporter } = collect();
    reportMissionSuccess('متجر عطور', { ...s.ctx, projectPath: dir }, reporter);
    assert.deepEqual(events.map(([ev]) => ev), ['chat_reply', 'workspace_files', 'project_metrics']);
    assert.equal(events[0][1].message, ['✅ اكتملت المهمة — تقرير التسليم:', '⏱️ مدة التنفيذ: 0 ث', '📁 الملفات (2): index.html، styles.css', '🧱 الأقسام: الرئيسية، تواصل', '🖥️ المعاينة الحية تحدّثت وفُتحت تلقائياً — راجعها الآن.', 'ما الخطوة التالية؟'].join('\n'));
    assert.deepEqual(events[0][1].options, ['🚀 انشر الآن', '🐙 ادفع إلى GitHub', '📊 أين وصلنا']);
    assert.deepEqual([...events[1][1]].sort(), ['index.html', 'styles.css'], '`.backups` لا تُبثّ');
    assert.ok(events[2][1] && typeof events[2][1] === 'object' && 'totalBuilds' in events[2][1], 'المقاييسُ الحقيقيّة تُبثّ');
});

test('بالإنجليزيّة بلغة الجلسة — وبلا أقسامٍ يسقط سطرُها', () => {
    const s = scenario('rpen'); setUserLanguage(s.ctx.username, 'en'); const dir = project();
    const { events, reporter } = collect();
    reportMissionSuccess('perfume shop', { ...s.ctx, projectPath: dir }, reporter);
    assert.equal(events[0][1].message, ['✅ Mission complete — Delivery report:', '⏱️ Duration: 0 ث', '📁 Files (2): index.html, styles.css', '🖥️ Live preview updated and opened automatically.', 'What is the next step?'].join('\n'));
    assert.deepEqual(events[0][1].options, ['🚀 Deploy now', '🐙 Push to GitHub', '📊 Status']);
});

test('hook afterBuild يصل الإضافاتِ بملفّات البناء — مسارٌ لم يطرقه اختبارٌ من قبل', async () => {
    const name = '__report_test_plugin__'; const seen = [];
    orchestrator.plugins.set(name, { name, enabled: true, source: 'test', hooks: { afterBuild: (ctx) => { seen.push(ctx); } } });
    try {
        const s = scenario('rphook'); setUserLanguage(s.ctx.username, 'ar'); const dir = project();
        reportMissionSuccess('متجر عطور', { ...s.ctx, projectPath: dir }, collect().reporter);
        await new Promise((r) => setTimeout(r, 20));
        assert.equal(seen.length, 1);
        assert.equal(seen[0].success, true); assert.equal(seen[0].goal, 'متجر عطور'); assert.equal(seen[0].project, s.ctx.activeProject);
        assert.deepEqual([...seen[0].files].sort(), ['index.html', 'styles.css']);
    } finally { orchestrator.plugins.delete(name); }
});

test('الحدود: لا this، لا استيرادَ من jcr، المفوِّضُ سطرٌ واحد، وتسريبُ io واحدٌ معلَن', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/reportMissionSuccess.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    assert.equal((code.match(/reporter\.io\b/g) || []).length, 1);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    // PM/2: المفوِّضُ يمرّر الحكمَ (افتراضُه null يُبقي المستدعين القدامى كما هم)
    assert.match(jcr, /_reportMissionSuccess\(goal, ctx, verdict = null\) \{\n\s+return reportMissionSuccess\(goal, ctx, this\.reporter, verdict\);\n\s+\}/);
});
