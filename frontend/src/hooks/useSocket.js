import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  // websocket أولاً — أسرع وأقل عرضة لمشاكل الـ polling، مع polling كاحتياط
  transports: ['websocket', 'polling'],
  // 🛠️ إصلاح جذري: كانت 3 محاولات فقط (6 ثوانٍ) ثم استسلام نهائي — الآن لا يستسلم أبداً
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,        // أول محاولة بعد ثانية
  reconnectionDelayMax: 10000,    // ثم تصاعدياً حتى 10 ثوانٍ
  randomizationFactor: 0.5,
  timeout: 20000,                 // مهلة أطول — Render المجاني قد يستيقظ ببطء
});

export function useSocket(isAuthenticated, handleAuthError) {
  const [files, setFiles]               = useState([]);
  const [logs, setLogs]                 = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [projects, setProjects]         = useState([]);
  const [activeProject, setActiveProject] = useState(
    () => localStorage.getItem('activeProject') || 'sandbox_app'
  );
  const [currentUser, setCurrentUser]   = useState('guest_user');
  const [vercelUrl, setVercelUrl]       = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [connectionError, setConnectionError] = useState('');
  const [previewTimestamp, setPreviewTimestamp] = useState(Date.now());
  const [agentStates, setAgentStates]   = useState({
    planner: 'waiting', architect: 'waiting',
    coder: 'waiting', qa: 'waiting', deploy: 'waiting'
  });
  const [isConnected, setIsConnected]   = useState(socket.connected);
  const [metrics, setMetrics]           = useState(null);   // 📊 المقاييس الحقيقية من السيرفر
  const [latencyMs, setLatencyMs]       = useState(null);   // زمن الاستجابة المقاس فعلياً
  const [missionPhase, setMissionPhase] = useState(null);   // 🔄 المرحلة الحقيقية من آلة الحالات
  const [presenceCount, setPresenceCount] = useState(1);    // 👥 عدد جلسات نفس المالك المتصلة بهذا المشروع الآن

  // مرجع لتتبع عدد أخطاء الاتصال لمنع حلقة الـ reload
  const connectErrorCountRef = useRef(0);

  // buffer تجميع دفعات بث الكود (code_stream_chunk) — يُفرَّغ مرة لكل إطار رسم
  const codeBufRef = useRef('');
  const codeFlushRef = useRef(0);

  // ✨ كشف ناعم بمستوى كلاود: النموذج يبثّ دفعاتٍ قد تقفز — نفصل الوصول عن
  // العرض. الشبكة تُراكم في `target`، وحلقة rAF تكشف الحروف بإيقاع ثابت
  // (تتسارع كلما اتّسعت الفجوة فلا تتأخّر أبداً، وتنعم على الدفعات الصغيرة).
  const revealRef = useRef({ target: '', shown: 0, raf: null, done: false });
  const startRevealLoop = () => {
    const st = revealRef.current;
    if (st.raf) return;
    const step = () => {
      const s = revealRef.current;
      const gap = s.target.length - s.shown;
      if (gap <= 0) {
        s.raf = null;
        if (s.done) { flushReveal(); return; }
        // ما زال البثّ حيّاً لكن لا حروف جديدة الآن — أعِد الفحص لاحقاً
        s.raf = requestAnimationFrame(step);
        return;
      }
      // اكشف نسبةً من الفجوة (سريع عند الدفعات الكبيرة، ناعم عند الصغيرة)
      const reveal = Math.max(2, Math.ceil(gap / 6));
      s.shown = Math.min(s.target.length, s.shown + reveal);
      const visible = s.target.slice(0, s.shown);
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || !last.streaming) return prev;
        return [...prev.slice(0, -1), { ...last, text: visible }];
      });
      s.raf = requestAnimationFrame(step);
    };
    st.raf = requestAnimationFrame(step);
  };
  const flushReveal = () => {
    const s = revealRef.current;
    if (s.raf) { cancelAnimationFrame(s.raf); s.raf = null; }
    const finalText = s.target;
    setChatMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || !last.streaming) return prev;
      return [...prev.slice(0, -1), { ...last, text: finalText, streaming: false }];
    });
    revealRef.current = { target: '', shown: 0, raf: null, done: false };
  };
  // مرجع للمشروع النشط — حتى تعيد معالجات الأحداث الانضمام للغرفة الصحيحة
  const activeProjectRef = useRef(activeProject);
  useEffect(() => { activeProjectRef.current = activeProject; }, [activeProject]);

  // 🛠️ إعادة الانضمام للغرفة عند تبديل المشروع + حفظه للجلسات القادمة
  useEffect(() => {
    if (!isAuthenticated) return;
    localStorage.setItem('activeProject', activeProject);
    if (socket.connected) {
      socket.emit('join_project', { project: activeProject });
    }
  }, [activeProject, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const savedProject = localStorage.getItem('activeProject') || activeProject;

    socket.auth = { token };

    // ─── أحداث Socket ──────────────────────────────────────────────
    socket.off('workspace_files').on('workspace_files', setFiles);

    socket.off('user_projects').on('user_projects', (data) => {
      setProjects(data.projects || []);
      setActiveProject(data.activeProject);
      setCurrentUser(data.currentUser);
      setVercelUrl(data.vercelUrl || '');

      // 🛠️ تحصين ذاتي: اسم المستخدم من السيرفر هو الحقيقة المطلقة —
      // يصحح أي قيمة تالفة مخزنة سابقاً ("undefined") كانت تكسر المعاينة
      if (data.currentUser && data.currentUser !== 'guest_user') {
        const stored = localStorage.getItem('currentUser');
        if (stored !== data.currentUser) {
          localStorage.setItem('currentUser', data.currentUser);
        }
      }
    });

    const clearCodeBuffer = () => {
      codeBufRef.current = '';
      if (codeFlushRef.current) {
        cancelAnimationFrame(codeFlushRef.current);
        codeFlushRef.current = 0;
      }
    };

    socket.off('preview_updated').on('preview_updated', (data) => {
      clearCodeBuffer();
      setStreamingContent('');
      setPreviewTimestamp(data.timestamp || Date.now());
    });

    // 🛠️ نهاية بث الكود (نجاح/فشل/إيقاف) — يزيل طبقة "يكتب الكود" عن المعاينة دائماً
    socket.off('stream_done').on('stream_done', () => {
      clearCodeBuffer();
      setStreamingContent('');
    });

    socket.off('code_stream_chunk').on('code_stream_chunk', (chunk) => {
      // تجميع الدفعات في buffer وتفريغه مرة لكل إطار رسم — الدفعات تصل أسرع
      // من 60fps أثناء البث الكثيف، وكل setState هنا يعيد رسم شجرة Dashboard كاملة
      codeBufRef.current += chunk;
      if (!codeFlushRef.current) {
        codeFlushRef.current = requestAnimationFrame(() => {
          codeFlushRef.current = 0;
          const buffered = codeBufRef.current;
          codeBufRef.current = '';
          if (buffered) setStreamingContent((prev) => prev + buffered);
        });
      }
    });

    socket.off('agent_states').on('agent_states', setAgentStates);

    // 📊 المقاييس الحقيقية (درجات الوكلاء + مؤشرات النظام)
    socket.off('project_metrics').on('project_metrics', setMetrics);

    // 👥 حضور مبسّط: كم جلسة/جهاز لنفس المالك متصل بهذا المشروع الآن
    socket.off('presence').on('presence', (data) => setPresenceCount(data?.count ?? 1));

    // 🔄 المرحلة الحقيقية من آلة الحالات (أحداث project_state الموحدة):
    // معمارية → كتابة → مراجعة → تحقق → اكتمال/فشل
    socket.off('project_state').on('project_state', (data) => {
      setMissionPhase(data || null);
    });

    socket.off('log').on('log', (newLog) => {
      // طابع وقت الوصول يُسجَّل هنا مرة واحدة — العرض يقرأه جاهزاً بدل توليد
      // new Date() لكل سطر في كل render (وكان يعرض وقتاً خاطئاً أصلاً)
      setLogs((prev) => [...prev.slice(-100), { ...newLog, time: new Date().toLocaleTimeString() }]);

      // 🆕 إحياء دور الشات: الأحداث المهمة تظهر كأسطر حالة داخل الشات مباشرة
      // بدل أن تبقى مدفونة في تاب Logs — المستخدم يرى ماذا يحدث لحظة بلحظة
      const msg = newLog?.message || '';
      const significant = /✅|❌|⚠️|🎯|🚀|⚙️|🔍|🎨|💻|🧪|🐙|📦|🔐|⏹|✨|🏁|🗺️|🏗️/.test(msg);
      if (significant) {
        setChatMessages((prev) => {
          const last = prev[prev.length - 1];
          // منع تكرار نفس السطر مرتين متتاليتين
          if (last?.sender === 'system' && last.text === msg) return prev;
          return [...prev.slice(-150), { sender: 'system', text: msg, timestamp: Date.now() }];
        });
      }
    });

    socket.off('chat_reply').on('chat_reply', (data) => {
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender !== 'user' && last.text === data.message) return prev;
        return [...prev, {
          sender: 'assistant',
          text: data.message,
          options: data.options || null,
          pendingGoal: data.pendingGoal || null,
          timestamp: Date.now()
        }];
      });
    });

    // 🔴 البثّ الحيّ للرد — يظهر حرفاً-بحرف
    socket.off('chat_stream_start').on('chat_stream_start', () => {
      revealRef.current = { target: '', shown: 0, raf: null, done: false };
      setChatMessages((prev) => [...prev, { sender: 'assistant', text: '', streaming: true, timestamp: Date.now() }]);
    });
    socket.off('chat_stream_chunk').on('chat_stream_chunk', (data) => {
      const delta = data?.delta || '';
      if (!delta) return;
      // نُراكم في الهدف فقط — حلقة الكشف الناعمة تعرضه بإيقاع ثابت
      revealRef.current.target += delta;
      startRevealLoop();
    });
    socket.off('chat_stream_end').on('chat_stream_end', (data) => {
      const st = revealRef.current;
      const noStream = st.target.length === 0 && st.shown === 0 && !st.raf;
      // لو لم يصل أي chunk (بثّ فشل) — أضِف الرد النهائي كرسالة عادية
      if (noStream && typeof data?.message === 'string') {
        setChatMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.streaming && !last.text) {
            return [...prev.slice(0, -1), { ...last, text: data.message, streaming: false }];
          }
          return [...prev, { sender: 'assistant', text: data.message, timestamp: Date.now() }];
        });
        revealRef.current = { target: '', shown: 0, raf: null, done: false };
        return;
      }
      // النص النهائي الموثوق يحلّ محل المتراكم؛ نترك الحلقة تكمل الكشف بنعومة
      if (typeof data?.message === 'string') st.target = data.message;
      st.done = true;
      startRevealLoop();
    });

    socket.off('chat_history').on('chat_history', (history) => {
      if (!history?.length) return;
      setChatMessages(prev => {
        // 🛡️ إغلاق سباق: أحداث حيّة قد تصل قبل التاريخ — كان التاريخ يُتجاهل
        // كلياً حينها. الآن يُدمج قبل الرسائل الحية بدل التخطي.
        if (prev.some(m => m.historic)) return prev; // حُمّل سابقاً — لا تكرار
        const hist = history.slice(-20).map(msg => ({
          sender: msg.role === 'user' ? 'user' : 'assistant',
          text: msg.content,
          historic: true,
        }));
        return [...hist, ...prev];
      });
    });

    // ─── معالجة أخطاء الاتصال — إعادة محاولة لا نهائية بدون reload ──
    socket.off('connect_error').on('connect_error', (err) => {
      connectErrorCountRef.current += 1;
      console.error('Socket Error:', err.message);

      // توكن منتهي أو غير صالح — الحالة الوحيدة التي توجب إعادة تسجيل الدخول
      if (err.message.includes('Unauthorized') || err.message.includes('Token')) {
        setConnectionError('انتهت صلاحية الجلسة. سيتم تسجيل خروجك...');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        setTimeout(() => window.location.reload(), 2000);
        return;
      }

      // socket.io يستمر بإعادة المحاولة تلقائياً (Infinity) — نعرض الحالة فقط
      setIsConnected(false);
      if (connectErrorCountRef.current === 1 || connectErrorCountRef.current % 5 === 0) {
        setConnectionError('جاري إعادة الاتصال بالخادم...');
        setLogs((prev) => [...prev.slice(-100), {
          message: `⚠️ [SYSTEM]: انقطع الاتصال — إعادة المحاولة (${connectErrorCountRef.current})...`
        }]);
      }
    });

    socket.off('connect').on('connect', () => {
      const wasReconnect = connectErrorCountRef.current > 0;
      connectErrorCountRef.current = 0;
      setConnectionError('');
      setIsConnected(true);

      // 🛠️ الإصلاح الجوهري: إعادة الانضمام لغرفة المشروع بعد *كل* اتصال.
      // بدون هذا، أي إعادة اتصال تترك الـ socket خارج الغرفة فتتوقف كل
      // الأحداث (شات/سجلات/ملفات) بصمت — وهذا ما كان يبدو كـ "فقدان اتصال".
      socket.emit('join_project', { project: activeProjectRef.current || 'sandbox_app' });

      if (wasReconnect) {
        setLogs((prev) => [...prev.slice(-100), { message: '✅ [SYSTEM]: عاد الاتصال بالخادم واستُعيدت الغرفة.' }]);
      }
    });

    socket.off('disconnect').on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // الخادم أنهى الاتصال (إعادة نشر مثلاً) — auto-reconnect لا يعمل هنا، نعيد يدوياً
        setLogs((prev) => [...prev.slice(-100), { message: '🔌 [SYSTEM]: أعاد الخادم تشغيل الاتصال — جاري الرجوع...' }]);
        setTimeout(() => socket.connect(), 1500);
      }
    });

    // 🛠️ تحديث التوكن قبل كل محاولة إعادة اتصال (Manager events)
    socket.io.off('reconnect_attempt').on('reconnect_attempt', () => {
      socket.auth = { token: localStorage.getItem('token') };
    });

    // 🛠️ الجوال: المتصفح يجمّد الـ socket في الخلفية — عند العودة نعيد الاتصال فوراً
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !socket.connected) {
        socket.auth = { token: localStorage.getItem('token') };
        socket.connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onVisibilityChange);

    // 🛠️ نبض حياة كل 4 دقائق: يبقي خدمة Render مستيقظة + يقيس زمن الاستجابة الفعلي
    const pingHealth = async () => {
      const t0 = performance.now();
      try {
        await fetch(`${BACKEND_URL}/api/health`);
        setLatencyMs(Math.round(performance.now() - t0));
      } catch {}
    };
    pingHealth();
    const keepAlive = setInterval(pingHealth, 4 * 60 * 1000);

    socket.connect();
    socket.emit('join_project', { project: savedProject });

    return () => {
      if (revealRef.current.raf) { cancelAnimationFrame(revealRef.current.raf); revealRef.current.raf = null; }
      clearCodeBuffer();
      socket.off('workspace_files');
      socket.off('user_projects');
      socket.off('preview_updated');
      socket.off('stream_done');
      socket.off('code_stream_chunk');
      socket.off('agent_states');
      socket.off('project_metrics');
      socket.off('presence');
      socket.off('project_state');
      socket.off('log');
      socket.off('chat_reply');
      socket.off('chat_stream_start');
      socket.off('chat_stream_chunk');
      socket.off('chat_stream_end');
      socket.off('chat_history');
      socket.off('connect_error');
      socket.off('connect');
      socket.off('disconnect');
      socket.io.off('reconnect_attempt');
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onVisibilityChange);
      clearInterval(keepAlive);
    };
  }, [isAuthenticated]);

  // 🆕 تحديث المعاينة يدوياً من شريط الأدوات
  const refreshPreview = () => setPreviewTimestamp(Date.now());

  return {
    files,
    logs,
    streamingContent,
    agentStates,
    projects,
    activeProject,
    currentUser,
    vercelUrl,
    chatMessages,
    connectionError,
    isConnected,
    metrics,
    latencyMs,
    missionPhase,
    presenceCount,
    previewTimestamp,
    refreshPreview,
    setChatMessages,
    setProjects,
    setActiveProject,
    setCurrentUser,
    setSocketUser: setCurrentUser,
    setVercelUrl,
    setStreamingContent,
    setFiles,
    setLogs,
  };
}
