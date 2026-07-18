import React, { useState } from 'react';
import { Shield, Activity, Terminal } from 'lucide-react';

// المسارات الصحيحة 100% للرجوع لمجلد المكونات (components)
import AuthScreen from '../components/auth/AuthScreen';
import PipelineVisualizer from '../components/dashboard/PipelineVisualizer';
import MissionControl from '../components/dashboard/MissionControl';
import Intelligence from '../components/dashboard/Intelligence';
import useSocket from '../hooks/useSocket';

const Dashboard = () => {
  // حالة المصادقة (مغلق افتراضياً حتى يتم إدخال الـ PAT)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // استدعاء السوكت والمقاييس من الهوك المخصص
  const { socket, connected, metrics } = useSocket();

  // إذا لم يقم بتسجيل الدخول، اعرض شاشة المصادقة
  if (!isAuthenticated) {
    return <AuthScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  // الواجهة الرئيسية لـ JAOLA OS (بعد تسجيل الدخول)
  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 font-sans relative overflow-hidden">
      
      {/* تأثيرات الإضاءة الخلفية (Glowing Effects) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* الشريط العلوي (Header) */}
      <header className="relative flex justify-between items-center mb-8 bg-gray-900/40 backdrop-blur-xl p-5 rounded-2xl border border-gray-800 shadow-[0_0_30px_rgba(0,255,255,0.05)] z-10">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <Terminal className="text-cyan-400 w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-wider">
              JAOLA OS
            </h1>
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Autonomous Engineering Core</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* مؤشر حالة الاتصال */}
          <div className="flex items-center gap-3 bg-gray-950/50 px-4 py-2 rounded-lg border border-gray-800">
            <div className="relative">
              <Activity className={`w-5 h-5 ${connected ? "text-green-400" : "text-red-400"}`} />
              {connected && (
                <span className="absolute top-0 left-0 w-full h-full bg-green-400 rounded-full animate-ping opacity-20"></span>
              )}
            </div>
            <span className="text-xs font-mono font-semibold tracking-wider text-gray-300">
              {connected ? "JCR LINK: ONLINE" : "JCR LINK: OFFLINE"}
            </span>
          </div>
          <Shield className="text-cyan-500 w-6 h-6 opacity-80" />
        </div>
      </header>

      {/* شبكة لوحة القيادة (Dashboard Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* العمود الأيسر (Mission Control & Intelligence) - يأخذ 4 أعمدة */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <MissionControl socket={socket} metrics={metrics} />
          <Intelligence socket={socket} />
        </div>

        {/* العمود الأيمن (Pipeline Visualizer) - يأخذ 8 أعمدة */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-140px)]">
          <PipelineVisualizer socket={socket} />
        </div>
        
      </div>
    </div>
  );
};

export default Dashboard;
