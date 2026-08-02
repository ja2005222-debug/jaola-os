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
      {tab === 'errors' && <ErrorsTab api={api} />}
      {tab === 'users' && <UsersTab api={api} />}
      {tab === 'audit' && <AuditTab api={api} />}
      {tab === 'agents' && <AgentsTab api={api} />}
      {tab === 'tradingbot' && <TradingBotTab api={api} />}
      {tab === 'files' && <FilesTab api={api} />}
      {tab === 'github' && <GitHubTab api={api} />}
      {tab === 'team' && <BackendTeamTab api={api} />}
    </Shell>
  );
}

// ── الهيكل العام ──────────────────────────────────────────────
function Shell({ children, onExit, tab, setTab }) {
  const tr = useI18n(s => s.t);
  const dir = useI18n(s => s.dir);
  const tabs = [
    { id: 'health', icon: '🩺', label: tr('admTabHealth') },
    { id: 'errors', icon: '🚨', label: tr('admTabErrors') },
    { id: 'users', icon: '👤', label: tr('admTabUsers') },
    { id: 'audit', icon: '🧾', label: tr('admTabAudit') },
    { id: 'agents', icon: '🤖', label: tr('admTabAgents') },
    { id: 'tradingbot', icon: '🤖💱', label: tr('admTabTradingBot') },
    { id: 'files', icon: '🗂️', label: tr('admTabFiles') },
    { id: 'github', icon: '🐙', label: tr('admTabGithub') },
    { id: 'team', icon: '👥', label: tr('admTabTeam') },
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

  // 🔌 فحص حيّ لمزوّدي الذكاء (مفاتيح مقنّعة + رصيد DeepSeek)
  const [providers, setProviders] = useState(null);
  const [provBusy, setProvBusy] = useState(false);
  const checkProviders = async () => {
    setProvBusy(true);
    try { const d = await api('/api/admin/ai-providers'); setProviders(d.providers); }
    catch (e) { setProviders({ _error: e.message }); }
    setProvBusy(false);
  };

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

      {/* 🔌 مزوّدو الذكاء — فحص حيّ يحسم «المفتاح موجود لكن لا يعمل» */}
      <div style={{ marginTop: 20 }}>
        <Header title={tr('admAiProviders')}
          action={<button onClick={checkProviders} disabled={provBusy} style={{ ...btnPrimary, opacity: provBusy ? 0.6 : 1 }}>{provBusy ? '⏳' : tr('admAiCheck')}</button>} />
        {providers?._error && <Muted>{providers._error}</Muted>}
        {providers && !providers._error && (
          <div style={{ display: 'grid', gap: 10 }}>
            {[['groq', 'Groq'], ['deepseek', 'DeepSeek'], ['gemini', 'Gemini'], ['openai', 'OpenAI']].map(([id, name]) => {
              const p = providers[id] || {};
              const icon = !p.configured ? '⚪' : p.ok ? '✅' : '❌';
              const color = !p.configured ? S.muted : p.ok ? '#10b981' : '#ef4444';
              return (
                <div key={id} style={{ ...cardStyle, padding: 14, borderRight: `3px solid ${color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{name}</span>
                    {p.keyTail && <code style={{ fontSize: 11, color: S.muted, direction: 'ltr' }}>{p.keyTail}</code>}
                  </div>
                  <div style={{ fontSize: 13, color: S.text, marginTop: 5 }}>
                    {!p.configured ? tr('admAiNotSet') : p.detail}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 🚨 أعطال الإنتاج الحقيقية ──────────────────────────────────
function ErrorsTab({ api }) {
  const tr = useI18n(s => s.t);
  const [errors, setErrors] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const d = await api('/api/admin/errors'); setErrors(d.errors); }
    catch (e) { if (e.message !== 'forbidden') setErr(e.message); }
    setLoading(false);
  }, [api]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Muted>{tr('admScanning')}</Muted>;
  if (err) return <Muted>{err}</Muted>;

  return (
    <div>
      <Header title={tr('admErrorsTitle')} action={<button onClick={load} style={btnPrimary}>{tr('admRefresh')}</button>} />
      {!errors?.length ? <Muted>{tr('admNoErrors')}</Muted> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {errors.map((e, i) => (
            <div key={i} style={{ ...cardStyle, padding: 14, borderRight: `3px solid ${S.red}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: S.muted, fontWeight: 700 }}>{new Date(e.at).toLocaleString()}</span>
                <span style={{ fontSize: 11, color: S.blue, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '2px 8px', borderRadius: 5, fontWeight: 700 }}>{e.source}</span>
                {e.path && <code style={{ fontSize: 11, color: S.muted, direction: 'ltr' }}>{e.method} {e.path}</code>}
              </div>
              <div style={{ fontSize: 14, color: S.text, marginTop: 6, fontWeight: 700 }}>{e.message}</div>
              {e.stack && (
                <pre style={{ fontSize: 11, color: S.muted, marginTop: 6, whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', maxHeight: 140, overflow: 'auto' }}>{e.stack}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 👤 المستخدمون ──────────────────────────────────────────────
const PLAN_IDS = ['free', 'pro', 'enterprise'];
function UsersTab({ api }) {
  const tr = useI18n(s => s.t);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyUser, setBusyUser] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async (q) => {
    setLoading(true); setErr('');
    try { const d = await api(`/api/admin/users?search=${encodeURIComponent(q ?? search)}`); setData(d); }
    catch (e) { if (e.message !== 'forbidden') setErr(e.message); }
    setLoading(false);
  }, [api, search]);
  useEffect(() => { load(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changePlan = async (username, plan) => {
    setBusyUser(username); setMsg('');
    try {
      await api(`/api/admin/users/${encodeURIComponent(username)}/plan`, { method: 'POST', body: JSON.stringify({ plan }) });
      setMsg(`✅ ${username} → ${plan}`);
      load(search);
    } catch (e) { setMsg('❌ ' + e.message); }
    setBusyUser(null);
  };

  if (loading) return <Muted>{tr('admScanning')}</Muted>;
  if (err) return <Muted>{err}</Muted>;
  if (data?.offline) return <div><Header title={tr('admUsersTitle')} /><Muted>{tr('admDbOffline')}</Muted></div>;

  return (
    <div>
      <Header title={`${tr('admUsersTitle')} (${data?.total ?? 0})`}
        action={msg && <span style={{ fontSize: 12, color: msg.startsWith('❌') ? S.red : S.green }}>{msg}</span>} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(search)}
          placeholder={tr('admUsersSearchPh')} style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
        <button onClick={() => load(search)} style={btnPrimary}>{tr('admUsersSearch')}</button>
      </div>
      {!data?.users?.length ? <Muted>{tr('admUsersEmpty')}</Muted> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {data.users.map(u => (
            <div key={u.username} style={{ ...cardStyle, padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{u.username}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{u.email || '—'}</div>
              </div>
              <span style={{ fontSize: 11, color: S.muted }}>{tr('admUsersProjects')}: <b style={{ color: S.text }}>{u.projectCount}</b></span>
              <span style={{ fontSize: 11, color: S.muted, direction: 'ltr' }}>{new Date(u.createdAt).toLocaleDateString()}</span>
              {u.provider && u.provider !== 'local' && (
                <span style={{ fontSize: 10, color: S.blue, background: 'rgba(59,130,246,0.1)', padding: '2px 7px', borderRadius: 5 }}>{u.provider}</span>
              )}
              <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <select value={u.plan} disabled={busyUser === u.username}
                  onChange={e => changePlan(u.username, e.target.value)}
                  style={{ ...inputStyle, marginTop: 0, width: 130, padding: '6px 8px' }}>
                  {PLAN_IDS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span style={{ fontSize: 10, color: u.status === 'active' ? S.green : S.muted }}>{u.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 🧾 سجلّ تدقيق الأدمِن ──────────────────────────────────────
function AuditTab({ api }) {
  const tr = useI18n(s => s.t);
  const [actions, setActions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { const d = await api('/api/admin/audit'); setActions(d.actions); }
    catch (e) { if (e.message !== 'forbidden') setErr(e.message); }
    setLoading(false);
  }, [api]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Muted>{tr('admScanning')}</Muted>;
  if (err) return <Muted>{err}</Muted>;

  return (
    <div>
      <Header title={tr('admAuditTitle')} action={<button onClick={load} style={btnPrimary}>{tr('admRefresh')}</button>} />
      <p style={{ color: S.muted, fontSize: 12, marginBottom: 14 }}>{tr('admAuditSubtitle')}</p>
      {!actions?.length ? <Muted>{tr('admAuditEmpty')}</Muted> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {actions.map((a, i) => (
            <div key={i} style={{ ...cardStyle, padding: 12, borderRight: `3px solid ${S.purple}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: S.muted, direction: 'ltr' }}>{new Date(a.at).toLocaleString()}</span>
                <span style={{ fontSize: 11, color: S.purple, background: 'rgba(139,92,246,0.1)', padding: '2px 8px', borderRadius: 5, fontWeight: 700 }}>{a.admin}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{a.action}</span>
              </div>
              <div style={{ fontSize: 12, color: S.text, marginTop: 5, direction: 'ltr', textAlign: 'left', wordBreak: 'break-all' }}>{a.target}</div>
              {a.details && <div style={{ fontSize: 11, color: S.muted, marginTop: 3 }}>{a.details}</div>}
            </div>
          ))}
        </div>
      )}
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

// ── 🤖💱 بوت PancakeSwap الشخصي — محصور بالمشرف حصراً، منفصل تماماً عن ─
// قالب مستشار الكريبتو العام (عرض/تحليل فقط، لا تنفيذ آلياً أبداً هناك).
function TradingBotTab({ api }) {
  const tr = useI18n(s => s.t);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(null);
  const [trades, setTrades] = useState([]);
  const [tokens, setTokens] = useState(null);
  const [tokenForm, setTokenForm] = useState({ coinId: '', symbol: '', address: '', decimals: '18' });
  const [tokenMsg, setTokenMsg] = useState('');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, t, tk] = await Promise.all([
        api('/api/admin/tradingbot/status'), api('/api/admin/tradingbot/trades?limit=30'), api('/api/admin/tradingbot/tokens'),
      ]);
      setStatus(s);
      setForm(f => f || { ...s.config, coinIdsText: (s.config.coinIds || []).join(',') });
      setTrades(t.trades || []);
      setTokens(tk.tokens || {});
    } catch (e) { if (e.message !== 'forbidden') setMsg('❌ ' + e.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const addToken = async () => {
    setTokenBusy(true); setTokenMsg('');
    try {
      const d = await api('/api/admin/tradingbot/tokens', {
        method: 'POST',
        body: JSON.stringify({ ...tokenForm, decimals: Number(tokenForm.decimals) }),
      });
      setTokens(d.tokens);
      setTokenForm({ coinId: '', symbol: '', address: '', decimals: '18' });
      setTokenMsg(`✅ ${tr('tbTokenAdded')}`);
    } catch (e) { setTokenMsg('❌ ' + e.message); }
    setTokenBusy(false);
  };

  const lookupToken = async () => {
    setTokenBusy(true); setTokenMsg('');
    try {
      const d = await api(`/api/admin/tradingbot/tokens/lookup?address=${encodeURIComponent(tokenForm.address)}`);
      setTokenForm(f => ({ ...f, coinId: d.coinId, symbol: d.symbol, decimals: String(d.decimals) }));
      setTokenMsg(`✅ ${d.name} — ${tr('tbTokenLookupReview')}`);
    } catch (e) { setTokenMsg('❌ ' + e.message); }
    setTokenBusy(false);
  };

  const removeTokenEntry = async (coinId) => {
    setTokenBusy(true); setTokenMsg('');
    try {
      const d = await api('/api/admin/tradingbot/tokens', { method: 'DELETE', body: JSON.stringify({ coinId }) });
      setTokens(d.tokens);
    } catch (e) { setTokenMsg('❌ ' + e.message); }
    setTokenBusy(false);
  };

  const saveConfig = async () => {
    setBusy(true); setMsg('');
    try {
      const patch = {
        ...form,
        coinIds: (form.coinIdsText || '').split(',').map(s => s.trim()).filter(Boolean),
      };
      delete patch.coinIdsText;
      const d = await api('/api/admin/tradingbot/config', { method: 'PUT', body: JSON.stringify(patch) });
      setMsg(`✅ ${tr('tbConfigSaved')}`);
      setStatus(s => ({ ...s, config: d.config, readyToEnable: d.readyToEnable }));
    } catch (e) { setMsg('❌ ' + e.message); }
    setBusy(false);
  };

  const toggleEnabled = async (enabled) => {
    setBusy(true); setMsg('');
    try {
      const d = await api('/api/admin/tradingbot/enable', { method: 'POST', body: JSON.stringify({ enabled }) });
      setStatus(s => ({ ...s, config: d.config }));
      setForm(f => ({ ...f, enabled: d.config.enabled }));
      setMsg(enabled ? `✅ ${tr('tbEnabled')}` : `⏹️ ${tr('tbDisabled')}`);
    } catch (e) { setMsg('❌ ' + e.message); }
    setBusy(false);
  };

  const rearm = async () => {
    setBusy(true); setMsg('');
    try {
      const d = await api('/api/admin/tradingbot/circuit-breaker/rearm', { method: 'POST' });
      setStatus(s => ({ ...s, config: d.config, circuitBreaker: d.circuitBreaker }));
      setMsg(`✅ ${tr('tbRearmed')}`);
    } catch (e) { setMsg('❌ ' + e.message); }
    setBusy(false);
  };

  const runOnce = async () => {
    setBusy(true); setMsg('');
    try {
      const d = await api('/api/admin/tradingbot/run-once', { method: 'POST' });
      setMsg(`📋 ${JSON.stringify(d.result)}`);
      load();
    } catch (e) { setMsg('❌ ' + e.message); }
    setBusy(false);
  };

  if (!status || !form) return <Muted>{tr('admLoading')}</Muted>;
  const cb = status.circuitBreaker;
  const openPositions = Object.keys(status.positions || {});

  return (
    <div>
      <Header title={tr('admTabTradingBot')} />

      <div style={{ ...cardStyle, marginBottom: 20, border: `1px solid ${status.config.enabled ? 'rgba(16,185,129,0.35)' : S.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: status.config.enabled ? S.green : S.muted }}>
            {status.config.enabled ? `● ${tr('tbRunning')}` : `○ ${tr('tbStopped')}`}
          </span>
          {cb?.tripped && <span style={{ fontSize: 11, fontWeight: 700, color: S.red, background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 6 }}>🛑 {tr('tbCircuitBreakerTripped')}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, fontSize: 12, color: S.muted, marginBottom: 12 }}>
          <div>{tr('tbDailyPnl')}: <b style={{ color: (cb?.dailyPnlBnb || 0) < 0 ? S.red : S.green }}>{(cb?.dailyPnlBnb || 0).toFixed(5)} BNB</b></div>
          <div>{tr('tbLossLimit')}: <b>{cb?.limitBnb} BNB</b></div>
          <div>{tr('tbOpenPositions')}: <b>{openPositions.length} / {status.config.maxOpenPositions}</b></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!status.config.enabled
            ? <button disabled={busy || !status.readyToEnable} onClick={() => toggleEnabled(true)} style={{ ...btnPrimary, opacity: (busy || !status.readyToEnable) ? 0.5 : 1 }}>▶ {tr('tbEnable')}</button>
            : <button disabled={busy} onClick={() => toggleEnabled(false)} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 18px', color: S.red, fontWeight: 700, fontSize: 13 }}>⏹ {tr('tbDisable')}</button>}
          {cb?.tripped && <button disabled={busy} onClick={rearm} style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '9px 18px', color: S.amber, fontWeight: 700, fontSize: 13 }}>🔄 {tr('tbRearm')}</button>}
          <button disabled={busy} onClick={runOnce} style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, padding: '9px 18px', color: S.text, fontWeight: 700, fontSize: 13 }}>🧪 {tr('tbRunOnce')}</button>
        </div>
        {!status.readyToEnable && !status.config.enabled && <p style={{ color: S.amber, fontSize: 11.5, marginTop: 10 }}>⚠️ {tr('tbNotReady')}</p>}
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('❌') ? S.red : S.muted, marginTop: 10, wordBreak: 'break-word' }}>{msg}</p>}
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{tr('tbConfigTitle')}</div>
        <p style={{ color: S.red, fontSize: 12, marginBottom: 14, lineHeight: 1.7 }}>⚠️ {tr('tbAddressWarning')}</p>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <span style={label}>{tr('tbCoinIds')}</span>
            <input style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} placeholder="bitcoin,ethereum"
              value={form.coinIdsText} onChange={e => setForm(f => ({ ...f, coinIdsText: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <span style={label}>{tr('tbPositionSize')}</span>
              <input style={inputStyle} type="text" value={form.positionSizeBnb} onChange={e => setForm(f => ({ ...f, positionSizeBnb: e.target.value }))} />
            </div>
            <div>
              <span style={label}>{tr('tbDailyLossLimit')}</span>
              <input style={inputStyle} type="text" value={form.dailyLossLimitBnb} onChange={e => setForm(f => ({ ...f, dailyLossLimitBnb: e.target.value }))} />
            </div>
            <div>
              <span style={label}>{tr('tbMinGasReserve')}</span>
              <input style={inputStyle} type="text" value={form.minGasReserveBnb} onChange={e => setForm(f => ({ ...f, minGasReserveBnb: e.target.value }))} />
            </div>
            <div>
              <span style={label}>{tr('tbMaxOpenPositions')}</span>
              <input style={inputStyle} type="number" min="1" value={form.maxOpenPositions} onChange={e => setForm(f => ({ ...f, maxOpenPositions: Number(e.target.value) }))} />
            </div>
            <div>
              <span style={label}>{tr('tbCooldown')}</span>
              <input style={inputStyle} type="number" min="0" value={form.cooldownMinutesPerCoin} onChange={e => setForm(f => ({ ...f, cooldownMinutesPerCoin: Number(e.target.value) }))} />
            </div>
            <div>
              <span style={label}>{tr('tbConfirmations')}</span>
              <input style={inputStyle} type="number" min="1" value={form.confirmationsRequired} onChange={e => setForm(f => ({ ...f, confirmationsRequired: Number(e.target.value) }))} />
            </div>
          </div>
          <p style={{ color: S.muted, fontSize: 11.5, marginTop: 4 }}>{tr('tbSecretHint')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <span style={label}>{tr('tbSecretUsername')}</span>
              <input style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} value={form.secretUsername} onChange={e => setForm(f => ({ ...f, secretUsername: e.target.value }))} />
            </div>
            <div>
              <span style={label}>{tr('tbSecretProject')}</span>
              <input style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} value={form.secretProject} onChange={e => setForm(f => ({ ...f, secretProject: e.target.value }))} />
            </div>
            <div>
              <span style={label}>{tr('tbSecretKeyName')}</span>
              <input style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} value={form.secretKeyName} onChange={e => setForm(f => ({ ...f, secretKeyName: e.target.value }))} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: S.text, marginTop: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.addressesVerified} onChange={e => setForm(f => ({ ...f, addressesVerified: e.target.checked }))} />
            {tr('tbAddressVerifiedConfirm')}
          </label>
          <div>
            <button disabled={busy} onClick={saveConfig} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>{busy ? tr('admSaving') : tr('save')}</button>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{tr('tbTokensTitle')}</div>
        <p style={{ color: S.muted, fontSize: 12, marginBottom: 14, lineHeight: 1.7 }}>{tr('tbTokensHint')}</p>
        <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
          {Object.keys(tokens || {}).length === 0 && <Muted>{tr('tbTokensEmpty')}</Muted>}
          {Object.entries(tokens || {}).map(([coinId, t]) => (
            <div key={coinId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 12.5 }}>
              <div style={{ minWidth: 0 }}>
                <b>{t.symbol}</b> <span style={{ color: S.muted }}>({coinId})</span>
                <div style={{ color: S.muted, fontSize: 11, direction: 'ltr', textAlign: 'left', wordBreak: 'break-all' }}>{t.address} · decimals {t.decimals}</div>
              </div>
              <button disabled={tokenBusy} onClick={() => removeTokenEntry(coinId)} style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 6, padding: '5px 10px', color: S.red, fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{tr('tbTokenRemove')}</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 10 }}>
          <div>
            <span style={label}>{tr('tbTokenAddress')}</span>
            <input style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} placeholder="0x..."
              value={tokenForm.address} onChange={e => setTokenForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <button disabled={tokenBusy || !tokenForm.address} onClick={lookupToken} style={{ background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 8, padding: '9px 16px', color: S.text, fontWeight: 700, fontSize: 13, opacity: (tokenBusy || !tokenForm.address) ? 0.5 : 1, whiteSpace: 'nowrap' }}>🔎 {tr('tbTokenLookup')}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div>
            <span style={label}>{tr('tbTokenCoinId')}</span>
            <input style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} placeholder="pancakeswap-token"
              value={tokenForm.coinId} onChange={e => setTokenForm(f => ({ ...f, coinId: e.target.value }))} />
          </div>
          <div>
            <span style={label}>{tr('tbTokenSymbol')}</span>
            <input style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} placeholder="CAKE"
              value={tokenForm.symbol} onChange={e => setTokenForm(f => ({ ...f, symbol: e.target.value }))} />
          </div>
          <div>
            <span style={label}>{tr('tbTokenDecimals')}</span>
            <input style={inputStyle} type="number" min="0" max="36" value={tokenForm.decimals} onChange={e => setTokenForm(f => ({ ...f, decimals: e.target.value }))} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button disabled={tokenBusy} onClick={addToken} style={{ ...btnPrimary, opacity: tokenBusy ? 0.6 : 1 }}>{tokenBusy ? tr('admSaving') : tr('tbTokenAdd')}</button>
        </div>
        {tokenMsg && <p style={{ fontSize: 12, color: tokenMsg.startsWith('❌') ? S.red : S.muted, marginTop: 10, wordBreak: 'break-word' }}>{tokenMsg}</p>}
      </div>

      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{tr('tbTradeHistory')} ({trades.length})</div>
      {!trades.length && <Muted>{tr('tbNoTrades')}</Muted>}
      <div style={{ display: 'grid', gap: 8 }}>
        {trades.map(t => (
          <div key={t.id} style={{ ...cardStyle, padding: 12, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontWeight: 700 }}>{t.coinId || '—'} {t.kind === 'trade' ? `· ${t.side}` : ''}</span>
              <span style={{ color: S.muted }}>{new Date(t.at).toLocaleString()}</span>
            </div>
            <div style={{ color: S.muted, marginTop: 4 }}>
              {t.kind === 'consideration'
                ? `${t.decision}${t.skipReason ? ` (${t.skipReason})` : ''}`
                : `${t.status}${t.realizedPnlBnb != null ? ` · PnL: ${Number(t.realizedPnlBnb).toFixed(5)} BNB` : ''}${t.error ? ` · ${t.error}` : ''}`}
            </div>
          </div>
        ))}
      </div>
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

// ── 🐙 ملفات GitHub ───────────────────────────────────────────
function GitHubTab({ api }) {
  const tr = useI18n(s => s.t);
  const [status, setStatus] = useState(null); // { linked, githubLogin }
  const [repos, setRepos] = useState(null);
  const [repo, setRepo] = useState(null); // { fullName, defaultBranch }
  const [pathStack, setPathStack] = useState([]); // مسار المجلد الحالي
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null); // { path, sha }
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const curPath = pathStack.join('/');

  useEffect(() => { api('/api/admin/github/status').then(setStatus).catch(() => setStatus({ linked: false })); }, [api]);
  useEffect(() => {
    if (status?.linked && repos === null) {
      api('/api/admin/github/repos').then(d => setRepos(d.repos || [])).catch(e => { setMsg(e.message); setRepos([]); });
    }
  }, [status, repos, api]);

  const openRepo = async (r) => {
    setRepo(r); setPathStack([]); setFile(null); setContent(''); setMsg('');
    try { const d = await api(`/api/admin/github/contents?repo=${encodeURIComponent(r.fullName)}`); setItems(d.items || []); }
    catch (e) { setMsg(e.message); }
  };
  const openDir = async (p) => {
    const stack = p.split('/');
    setPathStack(stack); setFile(null); setContent('');
    try { const d = await api(`/api/admin/github/contents?repo=${encodeURIComponent(repo.fullName)}&path=${encodeURIComponent(p)}`); setItems(d.items || []); }
    catch (e) { setMsg(e.message); }
  };
  const goUp = () => {
    const stack = pathStack.slice(0, -1);
    openDir(stack.join('/'));
  };
  const openFile = async (p) => {
    try {
      const d = await api(`/api/admin/github/file?repo=${encodeURIComponent(repo.fullName)}&path=${encodeURIComponent(p)}`);
      setFile({ path: p, sha: d.sha }); setContent(d.content); setDirty(false); setCommitMsg('');
    } catch (e) { setMsg(e.message); }
  };
  const push = async () => {
    setBusy(true); setMsg('');
    try {
      const d = await api('/api/admin/github/file', { method: 'PUT', body: JSON.stringify({
        repo: repo.fullName, path: file.path, content,
        message: commitMsg || `Update ${file.path} via JAOLA`,
        sha: file.sha, branch: repo.defaultBranch,
      }) });
      setFile(f => ({ ...f, sha: d.sha })); setDirty(false); setMsg(tr('admGhPushed'));
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { setMsg('❌ ' + e.message); }
    setBusy(false);
  };

  if (status && !status.linked) return (
    <div>
      <Header title={tr('admGhTitle')} />
      <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🐙</div>
        <p style={{ color: S.muted, fontSize: 14, lineHeight: 1.9, marginBottom: 18 }}>{tr('admGhNotLinked')}</p>
        <a href={`${BACKEND_URL}/api/auth/github`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 18px', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 13 }}>
          🐙 {tr('continueWithGithub')}
        </a>
      </div>
    </div>
  );

  return (
    <div>
      <Header title={tr('admGhTitle')} action={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {msg && <span style={{ fontSize: 12, color: msg.startsWith('❌') ? S.red : S.green }}>{msg}</span>}
          {status?.githubLogin && <span style={{ fontSize: 12, color: S.muted }}>{tr('admGhLinkedAs')} <b style={{ color: S.blue }}>@{status.githubLogin}</b></span>}
        </span>
      } />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, height: 'calc(100dvh - 170px)' }}>
        {/* عمود المستودعات/الملفات */}
        <div style={{ ...cardStyle, padding: 10, overflow: 'auto' }}>
          {!repo && (
            <>
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, marginBottom: 8 }}>{tr('admGhRepos')}</div>
              {repos === null && <Muted>{tr('admGhLoadingRepos')}</Muted>}
              {repos?.length === 0 && <Muted>{tr('admGhNoRepos')}</Muted>}
              {repos?.map(r => (
                <button key={r.fullName} onClick={() => openRepo(r)}
                  style={{ width: '100%', textAlign: 'start', background: 'transparent', border: 'none', color: S.text, fontSize: 12.5, padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📦</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>{r.fullName}</span>
                  {r.private && <span style={{ fontSize: 9, color: S.amber }}>{tr('admGhPrivate')}</span>}
                </button>
              ))}
            </>
          )}
          {repo && (
            <>
              <button onClick={() => { setRepo(null); setItems([]); setFile(null); }} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 12, marginBottom: 6 }}>{tr('admGhBackRepos')}</button>
              <div style={{ fontSize: 11, color: S.blue, marginBottom: 6, direction: 'ltr', wordBreak: 'break-all' }}>{repo.fullName}{curPath ? `/${curPath}` : ''}</div>
              {pathStack.length > 0 && <button onClick={goUp} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 12, marginBottom: 4 }}>{tr('admGhBackDir')}</button>}
              {items.map(it => (
                <button key={it.path} onClick={() => it.type === 'dir' ? openDir(it.path) : openFile(it.path)}
                  style={{ width: '100%', textAlign: 'start', background: file?.path === it.path ? 'rgba(59,130,246,0.1)' : 'transparent', border: 'none', color: file?.path === it.path ? '#93c5fd' : S.text, fontSize: 12.5, padding: '5px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{it.type === 'dir' ? '📁' : '📄'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>{it.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
        {/* محرر الملف */}
        <div style={{ ...cardStyle, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {file ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${S.border}`, gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: S.muted, direction: 'ltr', flex: 1, minWidth: 120 }}>{file.path}{dirty ? ' •' : ''}</span>
                <input value={commitMsg} onChange={e => setCommitMsg(e.target.value)} placeholder={tr('admGhCommitMsg')}
                  style={{ ...inputStyle, width: 200, marginTop: 0, padding: '6px 10px', fontSize: 12 }} />
                <button onClick={push} disabled={!dirty || busy} style={{ ...btnPrimary, padding: '6px 14px', opacity: (!dirty || busy) ? 0.5 : 1 }}>
                  {busy ? tr('admGhPushing') : tr('admGhCommitPush')}
                </button>
              </div>
              <textarea value={content} onChange={e => { setContent(e.target.value); setDirty(true); }} spellCheck={false}
                style={{ flex: 1, background: '#0a0f1e', border: 'none', padding: 16, color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, resize: 'none', lineHeight: 1.6, direction: 'ltr' }} />
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.muted, fontSize: 13 }}>{tr('admGhPickFile')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 👥 فريق وكلاء الخلفية ──────────────────────────────────────
function BackendTeamTab({ api }) {
  const tr = useI18n(s => s.t);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [active, setActive] = useState('backend');
  useEffect(() => { api('/api/admin/backend-team').then(setData).catch(e => setErr(e.message)); }, [api]);

  if (err) return <div><Header title={tr('admTeamTitle')} /><Muted>{err}</Muted></div>;
  if (!data) return <div><Header title={tr('admTeamTitle')} /><Muted>{tr('admTeamLoading')}</Muted></div>;

  // توافق: إن لم يرجع الخادم teams، ابنِ واحداً من الحقول القديمة
  const teams = data.teams || [{ key: 'backend', label: 'Backend', plan: data.plan, agents: data.agents }];
  const team = teams.find(t => t.key === active) || teams[0];

  const Section = ({ label, items }) => (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: S.muted, fontWeight: 700, letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <ul style={{ margin: 0, paddingInlineStart: 18, color: S.text, fontSize: 12, lineHeight: 1.7 }}>
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );

  return (
    <div>
      <Header title={tr('admTeamTitle')} />
      <p style={{ color: S.muted, fontSize: 13, lineHeight: 1.8, marginBottom: 12 }}>{tr('admTeamIntro')}</p>
      {/* مبدّل الفرق */}
      {teams.length > 1 && (
        <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 3, marginBottom: 14 }}>
          {teams.map(t => (
            <button key={t.key} onClick={() => setActive(t.key)}
              style={{ padding: '7px 16px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: active === t.key ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'transparent',
                color: active === t.key ? '#fff' : S.muted }}>
              {t.key === 'frontend' ? '🎨' : '🏛️'} {t.label} ({t.agents.length})
            </button>
          ))}
        </div>
      )}
      {/* ترتيب التنفيذ */}
      <div style={{ ...cardStyle, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: S.muted, fontWeight: 700, marginBottom: 8 }}>{tr('admTeamOrder')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {team.plan.map((p, i) => (
            <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 7, padding: '4px 10px', fontSize: 12, color: '#93c5fd', fontWeight: 700 }}>{p.icon} {p.role}</span>
              {i < team.plan.length - 1 && <span style={{ color: S.muted }}>→</span>}
            </span>
          ))}
        </div>
      </div>
      {/* بطاقات الوكلاء */}
      <div style={{ display: 'grid', gap: 12 }}>
        {team.agents.map(a => (
          <div key={a.id} style={{ ...cardStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{a.role}</span>
              {a.dependsOn?.length > 0 && (
                <span style={{ fontSize: 10, color: S.muted, marginInlineStart: 'auto' }}>{tr('admTeamDependsOn')}: {a.dependsOn.join(', ')}</span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: S.text, lineHeight: 1.7 }}>{a.mission}</div>
            <Section label={tr('admTeamResponsibilities')} items={a.responsibilities} />
            <Section label={tr('admTeamOutputs')} items={a.outputs} />
            <Section label={tr('admTeamCooperation')} items={a.cooperation.map(c => `${c.with} — ${c.how}`)} />
            <Section label={tr('admTeamNeverDo')} items={a.neverDo} />
          </div>
        ))}
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
