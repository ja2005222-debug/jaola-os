import { useRef } from 'react';

// 🛠️ نفس منطق اكتشاف عنوان الباك إند المستخدم في باقي الملفات
// يجب أن يشير دائماً لمنفذ 4000 (الباك إند) وليس window.location.origin
// (الذي يُعيد عنوان الصفحة الحالية على منفذ الفرونت إند 5173)
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

export function PreviewFrame({ activeProject, previewTimestamp, viewMode, streamingContent, currentUser }) {
  const iframeRef = useRef(null);
  const savedUser = currentUser || localStorage.getItem('currentUser') || 'guest_user';
  const directPreviewUrl = `${BACKEND_URL}/workspace/index.html?project=${activeProject}&username=${savedUser}&t=${previewTimestamp}`;

  // 🆕 حل مستهدف لمشكلة عناصر الإدخال البيضاء على خلفيات داكنة:
  // بدلاً من فرض لون على الموقع بالكامل (الذي كان يكسر التصاميم الملوّنة)،
  // نستهدف فقط عناصر input/select/textarea التي لم يُحدد لها AI لوناً صريحاً،
  // ونتركها تتوارث لون النص المحيط بها بدلاً من اللون الافتراضي الأبيض للمتصفح.
  const handleLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentDocument) {
        const doc = iframe.contentDocument;
        const oldStyle = doc.getElementById('jaola-input-fix');
        if (oldStyle) oldStyle.remove();

        const style = doc.createElement('style');
        style.id = 'jaola-input-fix';
        style.textContent = `
          /* فقط للعناصر التي لم يُحدد الـ AI لها background صريحاً */
          input:not([style*="background"]):not([class*="bg-"]),
          select:not([style*="background"]):not([class*="bg-"]),
          textarea:not([style*="background"]):not([class*="bg-"]) {
            background-color: inherit;
            color: inherit;
            border: 1px solid currentColor;
          }
        `;
        doc.head.appendChild(style);
      }
    } catch (e) {}
  };

  return (
    <iframe
      ref={iframeRef}
      src={directPreviewUrl}
      title="Live Preview"
      sandbox="allow-scripts allow-same-origin"
      onLoad={handleLoad}
      className={`w-full h-full ${viewMode === 'mobile' ? 'max-w-[375px] mx-auto' : 'max-w-full'}`}
      key={previewTimestamp}
    />
  );
}
