import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../config.js';

// 🕘 الخط الزمني التاريخي: سجل البنايات الحقيقي + نقاط git مع استرجاع لأي نقطة

const fmtDuration = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} د` : `${s} ث`);
const fmtWhen = (ts) => new Date(ts).toLocaleString('ar', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function TimelinePanel({ activeProject, token, onRestored }) {
  const [commits, setCommits] = useState([]);
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/timeline?project=${encodeURIComponent(activeProject)}`, { headers });
      const d = await res.json();
      if (res.ok) {
        setCommits(d.commits || []);
        setBuilds(d.metrics?.builds || []);
      } else setError(d.error || 'فشل جلب الخط الزمني');
    } catch { setError('تعذر الاتصال بالخادم'); }
    setLoading(false);
  }, [activeProject, token]);

  useEffect(() => { load(); }, [load]);

  const handleRestore = async (hash) => {
    if (!window.confirm(`استرجاع المشروع إلى النقطة (${hash})؟\nسيُحفظ الوضع الحالي تلقائياً قبل الاسترجاع — يمكنك العودة إليه لاحقاً.`)) return;
    setRestoring(hash);
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/rollback`, {
        method: 'POST', headers,
        body: JSON.stringify({ project: activeProject, hash }),
      });
      const d = await res.json();
      if (res.ok) { onRestored?.(hash); await load(); }
      else alert(d.error || 'فشل الاسترجاع');
    } catch { alert('تعذر الاتصال بالخادم'); }
    setRestoring(null);
  };

  const S = { muted: '#475569', border: '#1a2332' };

  if (loading) return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:S.muted, fontSize:13 }}>
      جاري تحميل الخط الزمني...
    </div>
  );

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:'16px', background:'#060a10' }}>
      {error && <div style={{ color:'#f87171', fontSize:12, marginBottom:12 }}>{error}</div>}

      {/* سجل البنايات */}
      <div style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>
        🏗️ سجل البنايات ({builds.length})
      </div>
      {builds.length === 0 && <div style={{ color:'#334155', fontSize:12, marginBottom:16 }}>لا بنايات مسجلة بعد.</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:24 }}>
        {builds.map((b, i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
            background:'rgba(255,255,255,0.02)', border:`1px solid ${b.success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius:8, fontSize:11,
          }}>
            <span style={{ fontSize:13 }}>{b.success ? '✅' : '❌'}</span>
            <span style={{ flex:1, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {b.goal || 'بناء'}
            </span>
            <span style={{ color:S.muted, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>⏱ {fmtDuration(b.durationSec || 0)}</span>
            {b.filesCount > 0 && <span style={{ color:S.muted, flexShrink:0 }}>📁 {b.filesCount}</span>}
            <span style={{ color:'#334155', fontSize:10, flexShrink:0, direction:'ltr' }}>{fmtWhen(b.at)}</span>
          </div>
        ))}
      </div>

      {/* نقاط git — قابلة للاسترجاع */}
      <div style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>
        ⏪ نقاط الاسترجاع ({commits.length})
      </div>
      {commits.length === 0 && <div style={{ color:'#334155', fontSize:12 }}>لا نقاط حفظ بعد — تُنشأ تلقائياً مع كل بناء.</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {commits.map((c, i) => (
          <div key={c.hash} style={{ display:'flex', gap:12, position:'relative' }}>
            {/* خط الزمن العمودي */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:14, flexShrink:0 }}>
              <div style={{ width:9, height:9, borderRadius:'50%', background: i === 0 ? '#3b82f6' : '#1f2937', border:'2px solid #0d1220', marginTop:10, zIndex:1 }} />
              {i < commits.length - 1 && <div style={{ width:1, flex:1, background:S.border }} />}
            </div>
            <div style={{ flex:1, padding:'6px 0 14px', minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <code style={{ fontSize:10, color:'#60a5fa', background:'rgba(59,130,246,0.08)', padding:'1px 6px', borderRadius:4, direction:'ltr' }}>{c.hash}</code>
                <span style={{ fontSize:10, color:'#334155' }}>{c.time}</span>
                {i === 0 && <span style={{ fontSize:9, color:'#10b981', fontWeight:700 }}>● الحالي</span>}
                {i > 0 && (
                  <button onClick={() => handleRestore(c.hash)} disabled={!!restoring}
                    style={{
                      marginRight:'auto', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)',
                      borderRadius:6, padding:'2px 10px', color:'#fbbf24', fontSize:10, fontWeight:700,
                      opacity: restoring ? 0.5 : 1,
                    }}>
                    {restoring === c.hash ? 'جاري الاسترجاع...' : '⏪ استرجاع'}
                  </button>
                )}
              </div>
              <div style={{ fontSize:12, color:'#94a3b8', marginTop:3, wordBreak:'break-word' }}>{c.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
