// 🧪 مراحلُ الجودة الستّ تخرج من jcr: `_stageReview/_stageRefactor/_stageTesting/_stageSEO/_stageSecurity/_stageGitBackup`
// → `stages/quality.js#run*Stage(context, roomName, reporter)` (JCR/13).
//
// كلُّها تُستدعى بالاسم من `DELIVERY_STAGES` (`contracts.test` يثبّت وجودَ المفوِّضات على النسخة)، ولم يُطرق
// جسدُ أيٍّ منها في اختبارٍ من قبل: خطُّ الأساس يمرّ بها عبر `runDynamicMultiAgentRuntime` بوكلاءَ مزيّفين
// ويطابق النتيجةَ بالعموم. هنا التوصيفُ الدقيق بلا LLM: السجلُّ بحروفه، ما يُكتب على القرص، ما يتغيّر في
// `plan.files`، الحالة، الدرجاتُ المسجَّلة، ومساراتُ «تخطّي» — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { runReviewStage, runRefactorStage, runTestingStage, runSeoStage, runSecurityStage, runGitBackupStage } from '../agents/stages/quality.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { transitionState, getProjectState, resetProjectState, STATES } from '../agents/stateMachine.js';
import { buildMetricsPayload } from '../services/metricsStore.js';
import { getCommitHistory } from '../agents/gitAgent.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const HTML = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>مطعم البحر</title><link rel="stylesheet" href="styles.css"></head><body><header><nav><a href="#home">الرئيسية</a></nav></header><main><section id="home"><h1>مطعم البحر</h1><img src="a.png"></section></main><script src="script.js"></script></body></html>';
const fixture = () => [
    { name: 'index.html', content: HTML },
    { name: 'styles.css', content: ':root{--primary:#06c}body{font-family:sans-serif}' },
    { name: 'script.js', content: 'console.log(1);\ndocument.getElementById("home").addEventListener("click",()=>{});' },
];
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const logs = (events) => events.filter(([ev]) => ev === 'log').map(([, p]) => p.message);
const context = (s, dir, plan = { files: fixture() }) => ({ ...s.ctx, projectPath: dir, plan, originalGoal: 'مطعم البحر للمأكولات البحرية', goal: 'مطعم البحر' });

test('المراجعة: حالةُ REVIEWING، إصلاحٌ واحد يُكتب ويحلّ في plan.files، الدرجةُ تُسجَّل، والسجلُّ بحروفه', async () => {
    const s = scenario('qrev'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 'test' });
    try {
        const ctx = context(s, dir); const before = ctx.plan.files;
        const { events, reporter } = collect();
        await runReviewStage(ctx, s.ctx.roomName, reporter);
        assert.equal(getProjectState(s.ctx.username, s.ctx.activeProject).state, STATES.REVIEWING);
        assert.deepEqual(logs(events), [
            '[5. RUNTIME] ➔ [ReviewAgent]: 🔍 مراجعة جودة الكود...',
            '[5. RUNTIME] ➔ [ReviewAgent]: 🟡 الجودة: B (76/100) — جيد — تم إصلاح 1 مشكلة',
        ]);
        assert.notEqual(ctx.plan.files, before, 'plan.files صار قائمةَ المُصلَح');
        assert.deepEqual(ctx.plan.files.map((f) => f.name), ['index.html', 'styles.css', 'script.js']);
        assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), ctx.plan.files[0].content, 'المُصلَحُ كُتب على القرص');
        assert.ok(ctx.plan.files[0].content.includes('alt='), 'الإصلاحُ الواحد: alt للصورة');
        const m = buildMetricsPayload(s.ctx.username, s.ctx.activeProject);
        assert.equal(m.quality.grade, 'B'); assert.equal(m.quality.score, 76);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('المراجعة بلا خطّة: سطرُ «تخطّي» لا انهيار — والحالةُ تنتقل قبل الرمي', async () => {
    const s = scenario('qrevx'); transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 'test' });
    try {
        const { events, reporter } = collect();
        await runReviewStage(context(s, emptyProject(), null), s.ctx.roomName, reporter);
        assert.equal(logs(events).length, 2);
        assert.ok(logs(events)[1].startsWith('[5. RUNTIME] ➔ [ReviewAgent]: ⚠️ تخطّي: '), logs(events)[1]);
        assert.equal(getProjectState(s.ctx.username, s.ctx.activeProject).state, STATES.REVIEWING);
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('التنظيف: كودٌ نظيف → صمتٌ تامّ (لا سطرَ عند صفر تقليص) وplan.files تُستبدل بالمعالَجة', async () => {
    const s = scenario('qref'); const ctx = context(s, emptyProject()); const before = ctx.plan.files;
    const { events, reporter } = collect();
    await runRefactorStage(ctx, s.ctx.roomName, reporter);
    assert.deepEqual(events, []);
    assert.notEqual(ctx.plan.files, before); assert.deepEqual(ctx.plan.files.map((f) => f.name), ['index.html', 'styles.css', 'script.js']);
});

test('الاختبار: التقريرُ بحروفه ثمّ سطرُ الفاشلة؛ وبلا ملفّات → «plan is not defined»', async () => {
    const s = scenario('qtest'); setUserLanguage(s.ctx.username, 'ar');
    const { events, reporter } = collect();
    await runTestingStage(context(s, emptyProject()), s.ctx.roomName, reporter);
    assert.deepEqual(logs(events), [
        '[5. RUNTIME] ➔ [TestingAgent]: 🟡 B (75/100) — 17/19 اختبار نجح | فشل: Media Queries للتجاوب, حجم CSS',
        '[5. RUNTIME] ➔ [TestingAgent]: ⚠️ اختبارات فاشلة: Media Queries للتجاوب | حجم CSS',
    ]);
    const x = collect();
    await runTestingStage(context(s, emptyProject(), {}), s.ctx.roomName, x.reporter);
    assert.deepEqual(logs(x.events), ['[5. RUNTIME] ➔ [TestingAgent]: ⚠️ تخطّي: plan is not defined']);
});

test('SEO: robots.txt وsitemap.xml يُكتبان على القرص بعنوان vercel المشتقّ، plan.files تُستبدل، والدرجةُ تُسجَّل', async () => {
    const s = scenario('qseo'); setUserLanguage(s.ctx.username, 'ar'); const dir = emptyProject();
    const ctx = context(s, dir); const { events, reporter } = collect();
    await runSeoStage(ctx, s.ctx.roomName, reporter);
    assert.deepEqual(logs(events), ['[5. RUNTIME] ➔ [SEOAgent]: ✅ SEO — robots.txt + sitemap.xml + meta tags (OG, Twitter, Schema.org) · 1 صفحة في الخريطة']);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['robots.txt', 'sitemap.xml'], 'الجديدةُ فقط تُكتب هنا — الصفحاتُ المعدَّلة تبقى في plan.files لمرحلة الكتابة');
    assert.ok(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8').includes(`https://${s.ctx.username}-${s.ctx.activeProject}.vercel.app`));
    assert.ok(ctx.plan.files.find((f) => f.name === 'index.html').content.includes('og:title'), 'الميتا حُقنت في الصفحة داخل الخطّة');
    assert.ok(buildMetricsPayload(s.ctx.username, s.ctx.activeProject).seo, 'درجةُ SEO مسجَّلة');
});

test('الأمان: .gitignore يُكتب، الدرجةُ A تُسجَّل، ولا مساسَ بـplan.files', async () => {
    const s = scenario('qsec'); const dir = emptyProject(); const ctx = context(s, dir); const before = ctx.plan.files;
    const { events, reporter } = collect();
    await runSecurityStage(ctx, s.ctx.roomName, reporter);
    assert.deepEqual(logs(events), ['[5. RUNTIME] ➔ [SecurityAgent]: ✅ Security A (100/100) — 0 مشكلة، 0 تحذير']);
    assert.deepEqual(fs.readdirSync(dir), ['.gitignore']);
    assert.equal(ctx.plan.files, before, 'لا مُصلِحَ أمنيّاً — القائمةُ نفسُها');
    assert.equal(buildMetricsPayload(s.ctx.username, s.ctx.activeProject).security.grade, 'A');
});

// 🔎 اكتشافٌ من التوصيف (لا يُغيَّر هنا — نقلٌ حرفيّ): `backupProject` يكتب لقطةً جديدة في `.backups/snapshot_<ts>_build`
// داخل المشروع قبل كلِّ commit، و`.gitignore` المولَّد لا يستثنيها — فكلُّ بناءٍ يُنتج commit ولو لم يتغيّر
// ملفٌّ واحد، ومسارُ `skipped` («لا توجد تغييرات للحفظ») لا يقع أبداً من هذه المرحلة. مثبَّتٌ كما هو.
test('النسخُ الاحتياطيّ: commit يُبثّ بهاشه في كلِّ مرّة — حتّى بلا تغيير (اللقطةُ نفسُها تغيير) — ومجلّدٌ غائب يُنشَأ', async () => {
    const s = scenario('qgit'); const dir = emptyProject(); fs.writeFileSync(path.join(dir, 'index.html'), HTML);
    const HASH = /^\[5\. RUNTIME\] ➔ \[GitAgent\]: ✅ تم الحفظ \[[0-9a-f]{7,40}\]$/;
    const { events, reporter } = collect();
    await runGitBackupStage(context(s, dir), s.ctx.roomName, reporter);
    assert.equal(logs(events).length, 1); assert.match(logs(events)[0], HASH);
    const [last] = await getCommitHistory(dir, 1);
    assert.ok(last.message.startsWith('🏗️ مطعم البحر للمأكولات البحرية ['), `الرسالةُ من هدف المستخدم الحرّ (originalGoal) لا من الهدف المطبَّع: ${last.message}`);
    const again = collect();
    await runGitBackupStage(context(s, dir), s.ctx.roomName, again.reporter);
    assert.equal(logs(again.events).length, 1); assert.match(logs(again.events)[0], HASH);
    assert.notEqual(logs(again.events)[0], logs(events)[0], 'هاشٌ ثانٍ — اللقطةُ الجديدة وحدَها غيّرت الشجرة');
    assert.equal(fs.readdirSync(path.join(dir, '.backups')).filter((d) => d.startsWith('snapshot_')).length, 2);
    // 🔎 اكتشافٌ ثانٍ: مسارُ مشروعٍ غائب لا يُخطئ — بل **يُنشَأ** (`mkdir recursive` في النسخ الاحتياطيّ) ثمّ
    // يُهيَّأ مستودعاً ويُحفَظ فيه commit. الأخُ الصغير لـSprint 7/3 («الحارسُ يُنشئ ما يفحصه»). مثبَّتٌ كما هو.
    const missing = collect(); const nope = path.join(dir, 'nope');
    await runGitBackupStage(context(s, nope), s.ctx.roomName, missing.reporter);
    assert.equal(logs(missing.events).length, 1); assert.match(logs(missing.events)[0], HASH);
    assert.ok(fs.existsSync(path.join(nope, '.git')) && fs.existsSync(path.join(nope, '.backups')), 'المجلّدُ الغائب أُنشئ وصار مستودعاً');
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — المراجعةُ بثّاً وقرصاً', async () => {
    const s = scenario('qeq'); setUserLanguage(s.ctx.username, 'ar'); const a = emptyProject(); const b = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 'test' });
    try {
        await s.rt._stageReview(context(s, a), s.ctx.roomName);
        const { events, reporter } = collect();
        await runReviewStage(context(s, b), s.ctx.roomName, reporter);
        assert.deepEqual(logs(events), s.events.filter((e) => e.ev === 'log').map((e) => e.payload.message));
        assert.equal(fs.readFileSync(path.join(b, 'index.html'), 'utf8'), fs.readFileSync(path.join(a, 'index.html'), 'utf8'));
    } finally { resetProjectState(s.ctx.username, s.ctx.activeProject); }
});

test('الحدود: لا this، لا استيرادَ من jcr، ستُّ مفوِّضاتٍ بسطرٍ واحد، وأجسادُها لم تعد في jcr', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/quality.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code)); assert.ok(!/reporter\.io\b/.test(code), 'لا io هنا');
    assert.equal((code.match(/reporter\.liveLog\(/g) || []).length, 12);
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    for (const [m, f] of [['_stageReview', 'runReviewStage'], ['_stageRefactor', 'runRefactorStage'], ['_stageTesting', 'runTestingStage'], ['_stageSEO', 'runSeoStage'], ['_stageSecurity', 'runSecurityStage'], ['_stageGitBackup', 'runGitBackupStage']]) {
        assert.match(jcr, new RegExp(`\\n    async ${m}\\(context, roomName\\) \\{\\n        return ${f}\\(context, roomName, this\\.reporter\\);\\n    \\}\\n`), m);
    }
    assert.equal((jcr.match(/\breviewCode\(|\brefactorCode\(|\brunTests\(|\brunSEO\(|\brunSecurity\(|\bcommitBuild\(|\brecordScore\(/g) || []).length, 0);
});
