/**
 * 🌐 i18n.js — جدول ترجمة عربي→(كل لغة) — تحضيرٌ للغة ثالثة
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
 *
 * 🧭 **جدولٌ واحد بعمود لكل لغة — لا جدولٌ منفصل لكل لغة**: الصيغة القديمة
 * كانت `{ en: { 'عربي': 'إنجليزي' } }` — صالحة للغتين، لكنها تعني أن أي
 * لغة ثالثة تحتاج **جدولاً موازياً كاملاً** (`{ ur: { 'عربي': 'أردو' } }`)
 * بنفس ٢٢٢ مفتاحاً من الصفر، فتعديل نصٍّ واحد يتطلّب تذكّر تحديثه في كل
 * جدول على حدة — وهذا تحديداً ما حذّر منه سجل الميزة 24. الآن كل نص عربي
 * **سطرٌ واحد بعمود لكل لغة**: `'عربي': { en: '...' }` (وحقل `ur:` لاحقاً)،
 * فإضافة لغة تعني إضافة عمود لا جدول، وحذف نصٍّ عربي يحذف سطراً واحداً لا
 * سطراً في كل جدول. **والعربية تبقى خارج الجدول عمداً** — HTML عربي المصدر
 * دوماً (`server.js`)، وهذا أساس أمان الزحف في الميزة 24 (تصفّح بلا JS
 * يبقى عربياً صحيحاً)؛ إقحام عمود عربي هنا كان يعني تفعيل ترجمةٍ حتى للغة
 * الأصل، وهو عكس القصد. لغةٌ غائب عمودها في مدخلٍ ما تسقط عربياً كما كانت
 * (نفس تدهور «غير المطابق» أعلاه) — لا يلزم ملء كل الأعمدة دفعة واحدة.
 * القواعد النمطية (`_RULES`) والاستبدالات الجزئية (`_SUBS`) بالمبدأ نفسه.
 */
window.JAOLA_I18N_TABLE = {
    // ─── شريط الثقة ─── (المفتاح يشمل الرمز التعبيري: عقدة نصٍّ واحدة)
    '💯 السعر الذي تراه هو ما تدفعه — لا رسوم تُضاف بعد الحجز': { en: '💯 The price you see is the price you pay — no fees added after booking' },
    '🎫 شرط الاسترداد يظهر قبل الحجز لا بعده': { en: '🎫 Refund terms shown before you book, not after' },
    '🎒 باقاتنا المجدولة مقاعد محجوزة فعلياً — لا عروض تتغيّر تحتك': { en: '🎒 Our scheduled packages hold real seats — not offers that shift under you' },

    // ─── الرأس والتبويبات ───
    'بوابة السفر': { en: 'Travel Portal' },
    '⚙️ الإدارة': { en: '⚙️ Admin' },
    '🔎 بحث الرحلات': { en: '🔎 Flights' },
    '🏨 الفنادق': { en: '🏨 Hotels' },
    '🎒 باقات جاهزة': { en: '🎒 Packages' },
    '🎁 ركّب باقتك': { en: '🎁 Build a bundle' },
    '🗺️ وجهات مقترحة': { en: '🗺️ Suggested destinations' },
    '🚗 سيارات': { en: '🚗 Cars' },
    '🧳 رحلاتي': { en: '🧳 My trips' },
    '🔔 التنبيهات': { en: '🔔 Notifications' },
    '🤖 المساعد': { en: '🤖 Assistant' },
    '💵 العملة الأصلية': { en: '💵 Original currency' },

    // ─── نموذج بحث الرحلات ───
    'من': { en: 'From' },
    'إلى': { en: 'To' },
    'تاريخ الذهاب': { en: 'Departure date' },
    'العودة (اختياري)': { en: 'Return (optional)' },
    'بالغون': { en: 'Adults' },
    'أطفال (دون 18)': { en: 'Children (under 18)' },
    'الدرجة': { en: 'Cabin' },
    'الترتيب': { en: 'Sort' },
    'اقتصادية': { en: 'Economy' },
    'اقتصادية مميزة': { en: 'Premium economy' },
    'رجال الأعمال': { en: 'Business' },
    'الأولى': { en: 'First' },
    '💰 الأرخص أولاً': { en: '💰 Cheapest first' },
    '⚡ الأسرع أولاً': { en: '⚡ Fastest first' },
    '🔎 ابحث': { en: '🔎 Search' },
    '📅 تقويم الأسعار': { en: '📅 Price calendar' },
    '🔍 فلاتر البحث (توقفات · شركة · أمتعة · سقف سعر)': { en: '🔍 Search filters (stops · airline · baggage · max price)' },
    '🧳 حقيبة مسجَّلة مشمولة فقط': { en: '🧳 Only fares including a checked bag' },
    'تبقى الرحلات التي لم يصرّح ناقلها بالأمتعة، موسومةً «غير مصرَّحة» — إخفاؤها يُظهر «لا نتائج» حيث توجد رحلات.': { en: 'Flights whose carrier did not declare baggage are kept and marked “not declared” — hiding them would show “no results” where flights exist.' },
    'التوقفات': { en: 'Stops' },
    'أي عدد': { en: 'Any' },
    '✈️ مباشر فقط': { en: '✈️ Direct only' },
    'توقف واحد كحد أقصى': { en: 'Max one stop' },
    'شركة الطيران (اسم أو رمز)': { en: 'Airline (name or code)' },
    'سقف السعر': { en: 'Max price' },
    'بلا سقف': { en: 'No cap' },
    'الرياض أو RUH': { en: 'Riyadh or RUH' },
    'القاهرة أو CAI': { en: 'Cairo or CAI' },
    'دبي أو DXB': { en: 'Dubai or DXB' },

    // ─── الفنادق والسيارات ───
    'الوجهة': { en: 'Destination' },
    'تاريخ الوصول': { en: 'Check-in date' },
    'تاريخ المغادرة': { en: 'Check-out date' },
    'الغرف': { en: 'Rooms' },
    'موقع الاستلام': { en: 'Pickup location' },
    'تاريخ الاستلام': { en: 'Pickup date' },
    'وقت الاستلام': { en: 'Pickup time' },
    'تاريخ التسليم': { en: 'Drop-off date' },
    'وقت التسليم': { en: 'Drop-off time' },
    '▾ تفاصيل الفندق والسياسات': { en: '▾ Hotel details & policies' },
    '▾ تفاصيل الرحلة والأمتعة': { en: '▾ Flight details & baggage' },
    'سياسة الإلغاء': { en: 'Cancellation policy' },

    // ─── الباقات الجاهزة ───
    'احجز الآن': { en: 'Book now' },
    'احجز الباقة': { en: 'Book package' },
    '🔔 أبلغني عند التوفّر': { en: '🔔 Notify me when available' },
    'اكتملت المقاعد': { en: 'Sold out' },
    'اسم قائد المجموعة': { en: 'Lead traveller name' },
    'بالغون (غرفة مزدوجة)': { en: 'Adults (double room)' },
    'غرف مفردة': { en: 'Single rooms' },
    'أطفال': { en: 'Children' },
    'أكّد الحجز': { en: 'Confirm booking' },
    'أكّد حجز الباقة': { en: 'Confirm package booking' },
    'التاريخ التقريبي': { en: 'Approximate date' },
    'المسافرون': { en: 'Travellers' },
    'بريد أو هاتف': { en: 'Email or phone' },
    'إرسال الطلب': { en: 'Send request' },
    'الاسم الكامل': { en: 'Full name' },
    'أنطاليا': { en: 'Antalya' },

    // ─── المراجعات والولاء ───
    'تقييمك': { en: 'Your rating' },
    'عنوان (اختياري)': { en: 'Title (optional)' },
    'تجربتك (اختياري)': { en: 'Your experience (optional)' },
    'نشر المراجعة': { en: 'Publish review' },
    '⭐ مراجعات موثقة': { en: '⭐ Verified reviews' },
    '🎁 برنامج الولاء': { en: '🎁 Loyalty program' },

    // ─── الحجز والمسافرون ───
    'اللقب': { en: 'Title' },
    'الاسم الأول (لاتيني)': { en: 'First name (Latin)' },
    'اسم العائلة (لاتيني)': { en: 'Family name (Latin)' },
    'تاريخ الميلاد': { en: 'Date of birth' },
    'الجنس': { en: 'Gender' },
    'ذكر': { en: 'Male' },
    'أنثى': { en: 'Female' },
    'البريد الإلكتروني': { en: 'Email' },
    'الهاتف (بصيغة دولية)': { en: 'Phone (international format)' },
    'البريد': { en: 'Email' },
    'الهاتف': { en: 'Phone' },
    '— اختر مسافراً محفوظاً —': { en: '— Pick a saved traveller —' },

    // ─── أزرار عامة ───
    'إغلاق': { en: 'Close' },
    'إلغاء': { en: 'Cancel' },
    'إلغاء الحجز': { en: 'Cancel booking' },
    'احجز': { en: 'Book' },
    'أرسل': { en: 'Send' },
    'حفظ': { en: 'Save' },
    'حذف': { en: 'Delete' },
    'إزالة': { en: 'Remove' },
    'دخول': { en: 'Sign in' },
    'حفظ التفضيلات': { en: 'Save preferences' },
    'تعليم الكل كمقروء': { en: 'Mark all read' },

    // ─── التنبيهات والملف ───
    '🔔 تنبيهاتك': { en: '🔔 Your notifications' },
    'مطار الانطلاق المعتاد': { en: 'Usual departure airport' },
    '💬 رقم واتساب (بصيغة دولية)': { en: '💬 WhatsApp number (international)' },
    'الدرجة المفضّلة': { en: 'Preferred cabin' },
    '— بلا تفضيل —': { en: '— No preference —' },
    'الوسم': { en: 'Label' },
    'أنا / زوجتي': { en: 'Me / spouse' },

    // ─── حالات الحجز وأنواعه (نصوص مولَّدة بالجافاسكربت) ───
    '💳 سدّد المتبقي الآن': { en: '💳 Pay balance now' },
    '💳 بانتظار إتمام الدفع — مقاعدك محجوزة، وتتحرر إن انتهت مهلة الدفع.': { en: '💳 Awaiting payment — your seats are held and release if the payment window expires.' },
    '💳 بانتظار إتمام الدفع — لا يُصدر الحجز قبل السداد، ولن تُحاسَب إن لم تُكمله.':
        { en: '💳 Awaiting payment — nothing is issued before payment, and you are not charged if you do not complete it.' },
    'مُصدَر ✅': { en: 'Issued ✅' },
    'قيد الإصدار': { en: 'Issuing' },
    'فشل': { en: 'Failed' },
    'مُلغى': { en: 'Cancelled' },
    'باقة مجدولة': { en: 'Fixed package' },
    '↩️ قابل للإلغاء': { en: '↩️ Cancellable' },
    '⛔ غير قابل للاسترداد': { en: '⛔ Non-refundable' },
    'سعر خاص متعاقَد': { en: 'Contracted special rate' },
    'سياسة الإلغاء': { en: 'Cancellation policy' },
    'الإلغاء قبل أول موعد أعلاه مجاني.': { en: 'Free cancellation before the first date above.' },
    '⛔ حجز غير قابل للاسترداد — لا إلغاء مجاني.': { en: '⛔ Non-refundable booking — no free cancellation.' },

    // ─── مقدمات الأقسام والشرائط ───
    '🎒 فندق متعاقَد + مقاعد طيران محجوزة مسبقاً — سعر نهائي واحد وتأكيد فوري. احجز بعربون وسلّم الأسماء قبل الإقلاع بأسبوعين.':
        { en: '🎒 Contracted hotel + pre-blocked flight seats — one final price, instant confirmation. Book with a deposit, submit names two weeks before departure.' },
    '🎯 ما ناسبك تاريخ أو وجهة؟': { en: "🎯 Dates or destination don't fit?" },
    'اطلب عرضاً خاصاً ويجهّز لك فريقنا باقة على مقاسك.': { en: 'Request a custom offer and our team will tailor a package for you.' },
    '✨ وجهات مقترحة من مطارك': { en: '✨ Suggested from your airport' },
    'اختيارٌ من فريقنا — والسعر أرخص ما وجدناه اليوم، ذهاب فقط بعد ٣٠ يوماً': { en: 'Picked by our team — price is the cheapest we found today, one-way, 30 days out' },
    '🏨 أضف فنادق الوجهة (تفتح في صفحة منفصلة)': { en: '🏨 Add destination hotels (opens separately)' },
    'الباقة ذهاب وعودة — حدّد التاريخين، فالفندق يُحجز بينهما.': { en: 'Bundles are round-trip — set both dates; the hotel spans them.' },
    '🪪 أسماء بقية المسافرين تُسلَّم قبل الإقلاع بأسبوعين — لا تلزم الآن.': { en: '🪪 Remaining traveller names are due two weeks before departure — not now.' },
    'عربون الآن والباقي لاحقاً': { en: 'Deposit now, balance later' },
    'دفع كامل': { en: 'Pay in full' },

    // ─── رسائل فارغ/خطأ/انتظار (مولَّدة) ───
    'لا رحلات متاحة لهذا البحث.': { en: 'No flights available for this search.' },
    'لا رحلات لهذا البحث.': { en: 'No flights for this search.' },
    'لا فنادق متاحة لهذه الوجهة/التواريخ.': { en: 'No hotels for this destination/dates.' },
    'لا فنادق قابلة للإلغاء لهذه التواريخ — شرط الباقة.': { en: 'No cancellable hotels for these dates — a bundle requirement.' },
    'لا سيارات متاحة لهذا البحث.': { en: 'No cars available for this search.' },
    'لا حجوزات بعد — ابدأ من تبويب البحث أو اطلب من المساعد.': { en: 'No bookings yet — start from Search or ask the assistant.' },
    'لا تنبيهات بعد — ستصلك هنا تأكيدات حجوزاتك وتغييرات شركات الطيران وانخفاضات الأسعار.': { en: 'No notifications yet — booking confirmations, airline changes and price drops arrive here.' },
    'لا انطلاقات معلنة حالياً — اطلب عرضاً خاصاً أدناه وسنوافيك.': { en: 'No departures announced yet — request a custom offer below.' },
    'لا باقات في مفضلتك بعد — اضغط ♡ على أي باقة.': { en: 'No wishlisted packages yet — tap ♡ on any package.' },
    'لا مراجعات بعد — كن أول من يشارك تجربته.': { en: 'No reviews yet — be the first to share.' },
    'لا تفاصيل إضافية من المزوّد.': { en: 'No extra details from the provider.' },
    'لا مطار مغطّى بهذا الاسم — جرّب اسم مدينة أو دولة أخرى.': { en: 'No covered airport by that name — try another city or country.' },
    '⏳ جارٍ جلب تفاصيل الفندق…': { en: '⏳ Fetching hotel details…' },
    'جارٍ الحساب...': { en: 'Calculating...' },
    '📅 نجمع أرخص سعر لكل يوم — لحظات...': { en: '📅 Collecting the cheapest price per day — moments...' },
    '📅 أرخص سعر لكل يوم (لمسافر واحد) — اضغط يوماً لتبحث به:': { en: '📅 Cheapest per day (one traveller) — tap a day to search it:' },
    'تعذّر البحث — حاول مجدداً بعد قليل.': { en: 'Search failed — try again shortly.' },
    'تعذّر بحث الفنادق — حاول مجدداً بعد قليل.': { en: 'Hotel search failed — try again shortly.' },
    'تعذّر الاتصال بالخادم — حاول مجدداً.': { en: 'Could not reach the server — try again.' },
    'تعذّر تحميل الباقات — حدّث الصفحة.': { en: 'Could not load packages — refresh the page.' },
    'تعذّر تحميل الوجهات — حاول مجدداً بعد قليل.': { en: 'Could not load destinations — try again shortly.' },
    'تعذّر تسعير الباقة — حاول مجدداً.': { en: 'Could not price the bundle — try again.' },
    'أدخل تاريخ ميلاد كل طفل — سعر تذكرته يتبع عمره يوم السفر.': { en: "Enter each child's date of birth — the fare follows their age on travel day." },
    'تاريخ الميلاد من البحث — لتغييره أعد البحث، فالسعر يتبع العمر.': { en: 'Date of birth comes from the search — re-search to change it; the fare follows the age.' },
    'أغلق هذا التبويب للعودة إلى نتائج بحث الرحلات.': { en: 'Close this tab to return to flight results.' },
    'فعّل الحفظ أعلاه لإضافة مسافرين.': { en: 'Enable saving above to add travellers.' },
    '💬 تنبيهات واتساب غير مُفعّلة على هذا الخادم بعد.': { en: '💬 WhatsApp alerts are not enabled on this server yet.' },
    '/ للشخص': { en: '/ per person' },
    'المرجع:': { en: 'Reference:' },
    '✓ حجز موثق': { en: '✓ verified booking' },
    '▴ إخفاء التفاصيل': { en: '▴ Hide details' },
    'خريطة موقع الفندق': { en: 'Hotel location map' },
    'خرائط Google': { en: 'Google Maps' },

    // ─── تفاصيل الرحلة والفندق (من صور فجوات حقيقية للمالك) ───
    '🎫 الدرجة:': { en: '🎫 Cabin:' },
    'الذهاب': { en: 'Outbound' },
    'العودة': { en: 'Return' },
    'الرحلة': { en: 'Flight' },
    '🧳 لم يُصرّح المزوّد بالأمتعة لهذا القطاع': { en: '🧳 The provider did not declare baggage for this segment' },
    '🛏️ الغرفة:': { en: '🛏️ Room:' },
    'رسوم تُدفع في الفندق (غير مشمولة بالسعر أعلاه)': { en: 'Fees paid at the hotel (not included in the price above)' },
    '🏨 فنادق الوجهة': { en: '🏨 Destination hotels' },
    'لا رحلات': { en: 'No flights' },
    'تعذّر جلب التقويم.': { en: 'Could not fetch the calendar.' },
    'تعذّر فتح صفحة الدفع.': { en: 'Could not open the payment page.' },

    // ─── المساعد ───
    '🤖 قراءة المساعد': { en: "🤖 Assistant's read" },
    '🔄 جديدة': { en: '🔄 New chat' },
    'محادثة جديدة': { en: 'New conversation' },
    'المساعد ينفّذ فعلياً: يبحث ويقارن ويحجز ويلغي بالحوار — وكل إجراء نفّذه يظهر كرقاقة شفافية.':
        { en: 'The assistant actually acts: it searches, compares, books and cancels in conversation — and every action it takes shows as a transparency chip.' },
    'مثال: احجز لي رحلة من الرياض للقاهرة الأسبوع القادم بأرخص سعر':
        { en: 'e.g.: book me the cheapest Riyadh–Cairo flight next week' },
    '↩️ استُؤنفت محادثتك السابقة': { en: '↩️ Your previous conversation was resumed' },
    '⚠️ تعذّر الاتصال بالخادم.': { en: '⚠️ Could not reach the server.' },
    'غير مفعَّل على هذا الخادم': { en: 'Not enabled on this server' },
    '🧪 بيئة تجريبية — الحجوزات هنا لا تُصدر تذاكر حقيقية ولا تُحصَّل أموال.':
        { en: '🧪 Sandbox environment — bookings here issue no real tickets and charge no money.' },
    '🔄 تحديث': { en: '🔄 Refresh' },
    '🔎 ابحث عن سيارة': { en: '🔎 Find a car' },
    'تعذّر تحميل التنبيهات.': { en: 'Could not load notifications.' },
    'للتقويم: حدّد «من» و«إلى» وتاريخ الذهاب أولاً.': { en: 'For the calendar: set From, To and the departure date first.' },
    '📄 تفاصيل الحجز': { en: '📄 Booking details' },
    '📤 مشاركة': { en: '📤 Share' },
    '🔗 رابط مؤقّت': { en: '🔗 Temporary link' },
    '📆 اشترك بتقويمك': { en: '📆 Subscribe in your calendar' },
    'حجوزاتك تظهر في تقويم هاتفك وتتحدّث وحدها.': { en: 'Your bookings appear in your phone calendar and update themselves.' },
    'إنشاء رابط الاشتراك': { en: 'Create subscription link' },
    '📋 انسخ': { en: '📋 Copy' },
    '📲 افتح في التقويم': { en: '📲 Open in calendar' },
    '🔄 جدّد الرابط': { en: '🔄 Regenerate link' },
    'أضِف الرابط في تقويمك كـ«اشتراك في تقويم». من يملك هذا الرابط يرى مواعيد رحلاتك — جدّده إن تسرّب.':
        { en: 'Add the link to your calendar as a calendar subscription. Anyone holding this link can see your trip dates — regenerate it if it leaks.' },
    '💬 واتساب': { en: '💬 WhatsApp' },
    '📅 أضف للتقويم': { en: '📅 Add to calendar' },
    '🔁 ابحث عن بديل': { en: '🔁 Find an alternative' },
    'تُشارَك خطة الرحلة والمرجع فقط — بلا بريدك ولا هاتفك ولا أرقام تذاكرك.':
        { en: 'Only the itinerary and reference are shared — not your email, phone or ticket numbers.' },
    '💳 أكمل الدفع الآن': { en: '💳 Pay now' },
    '🖨️ طباعة / حفظ PDF': { en: '🖨️ Print / save as PDF' },
    'تعذّر فتح صفحة الدفع.': { en: 'Could not open the payment page.' },

    // ─── ما كشفه مسحٌ آلي للواجهة الإنجليزية تبويباً تبويباً ───
    '🔎 ابحث عن فندق': { en: '🔎 Find a hotel' },
    '🔎 ابحث عن باقات': { en: '🔎 Find bundles' },
    '🎁 اختر رحلة وفندقاً معاً — سعر الباقة أقل من مجموعهما منفصلَين، والفرق يُحسب ويُعرض. الباقة ذهاب وعودة (الفندق بين التاريخين).':
        { en: '🎁 Pick a flight and a hotel together — the bundle costs less than booking both separately, and the difference is computed and shown. Bundles are round-trip (the hotel spans both dates).' },
    '🧠 ملفك ومسافروك': { en: '🧠 Your profile & travellers' },
    // الفقرة مقسومة بـ<strong> فهي عقدتا نص لا واحدة — مفتاح لكل جزء
    'يملأ نماذج البحث والحجز مسبقاً. المساعد يعرف تفضيلاتك ووجهاتك المتكررة —':
        { en: 'Pre-fills your search and booking forms. The assistant knows your preferences and frequent destinations —' },
    'ولا تصله أسماء مسافريك ولا تواريخ ميلادهم أبداً':
        { en: 'and it never receives your travellers’ names or dates of birth' },
    'احفظ بيانات المسافرين لتسريع الحجز القادم': { en: 'Save traveller details to speed up your next booking' },
    '🗑️ امسح كل بياناتي': { en: '🗑️ Erase all my data' },
    '⚙️ أي التنبيهات تريد أن تصلك؟': { en: '⚙️ Which notifications do you want?' },
    'وقائع حجوزاتك يبقى سجلها داخل البوابة دوماً — اختيارك يطال بريدها.':
        { en: 'Your booking events are always logged in the portal — your choice applies to their email.' },
    'أضف رقم واتساب أدناه أولاً': { en: 'Add a WhatsApp number below first' },
    // عناوين ومُلمِحات (title/placeholder)
    'عملة العرض التقريبية': { en: 'Approximate display currency' },
    'التنبيهات': { en: 'Notifications' },
    'أرخص سعر لكل يوم حول تاريخك': { en: 'Cheapest price per day around your date' },
    'مثال: السعودية أو SV': { en: 'e.g. Saudia or SV' },
    'رحلة رائعة!': { en: 'Great trip!' },
    'الفندق، التنظيم، الطيران...': { en: 'Hotel, organisation, flight...' },
    'سجل الوقائع محفوظ دوماً': { en: 'The event log is always kept' },
    'واتساب غير مُفعّل على الخادم': { en: 'WhatsApp is not enabled on this server' },
};

/**
 * قواعد الأنماط: نصوص بأرقام مُدرَجة لا تطابق جدولاً حرفياً — تُترجم
 * بتعابير نمطية محدودة، وتُطبَّق فقط حين لا يطابق النص الجدول أعلاه.
 * كائنٌ لكل قاعدة (لا مصفوفة ثنائية) بالمبدأ نفسه أعلاه: `pattern` واحد
 * وعمود لغة لكل ترجمة، فلغةٌ جديدة تضيف حقلاً لا مصفوفة قواعد كاملة.
 */
window.JAOLA_I18N_RULES = [
    { pattern: /^(\d+) ليالٍ$/, en: '$1 nights' },
    { pattern: /^متاح: (\d+) مقاعد$/, en: 'Available: $1 seats' },
    { pattern: /^🔥 تبقى (\d+) مقاعد فقط$/, en: '🔥 Only $1 seats left' },
    { pattern: /^إجمالي (\d+) مسافر$/, en: 'Total for $1 traveller(s)' },
    { pattern: /^(\d+) مسافر$/, en: '$1 traveller(s)' },
    { pattern: /^⭐ ([\d.]+) · (\d+) مراجعة موثقة$/, en: '⭐ $1 · $2 verified reviews' },
    { pattern: /^عربون (\d+)% يثبّت مقعدك — الأسماء قبل ([\d-]+)$/, en: '$1% deposit secures your seat — names due before $2' },
    { pattern: /^عربون (\d+)% الآن$/, en: '$1% deposit now' },
    { pattern: /^(\d+) بالغ — غرفة مزدوجة$/, en: '$1 adult(s) — double room' },
    { pattern: /^(\d+) غرفة مفردة/, en: '$1 single room(s)' },
    { pattern: /^(\d+) طفل$/, en: '$1 child(ren)' },
    { pattern: /^👥 حتى (\d+)$/, en: '👥 Up to $1' },
    { pattern: /^⏳ صلاحية السعر حتى (.+)$/, en: '⏳ Price valid until $1' },
    // سطرا سياسة الإلغاء — الأخصّ أولاً (أول نمط مطابق يفوز)
    { pattern: /^ابتداءً من (.+) تُخصم رسوم يحددها الفندق$/, en: 'From $1 a fee set by the hotel applies' },
    { pattern: /^ابتداءً من (.+) تُخصم (.+)$/, en: 'From $1 a charge of $2 applies' },

    // ─── رقائق شفافية المساعد (نصوصها تُبنى في الخادم بأرقام مُدرَجة) ───
    { pattern: /^🔎 (.+) \((\d+) عروض\)$/, en: '🔎 $1 ($2 offers)' },
    { pattern: /^💰 عرض بسعر (.+)$/, en: '💰 Offer at $1' },
    { pattern: /^💰 عرض فندق بسعر (.+)$/, en: '💰 Hotel offer at $1' },
    { pattern: /^💰 عرض سيارة بسعر (.+)$/, en: '💰 Car offer at $1' },
    { pattern: /^✅ حُجز — المرجع (.+)$/, en: '✅ Booked — reference $1' },
    { pattern: /^💳 بانتظار الدفع — (.+)$/, en: '💳 Awaiting payment — $1' },
    { pattern: /^↩️ تعذّر إصدار حجزك — أُعيد المبلغ$/, en: '↩️ Your booking could not be issued — refunded' },
    // رسائل فشل تُكتب على الحجز في الخادم وقت وقوعها (تبقى مخزَّنة بلغتها)
    { pattern: /^انتهت مهلة الدفع دون سداد — لم يُصدر الحجز ولم تُحاسَب على شيء\.$/,
        en: 'The payment window expired — nothing was issued and you were not charged.' },
    { pattern: /^انتهت مهلة الدفع \((\d+) دقيقة\) دون سداد — تحررت المقاعد\. احجز من جديد متى شئت\.$/,
        en: 'The payment window ($1 minutes) expired — the seats were released. Book again whenever you like.' },
    { pattern: /^تعذّر إصدار حجز (.+) بعد الدفع: (.+)$/, en: 'Could not issue your $1 booking after payment: $2' },
    { pattern: /^تعذّر فتح صفحة الدفع: (.+)$/, en: 'Could not open the payment page: $1' },
    { pattern: /^تعذّر إصدار الحجز: (.+)$/, en: 'Could not issue the booking: $1' },
    { pattern: /^✅ حُجز فندق — المرجع (.+)$/, en: '✅ Hotel booked — reference $1' },
    { pattern: /^✅ حُجزت سيارة — المرجع (.+)$/, en: '✅ Car booked — reference $1' },
    { pattern: /^↩️ أُلغي الحجز (.+)$/, en: '↩️ Cancelled booking $1' },
    { pattern: /^↩️ أُلغي حجز الفندق (.+)$/, en: '↩️ Cancelled hotel booking $1' },
    { pattern: /^↩️ أُلغي حجز السيارة (.+)$/, en: '↩️ Cancelled car booking $1' },
    { pattern: /^🧳 (\d+) حجوزات$/, en: '🧳 $1 bookings' },
    { pattern: /^🏨 (.+) \((\d+) فنادق\)$/, en: '🏨 $1 ($2 hotels)' },
    { pattern: /^🚗 (.+) \((\d+) سيارات\)$/, en: '🚗 $1 ($2 cars)' },
    { pattern: /^📅 (.+) \((\d+) تواريخ\)$/, en: '📅 $1 ($2 dates)' },
    { pattern: /^⚠️ (\d+) تعارض محتمل$/, en: '⚠️ $1 potential conflict(s)' },
    { pattern: /^✅ لا تعارض$/, en: '✅ No conflicts' },
    { pattern: /^👁️ مراقبة سعر (.+)$/, en: '👁️ Price watch $1' },
    { pattern: /^👁️ (\d+) مراقبات نشطة$/, en: '👁️ $1 active watches' },
    { pattern: /^🚫 أُلغيت المراقبة (.+)$/, en: '🚫 Watch cancelled $1' },
    { pattern: /^🌤️ طقس (.+) \((\d+) أيام\)$/, en: '🌤️ $1 weather ($2 days)' },
    { pattern: /^📋 ملخص رحلة \((\d+) حجوزات\)$/, en: '📋 Trip summary ($1 bookings)' },
    { pattern: /^🔀 أجاب (.+) \(حصّة المزوّد الأساسي مؤقتاً ممتلئة\)$/, en: '🔀 Answered by $1 (primary provider quota temporarily full)' },

    // ─── التنبيهات المخزَّنة (تُكتب بالعربية وقت وقوعها في الخادم — تُترجم
    // عرضاً سطراً سطراً: الواجهة تقسم الجسم بـ<br> فيصير كل سطر عقدة) ───
    { pattern: /^✅ تأكيد حجزك — مرجع (.+)$/, en: '✅ Booking confirmed — reference $1' },
    { pattern: /^↩️ تم إلغاء حجزك — مرجع (.+)$/, en: '↩️ Booking cancelled — reference $1' },
    { pattern: /^⚠️ تغيير من شركة الطيران على حجزك — مرجع (.+)$/, en: '⚠️ Airline change on your booking — reference $1' },
    { pattern: /^🔔 توفّرت مقاعد — (.+)$/, en: '🔔 Seats available — $1' },
    { pattern: /^💳 اكتمل سداد باقتك — (.+)$/, en: '💳 Package fully paid — $1' },
    { pattern: /^⏰ تذكير برحلتك — مرجع (.+)$/, en: '⏰ Trip reminder — reference $1' },
    { pattern: /^(.+) — عربون (\d+)% \((.+)\)$/, en: '$1 — $2% deposit ($3)' },
    { pattern: /^(.+) — دفع كامل \((.+)\)$/, en: '$1 — paid in full ($2)' },
    { pattern: /^سداد متبقي (.+) \((.+)\)$/, en: 'Balance due — $1 ($2)' },
    { pattern: /^تم تأكيد حجزك بنجاح\.$/, en: 'Your booking was confirmed successfully.' },
    { pattern: /^تم إلغاء حجزك\.$/, en: 'Your booking was cancelled.' },
    { pattern: /^المرجع: (.+)$/, en: 'Reference: $1' },
    { pattern: /^الإجمالي: (.+)$/, en: 'Total: $1' },
    { pattern: /^راجع كل حجوزاتك من بوابة السفر\.$/, en: 'See all your bookings in the travel portal.' },
    { pattern: /^راجع تفاصيل حجزك من بوابة السفر أو تواصل مع شركة الطيران بالمرجع أعلاه\.$/,
        en: 'See your booking details in the travel portal, or contact the airline with the reference above.' },
    { pattern: /^أجرت شركة الطيران تغييراً على رحلتك بعد الحجز \(موعد أو مسار\)\.$/,
        en: 'The airline changed your flight after booking (schedule or route).' },
    { pattern: /^⚠️ وأثر هذا على بقية خطتك:$/, en: '⚠️ This affects the rest of your plan:' },
    { pattern: /^انخفض سعر (.+) بتاريخ ([\d-]+) إلى (.+)\.$/, en: 'The price for $1 on $2 dropped to $3.' },
    { pattern: /^\(هدفك كان (.+)\.\)$/, en: '(Your target was $1.)' },
    { pattern: /^الأسعار تتغيّر باستمرار — احجز من بوابة السفر إن ناسبك\.$/,
        en: 'Prices move constantly — book from the travel portal if it suits you.' },
];

/**
 * استبدالات جزئية آمنة داخل النصوص المختلطة (مدينة · تاريخ · «5 ليالٍ»):
 * كلمات عربية مميزة لا تلتبس — تُطبَّق أخيراً وعالمياً داخل عقدة النص.
 * `{ ar, en }` بدل زوج مصفوفة — نفس مبدأ الجدول الرئيسي أعلاه.
 */
window.JAOLA_I18N_SUBS = [
    { ar: ' ليالٍ', en: ' nights' },
    { ar: ' ليلة', en: ' night(s)' },
    { ar: ' مقاعد', en: ' seats' },
    { ar: ' مسافر', en: ' traveller(s)' },
    { ar: ' مراجعة موثقة', en: ' verified reviews' },
    { ar: 'انطلاق ', en: 'Departs ' },
    { ar: 'أقرب انطلاقة ', en: 'Next departure ' },
    { ar: 'شامل الإفطار', en: 'Breakfast included' },
    { ar: 'إفطار وعشاء', en: 'Half board' },
    { ar: 'بدون إعاشة', en: 'Room only' },
    { ar: 'حقيبة مسجَّلة', en: 'checked bag' },
    { ar: 'حقيبة يد', en: 'carry-on bag' },
];
