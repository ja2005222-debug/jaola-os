import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkJS, checkHTML, guardFiles } from '../services/codeGuard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════
// عقد checkJS: سليمٌ لا كامل. «غير صالح» يُسلِّم الملفَ إلى LLM ليعيد
// كتابته، فالإنذار الكاذب ليس إزعاجاً بل إتلافُ ملفٍ صحيح.
// ═══════════════════════════════════════════════════════

test('استيراد ممتدّ على أسطر — صيغةٌ يوميّة، لا خطأ', () => {
    const src = `import {\n  useState,\n  useEffect,\n} from 'react';\n\nexport default function App(){ return null; }\n`;
    assert.equal(checkJS(src).valid, true, checkJS(src).error);
});

test('import.meta — تعبيرٌ مشروعٌ في الوحدات', () => {
    const src = `import path from 'path';\nconst here = path.dirname(new URL(import.meta.url).pathname);\nexport default here;\n`;
    assert.equal(checkJS(src).valid, true, checkJS(src).error);
});

test('await على المستوى الأعلى — مشروعٌ في الوحدات', () => {
    const src = `import fs from 'fs/promises';\nconst data = await fs.readFile('x', 'utf8');\nexport default data;\n`;
    assert.equal(checkJS(src).valid, true, checkJS(src).error);
});

test('الاستيراد الديناميكي في أول السطر ليس تصريحاً فلا يُمحى ما بعده', () => {
    const bad = `export async function f(){\n  const m = 1;\n}\nimport('./x.js');\nconst y = ;\n`;
    const r = checkJS(bad);
    assert.equal(r.valid, false, 'خطأٌ حقيقيٌّ بعد import() مرّ دون كشف');
    assert.match(r.error, /سطر 5/);
});

test('الخطأ الحقيقي يُكشف على سطره حتى بعد استيرادٍ متعدد الأسطر', () => {
    const src = `import {\n  a,\n  b\n} from './x.js';\n\nconst ok = 1;\nfunction f(){ const y = ; }\n`;
    const r = checkJS(src);
    assert.equal(r.valid, false);
    assert.match(r.error, /سطر 7/, `الترقيم انزاح: ${r.error}`);
});

test('استيرادٌ لا يُغلق لا يبتلع بقيّة الملف', () => {
    // سطرُ استيرادٍ مبتور، ثم خطأٌ حقيقيٌّ بعده بأسطرٍ كثيرة
    const filler = Array.from({ length: 40 }, (_, i) => `const v${i} = ${i};`).join('\n');
    const src = `import {\n${filler}\nfunction g(){ const z = ; }\n`;
    assert.equal(checkJS(src).valid, false, 'ابتُلع الملف كلُّه فلم يُكشف الخطأ');
});

// ═══════════════════════════════════════════════════════
// الجسم المرجعي: وحدات الريبو نفسها. Node يُشغّلها كل يوم، فهي صحيحة
// قطعاً. أيُّ إنذارٍ عليها هو إنذارٌ كاذبٌ بالتعريف.
// ═══════════════════════════════════════════════════════
test('لا يُعلن الحارسُ وحدةً من وحدات الريبو مكسورة', () => {
    const files = [];
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
            else if (e.name.endsWith('.js')) files.push(p);
        }
    };
    for (const r of ['services', 'agents', 'core']) walk(path.join(BACKEND, r));
    assert.ok(files.length > 100, `الجسم المرجعي صغير على غير المتوقع: ${files.length}`);

    const bad = files
        .filter((f) => !checkJS(fs.readFileSync(f, 'utf8')).valid)
        .map((f) => path.relative(BACKEND, f));
    assert.deepEqual(bad, [], `إنذاراتٌ كاذبة على وحداتٍ عاملة: ${bad.join('، ')}`);
});

// ═══════════════════════════════════════════════════════
// النتيجة العمليّة: الملفُّ الصحيح لا يُسلَّم إلى LLM
// ═══════════════════════════════════════════════════════
test('guardFiles لا يستدعي الإصلاح الذاتي على ESM صحيح', async () => {
    const file = {
        name: 'api/handler.js',
        content: `import {\n  readFile,\n} from 'fs/promises';\n\nconst cfg = await readFile(new URL('./c.json', import.meta.url), 'utf8');\n\nexport default function handler(req, res){ res.json(JSON.parse(cfg)); }\n`,
    };
    const logs = [];
    const [out] = await guardFiles([file], (m) => logs.push(m));
    assert.equal(out.content, file.content, 'أُعيدت كتابة ملفٍ صحيح');
    assert.deepEqual(logs, [], `أُنذر على ملفٍ صحيح: ${logs.join(' | ')}`);
});

test('guardFiles ما يزال يبلّغ عن خطأ syntax حقيقي', async () => {
    const logs = [];
    await guardFiles([{ name: 'api/broken.js', content: 'export function f(){ const x = ; }\n' }], (m) => logs.push(m));
    assert.ok(logs.some((m) => m.includes('خطأ syntax')), `لم يُبلَّغ عن خطأٍ حقيقي: ${logs.join(' | ')}`);
});

// ═══════════════════════════════════════════════════════
// checkHTML: الطرفان من مجتمعٍ واحد
// ═══════════════════════════════════════════════════════
test('سكربتٌ خارجيٌّ لا يستر سكربتاً داخلياً غير مغلق', () => {
    const html = `<html><body><script src="a.js"></script><script>x=1;</body></html>`;
    assert.equal(checkHTML(html).valid, false, 'سُتر السكربت غير المغلق');
});

test('صفحةٌ سليمةٌ تبقى سليمة', () => {
    const html = `<html><head></head><body><script src="a.js"></script><script>x=1;</script></body></html>`;
    assert.deepEqual(checkHTML(html).warnings, []);
});
