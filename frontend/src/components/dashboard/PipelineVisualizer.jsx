import React from 'react';

export default function PipelineVisualizer({ agentStates }) {
  // تعريف الوكلاء وترتيبهم في خط الأنابيب
  const pipeline = [
    { id: 'planner', label: 'Planner', icon: '🗺️' },
    { id: 'architect', label: 'Architect', icon: '🏗️' },
    { id: 'coder', label: 'Coder', icon: '💻' },
    { id: 'qa', label: 'QA / Review', icon: '🧪' },
    { id: 'deploy', label: 'Deploy', icon: '🚀' },
  ];

  // دالة مساعدة لتحديد الألوان بناءً على الحالة القادمة من السيرفر
  const getStateStyles = (state) => {
    switch (state) {
      case 'active':
      case 'working':
        return 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse';
      case 'done':
      case 'completed':
        return 'bg-emerald-500/20 border-emerald-500 text-emerald-400';
      case 'error':
      case 'failed':
        return 'bg-red-500/20 border-red-500 text-red-400';
      default: // waiting
        return 'bg-slate-800/50 border-slate-700 text-slate-500 opacity-50';
    }
  };

  return (
    <div className="h-16 bg-[#0a0f18] border-t border-slate-800 flex items-center px-6 overflow-x-auto shrink-0 hide-scrollbar relative z-20">
      <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
        {pipeline.map((agent, index) => {
          // استخراج حالة الوكيل من الـ Props أو جعله waiting كافتراضي
          const state = agentStates?.[agent.id] || 'waiting';
          const styles = getStateStyles(state);
          const isLast = index === pipeline.length - 1;

          return (
            <React.Fragment key={agent.id}>
              {/* عقدة الوكيل (Agent Node) */}
              <div className="flex flex-col items-center gap-1 relative group cursor-default">
                <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-lg transition-all duration-300 ${styles}`}>
                  {agent.icon}
                </div>
                
                {/* Tooltip صغير يعرض اسم الوكيل */}
                <span className="absolute -top-8 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {agent.label} ({state})
                </span>
              </div>

              {/* خط التوصيل بين الوكلاء (Connection Line) */}
              {!isLast && (
                <div className="flex-1 h-[2px] mx-2 relative">
                  {/* خط رمادي خلفي */}
                  <div className="absolute inset-0 bg-slate-800"></div>
                  {/* خط ملون يمتلئ إذا كان الوكيل الذي قبله قد انتهى */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-700 ease-in-out"
                    style={{ 
                      width: (state === 'done' || state === 'completed') ? '100%' : '0%',
                      boxShadow: (state === 'done') ? '0 0 10px rgba(16, 185, 129, 0.5)' : 'none'
                    }}
                  ></div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
