/**
 * 🎨 Component Marketplace — JAOLA OS
 *
 * مكتبة components جاهزة من:
 * - Tailwind CSS patterns
 * - Flowbite components
 * - HyperUI
 * - daisyUI patterns
 *
 * يُحقن مباشرة في الـ prompt عند الحاجة
 */

// ═══════════════════════════════════════════════════════
// 📦 مكتبة Components
// ═══════════════════════════════════════════════════════
export const MARKETPLACE_COMPONENTS = {

    // ── Navbar ──
    'navbar-modern': {
        name: 'Navbar عصري مع Dropdown',
        tags: ['navigation', 'all'],
        html: `<nav class="bg-white shadow-lg sticky top-0 z-50">
  <div class="max-w-7xl mx-auto px-4">
    <div class="flex justify-between items-center h-16">
      <div class="flex items-center gap-2">
        <span class="text-2xl font-bold text-primary">{Logo}</span>
      </div>
      <div class="hidden md:flex items-center gap-8">
        <a href="#" class="text-gray-600 hover:text-primary transition-colors font-medium">الرئيسية</a>
        <div class="relative group">
          <button class="text-gray-600 hover:text-primary transition-colors font-medium flex items-center gap-1">
            الخدمات <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div class="absolute top-full right-0 bg-white shadow-xl rounded-xl p-2 min-w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <a href="#" class="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">خدمة 1</a>
            <a href="#" class="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">خدمة 2</a>
          </div>
        </div>
        <a href="#contact" class="bg-primary text-white px-6 py-2 rounded-full font-semibold hover:bg-primary/90 transition-colors">تواصل معنا</a>
      </div>
    </div>
  </div>
</nav>`,
    },

    // ── Hero ──
    'hero-gradient': {
        name: 'Hero مع Gradient وAnimation',
        tags: ['hero', 'all'],
        html: `<section class="relative min-h-screen flex items-center overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-br from-primary/10 via-white to-secondary/10"></div>
  <div class="absolute top-20 right-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
  <div class="absolute bottom-20 left-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
  <div class="container mx-auto px-4 relative z-10 text-center">
    <span class="inline-block bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-6">✨ {شارة مميزة}</span>
    <h1 class="text-5xl md:text-7xl font-black mb-6 leading-tight">{عنوان} <span class="text-primary">{كلمة مميزة}</span></h1>
    <p class="text-xl text-gray-600 max-w-2xl mx-auto mb-10">{وصف مقنع}</p>
    <div class="flex gap-4 justify-center flex-wrap">
      <a href="#" class="bg-primary text-white px-8 py-4 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-1">{CTA رئيسي}</a>
      <a href="#" class="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-full font-bold text-lg hover:border-primary hover:text-primary transition-all">اعرف المزيد</a>
    </div>
  </div>
</section>`,
    },

    // ── Cards ──
    'cards-hover': {
        name: 'Cards مع Hover Effect',
        tags: ['cards', 'services', 'all'],
        html: `<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
  <div class="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
    <div class="relative">
      <div class="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all">
        <i class="fas fa-{icon} text-primary group-hover:text-white text-xl" aria-hidden="true"></i>
      </div>
      <h3 class="text-xl font-bold mb-3 text-gray-900">{عنوان}</h3>
      <p class="text-gray-600 leading-relaxed">{وصف}</p>
      <div class="mt-6 flex items-center gap-2 text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
        <span>اعرف المزيد</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </div>
    </div>
  </div>
</div>`,
    },

    // ── Pricing ──
    'pricing-modern': {
        name: 'Pricing Cards عصرية',
        tags: ['pricing', 'saas', 'gym', 'education'],
        html: `<div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
  <div class="bg-white rounded-2xl p-8 border border-gray-200 hover:border-primary/30 transition-all">
    <h3 class="text-lg font-bold mb-2">الأساسية</h3>
    <div class="flex items-baseline gap-1 my-4">
      <span class="text-4xl font-black">{السعر}</span>
      <span class="text-gray-500">/شهر</span>
    </div>
    <ul class="space-y-3 mb-8">
      <li class="flex items-center gap-3 text-gray-600"><svg class="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>{ميزة 1}</li>
    </ul>
    <button class="w-full py-3 border-2 border-primary text-primary rounded-xl font-bold hover:bg-primary hover:text-white transition-all">ابدأ الآن</button>
  </div>
  <div class="bg-primary rounded-2xl p-8 text-white relative overflow-hidden shadow-xl shadow-primary/25">
    <div class="absolute top-4 left-1/2 -translate-x-1/2 bg-white/20 text-white text-xs px-3 py-1 rounded-full">الأكثر شعبية</div>
    <h3 class="text-lg font-bold mb-2 mt-4">المميزة</h3>
    <div class="flex items-baseline gap-1 my-4">
      <span class="text-4xl font-black">{السعر}</span>
      <span class="text-white/75">/شهر</span>
    </div>
    <button class="w-full py-3 bg-white text-primary rounded-xl font-bold mt-4">ابدأ الآن</button>
  </div>
</div>`,
    },

    // ── Stats ──
    'stats-animated': {
        name: 'Stats مع Counter Animation',
        tags: ['stats', 'all'],
        html: `<section class="py-20 bg-gradient-to-r from-primary to-secondary">
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
      <div class="group">
        <div class="text-5xl font-black mb-2 counter" data-target="{رقم}">{رقم}+</div>
        <div class="text-white/80 font-medium">{تسمية}</div>
      </div>
    </div>
  </div>
</section>`,
    },

    // ── Testimonials ──
    'testimonials-cards': {
        name: 'Testimonials Cards',
        tags: ['testimonials', 'all'],
        html: `<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div class="flex gap-1 mb-4">
      {{'★★★★★'.split('').map(() => '<span class="text-yellow-400">★</span>').join('')}}
    </div>
    <p class="text-gray-600 leading-relaxed mb-6 italic">"{رأي العميل}"</p>
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">{الحرف الأول}</div>
      <div>
        <div class="font-bold text-gray-900 text-sm">{اسم العميل}</div>
        <div class="text-gray-500 text-xs">{المسمى}</div>
      </div>
    </div>
  </div>
</div>`,
    },

    // ── Contact Form ──
    'contact-modern': {
        name: 'Contact Form عصري',
        tags: ['contact', 'all'],
        html: `<div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
  <div>
    <h2 class="text-4xl font-black mb-6">{عنوان}</h2>
    <p class="text-gray-600 leading-relaxed mb-8">{وصف}</p>
    <div class="space-y-4">
      <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <div class="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <i class="fas fa-phone text-primary" aria-hidden="true"></i>
        </div>
        <div><div class="text-sm text-gray-500">الهاتف</div><div class="font-semibold">{رقم}</div></div>
      </div>
    </div>
  </div>
  <form class="bg-white rounded-2xl p-8 shadow-xl" onsubmit="handleContact(event)">
    <div class="space-y-4">
      <input type="text" placeholder="الاسم الكامل" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary transition-colors">
      <input type="email" placeholder="البريد الإلكتروني" required class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary transition-colors">
      <textarea rows="4" placeholder="رسالتك..." class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-primary transition-colors resize-none"></textarea>
      <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-colors">إرسال الرسالة ✉️</button>
    </div>
  </form>
</div>`,
    },

    // ── Footer ──
    'footer-modern': {
        name: 'Footer عصري',
        tags: ['footer', 'all'],
        html: `<footer class="bg-gray-900 text-gray-300">
  <div class="container mx-auto px-4 py-16">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
      <div class="md:col-span-2">
        <h3 class="text-white text-2xl font-black mb-4">{اسم}</h3>
        <p class="text-gray-400 leading-relaxed mb-6 max-w-sm">{وصف}</p>
        <div class="flex gap-3">
          <a href="#" class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-primary transition-colors"><i class="fab fa-twitter" aria-hidden="true"></i></a>
          <a href="#" class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-primary transition-colors"><i class="fab fa-linkedin-in" aria-hidden="true"></i></a>
          <a href="#" class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center hover:bg-primary transition-colors"><i class="fab fa-instagram" aria-hidden="true"></i></a>
        </div>
      </div>
      <div>
        <h4 class="text-white font-bold mb-4">روابط سريعة</h4>
        <ul class="space-y-2">
          <li><a href="#" class="hover:text-white hover:pr-1 transition-all">الرئيسية</a></li>
          <li><a href="#" class="hover:text-white hover:pr-1 transition-all">الخدمات</a></li>
          <li><a href="#" class="hover:text-white hover:pr-1 transition-all">من نحن</a></li>
        </ul>
      </div>
      <div>
        <h4 class="text-white font-bold mb-4">تواصل معنا</h4>
        <ul class="space-y-3 text-sm">
          <li class="flex items-center gap-2"><i class="fas fa-phone text-primary" aria-hidden="true"></i>{الهاتف}</li>
          <li class="flex items-center gap-2"><i class="fas fa-envelope text-primary" aria-hidden="true"></i>{البريد}</li>
        </ul>
      </div>
    </div>
    <div class="border-t border-white/10 mt-12 pt-6 text-center text-sm text-gray-500">
      © 2025 {اسم}. جميع الحقوق محفوظة.
    </div>
  </div>
</footer>`,
    },
};

// ═══════════════════════════════════════════════════════
// 🔍 البحث في المكتبة
// ═══════════════════════════════════════════════════════
export function searchComponents(query, projectType) {
    const results = [];

    for (const [id, component] of Object.entries(MARKETPLACE_COMPONENTS)) {
        const matchesQuery = !query || component.name.toLowerCase().includes(query.toLowerCase());
        const matchesType = !projectType || component.tags.includes(projectType) || component.tags.includes('all');

        if (matchesQuery && matchesType) {
            results.push({ id, ...component });
        }
    }

    return results;
}

// ═══════════════════════════════════════════════════════
// 📝 توليد context للـ Coder
// ═══════════════════════════════════════════════════════
export function buildMarketplaceContext(projectType) {
    const components = searchComponents('', projectType);
    if (components.length === 0) return '';

    const componentList = components
        .map(c => `- **${c.id}**: ${c.name}`)
        .join('\n');

    return `\n## Component Marketplace:\nاستخدم هذه الـ components كمرجع:\n${componentList}\n`;
}
