import React from 'react';

export function PreviewFrame({ activeProject, previewTimestamp, viewMode, streamingContent }) {
  const getIframeWidthClass = () => {
    if (viewMode === 'tablet') return 'w-[768px] max-w-full';
    if (viewMode === 'mobile') return 'w-[375px] max-w-full';
    return 'w-full';
  };

  return (
    <div className="w-full h-full relative flex justify-center items-center">
      {/* 🛡️ التعديل الشبكي الحاسم: استخدام المسار النسبي الآمن ليعبر تلقائياً عبر بروكسي Vite المطور */}
      <iframe
        src={`/workspace/index.html?project=${activeProject}&t=${previewTimestamp}`}
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
