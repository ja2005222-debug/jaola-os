import { io } from 'socket.io-client';
const socket = io('http://localhost:3000');

useEffect(() => {
  socket.on('file-updated', () => {
    // تحديث الـ Iframe تلقائياً
    document.getElementById('live-preview').contentWindow.location.reload();
  });
}, []);
