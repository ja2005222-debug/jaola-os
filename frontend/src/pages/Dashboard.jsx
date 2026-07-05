import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket, socket } from '../hooks/useSocket.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { MonacoWorkspace } from '../components/editor/MonacoWorkspace.jsx';
import { MissionProgress } from '../components/MissionProgress.jsx';
import { PreviewPanel } from '../components/PreviewPanel.jsx';
import { useJaolaStore } from '../store/useJaolaStore.js';
import { BACKEND_URL } from '../config.js';

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

const MOBILE_TABS = [
  { id: 'mission', icon: '⚡', label: 'المهمة' },
  { id: 'preview', icon: '🖥️', label: 'معاينة' },
  { id: 'editor', icon: '💻', label: 'الكود' },
  { id: 'logs', icon: '📋', label: 'السجل' },
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
    <div style={{ position:'fixed', inset:0, background:'#030508', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:9999, gap:40, padding:20 }}>
      <style>{`@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(59,130,246,0.3)}50%{box-shadow:0 0 60px rgba(59,130,246,0.7)}} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div style={{ textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 20px', animation:'glow 2s infinite' }}>⚡</div>
        <div style={{ fontSize:26, fontWeight:900, color:'#fff', letterSpacing:'-1px', fontFamily:'system-ui' }}>JAOLA OS</div>
        <div style={{ fontSize:12, color:'#475569', marginTop:6, letterSpacing:'2px', textTransform:'uppercase' }}>Autonomous Software Engineering</div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8, width:'min(320px, 90vw)' }}>
        {BOOT_STEPS.slice(0, step).map((msg, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:12, animation:'fadeIn 0.3s ease', opacity: i < step - 1 ? 0.4 : 1, transition:'opacity 0.3s' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background: i < step - 1 ? '#10b981' : '#3b82f6', boxShadow: i === step - 1 ? '0 0 10px #3b82f6' : 'none', flexShrink:0 }} />
            <span style={{ fontSize:13, color: i < step - 1 ? '#475569' : '#94a3b8', fontFamily:'monospace' }}>{msg}</span>
          </div>
        ))}
      </div>

      <div style={{ width:240, height:2, background:'#1e293b', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${(step/BOOT_STEPS.length)*100}%`, background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:2, transition:'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ── Execution Feed Item ─────────────────────────────────────────
function FeedItem({ msg }) {
  // رسائل النظام (أحداث البناء الحية) — سطر حالة مضغوط
  const isStatus = msg.sender === 'system' ||
    (msg.text && (msg.text.includes('✅') || msg.text.includes('❌') || msg.text.includes('🎯') || msg.text.includes('🚀') || msg.text.includes('⚙️') || msg.text.includes('🔍')));

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
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0', animation:'fadeIn 0.2s ease' }}>
        <div style={{ width:1, background:'rgba(59,130,246,0.3)', alignSelf:'stretch', marginRight:4, flexShrink:0 }} />
        <div style={{ fontSize:11.5, color:'#64748b', fontFamily:'monospace', flex:1, wordBreak:'break-word' }}>{msg.text}</div>
        {msg.timestamp && (
          <span style={{ fontSize:9, color:'#334155', fontFamily:'monospace', flexShrink:0, direction:'ltr' }}>
            {new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
          </span>
        )}
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

// ── Agent Node (شريط الوكلاء السفلي — سطح المكتب) ───────────────
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
  const isMobile = useIsMobile();

  const [booted, setBooted] = useState(() => sessionStorage.getItem('booted') === '1');
  const [activeNav, setActiveNav] = useState('mission');
  const [activeTab, setActiveTab] = useState('preview');       // سطح المكتب: تاب العمود الأوسط
  const [mobileView, setMobileView] = useState('mission');     // الجوال: الشاشة النشطة
  const [prompt, setPrompt] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [ghForm, setGhForm] = useState({ repoUrl: '', pat: '', branch: 'main', autoCommit: true });
  const [ghStatus, setGhStatus] = useState(null);
  const [isGhSaving, setIsGhSaving] = useState(false);
  const [buildStartedAt, setBuildStartedAt] = useState(null);

  const feedEndRef = useRef(null);
  const textareaRef = useRef(null);
  const notifId = useRef(0);

  const { files, logs, streamingContent, agentStates, projects, activeProject, currentUser, vercelUrl, chatMessages, setChatMessages, setActiveProject, previewTimestamp, refreshPreview, isConnected, connectionError } = useSocket(isAuthenticated, handleAuthError);

  // ── Monaco Workspace Store ──────────────────────────────────────
  const openJaolaFile = useJaolaStore(s => s.openFile);
  const openFiles = useJaolaStore(s => s.openFiles);
  const activeFilePath = useJaolaStore(s => s.activeFilePath);
  const activeFileContent = openFiles.find(f => f.path === activeFilePath)?.content || '';
  const activeFile = activeFilePath;

  useEffect(() => {
    if (isAuthenticated && token) {
      useJaolaStore.getState().setContext({ token, project: activeProject });
    }
  }, [token, activeProject, isAuthenticated]);

  const isBuilding = Object.values(agentStates || {}).some(s => s === 'running');
  const lastLogMsg = logs[logs.length - 1]?.message || '';

  // تتبع بداية البناء لعرض المؤقت في بطاقة التقدم
  useEffect(() => {
    setBuildStartedAt(prev => {
      if (isBuilding && !prev) return Date.now();
      if (!isBuilding && prev) return null;
      return prev;
    });
  }, [isBuilding]);

  useEffect(() => { feedEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMessages, isBuilding]);

  useEffect(() => {
    if (logs.length > 0) {
      const last = logs[logs.length - 1];
      if (last?.message?.includes('✨ نجاح')) {
        addNotification('✅ البناء اكتمل بنجاح!', 'success');
        if (isMobile) setMobileView('preview'); else setActiveTab('preview');
      }
    }
  }, [logs]);

  const addNotification = (msg, type = 'info') => {
    const id = ++notifId.current;
    setNotifications(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const getHeaders = () => ({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' });

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

  // ⏹️ إيقاف المهمة الجارية
  const handleAbort = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/abort`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
      const d = await res.json();
      addNotification(d.aborted ? '⏹️ جاري إيقاف المهمة...' : 'لا توجد مهمة نشطة', 'info');
    } catch {}
  };

  // 🐙 GitHub
  const openGithubModal = async () => {
    setShowGithubModal(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/github/status?project=${activeProject}`, { headers: getHeaders() });
      if (res.ok) {
        const d = await res.json();
        setGhStatus(d);
        setGhForm(f => ({ ...f, repoUrl: d.repoUrl || '', branch: d.branch || 'main', autoCommit: d.autoCommit ?? true, pat: '' }));
      }
    } catch {}
  };

  const handleGithubConnect = async () => {
    if (!ghForm.repoUrl.trim() && !ghForm.pat.trim()) return;
    setIsGhSaving(true);
    try {
      const body = { project: activeProject, branch: ghForm.branch || 'main', autoCommit: ghForm.autoCommit };
      if (ghForm.repoUrl.trim()) body.repoUrl = ghForm.repoUrl.trim();
      if (ghForm.pat.trim()) body.pat = ghForm.pat.trim();
      const res = await fetch(`${BACKEND_URL}/api/github/connect`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
      const d = await res.json();
      if (res.ok) {
        addNotification('🐙 تم ربط GitHub بنجاح', 'success');
        setGhForm(f => ({ ...f, pat: '' }));
        setShowGithubModal(false);
      } else {
        addNotification(`❌ ${d.error || 'فشل الربط'}`, 'info');
      }
    } catch {}
    setIsGhSaving(false);
  };

  const handleGithubPush = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/github/push`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
      const d = await res.json();
      addNotification(res.ok ? '🐙 جاري الدفع إلى GitHub... تابع الشات' : `❌ ${d.error || 'فشل الدفع'}`, 'info');
      if (res.ok) setShowGithubModal(false);
    } catch {}
  };

  const handleSwitchProject = (p) => { setActiveProject(p); };

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
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:S.bg }}>
      <div style={{ width:28, height:28, border:'2px solid #3b82f6', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!isAuthenticated) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:S.bg, fontFamily:S.font, padding:16 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input{outline:none!important;} input:focus{border-color:#3b82f6!important;}`}</style>
      <div style={{ background:'#0d1117', border:'1px solid #1f2937', borderRadius:16, padding:'40px 28px', width:'min(380px, 100%)', textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:14, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, margin:'0 auto 20px' }}>⚡</div>
        <h2 style={{ color:'#fff', fontSize:20, fontWeight:800, letterSpacing:'-0.5px', marginBottom:6 }}>JAOLA OS</h2>
        <p style={{ color:S.muted, fontSize:13, marginBottom:28 }}>Autonomous Software Engineering</p>
        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="اسم المستخدم" required
            style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'12px 14px', color:'#fff', fontSize:16, fontFamily:S.font, transition:'border-color 0.2s' }} />
          <button type="submit" disabled={isLoggingIn}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:13, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:S.font, opacity: isLoggingIn ? 0.7 : 1 }}>
            {isLoggingIn ? 'جاري الدخول...' : '⚡ دخول إلى Mission Control'}
          </button>
        </form>
      </div>
    </div>
  );

  if (!booted) return <BootScreen onDone={handleBoot} />;

  const globalStyles = `
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
  `;

  // ═══ الأجزاء المشتركة (سطح المكتب + الجوال) ═══════════════════

  // شريط حالة الاتصال — يظهر فقط عند الانقطاع، ويطمئن المستخدم أن الإرجاع تلقائي
  const connectionBanner = !isConnected && (
    <div style={{
      background:'rgba(245,158,11,0.1)', borderBottom:'1px solid rgba(245,158,11,0.3)',
      padding:'6px 14px', display:'flex', alignItems:'center', gap:8, flexShrink:0,
    }}>
      <div style={{ width:7, height:7, borderRadius:'50%', background:'#f59e0b', animation:'pulse 1s infinite', flexShrink:0 }} />
      <span style={{ fontSize:11, color:'#fbbf24', fontWeight:600 }}>
        {connectionError || 'انقطع الاتصال بالخادم — جاري إعادة الاتصال تلقائياً...'}
      </span>
    </div>
  );

  // بث المهمة داخل الشات: الرسائل + بطاقة التقدم الحية
  const missionFeed = (
    <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
      {chatMessages.length === 0 && !isBuilding && (
        <div style={{ textAlign:'center', color:S.muted, fontSize:12, marginTop:40, lineHeight:2 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>⚡</div>
          أخبرني ماذا تريد أن نبني اليوم؟<br/>
          <span style={{ fontSize:11, color:'#334155' }}>سأعرض لك هنا كل خطوة أثناء التنفيذ — لحظة بلحظة</span>
        </div>
      )}
      {chatMessages.map((msg, i) => <FeedItem key={i} msg={msg} />)}
      {isBuilding && buildStartedAt && (
        <MissionProgress agentStates={agentStates} lastLog={lastLogMsg} startedAt={buildStartedAt} />
      )}
      {isSending && !isBuilding && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#3b82f6', animation:'pulse 0.9s infinite' }} />
          <span style={{ fontSize:11, color:'#64748b' }}>JAOLA يستلم المهمة...</span>
        </div>
      )}
      <div ref={feedEndRef} />
    </div>
  );

  const quickBuilds = chatMessages.length === 0 && (
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
  );

  const logsView = (
    <div style={{ height:'100%', overflowY:'auto', padding:'12px 16px', background:'#060a10', fontFamily:'monospace', fontSize:11 }}>
      {logs.length === 0 && <div style={{ color:S.muted, textAlign:'center', marginTop:60, fontSize:13 }}>Awaiting mission orders...</div>}
      {logs.map((log, i) => (
        <div key={i} style={{ display:'flex', gap:12, padding:'3px 0', borderBottom:`1px solid rgba(255,255,255,0.02)`, animation:'fadeIn 0.1s ease' }}>
          <span style={{ color:'#1e2d45', flexShrink:0, fontSize:10, minWidth:60 }}>{new Date().toLocaleTimeString()}</span>
          <span style={{ color: getLogColor(log.message), wordBreak:'break-word' }}>{log.message}</span>
        </div>
      ))}
    </div>
  );

  const previewView = (
    <PreviewPanel
      activeProject={activeProject}
      previewTimestamp={previewTimestamp}
      streamingContent={streamingContent}
      currentUser={authUser}
      onRefresh={refreshPreview}
      compact={isMobile}
    />
  );

  const notificationsOverlay = (
    <div style={{ position:'fixed', bottom: isMobile ? 76 : 20, left:20, right: isMobile ? 20 : 'auto', display:'flex', flexDirection:'column', gap:8, zIndex:1000 }}>
      {notifications.map(n => (
        <div key={n.id} style={{
          background: n.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
          border: `1px solid ${n.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
          borderRadius:10, padding:'10px 16px', fontSize:12, color: n.type === 'success' ? '#10b981' : '#93c5fd',
          backdropFilter:'blur(10px)', animation:'slideIn 0.3s ease', fontWeight:600,
          boxShadow:'0 4px 20px rgba(0,0,0,0.3)'
        }}>
          {n.msg}
        </div>
      ))}
    </div>
  );

  const githubModal = showGithubModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowGithubModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'24px 22px', width:'min(420px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, marginBottom:6 }}>🐙 GitHub Integration</h3>
        <p style={{ color:S.muted, fontSize:12, marginBottom:16 }}>
          اربط المشروع ({activeProject}) بمستودع GitHub — مع دفع تلقائي بعد كل بناء ناجح.
          {ghStatus?.connected && <span style={{ color:'#10b981' }}> ● مرتبط حالياً</span>}
        </p>

        <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>REPOSITORY URL</label>
        <input value={ghForm.repoUrl} onChange={e => setGhForm(f => ({ ...f, repoUrl: e.target.value }))}
          placeholder="https://github.com/username/repo.git" dir="ltr"
          style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, margin:'6px 0 12px', fontFamily:'monospace' }} />

        <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>
          PERSONAL ACCESS TOKEN {ghStatus?.hasToken && <span style={{ color:'#10b981', fontWeight:400 }}>(محفوظ مشفراً — اتركه فارغاً للإبقاء عليه)</span>}
        </label>
        <input value={ghForm.pat} onChange={e => setGhForm(f => ({ ...f, pat: e.target.value }))}
          placeholder="ghp_..." type="password" dir="ltr"
          style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, margin:'6px 0 12px', fontFamily:'monospace' }} />

        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:120 }}>
            <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>BRANCH</label>
            <input value={ghForm.branch} onChange={e => setGhForm(f => ({ ...f, branch: e.target.value }))}
              placeholder="main" dir="ltr"
              style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, marginTop:6, fontFamily:'monospace' }} />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginTop:18, fontSize:12, color:'#94a3b8' }}>
            <input type="checkbox" checked={ghForm.autoCommit}
              onChange={e => setGhForm(f => ({ ...f, autoCommit: e.target.checked }))}
              style={{ accentColor:'#3b82f6', width:15, height:15 }} />
            Auto-push بعد البناء
          </label>
        </div>

        {ghStatus?.lastCommit && (
          <p style={{ color:S.muted, fontSize:10, marginBottom:12 }}>آخر دفع: {new Date(ghStatus.lastCommit).toLocaleString('ar')}</p>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={() => setShowGithubModal(false)}
            style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 16px', color:S.muted, fontSize:13 }}>Cancel</button>
          {ghStatus?.connected && (
            <button onClick={handleGithubPush}
              style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, padding:'8px 16px', color:'#10b981', fontWeight:700, fontSize:13 }}>
              ⬆ Push Now
            </button>
          )}
          <button onClick={handleGithubConnect} disabled={isGhSaving}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:'8px 20px', color:'#fff', fontWeight:700, fontSize:13, opacity: isGhSaving ? 0.7 : 1 }}>
            {isGhSaving ? 'جاري الحفظ...' : 'Save & Connect'}
          </button>
        </div>
      </div>
    </div>
  );

  const projectModal = showProjectModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowProjectModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:28, width:'min(360px, 100%)' }}>
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
  );

  // ═══════════════════════════════════════════════════════════════
  // 📱 تخطيط الجوال — شاشة واحدة + تنقل سفلي
  // ═══════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ height:'100dvh', background:S.bg, color:S.text, display:'flex', flexDirection:'column', fontFamily:S.font, overflow:'hidden' }}>
        <style>{globalStyles}</style>

        {/* رأس مضغوط */}
        <nav style={{ height:52, background:S.bg2, borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 12px', gap:8, flexShrink:0 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>⚡</div>
          <select value={activeProject} onChange={e => handleSwitchProject(e.target.value)}
            style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:7, color:S.text, fontSize:12, fontWeight:700, padding:'5px 8px', maxWidth:130, outline:'none' }}>
            {projects.map(p => <option key={p} value={p} style={{ background:'#161b22' }}>{p}</option>)}
          </select>
          <button onClick={() => setShowProjectModal(true)}
            style={{ background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:6, padding:'4px 8px', color:S.blue, fontSize:11, fontWeight:700, flexShrink:0 }}>+</button>

          {isBuilding && (
            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#60a5fa', fontWeight:700 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#3b82f6', animation:'pulse 1s infinite' }} />
              يبني...
            </span>
          )}

          <div style={{ flex:1 }} />

          <button onClick={openGithubModal} style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 9px', color:'#94a3b8', fontSize:13 }}>🐙</button>
          {vercelUrl
            ? <a href={vercelUrl} target="_blank" rel="noreferrer" style={{ fontSize:13, textDecoration:'none', padding:'5px 9px', border:'1px solid rgba(16,185,129,0.3)', borderRadius:7 }}>🌍</a>
            : <button onClick={handleDeploy} disabled={isDeploying} style={{ background:'linear-gradient(135deg,#1d4ed8,#4f46e5)', border:'none', borderRadius:7, padding:'5px 9px', color:'#fff', fontSize:13, opacity:isDeploying?0.6:1 }}>🚀</button>}
          <button onClick={handleLogout} style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 8px', color:S.muted, fontSize:11 }}>
            {(authUser || 'U')[0].toUpperCase()} ✕
          </button>
        </nav>

        {connectionBanner}

        {/* المحتوى النشط */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>
          {mobileView === 'mission' && (
            <>
              {missionFeed}
              {quickBuilds}
              {/* إدخال المهمة — أسلوب تطبيقات المحادثة */}
              <div style={{ padding:'10px 12px', borderTop:`1px solid ${S.border}`, flexShrink:0, display:'flex', gap:8, alignItems:'flex-end', background:S.bg2 }}>
                <textarea ref={textareaRef} value={prompt} onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="ماذا تريد أن نبني؟"
                  rows={2}
                  style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:12, padding:'10px 12px', color:S.text, fontSize:16, resize:'none', lineHeight:1.5 }} />
                {(isBuilding || isSending) && (
                  <button onClick={handleAbort} title="إيقاف"
                    style={{ width:44, height:44, borderRadius:12, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)', color:'#f87171', fontSize:16, flexShrink:0 }}>⏹</button>
                )}
                <button onClick={handleSend} disabled={isSending || !prompt.trim()}
                  style={{ width:44, height:44, borderRadius:12, background: prompt.trim() ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'rgba(255,255,255,0.05)', border:'none', color:'#fff', fontSize:17, flexShrink:0, opacity: isSending ? 0.6 : 1 }}>
                  {isSending ? '…' : '⚡'}
                </button>
              </div>
            </>
          )}

          {mobileView === 'preview' && previewView}

          {mobileView === 'editor' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
              {/* قائمة ملفات أفقية سريعة */}
              {files.length > 0 && (
                <div style={{ display:'flex', gap:6, padding:'8px 12px', overflowX:'auto', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
                  {files.map(f => (
                    <button key={f} onClick={() => openJaolaFile(f)}
                      style={{ background: activeFile === f ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)', border:`1px solid ${activeFile === f ? 'rgba(59,130,246,0.3)' : S.border}`, borderRadius:7, padding:'4px 10px', color: activeFile === f ? '#93c5fd' : S.muted, fontSize:11, whiteSpace:'nowrap', flexShrink:0 }}>
                      {f}
                    </button>
                  ))}
                </div>
              )}
              <div style={{ flex:1, minHeight:0 }}><MonacoWorkspace /></div>
            </div>
          )}

          {mobileView === 'logs' && logsView}
        </div>

        {/* التنقل السفلي */}
        <nav style={{
          height:'calc(58px + env(safe-area-inset-bottom))', paddingBottom:'env(safe-area-inset-bottom)',
          background:S.bg2, borderTop:`1px solid ${S.border}`, display:'flex', flexShrink:0,
        }}>
          {MOBILE_TABS.map(tab => {
            const isActive = mobileView === tab.id;
            const showBadge = tab.id === 'logs' && logs.length > 0;
            return (
              <button key={tab.id} onClick={() => setMobileView(tab.id)}
                style={{
                  flex:1, background:'transparent', border:'none', display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', gap:3, position:'relative',
                  color: isActive ? '#60a5fa' : '#475569',
                }}>
                <span style={{ fontSize:18, filter: isActive ? 'none' : 'grayscale(0.6)' }}>{tab.icon}</span>
                <span style={{ fontSize:9, fontWeight:700 }}>{tab.label}</span>
                {isActive && <span style={{ position:'absolute', top:0, left:'25%', right:'25%', height:2, background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:2 }} />}
                {showBadge && !isActive && <span style={{ position:'absolute', top:8, left:'calc(50% - 16px)', width:6, height:6, borderRadius:'50%', background: isBuilding ? '#3b82f6' : '#1f2937' }} />}
              </button>
            );
          })}
        </nav>

        {notificationsOverlay}
        {githubModal}
        {projectModal}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 🖥️ تخطيط سطح المكتب
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ height:'100vh', background:S.bg, color:S.text, display:'flex', flexDirection:'column', fontFamily:S.font, overflow:'hidden' }}>
      <style>{globalStyles}</style>

      {/* TOP NAV */}
      <nav style={{ height:48, background:S.bg2, borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚡</div>
          <span style={{ fontSize:14, fontWeight:800, letterSpacing:'-0.5px' }}>JAOLA OS</span>
          <span style={{ fontSize:9, color:S.blue, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', padding:'1px 6px', borderRadius:4, fontWeight:700, letterSpacing:'0.5px' }}>v2.3</span>
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
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color: !isConnected ? '#f59e0b' : isBuilding ? '#60a5fa' : S.muted }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background: !isConnected ? '#f59e0b' : isBuilding ? '#3b82f6' : '#10b981', animation:'pulse 2s infinite' }} />
          {!isConnected ? 'Reconnecting...' : isBuilding ? 'Mission Running...' : 'All Systems Operational'}
        </div>

        <div style={{ width:1, height:20, background:S.border }} />

        {/* GitHub */}
        <button onClick={openGithubModal} title="ربط المشروع بـ GitHub"
          style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 12px', color:'#94a3b8', fontSize:11, fontWeight:600 }}>
          🐙 GitHub
        </button>

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

      {connectionBanner}

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

          {/* Execution Feed */}
          {missionFeed}

          {/* Quick Builds */}
          {quickBuilds}

          {/* Quick Actions */}
          <div style={{ padding:'10px 16px', borderTop:`1px solid ${S.border}`, display:'flex', gap:6, flexWrap:'wrap', flexShrink:0 }}>
            {['غير الألوان', 'أضف قسماً', 'اجعله أسرع', 'انشر الآن'].map(a => (
              <button key={a} onClick={() => setPrompt(a)}
                style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:20, padding:'4px 10px', color:S.muted, fontSize:10, fontWeight:600 }}>
                {a}
              </button>
            ))}
          </div>

          {/* Mission Input */}
          <div style={{ padding:'16px', borderTop:`1px solid ${S.border}`, flexShrink:0 }}>
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
              {(isBuilding || isSending) && (
                <button onClick={handleAbort} title="إيقاف المهمة الجارية"
                  style={{
                    background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.35)',
                    borderRadius:7, padding:'8px 14px', color:'#f87171', fontSize:12, fontWeight:700,
                    display:'flex', alignItems:'center', gap:5
                  }}>
                  ⏹ Stop
                </button>
              )}
            </div>
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
            {activeTab === 'preview' && previewView}
            {activeTab === 'editor' && <MonacoWorkspace />}
            {activeTab === 'logs' && logsView}
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
                  { label:'Lines', value: activeFileContent.split('\n').length },
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
              <button key={f} onClick={() => { openJaolaFile(f); setActiveTab('editor'); }}
                style={{ width:'100%', background: activeFile === f ? 'rgba(59,130,246,0.08)' : 'transparent', border:`1px solid ${activeFile === f ? 'rgba(59,130,246,0.2)' : 'transparent'}`, borderRadius:6, padding:'5px 8px', color: activeFile === f ? '#93c5fd' : S.muted, fontSize:10, textAlign:'right', display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span>{f.endsWith('.html') ? '🧡' : f.endsWith('.css') ? '💙' : f.endsWith('.js') ? '💛' : '📄'}</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:11 }}>{f}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {notificationsOverlay}
      {githubModal}
      {projectModal}
    </div>
  );
}
