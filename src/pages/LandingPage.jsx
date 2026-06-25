import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, Zap, ShieldCheck, Cpu, 
  Coffee, Plane, Hotel, BarChart,
  ArrowRight, Star, Users, Code, 
  Globe, Database, GitBranch, Terminal
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    { icon: <Bot size={24} />, title: 'AI Agents', desc: 'خطط، صمم، اكتب، اختبر، وانشر تلقائياً.' },
    { icon: <Cpu size={24} />, title: 'Digital Twin', desc: 'رؤية كاملة لمشروعك في لوحة تحكم حية.' },
    { icon: <Zap size={24} />, title: 'Live Preview', desc: 'شاهد التغييرات لحظة بلحظة في المعاينة الحية.' },
    { icon: <ShieldCheck size={24} />, title: 'CEO Intelligence', desc: 'تحليل السوق، تقدير التكلفة، وإدارة المخاطر.' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* خلفية متحركة */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* المحتوى */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* الهيدر */}
        <header className="flex justify-between items-center py-4 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-xl font-black text-white">J</span>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
              JAOLA OS
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 transition flex items-center gap-2"
            >
              <span>دخول</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </header>

        {/* القسم الرئيسي */}
        <section className="py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-xs text-emerald-400 mb-6">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            نظام تشغيل ذكي لتطوير البرمجيات
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              JAOLA OS
            </span>
            <br />
            <span className="text-slate-200">شركة برمجيات كاملة</span>
            <br />
            <span className="text-slate-400 text-3xl md:text-4xl">في لوحة تحكم واحدة</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            دع الـ AI Agents تعمل نيابة عنك: تحليل، تصميم، برمجة، اختبار، ونشر – كل ذلك في واجهة واحدة حية.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 rounded-xl font-semibold text-white shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 text-lg"
            >
              🚀 درب الآن
              <ArrowRight size={20} />
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition flex items-center gap-2 text-lg"
            >
              <Terminal size={20} />
              استكشف الواجهة
            </button>
          </div>
        </section>

        {/* الميزات */}
        <section className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/30 transition group">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold mt-4 text-white">{f.title}</h3>
              <p className="text-sm text-slate-400 mt-2">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* إحصائيات */}
        <section className="py-12 grid grid-cols-2 md:grid-cols-4 gap-4 text-center border-t border-slate-800/50">
          <div>
            <div className="text-3xl font-bold text-emerald-400">5</div>
            <div className="text-xs text-slate-500">AI Agents</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-cyan-400">10+</div>
            <div className="text-xs text-slate-500">أوامر ذكية</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-emerald-400">100%</div>
            <div className="text-xs text-slate-500">تحكم كامل</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-cyan-400">0</div>
            <div className="text-xs text-slate-500">تعقيد</div>
          </div>
        </section>

        {/* الفوتر */}
        <footer className="py-8 text-center text-xs text-slate-500 border-t border-slate-800/50 mt-12">
          &copy; 2026 JAOLA OS – نظام تشغيل الذكاء الاصطناعي لتطوير البرمجيات.
        </footer>
      </div>
    </div>
  );
}
