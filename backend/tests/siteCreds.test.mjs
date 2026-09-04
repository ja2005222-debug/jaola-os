// 🔒 «أول من يعيّن كلمة مرور اللوحة يفوز» — وعدٌ لم يكن الكود يفي به.
// المسار `/api/site/password` بلا مصادقة بحكم تصميمه، وحارسه كان اقرأ
// ثمّ اكتب: طلبان متزامنان يجتازان الفحص معاً، ويخرج **كلاهما** بتوكن
// لوحةٍ صالحٍ ثماني ساعات (التوكن موقَّع على {user,project} لا على
// كلمة المرور). المطالبة صارت إنشاءً حصرياً يقرّره نظام الملفات.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { siteCredPath, readSiteCred, claimSiteCred } from '../services/siteCreds.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sitecred-'));
const cred = (pw) => ({ password: pw });

test('🛡️ فائزٌ واحد لا اثنان — والخاسر لا يدهس ما كُتب', () => {
    const dir = tmp();
    assert.equal(claimSiteCred(dir, 'ali', 'shop', cred('OWNER')), true, 'أول مطالبة تفوز');
    assert.equal(claimSiteCred(dir, 'ali', 'shop', cred('ATTACKER')), false, 'الثانية تخسر');
    assert.equal(readSiteCred(dir, 'ali', 'shop').password, 'OWNER', 'الخاسر لم يدهس المحتوى');
});

test('🏁 سباقٌ حقيقي: عشرة متسابقين على مشروعٍ واحد، فائزٌ واحد فقط', () => {
    const dir = tmp();
    // النداءات متزامنة فعلاً (fs متزامن): لا فاصل بين فحصٍ وكتابة يُستغَل.
    const results = Array.from({ length: 10 }, (_, i) => claimSiteCred(dir, 'ali', 'shop', cred(`r${i}`)));
    assert.equal(results.filter(Boolean).length, 1, `فائزون: ${results.filter(Boolean).length}`);
    assert.equal(results[0], true, 'الفائز هو الأول فعلاً — «أول من يعيّن» لا آخره');
    assert.equal(readSiteCred(dir, 'ali', 'shop').password, 'r0');
});

test('🔴 الحارس القديم كان يمرّر الجميع — مرجعٌ يثبت أن الاختبار يقيس شيئاً', () => {
    const dir = tmp();
    const legacyClaim = (u, p, c) => {                 // اقرأ ثم اكتب، كما كان
        if (readSiteCred(dir, u, p)?.password) return false;
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(siteCredPath(dir, u, p), JSON.stringify(c));
        return true;
    };
    // كلا الطلبين قرأ «لا كلمة مرور» قبل أن يكتب أيّهما — وهذا هو السباق.
    const before = readSiteCred(dir, 'ali', 'shop');
    assert.equal(before, null);
    assert.equal(legacyClaim('ali', 'shop', cred('OWNER')), true);
    // في السباق الحقيقي كان المهاجم قد قرأ null قبل كتابة المالك:
    fs.writeFileSync(siteCredPath(dir, 'ali', 'shop'), JSON.stringify(cred('ATTACKER')));
    assert.equal(readSiteCred(dir, 'ali', 'shop').password, 'ATTACKER', 'الصيغة القديمة تُدهَس');
});

test('العزل: كل (مستخدم، مشروع) مطالبةٌ مستقلة', () => {
    const dir = tmp();
    assert.equal(claimSiteCred(dir, 'ali', 'shop', cred('a')), true);
    assert.equal(claimSiteCred(dir, 'ali', 'other', cred('b')), true, 'مشروعٌ آخر لنفس المستخدم');
    assert.equal(claimSiteCred(dir, 'sara', 'shop', cred('c')), true, 'مستخدمٌ آخر لنفس الاسم');
    assert.equal(readSiteCred(dir, 'ali', 'shop').password, 'a');
    assert.equal(readSiteCred(dir, 'sara', 'shop').password, 'c');
});

test('المسار مطهَّرٌ كما كان حرفياً، ولا يخرج من مجلّده', () => {
    const dir = tmp();
    assert.equal(path.basename(siteCredPath(dir, 'Ali', 'My-App')), 'Ali__My-App.json');
    for (const [u, p] of [['../../etc', 'passwd'], ['a/b', 'c\\d'], ['ali', '../x']]) {
        const resolved = path.resolve(siteCredPath(dir, u, p));
        assert.equal(path.dirname(resolved), path.resolve(dir), `${u}/${p} → ${resolved}`);
    }
    assert.equal(readSiteCred(dir, 'nobody', 'nothing'), null, 'غير الموجود null لا رمية');
});
