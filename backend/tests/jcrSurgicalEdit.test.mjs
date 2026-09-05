// ✂️ `_runSurgicalEditNow` — أكبرُ طريقةٍ في jcr.js (٢١٥ سطراً) وكانت بلا
// اختبارٍ واحدٍ يذكرها. هذه اختباراتُ **توصيف**: تُثبّت ما يقع اليوم، لا ما
// نتمنّاه — كي يصير أيُّ نقلٍ لاحقٍ قابلاً للتحقّق بخطِّ أساسٍ مطابق.
//
// المسارُ حتميٌّ بلا نموذجٍ لغويّ: التوجيهُ (صفحات / بناءٌ كامل / تعديل)
// يقرّره النصُّ وقائمةُ الملفّات، و`coreEditCodePlan` يُحقَن، وحارسُ الارتداد
// يقارن دوالاً مستخرَجةً قبل وبعد. `patchEditPlan` يمرّ بـ`smartChat` الذي
// يعود بلا مفتاحٍ فارغاً، وهو محاطٌ بـ`try` أصلاً.
//
// المحروسُ الأثمن: حارسُ الارتداد بمرحلتيه — (أ) تعديلُ المستخدم أتلف →
// استرجاعُ ما قبله؛ (ب) الإصلاحُ التلقائيّ أتلف → إلغاءُ الإصلاح وحده وتعديلُ
// المستخدم يبقى. الخلطُ بينهما كان بلاغَ مستخدمٍ حقيقيّاً: «كلُّ تعديلٍ يعود
// للنسخة الأصليّة».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { setUserLanguage, clearUserLanguage } from '../agents/languageDetector.js';
import { updateLanguage } from '../agents/userProfile.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const FNS = ['openCart', 'checkout', 'loadMenu', 'showReport'];
const jsWith = (names) => names.map((n) => `function ${n}() { return '${n}'; }`).join('\n') + '\n';
const ORIGINAL_JS = jsWith(FNS);

/** مشروعٌ ثابتٌ حقيقيّ: `index.html` يشير إلى `app.js` فتقرؤه readProjectFilesArray. */
function staticProject({ react = false } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcr-surg-'));
    const scripts = react ? '<script src="lib/content.js"></script><script src="app.js"></script>' : '<script src="app.js"></script>';
    fs.writeFileSync(path.join(dir, 'index.html'), `<!DOCTYPE html><html><body><h1>مطعم</h1>${scripts}</body></html>\n`);
    fs.writeFileSync(path.join(dir, 'app.js'), ORIGINAL_JS);
    if (react) {
        fs.mkdirSync(path.join(dir, 'lib'));
        fs.writeFileSync(path.join(dir, 'lib/content.js'), 'export const content = { brand: "x", sections: {}, routes: [] };\n');
    }
    return dir;
}

let seq = 0;
function scenario(dir, { plan, planThrows = null, autofix = null, withAgent = true } = {}) {
    seq += 1;
    const events = [];
    const io = { to: (room) => ({ emit: (ev, payload) => events.push({ room, ev, payload }) }) };
    const rt = new JaolaCognitiveRuntime(io);
    const calls = { mission: [], verify: [], rename: [], del: [], add: [] };
    rt._runMissionNow = async (...a) => { calls.mission.push(a); return { success: true, via: 'mission' }; };
    rt._verifyAndAutofix = async (...a) => { calls.verify.push(a); if (autofix) await autofix(dir); };
    rt._renamePageNow = async (...a) => { calls.rename.push(a); return { success: true, via: 'rename' }; };
    rt._deletePageNow = async (...a) => { calls.del.push(a); return { success: true, via: 'delete' }; };
    rt._addPageNow = async (...a) => { calls.add.push(a); return { success: true, via: 'add' }; };
    const agents = withAgent
        ? { coreEditCodePlan: async () => { if (planThrows) throw planThrows; return plan; } }
        : {};
    const username = `__surg_u${seq}__`;
    // 🔎 اكتشافُ توصيف: `getUserLanguage` تعيد 'en' للمجهول لا null، فـ`|| 'ar'`
    //    في الطريقة لا يُبلَغ. تُثبَّت اللغةُ صراحةً كي تُختبر الرسائلُ العربيّة.
    setUserLanguage(username, 'ar');
    const ctx = { projectPath: dir, username, activeProject: `surg-${seq}`, roomName: `surg_room_${seq}`, agents };
    const run = (instruction) => rt._runSurgicalEditNow(instruction, ctx);
    const ev = (name) => events.filter((e) => e.ev === name).map((e) => e.payload);
    const logs = () => ev('log').map((p) => p.message).join('\n');
    const appJs = () => fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
    return { rt, run, calls, ev, logs, appJs, ctx };
}
const cleanup = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// ── التوجيه ────────────────────────────────────────────────────────────

test('مشروعٌ بلا ملفّات → بناءٌ كامل، لا تعديل', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcr-surg-empty-'));
    try {
        const s = scenario(dir, { plan: { files: [] } });
        const r = await s.run('غيّر لون الزر');
        assert.equal(r.via, 'mission');
        assert.equal(s.calls.mission.length, 1);
        assert.equal(s.calls.mission[0][0], 'غيّر لون الزر', 'التعليمةُ تُمرَّر حرفيّاً');
    } finally { cleanup(dir); }
});

test('عبارةُ إعادةِ بناءٍ صريحة → بناءٌ كامل حتى مع مشروعٍ قائم', async () => {
    const dir = staticProject();
    try {
        const s = scenario(dir, { plan: { files: [] } });
        for (const phrase of ['أعد البناء من الصفر', 'redesign the whole site', 'ابنِ تطبيق جديد']) {
            await s.run(phrase);
        }
        assert.equal(s.calls.mission.length, 3, 'ثلاثُ عباراتٍ ثلاثةُ تحويلات');
        assert.equal(s.appJs(), ORIGINAL_JS, 'القرصُ لم يُلمس');
    } finally { cleanup(dir); }
});

test('بلا وكيلِ coreEditCodePlan → بناءٌ كامل', async () => {
    const dir = staticProject();
    try {
        const s = scenario(dir, { withAgent: false });
        const r = await s.run('غيّر لون الزر');
        assert.equal(r.via, 'mission');
    } finally { cleanup(dir); }
});

test('مشروعُ React: إعادةُ تسميةِ صفحة → _renamePageNow بأسماءٍ منظَّفة وترتيبِ وسائطٍ ثابت', async () => {
    const dir = staticProject({ react: true });
    try {
        const s = scenario(dir, { plan: { files: [] } });
        const r = await s.run('أعد تسمية صفحة من نحن إلى عنّا');
        assert.equal(r.via, 'rename');
        const [projectPath, username, activeProject, roomName, lang, oldName, newName] = s.calls.rename[0];
        assert.equal(projectPath, dir);
        assert.equal(username, s.ctx.username);
        assert.equal(activeProject, s.ctx.activeProject);
        assert.equal(roomName, s.ctx.roomName);
        assert.equal(lang, 'ar');
        assert.equal(oldName, s.rt._cleanPageName('من نحن'));
        assert.equal(newName, s.rt._cleanPageName('عنّا'));
        assert.equal(s.calls.mission.length, 0);
    } finally { cleanup(dir); }
});

test('مشروعُ React: حذفُ صفحة → _deletePageNow، وإضافةُ صفحة → _addPageNow', async () => {
    const dir = staticProject({ react: true });
    try {
        const s = scenario(dir, { plan: { files: [] } });
        assert.equal((await s.run('احذف صفحة الأسعار')).via, 'delete');
        assert.equal(s.calls.del[0].at(-1), s.rt._cleanPageName('الأسعار'));
        assert.equal((await s.run('أضف صفحة اتصل بنا')).via, 'add');
        assert.equal(s.calls.add[0][0], 'أضف صفحة اتصل بنا', 'التعليمةُ كاملةً لا الاسمُ وحده');
        assert.equal((await s.run('add a page for pricing')).via, 'add');
    } finally { cleanup(dir); }
});

test('أسبقيّةٌ مُثبَّتة: عمليّاتُ الصفحات قبل فحصِ «التغيير الكبير»', async () => {
    // «أضف صفحة … من الصفر» يطابق الاثنين. القرارُ الموثَّق في المصدر: الصفحةُ
    // تفوز — وإلّا أعاد طلبُ صفحةٍ بناءَ الموقع كلِّه ودهس الكلونَ العامل.
    const dir = staticProject({ react: true });
    try {
        const s = scenario(dir, { plan: { files: [] } });
        const r = await s.run('أضف صفحة جديدة من الصفر');
        assert.equal(r.via, 'add');
        assert.equal(s.calls.mission.length, 0, 'لم يُعَد البناء');
    } finally { cleanup(dir); }
});

test('مشروعٌ غيرُ React: «أضف صفحة» ليست عمليّةَ صفحاتٍ بل تعديلٌ عاديّ', async () => {
    const dir = staticProject();
    try {
        const s = scenario(dir, { plan: { files: [{ name: 'app.js', content: jsWith([...FNS, 'pageAbout']) }] } });
        const r = await s.run('أضف صفحة من نحن');
        assert.equal(s.calls.add.length, 0, 'لا _addPageNow خارجَ React');
        assert.equal(r.success, true);
        assert.deepEqual(r.edited, ['app.js']);
    } finally { cleanup(dir); }
});

// ── مسارُ التعديل ─────────────────────────────────────────────────────

test('بعد إعادة تشغيل الخادم: لا جلسةَ لغةٍ، والملفُّ عربيّ → الردُّ عربيّ (كان إنجليزيّاً)', async () => {
    // 🔴 اكتشافُ JCR/1: `getUserLanguage(username) || 'ar'` احتياطُه ميّت. الجذرُ
    //    أُصلح في languageDetector (الملفُّ الدائم قبل 'en')، وهذا يُثبته من طرف المستخدم.
    const dir = staticProject();
    try {
        const edited = jsWith([...FNS, 'applyCoupon']);
        const s = scenario(dir, { plan: { files: [{ name: 'app.js', content: edited }] } });
        updateLanguage(s.ctx.username, 'ar');
        clearUserLanguage(s.ctx.username);       // scenario() ضبط الجلسة؛ نمحوها = إعادةُ تشغيل
        const r = await s.run('أضف زر كوبون');
        assert.equal(r.success, true);
        assert.match(s.ev('chat_reply').at(-1).message, /طبّقت التعديل على/, 'عربيٌّ بلا جلسة');
    } finally { cleanup(dir); }
});

test('تعديلٌ يحفظ الدوالَ ويضيف → يُكتب على القرص ويُبلَّغ المستخدم', async () => {
    const dir = staticProject();
    try {
        const edited = jsWith([...FNS, 'applyCoupon']);
        const s = scenario(dir, { plan: { files: [{ name: 'app.js', content: edited }] } });
        const r = await s.run('أضف زر كوبون');
        assert.deepEqual(r, { success: true, edited: ['app.js'] });
        assert.equal(s.appJs(), edited, 'الملفُّ المعدَّل هو ما على القرص');
        assert.equal(s.calls.verify.length, 1, 'التحقّقُ السلوكيّ يُستدعى مرّة');
        assert.match(s.ev('chat_reply').at(-1).message, /طبّقت التعديل على: \*\*app\.js\*\*/);
        assert.ok(s.ev('preview_updated').length >= 1);
        assert.deepEqual(s.ev('agent_states').at(-1), { planner: 'completed', architect: 'completed', coder: 'completed', qa: 'completed', deploy: 'completed' });
        assert.equal(s.ev('stream_done').length, 1);
    } finally { cleanup(dir); }
});

test('فشلُ المولّد → بناءٌ كامل، وقناةُ البثّ تُغلق', async () => {
    const dir = staticProject();
    try {
        const s = scenario(dir, { planThrows: new Error('provider down') });
        const r = await s.run('أضف زر');
        assert.equal(r.via, 'mission');
        assert.equal(s.ev('stream_done').length, 1, 'stream_done حتى عند الفشل');
        assert.match(s.logs(), /عودة للبناء الكامل: provider down/);
        assert.equal(s.appJs(), ORIGINAL_JS);
    } finally { cleanup(dir); }
});

test('خطّةٌ فارغة → بناءٌ كامل بلا كتابة', async () => {
    const dir = staticProject();
    try {
        const s = scenario(dir, { plan: { files: [] } });
        const r = await s.run('أضف زر');
        assert.equal(r.via, 'mission');
        assert.match(s.logs(), /بلا نتيجة/);
        assert.equal(s.appJs(), ORIGINAL_JS);
    } finally { cleanup(dir); }
});

// ── حارسُ الارتداد (أ): تعديلُ المستخدم نفسُه ─────────────────────────

test('(أ) تعديلٌ إضافيٌّ يُسقط دالّتين → استرجاعُ الأصل، ونتيجةٌ صادقة', async () => {
    const dir = staticProject();
    try {
        const dropping = jsWith(['openCart', 'checkout', 'applyCoupon']);   // أسقط loadMenu وshowReport
        const s = scenario(dir, { plan: { files: [{ name: 'app.js', content: dropping }] } });
        const r = await s.run('أضف زر كوبون');
        assert.equal(r.success, false);
        assert.equal(r.reverted, true);
        assert.deepEqual([...r.lost].sort(), ['loadMenu', 'showReport']);
        assert.equal(s.appJs(), ORIGINAL_JS, 'النسخةُ الأصليّة عادت إلى القرص');
        assert.match(s.logs(), /RegressionGuard.*حذف 2 ميزة/);
        assert.match(s.ev('chat_reply').at(-1).message, /كان سيحذف ميزات موجودة/);
        assert.equal(s.calls.verify.length, 0, 'لا تحقّقَ بعد الاسترجاع');
    } finally { cleanup(dir); }
});

test('(أ) نيّةُ الحذف الصريحة تُعطّل الحارس — المستخدمُ أراد الإسقاط', async () => {
    const dir = staticProject();
    try {
        const dropping = jsWith(['openCart', 'checkout']);
        for (const phrase of ['احذف التقارير والقائمة', 'remove the reports feature', 'شيل التقارير']) {
            fs.writeFileSync(path.join(dir, 'app.js'), ORIGINAL_JS);
            const s = scenario(dir, { plan: { files: [{ name: 'app.js', content: dropping }] } });
            const r = await s.run(phrase);
            assert.equal(r.success, true, `«${phrase}» حذفٌ مقصود`);
            assert.equal(s.appJs(), dropping);
        }
    } finally { cleanup(dir); }
});

test('(أ) العتبةُ دالّتان: إسقاطُ واحدةٍ يمرّ', async () => {
    const dir = staticProject();
    try {
        const oneLess = jsWith(['openCart', 'checkout', 'loadMenu', 'applyCoupon']);   // أسقط showReport فقط
        const s = scenario(dir, { plan: { files: [{ name: 'app.js', content: oneLess }] } });
        const r = await s.run('أضف زر كوبون');
        assert.equal(r.success, true);
        assert.equal(s.appJs(), oneLess);
    } finally { cleanup(dir); }
});

test('(أ) «شيل» لا تُقرأ داخلَ «تشيلي» — عطبٌ سابقٌ مُثبَّت', async () => {
    // كان `/شيل/` يطابق «تشيلي» فيُعطّل الحارسَ على طلبِ **إضافة**، فتضيع
    // الدوالُ صامتةً. المُطابِقُ المشترك يفرض حدودَ الكلمة.
    const dir = staticProject();
    try {
        const dropping = jsWith(['openCart', 'checkout']);
        const s = scenario(dir, { plan: { files: [{ name: 'app.js', content: dropping }] } });
        const r = await s.run('أضف طبق تشيلي للقائمة');
        assert.equal(r.reverted, true, 'إضافةُ «تشيلي» ليست حذفاً');
        assert.equal(s.appJs(), ORIGINAL_JS);
    } finally { cleanup(dir); }
});

// ── حارسُ الارتداد (ب): الإصلاحُ التلقائيّ ─────────────────────────────

test('(ب) الإصلاحُ التلقائيّ يُتلف → يُلغى هو وحده، وتعديلُ المستخدم يبقى', async () => {
    // هذا هو بلاغُ «كلُّ تعديلٍ يعود للنسخة الأصليّة»: كان الحارسُ يسترجع
    // ما **قبل** تعديل المستخدم فيمحو تعديلاً نجح. المرجعُ الصحيح لقطةُ ما بعده.
    const dir = staticProject();
    try {
        const userEdit = jsWith([...FNS, 'applyCoupon']);
        const corrupt = jsWith(['openCart', 'applyCoupon']);   // الإصلاحُ يُسقط ثلاثاً
        const s = scenario(dir, {
            plan: { files: [{ name: 'app.js', content: userEdit }] },
            autofix: (d) => fs.writeFileSync(path.join(d, 'app.js'), corrupt),
        });
        const r = await s.run('أضف زر كوبون');
        assert.equal(r.success, true, 'تعديلُ المستخدم نجح فالنتيجةُ نجاح');
        assert.equal(s.appJs(), userEdit, 'القرصُ = ما بعد تعديل المستخدم، لا الأصلُ ولا المُتلَف');
        assert.match(s.logs(), /جولة الإصلاح التلقائي أسقطت 3 ميزة/);
        assert.doesNotMatch(s.logs(), /استرجاع نسختك الكاملة/, 'لم يُستدعَ حارسُ (أ)');
    } finally { cleanup(dir); }
});

test('(ب) إصلاحٌ تلقائيٌّ سليم لا يُلمس', async () => {
    const dir = staticProject();
    try {
        const userEdit = jsWith([...FNS, 'applyCoupon']);
        const polished = userEdit + '// polished\n';
        const s = scenario(dir, {
            plan: { files: [{ name: 'app.js', content: userEdit }] },
            autofix: (d) => fs.writeFileSync(path.join(d, 'app.js'), polished),
        });
        await s.run('أضف زر كوبون');
        assert.equal(s.appJs(), polished, 'إصلاحٌ حافظٌ على الدوال يبقى');
    } finally { cleanup(dir); }
});
