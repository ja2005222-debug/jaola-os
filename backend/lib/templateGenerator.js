import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 🧠 دالة استخراج وتحديد تصنيف المشروع الذكي بناءً على الكلمات المفتاحية في طلب العميل
export function extractCategory(prompt) {
    if (!prompt) return 'default';
    const lower = prompt.toLowerCase();
    
    if (lower.includes('محفظة') || lower.includes('portfolio') || lower.includes('شخصي') || lower.includes('سيرة')) {
        return 'portfolio';
    }
    if (lower.includes('مطعم') || lower.includes('restaurant') || lower.includes('طعام') || lower.includes('بيتزا') || lower.includes('pizza') || lower.includes('وجبة') || lower.includes('أكل')) {
        return 'restaurant';
    }
    if (lower.includes('متجر') || lower.includes('store') || lower.includes('سلة') || lower.includes('منتجات') || lower.includes('تسوق') || lower.includes('شراء')) {
        return 'ecommerce';
    }
    if (lower.includes('شركة') || lower.includes('saas') || lower.includes('منصة') || lower.includes('تطبيق') || lower.includes('business') || lower.includes('موقع')) {
        return 'saas';
    }
    return 'default';
}

// 🎨 دالة توليد وتجميع القوالب العصرية المدمجة بالمكتبات والخطوط التفاعلية العالمية
export function generateTemplate(category, theme = 'dark') {
    // 🛠️ تجميع واستدعاء ترويسات المكتبات القياسية العالمية (Tailwind, Flowbite, Google Fonts)
    const baseHTMLHead = `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- استدعاء معزز ومباشر لأحدث نسخ المكتبات والخطوط لتفادي مشاكل الـ CORS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/flowbite/2.2.1/flowbite.min.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/flowbite/2.2.1/flowbite.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;700;900&family=Tajawal:wght@300;500;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
    <style>
        * { font-family: 'Tajawal', 'Cairo', sans-serif; scroll-behavior: smooth; }
    </style>
    `;

    const templates = {
        // 🚀 1. قالب المنصات والـ SaaS (Glassmorphism & Neon Blue Aura)
        saas: {
            html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    ${baseHTMLHead}
    <title>منصتنا الرقمية المبتكرة</title>
</head>
<body class="bg-[#05070f] text-slate-100 min-h-screen relative overflow-x-hidden selection:bg-cyan-500 selection:text-slate-950">
    <!-- توهج نيون خلفي ناعم -->
    <div class="absolute top-[-150px] left-[-150px] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none"></div>
    <div class="absolute bottom-[-200px] right-[-150px] w-[600px] h-[600px] rounded-full bg-indigo-500/8 blur-[160px] pointer-events-none"></div>

    <!-- نافبار زجاجي شفاف ومحاذاة دقيقة -->
    <header class="border-b border-slate-900 bg-[#05070f]/80 backdrop-blur-xl sticky top-0 z-50 px-8 py-4 flex items-center justify-between">
        <div class="text-xl font-black bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent tracking-wide">✨ PLATFORM</div>
        <nav class="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-400">
            <a href="#features" class="hover:text-cyan-400 transition-all">الميزات</a>
            <a href="#pricing" class="hover:text-cyan-400 transition-all">الأسعار</a>
            <a href="#testimonials" class="hover:text-cyan-400 transition-all">العملاء</a>
        </nav>
        <button class="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all">ابدأ الآن مجاناً</button>
    </header>

    <!-- قسم العرض الرئيسي الفاخر -->
    <main class="max-w-5xl mx-auto text-center px-6 py-28 flex flex-col items-center justify-center">
        <div class="inline-flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-800/30 text-cyan-400 px-3.5 py-1.5 rounded-full text-[10px] font-bold tracking-wider mb-6 animate-pulse">
            🚀 ثورة التوليد البرمجي بالذكاء الاصطناعي
        </div>
        <h1 class="text-4xl md:text-6xl font-black leading-tight mb-6">هندسة المستقبل البرمجي <br/><span class="bg-gradient-to-r from-cyan-400 via-teal-400 to-indigo-500 bg-clip-text text-transparent">بذكاء كوني متكامل</span></h1>
        <p class="text-slate-400 text-sm md:text-base leading-relaxed max-w-xl mb-12">منصة تفاعلية سحابية تمنحك أدوات لا نهائية لبناء وإطلاق شفرات برمجية عصرية وذكية لخدمة ملايين العملاء حول العالم بكفاءة مطلقة.</p>
        
        <div class="flex flex-col sm:flex-row items-center gap-4">
            <button class="bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-xs px-8 py-3.5 rounded-xl shadow-lg shadow-cyan-500/25 hover:scale-[1.02] transition-all">استكشف الميزات حياً 🚀</button>
            <button class="border border-slate-800 hover:bg-slate-900 text-xs text-slate-300 font-extrabold px-8 py-3.5 rounded-xl transition-all">شاهد ديمو تجريبي</button>
        </div>
    </main>

    <script src="script.js"></script>
</body>
</html>`,
            css: `/* CSS مخصص لـ SaaS */
body { background-color: #05070f; }`
        },

        // 🎨 2. قالب محفظة الأعمال الشخصية المضيء (Creative Neon Portfolio)
        portfolio: {
            html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    ${baseHTMLHead}
    <title>معرض أعمالي الفنية والإبداعية</title>
</head>
<body class="bg-[#090b14] text-slate-100 min-h-screen relative overflow-x-hidden selection:bg-violet-500 selection:text-white">
    <div class="absolute top-[-50px] right-[-50px] w-[350px] h-[350px] rounded-full bg-violet-500/10 blur-[100px] pointer-events-none"></div>

    <header class="px-8 py-6 flex items-center justify-between border-b border-slate-900/40 backdrop-blur-md sticky top-0 z-50 bg-[#090b14]/75">
        <div class="text-xs font-black tracking-widest text-violet-400">⚡ CREATIVE PORTFOLIO</div>
        <button class="border border-violet-800/60 bg-violet-950/20 text-xs text-violet-400 font-bold px-4 py-2.5 rounded-xl hover:bg-violet-950/40 hover:text-white transition-all">تحميل السيرة الذاتية (CV)</button>
    </header>

    <main class="max-w-3xl mx-auto px-6 py-28 text-center">
        <!-- الصورة الرمزية النيونية -->
        <div class="w-28 h-24 rounded-full bg-gradient-to-tr from-violet-500 via-purple-500 to-indigo-600 mx-auto mb-8 flex items-center justify-center text-4xl shadow-xl shadow-violet-500/10 border border-violet-400/20">
            👨‍💻
        </div>
        <h1 class="text-3xl md:text-5xl font-black mb-5 tracking-tight">مرحباً، أنا مصمم ومطور واجهات تفاعلية</h1>
        <p class="text-slate-400 text-xs md:text-sm max-w-lg mx-auto leading-relaxed mb-10">أقوم ببناء تجارب ويب فخمة وعصرية تجمع بين جمال الفن الرقمي، وسلاسة الحركات التفاعلية، ومتانة الأكواد المصنعة.</p>
        <button class="bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold text-xs px-8 py-3.5 rounded-xl shadow-lg shadow-violet-500/20 hover:scale-[1.02] transition-all">تصفح مشاريعي المبتكرة 📁</button>
    </main>

    <script src="script.js"></script>
</body>
</html>`,
            css: `/* CSS مخصص للمحفظة الإبداعية */
body { background-color: #090b14; }`
        },

        // 🍕 3. قالب المطاعم ومحلات الأغذية الفخم (Modern Amber Restaurant)
        restaurant: {
            html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    ${baseHTMLHead}
    <title>مطعم الوجبات الفاخرة</title>
</head>
<body class="bg-[#0b0c10] text-slate-100 min-h-screen relative overflow-x-hidden selection:bg-amber-500 selection:text-slate-950">
    <div class="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[120px] pointer-events-none"></div>

    <header class="border-b border-slate-900 bg-[#0b0c10]/85 backdrop-blur-md sticky top-0 z-50 px-8 py-5 flex items-center justify-between">
        <div class="text-lg font-black tracking-wide text-amber-500 flex items-center gap-1.5">🍕 مطعم الوجبات</div>
        <nav class="hidden md:flex items-center gap-8 text-xs font-bold text-slate-400">
            <a href="#menu" class="hover:text-amber-500 transition-colors">قائمة الطعام</a>
            <a href="#about" class="hover:text-amber-500 transition-colors">قصتنا</a>
            <a href="#reviews" class="hover:text-amber-500 transition-colors">آراء العملاء</a>
        </nav>
        <button class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/10 transition-all">احجز طاولتك الآن</button>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-28 text-center flex flex-col items-center">
        <div class="text-4xl mb-4 animate-bounce">🍕</div>
        <h1 class="text-4xl md:text-6xl font-black leading-tight mb-6">مذاق الطهي الإيطالي <br/><span class="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">بلمسات فخمة وعصرية</span></h1>
        <p class="text-slate-400 text-sm leading-relaxed max-w-lg mb-10">نحضر وجباتنا من مكونات طازجة منتقاة بعناية لنمنحك تجربة تذوق استثنائية تأخذك مباشرة لشوارع روما الفخمة.</p>
        <div class="flex items-center gap-4">
            <button class="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs px-8 py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all">استعرض قائمة الطعام 📜</button>
            <button class="border border-slate-800 text-xs text-slate-300 font-bold px-8 py-3.5 rounded-xl hover:bg-slate-900 transition-all">تواصل معنا</button>
        </div>
    </main>

    <script src="script.js"></script>
</body>
</html>`,
            css: `/* CSS مخصص للمطعم */
body { background-color: #0b0c10; }`
        },

        // 🛍️ 4. قالب المتاجر الإلكترونية العصري (Sleek Emerald E-Commerce)
        ecommerce: {
            html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    ${baseHTMLHead}
    <title>متجرنا العصري المبتكر</title>
</head>
<body class="bg-[#050907] text-slate-100 min-h-screen relative overflow-x-hidden selection:bg-emerald-500 selection:text-slate-950">
    <div class="absolute top-[-150px] right-[-150px] w-[450px] h-[450px] rounded-full bg-emerald-500/5 blur-[130px] pointer-events-none"></div>

    <header class="border-b border-slate-900/60 bg-[#050907]/80 backdrop-blur-xl sticky top-0 z-50 px-8 py-4 flex items-center justify-between">
        <div class="text-lg font-black text-emerald-400">🛍️ متجرنا الذكي</div>
        <nav class="hidden md:flex items-center gap-8 text-xs font-bold text-slate-400">
            <a href="#products" class="hover:text-emerald-400 transition-all">المنتجات</a>
            <a href="#offers" class="hover:text-emerald-400 transition-all">العروض حارّة</a>
            <a href="#faq" class="hover:text-emerald-400 transition-all">الأسئلة الشائعة</a>
        </nav>
        <button class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/10 transition-all">حقيبة التسوق (0)</button>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-28 text-center flex flex-col items-center">
        <div class="text-4xl mb-4">🎁</div>
        <h1 class="text-4xl md:text-5xl font-black leading-tight mb-6">تسوق أحدث المنتجات العالمية <br/><span class="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent">بجودة وأسعار استثنائية</span></h1>
        <p class="text-slate-400 text-sm leading-relaxed max-w-lg mb-10">احصل على تجربة تسوق ذكية وممتعة مع ضمان الشحن السريع لباب منزلك وخدمة عملاء وحماية وضمان حقيقي للمنتجات.</p>
        <div class="flex items-center gap-4">
            <button class="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all">تسوق الآن 🛍️</button>
            <button class="border border-slate-800 text-xs text-slate-300 font-bold px-8 py-3.5 rounded-xl hover:bg-slate-900 transition-all">استعرض التصنيفات</button>
        </div>
    </main>

    <script src="script.js"></script>
</body>
</html>`,
            css: `/* CSS مخصص للمتجر الإلكتروني */
body { background-color: #050907; }`
        },

        // 🚀 5. القالب العام متعدد الاستخدامات (Symmetrical Default Template)
        default: {
            html: `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    ${baseHTMLHead}
    <title>موقع ويب ذكي ومستقر</title>
</head>
<body class="bg-[#080b11] text-slate-100 min-h-screen flex flex-col justify-center items-center p-6 selection:bg-cyan-500 selection:text-slate-900">
    <!-- توهج ناعم بالخلفية -->
    <div class="absolute w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none"></div>

    <div class="max-w-md w-full bg-[#0d121f]/80 border border-slate-800 p-8 rounded-2xl text-center shadow-2xl backdrop-blur-xl relative z-10">
        <div class="text-4xl mb-4 animate-bounce">🚀</div>
        <h1 class="text-xl font-black mb-3 bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">JAOLA OS Sandbox</h1>
        <p class="text-slate-400 text-xs leading-relaxed mb-6">لقد تم إنشاء هيكل موقعك الأساسي بنجاح بالاعتماد على شفرات تنسيق معاصرة وسريعة الاستجابة. اطلب من المساعد الذكي تعديل أي شيء في الكود الآن!</p>
        <button class="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-xs py-3 rounded-xl hover:opacity-90 shadow-lg shadow-cyan-500/20 transition-all">ابدأ رحلتك الإبداعية</button>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`,
            css: `/* CSS الافتراضي */
body { background-color: #080b11; }`
        }
    };

    return templates[category] || templates.default;
}
