// 📁 اشتقاق مسار المشروع منفصلٌ عن إنشائه. كان `getProjectPath` يُنشئ المجلد
// قبل أن يعيد المسار، فأبطل حارس الوجود في `/api/site/password` — وهو مسارٌ
// **بلا مصادقة** تُعيَّن به أول كلمة مرور للوحة موقعٍ منشور.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { projectPathOf, safeSegment } from '../core/runtime/workspacePaths.js';

const tmpBase = () => fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-pp-'));

test('الاشتقاق لا يلمس القرص — لا مجلد يُنشأ', () => {
    const base = tmpBase();
    const p = projectPathOf(base, 'anyone', 'مشروع-لا-وجود-له');
    assert.equal(fs.existsSync(p), false, 'المسار لا يوجد بعد الاشتقاق');
    assert.deepEqual(fs.readdirSync(base), [], 'مساحة العمل بقيت فارغة');
});

test('🛡️ حارس «المشروع غير موجود» يقع فعلاً الآن', () => {
    const base = tmpBase();
    const guardFires = (u, p) => !fs.existsSync(projectPathOf(base, u, p)); // نفس تعبير المسار
    assert.equal(guardFires('victim', 'future-shop'), true, 'مشروع غير موجود → الحارس يقع');
    fs.mkdirSync(projectPathOf(base, 'victim', 'future-shop'), { recursive: true });
    assert.equal(guardFires('victim', 'future-shop'), false, 'مشروع موجود → يمرّ');
});

test('التطهير يمنع اجتياز المسار ويبقى داخل مساحة العمل', () => {
    const base = tmpBase();
    for (const [u, p] of [['../../etc', 'passwd'], ['ali', '../../../root'], ['a/b', 'c\\d']]) {
        const resolved = path.resolve(projectPathOf(base, u, p));
        assert.ok(resolved.startsWith(path.resolve(base) + path.sep), `${u}/${p} → ${resolved}`);
        assert.equal(path.relative(base, resolved).split(path.sep).length, 2, 'مستويان فقط');
    }
});

test('التطهير والافتراضات كما كانا حرفياً — لا مسار قائم يتغيّر', () => {
    assert.equal(safeSegment(null, 'guest_user'), 'guest_user');
    assert.equal(safeSegment('', 'sandbox_app'), 'sandbox_app');
    assert.equal(safeSegment('MyShop', 'x'), 'myshop');
    assert.equal(safeSegment('my shop', 'x'), 'my_shop');   // المحرف البديل `_` لم يُغيَّر
    assert.equal(safeSegment('a-b_c', 'x'), 'a-b_c');       // المسموح يمرّ كما هو
    assert.equal(projectPathOf('/ws', 'Ali', 'My App'), path.join('/ws', 'ali', 'my_app'));
});
