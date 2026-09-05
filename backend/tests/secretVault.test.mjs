// 🔐 خزنة الأسرار — الوحدة التي يعتمد عليها ستةُ مستوردين، وكانت بلا تغطية.
//
// العطبُ الأشدّ لم يكن في الخزنة وحدها بل في اتّساقها مع نصيحة النظام:
// `systemDoctorAgent` يقول للمالك «اضبط PAT_ENCRYPTION_KEY»، والفكُّ كان
// يقرأ مفتاحاً واحداً — فمن اتّبع النصيحةَ فقد كلَّ سرٍّ مخزَّن.
import { test } from 'node:test';
import assert from 'node:assert';

// الوحدةُ تقرأ process.env عند كلّ نداء، فيكفي ضبطُه حول الاستدعاء.
function withEnv(env, fn) {
    const saved = { ...process.env };
    for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    try { return fn(); } finally {
        for (const k of ['PAT_ENCRYPTION_KEY', 'JWT_SECRET']) {
            if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
        }
    }
}

const { encryptSecret, decryptSecret, candidateSecrets } = await import('../utils/secretVault.js');

// `assert.throws` لا تُعيد الاستثناء — فيلزم مِلقاطٌ صريح لفحص `reason`.
function grab(fn) {
    try { fn(); } catch (e) { return e; }
    assert.fail('لم يُرمَ استثناء');
}


test('الذهاب والإياب: السرُّ يعود كما دخل', () => {
    withEnv({ PAT_ENCRYPTION_KEY: 'k1', JWT_SECRET: 'j1' }, () => {
        const secret = 'ghp_AbC123_توكنٌ فيه عربية';
        assert.strictEqual(decryptSecret(encryptSecret(secret)), secret);
    });
});

test('العطب: اتّباعُ نصيحة الطبيب (إضافة PAT_ENCRYPTION_KEY) كان يُتلِف كلَّ سرٍّ مخزَّن', () => {
    // ١) الإقلاعُ الواقعي: JWT_SECRET وحده — PAT_ENCRYPTION_KEY اختياريٌّ في .env.example
    const stored = withEnv({ PAT_ENCRYPTION_KEY: undefined, JWT_SECRET: 'jwt-الأصلي' },
        () => encryptSecret('ghp_token_المستخدم'));
    // ٢) المالك يضبط ما طلبه الطبيب
    const read = withEnv({ PAT_ENCRYPTION_KEY: 'مفتاحٌ مخصَّص', JWT_SECRET: 'jwt-الأصلي' },
        () => decryptSecret(stored));
    assert.strictEqual(read, 'ghp_token_المستخدم');
});

test('التشفيرُ الجديد يستعمل المفتاح المخصَّص لا الاحتياط', () => {
    withEnv({ PAT_ENCRYPTION_KEY: 'مخصَّص', JWT_SECRET: 'احتياط' }, () => {
        assert.deepStrictEqual(candidateSecrets(), ['مخصَّص', 'احتياط']);
        const enc = encryptSecret('س');
        // يُقرأ حين يبقى المخصَّص وحده — أي أنّه هو الذي شفَّر
        const still = withEnv({ PAT_ENCRYPTION_KEY: 'مخصَّص', JWT_SECRET: undefined },
            () => decryptSecret(enc));
        assert.strictEqual(still, 'س');
    });
});

test('تساوي المفتاحين لا يُكرِّر المحاولة', () => {
    withEnv({ PAT_ENCRYPTION_KEY: 'نفسه', JWT_SECRET: 'نفسه' }, () => {
        assert.deepStrictEqual(candidateSecrets(), ['نفسه']);
    });
});

test('العطب: النصُّ الفارغ كان يُشفَّر بنجاح ثمّ يُرفَض بوصفه تالفاً', () => {
    withEnv({ JWT_SECRET: 'j' }, () => {
        for (const bad of ['', '   ', undefined, null, 12345]) {
            const e = grab(() => encryptSecret(bad));
            assert.strictEqual(e.reason, 'empty', `قُبِل: ${JSON.stringify(bad)}`);
        }
    });
});

test('الأحوالُ الثلاثة تفترق: صيغةٌ مكسورة ≠ مفتاحٌ مستبدَل ≠ غيابُ المفاتيح', () => {
    const stored = withEnv({ PAT_ENCRYPTION_KEY: undefined, JWT_SECRET: 'قديم' }, () => encryptSecret('س'));

    const malformed = grab(() => withEnv({ JWT_SECRET: 'قديم' }, () => decryptSecret('ليس:سرّاً')));
    assert.strictEqual(malformed.reason, 'malformed');
    // hex غير صالحٍ في الطول الصحيح — تلفٌ حقيقيّ لا «تدوير مفتاح»
    const badHex = grab(() => withEnv({ JWT_SECRET: 'قديم' },
        () => decryptSecret('z'.repeat(24) + ':' + 'z'.repeat(32) + ':aabb')));
    assert.strictEqual(badHex.reason, 'malformed');

    const rotated = grab(() => withEnv({ PAT_ENCRYPTION_KEY: 'جديد١', JWT_SECRET: 'جديد٢' },
        () => decryptSecret(stored)));
    assert.strictEqual(rotated.reason, 'key-mismatch');

    const noKey = grab(() => withEnv({ PAT_ENCRYPTION_KEY: undefined, JWT_SECRET: undefined },
        () => decryptSecret(stored)));
    assert.strictEqual(noKey.reason, 'no-key');
    const noKeyEnc = grab(() => withEnv({ PAT_ENCRYPTION_KEY: undefined, JWT_SECRET: undefined },
        () => encryptSecret('س')));
    assert.strictEqual(noKeyEnc.reason, 'no-key');
});

test('العبثُ بالنصّ المشفَّر يُكشَف (وسم GCM يعمل)', () => {
    withEnv({ JWT_SECRET: 'j' }, () => {
        const parts = encryptSecret('ghp_original').split(':');
        parts[2] = (parts[2][0] === 'f' ? '0' : 'f') + parts[2].slice(1);
        const e = grab(() => decryptSecret(parts.join(':')));
        assert.strictEqual(e.reason, 'key-mismatch');   // لا يُعاد نصٌّ مُحرَّف أبداً
    });
});

test('الصيغةُ المخزَّنة لم تتغيّر — الأسرارُ القديمة تُقرأ كما هي', () => {
    withEnv({ JWT_SECRET: 'j' }, () => {
        const [iv, tag, data] = encryptSecret('س').split(':');
        assert.strictEqual(iv.length, 24);
        assert.strictEqual(tag.length, 32);
        assert.ok(data.length > 0 && /^[0-9a-f]+$/.test(data));
    });
});
