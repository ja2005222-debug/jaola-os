import { useState, useEffect } from 'react';

// بطاقة تقدم المهمة الحية — تُعرض داخل الشات أثناء البناء
// تحوّل الشات من "صامت" إلى مركز تقارير مباشر: مرحلة حالية، نسبة، آخر حدث، مؤقت

const AGENT_META = {
  planner:   { icon: '🗺️', label: 'التخطيط' },
  architect: { icon: '🏗️', label: 'الهندسة' },
  coder:     { icon: '💻', label: 'البرمجة' },
  qa:        { icon: '🧪', label: 'الفحص' },
  deploy:    { icon: '🚀', label: 'النشر' },
};

export function MissionProgress({ agentStates, lastLog, startedAt }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const entries = Object.entries(agentStates || {});
  const doneCount = entries.filter(([, s]) => s === 'completed').length;
  const pct = entries.length ? Math.round((doneCount / entries.length) * 100) : 0;
  const running = entries.find(([, s]) => s === 'running');
  const currentMeta = running ? (AGENT_META[running[0]] || { icon: '⚙️', label: running[0] }) : null;

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.06))',
      border: '1px solid rgba(59,130,246,0.25)',
      borderRadius: 12, padding: '12px 14px', animation: 'fadeIn 0.3s ease',
    }}>
      {/* الرأس: الحالة + المؤقت */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: '#3b82f6',
          animation: 'pulse 1.2s infinite', flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', flex: 1 }}>
          {currentMeta
            ? `${currentMeta.icon} جاري ${currentMeta.label}...`
            : '⚡ جاري تجهيز المهمة...'}
        </span>
        <span style={{
          fontSize: 11, color: '#64748b', fontFamily: 'monospace',
          fontVariantNumeric: 'tabular-nums', direction: 'ltr',
        }}>
          {mm}:{ss}
        </span>
      </div>

      {/* شريط التقدم */}
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{
          height: '100%', width: `${Math.max(pct, 4)}%`,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          borderRadius: 2, transition: 'width 0.6s ease',
        }} />
      </div>

      {/* سلسلة الوكلاء */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: lastLog ? 10 : 0 }}>
        {entries.map(([name, state]) => {
          const meta = AGENT_META[name] || { icon: '⚙️', label: name };
          const isDone = state === 'completed';
          const isRunning = state === 'running';
          return (
            <span key={name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
              background: isDone ? 'rgba(16,185,129,0.1)' : isRunning ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : isRunning ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
              color: isDone ? '#10b981' : isRunning ? '#60a5fa' : '#4b5563',
            }}>
              <span>{isDone ? '✓' : meta.icon}</span>
              <span>{meta.label}</span>
            </span>
          );
        })}
      </div>

      {/* آخر حدث من السجل */}
      {lastLog && (
        <div style={{
          fontSize: 11, color: '#64748b', fontFamily: 'monospace',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8,
        }}>
          {lastLog}
        </div>
      )}
    </div>
  );
}
