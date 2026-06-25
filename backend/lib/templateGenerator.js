import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// دالة لاستخراج التصنيف البرمجي المناسب بناءً على كلمات مفتاحية في طلب العميل
export function extractCategory(prompt) {
    if (!prompt) return 'default';
    const lower = prompt.toLowerCase();
    
    if (lower.includes('محفظة') || lower.includes('portfolio') || lower.includes('شخصي')) {
        return 'portfolio';
    }
    if (lower.includes('مطعم') || lower.includes('restaurant') || lower.includes('طعام') || lower.includes('بيتزا') || lower.includes('pizza') || lower.includes('أكل')) {
        return 'restaurant';
    }
    if (lower.includes('شركة') || lower.includes('saas') || lower.includes('منصة') || lower.includes('تطبيق') || lower.includes('business') || lower.includes('موقع')) {
        return 'saas';
    }
    return 'default';
}

// دالة لتوليد القالب الأساسي العصري بناءً على التصنيف المختار
export function generateTemplate(category, theme = 'dark') {
    // 🛠️ النقطة رقم 1: استدعاء الـ Tailwind CSS و Flowbite وخطوط جوجل الفخمة بشكل موحد ومشترك في الرأس
    const baseHTMLHead = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/flowbite/2.2.1/flowbite.min.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/flowbite/2.2.1/flowbite.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;500;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
    <style>
        * { font-family: 'Tajawal', sans-serif; scroll-behavior: smooth; }
    </style>
    `;

    // 🛠️ النقطة رقم 3: تعريف هيكل القوالب العصرية والنيون الداكنة الجاهزة
    const templates = {
        // 🔮 قالب SaaS والشركات والمنصات (Glassmorphism & Neon Aura)
        saas: {
            html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    ${baseHTMLHead}
    <title>منصة رقمية مبتكرة</title>
</head>
<body class="bg-[#070913] text-slate-100 min-h-screen relative overflow-x-hidden">
    <!-- توهج النيون في الخلفية لجمال بصري فخم -->
    <div class="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-150px] right-[-100px] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none"></div>

    <header class="border-b border-slate-900 bg-[#070913]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div class="text-lg font-extrabold bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">✨ منصة مبتكرة</div>
        <nav class="hidden md:flex items-center gap-6 text-xs text-slate-400">
            <a href="#features" class="hover:text-cyan-400 transition-colors">الميزات</a>
            <a href="#services" class="hover:text-cyan-400 transition-colors">خدماتنا</a>
            <a href="#contact" class="hover:text-cyan-400 transition-colors">اتصل بنا</a>
        </nav>
        <button class="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-all">ابدأ الآن مجاناً</button>
    </header>

    <main class="max-w-4xl mx-auto text-center px-6 py-20 flex flex-col items-center justify-center">
        <h1 class="text-4xl md:text-5xl font-extrabold leading-tight mb-6">هندسة المستقبل <span class="bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">بذكاء اصطناعي</span> متكامل</h1>
        <p class="text-slate-400 text-sm md:text-base leading-relaxed max-w-xl mb-10">منصة تفاعلية تمنحك أدوات لا نهائية لتوسيع أعمالك وتقديم تجربة استثنائية لعملائك حياً بالاعتماد على معمارية معالجة عصرية.</p>
        <div class="flex items-center gap-4">
            <button class="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-all">استكشف الميزات 🚀</button>
            <button class="border border-slate-800 hover:bg-slate-900 text-xs text-slate-300 font-bold px-6 py-3 rounded-xl transition-all">شاهد ديمو حي</button>
        </div>
    </main>
    <script src="script.js"></script>
</body>
</html>`,
            css: `/* CSS مخصص إضافي لـ SaaS */
body {
    background-color: #070913;
}`
        },

        // 👨‍💻 قالب محفظة الأعمال الشخصية (Creative Portfolio)
        portfolio: {
            html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    ${baseHTMLHead}
    <title>محفظة أعمالي الإبداعية</title>
</head>
<body class="bg-[#090D16] text-slate-100 min-h-screen relative overflow-x-hidden">
    <!-- إضاءة نيون خلفية ناعمة -->
    <div class="absolute top-[-50px] right-[-50px] w-[300px] h-[300px] rounded-full bg-violet-500/10 blur-[100px] pointer-events-none"></div>

    <header class="px-8 py-6 flex items-center justify-between border-b border-slate-900/40">
        <div class="text-sm font-extrabold tracking-widest text-violet-400">⚡ PORTFOLIO</div>
        <button class="border border-violet-800 hover:bg-violet-950/20 text-xs text-violet-400 font-bold px-4 py-2 rounded-xl transition-all">تحميل السيرة الذاتية</button>
    </header>

    <main class="max-w-3xl mx-auto px-6 py-24 text-center">
        <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 mx-auto mb-6 flex items-center justify-center text-4xl shadow-lg shadow-violet-500/20">👨‍💻</div>
        <h1 class="text-3xl md:text-4xl font-extrabold mb-4">مرحباً، أنا مصمم ومطور واجهات تفاعلية</h1>
        <p class="text-slate-400 text-xs md:text-sm max-w-lg mx-auto leading-relaxed mb-8">أصنع تجارب ويب فريدة تجمع بين جمال التصميم، وسلاسة الحركة، ودقة الأكواد البرمجية بالاعتماد على أحدث التقنيات العصرية.</p>
        <button class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-lg shadow-violet-500/10 hover:scale-[1.02] transition-all">تصفح مشاريعي 📁</button>
    </main>
    <script src="script.js"></script>
</body>
</html>`,
            css: `/* CSS مخصص للمحفظة */
body {
    background-color: #090D16;
}`
        },

        // 🚀 القالب الافتراضي لجميع التخصصات الأخرى عند البدء من الصفر
        default: {
            html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    ${baseHTMLHead}
    <title>موقع ويب ذكي ومستقر</title>
</head>
<body class="bg-[#0B0F19] text-slate-100 min-h-screen flex flex-col justify-center items-center p-6">
    <div class="max-w-md w-full bg-[#0E1325]/80 border border-slate-900 p-8 rounded-2xl text-center shadow-xl backdrop-blur-md">
        <div class="text-4xl mb-4">🚀</div>
        <h1 class="text-xl font-bold mb-3 text-slate-200">مرحباً بك في JAOLA OS</h1>
        <p class="text-slate-400 text-xs leading-relaxed mb-6">لقد تم إنشاء هيكل موقعك الأساسي بنجاح بالاعتماد على شفرات تنسيق معاصرة وسريعة الاستجابة. اطلب من الذكاء الاصطناعي تعديل أي شيء الآن!</p>
        <button class="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs py-3 rounded-xl hover:opacity-90 transition-all">ابدأ رحلة الإبداع</button>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
            css: `/* CSS الافتراضي */
body {
    background-color: #0B0F19;
}`
        }
    };

    return templates[category] || templates.default;
}
