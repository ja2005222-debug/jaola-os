import React from 'react';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

// تم تزويد المكون بالـ currentUser لعزل ملقم المعاينة حركياً
export function PreviewFrame({ activeProject, previewTimestamp, viewMode, streamingContent, currentUser }) {
  const getIframeWidthClass = () => {
    if (viewMode === 'tablet') return 'w-[768px] max-w-full';
    if (viewMode === 'mobile') return 'w-[375px] max-w-full';
    return 'w-full';
  };

  // 🛡️ توجيه معزول تماماً يضمن تشغيل ومعاينة مجلدات المستخدم الفعلي فقط وتفادي تسريب الملفات
  const directPreviewUrl = `${BACKEND_URL}/workspace/index.html?project=${activeProject}&username=${currentUser || 'guest_user'}&t=${previewTimestamp}`;

  return (
    <div className="w-full h-full relative flex justify-center items-center">
      <iframe
        src={directPreviewUrl}
        className={`h-full border-0 bg-slate-900 transition-all duration-300 ${getIframeWidthClass()}`}
        sandbox="allow-scripts allow-same-origin"
      />

      {/* لوحة بث الأكواد */}
      {streamingContent && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md p-6 overflow-y-auto font-mono text-[10px] text-cyan-400 border border-cyan-500/20 rounded-xl flex flex-col justify-start">
          <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-2">
            <span className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-cyan-400">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              ⚡ جاري استقبال وبث الأكواد حياً (Token Streaming)
            </span>
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed select-none text-left">{streamingContent}</pre>
        </div>
      )}
    </div>
  );
}
