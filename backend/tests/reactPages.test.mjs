// 📄 مساعداتُ صفحات React الثماني تخرج من jcr → `stages/reactPages.js` (JCR/20): أربعُ دوالّ نقيّة
// (extractPageName/cleanPageName/readReactContent/findPage) وأربعٌ تبثّ (persistReactContent/renamePageNow/deletePageNow/pageNotFound).
// `jcrSurgicalEdit` و`jcrAddPage` يستبدلان بعضَها على النسخة ويختبران التوجيهَ لا العمل — هنا التوصيفُ الأوّل للعمل نفسِه
// على مشروع React حقيقيّ مبنيٍّ بلا LLM: الاستخراجُ والتنظيفُ بحروفهما، الإيجادُ بثلاث درجات، إعادةُ التسمية والحذفُ على القرص
// والبثّ والذاكرة، «لم أجد صفحة» بقائمة الصفحات، تسريبُ `reporter.io` المعلَن — والتكافؤُ والحدود.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { extractPageName, cleanPageName, readReactContent, findPage, renamePageNow, deletePageNow, pageNotFound } from '../agents/stages/reactPages.js';
import { buildReactProject } from '../agents/stages/buildReact.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { setUserLanguage } from '../agents/languageDetector.js';
import { getProjectMemory } from '../agents/projectMemory.js';
import { transitionState, resetProjectState, STATES } from '../agents/stateMachine.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();
const HERE = import.meta.dirname;
const collect = () => { const events = []; return { events, reporter: new RoomReporter({ to: () => ({ emit: (ev, p) => events.push([ev, p]) }) }) }; };
const names = (events) => events.map(([ev]) => ev);
const reply = (events) => events.find(([ev]) => ev === 'chat_reply')?.[1];
// مشروعُ React حقيقيّ (بلا LLM) — أربعةُ أقسام → صفحات home/about/services/twasl
async function reactProject(s) {
    const dir = emptyProject(); transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 'test' });
    await buildReactProject('مطعم البحر', { ...s.ctx, projectPath: dir }, { sections: ['الرئيسية', 'من نحن', 'الخدمات', 'تواصل'] }, collect().reporter);
    resetProjectState(s.ctx.username, s.ctx.activeProject); return dir;
}
const args = (s, dir, lang = 'ar') => [dir, s.ctx.username, s.ctx.activeProject, s.ctx.roomName, lang];

test('استخراجُ اسم الصفحة: الزرُّ بلا اسم → افتراضيّ بلغته، الكلماتُ الدالّة تُقشَّر عربيّاً وإنجليزيّاً، والطويلُ يُرفض', () => {
    assert.equal(extractPageName('➕ أضف صفحة', 'ar'), 'صفحة جديدة'); assert.equal(extractPageName('➕ أضف صفحة', 'en'), 'New Page');
    assert.equal(extractPageName('من فضلك أضف لي صفحة جديدة اسمها «الأسعار».', 'ar'), 'الأسعار');
    assert.equal(extractPageName('please add a new page called Pricing!', 'en'), 'Pricing');
    assert.equal(extractPageName('اضافة صفحه بعنوان قصتنا', 'ar'), 'قصتنا');
    assert.equal(extractPageName('أضف صفحة ' + 'x'.repeat(61), 'ar'), 'صفحة جديدة');
    assert.equal(extractPageName('', 'en'), 'New Page');
});

test('تنظيفُ الاسم: الاقتباسُ والترقيمُ وكلمةُ صفحة الزائدة تسقط', () => {
    assert.equal(cleanPageName(' "صفحة الخدمات". '), 'الخدمات'); assert.equal(cleanPageName('the Pricing page?'), 'Pricing page');
    assert.equal(cleanPageName(null), '');
});

test('القراءةُ والإيجاد: null بلا lib/content.js؛ تطابقُ التسمية ثمّ التضمينُ ثمّ المسار؛ والرئيسيةُ خارجَ البحث', async () => {
    const s = scenario('rp0'); assert.equal(await readReactContent(emptyProject()), null);
    const dir = await reactProject(s); const content = await readReactContent(dir);
    assert.ok(Array.isArray(content.routes) && content.sections.About, 'المحتوى يُقرأ من lib/content.js');
    assert.equal(findPage(content, 'من نحن').comp, 'About'); assert.equal(findPage(content, 'من نحن').slug, 'about');
    assert.equal(findPage(content, 'نحن').comp, 'About', 'تضمينٌ بحرفَين فأكثر'); assert.equal(findPage(content, 'about').comp, 'About', 'بالمسار');
    assert.equal(findPage(content, 'غير موجودة'), null); assert.equal(findPage(content, 'ن'), null, 'حرفٌ واحد لا يكفي للتضمين');
    // 🔎 ملاحظة: على القرص يحمل الجذرُ `/` التسميةَ «Home» (لا «الرئيسية» كما في meta السكافولد) وبجانبه `/home` بالعربيّة —
    // فالبحثُ عن «home» يقع على الجذر إن لم يُستثنَ؛ الاستثناءُ يُعيد /home بمكوّنه لا الجذرَ بلا مكوّن.
    assert.deepEqual([findPage(content, 'الرئيسية').slug, findPage(content, 'الرئيسية').comp], ['home', 'Home']);
    assert.deepEqual([findPage(content, 'home').slug, findPage(content, 'home').comp], ['home', 'Home'], 'الجذرُ خارجَ البحث');
    assert.equal(content.routes[0].label, 'Home', 'تسميةُ الجذر على القرص إنجليزيّة في موقعٍ عربيّ — سلوكُ المولّد، يُدرَس في مكانه');
});

test('إعادةُ التسمية: التسميةُ والعنوانُ يتغيّران، lib/content.js والصفحاتُ الثابتة تُعاد كتابتُها، البثُّ بترتيبه، الذاكرةُ تؤرّخ، والزرّان', async () => {
    const s = scenario('rp1'); setUserLanguage(s.ctx.username, 'ar'); const dir = await reactProject(s); const { events, reporter } = collect();
    // الاسمُ الجديد مختومٌ بطابع الجولة: الذاكرةُ تبقى على القرص بين الجولات فلا يُرضي تاريخٌ قديم تأكيدَ التأريخ
    const NEW = `قصتنا ${Date.now()}`;
    const r = await renamePageNow(...args(s, dir), 'من نحن', NEW, reporter);
    assert.deepEqual(r, { success: true, renamed: 'about', label: NEW });
    const content = await readReactContent(dir);
    assert.equal(content.routes.find((x) => x.href === '/about').label, NEW); assert.equal(content.sections.About.heading, NEW);
    assert.ok(fs.readFileSync(path.join(dir, 'about.html'), 'utf8').includes(NEW), 'المعاينةُ الثابتة أُعيد توليدُها');
    assert.deepEqual(names(events), ['agent_states', 'preview_updated', 'workspace_files', 'chat_reply']);
    assert.equal(reply(events).message, `✅ أعدت تسمية الصفحة إلى **${NEW}** — حُدِّث الشريط في كل الصفحات.`);
    assert.deepEqual(reply(events).options, ['➕ أضف صفحة', '🚀 انشر الآن']);
    assert.ok(getProjectMemory(s.ctx.username, s.ctx.activeProject).history.some((h) => JSON.stringify(h).includes(`إعادة تسمية صفحة: من نحن → ${NEW}`)));
});

test('الحذف: الوجهةُ والقسمُ والملفّاتُ الثلاثة تزول، والردُّ بالإنجليزيّة بلغة النداء', async () => {
    const s = scenario('rp2'); const dir = await reactProject(s); const { events, reporter } = collect();
    const r = await deletePageNow(...args(s, dir, 'en'), 'services', reporter);
    assert.deepEqual(r, { success: true, deleted: 'services' });
    const content = await readReactContent(dir);
    assert.ok(!content.routes.some((x) => x.href === '/services') && !content.sections.Services);
    for (const f of ['components/Services.jsx', 'app/services', 'services.html']) assert.ok(!fs.existsSync(path.join(dir, f)), `${f} حُذف`);
    assert.ok(fs.existsSync(path.join(dir, 'about.html')), 'غيرُها يبقى');
    assert.equal(reply(events).message, '✅ Deleted page **الخدمات** and removed it from the nav — preview updated.');
    assert.deepEqual(reply(events).options, ['➕ Add a page', '🚀 Deploy now']);
});

test('«لم أجد صفحة»: قائمةُ الصفحات بلا الرئيسية، الناتجُ {success:false, notFound}؛ ومشروعٌ غيرُ مقروء → ردُّ التعذّر بلا رمي', async () => {
    const s = scenario('rp3'); const dir = await reactProject(s); const a = collect();
    const r = await renamePageNow(...args(s, dir), 'الأسعار', 'x', a.reporter);
    assert.deepEqual(r, { success: false, notFound: 'الأسعار' });
    assert.equal(reply(a.events).message, '⚠️ لم أجد صفحة باسم «الأسعار». الصفحات الحالية: الرئيسية، من نحن، الخدمات، تواصل');
    assert.equal(names(a.events).length, 1, 'لا كتابةَ ولا بثَّ آخر');
    const b = collect(); const d = await deletePageNow(...args(s, emptyProject()), 'x', b.reporter);
    assert.equal(d, undefined); assert.equal(reply(b.events).message, '⚠️ تعذّر قراءة المشروع.');
    const c = collect(); pageNotFound({ routes: [] }, s.ctx.roomName, 'en', 'Blog', c.reporter);
    assert.equal(reply(c.events).message, '⚠️ No page named "Blog". Current pages: —');
});

test('الدالّةُ الحرّةُ ≡ المفوِّض — إعادةُ التسمية بثّاً وقرصاً', async () => {
    const s = scenario('rpq'); setUserLanguage(s.ctx.username, 'ar'); const a = await reactProject(s); const b = await reactProject(s);
    const viaClass = await s.rt._renamePageNow(...args(s, a), 'تواصل', 'اتصل بنا');
    const { events, reporter } = collect();
    const viaFree = await renamePageNow(...args(s, b), 'تواصل', 'اتصل بنا', reporter);
    assert.deepEqual(viaFree, viaClass);
    const shape = (evs) => evs.map(([ev, p]) => [ev, typeof p?.message === 'string' ? p.message : (Array.isArray(p) ? [...p].sort() : null)]);
    assert.deepEqual(shape(events), shape(s.events.map((e) => [e.ev, e.payload])));
    assert.equal(fs.readFileSync(path.join(b, 'twasl.html'), 'utf8'), fs.readFileSync(path.join(a, 'twasl.html'), 'utf8'));
});

test('الحدود: لا this، لا استيرادَ من jcr، ثماني مفوِّضاتٍ بسطرٍ واحد، تسريبُ io واحدٌ معلَن، والنداءاتُ الداخليّة مباشرة', () => {
    const mod = fs.readFileSync(path.join(HERE, '../agents/stages/reactPages.js'), 'utf8');
    const code = mod.replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\bthis\./.test(code)); assert.ok(!/jcr\.js/.test(code));
    assert.equal((code.match(/reporter\.io\b/g) || []).length, 1);
    assert.equal((code.match(/, reporter\);/g) || []).length, 4, 'pageNotFound ×٢ + persistReactContent ×٢ — بالمُبلِّغ نفسِه');
    const jcr = fs.readFileSync(path.join(HERE, '../agents/jcr.js'), 'utf8');
    for (const [m, f] of [['_extractPageName(instruction, lang)', 'extractPageName(instruction, lang)'], ['_cleanPageName(s)', 'cleanPageName(s)'], ['_findPage(content, name)', 'findPage(content, name)'], ['_pageNotFound(content, roomName, lang, name)', 'pageNotFound(content, roomName, lang, name, this.reporter)']]) {
        assert.ok(jcr.includes(`\n    ${m} {\n        return ${f};\n    }\n`), m);
    }
    for (const [m, f] of [['_readReactContent(projectPath)', 'readReactContent(projectPath)'], ['_renamePageNow(projectPath, username, activeProject, roomName, lang, oldName, newName)', 'renamePageNow(projectPath, username, activeProject, roomName, lang, oldName, newName, this.reporter)'], ['_deletePageNow(projectPath, username, activeProject, roomName, lang, name)', 'deletePageNow(projectPath, username, activeProject, roomName, lang, name, this.reporter)'], ['_persistReactContent(projectPath, content, username, activeProject, roomName, lang, historyMsg)', 'persistReactContent(projectPath, content, username, activeProject, roomName, lang, historyMsg, this.reporter)']]) {
        assert.ok(jcr.includes(`\n    async ${m} {\n        return ${f};\n    }\n`), m);
    }
});
