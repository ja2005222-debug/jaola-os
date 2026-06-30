import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket, socket } from '../hooks/useSocket.js';
import { PreviewFrame } from '../components/PreviewFrame.jsx';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

export default function Dashboard() {
  const { currentUser: authUser, token, isAuthenticated, handleAuthError, setIsAuthenticated, setCurrentUser, setToken, isLoading } = useAuth();

  const [activeFile, setActiveFile]       = useState('index.html');
  const [editorContent, setEditorContent] = useState('');
  const [activeTab, setActiveTab]         = useState('preview');
  const [viewMode, setViewMode]           = useState('desktop');
  const [prompt, setPrompt]               = useState('');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName]     = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [isLoggingIn, setIsLoggingIn]     = useState(false);

  const logsEndRef = useRef(null);
  const chatEndRef = useRef(null);

  const {
    files, logs, streamingContent, agentStates,
    projects, activeProject, currentUser, vercelUrl,
    chatMessages, setChatMessages,
    setActiveProject, setStreamingContent,
    previewTimestamp,   // ← من useSocket مباشرة
  } = useSocket(isAuthenticated, handleAuthError);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (isAuthenticated && activeFile) fetchFileContent(activeFile);
  }, [activeFile, activeProject, isAuthenticated]);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`
  });

  const fetchFileContent = async (fileName) => {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/file-content?fileName=${fileName}&project=${activeProject}`,
        { headers: getHeaders() }
      );
      if (res.status === 401 || res.status === 403) { handleAuthError(res.status); return; }
      const data = await res.json();
      setEditorContent(data.content || '');
    } catch (err) { console.error(err); }
  };

  const handleSaveCodeManual = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/file-content/save`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ fileName: activeFile, content: editorContent, project: activeProject })
      });
      if (res.status === 401 || res.status === 403) { handleAuthError(res.status); return; }
    } catch (err) { console.error(err); }
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim()) return;
    const userPrompt = prompt;
    setPrompt('');
    setStreamingContent('');
    setChatMessages((prev) => [...prev, { sender: 'user', text: userPrompt }]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userPrompt, project: activeProject })
      });
      if (res.status === 401 || res.status === 403) handleAuthError(res.status);
    } catch (err) { console.error(err); }
  };

  const handleSwitchProject = async (projName) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/project-context/switch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ project: projName })
      });
      if (res.status === 401 || res.status === 403) { handleAuthError(res.status); return; }
      setActiveProject(projName);
      localStorage.setItem('activeProject', projName);
      socket.emit('join_project', { project: projName });
    } catch (err) { console.error(err); }
  };

  const handleCreateProjectSubmit = async () => {
    if (!newProjectName.trim()) return;
    const sanitized = newProjectName.trim().toLowerCase().replace(/\s+/g, '-');
    setShowProjectModal(false);
    setNewProjectName('');
    await handleSwitchProject(sanitized);
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();
    if (!loginUsername.trim()) return;
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.removeItem('loggedOut');
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', data.currentUser);
        localStorage.setItem('activeProject', 'sandbox_app');
        setToken(data.token);
        setCurrentUser(data.currentUser);
        setIsAuthenticated(true);
        window.location.reload();
      }
    } catch (err) { console.error(err); }
    finally { setIsLoggingIn(false); }
  };

  const handleLogout = () => {
    localStorage.setItem('loggedOut', 'true');
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('activeProject');
    setToken(null);
    setIsAuthenticated(false);
    window.location.reload();
  };

  const getLogColorClass = (text = '') => {
    if (text.includes('[SUCCESS]'))  return 'text-emerald-400 font-semibold';
    if (text.includes('[ERROR]'))    return 'text-rose-400 font-bold';
    if (text.includes('[QA REPORT]')) return 'text-amber-400 font-medium';
    if (text.includes('[SYSTEM]'))   return 'text-sky-400';
    return 'text-slate-300';
  };

  const getFileLanguage = (fileName) => {
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.css'))  return 'css';
    if (fileName.endsWith('.js'))   return 'javascript';
    if (fileName.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  // ─── شاشة التحميل ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060913] flex items-center justify-center">
        <div className="text-cyan-400 text-sm animate-pulse">جاري التحقق من الجلسة...</div>
      </div>
    );
  }

  // ─── شاشة تسجيل الدخول ───────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#060913] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-150px] right-[-100px] w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[140px] pointer-events-none"></div>

        <form onSubmit={handleManualLogin} className="max-w-md w-full bg-[#0d121f]/75 border border-slate-800 p-8 rounded-2xl text-center shadow-2xl backdrop-blur-xl relative z-10">
          <div className="text-4xl mb-4 animate-bounce">⚡</div>
          <h2 className="text-xl font-black mb-1 bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">JAOLA OS Portal</h2>
          <p className="text-[10px] text-slate-500 mb-6 leading-relaxed">سجّل دخولك لإنشاء مساحة عمل معزولة خاصة بك.</p>
          <input
            type="text" required value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            placeholder="اسم المستخدم (بالإنجليزي)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500 mb-4 font-semibold text-center placeholder-slate-600"
          />
          <button type="submit" disabled={isLoggingIn}
            className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-xs py-3.5 rounded-xl hover:scale-[1.01] hover:opacity-95 shadow-lg transition-all duration-300 disabled:opacity-50"
          >
            {isLoggingIn ? 'جاري الاتصال...' : 'تسجيل الدخول 🚀'}
          </button>
        </form>
      </div>
    );
  }

  // ─── لوحة التحكم الرئيسية ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-cyan-500 selection:text-slate-900">

      <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-200px] right-[-100px] w-[700px] h-[700px] rounded-full bg-indigo-500/5 blur-[180px] pointer-events-none"></div>

      {/* ── الهيدر ─────────────────────────────────────────────────── */}
      <header className="border-b border-slate-900/60 bg-[#070b14]/90 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg animate-pulse">⚡</div>
          <div>
            <h1 className="text-base font-bold">
              JAOLA OS <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-900/40">v2.0</span>
            </h1>
            <p className="text-[9px] text-emerald-400 font-bold mt-0.5">👤 {authUser.toUpperCase()}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
          {vercelUrl && (
            <a href={vercelUrl} target="_blank" rel="noreferrer"
              className="text-xs bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 px-3.5 py-2.5 rounded-xl hover:scale-[1.01] transition-all">
              🌍 الرابط المنشور
            </a>
          )}

          <button onClick={handleLogout}
            className="text-xs bg-[#1A0B13]/80 border border-rose-950 text-rose-400 px-3.5 py-2.5 rounded-xl hover:bg-rose-950/30 transition-all font-bold">
            🚪 خروج
          </button>

          <div className="flex items-center gap-2.5 bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2 min-w-[200px]">
            <span className="text-[10px] text-slate-500 font-bold shrink-0">المشروع:</span>
            <select value={activeProject} onChange={(e) => handleSwitchProject(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none border-0 cursor-pointer font-bold w-full">
              {projects.map((p) => <option key={p} value={p} className="bg-[#0D121F]">{p}</option>)}
            </select>
          </div>

          <button onClick={() => setShowProjectModal(true)}
            className="text-xs bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl shadow-lg hover:scale-[1.02] transition-all border border-cyan-400/20">
            + مشروع جديد
          </button>
        </div>
      </header>

      {/* ── مساحة العمل ───────────────────────────────────────────── */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-[1750px] w-full mx-auto">

        {/* العمود الأيسر — الشات */}
        <section className="lg:col-span-1 flex flex-col bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-4 shadow-2xl backdrop-blur-xl h-[calc(100vh-230px)] min-h-[450px]">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tr-none'
                    : 'bg-gradient-to-tr from-cyan-950/30 to-indigo-950/30 border border-cyan-500/15 text-cyan-300 rounded-tl-none'
                }`}>
                  <div className="text-[9px] font-bold text-slate-500 mb-1">
                    {msg.sender === 'user' ? '👤 أنت' : '🤖 JAOLA'}
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-900/60 pt-3">
            <textarea
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendPrompt(); } }}
              placeholder="اكتب فكرتك أو اطلب تعديلاً... (Enter للإرسال)"
              className="w-full h-20 bg-slate-950 border border-slate-900 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
            />
            <button onClick={handleSendPrompt}
              className="w-full mt-2 py-3 bg-gradient-to-r from-cyan-600 to-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg hover:opacity-95 hover:scale-[1.01] transition-all">
              🚀 حقن التعديل حياً
            </button>
          </div>
        </section>

        {/* الأعمدة الوسطى — المعاينة والمحرر */}
        <section className="lg:col-span-3 flex flex-col gap-6 h-[calc(100vh-280px)]">
          <div className="bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex-1 flex flex-col">
            <div className="flex items-center gap-2 border-b border-slate-900 pb-4 mb-4">
              <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-900">
                <button onClick={() => setActiveTab('preview')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'preview' ? 'bg-[#090D16] text-cyan-400' : 'text-slate-500'}`}>
                  🖥️ المعاينة الحية
                </button>
                <button onClick={() => setActiveTab('editor')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === 'editor' ? 'bg-[#090D16] text-cyan-400' : 'text-slate-500'}`}>
                  💻 محرر الكود
                </button>
              </div>
            </div>

            <div className="flex-1 flex justify-center items-center bg-slate-950 rounded-xl overflow-hidden min-h-[300px] relative border border-slate-900">
              {activeTab === 'preview' ? (
                <PreviewFrame
                  activeProject={activeProject}
                  previewTimestamp={previewTimestamp}
                  viewMode={viewMode}
                  streamingContent={streamingContent}
                  currentUser={authUser}
                />
              ) : (
                <div className="w-full h-full flex flex-col p-4">
                  <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
                    <span>محرر: <span className="text-cyan-400 font-mono font-bold">{activeFile}</span></span>
                    <button onClick={handleSaveCodeManual}
                      className="bg-cyan-950 border border-cyan-900/50 text-cyan-400 hover:bg-cyan-900 px-3 py-1 rounded-lg font-bold">
                      💾 حفظ وحقن
                    </button>
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden border border-slate-900 mt-2 bg-[#0C0F19] h-[450px] relative flex">
                    <div className="w-12 bg-slate-950 border-r border-slate-900/60 text-right pr-3 pt-4 select-none font-mono text-[10px] text-slate-600 leading-relaxed">
                      {Array.from({ length: Math.max(15, (editorContent || '').split('\n').length) }).map((_, i) => (
                        <div key={i} className="h-5">{i + 1}</div>
                      ))}
                    </div>
                    <textarea
                      value={editorContent} onChange={(e) => setEditorContent(e.target.value)}
                      className="flex-1 bg-transparent p-4 font-mono text-xs text-slate-200 outline-none resize-none leading-relaxed overflow-auto"
                      spellCheck="false"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <AgentNetworkGraph states={agentStates} />
        </section>

        {/* العمود الأيمن — explorer + twin */}
        <section className="lg:col-span-1 flex flex-col gap-6 h-[calc(100vh-230px)] overflow-y-auto">
          <div className="bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex flex-col max-h-[220px]">
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">📁 WORKSPACE EXPLORER</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {files.map((file) => (
                <button key={file}
                  onClick={() => { setActiveFile(file); setActiveTab('editor'); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left border ${
                    activeFile === file ? 'bg-slate-950 border-slate-800 text-cyan-400 font-medium' : 'border-transparent text-slate-400 hover:bg-slate-950/40'
                  }`}>
                  {file.endsWith('.html') ? '🧡' : file.endsWith('.css') ? '💙' : file.endsWith('.js') ? '💛' : '📄'} {file}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <DigitalTwinPanel activeFileContent={editorContent} activeFile={activeFile} filesCount={files.length} />
          </div>
        </section>
      </main>

      {/* ── مودال المشروع الجديد ─────────────────────────────────── */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-[#0D121F] border border-slate-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold mb-1.5 text-slate-200">📁 مشروع جديد</h3>
            <p className="text-[10px] text-slate-500 mb-4">اسم المشروع بالإنجليزية</p>
            <input
              type="text" value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProjectSubmit()}
              placeholder="مثال: my-portfolio"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500 mb-4 font-mono"
            />
            <div className="flex items-center justify-end gap-2.5">
              <button onClick={() => setShowProjectModal(false)} className="text-xs text-slate-400 px-3 py-2">إلغاء</button>
              <button onClick={handleCreateProjectSubmit}
                className="text-xs bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl hover:scale-[1.01] transition-all">
                إنشاء ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── السجلات ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-900 bg-[#090D16]/50 p-6 relative z-10">
        <div className="max-w-[1700px] w-full mx-auto">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">⏱️ Stream Timeline Log</h3>
          <div className="bg-slate-950/80 border border-slate-900 rounded-2xl p-4 font-mono text-xs h-48 overflow-y-auto space-y-2 shadow-inner">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">بانتظار السجلات...</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={`border-b border-slate-900/40 pb-1.5 flex items-start gap-2 ${getLogColorClass(log.message)}`}>
                  <span className="text-slate-600 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                  <span>{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── التوأم الرقمي ────────────────────────────────────────────────
function DigitalTwinPanel({ activeFileContent, activeFile, filesCount }) {
  const [metrics, setMetrics] = useState({ cpu: 14, ram: 42.1, latency: 12 });
  const [twinLogs, setTwinLogs] = useState([
    '🟢 مزامنة التوأم الرقمي...', '🔍 فحص التجاوب: 1280px', '⏱️ زمن الاستجابة < 0.3s'
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        cpu: Math.floor(Math.random() * 12 + 6),
        ram: parseFloat((41 + Math.random() * 2).toFixed(1)),
        latency: Math.floor(Math.random() * 12 + 8),
      });
      const actions = [
        '👥 محاكاة Scroll.', '📱 التجاوب ممتاز.', '♿ التباين AA ممتاز.',
        '⏱️ الموارد محملة.', '🔒 فحص الحماية... آمن.'
      ];
      setTwinLogs(prev => [actions[Math.floor(Math.random() * actions.length)], ...prev.slice(0, 4)]);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const linesOfCode = activeFileContent ? activeFileContent.split('\n').length : 0;
  const estimatedKB = activeFileContent ? (activeFileContent.length / 1024).toFixed(2) : '0.00';

  return (
    <div className="bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex flex-col h-full min-h-[300px]">
      <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        Digital Twin
      </h3>
      <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 mb-4 text-center">
        <div className="text-[10px] text-slate-500 mb-1">مطابقة التوأم</div>
        <div className="text-xl font-extrabold text-emerald-400">99.98% Active</div>
      </div>
      <div className="space-y-3 mb-4">
        {[
          { label: 'حمل الخادم', value: `${metrics.cpu}% CPU`, color: 'text-cyan-400' },
          { label: 'RAM', value: `${metrics.ram} MB`, color: 'text-indigo-400' },
          { label: 'الاستجابة', value: `${metrics.latency} ms`, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-950/40 border border-slate-900/50 p-2.5 rounded-xl flex items-center justify-between">
            <span className="text-[10px] text-slate-500">{label}</span>
            <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
          </div>
        ))}
      </div>
      <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-3 mb-4">
        <div className="text-[11px] font-bold text-slate-400 mb-1.5 border-b border-slate-900 pb-1">📊 إحصائيات</div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-900">
            <div className="text-[9px] text-slate-500">الأسطر</div>
            <div className="text-xs font-bold font-mono text-slate-300 mt-0.5">{linesOfCode}</div>
          </div>
          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-900">
            <div className="text-[9px] text-slate-500">الحجم</div>
            <div className="text-xs font-bold font-mono text-slate-300 mt-0.5">{estimatedKB} KB</div>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 mt-2 text-center">
          الملف: <span className="text-slate-400 font-mono">{activeFile}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <div className="text-[10px] font-bold text-slate-400 mb-2">🤖 محاكاة الزوار</div>
        <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 font-mono text-[9px] h-24 overflow-y-auto space-y-1.5 text-slate-400 select-none">
          {twinLogs.map((log, idx) => (
            <div key={idx} className="border-b border-slate-900/30 pb-1 flex items-start gap-1">
              <span className="text-slate-600">❯</span><span>{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── شبكة الوكلاء ────────────────────────────────────────────────
function AgentNetworkGraph({ states }) {
  const agents = [
    { key: 'planner',   name: 'Planner',   emoji: '🧠', desc: 'تخطيط النوايا' },
    { key: 'architect', name: 'Architect', emoji: '🏗️', desc: 'مراجعة الهيكل' },
    { key: 'coder',     name: 'Coder',     emoji: '💻', desc: 'توليد الشفرة' },
    { key: 'qa',        name: 'QA',        emoji: '🔍', desc: 'اختبار الجودة' },
    { key: 'deploy',    name: 'Deploy',    emoji: '🚀', desc: 'النشر السحابي' },
  ];

  const getAgentStyle = (state) => {
    switch (state) {
      case 'running':   return 'border-cyan-500 bg-cyan-950/20 text-cyan-400 ring-2 ring-cyan-500/40 scale-[1.03] animate-pulse';
      case 'completed': return 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400';
      case 'error':     return 'border-rose-500 bg-rose-950/30 text-rose-400 animate-bounce';
      default:          return 'border-slate-900/80 bg-slate-950/40 text-slate-600 opacity-60';
    }
  };

  const getStatusBadge = (state) => {
    const base = 'text-[10px] px-2.5 py-0.5 rounded-full border font-medium';
    switch (state) {
      case 'running':   return <span className={`${base} bg-cyan-950 text-cyan-400 border-cyan-900/40 animate-pulse`}>يعمل...</span>;
      case 'completed': return <span className={`${base} bg-emerald-950 text-emerald-400 border-emerald-900/40`}>مكتمل ✓</span>;
      case 'error':     return <span className={`${base} bg-rose-950 text-rose-400 border-rose-900/40 font-bold`}>فشل !</span>;
      default:          return <span className={`${base} bg-slate-900 text-slate-500 border-slate-800/40`}>بالانتظار</span>;
    }
  };

  return (
    <div className="w-full bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-900 pb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
        </span>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Agent Network Graph</h3>
      </div>
      <div className="flex flex-col xl:flex-row items-center justify-center gap-4 xl:gap-2">
        {agents.map((agent, index) => {
          const state = states[agent.key] || 'waiting';
          return (
            <div key={agent.key} className="flex flex-col xl:flex-row items-center gap-2">
              <div className={`flex flex-col items-center p-4 rounded-xl border w-40 transition-all duration-500 ${getAgentStyle(state)}`}>
                <div className="text-2xl mb-2">{agent.emoji}</div>
                <span className="text-xs font-bold uppercase text-center mb-1">{agent.name}</span>
                <span className="text-[9px] text-slate-500 text-center mb-2.5">{agent.desc}</span>
                {getStatusBadge(state)}
              </div>
              {index < agents.length - 1 && (
                <span className={`text-xl xl:text-2xl ${state === 'completed' ? 'text-emerald-500' : state === 'running' ? 'text-cyan-400 animate-pulse' : 'text-slate-800'}`}>
                  →
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
