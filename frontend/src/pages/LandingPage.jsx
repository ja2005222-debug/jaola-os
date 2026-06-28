import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  // تأثير ناعم للنافبار عند التمرير
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = () => {
    // التوجيه الذكي المباشر إلى مسار لوحة التحكم
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#05070f] text-slate-100 font-sans relative overflow-x-hidden selection:bg-cyan-500 selection:text-slate-950">
      
      {/* 🔮 هالات نيونية متدرجة عميقة تمنح الصفحة بعداً بصرياً ثلاثي الأبعاد */}
      <div className="absolute top-[-250px] left-[-150px] w-[700px] h-[700px] rounded-full bg-cyan-500/5 blur-[160px] pointer-events-none"></div>
      <div className="absolute bottom-[-200px] right-[-150px] w-[800px] h-[800px] rounded-full bg-indigo-500/5 blur-[190px] pointer-events-none"></div>
      <div className="absolute top-[35%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-500/3 blur-[150px] pointer-events-none"></div>

      {/* 🔮 النافبار الفخم والشفاف */}
      <header className={`px-8 py-5 flex items-center justify-between sticky top-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-[#05070f]/90 border-b border-slate-900/80 backdrop-blur-xl py-4' : 'bg-transparent'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-cyan-500/10">⚡</div>
          <span className="text-lg font-black bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">JAOLA OS</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-400">
          <a href="#features" class="hover:text-cyan-400 transition-colors">الميزات الثورية</a>
          <a href="#architecture" class="hover:text-cyan-400 transition-colors">النواة الإدراكية</a>
          <a href="#pricing" class="hover:text-cyan-400 transition-colors">خطط التشغيل</a>
        </nav>
        <button 
          onClick={handleGetStarted}
          className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          ابدأ مجاناً 🚀
        </button>
      </header>

      {/* 🚀 قسم العرض الرئيسي الفاخر (Hero Section) */}
      <section className="max-w-4xl mx-auto text-center px-6 py-28 md:py-36 flex flex-col items-center justify-center relative z-10">
        <div className="inline-flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-800/30 text-cyan-400 px-4 py-2 rounded-full text-[10px] font-bold tracking-wider mb-8 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.1)]">
          ✨ إطلاق الإصدار المعرفي المطور JCOS v4.0
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-8">نظام تشغيل معرفي مستقل <br/><span class="bg-gradient-to-r from-cyan-400 via-teal-400 to-indigo-500 bg-clip-text text-transparent">يفكر ويصيغ ويصحح ذاتياً</span></h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl mb-12">منصة التطوير السحابية الأولى من نوعها التي لا تكتفي بإنتاج الشفرات البرمجية؛ بل تمتلك عقولاً إدراكية تفكك المهام، تتجادل تخصصياً، وتطور من كفاءة مشروعك تلقائياً حياً ومباشراً.</p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button 
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-xs px-9 py-4 rounded-xl shadow-lg shadow-cyan-500/25 hover:scale-[1.03] transition-all duration-300"
          >
            ادخل لوحة التحكم والتشغيل حياً 🚀
          </button>
          <a 
            href="#features"
            className="border border-slate-800 text-xs text-slate-300 font-bold px-9 py-4 rounded-xl hover:bg-slate-900/60 transition-all duration-300"
          >
            استكشف الميزات والطبقات الثمانية
          </a>
        </div>
      </section>

      {/* 🔮 قسم الميزات الإدراكية (Features Section) */}
      <section id="features" className="max-w-[1300px] mx-auto px-6 py-24 relative z-10 border-t border-slate-900/40">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-4">هندسة متكاملة بأبعاد إدراكية ثورية</h2>
        <p className="text-slate-500 text-xs md:text-sm text-center max-w-md mx-auto mb-16 leading-relaxed">اكتشف كيف يتحول JAOLA OS من مجرد محرك توليد أكواد إلى فريق عمل معرفي متكامل لخدمتك.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* ميزة 1 */}
          <div className="bg-[#070b14]/50 border border-slate-900 rounded-2xl p-6 hover:border-cyan-500/30 hover:scale-[1.02] transition-all duration-300 group">
            <div className="text-3xl mb-4 p-2 bg-cyan-950/30 rounded-xl w-fit">🧠</div>
            <h3 className="text-sm font-bold text-slate-200 mb-2 group-hover:text-cyan-400 transition-colors">النواة المعرفية الذاتية</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">تحليل النوايا وفك الأهداف المعقدة (Goal Decomposition) وطابور أولويات ذكي يبدأ بالأكثر حرجاً.</p>
          </div>

          {/* ميزة 2 */}
          <div className="bg-[#070b14]/50 border border-slate-900 rounded-2xl p-6 hover:border-violet-500/30 hover:scale-[1.02] transition-all duration-300 group">
            <div className="text-3xl mb-4 p-2 bg-violet-950/30 rounded-xl w-fit">🏗️</div>
            <h3 className="text-sm font-bold text-slate-200 mb-2 group-hover:text-violet-400 transition-colors">الجدال التخصصي المتوازى</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">حلقة نقاش فوري بين خبراء الأمان والجودة والبناء لإنتاج شفرة برمجية آمنة ومصفاة من أول محاولة.</p>
          </div>

          {/* ميزة 3 */}
          <div className="bg-[#070b14]/50 border border-slate-900 rounded-2xl p-6 hover:border-emerald-500/30 hover:scale-[1.02] transition-all duration-300 group">
            <div className="text-3xl mb-4 p-2 bg-emerald-950/30 rounded-xl w-fit">🧩</div>
            <h3 className="text-sm font-bold text-slate-200 mb-2 group-hover:text-emerald-400 transition-colors">محرك الفضول التلقائي</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">يعمل بالخلفية ليتساءل تلقائياً "هل توجد شفرة أكثر نظافة وأعلى أداءً؟" ويقوم بإعادة بنائها وتحسينها.</p>
          </div>

          {/* ميزة 4 */}
          <div className="bg-[#070b14]/50 border border-slate-900 rounded-2xl p-6 hover:border-indigo-500/30 hover:scale-[1.02] transition-all duration-300 group">
            <div className="text-3xl mb-4 p-2 bg-indigo-950/30 rounded-xl w-fit">💾</div>
            <h3 className="text-sm font-bold text-slate-200 mb-2 group-hover:text-indigo-400 transition-colors">الذاكرة التنفيذية الدائمة</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed">يتذكر تفضيلاتك البرمجية، الألوان، الخطوط المفضلة، ونبرتك البصرية ليستخدمها تلقائياً بجميع مشاريعك.</p>
          </div>

        </div>
      </section>

      {/* 🔮 قسم الـ CTA الأخير الفاخر */}
      <section className="max-w-[1100px] mx-auto px-6 py-20 relative z-10">
        <div className="bg-gradient-to-br from-[#070b14]/80 to-slate-950/80 border border-slate-800 rounded-3xl p-10 md:p-16 text-center backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-[-100px] right-[-50px] w-64 h-64 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none"></div>
          <h2 className="text-2xl md:text-4xl font-black mb-6">هل أنت جاهز لتجربة <br/><span class="bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">الجيل القادم من أنظمة التطوير؟</span></h2>
          <p className="text-slate-500 text-xs md:text-sm max-w-md mx-auto mb-10 leading-relaxed">ابدأ الآن بتأسيس وإطلاق بيئة عملك الإدراكية المعزولة، وتوجيه أولى مهامك الإنشائية لتشاهد سحر توليد الصور وتأصيل الأكواد حياً.</p>
          <button 
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-xs px-10 py-4 rounded-xl shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-all duration-300"
          >
            ادخل لوحة التحكم والتشغيل مجاناً
          </button>
        </div>
      </section>

    </div>
  );
}
