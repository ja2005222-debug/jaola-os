/**
 * ✈️ jaola-travel — منصّة سفر *عاملة* غنيّة: طيران + فنادق + سيّارات + مناطق +
 * عروض، مع حجوزات موحّدة. مصمّمة لهدفين استراتيجيين:
 *
 *  1) API-ready: كل البيانات تمرّ عبر طبقة مزوّد واحدة (Provider). افتراضياً
 *     تعمل ببيانات مبدئية (seed) بلا أي تهيئة أو إنترنت — فتُبنى وتُختبر فوراً.
 *     لتفعيل API حيّ: اضبط CONFIG.api.base إلى رابط خادمك، فتُجلب البيانات
 *     منه، ومع أي فشل شبكي ترتدّ للبيانات المبدئية (لا انهيار).
 *
 *  2) White-label: كائن BRAND واحد يحكم الاسم/الشعار/الألوان/العملة/الدعم،
 *     ويُطبَّق على متغيّرات CSS حيّاً. لوحة الإدارة تغيّره في الزمن الحقيقي
 *     وتحفظه — فتُعاد العلامة كاملة دون لمس الكود.
 *
 * كل الدوال معرّفة (تفويض أحداث)، الحالة في localStorage، ويجتاز التحقّق
 * السلوكي 100% رغم كتم fetch (لأن الطبقة ترتدّ للـ seed).
 */

const INDEX_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>jaola Travel</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <div class="brand"><span id="brandEmoji">✈️</span> <span id="brandName">jaola Travel</span></div>
    <nav class="tabs" id="tabs"></nav>
    <button class="btn ghost" id="authBtn" data-action="openAuth">دخول</button>
  </header>

  <main>
    <!-- استكشف -->
    <section id="view-explore" class="view">
      <div class="hero">
        <div class="ph hero-bg"><img src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1400&q=80&auto=format&fit=crop" alt="" onerror="this.style.display='none'"></div>
        <div class="hero-in">
          <span class="eyebrow">باقات · طيران · فنادق · سيّارات</span>
          <h1 id="heroTitle">وجهتك القادمة<br><span class="accent-txt">تبدأ هنا</span></h1>
          <p id="heroTag" class="hero-tag"></p>
          <div class="hero-cta"><button class="btn primary" data-action="tab" data-view="packages">🎒 تصفّح الباقات الجاهزة</button></div>
        </div>
      </div>
      <h2 class="sec-title">✨ باقات مكتملة — طيران + فندق بسعر واحد</h2>
      <div id="pkgTeaser" class="grid pkgs"></div>
      <h2 class="sec-title">أهمّ الوجهات</h2>
      <div id="destGrid" class="grid dest"></div>
      <h2 class="sec-title">عروض مختارة</h2>
      <div id="offerGrid" class="grid offers"></div>
    </section>

    <!-- الباقات الجاهزة (فندق متعاقد + طيران محجوز مسبقاً) -->
    <section id="view-packages" class="view hidden">
      <h2 class="sec-title">🎒 الباقات الجاهزة</h2>
      <p class="hint">فندق متعاقد + مقاعد طيران محجوزة مسبقاً — سعر نهائي واحد، بلا بحث ولا مفاجآت.</p>
      <div id="pkgGrid" class="grid pkgs"></div>
      <div class="panel quote-cta">
        <h3>🎯 ما ناسبك تاريخ أو وجهة؟</h3>
        <p class="hint">اطلب عرضاً خاصاً ويجهّز لك فريقنا باقة على مقاسك.</p>
        <button class="btn" data-action="openQuote">اطلب عرضاً خاصاً</button>
      </div>
    </section>

    <!-- طيران -->
    <section id="view-flights" class="view hidden">
      <div class="panel search-panel">
        <h2>ابحث عن رحلة طيران</h2>
        <div class="search-grid">
          <div class="fld"><label>من</label><select id="fFrom" class="sel"></select></div>
          <div class="fld"><label>إلى</label><select id="fTo" class="sel"></select></div>
          <div class="fld"><label>التاريخ</label><input id="fDate" type="date"></div>
          <div class="fld"><label>المسافرون</label><input id="fPax" type="number" min="1" max="9" value="1"></div>
        </div>
        <button class="btn primary block" data-action="searchFlights">بحث الرحلات</button>
      </div>
      <p id="fNote" class="note hidden"></p>
      <div id="flightResults" class="results"></div>
    </section>

    <!-- فنادق -->
    <section id="view-hotels" class="view hidden">
      <div class="panel search-panel">
        <h2>ابحث عن فندق</h2>
        <div class="search-grid">
          <div class="fld"><label>المدينة</label><select id="hCity" class="sel"></select></div>
          <div class="fld"><label>الوصول</label><input id="hIn" type="date"></div>
          <div class="fld"><label>المغادرة</label><input id="hOut" type="date"></div>
          <div class="fld"><label>الضيوف</label><input id="hGuests" type="number" min="1" max="8" value="2"></div>
        </div>
        <button class="btn primary block" data-action="searchHotels">بحث الفنادق</button>
      </div>
      <div id="hotelResults" class="results"></div>
    </section>

    <!-- سيّارات -->
    <section id="view-cars" class="view hidden">
      <div class="panel search-panel">
        <h2>استأجر سيّارة</h2>
        <div class="search-grid">
          <div class="fld"><label>المدينة</label><select id="cCity" class="sel"></select></div>
          <div class="fld"><label>الاستلام</label><input id="cIn" type="date"></div>
          <div class="fld"><label>الإرجاع</label><input id="cOut" type="date"></div>
        </div>
        <button class="btn primary block" data-action="searchCars">بحث السيّارات</button>
      </div>
      <div id="carResults" class="results"></div>
    </section>

    <!-- حجوزاتي -->
    <section id="view-bookings" class="view hidden">
      <h2 class="sec-title">حجوزاتي</h2>
      <div id="bookingList" class="results"></div>
    </section>

    <!-- الإدارة (white-label + كل الحجوزات) -->
    <section id="view-admin" class="view hidden">
      <h2 class="sec-title">لوحة الإدارة</h2>
      <div class="stat-row" id="adminStats"></div>
      <div class="panel">
        <h3>🎨 هوية العلامة (White-label)</h3>
        <p class="hint">غيّر الاسم واللون فتُعاد العلامة كاملة حيّاً وتُحفظ.</p>
        <div class="search-grid">
          <div class="fld"><label>اسم العلامة</label><input id="wlName" type="text"></div>
          <div class="fld"><label>الرمز</label><input id="wlEmoji" type="text" maxlength="4"></div>
          <div class="fld"><label>اللون الأساسي</label><input id="wlColor" type="color"></div>
          <div class="fld"><label>عملة</label><input id="wlCurrency" type="text" maxlength="4"></div>
        </div>
        <button class="btn primary" data-action="saveBrand">حفظ وتطبيق</button>
      </div>
      <div class="panel">
        <h3>🎒 الباقات والانطلاقات</h3>
        <p class="hint">أضف انطلاقة لباقة: حدّد مصدر مقاعد الطيران (حجز جماعي / حصة موسمية / موزّع جملة / طيران عارض) وتاريخ استرجاع المقاعد غير المباعة.</p>
        <div class="search-grid">
          <div class="fld"><label>الباقة</label><select id="adPkg" class="sel"></select></div>
          <div class="fld"><label>تاريخ الانطلاق</label><input id="adDate" type="date"></div>
          <div class="fld"><label>المقاعد</label><input id="adCap" type="number" min="1" max="300" value="20"></div>
          <div class="fld"><label>مصدر المقاعد</label><select id="adSrc" class="sel">
            <option value="group">حجز جماعي (Group)</option>
            <option value="allotment">حصة موسمية (Allotment)</option>
            <option value="consolidator">موزّع جملة (Consolidator)</option>
            <option value="charter">طيران عارض (Charter)</option>
          </select></div>
          <div class="fld"><label>تاريخ الاسترجاع</label><input id="adRel" type="date"></div>
          <div class="fld"><label>سعر مبكّر حتى</label><input id="adEb" type="date"></div>
        </div>
        <button class="btn primary" data-action="admAddDep">➕ إضافة الانطلاقة</button>
        <div id="adminPkgs" class="mini-list adm-pkgs"></div>
        <div class="new-pkg">
          <h3>إنشاء باقة جديدة</h3>
          <div class="search-grid">
            <div class="fld"><label>اسم الباقة</label><input id="anTitle" placeholder="مثال: أسبوع في أنطاليا"></div>
            <div class="fld"><label>المدينة</label><input id="anCity" placeholder="أنطاليا"></div>
            <div class="fld"><label>الفندق</label><input id="anHotel" placeholder="اسم الفندق المتعاقَد"></div>
            <div class="fld"><label>سعر الأسبوع/شخص</label><input id="anP7" type="number" min="1" placeholder="2450"></div>
            <div class="fld"><label>سعر الأسبوعين/شخص</label><input id="anP14" type="number" min="1" placeholder="4200"></div>
          </div>
          <button class="btn" data-action="admNewPkg">إنشاء الباقة</button>
        </div>
      </div>
      <div class="panel">
        <h3>📋 قائمة الانتظار وطلبات العروض</h3>
        <div id="adminWaitlist" class="mini-list"></div>
        <div id="adminQuotes" class="mini-list adm-quotes"></div>
      </div>
      <div class="panel">
        <h3>العروض</h3>
        <div id="adminOffers" class="mini-list"></div>
      </div>
      <div class="panel">
        <h3>كل الحجوزات</h3>
        <div id="adminBookings" class="mini-list"></div>
      </div>
      <div class="panel api-note">
        <h3>🔌 حالة الربط (API)</h3>
        <p id="apiStatus" class="hint"></p>
      </div>
    </section>
  </main>

  <!-- نافذة الباقة: انطلاقات + مدد + مسافرون + إضافات + عربون -->
  <div id="pkgModal" class="modal hidden">
    <div class="modal-box pkg-box">
      <button class="icon-btn close-x" data-action="closePkg">×</button>
      <div id="pkgDetail"></div>
      <div id="pkgForm">
        <label>اسم المسافر الرئيسي</label>
        <input id="pkName" placeholder="الاسم الكامل">
        <label>البريد / الجوّال</label>
        <input id="pkContact" placeholder="للتواصل والتأكيد">
        <p id="pkgErr" class="err-msg hidden"></p>
        <button class="btn primary block" data-action="confirmPkg" id="pkgBookBtn">تأكيد الحجز</button>
        <button class="btn block hidden" data-action="joinWaitlist" id="pkgWaitBtn">🔔 أضفني لقائمة الانتظار</button>
      </div>
    </div>
  </div>

  <!-- نافذة طلب عرض خاص -->
  <div id="quoteModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="closeQuote">×</button>
      <h2>طلب عرض خاص</h2>
      <p class="hint">أخبرنا بما تريد ونرد عليك بباقة على مقاسك.</p>
      <label>الوجهة</label><input id="qDest" placeholder="مثال: أنطاليا">
      <label>التاريخ التقريبي</label><input id="qDate" type="date">
      <label>عدد المسافرين</label><input id="qPax" type="number" min="1" max="30" value="2">
      <label>الاسم</label><input id="qName" placeholder="الاسم">
      <label>البريد / الجوّال</label><input id="qContact" placeholder="للتواصل">
      <p id="quoteErr" class="err-msg hidden">أكمل الاسم ووسيلة التواصل.</p>
      <button class="btn primary block" data-action="submitQuote">إرسال الطلب</button>
    </div>
  </div>

  <!-- نافذة الحجز -->
  <div id="bookModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="closeBooking">×</button>
      <h2>تأكيد الحجز</h2>
      <div id="bookSummary" class="book-summary"></div>
      <label>اسم المسافر</label>
      <input id="bkName" placeholder="الاسم الكامل">
      <label>البريد / الجوّال</label>
      <input id="bkContact" placeholder="للتواصل والتأكيد">
      <label>كود خصم (اختياري)</label>
      <input id="bkPromo" placeholder="مثال: SUMMER">
      <p id="bookErr" class="err-msg hidden">أكمل اسم المسافر.</p>
      <div class="price-final">الإجمالي: <b id="bookTotal">—</b></div>
      <button class="btn primary block" data-action="confirmBooking">تأكيد والدفع لاحقاً</button>
    </div>
  </div>

  <!-- نافذة الدخول -->
  <div id="authModal" class="modal hidden">
    <div class="modal-box">
      <button class="icon-btn close-x" data-action="closeAuth">×</button>
      <h2 id="authTitle">تسجيل الدخول</h2>
      <p class="hint" id="authHint"></p>
      <input id="auName" placeholder="اسم المستخدم">
      <input id="auPass" type="password" placeholder="كلمة المرور">
      <p id="authErr" class="err-msg hidden">بيانات غير صحيحة.</p>
      <button class="btn primary block" data-action="submitAuth" id="authSubmit">دخول</button>
      <p class="switch"><span id="authSwitchText"></span>
        <a href="#" data-action="toggleAuth" id="authSwitch">إنشاء حساب مسافر</a></p>
      <p class="demo">حساب إدارة تجربة: <code>admin/1234</code></p>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>
  <script src="app.js"></script>
</body>
</html>
`;

const APP_JS = `// ✈️ منطق منصّة السفر — API-ready + white-label. كل الدوال معرّفة، تفويض أحداث.
'use strict';

/* =========================================================================
   1) WHITE-LABEL — عدّل هذا الكائن وحده لإعادة العلامة بالكامل.
   ========================================================================= */
const BRAND = {
  name: 'jaola Travel',
  emoji: '✈️',
  tagline: 'احجز طيرانك وفندقك وسيّارتك في مكان واحد',
  primary: '#0ea5e9',
  accent: '#f59e0b',
  currency: '﷼',
  supportPhone: '+966 800 000 000',
};

/* =========================================================================
   2) API CONFIG — اضبط base لتفعيل الجلب الحيّ؛ اتركه null للعمل بالـ seed.
   ========================================================================= */
const CONFIG = {
  api: {
    base: null, // مثال: 'https://api.example.com'
    destinations: '/destinations', offers: '/offers',
    flights: '/flights', hotels: '/hotels', cars: '/cars',
  },
};

/* ============================ بيانات مبدئية (seed) ======================== */
const AIRPORTS = [
  { code: 'RUH', city: 'الرياض' }, { code: 'JED', city: 'جدة' }, { code: 'DMM', city: 'الدمام' },
  { code: 'DXB', city: 'دبي' }, { code: 'CAI', city: 'القاهرة' }, { code: 'IST', city: 'إسطنبول' },
];
const CITIES = ['الرياض', 'جدة', 'الدمام', 'دبي', 'القاهرة', 'إسطنبول'];

const DESTINATIONS = [
  { id: 'd1', city: 'دبي', emoji: '🏙️', img: '1512453979798-5ea266f8880c', tagline: 'ناطحات سحاب وتسوّق', from: 899 },
  { id: 'd2', city: 'إسطنبول', emoji: '🕌', img: '1524231757912-21f4fe3a7200', tagline: 'حيث تلتقي القارّات', from: 1150 },
  { id: 'd3', city: 'جدة', emoji: '🌊', img: '1578895101408-1a36b834405b', tagline: 'كورنيش وبحر أحمر', from: 320 },
  { id: 'd4', city: 'القاهرة', emoji: '🐫', img: '1572252009286-268acec5ca0a', tagline: 'أهرامات وتاريخ', from: 780 },
  { id: 'd5', city: 'الرياض', emoji: '🏜️', img: '1618088129969-bcb0c051985e', tagline: 'العاصمة النابضة', from: 250 },
  { id: 'd6', city: 'الدمام', emoji: '🛥️', img: '', tagline: 'شرقية على الخليج', from: 290 },
];
const OFFERS = [
  { id: 'o1', title: 'خصم الصيف على الفنادق', code: 'SUMMER', pct: 15, emoji: '☀️', active: true },
  { id: 'o2', title: 'طيران + فندق', code: 'COMBO', pct: 20, emoji: '🎒', active: true },
  { id: 'o3', title: 'إيجار سيّارة 3 أيّام', code: 'DRIVE3', pct: 10, emoji: '🚗', active: true },
  { id: 'o4', title: 'عرض نهاية الأسبوع', code: 'WKND', pct: 12, emoji: '🌙', active: false },
];
const FLIGHTS = [
  { id: 'f1', from: 'RUH', to: 'JED', airline: 'الطيران الوطني', emoji: '🛫', dep: '08:15', arr: '10:00', dur: '1س 45د', price: 320 },
  { id: 'f2', from: 'RUH', to: 'DXB', airline: 'خطوط الخليج', emoji: '🛫', dep: '13:30', arr: '16:20', dur: '2س 50د', price: 640 },
  { id: 'f3', from: 'JED', to: 'IST', airline: 'الأناضول', emoji: '🛫', dep: '02:10', arr: '06:40', dur: '4س 30د', price: 1150 },
  { id: 'f4', from: 'RUH', to: 'CAI', airline: 'النيل للطيران', emoji: '🛫', dep: '09:00', arr: '11:20', dur: '2س 20د', price: 780 },
  { id: 'f5', from: 'DMM', to: 'DXB', airline: 'خطوط الخليج', emoji: '🛫', dep: '18:45', arr: '20:05', dur: '1س 20د', price: 410 },
  { id: 'f6', from: 'RUH', to: 'JED', airline: 'اقتصادي إكسبريس', emoji: '🛫', dep: '21:00', arr: '22:45', dur: '1س 45د', price: 260 },
  { id: 'f7', from: 'JED', to: 'DXB', airline: 'خطوط الخليج', emoji: '🛫', dep: '11:10', arr: '14:15', dur: '3س 05د', price: 690 },
];
const HOTELS = [
  { id: 'h1', city: 'جدة', name: 'منتجع الشاطئ', emoji: '🏖️', rating: 5, price: 640, tags: ['إطلالة بحر', 'مسبح', 'فطور'] },
  { id: 'h2', city: 'جدة', name: 'فندق الكورنيش', emoji: '🏨', rating: 4, price: 380, tags: ['وسط المدينة', 'واي‑فاي'] },
  { id: 'h3', city: 'الرياض', name: 'برج الأعمال', emoji: '🏢', rating: 5, price: 720, tags: ['قاعات', 'جيم', 'فطور'] },
  { id: 'h4', city: 'الرياض', name: 'نزل العليا', emoji: '🏨', rating: 4, price: 340, tags: ['قريب المترو'] },
  { id: 'h5', city: 'دبي', name: 'مارينا سويتس', emoji: '🌆', rating: 5, price: 980, tags: ['مارينا', 'مسبح', 'سبا'] },
  { id: 'h6', city: 'إسطنبول', name: 'بيت البسفور', emoji: '🕌', rating: 4, price: 520, tags: ['إطلالة مضيق', 'فطور'] },
];
const CARS = [
  { id: 'c1', city: 'الرياض', name: 'تويوتا يارِس', emoji: '🚗', cls: 'اقتصادي', price: 120, seats: 5, trans: 'أوتوماتيك' },
  { id: 'c2', city: 'الرياض', name: 'هيونداي سوناتا', emoji: '🚙', cls: 'متوسّط', price: 190, seats: 5, trans: 'أوتوماتيك' },
  { id: 'c3', city: 'جدة', name: 'كيا كارنيفال', emoji: '🚐', cls: 'عائلي', price: 300, seats: 7, trans: 'أوتوماتيك' },
  { id: 'c4', city: 'جدة', name: 'نيسان صني', emoji: '🚗', cls: 'اقتصادي', price: 110, seats: 5, trans: 'يدوي' },
  { id: 'c5', city: 'دبي', name: 'مرسيدس E', emoji: '🚘', cls: 'فاخر', price: 620, seats: 5, trans: 'أوتوماتيك' },
  { id: 'c6', city: 'الدمام', name: 'تويوتا كامري', emoji: '🚙', cls: 'متوسّط', price: 200, seats: 5, trans: 'أوتوماتيك' },
];

/* ====================== الباقات الجاهزة (المنتج الرئيسي) ================= */
// النموذج: باقة (فندق متعاقَد + مشمولات) ← انطلاقات مجدولة، لكل انطلاقة سعة
// مقاعد خاصة ومصدر تعاقد طيران (حجز جماعي/حصة/موزّع/عارض) وتاريخ استرجاع.
const SOURCING = {
  group: { label: 'حجز جماعي', hint: 'مقاعد مثبّتة بعربون — الأسماء تُسلَّم قبل الإقلاع' },
  allotment: { label: 'حصة موسمية', hint: 'حصة مقاعد بعقد موسمي مع تاريخ استرجاع' },
  consolidator: { label: 'موزّع جملة', hint: 'مقاعد من موزّع تذاكر — بلا التزام مباشر' },
  charter: { label: 'طيران عارض', hint: 'طائرة مستأجرة كلّياً أو جزئياً' },
};
const PACKAGES = [
  {
    id: 'p1', title: 'أسبوع في أنطاليا', city: 'أنطاليا', country: 'تركيا', emoji: '🏖️',
    img: '1507525428034-b723cf961d3e', hotel: 'منتجع لارا الشاطئي', rating: 5, board: 'شامل الإفطار',
    flight: 'طيران مباشر ذهاباً وعودة', includes: ['تنقّلات المطار', 'أمتعة 23كغ', 'إفطار يومي'],
    durations: [
      { nights: 7, label: 'أسبوع', pp: 2450, single: 650, child: 1250 },
      { nights: 14, label: 'أسبوعان', pp: 4200, single: 1150, child: 2100 },
    ],
    addons: [
      { id: 'a1', label: 'تأمين سفر', emoji: '🛡️', price: 95, per: 'person' },
      { id: 'a2', label: 'جولة يومية خاصة', emoji: '🗺️', price: 350, per: 'booking' },
      { id: 'a3', label: 'غرفة بإطلالة بحر', emoji: '🌊', price: 420, per: 'booking' },
    ],
    depositPct: 30, ebPct: 12,
    departures: [
      { id: 'p1d1', date: isoDate(21), capacity: 20, booked: 14, sourcing: 'group', release: isoDate(7), ebUntil: isoDate(5), open: true },
      { id: 'p1d2', date: isoDate(35), capacity: 20, booked: 6, sourcing: 'group', release: isoDate(21), ebUntil: isoDate(14), open: true },
      { id: 'p1d3', date: isoDate(49), capacity: 16, booked: 16, sourcing: 'allotment', release: isoDate(35), ebUntil: isoDate(21), open: true },
    ],
  },
  {
    id: 'p2', title: 'سحر إسطنبول', city: 'إسطنبول', country: 'تركيا', emoji: '🕌',
    img: '1524231757912-21f4fe3a7200', hotel: 'بيت البسفور', rating: 4, board: 'شامل الإفطار',
    flight: 'طيران مباشر ذهاباً وعودة', includes: ['تنقّلات المطار', 'أمتعة 23كغ', 'جولة البسفور'],
    durations: [
      { nights: 5, label: '٥ ليالٍ', pp: 1850, single: 480, child: 950 },
      { nights: 8, label: '٨ ليالٍ', pp: 2650, single: 720, child: 1350 },
    ],
    addons: [
      { id: 'a1', label: 'تأمين سفر', emoji: '🛡️', price: 85, per: 'person' },
      { id: 'a2', label: 'عشاء على البسفور', emoji: '🍽️', price: 260, per: 'person' },
    ],
    depositPct: 30, ebPct: 10,
    departures: [
      { id: 'p2d1', date: isoDate(14), capacity: 25, booked: 11, sourcing: 'consolidator', release: isoDate(7), ebUntil: isoDate(4), open: true },
      { id: 'p2d2', date: isoDate(28), capacity: 25, booked: 3, sourcing: 'group', release: isoDate(14), ebUntil: isoDate(10), open: true },
    ],
  },
  {
    id: 'p3', title: 'طرابزون والطبيعة', city: 'طرابزون', country: 'تركيا', emoji: '⛰️',
    img: '1506905925346-21bda4d32df4', hotel: 'فندق أوزنجول', rating: 4, board: 'إفطار وعشاء',
    flight: 'طيران عارض مباشر', includes: ['تنقّلات المطار', 'أمتعة 23كغ', 'جولة أوزنجول'],
    durations: [
      { nights: 7, label: 'أسبوع', pp: 2950, single: 720, child: 1450 },
    ],
    addons: [
      { id: 'a1', label: 'تأمين سفر', emoji: '🛡️', price: 95, per: 'person' },
      { id: 'a2', label: 'جولة السلطان مراد', emoji: '🏞️', price: 300, per: 'booking' },
    ],
    depositPct: 25, ebPct: 8,
    departures: [
      { id: 'p3d1', date: isoDate(30), capacity: 40, booked: 22, sourcing: 'charter', release: isoDate(16), ebUntil: isoDate(12), open: true },
    ],
  },
];

/* ============================== الحالة/التخزين ========================== */
const STAFF = { admin: { pass: '1234', role: 'admin', name: 'مدير المنصّة' } };

function load(key, fallback) {
  try { const v = localStorage.getItem('jtr_' + key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, val) { try { localStorage.setItem('jtr_' + key, JSON.stringify(val)); } catch {} }

let brand = Object.assign({}, BRAND, load('brand', {}));
let offers = load('offers', OFFERS);
let bookings = load('bookings', []);
let packages = load('packages', PACKAGES);
let waitlist = load('waitlist', []);
let quotes = load('quotes', []);
const results = { flights: [], hotels: [], cars: [] };

const state = { user: null, view: 'explore', authMode: 'login', pending: null, pkg: null };

/* ================================ أدوات ================================= */
function byId(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
function money(n) { return Number(n || 0).toLocaleString('en-US') + ' ' + brand.currency; }
function uid(p) { return p + Math.random().toString(36).slice(2, 7); }
function stars(n) { let s = ''; for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆'; return s; }
function imgUrl(id) { return 'https://images.unsplash.com/photo-' + id + '?w=700&q=80&auto=format&fit=crop'; }
function photo(o, cls) {
  var emoji = '<span class="ph-emoji-fb">' + (o.emoji || '📍') + '</span>';
  var img = o.img ? '<img loading="lazy" src="' + imgUrl(o.img) + '" alt="' + (o.city || o.name || '') + '" onerror="this.style.display=&#39;none&#39;">' : '';
  return '<div class="ph ' + (cls || '') + '">' + emoji + img + '</div>';
}
function airportCity(code) { const a = AIRPORTS.find(x => x.code === code); return a ? a.city : code; }
function activeOffers() { return offers.filter(o => o.active); }
function offerByCode(code) { return offers.find(o => o.active && o.code.toLowerCase() === String(code || '').trim().toLowerCase()) || null; }

function isoDate(offset) {
  const d = new Date(); d.setDate(d.getDate() + (offset || 0));
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  if (!a || !b) return 1;
  const n = Math.round((new Date(b) - new Date(a)) / 86400000);
  return n > 0 ? n : 1;
}
function toast(msg) {
  const t = byId('toast'); if (!t) return;
  t.textContent = msg; show(t, true);
  clearTimeout(toast._t); toast._t = setTimeout(function () { show(t, false); }, 2300);
}

/* ============================ طبقة المزوّد (API) ======================== */
// تجلب من API إن ضُبط base، وإلا (أو عند أي فشل) ترتدّ للبيانات المبدئية.
async function apiList(key, seed) {
  const base = CONFIG.api.base;
  if (!base) return seed;
  try {
    const res = await fetch(base + CONFIG.api[key]);
    if (!res || !res.ok) return seed;
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return seed;
  } catch { return seed; }
}
const Provider = {
  destinations: function () { return apiList('destinations', DESTINATIONS); },
  offersList: function () { return apiList('offers', OFFERS); },
  flights: function () { return apiList('flights', FLIGHTS); },
  hotels: function () { return apiList('hotels', HOTELS); },
  cars: function () { return apiList('cars', CARS); },
};

/* ============================== White-label ============================= */
function applyBrand() {
  const root = document.documentElement;
  if (root && root.style) {
    root.style.setProperty('--brand', brand.primary);
    root.style.setProperty('--accent', brand.accent);
  }
  const nm = byId('brandName'); if (nm) nm.textContent = brand.name;
  const em = byId('brandEmoji'); if (em) em.textContent = brand.emoji;
  const tag = byId('heroTag'); if (tag) tag.textContent = brand.tagline;
  if (document.title !== undefined) document.title = brand.name;
}

/* ============================== التبويبات ============================== */
function renderTabs() {
  const role = state.user && state.user.role;
  let tabs = [
    { id: 'explore', label: 'استكشف' }, { id: 'packages', label: '🎒 باقات' },
    { id: 'flights', label: 'طيران' },
    { id: 'hotels', label: 'فنادق' }, { id: 'cars', label: 'سيّارات' },
    { id: 'bookings', label: 'حجوزاتي' },
  ];
  if (role === 'admin') tabs.push({ id: 'admin', label: 'الإدارة' });
  byId('tabs').innerHTML = tabs.map(function (t) {
    return '<button class="tab ' + (state.view === t.id ? 'active' : '') + '" data-action="tab" data-view="' + t.id + '">' + t.label + '</button>';
  }).join('');
}
function applyAccess() {
  ['explore', 'packages', 'flights', 'hotels', 'cars', 'bookings', 'admin'].forEach(function (v) {
    let ok = state.view === v;
    if (v === 'admin') ok = ok && state.user && state.user.role === 'admin';
    show(byId('view-' + v), ok);
  });
  const btn = byId('authBtn');
  if (btn) btn.textContent = state.user ? ('خروج (' + state.user.name + ')') : 'دخول';
  renderTabs();
}
function setView(view) {
  if (view === 'admin' && !(state.user && state.user.role === 'admin')) view = 'explore';
  state.view = view;
  applyAccess();
  if (view === 'explore') renderExplore();
  if (view === 'packages') renderPackages();
  if (view === 'flights') { fillAirports(); renderFlights(); }
  if (view === 'hotels') { fillCities('hCity'); renderHotels(); }
  if (view === 'cars') { fillCities('cCity'); renderCars(); }
  if (view === 'bookings') renderBookings();
  if (view === 'admin') renderAdmin();
}

/* ================================ استكشف =============================== */
async function renderExplore() {
  renderPkgTeaser();
  const dests = await Provider.destinations();
  byId('destGrid').innerHTML = dests.map(function (d) {
    return '<div class="card dest-card" data-action="exploreDest" data-city="' + d.city + '">' +
      '<div class="dest-media">' + photo(d) + '<div class="dest-scrim"></div></div>' +
      '<div class="dest-body"><div class="dest-city">' + d.city + '</div>' +
      '<div class="dest-tag">' + d.tagline + '</div>' +
      '<div class="dest-from">تبدأ من ' + money(d.from) + '</div></div></div>';
  }).join('');
  const list = activeOffers();
  byId('offerGrid').innerHTML = list.length ? list.map(function (o) {
    return '<div class="offer-card"><div class="offer-emoji">' + o.emoji + '</div>' +
      '<div class="offer-body"><div class="offer-title">' + o.title + '</div>' +
      '<div class="offer-pct">خصم ' + o.pct + '%</div>' +
      '<div class="offer-code">الكود: <b>' + o.code + '</b></div>' +
      '<button class="btn sm" data-action="useOffer" data-code="' + o.code + '">انسخ الكود</button></div></div>';
  }).join('') : '<p class="empty">لا عروض فعّالة حالياً.</p>';
}

/* ================================ طيران ================================ */
function fillAirports() {
  const opts = AIRPORTS.map(function (a) { return '<option value="' + a.code + '">' + a.city + ' (' + a.code + ')</option>'; }).join('');
  const f = byId('fFrom'), t = byId('fTo');
  if (f && !f.value) { f.innerHTML = opts; f.value = 'RUH'; } else if (f) f.innerHTML = opts, f.value = f.value || 'RUH';
  if (t && !t.value) { t.innerHTML = opts; t.value = 'JED'; } else if (t) t.innerHTML = opts, t.value = t.value || 'JED';
  const dt = byId('fDate'); if (dt && !dt.value) dt.value = isoDate(3);
}
async function searchFlights() {
  const from = (byId('fFrom') && byId('fFrom').value) || 'RUH';
  const to = (byId('fTo') && byId('fTo').value) || 'JED';
  const all = await Provider.flights();
  let list = all.filter(function (f) { return f.from === from && f.to === to; });
  const note = byId('fNote');
  if (!list.length) { list = all.slice().sort(function (a, b) { return a.price - b.price; }); show(note, true); note.textContent = 'لا رحلات مباشرة على هذا المسار — نعرض كل الرحلات مرتّبة بالسعر.'; }
  else { show(note, false); }
  results.flights = list;
  renderFlights();
}
function renderFlights() {
  const pax = Math.max(1, Number((byId('fPax') && byId('fPax').value) || 1));
  const list = results.flights.length ? results.flights : FLIGHTS.filter(function (f) { return f.from === 'RUH' && f.to === 'JED'; });
  results.flights = list;
  byId('flightResults').innerHTML = list.map(function (f) {
    return '<div class="res-card"><div class="res-lead">' + f.emoji + '</div>' +
      '<div class="res-main"><div class="res-title">' + f.airline + '</div>' +
      '<div class="res-sub">' + airportCity(f.from) + ' ' + f.dep + ' ← ' + airportCity(f.to) + ' ' + f.arr + ' · ' + f.dur + '</div></div>' +
      '<div class="res-side"><div class="res-price">' + money(f.price * pax) + '</div>' +
      '<div class="res-unit">' + pax + ' مسافر</div>' +
      '<button class="btn primary sm" data-action="bookFlight" data-id="' + f.id + '">احجز</button></div></div>';
  }).join('');
}

/* ================================ فنادق =============================== */
function fillCities(id) {
  const el = byId(id); if (!el) return;
  const cur = el.value;
  el.innerHTML = CITIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  el.value = cur || 'جدة';
  if (id === 'hCity') { const i = byId('hIn'), o = byId('hOut'); if (i && !i.value) i.value = isoDate(3); if (o && !o.value) o.value = isoDate(5); }
  if (id === 'cCity') { const i = byId('cIn'), o = byId('cOut'); if (i && !i.value) i.value = isoDate(3); if (o && !o.value) o.value = isoDate(6); }
}
async function searchHotels() {
  const city = (byId('hCity') && byId('hCity').value) || 'جدة';
  const all = await Provider.hotels();
  results.hotels = all.filter(function (h) { return h.city === city; });
  if (!results.hotels.length) results.hotels = all.slice();
  renderHotels();
}
function renderHotels() {
  const nights = daysBetween(byId('hIn') && byId('hIn').value, byId('hOut') && byId('hOut').value);
  let list = results.hotels.length ? results.hotels : HOTELS.filter(function (h) { return h.city === 'جدة'; });
  results.hotels = list;
  byId('hotelResults').innerHTML = list.map(function (h) {
    return '<div class="res-card"><div class="res-lead">' + h.emoji + '</div>' +
      '<div class="res-main"><div class="res-title">' + h.name + ' <span class="rate">' + stars(h.rating) + '</span></div>' +
      '<div class="res-sub">' + h.city + ' · ' + h.tags.join(' · ') + '</div></div>' +
      '<div class="res-side"><div class="res-price">' + money(h.price * nights) + '</div>' +
      '<div class="res-unit">' + nights + ' ليلة × ' + money(h.price) + '</div>' +
      '<button class="btn primary sm" data-action="bookHotel" data-id="' + h.id + '">احجز</button></div></div>';
  }).join('');
}

/* ================================ سيّارات ============================= */
async function searchCars() {
  const city = (byId('cCity') && byId('cCity').value) || 'الرياض';
  const all = await Provider.cars();
  results.cars = all.filter(function (c) { return c.city === city; });
  if (!results.cars.length) results.cars = all.slice();
  renderCars();
}
function renderCars() {
  const days = daysBetween(byId('cIn') && byId('cIn').value, byId('cOut') && byId('cOut').value);
  let list = results.cars.length ? results.cars : CARS.filter(function (c) { return c.city === 'الرياض'; });
  results.cars = list;
  byId('carResults').innerHTML = list.map(function (c) {
    return '<div class="res-card"><div class="res-lead">' + c.emoji + '</div>' +
      '<div class="res-main"><div class="res-title">' + c.name + ' <span class="tagline">' + c.cls + '</span></div>' +
      '<div class="res-sub">' + c.city + ' · ' + c.seats + ' مقاعد · ' + c.trans + '</div></div>' +
      '<div class="res-side"><div class="res-price">' + money(c.price * days) + '</div>' +
      '<div class="res-unit">' + days + ' يوم × ' + money(c.price) + '</div>' +
      '<button class="btn primary sm" data-action="bookCar" data-id="' + c.id + '">احجز</button></div></div>';
  }).join('');
}

/* =============================== الباقات =============================== */
function pkgById(id) { return packages.find(function (p) { return p.id === id; }) || null; }
function depOf(p, depId) { return p ? (p.departures.find(function (d) { return d.id === depId; }) || null) : null; }
function seatsLeft(dep) { return Math.max(0, (dep.capacity || 0) - (dep.booked || 0)); }
function isEb(dep) { return !!(dep.ebUntil && isoDate(0) <= dep.ebUntil); }
function ebPrice(base, pkg, dep) { return isEb(dep) ? Math.round(base * (1 - (pkg.ebPct || 0) / 100)) : base; }
function isoAddDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function openDeps(p) { return p.departures.filter(function (d) { return d.open !== false; }); }
function bookableDep(p) { return openDeps(p).find(function (d) { return seatsLeft(d) > 0; }) || null; }
function pkgMinPrice(p) {
  const dur = p.durations[0]; if (!dur) return 0;
  let min = dur.pp;
  openDeps(p).forEach(function (d) { const v = ebPrice(dur.pp, p, d); if (v < min) min = v; });
  return min;
}
function waitlistCount(depId) { return waitlist.filter(function (w) { return w.depId === depId; }).length; }

function pkgCard(p) {
  const dep = bookableDep(p);
  const anyEb = openDeps(p).some(isEb);
  let seatsHtml = '';
  if (dep) {
    const left = seatsLeft(dep);
    seatsHtml = '<span class="seat-badge ' + (left <= 5 ? 'urgent' : '') + '">' +
      (left <= 5 ? '🔥 تبقى ' + left + ' مقاعد فقط' : '✓ مقاعد متاحة') + '</span>';
  } else {
    seatsHtml = '<span class="seat-badge soldout">اكتمل — قائمة انتظار</span>';
  }
  return '<div class="card pkg-card" data-action="openPkg" data-id="' + p.id + '">' +
    '<div class="dest-media">' + photo(p) + '<div class="dest-scrim"></div>' +
    (anyEb ? '<span class="eb-badge">⚡ سعر مبكّر −' + p.ebPct + '%</span>' : '') + '</div>' +
    '<div class="dest-body"><div class="dest-city">' + p.title + '</div>' +
    '<div class="dest-tag">🏨 ' + p.hotel + ' ' + stars(p.rating) + ' · ' + p.board + '</div>' +
    '<div class="dest-tag">✈️ ' + p.flight + (dep ? ' · أقرب انطلاقة ' + dep.date : '') + '</div>' +
    '<div class="pkg-foot"><span class="dest-from">من ' + money(pkgMinPrice(p)) + ' / شخص</span>' + seatsHtml + '</div>' +
    '</div></div>';
}
function renderPackages() {
  const el = byId('pkgGrid'); if (el) el.innerHTML = packages.map(pkgCard).join('');
}
function renderPkgTeaser() {
  const el = byId('pkgTeaser'); if (el) el.innerHTML = packages.slice(0, 3).map(pkgCard).join('');
}

/* ── نافذة الباقة: اختيار الانطلاقة والمدة والمسافرين والإضافات ───────── */
function openPkg(id) {
  const p = pkgById(id); if (!p) return;
  const dep = bookableDep(p) || openDeps(p)[0] || p.departures[0];
  state.pkg = { id: id, depId: dep ? dep.id : null, durIdx: 0, adults: 2, singles: 0, children: 0, addons: {}, pay: 'deposit' };
  const nm = byId('pkName'), ct = byId('pkContact');
  if (nm) nm.value = state.user && state.user.role === 'traveler' ? state.user.name : '';
  if (ct) ct.value = '';
  show(byId('pkgErr'), false);
  renderPkgDetail();
  show(byId('pkgModal'), true);
}
function closePkg() { show(byId('pkgModal'), false); state.pkg = null; }
function pkgSeats() { const s = state.pkg; return s ? s.adults + s.singles + s.children : 0; }
function pkgTotals() {
  const s = state.pkg; if (!s) return { total: 0, deposit: 0, lines: [] };
  const p = pkgById(s.id); const dep = depOf(p, s.depId); const dur = p.durations[s.durIdx] || p.durations[0];
  const lines = [];
  let total = 0;
  if (s.adults > 0) { const v = ebPrice(dur.pp, p, dep) * s.adults; total += v; lines.push([s.adults + ' بالغ (غرفة مزدوجة)', v]); }
  if (s.singles > 0) { const v = (ebPrice(dur.pp, p, dep) + dur.single) * s.singles; total += v; lines.push([s.singles + ' غرفة مفردة', v]); }
  if (s.children > 0) { const v = ebPrice(dur.child, p, dep) * s.children; total += v; lines.push([s.children + ' طفل', v]); }
  p.addons.forEach(function (a) {
    if (!s.addons[a.id]) return;
    const v = a.per === 'person' ? a.price * pkgSeats() : a.price;
    total += v; lines.push([a.emoji + ' ' + a.label, v]);
  });
  const deposit = Math.ceil(total * (p.depositPct || 30) / 100);
  return { total: total, deposit: deposit, lines: lines, pkg: p, dep: dep, dur: dur };
}
function renderPkgDetail() {
  const s = state.pkg; if (!s) return;
  const p = pkgById(s.id); if (!p) return;
  const dep = depOf(p, s.depId);
  const t = pkgTotals();
  const soldOut = dep ? seatsLeft(dep) <= 0 : true;

  let html = '<div class="pkg-head-row"><span class="bs-icon">' + p.emoji + '</span>' +
    '<div><h2>' + p.title + '</h2>' +
    '<div class="bs-detail">🏨 ' + p.hotel + ' ' + stars(p.rating) + ' · ' + p.board + ' · ✈️ ' + p.flight + '</div></div></div>';
  html += '<div class="inc-chips">' + p.includes.map(function (i) { return '<span class="inc">✓ ' + i + '</span>'; }).join('') + '</div>';

  html += '<label class="grp-label">تاريخ الانطلاقة</label><div class="chip-row">' +
    openDeps(p).map(function (d) {
      const left = seatsLeft(d); const sold = left <= 0;
      return '<button class="chip ' + (d.id === s.depId ? 'active' : '') + (sold ? ' soldout' : '') + '" data-action="pkgDep" data-id="' + d.id + '">' +
        d.date + (sold ? ' · اكتمل' : (left <= 5 ? ' · 🔥 ' + left + ' مقاعد' : '')) +
        (isEb(d) ? ' ⚡' : '') + '</button>';
    }).join('') + '</div>';
  if (dep && isEb(dep)) html += '<p class="eb-note">⚡ سعر مبكّر: خصم ' + p.ebPct + '% لهذه الانطلاقة حتى ' + dep.ebUntil + '</p>';

  html += '<label class="grp-label">المدة</label><div class="chip-row">' +
    p.durations.map(function (d, i) {
      return '<button class="chip ' + (i === s.durIdx ? 'active' : '') + '" data-action="pkgDur" data-idx="' + i + '">' +
        d.label + ' (' + d.nights + ' ليالٍ) · ' + money(dep ? ebPrice(d.pp, p, dep) : d.pp) + '/شخص</button>';
    }).join('') + '</div>';

  html += '<label class="grp-label">المسافرون</label><div class="cnt-grid">' +
    cntRow('بالغ — غرفة مزدوجة', 'adults', s.adults) +
    cntRow('غرفة مفردة (+' + money(t.dur.single) + ')', 'singles', s.singles) +
    cntRow('طفل (سرير إضافي)', 'children', s.children) + '</div>';

  if (p.addons.length) {
    html += '<label class="grp-label">إضافات اختيارية</label><div class="chip-row">' +
      p.addons.map(function (a) {
        return '<button class="chip addon ' + (s.addons[a.id] ? 'active' : '') + '" data-action="pkgAddon" data-id="' + a.id + '">' +
          a.emoji + ' ' + a.label + ' · ' + money(a.price) + (a.per === 'person' ? '/شخص' : '') + '</button>';
      }).join('') + '</div>';
  }

  if (!soldOut) {
    html += '<label class="grp-label">طريقة الدفع</label><div class="chip-row">' +
      '<button class="chip ' + (s.pay === 'deposit' ? 'active' : '') + '" data-action="pkgPay" data-mode="deposit">عربون ' + (p.depositPct || 30) + '% الآن</button>' +
      '<button class="chip ' + (s.pay === 'full' ? 'active' : '') + '" data-action="pkgPay" data-mode="full">دفع كامل</button></div>';
    html += '<div class="brk">' + t.lines.map(function (l) {
      return '<div class="brk-row"><span>' + l[0] + '</span><span>' + money(l[1]) + '</span></div>';
    }).join('') +
      '<div class="brk-row total"><span>الإجمالي</span><span>' + money(t.total) + '</span></div>' +
      (s.pay === 'deposit'
        ? '<div class="brk-row due"><span>المطلوب الآن (عربون)</span><span>' + money(t.deposit) + '</span></div>' +
          '<div class="brk-row rest"><span>المتبقّي قبل ' + (dep ? isoAddDays(dep.date, -14) : '—') + '</span><span>' + money(t.total - t.deposit) + '</span></div>'
        : '<div class="brk-row due"><span>المطلوب الآن</span><span>' + money(t.total) + '</span></div>') +
      '</div>';
  } else {
    html += '<div class="soldout-note">😔 اكتملت مقاعد هذه الانطلاقة' +
      (waitlistCount(s.depId) ? ' — ' + waitlistCount(s.depId) + ' بانتظارها' : '') +
      '. انضم لقائمة الانتظار وسنبلغك فور توفّر مقاعد أو فتح انطلاقة جديدة.</div>';
  }

  byId('pkgDetail').innerHTML = html;
  show(byId('pkgBookBtn'), !soldOut);
  show(byId('pkgWaitBtn'), soldOut);
}
function cntRow(label, key, val) {
  return '<div class="cnt-row"><span>' + label + '</span><span class="cnt-ctl">' +
    '<button class="cnt-btn" data-action="pkgCount" data-k="' + key + '" data-d="-1">−</button>' +
    '<b>' + val + '</b>' +
    '<button class="cnt-btn" data-action="pkgCount" data-k="' + key + '" data-d="1">+</button></span></div>';
}
function pkgCount(k, d) {
  const s = state.pkg; if (!s) return;
  const min = k === 'adults' ? 1 : 0;
  s[k] = Math.max(min, Math.min(9, (s[k] || 0) + d));
  renderPkgDetail();
}
function confirmPkg() {
  const s = state.pkg; if (!s) return;
  const t = pkgTotals(); const p = t.pkg, dep = t.dep, dur = t.dur;
  const name = (byId('pkName').value || '').trim();
  const contact = (byId('pkContact').value || '').trim();
  const err = byId('pkgErr');
  if (!name || !contact) { err.textContent = 'أكمل الاسم ووسيلة التواصل.'; show(err, true); return; }
  const seats = pkgSeats();
  if (!dep || seatsLeft(dep) < seats) {
    err.textContent = 'المقاعد المتبقية (' + (dep ? seatsLeft(dep) : 0) + ') لا تكفي طلبك — قلّل العدد أو اختر انطلاقة أخرى.';
    show(err, true); return;
  }
  if (!state.user || state.user.role === 'admin') state.user = { name: name, role: 'traveler' };
  const payDeposit = s.pay === 'deposit';
  const booking = {
    id: uid('b'), type: 'package', pkgId: p.id, depId: dep.id, seats: seats,
    title: p.title + ' · ' + dur.label, detail: '🏨 ' + p.hotel + ' · انطلاق ' + dep.date + ' · ' + seats + ' مسافر',
    total: t.total, paidNow: payDeposit ? t.deposit : t.total,
    remaining: payDeposit ? t.total - t.deposit : 0, dueDate: isoAddDays(dep.date, -14),
    traveler: name, contact: contact, status: 'مؤكّد', at: isoDate(0),
  };
  dep.booked = (dep.booked || 0) + seats;
  bookings.push(booking);
  save('packages', packages); save('bookings', bookings);
  closePkg(); applyAccess();
  toast('✅ تأكّد حجزك — ' + (payDeposit ? 'عربون ' + money(t.deposit) + ' والباقي قبل ' + booking.dueDate : 'مدفوع بالكامل'));
  setView('bookings');
}
function joinWaitlist() {
  const s = state.pkg; if (!s) return;
  const name = (byId('pkName').value || '').trim();
  const contact = (byId('pkContact').value || '').trim();
  const err = byId('pkgErr');
  if (!name || !contact) { err.textContent = 'أكمل الاسم ووسيلة التواصل للانضمام.'; show(err, true); return; }
  waitlist.push({ id: uid('w'), pkgId: s.id, depId: s.depId, name: name, contact: contact, at: isoDate(0) });
  save('waitlist', waitlist);
  closePkg(); toast('🔔 أُضفت لقائمة الانتظار — سنتواصل معك فور توفّر مقاعد');
}

/* ── طلب عرض خاص (الطلبات المخصّصة خارج الباقات المجدولة) ─────────────── */
function openQuote() {
  ['qDest', 'qName', 'qContact'].forEach(function (i) { const el = byId(i); if (el) el.value = ''; });
  const d = byId('qDate'); if (d) d.value = isoDate(30);
  show(byId('quoteErr'), false);
  show(byId('quoteModal'), true);
}
function closeQuote() { show(byId('quoteModal'), false); }
function submitQuote() {
  const name = (byId('qName').value || '').trim();
  const contact = (byId('qContact').value || '').trim();
  if (!name || !contact) { show(byId('quoteErr'), true); return; }
  quotes.push({
    id: uid('q'), dest: (byId('qDest').value || '').trim() || '—', date: byId('qDate').value || '—',
    pax: Math.max(1, Number(byId('qPax').value || 2)), name: name, contact: contact,
    status: 'جديد', at: isoDate(0),
  });
  save('quotes', quotes);
  closeQuote(); toast('🎯 استلمنا طلبك — سيصلك عرض خاص قريباً');
}

/* ================================ الحجز =============================== */
function startBooking(type, item, unitLabel, qty) {
  state.pending = { type: type, title: item.title, detail: item.detail, unit: item.unit, qty: qty, base: item.base };
  byId('bookSummary').innerHTML =
    '<div class="bs-icon">' + item.emoji + '</div>' +
    '<div><div class="bs-title">' + item.title + '</div>' +
    '<div class="bs-detail">' + item.detail + '</div>' +
    '<div class="bs-unit">' + qty + ' ' + unitLabel + ' × ' + money(item.unit) + '</div></div>';
  byId('bkName').value = state.user && state.user.role === 'traveler' ? state.user.name : '';
  byId('bkContact').value = ''; byId('bkPromo').value = '';
  show(byId('bookErr'), false);
  updateBookTotal();
  show(byId('bookModal'), true);
}
function currentTotal() {
  if (!state.pending) return 0;
  let total = state.pending.base;
  const o = offerByCode(byId('bkPromo') && byId('bkPromo').value);
  if (o) total = Math.round(total * (1 - o.pct / 100));
  return total;
}
function updateBookTotal() {
  const o = offerByCode(byId('bkPromo') && byId('bkPromo').value);
  const t = currentTotal();
  byId('bookTotal').textContent = money(t) + (o ? ' (خصم ' + o.pct + '%)' : '');
}
function bookFlight(id) {
  const f = results.flights.find(x => x.id === id) || FLIGHTS.find(x => x.id === id); if (!f) return;
  const pax = Math.max(1, Number((byId('fPax') && byId('fPax').value) || 1));
  startBooking('flight', { emoji: f.emoji, title: 'رحلة ' + f.airline, detail: airportCity(f.from) + ' → ' + airportCity(f.to) + ' · ' + f.dep, unit: f.price, base: f.price * pax }, 'مسافر', pax);
}
function bookHotel(id) {
  const h = results.hotels.find(x => x.id === id) || HOTELS.find(x => x.id === id); if (!h) return;
  const nights = daysBetween(byId('hIn') && byId('hIn').value, byId('hOut') && byId('hOut').value);
  startBooking('hotel', { emoji: h.emoji, title: h.name, detail: h.city + ' · ' + stars(h.rating), unit: h.price, base: h.price * nights }, 'ليلة', nights);
}
function bookCar(id) {
  const c = results.cars.find(x => x.id === id) || CARS.find(x => x.id === id); if (!c) return;
  const days = daysBetween(byId('cIn') && byId('cIn').value, byId('cOut') && byId('cOut').value);
  startBooking('car', { emoji: c.emoji, title: c.name, detail: c.city + ' · ' + c.cls, unit: c.price, base: c.price * days }, 'يوم', days);
}
function closeBooking() { show(byId('bookModal'), false); state.pending = null; }
function confirmBooking() {
  if (!state.pending) return;
  const name = (byId('bkName').value || '').trim();
  if (!name) { show(byId('bookErr'), true); return; }
  // غير المسجّل يُنشأ له حساب مسافر تلقائياً عند أول حجز
  if (!state.user || state.user.role === 'admin') state.user = { name: name, role: 'traveler' };
  const o = offerByCode(byId('bkPromo') && byId('bkPromo').value);
  const booking = {
    id: uid('b'), type: state.pending.type, title: state.pending.title, detail: state.pending.detail,
    total: currentTotal(), promo: o ? o.code : null, traveler: name,
    contact: (byId('bkContact').value || '').trim(), status: 'مؤكّد', at: isoDate(0),
  };
  bookings.push(booking); save('bookings', bookings);
  closeBooking(); applyAccess(); toast('✅ تأكّد حجزك رقم ' + booking.id);
  setView('bookings');
}

/* ============================== حجوزاتي =============================== */
function typeIcon(t) { return t === 'package' ? '🎒' : (t === 'flight' ? '🛫' : (t === 'hotel' ? '🏨' : '🚗')); }
function renderBookings() {
  const mine = state.user ? bookings.filter(function (b) {
    return state.user.role === 'admin' || b.traveler === state.user.name;
  }) : [];
  byId('bookingList').innerHTML = mine.length ? mine.slice().reverse().map(function (b) {
    const payLine = b.type === 'package' && b.remaining > 0
      ? '<div class="res-sub pay-line">💳 مدفوع ' + money(b.paidNow) + ' · المتبقّي ' + money(b.remaining) + ' قبل ' + b.dueDate + '</div>' : '';
    return '<div class="res-card booking"><div class="res-lead">' + typeIcon(b.type) + '</div>' +
      '<div class="res-main"><div class="res-title">' + b.title + '</div>' +
      '<div class="res-sub">' + b.detail + ' · ' + b.at + (b.promo ? ' · كود ' + b.promo : '') + '</div>' + payLine + '</div>' +
      '<div class="res-side"><div class="res-price">' + money(b.total) + '</div>' +
      '<span class="pill ' + (b.status === 'ملغى' ? 'wait' : 'ok') + '">' + b.status + '</span>' +
      (b.status === 'ملغى' ? '' : '<button class="btn sm" data-action="cancelBooking" data-id="' + b.id + '">إلغاء</button>') +
      '</div></div>';
  }).join('') : '<p class="empty">لا حجوزات بعد — ابدأ من «استكشف».</p>';
}
function cancelBooking(id) {
  const b = bookings.find(x => x.id === id); if (!b) return;
  b.status = 'ملغى';
  // حجز باقة: تُعاد مقاعده للانطلاقة فوراً — فتظهر متاحة لقائمة الانتظار
  if (b.type === 'package' && b.depId) {
    const dep = depOf(pkgById(b.pkgId), b.depId);
    if (dep) { dep.booked = Math.max(0, (dep.booked || 0) - (b.seats || 0)); save('packages', packages); }
  }
  save('bookings', bookings); renderBookings(); toast('أُلغي الحجز');
}

/* ============================== الإدارة =============================== */
function renderAdmin() {
  const live = bookings.filter(b => b.status !== 'ملغى');
  const revenue = live.reduce(function (s, b) { return s + b.total; }, 0);
  const collected = live.reduce(function (s, b) { return s + (b.paidNow != null ? b.paidNow : b.total); }, 0);
  let seatsSold = 0, seatsAll = 0;
  packages.forEach(function (p) { p.departures.forEach(function (d) { seatsSold += d.booked || 0; seatsAll += d.capacity || 0; }); });
  byId('adminStats').innerHTML =
    stat('الحجوزات', bookings.length) + stat('الفعّالة', live.length) +
    stat('مقاعد مباعة', seatsSold + '/' + seatsAll) +
    stat('إشغال الباقات', (seatsAll ? Math.round(seatsSold * 100 / seatsAll) : 0) + '%') +
    stat('قيمة العقود', money(revenue)) + stat('المحصَّل فعلاً', money(collected));
  renderAdminPkgs();
  renderAdminWaitQuotes();
  byId('wlName').value = brand.name; byId('wlEmoji').value = brand.emoji;
  byId('wlColor').value = brand.primary; byId('wlCurrency').value = brand.currency;
  byId('adminOffers').innerHTML = offers.map(function (o) {
    return '<div class="mini-row"><span>' + o.emoji + ' ' + o.title + ' (' + o.pct + '%)</span>' +
      '<span class="pill ' + (o.active ? 'ok' : 'wait') + '">' + (o.active ? 'فعّال' : 'موقوف') + '</span>' +
      '<button class="btn sm" data-action="toggleOffer" data-id="' + o.id + '">' + (o.active ? 'إيقاف' : 'تفعيل') + '</button></div>';
  }).join('');
  byId('adminBookings').innerHTML = bookings.length ? bookings.slice().reverse().map(function (b) {
    return '<div class="mini-row"><span>' + typeIcon(b.type) + ' ' + b.title + ' — ' + b.traveler + '</span>' +
      '<span class="mr-price">' + money(b.total) + '</span>' +
      '<span class="pill ' + (b.status === 'ملغى' ? 'wait' : 'ok') + '">' + b.status + '</span></div>';
  }).join('') : '<p class="empty">لا حجوزات بعد.</p>';
  byId('apiStatus').textContent = CONFIG.api.base
    ? ('مربوط بـ API حيّ: ' + CONFIG.api.base + ' (يرتدّ للبيانات المبدئية عند فشل الشبكة).')
    : 'يعمل حالياً ببيانات مبدئية (seed). لتفعيل الجلب الحيّ اضبط CONFIG.api.base في app.js.';
}
/* ── إدارة الباقات والانطلاقات ────────────────────────────────────────── */
function renderAdminPkgs() {
  const sel = byId('adPkg');
  if (sel) sel.innerHTML = packages.map(function (p) { return '<option value="' + p.id + '">' + p.emoji + ' ' + p.title + '</option>'; }).join('');
  const dt = byId('adDate'); if (dt && !dt.value) dt.value = isoDate(45);
  const rl = byId('adRel'); if (rl && !rl.value) rl.value = isoDate(31);
  const eb = byId('adEb'); if (eb && !eb.value) eb.value = isoDate(20);
  const box = byId('adminPkgs'); if (!box) return;
  box.innerHTML = packages.map(function (p) {
    const deps = p.departures.map(function (d) {
      const left = seatsLeft(d); const pct = d.capacity ? Math.round((d.booked || 0) * 100 / d.capacity) : 0;
      const src = SOURCING[d.sourcing] || { label: d.sourcing };
      const wl = waitlistCount(d.id);
      return '<div class="mini-row dep-row"><span>📅 ' + d.date + ' · ' + src.label +
        (d.release ? ' · استرجاع ' + d.release : '') + (isEb(d) ? ' · ⚡مبكّر' : '') + '</span>' +
        '<span class="occ"><span class="occ-bar"><span class="occ-fill" style="width:' + pct + '%"></span></span> ' +
        (d.booked || 0) + '/' + d.capacity + (wl ? ' · 🔔' + wl : '') + '</span>' +
        '<span><button class="btn sm" data-action="admSeats" data-pkg="' + p.id + '" data-id="' + d.id + '">+5 مقاعد</button>' +
        '<button class="btn sm" data-action="admTogDep" data-pkg="' + p.id + '" data-id="' + d.id + '">' + (d.open === false ? 'فتح' : 'إغلاق') + '</button></span></div>';
    }).join('');
    return '<div class="adm-pkg"><div class="adm-pkg-title">' + p.emoji + ' <b>' + p.title + '</b> — ' + p.hotel +
      ' · عربون ' + (p.depositPct || 30) + '%</div>' + (deps || '<p class="empty">لا انطلاقات بعد — أضف واحدة أعلاه.</p>') + '</div>';
  }).join('');
}
function admAddDep() {
  const p = pkgById(byId('adPkg') && byId('adPkg').value); if (!p) { toast('اختر باقة أولاً'); return; }
  const date = byId('adDate').value; if (!date) { toast('حدّد تاريخ الانطلاق'); return; }
  p.departures.push({
    id: uid('d'), date: date, capacity: Math.max(1, Number(byId('adCap').value || 20)), booked: 0,
    sourcing: (byId('adSrc') && byId('adSrc').value) || 'group',
    release: byId('adRel').value || null, ebUntil: byId('adEb').value || null, open: true,
  });
  p.departures.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  save('packages', packages); renderAdmin(); toast('✅ أُضيفت الانطلاقة — المقاعد مفتوحة للحجز');
}
function admTogDep(pkgId, depId) {
  const dep = depOf(pkgById(pkgId), depId); if (!dep) return;
  dep.open = dep.open === false; save('packages', packages); renderAdmin();
}
function admSeats(pkgId, depId) {
  const dep = depOf(pkgById(pkgId), depId); if (!dep) return;
  dep.capacity = (dep.capacity || 0) + 5; save('packages', packages); renderAdmin();
  toast('زيدت السعة — أبلغ قائمة الانتظار إن وُجدت');
}
function admNewPkg() {
  const title = (byId('anTitle').value || '').trim();
  const city = (byId('anCity').value || '').trim();
  const hotel = (byId('anHotel').value || '').trim();
  const p7 = Number(byId('anP7').value || 0);
  if (!title || !city || !hotel || p7 <= 0) { toast('أكمل: الاسم، المدينة، الفندق، وسعر الأسبوع'); return; }
  const p14 = Number(byId('anP14').value || 0);
  const durations = [{ nights: 7, label: 'أسبوع', pp: p7, single: Math.round(p7 * 0.25), child: Math.round(p7 * 0.5) }];
  if (p14 > 0) durations.push({ nights: 14, label: 'أسبوعان', pp: p14, single: Math.round(p14 * 0.25), child: Math.round(p14 * 0.5) });
  packages.push({
    id: uid('p'), title: title, city: city, country: '', emoji: '🧳', img: '',
    hotel: hotel, rating: 4, board: 'شامل الإفطار', flight: 'طيران ذهاباً وعودة',
    includes: ['تنقّلات المطار', 'أمتعة 23كغ'],
    durations: durations,
    addons: [{ id: 'a1', label: 'تأمين سفر', emoji: '🛡️', price: 95, per: 'person' }],
    depositPct: 30, ebPct: 10, departures: [],
  });
  save('packages', packages);
  ['anTitle', 'anCity', 'anHotel', 'anP7', 'anP14'].forEach(function (i) { const el = byId(i); if (el) el.value = ''; });
  renderAdmin(); toast('🎒 أُنشئت الباقة «' + title + '» — أضف لها انطلاقة الآن');
}
function renderAdminWaitQuotes() {
  const wl = byId('adminWaitlist');
  if (wl) wl.innerHTML = waitlist.length ? waitlist.slice().reverse().map(function (w) {
    const p = pkgById(w.pkgId); const dep = depOf(p, w.depId);
    return '<div class="mini-row"><span>🔔 ' + w.name + ' — ' + (p ? p.title : '؟') + (dep ? ' (' + dep.date + ')' : '') + '</span>' +
      '<span class="tagline">' + w.contact + '</span><span class="pill wait">انتظار</span></div>';
  }).join('') : '<p class="empty">لا أحد في قائمة الانتظار.</p>';
  const qs = byId('adminQuotes');
  if (qs) qs.innerHTML = quotes.length ? quotes.slice().reverse().map(function (q) {
    return '<div class="mini-row"><span>🎯 ' + q.name + ' — ' + q.dest + ' · ' + q.date + ' · ' + q.pax + ' مسافر</span>' +
      '<span class="tagline">' + q.contact + '</span><span class="pill ok">' + q.status + '</span></div>';
  }).join('') : '<p class="empty">لا طلبات عروض خاصة.</p>';
}

function toggleOffer(id) {
  const o = offers.find(x => x.id === id); if (!o) return;
  o.active = !o.active; save('offers', offers); renderAdmin();
}
function saveBrand() {
  brand = Object.assign({}, brand, {
    name: (byId('wlName').value || brand.name).trim(),
    emoji: (byId('wlEmoji').value || brand.emoji).trim(),
    primary: byId('wlColor').value || brand.primary,
    currency: (byId('wlCurrency').value || brand.currency).trim(),
  });
  save('brand', brand); applyBrand(); renderAdmin(); toast('حُفظت هوية العلامة');
}
function stat(label, val) {
  return '<div class="stat"><div class="stat-val">' + val + '</div><div class="stat-label">' + label + '</div></div>';
}

/* ============================ الدخول/التوجيه ========================== */
function openAuth(mode) {
  state.authMode = mode || 'login'; updateAuthUI();
  show(byId('authErr'), false);
  byId('auName').value = ''; byId('auPass').value = '';
  show(byId('authModal'), true);
}
function closeAuth() { show(byId('authModal'), false); }
function updateAuthUI() {
  const reg = state.authMode === 'register';
  byId('authTitle').textContent = reg ? 'إنشاء حساب مسافر' : 'تسجيل الدخول';
  byId('authHint').textContent = reg ? 'سجّل لحفظ حجوزاتك.' : 'ادخل بحسابك.';
  byId('authSubmit').textContent = reg ? 'تسجيل' : 'دخول';
  byId('authSwitchText').textContent = reg ? 'لديك حساب إدارة؟ ' : 'مسافر جديد؟ ';
  byId('authSwitch').textContent = reg ? 'دخول' : 'إنشاء حساب مسافر';
}
function toggleAuth() { openAuth(state.authMode === 'login' ? 'register' : 'login'); }
function submitAuth() {
  const name = (byId('auName').value || '').trim();
  const pass = (byId('auPass').value || '').trim();
  if (!name) { show(byId('authErr'), true); return; }
  if (state.authMode === 'register') {
    state.user = { name: name, role: 'traveler' };
    closeAuth(); applyAccess(); toast('أهلاً ' + name); setView('explore'); return;
  }
  const acc = STAFF[name];
  if (acc && acc.pass === pass) {
    state.user = { name: acc.name, role: acc.role };
    closeAuth(); applyAccess(); toast('مرحباً ' + acc.name); setView('admin');
  } else { show(byId('authErr'), true); }
}
function logout() { state.user = null; state.view = 'explore'; applyAccess(); setView('explore'); toast('تم تسجيل الخروج'); }

/* ============================== التفويض =============================== */
function handleClick(e) {
  const a = e.target.closest('[data-action]'); if (!a) return;
  const id = a.dataset.id;
  switch (a.dataset.action) {
    case 'tab': setView(a.dataset.view); break;
    case 'exploreDest': { const c = byId('hCity'); state.view = 'hotels'; setView('hotels'); if (byId('hCity')) byId('hCity').value = a.dataset.city; searchHotels(); break; }
    case 'useOffer': navigator && navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(a.dataset.code) : 0; toast('نُسخ الكود: ' + a.dataset.code); break;
    case 'searchFlights': searchFlights(); break;
    case 'searchHotels': searchHotels(); break;
    case 'searchCars': searchCars(); break;
    case 'bookFlight': bookFlight(id); break;
    case 'bookHotel': bookHotel(id); break;
    case 'bookCar': bookCar(id); break;
    case 'openPkg': openPkg(id); break;
    case 'closePkg': closePkg(); break;
    case 'pkgDep': if (state.pkg) { state.pkg.depId = id; renderPkgDetail(); } break;
    case 'pkgDur': if (state.pkg) { state.pkg.durIdx = Number(a.dataset.idx || 0); renderPkgDetail(); } break;
    case 'pkgCount': pkgCount(a.dataset.k, Number(a.dataset.d)); break;
    case 'pkgAddon': if (state.pkg) { state.pkg.addons[id] = !state.pkg.addons[id]; renderPkgDetail(); } break;
    case 'pkgPay': if (state.pkg) { state.pkg.pay = a.dataset.mode; renderPkgDetail(); } break;
    case 'confirmPkg': confirmPkg(); break;
    case 'joinWaitlist': joinWaitlist(); break;
    case 'openQuote': openQuote(); break;
    case 'closeQuote': closeQuote(); break;
    case 'submitQuote': submitQuote(); break;
    case 'admAddDep': admAddDep(); break;
    case 'admTogDep': admTogDep(a.dataset.pkg, id); break;
    case 'admSeats': admSeats(a.dataset.pkg, id); break;
    case 'admNewPkg': admNewPkg(); break;
    case 'closeBooking': closeBooking(); break;
    case 'confirmBooking': confirmBooking(); break;
    case 'cancelBooking': cancelBooking(id); break;
    case 'toggleOffer': toggleOffer(id); break;
    case 'saveBrand': saveBrand(); break;
    case 'openAuth': state.user ? logout() : openAuth('login'); break;
    case 'closeAuth': closeAuth(); break;
    case 'toggleAuth': e.preventDefault(); toggleAuth(); break;
    case 'submitAuth': submitAuth(); break;
  }
}
function handleInput(e) {
  if (e.target && e.target.id === 'bkPromo') updateBookTotal();
}

function init() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  applyBrand();
  applyAccess();
  renderExplore();
}
document.addEventListener('DOMContentLoaded', init);
`;

const STYLES_CSS = `:root{--brand:#0ea5e9;--accent:#f59e0b;--bg:#080d16;--surface:#111726;--card:#161d2e;--good:#22c55e;--warn:#f59e0b;--text:#e8edf6;--muted:#8b98b0;--border:#222b40;--font:'Segoe UI',Tahoma,system-ui,sans-serif;--shadow:0 30px 70px -24px rgba(0,0,0,.8)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(50% 40% at 85% 0%,color-mix(in srgb,var(--brand) 14%,transparent),transparent 60%),radial-gradient(50% 40% at 0% 100%,color-mix(in srgb,var(--accent) 10%,transparent),transparent 60%),var(--bg)}
.topbar{display:flex;align-items:center;gap:16px;padding:12px 20px;background:rgba(17,23,38,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);flex-wrap:wrap;position:sticky;top:0;z-index:30}
.brand{font-size:19px;font-weight:800;white-space:nowrap;display:flex;align-items:center;gap:9px}
#brandEmoji{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--brand),var(--accent));display:grid;place-items:center;font-size:16px}
.tabs{flex:1;display:flex;gap:6px;flex-wrap:wrap}
.tab{background:transparent;border:1px solid transparent;color:var(--muted);padding:7px 14px;border-radius:99px;font-weight:700;font-size:13px;cursor:pointer;font-family:var(--font)}
.tab.active{background:var(--card);color:var(--text);border-color:var(--border)}
.btn{background:var(--card);border:1px solid var(--border);color:var(--text);padding:9px 16px;border-radius:11px;font-weight:700;font-size:13px;cursor:pointer;transition:.18s;font-family:var(--font)}
.btn.primary{background:linear-gradient(105deg,var(--brand),var(--accent));border-color:transparent;color:#04283a}
.btn.primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px -10px color-mix(in srgb,var(--brand) 55%,transparent)}
.btn.ghost{background:rgba(255,255,255,.04)}
.btn.sm{padding:6px 12px;font-size:12px}
.btn.block{width:100%}
.icon-btn{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer}
main{max-width:1120px;margin:0 auto;padding:0 18px 40px}
.sec-title{margin:26px 0 14px;font-size:18px}
.hero{position:relative;min-height:48vh;display:flex;align-items:center;overflow:hidden;border-radius:0 0 28px 28px;margin:0 -18px 8px}
.hero .hero-bg{position:absolute;inset:0;z-index:0}
.hero .hero-bg::after{content:"";position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(8,13,22,.94) 32%,rgba(8,13,22,.42))}
.hero-in{position:relative;z-index:3;padding:52px 30px}
.eyebrow{font-size:12px;font-weight:800;letter-spacing:2.5px;color:var(--brand);text-transform:uppercase}
.accent-txt{color:var(--accent)}
.hero h1{font-size:clamp(30px,5.5vw,54px);line-height:1.08;font-weight:800;margin:12px 0 12px;letter-spacing:-1px}
.hero-tag{color:#dbe6f2;font-size:16px;max-width:460px}
.ph{position:relative;overflow:hidden;background:linear-gradient(135deg,#161d2e,#22283e)}
.ph .ph-emoji-fb{position:absolute;inset:0;display:grid;place-items:center;font-size:44px;opacity:.9}
.ph img{position:relative;z-index:1;width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}
.grid{display:grid;gap:18px}
.grid.dest{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.grid.offers{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
.card{background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;cursor:pointer;transition:.2s}
.card:hover{border-color:color-mix(in srgb,var(--brand) 40%,var(--border));transform:translateY(-4px)}
.card:hover .ph img{transform:scale(1.06)}
.dest-media{position:relative;height:150px}
.dest-media .ph{height:100%}
.dest-scrim{position:absolute;inset:0;z-index:2;background:linear-gradient(to top,rgba(22,29,46,.55),transparent 55%)}
.dest-body{padding:14px 16px 16px}
.dest-city{font-weight:800;font-size:16px}
.dest-tag{color:var(--muted);font-size:13px;margin:2px 0 6px}
.dest-from{color:var(--brand);font-weight:700;font-size:13px}
.offer-card{display:flex;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:14px}
.offer-emoji{font-size:34px}
.offer-title{font-weight:700;font-size:14px}
.offer-pct{color:var(--accent);font-weight:800;margin:2px 0}
.offer-code{color:var(--muted);font-size:12px;margin-bottom:8px}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px}
.panel h2{margin-bottom:14px;font-size:17px}.panel h3{margin-bottom:10px;font-size:15px}
.search-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:14px}
.fld label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin-bottom:5px}
.sel,select,input[type=date],input[type=number],input[type=text],input[type=color],input[type=password]{width:100%;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--text);font-family:inherit}
input[type=color]{height:42px;padding:4px}
.note{background:rgba(245,158,11,.12);border:1px solid var(--warn);color:var(--warn);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px}
.results{display:flex;flex-direction:column;gap:12px}
.res-card{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;flex-wrap:wrap}
.res-lead{font-size:30px}
.res-main{flex:1;min-width:180px}
.res-title{font-weight:700;font-size:15px}
.rate{color:var(--accent);font-size:13px}
.tagline{color:var(--muted);font-size:12px;font-weight:400}
.res-sub{color:var(--muted);font-size:13px;margin-top:2px}
.res-side{text-align:left;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.res-price{color:var(--brand);font-weight:800;font-size:17px}
.res-unit{color:var(--muted);font-size:11px}
.pill{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--border);color:var(--muted)}
.pill.ok{background:rgba(34,197,94,.15);color:var(--good)}
.pill.wait{background:rgba(245,158,11,.15);color:var(--warn)}
.empty{text-align:center;color:var(--muted);padding:26px}
.hidden{display:none !important}
.stat-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin-bottom:18px}
.stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;text-align:center}
.stat-val{font-size:20px;font-weight:800;color:var(--brand)}
.stat-label{color:var(--muted);font-size:12px;margin-top:2px}
.mini-list{display:flex;flex-direction:column;gap:8px}
.mini-row{display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;flex-wrap:wrap}
.mr-price{color:var(--brand);font-weight:700}
.hint{color:var(--muted);font-size:13px;margin-bottom:12px}
.api-note{border-style:dashed}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:60;padding:16px}
.modal-box{background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:min(430px,100%);position:relative;max-height:92dvh;overflow:auto}
.close-x{position:absolute;top:12px;left:14px;font-size:22px}
.modal-box h2{font-size:19px;margin-bottom:12px}
.modal-box label{display:block;font-size:12px;color:var(--muted);font-weight:700;margin:10px 0 5px}
.modal-box input{margin-bottom:2px}
.book-summary{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:8px}
.bs-icon{font-size:32px}
.bs-title{font-weight:700}
.bs-detail{color:var(--muted);font-size:13px}
.bs-unit{color:var(--accent);font-size:12px;font-weight:700;margin-top:2px}
.price-final{margin:14px 0 8px;font-size:16px}.price-final b{color:var(--brand)}
.err-msg{color:#ef4444;font-size:13px;margin:6px 0}
.switch{text-align:center;color:var(--muted);font-size:13px;margin-top:12px}
.switch a{color:var(--brand);text-decoration:none;font-weight:700}
.demo{text-align:center;color:var(--muted);font-size:11px;margin-top:10px}
.demo code{background:var(--card);padding:1px 6px;border-radius:5px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:linear-gradient(105deg,var(--brand),var(--accent));color:#04283a;padding:11px 20px;border-radius:12px;font-weight:700;font-size:14px;z-index:70;box-shadow:var(--shadow)}
h1,h2,h3{color:var(--text)}
/* ── الباقات ── */
.hero-cta{margin-top:18px}
.grid.pkgs{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.pkg-card .dest-media{height:160px}
.pkg-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap}
.seat-badge{font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;background:rgba(34,197,94,.14);color:var(--good)}
.seat-badge.urgent{background:rgba(245,158,11,.16);color:var(--warn)}
.seat-badge.soldout{background:rgba(239,68,68,.14);color:#f87171}
.eb-badge{position:absolute;top:10px;right:10px;z-index:3;background:linear-gradient(105deg,var(--accent),#fbbf24);color:#3a2504;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px}
.pkg-box{width:min(560px,100%)}
.pkg-head-row{display:flex;gap:12px;align-items:center;margin-bottom:10px}
.pkg-head-row h2{margin:0;font-size:18px}
.inc-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.inc{font-size:11px;font-weight:700;color:var(--good);background:rgba(34,197,94,.1);border-radius:8px;padding:3px 9px}
.grp-label{display:block;font-size:12px;color:var(--muted);font-weight:800;margin:14px 0 7px}
.chip-row{display:flex;gap:7px;flex-wrap:wrap}
.chip{background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:11px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)}
.chip.active{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 16%,var(--card));box-shadow:0 0 0 1px var(--brand) inset}
.chip.soldout{opacity:.55;text-decoration:line-through}
.chip.addon.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset;background:color-mix(in srgb,var(--accent) 12%,var(--card))}
.eb-note{color:var(--accent);font-size:12px;font-weight:700;margin-top:7px}
.cnt-grid{display:flex;flex-direction:column;gap:7px}
.cnt-row{display:flex;align-items:center;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:8px 12px;font-size:13px}
.cnt-ctl{display:flex;align-items:center;gap:12px}
.cnt-btn{width:28px;height:28px;border-radius:8px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:15px;font-weight:800;cursor:pointer}
.brk{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-top:14px}
.brk-row{display:flex;justify-content:space-between;font-size:13px;color:var(--muted);padding:3px 0}
.brk-row.total{border-top:1px solid var(--border);margin-top:6px;padding-top:8px;color:var(--text);font-weight:800}
.brk-row.due{color:var(--brand);font-weight:800}
.brk-row.rest{color:var(--warn);font-size:12px}
.soldout-note{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;border-radius:12px;padding:12px 14px;margin-top:14px;font-size:13px}
.quote-cta{text-align:center;border-style:dashed;margin-top:22px}
.pay-line{color:var(--warn)}
.adm-pkgs{margin-top:14px}
.adm-pkg{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:4px}
.adm-pkg-title{font-size:14px;margin-bottom:8px}
.dep-row{background:var(--surface)}
.occ{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.occ-bar{display:inline-block;width:70px;height:6px;border-radius:4px;background:var(--border);overflow:hidden}
.occ-fill{display:block;height:100%;background:linear-gradient(90deg,var(--brand),var(--accent))}
.new-pkg{border-top:1px dashed var(--border);margin-top:16px;padding-top:14px}
.adm-quotes{margin-top:10px}
`;

export function jaolaTravel() {
    return {
        id: 'jaola-travel',
        category: 'travel',
        name: 'منصّة سفر (باقات جاهزة + طيران + فنادق + سيّارات)',
        description: 'منصّة سفر عاملة غنيّة يقودها منتج «الباقات الجاهزة»: فندق متعاقَد + مقاعد طيران محجوزة مسبقاً (حجز جماعي/حصة/موزّع/عارض) تُباع كسعر واحد بانطلاقات مجدولة، مع عدّاد مقاعد وسعر مبكّر وعربون وإضافات وقائمة انتظار وطلب عرض خاص. إضافةً لبحث طيران وفنادق وسيّارات + عروض + حجوزات موحّدة. جاهزة لِـ API و White-label.',
        nameEn: 'Travel Platform (Packages-first)',
        descriptionEn: 'Packages-first travel platform: pre-contracted hotel + pre-blocked flight seats sold as one price with scheduled departures, seat countdown, early-bird, deposit, add-ons, waitlist and custom quotes — plus flights/hotels/cars search, deals and unified bookings. API-ready and white-label.',
        // ⚠️ «باقات»/«package» مفردتين *ممنوعتان* هنا: كل قالب يبيع باقات
        // (استوديو تصوير، نادٍ رياضي، صالون…)، فكانتا تخطفان طلباتهم لقالب
        // السفر — «باقات جلسات تصوير» وُجّهت لـjaola-travel فعلاً. الكلمة
        // المفتاحية تُقيَّد بالسفر صراحةً.
        keywords: ['سفر', 'سياحة', 'طيران', 'رحلات', 'تذاكر', 'حجز فندق', 'فنادق', 'تأجير سيارات', 'باقات سفر', 'باقات سياحية', 'باقة سياحية', 'باقة سفر', 'عروض سفر', 'أنطاليا', 'شارتر', 'travel', 'flight', 'hotel', 'booking', 'tourism', 'trip', 'travel package', 'holiday package', 'tour package', 'charter', 'حجوزات', 'عطلة'],
        externalApi: 'API-ready (طبقة مزوّد قابلة للربط) + White-label',
        model: {
            entities: [
                { name: 'Package', fields: [{ name: 'title', type: 'string' }, { name: 'hotel', type: 'string' }, { name: 'board', type: 'string' }, { name: 'depositPct', type: 'number' }, { name: 'ebPct', type: 'number' }], ownedBy: 'Admin' },
                { name: 'Departure', fields: [{ name: 'date', type: 'string' }, { name: 'capacity', type: 'number' }, { name: 'booked', type: 'number' }, { name: 'sourcing', type: 'string' }, { name: 'release', type: 'string' }], ownedBy: 'Admin' },
                { name: 'WaitlistEntry', fields: [{ name: 'name', type: 'string' }, { name: 'contact', type: 'string' }, { name: 'depId', type: 'string' }], ownedBy: 'Traveler' },
                { name: 'QuoteRequest', fields: [{ name: 'dest', type: 'string' }, { name: 'date', type: 'string' }, { name: 'pax', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Traveler' },
                { name: 'Flight', fields: [{ name: 'from', type: 'string' }, { name: 'to', type: 'string' }, { name: 'airline', type: 'string' }, { name: 'price', type: 'number' }], ownedBy: 'Provider' },
                { name: 'Hotel', fields: [{ name: 'city', type: 'string' }, { name: 'name', type: 'string' }, { name: 'rating', type: 'number' }, { name: 'price', type: 'number' }], ownedBy: 'Provider' },
                { name: 'Car', fields: [{ name: 'city', type: 'string' }, { name: 'name', type: 'string' }, { name: 'cls', type: 'string' }, { name: 'price', type: 'number' }], ownedBy: 'Provider' },
                { name: 'Offer', fields: [{ name: 'code', type: 'string' }, { name: 'pct', type: 'number' }, { name: 'active', type: 'boolean' }], ownedBy: 'Admin' },
                { name: 'Booking', fields: [{ name: 'id', type: 'string' }, { name: 'type', type: 'string' }, { name: 'total', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Traveler' },
            ],
            roles: [
                { name: 'Traveler', description: 'يبحث ويحجز', capabilities: ['حجز باقة جاهزة (انطلاقة/مدة/إضافات/عربون)', 'قائمة انتظار', 'طلب عرض خاص', 'تصفّح الوجهات', 'بحث طيران/فنادق/سيّارات', 'تطبيق عرض', 'حجز', 'إدارة حجوزاته'] },
                { name: 'Admin', description: 'يدير المنصّة والعلامة', capabilities: ['إنشاء باقات وانطلاقات بمصدر مقاعد (جماعي/حصة/موزّع/عارض)', 'متابعة الإشغال وقوائم الانتظار وطلبات العروض', 'إحصاءات', 'إدارة العروض', 'white-label حيّ', 'كل الحجوزات', 'حالة الربط'] },
            ],
            flows: [
                { name: 'حجز باقة جاهزة', actor: 'Traveler', steps: ['يفتح باقة', 'يختار الانطلاقة والمدة وعدد المسافرين', 'يضيف إضافات اختيارية', 'يختار عربوناً أو دفعاً كاملاً', 'يؤكّد فيُخصم من مقاعد الانطلاقة'], touches: ['Package', 'Departure', 'Booking'], realtime: false },
                { name: 'قائمة انتظار انطلاقة مكتملة', actor: 'Traveler', steps: ['يفتح باقة مكتملة', 'يترك اسمه ووسيلة تواصله', 'يُبلَّغ عند توفّر مقاعد'], touches: ['Departure', 'WaitlistEntry'], realtime: false },
                { name: 'إدارة الانطلاقات ومصادر المقاعد', actor: 'Admin', steps: ['ينشئ باقة', 'يضيف انطلاقة بمصدر مقاعد وتاريخ استرجاع', 'يتابع الإشغال ويزيد السعة أو يغلق'], touches: ['Package', 'Departure', 'WaitlistEntry', 'QuoteRequest'], realtime: false },
                { name: 'حجز رحلة/فندق/سيّارة', actor: 'Traveler', steps: ['يبحث', 'يختار نتيجة', 'يطبّق كود خصم (اختياري)', 'يؤكّد الحجز'], touches: ['Flight', 'Hotel', 'Car', 'Booking', 'Offer'], realtime: false },
                { name: 'إعادة العلامة (white-label)', actor: 'Admin', steps: ['يفتح الإدارة', 'يغيّر الاسم/اللون/العملة', 'يحفظ فتُطبَّق حيّاً'], touches: ['Offer', 'Booking'], realtime: false },
            ],
            _source: 'clone',
        },
        files: [
            { name: 'index.html', content: INDEX_HTML },
            { name: 'app.js', content: APP_JS },
            { name: 'styles.css', content: STYLES_CSS },
        ],
    };
}
