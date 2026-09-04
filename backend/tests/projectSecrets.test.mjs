// 🔑 أسرار المشاريع: أول تغطية اختبارية لها. الوحدة تحقن مفاتيح أطراف
// ثالثة **بيئةً لتشغيل مشروع المستخدم** (`jcr.js`، `server.js`) ومفاتيحَ
// لبوت التداول — وكانت بلا اختبارٍ واحد.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'projectsecrets-test-key';
const {
    setProjectSecret, deleteProjectSecret, getProjectSecretNames, getProjectSecrets,
    getUnreadableSecretNames,
} = await import('../services/projectSecrets.js');

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const envOf = (dir) => fs.readFileSync(path.join(dir, '.env'), 'utf8');

test('الأساس: يحفظ ويقرأ ويكتب .env، ويضمن استثناءه من git', async () => {
    const dir = tmp('sec-base-');
    await setProjectSecret('u', 'p', dir, 'API_KEY', 'v1');
    assert.deepEqual(getProjectSecretNames('u', 'p'), ['API_KEY']);
    assert.deepEqual(getProjectSecrets('u', 'p'), { API_KEY: 'v1' });
    assert.equal(envOf(dir), 'API_KEY=v1\n');
    assert.match(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), /^\.env$/m);

    await deleteProjectSecret('u', 'p', dir, 'API_KEY');
    assert.deepEqual(getProjectSecretNames('u', 'p'), []);
    assert.equal(envOf(dir), '');
});

test('اسم المفتاح محروس: صيغة صارمة، وقيمة فارغة مرفوضة', async () => {
    const dir = tmp('sec-key-');
    for (const bad of ['lower', '1LEAD', 'A', 'HAS-DASH', 'HAS SPACE', '']) {
        await assert.rejects(() => setProjectSecret('u2', 'p2', dir, bad, 'v'), /غير صالح/, bad);
    }
    for (const bad of ['', '   ', null, 42]) {
        await assert.rejects(() => setProjectSecret('u2', 'p2', dir, 'OK_KEY', bad), /مطلوبة/, String(bad));
    }
});

// 🔴 حارسٌ يَعِد بما لا يحفظه: `VALID_KEY` يضبط **اسم** المفتاح بصرامة
// (`^[A-Z][A-Z0-9_]{1,48}$`)، ثم القيمة تُلصَق كما هي في `KEY=VALUE`.
// فسطرٌ جديد داخل القيمة يفتح سطراً ثانياً في `.env` — أي **مفتاحاً لم
// يمرّ بالحارس قط**، بشكلٍ يرفضه الحارس أصلاً (`lower_case`). و.env هذا
// يُحقَن بيئةً لتشغيل المشروع.
test('🔴 سطرٌ جديد في القيمة لا يخترع مفاتيح في .env', async () => {
    const dir = tmp('sec-inject-');
    await assert.rejects(
        () => setProjectSecret('u3', 'p3', dir, 'API_KEY', 'real\nINJECTED=owned'),
        /سطر/,
        'قيمةٌ متعددة الأسطر مرّت فحقنت مفتاحاً',
    );
    await assert.rejects(() => setProjectSecret('u3', 'p3', dir, 'API_KEY', 'a\rb'), /سطر/);
    // ولا يُنشأ ملفٌ ولا يُسجَّل مفتاح من محاولةٍ مرفوضة
    assert.deepEqual(getProjectSecretNames('u3', 'p3'), []);
});

// 🔴 سؤالٌ واحد بمصدرَي حقيقة: «أيُّ أسرارٍ لهذا المشروع؟» تُجيبه الأسماء
// من الخريطة **المشفّرة**، وتجيبه القيم من فكّ التشفير — فحين يتغيّر
// `PAT_ENCRYPTION_KEY`/`JWT_SECRET` (تدويرٌ في Render) تفترقان بصمت:
// اللوحة تعرض السرّ، والتطبيق يستلم لا شيء، **وأوّلُ حفظٍ لاحق يمحوه من
// `.env` نهائياً**. الصمت كان `catch { /* تجاهل التالف */ }`.
test('🔴 سرٌّ لا يُفَكّ يُقال ولا يُمحى من .env', async () => {
    const dir = tmp('sec-rot-');
    const before = process.env.JWT_SECRET;
    try {
        process.env.JWT_SECRET = 'key-BEFORE-rotation';
        await setProjectSecret('u4', 'p4', dir, 'STRIPE_KEY', 'sk_live_x');
        await setProjectSecret('u4', 'p4', dir, 'DB_URL', 'postgres://x');

        process.env.JWT_SECRET = 'key-AFTER-rotation';   // 🔁 تدوير المفتاح
        // 📌 المطلوب ليس أن يُسلَّم كلُّ اسمٍ معروض — فذاك مستحيل بعد فقد
        // المفتاح، وإخفاءُ الاسم أسوأ: يقول للمالك «لا STRIPE_KEY لديك»
        // بينما المُعمّى موجودٌ ويُستعاد بإرجاع المفتاح القديم. المطلوب
        // أن **لا تكون الفجوة صامتة**: كلُّ اسمٍ لا يُسلَّم يُقال إنه
        // متعذّر، فيعرف المالك أن يعيد إدخاله لا أن يطارد شبحاً.
        const names = getProjectSecretNames('u4', 'p4');
        const values = getProjectSecrets('u4', 'p4');
        const silentGap = names.filter(n => !(n in values) && !getUnreadableSecretNames('u4', 'p4').includes(n));
        assert.deepEqual(silentGap, [], 'أسرارٌ معروضةٌ لا تُسلَّم ولا يُقال إنها متعذّرة');
        assert.deepEqual(getUnreadableSecretNames('u4', 'p4').sort(), ['DB_URL', 'STRIPE_KEY']);

        await setProjectSecret('u4', 'p4', dir, 'NEW_KEY', 'n');
        const env = envOf(dir);
        assert.match(env, /STRIPE_KEY=sk_live_x/, 'سرٌّ عاملٌ مُحي من .env لأننا عجزنا عن فكّه');
        assert.match(env, /DB_URL=postgres:\/\/x/);
        assert.match(env, /NEW_KEY=n/);
    } finally { process.env.JWT_SECRET = before; }
});
