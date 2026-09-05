// 🚀 شكلُ `render.yaml` — ومَن يقرّره
//
// `prepareRenderDeploy(projectPath, name, hasBackend)` يقلب الإعدادَ رأساً على
// عقب: **موقعٌ ثابت** (`env: static`) مقابل **خدمةِ Node** (`npm install` +
// `node server.js` + `MONGODB_URI`).
//
// 🔴 **تصحيحٌ لدعوىً كتبتُها أنا (Sprint 4j يصحّح 4i).** قلتُ إنّ مسارَي
//    النشر يفرضان `true` فيُلغيان قرارَ التجهيز، وإنّ «مشروعاً ثابتاً يُنشَر
//    خدمةَ Node». **وهذا خطأ**: المواضعُ الثلاثة كلُّها داخل حارس
//    `isFullStackProject(projectPath)` — وهو يشترط دالّةً حقيقيّةً في `api/`
//    (لا `db.js`/`schema.js`/`seed.js`/`connection.js`). فالموقعُ الثابتُ **لا
//    يبلغ هذه الأسطر أصلاً**، و`true` عندها صوابٌ لا انحراف.
//
//    وقعتُ في الغلط نفسِه مرّتين في هذا المسار: قرأتُ قيمةً ثابتةً في سطرٍ
//    ولم أقرأ **الشرطَ المحيط به**. القيمةُ الثابتةُ داخل حارسٍ صحيحٍ ليست
//    ترميزاً صلباً، بل نتيجةً مثبتة. **الحارسُ جزءٌ من المعنى.**
//
// فما يثبّته هذا الملفُّ ليس «حالةً تنتظر قراراً»، بل **الاقترانَ الذي يجعل
// `true` صحيحة**: لو زال الحارسُ أو ضَعُف، صار الثابتُ عطباً حقيقيّاً.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';
import { generateRenderConfig } from '../agents/renderAgent.js';

divertConsoleToStderr();

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(BACKEND, f), 'utf8');

test('العلَمُ يقلب الإعدادَ فعلاً — وإلا فلا معنى لبقيّة الملفّ', () => {
    const stat = generateRenderConfig('demo', false);
    const node = generateRenderConfig('demo', true);
    assert.match(stat, /env: static/);
    assert.doesNotMatch(stat, /startCommand/);
    assert.match(node, /env: node/);
    assert.match(node, /startCommand: node server\.js/);
    assert.match(node, /MONGODB_URI/);
});

test('مواضعُ الجواب الخمسة كما قِيست — أيُّ تغييرٍ قرارٌ لا انزلاق', () => {
    // تُشتقّ من القرص: النصُّ هو الحقيقة، لا قائمةٌ في ذاكرتي.
    const sites = [];
    for (const f of ['agents/jcr.js', 'server.js', 'agents/renderAgent.js', 'services/deployAutomation.js']) {
        read(f).split('\n').forEach((line, i) => {
            const m = /prepareRenderDeploy\(|prepare\(projectPath/.exec(line);
            if (!m || /export (async )?function/.test(line)) return;
            const arg = /,\s*(true|false)\s*\)/.exec(line) || /,\s*(\w+)\s*\)/.exec(line);
            sites.push(`${f}:${i + 1} → ${arg ? arg[1] : '?'}`);
        });
    }
    assert.deepEqual(sites.sort(), [
        'agents/jcr.js:2228 → false',
        'agents/jcr.js:2290 → false',
        'agents/jcr.js:886 → hasBackend',   // ترتيبُ النصّ لا العدد
        'agents/renderAgent.js:172 → hasBackend',
        'server.js:2391 → false',
        'services/deployAutomation.js:211 → true',
    ], 'مواضعُ تقرير شكل `render.yaml` تغيّرت — راجع الحارسَ والوثيقة معاً');
});

test('`true` عند النشر مقترنةٌ بحارسِ full-stack — والاقترانُ هو الصواب', () => {
    // الحارسُ يشترط دالّةً حقيقيّةً في `api/`؛ فالثابتُ نتيجةٌ لا افتراض.
    for (const f of ['server.js', 'agents/jcr.js']) {
        const src = read(f);
        const guard = src.indexOf('isFullStackProject(');
        const call = src.indexOf('deployToRender(');
        assert.ok(guard !== -1, `\`${f}\`: حارسُ full-stack اختفى`);
        assert.ok(call !== -1 && guard < call,
            `\`${f}\`: نداءُ النشر لم يعد داخل الحارس — عندها يصير \`true\` عطباً`);
    }
    assert.match(read('services/deployAutomation.js'), /prepare\(projectPath, projectSlug, true\)/,
        '`autoDeployFullStack` لم يعد يمرّر `true` صراحةً — تغيّر السلوك');
});

test('الحارسُ يعني ما يقوله: دالّةٌ حقيقيّةٌ في api/ لا ملفُّ بيانات', async () => {
    const { isFullStackProject } = await import('../agents/deployAgent.js');
    const fsx = await import('fs'); const osx = await import('os'); const px = await import('path');
    const dir = fsx.mkdtempSync(px.join(osx.tmpdir(), 'jaola-fs-'));
    try {
        fsx.mkdirSync(px.join(dir, 'api'));
        fsx.writeFileSync(px.join(dir, 'api', 'db.js'), '1');
        assert.equal(isFullStackProject(dir), false, 'ملفُّ بياناتٍ وحده جعل المشروعَ full-stack');
        fsx.writeFileSync(px.join(dir, 'api', 'auth.js'), '1');
        assert.equal(isFullStackProject(dir), true, 'دالّةٌ حقيقيّةٌ لم تُحتسب');
    } finally { fsx.rmSync(dir, { recursive: true, force: true }); }
});

test('«أيحتاج خلفيةً؟» له مصدرٌ واحدٌ قائم — والمواضعُ الثابتة تتجاوزه', () => {
    const need = read('agents/backendNeed.js');
    assert.match(need, /export function needsBackend/, 'مصدرُ الحقيقة الواحد اختفى');
    assert.match(read('agents/jcr.js'), /needsBackend\(context\.originalGoal\)/,
        'الموضعُ الوحيد الذي يسأل المصدرَ الواحد لم يعد يفعل');
});
