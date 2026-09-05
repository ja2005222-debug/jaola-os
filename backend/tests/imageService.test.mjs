// 🖼️ خدمةُ الصور — تحقن في سياق البناء روابطَ يضعها وكيلُ البرمجة في
// `img src` مباشرةً. فكلمةُ البحث تُقرّر ماذا يرى زائرُ الموقع المولَّد.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { queryForType, buildImageContext } from '../services/imageService.js';
import { divertConsoleToStderr } from './helpers/reportChannel.mjs';

divertConsoleToStderr();

const TYPES = Object.keys(JSON.parse(
    fs.readFileSync(new URL('../knowledge/design-rules.json', import.meta.url), 'utf8')).types);

test('العطب: ٢١ من ٣١ نوعاً كانت تسقط إلى صور المكاتب', () => {
    // حارسٌ مشتقٌّ من السجلّ نفسِه: كلُّ نوعٍ يُنتجه `detectProjectType`
    // يجب أن يحمل استعلامُه اسمَه — فلا ينجرف عن قائمةٍ يدويّة أبداً.
    assert.ok(TYPES.length >= 20, `الأنواعُ انهارت إلى ${TYPES.length} — السجلُّ لم يُقرأ`);
    const orphans = TYPES.filter((t) => !queryForType(t).split(' ').includes(t));
    assert.deepStrictEqual(orphans, [], 'أنواعٌ لا يظهر اسمُها في استعلامها');
    // والعطبُ نفسُه: لا نوعَ غيرُ business يُبحث بكلمات business
    const officey = TYPES.filter((t) => t !== 'business' && queryForType(t).includes('office team'));
    assert.deepStrictEqual(officey, [], 'أنواعٌ ما تزال تُبحث بصور المكاتب');
});

test('الأنواعُ المُثراةُ تحتفظ بإثرائها', () => {
    assert.strictEqual(queryForType('restaurant'), 'restaurant food gourmet');
    assert.strictEqual(queryForType('business'), 'business office team');
});

test('نوعٌ لا إثراءَ له يُبحث باسمه لا بالافتراضيّ', () => {
    for (const t of ['wedding', 'beauty', 'law', 'travel', 'automotive']) {
        assert.strictEqual(queryForType(t), t);
    }
});

test('مُدخَلٌ غائبٌ أو فارغ: business لا انهيار', () => {
    for (const bad of [undefined, null, '', '   ']) {
        assert.strictEqual(queryForType(bad), 'business office team');
    }
    assert.strictEqual(queryForType('  WEDDING  '), 'wedding', 'يُطبَّع');
});

test('بلا مفتاح Pexels: صورُ الاحتياط تُعلَن غيرَ مطابقة', async () => {
    const key = process.env.PEXELS_API_KEY; delete process.env.PEXELS_API_KEY;
    try {
        const r = await buildImageContext('عرس', 'wedding', 'my-site');
        assert.strictEqual(r.source, 'picsum');
        assert.strictEqual(r.count, 6);
        assert.match(r.context, /غير مطابقة للموضوع/, 'لا تُقدَّم صورٌ عشوائيةٌ على أنّها موضوعيّة');
        assert.match(r.context, /picsum\.photos\/seed\/my-site-0/);
    } finally { if (key !== undefined) process.env.PEXELS_API_KEY = key; }
});

test('مع Pexels: الاستعلامُ المستعمَل يُقال، والروابطُ هي ما عاد', async () => {
    const key = process.env.PEXELS_API_KEY;
    const realFetch = globalThis.fetch;
    let asked = '';
    process.env.PEXELS_API_KEY = 'k';
    globalThis.fetch = async (url) => {
        asked = String(url);
        return { ok: true, json: async () => ({ photos: [{ src: { large: 'https://p/1.jpg' } }, { src: {} }] }) };
    };
    try {
        const r = await buildImageContext('عرس', 'wedding', 's');
        assert.strictEqual(r.source, 'Pexels');
        assert.strictEqual(r.query, 'wedding');
        assert.match(asked, /query=wedding/, 'بُحث بنوعه لا بـbusiness');
        assert.strictEqual(r.count, 1, 'صورةٌ بلا رابطٍ تُطرح');
        assert.match(r.context, /مطابقة لموضوع/);
    } finally {
        globalThis.fetch = realFetch;
        if (key === undefined) delete process.env.PEXELS_API_KEY; else process.env.PEXELS_API_KEY = key;
    }
});

test('إخفاقُ Pexels يعود إلى الاحتياط ولا يُسقط البناء', async () => {
    const key = process.env.PEXELS_API_KEY;
    const realFetch = globalThis.fetch;
    process.env.PEXELS_API_KEY = 'k';
    globalThis.fetch = async () => { throw new Error('انقطاع'); };
    try {
        const r = await buildImageContext('عرس', 'wedding', 's');
        assert.strictEqual(r.source, 'picsum');
        assert.strictEqual(r.count, 6);
    } finally {
        globalThis.fetch = realFetch;
        if (key === undefined) delete process.env.PEXELS_API_KEY; else process.env.PEXELS_API_KEY = key;
    }
});
