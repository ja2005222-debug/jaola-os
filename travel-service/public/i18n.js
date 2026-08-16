/**
 * 🌐 i18n.js — جدول ترجمة عربي→إنجليزي (المرحلة الأولى من تعدد اللغات)
 *
 * النهج «جدول نصوص» عمداً لا «مفاتيح data-i18n»: مترجم واحد يمشي على عقد
 * النصوص والـplaceholders ويستبدل المطابق تماماً — صفر تعديل في مئات مواضع
 * الـHTML، ويشمل تلقائياً المحتوى المولَّد بالجافاسكربت لاحقاً (عبر نفس
 * مراقب الـDOM المستخدم لعملات العرض). غير المطابق (نصوص بأرقام مُدرَجة،
 * رسائل الخادم) يبقى عربياً — تدهور صريح لا صفحة مكسورة.
 *
 * المفاتيح **نصوص حرفية** كما تظهر في الصفحة بالضبط (بما فيها الرموز
 * التعبيرية) — اختبارٌ يتحقق أن عيّنة المفاتيح المحورية ما زالت موجودة في
 * index.html فلا يتباعد الجدول عن الواقع بصمت.
 */
window.JAOLA_I18N = {
    en: {
        // ─── الرأس والتبويبات ───
        'بوابة السفر': 'Travel Portal',
        '⚙️ الإدارة': '⚙️ Admin',
        '🔎 بحث الرحلات': '🔎 Flights',
        '🏨 الفنادق': '🏨 Hotels',
        '🎒 باقات جاهزة': '🎒 Packages',
        '🎁 ركّب باقتك': '🎁 Build a bundle',
        '🗺️ أهم الوجهات': '🗺️ Top destinations',
        '🚗 سيارات': '🚗 Cars',
        '🧳 رحلاتي': '🧳 My trips',
        '🔔 التنبيهات': '🔔 Notifications',
        '🤖 المساعد': '🤖 Assistant',
        '💵 العملة الأصلية': '💵 Original currency',

        // ─── نموذج بحث الرحلات ───
        'من': 'From',
        'إلى': 'To',
        'تاريخ الذهاب': 'Departure date',
        'العودة (اختياري)': 'Return (optional)',
        'بالغون': 'Adults',
        'أطفال (دون 18)': 'Children (under 18)',
        'الدرجة': 'Cabin',
        'الترتيب': 'Sort',
        'اقتصادية': 'Economy',
        'اقتصادية مميزة': 'Premium economy',
        'رجال الأعمال': 'Business',
        'الأولى': 'First',
        '💰 الأرخص أولاً': '💰 Cheapest first',
        '⚡ الأسرع أولاً': '⚡ Fastest first',
        '🔎 ابحث': '🔎 Search',
        '📅 تقويم الأسعار': '📅 Price calendar',
        '🔍 فلاتر متقدمة (توقفات · شركة · سقف سعر)': '🔍 Advanced filters (stops · airline · max price)',
        'التوقفات': 'Stops',
        'أي عدد': 'Any',
        '✈️ مباشر فقط': '✈️ Direct only',
        'توقف واحد كحد أقصى': 'Max one stop',
        'شركة الطيران (اسم أو رمز)': 'Airline (name or code)',
        'سقف السعر': 'Max price',
        'بلا سقف': 'No cap',
        'الرياض أو RUH': 'Riyadh or RUH',
        'القاهرة أو CAI': 'Cairo or CAI',
        'دبي أو DXB': 'Dubai or DXB',

        // ─── الفنادق والسيارات ───
        'الوجهة': 'Destination',
        'تاريخ الوصول': 'Check-in date',
        'تاريخ المغادرة': 'Check-out date',
        'الغرف': 'Rooms',
        'موقع الاستلام': 'Pickup location',
        'تاريخ الاستلام': 'Pickup date',
        'وقت الاستلام': 'Pickup time',
        'تاريخ التسليم': 'Drop-off date',
        'وقت التسليم': 'Drop-off time',
        '▾ تفاصيل الفندق والسياسات': '▾ Hotel details & policies',
        '▾ تفاصيل الرحلة والأمتعة': '▾ Flight details & baggage',
        'سياسة الإلغاء': 'Cancellation policy',

        // ─── الباقات الجاهزة ───
        'احجز الآن': 'Book now',
        'احجز الباقة': 'Book package',
        '🔔 أبلغني عند التوفّر': '🔔 Notify me when available',
        'اكتملت المقاعد': 'Sold out',
        'اسم قائد المجموعة': 'Lead traveller name',
        'بالغون (غرفة مزدوجة)': 'Adults (double room)',
        'غرف مفردة': 'Single rooms',
        'أطفال': 'Children',
        'أكّد الحجز': 'Confirm booking',
        'أكّد حجز الباقة': 'Confirm package booking',
        'التاريخ التقريبي': 'Approximate date',
        'المسافرون': 'Travellers',
        'بريد أو هاتف': 'Email or phone',
        'إرسال الطلب': 'Send request',
        'الاسم الكامل': 'Full name',
        'أنطاليا': 'Antalya',

        // ─── المراجعات والولاء ───
        'تقييمك': 'Your rating',
        'عنوان (اختياري)': 'Title (optional)',
        'تجربتك (اختياري)': 'Your experience (optional)',
        'نشر المراجعة': 'Publish review',
        '⭐ مراجعات موثقة': '⭐ Verified reviews',
        '🎁 برنامج الولاء': '🎁 Loyalty program',

        // ─── الحجز والمسافرون ───
        'اللقب': 'Title',
        'الاسم الأول (لاتيني)': 'First name (Latin)',
        'اسم العائلة (لاتيني)': 'Family name (Latin)',
        'تاريخ الميلاد': 'Date of birth',
        'الجنس': 'Gender',
        'ذكر': 'Male',
        'أنثى': 'Female',
        'البريد الإلكتروني': 'Email',
        'الهاتف (بصيغة دولية)': 'Phone (international format)',
        'البريد': 'Email',
        'الهاتف': 'Phone',
        '— اختر مسافراً محفوظاً —': '— Pick a saved traveller —',

        // ─── أزرار عامة ───
        'إغلاق': 'Close',
        'إلغاء': 'Cancel',
        'إلغاء الحجز': 'Cancel booking',
        'احجز': 'Book',
        'أرسل': 'Send',
        'حفظ': 'Save',
        'حذف': 'Delete',
        'إزالة': 'Remove',
        'دخول': 'Sign in',
        'حفظ التفضيلات': 'Save preferences',
        'تعليم الكل كمقروء': 'Mark all read',
        'تحميل المزيد': 'Load more',

        // ─── التنبيهات والملف ───
        '🔔 تنبيهاتك': '🔔 Your notifications',
        'مطار الانطلاق المعتاد': 'Usual departure airport',
        '💬 رقم واتساب (بصيغة دولية)': '💬 WhatsApp number (international)',
        'الدرجة المفضّلة': 'Preferred cabin',
        '— بلا تفضيل —': '— No preference —',
        'الوسم': 'Label',
        'أنا / زوجتي': 'Me / spouse',
    },
};
