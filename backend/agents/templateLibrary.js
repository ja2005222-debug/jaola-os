/**
 * 📚 Template Library — JAOLA OS
 *
 * مكتبة templates كاملة لـ 10 أنواع مشاريع.
 * كل نوع لديه:
 * - هيكل HTML كامل جاهز
 * - CSS Variables مخصصة
 * - أقسام إلزامية مفصّلة
 * - محتوى واقعي (أسماء، أسعار، وصف)
 *
 * الـ Coder يستخدم هذه كنقطة انطلاق وليس من صفر.
 */

// ═══════════════════════════════════════════════════════
// 🎨 CSS Base لكل المشاريع
// ═══════════════════════════════════════════════════════
const CSS_RESET = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;500;700&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
    font-family: 'Tajawal', 'Cairo', sans-serif;
    color: var(--text);
    background: var(--bg);
    line-height: 1.6;
    direction: rtl;
}
img { max-width: 100%; height: auto; display: block; }
a { text-decoration: none; color: inherit; }
ul { list-style: none; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
section { padding: 5rem 0; }
.section-header { text-align: center; margin-bottom: 3rem; }
.section-header h2 { font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 700; color: var(--text); margin-bottom: .5rem; }
.section-header p { color: var(--text-light); font-size: 1rem; }
.btn { display: inline-block; padding: .8rem 2rem; border-radius: 50px; font-weight: 600; transition: all .3s; cursor: pointer; border: none; font-family: inherit; font-size: 1rem; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,.2); }
.btn-outline { border: 2px solid var(--primary); color: var(--primary); background: transparent; }
.btn-outline:hover { background: var(--primary); color: #fff; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
@media (max-width: 768px) {
    .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
    section { padding: 3rem 0; }
}
`;

// ═══════════════════════════════════════════════════════
// 🏪 قوالب المتجر الإلكتروني
// ═══════════════════════════════════════════════════════
const ECOMMERCE_TEMPLATE = {
    css_vars: `
:root {
    --primary: #7c3aed;
    --secondary: #5b21b6;
    --accent: #a78bfa;
    --bg: #fafafa;
    --bg-light: #f3f0ff;
    --text: #1a1a2e;
    --text-light: #6b7280;
    --border: #e5e7eb;
    --card-bg: #ffffff;
    --sale: #ef4444;
    --success: #10b981;
}`,
    sections: {
        navbar: `
<header class="navbar" id="navbar">
    <div class="container">
        <div class="logo">
            <i class="fas fa-store" aria-hidden="true"></i>
            <span>{اسم المتجر}</span>
        </div>
        <nav class="nav-links" id="navLinks">
            <a href="#home">الرئيسية</a>
            <a href="#products">المنتجات</a>
            <a href="#offers">العروض</a>
            <a href="#about">من نحن</a>
        </nav>
        <div class="nav-actions">
            <button class="search-btn" aria-label="بحث"><i class="fas fa-search" aria-hidden="true"></i></button>
            <button class="cart-btn" onclick="openCart()" aria-label="سلة التسوق">
                <i class="fas fa-shopping-cart" aria-hidden="true"></i>
                <span class="cart-badge" id="cartCount">0</span>
            </button>
        </div>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero" id="home">
    <div class="hero-content">
        <span class="hero-badge">🔥 تخفيضات تصل إلى 50%</span>
        <h1>اكتشف <span class="text-accent">أحدث</span> المنتجات</h1>
        <p>تسوّق بثقة من مجموعتنا المتميزة — جودة عالية بأسعار تنافسية مع توصيل سريع</p>
        <div class="hero-actions">
            <a href="#products" class="btn btn-primary">تسوّق الآن</a>
            <a href="#offers" class="btn btn-outline">العروض الحصرية</a>
        </div>
        <div class="hero-stats">
            <div class="stat"><strong>+5,000</strong><span>منتج</span></div>
            <div class="stat"><strong>+20,000</strong><span>عميل سعيد</span></div>
            <div class="stat"><strong>24/7</strong><span>دعم فوري</span></div>
        </div>
    </div>
    <div class="hero-image">
        <img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&q=80&auto=format&fit=crop" alt="تسوق أونلاين">
    </div>
</section>`,
        products: `
<section class="products" id="products">
    <div class="container">
        <div class="section-header">
            <h2>منتجاتنا المميزة</h2>
            <p>اختر من بين آلاف المنتجات عالية الجودة</p>
        </div>
        <div class="product-filters">
            <button class="filter-btn active" onclick="filterProducts('all')">الكل</button>
            <button class="filter-btn" onclick="filterProducts('new')">الجديد</button>
            <button class="filter-btn" onclick="filterProducts('sale')">العروض</button>
            <button class="filter-btn" onclick="filterProducts('popular')">الأكثر مبيعاً</button>
        </div>
        <div class="product-grid" id="productGrid">
            <!-- المنتجات تُحمّل هنا -->
        </div>
    </div>
</section>`,
        cart: `
<div class="cart-overlay" id="cartOverlay" onclick="closeCart()"></div>
<div class="cart-sidebar" id="cartSidebar">
    <div class="cart-header">
        <h3>سلة التسوق <i class="fas fa-shopping-cart" aria-hidden="true"></i></h3>
        <button onclick="closeCart()" aria-label="إغلاق السلة">✕</button>
    </div>
    <div class="cart-items" id="cartItems">
        <div class="cart-empty"><i class="fas fa-shopping-bag" aria-hidden="true"></i><p>السلة فارغة</p></div>
    </div>
    <div class="cart-footer">
        <div class="cart-total">المجموع: <strong id="cartTotal">0</strong> ر.س</div>
        <button class="btn btn-primary" onclick="checkout()" style="width:100%">إتمام الشراء</button>
    </div>
</div>`,
        features: `
<section class="features">
    <div class="container">
        <div class="grid-4">
            <div class="feature-item">
                <i class="fas fa-truck" aria-hidden="true"></i>
                <h3>توصيل مجاني</h3>
                <p>لجميع الطلبات فوق 200 ر.س</p>
            </div>
            <div class="feature-item">
                <i class="fas fa-shield-alt" aria-hidden="true"></i>
                <h3>دفع آمن</h3>
                <p>جميع وسائل الدفع مشفّرة</p>
            </div>
            <div class="feature-item">
                <i class="fas fa-undo" aria-hidden="true"></i>
                <h3>إرجاع مجاني</h3>
                <p>خلال 30 يوماً من الاستلام</p>
            </div>
            <div class="feature-item">
                <i class="fas fa-headset" aria-hidden="true"></i>
                <h3>دعم 24/7</h3>
                <p>فريق خدمة العملاء دائماً معك</p>
            </div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🏥 قوالب المستشفى والعيادة الطبية
// ═══════════════════════════════════════════════════════
const MEDICAL_TEMPLATE = {
    css_vars: `
:root {
    --primary: #0ea5e9;
    --secondary: #0284c7;
    --accent: #10b981;
    --bg: #f0f9ff;
    --bg-light: #e0f2fe;
    --text: #0c4a6e;
    --text-light: #64748b;
    --border: #bae6fd;
    --card-bg: #ffffff;
    --emergency: #ef4444;
}`,
    sections: {
        navbar: `
<header class="navbar medical-nav" id="navbar">
    <div class="top-bar">
        <div class="container">
            <span><i class="fas fa-phone" aria-hidden="true"></i> طوارئ: 920000000</span>
            <span><i class="fas fa-clock" aria-hidden="true"></i> السبت - الخميس: 8 ص - 10 م</span>
        </div>
    </div>
    <div class="main-nav">
        <div class="container">
            <div class="logo">
                <i class="fas fa-heartbeat" aria-hidden="true"></i>
                <span>{اسم المستشفى}</span>
            </div>
            <nav class="nav-links" id="navLinks">
                <a href="#home">الرئيسية</a>
                <a href="#specialties">التخصصات</a>
                <a href="#doctors">الأطباء</a>
                <a href="#booking">احجز موعد</a>
            </nav>
            <a href="#booking" class="btn btn-primary">احجز موعد الآن</a>
        </div>
    </div>
</header>`,
        hero: `
<section class="hero medical-hero" id="home">
    <div class="hero-content">
        <h1>صحتك <span class="text-accent">أمانة</span> في أيدٍ موثوقة</h1>
        <p>نقدم لك أعلى مستويات الرعاية الصحية بفريق طبي متخصص وتقنيات طبية حديثة</p>
        <div class="hero-actions">
            <a href="#booking" class="btn btn-primary">احجز موعدك الآن</a>
            <a href="#specialties" class="btn btn-outline">اعرف خدماتنا</a>
        </div>
        <div class="hero-stats">
            <div class="stat"><strong>+50</strong><span>طبيب متخصص</span></div>
            <div class="stat"><strong>+30,000</strong><span>مريض</span></div>
            <div class="stat"><strong>15+</strong><span>سنة خبرة</span></div>
        </div>
    </div>
    <div class="hero-image">
        <img src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&q=80&auto=format&fit=crop" alt="مستشفى متخصص">
    </div>
</section>`,
        specialties: `
<section class="specialties" id="specialties">
    <div class="container">
        <div class="section-header">
            <h2>تخصصاتنا الطبية</h2>
            <p>فريق من أفضل الأطباء المتخصصين في مختلف المجالات</p>
        </div>
        <div class="grid-3">
            <div class="specialty-card">
                <div class="specialty-icon"><i class="fas fa-heart" aria-hidden="true"></i></div>
                <h3>أمراض القلب</h3>
                <p>تشخيص وعلاج جميع أمراض القلب والأوعية الدموية بأحدث التقنيات</p>
                <a href="#booking">احجز موعد ←</a>
            </div>
            <div class="specialty-card">
                <div class="specialty-icon"><i class="fas fa-brain" aria-hidden="true"></i></div>
                <h3>طب الأعصاب</h3>
                <p>تشخيص وعلاج اضطرابات الجهاز العصبي المركزي والطرفي</p>
                <a href="#booking">احجز موعد ←</a>
            </div>
            <div class="specialty-card">
                <div class="specialty-icon"><i class="fas fa-bone" aria-hidden="true"></i></div>
                <h3>جراحة العظام</h3>
                <p>علاج إصابات وأمراض العظام والمفاصل بأحدث الأساليب الجراحية</p>
                <a href="#booking">احجز موعد ←</a>
            </div>
        </div>
    </div>
</section>`,
        booking: `
<section class="booking-section" id="booking">
    <div class="container">
        <div class="section-header">
            <h2>احجز موعدك الآن</h2>
            <p>اختر التخصص المناسب وحدد الموعد الملائم لك</p>
        </div>
        <form class="booking-form" onsubmit="submitBooking(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>الاسم الكامل</label>
                    <input type="text" placeholder="محمد عبدالله" required>
                </div>
                <div class="form-group">
                    <label>رقم الجوال</label>
                    <input type="tel" placeholder="05XXXXXXXX" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>التخصص</label>
                    <select required>
                        <option value="">اختر التخصص</option>
                        <option>أمراض القلب</option>
                        <option>طب الأعصاب</option>
                        <option>جراحة العظام</option>
                        <option>طب الأطفال</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>التاريخ المفضل</label>
                    <input type="date" required>
                </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%">تأكيد الحجز</button>
        </form>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🍽️ قوالب المطعم
// ═══════════════════════════════════════════════════════
const RESTAURANT_TEMPLATE = {
    css_vars: `
:root {
    --primary: #d97706;
    --secondary: #92400e;
    --accent: #fbbf24;
    --bg: #fffbeb;
    --bg-dark: #1c1917;
    --text: #1c1917;
    --text-light: #78716c;
    --border: #fde68a;
    --card-bg: #ffffff;
}`,
    sections: {
        navbar: `
<header class="navbar restaurant-nav" id="navbar">
    <div class="container">
        <div class="logo">
            <i class="fas fa-utensils" aria-hidden="true"></i>
            <span>{اسم المطعم}</span>
        </div>
        <nav class="nav-links" id="navLinks">
            <a href="#home">الرئيسية</a>
            <a href="#menu">القائمة</a>
            <a href="#about">قصتنا</a>
            <a href="#reservation">حجز طاولة</a>
        </nav>
        <a href="#reservation" class="btn btn-primary">احجز طاولة</a>
        <div class="hamburger" id="hamburger"><span></span><span></span><span></span></div>
    </div>
</header>`,
        hero: `
<section class="hero restaurant-hero" id="home">
    <div class="hero-overlay"></div>
    <div class="hero-content">
        <p class="hero-subtitle">مطعم فاخر منذ 2010</p>
        <h1>تجربة طعام <span>لا تُنسى</span></h1>
        <p>استمتع بأشهى الأطباق المطبوخة بأيدي أمهر الطهاة من مأكولات شرقية وغربية</p>
        <div class="hero-actions">
            <a href="#menu" class="btn btn-primary">تصفح القائمة</a>
            <a href="#reservation" class="btn btn-outline">احجز طاولة</a>
        </div>
    </div>
</section>`,
        menu: `
<section class="menu-section" id="menu">
    <div class="container">
        <div class="section-header">
            <h2>قائمتنا الشهية</h2>
            <p>أطباق متنوعة تُرضي جميع الأذواق</p>
        </div>
        <div class="menu-tabs">
            <button class="menu-tab active" onclick="showCategory('all')">الكل</button>
            <button class="menu-tab" onclick="showCategory('main')">الأطباق الرئيسية</button>
            <button class="menu-tab" onclick="showCategory('appetizer')">المقبلات</button>
            <button class="menu-tab" onclick="showCategory('dessert')">الحلويات</button>
            <button class="menu-tab" onclick="showCategory('drinks')">المشروبات</button>
        </div>
        <div class="menu-grid" id="menuGrid">
            <div class="menu-card" data-category="main">
                <img src="https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80&auto=format&fit=crop" alt="مشاوي">
                <div class="menu-card-info">
                    <h3>مشاوي مشكلة</h3>
                    <p>مجموعة من أشهى المشاوي مع الخبز والمقبلات</p>
                    <span class="price">85 ر.س</span>
                </div>
            </div>
        </div>
    </div>
</section>`,
        reservation: `
<section class="reservation" id="reservation">
    <div class="container">
        <div class="grid-2">
            <div class="reservation-info">
                <h2>احجز طاولتك</h2>
                <p>نضمن لك تجربة عشاء مميزة في أجواء راقية مع خدمة استثنائية</p>
                <div class="info-item"><i class="fas fa-clock" aria-hidden="true"></i><span>السبت - الخميس: 12 ظ - 12 م</span></div>
                <div class="info-item"><i class="fas fa-phone" aria-hidden="true"></i><span>920-000-0000</span></div>
                <div class="info-item"><i class="fas fa-map-marker-alt" aria-hidden="true"></i><span>شارع الملك فهد، الرياض</span></div>
            </div>
            <form class="reservation-form" onsubmit="submitReservation(event)">
                <div class="form-group"><input type="text" placeholder="الاسم الكامل" required></div>
                <div class="form-group"><input type="tel" placeholder="رقم الجوال" required></div>
                <div class="form-row">
                    <div class="form-group"><input type="date" required></div>
                    <div class="form-group"><input type="time" required></div>
                </div>
                <div class="form-group">
                    <select required>
                        <option value="">عدد الأشخاص</option>
                        <option>1-2 شخص</option>
                        <option>3-4 أشخاص</option>
                        <option>5-6 أشخاص</option>
                        <option>أكثر من 6</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%">تأكيد الحجز</button>
            </form>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🏋️ قوالب الجيم
// ═══════════════════════════════════════════════════════
const GYM_TEMPLATE = {
    css_vars: `
:root {
    --primary: #dc2626;
    --secondary: #991b1b;
    --accent: #f59e0b;
    --bg: #0a0a0a;
    --bg-card: #1a1a1a;
    --text: #f9fafb;
    --text-light: #9ca3af;
    --border: #2d2d2d;
    --success: #10b981;
}`,
    sections: {
        hero: `
<section class="hero gym-hero" id="home">
    <div class="hero-bg">
        <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80&auto=format&fit=crop" alt="جيم">
    </div>
    <div class="hero-overlay"></div>
    <div class="hero-content">
        <h1>حوّل جسمك <span>ابدأ اليوم</span></h1>
        <p>انضم لأكثر من 5,000 عضو يحققون أهدافهم مع أفضل المدربين المعتمدين</p>
        <div class="hero-actions">
            <a href="#membership" class="btn btn-primary">ابدأ تجربتك المجانية</a>
            <a href="#classes" class="btn btn-outline">الحصص التدريبية</a>
        </div>
    </div>
</section>`,
        classes: `
<section class="classes" id="classes">
    <div class="container">
        <div class="section-header">
            <h2>حصصنا التدريبية</h2>
            <p>برامج تدريبية متنوعة لكل مستوى</p>
        </div>
        <div class="grid-3">
            <div class="class-card">
                <div class="class-icon"><i class="fas fa-dumbbell" aria-hidden="true"></i></div>
                <h3>رفع الأثقال</h3>
                <p>بناء العضلات وزيادة القوة مع مدربين معتمدين</p>
                <span class="class-duration"><i class="fas fa-clock" aria-hidden="true"></i> 60 دقيقة</span>
            </div>
            <div class="class-card featured">
                <span class="badge">الأكثر شعبية</span>
                <div class="class-icon"><i class="fas fa-fire" aria-hidden="true"></i></div>
                <h3>كروس فيت</h3>
                <p>تدريبات مكثفة لحرق الدهون وبناء اللياقة</p>
                <span class="class-duration"><i class="fas fa-clock" aria-hidden="true"></i> 45 دقيقة</span>
            </div>
            <div class="class-card">
                <div class="class-icon"><i class="fas fa-running" aria-hidden="true"></i></div>
                <h3>كارديو</h3>
                <p>تحسين صحة القلب والتحمل البدني</p>
                <span class="class-duration"><i class="fas fa-clock" aria-hidden="true"></i> 30 دقيقة</span>
            </div>
        </div>
    </div>
</section>`,
        membership: `
<section class="membership" id="membership">
    <div class="container">
        <div class="section-header">
            <h2>باقات الاشتراك</h2>
            <p>اختر الباقة المناسبة لأهدافك</p>
        </div>
        <div class="grid-3">
            <div class="price-card">
                <h3>شهري</h3>
                <div class="price"><span class="amount">199</span><span class="currency">ر.س/شهر</span></div>
                <ul>
                    <li>✓ دخول غير محدود</li>
                    <li>✓ جميع الأجهزة</li>
                    <li>✗ حصص جماعية</li>
                    <li>✗ مدرب شخصي</li>
                </ul>
                <a href="#" class="btn btn-outline">اشترك الآن</a>
            </div>
            <div class="price-card featured">
                <span class="badge">الأفضل قيمة</span>
                <h3>3 أشهر</h3>
                <div class="price"><span class="amount">149</span><span class="currency">ر.س/شهر</span></div>
                <ul>
                    <li>✓ دخول غير محدود</li>
                    <li>✓ جميع الأجهزة</li>
                    <li>✓ حصص جماعية</li>
                    <li>✗ مدرب شخصي</li>
                </ul>
                <a href="#" class="btn btn-primary">اشترك الآن</a>
            </div>
            <div class="price-card">
                <h3>سنوي</h3>
                <div class="price"><span class="amount">99</span><span class="currency">ر.س/شهر</span></div>
                <ul>
                    <li>✓ دخول غير محدود</li>
                    <li>✓ جميع الأجهزة</li>
                    <li>✓ حصص جماعية</li>
                    <li>✓ مدرب شخصي</li>
                </ul>
                <a href="#" class="btn btn-outline">اشترك الآن</a>
            </div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 🏢 قوالب الشركة والأعمال
// ═══════════════════════════════════════════════════════
const BUSINESS_TEMPLATE = {
    css_vars: `
:root {
    --primary: #1e40af;
    --secondary: #1e3a8a;
    --accent: #3b82f6;
    --bg: #f8fafc;
    --bg-light: #eff6ff;
    --text: #0f172a;
    --text-light: #64748b;
    --border: #e2e8f0;
    --card-bg: #ffffff;
}`,
    sections: {
        hero: `
<section class="hero business-hero" id="home">
    <div class="container">
        <div class="grid-2">
            <div class="hero-text">
                <span class="hero-badge">🏆 رائدون في المجال منذ 2010</span>
                <h1>نبني <span class="text-accent">مستقبلك</span> معك</h1>
                <p>نقدم حلولاً تقنية وتجارية مبتكرة تساعد شركتك على النمو والتوسع في السوق</p>
                <div class="hero-actions">
                    <a href="#contact" class="btn btn-primary">تحدث مع خبير</a>
                    <a href="#services" class="btn btn-outline">خدماتنا</a>
                </div>
            </div>
            <div class="hero-visual">
                <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&q=80&auto=format&fit=crop" alt="بيئة عمل احترافية">
            </div>
        </div>
    </div>
</section>`,
        services: `
<section class="services" id="services">
    <div class="container">
        <div class="section-header">
            <h2>خدماتنا المتميزة</h2>
            <p>حلول شاملة لتطوير أعمالك وتحقيق أهدافك</p>
        </div>
        <div class="grid-3">
            <div class="service-card">
                <div class="service-icon"><i class="fas fa-chart-line" aria-hidden="true"></i></div>
                <h3>الاستشارات الاستراتيجية</h3>
                <p>نساعدك في وضع خطة عمل واضحة وتحقيق أهدافك بكفاءة عالية</p>
                <a href="#contact">اعرف المزيد ←</a>
            </div>
            <div class="service-card">
                <div class="service-icon"><i class="fas fa-cog" aria-hidden="true"></i></div>
                <h3>الحلول التقنية</h3>
                <p>تطوير أنظمة وتطبيقات مخصصة تناسب احتياجات عملك</p>
                <a href="#contact">اعرف المزيد ←</a>
            </div>
            <div class="service-card">
                <div class="service-icon"><i class="fas fa-bullhorn" aria-hidden="true"></i></div>
                <h3>التسويق الرقمي</h3>
                <p>استراتيجيات تسويقية فعّالة لزيادة حضورك الرقمي وجذب العملاء</p>
                <a href="#contact">اعرف المزيد ←</a>
            </div>
        </div>
    </div>
</section>`
    }
};

// ═══════════════════════════════════════════════════════
// 📚 فهرس المكتبة
// ═══════════════════════════════════════════════════════
const TEMPLATE_LIBRARY = {
    ecommerce: ECOMMERCE_TEMPLATE,
    medical: MEDICAL_TEMPLATE,
    restaurant: RESTAURANT_TEMPLATE,
    gym: GYM_TEMPLATE,
    business: BUSINESS_TEMPLATE,
};

// ═══════════════════════════════════════════════════════
// 🔍 دوال الوصول للمكتبة
// ═══════════════════════════════════════════════════════

/** الحصول على template لنوع مشروع */
export function getTemplate(projectType) {
    return TEMPLATE_LIBRARY[projectType] || TEMPLATE_LIBRARY.business;
}

/** توليد CSS Variables للنوع */
export function getTemplateCSSVars(projectType) {
    const template = getTemplate(projectType);
    return template.css_vars || '';
}

/** توليد context prompt يُحقن في الـ Coder */
export function buildTemplateContext(projectType) {
    const template = getTemplate(projectType);
    if (!template) return '';

    const sectionNames = Object.keys(template.sections || {}).join('، ');
    const firstSection = Object.values(template.sections || {})[0] || '';

    return `
## Template Library — قالب ${projectType}:

### CSS Variables الإلزامية:
\`\`\`css
${template.css_vars}

${CSS_RESET}
\`\`\`

### الأقسام المتاحة في المكتبة: ${sectionNames}

### مثال على هيكل القسم الأول (navbar/hero):
\`\`\`html
${firstSection.slice(0, 800)}
\`\`\`

### تعليمات إلزامية:
- استخدم CSS Variables من :root في كل الألوان
- اتبع نفس أسلوب HTML الموضح أعلاه
- أضف محتوى واقعي (أسماء، أسعار، أوصاف حقيقية)
- تأكد من dir="rtl" على <html>`;
}

/** قائمة بجميع أنواع المشاريع المتاحة */
export function getAvailableTemplates() {
    return Object.keys(TEMPLATE_LIBRARY);
}

export { CSS_RESET };
