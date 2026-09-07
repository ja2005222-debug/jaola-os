// 🧾 PM/15 — «الحكمُ يقرأ ما بُني كلَّه»: مسارُ React يكتب مشروعاً متعدّدَ الصفحات، والحكمُ يقرأ `index.html`
// وحدَها. قِيس على وثيقة مكتبةٍ من ١٢ بنداً: البناءُ يكتب ٣٠ ملفّاً منها ٧ صفحاتٍ ثابتة، و`readProjectFiles`
// يعود بواحدة — فستُّ صفحاتٍ لا يراها تتبّعُ المتطلّبات ولا تتبّعُ بنود الوثيقة. الأثر: المتطلّبات ٣/٤ بدل
// **٤/٤**، وبنودُ الوثيقة ١٠/١٢ بدل **١١/١٢** — **سقوطٌ زائف**، عكسُ اتّجاه PM/14 تماماً.
//
// الحدُّ الذي يمنع توسيعَ القارئ القائم: له تسعةُ مواضع نداء، منها ثلاثةٌ في التعديل الجراحيّ وواحدٌ في جولة
// الإصلاح — وحداتٌ **تقرأ لتكتب**؛ فتوسيعُها يجعل المُعدِّلَ يرى سبعَ صفحاتٍ فيعدّل الخطأ منها. فيُشقّ قارئٌ
// للحكم (ما وصل القرصَ كلُّه) ويبقى القائمُ للتعديل على تحديده الصحيح لغرضه: الصفحةُ وما تُحمّله.
// وللمسار الثالث سابقةٌ في المستودع: `buildFromRegistry` يحكم على الملفّات التي كتبها هو، لا على قراءةٍ ضيّقة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { readBuiltFiles, readProjectFiles } from '../agents/projectReader.js';
import { buildReactProject } from '../agents/stages/buildReact.js';
import { setDomainModel } from '../agents/projectMemory.js';
import { setUserLanguage } from '../agents/languageDetector.js';
import { transitionState, STATES } from '../agents/stateMachine.js';
import { RoomReporter } from '../core/runtime/RoomReporter.js';
import { scenario, emptyProject } from './helpers/jcrScenario.mjs';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const quiet = () => new RoomReporter({ to: () => ({ emit: () => {} }) });
const SPEC = `أريد بناء نظام إدارة مكتبة عامة متكامل.

1. الأعضاء: تسجيل عضو جديد وإصدار بطاقة عضوية.
2. الكتب: فهرس كامل بالعنوان والمؤلف ورقم ISBN.
3. الإعارة: إعارة نسخة لعضو بتاريخ استحقاق.
4. الإرجاع: تسجيل الإرجاع وحساب غرامة التأخير.
5. الحجز: حجز كتاب معار وطابور انتظار.
6. البحث: بحث موحد في الكتب والأعضاء.`;
const MODEL = { roles: [{ name: 'أمين المكتبة' }, { name: 'مدير' }, { name: 'عضو' }],
    entities: [{ name: 'كتاب' }, { name: 'عضو' }, { name: 'إعارة' }, { name: 'حجز' }], flows: [] };

async function buildLibrary(prefix) {
    const s = scenario(prefix); setUserLanguage(s.ctx.username, 'ar');
    const dir = emptyProject();
    transitionState(s.ctx.username, s.ctx.activeProject, STATES.GENERATING, { agent: 't' });
    setDomainModel(s.ctx.username, s.ctx.activeProject, MODEL);
    const r = await buildReactProject(SPEC, { ...s.ctx, projectPath: dir },
        { sections: ['الرئيسية', 'الأعضاء', 'الكتب', 'الإعارة', 'الحجز', 'تواصل'] }, quiet());
    return { dir, verdict: r.verdict };
}

test('قارئُ الحكم يرى كلَّ صفحةٍ بُنيت — والقارئُ الضيّق كان يرى واحدة', async () => {
    const { dir } = await buildLibrary('pm15a');
    const built = await readBuiltFiles(dir);
    const pages = built.filter(f => f.name.endsWith('.html')).map(f => f.name);
    assert.ok(pages.length >= 6, `صفحاتٌ مرئيّة: ${pages.join(', ')}`);
    assert.ok(pages.includes('index.html'), 'الصفحةُ الأولى');
    assert.ok(built.some(f => f.name === 'lib/content.js'), 'محتوى المشروع تحت مجلّد');
    // القارئُ القائمُ للتعديل لم يتوسّع: الصفحةُ وما تُحمّله فقط
    const narrow = await readProjectFiles(dir);
    assert.equal(narrow.filter(f => f.name.endsWith('.html')).length, 1, 'قارئُ التعديل بقي على صفحةٍ واحدة');
    assert.ok(built.length > narrow.length, `${built.length} ≤ ${narrow.length}`);
});

test('حكمُ مسار React على ما بُني كلِّه: بندُ الوثيقة الذي كُتب في صفحته له أثر', async () => {
    const { verdict } = await buildLibrary('pm15b');
    const req = (verdict.gates || []).find(g => g.name === 'requirements-verify');
    // كلُّ متطلّبات النموذج لها أثرٌ في الصفحات المكتوبة — وكانت «شاشة مدير» بلا أثرٍ لأنّ صفحتَها لم تُقرأ
    assert.equal(req.status, 'pass', req.detail);
    assert.doesNotMatch(req.detail, /بلا أثر/, req.detail);
});

test('قارئُ الحكم لا يبتلع ما ليس مصدراً: node_modules والمخفيّ والثنائيّ', async () => {
    const dir = emptyProject();
    fs.writeFileSync(path.join(dir, 'index.html'), '<!DOCTYPE html><html><body><h1>ص</h1></body></html>');
    fs.mkdirSync(path.join(dir, 'node_modules', 'x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'x', 'index.js'), 'module.exports=1;');
    // مجلّدُ بناءِ Next وسجلُّ git — ملفّاتُ مصدرٍ بامتدادها، وليست منتجَ المستخدم
    fs.mkdirSync(path.join(dir, '.next', 'static'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.next', 'static', 'chunk.js'), 'window.__NEXT_P=[];');
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git', 'COMMIT_EDITMSG.txt'), 'wip');
    fs.writeFileSync(path.join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const built = await readBuiltFiles(dir);
    const names = built.map(f => f.name);
    assert.deepEqual(names, ['index.html'], names.join(', '));
});

test('مسارٌ لا وجود له: مصفوفةٌ فارغة لا استثناء', async () => {
    assert.deepEqual(await readBuiltFiles('/tmp/لا-يوجد-هذا-المسار-إطلاقاً'), []);
});
