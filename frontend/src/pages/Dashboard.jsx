import React, { useState } from 'react';

// استيراد المكونات التي قمت بإنشائها
import AuthScreen from './auth/AuthScreen';
import PipelineVisualizer from './dashboard/PipelineVisualizer';
import MissionControl from './dashboard/MissionControl';
import Intelligence from './dashboard/Intelligence';

// استيراد الـ Hook الخاص بالاتصال
import useSocket from '../hooks/useSocket';

export default function Dashboard() {
  // حالة المصادقة (Authentication State)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);

  // جلب البيانات من JCR عبر الـ Socket
  // ملاحظة: الـ Hook سيعمل ويحاول الاتصال بناءً على وجود التوكن
  const { 
    isConnected, 
    logs, 
    metrics, 
    pipelineStage, 
    sendCommand 
  } = useSocket(isAuthenticated ? authToken : null);

  // دالة التعامل مع تسجيل الدخول
  const handleLogin = (token) => {
    setAuthToken(token);
    setIsAuthenticated(true);
  };

  // إذا لم يقم الـ CEO بتسجيل الدخول، نعرض شاشة المصادقة
  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  // الواجهة الرئيسية لـ JAOLA OS (NASA-Style)
  return (
    <div className="min-h-screen bg-[#020408] text-slate-300 font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      
      {/* 🌟 شريط المهام العلوي (Top Navigation) */}
      <header className="h-14 bg-[#050810]/80 border-b border-slate-800/80 backdrop-blur-xl flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-200 tracking-wide">JAOLA OS</h1>
            <p className="text-[10px] text-emerald-400 font-mono">Cognitive Runtime v2.1</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {/* مؤشر حالة الاتصال العلوية */}
          <div className="flex items-center gap-2">
             <span className="text-xs text-slate-500 font-mono">JCR CORE:</span>
             {isConnected ? (
               <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                 <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE
               </span>
             ) : (
               <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                 <span className="w-2 h-2 rounded-full bg-red-400"></span> OFFLINE
               </span>
             )}
          </div>
          
          <div className="w-px h-6 bg-slate-800"></div>
          
          {/* ملف الـ CEO */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-300 uppercase">System CEO</p>
              <p className="text-[10px] text-slate-500 font-mono">Admin Privileges</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* 🌟 شبكة لوحة القيادة (Dashboard Grid) */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 h-[calc(100vh-3.5rem)] overflow-hidden">
        
        {/* الشريط العلوي: متتبع الأنابيب (Pipeline Visualizer) */}
        <div className="col-span-12 shrink-0">
          <PipelineVisualizer currentStage={pipelineStage || 'planner'} />
        </div>

        {/* القسم المركزي: غرفة التحكم (Mission Control) */}
        <div className="col-span-12 lg:col-span-8 h-full min-h-0">
          <MissionControl 
            logs={logs} 
            onSendCommand={sendCommand} 
            isConnected={isConnected} 
          />
        </div>

        {/* القسم الجانبي: لوحة الذكاء (Intelligence Panel) */}
        <div className="col-span-12 lg:col-span-4 h-full min-h-0">
          <Intelligence 
            metrics={metrics} 
            activeAgents={22} 
            systemHealth={isConnected ? 100 : 0} 
          />
        </div>

      </main>
    </div>
  );
}
