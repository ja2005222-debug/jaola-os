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

        // ─── التنبيهات والملف ───
        '🔔 تنبيهاتك': '🔔 Your notifications',
        'مطار الانطلاق المعتاد': 'Usual departure airport',
        '💬 رقم واتساب (بصيغة دولية)': '💬 WhatsApp number (international)',
        'الدرجة المفضّلة': 'Preferred cabin',
        '— بلا تفضيل —': '— No preference —',
        'الوسم': 'Label',
        'أنا / زوجتي': 'Me / spouse',

        // ─── حالات الحجز وأنواعه (نصوص مولَّدة بالجافاسكربت) ───
        '💳 سدّد المتبقي الآن': '💳 Pay balance now',
        '💳 بانتظار إتمام الدفع — مقاعدك محجوزة، وتتحرر إن انتهت مهلة الدفع.': '💳 Awaiting payment — your seats are held and release if the payment window expires.',
        'مُصدَر ✅': 'Issued ✅',
        'قيد الإصدار': 'Issuing',
        'فشل': 'Failed',
        'مُلغى': 'Cancelled',
        'باقة مجدولة': 'Fixed package',
        '↩️ قابل للإلغاء': '↩️ Cancellable',
        '⛔ غير قابل للاسترداد': '⛔ Non-refundable',
        'سعر خاص متعاقَد': 'Contracted special rate',
        'سياسة الإلغاء': 'Cancellation policy',
        'الإلغاء قبل أول موعد أعلاه مجاني.': 'Free cancellation before the first date above.',
        '⛔ حجز غير قابل للاسترداد — لا إلغاء مجاني.': '⛔ Non-refundable booking — no free cancellation.',

        // ─── مقدمات الأقسام والشرائط ───
        '🎒 فندق متعاقَد + مقاعد طيران محجوزة مسبقاً — سعر نهائي واحد وتأكيد فوري. احجز بعربون وسلّم الأسماء قبل الإقلاع بأسبوعين.':
            '🎒 Contracted hotel + pre-blocked flight seats — one final price, instant confirmation. Book with a deposit, submit names two weeks before departure.',
        '🎯 ما ناسبك تاريخ أو وجهة؟': "🎯 Dates or destination don't fit?",
        'اطلب عرضاً خاصاً ويجهّز لك فريقنا باقة على مقاسك.': 'Request a custom offer and our team will tailor a package for you.',
        '✨ وجهات رائجة من مطارك': '✨ Trending from your airport',
        'أرخص سعر وجدناه اليوم — ذهاب فقط بعد ٣٠ يوماً': 'Cheapest price found today — one-way, 30 days out',
        '🏨 أضف فنادق الوجهة (تفتح في صفحة منفصلة)': '🏨 Add destination hotels (opens separately)',
        'الباقة ذهاب وعودة — حدّد التاريخين، فالفندق يُحجز بينهما.': 'Bundles are round-trip — set both dates; the hotel spans them.',
        '🪪 أسماء بقية المسافرين تُسلَّم قبل الإقلاع بأسبوعين — لا تلزم الآن.': '🪪 Remaining traveller names are due two weeks before departure — not now.',
        'عربون الآن والباقي لاحقاً': 'Deposit now, balance later',
        'دفع كامل': 'Pay in full',

        // ─── رسائل فارغ/خطأ/انتظار (مولَّدة) ───
        'لا رحلات متاحة لهذا البحث.': 'No flights available for this search.',
        'لا رحلات لهذا البحث.': 'No flights for this search.',
        'لا فنادق متاحة لهذه الوجهة/التواريخ.': 'No hotels for this destination/dates.',
        'لا فنادق قابلة للإلغاء لهذه التواريخ — شرط الباقة.': 'No cancellable hotels for these dates — a bundle requirement.',
        'لا سيارات متاحة لهذا البحث.': 'No cars available for this search.',
        'لا حجوزات بعد — ابدأ من تبويب البحث أو اطلب من المساعد.': 'No bookings yet — start from Search or ask the assistant.',
        'لا تنبيهات بعد — ستصلك هنا تأكيدات حجوزاتك وتغييرات شركات الطيران وانخفاضات الأسعار.': 'No notifications yet — booking confirmations, airline changes and price drops arrive here.',
        'لا انطلاقات معلنة حالياً — اطلب عرضاً خاصاً أدناه وسنوافيك.': 'No departures announced yet — request a custom offer below.',
        'لا باقات في مفضلتك بعد — اضغط ♡ على أي باقة.': 'No wishlisted packages yet — tap ♡ on any package.',
        'لا مراجعات بعد — كن أول من يشارك تجربته.': 'No reviews yet — be the first to share.',
        'لا تفاصيل إضافية من المزوّد.': 'No extra details from the provider.',
        'لا مطار مغطّى بهذا الاسم — جرّب اسم مدينة أو دولة أخرى.': 'No covered airport by that name — try another city or country.',
        '⏳ جارٍ جلب تفاصيل الفندق…': '⏳ Fetching hotel details…',
        'جارٍ الحساب...': 'Calculating...',
        '📅 نجمع أرخص سعر لكل يوم — لحظات...': '📅 Collecting the cheapest price per day — moments...',
        '📅 أرخص سعر لكل يوم (لمسافر واحد) — اضغط يوماً لتبحث به:': '📅 Cheapest per day (one traveller) — tap a day to search it:',
        'تعذّر البحث — حاول مجدداً بعد قليل.': 'Search failed — try again shortly.',
        'تعذّر بحث الفنادق — حاول مجدداً بعد قليل.': 'Hotel search failed — try again shortly.',
        'تعذّر الاتصال بالخادم — حاول مجدداً.': 'Could not reach the server — try again.',
        'تعذّر تحميل الباقات — حدّث الصفحة.': 'Could not load packages — refresh the page.',
        'تعذّر تحميل الوجهات — حاول مجدداً بعد قليل.': 'Could not load destinations — try again shortly.',
        'تعذّر تسعير الباقة — حاول مجدداً.': 'Could not price the bundle — try again.',
        'أدخل تاريخ ميلاد كل طفل — سعر تذكرته يتبع عمره يوم السفر.': "Enter each child's date of birth — the fare follows their age on travel day.",
        'تاريخ الميلاد من البحث — لتغييره أعد البحث، فالسعر يتبع العمر.': 'Date of birth comes from the search — re-search to change it; the fare follows the age.',
        'أغلق هذا التبويب للعودة إلى نتائج بحث الرحلات.': 'Close this tab to return to flight results.',
        'فعّل الحفظ أعلاه لإضافة مسافرين.': 'Enable saving above to add travellers.',
        '💬 تنبيهات واتساب غير مُفعّلة على هذا الخادم بعد.': '💬 WhatsApp alerts are not enabled on this server yet.',
        '/ للشخص': '/ per person',
        'المرجع:': 'Reference:',
        '✓ حجز موثق': '✓ verified booking',
        '▴ إخفاء التفاصيل': '▴ Hide details',
        'خريطة موقع الفندق': 'Hotel location map',
        'خرائط Google': 'Google Maps',

        // ─── تفاصيل الرحلة والفندق (من صور فجوات حقيقية للمالك) ───
        '🎫 الدرجة:': '🎫 Cabin:',
        'الذهاب': 'Outbound',
        'العودة': 'Return',
        'الرحلة': 'Flight',
        '🧳 لم يُصرّح المزوّد بالأمتعة لهذا القطاع': '🧳 The provider did not declare baggage for this segment',
        '🛏️ الغرفة:': '🛏️ Room:',
        'رسوم تُدفع في الفندق (غير مشمولة بالسعر أعلاه)': 'Fees paid at the hotel (not included in the price above)',
        '🏨 فنادق الوجهة': '🏨 Destination hotels',
        'لا رحلات': 'No flights',
        'تعذّر جلب التقويم.': 'Could not fetch the calendar.',
        'تعذّر فتح صفحة الدفع.': 'Could not open the payment page.',

        // ─── المساعد ───
        '🤖 قراءة المساعد': "🤖 Assistant's read",
        '🔄 جديدة': '🔄 New chat',
        'محادثة جديدة': 'New conversation',
        'المساعد ينفّذ فعلياً: يبحث ويقارن ويحجز ويلغي بالحوار — وكل إجراء نفّذه يظهر كرقاقة شفافية.':
            'The assistant actually acts: it searches, compares, books and cancels in conversation — and every action it takes shows as a transparency chip.',
        'مثال: احجز لي رحلة من الرياض للقاهرة الأسبوع القادم بأرخص سعر':
            'e.g.: book me the cheapest Riyadh–Cairo flight next week',
        '↩️ استُؤنفت محادثتك السابقة': '↩️ Your previous conversation was resumed',
        '⚠️ تعذّر الاتصال بالخادم.': '⚠️ Could not reach the server.',
        'غير مفعَّل على هذا الخادم': 'Not enabled on this server',
        '🧪 بيئة تجريبية — الحجوزات هنا لا تُصدر تذاكر حقيقية ولا تُحصَّل أموال.':
            '🧪 Sandbox environment — bookings here issue no real tickets and charge no money.',
    },
};

/**
 * قواعد الأنماط: نصوص بأرقام مُدرَجة لا تطابق جدولاً حرفياً — تُترجم
 * بتعابير نمطية محدودة، وتُطبَّق فقط حين لا يطابق النص الجدول أعلاه.
 */
window.JAOLA_I18N_RULES = [
    [/^(\d+) ليالٍ$/, '$1 nights'],
    [/^متاح: (\d+) مقاعد$/, 'Available: $1 seats'],
    [/^🔥 تبقى (\d+) مقاعد فقط$/, '🔥 Only $1 seats left'],
    [/^إجمالي (\d+) مسافر$/, 'Total for $1 traveller(s)'],
    [/^(\d+) مسافر$/, '$1 traveller(s)'],
    [/^⭐ ([\d.]+) · (\d+) مراجعة موثقة$/, '⭐ $1 · $2 verified reviews'],
    [/^عربون (\d+)% يثبّت مقعدك — الأسماء قبل ([\d-]+)$/, '$1% deposit secures your seat — names due before $2'],
    [/^عربون (\d+)% الآن$/, '$1% deposit now'],
    [/^(\d+) بالغ — غرفة مزدوجة$/, '$1 adult(s) — double room'],
    [/^(\d+) غرفة مفردة/, '$1 single room(s)'],
    [/^(\d+) طفل$/, '$1 child(ren)'],
    [/^👥 حتى (\d+)$/, '👥 Up to $1'],
    [/^⏳ صلاحية السعر حتى (.+)$/, '⏳ Price valid until $1'],
    // سطرا سياسة الإلغاء — الأخصّ أولاً (أول نمط مطابق يفوز)
    [/^ابتداءً من (.+) تُخصم رسوم يحددها الفندق$/, 'From $1 a fee set by the hotel applies'],
    [/^ابتداءً من (.+) تُخصم (.+)$/, 'From $1 a charge of $2 applies'],

    // ─── رقائق شفافية المساعد (نصوصها تُبنى في الخادم بأرقام مُدرَجة) ───
    [/^🔎 (.+) \((\d+) عروض\)$/, '🔎 $1 ($2 offers)'],
    [/^💰 عرض بسعر (.+)$/, '💰 Offer at $1'],
    [/^💰 عرض فندق بسعر (.+)$/, '💰 Hotel offer at $1'],
    [/^💰 عرض سيارة بسعر (.+)$/, '💰 Car offer at $1'],
    [/^✅ حُجز — المرجع (.+)$/, '✅ Booked — reference $1'],
    [/^✅ حُجز فندق — المرجع (.+)$/, '✅ Hotel booked — reference $1'],
    [/^✅ حُجزت سيارة — المرجع (.+)$/, '✅ Car booked — reference $1'],
    [/^↩️ أُلغي الحجز (.+)$/, '↩️ Cancelled booking $1'],
    [/^↩️ أُلغي حجز الفندق (.+)$/, '↩️ Cancelled hotel booking $1'],
    [/^↩️ أُلغي حجز السيارة (.+)$/, '↩️ Cancelled car booking $1'],
    [/^🧳 (\d+) حجوزات$/, '🧳 $1 bookings'],
    [/^🏨 (.+) \((\d+) فنادق\)$/, '🏨 $1 ($2 hotels)'],
    [/^🚗 (.+) \((\d+) سيارات\)$/, '🚗 $1 ($2 cars)'],
    [/^📅 (.+) \((\d+) تواريخ\)$/, '📅 $1 ($2 dates)'],
    [/^⚠️ (\d+) تعارض محتمل$/, '⚠️ $1 potential conflict(s)'],
    [/^✅ لا تعارض$/, '✅ No conflicts'],
    [/^👁️ مراقبة سعر (.+)$/, '👁️ Price watch $1'],
    [/^👁️ (\d+) مراقبات نشطة$/, '👁️ $1 active watches'],
    [/^🚫 أُلغيت المراقبة (.+)$/, '🚫 Watch cancelled $1'],
    [/^🌤️ طقس (.+) \((\d+) أيام\)$/, '🌤️ $1 weather ($2 days)'],
    [/^📋 ملخص رحلة \((\d+) حجوزات\)$/, '📋 Trip summary ($1 bookings)'],
    [/^🔀 أجاب (.+) \(حصّة المزوّد الأساسي مؤقتاً ممتلئة\)$/, '🔀 Answered by $1 (primary provider quota temporarily full)'],
];

/**
 * استبدالات جزئية آمنة داخل النصوص المختلطة (مدينة · تاريخ · «5 ليالٍ»):
 * كلمات عربية مميزة لا تلتبس — تُطبَّق أخيراً وعالمياً داخل عقدة النص.
 */
window.JAOLA_I18N_SUBS = [
    [' ليالٍ', ' nights'],
    [' ليلة', ' night(s)'],
    [' مقاعد', ' seats'],
    [' مسافر', ' traveller(s)'],
    [' مراجعة موثقة', ' verified reviews'],
    ['انطلاق ', 'Departs '],
    ['أقرب انطلاقة ', 'Next departure '],
    ['شامل الإفطار', 'Breakfast included'],
    ['إفطار وعشاء', 'Half board'],
    ['بدون إعاشة', 'Room only'],
    ['حقيبة مسجَّلة', 'checked bag'],
    ['حقيبة يد', 'carry-on bag'],
];
