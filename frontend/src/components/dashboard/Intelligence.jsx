import React from 'react';

export default function Intelligence({ metrics = {}, activeAgents = 22, systemHealth = 100 }) {
  // قيم افتراضية في حال لم يتم تمرير البيانات بعد
  const {
    tasksCompleted = 0,
    linesOfCode = 0,
    bugsFixed = 0,
    uptime = "0h 0m"
  } = metrics;

  return (
    <div className="flex flex-col h-full bg-[#050810]/80 rounded-xl border border-slate-800/60 shadow-2xl overflow-hidden backdrop-blur-xl">
      
      {/* العنوان */}
      <div className="h-12 bg-slate-900/60 border-b border-slate-800 flex items-center px-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-slate-300 text-xs font-bold tracking-widest uppercase">
          System Intelligence
        </span>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4 flex-1 overflow-y-auto custom-scrollbar">
        
        {/* كارت: صحة النظام */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 relative group overflow-hidden">
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">System Health</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-emerald-400">{systemHealth}%</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 mt-3 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full" style={{ width: `${systemHealth}%` }}></div>
          </div>
        </div>

        {/* كارت: الوكلاء النشطين */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 relative group overflow-hidden">
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Active Agents</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-bold text-blue-400">{activeAgents}</span>
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">JCR v2.1 Routing Active</p>
        </div>

        {/* كارت: إحصائيات التوأم الرقمي (Digital Twin) */}
        <div className="col-span-2 bg-slate-900/50 p-4 rounded-lg border border-slate-800 mt-2">
          <p className="text-xs text-slate-500 uppercase font-semibold mb-4 border-b border-slate-800 pb-2">Project Digital Twin</p>
          
          <div className="grid grid-cols-2 gap-y-4 gap-x-2">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Tasks Completed</p>
              <p className="text-lg font-mono text-slate-300">{tasksCompleted}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Lines Generated</p>
              <p className="text-lg font-mono text-slate-300">{linesOfCode}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Bugs Resolved</p>
              <p className="text-lg font-mono text-slate-300">{bugsFixed}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Session Uptime</p>
              <p className="text-lg font-mono text-slate-300">{uptime}</p>
            </div>
          </div>
        </div>

        {/* مؤشر الأداء */}
        <div className="col-span-2 mt-2 flex items-center justify-between bg-slate-900/30 px-3 py-2 rounded-lg border border-slate-800/50">
          <span className="text-[10px] text-slate-500 uppercase">JCR AI Model</span>
          <span className="text-[10px] text-emerald-400/80 font-mono">GPT-4o / DeepSeek (Core)</span>
        </div>
      </div>
    </div>
  );
}
