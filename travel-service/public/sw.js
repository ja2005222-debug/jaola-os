/**
 * 🛰️ Service Worker — بوابة السفر كتطبيق قابل للتثبيت (PWA)
 *
 * ⚠️ درس إنتاجي حقيقي (١٥ أغسطس ٢٠٢٦): النسخة الأولى خدمت القشرة
 * cache-first — فكان كل مستخدم يرى صفحة **النشر السابق** زيارةً كاملة
 * (تحديث خلفي لا يظهر إلا بالزيارة التالية)، وبدت الميزات الجديدة
 * «مختفية» رغم نشرها. المالك أبلغ عنها فعلياً.
 *
 * السياسة الآن **network-first للقشرة**: الشبكة أولاً دوماً (فأحدث نشر
 * يظهر فوراً)، والكاش احتياطي الانقطاع الكامل فقط — الـPWA تبقى تعمل
 * دون اتصال، بلا ثمن التقادم.
 * - الـ API لا يُلمس إطلاقاً (أسعار ومقاعد حية).
 * - رفع الإصدار في CACHE_NAME يمسح كاش النسخ القديمة عند التفعيل.
 */
const CACHE_NAME = 'jatrava-shell-v8';
// ⚠️ **`/index.html` أُزيل عمداً ولا يُعاد**: صار يردّ 301 إلى `/` بعد
// فصل نسختَي اللغة، و`cache.addAll` **يرفض أي رد إعادة توجيه** فيسقط
// تثبيت الـSW كلّه — لا هذا الملف وحده. أي عنوانٍ يُضاف هنا يجب أن يردّ
// 200 مباشرةً. و`/en/` و`/ur/` و`/nl/` مضافة كي تعمل كل نسخة لغة دون اتصال أيضاً.
const SHELL = ['/', '/en/', '/ur/', '/nl/', '/i18n.js', '/trips.js', '/fare.js', '/manifest.webmanifest', '/icon.svg', '/logo.svg'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    // API وكل ما ليس GET من أصلنا → الشبكة مباشرةً بلا أي تدخل
    if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
    // القشرة: شبكة أولاً (أحدث نشر فوراً) + تحديث الكاش، والكاش للانقطاع فقط
    event.respondWith(
        fetch(event.request).then(res => {
            if (res?.ok) {
                const copy = res.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            }
            return res;
        }).catch(() => caches.match(event.request))
    );
});
