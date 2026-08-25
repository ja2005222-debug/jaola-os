// 🩹 «صفحة بيضاء فقط» على jaola.dev (٢٥ أغسطس ٢٠٢٦):
// احتياط توجيه SPA كان يردّ index.html على كل مسار غير معروف — بما فيه
// الأصول المفقودة. تبويب قديم يطلب `/assets/index-<hash>.js` مُزالاً بعد
// نشرٍ جديد فيتلقّى HTML بترويسة text/html مكان وحدة جافاسكربت، فيرفض
// المتصفح تنفيذه وتُفرَّغ شجرة React → بياض تام مع بقاء عنوان التبويب.
// هذه الاختبارات تثبّت الحدّ: مسارات الصفحات تمرّ للاحتياط، والأصول تُرفض
// بـ404 صريحة (تصل للواجهة كـvite:preloadError فتتعافى تلقائياً).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isStaticAssetPath } from '../utils/spaFallback.js';

test('مسارات صفحات التطبيق كلها تمرّ لاحتياط SPA (لا 404)', () => {
    for (const p of ['/', '/dashboard', '/boot', '/admin', '/billing', '/settings', '/privacy', '/terms', '/some/deep/route']) {
        assert.equal(isStaticAssetPath(p), false, `${p} صفحة لا أصل`);
    }
});

test('حزم مبصومة بالهاش تحت /assets/ تُعدّ أصولاً → 404 لا index.html', () => {
    for (const p of ['/assets/index-B6XrB9SQ.js', '/assets/index-D2PUoSgR.css', '/assets/Dashboard-BKfKNq5R.js']) {
        assert.equal(isStaticAssetPath(p), true, `${p} أصل`);
    }
});

test('ملفات الجذر ذات الامتداد أصول أيضاً (favicon، manifest، أيقونات)', () => {
    for (const p of ['/favicon.svg', '/manifest.json', '/icon-192.png', '/sw.js', '/robots.txt']) {
        assert.equal(isStaticAssetPath(p), true, `${p} أصل`);
    }
});

test('امتداد طويل غير معهود لا يُعدّ أصلاً — لا نحرم مساراً صفحةً بالخطأ', () => {
    assert.equal(isStaticAssetPath('/project.something-long'), false);
});

// 🛡️ الشقّ الثاني من نفس العطب: الواجهة نفسها. حتى مع 404 صريحة، غياب
// حدّ الأخطاء حول <Suspense> يعني أن أي فشل حزمة يُفرّغ الشجرة بصمت.
test('الواجهة: <App/> مغلَّف بحدّ أخطاء ومستمع vite:preloadError مسجَّل', () => {
    const main = fs.readFileSync(new URL('../../frontend/src/main.jsx', import.meta.url), 'utf8');
    assert.match(main, /<ErrorBoundary>[\s\S]*<App\s*\/>[\s\S]*<\/ErrorBoundary>/, 'App داخل حدّ الأخطاء');
    assert.match(main, /vite:preloadError/, 'فشل modulepreload يسبق React — لا بد من التقاطه');
    assert.match(main, /reloadOnceForStaleChunk/, 'التعافي من الحزمة المتقادمة');
});

test('الواجهة: احتياط vercel.json يستثني /assets/ كما يفعل الخادم', () => {
    const cfg = JSON.parse(fs.readFileSync(new URL('../../frontend/vercel.json', import.meta.url), 'utf8'));
    const src = cfg.rewrites?.[0]?.source || '';
    assert.match(src, /\(\?!assets\//, 'الأصول المفقودة لا تُبتلع في index.html');
});

// ⚠️ درس فوري (٢٥ أغسطس ٢٠٢٦): أُضيف مفتاح `"//"` تعليقاً في vercel.json،
// فرفضه مُصادِق مخطط Vercel («should NOT have additional property //»)
// وفشل النشر بالكامل. JSON بلا تعليقات، وVercel لا يتسامح مع مفتاح زائد —
// والتوثيق مكانه تعليق جافاسكربت في الشيفرة لا مفتاح في ملف الإعداد.
test('vercel.json بلا مفاتيح خارج مخطط Vercel — وإلا فشل النشر كلّه', () => {
    const raw = fs.readFileSync(new URL('../../frontend/vercel.json', import.meta.url), 'utf8');
    const cfg = JSON.parse(raw);
    const ALLOWED = new Set([
        'buildCommand', 'cleanUrls', 'crons', 'devCommand', 'framework', 'functions',
        'headers', 'ignoreCommand', 'images', 'installCommand', 'outputDirectory',
        'public', 'redirects', 'regions', 'rewrites', 'trailingSlash',
    ]);
    for (const key of Object.keys(cfg)) {
        assert.ok(ALLOWED.has(key), `مفتاح غير مدعوم في vercel.json: ${JSON.stringify(key)}`);
    }
});

test('الواجهة: إعادة التحميل محروسة بـsessionStorage — لا حلقة لا نهائية', () => {
    const helper = fs.readFileSync(new URL('../../frontend/src/chunkReload.js', import.meta.url), 'utf8');
    assert.match(helper, /sessionStorage/, 'حارس دائم عبر إعادات التحميل');
    assert.match(helper, /window\.location\.reload\(\)/);
    assert.match(helper, /catch\s*\{/, 'التصفح الخاص قد يمنع التخزين → لا إعادة تحميل بلا حارس');
});

// 🩺 الثغرة التي كشفها النشر (٢٥ أغسطس ٢٠٢٦): حدّ أخطاء React لا يمكنه أن
// يمسك فشل **حزمة الدخول نفسها** — فهو يعيش داخلها. بقيت jaola.dev بيضاء
// بلا بطاقة بعد نشر الإصلاح، وهذا هو السبب. العلاج حارسٌ مضمّن في
// index.html كسكربت عادي (لا وحدة) يعمل حتى لو لم تُحمَّل أي حزمة.
test('index.html يحمل حارس إقلاع مضمّناً خارج الحزمة', () => {
    const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');
    const guard = html.slice(html.indexOf('<script>'));
    assert.ok(html.includes('<script>'), 'سكربت عادي مضمّن — لا وحدة، كي يعمل بلا حزم');
    assert.match(guard, /childElementCount/, 'يرصد بقاء #root فارغاً');
    assert.match(guard, /sessionStorage/, 'حارس ضد حلقة إعادة التحميل');
    assert.match(guard, /_jaolaRetry/, 'إعادة محاولة بتجاوز كاش index.html المتقادم');
    assert.match(guard, /content-type/i, 'يشخّص HTML المموّه مكان الجافاسكربت');
    assert.match(guard, /addEventListener\('error'[\s\S]{0,200}true\)/, 'التقاط فشل السكربت في طور الالتقاط');
});

test('حارس الإقلاع لا يعتمد على وحدات أو مكتبات — يعمل ولو فشل كل شيء', () => {
    const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');
    const guard = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
    assert.ok(!/\bimport\s/.test(guard), 'لا import — سكربت عادي');
    assert.ok(!/\brequire\(/.test(guard), 'لا require');
    assert.ok(!/=>/.test(guard), 'ES5 صِرف — لا يسقط على متصفح قديم قبل أن يشخّص');
});

// 🎙️ الجولة الثانية على jaola.dev: الحارس عرض بطاقةً تقول «status: 200،
// content-type: application/javascript» ثم «راجع Console» — أي أنه شخّص
// التسليم ولم يشخّص التنفيذ. السبب أنه كان يرشّح أحداث window.error إلى
// فشل تحميل السكربتات وحدها، فيضيع الاستثناء المرمي عند أعلى مستوى الحزمة.
// الآن مسجّلٌ مبكّر في <head> يلتقط كل خطأ ورفضٍ غير معالَج، والبطاقة تعرضه.
test('مسجّل الأخطاء المبكّر يسبق كل سكربت آخر ويلتقط الاستثناءات والرفض', () => {
    const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');
    const headEnd = html.indexOf('</head>');
    const recorder = html.slice(0, headEnd);
    assert.match(recorder, /__jaolaErrors/, 'المسجّل داخل <head> — قبل أي سكربت');
    assert.match(recorder, /unhandledrejection/, 'الرفض غير المعالَج يضيع بلا هذا');
    assert.ok(recorder.indexOf('__jaolaErrors') < html.indexOf('type="module"'),
        'يسبق حزمة الدخول، وإلا فاته ما ترميه عند أعلى مستواها');
});

test('بطاقة التشخيص تعرض الخطأ الملتقَط وحالة الـservice worker', () => {
    const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');
    const guard = html.slice(html.lastIndexOf('<script>'));
    assert.match(guard, /--- errors ---/, 'نصّ الخطأ يظهر في البطاقة لا في Console وحدها');
    assert.match(guard, /service-worker:/, 'SW مسيطر يفسّر «تصل سليمة ولا تُنفَّذ»');
    assert.match(guard, /unregister/, 'زرّ تنظيف SW والكاش — علاجٌ لا تشخيصٌ فقط');
});

// ⏱️ قياسٌ فعلي: البطاقة كانت تظهر بعد ٥٣ ثانية لأن العدّ يبدأ من load،
// وload ينتظر الموارد — ومنها المورد المعطوب نفسه. والزائر أمام بياضٍ طوالها.
test('العدّ يبدأ من DOMContentLoaded، ومسارٌ سريع لا ينتظر المهلة عند خطأ مُسجَّل', () => {
    const html = fs.readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8');
    const guard = html.slice(html.lastIndexOf('<script>'));
    assert.match(guard, /DOMContentLoaded/, 'لا ننتظر load — يتأخّر حين يكون العطب في مورد');
    assert.match(guard, /FAST_FAIL_AFTER/, 'خطأ مُسجَّل + جذر فارغ = حكم قاطع بلا انتظار');
});
