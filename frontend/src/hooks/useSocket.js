import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

export const socket = io(BACKEND_URL, { 
  autoConnect: false,
  transports: ['polling', 'websocket'] 
});

export function useSocket(isAuthenticated, handleAuthError) {
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  
  // إدارة حالات المشاريع والمستخدم والروابط المصدقة داخل خطاف السوكيت
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState('sandbox_app');
  const [currentUser, setCurrentUser] = useState('guest_user');
  const [vercelUrl, setVercelUrl] = useState('');

  // مصفوفة رسائل الشات
  const [chatMessages, setChatMessages] = useState([]);

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

      // السجلات (مع فلترة الرسائل الموجهة للشات إن وُجدت)
      socket.off('log').on('log', (newLog) => {
        setLogs((prev) => [...prev.slice(-100), newLog]);

        if (newLog.message.includes('AI CEO Consultant') || newLog.message.includes('[INFO]')) {
          const cleanReply = newLog.message
            .replace(/.*AI CEO Consultant\]:\s*/, '')
            .replace('🤖 [AI CEO Consultant]:', '')
            .replace('🤖 [INFO]:', '')
            .trim();
          
          setChatMessages((prev) => [...prev, { sender: 'ai', text: cleanReply }]);
        }
      });

      socket.off('chat_reply').on('chat_reply', (data) => {
        setChatMessages((prev) => [...prev, { 
          sender: 'assistant', 
          text: data.message, 
          timestamp: Date.now() 
        }]);
      });

      // 💾 4. استقبال وحقن تاريخ الدردشة التراكمي المصدق بالكامل من الـ DB لإنعاش ذاكرة الشات حركياً
      socket.off('chat_history').on('chat_history', (history) => {
        if (history && history.length > 0) {
          const formattedHistory = history.map(msg => ({
            sender: msg.role === 'user' ? 'user' : 'ai',
            text: msg.content
          }));
          setChatMessages(formattedHistory); // تحديث واجهة الشات بالتاريخ التراكمي
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

      // الاتصال والانضمام للغرفة
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
      socket.off('chat_reply');        
      socket.off('chat_history'); // تنظيف المستمع الجديد
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
    chatMessages,          
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
