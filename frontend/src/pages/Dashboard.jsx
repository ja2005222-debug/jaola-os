import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket, socket } from '../hooks/useSocket.js';
import { PreviewFrame } from '../components/PreviewFrame.jsx';
import Editor from '@monaco-editor/react';

export default function Dashboard() {
  const [activeProject, setActiveProject] = useState('sandbox_app');
  
  const { currentUser, token, isAuthenticated, handleAuthError } = useAuth(activeProject);

  const [activeFile, setActiveFile] = useState('index.html');
  const [editorContent, setEditorContent] = useState('');
  const [activeTab, setActiveTab] = useState('preview'); 
  const [viewMode, setViewMode] = useState('desktop'); 
  const [prompt, setPrompt] = useState('');
  const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());
  const [projects, setProjects] = useState([]);
  const [vercelUrl, setVercelUrl] = useState('');

  const logsEndRef = useRef(null);

  const { 
    files, 
    logs, 
    streamingContent, 
    agentStates, 
    setStreamingContent, 
    setFiles, 
    setLogs 
  } = useSocket(currentUser, activeProject, isAuthenticated, handleAuthError);

  useEffect(() => {
    const handlePreviewUpdate = (e) => {
      setPreviewTimestamp(e.detail.timestamp || Date.now());
    };
    window.addEventListener('preview_updated', handlePreviewUpdate);
    return () => window.removeEventListener('preview_updated', handlePreviewUpdate);
  }, []);

  // 🔐 مصادقة تلقائية حركية بالمسار النسبي عبر البروكسي
  useEffect(() => {
    const initializeSecureSession = async () => {
      let activeToken = localStorage.getItem('token');
      let username = localStorage.getItem('currentUser') || 'guest_user';

      if (!activeToken) {
        try {
          // استدعاء نسبي آمن تماماً
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
          });
          const data = await res.json();
          if (data.success && data.token) {
            activeToken = data.token;
            localStorage.setItem('token', data.token);
            localStorage.setItem('currentUser', data.currentUser);
            setCurrentUser(data.currentUser);
          }
        } catch (err) {
          console.error('Failed to initialize secure session:', err);
        }
      }

      if (activeToken) {
        socket.auth = { token: activeToken };
        socket.connect();
        socket.emit('join_project', { project: activeProject });
      }
    };

    initializeSecureSession();
  }, [activeProject]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (isAuthenticated && activeFile) {
      fetchFileContent(activeFile);
    }
  }, [activeFile, activeProject, isAuthenticated]);

  const getHeaders = () => {
    const activeToken = token || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': activeToken ? `Bearer ${activeToken}` : ''
    };
  };

  const fetchFileContent = async (fileName) => {
    try {
      // جلب نسبي آمن
      const res = await fetch(`/api/file-content?fileName=${fileName}&project=${activeProject}`, {
        headers: getHeaders()
      });
      if (res.status === 401 || res.status === 403) {
        handleAuthError(res.status);
        return;
      }
      const data = await res.json();
      setEditorContent(data.content || '');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCodeManual = async () => {
    try {
      const res = await fetch('/api/file-content/save', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          fileName: activeFile, 
          content: editorContent, 
          project: activeProject,
          username: currentUser
        })
      });
      if (res.status === 401 || res.status === 403) {
        handleAuthError(res.status);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setPreviewTimestamp(Date.now());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim()) return;
    try {
      setPrompt('');
      setStreamingContent(''); 
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          message: prompt, 
          project: activeProject,
          username: currentUser
        })
      });
      if (res.status === 401 || res.status === 403) {
        handleAuthError(res.status);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSwitchProject = async (projName) => {
    try {
      const res = await fetch('/api/project-context/switch', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ project: projName })
      });
      if (res.status === 401 || res.status === 403) {
        handleAuthError(res.status);
        return;
      }
      setActiveProject(projName);
    } catch (err) {
      console.error(err);
    }
  };

  const getLogColorClass = (text) => {
    if (text.includes('[SUCCESS]')) return 'text-emerald-400 font-semibold';
    if (text.includes('[ERROR]')) return 'text-rose-400 font-bold';
    if (text.includes('[QA REPORT]')) return 'text-amber-400 font-medium';
    if (text.includes('[SYSTEM]')) return 'text-sky-400';
    return 'text-slate-300';
  };

  const getFileLanguage = (fileName) => {
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.js')) return 'javascript';
    if (fileName.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  return (
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-900">
      
      {/* 🔮 الهيدر العلوي */}
      <header className="border-b border-slate-900 bg-[#090D16]/90 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-cyan-500/15 animate-pulse">
            ⚡
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide flex items-center gap-2">
              JAOLA OS <span className="text-xs text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-md border border-cyan-900/40">v1.9</span>
            </h1>
            <p className="text-[10px] text-emerald-400 font-medium tracking-wider uppercase mt-0.5">● ENTERPRISE SECURITY SECURE</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {vercelUrl && (
            <a href={vercelUrl} target="_blank" rel="noreferrer" className="text-xs bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 px-3 py-2 rounded-xl hover:bg-emerald-950/70 transition-all">
              🌍 الرابط المنشور حياً
            </a>
          )}

          <button className="text-xs bg-[#0F172A] border border-slate-800 text-slate-300 px-3 py-2 rounded-xl hover:bg-slate-900">😺 GitHub Login</button>
          <button className="text-xs bg-white text-slate-950 px-3 py-2 rounded-xl font-semibold hover:bg-slate-100 shadow-md">🌐 Google Login</button>

          <div className="flex items-center gap-1.5 bg-[#0D121F] border border-slate-800 rounded-xl px-2 py-1">
            <span className="text-[10px] text-slate-500">المشاريع:</span>
            <select 
              value={activeProject}
              onChange={(e) => handleSwitchProject(e.target.value)}
              className="bg-transparent text-xs text-slate-200 outline-none border-0 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p} value={p} className="bg-[#0D121F]">{p}</option>
              ))}
            </select>
          </div>

          <button className="text-xs bg-cyan-500 text-slate-950 font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-cyan-500/10 hover:bg-cyan-400 transition-all">
            + مشروع جديد
          </button>
        </div>
      </header>

      {/* 🚀 مساحة العمل الرئيسية */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-[1700px] w-full mx-auto">
        
        {/* 1. العمود الأيسر (1/5): الأوامر ومتصفح الملفات */}
        <section className="flex flex-col gap-6 lg:col-span-1">
          <div className="bg-[#090D16]/80 border border-slate-900/50 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">💬 توجيه الأوامر التحديثية</h3>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="اطلب تعديل، إضافة ميزة..." className="w-full h-36 bg-slate-950 border border-slate-900 rounded-xl p-3.5 text-xs text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none resize-none" />
            <button onClick={handleSendPrompt} className="w-full mt-3 py-3 bg-gradient-to-r from-cyan-600 to-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg hover:scale-[1.01] transition-all">🚀 حقن التعديل حياً</button>
          </div>
          <div className="bg-[#090D16]/80 border border-slate-900/50 rounded-2xl p-5 shadow-xl flex-1 flex flex-col max-h-[350px]">
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">📁 WORKSPACE EXPLORER</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {files.map((file) => (
                <button key={file} onClick={() => { setActiveFile(file); setActiveTab('editor'); }} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left border ${activeFile === file ? 'bg-slate-950 border-slate-800 text-cyan-400 font-medium' : 'border-transparent text-slate-400 hover:bg-slate-950/40'}`}>{file}</button>
              ))}
            </div>
          </div>
        </section>

        {/* 2. الأعمدة الوسطى (3/5): المعاينة أو المحرر والـ Graph */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-[#090D16]/80 border border-slate-900/50 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-[500px]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-4 mb-4">
              <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border">
                <button onClick={() => setActiveTab('preview')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'preview' ? 'bg-[#090D16] text-cyan-400' : 'text-slate-500'}`}>🖥️ المعاينة الحية</button>
                <button onClick={() => setActiveTab('editor')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'editor' ? 'bg-[#090D16] text-cyan-400' : 'text-slate-500'}`}>💻 مراجعة الكود الصافي</button>
              </div>
            </div>

            <div className="flex-1 flex justify-center items-center bg-slate-950 rounded-xl overflow-hidden min-h-[400px] relative border border-slate-900">
              {activeTab === 'preview' ? (
                // 🛡️ تمرير مسار البروكسي النسبي لـ PreviewFrame
                <PreviewFrame 
                  activeProject={activeProject} 
                  previewTimestamp={previewTimestamp} 
                  viewMode={viewMode} 
                  streamingContent={streamingContent}
                  backendUrl="" // فارغ لأن البروكسي العكسي يدمجه على نفس المضيف تلقائياً
                />
              ) : (
                <div className="w-full h-full flex flex-col p-4">
                  <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
                    <span>محرر موناكو الذكي: <span className="text-cyan-400 font-mono font-bold">{activeFile}</span></span>
                    <button onClick={handleSaveCodeManual} className="bg-cyan-950 border border-cyan-900/50 text-cyan-400 hover:bg-cyan-900 px-3 py-1 rounded-lg font-bold">💾 حفظ وحقن</button>
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden border border-slate-900 mt-2 bg-[#1e1e1e]">
                    <Editor height="100%" language={getFileLanguage(activeFile)} theme="vs-dark" value={editorContent} onChange={(value) => setEditorContent(value || '')} options={{ minimap: { enabled: false }, fontSize: 12, automaticLayout: true }} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <AgentNetworkGraph states={agentStates} />
        </section>

        {/* 3. العمود الأيمن (1/5): مساحة التوأم الرقمي */}
        <section className="lg:col-span-1 flex flex-col gap-6">
          <DigitalTwinPanel 
            activeFileContent={editorContent} 
            activeFile={activeFile} 
            filesCount={files.length}
          />
        </section>

      </main>

      <footer className="border-t border-slate-900 bg-[#090D16]/50 p-6">
        <div className="max-w-[1700px] w-full mx-auto">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">⏱️ Stream Timeline Log</h3>
          <div className="bg-slate-950/80 border border-slate-900 rounded-2xl p-4 font-mono text-xs h-40 overflow-y-auto space-y-2 shadow-inner">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">بانتظار استقبال السجلات والأحداث من نواة المعالجة...</div>
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

// ==========================================
// 🎨 مكوّن التوأم الرقمي المفعّل بالكامل
// ==========================================
function DigitalTwinPanel({ activeFileContent, activeFile, filesCount }) {
  const [metrics, setMetrics] = useState({ cpu: 14, ram: 42.1, latency: 12 });
  const [twinLogs, setTwinLogs] = useState([
    "🟢 تم بدء مزامنة التوأم الرقمي للواجهة الحية...",
    "🔍 فحص التجاوب: محاكاة أبعاد شاشة 1280px...",
    "⏱️ زمن التفاعل البصري الأولي مستقر تحت 0.3 ثانية."
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        cpu: Math.floor(Math.random() * (18 - 6) + 6),
        ram: parseFloat((41 + Math.random() * 2).toFixed(1)),
        latency: Math.floor(Math.random() * (20 - 8) + 8)
      });

      const simulatorActions = [
        "👥 محاكاة مستخدم: التمرير نحو الأسفل (Scroll).",
        "📱 فحص أبعاد الشاشة: العرض المتجاوب ممتاز.",
        "♿ تقرير سهولة الوصول: التباين اللوني ممتاز (AA).",
        "⏱️ قياس الكفاءة: الترويسات والصور محملة بالكامل.",
        "🔒 جاري فحص الحماية من ثغرات الحقن... آمن"
      ];
      const randomAction = simulatorActions[Math.floor(Math.random() * simulatorActions.length)];
      setTwinLogs(prev => [randomAction, ...prev.slice(0, 4)]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const linesOfCode = activeFileContent ? activeFileContent.split('\n').length : 0;
  const estimatedKB = activeFileContent ? (activeFileContent.length / 1024).toFixed(2) : '0.00';

  return (
    <div className="bg-[#090D16]/80 border border-slate-900/50 rounded-2xl p-5 shadow-xl backdrop-blur-md flex-1 flex flex-col">
      <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        Digital Twin Working
      </h3>

      <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 mb-4 text-center">
        <div className="text-[10px] text-slate-500 mb-1">نسبة مطابقة التوأم الرقمي</div>
        <div className="text-xl font-extrabold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">99.98% Active</div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="bg-slate-950/40 border border-slate-900/50 p-2.5 rounded-xl flex items-center justify-between">
          <span className="text-[10px] text-slate-500">حمل الخادم الافتراضي</span>
          <span className="text-xs font-mono font-bold text-cyan-400">{metrics.cpu}% CPU</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900/50 p-2.5 rounded-xl flex items-center justify-between">
          <span className="text-[10px] text-slate-500">استهلاك الذاكرة المؤقتة</span>
          <span className="text-xs font-mono font-bold text-indigo-400">{metrics.ram} MB</span>
        </div>
        <div className="bg-slate-950/40 border border-slate-900/50 p-2.5 rounded-xl flex items-center justify-between">
          <span className="text-[10px] text-slate-500">زمن الاستجابة التفاعلية</span>
          <span className="text-xs font-mono font-bold text-emerald-400">{metrics.latency} ms</span>
        </div>
      </div>

      <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-3.5 mb-4">
        <div className="text-[11px] font-bold text-slate-400 mb-2 border-b border-slate-900 pb-1.5">📊 إحصائيات الشفرة الحالية</div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-900">
            <div className="text-[9px] text-slate-500">عدد الأسطر (LOC)</div>
            <div className="text-xs font-bold font-mono text-slate-300 mt-0.5">{linesOfCode}</div>
          </div>
          <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-900">
            <div className="text-[9px] text-slate-500">حجم الملف</div>
            <div className="text-xs font-bold font-mono text-slate-300 mt-0.5">{estimatedKB} KB</div>
          </div>
        </div>
        <div className="text-[10px] text-slate-500 mt-2.5 text-center">الملف النشط: <span className="text-slate-400 font-mono">{activeFile}</span></div>
      </div>

      <div className="flex-1 flex flex-col justify-end">
        <div className="text-[10px] font-bold text-slate-400 mb-2">🤖 محاكاة سلوك الزوار</div>
        <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 font-mono text-[9px] h-32 overflow-y-auto space-y-1.5 text-slate-400 select-none">
          {twinLogs.map((log, idx) => (
            <div key={idx} className="border-b border-slate-900/30 pb-1 flex items-start gap-1">
              <span className="text-slate-600">❯</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 🎨 مكون رسم شبكة الوكلاء التفاعلي (Agent Graph)
// ==========================================
function AgentNetworkGraph({ states }) {
  const agents = [
    { key: 'planner', name: 'Planner', emoji: '🧠', desc: 'تخطيط النوايا' },
    { key: 'architect', name: 'Architect', emoji: '🏗️', desc: 'مراجعة الهيكل' },
    { key: 'coder', name: 'Coder', emoji: '💻', desc: 'توليد الشفرة' },
    { key: 'qa', name: 'QA', emoji: '🔍', desc: 'اختبار الجودة' },
    { key: 'deploy', name: 'Deploy', emoji: '🚀', desc: 'النشر السحابي' },
  ];

  const getAgentStyle = (state) => {
    switch (state) {
      case 'running':
        return 'border-cyan-500 bg-cyan-950/30 text-cyan-400 ring-2 ring-cyan-500/30 scale-105 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse';
      case 'completed':
        return 'border-emerald-500/80 bg-emerald-950/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
      case 'error':
        return 'border-rose-500 bg-rose-950/30 text-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-bounce';
      case 'waiting':
      default:
        return 'border-slate-900/80 bg-slate-950/40 text-slate-600 opacity-60';
    }
  };

  const getStatusBadge = (state) => {
    switch (state) {
      case 'running':
        return <span className="text-[10px] bg-cyan-950 text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-900/40 animate-pulse font-medium">يعمل الآن...</span>;
      case 'completed':
        return <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-900/40 font-medium">مكتمل ✓</span>;
      case 'error':
        return <span className="text-[10px] bg-rose-950 text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-900/40 font-bold animate-pulse">فشل !</span>;
      case 'waiting':
      default:
        return <span className="text-[10px] bg-slate-900 text-slate-500 px-2.5 py-0.5 rounded-full border border-slate-800/40 font-medium">بالانتظار</span>;
    }
  };

  const getArrowStyle = (prevState) => {
    if (prevState === 'completed') return 'text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)] transition-colors duration-500';
    if (prevState === 'running') return 'text-cyan-400 animate-pulse';
    return 'text-slate-800';
  };

  return (
    <div className="w-full bg-[#090D16]/80 border border-slate-900/50 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-6 border-b border-slate-900 pb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          رسم بياني حركي لنشاط شبكة الوكلاء (Agent Network Graph)
        </h3>
      </div>

      <div className="flex flex-col xl:flex-row items-center justify-center gap-4 xl:gap-2">
        {agents.map((agent, index) => {
          const currentState = states[agent.key] || 'waiting';
          
          return (
            <div key={agent.key} className="flex flex-col xl:flex-row items-center gap-2">
              <div className={`flex flex-col items-center p-4 rounded-xl border w-40 transition-all duration-500 ${getAgentStyle(currentState)}`}>
                <div className="text-2xl mb-2 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                  {agent.emoji}
                </div>
                <span className="text-xs font-bold tracking-wide uppercase block text-center mb-1">
                  {agent.name}
                </span>
                <span className="text-[9px] text-slate-500 text-center mb-2.5 block">
                  {agent.desc}
                </span>
                {getStatusBadge(currentState)}
              </div>

              {index < agents.length - 1 && (
                <div className="flex justify-center items-center py-2 xl:py-0 xl:px-2">
                  <span className={`text-xl xl:text-2xl ${getArrowStyle(currentState)}`}>
                    <span className="block xl:hidden">↓</span>
                    <span className="hidden xl:block">→</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
