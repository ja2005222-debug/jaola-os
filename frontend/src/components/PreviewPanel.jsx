import { useRef, useEffect, useState } from 'react';
import { PreviewFrame } from './PreviewFrame.jsx';
import { BACKEND_URL } from '../config.js';

// معاينة محسّنة: شريط أدوات (جهاز/تحديث/فتح خارجي) + بث الكود الحي أثناء الكتابة

export function PreviewPanel({ activeProject, previewTimestamp, streamingContent, currentUser, onRefresh, compact = false }) {
  const [viewMode, setViewMode] = useState('desktop'); // desktop | mobile
  const streamRef = useRef(null);

  // تمرير تلقائي لأسفل بث الكود
  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [streamingContent]);

  const savedUser = currentUser || localStorage.getItem('currentUser') || 'guest_user';
  const externalUrl = `${BACKEND_URL}/workspace/index.html?project=${activeProject}&username=${savedUser}&t=${previewTimestamp}`;

  const btn = {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
    padding: compact ? '4px 8px' : '4px 10px', color: '#64748b', fontSize: 12, cursor: 'pointer',
  };
  const btnActive = { ...btn, background: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.35)', color: '#93c5fd' };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#060a10' }}>
      {/* شريط الأدوات */}
      <div style={{
        height: 38, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        <button style={viewMode === 'desktop' ? btnActive : btn} onClick={() => setViewMode('desktop')} title="عرض سطح المكتب">🖥️</button>
        <button style={viewMode === 'mobile' ? btnActive : btn} onClick={() => setViewMode('mobile')} title="عرض الجوال">📱</button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
          <span style={{
            fontSize: 10, color: '#374151', fontFamily: 'monospace', direction: 'ltr',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
          }}>
            /workspace/{activeProject}
          </span>
        </div>
        <button style={btn} onClick={onRefresh} title="تحديث المعاينة">⟳</button>
        <a href={externalUrl} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none', display: 'flex', alignItems: 'center' }} title="فتح في تبويب جديد">↗</a>
      </div>

      {/* المعاينة + بث الكود الحي */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: viewMode === 'mobile' ? '#0a0f18' : '#060a10' }}>
        <PreviewFrame
          activeProject={activeProject}
          previewTimestamp={previewTimestamp}
          viewMode={viewMode}
          streamingContent={streamingContent}
          currentUser={savedUser}
        />

        {/* أثناء البناء: طبقة بث الكود المكتوب مباشرة */}
        {streamingContent && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(4,8,16,0.96)',
            display: 'flex', flexDirection: 'column', zIndex: 5,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
              borderBottom: '1px solid rgba(59,130,246,0.2)', flexShrink: 0,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd' }}>💻 JAOLA يكتب الكود الآن مباشرة...</span>
              <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginRight: 'auto', direction: 'ltr' }}>
                {streamingContent.length.toLocaleString()} حرف
              </span>
            </div>
            <pre ref={streamRef} dir="ltr" style={{
              flex: 1, margin: 0, padding: '12px 16px', overflow: 'auto',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.6,
              color: '#7dd3a8', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {streamingContent.slice(-4000)}
              <span style={{ animation: 'pulse 0.8s infinite', color: '#3b82f6' }}>▊</span>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
