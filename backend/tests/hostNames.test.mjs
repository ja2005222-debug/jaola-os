// 🏷️ هويّتا النشر (Render وVercel) كانتا تقعان في العطب نفسه: التطهير
// وحده يفقد ما يميّز، فاسمٌ عربي بأكمله يُطوى إلى فراغ — فتتصادم مشاريع
// المستخدم كلها على هويةٍ واحدة، وما يبقى ينتهي بشَرطةٍ يرفضها المزوّدان.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugPart, nameFingerprint } from '../services/hostNames.js';
import { vercelProjectNameOf } from '../services/customDomains.js';
import { renderServiceName } from '../agents/renderAgent.js';

// اسم مضيف/مشروع صالح: يبدأ وينتهي بحرفٍ أو رقم، وبينهما شَرَطات.
const isValidName = (n) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(n) && n.length <= 100;

// الصيغة القديمة حرفياً — مرجعُ عدم الانحراف لا نسخةٌ حيّة.
const legacyVercelName = (u, p) =>
    `${u}-${p}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 100);

const ARABIC_PROJECTS = ['متجري', 'دكاني', 'مشروعي', 'موقع الشركة'];

test('🔴 العطب: كل مشاريع المستخدم العربية كانت هويةً واحدة تنتهي بشَرطة', () => {
    const legacy = new Set(ARABIC_PROJECTS.map((p) => legacyVercelName('ali', p)));
    assert.deepEqual([...legacy], ['ali-'], 'الصيغة القديمة تطوي الأربعة إلى اسمٍ واحد');
    assert.equal(isValidName('ali-'), false, 'وهو اسمٌ غير صالح أصلاً');

    const fixed = ARABIC_PROJECTS.map((p) => vercelProjectNameOf('ali', p));
    assert.equal(new Set(fixed).size, ARABIC_PROJECTS.length, `تصادمٌ باقٍ: ${fixed.join(' | ')}`);
    for (const n of fixed) assert.ok(isValidName(n), n);
});

test('🛡️ لا يُعاد تسمية مشروعٍ منشورٍ يعمل: التطابق حرفيّ حيث كان الاسم صالحاً', () => {
    const inputs = [
        ['ali', 'my shop'], ['jamal', 'photo_test'], ['Ali', 'My-App'], ['a', 'b'],
        ['guest_user', 'sandbox_app'], ['ali', 'shop-2024'], ['u', 'x'.repeat(120)],
        ['ali', '!shop'], ['ali!', 'shop'],
    ];
    let compared = 0;
    for (const [u, p] of inputs) {
        const legacy = legacyVercelName(u, p);
        if (!isValidName(legacy)) continue;          // كان مكسوراً — يُسمح بتغييره
        compared++;
        assert.equal(vercelProjectNameOf(u, p), legacy, `انحراف على ${u}/${p}`);
    }
    assert.ok(compared >= 7, `مُدخلات صالحة قورنت: ${compared}`);
});

test('الأسماء المكسورة وحدها تتغيّر — والشَرطة الطرفية تزول', () => {
    for (const [u, p] of [['ali', 'shop!'], ['guest_user', 'مشروعي'], ['ali', 'متجري']]) {
        assert.equal(isValidName(legacyVercelName(u, p)), false, 'المرجع: كان مكسوراً');
        assert.ok(isValidName(vercelProjectNameOf(u, p)), 'صار صالحاً');
    }
});

test('الحتميّة: نفس المشروع نفسُ الهوية في كل نشرة، ولا مستخدمَ بلا اسم', () => {
    assert.equal(vercelProjectNameOf('ali', 'متجري'), vercelProjectNameOf('ali', 'متجري'));
    assert.notEqual(vercelProjectNameOf('ali', 'متجري'), vercelProjectNameOf('sara', 'متجري'));
    for (const bad of [null, undefined, '', '؟؟؟']) {
        const n = vercelProjectNameOf(bad, 'shop');
        assert.ok(isValidName(n), `${bad} → ${n}`);
        assert.ok(n.startsWith('user-'), n);
    }
});

test('البدائيّتان مشتركتان فعلاً — لا نسخة ثانية في أحد المولّدين', () => {
    assert.equal(slugPart('My Shop!'), 'my-shop');
    assert.equal(slugPart('--a--b--'), 'a-b');
    assert.equal(slugPart('متجري'), '');
    for (const bad of [null, undefined, '']) assert.equal(slugPart(bad), '');

    assert.match(nameFingerprint('متجري'), /^p[0-9a-f]{6}$/);
    assert.equal(nameFingerprint('متجري'), nameFingerprint('متجري'), 'حتميّة');
    assert.notEqual(nameFingerprint('متجري'), nameFingerprint('دكاني'));

    // نفس البصمة تظهر في الهويّتين لأنها مصدرٌ واحد لا نسختان.
    const fp = nameFingerprint('متجري');
    assert.ok(vercelProjectNameOf('ali', 'متجري').endsWith(fp));
    assert.ok(renderServiceName('ali', 'متجري').endsWith(fp));
});
