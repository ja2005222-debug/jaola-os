// 🔐 مصادقة قوالب السيستم: كلمة مرور مُجزَّأة، افتراضية 'admin' قبل التغيير
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyPassword, setPassword } from '../services/projectAuth.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'projectauth-'));

test('projectAuth: كلمة المرور الافتراضية admin تُقبَل قبل أي تغيير', async () => {
    const dir = tmp();
    assert.equal(await verifyPassword(dir, 'u', 'p', 'admin'), true);
    assert.equal(await verifyPassword(dir, 'u', 'p', 'wrong'), false);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectAuth: بعد تغيير كلمة المرور، القديمة (admin) تُرفض والجديدة تُقبَل', async () => {
    const dir = tmp();
    const r = await setPassword(dir, 'u', 'p', 'newSecret123');
    assert.ok(r.ok);
    assert.equal(await verifyPassword(dir, 'u', 'p', 'admin'), false, 'الافتراضية لم تعد صالحة');
    assert.equal(await verifyPassword(dir, 'u', 'p', 'newSecret123'), true);
    assert.equal(await verifyPassword(dir, 'u', 'p', 'wrong'), false);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectAuth: عزل تام بين المشاريع', async () => {
    const dir = tmp();
    await setPassword(dir, 'u', 'p1', 'secretOne');
    assert.equal(await verifyPassword(dir, 'u', 'p2', 'secretOne'), false, 'مشروع آخر لم يتأثر');
    assert.equal(await verifyPassword(dir, 'u', 'p2', 'admin'), true, 'مشروع آخر لا يزال على الافتراضية');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectAuth: يرفض كلمة مرور قصيرة جداً أو فارغة', async () => {
    const dir = tmp();
    assert.ok((await setPassword(dir, 'u', 'p', '')).error);
    assert.ok((await setPassword(dir, 'u', 'p', 'ab')).error);
    assert.ok((await setPassword(dir, 'u', 'p', 'abc')).ok, '3 أحرف حدّ أدنى مقبول');
    fs.rmSync(dir, { recursive: true, force: true });
});

test('projectAuth: لا يخزّن التجزئة كنص صريح، ولا يرمي مع ملف تالف', async () => {
    const dir = tmp();
    await setPassword(dir, 'u', 'p', 'mySecretPass');
    const raw = fs.readFileSync(path.join(dir, 'u__p.json'), 'utf8');
    assert.ok(!raw.includes('mySecretPass'), 'كلمة المرور الخام غائبة عن الملف المخزَّن');

    fs.writeFileSync(path.join(dir, 'u2__p2.json'), '{not json');
    assert.equal(await verifyPassword(dir, 'u2', 'p2', 'admin'), true, 'ملف تالف → يُعامَل كغير موجود (افتراضية)');
    fs.rmSync(dir, { recursive: true, force: true });
});
