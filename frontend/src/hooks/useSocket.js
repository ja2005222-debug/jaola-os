import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

export const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 3,       // حد أقصى 3 محاولات إعادة اتصال
  reconnectionDelay: 2000,       // انتظر ثانيتين بين كل محاولة
  timeout: 10000,
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

  // مرجع لتتبع عدد أخطاء الاتصال لمنع حلقة الـ reload
  const connectErrorCountRef = useRef(0);

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

    // ─── معالجة أخطاء الاتصال — بدون حلقة reload لا نهاية لها ─────
    socket.off('connect_error').on('connect_error', (err) => {
      connectErrorCountRef.current += 1;
      console.error('Socket Error:', err.message);

      // توكن منتهي أو غير صالح
      if (err.message.includes('Unauthorized') || err.message.includes('Token')) {
        setConnectionError('انتهت صلاحية الجلسة. سيتم تسجيل خروجك...');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        // reload مرة واحدة فقط
        setTimeout(() => window.location.reload(), 2000);
        return;
      }

      // بعد 3 محاولات فاشلة — أظهر رسالة بدلاً من reload
      if (connectErrorCountRef.current >= 3) {
        setConnectionError('تعذّر الاتصال بالخادم. تحقق من اتصالك وحاول تحديث الصفحة.');
        setLogs((prev) => [...prev, {
          message: '⚠️ [SYSTEM]: فشل الاتصال بالخادم بعد 3 محاولات. يرجى تحديث الصفحة يدوياً.'
        }]);
      } else {
        setLogs((prev) => [...prev, {
          message: `⚠️ [SYSTEM]: محاولة اتصال ${connectErrorCountRef.current}/3...`
        }]);
      }
    });

    socket.off('connect').on('connect', () => {
      // إعادة تعيين عداد الأخطاء عند الاتصال الناجح
      connectErrorCountRef.current = 0;
      setConnectionError('');
    });

    socket.off('disconnect').on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // الخادم قطع الاتصال عمداً (مثلاً انتهاء التوكن)
        setLogs((prev) => [...prev, { message: '🔌 [SYSTEM]: انقطع الاتصال بالخادم.' }]);
      }
    });

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
