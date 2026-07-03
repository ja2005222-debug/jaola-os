import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket, socket } from '../hooks/useSocket.js';
import { PreviewFrame } from '../components/PreviewFrame.jsx';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

const QUICK_BUILDS = [
  { icon: '🛒', label: 'متجر إلكتروني', prompt: 'ابني متجر إلكتروني احترافي' },
  { icon: '🏥', label: 'عيادة طبية', prompt: 'ابني موقع عيادة طبية متخصصة' },
  { icon: '🍽️', label: 'مطعم', prompt: 'ابني موقع مطعم فاخر مع حجز طاولات' },
  { icon: '🏨', label: 'فندق', prompt: 'ابني موقع فندق فاخر مع نظام حجز' },
  { icon: '💼', label: 'بورتفوليو', prompt: 'ابني معرض أعمال احترافي' },
  { icon: '🎓', label: 'منصة تعليمية', prompt: 'ابني منصة تعليمية مع دورات ودفع' },
];

const BOOT_MESSAGES = [
  'Initializing JAOLA OS...',
  'Connecting AI Company...',
  'Loading Knowledge Base...',
  'Hiring AI Agents...',
  'Mission Control Ready ✓',
];

function BootScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step < BOOT_MESSAGES.length) {
      const t = setTimeout(() => setStep(s => s + 1), step === BOOT_MESSAGES.length - 1 ? 800 : 600);
      return () => clearTimeout(t);
    } else {
      setTimeout(onComplete, 400);
    }
  }, [step, onComplete]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#050810',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, gap: '32px'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 20px', boxShadow: '0 0 40px rgba(59,130,246,0.4)'
        }}>⚡</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>JAOLA OS</div>
        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>Autonomous Software Engineering</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 280 }}>
        {BOOT_MESSAGES.slice(0, step).map((msg, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            opacity: i < step - 1 ? 0.5 : 1,
            transition: 'opacity 0.3s'
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i < step - 1 ? '#10b981' : '#3b82f6',
              boxShadow: i === step - 1 ? '0 0 8px #3b82f6' : 'none'
            }} />
            <span style={{ fontSize: 12, color: i < step - 1 ? '#6b7280' : '#d1d5db', fontFamily: 'monospace' }}>
              {msg}
            </span>
          </div>
        ))}
      </div>

      <div style={{ width: 200, height: 2, background: '#111827', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          width: `${(step / BOOT_MESSAGES.length) * 100}%`,
          transition: 'width 0.5s ease'
        }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { currentUser: authUser, token, isAuthenticated, handleAuthError, setIsAuthenticated, setCurrentUser, setToken, isLoading } = useAuth();
  const [booted, setBooted] = useState(false);
  const [activeTab, setActiveTab] = useState('preview');
  const [prompt, setPrompt] = useState('');
  const [activeFile, setActiveFile] = useState('index.html');
  const [editorContent, setEditorContent] = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const logsEndRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  const {
    files, logs, streamingContent, agentStates,
    projects, activeProject, currentUser, vercelUrl,
    chatMessages, setChatMessages,
    setActiveProject, setStreamingContent,
    previewTimestamp,
  } = useSocket(isAuthenticated, handleAuthError);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
  useEffect(() => { if (activeTab === 'logs') logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs, activeTab]);
  useEffect(() => { if (isAuthenticated && activeFile) fetchFileContent(activeFile); }, [activeFile, activeProject, isAuthenticated]);

  const getHeaders = () => ({ 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' });

  const fetchFileContent = async (file) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/file?name=${encodeURIComponent(file)}&project=${activeProject}`, { headers: getHeaders() });
      if (res.ok) { const d = await res.json(); setEditorContent(d.content || ''); }
    } catch {}
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim()) return;
    const msg = prompt.trim();
    setPrompt('');
    setChatMessages(prev => [...prev, { sender: 'user', text: msg }]);
    try {
      await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: msg, project: activeProject }),
      });
    } catch {}
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      await fetch(`${BACKEND_URL}/api/deploy`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ project: activeProject }) });
    } catch {}
    setTimeout(() => setIsDeploying(false), 5000);
  };

  const handleSaveCode = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/file`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ name: activeFile, content: editorContent, project: activeProject }),
      });
    } catch {}
  };

  const handleSwitchProject = (p) => { setActiveProject(p); setEditorContent(''); };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await fetch(`${BACKEND_URL}/api/projects`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ name: newProjectName }),
      });
      setActiveProject(newProjectName);
      setShowProjectModal(false);
      setNewProjectName('');
    } catch {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim()) return;
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/offline-login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername }),
      });
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
  };

  const getLogColor = (msg = '') => {
    if (msg.includes('✅') || msg.includes('نجاح')) return '#10b981';
    if (msg.includes('❌') || msg.includes('فشل')) return '#ef4444';
    if (msg.includes('⚠️')) return '#f59e0b';
    if (msg.includes('🎨') || msg.includes('Designer')) return '#a78bfa';
    if (msg.includes('💻') || msg.includes('Coder')) return '#60a5fa';
    return '#6b7280';
  };

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050810' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!isAuthenticated) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050810' }}>
      <div style={{ background: '#0d1117', border: '1px solid #1f2937', borderRadius: 16, padding: '40px', width: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚡</div>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>JAOLA OS</h1>
        <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 28 }}>Autonomous Software Engineering</p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input value={loginUsername} onChange={e => setLoginUsername(e.target.value)}
            placeholder="اسم المستخدم" required
            style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none' }} />
          <button type="submit" disabled={isLoggingIn}
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: 8, padding: '11px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
            {isLoggingIn ? 'جاري الدخول...' : 'دخول إلى JAOLA OS'}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!booted) return <BootScreen onComplete={() => setBooted(true)} />;

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', background: '#050810', color: '#e2e8f0', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 2px; }
        textarea:focus, input:focus { outline: none; }
        button { cursor: pointer; transition: all 0.15s; }
        button:hover { opacity: 0.85; }
      `}</style>

      {/* TOP NAV */}
      <nav style={{ height: 48, background: '#0d1117', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>⚡</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>JAOLA OS</span>
          <span style={{ fontSize: 10, color: '#3b82f6', background: '#1e3a5f', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>v2.0</span>
        </div>

        <div style={{ width: 1, height: 20, background: '#1f2937', margin: '0 4px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '4px 10px', flex: 1, maxWidth: 260 }}>
          <span style={{ fontSize: 11, color: '#4b5563' }}>المشروع:</span>
          <select value={activeProject} onChange={e => handleSwitchProject(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: '#d1d5db', fontSize: 12, fontWeight: 600, flex: 1, cursor: 'pointer' }}>
            {projects.map(p => <option key={p} value={p} style={{ background: '#161b22' }}>{p}</option>)}
          </select>
          <button onClick={() => setShowProjectModal(true)}
            style={{ background: '#21262d', border: '1px solid #30363d', borderRadius: 5, padding: '2px 8px', color: '#8b949e', fontSize: 11 }}>
            + جديد
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {vercelUrl ? (
          <a href={vercelUrl} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0d2818', border: '1px solid #16a34a', borderRadius: 7, padding: '5px 12px', color: '#4ade80', fontSize: 12, textDecoration: 'none' }}>
            🌍 الموقع المنشور
          </a>
        ) : (
          <button onClick={handleDeploy} disabled={isDeploying}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#065f46,#0d9488)', border: 'none', borderRadius: 7, padding: '5px 14px', color: '#fff', fontSize: 12, fontWeight: 600 }}>
            {isDeploying ? '⏳ جاري النشر...' : '🚀 نشر الموقع'}
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#161b22', border: '1px solid #30363d', borderRadius: 7, padding: '5px 10px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{(authUser || '').toUpperCase()}</span>
        </div>

        <button onClick={handleLogout}
          style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 7, padding: '5px 10px', color: '#6b7280', fontSize: 11 }}>
          خروج
        </button>
      </nav>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: 'calc(100vh - 48px)' }}>

        {/* LEFT: COMMAND CENTER */}
        <div style={{ width: sidebarCollapsed ? 48 : 360, minWidth: sidebarCollapsed ? 48 : 360, background: '#0d1117', borderRight: '1px solid #1f2937', display: 'flex', flexDirection: 'column', transition: 'width 0.2s, min-width 0.2s', overflow: 'hidden', position: 'relative', height: '100%' }}>

          {/* Collapse toggle */}
          <button onClick={() => setSidebarCollapsed(v => !v)}
            style={{ position: 'absolute', top: 12, right: -12, width: 24, height: 24, borderRadius: '50%', background: '#1f2937', border: '1px solid #374151', color: '#6b7280', fontSize: 12, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sidebarCollapsed ? '›' : '‹'}
          </button>

          {!sidebarCollapsed && <>
            {/* Chat Messages - في الأعلى */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
              {chatMessages.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⚡</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>JAOLA OS جاهز</div>
                    <div style={{ fontSize: 12, color: '#4b5563' }}>صف ما تريد بناءه</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
                    {QUICK_BUILDS.map((b, i) => (
                      <button key={i} onClick={() => { setPrompt(b.prompt); textareaRef.current?.focus(); }}
                        style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '8px 10px', color: '#9ca3af', fontSize: 11, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{b.icon}</span><span>{b.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ animation: 'fadeIn 0.2s ease', flexShrink: 0 }}>
                  {msg.sender === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ background: '#1d4ed8', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', maxWidth: '85%', fontSize: 12, color: '#fff', lineHeight: 1.6 }}>
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, marginTop: 2 }}>⚡</div>
                      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '2px 12px 12px 12px', padding: '8px 12px', maxWidth: '85%', fontSize: 12, color: '#d1d5db', lineHeight: 1.7 }}>
                        <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>JAOLA</div>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Mission Input - في الأسفل */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid #1f2937', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 10 }}>
                ⚡ Mission Control
              </div>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendPrompt(); } }}
                  placeholder="ما الذي تريد شركتك الذكية أن تبني اليوم؟"
                  rows={3}
                  style={{
                    width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 10,
                    padding: '12px', color: '#e2e8f0', fontSize: 13, resize: 'none',
                    lineHeight: 1.6, paddingBottom: 40
                  }}
                />
                <button onClick={handleSendPrompt}
                  style={{
                    position: 'absolute', bottom: 8, left: 8, right: 8,
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: 7,
                    padding: '8px', color: '#fff', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}>
                  <span>إرسال المهمة</span><span style={{ opacity: 0.7 }}>↵</span>
                </button>
              </div>
            </div>

            {/* Quick Builds */}
            {chatMessages.length === 0 && (
              <div style={{ padding: '0 16px 12px' }}>
                <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 8 }}>بناء سريع</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {QUICK_BUILDS.map((b, i) => (
                    <button key={i} onClick={() => { setPrompt(b.prompt); textareaRef.current?.focus(); }}
                      style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '8px 10px', color: '#9ca3af', fontSize: 11, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{b.icon}</span><span>{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ width: 1, height: 1, background: '#1f2937', margin: '0 16px' }} />

            {/* Chat Messages */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ animation: 'fadeIn 0.2s ease' }}>
                  {msg.sender === 'user' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ background: '#1d4ed8', borderRadius: '12px 12px 2px 12px', padding: '8px 12px', maxWidth: '85%', fontSize: 12, color: '#fff', lineHeight: 1.6 }}>
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, marginTop: 2 }}>⚡</div>
                      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '2px 12px 12px 12px', padding: '8px 12px', maxWidth: '85%', fontSize: 12, color: '#d1d5db', lineHeight: 1.7 }}>
                        <div style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>JAOLA</div>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #1f2937', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['غير الألوان', 'أضف قسماً', 'اجعله أبسط', 'أضف قسم تواصل'].map(a => (
                <button key={a} onClick={() => setPrompt(a)}
                  style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 20, padding: '4px 10px', color: '#6b7280', fontSize: 11 }}>
                  {a}
                </button>
              ))}
            </div>
          </>}

          {sidebarCollapsed && (
            <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 14 }}>💬</span>
              <span style={{ fontSize: 14 }}>📁</span>
            </div>
          )}
        </div>

        {/* CENTER: PREVIEW */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ height: 44, background: '#0d1117', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 2, flexShrink: 0 }}>
            {[
              { id: 'preview', label: '🖥️ معاينة' },
              { id: 'editor', label: '💻 كود' },
              { id: 'logs', label: '📋 سجل' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? '#161b22' : 'transparent',
                  border: activeTab === tab.id ? '1px solid #30363d' : '1px solid transparent',
                  borderRadius: 7, padding: '5px 14px', color: activeTab === tab.id ? '#e2e8f0' : '#6b7280',
                  fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400
                }}>
                {tab.label}
              </button>
            ))}
            {logs.length > 0 && activeTab !== 'logs' && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', marginRight: 4, animation: 'pulse 1.5s infinite' }} />
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {activeTab === 'preview' && (
              <PreviewFrame activeProject={activeProject} previewTimestamp={previewTimestamp} streamingContent={streamingContent} currentUser={authUser} />
            )}

            {activeTab === 'editor' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 8, borderBottom: '1px solid #1f2937', flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                    {files.map(f => (
                      <button key={f} onClick={() => setActiveFile(f)}
                        style={{
                          background: activeFile === f ? '#1d4ed8' : '#161b22',
                          border: `1px solid ${activeFile === f ? '#3b82f6' : '#30363d'}`,
                          borderRadius: 6, padding: '3px 10px', color: activeFile === f ? '#fff' : '#9ca3af', fontSize: 11
                        }}>
                        {f.endsWith('.html') ? '🧡' : f.endsWith('.css') ? '💙' : f.endsWith('.js') ? '💛' : '📄'} {f}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleSaveCode}
                    style={{ background: '#0d2818', border: '1px solid #166534', borderRadius: 7, padding: '5px 14px', color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                    💾 حفظ
                  </button>
                </div>
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  <div style={{ width: 40, background: '#0a0f17', borderRight: '1px solid #1f2937', padding: '12px 0', textAlign: 'center', userSelect: 'none', overflowY: 'hidden' }}>
                    {(editorContent || '').split('\n').slice(0, 500).map((_, i) => (
                      <div key={i} style={{ fontSize: 10, color: '#374151', lineHeight: '20px', height: 20 }}>{i + 1}</div>
                    ))}
                  </div>
                  <textarea value={editorContent} onChange={e => setEditorContent(e.target.value)}
                    style={{ flex: 1, background: '#0d1117', border: 'none', padding: '12px 16px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, resize: 'none', lineHeight: '20px', overflowY: 'auto' }}
                    spellCheck={false} />
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div style={{ height: '100%', overflowY: 'auto', padding: '12px 16px', background: '#0d1117', fontFamily: 'monospace', fontSize: 11 }}>
                {logs.length === 0 && <div style={{ color: '#374151', textAlign: 'center', marginTop: 40 }}>في انتظار المهام...</div>}
                {logs.map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '3px 0', borderBottom: '1px solid #0f1923', animation: 'fadeIn 0.15s ease' }}>
                    <span style={{ color: '#374151', flexShrink: 0, fontSize: 10 }}>{new Date().toLocaleTimeString()}</span>
                    <span style={{ color: getLogColor(log.message) }}>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>

          {/* Agent Timeline */}
          <div style={{ height: 56, background: '#0a0f17', borderTop: '1px solid #1f2937', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 0, overflowX: 'auto', flexShrink: 0 }}>
            {Object.entries(agentStates || {}).map(([name, state], i, arr) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '0 12px' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: state === 'completed' ? '#0d2818' : state === 'running' ? 'rgba(59,130,246,0.15)' : '#161b22',
                    border: `1px solid ${state === 'completed' ? '#166534' : state === 'running' ? '#3b82f6' : '#21262d'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                    animation: state === 'running' ? 'pulse 1s infinite' : 'none',
                    boxShadow: state === 'running' ? '0 0 8px rgba(59,130,246,0.3)' : 'none'
                  }}>
                    {state === 'completed' ? '✓' : state === 'running' ? '⟳' : '·'}
                  </div>
                  <span style={{ fontSize: 9, color: state === 'completed' ? '#4ade80' : state === 'running' ? '#60a5fa' : '#374151', fontWeight: state !== 'waiting' ? 600 : 400 }}>
                    {name}
                  </span>
                </div>
                {i < arr.length - 1 && <div style={{ width: 20, height: 1, background: '#1f2937', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: INTELLIGENCE PANEL */}
        <div style={{ width: 220, minWidth: 220, background: '#0d1117', borderLeft: '1px solid #1f2937', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
          {/* Digital Twin Header */}
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #1f2937' }}>
            <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 10 }}>⬡ Digital Twin</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>99.98%</span>
              <span style={{ fontSize: 11, color: '#4b5563' }}>Active</span>
            </div>
          </div>

          {/* Metrics */}
          <div style={{ padding: 14, borderBottom: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'حمل الخادم', value: '14%', bar: 14 },
              { label: 'RAM', value: '42 MB', bar: 28 },
              { label: 'الاستجابة', value: '11 ms', bar: 8 },
            ].map(m => (
              <div key={m.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{m.label}</span>
                  <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 600 }}>{m.value}</span>
                </div>
                <div style={{ height: 3, background: '#161b22', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${m.bar}%`, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          {files.length > 0 && (
            <div style={{ padding: 14, borderBottom: '1px solid #1f2937' }}>
              <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 10 }}>إحصائيات</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'الأسطر', value: editorContent.split('\n').length },
                  { label: 'الملفات', value: files.length },
                ].map(s => (
                  <div key={s.label} style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: '#4b5563' }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Explorer */}
          <div style={{ padding: 14, flex: 1 }}>
            <div style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600, marginBottom: 10 }}>📁 الملفات</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {files.map(f => (
                <button key={f} onClick={() => { setActiveFile(f); setActiveTab('editor'); }}
                  style={{
                    background: activeFile === f ? '#1d4ed820' : 'transparent',
                    border: `1px solid ${activeFile === f ? '#3b82f640' : 'transparent'}`,
                    borderRadius: 6, padding: '5px 8px', color: activeFile === f ? '#93c5fd' : '#6b7280',
                    fontSize: 11, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 6
                  }}>
                  <span style={{ fontSize: 12 }}>{f.endsWith('.html') ? '🧡' : f.endsWith('.css') ? '💙' : f.endsWith('.js') ? '💛' : '📄'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setShowProjectModal(false)}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 14, padding: 28, width: 360 }}>
            <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: 16, fontWeight: 700 }}>مشروع جديد</h3>
            <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
              placeholder="اسم المشروع (بالإنجليزية)"
              autoFocus
              style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowProjectModal(false)}
                style={{ background: 'transparent', border: '1px solid #30363d', borderRadius: 8, padding: '8px 16px', color: '#6b7280', fontSize: 13 }}>إلغاء</button>
              <button onClick={handleCreateProject}
                style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontWeight: 700, fontSize: 13 }}>إنشاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
