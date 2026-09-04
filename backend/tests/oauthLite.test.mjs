// 🔑 OAuth الخفيف: أول تغطية اختبارية له. هذه الوحدة تقرّر **من أنت**
// لكل داخلٍ عبر GitHub أو Google، وناتجُها يمرّ إلى `DB.upsertOAuthUser`
// الذي **يربط الحسابات بالبريد**: يجد المستخدم القائم به ثم يعيد كتابة
// `provider`/`providerId` إليه ويسلّمه. فبريدٌ غير مؤكَّد هنا ليس حقلاً
// تجميلياً — هو مفتاحُ حسابِ غيرك.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProfile, getAuthUrl, isProvider, providerConfigured } from '../services/oauthLite.js';

const json = (o) => ({ ok: true, json: async () => o });
const withFetch = async (impl, fn) => {
    const real = globalThis.fetch;
    globalThis.fetch = impl;
    try { return await fn(); } finally { globalThis.fetch = real; }
};

test('الأساس: المزوّدان معروفان، وغير المُهيّأ لا يُعدّ مُهيّأً', () => {
    assert.equal(isProvider('github'), true);
    assert.equal(isProvider('google'), true);
    assert.equal(isProvider('facebook'), false);
    assert.equal(isProvider('constructor'), false, 'وراثةُ Object لا تصنع مزوّداً');
    const saved = process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_ID;
    assert.equal(providerConfigured('github'), false);
    if (saved !== undefined) process.env.GITHUB_CLIENT_ID = saved;
});

test('getAuthUrl: يحمل state والنطاق والعودة', () => {
    process.env.GOOGLE_CLIENT_ID = 'cid-test';
    const u = new URL(getAuthUrl('google', { state: 'st-123', redirectUri: 'https://x.test/cb' }));
    assert.equal(u.searchParams.get('state'), 'st-123');
    assert.equal(u.searchParams.get('redirect_uri'), 'https://x.test/cb');
    assert.equal(u.searchParams.get('response_type'), 'code');
    assert.match(u.searchParams.get('scope'), /email/);
});

// 🔴 **انتحالُ حسابٍ كامل ببريدٍ لم يُثبَت امتلاكه.**
// جوجل نفسها توثّق أن `email` بلا `email_verified` لا يُوثق به، وخدمة
// السفر في هذا المستودع **ترفضه صراحةً** لهذا السبب بعينه (googleAuth.js).
// وهنا لم يكن يُفحَص إطلاقاً: يخرج البريد إلى `upsertOAuthUser` فيجد به
// حساب الضحية، **ويعيد كتابة provider/providerId إلى المهاجم**، ثم يصدر
// له توكناً باسم الضحية. ولو وقع اسمها في ADMIN_USERS فهي لوحة الإدارة.
test('🔴 جوجل: بريدٌ غير مؤكَّد لا يصير هويةً ولا مفتاحَ ربط', async () => {
    const p = await withFetch(
        async () => json({ sub: 'attacker-999', email: 'victim@example.com', email_verified: false, name: 'A' }),
        () => fetchProfile('google', 'tok'),
    );
    assert.equal(p.email, null, 'بريدُ ضحيةٍ غير مؤكَّد خرج من الوحدة');
    assert.ok(!String(p.username).includes('victim'), `اسمٌ مشتقٌّ من بريدٍ غير مؤكَّد: ${p.username}`);
    assert.equal(p.providerId, 'attacker-999', 'الهوية تبقى معرّف المزوّد');
});

test('جوجل: البريد المؤكَّد يُحمَل كما هو', async () => {
    const p = await withFetch(
        async () => json({ sub: 'g-1', email: 'real@example.com', email_verified: true, name: 'R' }),
        () => fetchProfile('google', 'tok'),
    );
    assert.equal(p.email, 'real@example.com');
    assert.equal(p.username, 'real');
});

// 🔴 نفس العائلة في فرع GitHub: `emails.find(primary && verified) || emails[0]`
// — والسقوط على **أول عنصرٍ مهما كان** يقبل بريداً غير مؤكَّد.
test('🔴 GitHub: لا يسقط على بريدٍ غير مؤكَّد', async () => {
    let n = 0;
    const p = await withFetch(
        async () => (++n === 1
            ? json({ id: 777, login: 'attacker', email: null })
            : json([{ email: 'victim@example.com', primary: false, verified: false }])),
        () => fetchProfile('github', 'tok'),
    );
    assert.equal(p.email, null, 'بريدُ ضحيةٍ غير مؤكَّد خرج من الوحدة');
    assert.equal(p.username, 'attacker', 'اسم GitHub يبقى login لا البريد');
});

test('GitHub: يختار المؤكَّد ولو لم يكن الأساسي', async () => {
    let n = 0;
    const p = await withFetch(
        async () => (++n === 1
            ? json({ id: 5, login: 'dev', email: null })
            : json([
                { email: 'unverified@x.test', primary: true, verified: false },
                { email: 'ok@x.test', primary: false, verified: true },
            ])),
        () => fetchProfile('github', 'tok'),
    );
    assert.equal(p.email, 'ok@x.test');
});
