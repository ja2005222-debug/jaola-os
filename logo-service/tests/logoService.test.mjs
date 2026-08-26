/**
 * 🧪 اختبارات JALOGO — الوحدات (برومبت/حدود) + التكامل (المسارات كاملة)
 *
 * بلا شبكة إطلاقاً: مزوّدات محاكاة ومخزن ملفات في مجلد مؤقت لكل اختبار.
 * كل سقفٍ وسلوكِ بوابةٍ هنا **درعُ فاتورة** — كسرُه في PR لاحق يعني
 * تكلفة حقيقية غير محدودة، فهذه الاختبارات صارمة عمداً.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';

import { validateLogoInput, composeLogoPrompt, LOGO_STYLES } from '../src/prompts.js';
import {
    readLimits, DEFAULTS, hashIp, startOfUtcDay, startOfUtcMonth,
    checkDraftAllowed, checkFinalAllowed, maybeAlertCost,
} from '../src/limits.js';
import { createFileStore } from '../src/store/fileStore.js';
import { extractImageUrl } from '../src/providers/falImageProvider.js';
import { createApp } from '../server.js';

const SECRET = 'test-secret';
const tokenFor = (username, extra = {}) => jwt.sign({ username, ...extra }, SECRET);

function tmpStore() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jalogo-test-'));
    return createFileStore({ dataDir: dir });
}

/** مزوّد محاكاة: يرقّم الصور ويسجّل النداءات — والفشل قابل للبرمجة. */
function fakeProvider(name, { failTimes = 0 } = {}) {
    let n = 0; let fails = failTimes;
    const calls = [];
    return {
        name,
        calls,
        async generateImage(prompt, extra) {
            calls.push({ prompt, extra });
            if (fails > 0) { fails--; throw new Error('فشل مبرمج'); }
            return `https://img.test/${name}-${++n}.png`;
        },
    };
}

/** يشغّل التطبيق على منفذ عشوائي ويعيد baseUrl + إغلاقاً نظيفاً. */
async function startApp(overrides = {}) {
    const store = overrides.store || tmpStore();
    const draft = overrides.draftProvider || fakeProvider('draft');
    const final = overrides.finalProvider || fakeProvider('final');
    const app = createApp({
        store, jwtSecret: SECRET,
        draftProvider: draft, finalProvider: final,
        adminUsersCsv: 'boss',
        limits: { ...readLimits({}), ...overrides.limits },
    });
    const server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    return { baseUrl, store, draft, final, close: () => new Promise(r => server.close(r)) };
}

const post = (base, p, body, token) => fetch(`${base}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
});
const get = (base, p, token) => fetch(`${base}${p}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
});

const VALID_INPUT = { brandName: 'Jatrava', industry: 'travel and tourism', style: 'minimal' };

// ═══ الوحدات: البرومبت ═══════════════════════════════════════════════

test('validateLogoInput: يرفض غياب الاسم والمجال والأسلوب المجهول واللون التالف', () => {
    assert.equal(validateLogoInput({}).ok, false);
    assert.equal(validateLogoInput({ brandName: 'x' }).ok, false);
    assert.equal(validateLogoInput({ ...VALID_INPUT, style: 'evil' }).ok, false);
    assert.equal(validateLogoInput({ ...VALID_INPUT, colors: ['red'] }).ok, false);
    assert.equal(validateLogoInput({ ...VALID_INPUT, colors: ['#123456', '#abcdef', '#000000', '#ffffff'] }).ok, false);
    assert.equal(validateLogoInput({ ...VALID_INPUT, brandName: 'ب'.repeat(61) }).ok, false);
});

test('validateLogoInput: يقبل المدخل السليم ويطبّع الألوان لحروف صغيرة', () => {
    const r = validateLogoInput({ ...VALID_INPUT, colors: ['#AbCdEf'] });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.colors, ['#abcdef']);
    assert.equal(r.value.styleId, 'minimal');
});

test('composeLogoPrompt: يضم قصاصة الأسلوب والاسم والألوان وحارس «بلا نص»', () => {
    const r = validateLogoInput({ ...VALID_INPUT, style: 'emblem', colors: ['#112233'] });
    const p = composeLogoPrompt(r.value);
    assert.ok(p.includes(LOGO_STYLES.find(s => s.id === 'emblem').fragment));
    assert.ok(p.includes('"Jatrava"'));
    assert.ok(p.includes('#112233'));
    assert.ok(p.includes('no text, no letters'));
});

test('كل أسلوب في الكتالوج يُنتج برومبت صالحاً يحمل حارس «بلا نص»', () => {
    for (const s of LOGO_STYLES) {
        const r = validateLogoInput({ ...VALID_INPUT, style: s.id });
        assert.equal(r.ok, true, s.id);
        assert.ok(composeLogoPrompt(r.value).includes('no text'), s.id);
    }
});

// ═══ الوحدات: الحدود ════════════════════════════════════════════════

test('hashIp: ثابت لنفس العنوان، مختلف بين عنوانين، ولا يحوي العنوان الخام', () => {
    assert.equal(hashIp('1.2.3.4', 's'), hashIp('1.2.3.4', 's'));
    assert.notEqual(hashIp('1.2.3.4', 's'), hashIp('5.6.7.8', 's'));
    assert.ok(!hashIp('1.2.3.4', 's').includes('1.2.3.4'));
});

test('readLimits: قيمة بيئة تالفة تسقط للافتراضي الآمن', () => {
    const l = readLimits({ LOGO_DAILY_DRAFT_CAP: 'كثير', LOGO_MONTHLY_FINAL_CAP_PER_USER: '-5' });
    assert.equal(l.dailyDraftCap, DEFAULTS.dailyDraftCap);
    assert.equal(l.monthlyFinalCapPerUser, DEFAULTS.monthlyFinalCapPerUser);
});

test('checkDraftAllowed: حد الزائر بالـIP يُفرض، وصاحب الحساب لا يقيده الـIP', async () => {
    const store = tmpStore();
    const limits = { ...DEFAULTS, dailyDraftCapPerIp: 1 };
    const ipHash = hashIp('9.9.9.9', 's');

    assert.equal((await checkDraftAllowed(store, { ipHash, limits })).allowed, true);
    await store.recordDraftRound({ ipHash, username: null, prompt: 'p', params: {}, images: [] });
    const denied = await checkDraftAllowed(store, { ipHash, limits });
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, 'guest_cap_reached');

    // نفس الـIP لكن بحساب — يمر (حد المستخدم مستقل عن حد الزائر)
    assert.equal((await checkDraftAllowed(store, { ipHash, username: 'sara', limits })).allowed, true);
});

test('checkDraftAllowed: السقف العام صفر = إيقاف طوارئ كامل', async () => {
    const store = tmpStore();
    const denied = await checkDraftAllowed(store, {
        ipHash: 'x', limits: { ...DEFAULTS, dailyDraftCap: 0 },
    });
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, 'daily_cap_reached');
});

test('checkFinalAllowed: السقف الشهري يُفرض ويتجدد مطلع الشهر', async () => {
    const store = tmpStore();
    const limits = { ...DEFAULTS, monthlyFinalCapPerUser: 1 };
    assert.equal((await checkFinalAllowed(store, { username: 'ali', limits })).allowed, true);
    await store.recordFinal({ username: 'ali', roundId: 'r', prompt: 'p', params: {}, imageUrl: 'u' });
    const denied = await checkFinalAllowed(store, { username: 'ali', limits });
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, 'monthly_final_cap_reached');
    // نافذة الشهر القادم فارغة — العدّ من بداية الشهر لا نافذة منزلقة
    const nextMonth = startOfUtcMonth() + 32 * 24 * 3600 * 1000;
    assert.equal((await checkFinalAllowed(store, { username: 'ali', limits, now: nextMonth })).allowed, true);
});

test('maybeAlertCost: ينبّه مرة واحدة فقط في اليوم وعند العتبة فقط', async () => {
    const store = tmpStore();
    const limits = { ...DEFAULTS, dailyDraftCap: 10, alertAtPct: 80, alertWebhookUrl: '' };
    assert.equal(await maybeAlertCost(store, { limits, count: 7 }), false);
    assert.equal(await maybeAlertCost(store, { limits, count: 8 }), true);
    assert.equal(await maybeAlertCost(store, { limits, count: 9 }), false); // نُبِّه اليوم بالفعل
});

test('extractImageUrl: يفهم كل صيغ رد fal المعروفة', () => {
    assert.equal(extractImageUrl({ images: [{ url: 'a' }] }), 'a');
    assert.equal(extractImageUrl({ image: { url: 'b' } }), 'b');
    assert.equal(extractImageUrl({ image: 'c' }), 'c');
    assert.equal(extractImageUrl({}), null);
});

// ═══ التكامل: المسارات ══════════════════════════════════════════════

test('الصحة والكتالوج علنيان بلا توكن', async () => {
    const app = await startApp();
    try {
        const h = await (await get(app.baseUrl, '/api/health')).json();
        assert.equal(h.ok, true);
        const res = await get(app.baseUrl, '/api/logo/options');
        assert.equal(res.status, 200);
        const opts = await res.json();
        assert.ok(opts.styles.length >= 5);
        assert.ok(opts.styles.every(s => s.id && s.nameAr && s.nameEn));
        assert.equal(opts.guestDailyAttempts, DEFAULTS.dailyDraftCapPerIp);
    } finally { await app.close(); }
});

test('مسودات الزائر: جولة كاملة تعيد الخيارات، والحد اليومي يقفل بعدها بـ429', async () => {
    const app = await startApp({ limits: { dailyDraftCapPerIp: 1, draftVariants: 4 } });
    try {
        const res = await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.images.length, 4);
        assert.ok(body.id);
        assert.equal(body.remaining, 0);
        // البرومبت وصل للمزوّد الرخيص بمقاس مربع وبلا نص
        assert.equal(app.draft.calls.length, 4);
        assert.equal(app.draft.calls[0].extra.image_size, 'square');
        assert.ok(app.draft.calls[0].prompt.includes('no text'));

        const denied = await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT);
        assert.equal(denied.status, 429);
        assert.equal((await denied.json()).code, 'guest_cap_reached');
    } finally { await app.close(); }
});

test('مسودات: مدخل تالف يُرفض بـ400 قبل أي نداء للمزوّد', async () => {
    const app = await startApp();
    try {
        const res = await post(app.baseUrl, '/api/logo/drafts', { brandName: '', industry: 'x' });
        assert.equal(res.status, 400);
        assert.equal(app.draft.calls.length, 0);
    } finally { await app.close(); }
});

test('مسودات صاحب الحساب: حده مستقل وأرحب من حد الزائر', async () => {
    const app = await startApp({ limits: { dailyDraftCapPerIp: 0, dailyDraftCapPerUser: 2 } });
    try {
        // الزائر مقفول تماماً (سقفه 0) لكن صاحب الحساب يمر من نفس الـIP
        const guest = await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT);
        assert.equal(guest.status, 429);
        const res = await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT, tokenFor('sara'));
        assert.equal(res.status, 200);
        assert.equal((await res.json()).remaining, 1);
    } finally { await app.close(); }
});

test('مسودات: نجاح جزئي للمزوّد يعيد ما نجح، وفشل كامل يعيد 502', async () => {
    const partial = await startApp({
        limits: { draftVariants: 4 },
        draftProvider: fakeProvider('draft', { failTimes: 2 }),
    });
    try {
        const res = await post(partial.baseUrl, '/api/logo/drafts', VALID_INPUT);
        assert.equal(res.status, 200);
        assert.equal((await res.json()).images.length, 2);
    } finally { await partial.close(); }

    const dead = await startApp({
        limits: { draftVariants: 2 },
        draftProvider: fakeProvider('draft', { failTimes: 99 }),
    });
    try {
        const res = await post(dead.baseUrl, '/api/logo/drafts', VALID_INPUT);
        assert.equal(res.status, 502);
    } finally { await dead.close(); }
});

test('النهائي: بلا توكن 401 — بوابة التسجيل هي جوهر النموذج', async () => {
    const app = await startApp();
    try {
        const res = await post(app.baseUrl, '/api/logo/final', { roundId: 'x' });
        assert.equal(res.status, 401);
    } finally { await app.close(); }
});

test('النهائي: جولة الزائر تُتبنى بالحساب الجديد، وتُرفض جولة حساب آخر', async () => {
    const app = await startApp();
    try {
        // ولّد كزائر (القمع الحقيقي: جرّب أولاً، سجّل للتنزيل)
        const draft = await (await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT)).json();

        const res = await post(app.baseUrl, '/api/logo/final', { roundId: draft.id }, tokenFor('sara'));
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(body.imageUrl.startsWith('https://img.test/final-'));
        // النهائي بالجودة العالية (square_hd) وبنفس برومبت الجولة
        assert.equal(app.final.calls[0].extra.image_size, 'square_hd');
        assert.ok(app.final.calls[0].prompt.includes('"Jatrava"'));

        // جولة بحساب — لا يفتحها حساب آخر
        const owned = await (await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT, tokenFor('sara'))).json();
        const stranger = await post(app.baseUrl, '/api/logo/final', { roundId: owned.id }, tokenFor('omar'));
        assert.equal(stranger.status, 403);

        const missing = await post(app.baseUrl, '/api/logo/final', { roundId: 'ghost' }, tokenFor('sara'));
        assert.equal(missing.status, 404);
    } finally { await app.close(); }
});

test('النهائي: السقف الشهري يقفل بـ429، و«شعاراتي» تسرد ما وُلّد', async () => {
    const app = await startApp({ limits: { monthlyFinalCapPerUser: 1, dailyDraftCapPerIp: 5 } });
    try {
        const d1 = await (await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT)).json();
        const d2 = await (await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT)).json();

        const ok = await post(app.baseUrl, '/api/logo/final', { roundId: d1.id }, tokenFor('sara'));
        assert.equal(ok.status, 200);
        const capped = await post(app.baseUrl, '/api/logo/final', { roundId: d2.id }, tokenFor('sara'));
        assert.equal(capped.status, 429);
        assert.equal((await capped.json()).code, 'monthly_final_cap_reached');

        const mine = await (await get(app.baseUrl, '/api/logo/mine', tokenFor('sara'))).json();
        assert.equal(mine.logos.length, 1);
        assert.ok(mine.logos[0].imageUrl);

        const other = await (await get(app.baseUrl, '/api/logo/mine', tokenFor('omar'))).json();
        assert.equal(other.logos.length, 0);
    } finally { await app.close(); }
});

test('لوحة المشرف: 403 لغير المشرف، وعدّادات الاستهلاك للمشرف', async () => {
    const app = await startApp();
    try {
        assert.equal((await get(app.baseUrl, '/api/logo/admin/status', tokenFor('sara'))).status, 403);
        await post(app.baseUrl, '/api/logo/drafts', VALID_INPUT);
        const res = await get(app.baseUrl, '/api/logo/admin/status', tokenFor('boss'));
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.todayDraftRounds, 1);
        assert.equal(body.dailyDraftCap, DEFAULTS.dailyDraftCap);
    } finally { await app.close(); }
});

test('createApp: يرفض التشغيل بلا سر أو بلا مزوّدين — فشل صاخب عند الإقلاع', () => {
    const store = tmpStore();
    const p = fakeProvider('x');
    assert.throws(() => createApp({ store, jwtSecret: '', draftProvider: p, finalProvider: p }), /JWT_SECRET/);
    assert.throws(() => createApp({ store, jwtSecret: SECRET, draftProvider: null, finalProvider: p }), /مزوّدا/);
});

test('المخزن: عدّ الجولات يفرّق بين IP ومستخدم ونافذة زمنية', async () => {
    const store = tmpStore();
    await store.recordDraftRound({ ipHash: 'a', username: null, prompt: 'p', params: {}, images: [] });
    await store.recordDraftRound({ ipHash: 'a', username: 'sara', prompt: 'p', params: {}, images: [] });
    const since = startOfUtcDay();
    assert.equal(await store.countDraftRoundsSince(since), 2);
    assert.equal(await store.countDraftRoundsSinceForIp('a', since), 2);
    assert.equal(await store.countDraftRoundsSinceForUser('sara', since), 1);
    assert.equal(await store.countDraftRoundsSince(Date.now() + 1000), 0);
});
