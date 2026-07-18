import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// تحديد مسار الخادم تلقائياً (سواء على بيئة التطوير أو الإنتاج في Render)
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/');

const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState({ latency: 0, memory: 0, cpu: 0 });

  useEffect(() => {
    // تهيئة الاتصال
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    setSocket(newSocket);

    // عند نجاح الاتصال
    newSocket.on('connect', () => {
      setConnected(true);
      console.log('🟢 [JCR Socket] Connected to JAOLA Core');
      // الانضمام لغرفة المشروع لاستقبال التحديثات
      newSocket.emit('join_project_room', { projectId: 'jaola-core-main' });
    });

    // عند انقطاع الاتصال
    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('🔴 [JCR Socket] Disconnected from Core');
    });

    // استقبال المقاييس الحية من الخادم
    newSocket.on('system_metrics', (data) => {
      setMetrics(prev => ({ ...prev, ...data }));
    });

    // حساب سرعة الاستجابة (Ping/Pong)
    let pingInterval = setInterval(() => {
      const start = Date.now();
      newSocket.emit('ping', () => {
        const duration = Date.now() - start;
        setMetrics(prev => ({ ...prev, latency: duration }));
      });
    }, 5000);

    // تنظيف الاتصال عند إغلاق الصفحة
    return () => {
      clearInterval(pingInterval);
      newSocket.disconnect();
    };
  }, []);

  return { socket, connected, metrics };
};

// هذا هو السطر الذي كان يشتكي منه نظام البناء!
export default useSocket; 
