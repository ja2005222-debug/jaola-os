import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // تأكد من وجود ./ قبل اسم الملف
import './index.css'; // تأكد من وجود ملف التنسيقات

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 📱 تسجيل Service Worker — وجوده وحده شرط تثبيت PWA على Chrome/Android
// (بلا تخزين مؤقت فعلي، راجع public/sw.js). فشل التسجيل لا يكسر الموقع.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
