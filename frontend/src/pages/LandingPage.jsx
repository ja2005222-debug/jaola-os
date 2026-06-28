import React, { useEffect, useState, useRef } from 'react';

export default function LandingPage({ navigateTo }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = () => navigateTo('dashboard');

  return (
    <div className="min-h-screen bg-[#03050A] text-slate-100 font-sans overflow-x-hidden selection:bg-cyan-500/50 selection:text-white">
      
      {/* خلفية ديناميكية */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-300px] right-[-200px] w-[800px] h-[800px] rounded-full bg-cyan-600/10 blur-[180px] animate-pulse" />
        <div className="absolute bottom-[-300px] left-[-200px] w-[700px] h-[700px] rounded-full bg-indigo-700/10 blur-[160px]" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-violet-600/5 blur-[200px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMTUiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40" />
      </div>

      {/* شريط التنقل */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled ? 'bg-[#03050A]/80 backdrop-blur-2xl border-b border-white/[0.05] shadow-2xl' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="bg-gradient-to-br from-cyan-400 to-indigo-600 p-2.5 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all duration-300">
              <span className="text-xl font-black text-white">⚡</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">JAOLA OS</h1>
              <p className="text-[9px] font-medium text-cyan-400 tracking-widest uppercase">Cognitive Kernel</p>
            </div>
          </div>
          
          <nav className="hidden lg:flex items-center gap-10 text-[13px] font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">القدرات</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">آلية العمل</a>
            <a href="#testimonials" className="hover:text-white transition-colors">التجارب</a>
            <a href="#faq" className="hover:text-white transition-colors">الأسئلة</a>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleGetStarted}
              className="bg-white text-slate-950 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-slate-200 transition-all duration-300 shadow-lg shadow-white/5"
            >
              دخول المنصة 🚀
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 pt-40 pb-24 md:pt-48 md:pb-32 max-w-7xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-4 py-1.5 rounded-full text-xs font-semibold mb-8">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          الإصدار المعرفي JCOS v4.0 متاح الآن
        </div>
        
        <h1 className="text-5xl md:text-7xl xl:text-8xl font-black tracking-tight leading-[1.1] mb-8">
          فريق من الوكلاء<br/>
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-500 bg-clip-text text-transparent">
            يفكر، يبني، وينشر
          </span>
        </h1>
        
        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          أول نظام تشغيل معرفي لتطوير الويب. اكتب فكرتك بالعربية، ودع الوكلاء المتخصصين يتجادلون وينتجون كودًا احترافيًا آمنًا وجاهزًا للنشر في ثوانٍ.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-base px-10 py-4 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:scale-105 transition-transform duration-300"
          >
            ابدأ البناء الآن ⚡
          </button>
          <a href="#how-it-works" className="text-slate-300 font-semibold text-sm px-8 py-4 rounded-2xl border border-white/10 hover:bg-white/5 transition-all duration-300">
            شاهد كيف يعمل ←
          </a>
        </div>

        {/* شريط إحصاءات سريع */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto text-center">
          <div className="space-y-1">
            <div className="text-3xl font-black text-white">20+</div>
            <div className="text-xs text-slate-500">مشروع يومياً</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black text-white">0.8s</div>
            <div className="text-xs text-slate-500">زمن التوليد</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black text-white">99.9%</div>
            <div className="text-xs text-slate-500">دقة الكود</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-black text-white">24/7</div>
            <div className="text-xs text-slate-500">نشر تلقائي</div>
          </div>
        </div>
      </section>

      {/* الميزات */}
      <section id="features" className="relative z-10 py-24 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black mb-5">قدرات معرفية <span className="text-cyan-400">ثورية</span></h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">ليست مجرد أداة توليد أكواد، بل عقل جماعي من الوكلاء المتخصصين يعمل بتناغم.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="group bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 hover:bg-white/[0.04] hover:border-cyan-500/30 transition-all duration-500">
              <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">🧠</div>
              <h3 className="text-lg font-bold mb-3">التخطيط الواعي (Meta-Reasoning)</h3>
              <p className="text-sm text-slate-400 leading-relaxed">النواة تشك في فهمها للطلب، تطرح الأسئلة الذكية، وتفكك الهدف إلى مهام صغيرة مرتبة بالأولوية.</p>
            </div>

            <div className="group bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 hover:bg-white/[0.04] hover:border-violet-500/30 transition-all duration-500">
              <div className="w-14 h-14 bg-violet-500/10 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">⚔️</div>
              <h3 className="text-lg font-bold mb-3">الجدال التخصصي (Multi-Agent Debate)</h3>
              <p className="text-sm text-slate-400 leading-relaxed">خبراء الأمان، التصميم، والأداء يراجعون الكود معاً في جولة واحدة، ويصرون على الكمال قبل التسليم.</p>
            </div>

            <div className="group bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-500">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">✨</div>
              <h3 className="text-lg font-bold mb-3">التحسين الذاتي (Curiosity Engine)</h3>
              <p className="text-sm text-slate-400 leading-relaxed">حتى بعد النشر، يتساءل النظام: "هل هناك كود أنظف؟" ويعيد هيكلة الملفات تلقائياً لرفع الأداء.</p>
            </div>
          </div>
        </div>
      </section>

      {/* كيفية العمل */}
      <section id="how-it-works" className="relative z-10 py-24 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black mb-5">ثلاث خطوات <span className="text-indigo-400">فقط</span></h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">لا تحتاج لتعلم البرمجة. فقط عبّر عن فكرتك.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto bg-cyan-500/10 border border-cyan-500/20 rounded-3xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">✍️</div>
              <h3 className="text-xl font-bold mb-3">اكتب فكرتك</h3>
              <p className="text-sm text-slate-400">باللغة العربية أو الإنجليزية. صف موقع أحلامك بجملة واحدة.</p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto bg-violet-500/10 border border-violet-500/20 rounded-3xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">⚙️</div>
              <h3 className="text-xl font-bold mb-3">الوكلاء يخططون ويبنون</h3>
              <p className="text-sm text-slate-400">شاهد الوكلاء وهم يتحاورون وينتجون الكود حياً أمام عينيك.</p>
            </div>
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🚀</div>
              <h3 className="text-xl font-bold mb-3">انشر بضغطة زر</h3>
              <p className="text-sm text-slate-400">موقعك يصبح حياً على الإنترنت تلقائياً، جاهز للمشاركة.</p>
            </div>
          </div>
        </div>
      </section>

      {/* شهادات */}
      <section id="testimonials" className="relative z-10 py-24 border-t border-white/[0.03]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black mb-5">ماذا يقول <span className="text-cyan-400">المطورون؟</span></h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { text: "أسرع طريقة لبناء MVP رأيتها. الجدال بين الوكلاء أنتج كوداً أفضل مما كنت سأكتبه بنفسي.", name: "أحمد م. — مطور React" },
              { text: "محرك الفضول أذهلني. نظف ملفات CSS تلقائياً ورفع درجة الأداء دون أن أطلب ذلك.", name: "سارة ك. — مصممة UI/UX" },
              { text: "كنت أحتاج موقعاً لمدرستي في يومين. JAOLA بناه في 30 ثانية. ثورة حقيقية.", name: "خالد و. — رائد أعمال" }
            ].map((t, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-8 relative">
                <div className="text-5xl text-cyan-500/30 absolute top-4 right-6">“</div>
                <p className="text-sm text-slate-300 leading-relaxed mb-6 relative z-10">{t.text}</p>
                <div className="text-xs font-bold text-slate-500">{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="bg-gradient-to-br from-cyan-500/10 to-indigo-600/10 border border-white/[0.08] rounded-[3rem] p-16 backdrop-blur-xl shadow-2xl">
            <h2 className="text-3xl md:text-5xl font-black mb-6">هل أنت مستعد <span className="text-cyan-400">للقفزة التقنية؟</span></h2>
            <p className="text-slate-400 max-w-lg mx-auto mb-10 text-sm">انضم إلى مئات المطورين الذين يستخدمون JAOLA OS لبناء ونشر المواقع في ثوانٍ.</p>
            <button 
              onClick={handleGetStarted}
              className="bg-white text-slate-950 font-extrabold text-base px-10 py-5 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform duration-300"
            >
              ابدأ الآن مجاناً 🚀
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.03] py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span> JAOLA OS — جميع الحقوق محفوظة © 2025
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-400 transition-colors">الخصوصية</a>
            <a href="#" className="hover:text-slate-400 transition-colors">الشروط</a>
            <a href="#" className="hover:text-slate-400 transition-colors">تواصل</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
