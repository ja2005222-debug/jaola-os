import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket, socket } from '../hooks/useSocket.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { MonacoWorkspace } from '../components/editor/MonacoWorkspace.jsx';
import { MissionProgress } from '../components/MissionProgress.jsx';
import { Markdown } from '../components/Markdown.jsx';
import { PreviewPanel } from '../components/PreviewPanel.jsx';
import { TimelinePanel } from '../components/TimelinePanel.jsx';
import { useJaolaStore } from '../store/useJaolaStore.js';
import { BACKEND_URL } from '../config.js';
import { useI18n } from '../i18n.js';
import { LanguageSwitcher } from '../components/LanguageSwitcher.jsx';

const QUICK_BUILDS = [
  { icon: '⚡', label: 'SaaS', promptKey: 'qbSaaS' },
  { icon: '✈️', label: 'Travel', promptKey: 'qbTravel' },
  { icon: '🍽️', label: 'Restaurant', promptKey: 'qbRestaurant' },
  { icon: '🎬', label: 'Cinema', promptKey: 'qbCinema' },
  { icon: '📊', label: 'Dashboard', promptKey: 'qbDashboard' },
  { icon: '📱', label: 'Mobile App', promptKey: 'qbMobile' },
  { icon: '💼', label: 'CRM', promptKey: 'qbCRM' },
  { icon: '🏢', label: 'ERP', promptKey: 'qbERP' },
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
  { id: 'mission', icon: '⚡', key: 'mMission' },
  { id: 'preview', icon: '🖥️', key: 'preview' },
  { id: 'editor', icon: '💻', key: 'code' },
  { id: 'logs', icon: '📋', key: 'logs' },
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
function FeedItem({ msg, onOption }) {
  // رسائل النظام (أحداث البناء الحية) — سطر حالة مضغوط
  const isStatus = msg.sender === 'system' ||
    (msg.text && (msg.text.includes('✅') || msg.text.includes('❌') || msg.text.includes('🎯') || msg.text.includes('🚀') || msg.text.includes('⚙️') || msg.text.includes('🔍')));

  const timeStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
    : null;

  if (msg.sender === 'user') {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', animation:'msgIn 0.25s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#1d4ed8,#4f46e5)', borderRadius:'12px 12px 2px 12px', padding:'10px 16px', maxWidth:'80%', fontSize:13, color:'#fff', lineHeight:1.6 }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', fontWeight:700, marginBottom:4, letterSpacing:'0.5px' }}>YOU — CEO</div>
          {msg.text}
        </div>
        {timeStr && <span style={{ fontSize:9, color:'#334155', marginTop:3, direction:'ltr' }}>{timeStr}</span>}
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
    <div className="feed-msg" style={{ display:'flex', gap:10, alignItems:'flex-start', animation:'msgIn 0.25s ease' }}>
      <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, marginTop:2, animation: msg.streaming ? 'avatarGlow 1.2s infinite' : 'none' }}>⚡</div>
      <div style={{ background:'rgba(15,23,42,0.8)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:'2px 12px 12px 12px', padding:'10px 14px', maxWidth:'85%', fontSize:12, color:'#cbd5e1', lineHeight:1.7, position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ fontSize:9, color:'#3b82f6', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase' }}>JAOLA OS</span>
          {timeStr && <span style={{ fontSize:9, color:'#334155', direction:'ltr' }}>{timeStr}</span>}
          {!msg.streaming && msg.text && (
            <button className="msg-copy" onClick={() => navigator.clipboard?.writeText(msg.text)} title="نسخ"
              style={{ background:'transparent', border:'none', color:'#64748b', fontSize:11, padding:'0 2px', marginInlineStart:'auto' }}>
              ⧉
            </button>
          )}
        </div>
        {msg.streaming && !msg.text
          ? <span style={{ display:'inline-flex', gap:3 }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite' }} />
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite 0.2s' }} />
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#60a5fa', animation:'typing 1s infinite 0.4s' }} />
            </span>
          : <span style={{ display:'inline' }}>
              <Markdown text={msg.text} />
              {msg.streaming && <span style={{ display:'inline-block', width:7, height:14, background:'#60a5fa', marginInlineStart:2, verticalAlign:'text-bottom', animation:'blink 1s step-end infinite' }} />}
            </span>}

        {/* 🔟 اقتراحات استباقية — أزرار الخطوة التالية */}
        {Array.isArray(msg.options) && msg.options.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
            {msg.options.map((opt, i) => (
              <button key={i} onClick={() => onOption?.(opt)}
                style={{
                  background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)',
                  borderRadius:8, padding:'6px 12px', color:'#93c5fd', fontSize:11, fontWeight:700,
                }}>
                {opt}
              </button>
            ))}
          </div>
        )}
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
  const { currentUser: authUser, token, isAuthenticated, handleAuthError, setIsAuthenticated, setCurrentUser, setToken, isLoading, oauthError } = useAuth();
  const isMobile = useIsMobile();

  const [booted, setBooted] = useState(() => sessionStorage.getItem('booted') === '1');
  const [activeNav, setActiveNav] = useState('mission');
  const [activeTab, setActiveTab] = useState('preview');       // سطح المكتب: تاب العمود الأوسط
  const [mobileView, setMobileView] = useState('mission');     // الجوال: الشاشة النشطة
  const [mobileLogsMode, setMobileLogsMode] = useState('logs'); // الجوال: سجل حي / خط زمني
  const [showMobileMenu, setShowMobileMenu] = useState(false);  // الجوال: قائمة الإجراءات الثانوية
  const [showSiteHealth, setShowSiteHealth] = useState(false);  // الجوال: بطاقة حالة الموقع (مؤشرات الجودة)
  const [prompt, setPrompt] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authError, setAuthError] = useState('');
  const [oauthProviders, setOauthProviders] = useState([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledge, setKnowledge] = useState(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [showSecretsModal, setShowSecretsModal] = useState(false);
  const [secretKeys, setSecretKeys] = useState([]);
  const [newSecretKey, setNewSecretKey] = useState('');
  const [newSecretVal, setNewSecretVal] = useState('');
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretError, setSecretError] = useState('');
  const [ghForm, setGhForm] = useState({ repoUrl: '', pat: '', branch: 'main', autoCommit: true });
  const [ghStatus, setGhStatus] = useState(null);
  const [isGhSaving, setIsGhSaving] = useState(false);
  const [buildStartedAt, setBuildStartedAt] = useState(null);

  const feedEndRef = useRef(null);
  const textareaRef = useRef(null);
  const notifId = useRef(0);

  // 🔑 اكتشاف مزوّدي OAuth المُهيّئين + عرض خطأ ارتداد OAuth إن وُجد
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/auth/providers`)
      .then(r => r.json()).then(d => setOauthProviders(d.providers || [])).catch(() => {});
  }, []);
  useEffect(() => { if (oauthError) setAuthError(oauthError); }, [oauthError]);

  const { files, logs, streamingContent, agentStates, projects, activeProject, currentUser, vercelUrl, chatMessages, setChatMessages, setActiveProject, previewTimestamp, refreshPreview, isConnected, connectionError, metrics, latencyMs, missionPhase } = useSocket(isAuthenticated, handleAuthError);

  // 📊 قيم لوحة الذكاء الحقيقية (مع بدائل عند غياب البيانات)
  const gradeColor = (g) => g === 'A' ? '#10b981' : g === 'B' ? '#fbbf24' : g ? '#f97316' : '#334155';
  const fmtScore = (s) => s ? `${s.grade}${s.score != null ? ` ${s.score}%` : ''}` : '—';
  const sysUptime = metrics?.system?.uptimeSec ?? null;
  const fmtUptime = sysUptime == null ? '—'
    : sysUptime >= 3600 ? `${Math.floor(sysUptime/3600)}س ${Math.floor((sysUptime%3600)/60)}د`
    : `${Math.floor(sysUptime/60)}د`;

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

  const t = useI18n(s => s.t);
  const uiLang = useI18n(s => s.lang);

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
        addNotification(t('nBuildDone'), 'success');
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

  const handleSend = async (overrideText) => {
    // overrideText: نص مباشر من زر اقتراح (وليس حدث onClick)
    const raw = typeof overrideText === 'string' ? overrideText : prompt;
    const msg = raw.trim();
    if (!msg || isSending) return;
    setIsSending(true);
    if (typeof overrideText !== 'string') setPrompt('');
    setChatMessages(prev => [...prev, { sender: 'user', text: msg, timestamp: Date.now() }]);
    try {
      await fetch(`${BACKEND_URL}/api/chat`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ message: msg, project: activeProject, uiLang }) });
    } catch {}
    setTimeout(() => setIsSending(false), 1000);
  };

  // 🔟 ضغطة زر اقتراح → تُرسل كرسالة (بعد إزالة الرموز التعبيرية من البداية)
  const handleOptionClick = (opt) => {
    const clean = opt.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    handleSend(clean || opt);
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    addNotification(t('nDeploying'), 'info');
    try {
      const res = await fetch(`${BACKEND_URL}/api/deploy`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
      const d = await res.json().catch(() => ({}));
      // 🖥️ مشروع full-stack → خادم دائم على Render (زر بضغطة واحدة)
      if (d.target === 'render') {
        setIsDeploying(false);
        if (d.needsGitHub) {
          // Render ينشر من GitHub — نفتح ربط GitHub مباشرةً (الخطوة الوحيدة المتبقية)
          addNotification(t('renderNeedsGithub'), 'info');
          openGithubModal();
          return;
        }
        if (d.deployUrl) {
          addNotification(t('renderReady'), 'success');
          window.open(d.deployUrl, '_blank', 'noopener');
          return;
        }
        addNotification(`❌ ${d.error || t('deployFail')}`, 'info');
        return;
      }
    } catch {}
    setTimeout(() => { setIsDeploying(false); addNotification(t('nDeployed'), 'success'); }, 8000);
  };

  // 🩺 فحص جاهزية النشر على Vercel — يعرض تشخيصاً دقيقاً بدل تخمين "Not authorized"
  const handleVercelCheck = async () => {
    addNotification(t('vercelChecking') || 'جاري فحص إعداد Vercel...', 'info');
    try {
      const res = await fetch(`${BACKEND_URL}/api/deploy/vercel-check`, { headers: getHeaders() });
      const d = await res.json();
      addNotification(d.message || (d.ok ? '✅' : '❌'), d.ok ? 'success' : 'info');
    } catch (e) {
      addNotification('❌ تعذّر الوصول للخادم للفحص.', 'info');
    }
  };

  // 📚 معرفة المنصّة — فهم المشروع الحالي + مكتبة الفئات + الدروس المتراكمة
  const openKnowledgeModal = async () => {
    setShowKnowledgeModal(true);
    setKnowledgeLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/platform/knowledge?project=${encodeURIComponent(activeProject || '')}`, { headers: getHeaders() });
      const d = await res.json();
      setKnowledge(d);
    } catch {
      setKnowledge({ error: true });
    }
    setKnowledgeLoading(false);
  };

  // ⏹️ إيقاف المهمة الجارية
  const handleAbort = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/abort`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
      const d = await res.json();
      addNotification(d.aborted ? t('nStopping') : t('nNoMission'), 'info');
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

  // 🔑 أسرار المشروع (متغيّرات البيئة مثل MONGODB_URI)
  const openSecretsModal = async () => {
    setShowSecretsModal(true); setSecretError(''); setNewSecretKey(''); setNewSecretVal('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/secrets?project=${activeProject}`, { headers: getHeaders() });
      if (res.ok) { const d = await res.json(); setSecretKeys(d.keys || []); }
    } catch {}
  };
  const handleAddSecret = async () => {
    const key = newSecretKey.trim(), value = newSecretVal.trim();
    if (!key || !value) return;
    setSecretBusy(true); setSecretError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/secret`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject, key, value }) });
      const d = await res.json();
      if (res.ok) { setSecretKeys(d.keys || []); setNewSecretKey(''); setNewSecretVal(''); addNotification(t('secretSaved'), 'success'); }
      else setSecretError(d.error || 'خطأ');
    } catch { setSecretError('تعذّر الحفظ'); }
    setSecretBusy(false);
  };
  const handleDeleteSecret = async (key) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/project/secret`, { method: 'DELETE', headers: getHeaders(), body: JSON.stringify({ project: activeProject, key }) });
      const d = await res.json();
      if (res.ok) setSecretKeys(d.keys || []);
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
        addNotification(t('nGithubLinked'), 'success');
        setGhForm(f => ({ ...f, pat: '' }));
        setShowGithubModal(false);
      } else {
        addNotification(`❌ ${d.error || t('linkFail')}`, 'info');
      }
    } catch {}
    setIsGhSaving(false);
  };

  const handleGithubPush = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/github/push`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
      const d = await res.json();
      addNotification(res.ok ? t('pushingGithub') : `❌ ${d.error || t('pushFail')}`, 'info');
      if (res.ok) setShowGithubModal(false);
    } catch {}
  };

  const handleSwitchProject = (p) => {
    setActiveProject(p);
    // إعادة الانضمام لغرفة المشروع الجديد عبر الـ socket فوراً
    if (socket.connected) socket.emit('join_project', { project: p });
  };

  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    setCreateError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/projects`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ name }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // نستخدم الاسم المُطهَّر من السيرفر (قد يختلف عن المُدخل)
        handleSwitchProject(d.activeProject || name);
        setShowProjectModal(false);
        setNewProjectName('');
        addNotification(`${t('nProjectCreated')} "${d.activeProject || name}"`, 'success');
      } else {
        setCreateError(d.error || t('createProjectFail'));
      }
    } catch {
      setCreateError(t('serverConnFail'));
    }
    setIsCreating(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim()) return;
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // 🛠️ السيرفر يرجع الحقل باسم currentUser — قراءة d.username كانت تخزن
        // "undefined" فتكسر رابط المعاينة (مجلد مستخدم خاطئ → 404)
        const uname = d.currentUser || d.username || loginUsername.trim().toLowerCase();
        setToken(d.token); setCurrentUser(uname); setIsAuthenticated(true);
        localStorage.setItem('token', d.token); localStorage.setItem('currentUser', uname);
        localStorage.removeItem('loggedOut');
      } else {
        setAuthError(d.error || (authMode === 'register' ? t('registerFail') : t('loginFail')));
      }
    } catch {
      setAuthError(t('serverConnRetry'));
    }
    setIsLoggingIn(false);
  };

  const handleLogout = () => {
    // 🔐 هدم كامل للجلسة — الـ socket مفرد ويبقى موثّقاً بالحساب القديم،
    // وحالة React (شات/مشاريع/ملفات) تعيش لأن المكوّن لا يُفكك. بدون هذا
    // كان الحساب التالي يرى كل بيانات السابق (تسريب حقيقي مُبلغ عنه).
    try { socket.disconnect(); } catch { /* لا يهم */ }
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('activeProject');
    sessionStorage.removeItem('booted');
    window.location.replace('/'); // تصفير كل حالة الذاكرة — عزل تام بين الحسابات
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
    surface: 'rgba(255,255,255,0.025)', surfaceHi: 'rgba(255,255,255,0.045)',
    border: '#1a2332', border2: '#0f1a2a', borderHi: 'rgba(59,130,246,0.25)',
    text: '#f1f5f9', muted: '#64748b', dim: '#475569',
    blue: '#3b82f6', purple: '#8b5cf6',
    good: '#10b981', warn: '#f59e0b', danger: '#ef4444',
    accent: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
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
        <p style={{ color:S.muted, fontSize:13, marginBottom:20 }}>Autonomous Software Engineering</p>

        <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}><LanguageSwitcher /></div>

        {/* تبويب دخول / حساب جديد */}
        <div style={{ display:'flex', background:'rgba(255,255,255,0.04)', borderRadius:9, padding:3, marginBottom:18 }}>
          {[['login', t('login')],['register', t('register')]].map(([mode, label]) => (
            <button key={mode} type="button" onClick={() => { setAuthMode(mode); setAuthError(''); }}
              style={{
                flex:1, padding:'8px', borderRadius:7, border:'none', fontSize:13, fontWeight:700, cursor:'pointer',
                background: authMode === mode ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'transparent',
                color: authMode === mode ? '#fff' : '#64748b',
              }}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder={t('username')} required dir="ltr"
            style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'12px 14px', color:'#fff', fontSize:16, fontFamily:S.font, transition:'border-color 0.2s', textAlign:'left' }} />
          <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} type="password" dir="ltr"
            placeholder={t('password')}
            required={authMode === 'register'} minLength={authMode === 'register' ? 6 : undefined}
            style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:8, padding:'12px 14px', color:'#fff', fontSize:16, fontFamily:S.font, transition:'border-color 0.2s', textAlign:'left' }} />

          {authError && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'9px 12px', color:'#f87171', fontSize:12, textAlign:'center' }}>
              {authError}
            </div>
          )}

          <button type="submit" disabled={isLoggingIn}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:13, color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:S.font, opacity: isLoggingIn ? 0.7 : 1 }}>
            {isLoggingIn
              ? (authMode === 'register' ? t('registering') : t('signingIn'))
              : (authMode === 'register' ? `✨ ${t('register')}` : `⚡ ${t('enterMission')}`)}
          </button>
        </form>

        {/* 🔑 الدخول عبر مزوّدي OAuth (يظهر فقط إذا هُيّئ على الخادم) */}
        {oauthProviders.length > 0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'18px 0 14px' }}>
              <div style={{ flex:1, height:1, background:'#1f2937' }} />
              <span style={{ color:S.muted, fontSize:11 }}>{t('orDivider')}</span>
              <div style={{ flex:1, height:1, background:'#1f2937' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {oauthProviders.includes('github') && (
                <a href={`${BACKEND_URL}/api/auth/github`}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'#161b22', border:'1px solid #30363d', borderRadius:8, padding:'11px', color:'#fff', fontSize:14, fontWeight:600, textDecoration:'none' }}>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                  {t('continueWithGithub')}
                </a>
              )}
              {oauthProviders.includes('google') && (
                <a href={`${BACKEND_URL}/api/auth/google`}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'#fff', border:'1px solid #30363d', borderRadius:8, padding:'11px', color:'#1f2937', fontSize:14, fontWeight:600, textDecoration:'none' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 009 18z"/><path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 010-3.44V4.94H.96a9 9 0 000 8.12l3.02-2.34z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 00.96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z"/></svg>
                  {t('continueWithGoogle')}
                </a>
              )}
            </div>
          </>
        )}
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
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    @keyframes typing{0%,60%,100%{transform:translateY(0);opacity:0.5}30%{transform:translateY(-4px);opacity:1}}
    *{box-sizing:border-box}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px}
    ::-webkit-scrollbar-thumb:hover{background:#334155}

    /* 🖱️ طبقة التفاعل الموحدة — كل زر ورابط في التطبيق يستجيب للمس */
    button{cursor:pointer;transition:all 0.15s ease;font-family:system-ui}
    button:hover:not(:disabled){filter:brightness(1.2);transform:translateY(-1px)}
    button:active:not(:disabled){transform:translateY(0) scale(0.97);filter:brightness(0.95)}
    button:disabled{cursor:not-allowed}
    a{transition:all 0.15s ease}
    a:hover{filter:brightness(1.25)}
    button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid rgba(59,130,246,0.6);outline-offset:2px}
    select{cursor:pointer}
    textarea,input{font-family:system-ui;outline:none;transition:border-color 0.2s}
    textarea:focus,input:focus{border-color:rgba(59,130,246,0.5)!important}

    /* 💬 حيوية الشات: زر النسخ يظهر عند المرور، والفقاعات تنساب */
    .feed-msg .msg-copy{opacity:0;transition:opacity 0.15s}
    .feed-msg:hover .msg-copy{opacity:0.7}
    .feed-msg .msg-copy:hover{opacity:1}
    @keyframes msgIn{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes avatarGlow{0%,100%{box-shadow:0 0 6px rgba(59,130,246,0.3)}50%{box-shadow:0 0 14px rgba(139,92,246,0.6)}}

    /* 🎴 نظام بطاقات موحّد — سطح زجاجي يرتفع قليلاً عند المرور */
    .jaola-card{background:rgba(255,255,255,0.025);border:1px solid #1a2332;border-radius:12px;transition:transform .18s ease,border-color .18s ease,background .18s ease}
    .jaola-card:hover{border-color:rgba(59,130,246,0.28);background:rgba(255,255,255,0.045)}
    .stat-tile{background:rgba(255,255,255,0.025);border:1px solid #1a2332;border-radius:10px;padding:10px 12px;transition:border-color .18s ease,background .18s ease}
    .stat-tile:hover{border-color:rgba(59,130,246,0.28);background:rgba(255,255,255,0.045)}
    /* 📊 مؤشر: أطراف مدوّرة، حركة انسيابية — بديل الشريط المسطّح 2px */
    .meter{height:6px;background:rgba(255,255,255,0.05);border-radius:999px;overflow:hidden}
    .meter>span{display:block;height:100%;border-radius:999px;transition:width .7s cubic-bezier(.4,0,.2,1)}
    .sec-title{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
    /* توهّج خلفي ناعم يعطي عمقاً بلا ضجيج */
    .glow-bg{position:relative}
    .glow-bg::before{content:'';position:absolute;inset:0;background:radial-gradient(60% 45% at 50% 0%,rgba(59,130,246,0.06),transparent 70%);pointer-events:none;z-index:0}
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
        {connectionError || t('connectionLost')}
      </span>
    </div>
  );

  // بث المهمة داخل الشات: الرسائل + بطاقة التقدم الحية
  const missionFeed = (
    <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8, minHeight:0 }}>
      {chatMessages.length === 0 && !isBuilding && (
        <div style={{ textAlign:'center', color:S.muted, fontSize:12, marginTop:40, lineHeight:2 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>⚡</div>
          {t('feedAsk')}<br/>
          <span style={{ fontSize:11, color:'#334155' }}>{t('feedHint')}</span>
        </div>
      )}
      {chatMessages.map((msg, i) => <FeedItem key={i} msg={msg} onOption={handleOptionClick} />)}
      {isBuilding && buildStartedAt && (
        <MissionProgress agentStates={agentStates} lastLog={lastLogMsg} startedAt={buildStartedAt} phase={missionPhase} />
      )}
      {isSending && !isBuilding && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#3b82f6', animation:'pulse 0.9s infinite' }} />
          <span style={{ fontSize:11, color:'#64748b' }}>{t('receiving')}</span>
        </div>
      )}
      <div ref={feedEndRef} />
    </div>
  );

  const quickBuilds = chatMessages.length === 0 && (
    <div style={{ padding:'12px 16px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
      <div className="sec-title" style={{ color:S.muted, marginBottom:8 }}>{t('quickLaunch')}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {QUICK_BUILDS.map((b, i) => (
          <button key={i} onClick={() => { setPrompt(t(b.promptKey)); textareaRef.current?.focus(); }}
            className="stat-tile"
            style={{ color:S.muted, fontSize:11, textAlign:'start', display:'flex', alignItems:'center', gap:6, padding:'8px 10px' }}>
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
      currentUser={currentUser && currentUser !== 'guest_user' ? currentUser : authUser}
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
        <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, marginBottom:6 }}>🐙 {t('ghIntegration')}</h3>
        <p style={{ color:S.muted, fontSize:12, marginBottom:12 }}>
          {activeProject}
          {ghStatus?.connected && <span style={{ color:'#10b981' }}> {t('ghConnected')}</span>}
        </p>

        <p style={{ color:'#93c5fd', fontSize:11, lineHeight:1.6, background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:8, padding:'8px 10px', marginBottom:16 }}>
          🖥️ {t('ghRenderHint')}
        </p>

        <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>{t('ghRepoUrl')}</label>
        <input value={ghForm.repoUrl} onChange={e => setGhForm(f => ({ ...f, repoUrl: e.target.value }))}
          placeholder="https://github.com/username/repo.git" dir="ltr"
          style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, margin:'6px 0 12px', fontFamily:'monospace' }} />

        <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>
          {t('ghToken')} {ghStatus?.hasToken && <span style={{ color:'#10b981', fontWeight:400 }}>{t('ghTokenSaved')}</span>}
        </label>
        <input value={ghForm.pat} onChange={e => setGhForm(f => ({ ...f, pat: e.target.value }))}
          placeholder="ghp_..." type="password" dir="ltr"
          style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, margin:'6px 0 12px', fontFamily:'monospace' }} />

        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:120 }}>
            <label style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px' }}>{t('ghBranch')}</label>
            <input value={ghForm.branch} onChange={e => setGhForm(f => ({ ...f, branch: e.target.value }))}
              placeholder="main" dir="ltr"
              style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, marginTop:6, fontFamily:'monospace' }} />
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginTop:18, fontSize:12, color:'#94a3b8' }}>
            <input type="checkbox" checked={ghForm.autoCommit}
              onChange={e => setGhForm(f => ({ ...f, autoCommit: e.target.checked }))}
              style={{ accentColor:'#3b82f6', width:15, height:15 }} />
            {t('ghAutoPush')}
          </label>
        </div>

        {ghStatus?.lastCommit && (
          <p style={{ color:S.muted, fontSize:10, marginBottom:12 }}>{t('ghLastPush')} {new Date(ghStatus.lastCommit).toLocaleString()}</p>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={() => setShowGithubModal(false)}
            style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 16px', color:S.muted, fontSize:13 }}>{t('cancel')}</button>
          {ghStatus?.connected && (
            <button onClick={handleGithubPush}
              style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, padding:'8px 16px', color:'#10b981', fontWeight:700, fontSize:13 }}>
              {t('ghPushNow')}
            </button>
          )}
          <button onClick={handleGithubConnect} disabled={isGhSaving}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:'8px 20px', color:'#fff', fontWeight:700, fontSize:13, opacity: isGhSaving ? 0.7 : 1 }}>
            {isGhSaving ? t('ghSaving') : t('ghSaveConnect')}
          </button>
        </div>
      </div>
    </div>
  );

  // 📚 لوحة «معرفة المنصّة» — تجعل الفهم المتراكم مرئياً (المشروع + الفئات + الدروس)
  const knowledgeModal = showKnowledgeModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowKnowledgeModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:'22px 20px', width:'min(560px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800 }}>📚 {t('knTitle')}</h3>
          <button onClick={() => setShowKnowledgeModal(false)}
            style={{ background:'transparent', border:'none', color:S.muted, fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {knowledgeLoading && <p style={{ color:S.muted, fontSize:13 }}>{t('knLoading')}</p>}
        {!knowledgeLoading && knowledge?.error && <p style={{ color:S.danger, fontSize:13 }}>{t('serverUnreachable')}</p>}

        {!knowledgeLoading && knowledge && !knowledge.error && (
          <>
            {/* فهم المشروع الحالي */}
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:8 }}>{t('knProject')} — {activeProject}</p>
              {knowledge.projectModel ? (
                <div style={{ background:'#161b22', border:`1px solid ${S.border}`, borderRadius:10, padding:'12px 14px' }}>
                  <p style={{ color:S.accent, fontSize:12, marginBottom:10 }}>{knowledge.projectSummary}</p>
                  {['entities','roles','flows'].map(kind => (knowledge.projectModel[kind]?.length > 0) && (
                    <div key={kind} style={{ marginBottom:8 }}>
                      <span style={{ fontSize:10, color:S.muted, fontWeight:700 }}>{t('kn_'+kind)}: </span>
                      <span style={{ fontSize:12, color:'#cbd5e1' }}>
                        {knowledge.projectModel[kind].map(x => x.name).join('، ')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>{t('knNoModel')}</p>
              )}
            </div>

            {/* قوالب التطبيقات العاملة (كلون + بصمة) */}
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:8 }}>{t('knClones')}</p>
              {knowledge.clones?.length ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {knowledge.clones.map(c => (
                    <div key={c.id} style={{ background:'#161b22', border:'1px solid rgba(255,107,53,0.25)', borderRadius:10, padding:'10px 12px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ color:'#fff', fontSize:13, fontWeight:800 }}>🧩 {c.name}</span>
                        <span style={{ color:'#64748b', fontSize:9, fontFamily:'monospace' }}>{c.id}</span>
                        {c.externalApi && <span style={{ background:'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)', color:'#7dd3fc', fontSize:9, padding:'1px 6px', borderRadius:8 }}>🌐 API: {c.externalApi}</span>}
                      </div>
                      <div style={{ color:S.muted, fontSize:11, marginTop:3 }}>{c.description}</div>
                      <div style={{ color:'#ff9d6b', fontSize:10, marginTop:5 }}>{(c.roles||[]).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>{t('knClonesEmpty')}</p>
              )}
            </div>

            {/* مكتبة نماذج الفئات المتراكمة */}
            <div style={{ marginBottom:18 }}>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:8 }}>{t('knLibrary')}</p>
              {knowledge.library?.length ? (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {knowledge.library.map(c => (
                    <div key={c.category} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 12px' }}>
                      <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{c.category}</span>
                      <span style={{ color:S.muted, fontSize:11 }}>
                        {c.entities}🧩 · {c.roles}👤 · {c.flows}🔀 · <span style={{ color:S.good }}>{c.verified}✓</span>/{c.contributions}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>{t('knLibraryEmpty')}</p>
              )}
            </div>

            {/* الدروس المتراكمة */}
            <div>
              <p style={{ fontSize:10, color:S.muted, fontWeight:700, letterSpacing:'0.5px', marginBottom:8 }}>{t('knLessons')}</p>
              {knowledge.lessons?.length ? (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {knowledge.lessons.map((l, i) => (
                    <span key={i} style={{ background:'rgba(139,92,246,0.12)', border:'1px solid rgba(139,92,246,0.25)', borderRadius:14, padding:'4px 10px', fontSize:11, color:'#c4b5fd' }}>
                      {l.key} <span style={{ opacity:0.7 }}>×{l.count}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ color:S.muted, fontSize:12 }}>{t('knLessonsEmpty')}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const projectModal = showProjectModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowProjectModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:28, width:'min(360px, 100%)' }}>
        <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, marginBottom:6 }}>{t('newProjectTitle')}</h3>
        <p style={{ color:S.muted, fontSize:12, marginBottom:16 }}>{t('projectNameHint')}</p>
        <input value={newProjectName} onChange={e => { setNewProjectName(e.target.value); setCreateError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
          placeholder="my-awesome-project" autoFocus dir="ltr"
          style={{ width:'100%', background:'#161b22', border:`1px solid ${createError ? 'rgba(239,68,68,0.5)' : S.border}`, borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:14, marginBottom: createError ? 8 : 14, fontFamily:'monospace', textAlign:'left' }} />
        {createError && (
          <div style={{ color:'#f87171', fontSize:12, marginBottom:14 }}>{createError}</div>
        )}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={() => { setShowProjectModal(false); setCreateError(''); }}
            style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 16px', color:S.muted, fontSize:13 }}>{t('cancel')}</button>
          <button onClick={handleCreateProject} disabled={isCreating}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:'8px 20px', color:'#fff', fontWeight:700, fontSize:13, opacity: isCreating ? 0.6 : 1 }}>
            {isCreating ? t('creating') : t('create')}
          </button>
        </div>
      </div>
    </div>
  );

  // 🔑 نافذة أسرار المشروع (متغيّرات البيئة) — MONGODB_URI وغيرها
  const secretsModal = showSecretsModal && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)', padding:16 }}
      onClick={e => e.target === e.currentTarget && setShowSecretsModal(false)}>
      <div style={{ background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:24, width:'min(440px, 100%)', maxHeight:'90dvh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <span style={{ fontSize:18 }}>🔑</span>
          <h3 style={{ color:'#fff', fontSize:15, fontWeight:800, flex:1 }}>{t('secretsTitle')}</h3>
          <button onClick={() => setShowSecretsModal(false)} style={{ width:30, height:30, borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, color:S.muted, fontSize:14 }}>✕</button>
        </div>
        <p style={{ color:S.muted, fontSize:12, lineHeight:1.7, marginBottom:14 }}>{t('secretsHint')}</p>

        {/* تلميح MONGODB_URI للمشاريع full-stack */}
        <div style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:10, padding:'10px 12px', marginBottom:16, fontSize:11.5, color:'#6ee7b7', lineHeight:1.7 }}>
          🗄️ {t('secretsMongoHint')}
        </div>

        {/* المفاتيح الحالية */}
        {secretKeys.length > 0 && (
          <div style={{ marginBottom:16 }}>
            {secretKeys.map(k => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:8, padding:'8px 12px', marginBottom:6 }}>
                <span style={{ fontSize:13 }}>🔒</span>
                <span style={{ flex:1, fontSize:12.5, color:S.text, fontFamily:'monospace' }}>{k}</span>
                <span style={{ fontSize:10, color:S.dim }}>••••••••</span>
                <button onClick={() => handleDeleteSecret(k)} title={t('delete')} style={{ background:'transparent', border:'none', color:'#f87171', fontSize:13, padding:'2px 6px' }}>🗑️</button>
              </div>
            ))}
          </div>
        )}

        {/* إضافة سرّ */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <input value={newSecretKey} onChange={e => { setNewSecretKey(e.target.value.toUpperCase()); setSecretError(''); }}
            placeholder="MONGODB_URI" dir="ltr"
            style={{ width:'100%', background:'#161b22', border:`1px solid ${S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, fontFamily:'monospace', textAlign:'left' }} />
          <input value={newSecretVal} onChange={e => { setNewSecretVal(e.target.value); setSecretError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAddSecret()}
            placeholder={t('secretValuePlaceholder')} dir="ltr" type="password"
            style={{ width:'100%', background:'#161b22', border:`1px solid ${secretError ? 'rgba(239,68,68,0.5)' : S.border}`, borderRadius:8, padding:'10px 12px', color:'#fff', fontSize:13, fontFamily:'monospace', textAlign:'left' }} />
          {secretError && <div style={{ color:'#f87171', fontSize:12 }}>{secretError}</div>}
          <button onClick={handleAddSecret} disabled={secretBusy || !newSecretKey.trim() || !newSecretVal.trim()}
            style={{ background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', border:'none', borderRadius:8, padding:'10px', color:'#fff', fontWeight:700, fontSize:13, opacity: (secretBusy || !newSecretKey.trim() || !newSecretVal.trim()) ? 0.5 : 1 }}>
            {secretBusy ? '…' : `➕ ${t('secretAdd')}`}
          </button>
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

        {/* رأس مضغوط — الأساسي ظاهر، الثانوي في قائمة ⋯ (تفريغ الازدحام) */}
        <nav style={{ height:56, background:S.bg2, borderBottom:`1px solid ${S.border}`, display:'flex', alignItems:'center', padding:'0 12px', gap:8, flexShrink:0, position:'relative', zIndex:60 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>⚡</div>

          {/* منتقي المشروع — يأخذ المساحة المرنة ولا يطفح */}
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:4, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:10, paddingInlineStart:10, minWidth:0, height:40 }}>
            <select value={activeProject} onChange={e => handleSwitchProject(e.target.value)}
              style={{ flex:1, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:700, outline:'none', minWidth:0, textOverflow:'ellipsis' }}>
              {projects.map(p => <option key={p} value={p} style={{ background:'#161b22' }}>{p}</option>)}
            </select>
            <button onClick={() => setShowProjectModal(true)} title={t('newProject')}
              style={{ width:32, height:32, borderRadius:8, background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)', color:S.blue, fontSize:17, fontWeight:700, flexShrink:0, marginInlineEnd:3 }}>+</button>
          </div>

          {isBuilding && (
            <span style={{ display:'flex', alignItems:'center', flexShrink:0 }} title={t('building')}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#3b82f6', boxShadow:'0 0 8px #3b82f6', animation:'pulse 1s infinite' }} />
            </span>
          )}

          {/* رابط الموقع (إن وُجد) + زر النشر/إعادة النشر — الأخير يبقى دائماً */}
          {vercelUrl && (
            <a href={vercelUrl} target="_blank" rel="noreferrer" title={t('liveSite')} style={{ width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, textDecoration:'none', border:'1px solid rgba(16,185,129,0.35)', borderRadius:10, flexShrink:0 }}>🌍</a>
          )}
          <button onClick={handleDeploy} disabled={isDeploying} title={vercelUrl ? t('redeploy') : t('deploy')} style={{ width:40, height:40, background: vercelUrl ? 'rgba(59,130,246,0.14)' : 'linear-gradient(135deg,#1d4ed8,#4f46e5)', border: vercelUrl ? '1px solid rgba(59,130,246,0.3)' : 'none', borderRadius:10, color:'#fff', fontSize:16, opacity:isDeploying?0.6:1, flexShrink:0 }}>{isDeploying ? '⏳' : (vercelUrl ? '🔄' : '🚀')}</button>

          {/* قائمة الإجراءات الثانوية */}
          <button onClick={() => setShowMobileMenu(v => !v)} title="•••"
            style={{ width:40, height:40, borderRadius:10, background: showMobileMenu ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.03)', border:`1px solid ${showMobileMenu ? 'rgba(59,130,246,0.3)' : S.border}`, color:S.text, fontSize:20, lineHeight:1, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>⋯</button>

          {showMobileMenu && (
            <>
              <div onClick={() => setShowMobileMenu(false)} style={{ position:'fixed', inset:0, zIndex:59 }} />
              <div style={{ position:'absolute', top:'calc(100% + 6px)', insetInlineEnd:12, background:'#0d1117', border:`1px solid ${S.border}`, borderRadius:14, padding:8, minWidth:210, zIndex:61, boxShadow:'0 14px 44px rgba(0,0,0,0.55)', display:'flex', flexDirection:'column', gap:2, animation:'fadeIn 0.15s ease' }}>
                <div style={{ padding:'8px 10px 10px', display:'flex', alignItems:'center', gap:9, borderBottom:`1px solid ${S.border}`, marginBottom:5 }}>
                  <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:'#fff', flexShrink:0 }}>{(authUser || 'U')[0].toUpperCase()}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:S.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{authUser || 'guest'}</div>
                    <div style={{ fontSize:10, color: isConnected ? S.good : S.warn, fontWeight:600 }}>{isConnected ? '● ONLINE' : '● OFFLINE'}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderRadius:9, background:'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize:13, color:S.text }}>🌐 {t('language') || 'Language'}</span>
                  <LanguageSwitcher compact />
                </div>
                <button onClick={() => { setShowMobileMenu(false); setShowSiteHealth(true); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>📊</span> {t('siteHealth')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openGithubModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🐙</span> GitHub
                </button>
                <button onClick={() => { setShowMobileMenu(false); openKnowledgeModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>📚</span> {t('knTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); openSecretsModal(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🔑</span> {t('secretsTitle')}
                </button>
                <button onClick={() => { setShowMobileMenu(false); handleVercelCheck(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'transparent', border:'none', color:S.text, fontSize:13, fontWeight:600, textAlign:'start' }}>
                  <span style={{ fontSize:16 }}>🩺</span> {t('vercelCheck') || 'فحص النشر (Vercel)'}
                </button>
                <button onClick={() => { setShowMobileMenu(false); handleLogout(); }}
                  style={{ display:'flex', alignItems:'center', gap:9, padding:'11px 10px', borderRadius:9, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:13, fontWeight:700, textAlign:'start', marginTop:3 }}>
                  <span style={{ fontSize:16 }}>🚪</span> {t('exit') || 'Exit'}
                </button>
              </div>
            </>
          )}
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
                  placeholder={t('mobilePrompt')}
                  rows={2}
                  style={{ flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, borderRadius:12, padding:'10px 12px', color:S.text, fontSize:16, resize:'none', lineHeight:1.5 }} />
                {(isBuilding || isSending) && (
                  <button onClick={handleAbort} title={t('stopTitle')}
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

          {mobileView === 'logs' && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
              {/* تبديل: السجل الحي / الخط الزمني */}
              <div style={{ display:'flex', gap:4, padding:'8px 12px', borderBottom:`1px solid ${S.border}`, flexShrink:0 }}>
                {[['logs',t('liveLog')],['timeline',t('timelineTab')]].map(([mode, label]) => (
                  <button key={mode} onClick={() => setMobileLogsMode(mode)}
                    style={{
                      flex:1, padding:'6px', borderRadius:7, fontSize:11, fontWeight:700,
                      background: mobileLogsMode === mode ? 'rgba(59,130,246,0.12)' : 'transparent',
                      border:`1px solid ${mobileLogsMode === mode ? 'rgba(59,130,246,0.3)' : S.border}`,
                      color: mobileLogsMode === mode ? '#93c5fd' : S.muted,
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ flex:1, minHeight:0, overflow:'hidden' }}>
                {mobileLogsMode === 'logs' ? logsView : (
                  <TimelinePanel activeProject={activeProject} token={token}
                    onRestored={(h) => { addNotification(`${t('nRestored')} (${h})`, 'success'); refreshPreview(); }} />
                )}
              </div>
            </div>
          )}
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
                <span style={{ fontSize:9, fontWeight:700 }}>{t(tab.key)}</span>
                {isActive && <span style={{ position:'absolute', top:0, left:'25%', right:'25%', height:2, background:'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius:2 }} />}
                {showBadge && !isActive && <span style={{ position:'absolute', top:8, left:'calc(50% - 16px)', width:6, height:6, borderRadius:'50%', background: isBuilding ? '#3b82f6' : '#1f2937' }} />}
              </button>
            );
          })}
        </nav>

        {notificationsOverlay}
        {githubModal}
        {knowledgeModal}
        {projectModal}
        {secretsModal}

        {/* 📊 بطاقة حالة الموقع — مؤشرات الجودة على الجوال (بديل الشريط الجانبي) */}
        {showSiteHealth && (
          <div onClick={() => setShowSiteHealth(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'flex-end', backdropFilter:'blur(3px)' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width:'100%', background:'#0d1117', borderTop:`1px solid ${S.border}`, borderRadius:'18px 18px 0 0', padding:'16px 16px calc(20px + env(safe-area-inset-bottom))', animation:'fadeIn 0.2s ease' }}>
              <div style={{ width:38, height:4, borderRadius:2, background:S.border, margin:'0 auto 14px' }} />
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <span style={{ fontSize:17 }}>📊</span>
                <span style={{ fontSize:15, fontWeight:800, color:S.text, flex:1 }}>{t('siteHealth')}</span>
                <button onClick={() => setShowSiteHealth(false)} style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,0.04)', border:`1px solid ${S.border}`, color:S.muted, fontSize:15 }}>✕</button>
              </div>
              {metrics && (metrics.seo || metrics.security || metrics.quality || metrics.totalBuilds) ? (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'SEO', value: fmtScore(metrics?.seo), color: gradeColor(metrics?.seo?.grade) },
                    { label:'Security', value: fmtScore(metrics?.security), color: gradeColor(metrics?.security?.grade) },
                    { label:'Quality', value: fmtScore(metrics?.quality), color: gradeColor(metrics?.quality?.grade) },
                    { label:t('mBuilds'), value: metrics?.totalBuilds ?? 0, color:S.blue },
                    { label:t('mEdits'), value: metrics?.totalEdits ?? 0, color:S.purple },
                  ].map(m => (
                    <div key={m.label} className="stat-tile">
                      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
                        <span style={{ width:7, height:7, borderRadius:'50%', background:m.color, boxShadow:`0 0 6px ${m.color}88`, flexShrink:0 }} />
                        <span style={{ fontSize:10, color:S.muted, fontWeight:600 }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize:16, fontWeight:800, color:S.text, fontVariantNumeric:'tabular-nums' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding:'24px 12px', textAlign:'center', color:S.muted, fontSize:13 }}>{t('noMetricsYet')}</div>
              )}
            </div>
          </div>
        )}
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
          {!isConnected ? t('reconnecting') : isBuilding ? t('missionRunning') : t('operational')}
        </div>

        <div style={{ width:1, height:20, background:S.border }} />

        {/* معرفة المنصّة */}
        <button onClick={openKnowledgeModal} title={t('knTitle')}
          style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 12px', color:'#94a3b8', fontSize:11, fontWeight:600 }}>
          📚 {t('knTitle')}
        </button>

        {/* GitHub */}
        <button onClick={openGithubModal} title={t('githubTitle')}
          style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 12px', color:'#94a3b8', fontSize:11, fontWeight:600 }}>
          🐙 GitHub
        </button>

        {/* الأسرار (متغيّرات البيئة) */}
        <button onClick={openSecretsModal} title={t('secretsTitle')}
          style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 12px', color:'#94a3b8', fontSize:11, fontWeight:600 }}>
          🔑 {t('secretsShort')}
        </button>

        {/* Deploy — رابط الموقع (إن وُجد) + زر النشر/إعادة النشر دائماً حاضر */}
        {vercelUrl && (
          <a href={vercelUrl} target="_blank" rel="noreferrer" title={t('liveSite')}
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:7, padding:'5px 12px', color:'#10b981', fontSize:11, textDecoration:'none', fontWeight:600 }}>
            🌍 {t('liveSite')}
          </a>
        )}
        <button onClick={handleDeploy} disabled={isDeploying} title={vercelUrl ? t('redeploy') : t('deploy')}
          style={{ background: isDeploying ? 'rgba(59,130,246,0.1)' : (vercelUrl ? 'rgba(59,130,246,0.12)' : 'linear-gradient(135deg,#1d4ed8,#4f46e5)'), border: vercelUrl ? '1px solid rgba(59,130,246,0.3)' : 'none', borderRadius:7, padding:'5px 14px', color: vercelUrl ? '#93c5fd' : '#fff', fontSize:11, fontWeight:700, opacity: isDeploying ? 0.7 : 1 }}>
          {isDeploying ? `⏳ ${t('deploying')}` : (vercelUrl ? `🔄 ${t('redeploy')}` : `🚀 ${t('deploy')}`)}
        </button>

        {/* User */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${S.border}`, borderRadius:8, padding:'5px 12px' }}>
          <div style={{ width:22, height:22, borderRadius:6, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800 }}>
            {(authUser || 'U')[0].toUpperCase()}
          </div>
          <span style={{ fontSize:11, fontWeight:700, color:'#94a3b8' }}>{(authUser || '').toUpperCase()}</span>
        </div>

        <a href="/billing" title={t('billingTitle')}
          style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 10px', color:S.muted, fontSize:13, textDecoration:'none' }}>
          💳
        </a>

        <a href="/admin" title={t('adminTitle')}
          style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 10px', color:S.muted, fontSize:13, textDecoration:'none' }}>
          ⚙️
        </a>

        <LanguageSwitcher />

        <button onClick={handleLogout}
          style={{ background:'transparent', border:`1px solid ${S.border}`, borderRadius:7, padding:'5px 10px', color:S.muted, fontSize:11 }}>
          {t('exit')}
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
            {[t('qaColors'), t('qaSection'), t('qaFaster'), t('qaDeploy')].map(a => (
              <button key={a} onClick={() => setPrompt(a)}
                style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${S.border}`, borderRadius:20, padding:'4px 10px', color:S.muted, fontSize:10, fontWeight:600 }}>
                {a}
              </button>
            ))}
          </div>

          {/* Mission Input */}
          <div style={{ padding:'16px', borderTop:`1px solid ${S.border}`, flexShrink:0 }}>
            <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>⚡ Mission Control</div>
            <textarea ref={textareaRef} value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t('promptPlaceholder')}
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
                <span>{isSending ? t('sending') : t('execute')}</span>
                {!isSending && <span style={{ opacity:0.6, fontSize:10 }}>↵</span>}
              </button>
              {(isBuilding || isSending) && (
                <button onClick={handleAbort} title={t('stopMission')}
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
              { id:'preview', label:`🖥️ ${t('preview')}` },
              { id:'editor', label:`💻 ${t('code')}` },
              { id:'logs', label:`📋 ${t('logs')}${logs.length > 0 ? ` (${logs.length})` : ''}` },
              { id:'timeline', label:`🕘 ${t('timeline')}` },
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
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#10b981', animation:'pulse 1s infinite' }} /> {t('buildComplete')}
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
            {activeTab === 'preview' && previewView}
            {activeTab === 'editor' && <MonacoWorkspace />}
            {activeTab === 'logs' && logsView}
            {activeTab === 'timeline' && (
              <TimelinePanel activeProject={activeProject} token={token}
                onRestored={(h) => { addNotification(`${t('nRestored')} (${h})`, 'success'); refreshPreview(); }} />
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

          {/* Digital Twin — حالة السيرفر الحقيقية */}
          <div style={{ padding:'14px', borderBottom:`1px solid ${S.border}` }}>
            <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>⬡ Digital Twin</div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background: isConnected ? S.good : S.warn, boxShadow:`0 0 8px ${isConnected ? S.good : S.warn}`, animation:'pulse 1.6s infinite', flexShrink:0 }} />
              <span style={{ fontSize:20, fontWeight:900, letterSpacing:'0.5px', color: isConnected ? S.good : S.warn }}>
                {isConnected ? 'ONLINE' : 'OFFLINE'}
              </span>
              <span style={{ fontSize:10, color:S.muted, marginInlineStart:'auto' }}>Uptime {fmtUptime}</span>
            </div>
            <div className="meter">
              <span style={{ width: isConnected ? '100%' : '15%', background: isConnected ? 'linear-gradient(90deg,#10b981,#059669)' : S.warn, boxShadow:`0 0 8px ${isConnected ? S.good : S.warn}66` }} />
            </div>
          </div>

          {/* Metrics — مؤشرات النظام الحقيقية (مؤشرات مدوّرة، القيمة بالحبر النصّي) */}
          <div style={{ padding:14, borderBottom:`1px solid ${S.border}`, display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { label:'CPU', value: metrics?.system?.cpuPct != null ? `${metrics.system.cpuPct}%` : '—', pct: metrics?.system?.cpuPct ?? 0, color:S.blue },
              { label:'RAM', value: metrics?.system?.rssMb != null ? `${metrics.system.rssMb} MB` : '—', pct: Math.min(100, (metrics?.system?.rssMb ?? 0) / 5), color:S.purple },
              { label:'Latency', value: latencyMs != null ? `${latencyMs} ms` : '—', pct: Math.min(100, (latencyMs ?? 0) / 10), color: (latencyMs ?? 0) > 500 ? S.warn : S.good },
            ].map(m => (
              <div key={m.label}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:10, color:S.muted, fontWeight:600 }}>{m.label}</span>
                  <span style={{ fontSize:11, color:S.text, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{m.value}</span>
                </div>
                <div className="meter">
                  <span style={{ width:`${Math.max(m.pct, 2)}%`, background:m.color, boxShadow:`0 0 8px ${m.color}66` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Business Intelligence — بطاقات إحصاء: القيمة بالحبر، لون الحالة على النقطة */}
          <div style={{ padding:14, borderBottom:`1px solid ${S.border}` }}>
            <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>📊 {t('intelligence')}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {[
                { label:'SEO', value: fmtScore(metrics?.seo), color: gradeColor(metrics?.seo?.grade) },
                { label:'Security', value: fmtScore(metrics?.security), color: gradeColor(metrics?.security?.grade) },
                { label:'Quality', value: fmtScore(metrics?.quality), color: gradeColor(metrics?.quality?.grade) },
                { label:'Builds', value: metrics?.totalBuilds ?? 0, color:S.blue },
                { label:'Edits', value: metrics?.totalEdits ?? 0, color:S.purple },
              ].map(m => (
                <div key={m.label} className="stat-tile">
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:m.color, boxShadow:`0 0 6px ${m.color}88`, flexShrink:0 }} />
                    <span style={{ fontSize:9, color:S.muted, fontWeight:600, letterSpacing:'0.3px' }}>{m.label}</span>
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:S.text, fontVariantNumeric:'tabular-nums' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          {files.length > 0 && (
            <div style={{ padding:14, borderBottom:`1px solid ${S.border}` }}>
              <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>📁 Workspace</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { label:'Files', value: files.length },
                  { label:'Lines', value: activeFileContent.split('\n').length },
                ].map(s => (
                  <div key={s.label} className="stat-tile">
                    <div style={{ fontSize:9, color:S.muted, fontWeight:600 }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:S.text, marginTop:2, fontVariantNumeric:'tabular-nums' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          <div style={{ padding:14, flex:1 }}>
            <div className="sec-title" style={{ color:S.muted, marginBottom:10 }}>Files</div>
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
      {knowledgeModal}
      {projectModal}
      {secretsModal}
    </div>
  );
}
