import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // تأكد من وجود ./ قبل اسم الملف
import ErrorBoundary from './ErrorBoundary.jsx';
import { reloadOnceForStaleChunk } from './chunkReload';
import './index.css'; // تأكد من وجود ملف التنسيقات

// ⚡ فشل جلب حزمة صفحةٍ مقسّمة (`lazy()`) لا يمرّ دائماً عبر حدّ الأخطاء:
// حين يفشل `modulepreload` نفسه يطلق Vite حدث `vite:preloadError` على
// window قبل أن يصل الخطأ لـReact. بلا معالجة، النتيجة صفحة بيضاء صامتة.
// السبب الأشيع حزمة متقادمة، وعلاجها إعادة تحميل واحدة محروسة (انظر
// ErrorBoundary.jsx). preventDefault يمنع Vite من رمي الخطأ افتراضياً.
window.addEventListener('vite:preloadError', (event) => {
  // حزمة متقادمة على الأرجح → إعادة تحميل واحدة. الصفحة ذاهبة، فنكتم الخطأ.
  if (reloadOnceForStaleChunk()) {
    event.preventDefault();
    return;
  }
  // استُهلكت المحاولة: **لا** preventDefault هنا عمداً — كتمُ الخطأ يجعل
  // الاستيراد يُحلّ بـundefined فيرمي React.lazy «Cannot read properties of
  // undefined» وهي رسالة مبهمة لا يميّزها التصنيف. بتركه يُرمى يصل الخطأ
  // الأصلي لحدّ الأخطاء فيعرض الرسالة الصحيحة للزائر.
  console.error('[JAOLA] تعذّر جلب حزمة الصفحة بعد إعادة تحميل سابقة:', event.payload);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// 📱 تسجيل Service Worker — وجوده وحده شرط تثبيت PWA على Chrome/Android
// (بلا تخزين مؤقت فعلي، راجع public/sw.js). فشل التسجيل لا يكسر الموقع.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
