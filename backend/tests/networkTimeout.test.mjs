// 🌐 مهلةُ النداء الشبكيّ الصادر.
//
// 🔴 `fetch` في Node **لا تنتهي مهلتُها أبداً** بلا `AbortSignal`. وكان أحدَ
//    عشرَ موضعاً بلا مهلة: أربعةٌ في مسار تسجيل الدخول (`oauthLite`)، وخمسةٌ
//    في مسار النشر (`deployAgent`)، وواحدٌ في قراءة ملفّات GitHub، وواحدٌ في
//    وحدةٍ يتيمة. ومزوّدٌ **معلَّق** (لا ساقط) كان يُعلّقها بلا حدّ.
import { test } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fetchWithTimeout, TIMEOUTS } from '../services/httpRetry.js';
import { scanNetworkCalls, argSpan, TIMED_CALLERS } from '../scripts/networkCalls.mjs';

/** خادمٌ يقبل الاتصالَ ولا يردّ أبداً — «معلَّق» لا «ساقط». */
function hangingServer() {
    const sockets = new Set();
    const server = http.createServer(() => { /* لا ردّ، عمداً */ });
    server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve({
            url: `http://127.0.0.1:${server.address().port}/`,
            close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(r); }),
        }));
    });
}

test('مزوّدٌ معلَّقٌ يُقطَع بالمهلة — لا ينتظَر إلى الأبد', async () => {
    const srv = await hangingServer();
    try {
        const t0 = Date.now();
        // 🔴 لا يُنتظر النداءُ انتظاراً مفتوحاً: اختبارٌ **يعلّق** بدل أن يسقط
        //    يحرق مهلةَ وظيفةِ CI ولا يقول ما العطب. أُثبت بطفرةٍ حقيقيّة:
        //    حذفُ المهلة من البوّابة كان يجمّد هذا الملفَّ بلا رسالة. فيُسابَق
        //    النداءُ حارساً يرمي رسالةً صريحة.
        const guard = new Promise((_, rej) =>
            setTimeout(() => rej(new Error('لم تُقطع المهلة — البوّابةُ لا تضع إشارة')), 4000).unref());
        await assert.rejects(
            () => Promise.race([fetchWithTimeout(srv.url, {}, 300), guard]),
            (e) => e?.name === 'TimeoutError' || /abort|timeout/i.test(e?.message || ''),
            'المهلةُ ترمي، ولا تعلّق',
        );
        assert.ok(Date.now() - t0 < 3000, 'قُطع في حدود المهلة لا بعد دهر');
    } finally { await srv.close(); }
});

test('النداءُ العاري على الخادمِ نفسِه لا يعود — وهذا هو العطبُ بعينه', async () => {
    const srv = await hangingServer();
    try {
        let settled = false;
        // بلا مهلةٍ: لا استقرارَ. نثبتُه بمهلةِ سباقٍ خارجيّة — لو كان لـ`fetch`
        // مهلةٌ ضمنيّةٌ قصيرة لاستقرّ النداءُ أوّلاً وسقط هذا التأكيد.
        const bare = fetch(srv.url).then(() => { settled = true; }, () => { settled = true; });
        const raced = await Promise.race([bare, new Promise((r) => setTimeout(() => r('ما زال معلّقاً'), 700))]);
        assert.strictEqual(raced, 'ما زال معلّقاً');
        assert.strictEqual(settled, false, '`fetch` بلا إشارةٍ لا تنتهي مهلتُها');
    } finally { await srv.close(); }
});

test('إشارةُ المتصل تُحترم ولا تُنتزع', async () => {
    const srv = await hangingServer();
    try {
        // 🔴 طفرةٌ نجت هنا أوّلاً: كان التأكيدُ `assert.rejects` **بلا مُطابِق**،
        //    فرفضُ الحارسِ نفسِه كان يُرضيه. أي أنّ الاختبارَ كان يمرّ بالسبب
        //    الخطأ: تجاهلُ إشارةِ المتصل لا يُمسك. **رفضٌ ما ليس الرفضَ المقصود.**
        //    الآن: يُطلَب سببُ الرفضِ بعينه، وزمنُه.
        const ac = new AbortController();
        const REASON = 'ألغاه المتصل';
        setTimeout(() => ac.abort(new Error(REASON)), 150);
        const guard = new Promise((_, rej) =>
            setTimeout(() => rej(new Error('إشارةُ المتصل أُهملت')), 4000).unref());
        const t0 = Date.now();
        await assert.rejects(
            () => Promise.race([fetchWithTimeout(srv.url, { signal: ac.signal }, 60_000), guard]),
            (e) => {
                assert.notStrictEqual(e?.message, 'إشارةُ المتصل أُهملت',
                    'المهلةُ الداخليّةُ (٦٠ث) طغت على إشارةِ المتصل');
                return e?.name === 'AbortError' || (e?.message || '').includes(REASON)
                    || /abort/i.test(e?.message || '');
            },
        );
        assert.ok(Date.now() - t0 < 1500, 'قُطع عند إشارةِ المتصل (١٥٠ms) لا عند مهلةِ البوّابة');
    } finally { await srv.close(); }
});

test('المهلُ مسمّاةٌ ومرتّبةٌ بحسب ثقل النداء', () => {
    assert.deepStrictEqual(Object.keys(TIMEOUTS).sort(), ['api', 'oauth', 'upload']);
    assert.ok(TIMEOUTS.oauth < TIMEOUTS.api, 'رحلةُ JSON أخفُّ من واجهةِ REST');
    assert.ok(TIMEOUTS.api < TIMEOUTS.upload, 'رفعُ موقعٍ كامل أثقلُ من قراءة');
    assert.ok(Object.isFrozen(TIMEOUTS));
});

test('argSpan لا يخدعه قوسٌ داخلَ نصّ', () => {
    // 🔴 لولا الوزنُ على حالاتِ المحارف لأغلق `")"` النطاقَ مبكّراً، فيُقرأ
    //    نداءٌ ذو مهلةٍ على أنّه بلا مهلة.
    const src = 'fetch(url, { headers: { x: ")" }, signal: s });';
    const span = argSpan(src, src.indexOf('('));
    assert.strictEqual(span, '(url, { headers: { x: ")" }, signal: s })', 'النطاقُ يبلغ الإغلاقَ الحقيقيّ');
    assert.match(span, /\bsignal\s*:/, 'ولذلك تُرى الإشارة');

    // والقوسُ المتداخلُ الحقيقيّ يُوزن، لا يُقطع عند أوّلِ `)`.
    const nested = 'fetch(build(a, b), { signal: s })';
    assert.strictEqual(argSpan(nested, nested.indexOf('(')), '(build(a, b), { signal: s })');
});

test('النداءُ بلا إشارةٍ يُصنَّف بلا مهلة — الحارسُ يرى النقيضَ أيضاً', () => {
    // 🔴 حارسٌ لا يُثبَت أنّه يقع لا يُوثق بوقوفه. تُبنى شجرةٌ حقيقتُها معروفة.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'netscan-'));
    try {
        fs.writeFileSync(path.join(dir, 'a.js'),
            'await fetch(u);\n'
            + 'await fetch(u, { signal: AbortSignal.timeout(5) });\n'
            + 'const tpl = `\n  await fetch("/api");\n`;\n'
            + '// await fetch(u);\n');
        const r = scanNetworkCalls(dir);
        assert.deepStrictEqual(r.untimed, ['a.js:1 → fetch'], 'العاري وحدَه');
        assert.deepStrictEqual(r.timed, ['a.js:2 → fetch'], 'وذو الإشارةِ بمعزل');
        assert.deepStrictEqual(r.generated, ['a.js:4 → fetch'], 'وما في القالبِ ليس نداءَنا');
        assert.deepStrictEqual(r.inert, ['a.js:6 → fetch'], 'وما في التعليقِ لا يُنفَّذ');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('الحدُّ المحروس: لا نداءَ شبكيٌّ بلا مهلة', () => {
    const { untimed } = scanNetworkCalls();
    assert.deepStrictEqual(untimed, [], `مواضعُ بلا مهلة:\n${untimed.join('\n')}`);
});

test('حارسُ الخواء: المسحُ بلغ ما ندّعي فحصَه', () => {
    // يُقاس **ما مُسح** لا ما نتج: صفرُ «بلا مهلة» لأنّ المسحَ لم يبلغ شيئاً
    //    يمرّ مرورَ الظافر.
    const { timed, generated } = scanNetworkCalls();
    for (const layer of ['agents/', 'services/', 'utils/', 'plugins/']) {
        assert.ok(timed.some((s) => s.startsWith(layer)), `لم يُمسح \`${layer}\``);
    }
    assert.ok(timed.length >= 20, `الجردُ انهار إلى ${timed.length} — الماسحُ معطوبٌ لا المستودعُ نظيف`);
    assert.ok(generated.length >= 50,
        `القوالبُ النصّيّة ${generated.length} — وهي وحدَها تفسّر «٣٩» في التدقيق`);
    for (const name of TIMED_CALLERS) assert.ok(typeof name === 'string' && name.length);
});
