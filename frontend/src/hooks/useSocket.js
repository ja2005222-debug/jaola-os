import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// 🚀 التحديث الذكي والآمن:
// نعتمد فقط على VITE_BACKEND_URL في الإنتاج 
// (أزلنا window.location.origin لأنه يسبب اتصالاً ذاتياً خاطئاً إذا لم يجد الرابط)
const SOCKET_URL = import.meta.env.MODE === "production" 
  ? import.meta.env.VITE_BACKEND_URL 
  : "http://localhost:4000";

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, latency: 0 });

  useEffect(() => {
    // الاتصال بالخادم
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // دعم الاتصال
      reconnectionAttempts: 5,
      withCredentials: true, // 👈 🔴 هذا هو السطر السحري الذي كان ينقصك!
    });

    newSocket.on('connect', () => {
      console.log('🟢 JCR Link: ONLINE', newSocket.id);
      setIsConnected(true);
      // الانضمام لغرفة المشروع
      newSocket.emit('join_project', 'jaola-core-main');
    });

    newSocket.on('disconnect', () => {
      console.log('🔴 JCR Link: OFFLINE');
      setIsConnected(false);
    });

    newSocket.on('system_metrics', (data) => {
      setMetrics(data);
    });

    setSocket(newSocket);

    // تنظيف الاتصال عند إغلاق المكون
    return () => newSocket.close();
  }, []);

  return { socket, isConnected, metrics };
};

export default useSocket;
