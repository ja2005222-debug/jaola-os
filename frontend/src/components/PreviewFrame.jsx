import { useRef } from 'react';

const BACKEND_URL = window.location.origin;

export function PreviewFrame({ activeProject, previewTimestamp, viewMode, streamingContent, currentUser }) {
  const iframeRef = useRef(null);

const savedUser = currentUser || localStorage.getItem('currentUser') || 'guest_user';
const directPreviewUrl = `${BACKEND_URL}/workspace/index.html?project=${activeProject}&username=${savedUser}&t=${previewTimestamp}`;

  const handleLoad = () => {
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentDocument) {
        const doc = iframe.contentDocument;
        const oldStyle = doc.getElementById('jaola-fix');
        if (oldStyle) oldStyle.remove();
        const style = doc.createElement('style');
        style.id = 'jaola-fix';
        style.textContent = `
          html, body {
            background-color: #ffffff !important;
            color: #111111 !important;
          }
          body * {
            color-scheme: light !important;
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
      style={{
        backgroundColor: '#ffffff',
        colorScheme: 'light',
      }}
      className={`w-full h-full ${viewMode === 'mobile' ? 'max-w-[375px] mx-auto' : 'max-w-full'}`}
      key={previewTimestamp}   // يضمن إعادة تحميل الإطار عند كل تحديث
    />
  );
}
