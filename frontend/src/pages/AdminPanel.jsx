import { useState, useEffect, useCallback } from 'react';
import { BACKEND_URL } from '../config.js';
import { useI18n } from '../i18n.js';

// 🛠️ لوحة تحكم المشرف — صحة النظام + صناعة وإدارة الوكلاء + إدارة الملفات

const S = {
  bg: '#050810', bg2: '#0b1120', card: '#0f1729', border: '#1e293b',
  text: '#e2e8f0', muted: '#64748b', blue: '#3b82f6', purple: '#8b5cf6',
  green: '#10b981', amber: '#f59e0b', red: '#ef4444',
};

const statusColor = { ok: S.green, warn: S.amber, critical: S.red };
const statusIcon = { ok: '✅', warn: '⚠️', critical: '❌' };

export default function AdminPanel({ onExit }) {
  const tr = useI18n(s => s.t);
  const token = localStorage.getItem('token');
  const [tab, setTab] = useState('health');
  const [denied, setDenied] = useState(false);

  const api = useCallback(async (pathUrl, opts = {}) => {
    const res = await fetch(`${BACKEND_URL}${pathUrl}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (res.status === 403) { setDenied(true); throw new Error('forbidden'); }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || tr('admGenericError'));
    return d;
  }, [token]);

  if (denied) return (
    <Shell onExit={onExit} tab={tab} setTab={setTab}>
      <div style={{ padding: 40, textAlign: 'center', color: S.amber }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h3 style={{ color: S.text, marginBottom: 8 }}>{tr('admAccessDenied')}</h3>
        <p style={{ color: S.muted, fontSize: 14, lineHeight: 2 }}>
          {tr('admNotAdmin')}<br />
          <code style={{ color: S.blue, direction: 'ltr' }}>ADMIN_USERS=username</code> {tr('admThenRestart')}
        </p>
      </div>
    </Shell>
  );

  return (
    <Shell onExit={onExit} tab={tab} setTab={setTab}>
      {tab === 'health' && <HealthTab api={api} />}
      {tab === 'agents' && <AgentsTab api={api} />}
      {tab === 'files' && <FilesTab api={api} />}
    </Shell>
  );
}

// ── الهيكل العام ──────────────────────────────────────────────
function Shell({ children, onExit, tab, setTab }) {
  const tr = useI18n(s => s.t);
  const dir = useI18n(s => s.dir);
  const tabs = [
    { id: 'health', icon: '🩺', label: tr('admTabHealth') },
    { id: 'agents', icon: '🤖', label: tr('admTabAgents') },
    { id: 'files', icon: '🗂️', label: tr('admTabFiles') },
  ];
  return (
    <div style={{ minHeight: '100dvh', background: S.bg, color: S.text, fontFamily: 'system-ui, sans-serif', direction: dir }}>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px} button{cursor:pointer;font-family:inherit} input,textarea,select{font-family:inherit;outline:none}`}</style>
      <nav style={{ height: 56, background: S.bg2, borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚙️</div>
        <span style={{ fontWeight: 800, fontSize: 15 }}>JAOLA Admin</span>
        <span style={{ fontSize: 10, color: S.blue, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '2px 8px', borderRadius: 5, fontWeight: 700 }}>Control Center</span>
        <div style={{ flex: 1 }} />
        <button onClick={onExit} style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 14px', color: S.muted, fontSize: 13 }}>{tr('admBack')}</button>
      </nav>

      <div style={{ display: 'flex', minHeight: 'calc(100dvh - 56px)' }}>
        <div style={{ width: 210, background: S.bg2, borderLeft: `1px solid ${S.border}`, padding: '16px 10px', flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', marginBottom: 4,
                borderRadius: 9, border: `1px solid ${tab === t.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                background: tab === t.id ? 'rgba(59,130,246,0.1)' : 'transparent', color: tab === t.id ? '#93c5fd' : S.muted,
                fontSize: 14, fontWeight: tab === t.id ? 700 : 500, textAlign: 'start',
              }}>
              <span style={{ fontSize: 17 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 24, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}

const cardStyle = { background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 18 };
const inputStyle = { width: '100%', background: '#0a0f1e', border: `1px solid ${S.border}`, borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, marginTop: 6 };
const btnPrimary = { background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: 8, padding: '9px 18px', color: '#fff', fontWeight: 700, fontSize: 13 };
const label = { fontSize: 11, color: S.muted, fontWeight: 700, letterSpacing: '0.5px' };

// ── 🩺 صحة النظام ─────────────────────────────────────────────
function HealthTab({ api }) {
  const tr = useI18n(s => s.t);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const d = await api('/api/admin/health'); setReport(d.report); }
    catch (e) { if (e.message !== 'forbidden') setErr(e.message); }
    setLoading(false);
  }, [api]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Muted>{tr('admScanning')}</Muted>;
  if (err) return <Muted>{err}</Muted>;
  if (!report) return null;

  return (
    <div>
      <Header title={tr('admHealthTitle')} action={<button onClick={load} style={btnPrimary}>{tr('admRefresh')}</button>} />
      <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 26 }}>{statusIcon[report.overall]}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: statusColor[report.overall] }}>{report.summary}</div>
          <div style={{ fontSize: 12, color: S.muted }}>Uptime: {Math.floor(report.uptimeSec / 60)} {tr('admUptime')}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {report.checks.map((c, i) => (
          <div key={i} style={{ ...cardStyle, padding: 14, borderRight: `3px solid ${statusColor[c.status]}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{statusIcon[c.status]}</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
            </div>
            <div style={{ fontSize: 13, color: S.text, marginTop: 5 }}>{c.detail}</div>
            {c.fix && <div style={{ fontSize: 12, color: S.amber, marginTop: 6 }}>↳ {c.fix}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 🤖 الوكلاء والإضافات ──────────────────────────────────────
function AgentsTab({ api }) {
  const tr = useI18n(s => s.t);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', instructions: '', runsOnBuild: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try { const d = await api('/api/admin/plugins'); setStatus(d); }
    catch (e) { if (e.message !== 'forbidden') setMsg(e.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const createAgent = async () => {
    if (!form.name.trim() || !form.instructions.trim()) { setMsg(tr('admNameInstrRequired')); return; }
    setBusy(true); setMsg('');
    try {
      await api('/api/admin/agents', { method: 'POST', body: JSON.stringify(form) });
      setMsg(`✅ ${tr('admAgentCreated')} "${form.name}"${form.runsOnBuild ? tr('admWillJoinBuilds') : '.'}`);
      setForm({ name: '', description: '', instructions: '', runsOnBuild: false });
      load();
    } catch (e) { setMsg('❌ ' + e.message); }
    setBusy(false);
  };

  const toggle = async (name, enabled) => {
    try { await api(`/api/admin/plugins/${encodeURIComponent(name)}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) }); load(); } catch {}
  };
  const del = async (file) => {
    if (!window.confirm(`${tr('admConfirmDeletePlugin')} "${file}"`)) return;
    try { await api(`/api/admin/plugins/${encodeURIComponent(file)}`, { method: 'DELETE' }); load(); } catch (e) { setMsg('❌ ' + e.message); }
  };
  const runAgent = async (agentName) => {
    setTesting(true); setTestResult('');
    try {
      const d = await api(`/api/admin/agents/${encodeURIComponent(agentName)}/run`, { method: 'POST', body: JSON.stringify({ input: { text: testInput } }) });
      setTestResult(typeof d.result === 'string' ? d.result : (d.result?.reply || JSON.stringify(d.result, null, 2)));
    } catch (e) { setTestResult('❌ ' + e.message); }
    setTesting(false);
  };

  return (
    <div>
      <Header title={tr('admAgentsTitle')} />

      {/* صناعة وكيل — أبسط طريقة */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{tr('admCreateNewAgent')}</div>
        <p style={{ color: S.muted, fontSize: 12, marginBottom: 14 }}>{tr('admCreateHint')}</p>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <span style={label}>{tr('admAgentName')}</span>
            <input style={inputStyle} dir="ltr" value={form.name} placeholder="marketing-writer"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <span style={label}>{tr('admDescOptional')}</span>
            <input style={inputStyle} value={form.description} placeholder={tr('admDescPlaceholder')}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <span style={label}>{tr('admInstructions')}</span>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', lineHeight: 1.6 }}
              value={form.instructions} placeholder={tr('admInstrPlaceholder')}
              onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
          </div>
          {/* متى يعمل الوكيل؟ — نقطة الدمج في منظومة جولا */}
          <div>
            <span style={label}>{tr('admWhenRuns')}</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[
                { v: false, icon: '🧪', t: tr('admOnDemand'), d: tr('admOnDemandDesc') },
                { v: true, icon: '🔗', t: tr('admEveryBuild'), d: tr('admEveryBuildDesc') },
              ].map(o => (
                <button key={String(o.v)} onClick={() => setForm(f => ({ ...f, runsOnBuild: o.v }))}
                  style={{
                    flex: 1, textAlign: 'start', padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                    background: form.runsOnBuild === o.v ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: `1px solid ${form.runsOnBuild === o.v ? 'rgba(59,130,246,0.4)' : S.border}`,
                    color: form.runsOnBuild === o.v ? '#93c5fd' : S.muted,
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{o.icon} {o.t}</div>
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 3 }}>{o.d}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={createAgent} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
              {busy ? tr('creating') : tr('admCreateActivate')}
            </button>
            {msg && <span style={{ fontSize: 12, color: msg.startsWith('❌') ? S.red : S.green }}>{msg}</span>}
          </div>
        </div>
      </div>

      {/* تجربة وكيل مباشرة */}
      {status?.registeredAgents?.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{tr('admTestAgent')}</div>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={testInput} placeholder={tr('admTestPlaceholder')}
            onChange={e => setTestInput(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {status.registeredAgents.map(a => (
              <button key={a} onClick={() => runAgent(a)} disabled={testing}
                style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 7, padding: '6px 14px', color: '#c4b5fd', fontSize: 12, fontWeight: 700 }}>
                ▶ {a}
              </button>
            ))}
          </div>
          {testing && <Muted>{tr('admRunning')}</Muted>}
          {testResult && (
            <pre style={{ marginTop: 12, background: '#0a0f1e', border: `1px solid ${S.border}`, borderRadius: 8, padding: 14, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#a7f3d0', maxHeight: 300, overflow: 'auto' }}>{testResult}</pre>
          )}
        </div>
      )}

      {/* قائمة الإضافات */}
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{tr('admInstalledPlugins')} ({status?.count ?? 0})</div>
      {(!status?.plugins || status.plugins.length === 0) && <Muted>{tr('admNoPlugins')}</Muted>}
      <div style={{ display: 'grid', gap: 10 }}>
        {status?.plugins?.map(p => (
          <div key={p.name} style={{ ...cardStyle, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                <span style={{ fontSize: 10, color: S.muted, background: 'rgba(255,255,255,0.04)', padding: '1px 7px', borderRadius: 4 }}>{p.type}</span>
                <span style={{ fontSize: 10, color: S.muted }}>v{p.version}</span>
              </div>
              {p.description && <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{p.description}</div>}
            </div>
            <button onClick={() => toggle(p.name, !p.enabled)}
              style={{ background: p.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)', border: `1px solid ${p.enabled ? 'rgba(16,185,129,0.3)' : S.border}`, borderRadius: 7, padding: '5px 12px', color: p.enabled ? S.green : S.muted, fontSize: 12, fontWeight: 700 }}>
              {p.enabled ? tr('admEnabled') : tr('admDisabled')}
            </button>
            <button onClick={() => del(`${p.name}.js`)}
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '5px 10px', color: S.red, fontSize: 12 }}>🗑</button>
          </div>
        ))}
      </div>
      {status?.errors?.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 16, borderColor: 'rgba(245,158,11,0.3)' }}>
          <div style={{ color: S.amber, fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{tr('admLoadErrors')} ({status.errors.length})</div>
          {status.errors.map((e, i) => <div key={i} style={{ fontSize: 11, color: S.muted, direction: 'ltr', textAlign: 'left' }}>{e.error}</div>)}
        </div>
      )}
    </div>
  );
}

// ── 🗂️ إدارة الملفات ──────────────────────────────────────────
function FilesTab({ api }) {
  const tr = useI18n(s => s.t);
  const [tree, setTree] = useState([]);
  const [sel, setSel] = useState(null); // { user, project }
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/api/admin/files/tree').then(d => setTree(d.tree)).catch(() => {}); }, [api]);

  const openProject = async (user, project) => {
    setSel({ user, project }); setActiveFile(null); setContent('');
    try { const d = await api(`/api/admin/files/list?user=${encodeURIComponent(user)}&project=${encodeURIComponent(project)}`); setFiles(d.files); }
    catch (e) { setMsg(e.message); }
  };
  const openFile = async (f) => {
    try {
      const d = await api(`/api/admin/files/read?user=${encodeURIComponent(sel.user)}&project=${encodeURIComponent(sel.project)}&path=${encodeURIComponent(f)}`);
      setActiveFile(f); setContent(d.content); setDirty(false);
    } catch (e) { setMsg(e.message); }
  };
  const save = async () => {
    try {
      await api('/api/admin/files/write', { method: 'POST', body: JSON.stringify({ user: sel.user, project: sel.project, path: activeFile, content }) });
      setDirty(false); setMsg(tr('admSaved'));
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg('❌ ' + e.message); }
  };
  const del = async (f) => {
    if (!window.confirm(`${tr('admConfirmDeleteFile')} "${f}"`)) return;
    try {
      await api('/api/admin/files', { method: 'DELETE', body: JSON.stringify({ user: sel.user, project: sel.project, path: f }) });
      setFiles(fs => fs.filter(x => x !== f));
      if (activeFile === f) { setActiveFile(null); setContent(''); }
    } catch (e) { setMsg('❌ ' + e.message); }
  };

  return (
    <div>
      <Header title={tr('admFilesTitle')} action={msg && <span style={{ fontSize: 12, color: msg.startsWith('❌') ? S.red : S.green }}>{msg}</span>} />
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, height: 'calc(100dvh - 170px)' }}>
        {/* الأعمدة: المشاريع + الملفات */}
        <div style={{ ...cardStyle, padding: 10, overflow: 'auto' }}>
          {!sel && tree.map(u => (
            <div key={u.user} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, marginBottom: 4 }}>👤 {u.user}</div>
              {u.projects.map(p => (
                <button key={p} onClick={() => openProject(u.user, p)}
                  style={{ width: '100%', textAlign: 'start', background: 'transparent', border: 'none', color: '#93c5fd', fontSize: 13, padding: '5px 8px', borderRadius: 6 }}>📁 {p}</button>
              ))}
            </div>
          ))}
          {tree.length === 0 && !sel && <Muted>{tr('admNoProjects')}</Muted>}
          {sel && (
            <div>
              <button onClick={() => { setSel(null); setFiles([]); setActiveFile(null); }} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 12, marginBottom: 8 }}>{tr('admBackProjects')}</button>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>{sel.user} / {sel.project}</div>
              {files.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => openFile(f)}
                    style={{ flex: 1, textAlign: 'left', background: activeFile === f ? 'rgba(59,130,246,0.1)' : 'transparent', border: 'none', color: activeFile === f ? '#93c5fd' : S.text, fontSize: 12, padding: '5px 8px', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>{f}</button>
                  <button onClick={() => del(f)} style={{ background: 'transparent', border: 'none', color: S.red, fontSize: 12 }}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* محرر الملف */}
        <div style={{ ...cardStyle, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeFile ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${S.border}`, gap: 10 }}>
                <span style={{ fontSize: 12, color: S.muted, direction: 'ltr', flex: 1 }}>{activeFile}{dirty ? ' •' : ''}</span>
                <button onClick={save} disabled={!dirty} style={{ ...btnPrimary, padding: '6px 14px', opacity: dirty ? 1 : 0.5 }}>{tr('admSave')}</button>
              </div>
              <textarea value={content} onChange={e => { setContent(e.target.value); setDirty(true); }} spellCheck={false}
                style={{ flex: 1, background: '#0a0f1e', border: 'none', padding: 16, color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, resize: 'none', lineHeight: 1.6, direction: 'ltr' }} />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.muted, fontSize: 13 }}>{tr('admPickFile')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── عناصر مشتركة ──────────────────────────────────────────────
function Header({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
      <h2 style={{ fontSize: 19, fontWeight: 800 }}>{title}</h2>
      <div style={{ flex: 1 }} />
      {action}
    </div>
  );
}
function Muted({ children }) {
  return <div style={{ color: S.muted, fontSize: 13, padding: 12 }}>{children}</div>;
}
