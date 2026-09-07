// ⚛️ PM/22 — «نوعُ المشروع حقيقةٌ على القرص، لا رأيُ قارئٍ اختار غرضَه»: التعديلُ الجراحيّ يسأل «أهذا مشروعُ React؟»
// من قائمةِ `readProjectFiles` — وهو **قارئُ التعديل**، يقرأ الصفحةَ وما تُحمّله وحدَها بتصميمٍ مقصود (PM/15:
// «لو رأى المُعدِّلُ سبعَ صفحاتٍ لعدّل الخطأ منها»). فعلى مشروع React حقيقيّ يعود بـ`index.html` وحدَها،
// و`lib/content.js` موجودٌ على القرص ولا يراه — فـ`isReact` **خطأٌ دائماً**. والأثرُ ثلاثةُ أضرارٍ مقيسة:
//   • عمليّاتُ الصفحات الثلاث (تسمية/حذف/إضافة) **ميّتةٌ بالكامل**: يطلب المستخدمُ حذفَ صفحة، فلا يُحذف شيء،
//     ويُقال له «✅ طبّقت التعديل على index.html فقط».
//   • المعاينةُ لا يُعاد توليدُها من `lib/content.js` بعد التعديل — والرسالةُ تقول «المعاينة تحدّثت».
//   • التعديلُ يُوجَّه إلى `index.html` المولَّد بدل المصدر، فيفترق الاثنان.
// وهو PM/15 نفسُه من الجهة الأخرى: قارئٌ صحيحٌ لغرضه، أُعيد استعمالُه لغرضٍ آخر (PM/17، PM/19، PM/20).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { buildReactProject } from '../agents/stages/buildReact.js';
import { runSurgicalEdit } from '../agents/stages/surgicalEdit.js';
import { readProjectFiles, isReactProject } from '../agents/projectReader.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const noLlm = async () => { throw new Error('لا مزوّد'); };
const quiet = () => new RoomReporter({ to: () => ({ emit: () => {} }) });

/** مشروعُ React حقيقيّ على القرص، بقسمَين مسمّيَين. */
async function reactProject(prefix) {
    const s = scenario(prefix);
    setUserLanguage(s.ctx.username, 'ar');
    const dir = emptyProject();
    const ctx = { ...s.ctx, projectPath: dir, agents: {} };
    await buildReactProject('متجر ورد', ctx, { sections: ['الباقات', 'التوصيل'], llm: noLlm }, quiet());
    return { ctx, dir };
}

const stubOps = (called) => ({
    renamePage: async () => { called.push('renamePage'); return { ok: 1 }; },
    deletePage: async () => { called.push('deletePage'); return { ok: 1 }; },
    addPage: async () => { called.push('addPage'); return { ok: 1 }; },
    runMission: async () => { called.push('runMission'); return { success: false }; },
    verify: async () => null,
});

test('عمليّاتُ صفحات React الثلاث تعمل على مشروع React — لا تسقط إلى التعديل العامّ', async () => {
    for (const [instruction, expected] of [
        ['أعد تسمية صفحة الباقات إلى العروض', 'renamePage'],
        ['احذف صفحة التوصيل', 'deletePage'],
        ['أضف صفحة الأسئلة الشائعة', 'addPage'],
    ]) {
        const { ctx } = await reactProject('pm22op');
        const called = [];
        ctx.agents = { coreEditCodePlan: async (_i, files) => ({ files: files.slice(0, 1) }) };
        await runSurgicalEdit(instruction, ctx, quiet(), stubOps(called));
        assert.deepEqual(called, [expected], `«${instruction}» سلكت: ${called.join('، ') || 'التعديلَ العامّ'}`);
    }
});

test('وطلبُ الحذف يحذف فعلاً — لا «✅ طبّقت التعديل» وصفحةُ المستخدم باقية', async () => {
    const { ctx, dir } = await reactProject('pm22del');
    const pages = () => fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
    const before = pages();
    assert.ok(before.includes('altwsyl.html'), `صفحةُ التوصيل مبنيّة: ${before.join('، ')}`);
    const called = [];
    ctx.agents = { coreEditCodePlan: async (_i, files) => ({ files: files.slice(0, 1) }) };
    await runSurgicalEdit('احذف صفحة التوصيل', ctx, quiet(), stubOps(called));
    assert.deepEqual(called, ['deletePage'], 'الطلبُ يصل عمليّةَ الحذف');
});

test('والمعاينةُ تُعاد من المصدر بعد التعديل — فما يُقال «تحدّثت» يكون قد تحدّث', async () => {
    const { ctx, dir } = await reactProject('pm22prev');
    const src = fs.readFileSync(path.join(dir, 'lib/content.js'), 'utf8');
    // نأخذ نصّاً موجوداً في المصدر **وفي الصفحة المعروضة** معاً — لا نفترضه
    const brand = JSON.parse(src.match(/"brand":\s*("(?:[^"\\]|\\.)*")/)[1]);
    assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes(brand), `«${brand}» معروضةٌ قبل التعديل`);
    ctx.agents = { coreEditCodePlan: async () => ({ files: [{ name: 'lib/content.js', content: src.split(brand).join('زهور المدينة') }] }) };
    const ev = [];
    const reporter = new RoomReporter({ to: () => ({ emit: (e, p) => ev.push([e, p]) }) });
    const called = [];
    await runSurgicalEdit('استبدل اسم المتجر بزهور المدينة', ctx, reporter, stubOps(called));
    assert.deepEqual(called, [], 'تعديلٌ عاديّ — لا عمليّةَ صفحة');

    const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(idx.includes('زهور المدينة'), 'النصُّ الجديد بلغ الصفحةَ المعروضة');
    assert.ok(!idx.includes(brand), 'ولم يبقَ القديمُ فيها');
    assert.match((ev.find(([e]) => e === 'chat_reply') || [])[1]?.message || '', /المعاينة تحدّثت/);
});

test('الحدّ: قارئُ التعديل يبقى ضيّقاً كما قُصد (PM/15) — الكشفُ من القرص لا بتوسيعه', async () => {
    const { dir } = await reactProject('pm22rd');
    const seen = await readProjectFiles(dir);
    assert.deepEqual(seen.map((f) => f.name), ['index.html'], 'قارئُ التعديل لم يُوسَّع');
    for (const f of ['lib/content.js', 'app/page.jsx']) {
        assert.ok(fs.existsSync(path.join(dir, f)), `${f} على القرص ولا يراه القارئ`);
    }
});

// الحارسُ صُحِّح بالقياس: أوّلُ صياغةٍ له كانت «عمليّةُ صفحةٍ فقط إن كانت X صفحةً موجودة»، فأسقطت حارسَين
// قائمَين يقولان «أعد تسمية **صفحة** من نحن إلى عنّا» على مشروعٍ بلا صفحات. وهما محقّان: من قال «صفحة»
// صراحةً يعني صفحةً، و«⚠️ لم أجد صفحة باسم «من نحن». الصفحات الحالية: …» جوابٌ صادقٌ نافع — لا بناءٌ كامل.
// فالمُميِّزُ هو **اللفظُ** لا الوجود: قالها ⇒ عمليّةُ صفحةٍ مهما كان الاسم؛ لم يقلها ⇒ لا تُفترَض إلّا بصفحةٍ قائمة.
test('والحدُّ الذي يحمي من الارتداد: كلمةُ «صفحة» تحسم، وبغيابها لا تُفترَض العمليّةُ إلّا على صفحةٍ قائمة', async () => {
    for (const [instruction, expected] of [
        ['أعد تسمية صفحة الباقات إلى العروض', ['renamePage']],  // لفظٌ صريح + صفحةٌ قائمة
        ['أعد تسمية صفحة المتجر إلى زهور', ['renamePage']],     // لفظٌ صريح بلا صفحة → «لم أجد صفحة» لا بناءٌ كامل
        ['غيّر اسم الباقات إلى العروض', ['renamePage']],        // بلا لفظ، لكنّ «الباقات» صفحةٌ مبنيّة
        ['غيّر اسم المتجر إلى زهور المدينة', []],                // بلا لفظٍ ولا صفحة → تعديلٌ عاديّ
    ]) {
        const { ctx } = await reactProject('pm22ren');
        const called = [];
        ctx.agents = { coreEditCodePlan: async (_i, files) => ({ files: files.slice(0, 1) }) };
        const ev = [];
        await runSurgicalEdit(instruction, ctx, new RoomReporter({ to: () => ({ emit: (e, p) => ev.push([e, p]) }) }), stubOps(called));
        assert.deepEqual(called, expected, `«${instruction}» سلكت: ${called.join('، ') || 'التعديلَ العامّ'}`);
        if (!expected.length) {
            const reply = (ev.find(([e]) => e === 'chat_reply') || [])[1]?.message || '';
            assert.ok(!/لم أجد صفحة/.test(reply), `لا يُردّ عليه بـ«لم أجد صفحة»: ${reply}`);
        }
    }
});

test('ومصادرُ React تصل المُعدِّلَ — لا صفرُ ملفّاتٍ بعد استبعاد الصفحات المولَّدة', async () => {
    const { ctx } = await reactProject('pm22src');
    let seen = null;
    ctx.agents = { coreEditCodePlan: async (_i, files) => { seen = files.map((f) => f.name); return { files: [] }; } };
    await runSurgicalEdit('اجعل الخلفية داكنة', ctx, quiet(), stubOps([]));
    assert.ok(seen && seen.length, `وصل المُعدِّلَ: ${seen === null ? '(لم يُستدعَ)' : 'صفر ملفّات'}`);
    assert.ok(seen.includes('lib/content.js'), `مصدرُ المحتوى فيها: ${seen.join('، ')}`);
    assert.ok(seen.some((n) => n.startsWith('components/')), `والمكوّناتُ كذلك: ${seen.join('، ')}`);
    assert.ok(!seen.some((n) => /^[^/]+\.html$/.test(n)), 'ولا صفحةَ HTML مولَّدة');
});

test('وعلامتا الكشف كلتاهما تكفيان — `app/page.jsx` وحدَها مشروعُ React', async () => {
    const dir = emptyProject();
    assert.equal(await isReactProject(dir), false, 'مجلّدٌ فارغ ليس React');
    fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'app/page.jsx'), 'export default function Page() { return null; }\n');
    assert.equal(await isReactProject(dir), true, 'صفحةُ Next وحدَها تكفي — لا يُشترط lib/content.js');
});
