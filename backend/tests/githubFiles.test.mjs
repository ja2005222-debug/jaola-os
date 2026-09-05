// 🐙 githubFiles — كلُّ ما يعود من `getFile` يصل إلى مربّع نصٍّ في اللوحة،
// ثمّ يكتبه `putFile` في مستودع المستخدم. فهو ادّعاءٌ بأنّه «نصُّ الملف».
//
// وكان يكذب في حالتين، كلتاهما تُتلف الملف عند الحفظ.
import { test } from 'node:test';
import assert from 'node:assert';
import { listRepos, getFile } from '../services/githubFiles.js';

/** يستبدل fetch بردودٍ معدّة، ويسجّل ما طُلب. */
function stubFetch(responder) {
    const real = globalThis.fetch;
    const urls = [];
    globalThis.fetch = async (url) => {
        urls.push(String(url));
        const { status = 200, body } = responder(String(url), urls.length) || {};
        return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body ?? {}) };
    };
    return { urls, restore() { globalThis.fetch = real; } };
}
const repo = (i) => ({ full_name: `u/r${i}`, name: `r${i}`, private: false, default_branch: 'main', updated_at: '' });

test('العطب: قائمةُ المستودعات كانت صفحةً واحدةً تُعرض قائمةً كاملة', async () => {
    const f = stubFetch((_u, n) => ({ body: n <= 2 ? Array.from({ length: 100 }, (_, i) => repo(n * 100 + i)) : [repo(999)] }));
    try {
        const { repos, truncated } = await listRepos('t');
        assert.strictEqual(repos.length, 201, 'ثلاثُ صفحاتٍ لا واحدة');
        assert.strictEqual(truncated, false, 'انتهت قبل السقف');
        assert.match(f.urls[1], /page=2/);
    } finally { f.restore(); }
});

test('بلوغُ السقف يُقال ولا يُبتلَع', async () => {
    const f = stubFetch(() => ({ body: Array.from({ length: 100 }, (_, i) => repo(i)) }));
    try {
        const { repos, truncated } = await listRepos('t', { maxPages: 2 });
        assert.strictEqual(repos.length, 200);
        assert.strictEqual(truncated, true, 'مبتورةٌ فتُعلَن مبتورة');
    } finally { f.restore(); }
});

test('صفحةٌ واحدةٌ ناقصة: لا طلبَ زائد ولا دعوى بتر', async () => {
    const f = stubFetch(() => ({ body: [repo(1), repo(2)] }));
    try {
        const { repos, truncated } = await listRepos('t');
        assert.deepStrictEqual([repos.length, truncated, f.urls.length], [2, false, 1]);
    } finally { f.restore(); }
});

test('العطب: ملفٌّ ثنائيّ كان يُعرض نصّاً — وحفظُه يُتلف الأصل', async () => {
    // بايتاتٌ لا تُمثَّل في utf8 (ترويسة PNG) — قِيست حقيقةً على الواجهة الحيّة:
    // apple-touch-icon.png ‏8235 بايت → بعد فكّ utf8: 14763.
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xd8, 0xfe]);
    const f = stubFetch(() => ({ body: { type: 'file', encoding: 'base64', content: png.toString('base64'), sha: 's' } }));
    try {
        const e = await getFile('t', 'u/r', 'icon.png').then(() => null, (err) => err);
        assert.ok(e, 'لم يعد يُقدَّم نصّاً');
        assert.strictEqual(e.reason, 'binary');
        assert.strictEqual(e.status, 415);
    } finally { f.restore(); }
});

test('العطب: محتوىً لم تُرسله الواجهة كان يُعرض ملفاً فارغاً', async () => {
    for (const body of [
        { type: 'file', encoding: 'none', content: '', sha: 's' },   // ما توثّقه GitHub للكبير
        { type: 'file', encoding: 'base64', content: '', sha: 's' },
        { type: 'file', sha: 's' },
    ]) {
        const f = stubFetch(() => ({ body }));
        try {
            const e = await getFile('t', 'u/r', 'big.json').then(() => null, (err) => err);
            assert.ok(e, `قُبل: ${JSON.stringify(body)}`);
            assert.strictEqual(e.reason, 'no-content');
        } finally { f.restore(); }
    }
});

test('نصٌّ حقيقيّ — عربيٌّ متعدّد البايتات — يمرّ سليماً', async () => {
    const text = 'مرحباً 🌍\nconst x = 1;\n';
    const f = stubFetch(() => ({ body: {
        type: 'file', encoding: 'base64', content: Buffer.from(text, 'utf8').toString('base64'),
        sha: 'abc', path: 'a.js', size: 20 } }));
    try {
        const r = await getFile('t', 'u/r', 'a.js');
        assert.strictEqual(r.content, text, 'الجولةُ كاملة');
        assert.strictEqual(r.sha, 'abc');
    } finally { f.restore(); }
});

test('مسارٌ ليس ملفاً يُرفض كما كان', async () => {
    const f = stubFetch(() => ({ body: { type: 'dir' } }));
    try {
        await assert.rejects(() => getFile('t', 'u/r', 'src'), /ليس ملفاً/);
    } finally { f.restore(); }
});

test('خطأُ الواجهة يحمل حالتَه فلا يصير 500 عمياء', async () => {
    const f = stubFetch(() => ({ status: 404, body: { message: 'Not Found' } }));
    try {
        const e = await getFile('t', 'u/r', 'x').then(() => null, (err) => err);
        assert.strictEqual(e.status, 404);
        assert.strictEqual(e.message, 'Not Found');
    } finally { f.restore(); }
});
