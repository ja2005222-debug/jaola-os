import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// 🛠️ الاتصال المباشر والديناميكي بمنفذ الباك إند (بفضل تفعيل CORS: * في السيرفر) لتفادي مشاكل بروكسي فيت للـ WebSockets
const BACKEND_URL = `http://${window.location.hostname}:4000`;
export const socket = io(BACKEND_URL, { autoConnect: false });

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

    // استعادة الأحداث والمستمعات على نفس السوكيت الموحد المشترك
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
      
      setLogs((prev) => [...prev, { message: `⚠️ [SYSTEM]: تم رصد توكن منتهي أو غير صالح. جاري إعادة تهيئة الجلسة أمنياً...` }]);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });

    return () => {
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
