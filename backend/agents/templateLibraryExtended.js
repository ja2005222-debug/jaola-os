/**
 * 📚➕ Extended Template Library — JAOLA OS
 *
 * توسعة مكتبة القوالب لتغطية القطاعات الأكثر طلباً (20 فئة إضافية):
 * سفر، SaaS، شركات ناشئة، ترفيه، حجوزات، مدونة، أخبار، محاماة، تجميل،
 * سيارات، زفاف، تصوير، موسيقى، جمعيات خيرية، وكالة إبداعية، مالية،
 * مقاولات، تصميم داخلي، ألعاب، عملات رقمية.
 *
 * كل قالب بنفس هيكل templateLibrary.js: { css_vars, sections } — أقسام HTML
 * جاهزة بمحتوى عربي واقعي، تعتمد على CSS_RESET والـ utility classes المشتركة
 * (.container, .btn, .grid-3, .section-header). يستخدمها الـ Coder كنقطة انطلاق.
 */

// ═══════════════════════════════════════════════════════
// ✈️ سفر وسياحة
// ═══════════════════════════════════════════════════════
const TRAVEL_TEMPLATE = {
    css_vars: `
:root {
    --primary: #0284c7;
    --secondary: #0369a1;
    --accent: #f59e0b;
    --bg: #f0f9ff;
    --bg-light: #e0f2fe;
    --text: #0c4a6e;
    --text-light: #64748b;
    --border: #e2e8f0;
    --card-bg: #ffffff;
    --success: #10b981;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-plane" aria-hidden="true"></i><span>{اسم الوكالة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#home">الرئيسية</a>
            <a href="#destinations">الوجهات</a>
            <a href="#packages">الباقات</a>
            <a href="#about">من نحن</a>
        </nav>
        <a href="#booking" class="btn btn-primary">احجز رحلتك</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">✈️ أكثر من 120 وجهة حول العالم</span>
        <h1>اكتشف العالم مع <span class="text-accent">رحلات لا تُنسى</span></h1>
        <p>باقات سفر متكاملة بأفضل الأسعار — طيران، فنادق، وجولات سياحية بتنظيم كامل.</p>
        <form class="search-form" onsubmit="return searchTrips(event)">
            <input type="text" placeholder="إلى أين تريد الذهاب؟" aria-label="الوجهة">
            <input type="date" aria-label="تاريخ المغادرة">
            <select aria-label="عدد المسافرين"><option>مسافر واحد</option><option>مسافران</option><option>عائلة</option></select>
            <button type="submit" class="btn btn-primary">ابحث</button>
        </form>
    </div>
</section>`,
        destinations: `
<section class="destinations" id="destinations">
    <div class="container">
        <div class="section-header"><h2>وجهات شائعة</h2><p>الأكثر طلباً هذا الموسم</p></div>
        <div class="grid-3" id="destinationGrid">
            <div class="destination-card"><img src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=500&q=80" alt="دبي"><div class="dest-info"><h3>دبي</h3><span>من 1,200 ر.س</span></div></div>
            <div class="destination-card"><img src="https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5?w=500&q=80" alt="إسطنبول"><div class="dest-info"><h3>إسطنبول</h3><span>من 1,800 ر.س</span></div></div>
            <div class="destination-card"><img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=500&q=80" alt="ماليزيا"><div class="dest-info"><h3>ماليزيا</h3><span>من 2,400 ر.س</span></div></div>
        </div>
    </div>
</section>`,
        packages: `
<section class="packages" id="packages">
    <div class="container">
        <div class="section-header"><h2>باقاتنا المميزة</h2><p>كل ما تحتاجه في مكان واحد</p></div>
        <div class="grid-3">
            <div class="package-card"><h3>باقة اقتصادية</h3><div class="price">1,999 <small>ر.س</small></div><ul><li>طيران ذهاب وعودة</li><li>إقامة 4 ليالٍ</li><li>إفطار يومي</li></ul><a href="#booking" class="btn btn-outline">احجز الآن</a></div>
            <div class="package-card featured"><span class="pkg-badge">الأكثر طلباً</span><h3>باقة عائلية</h3><div class="price">4,999 <small>ر.س</small></div><ul><li>طيران لـ 4 أفراد</li><li>إقامة 7 ليالٍ</li><li>جولات سياحية</li></ul><a href="#booking" class="btn btn-primary">احجز الآن</a></div>
            <div class="package-card"><h3>باقة فاخرة</h3><div class="price">8,999 <small>ر.س</small></div><ul><li>درجة رجال الأعمال</li><li>فندق 5 نجوم</li><li>سائق خاص</li></ul><a href="#booking" class="btn btn-outline">احجز الآن</a></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// ☁️ منصة SaaS
// ═══════════════════════════════════════════════════════
const SAAS_TEMPLATE = {
    css_vars: `
:root {
    --primary: #6366f1;
    --secondary: #4f46e5;
    --accent: #22d3ee;
    --bg: #ffffff;
    --bg-light: #f5f3ff;
    --text: #111827;
    --text-light: #6b7280;
    --border: #e5e7eb;
    --card-bg: #ffffff;
    --success: #10b981;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-cube" aria-hidden="true"></i><span>{اسم المنصة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#features">المميزات</a>
            <a href="#pricing">الأسعار</a>
            <a href="#faq">الأسئلة</a>
        </nav>
        <div class="nav-actions"><a href="#login">تسجيل الدخول</a><a href="#signup" class="btn btn-primary">ابدأ مجاناً</a></div>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🚀 جديد: تكامل الذكاء الاصطناعي</span>
        <h1>أدر عملك <span class="text-accent">بذكاء</span> من مكان واحد</h1>
        <p>منصة متكاملة تجمع كل أدواتك في لوحة تحكم واحدة — أتمتة، تحليلات، وتعاون فوري.</p>
        <div class="hero-actions">
            <a href="#signup" class="btn btn-primary">ابدأ تجربتك المجانية</a>
            <a href="#demo" class="btn btn-outline"><i class="fas fa-play"></i> شاهد العرض</a>
        </div>
        <p class="hero-note">بدون بطاقة ائتمان · 14 يوماً مجاناً</p>
    </div>
</section>`,
        features: `
<section class="features" id="features">
    <div class="container">
        <div class="section-header"><h2>كل ما تحتاجه لتنمو</h2><p>أدوات قوية بواجهة بسيطة</p></div>
        <div class="grid-3">
            <div class="feature-item"><i class="fas fa-bolt" aria-hidden="true"></i><h3>أتمتة كاملة</h3><p>وفّر ساعات عبر أتمتة المهام المتكررة.</p></div>
            <div class="feature-item"><i class="fas fa-chart-line" aria-hidden="true"></i><h3>تحليلات فورية</h3><p>قرارات مبنية على بيانات حيّة ولوحات واضحة.</p></div>
            <div class="feature-item"><i class="fas fa-users" aria-hidden="true"></i><h3>تعاون الفريق</h3><p>اعمل مع فريقك في الوقت الحقيقي بأمان.</p></div>
        </div>
    </div>
</section>`,
        pricing: `
<section class="pricing" id="pricing">
    <div class="container">
        <div class="section-header"><h2>خطط تناسب الجميع</h2><p>ابدأ مجاناً وترقَّ متى شئت</p></div>
        <div class="grid-3">
            <div class="price-card"><h3>مجانية</h3><div class="price">0 <small>ر.س/شهر</small></div><ul><li>حتى 3 مشاريع</li><li>لوحة تحكم أساسية</li></ul><a href="#signup" class="btn btn-outline">ابدأ الآن</a></div>
            <div class="price-card featured"><span class="pkg-badge">الأفضل قيمة</span><h3>Pro</h3><div class="price">99 <small>ر.س/شهر</small></div><ul><li>مشاريع غير محدودة</li><li>تحليلات متقدمة</li><li>دعم أولوية</li></ul><a href="#signup" class="btn btn-primary">اشترك</a></div>
            <div class="price-card"><h3>Enterprise</h3><div class="price">تواصل معنا</div><ul><li>حلول مخصصة</li><li>مدير حساب مخصص</li></ul><a href="#contact" class="btn btn-outline">تواصل</a></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🚀 شركة ناشئة (Startup Landing)
// ═══════════════════════════════════════════════════════
const STARTUP_TEMPLATE = {
    css_vars: `
:root {
    --primary: #7c3aed;
    --secondary: #6d28d9;
    --accent: #f472b6;
    --bg: #0f0e1a;
    --bg-light: #1a1830;
    --text: #f8fafc;
    --text-light: #a5b4fc;
    --border: #2d2b52;
    --card-bg: #16152b;
    --success: #34d399;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-rocket" aria-hidden="true"></i><span>{اسم الشركة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#product">المنتج</a>
            <a href="#how">كيف يعمل</a>
            <a href="#investors">المستثمرون</a>
        </nav>
        <a href="#waitlist" class="btn btn-primary">انضم للقائمة</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🌟 مدعومة من مسرّعات رائدة</span>
        <h1>نُعيد تعريف <span class="text-accent">طريقة عملك</span></h1>
        <p>حلٌّ مبتكر يوفّر وقتك ومالك — انضم لآلاف المستخدمين الذين غيّروا طريقة إنجازهم.</p>
        <form class="waitlist-form" onsubmit="return joinWaitlist(event)">
            <input type="email" placeholder="بريدك الإلكتروني" required aria-label="البريد">
            <button type="submit" class="btn btn-primary">احجز مكانك</button>
        </form>
    </div>
</section>`,
        how: `
<section class="how" id="how">
    <div class="container">
        <div class="section-header"><h2>كيف يعمل؟</h2><p>ثلاث خطوات بسيطة</p></div>
        <div class="grid-3">
            <div class="step-card"><span class="step-num">1</span><h3>سجّل حسابك</h3><p>ابدأ خلال دقيقة واحدة بدون تعقيد.</p></div>
            <div class="step-card"><span class="step-num">2</span><h3>اربط أدواتك</h3><p>تكامل سلس مع ما تستخدمه بالفعل.</p></div>
            <div class="step-card"><span class="step-num">3</span><h3>انطلق</h3><p>راقب نتائجك تنمو تلقائياً.</p></div>
        </div>
    </div>
</section>`,
        metrics: `
<section class="metrics">
    <div class="container">
        <div class="grid-4">
            <div class="metric"><strong>+50K</strong><span>مستخدم نشط</span></div>
            <div class="metric"><strong>99.9%</strong><span>وقت تشغيل</span></div>
            <div class="metric"><strong>+120</strong><span>دولة</span></div>
            <div class="metric"><strong>4.9/5</strong><span>تقييم العملاء</span></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🎭 ترفيه وفعاليات
// ═══════════════════════════════════════════════════════
const ENTERTAINMENT_TEMPLATE = {
    css_vars: `
:root {
    --primary: #db2777;
    --secondary: #9d174d;
    --accent: #fbbf24;
    --bg: #12081f;
    --bg-light: #1e1033;
    --text: #fdf4ff;
    --text-light: #d8b4fe;
    --border: #3b1e5e;
    --card-bg: #1c1030;
    --success: #22c55e;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-masks-theater" aria-hidden="true"></i><span>{اسم الفعالية}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#events">الفعاليات</a>
            <a href="#lineup">النجوم</a>
            <a href="#tickets">التذاكر</a>
        </nav>
        <a href="#tickets" class="btn btn-primary">احجز تذكرتك</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🎉 موسم 2025 — تذاكر محدودة</span>
        <h1>عش تجربة <span class="text-accent">لا تُنسى</span></h1>
        <p>أكبر الحفلات والعروض المباشرة في مكان واحد — احجز مقعدك قبل نفاد التذاكر.</p>
        <div class="hero-actions"><a href="#tickets" class="btn btn-primary">احجز الآن</a><a href="#events" class="btn btn-outline">جدول الفعاليات</a></div>
    </div>
</section>`,
        events: `
<section class="events" id="events">
    <div class="container">
        <div class="section-header"><h2>الفعاليات القادمة</h2><p>لا تفوّت أي لحظة</p></div>
        <div class="grid-3" id="eventGrid">
            <div class="event-card"><div class="event-date"><strong>18</strong><span>يوليو</span></div><h3>ليلة الموسيقى الحية</h3><p>المسرح الكبير · 8 مساءً</p><a href="#tickets" class="btn btn-outline">تذاكر</a></div>
            <div class="event-card"><div class="event-date"><strong>25</strong><span>يوليو</span></div><h3>عرض الكوميديا</h3><p>قاعة النخبة · 9 مساءً</p><a href="#tickets" class="btn btn-outline">تذاكر</a></div>
            <div class="event-card"><div class="event-date"><strong>02</strong><span>أغسطس</span></div><h3>مهرجان الأضواء</h3><p>الحديقة المركزية · 6 مساءً</p><a href="#tickets" class="btn btn-outline">تذاكر</a></div>
        </div>
    </div>
</section>`,
        tickets: `
<section class="tickets" id="tickets">
    <div class="container">
        <div class="section-header"><h2>فئات التذاكر</h2><p>اختر تجربتك</p></div>
        <div class="grid-3">
            <div class="ticket-card"><h3>عادية</h3><div class="price">150 <small>ر.س</small></div><ul><li>دخول عام</li><li>مقاعد غير محددة</li></ul><button class="btn btn-outline" onclick="buyTicket('regular')">اشترِ</button></div>
            <div class="ticket-card featured"><span class="pkg-badge">الأكثر مبيعاً</span><h3>VIP</h3><div class="price">450 <small>ر.س</small></div><ul><li>مقاعد أمامية</li><li>لقاء النجوم</li></ul><button class="btn btn-primary" onclick="buyTicket('vip')">اشترِ</button></div>
            <div class="ticket-card"><h3>بلاتينيوم</h3><div class="price">900 <small>ر.س</small></div><ul><li>لاونج خاص</li><li>ضيافة كاملة</li></ul><button class="btn btn-outline" onclick="buyTicket('platinum')">اشترِ</button></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 📅 حجوزات ومواعيد
// ═══════════════════════════════════════════════════════
const BOOKING_TEMPLATE = {
    css_vars: `
:root {
    --primary: #0d9488;
    --secondary: #0f766e;
    --accent: #f59e0b;
    --bg: #f0fdfa;
    --bg-light: #ccfbf1;
    --text: #134e4a;
    --text-light: #5f7d7a;
    --border: #d1e7e3;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-calendar-check" aria-hidden="true"></i><span>{اسم الخدمة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#services">الخدمات</a>
            <a href="#how">كيف نعمل</a>
            <a href="#contact">تواصل</a>
        </nav>
        <a href="#booking" class="btn btn-primary">احجز موعدك</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">⏱️ حجز فوري خلال دقيقة</span>
        <h1>احجز موعدك <span class="text-accent">بضغطة واحدة</span></h1>
        <p>اختر الخدمة والوقت المناسب لك، وسنؤكّد حجزك فوراً — بدون انتظار أو مكالمات.</p>
        <a href="#booking" class="btn btn-primary">ابدأ الحجز</a>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header"><h2>خدماتنا</h2><p>اختر ما يناسبك</p></div>
        <div class="grid-3" id="serviceGrid">
            <div class="service-card"><i class="fas fa-star"></i><h3>استشارة</h3><p>30 دقيقة</p><span class="svc-price">120 ر.س</span></div>
            <div class="service-card"><i class="fas fa-gem"></i><h3>جلسة متكاملة</h3><p>60 دقيقة</p><span class="svc-price">220 ر.س</span></div>
            <div class="service-card"><i class="fas fa-crown"></i><h3>باقة مميزة</h3><p>90 دقيقة</p><span class="svc-price">350 ر.س</span></div>
        </div>
    </div>
</section>`,
        booking: `
<section class="booking" id="booking">
    <div class="container">
        <div class="section-header"><h2>احجز موعدك الآن</h2><p>اختر التاريخ والوقت</p></div>
        <form class="booking-form" onsubmit="return submitBooking(event)">
            <input type="text" placeholder="الاسم الكامل" required aria-label="الاسم">
            <input type="tel" placeholder="رقم الجوال" required aria-label="الجوال">
            <select required aria-label="الخدمة"><option value="">اختر الخدمة</option><option>استشارة</option><option>جلسة متكاملة</option><option>باقة مميزة</option></select>
            <input type="date" required aria-label="التاريخ">
            <select required aria-label="الوقت"><option value="">اختر الوقت</option><option>10:00 ص</option><option>12:00 م</option><option>4:00 م</option></select>
            <button type="submit" class="btn btn-primary">تأكيد الحجز</button>
        </form>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// ✍️ مدونة
// ═══════════════════════════════════════════════════════
const BLOG_TEMPLATE = {
    css_vars: `
:root {
    --primary: #ea580c;
    --secondary: #c2410c;
    --accent: #0ea5e9;
    --bg: #fffbf7;
    --bg-light: #fff1e6;
    --text: #1c1917;
    --text-light: #78716c;
    --border: #eaddd0;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-feather-pointed" aria-hidden="true"></i><span>{اسم المدونة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#latest">الأحدث</a>
            <a href="#categories">التصنيفات</a>
            <a href="#about">عنّا</a>
        </nav>
        <a href="#subscribe" class="btn btn-primary">اشترك</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero blog-hero" id="home">
    <div class="container">
        <article class="featured-post">
            <img src="https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80" alt="المقال المميز">
            <div class="featured-body">
                <span class="post-tag">مقال مميز</span>
                <h1>عنوان المقال الرئيسي الذي يجذب القارئ</h1>
                <p>مقدمة مشوّقة تلخّص فكرة المقال وتدفع القارئ للمتابعة حتى النهاية.</p>
                <div class="post-meta"><span>بقلم فلان</span> · <span>5 دقائق قراءة</span></div>
            </div>
        </article>
    </div>
</section>`,
        latest: `
<section class="latest" id="latest">
    <div class="container">
        <div class="section-header"><h2>أحدث المقالات</h2><p>جديدنا أولاً بأول</p></div>
        <div class="grid-3" id="postGrid">
            <article class="post-card"><img src="https://images.unsplash.com/photo-1516414447565-b14be0adf13e?w=500&q=80" alt=""><div class="post-body"><span class="post-tag">تقنية</span><h3>عنوان المقال الأول</h3><p>ملخص قصير للمقال يوضح محتواه.</p></div></article>
            <article class="post-card"><img src="https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=500&q=80" alt=""><div class="post-body"><span class="post-tag">تطوير ذات</span><h3>عنوان المقال الثاني</h3><p>ملخص قصير للمقال يوضح محتواه.</p></div></article>
            <article class="post-card"><img src="https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=500&q=80" alt=""><div class="post-body"><span class="post-tag">سفر</span><h3>عنوان المقال الثالث</h3><p>ملخص قصير للمقال يوضح محتواه.</p></div></article>
        </div>
    </div>
</section>`,
        subscribe: `
<section class="subscribe" id="subscribe">
    <div class="container">
        <div class="subscribe-box">
            <h2>لا تفوّت جديدنا</h2>
            <p>اشترك في النشرة البريدية ووصلك كل مقال جديد أولاً بأول.</p>
            <form class="subscribe-form" onsubmit="return subscribeNewsletter(event)">
                <input type="email" placeholder="بريدك الإلكتروني" required aria-label="البريد">
                <button type="submit" class="btn btn-primary">اشترك مجاناً</button>
            </form>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 📰 أخبار ومجلة
// ═══════════════════════════════════════════════════════
const NEWS_TEMPLATE = {
    css_vars: `
:root {
    --primary: #dc2626;
    --secondary: #991b1b;
    --accent: #1d4ed8;
    --bg: #ffffff;
    --bg-light: #f8fafc;
    --text: #0f172a;
    --text-light: #64748b;
    --border: #e2e8f0;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar news-navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-newspaper" aria-hidden="true"></i><span>{اسم الصحيفة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#politics">سياسة</a>
            <a href="#economy">اقتصاد</a>
            <a href="#sports">رياضة</a>
            <a href="#tech">تقنية</a>
        </nav>
        <button class="search-btn" aria-label="بحث"><i class="fas fa-search"></i></button>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        breaking: `
<div class="breaking-bar">
    <span class="breaking-label">عاجل</span>
    <div class="breaking-ticker" id="ticker">آخر الأخبار تظهر هنا بشكل متحرك ومتجدد على مدار الساعة…</div>
</div>`,
        headlines: `
<section class="headlines" id="home">
    <div class="container">
        <div class="headlines-grid">
            <article class="lead-story"><img src="https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=80" alt=""><div class="story-body"><span class="cat-tag">الخبر الرئيسي</span><h1>عنوان الخبر الأبرز لهذا اليوم</h1><p>موجز يشرح تفاصيل الحدث الأهم بإيجاز.</p></div></article>
            <div class="side-stories">
                <article class="side-story"><h3>عنوان خبر جانبي أول</h3><span class="story-time">منذ ساعة</span></article>
                <article class="side-story"><h3>عنوان خبر جانبي ثانٍ</h3><span class="story-time">منذ ساعتين</span></article>
                <article class="side-story"><h3>عنوان خبر جانبي ثالث</h3><span class="story-time">منذ 3 ساعات</span></article>
            </div>
        </div>
    </div>
</section>`,
        sections_list: `
<section class="news-sections" id="tech">
    <div class="container">
        <div class="section-header"><h2>أحدث الأخبار</h2></div>
        <div class="grid-4" id="newsGrid">
            <article class="news-card"><img src="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80" alt=""><span class="cat-tag">اقتصاد</span><h3>عنوان الخبر</h3></article>
            <article class="news-card"><img src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&q=80" alt=""><span class="cat-tag">تقنية</span><h3>عنوان الخبر</h3></article>
            <article class="news-card"><img src="https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=80" alt=""><span class="cat-tag">رياضة</span><h3>عنوان الخبر</h3></article>
            <article class="news-card"><img src="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80" alt=""><span class="cat-tag">سياسة</span><h3>عنوان الخبر</h3></article>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// ⚖️ محاماة وخدمات قانونية
// ═══════════════════════════════════════════════════════
const LAW_TEMPLATE = {
    css_vars: `
:root {
    --primary: #1e3a5f;
    --secondary: #0f2440;
    --accent: #c9a227;
    --bg: #f8fafc;
    --bg-light: #eef2f7;
    --text: #0f2440;
    --text-light: #5b6b7f;
    --border: #dbe3ec;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-scale-balanced" aria-hidden="true"></i><span>{اسم المكتب}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#services">خدماتنا</a>
            <a href="#team">المحامون</a>
            <a href="#about">عن المكتب</a>
        </nav>
        <a href="#consult" class="btn btn-primary">استشارة قانونية</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">⚖️ أكثر من 20 عاماً من الخبرة</span>
        <h1>نحمي <span class="text-accent">حقوقك</span> بخبرة وثقة</h1>
        <p>مكتب محاماة متكامل يقدّم استشارات وتمثيلاً قانونياً في مختلف القضايا التجارية والمدنية.</p>
        <div class="hero-actions"><a href="#consult" class="btn btn-primary">احجز استشارة</a><a href="#services" class="btn btn-outline">خدماتنا</a></div>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header"><h2>مجالات ممارستنا</h2><p>خبرة قانونية شاملة</p></div>
        <div class="grid-3">
            <div class="service-card"><i class="fas fa-briefcase"></i><h3>القانون التجاري</h3><p>تأسيس الشركات والعقود التجارية والنزاعات.</p></div>
            <div class="service-card"><i class="fas fa-house-chimney"></i><h3>القضايا العقارية</h3><p>عقود البيع والإيجار ونزاعات الملكية.</p></div>
            <div class="service-card"><i class="fas fa-users"></i><h3>الأحوال الشخصية</h3><p>قضايا الأسرة والميراث بسرية تامة.</p></div>
        </div>
    </div>
</section>`,
        consult: `
<section class="consult" id="consult">
    <div class="container">
        <div class="section-header"><h2>احجز استشارتك</h2><p>سنعاود الاتصال بك خلال 24 ساعة</p></div>
        <form class="consult-form" onsubmit="return submitConsult(event)">
            <input type="text" placeholder="الاسم الكامل" required aria-label="الاسم">
            <input type="tel" placeholder="رقم الجوال" required aria-label="الجوال">
            <textarea placeholder="اشرح قضيتك باختصار" rows="4" aria-label="التفاصيل"></textarea>
            <button type="submit" class="btn btn-primary">إرسال الطلب</button>
        </form>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 💅 تجميل وصالونات وسبا
// ═══════════════════════════════════════════════════════
const BEAUTY_TEMPLATE = {
    css_vars: `
:root {
    --primary: #db2777;
    --secondary: #be185d;
    --accent: #f5c9b8;
    --bg: #fff5f8;
    --bg-light: #fce7f0;
    --text: #4a2530;
    --text-light: #9d7a85;
    --border: #f3d9e3;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-spa" aria-hidden="true"></i><span>{اسم الصالون}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#services">خدماتنا</a>
            <a href="#gallery">المعرض</a>
            <a href="#offers">العروض</a>
        </nav>
        <a href="#booking" class="btn btn-primary">احجزي موعدك</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">✨ دلّلي نفسك اليوم</span>
        <h1>جمالكِ يبدأ من <span class="text-accent">هنا</span></h1>
        <p>باقة متكاملة من خدمات التجميل والعناية على يد خبيرات محترفات في أجواء راقية.</p>
        <a href="#booking" class="btn btn-primary">احجزي الآن</a>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header"><h2>خدماتنا</h2><p>عناية من الرأس حتى القدم</p></div>
        <div class="grid-4">
            <div class="service-card"><i class="fas fa-scissors"></i><h3>تصفيف الشعر</h3><span class="svc-price">من 120 ر.س</span></div>
            <div class="service-card"><i class="fas fa-hand-sparkles"></i><h3>عناية بالبشرة</h3><span class="svc-price">من 200 ر.س</span></div>
            <div class="service-card"><i class="fas fa-paint-brush"></i><h3>مكياج</h3><span class="svc-price">من 350 ر.س</span></div>
            <div class="service-card"><i class="fas fa-gem"></i><h3>مانيكير وباديكير</h3><span class="svc-price">من 90 ر.س</span></div>
        </div>
    </div>
</section>`,
        offers: `
<section class="offers" id="offers">
    <div class="container">
        <div class="section-header"><h2>عروض حصرية</h2><p>لفترة محدودة</p></div>
        <div class="grid-3">
            <div class="offer-card"><span class="offer-badge">-30%</span><h3>باقة العروس</h3><p>مكياج + شعر + عناية كاملة</p><a href="#booking" class="btn btn-outline">احجزي</a></div>
            <div class="offer-card"><span class="offer-badge">-20%</span><h3>باقة الاسترخاء</h3><p>سبا + مساج + عناية بالبشرة</p><a href="#booking" class="btn btn-outline">احجزي</a></div>
            <div class="offer-card"><span class="offer-badge">جديد</span><h3>عضوية VIP</h3><p>خصومات دائمة وأولوية حجز</p><a href="#booking" class="btn btn-outline">اشتركي</a></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🚗 سيارات ومعارض
// ═══════════════════════════════════════════════════════
const AUTOMOTIVE_TEMPLATE = {
    css_vars: `
:root {
    --primary: #dc2626;
    --secondary: #b91c1c;
    --accent: #facc15;
    --bg: #0a0a0a;
    --bg-light: #171717;
    --text: #f5f5f5;
    --text-light: #a3a3a3;
    --border: #262626;
    --card-bg: #141414;
    --success: #22c55e;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-car-side" aria-hidden="true"></i><span>{اسم المعرض}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#inventory">السيارات</a>
            <a href="#brands">الماركات</a>
            <a href="#finance">التمويل</a>
        </nav>
        <a href="#testdrive" class="btn btn-primary">قيادة تجريبية</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🏁 موديلات 2025 وصلت</span>
        <h1>قُد <span class="text-accent">أحلامك</span> اليوم</h1>
        <p>أوسع تشكيلة سيارات جديدة ومستعملة معتمدة، مع خيارات تمويل مرنة وضمان شامل.</p>
        <div class="hero-actions"><a href="#inventory" class="btn btn-primary">تصفّح السيارات</a><a href="#finance" class="btn btn-outline">احسب التمويل</a></div>
    </div>
</section>`,
        inventory: `
<section class="inventory" id="inventory">
    <div class="container">
        <div class="section-header"><h2>أحدث المعروضات</h2><p>اختر سيارتك المثالية</p></div>
        <div class="grid-3" id="carGrid">
            <div class="car-card"><img src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&q=80" alt=""><div class="car-body"><h3>سيدان فاخرة</h3><ul class="car-specs"><li>2025</li><li>أوتوماتيك</li><li>0 كم</li></ul><div class="car-price">185,000 ر.س</div><button class="btn btn-outline" onclick="viewCar(1)">التفاصيل</button></div></div>
            <div class="car-card"><img src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=500&q=80" alt=""><div class="car-body"><h3>سيارة رياضية</h3><ul class="car-specs"><li>2025</li><li>V8</li><li>0 كم</li></ul><div class="car-price">320,000 ر.س</div><button class="btn btn-outline" onclick="viewCar(2)">التفاصيل</button></div></div>
            <div class="car-card"><img src="https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=500&q=80" alt=""><div class="car-body"><h3>دفع رباعي</h3><ul class="car-specs"><li>2024</li><li>7 مقاعد</li><li>15,000 كم</li></ul><div class="car-price">210,000 ر.س</div><button class="btn btn-outline" onclick="viewCar(3)">التفاصيل</button></div></div>
        </div>
    </div>
</section>`,
        finance: `
<section class="finance" id="finance">
    <div class="container">
        <div class="section-header"><h2>احسب قسطك الشهري</h2><p>تمويل يبدأ من 0% فائدة</p></div>
        <form class="finance-form" onsubmit="return calcFinance(event)">
            <input type="number" placeholder="سعر السيارة (ر.س)" required aria-label="السعر">
            <input type="number" placeholder="الدفعة الأولى (ر.س)" aria-label="الدفعة الأولى">
            <select aria-label="مدة التمويل"><option>36 شهراً</option><option>48 شهراً</option><option>60 شهراً</option></select>
            <button type="submit" class="btn btn-primary">احسب القسط</button>
        </form>
        <div class="finance-result" id="financeResult"></div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 💍 زفاف ومناسبات
// ═══════════════════════════════════════════════════════
const WEDDING_TEMPLATE = {
    css_vars: `
:root {
    --primary: #b08d57;
    --secondary: #8a6d3b;
    --accent: #e8b4b8;
    --bg: #fdfbf7;
    --bg-light: #f7f0e6;
    --text: #3d3428;
    --text-light: #8a7f6e;
    --border: #ece2d0;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-ring" aria-hidden="true"></i><span>{اسم الخدمة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#story">قصتنا</a>
            <a href="#packages">الباقات</a>
            <a href="#gallery">المعرض</a>
        </nav>
        <a href="#rsvp" class="btn btn-primary">احجز مناسبتك</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero wedding-hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">💍 نصنع لحظاتكم الخالدة</span>
        <h1>يوم زفافٍ <span class="text-accent">كما حلمتِ به</span></h1>
        <p>تنظيم وتنسيق كامل لحفلات الزفاف والمناسبات بلمسة راقية تليق بأجمل أيام حياتكم.</p>
        <a href="#rsvp" class="btn btn-primary">ابدأ التخطيط</a>
    </div>
</section>`,
        packages: `
<section class="packages" id="packages">
    <div class="container">
        <div class="section-header"><h2>باقات المناسبات</h2><p>نناسب كل الأذواق والميزانيات</p></div>
        <div class="grid-3">
            <div class="package-card"><h3>باقة كلاسيكية</h3><div class="price">15,000 <small>ر.س</small></div><ul><li>تنسيق القاعة</li><li>تصوير فوتوغرافي</li><li>ضيافة أساسية</li></ul><a href="#rsvp" class="btn btn-outline">اختر</a></div>
            <div class="package-card featured"><span class="pkg-badge">الأكثر طلباً</span><h3>باقة ملكية</h3><div class="price">35,000 <small>ر.س</small></div><ul><li>ديكور فاخر</li><li>تصوير سينمائي</li><li>منسّق مناسبات</li></ul><a href="#rsvp" class="btn btn-primary">اختر</a></div>
            <div class="package-card"><h3>باقة مخصصة</h3><div class="price">حسب الطلب</div><ul><li>تصميم كامل حسب رغبتك</li><li>خدمات إضافية</li></ul><a href="#rsvp" class="btn btn-outline">تواصل</a></div>
        </div>
    </div>
</section>`,
        rsvp: `
<section class="rsvp" id="rsvp">
    <div class="container">
        <div class="section-header"><h2>احجز موعد مناسبتك</h2><p>سنتواصل معك لتفصيل كل التفاصيل</p></div>
        <form class="rsvp-form" onsubmit="return submitRsvp(event)">
            <input type="text" placeholder="اسم العروسين" required aria-label="الاسم">
            <input type="tel" placeholder="رقم الجوال" required aria-label="الجوال">
            <input type="date" required aria-label="تاريخ المناسبة">
            <input type="number" placeholder="عدد الضيوف المتوقع" aria-label="عدد الضيوف">
            <button type="submit" class="btn btn-primary">إرسال الطلب</button>
        </form>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 📷 تصوير فوتوغرافي
// ═══════════════════════════════════════════════════════
const PHOTOGRAPHY_TEMPLATE = {
    css_vars: `
:root {
    --primary: #18181b;
    --secondary: #000000;
    --accent: #eab308;
    --bg: #fafafa;
    --bg-light: #f4f4f5;
    --text: #18181b;
    --text-light: #71717a;
    --border: #e4e4e7;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-camera-retro" aria-hidden="true"></i><span>{اسم المصور}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#portfolio">أعمالي</a>
            <a href="#services">الخدمات</a>
            <a href="#contact">تواصل</a>
        </nav>
        <a href="#booking" class="btn btn-primary">احجز جلسة</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero photo-hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">📷 نلتقط اللحظات كما هي</span>
        <h1>قصصكم <span class="text-accent">بعدسة احترافية</span></h1>
        <p>تصوير فوتوغرافي للمناسبات والبورتريه والمنتجات بجودة عالية ولمسة فنية مميزة.</p>
        <a href="#portfolio" class="btn btn-primary">شاهد أعمالي</a>
    </div>
</section>`,
        portfolio: `
<section class="portfolio" id="portfolio">
    <div class="container">
        <div class="section-header"><h2>معرض الأعمال</h2><p>مختارات من أحدث جلساتي</p></div>
        <div class="gallery-filters">
            <button class="filter-btn active" onclick="filterGallery('all')">الكل</button>
            <button class="filter-btn" onclick="filterGallery('portrait')">بورتريه</button>
            <button class="filter-btn" onclick="filterGallery('event')">مناسبات</button>
            <button class="filter-btn" onclick="filterGallery('product')">منتجات</button>
        </div>
        <div class="masonry-grid" id="galleryGrid">
            <img src="https://images.unsplash.com/photo-1519741497674-611481863552?w=500&q=80" alt="" data-category="event">
            <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&q=80" alt="" data-category="portrait">
            <img src="https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&q=80" alt="" data-category="product">
            <img src="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500&q=80" alt="" data-category="portrait">
        </div>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header"><h2>باقات التصوير</h2><p>اختر ما يناسب مناسبتك</p></div>
        <div class="grid-3">
            <div class="service-card"><i class="fas fa-user"></i><h3>جلسة بورتريه</h3><div class="price">400 <small>ر.س</small></div><p>ساعة تصوير · 15 صورة معدّلة</p></div>
            <div class="service-card"><i class="fas fa-heart"></i><h3>مناسبات</h3><div class="price">1,500 <small>ر.س</small></div><p>تغطية كاملة · ألبوم رقمي</p></div>
            <div class="service-card"><i class="fas fa-box"></i><h3>تصوير منتجات</h3><div class="price">من 250 <small>ر.س</small></div><p>خلفيات احترافية · تعديل كامل</p></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🎵 موسيقى وفنانون
// ═══════════════════════════════════════════════════════
const MUSIC_TEMPLATE = {
    css_vars: `
:root {
    --primary: #8b5cf6;
    --secondary: #7c3aed;
    --accent: #22d3ee;
    --bg: #0c0a1d;
    --bg-light: #17132e;
    --text: #f5f3ff;
    --text-light: #c4b5fd;
    --border: #2e2650;
    --card-bg: #150f2e;
    --success: #34d399;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-music" aria-hidden="true"></i><span>{اسم الفنان}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#music">الأغاني</a>
            <a href="#tour">الحفلات</a>
            <a href="#about">عن الفنان</a>
        </nav>
        <a href="#tour" class="btn btn-primary">احجز تذكرة</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🎧 الألبوم الجديد متاح الآن</span>
        <h1>اسمع <span class="text-accent">الإيقاع</span> الجديد</h1>
        <p>موسيقى تلامس الروح — استمع لأحدث الإصدارات واحجز تذكرتك للجولة القادمة.</p>
        <div class="hero-actions"><a href="#music" class="btn btn-primary"><i class="fas fa-play"></i> استمع الآن</a><a href="#tour" class="btn btn-outline">مواعيد الحفلات</a></div>
    </div>
</section>`,
        tracks: `
<section class="tracks" id="music">
    <div class="container">
        <div class="section-header"><h2>أحدث الأغاني</h2><p>من الألبوم الجديد</p></div>
        <ul class="track-list" id="trackList">
            <li class="track-item"><button class="play-btn" onclick="playTrack(1)"><i class="fas fa-play"></i></button><span class="track-name">الأغنية الأولى</span><span class="track-time">3:45</span></li>
            <li class="track-item"><button class="play-btn" onclick="playTrack(2)"><i class="fas fa-play"></i></button><span class="track-name">الأغنية الثانية</span><span class="track-time">4:12</span></li>
            <li class="track-item"><button class="play-btn" onclick="playTrack(3)"><i class="fas fa-play"></i></button><span class="track-name">الأغنية الثالثة</span><span class="track-time">3:28</span></li>
        </ul>
    </div>
</section>`,
        tour: `
<section class="tour" id="tour">
    <div class="container">
        <div class="section-header"><h2>جولة الحفلات</h2><p>احجز مكانك قبل النفاد</p></div>
        <ul class="tour-list">
            <li class="tour-item"><div class="tour-date"><strong>20</strong><span>يوليو</span></div><div class="tour-info"><h3>الرياض</h3><p>قاعة المملكة</p></div><a href="#tickets" class="btn btn-outline">تذاكر</a></li>
            <li class="tour-item"><div class="tour-date"><strong>27</strong><span>يوليو</span></div><div class="tour-info"><h3>جدة</h3><p>واجهة البحر</p></div><a href="#tickets" class="btn btn-outline">تذاكر</a></li>
            <li class="tour-item sold"><div class="tour-date"><strong>03</strong><span>أغسطس</span></div><div class="tour-info"><h3>الدمام</h3><p>المسرح الكبير</p></div><span class="sold-out">نفدت التذاكر</span></li>
        </ul>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🤝 جمعية خيرية / غير ربحية
// ═══════════════════════════════════════════════════════
const NONPROFIT_TEMPLATE = {
    css_vars: `
:root {
    --primary: #059669;
    --secondary: #047857;
    --accent: #f59e0b;
    --bg: #f0fdf4;
    --bg-light: #dcfce7;
    --text: #14532d;
    --text-light: #5f7a68;
    --border: #cfebd8;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-hand-holding-heart" aria-hidden="true"></i><span>{اسم الجمعية}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#causes">حملاتنا</a>
            <a href="#about">عنّا</a>
            <a href="#volunteer">تطوّع</a>
        </nav>
        <a href="#donate" class="btn btn-primary">تبرّع الآن</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">❤️ معاً نصنع الفرق</span>
        <h1>تبرّعك <span class="text-accent">يغيّر حياة</span></h1>
        <p>نعمل على إيصال العون للمحتاجين حول العالم — كل ريال يصل بأمانة وشفافية كاملة.</p>
        <div class="hero-actions"><a href="#donate" class="btn btn-primary">تبرّع الآن</a><a href="#volunteer" class="btn btn-outline">انضم متطوعاً</a></div>
    </div>
</section>`,
        causes: `
<section class="causes" id="causes">
    <div class="container">
        <div class="section-header"><h2>حملاتنا الحالية</h2><p>ساهم في صنع الأثر</p></div>
        <div class="grid-3" id="causeGrid">
            <div class="cause-card"><img src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=500&q=80" alt=""><div class="cause-body"><h3>كفالة يتيم</h3><div class="progress"><div class="progress-bar" style="width:72%"></div></div><p>جُمع 72% من الهدف</p><a href="#donate" class="btn btn-outline">تبرّع</a></div></div>
            <div class="cause-card"><img src="https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=500&q=80" alt=""><div class="cause-body"><h3>مياه نظيفة</h3><div class="progress"><div class="progress-bar" style="width:45%"></div></div><p>جُمع 45% من الهدف</p><a href="#donate" class="btn btn-outline">تبرّع</a></div></div>
            <div class="cause-card"><img src="https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=500&q=80" alt=""><div class="cause-body"><h3>سلة غذائية</h3><div class="progress"><div class="progress-bar" style="width:88%"></div></div><p>جُمع 88% من الهدف</p><a href="#donate" class="btn btn-outline">تبرّع</a></div></div>
        </div>
    </div>
</section>`,
        donate: `
<section class="donate" id="donate">
    <div class="container">
        <div class="donate-box">
            <h2>تبرّع الآن</h2>
            <p>اختر مبلغ تبرّعك وساهم في إحداث فرق حقيقي.</p>
            <div class="amount-options">
                <button class="amount-btn" onclick="setAmount(50)">50 ر.س</button>
                <button class="amount-btn active" onclick="setAmount(100)">100 ر.س</button>
                <button class="amount-btn" onclick="setAmount(500)">500 ر.س</button>
                <input type="number" placeholder="مبلغ آخر" aria-label="مبلغ مخصص">
            </div>
            <button class="btn btn-primary" onclick="donate()" style="width:100%">أكمل التبرّع</button>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🎨 وكالة إبداعية / تسويق
// ═══════════════════════════════════════════════════════
const AGENCY_TEMPLATE = {
    css_vars: `
:root {
    --primary: #84cc16;
    --secondary: #65a30d;
    --accent: #f43f5e;
    --bg: #0a0a0a;
    --bg-light: #171717;
    --text: #fafafa;
    --text-light: #a3a3a3;
    --border: #262626;
    --card-bg: #131313;
    --success: #22c55e;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-bezier-curve" aria-hidden="true"></i><span>{اسم الوكالة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#work">أعمالنا</a>
            <a href="#services">خدماتنا</a>
            <a href="#contact">تواصل</a>
        </nav>
        <a href="#contact" class="btn btn-primary">ابدأ مشروعك</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🎯 نصنع علامات تُذكر</span>
        <h1>أفكار <span class="text-accent">جريئة</span> تُحرّك النتائج</h1>
        <p>وكالة إبداعية متكاملة في الهوية البصرية، التسويق الرقمي، وتطوير المنتجات.</p>
        <a href="#work" class="btn btn-primary">شاهد أعمالنا</a>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header"><h2>ماذا نقدّم</h2><p>حلول إبداعية شاملة</p></div>
        <div class="grid-4">
            <div class="service-card"><i class="fas fa-palette"></i><h3>الهوية البصرية</h3><p>شعارات وأنظمة بصرية مميزة.</p></div>
            <div class="service-card"><i class="fas fa-bullhorn"></i><h3>التسويق الرقمي</h3><p>حملات تصل لجمهورك الصحيح.</p></div>
            <div class="service-card"><i class="fas fa-code"></i><h3>تطوير الويب</h3><p>مواقع وتطبيقات عالية الأداء.</p></div>
            <div class="service-card"><i class="fas fa-film"></i><h3>إنتاج المحتوى</h3><p>فيديو وتصوير يحكي قصتك.</p></div>
        </div>
    </div>
</section>`,
        work: `
<section class="work" id="work">
    <div class="container">
        <div class="section-header"><h2>أعمال مختارة</h2><p>نتائج نفخر بها</p></div>
        <div class="grid-3" id="workGrid">
            <div class="work-card"><img src="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=500&q=80" alt=""><div class="work-overlay"><h3>هوية علامة تجارية</h3><span>Branding</span></div></div>
            <div class="work-card"><img src="https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=500&q=80" alt=""><div class="work-overlay"><h3>حملة تسويقية</h3><span>Marketing</span></div></div>
            <div class="work-card"><img src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&q=80" alt=""><div class="work-overlay"><h3>منصة رقمية</h3><span>Web</span></div></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 💰 مالية وتأمين ومحاسبة
// ═══════════════════════════════════════════════════════
const FINANCE_TEMPLATE = {
    css_vars: `
:root {
    --primary: #1d4ed8;
    --secondary: #1e3a8a;
    --accent: #10b981;
    --bg: #f8fafc;
    --bg-light: #eff6ff;
    --text: #0f172a;
    --text-light: #64748b;
    --border: #dbe4f0;
    --card-bg: #ffffff;
    --success: #10b981;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-chart-pie" aria-hidden="true"></i><span>{اسم الشركة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#services">خدماتنا</a>
            <a href="#calculator">حاسبة</a>
            <a href="#about">عنّا</a>
        </nav>
        <a href="#consult" class="btn btn-primary">استشارة مجانية</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">📈 نُنمّي أموالك بثقة</span>
        <h1>مستقبلك المالي <span class="text-accent">يبدأ اليوم</span></h1>
        <p>حلول استثمارية ومحاسبية وتأمينية مصمّمة لتحقيق أهدافك المالية بأمان وشفافية.</p>
        <div class="hero-actions"><a href="#consult" class="btn btn-primary">احجز استشارة</a><a href="#calculator" class="btn btn-outline">احسب استثمارك</a></div>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header"><h2>خدماتنا المالية</h2><p>حلول شاملة لكل احتياج</p></div>
        <div class="grid-3">
            <div class="service-card"><i class="fas fa-piggy-bank"></i><h3>إدارة الثروات</h3><p>محافظ استثمارية مدروسة تناسب أهدافك.</p></div>
            <div class="service-card"><i class="fas fa-file-invoice-dollar"></i><h3>محاسبة وضرائب</h3><p>مسك دفاتر وإقرارات ضريبية دقيقة.</p></div>
            <div class="service-card"><i class="fas fa-shield-halved"></i><h3>تأمين</h3><p>باقات تأمين تحمي أصولك وعائلتك.</p></div>
        </div>
    </div>
</section>`,
        calculator: `
<section class="calculator" id="calculator">
    <div class="container">
        <div class="section-header"><h2>حاسبة الاستثمار</h2><p>احسب عائدك المتوقع</p></div>
        <form class="calc-form" onsubmit="return calcInvestment(event)">
            <input type="number" placeholder="المبلغ المبدئي (ر.س)" required aria-label="المبلغ">
            <input type="number" placeholder="إيداع شهري (ر.س)" aria-label="الإيداع الشهري">
            <input type="number" placeholder="عدد السنوات" required aria-label="السنوات">
            <button type="submit" class="btn btn-primary">احسب العائد</button>
        </form>
        <div class="calc-result" id="calcResult"></div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🏗️ مقاولات وبناء
// ═══════════════════════════════════════════════════════
const CONSTRUCTION_TEMPLATE = {
    css_vars: `
:root {
    --primary: #ea580c;
    --secondary: #9a3412;
    --accent: #facc15;
    --bg: #fafaf9;
    --bg-light: #f5f5f4;
    --text: #1c1917;
    --text-light: #78716c;
    --border: #e7e5e4;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-helmet-safety" aria-hidden="true"></i><span>{اسم الشركة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#services">خدماتنا</a>
            <a href="#projects">مشاريعنا</a>
            <a href="#contact">تواصل</a>
        </nav>
        <a href="#quote" class="btn btn-primary">اطلب عرض سعر</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🏗️ نبني على أساس متين</span>
        <h1>نحوّل تصوّرك إلى <span class="text-accent">واقع</span></h1>
        <p>شركة مقاولات متكاملة في البناء والتشطيب والإشراف الهندسي بأعلى معايير الجودة والالتزام.</p>
        <div class="hero-actions"><a href="#quote" class="btn btn-primary">اطلب عرض سعر</a><a href="#projects" class="btn btn-outline">مشاريعنا</a></div>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header"><h2>خدماتنا</h2><p>من الفكرة حتى التسليم</p></div>
        <div class="grid-3">
            <div class="service-card"><i class="fas fa-building"></i><h3>البناء والإنشاء</h3><p>تنفيذ المشاريع السكنية والتجارية بالكامل.</p></div>
            <div class="service-card"><i class="fas fa-trowel-bricks"></i><h3>التشطيبات</h3><p>تشطيبات داخلية وخارجية بجودة عالية.</p></div>
            <div class="service-card"><i class="fas fa-ruler-combined"></i><h3>الإشراف الهندسي</h3><p>متابعة فنية دقيقة لكل مراحل المشروع.</p></div>
        </div>
    </div>
</section>`,
        projects: `
<section class="projects" id="projects">
    <div class="container">
        <div class="section-header"><h2>مشاريع أنجزناها</h2><p>جودة تتحدث عن نفسها</p></div>
        <div class="grid-3" id="projectGrid">
            <div class="project-card"><img src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&q=80" alt=""><div class="project-info"><h3>مجمّع سكني</h3><span>الرياض · 2024</span></div></div>
            <div class="project-card"><img src="https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500&q=80" alt=""><div class="project-info"><h3>برج تجاري</h3><span>جدة · 2023</span></div></div>
            <div class="project-card"><img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&q=80" alt=""><div class="project-info"><h3>فيلا خاصة</h3><span>الدمام · 2024</span></div></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🛋️ تصميم داخلي وديكور
// ═══════════════════════════════════════════════════════
const INTERIOR_TEMPLATE = {
    css_vars: `
:root {
    --primary: #7c6a54;
    --secondary: #5c4f3e;
    --accent: #a3b18a;
    --bg: #faf8f5;
    --bg-light: #f0ece5;
    --text: #33302b;
    --text-light: #8a8479;
    --border: #e5ded3;
    --card-bg: #ffffff;
    --success: #16a34a;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-couch" aria-hidden="true"></i><span>{اسم الاستوديو}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#portfolio">أعمالنا</a>
            <a href="#services">خدماتنا</a>
            <a href="#contact">تواصل</a>
        </nav>
        <a href="#consult" class="btn btn-primary">استشارة تصميم</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🛋️ مساحات تعكس ذوقك</span>
        <h1>نصمّم <span class="text-accent">بيتاً يشبهك</span></h1>
        <p>تصميم داخلي وديكور يجمع بين الجمال والوظيفة — من الفكرة حتى آخر قطعة أثاث.</p>
        <a href="#portfolio" class="btn btn-primary">شاهد أعمالنا</a>
    </div>
</section>`,
        portfolio: `
<section class="portfolio" id="portfolio">
    <div class="container">
        <div class="section-header"><h2>معرض التصاميم</h2><p>إلهام لمساحتك القادمة</p></div>
        <div class="grid-3" id="designGrid">
            <div class="design-card"><img src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=500&q=80" alt=""><div class="design-info"><h3>صالة معيشة عصرية</h3></div></div>
            <div class="design-card"><img src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&q=80" alt=""><div class="design-info"><h3>غرفة نوم دافئة</h3></div></div>
            <div class="design-card"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=500&q=80" alt=""><div class="design-info"><h3>مطبخ مفتوح</h3></div></div>
        </div>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header"><h2>خدماتنا</h2><p>حلول تصميم متكاملة</p></div>
        <div class="grid-3">
            <div class="service-card"><i class="fas fa-pencil-ruler"></i><h3>تصميم المخططات</h3><p>مخططات ثلاثية الأبعاد قبل التنفيذ.</p></div>
            <div class="service-card"><i class="fas fa-swatchbook"></i><h3>اختيار الخامات</h3><p>ألوان وخامات تناسب أسلوبك.</p></div>
            <div class="service-card"><i class="fas fa-truck-ramp-box"></i><h3>التنفيذ والإشراف</h3><p>تنفيذ كامل بإشراف مصمّمينا.</p></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🎮 ألعاب و eSports
// ═══════════════════════════════════════════════════════
const GAMING_TEMPLATE = {
    css_vars: `
:root {
    --primary: #22c55e;
    --secondary: #16a34a;
    --accent: #a855f7;
    --bg: #08090d;
    --bg-light: #12141c;
    --text: #e5f9ed;
    --text-light: #86efac;
    --border: #1e2430;
    --card-bg: #0f1218;
    --success: #22c55e;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-gamepad" aria-hidden="true"></i><span>{اسم الفريق}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#games">الألعاب</a>
            <a href="#tournaments">البطولات</a>
            <a href="#team">الفريق</a>
        </nav>
        <a href="#join" class="btn btn-primary">انضم إلينا</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🎮 البطولة الكبرى قادمة</span>
        <h1>ادخل <span class="text-accent">حلبة الأبطال</span></h1>
        <p>مجتمع لاعبين محترفين، بطولات بجوائز ضخمة، وبث مباشر لكل اللحظات الحاسمة.</p>
        <div class="hero-actions"><a href="#tournaments" class="btn btn-primary">سجّل في البطولة</a><a href="#live" class="btn btn-outline"><i class="fas fa-circle"></i> شاهد البث</a></div>
    </div>
</section>`,
        tournaments: `
<section class="tournaments" id="tournaments">
    <div class="container">
        <div class="section-header"><h2>البطولات القادمة</h2><p>جوائز تصل لـ 100,000 ر.س</p></div>
        <div class="grid-3" id="tournamentGrid">
            <div class="tournament-card"><span class="prize">50,000 ر.س</span><h3>بطولة الصيف</h3><p>18 يوليو · فرق من 5</p><a href="#join" class="btn btn-outline">سجّل</a></div>
            <div class="tournament-card"><span class="prize">30,000 ر.س</span><h3>نزال الفردي</h3><p>25 يوليو · 1 ضد 1</p><a href="#join" class="btn btn-outline">سجّل</a></div>
            <div class="tournament-card"><span class="prize">20,000 ر.س</span><h3>كأس الهواة</h3><p>2 أغسطس · مفتوح</p><a href="#join" class="btn btn-outline">سجّل</a></div>
        </div>
    </div>
</section>`,
        stats: `
<section class="stats">
    <div class="container">
        <div class="grid-4">
            <div class="metric"><strong>+2M</strong><span>مشاهدة</span></div>
            <div class="metric"><strong>150+</strong><span>لاعب محترف</span></div>
            <div class="metric"><strong>40</strong><span>بطولة</span></div>
            <div class="metric"><strong>#1</strong><span>ترتيب إقليمي</span></div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// ₿ عملات رقمية / Web3
// ═══════════════════════════════════════════════════════
const CRYPTO_TEMPLATE = {
    css_vars: `
:root {
    --primary: #f7931a;
    --secondary: #d97706;
    --accent: #22d3ee;
    --bg: #0b1120;
    --bg-light: #141d33;
    --text: #f1f5f9;
    --text-light: #94a3b8;
    --border: #1e2b45;
    --card-bg: #101a30;
    --success: #22c55e;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo"><i class="fas fa-coins" aria-hidden="true"></i><span>{اسم المنصة}</span></div>
        <nav class="nav-links" id="navLinks">
            <a href="#markets">الأسواق</a>
            <a href="#features">المميزات</a>
            <a href="#faq">الأسئلة</a>
        </nav>
        <div class="nav-actions"><a href="#login">دخول</a><a href="#signup" class="btn btn-primary">ابدأ التداول</a></div>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">₿ تداول بأمان وسرعة</span>
        <h1>مستقبل <span class="text-accent">المال الرقمي</span> بين يديك</h1>
        <p>منصة تداول عملات رقمية موثوقة برسوم منخفضة، أمان عالٍ، وأدوات احترافية للمبتدئ والخبير.</p>
        <div class="hero-actions"><a href="#signup" class="btn btn-primary">أنشئ محفظتك</a><a href="#markets" class="btn btn-outline">تصفّح الأسواق</a></div>
    </div>
</section>`,
        markets: `
<section class="markets" id="markets">
    <div class="container">
        <div class="section-header"><h2>أسعار السوق</h2><p>تحديث لحظي</p></div>
        <table class="market-table" id="marketTable">
            <thead><tr><th>العملة</th><th>السعر</th><th>24 ساعة</th></tr></thead>
            <tbody>
                <tr><td>Bitcoin (BTC)</td><td>$64,200</td><td class="up">+2.4%</td></tr>
                <tr><td>Ethereum (ETH)</td><td>$3,180</td><td class="up">+1.1%</td></tr>
                <tr><td>Solana (SOL)</td><td>$148</td><td class="down">-0.8%</td></tr>
            </tbody>
        </table>
    </div>
</section>`,
        features: `
<section class="features" id="features">
    <div class="container">
        <div class="section-header"><h2>لماذا منصّتنا؟</h2><p>مصمّمة لتثق بها</p></div>
        <div class="grid-3">
            <div class="feature-item"><i class="fas fa-lock"></i><h3>أمان عالٍ</h3><p>تخزين بارد وحماية بمصادقة ثنائية.</p></div>
            <div class="feature-item"><i class="fas fa-bolt"></i><h3>تنفيذ فوري</h3><p>صفقات تُنفّذ في أجزاء من الثانية.</p></div>
            <div class="feature-item"><i class="fas fa-percent"></i><h3>رسوم منخفضة</h3><p>أفضل الأسعار في السوق بلا رسوم خفية.</p></div>
        </div>
    </div>
</section>`
    }
};

export const EXTENDED_TEMPLATES = {
    travel: TRAVEL_TEMPLATE,
    saas: SAAS_TEMPLATE,
    startup: STARTUP_TEMPLATE,
    entertainment: ENTERTAINMENT_TEMPLATE,
    booking: BOOKING_TEMPLATE,
    blog: BLOG_TEMPLATE,
    news: NEWS_TEMPLATE,
    law: LAW_TEMPLATE,
    beauty: BEAUTY_TEMPLATE,
    automotive: AUTOMOTIVE_TEMPLATE,
    wedding: WEDDING_TEMPLATE,
    photography: PHOTOGRAPHY_TEMPLATE,
    music: MUSIC_TEMPLATE,
    nonprofit: NONPROFIT_TEMPLATE,
    agency: AGENCY_TEMPLATE,
    finance: FINANCE_TEMPLATE,
    construction: CONSTRUCTION_TEMPLATE,
    interior: INTERIOR_TEMPLATE,
    gaming: GAMING_TEMPLATE,
    crypto: CRYPTO_TEMPLATE,
};
