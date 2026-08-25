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

    // ─── نافذة الدخول/التسجيل + بوابة الجلسة + الترويسة ───
    '🔐 دخول': { en: '🔐 Sign in' },
    '🚪 خروج': { en: '🚪 Sign out' },
    '🔐 انتهت جلستك — سجّل دخولك من جديد للوصول إلى حجوزاتك.': { en: '🔐 Your session has ended — sign in again to access your bookings.' },
    '🔐 الحجز يحتاج حساباً': { en: '🔐 Booking requires an account' },
    'تصفّحُ الأسعار مفتوح للجميع، أمّا الحجز فيحتاج حساباً لتصل إليك التذكرة والتأكيد، وتجد حجزك في «رحلاتي» لاحقاً.': { en: 'Browsing prices is open to everyone — booking requires an account so your ticket and confirmation reach you, and you can find your booking later under "My trips."' },
    'تسجيل الدخول': { en: 'Sign in' },
    'حساب جديد': { en: 'New account' },
    '🔑 استعادة كلمة المرور': { en: '🔑 Reset password' },
    'اكتب بريدك المسجَّل وسنرسل إليك رابطاً لاختيار كلمة مرور جديدة. الرابط صالح ٣٠ دقيقة ويعمل مرة واحدة.': { en: "Enter your registered email and we'll send you a link to choose a new password. The link is valid for 30 minutes and works once." },
    '🔑 اختر كلمة مرور جديدة': { en: '🔑 Choose a new password' },
    'اختر كلمة مرور جديدة لحسابك. سندخلك مباشرةً بعد الحفظ.': { en: "Choose a new password for your account. You'll be signed in immediately after saving." },
    'الاسم': { en: 'Name' },
    'اسمك': { en: 'Your name' },
    'كلمة المرور': { en: 'Password' },
    'كلمة المرور الجديدة': { en: 'New password' },
    '٨ أحرف على الأقل': { en: 'At least 8 characters' },
    'أعد كتابة كلمة المرور': { en: 'Confirm password' },
    'نفس الكلمة مرة أخرى': { en: 'Same password again' },
    'أنشئ الحساب': { en: 'Create account' },
    'أرسل رابط الاستعادة': { en: 'Send reset link' },
    'احفظ وادخل': { en: 'Save and sign in' },
    'أكمل التصفّح': { en: 'Continue browsing' },
    'نسيت كلمة المرور؟': { en: 'Forgot your password?' },
    '← العودة لتسجيل الدخول': { en: '← Back to sign in' },
    '— أو —': { en: '— or —' },
    // رسائل تحقق العميل (submitAuth/onGoogleCredential في index.html)
    'أدخل بريدك المسجَّل.': { en: 'Enter your registered email.' },
    'أدخل كلمة المرور الجديدة.': { en: 'Enter your new password.' },
    'أدخل البريد وكلمة المرور.': { en: 'Enter your email and password.' },
    'الكلمتان غير متطابقتين — أعد كتابتهما.': { en: "The passwords don't match — enter them again." },
    'تعذّر إتمام الطلب — حاول مجدداً.': { en: "Couldn't complete the request — try again." },
    'تعذّر الاتصال بالخادم — تحقق من اتصالك.': { en: "Couldn't reach the server — check your connection." },
    'إن كان هذا البريد مسجَّلاً فستصلك رسالة بها رابط إعادة التعيين.': { en: "If this email is registered, you'll receive a message with a reset link." },
    'تعذّر الدخول بحساب جوجل — حاول مجدداً.': { en: "Couldn't sign in with Google — try again." },

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
    // ─── حسابات Jatrava: رسائل خادم بأرقامٍ مُدرَجة (accounts.js/googleAuth.js) ───
    { pattern: /^كلمة المرور (\d+) أحرف على الأقل\.$/u, en: 'Password must be at least $1 characters.' },
    { pattern: /^كلمة المرور أطول من (\d+) حرفاً\.$/u, en: 'Password must be at most $1 characters.' },
    { pattern: /^تعذّر جلب مفاتيح جوجل العامة \((\d+)\)\.$/u, en: "Couldn't fetch Google's public keys ($1)." },
    // ─── حسابات Jatrava: رسائل خادم ثابتة بلا أرقام (server.js/googleAuth.js) ───
    // ليست في الجدول عمداً: نصوصٌ لا تظهر حرفياً في index.html (تصل عبر
    // data.error من رد الخادم)، فحارس الانجراف الصارم على الجدول يرفضها —
    // نفس السبب الذي يضع رسائل الحجوزات المخزَّنة أدناه في RULES لا الجدول.
    { pattern: /^أدخل بريداً إلكترونياً صحيحاً\.$/u, en: 'Enter a valid email address.' },
    { pattern: /^كلمة المرور شائعة جداً — اختر غيرها\.$/u, en: 'This password is too common — choose another.' },
    { pattern: /^تعذّر إنشاء الحساب بهذا البريد — جرّب تسجيل الدخول\.$/u, en: "Couldn't create an account with this email — try signing in." },
    { pattern: /^البريد أو كلمة المرور غير صحيحة\.$/u, en: 'Incorrect email or password.' },
    { pattern: /^الدخول بحساب جوجل غير مفعَّل على هذا الخادم\.$/u, en: "Google sign-in isn't enabled on this server." },
    { pattern: /^رمز جوجل مفقود\.$/u, en: 'Google token missing.' },
    { pattern: /^تعذّر التحقق من حساب جوجل\.$/u, en: "Couldn't verify the Google account." },
    { pattern: /^بريد حساب جوجل غير مؤكَّد — تعذّر إتمام الدخول\.$/u, en: 'Google account email is unverified — sign-in failed.' },
    { pattern: /^بريد حساب جوجل غير صالح\.$/u, en: 'Invalid Google account email.' },
    { pattern: /^تعذّر إتمام الدخول — حاول مجدداً\.$/u, en: "Couldn't sign in — try again." },
    { pattern: /^رابط إعادة التعيين منتهٍ أو غير صالح — اطلب رابطاً جديداً\.$/u, en: 'This reset link is expired or invalid — request a new one.' },
    // ردود src/googleAuth.js (تُمرَّر عبر e.message في مسار /auth/google)
    { pattern: /^رمز جوجل غير صالح\.$/u, en: 'Invalid Google token.' },
    { pattern: /^تعذّر التحقق من حساب جوجل — حاول مجدداً\.$/u, en: "Couldn't verify the Google account — try again." },
    { pattern: /^حساب جوجل بلا بريد إلكتروني — تعذّر إتمام الدخول\.$/u, en: 'Google account has no email — sign-in failed.' },

    // ─── تحقّق مُدخلات البحث والحجز (server.js + passengerAges.js) ───
    // في RULES لا الجدول لنفس سبب رسائل الحسابات: تصل عبر `data.error`
    // من رد الشبكة فلا تظهر حرفياً في index.html، وحارس الانجراف الصارم
    // على الجدول يرفضها بحق. **وهذه أكثر الرسائل ظهوراً لمسافرٍ حقيقي**:
    // كشفها المالك بلقطةٍ من الموقع الحيّ — بحثٌ بحقل وجهةٍ فارغ على
    // `/en/` فظهرت رسالة عربية وسط صفحة إنجليزية.
    // المطارات والوجهات
    { pattern: /^رمزا المطار يجب أن يكونا IATA من ثلاثة أحرف \(مثل RUH وCAI\)\.$/u, en: 'Both airport codes must be 3-letter IATA codes (e.g. RUH and CAI).' },
    { pattern: /^رمز الوجهة يجب أن يكون IATA من ثلاثة أحرف \(مثل RUH وCAI\)\.$/u, en: 'The destination must be a 3-letter IATA code (e.g. RUH or CAI).' },
    { pattern: /^رمز موقع الاستلام يجب أن يكون IATA من ثلاثة أحرف \(مثل RUH وCAI\)\.$/u, en: 'The pick-up location must be a 3-letter IATA code (e.g. RUH or CAI).' },
    { pattern: /^مطار المغادرة والوصول متطابقان\.$/u, en: 'Departure and arrival airports are the same.' },
    { pattern: /^الوجهة (.+) غير مغطّاة حالياً في بحث الفنادق\.$/u, en: 'Destination $1 is not covered by hotel search yet.' },
    { pattern: /^الوجهة (.+) غير مغطّاة حالياً في بحث السيارات\.$/u, en: 'Destination $1 is not covered by car search yet.' },
    // التواريخ والأوقات
    { pattern: /^تاريخ الذهاب بصيغة YYYY-MM-DD\.$/u, en: 'Departure date must be in YYYY-MM-DD format.' },
    { pattern: /^تاريخ العودة بصيغة YYYY-MM-DD\.$/u, en: 'Return date must be in YYYY-MM-DD format.' },
    { pattern: /^تاريخ الوصول بصيغة YYYY-MM-DD\.$/u, en: 'Check-in date must be in YYYY-MM-DD format.' },
    { pattern: /^تاريخ المغادرة بصيغة YYYY-MM-DD\.$/u, en: 'Check-out date must be in YYYY-MM-DD format.' },
    { pattern: /^تاريخ الاستلام بصيغة YYYY-MM-DD\.$/u, en: 'Pick-up date must be in YYYY-MM-DD format.' },
    { pattern: /^تاريخ التسليم بصيغة YYYY-MM-DD\.$/u, en: 'Drop-off date must be in YYYY-MM-DD format.' },
    { pattern: /^وقت الاستلام بصيغة HH:MM\.$/u, en: 'Pick-up time must be in HH:MM format.' },
    { pattern: /^وقت التسليم بصيغة HH:MM\.$/u, en: 'Drop-off time must be in HH:MM format.' },
    { pattern: /^تاريخ الذهاب في الماضي\.$/u, en: 'The departure date is in the past.' },
    { pattern: /^تاريخ الوصول في الماضي\.$/u, en: 'The check-in date is in the past.' },
    { pattern: /^تاريخ الاستلام في الماضي\.$/u, en: 'The pick-up date is in the past.' },
    { pattern: /^تاريخ العودة قبل الذهاب\.$/u, en: 'The return date is before the departure date.' },
    { pattern: /^تاريخ المغادرة يجب أن يكون بعد الوصول\.$/u, en: 'The check-out date must be after the check-in date.' },
    { pattern: /^وقت التسليم يجب أن يكون بعد الاستلام\.$/u, en: 'The drop-off time must be after the pick-up time.' },
    { pattern: /^تاريخ الذهاب أبعد من نافذة الحجز \((\d+) يوماً\)\.$/u, en: 'The departure date is beyond the booking window ($1 days).' },
    { pattern: /^تاريخ العودة أبعد من نافذة الحجز \((\d+) يوماً\)\.$/u, en: 'The return date is beyond the booking window ($1 days).' },
    { pattern: /^تاريخ الوصول أبعد من نافذة الحجز \((\d+) يوماً\)\.$/u, en: 'The check-in date is beyond the booking window ($1 days).' },
    { pattern: /^تاريخ الاستلام أبعد من نافذة الحجز \((\d+) يوماً\)\.$/u, en: 'The pick-up date is beyond the booking window ($1 days).' },
    { pattern: /^أقصى مدة إقامة (\d+) ليلة\.$/u, en: 'Maximum stay is $1 nights.' },
    { pattern: /^أقصى مدة استئجار (\d+) يوماً\.$/u, en: 'Maximum rental period is $1 days.' },
    // الأعداد والفلاتر
    { pattern: /^عدد البالغين بين 1 و(\d+)\.$/u, en: 'Number of adults must be between 1 and $1.' },
    { pattern: /^عدد الغرف بين 1 و(\d+)\.$/u, en: 'Number of rooms must be between 1 and $1.' },
    { pattern: /^عدد الأطفال بين 0 و(\d+)\.$/u, en: 'Number of children must be between 0 and $1.' },
    { pattern: /^حد التوقفات عدد صحيح بين 0 \(مباشر\) و3\.$/u, en: 'Stops must be a whole number between 0 (direct) and 3.' },
    { pattern: /^سقف السعر رقم موجب\.$/u, en: 'Max price must be a positive number.' },
    // ⚠️ القائمتان تُجمعان بفاصلةٍ **عربية** (`join('، ')`)، فالتقاطهما
    // بـ`(.+)` يسحب علامة ترقيم عربية إلى جملةٍ إنجليزية. وهما ثابتتان
    // في المصدر (CABINS/SORTS) لا مُدخَل مستخدم، فتُطابَقان حرفياً
    // وتُعاد كتابة القائمة بفاصلةٍ لاتينية. كشف هذا فحصُ الأنماط لا العين.
    { pattern: /^درجة غير معروفة \(المتاح: economy، premium_economy، business، first\)\.$/u,
        en: 'Unknown cabin (available: economy, premium_economy, business, first).' },
    { pattern: /^ترتيب غير معروف \(المتاح: price، duration\)\.$/u,
        en: 'Unknown sort order (available: price, duration).' },
    // الركاب والضيوف والسائقون
    { pattern: /^بيانات الركاب مطلوبة\.$/u, en: 'Passenger details are required.' },
    { pattern: /^بيانات الضيوف مطلوبة\.$/u, en: 'Guest details are required.' },
    { pattern: /^بيانات السائق مطلوبة\.$/u, en: 'Driver details are required.' },
    { pattern: /^العرض لعدد (\d+) مسافرين — وصلت بيانات (\d+)\.$/u, en: 'The offer is for $1 traveller(s) — details for $2 were received.' },
    { pattern: /^المسافر (\d+): اللقب mr أو ms أو mrs\.$/u, en: 'Traveller $1: title must be mr, ms or mrs.' },
    { pattern: /^المسافر (\d+): الاسمان بالحروف اللاتينية كما في الجواز \(حتى 40 حرفاً\)\.$/u, en: 'Traveller $1: both names in Latin letters as in the passport (up to 40 characters).' },
    { pattern: /^المسافر (\d+): تاريخ ميلاد صالح بصيغة YYYY-MM-DD\.$/u, en: 'Traveller $1: a valid date of birth in YYYY-MM-DD format.' },
    { pattern: /^المسافر (\d+): الجنس m أو f\.$/u, en: 'Traveller $1: gender must be m or f.' },
    { pattern: /^الضيف (\d+): الاسمان بالحروف اللاتينية \(حتى 40 حرفاً\)\.$/u, en: 'Guest $1: both names in Latin letters (up to 40 characters).' },
    { pattern: /^السائق (\d+): الاسمان بالحروف اللاتينية \(حتى 40 حرفاً\)\.$/u, en: 'Driver $1: both names in Latin letters (up to 40 characters).' },
    { pattern: /^الطفل (\d+): تاريخ ميلاد صالح بصيغة YYYY-MM-DD\.$/u, en: 'Child $1: a valid date of birth in YYYY-MM-DD format.' },
    { pattern: /^الطفل (\d+): تاريخ الميلاد بعد تاريخ السفر\.$/u, en: 'Child $1: date of birth is after the travel date.' },
    { pattern: /^الطفل (\d+): عمره (\d+) سنة يوم السفر — يُحجز ضمن البالغين\.$/u, en: 'Child $1: aged $2 on the travel date — must be booked as an adult.' },
    { pattern: /^تواريخ ميلاد الأطفال يجب أن تكون قائمة\.$/u, en: "Children's dates of birth must be a list." },
    { pattern: /^أرسل childrenDobs \(تواريخ ميلاد الأطفال\) بدل children — سعر تذكرة الطفل يتبع عمره يوم السفر\.$/u,
        en: "Send childrenDobs (children's dates of birth) instead of children — a child's fare follows their age on the travel date." },
    // التواصل
    { pattern: /^بريد تواصل صالح مطلوب\.$/u, en: 'A valid contact email is required.' },
    { pattern: /^هاتف بصيغة دولية يبدأ بـ\+ ورمز الدولة \(مثل \+966501234567\)\.$/u, en: 'Phone in international format starting with + and the country code (e.g. +966501234567).' },
    { pattern: /^(\d+) ليالٍ$/u, en: '$1 nights' },
    { pattern: /^متاح: (\d+) مقاعد$/u, en: 'Available: $1 seats' },
    { pattern: /^🔥 تبقى (\d+) مقاعد فقط$/u, en: '🔥 Only $1 seats left' },
    { pattern: /^إجمالي (\d+) مسافر$/u, en: 'Total for $1 traveller(s)' },
    { pattern: /^(\d+) مسافر$/u, en: '$1 traveller(s)' },
    { pattern: /^⭐ ([\d.]+) · (\d+) مراجعة موثقة$/u, en: '⭐ $1 · $2 verified reviews' },
    { pattern: /^عربون (\d+)% يثبّت مقعدك — الأسماء قبل ([\d-]+)$/u, en: '$1% deposit secures your seat — names due before $2' },
    { pattern: /^عربون (\d+)% الآن$/u, en: '$1% deposit now' },
    { pattern: /^(\d+) بالغ — غرفة مزدوجة$/u, en: '$1 adult(s) — double room' },
    { pattern: /^(\d+) غرفة مفردة/u, en: '$1 single room(s)' },
    { pattern: /^(\d+) طفل$/u, en: '$1 child(ren)' },
    { pattern: /^👥 حتى (\d+)$/u, en: '👥 Up to $1' },
    { pattern: /^⏳ صلاحية السعر حتى (.+)$/u, en: '⏳ Price valid until $1' },
    // سطرا سياسة الإلغاء — الأخصّ أولاً (أول نمط مطابق يفوز)
    { pattern: /^ابتداءً من (.+) تُخصم رسوم يحددها الفندق$/u, en: 'From $1 a fee set by the hotel applies' },
    { pattern: /^ابتداءً من (.+) تُخصم (.+)$/u, en: 'From $1 a charge of $2 applies' },

    // ─── رقائق شفافية المساعد (نصوصها تُبنى في الخادم بأرقام مُدرَجة) ───
    { pattern: /^🔎 (.+) \((\d+) عروض\)$/u, en: '🔎 $1 ($2 offers)' },
    { pattern: /^💰 عرض بسعر (.+)$/u, en: '💰 Offer at $1' },
    { pattern: /^💰 عرض فندق بسعر (.+)$/u, en: '💰 Hotel offer at $1' },
    { pattern: /^💰 عرض سيارة بسعر (.+)$/u, en: '💰 Car offer at $1' },
    { pattern: /^✅ حُجز — المرجع (.+)$/u, en: '✅ Booked — reference $1' },
    { pattern: /^💳 بانتظار الدفع — (.+)$/u, en: '💳 Awaiting payment — $1' },
    { pattern: /^↩️ تعذّر إصدار حجزك — أُعيد المبلغ$/u, en: '↩️ Your booking could not be issued — refunded' },
    // رسائل فشل تُكتب على الحجز في الخادم وقت وقوعها (تبقى مخزَّنة بلغتها)
    { pattern: /^انتهت مهلة الدفع دون سداد — لم يُصدر الحجز ولم تُحاسَب على شيء\.$/u,
        en: 'The payment window expired — nothing was issued and you were not charged.' },
    { pattern: /^انتهت مهلة الدفع \((\d+) دقيقة\) دون سداد — تحررت المقاعد\. احجز من جديد متى شئت\.$/u,
        en: 'The payment window ($1 minutes) expired — the seats were released. Book again whenever you like.' },
    { pattern: /^تعذّر إصدار حجز (.+) بعد الدفع: (.+)$/u, en: 'Could not issue your $1 booking after payment: $2' },
    { pattern: /^تعذّر فتح صفحة الدفع: (.+)$/u, en: 'Could not open the payment page: $1' },
    { pattern: /^تعذّر إصدار الحجز: (.+)$/u, en: 'Could not issue the booking: $1' },
    { pattern: /^✅ حُجز فندق — المرجع (.+)$/u, en: '✅ Hotel booked — reference $1' },
    { pattern: /^✅ حُجزت سيارة — المرجع (.+)$/u, en: '✅ Car booked — reference $1' },
    { pattern: /^↩️ أُلغي الحجز (.+)$/u, en: '↩️ Cancelled booking $1' },
    { pattern: /^↩️ أُلغي حجز الفندق (.+)$/u, en: '↩️ Cancelled hotel booking $1' },
    { pattern: /^↩️ أُلغي حجز السيارة (.+)$/u, en: '↩️ Cancelled car booking $1' },
    { pattern: /^🧳 (\d+) حجوزات$/u, en: '🧳 $1 bookings' },
    { pattern: /^🏨 (.+) \((\d+) فنادق\)$/u, en: '🏨 $1 ($2 hotels)' },
    { pattern: /^🚗 (.+) \((\d+) سيارات\)$/u, en: '🚗 $1 ($2 cars)' },
    { pattern: /^📅 (.+) \((\d+) تواريخ\)$/u, en: '📅 $1 ($2 dates)' },
    { pattern: /^⚠️ (\d+) تعارض محتمل$/u, en: '⚠️ $1 potential conflict(s)' },
    { pattern: /^✅ لا تعارض$/u, en: '✅ No conflicts' },
    { pattern: /^👁️ مراقبة سعر (.+)$/u, en: '👁️ Price watch $1' },
    { pattern: /^👁️ (\d+) مراقبات نشطة$/u, en: '👁️ $1 active watches' },
    { pattern: /^🚫 أُلغيت المراقبة (.+)$/u, en: '🚫 Watch cancelled $1' },
    { pattern: /^🌤️ طقس (.+) \((\d+) أيام\)$/u, en: '🌤️ $1 weather ($2 days)' },
    { pattern: /^📋 ملخص رحلة \((\d+) حجوزات\)$/u, en: '📋 Trip summary ($1 bookings)' },
    { pattern: /^🔀 أجاب (.+) \(حصّة المزوّد الأساسي مؤقتاً ممتلئة\)$/u, en: '🔀 Answered by $1 (primary provider quota temporarily full)' },

    // ─── التنبيهات المخزَّنة (تُكتب بالعربية وقت وقوعها في الخادم — تُترجم
    // عرضاً سطراً سطراً: الواجهة تقسم الجسم بـ<br> فيصير كل سطر عقدة) ───
    { pattern: /^✅ تأكيد حجزك — مرجع (.+)$/u, en: '✅ Booking confirmed — reference $1' },
    { pattern: /^↩️ تم إلغاء حجزك — مرجع (.+)$/u, en: '↩️ Booking cancelled — reference $1' },
    { pattern: /^⚠️ تغيير من شركة الطيران على حجزك — مرجع (.+)$/u, en: '⚠️ Airline change on your booking — reference $1' },
    { pattern: /^🔔 توفّرت مقاعد — (.+)$/u, en: '🔔 Seats available — $1' },
    { pattern: /^💳 اكتمل سداد باقتك — (.+)$/u, en: '💳 Package fully paid — $1' },
    { pattern: /^⏰ تذكير برحلتك — مرجع (.+)$/u, en: '⏰ Trip reminder — reference $1' },
    { pattern: /^(.+) — عربون (\d+)% \((.+)\)$/u, en: '$1 — $2% deposit ($3)' },
    { pattern: /^(.+) — دفع كامل \((.+)\)$/u, en: '$1 — paid in full ($2)' },
    { pattern: /^سداد متبقي (.+) \((.+)\)$/u, en: 'Balance due — $1 ($2)' },
    { pattern: /^تم تأكيد حجزك بنجاح\.$/u, en: 'Your booking was confirmed successfully.' },
    { pattern: /^تم إلغاء حجزك\.$/u, en: 'Your booking was cancelled.' },
    { pattern: /^المرجع: (.+)$/u, en: 'Reference: $1' },
    { pattern: /^الإجمالي: (.+)$/u, en: 'Total: $1' },
    { pattern: /^راجع كل حجوزاتك من بوابة السفر\.$/u, en: 'See all your bookings in the travel portal.' },
    { pattern: /^راجع تفاصيل حجزك من بوابة السفر أو تواصل مع شركة الطيران بالمرجع أعلاه\.$/u,
        en: 'See your booking details in the travel portal, or contact the airline with the reference above.' },
    { pattern: /^أجرت شركة الطيران تغييراً على رحلتك بعد الحجز \(موعد أو مسار\)\.$/u,
        en: 'The airline changed your flight after booking (schedule or route).' },
    { pattern: /^⚠️ وأثر هذا على بقية خطتك:$/u, en: '⚠️ This affects the rest of your plan:' },
    { pattern: /^انخفض سعر (.+) بتاريخ ([\d-]+) إلى (.+)\.$/u, en: 'The price for $1 on $2 dropped to $3.' },
    { pattern: /^\(هدفك كان (.+)\.\)$/u, en: '(Your target was $1.)' },
    { pattern: /^الأسعار تتغيّر باستمرار — احجز من بوابة السفر إن ناسبك\.$/u,
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
