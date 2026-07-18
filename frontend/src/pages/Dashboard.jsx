import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

// استيراد المكونات (سنقوم بإنشائها في الخطوات القادمة)
// import AuthScreen from '../components/auth/AuthScreen';
// import Topbar from '../components/layout/Topbar';
// import Sidebar from '../components/layout/Sidebar';
// import MissionControl from '../components/dashboard/MissionControl';
// import Workspace from '../components/dashboard/Workspace';
// import Intelligence from '../components/dashboard/Intelligence';
// import PipelineVisualizer from '../components/dashboard/PipelineVisualizer';

export default function Dashboard() {
  const { isAuthenticated, isLoading, handleAuthError } = useAuth();
  const isMobile = useIsMobile();
  const socketData = useSocket(isAuthenticated, handleAuthError);

  // حالة التنقل الداخلي
  const [activeNav, setActiveNav] = useState('mission');
  const [activeTab, setActiveTab] = useState('preview');

  // شاشة التحميل
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // شاشة تسجيل الدخول (سنفصلها لاحقاً في مكون AuthScreen)
  if (!isAuthenticated) {
    return <div className="text-white p-10">TODO: Render AuthScreen Component</div>;
  }

  // 📱 تخطيط الجوال (Mobile Layout)
  if (isMobile) {
    return (
      <div className="h-[100dvh] bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
        {/* سيتم وضع تخطيط الجوال هنا لاحقاً */}
        <div className="p-4">Mobile view is under construction...</div>
      </div>
    );
  }

  // 🖥️ تخطيط سطح المكتب (Desktop Layout - Ultra Premium)
  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* 1. الشريط العلوي */}
      {/* <Topbar {...socketData} /> */}
      <header className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 flex items-center px-4 justify-between shrink-0 z-50">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm shadow-[0_0_15px_rgba(59,130,246,0.3)]">⚡</div>
            <span className="font-extrabold tracking-tight text-lg">JAOLA OS</span>
            <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">v3.0</span>
         </div>
         {/* باقي عناصر Topbar ستأتي هنا */}
      </header>

      {/* 2. منطقة المحتوى الرئيسية */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* الشريط الجانبي الأيسر (Sidebar) */}
        {/* <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} /> */}
        <aside className="w-16 bg-slate-900/50 border-r border-slate-800/80 flex flex-col items-center py-4 gap-4 shrink-0 backdrop-blur-sm">
          {['⚡', '📁', '🤖', '📚', '🚀', '⚙️'].map((icon, i) => (
            <button key={i} className="w-10 h-10 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 text-slate-400 transition-all flex items-center justify-center text-xl">
              {icon}
            </button>
          ))}
        </aside>

        {/* القسم الأوسط الأيسر (Mission Control - الشات) */}
        <section className="w-[400px] min-w-[340px] bg-slate-900/30 border-r border-slate-800/80 flex flex-col relative">
          {/* <MissionControl {...socketData} /> */}
          <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center text-slate-500">Mission Control Area</div>
        </section>

        {/* القسم الأوسط الأيمن (Workspace - المحرر والمعاينة) */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#030508] relative shadow-inner">
          {/* <Workspace activeTab={activeTab} setActiveTab={setActiveTab} {...socketData} /> */}
          <div className="flex-1 flex items-center justify-center text-slate-500">Workspace (Monaco / Preview) Area</div>
          
          {/* شريط تتبع الوكلاء (Pipeline Visualizer) في الأسفل */}
          {/* <PipelineVisualizer agentStates={socketData.agentStates} /> */}
          <div className="h-16 bg-slate-950 border-t border-slate-800/80 shrink-0 flex items-center justify-center text-slate-600 text-sm">
            Pipeline Visualizer Area
          </div>
        </main>

        {/* الشريط الأيمن (Intelligence - المؤشرات والذكاء) */}
        <aside className="w-[280px] bg-slate-900/40 border-l border-slate-800/80 flex flex-col overflow-y-auto shrink-0 backdrop-blur-sm">
          {/* <Intelligence {...socketData} /> */}
          <div className="flex-1 p-4 flex items-center justify-center text-slate-500 text-center">Intelligence & Digital Twin Area</div>
        </aside>
      </div>

    </div>
  );
}
