import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname.startsWith('100.115')
  ? `http://${window.location.hostname}:4000`
  : 'https://jaola-os.onrender.com';

export const socket = io(BACKEND_URL, { 
  autoConnect: false,
  transports: ['polling', 'websocket'] 
});

export function useSocket(currentUser, activeProject, isAuthenticated, handleAuthError) {
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
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
    if (token) {
      socket.auth = { token };

      // 🛠️ الخطوة الأهم: تسجيل وتفعيل جميع المستمعات أولاً لضمان عدم فوات أي حدث برمجى
      socket.off('workspace_files').on('workspace_files', (workspaceFiles) => {
        setFiles(workspaceFiles);
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

      socket.off('log').on('log', (newLog) => {
        setLogs((prev) => [...prev.slice(-100), newLog]);
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

      // 🛠️ الاتصال وإرسال طلب الانضمام للروم بعد تأمين تفعيل جميع المستمعات بنجاح
      socket.connect();
      socket.emit('join_project', { project: activeProject });
    }

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
      socket.off('workspace_files');
      socket.off('preview_updated');
      socket.off('code_stream_chunk');
      socket.off('agent_states');
      socket.off('log');
      socket.off('connect_error');
    };
  }, [currentUser, activeProject, isAuthenticated]);

  return { files, logs, streamingContent, agentStates, setStreamingContent, setFiles, setLogs };
}
