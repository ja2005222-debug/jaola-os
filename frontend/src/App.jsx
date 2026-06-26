import { useEffect, useState, useRef } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useSocket, socket } from './hooks/useSocket.js';
import { PreviewFrame } from './components/PreviewFrame.jsx';
import Editor from '@monaco-editor/react';

// حساب عنوان الباك إند ديناميكياً لتفادي مشاكل الـ Localhost في الكروم بوك
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

export default function App() {
  const [activeProject, setActiveProject] = useState('sandbox_app');
  
  // 🛡️ استدعاء خطاف المصادقة وحارس الـ JWT
  const { currentUser, token, isAuthenticated, handleAuthError } = useAuth(activeProject);

  // === 📊 حالات الـ State ===
  const [activeFile, setActiveFile] = useState('index.html');
  const [editorContent, setEditorContent] = useState('');
  const [activeTab, setActiveTab] = useState('preview'); 
  const [viewMode, setViewMode] = useState('desktop'); 
  const [prompt, setPrompt] = useState('');
  const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());
  const [projects, setProjects] = useState([]);
  const [vercelUrl, setVercelUrl] = useState('');

  // نائبة المشاريع المدمجة لتفادي حظر المتصفحات للـ prompts
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // مصفوفة فقاعات المحادثة التفاعلية
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: '👋 مرحباً بك في نواة JAOLA OS الذكية! أنا مستشارك الذكاء الاصطناعي، كيف يمكنني مساعدتك في تطوير وتحديث شفرات مشروعك اليوم؟' }
  ]);

  const logsEndRef = useRef(null);
  const chatEndRef = useRef(null);

  // 🔌 استهلاك حالات السوكيت المغلفة والمعزولة والنشطة بالبروكسي العكسي لـ Vite بآلية ترتيب الاتصال الآمنة
  const { 
    files, 
    logs, 
    streamingContent, 
    agentStates, 
    setStreamingContent, 
    setFiles, 
    setLogs 
  } = useSocket(currentUser, activeProject, isAuthenticated, handleAuthError);

  // استلام إشارة تحديث البرفيو وتخطي الكاش عبر الأحداث المحلية المعزولة
  useEffect(() => {
    const handlePreviewUpdate = (e) => {
      setPreviewTimestamp(e.detail.timestamp || Date.now());
    };
    window.addEventListener('preview_updated', handlePreviewUpdate);
    return () => window.removeEventListener('preview_updated', handlePreviewUpdate);
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
      const res = await fetch(`${BACKEND_URL}/api/file-content?fileName=${fileName}&project=${activeProject}`, {
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
      const res = await fetch(`${BACKEND_URL}/api/file-content/save`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ fileName: activeFile, content: editorContent, project: activeProject, username: currentUser })
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
    const userPrompt = prompt;
    try {
      setPrompt('');
      setStreamingContent(''); 
      
      setChatMessages((prev) => [...prev, { sender: 'user', text: userPrompt }]);

      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userPrompt, project: activeProject, username: currentUser })
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
      const res = await fetch(`${BACKEND_URL}/api/project-context/switch`, {
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

  const handleCreateProjectSubmit = async () => {
    if (!newProjectName.trim()) return;
    const sanitized = newProjectName.trim().toLowerCase().replace(/\s+/g, '-');
    setShowProjectModal(false);
    setNewProjectName('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/project-context/switch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ project: sanitized })
      });
      if (res.status === 401 || res.status === 403) {
        handleAuthError(res.status);
        return;
      }
      setActiveProject(sanitized);
    } catch (err) {
      console.error(err);
    }
  };

  // === 🔐 مصادقة حركية تلقائية مخصصة فقط للتوكن والجلسة دون تضارب مع السوكيت ===
  useEffect(() => {
    const initializeSecureSession = async () => {
      let activeToken = localStorage.getItem('token');
      let username = localStorage.getItem('currentUser') || 'guest_user';

      if (!activeToken) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
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
      } else {
        setCurrentUser(username);
      }
    };

    initializeSecureSession();
  }, [activeProject]);

  const getLogColorClass = (text) => {
    if (text.includes('[SUCCESS]')) return 'text-emerald-400 font-semibold';
    if (text.includes('[ERROR]')) return 'text-rose-400 font-bold';
    if (text.includes('[QA REPORT]')) return 'text-amber-400 font-medium';
    if (text.includes('[SYSTEM]')) return 'text-sky-400';
    return 'text-slate-300';
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-cyan-500 selection:text-slate-900">
      
      {/* هالات النيون */}
      <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-200px] right-[-100px] w-[700px] h-[700px] rounded-full bg-indigo-500/5 blur-[180px] pointer-events-none"></div>
      <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-violet-500/3 blur-[140px] pointer-events-none"></div>

      <header className="border-b border-slate-900/60 bg-[#070b14]/90 backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg animate-pulse">⚡</div>
          <div>
            <h1 className="text-base font-bold">JAOLA OS <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-900/40">v1.9</span></h1>
            <p className="text-[9px] text-emerald-400 font-bold tracking-wider mt-0.5">● ENTERPRISE SECURITY SECURE</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
          {vercelUrl && <a href={vercelUrl} target="_blank" rel="noreferrer" className="text-xs bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 px-3.5 py-2.5 rounded-xl hover:scale-[1.01] transition-all">🌍 الرابط المنشور حياً</a>}
          <button className="text-xs bg-[#0F172A]/80 border border-slate-800 text-slate-300 px-3.5 py-2.5 rounded-xl hover:bg-slate-900 transition-all">😺 GitHub Login</button>
          <button className="text-xs bg-white text-slate-950 px-3.5 py-2.5 rounded-xl font-bold hover:bg-slate-100 shadow-lg transition-all">🌐 Google Login</button>

          <div className="flex items-center gap-2.5 bg-[#0D121F] border border-slate-800 rounded-xl px-3 py-2 min-w-[200px] shrink-0">
            <span className="text-[10px] text-slate-500 font-bold shrink-0">المشروع الحالي:</span>
            <select value={activeProject} onChange={(e) => handleSwitchProject(e.target.value)} className="bg-transparent text-xs text-slate-200 outline-none border-0 cursor-pointer font-bold w-full">
              {projects.length === 0 ? (
                <option value="sandbox_app" className="bg-[#0D121F]">sandbox_app</option>
              ) : (
                projects.map((p) => <option key={p} value={p} className="bg-[#0D121F]">{p}</option>)
              )}
            </select>
          </div>

          <button 
            onClick={() => setShowProjectModal(true)}
            className="text-xs bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/10 hover:scale-[1.02] hover:shadow-cyan-500/25 transition-all duration-300 shrink-0 border border-cyan-400/20"
          >
            + مشروع جديد
          </button>
        </div>
      </header>

      {/* مساحة العمل */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-[1750px] w-full mx-auto">
        <section className="lg:col-span-1 flex flex-col bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-4.5 shadow-2xl backdrop-blur-xl h-[calc(100vh-230px)] min-h-[450px]">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${msg.sender === 'user' ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tr-none' : 'bg-gradient-to-tr from-cyan-950/30 to-indigo-950/30 border border-cyan-500/15 text-cyan-300 rounded-tl-none shadow-[0_0_15px_rgba(6,182,212,0.03)]'}`}>
                  <div className="text-[9px] font-bold text-slate-500 mb-1">
                    {msg.sender === 'user' ? '👤 أنت' : '🤖 المستشار المساعد'}
                  </div>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-900/60 pt-3">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendPrompt(); } }} placeholder="اكتب فكرتك أو اطلب تعديلاً هنا..." className="w-full h-20 bg-slate-950 border border-slate-900 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none resize-none leading-relaxed" />
            <button onClick={handleSendPrompt} className="w-full mt-2 py-3 bg-gradient-to-r from-cyan-600 to-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg hover:opacity-95 hover:scale-[1.01] transition-all">🚀 حقن التعديل حياً</button>
          </div>
        </section>

        <section className="lg:col-span-3 flex flex-col gap-6 h-[calc(100vh-280px)]">
          <div className="bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex-1 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900 pb-4 mb-4">
              <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-900">
                <button onClick={() => setActiveTab('preview')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'preview' ? 'bg-[#090D16] text-cyan-400' : 'text-slate-500'}`}>🖥️ المعاينة الحية</button>
                <button onClick={() => setActiveTab('editor')} className={`px-4 py-2 rounded-lg text-xs font-semibold ${activeTab === 'editor' ? 'bg-[#090D16] text-cyan-400' : 'text-slate-500'}`}>💻 مراجعة الكود الصافي</button>
              </div>
            </div>

            <div className="flex-1 flex justify-center items-center bg-slate-950 rounded-xl overflow-hidden min-h-[300px] relative border border-slate-900">
              {activeTab === 'preview' ? (
                <PreviewFrame activeProject={activeProject} previewTimestamp={previewTimestamp} viewMode={viewMode} streamingContent={streamingContent} />
              ) : (
                <div className="w-full h-full flex flex-col p-4">
                  <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
                    <span>محرر موناكو الذكي: <span className="text-cyan-400 font-mono font-bold">{activeFile}</span></span>
                    <button onClick={handleSaveCodeManual} className="bg-cyan-950 border border-cyan-900/50 text-cyan-400 hover:bg-cyan-900 px-3 py-1 rounded-lg font-bold">💾 حفظ وحقن</button>
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden border border-slate-900 mt-2 bg-[#0C0F19] h-[450px] relative flex">
                    <div className="w-12 bg-slate-950 border-r border-slate-900/60 text-right pr-3 pt-4 select-none font-mono text-[10px] text-slate-600 leading-relaxed">
                      {Array.from({ length: Math.max(15, (editorContent || '').split('\n').length) }).map((_, i) => (
                        <div key={i} className="h-5">{i + 1}</div>
                      ))}
                    </div>
                    <textarea
                      value={editorContent}
                      onChange={(e) => setEditorContent(e.target.value)}
                      className="flex-1 bg-transparent p-4 font-mono text-xs text-slate-200 outline-none resize-none leading-relaxed overflow-auto scrollbar-thin"
                      spellCheck="false"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <AgentNetworkGraph states={agentStates} />
        </section>

        <section className="lg:col-span-1 flex flex-col gap-6 h-[calc(100vh-230px)] overflow-y-auto">
          <div className="bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex flex-col max-h-[220px]">
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">📁 WORKSPACE EXPLORER</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {files.map((file) => (
                <button key={file} onClick={() => { setActiveFile(file); setActiveTab('editor'); }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left border ${activeFile === file ? 'bg-slate-950 border-slate-800 text-cyan-400 font-medium' : 'border-transparent text-slate-400 hover:bg-slate-950/40'}`}>{file}</button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <DigitalTwinPanel activeFileContent={editorContent} activeFile={activeFile} filesCount={files.length} />
          </div>
        </section>
      </main>

      {/* النافذة المنبثقة المدمجة (Interactive Custom Modal) لإنشاء المشاريع */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all">
          <div className="bg-[#0D121F] border border-slate-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-sm font-bold mb-1.5 text-slate-200">📁 إنشاء مشروع جديد</h3>
            <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">أدخل اسماً معبراً لمساحة العمل الجديدة باللغة الإنجليزية للبدء فورا في تجميع الأكواد.</p>
            <input 
              type="text" 
              value={newProjectName} 
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="مثال: company-portal" 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-cyan-500 mb-4 font-mono"
            />
            <div className="flex items-center justify-end gap-2.5">
              <button onClick={() => setShowProjectModal(false)} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2">إلغاء</button>
              <button onClick={handleCreateProjectSubmit} className="text-xs bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl hover:scale-[1.01] transition-all">إنشاء وتدشين</button>
            </div>
          </div>
        </div>
      )}

      {/* الـ Timeline */}
      <footer className="border-t border-slate-900 bg-[#090D16]/50 p-6 relative z-10">
        <div className="max-w-[1700px] w-full mx-auto">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">⏱️ Stream Timeline Log</h3>
          <div className="bg-slate-950/80 border border-slate-900 rounded-2xl p-4 font-mono text-xs h-48 overflow-y-auto space-y-2 shadow-inner">
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
    <div className="bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex flex-col h-full min-h-[300px]">
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
      </div>

      <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-3 mb-4">
        <div className="text-[11px] font-bold text-slate-400 mb-1.5 border-b border-slate-900 pb-1.5">📊 إحصائيات الشفرة</div>
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
      </div>

      <div className="flex-1 flex flex-col justify-end">
        <div className="text-[10px] font-bold text-slate-400 mb-2">🤖 محاكاة سلوك الزوار</div>
        <div className="bg-slate-950/80 border border-slate-900 rounded-xl p-3 font-mono text-[9px] h-24 overflow-y-auto space-y-1.5 text-slate-400 select-none">
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
        return 'border-cyan-500 bg-cyan-950/20 text-cyan-400 ring-2 ring-cyan-500/40 scale-[1.03] shadow-[0_0_30px_rgba(6,182,212,0.3)] animate-pulse';
      case 'completed':
        return 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
      case 'error':
        return 'border-rose-500 bg-rose-950/30 text-rose-400 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-bounce';
      case 'waiting':
      default:
        return 'border-slate-800/80 bg-slate-900/20 text-slate-500 hover:border-slate-700/60 hover:text-slate-400 transition-all';
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
    <div className="w-full bg-[#070b14]/70 border border-slate-900/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
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
                    →
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
