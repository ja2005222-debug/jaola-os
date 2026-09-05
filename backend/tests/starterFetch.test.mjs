// 📥 جالبُ القوالب من GitHub — وحدةٌ حيّةٌ خلف مسار أدمِن (`/api/admin/starters/import`)
// تسحب كودَ مستودعاتٍ خارجيّة إلى داخل المنصّة، وكانت بلا تغطية.
//
// خطرُها ليس في المنطق بل في **ما قد تسحبه**: سرّاً في `.env`، أو ثنائيّاً
// يُفسد المحتوى، أو مستودعاً ضخماً يبتلع الذاكرة. فالحراسةُ هنا على أنّ
// المتجاوَزات **لا تُطلَب أصلاً** — لا أن تُطلب ثمّ تُرمى.
import { test } from 'node:test';
import assert from 'node:assert';
import { parseRepoUrl, fetchRepoFiles, fetchStarter } from '../agents/starterFetch.js';

/** حاقنُ شبكةٍ يسجّل كلَّ رابطٍ طُلب، فنسأل عمّا لم يُطلب لا عمّا رجع فقط. */
function net(tree, body = (p) => `محتوى ${p}`) {
    const asked = [];
    const impl = async (url) => {
        asked.push(url);
        if (url.includes('api.github.com')) return { ok: true, json: async () => tree };
        const path = url.split('/HEAD/')[1] || url;
        const out = body(decodeURIComponent(path));
        if (out === null) return { ok: false, status: 404 };
        return { ok: true, text: async () => out };
    };
    return { impl, asked, raw: () => asked.filter((u) => u.includes('raw.githubusercontent')) };
}

const blobs = (...paths) => ({ tree: paths.map((p) => (typeof p === 'string' ? { type: 'blob', path: p, size: 50 } : { type: 'blob', ...p })) });

test('تحليلُ رابط المستودع يقبل صيغَه المعروفة ويرفض ما ليس مستودعاً', () => {
    for (const [input, want] of [
        ['vercel/commerce', 'vercel/commerce'],
        ['https://github.com/vercel/commerce', 'vercel/commerce'],
        ['https://github.com/vercel/commerce.git', 'vercel/commerce'],
        ['git@github.com:vercel/commerce.git', 'vercel/commerce'],
        ['https://github.com/vercel/commerce/tree/main/site', 'vercel/commerce'],
    ]) {
        const { owner, repo } = parseRepoUrl(input);
        assert.strictEqual(`${owner}/${repo}`, want, input);
    }
    for (const bad of ['', '   ', 'ليس-رابطاً', 'https://example.com/a/b', 'owner']) {
        assert.throws(() => parseRepoUrl(bad), /مطلوب|تعذّر تحليل|غير صالح/, JSON.stringify(bad));
    }
    // مقيسٌ لا مفترَض: مضيفٌ آخر بلا بروتوكول يُقرأ owner/repo ويُطلب من GitHub
    // (`example.com/vercel` = ٤٠٤ لا مضيفٌ آخر) — الطلبُ لا يغادر api.github.com.
    assert.deepStrictEqual(parseRepoUrl('example.com/vercel/commerce'), { owner: 'example.com', repo: 'vercel' });
});

// 🔑 الحارسُ الأهمّ: السرُّ والثنائيّ والضخمُ لا تُفتح لها الشبكةُ أصلاً.
test('المتجاوَزات لا تُطلَب أصلاً — لا تُطلب ثمّ تُرمى', async () => {
    const n = net(blobs(
        'package.json', 'src/app.js',
        '.env', '.env.local', 'apps/web/.env',        // أسرار
        'public/logo.png', 'fonts/x.woff2',           // ثنائيّات
        'node_modules/x/i.js', 'dist/b.js', '.git/config', 'coverage/r.js',
        'package-lock.json', 'pnpm-lock.yaml',
        { path: 'huge.js', size: 999_999 },           // فوق سقف الملف الواحد
    ));
    const r = await fetchRepoFiles('o', 'p', { fetchImpl: n.impl });

    assert.deepStrictEqual(r.files.map((f) => f.name), ['package.json', 'src/app.js']);
    const requested = n.raw().join('\n');
    for (const forbidden of ['.env', 'logo.png', 'woff2', 'node_modules', 'dist/', '.git/', 'lock', 'huge.js']) {
        assert.ok(!requested.includes(forbidden), `طُلب ما لا يُطلب: ${forbidden}`);
    }
    assert.strictEqual(n.raw().length, 2, 'طلبان اثنان لا أكثر');
});

test('«قد لا يكون هذا كلَّ شيء» تُقال: truncated تُمرَّر كما جاءت', async () => {
    const cut = net({ truncated: true, ...blobs('a.js') });
    assert.strictEqual((await fetchRepoFiles('o', 'p', { fetchImpl: cut.impl })).meta.truncated, true);
    const whole = net({ truncated: false, ...blobs('a.js') });
    assert.strictEqual((await fetchRepoFiles('o', 'p', { fetchImpl: whole.impl })).meta.truncated, false);
});

test('سقفُ العدد يُحترَم، والمتروكُ يُعَدّ لا يُبتلَع', async () => {
    const n = net(blobs('a.js', 'b.js', 'c.js', 'd.js'));
    const r = await fetchRepoFiles('o', 'p', { fetchImpl: n.impl, maxFiles: 2 });
    assert.strictEqual(r.files.length, 2);
    assert.strictEqual(r.meta.count, 2, 'العدُّ المُعلَن هو عددُ ما سُلّم فعلاً');
    assert.strictEqual(r.meta.skipped, 2, 'المتروكان معدودان');
    assert.strictEqual(n.raw().length, 2, 'ما تُرك لم يُنزَّل');
});

test('سقفُ المجموع يُحترَم، وtotalBytes يقيس ما سُلّم', async () => {
    const n = net(blobs('a.js', 'b.js', 'c.js'), () => 'x'.repeat(100));
    const r = await fetchRepoFiles('o', 'p', { fetchImpl: n.impl, maxBytes: 250 });
    assert.ok(r.meta.totalBytes <= 250, `تجاوز السقف: ${r.meta.totalBytes}`);
    assert.strictEqual(r.meta.totalBytes, r.files.reduce((s, f) => s + Buffer.byteLength(f.content), 0));
});

// الشجرةُ قد تكذب في الحجم (أو تسكت عنه)، فالحدُّ يُعاد فحصُه على المُنزَّل.
test('حجمُ الشجرة ليس دليلاً — الحدُّ يُعاد فحصه بعد التنزيل', async () => {
    const n = net(blobs({ path: 'a.js', size: 10 }), () => 'x'.repeat(5000));
    const r = await fetchRepoFiles('o', 'p', { fetchImpl: n.impl, maxFileBytes: 1000 });
    assert.deepStrictEqual(r.files, [], 'ما تجاوز الحدَّ لا يُسلَّم وإن كذبت الشجرة');
    assert.strictEqual(r.meta.skipped, 1);
});

test('تعذُّرُ الشجرة يُرفَع بحالته لا برسالةٍ عامّة', async () => {
    const impl = async () => ({ ok: false, status: 404 });
    const err = await fetchRepoFiles('o', 'p', { fetchImpl: impl }).then(() => null, (e) => e);
    assert.ok(err, 'لم يُرفع خطأ');
    assert.strictEqual(err.status, 404, 'المسارُ يترجمها إلى ٤٠٤ للمستخدم');
    assert.match(err.message, /o\/p/);
});

test('سقوطُ ملفٍ واحد لا يُسقط الجلبَ كلَّه، ويُعَدّ متروكاً', async () => {
    const n = net(blobs('a.js', 'b.js'), (p) => (p === 'b.js' ? null : 'ok'));
    const r = await fetchRepoFiles('o', 'p', { fetchImpl: n.impl });
    assert.deepStrictEqual(r.files.map((f) => f.name), ['a.js']);
    assert.strictEqual(r.meta.skipped, 1);
});

test('القالبُ الداخليّ يُقال إنّه داخليّ، لا يُطلب من GitHub', async () => {
    await assert.rejects(() => fetchStarter({ id: 'vanilla', name: 'V' }), /داخليّ/);
    await assert.rejects(() => fetchStarter(null), /داخليّ/);
});

test('جلبُ قالبٍ من السجلّ يُعيد هويّته معه', async () => {
    const n = net(blobs('a.js'));
    const r = await fetchStarter(
        { id: 'precedent', name: 'Precedent', license: 'MIT', repo: 'https://github.com/steven-tey/precedent' },
        { fetchImpl: n.impl },
    );
    assert.deepStrictEqual(r.starter, {
        id: 'precedent', name: 'Precedent', license: 'MIT', repo: 'https://github.com/steven-tey/precedent',
    });
    assert.strictEqual(r.meta.owner, 'steven-tey');
    assert.strictEqual(r.meta.repo, 'precedent');
});
