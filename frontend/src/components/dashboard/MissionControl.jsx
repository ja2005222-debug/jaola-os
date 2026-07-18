import React, { useState, useRef, useEffect } from 'react';

export default function MissionControl({ logs = [], onSendCommand, isConnected }) {
  const [command, setCommand] = useState('');
  const logsEndRef = useRef(null);

  // التمرير التلقائي للأسفل عند وصول رسائل (Logs) جديدة
  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    onSendCommand(command);
    setCommand('');
  };

  // دالة لتلوين السجلات بناءً على نوعها
  const getLogColor = (type) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'success': return 'text-emerald-400';
      case 'agent': return 'text-purple-400';
      case 'system': return 'text-blue-400';
      default: return 'text-slate-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050810] rounded-xl border border-slate-800/60 shadow-2xl overflow-hidden font-mono relative group">
      
      {/* تأثير الإضاءة الخلفي (Glow) */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none"></div>

      {/* شريط العنوان العلوي (Header) */}
      <div className="h-12 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between px-4 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-slate-400 text-xs font-bold tracking-widest uppercase ml-2">
            JAOLA Mission Control
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase">Status:</span>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold ${isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* منطقة عرض السجلات (Logs Terminal) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 z-10 custom-scrollbar">
        {logs.length === 0 ? (
          <div className="text-slate-600 text-sm animate-pulse">
            [SYSTEM] Waiting for JCR v2.1 initialization...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="text-sm font-medium leading-relaxed flex gap-3 hover:bg-slate-800/30 px-2 py-1 rounded transition-colors">
              <span className="text-slate-600 shrink-0">
                [{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]
              </span>
              <span className={`${getLogColor(log.type)} break-words`}>
                {log.type === 'agent' && '🤖 '}
                {log.type === 'error' && '⚠️ '}
                {log.type === 'success' && '✅ '}
                {log.type === 'system' && '⚡ '}
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* شريط إدخال الأوامر (Command Input) */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800 z-10 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <span className="absolute left-4 text-emerald-500 font-bold">CEO {`>`}</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={!isConnected}
            placeholder={isConnected ? "Enter command, ask a question, or assign a task..." : "Connecting to JCR Core..."}
            className="w-full bg-[#0a0f18] border border-slate-700 rounded-lg py-3 pl-14 pr-4 text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600 disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!isConnected || !command.trim()}
            className="absolute right-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 p-2 rounded-md transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
