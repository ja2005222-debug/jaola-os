// 📱 Service Worker حدّي الدور: وجوده وحده يجعل الموقع قابلاً للتثبيت
// (معيار Chrome/Android لتفعيل beforeinstallprompt) — بلا أي تخزين مؤقت
// فعلي عمداً؛ التطبيق يتغيّر بسرعة والتخزين المؤقت هنا كان سيعني محتوى
// قديماً بصمت. كل طلب يمر مباشرة للشبكة كأن لا service worker إطلاقاً.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // بلا respondWith — يترك المتصفح يتعامل مع الطلب بشكل طبيعي.
});
