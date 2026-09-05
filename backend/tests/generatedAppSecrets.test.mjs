// 🔐 سرُّ توقيع JWT في التطبيقات المولَّدة: كان مكتوباً حرفياً في ثلاثة قوالب
// بقيمتين مختلفتين — فكل توكن يصدره دخول Google كان يُرفض عند التحقق. ثم كانت
// القيمة الموحَّدة معروفة علناً، فصارت مشتقّةً لكل مشروع على حدة.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAuth } from '../agents/authAgent.js';
import { generateOAuthModule } from '../agents/backendAgent.js';
import { projectJwtSecret, jwtSecretSnippet, GENERATED_JWT_SECRET_FALLBACK } from '../agents/generatedAppSecrets.js';
import { isAiDownMessage } from '../services/platformLessons.js';
import { buildFailureChatMessage } from '../agents/failureMessages.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

// الخادم يرفض الإقلاع بلا JWT_SECRET (server.js) — فالاشتقاق في الإنتاج
// مملَّحٌ دائماً. نحاكي ذلك هنا: بدونه يسقط الجميع على الثابت المعلن،
// وهو ما يختبره الاختبار الثالث صراحةً.
process.env.JWT_SECRET ||= 'test-only-salt-not-a-real-secret';

const PROJECT = '/workspace/ali/my_shop';
const secretsIn = (txt) => [...String(txt).matchAll(/return "([^"]*)";/g)].map((m) => m[1]);

async function generatedJsFiles(projectPath = PROJECT) {
    const { files = [] } = await generateAuth('login and dashboard', projectPath, 'ar');
    return [...files, generateOAuthModule(projectPath)].filter((f) => f.name.endsWith('.js'));
}

test('🔐 سرٌّ واحد عبر كل ملفات المشروع — لا توكنٌ يُصدر بسرٍّ ويُتحقّق بآخر', async () => {
    const files = await generatedJsFiles();
    const withSecret = files.filter((f) => f.content.includes('JWT_SECRET'));
    assert.ok(withSecret.length >= 3, `القوالب الحاملة للسرّ: ${withSecret.length}`);

    const secrets = new Set();
    for (const f of withSecret) {
        secretsIn(f.content).forEach((s) => secrets.add(s));
        assert.ok(!f.content.includes('${jwtSecretSnippet'), `قالبٌ لم يُستبدل: ${f.name}`);
    }
    assert.equal(secrets.size, 1, `أسرارٌ متعددة: ${[...secrets].join(' | ')}`);
    assert.equal([...secrets][0], projectJwtSecret(PROJECT));
});

test('🔑 مشروعان مختلفان لا يتشاركان سرّاً، والمشروع الواحد ثابتٌ عبر إعادة التوليد', async () => {
    const a = new Set((await generatedJsFiles('/workspace/ali/shop')).flatMap((f) => secretsIn(f.content)));
    const b = new Set((await generatedJsFiles('/workspace/sara/shop')).flatMap((f) => secretsIn(f.content)));
    assert.equal(a.size, 1); assert.equal(b.size, 1);
    assert.notDeepEqual([...a], [...b], 'مشروعان مختلفان → سرّان مختلفان');

    const again = new Set((await generatedJsFiles('/workspace/ali/shop')).flatMap((f) => secretsIn(f.content)));
    assert.deepEqual([...again], [...a], 'إعادة التوليد لا تُسقط جلسات المستخدمين');
});

test('الاشتقاق: ملحُه مفتاح جاولا، وبلا مسارٍ أو مفتاح يسقط على الثابت المعلن', () => {
    const s1 = projectJwtSecret(PROJECT, { JWT_SECRET: 'salt-one' });
    const s2 = projectJwtSecret(PROJECT, { JWT_SECRET: 'salt-two' });
    assert.notEqual(s1, s2, 'ملحٌ مختلف → سرٌّ مختلف');
    assert.equal(s1, projectJwtSecret(PROJECT, { JWT_SECRET: 'salt-one' }), 'حتميّ');
    assert.match(s1, /^jaola_[A-Za-z0-9_-]{43}$/);

    assert.equal(projectJwtSecret('', { JWT_SECRET: 'x' }), GENERATED_JWT_SECRET_FALLBACK);
    assert.equal(projectJwtSecret(PROJECT, {}), GENERATED_JWT_SECRET_FALLBACK);
    for (const bad of [null, undefined]) assert.equal(projectJwtSecret(bad, { JWT_SECRET: 'x' }), GENERATED_JWT_SECRET_FALLBACK);
});

test('الكود المولَّد صالحٌ نحوياً بعد إدراج المقطع', async () => {
    for (const f of await generatedJsFiles()) {
        assert.doesNotThrow(() => new Function(`return ${JSON.stringify(f.content)};`), f.name);
        assert.ok(f.content.length > 100, f.name);
    }
});

test('السقوط الآمن يبقى، لكنه يصير مسموعاً — إنذار في كل ملف يحمل السرّ', async () => {
    for (const f of (await generatedJsFiles()).filter((x) => x.content.includes('JWT_SECRET'))) {
        assert.match(f.content, /console\.warn/, `${f.name}: لا إنذار`);
        assert.match(f.content, /JWT_SECRET غير مضبوط/, `${f.name}: نصّ الإنذار`);
    }
    assert.match(jwtSecretSnippet(PROJECT), /process\.env\.JWT_SECRET \|\|/, 'المتغيّر يبقى الأولوية');
});

test('🔀 مُميِّز تعطّل المزوّد مصدرٌ واحد — والنسخة الأوسع هي المحفوظة', () => {
    assert.equal(isAiDownMessage('نفد رصيد المزوّد'), true);
    assert.equal(isAiDownMessage('الخدمة غير متاحة حالياً'), true);
    assert.equal(isAiDownMessage('insufficient_quota'), true);
    assert.equal(isAiDownMessage('عطبٌ آخر تماماً'), false);
    for (const bad of [null, undefined, '']) assert.equal(isAiDownMessage(bad), false, String(bad));

    const msg = buildFailureChatMessage('ar', { message: 'نفد رصيد المزوّد' });
    assert.match(msg, /الذكاء الاصطناعي غير متاح/);
});
