import React, { useState } from 'react';
import { LayoutDashboard, Terminal, Bot, Zap, Clock, ShieldCheck, Cpu, ChevronRight } from 'lucide-react';

export default function App() {
  const [agents] = useState([
    { name: 'Planner', status: 'idle' },
    { name: 'Architect', status: 'idle' },
    { name: 'Coder', status: 'working' },
    { name: 'QA', status: 'idle' }
  ]);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* الـ Grid الأساسي */}
      <div className="grid grid-cols-12 grid-rows-6 gap-2 w-full h-full p-2">
        
        {/* CEO Brief - في الأعلى */}
        <div className="col-span-12 row-span-1 border border-slate-800 bg-slate-900/50 rounded-xl p-4 flex items-center justify-between shadow-2xl">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">JAOLA OS</h1>
          <div className="flex gap-10 text-sm text-slate-400">
            <div className="flex flex-col"><span className="text-xs text-slate-600">المشروع</span><span className="font-semibold text-white">Pizza Store</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">التقدم</span><span className="font-semibold text-emerald-400">64%</span></div>
            <div className="flex flex-col"><span className="text-xs text-slate-600">الوقت المتبقي</span><span className="font-semibold">14 دقيقة</span></div>
          </div>
        </div>

        {/* AI Chat */}
        <div className="col-span-4 row-span-3 border border-slate-800 bg-slate-900 rounded-xl p-4 overflow-hidden flex flex-col">
          <h2 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2"><Bot size={16}/> AI CHAT</h2>
          <div className="flex-1 space-y-2 text-sm overflow-y-auto">
            <p className="p-2 bg-slate-800 rounded border-l-2 border-emerald-500">🧠 Planner: بدأ تحليل متطلبات متجر البيتزا...</p>
            <p className="p-2 bg-slate-800 rounded border-l-2 border-cyan-500">🏗 Architect: تم تصميم قاعدة البيانات.</p>
          </div>
        </div>

        {/* Live Preview */}
        <div className="col-span-8 row-span-3 border border-slate-800 bg-white rounded-xl overflow-hidden shadow-inner">
          <div className="h-6 bg-slate-100 border-b border-slate-200 flex items-center px-3 gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
          </div>
          <iframe src="about:blank" className="w-full h-full" title="Live Preview" />
        </div>

        {/* Timeline & Changes */}
        <div className="col-span-4 row-span-2 border border-slate-800 bg-slate-900 rounded-xl p-4 overflow-y-auto">
          <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><Clock size={16}/> TIMELINE</h2>
          <div className="text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-400">✓ تحليل الطلب</div>
            <div className="flex items-center gap-2 text-emerald-400">✓ إنشاء الخطة</div>
            <div className="flex items-center gap-2 text-white animate-pulse"><Zap size={12}/> إنشاء المشروع (جاري العمل)</div>
          </div>
        </div>

        {/* Agents & Twin */}
        <div className="col-span-8 row-span-2 grid grid-cols-2 gap-2">
          <div className="border border-slate-800 bg-slate-900 rounded-xl p-4">
             <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><Cpu size={16}/> AGENTS</h2>
             <div className="grid grid-cols-2 gap-2">
                {agents.map(a => (
                  <div key={a.name} className={`text-xs p-2 rounded border ${a.status === 'working' ? 'border-emerald-900 bg-emerald-950' : 'border-slate-800'}`}>
                    {a.name} {a.status === 'working' ? '⚙️' : '✅'}
                  </div>
                ))}
             </div>
          </div>
          <div className="border border-slate-800 bg-slate-900 rounded-xl p-4">
             <h2 className="text-sm font-bold text-slate-500 mb-2 flex items-center gap-2"><ShieldCheck size={16}/> DIGITAL TWIN</h2>
             <div className="text-xs text-slate-400 space-y-1">
                <p>Framework: <span className="text-white">Next.js 15</span></p>
                <p>Health: <span className="text-emerald-400">96%</span></p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
