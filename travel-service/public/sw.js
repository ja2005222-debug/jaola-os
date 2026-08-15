/**
 * 🛰️ Service Worker — بوابة السفر كتطبيق قابل للتثبيت (PWA)
 *
 * السياسة عمداً محافظة:
 * - القشرة الثابتة (الصفحة/الأيقونة/المانيفست) cache-first مع تحديث خلفي
 *   (stale-while-revalidate) — فتح فوري حتى بشبكة بطيئة.
 * - **الـ API لا يُكيَّش أبداً**: الأسعار والمقاعد والحجوزات بيانات حية،
 *   وتقديم نسخة قديمة منها كذبة سعرية — نفس فلسفة «لا أسعار موهومة».
 * - رفع الإصدار في CACHE_NAME يمسح القديم تلقائياً عند التفعيل.
 */
const CACHE_NAME = 'jaola-travel-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

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
    // API وكل ما ليس GET → الشبكة مباشرةً بلا أي تدخل
    if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
    // القشرة فقط: كاش أولاً + تحديث خلفي صامت
    event.respondWith(
        caches.match(event.request).then(cached => {
            const refresh = fetch(event.request).then(res => {
                if (res && res.ok && url.origin === self.location.origin) {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                }
                return res;
            }).catch(() => cached); // انقطاع كامل: القشرة المكيَّشة خير من لا شيء
            return cached || refresh;
        })
    );
});
