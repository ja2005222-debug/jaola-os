import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket, socket } from '../hooks/useSocket.js';
import { PreviewFrame } from '../components/PreviewFrame.jsx';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

const QUICK_BUILDS = [
  { icon: '⚡', label: 'SaaS', prompt: 'ابني منصة SaaS متكاملة مع اشتراكات' },
  { icon: '✈️', label: 'Travel', prompt: 'ابني منصة سفر فاخرة مع حجز' },
  { icon: '🍽️', label: 'Restaurant', prompt: 'ابني موقع مطعم فاخر مع حجز طاولات' },
  { icon: '🎬', label: 'Cinema', prompt: 'ابني منصة سينما مع حجز تذاكر' },
  { icon: '📊', label: 'Dashboard', prompt: 'ابني لوحة تحكم تحليلية احترافية' },
  { icon: '📱', label: 'Mobile App', prompt: 'ابني تطبيق جوال عصري' },
  { icon: '💼', label: 'CRM', prompt: 'ابني نظام إدارة علاقات عملاء' },
  { icon: '🏢', label: 'ERP', prompt: 'ابني نظام تخطيط موارد مؤسسة' },
];

const BOOT_STEPS = [
  'Initializing JAOLA OS...',
  'Connecting AI Company...',
  'Loading Knowledge Base...',
  'Hiring AI Agents...',
  'Synchronizing Mission Control...',
  'Activating Digital Twin...',
  'Mission Control Ready ✓',
];

const SIDEBAR_ITEMS = [
  { icon: '⚡', label: 'Mission Control', id: 'mission' },
  { icon: '📁', label: 'Projects', id: 'projects' },
  { icon: '🤖', label: 'AI Company', id: 'agents' },
  { icon: '📚', label: 'Knowledge', id: 'knowledge' },
  { icon: '🛒', label: 'Marketplace', id: 'marketplace' },
  { icon: '🚀', label: 'Deployments', id: 'deployments' },
  { icon: '📈', label: 'Analytics', id: 'analytics' },
  { icon: '🎬', label: 'Cinema Studio', id: 'cinema' },
  { icon: '⚙️', label: 'Settings', id: 'settings' },
];

// ── Boot Screen ──────────────────────────────────────────────────
function BootScreen({ onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step < BOOT_STEPS.length) {
      const t = setTimeout(() => setStep(s => s + 1), step === BOOT_STEPS.length - 1 ? 600 : 500);
      return () => clearTimeout(t);
    } else {
      setTimeout(onDone, 300);
    }
  }, [step, onDone]);

  return (
    <div style={{ position:'fixed', inset:0, background:'#030508', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:9999, gap:40 }}>
      <style>{`@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(59,130,246,0.3)}50%{box-shadow:0 0 60px rgba(59,130,246,0.7)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Logo */}
      <div style={{ textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 20px', animation:'glow 2s infinite' }}>⚡</div>
        <div style={{ fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-1px', fontFamily:'system-ui' }}>JAOLA OS</div>
        <div style={{ fontSize:12, color:'#475569', marginTop:6, letterSpacing:'2px', textTransform:'uppercase' }}>Autonomous Software Engineering</div>
      </div>

      {/* Boot Messages */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, width:320 }}>
        {BOOT_STEPS.slice(0, step).map((msg, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, animation:'fadeIn 0.3s ease', opacity: i < step - 1 ? 0.4 : 1, transition:'opacity 0.3s' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background: i < step - 1 ? '#10b981' : '#3b82f6', boxShadow: i === step - 1 ? '0 0 10px #3b82f6' : 'none', flexShrink:0 }} />
            <span style={{ fontSize:13, color: i < step - 1 ? '#475569' : '#94a3b8', fontFamily:'monospace' }}>{msg}</span>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={{ width:240, height:2, background:'#1e293b', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${(step/BOOT_STEPS.length)*100}%`, background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:2, transition:'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Execution Feed Item ─────────────────────────────────────────
function FeedItem({ msg, type }) {
  const icons = { user:'👤', assistant:'⚡', system:'🔧' };
  const colors = { user:'#1d4ed8', assistant:'#0f172a', system:'#1a1a2e' };
  const borders = { user:'rgba(29,78,216,0.3)', assistant:'rgba(59,130,246,0.15)', system:'rgba(100,116,139,0.15)' };

  const isStatus = msg.text && (msg.text.includes('✅') || msg.text.includes('❌') || msg.text.includes('🎯') || msg.text.includes('🚀') || msg.text.includes('⚙️') || msg.text.includes('🔍'));

  if (msg.sender === 'user') {
    return (
      <div style={{ display:'flex', justifyContent:'flex-end', animation:'fadeIn 0.2s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#1d4ed8,#4f46e5)', borderRadius:'12px 12px 2px 12px', padding:'10px 16px', maxWidth:'80%', fontSize:13, color:'#fff', lineHeight:1.6 }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', fontWeight:700, marginBottom:4, letterSpacing:'0.5px' }}>YOU — CEO</div>
          {msg.text}
        </div>
      </div>
    );
  }

  if (isStatus) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', animation:'fadeIn 0.2s ease' }}>
        <div style={{ width:1, background:'rgba(59,130,246,0.3)', alignSelf:'stretch', marginRight:4, flexShrink:0 }} />
        <div style={{ fontSize:12, color:'#64748b', fontFamily:'monospace', flex:1 }}>{msg.text}</div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', gap:10, alignItems:'flex-start', animation:'fadeIn 0.2s ease' }}>
      <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, marginTop:2 }}>⚡</div>
      <div style={{ background:'rgba(15,23,42,0.8)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:'2px 12px 12px 12px', padding:'10px 14px', maxWidth:'85%', fontSize:12, color:'#cbd5e1', lineHeight:1.7 }}>
        <div style={{ fontSize:9, color:'#3b82f6', fontWeight:700, marginBottom:4, letterSpacing:'0.5px', textTransform:'uppercase' }}>JAOLA OS</div>
        <span style={{ whiteSpace:'pre-wrap' }}>{msg.text}</span>
      </div>
    </div>
  );
}

// ── Agent Node ──────────────────────────────────────────────────
function AgentNode({ name, state, icon }) {
  const isActive = state === 'running';
  const isDone = state === 'completed';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
      <div style={{
        width:36, height:36, borderRadius:10,
        background: isDone ? 'rgba(16,185,129,0.1)' : isActive ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isDone ? 'rgba(16,185,129,0.4)' : isActive ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
        boxShadow: isActive ? '0 0 12px rgba(59,130,246,0.25)' : 'none',
        animation: isActive ? 'agentPulse 1.5s infinite' : 'none',
        transition:'all 0.3s'
      }}>
        {isDone ? '✓' : icon}
      </div>
      <span style={{ fontSize:9, color: isDone ? '#10b981' : isActive ? '#60a5fa' : '#374151', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{name}</span>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const { currentUser: authUser, token, isAuthenticated, handleAuthError, setIsAuthenticated, setCurrentUser, setToken, isLoading } = useAuth();

  const [booted, setBooted] = useState(() => sessionStorage.getItem('booted') === '1');
  const [activeNav, setActiveNav] = useState('mission');
  const [activeTab, setActiveTab] = useState('preview');
  const [prompt, setPrompt] = useState('');
  const [activeFile, setActiveFile] = useState('index.html');
  const [editorContent, setEditorContent] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const feedEndRef = useRef(null);
  const textareaRef = useRef(null);
  const notifId = useRef(0);

  const { files, logs, streamingContent, agentStates, projects, activeProject, currentUser, vercelUrl, chatMessages, setChatMessages, setActiveProject, setStreamingContent, previewTimestamp } = useSocket(isAuthenticated, handleAuthError);

  useEffect(() => { feedEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMessages]);
  useEffect(() => { if (isAuthenticated && activeFile) fetchFileContent(activeFile); }, [activeFile, activeProject, isAuthenticated]);

  // Auto-switch to logs tab during build
  useEffect(() => {
    if (logs.length > 0) {
      const last = logs[logs.length - 1];
      if (last?.message?.includes('✨ نجاح')) {
        addNotification('✅ البناء اكتمل بنجاح!', 'success');
        setActiveTab('preview');
      }
    }
  }, [logs]);

  const addNotification = (msg, type = 'info') => {
    const id = ++notifId.current;
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const getHeaders = () => ({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' });

  const fetchFileContent = async (file) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/file-content?fileName=${file}&project=${activeProject}`, { headers: getHeaders() });
      if (res.ok) { const d = await res.json(); setEditorContent(d.content || ''); }
    } catch {}
  };

  const handleSend = async () => {
    if (!prompt.trim() || isSending) return;
    setIsSending(true);
    const msg = prompt.trim();
    setPrompt('');
    setChatMessages(prev => [...prev, { sender: 'user', text: msg }]);
    try {
      await fetch(`${BACKEND_URL}/api/chat`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ message: msg, project: activeProject }) });
    } catch {}
    setTimeout(() => setIsSending(false), 1000);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    addNotification('🚀 جاري النشر على Vercel...', 'info');
    try {
      await fetch(`${BACKEND_URL}/api/deploy`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
    } catch {}
    setTimeout(() => { setIsDeploying(false); addNotification('✅ تم النشر بنجاح!', 'success'); }, 8000);
  };

  const handleSaveCode = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/file-content/save`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ fileName: activeFile, content: editorContent, project: activeProject }) });
      addNotification('💾 تم الحفظ', 'success');
    } catch {}
  };

  const handleSwitchProject = (p) => { setActiveProject(p); setEditorContent(''); };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await fetch(`${BACKEND_URL}/api/projects`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ name: newProjectName }) });
      handleSwitchProject(newProjectName);
      setShowProjectModal(false); setNewProjectName('');
    } catch {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim()) return;
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: loginUsername }) });
      if (res.ok) {
        const d = await res.json();
        setToken(d.token); setCurrentUser(d.username); setIsAuthenticated(true);
        localStorage.setItem('token', d.token); localStorage.setItem('currentUser', d.username);
      }
    } catch {}
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false); setCurrentUser(''); setToken('');
    localStorage.removeItem('token'); localStorage.removeItem('currentUser');
    sessionStorage.removeItem('booted');
  };

  const handleBoot = useCallback(() => {
    sessionStorage.setItem('booted', '1');
    setBooted(true);
  }, []);

  const getLogColor = (msg = '') => {
    if (msg.includes('✅') || msg.includes('نجاح')) return '#10b981';
    if (msg.includes('❌') || msg.includes('فشل')) return '#ef4444';
    if (msg.includes('⚠️')) return '#f59e0b';
    if (msg.includes('🎨') || msg.includes('Designer')) return '#a78bfa';
    if (msg.includes('💻') || msg.includes('Coder')) return '#60a5fa';
    if (msg.includes('🔐') || msg.includes('Security')) return '#f97316';
    return '#475569';
  };

  const S = {
    bg: '#030508', bg2: '#070b12', bg3: '#0d1220',
    border: '#1a2332', border2: '#0f1a2a',
    text: '#f1f5f9', muted: '#475569',
    blue: '#3b82f6', purple: '#8b5cf6',
    font: 'system-ui,-apple-system,sans-serif',
  };

  // ── LOGIN ────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:S.bg }}>
      <div style={{ width:28, height:28, border:'2px solid #3b82f6', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isAuthenticated) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:S.bg, fontFamily:S.font }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input{outline:none!important;} input:focus{border-color:#3b82f6!important;}`}</style>
      <div style={{ background:'#0d1117', border:'1px solid #1f2937', borderRadius:16, padding:40, width:380, textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:14, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 20px' }}>⚡</div>
        <h2 style={{ color:'#fff', fontSize:20, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>JAOLA OS</h2>
        <p style={{ color:S.muted, fontSize:13, marginBottom:28 }}>Autonomous Software Engineering</p>
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="اسم المستخدم" required
            style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'11px 14px', color:'#fff', fontSize:14, fontFamily:S.font, transition:'border-color 0.2s' }} />
          <button type="submit" disabled={isLoggingIn}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:12, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:S.font, opacity: isLoggingIn ? 0.7 : 1 }}>
            {isLoggingIn ? 'جاري الدخول...' : '⚡ دخول إلى Mission Control'}
          </button>
        </form>
      </div>
    </div>
  );

  if (!booted) return <BootScreen onDone={handleBoot} />;

  // ── MAIN UI ──────────────────────────────────────────────────
  return (
    <div style={{ height:'100vh', background:S.bg, color:S.text, display:'flex', flexDirection:'column', fontFamily:S.font, overflow:'hidden' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        @keyframes agentPulse{0%,100%{box-shadow:0 0 8px rgba(59,130,246,0.2)}50%{box-shadow:0 0 20px rgba(59,130,246,0.5)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:2px}
        button{cursor:pointer;transition:all 0.15s;font-family:system-ui}
        textarea,input{font-family:system-ui;outline:none}
      `}</style>

      {/* TOP NAV */}
      <nav style={{ height:48, background:S.bg2, borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚡</div>
          <span style={{ fontSize:14, fontWeight:800, letterSpacing:'-0.5px' }}>JAOLA OS</span>
          <span style={{ fontSize:9, color:S.blue, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', padding:'1px 6px', borderRadius:4, fontWeight:700, letterSpacing:'0.5px' }}>v2.0</span>
        </div>

        <div style={{ width:1, height:20, background:S.border, margin:'0 4px' }} />

        {/* Project Selector */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:8, padding:'4px 12px' }}>
          <span style={{ fontSize:10, color:S.muted }}>PROJECT</span>
          <select value={activeProject} onChange={e => handleSwitchProject(e.target.value)}
            style={{ background:'transparent', border:'none', color:S.text, fontSize:12, fontWeight:700, cursor:'pointer', outline:'none' }}>
            {projects.map(p => <option key={p} value={p} style={{ background:'#161b22' }}>{p}</option>)}
          </select>
          <button onClick={() => setShowProjectModal(true)}
            style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:5, padding:'2px 8px', color:S.blue, fontSize:10, fontWeight:700 }}>
            + New
          </button>
        </div>

        <div style={{ flex:1 }} />

        {/* Status */}
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:S.muted }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', animation:'pulse 2s infinite' }} />
          All Systems Operational
        </div>

        <div style={{ width:1, height:20, background:S.border }} />

        {/* Deploy */}
        {vercelUrl ? (
          <a href={vercelUrl} target="_blank" rel="noreferrer"
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:7, padding:'5px 12px', color:'#10b981', fontSize:11, textDecoration:'none', fontWeight:600 }}>
            🌍 Live Site
          </a>
        ) : (
          <button onClick={handleDeploy} disabled={isDeploying}
            style={{ background: isDeploying ? 'rgba(59,130,246,0.1)' : 'linear-gradient(135deg,#1d4ed8,#4f46e5)', border:'none', borderRadius:7, padding:'5px 14px', color:'#fff', fontSize:11, fontWeight:700, opacity: isDeploying ? 0.7 : 1 }}>
            {isDeploying ? '⏳ Deploying...' : '🚀 Deploy'}
          </button>
        )}

        {/* User */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:8, padding:'5px 12px' }}>
          <div style={{ width:22, height:22, borderRadius:6, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>
            {(authUser || 'U')[0].toUpperCase()}
          </div>
          <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>{(authUser || '').toUpperCase()}</span>
        </div>

        <button onClick={handleLogout}
          style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 10px', color:S.muted, fontSize:11 }}>
          Exit
        </button>
      </nav>

      {/* MAIN BODY */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* LEFT SIDEBAR */}
        <div style={{ width:56, background:S.bg2, borderRight:`1px solid ${S.border}`, display:'flex', flexDirection:'column', alignItems:'center', padding:'12px 0', gap:4, flexShrink:0 }}>
          {SIDEBAR_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)} title={item.label}
              style={{
                width:40, height:40, borderRadius:10, border:`1px solid ${activeNav === item.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                background: activeNav === item.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                color: activeNav === item.id ? S.blue : S.muted, fontSize:18,
                display:'flex', alignItems:'center', justifyContent:'center'
              }}>
              {item.icon}
            </button>
          ))}
        </div>

        {/* MISSION CONTROL — CENTER-LEFT */}
        <div style={{ width:380, minWidth:340, background:S.bg2, borderRight:`1px solid ${S.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Mission Input */}
          <div style={{ order:3, padding:'16px', borderTop:`1px solid ${S.border}`, flexShrink:0 }}>
            <div style={{ fontSize:9, color:S.muted, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>⚡ Mission Control</div>
            <textarea ref={textareaRef} value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="What do you want your AI company to build today?"
              rows={3}
              style={{
                width:'100%', background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`,
                borderRadius:10, padding:'12px 14px', color:S.text, fontSize:13, resize:'none', lineHeight:1.6,
                paddingBottom:48, transition:'border-color 0.2s'
              }}
            />
            <div style={{ display:'flex', gap:8, marginTop:-40, paddingBottom:8, position:'relative', zIndex:1, paddingRight:8, paddingLeft:8 }}>
              <button onClick={handleSend} disabled={isSending || !prompt.trim()}
                style={{
                  flex:1, background: isSending ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  border:'none', borderRadius:7, padding:'8px', color:'#fff', fontSize:12, fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, opacity: !prompt.trim() ? 0.4 : 1
                }}>
                <span>{isSending ? 'Sending...' : 'Execute Mission'}</span>
                {!isSending && <span style={{ opacity:0.6, fontSize:10 }}>↵</span>}
              </button>
            </div>
          </div>

          {/* Quick Builds */}
          {chatMessages.length === 0 && (
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
              <div style={{ fontSize:9, color:S.muted, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:8 }}>Quick Launch</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {QUICK_BUILDS.map((b, i) => (
                  <button key={i} onClick={() => { setPrompt(b.prompt); textareaRef.current?.focus(); }}
                    style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 10px', color:'#64748b', fontSize:11, textAlign:'right', display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:14 }}>{b.icon}</span><span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Execution Feed */}
          <div style={{ order:0, flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
            {chatMessages.map((msg, i) => <FeedItem key={i} msg={msg} />)}
            <div ref={feedEndRef} />
          </div>

          {/* Quick Actions */}
          <div style={{ order:2, padding:'10px 16px', borderTop:`1px solid ${S.border}`, display:'flex', gap:6, flexWrap:'wrap', flexShrink:0 }}>
            {['غير الألوان', 'أضف قسماً', 'اجعله أسرع', 'انشر الآن'].map(a => (
              <button key={a} onClick={() => setPrompt(a)}
                style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:20, padding:'4px 10px', color:S.muted, fontSize:10, fontWeight:600 }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* CENTER — PREVIEW */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          {/* Tab Bar */}
          <div style={{ height:44, background:S.bg2, borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:2, flexShrink:0 }}>
            {[
              { id:'preview', label:'🖥️ Preview' },
              { id:'editor', label:'💻 Code' },
              { id:'logs', label:`📋 Logs${logs.length > 0 ? ` (${logs.length})` : ''}` },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? 'rgba(59,130,246,0.08)' : 'transparent',
                  border: `1px solid ${activeTab === tab.id ? 'rgba(59,130,246,0.2)' : 'transparent'}`,
                  borderRadius:7, padding:'5px 14px', color: activeTab === tab.id ? '#93c5fd' : S.muted,
                  fontSize:12, fontWeight: activeTab === tab.id ? 600 : 400
                }}>
                {tab.label}
              </button>
            ))}
            {logs.some(l => l.message?.includes('✨')) && (
              <div style={{ marginRight:4, display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#10b981', marginLeft:8 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', animation:'pulse 1s infinite' }} /> Build Complete
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
            {activeTab === 'preview' && (
              <PreviewFrame activeProject={activeProject} previewTimestamp={previewTimestamp} streamingContent={streamingContent} currentUser={authUser} />
            )}

            {activeTab === 'editor' && (
              <div style={{ height:'100%', display:'flex', flexDirection:'column', background:'#060a10' }}>
                <div style={{ display:'flex', alignItems:'center', padding:'8px 16px', gap:6, borderBottom:`1px solid ${S.border}`, flexShrink:0, flexWrap:'wrap' }}>
                  {files.slice(0, 6).map(f => (
                    <button key={f} onClick={() => setActiveFile(f)}
                      style={{ background: activeFile === f ? 'rgba(59,130,246,0.12)' : 'transparent', border:`1px solid ${activeFile === f ? 'rgba(59,130,246,0.3)' : 'transparent'}`, borderRadius:6, padding:'3px 10px', color: activeFile === f ? '#93c5fd' : S.muted, fontSize:11 }}>
                      {f.endsWith('.html') ? '🧡' : f.endsWith('.css') ? '💙' : f.endsWith('.js') ? '💛' : '📄'} {f}
                    </button>
                  ))}
                  <div style={{ flex:1 }} />
                  <button onClick={handleSaveCode}
                    style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:7, padding:'4px 12px', color:'#10b981', fontSize:11, fontWeight:700 }}>
                    💾 Save
                  </button>
                </div>
                <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
                  <div style={{ width:40, background:'#040810', borderRight:`1px solid ${S.border}`, padding:'12px 0', textAlign:'center', userSelect:'none', overflowY:'hidden', flexShrink:0 }}>
                    {(editorContent || '').split('\n').slice(0, 300).map((_, i) => (
                      <div key={i} style={{ fontSize:10, color:'#1e2d45', lineHeight:'20px', height:20 }}>{i + 1}</div>
                    ))}
                  </div>
                  <textarea value={editorContent} onChange={e => setEditorContent(e.target.value)}
                    style={{ flex:1, background:'#060a10', border:'none', padding:'12px 16px', color:'#e2e8f0', fontFamily:'monospace', fontSize:12, resize:'none', lineHeight:'20px', overflowY:'auto' }}
                    spellCheck={false} />
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div style={{ height:'100%', overflowY:'auto', padding:'12px 16px', background:'#060a10', fontFamily:'monospace', fontSize:11 }}>
                {logs.length === 0 && <div style={{ color:S.muted, textAlign:'center', marginTop:60, fontSize:13 }}>Awaiting mission orders...</div>}
                {logs.map((log, i) => (
                  <div key={i} style={{ display:'flex', gap:12, padding:'3px 0', borderBottom:`1px solid rgba(255,255,255,0.02)`, animation:'fadeIn 0.1s ease' }}>
                    <span style={{ color:'#1e2d45', flexShrink:0, fontSize:10, minWidth:60 }}>{new Date().toLocaleTimeString()}</span>
                    <span style={{ color: getLogColor(log.message) }}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent Timeline */}
          <div style={{ height:60, background:'#050910', borderTop:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:0, overflowX:'auto', flexShrink:0 }}>
            {Object.entries(agentStates || { planner:'waiting', architect:'waiting', coder:'waiting', qa:'waiting', deploy:'waiting' }).map(([name, state], i, arr) => (
              <div key={name} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
                <AgentNode name={name} state={state} icon={
                  name === 'planner' ? '🗺️' : name === 'architect' ? '🏗️' : name === 'coder' ? '💻' : name === 'qa' ? '🧪' : '🚀'
                } />
                {i < arr.length - 1 && <div style={{ width:24, height:1, background: state === 'completed' ? 'rgba(16,185,129,0.3)' : S.border, flexShrink:0, margin:'0 2px' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — INTELLIGENCE */}
        <div style={{ width:220, background:S.bg2, borderLeft:`1px solid ${S.border}`, display:'flex', flexDirection:'column', overflowY:'auto', flexShrink:0 }}>

          {/* Digital Twin */}
          <div style={{ padding:'14px', borderBottom:`1px solid ${S.border}` }}>
            <div style={{ fontSize:9, color:S.muted, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>⬡ Digital Twin</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:4, marginBottom:4 }}>
              <span style={{ fontSize:24, fontWeight:900, color:'#10b981' }}>99.98%</span>
              <span style={{ fontSize:10, color:S.muted }}>Active</span>
            </div>
            <div style={{ height:2, background:S.border, borderRadius:1, overflow:'hidden' }}>
              <div style={{ height:'100%', width:'99.98%', background:'linear-gradient(90deg,#10b981,#059669)', borderRadius:1 }} />
            </div>
          </div>

          {/* Metrics */}
          <div style={{ padding:14, borderBottom:`1px solid ${S.border}`, display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'CPU', value:'14%', pct:14, color:'#3b82f6' },
              { label:'RAM', value:'42 MB', pct:22, color:'#8b5cf6' },
              { label:'Latency', value:'11 ms', pct:8, color:'#10b981' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:10, color:S.muted }}>{m.label}</span>
                  <span style={{ fontSize:10, color:S.text, fontWeight:700 }}>{m.value}</span>
                </div>
                <div style={{ height:2, background:S.border, borderRadius:1, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${m.pct}%`, background:m.color, borderRadius:1 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Business Intelligence */}
          <div style={{ padding:14, borderBottom:`1px solid ${S.border}` }}>
            <div style={{ fontSize:9, color:S.muted, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>📊 Intelligence</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { label:'SEO Score', value:'A', color:'#10b981' },
                { label:'Security', value:'A 100%', color:'#10b981' },
                { label:'Quality', value:'A 92%', color:'#10b981' },
                { label:'Completion', value:`${Math.min(100, logs.length * 5)}%`, color:'#3b82f6' },
              ].map(m => (
                <div key={m.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:10, color:S.muted }}>{m.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          {files.length > 0 && (
            <div style={{ padding:14, borderBottom:`1px solid ${S.border}` }}>
              <div style={{ fontSize:9, color:S.muted, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>📁 Workspace</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'Files', value: files.length },
                  { label:'Lines', value: editorContent.split('\n').length },
                ].map(s => (
                  <div key={s.label} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px' }}>
                    <div style={{ fontSize:9, color:S.muted }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:S.text, marginTop:2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          <div style={{ padding:14, flex:1 }}>
            <div style={{ fontSize:9, color:S.muted, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:10 }}>Files</div>
            {files.map(f => (
              <button key={f} onClick={() => { setActiveFile(f); setActiveTab('editor'); }}
                style={{ width:'100%', background: activeFile === f ? 'rgba(59,130,246,0.08)' : 'transparent', border:`1px solid ${activeFile === f ? 'rgba(59,130,246,0.2)' : 'transparent'}`, borderRadius:6, padding:'5px 8px', color: activeFile === f ? '#93c5fd' : S.muted, fontSize:10, textAlign:'right', display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span>{f.endsWith('.html') ? '🧡' : f.endsWith('.css') ? '💙' : f.endsWith('.js') ? '💛' : '📄'}</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 }}>{f}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* FLOATING NOTIFICATIONS */}
      <div style={{ position:'fixed', bottom:20, left:20, display:'flex', flexDirection:'column', gap:8, zIndex:1000 }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            background: n.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
            border: `1px solid ${n.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
            borderRadius:10, padding:'10px 16px', fontSize:12, color: n.type === 'success' ? '#10b981' : '#93c5fd',
            backdropFilter:'blur(10px)', animation:'slideIn 0.3s ease', fontWeight:600,
            boxShadow:'0 4px 20px rgba(0,0,0,0.3)'
          }}>
            {n.msg}
          </div>
        ))}
      </div>

      {/* PROJECT MODAL */}
      {showProjectModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)' }}
          onClick={e => e.target === e.currentTarget && setShowProjectModal(false)}>
          <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:28, width:360 }}>
            <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, marginBottom:6 }}>New Project</h3>
            <p style={{ color:S.muted, fontSize:12, marginBottom:16 }}>اسم المشروع بالإنجليزية (بدون مسافات)</p>
            <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              placeholder="my-awesome-project" autoFocus
              style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:13, marginBottom:14, fontFamily:'monospace' }} />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setShowProjectModal(false)}
                style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 16px', color:S.muted, fontSize:13 }}>Cancel</button>
              <button onClick={handleCreateProject}
                style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:'8px 20px', color:'#fff', fontWeight:700, fontSize:13 }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
