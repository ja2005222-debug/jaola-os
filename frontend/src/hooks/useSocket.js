import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

// الاستدعاء الديناميكي الصامد بمنفذ 4000 لتجاوز جدران الحماية للـ WebSockets
export const socket = io(BACKEND_URL, { 
  autoConnect: false,
  transports: ['polling', 'websocket'] 
});

export function useSocket(isAuthenticated, handleAuthError) {
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  
  // إدارة حالات المشاريع والمستخدم والروابط المصدقة داخل خطاف السوكيت لمنع الـ Reference Error
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState('sandbox_app');
  const [currentUser, setCurrentUser] = useState('guest_user');
  const [vercelUrl, setVercelUrl] = useState('');

  // 🛡️ نقل وإدارة مصفوفة الشات بداخل السوكيت لمنع التكرار والـ Re-render Loops
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: '👋 مرحباً بك في نواة JAOLA OS الذكية! أنا مستشارك الذكاء الاصطناعي، كيف يمكنني مساعدتك في تطوير وتحديث شفرات مشروعك اليوم؟' }
  ]);

  const [agentStates, setAgentStates] = useState({
    planner: 'waiting',
    architect: 'waiting',
    coder: 'waiting',
    qa: 'waiting',
    deploy: 'waiting'
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem('token');
    const savedProject = localStorage.getItem('activeProject') || activeProject;

    if (token) {
      socket.auth = { token };

      // تسجيل وتفعيل المستمعات لمرة واحدة فقط لمنع التضارب
      socket.off('workspace_files').on('workspace_files', (workspaceFiles) => {
        setFiles(workspaceFiles);
      });

      socket.off('user_projects').on('user_projects', (data) => {
        setProjects(data.projects || []);
        setActiveProject(data.activeProject);
        setCurrentUser(data.currentUser);
        setVercelUrl(data.vercelUrl || '');
      });

      socket.off('preview_updated').on('preview_updated', (data) => {
        setStreamingContent('');
        window.dispatchEvent(new CustomEvent('preview_updated', { detail: data }));
      });

      socket.off('code_stream_chunk').on('code_stream_chunk', (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      });

      socket.off('agent_states').on('agent_states', (states) => {
        setAgentStates(states);
      });

      // 🛡️ الفلترة الذكية والموحدة للسجلات وحقنها بداخل فقاعات المحادثة دون حدوث تكرار
      socket.off('log').on('log', (newLog) => {
        setLogs((prev) => [...prev.slice(-100), newLog]);

        if (newLog.message.includes('AI CEO Consultant') || newLog.message.includes('[INFO]')) {
          const cleanReply = newLog.message
            .replace(/.*AI CEO Consultant\]:/, '')
            .replace('🤖 [AI CEO Consultant]:', '')
            .replace('🤖 [INFO]:', '')
            .trim();
          
          setChatMessages((prev) => [...prev, { sender: 'ai', text: cleanReply }]);
        }
      });

      socket.off('connect_error').on('connect_error', (err) => {
        console.error('Socket Connection Rejected:', err.message);
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        setLogs((prev) => [...prev, { message: `⚠️ [SYSTEM]: تم رصد توكن منتهي أو غير صالح. جاري إعادة تهيئة الجلسة...` }]);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      });

      // الاتصال وإرسال طلب الانضمام المعزول للغرفة
      socket.connect();
      socket.emit('join_project', { project: savedProject });
    }

    return () => {
      socket.off('workspace_files');
      socket.off('user_projects');
      socket.off('preview_updated');
      socket.off('code_stream_chunk');
      socket.off('agent_states');
      socket.off('log');
      socket.off('connect_error');
    };
  }, [currentUser, activeProject, isAuthenticated]);

  return { 
    files, 
    logs, 
    streamingContent, 
    agentStates, 
    projects, 
    activeProject, 
    currentUser, 
    vercelUrl, 
    chatMessages, // تصدير مصفوفة المحادثة التفاعلية
    setChatMessages,
    setProjects, 
    setActiveProject, 
    setCurrentUser, 
    setVercelUrl, 
    setStreamingContent, 
    setFiles, 
    setLogs 
  };
}
