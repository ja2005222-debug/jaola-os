// 📦 تصدير المشروع zip: «كودك ملكك» — بلا أسرار ولا داخليات.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { exportProjectZip } from '../services/projectExport.js';

function makeProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<html>موقعي</html>');
    fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1)');
    fs.mkdirSync(path.join(dir, 'images'));
    fs.writeFileSync(path.join(dir, 'images', 'gen-1.svg'), '<svg/>');
    // ما يجب استثناؤه دائماً
    fs.writeFileSync(path.join(dir, '.env'), 'MONGODB_URI=secret');
    fs.writeFileSync(path.join(dir, '.env.local'), 'KEY=secret2');
    fs.mkdirSync(path.join(dir, 'node_modules', 'x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', 'x', 'i.js'), '//dep');
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, '.git', 'HEAD'), 'ref');
    return dir;
}

test('يضم ملفات المشروع (بمجلداتها) ويستثني الأسرار والداخليات', () => {
    const dir = makeProject();
    const buf = exportProjectZip(dir);
    const names = new AdmZip(buf).getEntries().map(e => e.entryName);
    assert.ok(names.includes('index.html'), 'index.html موجود');
    assert.ok(names.includes('app.js'), 'app.js موجود');
    assert.ok(names.includes('images/gen-1.svg'), 'المجلدات المتداخلة تُضم');
    assert.ok(!names.some(n => n.includes('.env')), 'الأسرار لا تُصدَّر أبداً');
    assert.ok(!names.some(n => n.startsWith('node_modules')), 'بلا node_modules');
    assert.ok(!names.some(n => n.startsWith('.git')), 'بلا .git');
    // المحتوى سليم (يفكّ ويقرأ)
    const html = new AdmZip(buf).readAsText('index.html');
    assert.ok(html.includes('موقعي'));
    fs.rmSync(dir, { recursive: true, force: true });
});

test('مجلد غير موجود → خطأ صريح', () => {
    assert.throws(() => exportProjectZip('/no/such/dir'), /غير موجود/);
});
