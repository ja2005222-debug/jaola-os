import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// 🚀 تحديث مهم هنا: إذا كان لدينا رابط للخادم نضعه هنا، وإلا نستخدم النطاق الحالي
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "https://رابط-الخادم-الخلفي-الخاص-بك.onrender.com"; 

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, latency: 0 });

  useEffect(() => {
    // الاتصال بالخادم
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // دعم الاتصال
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('🟢 JCR Link: ONLINE');
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

    return () => newSocket.close();
  }, []);

  return { socket, isConnected, metrics };
};

export default useSocket;
