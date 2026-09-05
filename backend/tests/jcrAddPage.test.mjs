// ═══════════════════════════════════════════════════════════════════
// ➕ `_addPageNow` — المسارُ الذي يُضيف صفحةً لمشروع React قائم.
//
// كان بلا تغطية، وفيه حلقةُ تفرّدٍ شرطُ انتهائها أنّ `compName` يعطي قيمةً
// مختلفة كلّما تغيّر ترتيبُ القسم: `while (existing.has(comp)) comp =
// compName(label, ++n)`. وهذا صحيحٌ فقط ما دام الاسمُ مشتقّاً من **الموضع**
// (`SectionN`). ولمّا صار مشتقّاً من **المعنى** (`About`) ثبتت القيمةُ فصارت
// الحلقةُ لا تنتهي — والخادمُ يتجمّد على طلبِ مستخدمٍ عاديّ.
//
// فالمحروسُ هنا شيئان: أنّ الصفحةَ العربية تأخذ مساراً ذا معنى، وأنّ إضافةَ
// صفحةٍ باسمٍ يُنتج مكوّناً موجوداً **تنتهي**.
// ═══════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JaolaCognitiveRuntime } from '../agents/jcr.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// مشروع Next حقيقي مصغَّر: `lib/content.js` هو ما يقرؤه المسار فعلاً.
function nextProject(sections = {}, routes = [{ label: 'الرئيسية', href: '/' }]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcr-next-'));
    fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'components'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
    const content = { brand: 'مطعم البحر', hero: { title: 'أهلاً' }, sections, routes };
    fs.writeFileSync(path.join(dir, 'lib/content.js'),
        `export const content = ${JSON.stringify(content, null, 2)};\n`);
    return dir;
}

let seq = 0;
function runtime() {
    seq += 1;
    const events = [];
    const io = { to: () => ({ emit: (ev, payload) => events.push({ ev, payload }) }) };
    const rt = new JaolaCognitiveRuntime(io);
    return { rt, events, user: `__addpage_u${seq}__`, proj: `addpage-${seq}` };
}

const addPage = (h, dir, instruction) =>
    h.rt._addPageNow(instruction, dir, h.user, h.proj, `room_${h.proj}`, 'ar');

test('صفحةٌ عربية تأخذ مساراً ذا معنى لا رقماً — والملفات تُكتب باسمه', async () => {
    const h = runtime();
    const dir = nextProject({ Navbar: {}, Hero: {}, Footer: {} });

    const r = await addPage(h, dir, 'أضف صفحة من نحن');

    assert.equal(r.success, true);
    assert.equal(r.addedPage, 'about', `المسار: ${r.addedPage}`);
    assert.equal(r.label, 'من نحن', 'التسميةُ العربية هي المعنى فلا تُفقد');
    assert.ok(fs.existsSync(path.join(dir, 'components/About.jsx')), 'مكوّن About لم يُكتب');
    assert.ok(fs.existsSync(path.join(dir, 'app/about/page.jsx')), 'صفحة app/about لم تُكتب');

    // الوجهةُ في شريط التنقّل: عنوانٌ عربيّ ورابطٌ لاتينيّ ذو معنى
    const content = JSON.parse(fs.readFileSync(path.join(dir, 'lib/content.js'), 'utf8')
        .replace(/^[^{]*/, '').replace(/;\s*$/, ''));
    assert.deepEqual(content.routes.at(-1), { label: 'من نحن', href: '/about' });
});

// هذه هي الحلقةُ التي كانت ستتجمّد. الاختبارُ نفسه يقع تحت مهلة node:test،
// فلو عادت لَعُلِّق الملفُّ بدل أن يسقط — ولذلك يُقاس الناتجُ أيضاً لا الوصولُ فقط.
test('إضافةُ صفحةٍ باسمٍ يُنتج مكوّناً موجوداً تنتهي بلاحقةٍ فريدة', async () => {
    const h = runtime();
    const dir = nextProject({ Navbar: {}, Hero: {}, Footer: {}, About: {} },
        [{ label: 'الرئيسية', href: '/' }, { label: 'عنّا', href: '/about' }]);

    const r = await addPage(h, dir, 'أضف صفحة من نحن');

    assert.equal(r.success, true);
    assert.notEqual(r.addedPage, 'about', 'داس المسارَ القائم');
    assert.match(r.addedPage, /^about\d*(-\d+)?$/, `مسارٌ غير متوقَّع: ${r.addedPage}`);
    const content = JSON.parse(fs.readFileSync(path.join(dir, 'lib/content.js'), 'utf8')
        .replace(/^[^{]*/, '').replace(/;\s*$/, ''));
    assert.equal(Object.keys(content.sections).filter(k => k.startsWith('About')).length, 2);
});

test('صفحتان عربيّتان مختلفتان تأخذان مسارين مختلفين ذوَي معنى', async () => {
    const h = runtime();
    const dir = nextProject({ Navbar: {}, Hero: {}, Footer: {} });

    const a = await addPage(h, dir, 'أضف صفحة اتصل بنا');
    const b = await addPage(h, dir, 'أضف صفحة الأسعار');

    assert.equal(a.addedPage, 'contact');
    assert.equal(b.addedPage, 'pricing');
    assert.ok(fs.existsSync(path.join(dir, 'app/contact/page.jsx')));
    assert.ok(fs.existsSync(path.join(dir, 'app/pricing/page.jsx')));
});
