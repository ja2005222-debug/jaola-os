import React from 'react';

export default function DigitalTwin({ projectData, agents }) {
  // تصفية ألوان الصحة البرمجية
  const activeAgent = agents.find(a => a.status === 'Running');

  return (
    <div style={{ background: '#09090b', color: '#fff', padding: '20px', height: '100%', borderRadius: '14px', border: '1px solid #18181b', display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box' }}>
      <h3 style={{ margin: 0, fontSize: '11px', color: '#71717a', letterSpacing: '1px', textTransform: 'uppercase' }}>🧠 Digital Twin Engine</h3>
      
      {/* لوحة الـ KPIs الذكية */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ background: '#020204', padding: '10px', borderRadius: '10px', border: '1px solid #18181b' }}>
          <div style={{ fontSize: '9px', color: '#71717a' }}>ENGINE STACK</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px', fontFamily: 'monospace' }}>{projectData.framework}</div>
        </div>
        <div style={{ background: '#020204', padding: '10px', borderRadius: '10px', border: '1px solid #18181b' }}>
          <div style={{ fontSize: '9px', color: '#71717a' }}>HEALTH INDEX</div>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '4px', color: '#00df89' }}>{projectData.health}%</div>
        </div>
      </div>

      {/* المحرك النشط حالياً */}
      <div style={{ background: '#020204', padding: '12px', borderRadius: '10px', border: '1px solid #18181b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#71717a' }}>Active Core:</span>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: activeAgent ? '#0070f3' : '#00df89' }}>
          {activeAgent ? `⚡ ${activeAgent.name} Working...` : '🟢 System Idle'}
        </span>
      </div>

      {/* الابتكار الأكبر: قسم WHAT CHANGED (الـ Gen-Diff البصري الفعلي) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: '#71717a', fontWeight: '700', letterSpacing: '0.5px' }}>⚡ WHAT CHANGED (GEN-DIFF)</div>
        <div style={{ flex: 1, background: '#000', borderRadius: '10px', padding: '12px', border: '1px solid #18181b', fontSize: '11px', fontFamily: 'monospace', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {projectData.changes.map((change, i) => (
            <div key={i} style={{ color: change.startsWith('+') ? '#00df89' : change.startsWith('-') ? '#ff4d4d' : '#38bdf8' }}>
              {change}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
