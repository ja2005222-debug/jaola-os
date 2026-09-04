// 🗝️ مفتاح المخزن المسطّح: `clean(u) + '__' + clean(p)` ليس اقتراناً
// مبايناً — `_` حرفٌ مشروع داخل الحقلين، فزوجان مختلفان يكتبان ملفاً
// واحداً. وهذا ليس بلاغة: (`alice`, `bob__site`) و(`alice__bob`, `site`)
// كانا يتشاركان ملفّ اعتماد لوحة الموقع نفسه.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { storeKey, cleanSegment } from '../services/storeKey.js';

// الصيغة القديمة حرفياً — مرجعٌ يُثبت أن الاختبار يقيس فرقاً حقيقياً.
const legacy = (...parts) => parts.map(cleanSegment).join('__');

test('🔴 الصيغة القديمة تخلط زوجين مختلفين — مرجعُ العطب', () => {
    assert.equal(legacy('alice', 'bob__site'), legacy('alice__bob', 'site'),
        'لو لم يتساويا هنا لَما كان في السطور التالية ما يُختبَر');
    assert.equal(legacy('a_', 'b'), legacy('a', '_b'),
        'التباسٌ ثانٍ عند الحدود: `_` طرفيٌّ يلتحم بالفاصل');
});

test('🛡️ المفتاح الجديد مبايِن: لا زوجَين مختلفَين على مفتاحٍ واحد', () => {
    assert.notEqual(storeKey('alice', 'bob__site'), storeKey('alice__bob', 'site'));
    assert.notEqual(storeKey('a_', 'b'), storeKey('a', '_b'));
    assert.notEqual(storeKey('a', 'b_'), storeKey('a', 'b__'));
    assert.notEqual(storeKey('u', 'p__q', 'slot'), storeKey('u__p', 'q', 'slot'));
    assert.notEqual(storeKey('u', 'p', 'a__b'), storeKey('u', 'p__a', 'b'));
});

test('🧮 مسحٌ شامل: كل الأزواج من أبجديةٍ فيها `_` تعطي مفاتيح مختلفة', () => {
    const segs = ['a', 'a_', '_a', 'a__b', 'a_b', 'ab', '_', '__', ''];
    const seen = new Map();
    for (const u of segs) for (const p of segs) {
        const k = storeKey(u, p);
        const prev = seen.get(k);
        assert.equal(prev, undefined, `تصادم: ${JSON.stringify(prev)} و ${JSON.stringify([u, p])} → ${k}`);
        seen.set(k, [u, p]);
    }
    assert.equal(seen.size, segs.length * segs.length, 'كل زوجٍ مفتاحٌ خاصّ به');
});

test('✅ ما ليس ملتبساً لا يتغيّر حرفاً — الأسماء القائمة على القرص تبقى', () => {
    // كل أسماء المستخدمين والمشاريع الفعلية اليوم من هذا الشكل.
    assert.equal(storeKey('ali', 'shop'), 'ali__shop');
    assert.equal(storeKey('Ali', 'My-App'), 'Ali__My-App');
    assert.equal(storeKey('alice_bob', 'sandbox_app'), 'alice_bob__sandbox_app');
    assert.equal(storeKey('u', 'p', 'clinicPhoto'), 'u__p__clinicPhoto');
});

test('🔁 المفتاح ثابتٌ عبر النداءات — لا عشوائية تُيتّم ملفاً', () => {
    assert.equal(storeKey('alice__bob', 'site'), storeKey('alice__bob', 'site'));
});

test('🧹 الأبجدية كما كانت: ما خرج عنها يصير `_`، ولا يخرج المفتاح من مجلّده', () => {
    assert.equal(cleanSegment('a/b'), 'a_b');
    assert.equal(cleanSegment('../etc'), '___etc');
    for (const [u, p] of [['../../etc', 'passwd'], ['a/b', 'c\\d'], ['ali', '../x']]) {
        assert.equal(storeKey(u, p).includes('/'), false, `${u}/${p} لا يحمل فاصل مسار`);
        assert.equal(storeKey(u, p).includes('\\'), false, `${u}/${p} لا يحمل فاصلاً عكسياً`);
    }
});

// ── حارسٌ بنيوي: لا يعود اللصق من بابٍ آخر ──────────────────────────
// أحد عشر مخزناً كتبت المفتاح بيدها بالصياغة نفسها. الإصلاح لا يكتمل
// بتحويلها وحدها: يكتمل حين يصير الرجوع إلى اللصق مرئياً في المراجعة.
test('🧱 لا مخزنَ يلصق `__` بين حقلين بيده — عدا بادئة عدٍّ موثّقة', () => {
    const dir = new URL('../services/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
    const pasted = files.filter((f) => readFileSync(new URL(f, dir), 'utf8').includes('}__${'));
    assert.deepEqual(pasted, ['appAssets.js'],
        `مخازن تلصق المفتاح بيدها: ${pasted.join('، ')} — استخدم storeKey`);

    // والاستثناء الوحيد بادئةُ عدٍّ لا مفتاحَ قراءة: العدّ لا ينقص بها أبداً.
    const src = readFileSync(new URL('appAssets.js', dir), 'utf8');
    assert.equal((src.match(/\}__\$\{/g) || []).length, 1, 'بادئةٌ واحدة لا أكثر');
    assert.match(src, /countSlots[\s\S]{0,400}\}__\$\{/, 'وموضعها countSlots وحدها');
});
