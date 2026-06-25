import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

// الاتصال بالسيرفر
const socket = io('http://localhost:3000');

const Dashboard = () => {
  const [command, setCommand] = useState('');
  const [logs, setLogs] = useState([]);

  // الاستماع للإشارات القادمة من السيرفر
  useEffect(() => {
    socket.on('progress', (msg) => {
      setLogs(prev => [...prev, msg]);
    });
    return () => socket.off('progress');
  }, []);

  const handleExecute = async () => {
    if (!command.trim()) return;
    setLogs([]); // مسح السجلات القديمة عند بدء مهمة جديدة
    try {
      await axios.post('http://localhost:3000/api/chat', { task: command });
    } catch (err) {
      setLogs(prev => [...prev, "❌ خطأ في الاتصال بالسيرفر"]);
    }
  };

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-4 text-blue-400">JAOLA OS Dashboard</h1>
      
      <textarea 
        className="w-full border p-2 mb-2 rounded bg-gray-800" 
        value={command} 
        onChange={(e) => setCommand(e.target.value)} 
        placeholder="اكتب أمراً للـ CEO..." 
      />
      <button className="bg-blue-600 p-2 w-full rounded font-bold" onClick={handleExecute}>
        إرسال الأمر
      </button>

      {/* منطقة مراقبة السجلات الحية */}
      <div className="mt-6 p-4 bg-black border border-gray-700 rounded h-40 overflow-y-auto font-mono text-sm text-green-400">
        {logs.map((log, i) => <p key={i} className="mb-1">{log}</p>)}
      </div>
      
      <h2 className="mt-6 font-bold">Digital Twin Preview:</h2>
      <iframe src="http://localhost:3000/workspace/index.html" className="w-full h-64 border mt-2 bg-white" />
    </div>
  );
};

export default Dashboard;
