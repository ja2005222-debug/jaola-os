
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// 🚀 توجيه مباشر للخادم (تجاوزنا متغيرات البيئة لضمان الاتصال)
const SOCKET_URL = import.meta.env.MODE === "production" 
  ? "https://jaola-os.onrender.com" // 👈 رابط الخادم الذي ظهر في سجلاتك
  : "http://localhost:4000";

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, latency: 0 });

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      withCredentials: true, // 👈 ضروري جداً
    });

    newSocket.on('connect', () => {
      console.log('🟢 JCR Link: ONLINE');
      setIsConnected(true);
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
