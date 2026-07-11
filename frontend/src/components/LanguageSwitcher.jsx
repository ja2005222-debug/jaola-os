import { useState, useRef, useEffect } from 'react';
import { useI18n, LANGUAGES } from '../i18n.js';

// 🌐 مبدّل اللغات الحي — زر يفتح قائمة اللغات المدعومة
export function LanguageSwitcher({ compact = false }) {
  const lang = useI18n(s => s.lang);
  const setLang = useI18n(s => s.setLang);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} title="Language"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.03)',
          border: '1px solid #1a2332', borderRadius: 7, padding: compact ? '5px 9px' : '5px 11px',
          color: '#94a3b8', fontSize: 13, cursor: 'pointer',
        }}>
        <span style={{ fontSize: 15 }}>{current.flag}</span>
        {!compact && <span style={{ fontSize: 12, fontWeight: 600 }}>{current.label}</span>}
        <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', insetInlineEnd: 0, minWidth: 160, zIndex: 200,
          background: '#0d1420', border: '1px solid #1e293b', borderRadius: 10, padding: 5,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', maxHeight: 320, overflowY: 'auto',
        }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); setOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 7, border: 'none', cursor: 'pointer', textAlign: l.dir === 'rtl' ? 'right' : 'left',
                background: l.code === lang ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: l.code === lang ? '#93c5fd' : '#cbd5e1', fontSize: 13, fontWeight: l.code === lang ? 700 : 500,
              }}>
              <span style={{ fontSize: 16 }}>{l.flag}</span>
              <span style={{ flex: 1 }}>{l.label}</span>
              {l.code === lang && <span style={{ fontSize: 11, color: '#10b981' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
