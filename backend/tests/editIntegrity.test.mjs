// 🧷 حارس سلامة التعديلات الجراحية — من عطل حقيقي (test17-7-5):
// تعديل «أضف نظام جلسات فيديو» أعاد index.html بدون <link rel="stylesheet">
// فظهر الموقع كله HTML خاماً بلا تصميم. guardFiles (syntax فقط) لم يلحظ شيئاً.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureEditIntegrity } from '../services/codeGuard.js';

let dir;
before(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jaola-integrity-'));
    await fs.writeFile(path.join(dir, 'index.html'),
        '<!DOCTYPE html>\n<html><head>\n    <link rel="stylesheet" href="styles.css">\n</head><body><h1>أكاديمية</h1>\n    <script src="script.js"></script>\n</body></html>');
    await fs.writeFile(path.join(dir, 'styles.css'), 'body { color: red; }');
    await fs.writeFile(path.join(dir, 'script.js'), 'console.log(1);');
});
after(async () => { await fs.rm(dir, { recursive: true, force: true }); });

test('التعديل الذي يُسقط رابط التنسيق → يُعاد الرابط من النسخة السابقة', async () => {
    // سيناريو العطل الحرفي: HTML كامل جديد بقسم الفيديو لكن بلا <link>
    const edited = '<!DOCTYPE html>\n<html><head><title>ت</title></head><body><nav>جلسات الفيديو</nav><h1>أكاديمية</h1></body></html>';
    const [fixed] = await ensureEditIntegrity([{ name: 'index.html', content: edited }], dir);
    assert.match(fixed.content, /<link rel="stylesheet" href="styles\.css">/);
});

test('التعديل الذي يُسقط DOCTYPE و<script src> → يُعادان', async () => {
    const edited = '<html><head><link rel="stylesheet" href="styles.css"></head><body><h1>hi</h1></body></html>';
    const [fixed] = await ensureEditIntegrity([{ name: 'index.html', content: edited }], dir);
    assert.match(fixed.content, /^<!DOCTYPE html>/);
    assert.match(fixed.content, /<script src="script\.js"><\/script>\s*<\/body>/);
});

test('ملف سليم يمرّ دون أي لمس (نفس المرجع)', async () => {
    const ok = '<!DOCTYPE html>\n<html><head><link rel="stylesheet" href="styles.css"></head><body>x<script src="script.js"></script></body></html>';
    const input = [{ name: 'index.html', content: ok }];
    const [out] = await ensureEditIntegrity(input, dir);
    assert.equal(out, input[0]);
});

test('التنسيق المضمّن <style> يُعتبر بديلاً مشروعاً — لا حقن', async () => {
    const inline = '<!DOCTYPE html>\n<html><head><style>body{}</style></head><body>x<script src="script.js"></script></body></html>';
    const [out] = await ensureEditIntegrity([{ name: 'index.html', content: inline }], dir);
    assert.equal((out.content.match(/<link/g) || []).length, 0);
});

test('مرجع CSS لملف غير موجود + مرشح وحيد على القرص → يُصحَّح المسار', async () => {
    const edited = '<!DOCTYPE html>\n<html><head><link rel="stylesheet" href="main.css"></head><body>x<script src="script.js"></script></body></html>';
    const [fixed] = await ensureEditIntegrity([{ name: 'index.html', content: edited }], dir);
    assert.match(fixed.content, /href="styles\.css"/);
    assert.doesNotMatch(fixed.content, /main\.css/);
});

test('مرجع مكسور بلا مرشح → تحذير ظاهر ولا تخريب للمحتوى', async () => {
    const warnings = [];
    const edited = '<!DOCTYPE html>\n<html><head><link rel="stylesheet" href="styles.css"></head><body>x<script src="ghost.js"></script></body></html>';
    const [out] = await ensureEditIntegrity([{ name: 'index.html', content: edited }], dir, (m) => warnings.push(m));
    assert.ok(warnings.some(w => w.includes('ghost.js')), 'يجب التحذير من ghost.js');
    assert.match(out.content, /ghost\.js/); // لا حذف صامت
});

test('الروابط الخارجية (CDN/خطوط) لا تُعامل كمراجع محلية', async () => {
    const warnings = [];
    const edited = '<!DOCTYPE html>\n<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo"><link rel="stylesheet" href="styles.css"></head><body>x<script src="script.js"></script></body></html>';
    const input = [{ name: 'index.html', content: edited }];
    const [out] = await ensureEditIntegrity(input, dir, (m) => warnings.push(m));
    assert.equal(out, input[0]);
    assert.equal(warnings.length, 0);
});

test('الملفات غير HTML والقيم الشاذة تمرّ كما هي', async () => {
    const input = [{ name: 'script.js', content: 'x()' }, null, { name: 'a.css' }];
    const out = await ensureEditIntegrity(input, dir);
    assert.deepEqual(out, input);
});

test('مشروع بلا نسخة سابقة (مجلد غير موجود) → لا انهيار ولا حقن أعمى', async () => {
    const edited = '<html><head><title>x</title></head><body>y</body></html>';
    const [out] = await ensureEditIntegrity([{ name: 'index.html', content: edited }], path.join(dir, 'ghost-dir'));
    assert.match(out.content, /^<!DOCTYPE html>/); // DOCTYPE حتمي دوماً
    assert.doesNotMatch(out.content, /<link/); // لا مرشح CSS → لا حقن
});
