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

test('الواجهة: إعادة التحميل محروسة بـsessionStorage — لا حلقة لا نهائية', () => {
    const helper = fs.readFileSync(new URL('../../frontend/src/chunkReload.js', import.meta.url), 'utf8');
    assert.match(helper, /sessionStorage/, 'حارس دائم عبر إعادات التحميل');
    assert.match(helper, /window\.location\.reload\(\)/);
    assert.match(helper, /catch\s*\{/, 'التصفح الخاص قد يمنع التخزين → لا إعادة تحميل بلا حارس');
});
