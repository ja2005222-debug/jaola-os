// ✂️ `stages/surgicalEdit.js#runSurgicalEdit(instruction, ctx, reporter, ops)` — JCR/22.
//
// `jcrSurgicalEdit` (١٧ اختباراً) يوصّف الجسدَ عبر المفوِّض على الصنف مستبدِلاً خمسَ طرائقَ على النسخة؛
// هذا الملفّ يوصّف **الشقَّ** الذي جعل تلك الاستبدالاتِ تبقى نافذةً بعد النقل: `ops` كائنُ دوالٍّ محقَن، والمُبلِّغُ
// يُمرَّر، و`cleanPageName`/`readProjectFiles` يُستوردان. الدالّةُ الحرّة ≡ المفوِّض بثّاً وقرصاً وناتجاً.
//
// المسارُ حتميٌّ بلا نموذجٍ لغويّ: `patchEditPlan` يمرّ بـ`smartChat` الذي يعود فارغاً بلا مفتاح (محاطٌ بـ`try`)،
// و`coreEditCodePlan` يُحقَن في `ctx.agents`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runSurgicalEdit } from '../agents/stages/surgicalEdit.js';
import { cleanPageName } from '../agents/stages/reactPages.js';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const HERE = import.meta.dirname;
const FNS = ['openCart', 'checkout', 'loadMenu', 'showReport'];
const jsWith = (names) => names.map((n) => `function ${n}() { return '${n}'; }`).join('\n') + '\n';
const ORIGINAL_JS = jsWith(FNS);

function staticProject({ react = false } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'surg-stage-'));
    const scripts = react ? '<script src="lib/content.js"></script><script src="app.js"></script>' : '<script src="app.js"></script>';
    fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html><html><body><h1>مطعم</h1>${scripts}</body></html>\n`);
    fs.writeFileSync(path.join(dir, 'app.js'), ORIGINAL_JS);
    if (react) {
        fs.mkdirSync(path.join(dir, 'lib'));
        fs.writeFileSync(path.join(dir, 'lib/content.js'), 'export const content = { brand: "x", sections: {}, routes: [] };\n');
    }
    return dir;
}
const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });

let seq = 0;
/** مُبلِّغٌ حقيقيّ فوق io لاقط + `ops` مسجِّل — كلُّ دالّةٍ تعيد وسماً يميّزها. */
function harness(dir, { plan = { files: [] }, planThrows = null, autofix = null, withAgent = true } = {}) {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const reporter = new RoomReporter(io);
    const calls = { runMission: [], renamePage: [], deletePage: [], addPage: [], verify: [], plan: [] };
    const ops = {
        runMission: async (...a) => { calls.runMission.push(a); return { success: true, via: 'mission' }; },
        renamePage: async (...a) => { calls.renamePage.push(a); return { success: true, via: 'rename' }; },
        deletePage: async (...a) => { calls.deletePage.push(a); return { success: true, via: 'delete' }; },
        addPage: async (...a) => { calls.addPage.push(a); return { success: true, via: 'add' }; },
        verify: async (...a) => { calls.verify.push(a); if (autofix) await autofix(dir); },
    };
    const agents = withAgent
        ? { coreEditCodePlan: async (...a) => { calls.plan.push(a); if (planThrows) throw planThrows; return plan; } }
        : {};
    const username = `__surgstage_u${seq}_${Date.now()}__`;
    setUserLanguage(username, 'ar');
    const ctx = { projectPath: dir, username, activeProject: `surgstage-${seq}`, roomName: `surgstage_room_${seq}`, agents };
    const run = (instruction) => runSurgicalEdit(instruction, ctx, reporter, ops);
    const ev = (name) => events.filter((e) => e.ev === name).map((e) => e.payload);
    const appJs = () => fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
    return { run, ops, calls, ctx, events, ev, reporter, io, appJs };
}

// ── الشقّ: كلُّ عمليّةٍ تصل إلى دالّتها في `ops` بوسائطها الحرفيّة ───────────────────────────

test('صفحاتُ React: rename/delete/add تصل إلى ops بترتيبِ وسائطٍ ثابت والأسماءُ منظَّفة — والباقي لا يُلمس', async () => {
    const dir = staticProject({ react: true });
    try {
        const h = harness(dir);
        const r = await h.run('أعد تسمية صفحة "من نحن." إلى "عنّا،"');
        assert.equal(r.via, 'rename');
        assert.deepEqual(h.calls.renamePage[0], [dir, h.ctx.username, h.ctx.activeProject, h.ctx.roomName, 'ar', cleanPageName('"من نحن."'), cleanPageName('"عنّا،"')]);
        assert.equal(cleanPageName('"من نحن."'), 'من نحن', 'التنظيفُ يقشّر الاقتباسَ والترقيم فعلاً');
        assert.equal((await h.run('delete page "Pricing"')).via, 'delete');
        assert.deepEqual(h.calls.deletePage[0], [dir, h.ctx.username, h.ctx.activeProject, h.ctx.roomName, 'ar', 'Pricing']);
        assert.equal((await h.run('أضف صفحة اتصل بنا')).via, 'add');
        assert.deepEqual(h.calls.addPage[0], ['أضف صفحة اتصل بنا', dir, h.ctx.username, h.ctx.activeProject, h.ctx.roomName, 'ar']);
        assert.equal(h.calls.runMission.length + h.calls.verify.length + h.calls.plan.length, 0, 'عمليّاتُ الصفحات تعود قبل أيِّ مسارٍ آخر');
        assert.equal(h.events.length, 0, 'لا بثَّ من الموجِّه نفسِه — البثُّ في المفوَّض إليه');
    } finally { cleanup(dir); }
});

test('عودةٌ للبناء: ops.runMission(instruction, ctx) بالسياق نفسِه، وناتجُه يُعاد كما هو — ثلاثةُ أبواب', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'surg-empty-'));
    const dir = staticProject();
    try {
        const h0 = harness(empty);
        assert.deepEqual(await h0.run('أضف زرّاً'), { success: true, via: 'mission' });
        assert.equal(h0.calls.runMission[0][0], 'أضف زرّاً'); assert.equal(h0.calls.runMission[0][1], h0.ctx, 'السياقُ نفسُه بالهويّة لا نسخة');
        const h1 = harness(dir);
        await h1.run('أعد بناء الموقع من الصفر');
        assert.equal(h1.calls.runMission.length, 1, 'التغييرُ الكبير → بناء');
        assert.equal(h1.calls.plan.length, 0, 'ولا يُستشار المولّدُ أصلاً');
        const h2 = harness(dir, { withAgent: false });
        await h2.run('أضف زرّاً');
        assert.equal(h2.calls.runMission.length, 1, 'بلا coreEditCodePlan → بناء');
        // الحارسُ المبكّر لا احتياطُ الرمي: بلا وكيلٍ يعود قبل أيِّ بثّ — لا «تعذّر … is not a function» ولا stream_done.
        assert.equal(h2.events.length, 0, 'بوّابةُ «بلا مولّد» صامتة — لا تصل إلى catch المولّد');
    } finally { cleanup(dir); cleanup(empty); }
});

test('فشلُ المولّد وخطّتُه الفارغة → بناءٌ كامل، stream_done مرّةً واحدة، ولا كتابةَ على القرص', async () => {
    const dir = staticProject();
    try {
        const h = harness(dir, { planThrows: new Error('boom') });
        assert.equal((await h.run('أضف زرّاً')).via, 'mission');
        assert.equal(h.ev('stream_done').length, 1);
        assert.match(h.ev('log').map((p) => p.message).join('\n'), /عودة للبناء الكامل: boom/);
        const h2 = harness(dir, { plan: { files: [] } });
        assert.equal((await h2.run('أضف زرّاً')).via, 'mission');
        assert.equal(h2.appJs(), ORIGINAL_JS);
        assert.equal(h2.calls.verify.length, 0, 'لا تحقّقَ على خطّةٍ لم تُكتب');
    } finally { cleanup(dir); }
});

test('التحقّقُ يصل عبر ops.verify بكائن الخيارات الثمانية وcanFix=true — ورميُه لا يُسقط التعديل', async () => {
    const dir = staticProject();
    try {
        const edited = jsWith([...FNS, 'applyCoupon']);
        const h = harness(dir, { plan: { files: [{ name: 'app.js', content: edited }] }, autofix: async () => { throw new Error('verify-down'); } });
        const r = await h.run('أضف زر كوبون');
        assert.deepEqual(r, { success: true, edited: ['app.js'] });
        assert.deepEqual(h.calls.verify[0], [{ projectPath: dir, blueprint: null, username: h.ctx.username, activeProject: h.ctx.activeProject, roomName: h.ctx.roomName, agents: h.ctx.agents, lang: 'ar', canFix: true }]);
        assert.equal(h.appJs(), edited);
        // 📸 النسخةُ الاحتياطيّة قبل التعديل: لقطةٌ موسومة `_edit` تحت `.backups/` تحمل الأصلَ لا المعدَّل.
        const snaps = fs.readdirSync(path.join(dir, '.backups')).filter((n) => n.endsWith('_edit'));
        assert.equal(snaps.length, 1, 'لقطةٌ واحدة لتعديلٍ واحد');
        assert.equal(fs.readFileSync(path.join(dir, '.backups', snaps[0], 'app.js'), 'utf8'), ORIGINAL_JS);
        // 📊 عدّادُ التعديلات يُحدَّث قبل بثّ القياسات — كان لا يُستدعى أبداً (تعليقُ الجسد)؛ الاسمُ موسومٌ بالوقت لأنّ الذاكرةَ على القرص.
        assert.equal(h.ev('project_metrics').at(-1).totalEdits, 1);
    } finally { cleanup(dir); }
});

test('React: المولّدُ يتلقّى ملفّاتِ المصدر بلا صفحات HTML المولَّدة', async () => {
    const dir = staticProject({ react: true });
    try {
        const h = harness(dir, { plan: { files: [] } });
        await h.run('غيّر لون الزرّ');
        const [, filesGiven, lang] = h.calls.plan[0];
        assert.deepEqual(filesGiven.map((f) => f.name).sort(), ['app.js', 'lib/content.js']);
        assert.equal(lang, 'ar');
    } finally { cleanup(dir); }
});

// ── التكافؤ: الدالّةُ الحرّة ≡ المفوِّض على الصنف ──────────────────────────────────────────

test('الدالّةُ الحرّةُ ≡ المفوِّض — التعديلُ الناجح بثّاً وقرصاً وناتجاً، والاستبدالاتُ على النسخة تصل', async () => {
    const a = staticProject(); const b = staticProject();
    try {
        const edited = jsWith([...FNS, 'applyCoupon']);
        const free = harness(a, { plan: { files: [{ name: 'app.js', content: edited }] } });
        const viaFree = await free.run('أضف زر كوبون');

        const events = [];
        const rt = new JaolaCognitiveRuntime({ to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) });
        const seen = { mission: 0, verify: 0 };
        rt._runMissionNow = async () => { seen.mission += 1; };
        rt._verifyAndAutofix = async () => { seen.verify += 1; };
        const username = `__surgstage_cls${Date.now()}__`; setUserLanguage(username, 'ar');
        const ctx = { projectPath: b, username, activeProject: 'surgstage-cls', roomName: 'surgstage_room_cls', agents: { coreEditCodePlan: async () => ({ files: [{ name: 'app.js', content: edited }] }) } };
        const viaClass = await rt._runSurgicalEditNow('أضف زر كوبون', ctx);

        assert.deepEqual(viaFree, viaClass);
        assert.equal(seen.verify, 1, 'استبدالُ _verifyAndAutofix على النسخة وصل عبر ops.verify');
        assert.equal(seen.mission, 0);
        const shape = (evs) => evs.map((e) => [e.ev, typeof e.payload?.message === 'string' ? e.payload.message : (Array.isArray(e.payload) ? [...e.payload].sort() : null)]);
        assert.deepEqual(shape(free.events), shape(events));
        assert.equal(fs.readFileSync(path.join(a, 'app.js'), 'utf8'), fs.readFileSync(path.join(b, 'app.js'), 'utf8'));
    } finally { cleanup(a); cleanup(b); }
});

// ── الحدود ─────────────────────────────────────────────────────────────────────────────────

test('الحدود: لا this، لا استيرادَ من jcr، خمسُ دوالِّ ops بعدِّ نداءاتها، reporter.io واحدٌ معلَن، والمفوِّضُ بشكله', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/surgicalEdit.js'), 'utf8');
    // السطريّةُ أوّلاً: تعليقٌ سطريٌّ في الجسد يحوي `/*` (index.html/*.html) كان يبتلع نصفَ الملفّ لو قُشّرت الكتليّةُ أوّلاً.
    const code = mod.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[^]*?\*\//g, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    const count = (re) => (code.match(re) || []).length;
    assert.deepEqual(
        { runMission: count(/ops\.runMission\(/g), renamePage: count(/ops\.renamePage\(/g), deletePage: count(/ops\.deletePage\(/g), addPage: count(/ops\.addPage\(/g), verify: count(/ops\.verify\(/g) },
        { runMission: 3, renamePage: 1, deletePage: 1, addPage: 1, verify: 1 }, 'قِيست قبل النقل: ٣ عوداتٍ للبناء + ٣ عمليّاتِ صفحات + تحقّقٌ واحد');
    assert.equal(count(/\bops\.\w+/g), 7, 'لا نداءَ على ops غيرَ الخمس');
    assert.equal(count(/reporter\.io\b/g), 1, 'تسريبُ io واحد — للدفع التلقائيّ');
    assert.equal(count(/reporter\.liveLog\(/g), 11); assert.equal(count(/reporter\.send\(/g), 11);
    assert.equal(count(/\breadProjectFiles\(/g), 3); assert.equal(count(/\bcleanPageName\(/g), 3);

    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    assert.ok(jcr.includes(`\n    async _runSurgicalEditNow(instruction, ctx) {
        return runSurgicalEdit(instruction, ctx, this.reporter, {
            runMission: (goal, c) => this._runMissionNow(goal, c),
            renamePage: (...a) => this._renamePageNow(...a),
            deletePage: (...a) => this._deletePageNow(...a),
            addPage: (...a) => this._addPageNow(...a),
            verify: (opts) => this._verifyAndAutofix(opts),
        });
    }\n`), 'المفوِّضُ سطرُ نداءٍ واحد بخمس دوالٍّ مربوطةٍ بالنسخة');
    assert.ok(jcr.includes("import { runSurgicalEdit } from './stages/surgicalEdit.js';"));
    // اليتيماتُ السبع خرجت مع الجسد — قِيست بالنداء لا بالاسم.
    for (const n of ['hasKeyword', 'patchEditPlan', 'backupProject', 'buildStaticSiteFromSource', 'buildProjectModelContext', 'extractDefinedFunctions', 'scrubPlaceholders']) {
        assert.ok(!new RegExp(`\\b${n}\\b`).test(jcr.replace(/^\s*\/\/.*$/gm, '')), `${n} ما زال في jcr`);
    }
});
