import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
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

  // مرجع لتتبع عدد أخطاء الاتصال لمنع حلقة الـ reload
  const connectErrorCountRef = useRef(0);
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
    });

    socket.off('preview_updated').on('preview_updated', (data) => {
      setStreamingContent('');
      setPreviewTimestamp(data.timestamp || Date.now());
    });

    socket.off('code_stream_chunk').on('code_stream_chunk', (chunk) => {
      setStreamingContent((prev) => prev + chunk);
    });

    socket.off('agent_states').on('agent_states', setAgentStates);

    socket.off('log').on('log', (newLog) => {
      setLogs((prev) => [...prev.slice(-100), newLog]);

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

    socket.off('chat_history').on('chat_history', (history) => {
      if (!history?.length) return;
      setChatMessages(prev => {
        if (prev.length > 0) return prev; // لا تُعيد التحميل إذا يوجد رسائل
        return history.slice(-50).map(msg => ({
          sender: msg.role === 'user' ? 'user' : 'ai',
          text: msg.content
        }));
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

    // 🛠️ نبض حياة كل 4 دقائق: يبقي خدمة Render المجانية مستيقظة أثناء فتح الصفحة
    const keepAlive = setInterval(() => {
      fetch(`${BACKEND_URL}/api/health`).catch(() => {});
    }, 4 * 60 * 1000);

    socket.connect();
    socket.emit('join_project', { project: savedProject });

    return () => {
      socket.off('workspace_files');
      socket.off('user_projects');
      socket.off('preview_updated');
      socket.off('code_stream_chunk');
      socket.off('agent_states');
      socket.off('log');
      socket.off('chat_reply');
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
