// 🔐 سرُّ توقيع JWT في التطبيقات المولَّدة: كان مكتوباً حرفياً في ثلاثة قوالب
// بقيمتين مختلفتين — فكل توكن يصدره دخول Google كان يُرفض عند التحقق.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAuth } from '../agents/authAgent.js';
import { generateOAuthModule } from '../agents/backendAgent.js';
import { GENERATED_JWT_SECRET_FALLBACK, JWT_SECRET_SNIPPET } from '../agents/generatedAppSecrets.js';
import { isAiDownMessage } from '../services/platformLessons.js';
import { buildFailureChatMessage } from '../agents/failureMessages.js';

async function generatedJsFiles() {
    const { files = [] } = await generateAuth('login and dashboard', '/tmp/jaola-none', 'ar');
    return [...files, generateOAuthModule()].filter((f) => f.name.endsWith('.js'));
}

test('🔐 سرٌّ واحد عبر كل الملفات المولَّدة — لا توكنٌ يُصدر بسرٍّ ويُتحقّق بآخر', async () => {
    const files = await generatedJsFiles();
    const withSecret = files.filter((f) => f.content.includes('JWT_SECRET'));
    assert.ok(withSecret.length >= 3, `القوالب الحاملة للسرّ: ${withSecret.length}`);

    const secrets = new Set();
    for (const f of withSecret) {
        for (const m of f.content.matchAll(/return "([^"]*)";/g)) secrets.add(m[1]);
        assert.ok(!f.content.includes('${JWT_SECRET_SNIPPET}'), `قالبٌ لم يُستبدل: ${f.name}`);
    }
    assert.equal(secrets.size, 1, `أسرارٌ متعددة: ${[...secrets].join(' | ')}`);
    assert.equal([...secrets][0], GENERATED_JWT_SECRET_FALLBACK);
});

test('الكود المولَّد صالحٌ نحوياً بعد إدراج المقطع', async () => {
    const files = await generatedJsFiles();
    for (const f of files) {
        // `new Function` يفشل على الخطأ النحوي؛ الوحدات ESM تُغلَّف كنصّ فقط
        assert.doesNotThrow(() => new Function(`return ${JSON.stringify(f.content)};`), f.name);
        assert.ok(f.content.length > 100, f.name);
    }
});

test('السقوط الآمن يبقى، لكنه يصير مسموعاً — إنذار في كل ملف يحمل السرّ', async () => {
    const files = await generatedJsFiles();
    for (const f of files.filter((x) => x.content.includes('JWT_SECRET'))) {
        assert.match(f.content, /console\.warn/, `${f.name}: لا إنذار`);
        assert.match(f.content, /JWT_SECRET غير مضبوط/, `${f.name}: نصّ الإنذار`);
    }
    assert.match(JWT_SECRET_SNIPPET, /process\.env\.JWT_SECRET \|\|/, 'المتغيّر يبقى الأولوية');
});

test('🔀 مُميِّز تعطّل المزوّد مصدرٌ واحد — والنسخة الأوسع هي المحفوظة', () => {
    // «رصيد المزوّد» كانت في نسخةٍ دون الأخرى
    assert.equal(isAiDownMessage('نفد رصيد المزوّد'), true);
    assert.equal(isAiDownMessage('الخدمة غير متاحة حالياً'), true);
    assert.equal(isAiDownMessage('insufficient_quota'), true);
    assert.equal(isAiDownMessage('عطبٌ آخر تماماً'), false);
    for (const bad of [null, undefined, '']) assert.equal(isAiDownMessage(bad), false, String(bad));

    // والمستهلك الحيّ يعطي رسالة «المزوّد متعطّل» لا رسالة الفشل العامة
    const msg = buildFailureChatMessage('ar', { message: 'نفد رصيد المزوّد' });
    assert.match(msg, /الذكاء الاصطناعي غير متاح/);
});
