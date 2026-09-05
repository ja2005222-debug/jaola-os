// 🧠 `_handleCeoIntent` — النوايا الإداريّة السريعة (أين وصلنا / كمل / انشر /
// ادفع / تحيّة) تُعالَج قبل أيّ نموذجٍ لغويّ. ١٢٥ سطراً بلا اختبارٍ يذكرها.
// اختباراتُ **توصيف**: تُثبّت ما يقع اليوم كي يصير النقلُ قابلاً للتحقّق.
//
// كلُّ شيءٍ هنا حتميّ: `classifyIntentFast` قواعدُ نصّيّة، و`decide` يقرأ
// صفَّ التنفيذ لا الذاكرةَ العالقة، و`buildContinuationGoal` يقرأ ذاكرةَ
// المشروع. الأثقلُ (`executeMission`) مسجِّل، والنشرُ يُحقَن أو يقف مبكّراً
// عند «لا مستودعَ مربوطاً» بلا شبكة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { scenario, tempProject, emptyProject, assertNoHeavyPath } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { addToHistory } from '../agents/projectMemory.js';
import { enqueueMission, isMissionActive } from '../core/runtime/ExecutionQueue.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

function ceo(prefix, { dir = null, deploy = null } = {}) {
    const s = scenario(prefix);
    setUserLanguage(s.ctx.username, 'ar');
    const projectPath = dir || emptyProject();
    const deployCalls = [];
    const agents = {
        getState: () => null,
        deployProject: async (...a) => { deployCalls.push(a); return deploy ? deploy() : {}; },
    };
    const req = (message) => ({ message, normalizedMessage: message, ...s.ctx, projectPath, userLang: 'ar' });
    const handle = (message) => s.rt._handleCeoIntent(req(message), agents);
    const intentLogs = () => s.logs().split('\n').filter((l) => /\[INTENT\]|\[DECISION\]/.test(l));
    return { ...s, projectPath, agents, deployCalls, handle, intentLogs };
}
const until = async (pred, ms = 1500) => { const t0 = Date.now(); while (!pred() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 20)); };

test('رسالةٌ بلا نيّةٍ سريعة → false ولا بثّ ولا مسارٌ ثقيل', async () => {
    const s = ceo('ceo');
    assert.equal(await s.handle('أريد قسم تقييمات جديد'), false);
    assert.equal(s.events.length, 0, 'لا شيءَ يُبثّ حين لا تُطابَق نيّة');
    assertNoHeavyPath(assert, s.calls, 'لا نيّة');
});

test('«أين وصلنا» → بطاقةُ حالةٍ فوريّة، وشفافيّةُ النيّة والقرار في البثّ', async () => {
    const s = ceo('ceo');
    assert.equal(await s.handle('أين وصلنا؟'), true);
    const reply = s.replies().at(-1);
    assert.ok(reply.includes(s.ctx.activeProject), `الردُّ يسمّي المشروع: ${reply}`);
    const il = s.intentLogs();
    assert.match(il[0], /"intent":"status"/);
    assert.match(il[1], /reply — استعلام حالة/);
    assertNoHeavyPath(assert, s.calls, 'حالة');
});

test('تحيّة → ردٌّ مباشر بلا تنفيذ', async () => {
    const s = ceo('ceo');
    assert.equal(await s.handle('مرحبا'), true);
    assert.ok(s.replies().at(-1).length > 0);
    assert.match(s.intentLogs()[0], /"intent":"greeting"/);
    assertNoHeavyPath(assert, s.calls, 'تحيّة');
});

test('«اكمل» بلا ذاكرة → سؤالٌ محدَّد بدل «ماذا تقصد؟»، ولا مهمّة', async () => {
    const s = ceo('ceo');
    assert.equal(await s.handle('اكمل'), true);
    assert.match(s.replies().at(-1), /لا أجد مشروعاً سابقاً/);
    assert.ok(s.replies().at(-1).includes(s.ctx.activeProject));
    assert.equal(s.calls.executeMission.length, 0);
});

test('«اكمل» مع ذاكرة → استئنافٌ بهدفٍ موسومٍ [استئناف] وسياقِ الغرفة نفسِه', async () => {
    const s = ceo('ceo');
    addToHistory(s.ctx.username, s.ctx.activeProject, 'بناء الصفحة الرئيسية');
    assert.equal(await s.handle('كمل من فضلك'), true);
    assert.match(s.replies().at(-1), /وجدت المشروع في الذاكرة/);
    assert.equal(s.calls.executeMission.length, 1);
    const [goal, ec] = s.calls.executeMission[0];
    assert.match(goal, /^\[استئناف\]/, 'الوسمُ يحمي الهدفَ من أن يُقرأ بناءً جديداً');
    assert.match(goal, /بناء الصفحة الرئيسية/);
    assert.equal(ec.projectPath, s.projectPath);
    assert.equal(ec.username, s.ctx.username);
});

test('«اكمل» أثناء مهمّةٍ نشطة → «الفريق يعمل» ولا تنفيذَ متوازٍ', async () => {
    const s = ceo('ceo');
    addToHistory(s.ctx.username, s.ctx.activeProject, 'x');
    let release;
    const gate = new Promise((r) => { release = r; });
    const running = enqueueMission({ username: s.ctx.username, project: s.ctx.activeProject, run: () => gate, onWait: () => {} });
    try {
        await until(() => isMissionActive(s.ctx.username, s.ctx.activeProject));
        assert.ok(isMissionActive(s.ctx.username, s.ctx.activeProject), 'الصفُّ يعرف المهمّة');
        assert.equal(await s.handle('اكمل'), true);
        assert.match(s.replies().at(-1), /الفريق يعمل على المشروع الآن/);
        assert.equal(s.calls.executeMission.length, 0);
        assert.match(s.intentLogs()[1], /مهمة تعمل بالفعل/);
    } finally { release(); await running; }
});

test('«انشر» على مشروعٍ ثابت → قبولٌ فوريّ ونشرٌ عبر الوكيل بأسرار المشروع', async () => {
    const s = ceo('ceo', { dir: tempProject() });
    assert.equal(await s.handle('انشر الموقع'), true);
    assert.match(s.replies().at(-1), /أمر النشر مقبول/);
    await until(() => s.deployCalls.length === 1);
    const [opts, io] = s.deployCalls[0];
    assert.equal(opts.projectPath, s.projectPath);
    assert.equal(opts.currentUser, s.ctx.username);
    assert.equal(opts.activeProject, s.ctx.activeProject);
    assert.ok('env' in opts, 'الأسرارُ تُمرَّر (ولو فارغة)');
    assert.equal(io, s.rt.io);
});

test('«انشر» على مشروعٍ full-stack بلا مستودع → مسارُ Render ثمّ طلبُ ربط GitHub، لا Vercel', async () => {
    const dir = tempProject();
    fs.mkdirSync(path.join(dir, 'api'));
    fs.writeFileSync(path.join(dir, 'api/orders.js'), 'export default (req, res) => res.json([]);\n');
    const s = ceo('ceo', { dir });
    assert.equal(await s.handle('انشر'), true);
    assert.match(s.replies()[0], /مشروع full-stack.*Render/);
    await until(() => s.replies().length >= 2);
    assert.match(s.replies().at(-1), /ربط المشروع بمستودع GitHub أولاً/, 'يقف مبكّراً بلا شبكة');
    assert.equal(s.deployCalls.length, 0, 'وكيلُ Vercel لا يُستدعى للـfull-stack');
});

test('«انشر» أثناء بناءٍ نشط → انتظارٌ لا نشر', async () => {
    const s = ceo('ceo', { dir: tempProject() });
    let release; const gate = new Promise((r) => { release = r; });
    const running = enqueueMission({ username: s.ctx.username, project: s.ctx.activeProject, run: () => gate, onWait: () => {} });
    try {
        await until(() => isMissionActive(s.ctx.username, s.ctx.activeProject));
        assert.equal(await s.handle('انشر'), true);
        assert.match(s.replies().at(-1), /البناء جارٍ الآن/);
        assert.equal(s.deployCalls.length, 0);
    } finally { release(); await running; }
});

test('دفعٌ إلى GitHub بلا مستودعٍ مربوط → «جاري الدفع» ثمّ فشلٌ صادق، بلا شبكة', async () => {
    const s = ceo('ceo', { dir: tempProject() });
    assert.equal(await s.handle('push to github'), true);
    assert.match(s.replies()[0], /جاري الدفع إلى GitHub/);
    await until(() => s.replies().length >= 2);
    assert.match(s.replies().at(-1), /فشل الدفع — لا يوجد مستودع مرتبط/);
});
