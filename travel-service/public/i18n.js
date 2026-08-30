/**
 * 🌐 i18n.js — جدول ترجمة عربي→(كل لغة) — عربي/إنجليزي/أردو/هولندي
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
 * 🧭 **جدولٌ واحد بعمود لكل لغة — لا جدولٌ منفصل لكل لغة**: كل نص عربي
 * **سطرٌ واحد بعمود لكل لغة**: `'عربي': { en: '...', ur: '...', nl: '...' }`،
 * فإضافة لغة تعني إضافة عمود لا جدولاً موازياً كاملاً، وحذف نصٍّ عربي يحذف
 * سطراً واحداً لا سطراً في كل جدول. **والعربية تبقى خارج الجدول عمداً** —
 * HTML عربي المصدر دوماً (`server.js`)، وهذا أساس أمان الزحف (تصفّح بلا JS
 * يبقى عربياً صحيحاً)؛ إقحام عمود عربي هنا كان يعني تفعيل ترجمةٍ حتى للغة
 * الأصل، وهو عكس القصد. لغةٌ غائب عمودها في مدخلٍ ما تسقط عربياً كما كانت
 * (نفس تدهور «غير المطابق» أعلاه) — لا يلزم ملء كل الأعمدة دفعة واحدة.
 * القواعد النمطية (`_RULES`) والاستبدالات الجزئية (`_SUBS`) بالمبدأ نفسه.
 *
 * 🌍 **الأردية والهولندية** (ثالث ورابع أعمدة، أُضيفتا معاً): جمهور
 * الجاليات المقيمة بالخليج مهملٌ من كبار مواقع السفر رغم سفرهم المتكرر —
 * والأردية أولى لغاته. والهولندية لأن المنشأة المسجِّلة (Nalia Diensten)
 * هولندية الأصل. ترجمةٌ بمساعدة نموذج لغوي لا مراجعة بشرية أصلية — نفس
 * أسلوب الإنجليزية عند إطلاقها، وصفحات الشروط/الخصوصية القانونية تستحق
 * مراجعة ناطقٍ أصلي قبل الاعتماد الكامل عليها قانونياً.
 */
window.JAOLA_I18N_TABLE = {
    // ─── شريط الثقة ─── (المفتاح يشمل الرمز التعبيري: عقدة نصٍّ واحدة)
    '💯 السعر الذي تراه هو ما تدفعه — لا رسوم تُضاف بعد الحجز': { en: '💯 The price you see is the price you pay — no fees added after booking', ur: '💯 جو قیمت آپ دیکھتے ہیں وہی قیمت آپ ادا کرتے ہیں — بکنگ کے بعد کوئی اضافی فیس نہیں', nl: '💯 De prijs die u ziet, is de prijs die u betaalt — geen kosten achteraf toegevoegd' },
    '🎫 شرط الاسترداد يظهر قبل الحجز لا بعده': { en: '🎫 Refund terms shown before you book, not after', ur: '🎫 ریفنڈ کی شرط بکنگ سے پہلے دکھائی جاتی ہے، بعد میں نہیں', nl: '🎫 De terugbetalingsvoorwaarden worden vóór het boeken getoond, niet erna' },
    '🎒 باقاتنا المجدولة مقاعد محجوزة فعلياً — لا عروض تتغيّر تحتك': { en: '🎒 Our scheduled packages hold real seats — not offers that shift under you', ur: '🎒 ہمارے شیڈول شدہ پیکجز میں نشستیں حقیقت میں محفوظ ہیں — ایسی پیشکشیں نہیں جو آپ کے نیچے بدل جائیں', nl: '🎒 Onze geplande pakketten hebben echt gereserveerde stoelen — geen aanbiedingen die onder u veranderen' },

    // ─── الرأس والتبويبات ───
    'بوابة السفر': { en: 'Travel Portal', ur: 'سفری پورٹل', nl: 'Reisportaal' },
    '⚙️ الإدارة': { en: '⚙️ Admin', ur: '⚙️ ایڈمن', nl: '⚙️ Beheer' },
    '🔎 بحث الرحلات': { en: '🔎 Flights', ur: '🔎 پروازیں', nl: '🔎 Vluchten' },
    '🏨 الفنادق': { en: '🏨 Hotels', ur: '🏨 ہوٹلز', nl: '🏨 Hotels' },
    '🎒 باقات جاهزة': { en: '🎒 Packages', ur: '🎒 پیکجز', nl: '🎒 Pakketten' },
    '🎁 ركّب باقتك': { en: '🎁 Build a bundle', ur: '🎁 اپنا پیکج بنائیں', nl: '🎁 Stel een pakket samen' },
    '🗺️ وجهات مقترحة': { en: '🗺️ Suggested destinations', ur: '🗺️ تجویز کردہ منزلیں', nl: '🗺️ Voorgestelde bestemmingen' },
    '🚗 سيارات': { en: '🚗 Cars', ur: '🚗 گاڑیاں', nl: '🚗 Auto’s' },
    '🧳 رحلاتي': { en: '🧳 My trips', ur: '🧳 میرے سفر', nl: '🧳 Mijn reizen' },
    '🔔 التنبيهات': { en: '🔔 Notifications', ur: '🔔 اطلاعات', nl: '🔔 Meldingen' },
    '🤖 المساعد': { en: '🤖 Assistant', ur: '🤖 اسسٹنٹ', nl: '🤖 Assistent' },
    '💵 العملة الأصلية': { en: '💵 Original currency', ur: '💵 اصل کرنسی', nl: '💵 Oorspronkelijke valuta' },

    // ─── نموذج بحث الرحلات ───
    '✈️ ذهاب / عودة': { en: '✈️ One-way / round-trip', ur: '✈️ یک طرفہ / راؤنڈ ٹرپ', nl: '✈️ Enkele reis / retour' },
    '🗺️ ملتي سيتي': { en: '🗺️ Multi-city', ur: '🗺️ ملٹی سٹی', nl: '🗺️ Multi-stad' },
    '+ أضف محطة': { en: '+ Add a stop', ur: '+ اسٹاپ شامل کریں', nl: '+ Voeg een tussenstop toe' },
    'التاريخ': { en: 'Date', ur: 'تاریخ', nl: 'Datum' },
    '✕ إزالة': { en: '✕ Remove', ur: '✕ ہٹائیں', nl: '✕ Verwijderen' },
    'من': { en: 'From', ur: 'سے', nl: 'Van' },
    'إلى': { en: 'To', ur: 'تک', nl: 'Naar' },
    'تاريخ الذهاب': { en: 'Departure date', ur: 'روانگی کی تاریخ', nl: 'Vertrekdatum' },
    'العودة (اختياري)': { en: 'Return (optional)', ur: 'واپسی (اختیاری)', nl: 'Terugkeer (optioneel)' },
    'بالغون': { en: 'Adults', ur: 'بالغ افراد', nl: 'Volwassenen' },
    'أطفال (دون 18)': { en: 'Children (under 18)', ur: 'بچے (18 سال سے کم)', nl: 'Kinderen (onder 18)' },
    'الدرجة': { en: 'Cabin', ur: 'کلاس', nl: 'Klasse' },
    'الترتيب': { en: 'Sort', ur: 'ترتیب', nl: 'Sorteren' },
    'اقتصادية': { en: 'Economy', ur: 'اکانومی', nl: 'Economy' },
    'اقتصادية مميزة': { en: 'Premium economy', ur: 'پریمیم اکانومی', nl: 'Premium economy' },
    'رجال الأعمال': { en: 'Business', ur: 'بزنس', nl: 'Business' },
    'الأولى': { en: 'First', ur: 'فرسٹ کلاس', nl: 'Eerste klas' },
    '💰 الأرخص أولاً': { en: '💰 Cheapest first', ur: '💰 پہلے سستی', nl: '💰 Goedkoopste eerst' },
    '⚡ الأسرع أولاً': { en: '⚡ Fastest first', ur: '⚡ پہلے تیز ترین', nl: '⚡ Snelste eerst' },
    '🔎 ابحث': { en: '🔎 Search', ur: '🔎 تلاش کریں', nl: '🔎 Zoeken' },
    '📅 تقويم الأسعار': { en: '📅 Price calendar', ur: '📅 قیمتوں کا کیلنڈر', nl: '📅 Prijskalender' },
    '🔍 فلاتر البحث (توقفات · شركة · أمتعة · سقف سعر)': { en: '🔍 Search filters (stops · airline · baggage · max price)', ur: '🔍 تلاش کے فلٹرز (اسٹاپس · ایئرلائن · سامان · زیادہ سے زیادہ قیمت)', nl: '🔍 Zoekfilters (tussenstops · maatschappij · bagage · maximumprijs)' },
    '🧳 حقيبة مسجَّلة مشمولة فقط': { en: '🧳 Only fares including a checked bag', ur: '🧳 صرف چیک اِن بیگ شامل والی پروازیں', nl: '🧳 Alleen met incheckbagage' },
    'تبقى الرحلات التي لم يصرّح ناقلها بالأمتعة، موسومةً «غير مصرَّحة» — إخفاؤها يُظهر «لا نتائج» حيث توجد رحلات.': { en: 'Flights whose carrier did not declare baggage are kept and marked “not declared” — hiding them would show “no results” where flights exist.', ur: 'وہ پروازیں جن کی ایئرلائن نے سامان کا اعلان نہیں کیا، انہیں "غیر اعلان شدہ" کے لیبل کے ساتھ باقی رکھا جاتا ہے — انہیں چھپانے سے وہاں "کوئی نتیجہ نہیں" ظاہر ہوگا جہاں پروازیں موجود ہیں۔', nl: 'Vluchten waarvan de maatschappij geen bagage heeft opgegeven, blijven zichtbaar met het label "niet opgegeven" — ze verbergen zou "geen resultaten" tonen waar wel vluchten zijn.' },
    'التوقفات': { en: 'Stops', ur: 'اسٹاپس', nl: 'Tussenstops' },
    'أي عدد': { en: 'Any', ur: 'کوئی بھی تعداد', nl: 'Elk aantal' },
    '✈️ مباشر فقط': { en: '✈️ Direct only', ur: '✈️ صرف براہ راست', nl: '✈️ Alleen direct' },
    'توقف واحد كحد أقصى': { en: 'Max one stop', ur: 'زیادہ سے زیادہ ایک اسٹاپ', nl: 'Maximaal één tussenstop' },
    'شركة الطيران (اسم أو رمز)': { en: 'Airline (name or code)', ur: 'ایئرلائن (نام یا کوڈ)', nl: 'Luchtvaartmaatschappij (naam of code)' },
    'سقف السعر': { en: 'Max price', ur: 'زیادہ سے زیادہ قیمت', nl: 'Maximumprijs' },
    'بلا سقف': { en: 'No cap', ur: 'کوئی حد نہیں', nl: 'Geen limiet' },
    'الرياض أو RUH': { en: 'Riyadh or RUH', ur: 'ریاض یا RUH', nl: 'Riyad of RUH' },
    'القاهرة أو CAI': { en: 'Cairo or CAI', ur: 'قاہرہ یا CAI', nl: 'Caïro of CAI' },
    'دبي أو DXB': { en: 'Dubai or DXB', ur: 'دبئی یا DXB', nl: 'Dubai of DXB' },

    // ─── الفنادق والسيارات ───
    'الوجهة': { en: 'Destination', ur: 'منزل', nl: 'Bestemming' },
    'تاريخ الوصول': { en: 'Check-in date', ur: 'چیک اِن کی تاریخ', nl: 'Inchekdatum' },
    'تاريخ المغادرة': { en: 'Check-out date', ur: 'چیک آؤٹ کی تاریخ', nl: 'Uitchekdatum' },
    'الغرف': { en: 'Rooms', ur: 'کمرے', nl: 'Kamers' },
    'موقع الاستلام': { en: 'Pickup location', ur: 'وصولی کا مقام', nl: 'Ophaallocatie' },
    'تاريخ الاستلام': { en: 'Pickup date', ur: 'وصولی کی تاریخ', nl: 'Ophaaldatum' },
    'وقت الاستلام': { en: 'Pickup time', ur: 'وصولی کا وقت', nl: 'Ophaaltijd' },
    'تاريخ التسليم': { en: 'Drop-off date', ur: 'واپسی کی تاریخ', nl: 'Inleverdatum' },
    'وقت التسليم': { en: 'Drop-off time', ur: 'واپسی کا وقت', nl: 'Inlevertijd' },
    '▾ تفاصيل الفندق والسياسات': { en: '▾ Hotel details & policies', ur: '▾ ہوٹل کی تفصیلات اور پالیسیاں', nl: '▾ Hoteldetails & beleid' },
    '▾ تفاصيل الرحلة والأمتعة': { en: '▾ Flight details & baggage', ur: '▾ پرواز کی تفصیلات اور سامان', nl: '▾ Vluchtdetails & bagage' },
    'سياسة الإلغاء': { en: 'Cancellation policy', ur: 'منسوخی کی پالیسی', nl: 'Annuleringsbeleid' },

    // ─── الباقات الجاهزة ───
    'احجز الآن': { en: 'Book now', ur: 'ابھی بک کریں', nl: 'Nu boeken' },
    'احجز الباقة': { en: 'Book package', ur: 'پیکج بک کریں', nl: 'Pakket boeken' },
    '🔔 أبلغني عند التوفّر': { en: '🔔 Notify me when available', ur: '🔔 دستیاب ہونے پر مطلع کریں', nl: '🔔 Meld mij wanneer beschikbaar' },
    'اكتملت المقاعد': { en: 'Sold out', ur: 'نشستیں مکمل ہو گئیں', nl: 'Uitverkocht' },
    'اسم قائد المجموعة': { en: 'Lead traveller name', ur: 'گروپ لیڈر کا نام', nl: 'Naam van de groepsleider' },
    'بالغون (غرفة مزدوجة)': { en: 'Adults (double room)', ur: 'بالغ افراد (ڈبل روم)', nl: 'Volwassenen (tweepersoonskamer)' },
    'غرف مفردة': { en: 'Single rooms', ur: 'سنگل کمرے', nl: 'Eenpersoonskamers' },
    'أطفال': { en: 'Children', ur: 'بچے', nl: 'Kinderen' },
    'أكّد الحجز': { en: 'Confirm booking', ur: 'بکنگ کی تصدیق کریں', nl: 'Boeking bevestigen' },
    'أكّد حجز الباقة': { en: 'Confirm package booking', ur: 'پیکج بکنگ کی تصدیق کریں', nl: 'Pakketboeking bevestigen' },
    'التاريخ التقريبي': { en: 'Approximate date', ur: 'تخمینی تاریخ', nl: 'Geschatte datum' },
    'المسافرون': { en: 'Travellers', ur: 'مسافر', nl: 'Reizigers' },
    'بريد أو هاتف': { en: 'Email or phone', ur: 'ای میل یا فون', nl: 'E-mail of telefoon' },
    'إرسال الطلب': { en: 'Send request', ur: 'درخواست بھیجیں', nl: 'Aanvraag versturen' },
    'الاسم الكامل': { en: 'Full name', ur: 'مکمل نام', nl: 'Volledige naam' },
    'أنطاليا': { en: 'Antalya', ur: 'انطالیہ', nl: 'Antalya' },

    // ─── المراجعات والولاء ───
    'تقييمك': { en: 'Your rating', ur: 'آپ کی درجہ بندی', nl: 'Uw beoordeling' },
    'عنوان (اختياري)': { en: 'Title (optional)', ur: 'عنوان (اختیاری)', nl: 'Titel (optioneel)' },
    'تجربتك (اختياري)': { en: 'Your experience (optional)', ur: 'آپ کا تجربہ (اختیاری)', nl: 'Uw ervaring (optioneel)' },
    'نشر المراجعة': { en: 'Publish review', ur: 'جائزہ شائع کریں', nl: 'Beoordeling plaatsen' },
    '⭐ مراجعات موثقة': { en: '⭐ Verified reviews', ur: '⭐ تصدیق شدہ جائزے', nl: '⭐ Geverifieerde beoordelingen' },
    '🎁 برنامج الولاء': { en: '🎁 Loyalty program', ur: '🎁 وفاداری پروگرام', nl: '🎁 Loyaliteitsprogramma' },

    // ─── الحجز والمسافرون ───
    'اللقب': { en: 'Title', ur: 'خطاب', nl: 'Titel' },
    'الاسم الأول (لاتيني)': { en: 'First name (Latin)', ur: 'پہلا نام (لاطینی حروف میں)', nl: 'Voornaam (Latijns)' },
    'اسم العائلة (لاتيني)': { en: 'Family name (Latin)', ur: 'خاندانی نام (لاطینی حروف میں)', nl: 'Achternaam (Latijns)' },
    'تاريخ الميلاد': { en: 'Date of birth', ur: 'تاریخ پیدائش', nl: 'Geboortedatum' },
    'الجنس': { en: 'Gender', ur: 'جنس', nl: 'Geslacht' },
    'ذكر': { en: 'Male', ur: 'مرد', nl: 'Man' },
    'أنثى': { en: 'Female', ur: 'عورت', nl: 'Vrouw' },
    'البريد الإلكتروني': { en: 'Email', ur: 'ای میل ایڈریس', nl: 'E-mailadres' },
    'الهاتف (بصيغة دولية)': { en: 'Phone (international format)', ur: 'فون نمبر (بین الاقوامی فارمیٹ میں)', nl: 'Telefoon (internationaal formaat)' },
    'البريد': { en: 'Email', ur: 'ای میل', nl: 'E-mail' },
    'الهاتف': { en: 'Phone', ur: 'فون', nl: 'Telefoon' },
    '— اختر مسافراً محفوظاً —': { en: '— Pick a saved traveller —', ur: '— محفوظ شدہ مسافر منتخب کریں —', nl: '— Kies een opgeslagen reiziger —' },

    // ─── أزرار عامة ───
    'إغلاق': { en: 'Close', ur: 'بند کریں', nl: 'Sluiten' },
    'إلغاء': { en: 'Cancel', ur: 'منسوخ کریں', nl: 'Annuleren' },
    'إلغاء الحجز': { en: 'Cancel booking', ur: 'بکنگ منسوخ کریں', nl: 'Boeking annuleren' },
    'احجز': { en: 'Book', ur: 'بک کریں', nl: 'Boeken' },
    'أرسل': { en: 'Send', ur: 'بھیجیں', nl: 'Verzenden' },
    'حفظ': { en: 'Save', ur: 'محفوظ کریں', nl: 'Opslaan' },
    'حذف': { en: 'Delete', ur: 'حذف کریں', nl: 'Verwijderen' },
    'إزالة': { en: 'Remove', ur: 'ہٹائیں', nl: 'Verwijderen' },
    'دخول': { en: 'Sign in', ur: 'لاگ اِن', nl: 'Inloggen' },
    'حفظ التفضيلات': { en: 'Save preferences', ur: 'ترجیحات محفوظ کریں', nl: 'Voorkeuren opslaan' },
    'تعليم الكل كمقروء': { en: 'Mark all read', ur: 'سب کو پڑھا ہوا نشان زد کریں', nl: 'Alles als gelezen markeren' },

    // ─── نافذة الدخول/التسجيل + بوابة الجلسة + الترويسة ───
    '🔐 دخول': { en: '🔐 Sign in', ur: '🔐 لاگ اِن', nl: '🔐 Inloggen' },
    '🚪 خروج': { en: '🚪 Sign out', ur: '🚪 لاگ آؤٹ', nl: '🚪 Uitloggen' },
    '🔐 انتهت جلستك — سجّل دخولك من جديد للوصول إلى حجوزاتك.': { en: '🔐 Your session has ended — sign in again to access your bookings.', ur: '🔐 آپ کا سیشن ختم ہو گیا ہے — اپنی بکنگز تک رسائی کے لیے دوبارہ لاگ اِن کریں۔', nl: '🔐 Uw sessie is verlopen — log opnieuw in om toegang te krijgen tot uw boekingen.' },
    '🔐 الحجز يحتاج حساباً': { en: '🔐 Booking requires an account', ur: '🔐 بکنگ کے لیے اکاؤنٹ درکار ہے', nl: '🔐 Boeken vereist een account' },
    'تصفّحُ الأسعار مفتوح للجميع، أمّا الحجز فيحتاج حساباً لتصل إليك التذكرة والتأكيد، وتجد حجزك في «رحلاتي» لاحقاً.': { en: 'Browsing prices is open to everyone — booking requires an account so your ticket and confirmation reach you, and you can find your booking later under "My trips."', ur: 'قیمتیں دیکھنا سب کے لیے کھلا ہے، لیکن بکنگ کے لیے اکاؤنٹ درکار ہے تاکہ آپ کی ٹکٹ اور تصدیق آپ تک پہنچے، اور آپ بعد میں اپنی بکنگ "میرے سفر" میں دیکھ سکیں۔', nl: 'Prijzen bekijken staat voor iedereen open — boeken vereist een account, zodat uw ticket en bevestiging u bereiken en u uw boeking later terugvindt onder "Mijn reizen".' },
    'تسجيل الدخول': { en: 'Sign in', ur: 'لاگ اِن کریں', nl: 'Inloggen' },
    'حساب جديد': { en: 'New account', ur: 'نیا اکاؤنٹ', nl: 'Nieuw account' },
    '🔑 استعادة كلمة المرور': { en: '🔑 Reset password', ur: '🔑 پاس ورڈ کی بحالی', nl: '🔑 Wachtwoord herstellen' },
    'اكتب بريدك المسجَّل وسنرسل إليك رابطاً لاختيار كلمة مرور جديدة. الرابط صالح ٣٠ دقيقة ويعمل مرة واحدة.': { en: "Enter your registered email and we'll send you a link to choose a new password. The link is valid for 30 minutes and works once.", ur: 'اپنا رجسٹرڈ ای میل درج کریں، ہم آپ کو نیا پاس ورڈ منتخب کرنے کے لیے ایک لنک بھیجیں گے۔ یہ لنک 30 منٹ تک درست رہتا ہے اور صرف ایک بار استعمال ہوتا ہے۔', nl: 'Voer uw geregistreerde e-mailadres in en we sturen u een link om een nieuw wachtwoord te kiezen. De link is 30 minuten geldig en werkt eenmalig.' },
    '🔑 اختر كلمة مرور جديدة': { en: '🔑 Choose a new password', ur: '🔑 نیا پاس ورڈ منتخب کریں', nl: '🔑 Kies een nieuw wachtwoord' },
    'اختر كلمة مرور جديدة لحسابك. سندخلك مباشرةً بعد الحفظ.': { en: "Choose a new password for your account. You'll be signed in immediately after saving.", ur: 'اپنے اکاؤنٹ کے لیے نیا پاس ورڈ منتخب کریں۔ محفوظ کرنے کے بعد آپ فوراً لاگ اِن ہو جائیں گے۔', nl: 'Kies een nieuw wachtwoord voor uw account. U wordt direct ingelogd na het opslaan.' },
    'الاسم': { en: 'Name', ur: 'نام', nl: 'Naam' },
    'اسمك': { en: 'Your name', ur: 'آپ کا نام', nl: 'Uw naam' },
    'كلمة المرور': { en: 'Password', ur: 'پاس ورڈ', nl: 'Wachtwoord' },
    'كلمة المرور الجديدة': { en: 'New password', ur: 'نیا پاس ورڈ', nl: 'Nieuw wachtwoord' },
    '٨ أحرف على الأقل': { en: 'At least 8 characters', ur: 'کم از کم 8 حروف', nl: 'Minimaal 8 tekens' },
    'أعد كتابة كلمة المرور': { en: 'Confirm password', ur: 'پاس ورڈ دوبارہ لکھیں', nl: 'Bevestig wachtwoord' },
    'نفس الكلمة مرة أخرى': { en: 'Same password again', ur: 'وہی پاس ورڈ دوبارہ', nl: 'Hetzelfde wachtwoord nogmaals' },
    'أنشئ الحساب': { en: 'Create account', ur: 'اکاؤنٹ بنائیں', nl: 'Account aanmaken' },
    'أرسل رابط الاستعادة': { en: 'Send reset link', ur: 'بحالی کا لنک بھیجیں', nl: 'Herstellink versturen' },
    'احفظ وادخل': { en: 'Save and sign in', ur: 'محفوظ کریں اور لاگ اِن کریں', nl: 'Opslaan en inloggen' },
    'أكمل التصفّح': { en: 'Continue browsing', ur: 'براؤزنگ جاری رکھیں', nl: 'Verder bladeren' },
    'نسيت كلمة المرور؟': { en: 'Forgot your password?', ur: 'پاس ورڈ بھول گئے؟', nl: 'Wachtwoord vergeten?' },
    '← العودة لتسجيل الدخول': { en: '← Back to sign in', ur: '← لاگ اِن پر واپس جائیں', nl: '← Terug naar inloggen' },
    '— أو —': { en: '— or —', ur: '— یا —', nl: '— of —' },
    // رسائل تحقق العميل (submitAuth/onGoogleCredential في index.html)
    'أدخل بريدك المسجَّل.': { en: 'Enter your registered email.', ur: 'اپنا رجسٹرڈ ای میل درج کریں۔', nl: 'Voer uw geregistreerde e-mailadres in.' },
    'أدخل كلمة المرور الجديدة.': { en: 'Enter your new password.', ur: 'نیا پاس ورڈ درج کریں۔', nl: 'Voer het nieuwe wachtwoord in.' },
    'أدخل البريد وكلمة المرور.': { en: 'Enter your email and password.', ur: 'ای میل اور پاس ورڈ درج کریں۔', nl: 'Voer e-mail en wachtwoord in.' },
    'الكلمتان غير متطابقتين — أعد كتابتهما.': { en: "The passwords don't match — enter them again.", ur: 'دونوں پاس ورڈ مماثل نہیں ہیں — دوبارہ درج کریں۔', nl: 'De wachtwoorden komen niet overeen — voer ze opnieuw in.' },
    'تعذّر إتمام الطلب — حاول مجدداً.': { en: "Couldn't complete the request — try again.", ur: 'درخواست مکمل نہیں ہو سکی — دوبارہ کوشش کریں۔', nl: 'Kon het verzoek niet voltooien — probeer het opnieuw.' },
    'تعذّر الاتصال بالخادم — تحقق من اتصالك.': { en: "Couldn't reach the server — check your connection.", ur: 'سرور سے رابطہ نہیں ہو سکا — اپنا انٹرنیٹ کنکشن چیک کریں۔', nl: 'Kon geen verbinding maken met de server — controleer uw verbinding.' },
    'إن كان هذا البريد مسجَّلاً فستصلك رسالة بها رابط إعادة التعيين.': { en: "If this email is registered, you'll receive a message with a reset link.", ur: 'اگر یہ ای میل رجسٹرڈ ہے تو آپ کو ری سیٹ لنک کے ساتھ ایک پیغام موصول ہوگا۔', nl: 'Als dit e-mailadres geregistreerd is, ontvangt u een bericht met een link om het wachtwoord opnieuw in te stellen.' },
    'تعذّر الدخول بحساب جوجل — حاول مجدداً.': { en: "Couldn't sign in with Google — try again.", ur: 'گوگل اکاؤنٹ سے لاگ اِن ناکام ہوا — دوبارہ کوشش کریں۔', nl: 'Inloggen met Google is mislukt — probeer het opnieuw.' },

    // ─── التنبيهات والملف ───
    '🔔 تنبيهاتك': { en: '🔔 Your notifications', ur: '🔔 آپ کی اطلاعات', nl: '🔔 Uw meldingen' },
    'مطار الانطلاق المعتاد': { en: 'Usual departure airport', ur: 'معمول کا روانگی ایئرپورٹ', nl: 'Gebruikelijke vertrekluchthaven' },
    '💬 رقم واتساب (بصيغة دولية)': { en: '💬 WhatsApp number (international)', ur: '💬 واٹس ایپ نمبر (بین الاقوامی فارمیٹ میں)', nl: '💬 WhatsApp-nummer (internationaal formaat)' },
    'الدرجة المفضّلة': { en: 'Preferred cabin', ur: 'پسندیدہ کلاس', nl: 'Voorkeursklasse' },
    '— بلا تفضيل —': { en: '— No preference —', ur: '— کوئی ترجیح نہیں —', nl: '— Geen voorkeur —' },
    'الوسم': { en: 'Label', ur: 'لیبل', nl: 'Label' },
    'أنا / زوجتي': { en: 'Me / spouse', ur: 'میں / میری بیوی', nl: 'Ik / mijn vrouw' },

    // ─── حالات الحجز وأنواعه (نصوص مولَّدة بالجافاسكربت) ───
    '💳 سدّد المتبقي الآن': { en: '💳 Pay balance now', ur: '💳 بقایا رقم ابھی ادا کریں', nl: '💳 Betaal het resterende bedrag nu' },
    '💳 بانتظار إتمام الدفع — مقاعدك محجوزة، وتتحرر إن انتهت مهلة الدفع.': { en: '💳 Awaiting payment — your seats are held and release if the payment window expires.', ur: '💳 ادائیگی کا انتظار — آپ کی نشستیں محفوظ ہیں، اور ادائیگی کی مدت ختم ہونے پر خالی ہو جائیں گی۔', nl: '💳 Wachten op betaling — uw stoelen zijn gereserveerd en worden vrijgegeven als de betalingstermijn verstrijkt.' },
    '💳 بانتظار إتمام الدفع — لا يُصدر الحجز قبل السداد، ولن تُحاسَب إن لم تُكمله.':
        { en: '💳 Awaiting payment — nothing is issued before payment, and you are not charged if you do not complete it.', ur: '💳 ادائیگی کا انتظار — ادائیگی سے پہلے بکنگ جاری نہیں ہوگی، اور اگر آپ اسے مکمل نہ کریں تو آپ سے کوئی رقم نہیں لی جائے گی۔', nl: '💳 Wachten op betaling — de boeking wordt pas uitgegeven na betaling, en er wordt niets in rekening gebracht als u niet afrondt.' },
    'مُصدَر ✅': { en: 'Issued ✅', ur: 'جاری شدہ ✅', nl: 'Uitgegeven ✅' },
    'قيد الإصدار': { en: 'Issuing', ur: 'اجرا کے مرحلے میں', nl: 'Wordt uitgegeven' },
    'فشل': { en: 'Failed', ur: 'ناکام', nl: 'Mislukt' },
    'مُلغى': { en: 'Cancelled', ur: 'منسوخ شدہ', nl: 'Geannuleerd' },
    'باقة مجدولة': { en: 'Fixed package', ur: 'شیڈول شدہ پیکج', nl: 'Gepland pakket' },
    '↩️ قابل للإلغاء': { en: '↩️ Cancellable', ur: '↩️ منسوخ کے قابل', nl: '↩️ Annuleerbaar' },
    '⛔ غير قابل للاسترداد': { en: '⛔ Non-refundable', ur: '⛔ ناقابلِ واپسی', nl: '⛔ Niet-restitueerbaar' },
    'سعر خاص متعاقَد': { en: 'Contracted special rate', ur: 'خصوصی معاہداتی قیمت', nl: 'Speciaal contracttarief' },
    'الإلغاء قبل أول موعد أعلاه مجاني.': { en: 'Free cancellation before the first date above.', ur: 'اوپر دی گئی پہلی تاریخ سے پہلے منسوخی مفت ہے۔', nl: 'Annuleren vóór de eerste datum hierboven is gratis.' },
    '⛔ حجز غير قابل للاسترداد — لا إلغاء مجاني.': { en: '⛔ Non-refundable booking — no free cancellation.', ur: '⛔ ناقابلِ واپسی بکنگ — کوئی مفت منسوخی نہیں۔', nl: '⛔ Niet-restitueerbare boeking — geen gratis annulering.' },

    // ─── مقدمات الأقسام والشرائط ───
    '🎒 فندق متعاقَد + مقاعد طيران محجوزة مسبقاً — سعر نهائي واحد وتأكيد فوري. احجز بعربون وسلّم الأسماء قبل الإقلاع بأسبوعين.':
        { en: '🎒 Contracted hotel + pre-blocked flight seats — one final price, instant confirmation. Book with a deposit, submit names two weeks before departure.', ur: '🎒 معاہداتی ہوٹل + پہلے سے محفوظ پرواز کی نشستیں — ایک حتمی قیمت، فوری تصدیق۔ ایڈوانس کے ساتھ بک کریں اور روانگی سے دو ہفتے پہلے نام جمع کرائیں۔', nl: '🎒 Contracthotel + vooraf geblokkeerde vliegstoelen — één vaste prijs, directe bevestiging. Boek met een aanbetaling en lever de namen twee weken voor vertrek aan.' },
    '🎯 ما ناسبك تاريخ أو وجهة؟': { en: "🎯 Dates or destination don't fit?", ur: '🎯 کوئی تاریخ یا منزل موزوں نہیں؟', nl: '🎯 Geen datum of bestemming die past?' },
    'اطلب عرضاً خاصاً ويجهّز لك فريقنا باقة على مقاسك.': { en: 'Request a custom offer and our team will tailor a package for you.', ur: 'خصوصی پیشکش کی درخواست کریں، ہماری ٹیم آپ کے لیے مخصوص پیکج تیار کرے گی۔', nl: 'Vraag een offerte op maat aan en ons team stelt een pakket voor u samen.' },
    '✨ وجهات مقترحة من مطارك': { en: '✨ Suggested from your airport', ur: '✨ آپ کے ایئرپورٹ سے تجویز کردہ', nl: '✨ Voorgesteld vanaf uw luchthaven' },
    'اختيارٌ من فريقنا — والسعر أرخص ما وجدناه اليوم، ذهاب فقط بعد ٣٠ يوماً': { en: 'Picked by our team — price is the cheapest we found today, one-way, 30 days out', ur: 'ہماری ٹیم کا انتخاب — اور قیمت آج ملنے والی سب سے سستی قیمت ہے، صرف ایک طرفہ، 30 دن بعد', nl: 'Geselecteerd door ons team — de prijs is de goedkoopste die we vandaag vonden, enkele reis over 30 dagen' },
    '🏨 أضف فنادق الوجهة (تفتح في صفحة منفصلة)': { en: '🏨 Add destination hotels (opens separately)', ur: '🏨 منزل کے ہوٹلز شامل کریں (الگ صفحے میں کھلتا ہے)', nl: '🏨 Voeg hotels op bestemming toe (opent apart)' },
    'الباقة ذهاب وعودة — حدّد التاريخين، فالفندق يُحجز بينهما.': { en: 'Bundles are round-trip — set both dates; the hotel spans them.', ur: 'پیکج راؤنڈ ٹرپ ہے — دونوں تاریخیں مقرر کریں، ہوٹل ان کے درمیان بک ہوگا۔', nl: 'Het pakket is heen en terug — stel beide data in; het hotel wordt daartussen geboekt.' },
    '🪪 أسماء بقية المسافرين تُسلَّم قبل الإقلاع بأسبوعين — لا تلزم الآن.': { en: '🪪 Remaining traveller names are due two weeks before departure — not now.', ur: '🪪 باقی مسافروں کے نام روانگی سے دو ہفتے پہلے جمع کرائے جاتے ہیں — ابھی ضروری نہیں۔', nl: '🪪 De namen van de overige reizigers worden twee weken voor vertrek aangeleverd — nu niet nodig.' },
    'عربون الآن والباقي لاحقاً': { en: 'Deposit now, balance later', ur: 'ابھی ایڈوانس، باقی بعد میں', nl: 'Nu aanbetalen, rest later' },
    'دفع كامل': { en: 'Pay in full', ur: 'مکمل ادائیگی', nl: 'Volledig betalen' },

    // ─── رسائل فارغ/خطأ/انتظار (مولَّدة) ───
    'لا رحلات متاحة لهذا البحث.': { en: 'No flights available for this search.', ur: 'اس تلاش کے لیے کوئی پرواز دستیاب نہیں۔', nl: 'Geen vluchten beschikbaar voor deze zoekopdracht.' },
    'لا رحلات لهذا البحث.': { en: 'No flights for this search.', ur: 'اس تلاش کے لیے کوئی پرواز نہیں۔', nl: 'Geen vluchten voor deze zoekopdracht.' },
    'لا فنادق متاحة لهذه الوجهة/التواريخ.': { en: 'No hotels for this destination/dates.', ur: 'اس منزل/تاریخوں کے لیے کوئی ہوٹل دستیاب نہیں۔', nl: 'Geen hotels beschikbaar voor deze bestemming/data.' },
    'لا فنادق قابلة للإلغاء لهذه التواريخ — شرط الباقة.': { en: 'No cancellable hotels for these dates — a bundle requirement.', ur: 'ان تاریخوں کے لیے کوئی منسوخ کے قابل ہوٹل نہیں — یہ پیکج کی شرط ہے۔', nl: 'Geen annuleerbare hotels voor deze data — een pakketvereiste.' },
    'لا سيارات متاحة لهذا البحث.': { en: 'No cars available for this search.', ur: 'اس تلاش کے لیے کوئی گاڑی دستیاب نہیں۔', nl: 'Geen auto’s beschikbaar voor deze zoekopdracht.' },
    'لا حجوزات بعد — ابدأ من تبويب البحث أو اطلب من المساعد.': { en: 'No bookings yet — start from Search or ask the assistant.', ur: 'ابھی تک کوئی بکنگ نہیں — تلاش کے ٹیب سے شروع کریں یا اسسٹنٹ سے پوچھیں۔', nl: 'Nog geen boekingen — begin bij het tabblad Zoeken of vraag het de assistent.' },
    'لا تنبيهات بعد — ستصلك هنا تأكيدات حجوزاتك وتغييرات شركات الطيران وانخفاضات الأسعار.': { en: 'No notifications yet — booking confirmations, airline changes and price drops arrive here.', ur: 'ابھی تک کوئی اطلاع نہیں — یہاں آپ کو بکنگ کی تصدیق، ایئرلائن کی تبدیلیاں اور قیمتوں میں کمی کی اطلاعات ملیں گی۔', nl: 'Nog geen meldingen — hier ontvangt u bevestigingen van uw boekingen, wijzigingen van luchtvaartmaatschappijen en prijsdalingen.' },
    'لا انطلاقات معلنة حالياً — اطلب عرضاً خاصاً أدناه وسنوافيك.': { en: 'No departures announced yet — request a custom offer below.', ur: 'فی الحال کوئی اعلان شدہ روانگی نہیں — نیچے خصوصی پیشکش کی درخواست کریں، ہم آپ سے رابطہ کریں گے۔', nl: 'Momenteel geen aangekondigde vertrekken — vraag hieronder een offerte op maat aan en we nemen contact op.' },
    'لا باقات في مفضلتك بعد — اضغط ♡ على أي باقة.': { en: 'No wishlisted packages yet — tap ♡ on any package.', ur: 'ابھی تک آپ کی پسندیدہ فہرست میں کوئی پیکج نہیں — کسی بھی پیکج پر ♡ دبائیں۔', nl: 'Nog geen pakketten in uw favorieten — tik op ♡ bij een pakket.' },
    'لا مراجعات بعد — كن أول من يشارك تجربته.': { en: 'No reviews yet — be the first to share.', ur: 'ابھی تک کوئی جائزہ نہیں — اپنا تجربہ شیئر کرنے والے پہلے شخص بنیں۔', nl: 'Nog geen beoordelingen — wees de eerste die zijn ervaring deelt.' },
    'لا تفاصيل إضافية من المزوّد.': { en: 'No extra details from the provider.', ur: 'فراہم کنندہ کی طرف سے کوئی اضافی تفصیلات نہیں۔', nl: 'Geen extra details van de aanbieder.' },
    'لا مطار مغطّى بهذا الاسم — جرّب اسم مدينة أو دولة أخرى.': { en: 'No covered airport by that name — try another city or country.', ur: 'اس نام کا کوئی ایئرپورٹ موجود نہیں — کسی اور شہر یا ملک کا نام آزمائیں۔', nl: 'Geen gedekte luchthaven met deze naam — probeer een andere stad of ander land.' },
    '⏳ جارٍ جلب تفاصيل الفندق…': { en: '⏳ Fetching hotel details…', ur: '⏳ ہوٹل کی تفصیلات حاصل کی جا رہی ہیں…', nl: '⏳ Hoteldetails ophalen…' },
    'جارٍ الحساب...': { en: 'Calculating...', ur: 'حساب کیا جا رہا ہے...', nl: 'Berekenen...' },
    '📅 نجمع أرخص سعر لكل يوم — لحظات...': { en: '📅 Collecting the cheapest price per day — moments...', ur: '📅 ہر دن کی سب سے سستی قیمت جمع کی جا رہی ہے — چند لمحے...', nl: '📅 We verzamelen de goedkoopste prijs per dag — een moment...' },
    '📅 أرخص سعر لكل يوم (لمسافر واحد) — اضغط يوماً لتبحث به:': { en: '📅 Cheapest per day (one traveller) — tap a day to search it:', ur: '📅 ہر دن کی سب سے سستی قیمت (ایک مسافر کے لیے) — تلاش کے لیے کسی دن پر دبائیں:', nl: '📅 Goedkoopste prijs per dag (voor één reiziger) — tik op een dag om ermee te zoeken:' },
    'تعذّر البحث — حاول مجدداً بعد قليل.': { en: 'Search failed — try again shortly.', ur: 'تلاش ناکام ہوئی — تھوڑی دیر بعد دوبارہ کوشش کریں۔', nl: 'Zoeken mislukt — probeer het straks opnieuw.' },
    'تعذّر بحث الفنادق — حاول مجدداً بعد قليل.': { en: 'Hotel search failed — try again shortly.', ur: 'ہوٹل کی تلاش ناکام ہوئی — تھوڑی دیر بعد دوبارہ کوشش کریں۔', nl: 'Hotelzoekopdracht mislukt — probeer het straks opnieuw.' },
    'تعذّر الاتصال بالخادم — حاول مجدداً.': { en: 'Could not reach the server — try again.', ur: 'سرور سے رابطہ نہیں ہو سکا — دوبارہ کوشش کریں۔', nl: 'Kon geen verbinding maken met de server — probeer het opnieuw.' },
    'تعذّر تحميل الباقات — حدّث الصفحة.': { en: 'Could not load packages — refresh the page.', ur: 'پیکجز لوڈ نہیں ہو سکے — صفحہ ریفریش کریں۔', nl: 'Kon pakketten niet laden — vernieuw de pagina.' },
    'تعذّر تحميل الوجهات — حاول مجدداً بعد قليل.': { en: 'Could not load destinations — try again shortly.', ur: 'منزلیں لوڈ نہیں ہو سکیں — تھوڑی دیر بعد دوبارہ کوشش کریں۔', nl: 'Kon bestemmingen niet laden — probeer het straks opnieuw.' },
    'تعذّر تسعير الباقة — حاول مجدداً.': { en: 'Could not price the bundle — try again.', ur: 'پیکج کی قیمت کا تعین نہیں ہو سکا — دوبارہ کوشش کریں۔', nl: 'Kon de pakketprijs niet berekenen — probeer het opnieuw.' },
    'أدخل تاريخ ميلاد كل طفل — سعر تذكرته يتبع عمره يوم السفر.': { en: "Enter each child's date of birth — the fare follows their age on travel day.", ur: 'ہر بچے کی تاریخ پیدائش درج کریں — ٹکٹ کی قیمت سفر کے دن اس کی عمر کے مطابق ہوگی۔', nl: 'Voer de geboortedatum van elk kind in — de tarief volgt hun leeftijd op de reisdag.' },
    'تاريخ الميلاد من البحث — لتغييره أعد البحث، فالسعر يتبع العمر.': { en: 'Date of birth comes from the search — re-search to change it; the fare follows the age.', ur: 'تاریخ پیدائش تلاش سے آئی ہے — اسے تبدیل کرنے کے لیے دوبارہ تلاش کریں، کیونکہ قیمت عمر کے مطابق ہوتی ہے۔', nl: 'De geboortedatum komt uit de zoekopdracht — zoek opnieuw om deze te wijzigen, want de prijs volgt de leeftijd.' },
    'أغلق هذا التبويب للعودة إلى نتائج بحث الرحلات.': { en: 'Close this tab to return to flight results.', ur: 'پرواز کے نتائج پر واپس جانے کے لیے یہ ٹیب بند کریں۔', nl: 'Sluit dit tabblad om terug te keren naar de vluchtresultaten.' },
    'فعّل الحفظ أعلاه لإضافة مسافرين.': { en: 'Enable saving above to add travellers.', ur: 'مسافر شامل کرنے کے لیے اوپر سیو کو فعال کریں۔', nl: 'Schakel opslaan hierboven in om reizigers toe te voegen.' },
    '💬 تنبيهات واتساب غير مُفعّلة على هذا الخادم بعد.': { en: '💬 WhatsApp alerts are not enabled on this server yet.', ur: '💬 اس سرور پر واٹس ایپ اطلاعات ابھی فعال نہیں ہیں۔', nl: '💬 WhatsApp-meldingen zijn nog niet ingeschakeld op deze server.' },
    '/ للشخص': { en: '/ per person', ur: '/ فی شخص', nl: '/ per persoon' },
    'المرجع:': { en: 'Reference:', ur: 'حوالہ:', nl: 'Referentie:' },
    '✓ حجز موثق': { en: '✓ verified booking', ur: '✓ تصدیق شدہ بکنگ', nl: '✓ geverifieerde boeking' },
    '▴ إخفاء التفاصيل': { en: '▴ Hide details', ur: '▴ تفصیلات چھپائیں', nl: '▴ Details verbergen' },
    'خريطة موقع الفندق': { en: 'Hotel location map', ur: 'ہوٹل کے مقام کا نقشہ', nl: 'Kaart van hotellocatie' },
    'خرائط Google': { en: 'Google Maps', ur: 'گوگل میپس', nl: 'Google Maps' },

    // ─── تفاصيل الرحلة والفندق (من صور فجوات حقيقية للمالك) ───
    '🎫 الدرجة:': { en: '🎫 Cabin:', ur: '🎫 کلاس:', nl: '🎫 Klasse:' },
    'الذهاب': { en: 'Outbound', ur: 'روانگی', nl: 'Heenreis' },
    'العودة': { en: 'Return', ur: 'واپسی', nl: 'Terugreis' },
    'الرحلة': { en: 'Flight', ur: 'پرواز', nl: 'Vlucht' },
    '🧳 لم يُصرّح المزوّد بالأمتعة لهذا القطاع': { en: '🧳 The provider did not declare baggage for this segment', ur: '🧳 فراہم کنندہ نے اس سیکٹر کے لیے سامان کا اعلان نہیں کیا', nl: '🧳 De aanbieder heeft geen bagage opgegeven voor dit segment' },
    '🛏️ الغرفة:': { en: '🛏️ Room:', ur: '🛏️ کمرہ:', nl: '🛏️ Kamer:' },
    'رسوم تُدفع في الفندق (غير مشمولة بالسعر أعلاه)': { en: 'Fees paid at the hotel (not included in the price above)', ur: 'فیس ہوٹل میں ادا کی جائے گی (اوپر کی قیمت میں شامل نہیں)', nl: 'Kosten te betalen in het hotel (niet inbegrepen in de prijs hierboven)' },
    '🏨 فنادق الوجهة': { en: '🏨 Destination hotels', ur: '🏨 منزل کے ہوٹلز', nl: '🏨 Hotels op bestemming' },
    'لا رحلات': { en: 'No flights', ur: 'کوئی پرواز نہیں', nl: 'Geen vluchten' },
    'تعذّر جلب التقويم.': { en: 'Could not fetch the calendar.', ur: 'کیلنڈر حاصل نہیں ہو سکا۔', nl: 'Kon de kalender niet ophalen.' },
    'تعذّر فتح صفحة الدفع.': { en: 'Could not open the payment page.', ur: 'ادائیگی کا صفحہ نہیں کھل سکا۔', nl: 'Kon de betaalpagina niet openen.' },

    // ─── المساعد ───
    '🤖 قراءة المساعد': { en: "🤖 Assistant's read", ur: '🤖 اسسٹنٹ کی رائے', nl: '🤖 Inzicht van de assistent' },
    '🔄 جديدة': { en: '🔄 New chat', ur: '🔄 نئی', nl: '🔄 Nieuw' },
    'محادثة جديدة': { en: 'New conversation', ur: 'نئی گفتگو', nl: 'Nieuw gesprek' },
    'المساعد ينفّذ فعلياً: يبحث ويقارن ويحجز ويلغي بالحوار — وكل إجراء نفّذه يظهر كرقاقة شفافية.':
        { en: 'The assistant actually acts: it searches, compares, books and cancels in conversation — and every action it takes shows as a transparency chip.', ur: 'اسسٹنٹ حقیقت میں عمل کرتا ہے: یہ بات چیت کے دوران تلاش کرتا، موازنہ کرتا، بک کرتا اور منسوخ کرتا ہے — اور اس کا ہر عمل ایک شفافیت چپ کے طور پر ظاہر ہوتا ہے۔', nl: 'De assistent handelt daadwerkelijk: hij zoekt, vergelijkt, boekt en annuleert in het gesprek — en elke actie die hij uitvoert verschijnt als een transparantiechip.' },
    'مثال: احجز لي رحلة من الرياض للقاهرة الأسبوع القادم بأرخص سعر':
        { en: 'e.g.: book me the cheapest Riyadh–Cairo flight next week', ur: 'مثال: اگلے ہفتے ریاض سے قاہرہ کی سب سے سستی پرواز بک کریں', nl: 'bijv.: boek me de goedkoopste vlucht Riyad–Caïro volgende week' },
    '↩️ استُؤنفت محادثتك السابقة': { en: '↩️ Your previous conversation was resumed', ur: '↩️ آپ کی سابقہ گفتگو دوبارہ شروع ہو گئی', nl: '↩️ Uw vorige gesprek is hervat' },
    '⚠️ تعذّر الاتصال بالخادم.': { en: '⚠️ Could not reach the server.', ur: '⚠️ سرور سے رابطہ نہیں ہو سکا۔', nl: '⚠️ Kon geen verbinding maken met de server.' },
    'غير مفعَّل على هذا الخادم': { en: 'Not enabled on this server', ur: 'اس سرور پر فعال نہیں', nl: 'Niet ingeschakeld op deze server' },
    '🧪 بيئة تجريبية — الحجوزات هنا لا تُصدر تذاكر حقيقية ولا تُحصَّل أموال.':
        { en: '🧪 Sandbox environment — bookings here issue no real tickets and charge no money.', ur: '🧪 آزمائشی ماحول — یہاں کی بکنگز کوئی حقیقی ٹکٹ جاری نہیں کرتیں اور نہ ہی کوئی رقم وصول کی جاتی ہے۔', nl: '🧪 Testomgeving — boekingen hier geven geen echte tickets uit en er wordt geen geld in rekening gebracht.' },
    '🔄 تحديث': { en: '🔄 Refresh', ur: '🔄 تازہ کاری', nl: '🔄 Vernieuwen' },
    '🔎 ابحث عن سيارة': { en: '🔎 Find a car', ur: '🔎 گاڑی تلاش کریں', nl: '🔎 Zoek een auto' },
    'تعذّر تحميل التنبيهات.': { en: 'Could not load notifications.', ur: 'اطلاعات لوڈ نہیں ہو سکیں۔', nl: 'Kon meldingen niet laden.' },
    'للتقويم: حدّد «من» و«إلى» وتاريخ الذهاب أولاً.': { en: 'For the calendar: set From, To and the departure date first.', ur: 'کیلنڈر کے لیے: پہلے "سے"، "تک" اور روانگی کی تاریخ مقرر کریں۔', nl: 'Voor de kalender: stel eerst "Van", "Naar" en de vertrekdatum in.' },
    '📄 تفاصيل الحجز': { en: '📄 Booking details', ur: '📄 بکنگ کی تفصیلات', nl: '📄 Boekingsdetails' },
    '📤 مشاركة': { en: '📤 Share', ur: '📤 شیئر کریں', nl: '📤 Delen' },
    '🔗 رابط مؤقّت': { en: '🔗 Temporary link', ur: '🔗 عارضی لنک', nl: '🔗 Tijdelijke link' },
    '📆 اشترك بتقويمك': { en: '📆 Subscribe in your calendar', ur: '📆 اپنے کیلنڈر میں سبسکرائب کریں', nl: '📆 Abonneer in uw kalender' },
    'حجوزاتك تظهر في تقويم هاتفك وتتحدّث وحدها.': { en: 'Your bookings appear in your phone calendar and update themselves.', ur: 'آپ کی بکنگز آپ کے فون کے کیلنڈر میں ظاہر ہوں گی اور خود بخود اپ ڈیٹ ہوتی رہیں گی۔', nl: 'Uw boekingen verschijnen in de kalender van uw telefoon en werken zichzelf bij.' },
    'إنشاء رابط الاشتراك': { en: 'Create subscription link', ur: 'سبسکرپشن لنک بنائیں', nl: 'Abonnementslink maken' },
    '📋 انسخ': { en: '📋 Copy', ur: '📋 کاپی کریں', nl: '📋 Kopiëren' },
    '📲 افتح في التقويم': { en: '📲 Open in calendar', ur: '📲 کیلنڈر میں کھولیں', nl: '📲 Openen in kalender' },
    '🔄 جدّد الرابط': { en: '🔄 Regenerate link', ur: '🔄 لنک تجدید کریں', nl: '🔄 Link vernieuwen' },
    'أضِف الرابط في تقويمك كـ«اشتراك في تقويم». من يملك هذا الرابط يرى مواعيد رحلاتك — جدّده إن تسرّب.':
        { en: 'Add the link to your calendar as a calendar subscription. Anyone holding this link can see your trip dates — regenerate it if it leaks.', ur: 'اس لنک کو اپنے کیلنڈر میں "کیلنڈر سبسکرپشن" کے طور پر شامل کریں۔ جس کے پاس یہ لنک ہوگا وہ آپ کے سفر کی تاریخیں دیکھ سکے گا — اگر یہ لیک ہو جائے تو اسے تجدید کریں۔', nl: 'Voeg de link toe aan uw kalender als een "kalenderabonnement". Iedereen die deze link heeft, kan uw reisdata zien — vernieuw hem als hij is uitgelekt.' },
    '💬 واتساب': { en: '💬 WhatsApp', ur: '💬 واٹس ایپ', nl: '💬 WhatsApp' },
    '📅 أضف للتقويم': { en: '📅 Add to calendar', ur: '📅 کیلنڈر میں شامل کریں', nl: '📅 Toevoegen aan kalender' },
    '🔁 ابحث عن بديل': { en: '🔁 Find an alternative', ur: '🔁 متبادل تلاش کریں', nl: '🔁 Zoek een alternatief' },
    'تُشارَك خطة الرحلة والمرجع فقط — بلا بريدك ولا هاتفك ولا أرقام تذاكرك.':
        { en: 'Only the itinerary and reference are shared — not your email, phone or ticket numbers.', ur: 'صرف سفری منصوبہ اور حوالہ نمبر شیئر کیا جاتا ہے — آپ کا ای میل، فون یا ٹکٹ نمبر نہیں۔', nl: 'Alleen het reisplan en de referentie worden gedeeld — niet uw e-mail, telefoon of ticketnummers.' },
    '💳 أكمل الدفع الآن': { en: '💳 Pay now', ur: '💳 ابھی ادائیگی کریں', nl: '💳 Nu betalen' },
    '🖨️ طباعة / حفظ PDF': { en: '🖨️ Print / save as PDF', ur: '🖨️ پرنٹ / PDF کے طور پر محفوظ کریں', nl: '🖨️ Afdrukken / opslaan als PDF' },

    // ─── ما كشفه مسحٌ آلي للواجهة الإنجليزية تبويباً تبويباً ───
    '🔎 ابحث عن فندق': { en: '🔎 Find a hotel', ur: '🔎 ہوٹل تلاش کریں', nl: '🔎 Zoek een hotel' },
    '🔎 ابحث عن باقات': { en: '🔎 Find bundles', ur: '🔎 پیکجز تلاش کریں', nl: '🔎 Zoek pakketten' },
    '🎁 اختر رحلة وفندقاً معاً — سعر الباقة أقل من مجموعهما منفصلَين، والفرق يُحسب ويُعرض. الباقة ذهاب وعودة (الفندق بين التاريخين).':
        { en: '🎁 Pick a flight and a hotel together — the bundle costs less than booking both separately, and the difference is computed and shown. Bundles are round-trip (the hotel spans both dates).', ur: '🎁 پرواز اور ہوٹل ایک ساتھ منتخب کریں — پیکج کی قیمت دونوں کو الگ الگ بک کرنے سے کم ہے، اور فرق کا حساب لگا کر دکھایا جاتا ہے۔ پیکج راؤنڈ ٹرپ ہے (ہوٹل دونوں تاریخوں کے درمیان ہوگا)۔', nl: '🎁 Kies een vlucht en hotel samen — het pakket kost minder dan beide apart, en het verschil wordt berekend en getoond. Het pakket is heen en terug (het hotel loopt tussen beide data).' },
    '🧠 ملفك ومسافروك': { en: '🧠 Your profile & travellers', ur: '🧠 آپ کی پروفائل اور مسافر', nl: '🧠 Uw profiel & reizigers' },
    // الفقرة مقسومة بـ<strong> فهي عقدتا نص لا واحدة — مفتاح لكل جزء
    'يملأ نماذج البحث والحجز مسبقاً. المساعد يعرف تفضيلاتك ووجهاتك المتكررة —':
        { en: 'Pre-fills your search and booking forms. The assistant knows your preferences and frequent destinations —', ur: 'آپ کے تلاش اور بکنگ کے فارم پہلے سے بھر دیتا ہے۔ اسسٹنٹ آپ کی ترجیحات اور بار بار جانے والی منزلوں کو جانتا ہے —', nl: 'Vult uw zoek- en boekingsformulieren vooraf in. De assistent kent uw voorkeuren en veelbezochte bestemmingen —' },
    'ولا تصله أسماء مسافريك ولا تواريخ ميلادهم أبداً':
        { en: 'and it never receives your travellers’ names or dates of birth', ur: 'اور اسے آپ کے مسافروں کے نام یا تاریخ پیدائش کبھی موصول نہیں ہوتی', nl: 'en ontvangt nooit de namen of geboortedata van uw reizigers' },
    'احفظ بيانات المسافرين لتسريع الحجز القادم': { en: 'Save traveller details to speed up your next booking', ur: 'اگلی بکنگ کو تیز کرنے کے لیے مسافروں کا ڈیٹا محفوظ کریں', nl: 'Sla reizigersgegevens op om uw volgende boeking te versnellen' },
    '🗑️ امسح كل بياناتي': { en: '🗑️ Erase all my data', ur: '🗑️ میرا تمام ڈیٹا حذف کریں', nl: '🗑️ Al mijn gegevens wissen' },
    '⚙️ أي التنبيهات تريد أن تصلك؟': { en: '⚙️ Which notifications do you want?', ur: '⚙️ آپ کون سی اطلاعات وصول کرنا چاہتے ہیں؟', nl: '⚙️ Welke meldingen wilt u ontvangen?' },
    'وقائع حجوزاتك يبقى سجلها داخل البوابة دوماً — اختيارك يطال بريدها.':
        { en: 'Your booking events are always logged in the portal — your choice applies to their email.', ur: 'آپ کی بکنگز کے واقعات ہمیشہ پورٹل کے اندر ریکارڈ رہتے ہیں — آپ کا انتخاب صرف ای میل پر لاگو ہوتا ہے۔', nl: 'Gebeurtenissen van uw boekingen blijven altijd geregistreerd in het portaal — uw keuze geldt alleen voor de e-mail ervan.' },
    'أضف رقم واتساب أدناه أولاً': { en: 'Add a WhatsApp number below first', ur: 'پہلے نیچے واٹس ایپ نمبر شامل کریں', nl: 'Voeg hieronder eerst een WhatsApp-nummer toe' },
    // عناوين ومُلمِحات (title/placeholder)
    'عملة العرض التقريبية': { en: 'Approximate display currency', ur: 'تخمینی نمائشی کرنسی', nl: 'Geschatte weergavevaluta' },
    'التنبيهات': { en: 'Notifications', ur: 'اطلاعات', nl: 'Meldingen' },
    'أرخص سعر لكل يوم حول تاريخك': { en: 'Cheapest price per day around your date', ur: 'آپ کی تاریخ کے آس پاس ہر دن کی سب سے سستی قیمت', nl: 'Goedkoopste prijs per dag rond uw datum' },
    'مثال: السعودية أو SV': { en: 'e.g. Saudia or SV', ur: 'مثال: سعودیہ یا SV', nl: 'bijv. Saudia of SV' },
    'رحلة رائعة!': { en: 'Great trip!', ur: 'شاندار سفر!', nl: 'Geweldige reis!' },
    'الفندق، التنظيم، الطيران...': { en: 'Hotel, organisation, flight...', ur: 'ہوٹل، انتظام، پرواز...', nl: 'Het hotel, de organisatie, de vlucht...' },
    'سجل الوقائع محفوظ دوماً': { en: 'The event log is always kept', ur: 'واقعات کا ریکارڈ ہمیشہ محفوظ رہتا ہے', nl: 'Het gebeurtenissenlogboek blijft altijd bewaard' },
    'واتساب غير مُفعّل على الخادم': { en: 'WhatsApp is not enabled on this server', ur: 'واٹس ایپ سرور پر فعال نہیں ہے', nl: 'WhatsApp is niet ingeschakeld op de server' },

    // ─── التذييل (بيانات الشركة وروابط الصفحات القانونية) ───
    'من نحن': { en: 'About us', ur: 'ہمارے بارے میں', nl: 'Over ons' },
    'اتصل بنا': { en: 'Contact us', ur: 'ہم سے رابطہ کریں', nl: 'Contact' },
    'الشروط والأحكام': { en: 'Terms & Conditions', ur: 'شرائط و ضوابط', nl: 'Algemene voorwaarden' },
    'سياسة الخصوصية': { en: 'Privacy Policy', ur: 'رازداری کی پالیسی', nl: 'Privacybeleid' },
    'سياسة الاسترجاع والإلغاء': { en: 'Refund & Cancellation Policy', ur: 'واپسی اور منسوخی کی پالیسی', nl: 'Restitutie- en annuleringsbeleid' },
    'علامة تجارية تابعة لمنشأة': { en: 'a trading name of', ur: 'کا تجارتی نام', nl: 'een handelsnaam van' },
    'سجل تجاري هولندي (KVK) رقم': { en: 'Dutch Chamber of Commerce (KVK) no.', ur: 'ڈچ چیمبر آف کامرس (KVK) نمبر', nl: 'Nederlandse Kamer van Koophandel (KVK) nr.' },
    'منشأة فردية مؤسَّسة في 22-06-2018': { en: 'a sole proprietorship established on 22-06-2018', ur: 'ایک انفرادی ملکیتی ادارہ، قائم شدہ بتاریخ 22-06-2018', nl: 'een eenmanszaak, opgericht op 22-06-2018' },
    'العنوان المسجَّل': { en: 'Registered address', ur: 'رجسٹرڈ پتہ', nl: 'Geregistreerd adres' },
    'نشاط وكالة سفر مسجَّل تحت تصنيف SBI 79110': { en: 'Registered travel agency activity under SBI code 79110', ur: 'SBI کوڈ 79110 کے تحت رجسٹرڈ ٹریول ایجنسی کی سرگرمی', nl: 'Geregistreerde reisbureauactiviteit onder SBI-code 79110' },
    'هولندا': { en: 'the Netherlands', ur: 'نیدرلینڈز', nl: 'Nederland' },
};

/**
 * قواعد الأنماط: نصوص بأرقام مُدرَجة لا تطابق جدولاً حرفياً — تُترجم
 * بتعابير نمطية محدودة، وتُطبَّق فقط حين لا يطابق النص الجدول أعلاه.
 * كائنٌ لكل قاعدة (لا مصفوفة ثنائية) بالمبدأ نفسه أعلاه: `pattern` واحد
 * وعمود لغة لكل ترجمة، فلغةٌ جديدة تضيف حقلاً لا مصفوفة قواعد كاملة.
 */
window.JAOLA_I18N_RULES = [
    // ─── حسابات Jatrava: رسائل خادم بأرقامٍ مُدرَجة (accounts.js/googleAuth.js) ───
    { pattern: /^كلمة المرور (\d+) أحرف على الأقل\.$/u, en: 'Password must be at least $1 characters.', ur: 'پاس ورڈ کم از کم $1 حروف کا ہونا چاہیے۔', nl: 'Wachtwoord moet minstens $1 tekens bevatten.' },
    { pattern: /^كلمة المرور أطول من (\d+) حرفاً\.$/u, en: 'Password must be at most $1 characters.', ur: 'پاس ورڈ زیادہ سے زیادہ $1 حروف کا ہو سکتا ہے۔', nl: 'Wachtwoord mag maximaal $1 tekens bevatten.' },
    { pattern: /^تعذّر جلب مفاتيح جوجل العامة \((\d+)\)\.$/u, en: "Couldn't fetch Google's public keys ($1).", ur: 'گوگل کی عوامی چابیاں حاصل نہیں ہو سکیں ($1)۔', nl: "Kon Google's publieke sleutels niet ophalen ($1)." },
    // ─── حسابات Jatrava: رسائل خادم ثابتة بلا أرقام (server.js/googleAuth.js) ───
    // ليست في الجدول عمداً: نصوصٌ لا تظهر حرفياً في index.html (تصل عبر
    // data.error من رد الخادم)، فحارس الانجراف الصارم على الجدول يرفضها —
    // نفس السبب الذي يضع رسائل الحجوزات المخزَّنة أدناه في RULES لا الجدول.
    { pattern: /^أدخل بريداً إلكترونياً صحيحاً\.$/u, en: 'Enter a valid email address.', ur: 'ایک درست ای میل ایڈریس درج کریں۔', nl: 'Voer een geldig e-mailadres in.' },
    { pattern: /^كلمة المرور شائعة جداً — اختر غيرها\.$/u, en: 'This password is too common — choose another.', ur: 'یہ پاس ورڈ بہت عام ہے — کوئی اور منتخب کریں۔', nl: 'Dit wachtwoord is te algemeen — kies een ander.' },
    { pattern: /^تعذّر إنشاء الحساب بهذا البريد — جرّب تسجيل الدخول\.$/u, en: "Couldn't create an account with this email — try signing in.", ur: 'اس ای میل سے اکاؤنٹ نہیں بن سکا — لاگ اِن کرنے کی کوشش کریں۔', nl: 'Kon geen account aanmaken met dit e-mailadres — probeer in te loggen.' },
    { pattern: /^البريد أو كلمة المرور غير صحيحة\.$/u, en: 'Incorrect email or password.', ur: 'ای میل یا پاس ورڈ درست نہیں ہے۔', nl: 'E-mailadres of wachtwoord onjuist.' },
    { pattern: /^الدخول بحساب جوجل غير مفعَّل على هذا الخادم\.$/u, en: "Google sign-in isn't enabled on this server.", ur: 'اس سرور پر گوگل اکاؤنٹ سے لاگ اِن فعال نہیں ہے۔', nl: 'Inloggen met Google is niet ingeschakeld op deze server.' },
    { pattern: /^رمز جوجل مفقود\.$/u, en: 'Google token missing.', ur: 'گوگل ٹوکن غائب ہے۔', nl: 'Google-token ontbreekt.' },
    { pattern: /^تعذّر التحقق من حساب جوجل\.$/u, en: "Couldn't verify the Google account.", ur: 'گوگل اکاؤنٹ کی تصدیق نہیں ہو سکی۔', nl: 'Kon het Google-account niet verifiëren.' },
    { pattern: /^بريد حساب جوجل غير مؤكَّد — تعذّر إتمام الدخول\.$/u, en: 'Google account email is unverified — sign-in failed.', ur: 'گوگل اکاؤنٹ کا ای میل غیر تصدیق شدہ ہے — لاگ اِن مکمل نہیں ہو سکا۔', nl: 'Het e-mailadres van het Google-account is niet geverifieerd — inloggen mislukt.' },
    { pattern: /^بريد حساب جوجل غير صالح\.$/u, en: 'Invalid Google account email.', ur: 'گوگل اکاؤنٹ کا ای میل غلط ہے۔', nl: 'Ongeldig e-mailadres van het Google-account.' },
    { pattern: /^تعذّر إتمام الدخول — حاول مجدداً\.$/u, en: "Couldn't sign in — try again.", ur: 'لاگ اِن مکمل نہیں ہو سکا — دوبارہ کوشش کریں۔', nl: 'Inloggen mislukt — probeer het opnieuw.' },
    { pattern: /^رابط إعادة التعيين منتهٍ أو غير صالح — اطلب رابطاً جديداً\.$/u, en: 'This reset link is expired or invalid — request a new one.', ur: 'یہ ری سیٹ لنک ختم ہو چکا ہے یا غلط ہے — نیا لنک طلب کریں۔', nl: 'Deze herstellink is verlopen of ongeldig — vraag een nieuwe aan.' },
    // ردود src/googleAuth.js (تُمرَّر عبر e.message في مسار /auth/google)
    { pattern: /^رمز جوجل غير صالح\.$/u, en: 'Invalid Google token.', ur: 'غلط گوگل ٹوکن۔', nl: 'Ongeldig Google-token.' },
    { pattern: /^تعذّر التحقق من حساب جوجل — حاول مجدداً\.$/u, en: "Couldn't verify the Google account — try again.", ur: 'گوگل اکاؤنٹ کی تصدیق نہیں ہو سکی — دوبارہ کوشش کریں۔', nl: 'Kon het Google-account niet verifiëren — probeer het opnieuw.' },
    { pattern: /^حساب جوجل بلا بريد إلكتروني — تعذّر إتمام الدخول\.$/u, en: 'Google account has no email — sign-in failed.', ur: 'گوگل اکاؤنٹ میں ای میل موجود نہیں — لاگ اِن مکمل نہیں ہو سکا۔', nl: 'Het Google-account heeft geen e-mailadres — inloggen mislukt.' },

    // ─── تحقّق مُدخلات البحث والحجز (server.js + passengerAges.js) ───
    // في RULES لا الجدول لنفس سبب رسائل الحسابات: تصل عبر `data.error`
    // من رد الشبكة فلا تظهر حرفياً في index.html، وحارس الانجراف الصارم
    // على الجدول يرفضها بحق. **وهذه أكثر الرسائل ظهوراً لمسافرٍ حقيقي**:
    // كشفها المالك بلقطةٍ من الموقع الحيّ — بحثٌ بحقل وجهةٍ فارغ على
    // `/en/` فظهرت رسالة عربية وسط صفحة إنجليزية.
    // المطارات والوجهات
    { pattern: /^رمزا المطار يجب أن يكونا IATA من ثلاثة أحرف \(مثل RUH وCAI\)\.$/u, en: 'Both airport codes must be 3-letter IATA codes (e.g. RUH and CAI).', ur: 'دونوں ایئرپورٹ کوڈز تین حروف کے IATA کوڈ ہونے چاہئیں (مثلاً RUH اور CAI)۔', nl: 'Beide luchthavencodes moeten 3-letterige IATA-codes zijn (bijv. RUH en CAI).' },
    { pattern: /^رمز الوجهة يجب أن يكون IATA من ثلاثة أحرف \(مثل RUH وCAI\)\.$/u, en: 'The destination must be a 3-letter IATA code (e.g. RUH or CAI).', ur: 'منزل کا کوڈ تین حروف کا IATA کوڈ ہونا چاہیے (مثلاً RUH یا CAI)۔', nl: 'De bestemming moet een 3-letterige IATA-code zijn (bijv. RUH of CAI).' },
    { pattern: /^رمز موقع الاستلام يجب أن يكون IATA من ثلاثة أحرف \(مثل RUH وCAI\)\.$/u, en: 'The pick-up location must be a 3-letter IATA code (e.g. RUH or CAI).', ur: 'وصولی کے مقام کا کوڈ تین حروف کا IATA کوڈ ہونا چاہیے (مثلاً RUH یا CAI)۔', nl: 'De ophaallocatie moet een 3-letterige IATA-code zijn (bijv. RUH of CAI).' },
    { pattern: /^مطار المغادرة والوصول متطابقان\.$/u, en: 'Departure and arrival airports are the same.', ur: 'روانگی اور آمد کا ایئرپورٹ ایک جیسا ہے۔', nl: 'Vertrek- en aankomstluchthaven zijn hetzelfde.' },
    { pattern: /^الوجهة (.+) غير مغطّاة حالياً في بحث الفنادق\.$/u, en: 'Destination $1 is not covered by hotel search yet.', ur: 'منزل $1 فی الحال ہوٹل تلاش میں شامل نہیں ہے۔', nl: 'Bestemming $1 wordt momenteel niet ondersteund in de hotelzoekopdracht.' },
    { pattern: /^الوجهة (.+) غير مغطّاة حالياً في بحث السيارات\.$/u, en: 'Destination $1 is not covered by car search yet.', ur: 'منزل $1 فی الحال گاڑی کی تلاش میں شامل نہیں ہے۔', nl: 'Bestemming $1 wordt momenteel niet ondersteund in de autozoekopdracht.' },
    // التواريخ والأوقات
    { pattern: /^تاريخ الذهاب بصيغة YYYY-MM-DD\.$/u, en: 'Departure date must be in YYYY-MM-DD format.', ur: 'روانگی کی تاریخ YYYY-MM-DD فارمیٹ میں ہونی چاہیے۔', nl: 'Vertrekdatum moet in het formaat YYYY-MM-DD zijn.' },
    { pattern: /^تاريخ العودة بصيغة YYYY-MM-DD\.$/u, en: 'Return date must be in YYYY-MM-DD format.', ur: 'واپسی کی تاریخ YYYY-MM-DD فارمیٹ میں ہونی چاہیے۔', nl: 'Terugkeerdatum moet in het formaat YYYY-MM-DD zijn.' },
    { pattern: /^تاريخ الوصول بصيغة YYYY-MM-DD\.$/u, en: 'Check-in date must be in YYYY-MM-DD format.', ur: 'چیک اِن کی تاریخ YYYY-MM-DD فارمیٹ میں ہونی چاہیے۔', nl: 'Inchekdatum moet in het formaat YYYY-MM-DD zijn.' },
    { pattern: /^تاريخ المغادرة بصيغة YYYY-MM-DD\.$/u, en: 'Check-out date must be in YYYY-MM-DD format.', ur: 'چیک آؤٹ کی تاریخ YYYY-MM-DD فارمیٹ میں ہونی چاہیے۔', nl: 'Uitchekdatum moet in het formaat YYYY-MM-DD zijn.' },
    { pattern: /^تاريخ الاستلام بصيغة YYYY-MM-DD\.$/u, en: 'Pick-up date must be in YYYY-MM-DD format.', ur: 'وصولی کی تاریخ YYYY-MM-DD فارمیٹ میں ہونی چاہیے۔', nl: 'Ophaaldatum moet in het formaat YYYY-MM-DD zijn.' },
    { pattern: /^تاريخ التسليم بصيغة YYYY-MM-DD\.$/u, en: 'Drop-off date must be in YYYY-MM-DD format.', ur: 'واپسی کی تاریخ YYYY-MM-DD فارمیٹ میں ہونی چاہیے۔', nl: 'Inleverdatum moet in het formaat YYYY-MM-DD zijn.' },
    { pattern: /^وقت الاستلام بصيغة HH:MM\.$/u, en: 'Pick-up time must be in HH:MM format.', ur: 'وصولی کا وقت HH:MM فارمیٹ میں ہونا چاہیے۔', nl: 'Ophaaltijd moet in het formaat HH:MM zijn.' },
    { pattern: /^وقت التسليم بصيغة HH:MM\.$/u, en: 'Drop-off time must be in HH:MM format.', ur: 'واپسی کا وقت HH:MM فارمیٹ میں ہونا چاہیے۔', nl: 'Inlevertijd moet in het formaat HH:MM zijn.' },
    { pattern: /^تاريخ الذهاب في الماضي\.$/u, en: 'The departure date is in the past.', ur: 'روانگی کی تاریخ ماضی میں ہے۔', nl: 'De vertrekdatum ligt in het verleden.' },
    { pattern: /^تاريخ الوصول في الماضي\.$/u, en: 'The check-in date is in the past.', ur: 'چیک اِن کی تاریخ ماضی میں ہے۔', nl: 'De inchekdatum ligt in het verleden.' },
    { pattern: /^تاريخ الاستلام في الماضي\.$/u, en: 'The pick-up date is in the past.', ur: 'وصولی کی تاریخ ماضی میں ہے۔', nl: 'De ophaaldatum ligt in het verleden.' },
    { pattern: /^تاريخ العودة قبل الذهاب\.$/u, en: 'The return date is before the departure date.', ur: 'واپسی کی تاریخ روانگی سے پہلے ہے۔', nl: 'De terugkeerdatum ligt vóór de vertrekdatum.' },
    { pattern: /^تاريخ المغادرة يجب أن يكون بعد الوصول\.$/u, en: 'The check-out date must be after the check-in date.', ur: 'چیک آؤٹ کی تاریخ چیک اِن کے بعد ہونی چاہیے۔', nl: 'De uitchekdatum moet na de inchekdatum liggen.' },
    { pattern: /^وقت التسليم يجب أن يكون بعد الاستلام\.$/u, en: 'The drop-off time must be after the pick-up time.', ur: 'واپسی کا وقت وصولی کے بعد ہونا چاہیے۔', nl: 'De inlevertijd moet na de ophaaltijd liggen.' },
    { pattern: /^تاريخ الذهاب أبعد من نافذة الحجز \((\d+) يوماً\)\.$/u, en: 'The departure date is beyond the booking window ($1 days).', ur: 'روانگی کی تاریخ بکنگ ونڈو سے آگے ہے ($1 دن)۔', nl: 'De vertrekdatum valt buiten het boekingsvenster ($1 dagen).' },
    { pattern: /^تاريخ العودة أبعد من نافذة الحجز \((\d+) يوماً\)\.$/u, en: 'The return date is beyond the booking window ($1 days).', ur: 'واپسی کی تاریخ بکنگ ونڈو سے آگے ہے ($1 دن)۔', nl: 'De terugkeerdatum valt buiten het boekingsvenster ($1 dagen).' },
    { pattern: /^تاريخ الوصول أبعد من نافذة الحجز \((\d+) يوماً\)\.$/u, en: 'The check-in date is beyond the booking window ($1 days).', ur: 'چیک اِن کی تاریخ بکنگ ونڈو سے آگے ہے ($1 دن)۔', nl: 'De inchekdatum valt buiten het boekingsvenster ($1 dagen).' },
    { pattern: /^تاريخ الاستلام أبعد من نافذة الحجز \((\d+) يوماً\)\.$/u, en: 'The pick-up date is beyond the booking window ($1 days).', ur: 'وصولی کی تاریخ بکنگ ونڈو سے آگے ہے ($1 دن)۔', nl: 'De ophaaldatum valt buiten het boekingsvenster ($1 dagen).' },
    { pattern: /^أقصى مدة إقامة (\d+) ليلة\.$/u, en: 'Maximum stay is $1 nights.', ur: 'زیادہ سے زیادہ قیام کی مدت $1 راتیں ہے۔', nl: 'Maximale verblijfsduur is $1 nachten.' },
    { pattern: /^أقصى مدة استئجار (\d+) يوماً\.$/u, en: 'Maximum rental period is $1 days.', ur: 'زیادہ سے زیادہ کرایے کی مدت $1 دن ہے۔', nl: 'Maximale huurperiode is $1 dagen.' },
    // الأعداد والفلاتر
    { pattern: /^عدد البالغين بين 1 و(\d+)\.$/u, en: 'Number of adults must be between 1 and $1.', ur: 'بالغ افراد کی تعداد 1 اور $1 کے درمیان ہونی چاہیے۔', nl: 'Het aantal volwassenen moet tussen 1 en $1 liggen.' },
    { pattern: /^عدد الغرف بين 1 و(\d+)\.$/u, en: 'Number of rooms must be between 1 and $1.', ur: 'کمروں کی تعداد 1 اور $1 کے درمیان ہونی چاہیے۔', nl: 'Het aantal kamers moet tussen 1 en $1 liggen.' },
    { pattern: /^عدد الأطفال بين 0 و(\d+)\.$/u, en: 'Number of children must be between 0 and $1.', ur: 'بچوں کی تعداد 0 اور $1 کے درمیان ہونی چاہیے۔', nl: 'Het aantal kinderen moet tussen 0 en $1 liggen.' },
    { pattern: /^حد التوقفات عدد صحيح بين 0 \(مباشر\) و3\.$/u, en: 'Stops must be a whole number between 0 (direct) and 3.', ur: 'اسٹاپس کی حد 0 (براہ راست) اور 3 کے درمیان ایک مکمل عدد ہونی چاہیے۔', nl: 'Tussenstops moet een geheel getal zijn tussen 0 (direct) en 3.' },
    { pattern: /^سقف السعر رقم موجب\.$/u, en: 'Max price must be a positive number.', ur: 'زیادہ سے زیادہ قیمت ایک مثبت عدد ہونی چاہیے۔', nl: 'De maximumprijs moet een positief getal zijn.' },
    // ⚠️ القائمتان تُجمعان بفاصلةٍ **عربية** (`join('، ')`)، فالتقاطهما
    // بـ`(.+)` يسحب علامة ترقيم عربية إلى جملةٍ إنجليزية. وهما ثابتتان
    // في المصدر (CABINS/SORTS) لا مُدخَل مستخدم، فتُطابَقان حرفياً
    // وتُعاد كتابة القائمة بفاصلةٍ لاتينية. كشف هذا فحصُ الأنماط لا العين.
    { pattern: /^درجة غير معروفة \(المتاح: economy، premium_economy، business، first\)\.$/u,
        en: 'Unknown cabin (available: economy, premium_economy, business, first).',
        ur: 'نامعلوم کلاس (دستیاب: economy, premium_economy, business, first)۔',
        nl: 'Onbekende klasse (beschikbaar: economy, premium_economy, business, first).' },
    { pattern: /^ترتيب غير معروف \(المتاح: price، duration\)\.$/u,
        en: 'Unknown sort order (available: price, duration).',
        ur: 'نامعلوم ترتیب (دستیاب: price, duration)۔',
        nl: 'Onbekende sorteervolgorde (beschikbaar: price, duration).' },
    // الركاب والضيوف والسائقون
    { pattern: /^بيانات الركاب مطلوبة\.$/u, en: 'Passenger details are required.', ur: 'مسافروں کی تفصیلات درکار ہیں۔', nl: 'Passagiersgegevens zijn vereist.' },
    { pattern: /^بيانات الضيوف مطلوبة\.$/u, en: 'Guest details are required.', ur: 'مہمانوں کی تفصیلات درکار ہیں۔', nl: 'Gastgegevens zijn vereist.' },
    { pattern: /^بيانات السائق مطلوبة\.$/u, en: 'Driver details are required.', ur: 'ڈرائیور کی تفصیلات درکار ہیں۔', nl: 'Bestuurdersgegevens zijn vereist.' },
    { pattern: /^العرض لعدد (\d+) مسافرين — وصلت بيانات (\d+)\.$/u, en: 'The offer is for $1 traveller(s) — details for $2 were received.', ur: 'یہ پیشکش $1 مسافر(وں) کے لیے ہے — $2 کی تفصیلات موصول ہوئیں۔', nl: 'De aanbieding geldt voor $1 reiziger(s) — er zijn gegevens voor $2 ontvangen.' },
    { pattern: /^المسافر (\d+): اللقب mr أو ms أو mrs\.$/u, en: 'Traveller $1: title must be mr, ms or mrs.', ur: 'مسافر $1: خطاب mr، ms یا mrs ہونا چاہیے۔', nl: 'Reiziger $1: titel moet mr, ms of mrs zijn.' },
    { pattern: /^المسافر (\d+): الاسمان بالحروف اللاتينية كما في الجواز \(حتى 40 حرفاً\)\.$/u, en: 'Traveller $1: both names in Latin letters as in the passport (up to 40 characters).', ur: 'مسافر $1: دونوں نام لاطینی حروف میں جیسے پاسپورٹ میں درج ہیں (زیادہ سے زیادہ 40 حروف)۔', nl: 'Reiziger $1: beide namen in Latijnse letters zoals in het paspoort (max. 40 tekens).' },
    { pattern: /^المسافر (\d+): تاريخ ميلاد صالح بصيغة YYYY-MM-DD\.$/u, en: 'Traveller $1: a valid date of birth in YYYY-MM-DD format.', ur: 'مسافر $1: YYYY-MM-DD فارمیٹ میں درست تاریخ پیدائش۔', nl: 'Reiziger $1: een geldige geboortedatum in het formaat YYYY-MM-DD.' },
    { pattern: /^المسافر (\d+): الجنس m أو f\.$/u, en: 'Traveller $1: gender must be m or f.', ur: 'مسافر $1: جنس m یا f ہونی چاہیے۔', nl: 'Reiziger $1: geslacht moet m of f zijn.' },
    { pattern: /^الضيف (\d+): الاسمان بالحروف اللاتينية \(حتى 40 حرفاً\)\.$/u, en: 'Guest $1: both names in Latin letters (up to 40 characters).', ur: 'مہمان $1: دونوں نام لاطینی حروف میں (زیادہ سے زیادہ 40 حروف)۔', nl: 'Gast $1: beide namen in Latijnse letters (max. 40 tekens).' },
    { pattern: /^السائق (\d+): الاسمان بالحروف اللاتينية \(حتى 40 حرفاً\)\.$/u, en: 'Driver $1: both names in Latin letters (up to 40 characters).', ur: 'ڈرائیور $1: دونوں نام لاطینی حروف میں (زیادہ سے زیادہ 40 حروف)۔', nl: 'Bestuurder $1: beide namen in Latijnse letters (max. 40 tekens).' },
    { pattern: /^الطفل (\d+): تاريخ ميلاد صالح بصيغة YYYY-MM-DD\.$/u, en: 'Child $1: a valid date of birth in YYYY-MM-DD format.', ur: 'بچہ $1: YYYY-MM-DD فارمیٹ میں درست تاریخ پیدائش۔', nl: 'Kind $1: een geldige geboortedatum in het formaat YYYY-MM-DD.' },
    { pattern: /^الطفل (\d+): تاريخ الميلاد بعد تاريخ السفر\.$/u, en: 'Child $1: date of birth is after the travel date.', ur: 'بچہ $1: تاریخ پیدائش سفر کی تاریخ کے بعد ہے۔', nl: 'Kind $1: geboortedatum ligt na de reisdatum.' },
    { pattern: /^الطفل (\d+): عمره (\d+) سنة يوم السفر — يُحجز ضمن البالغين\.$/u, en: 'Child $1: aged $2 on the travel date — must be booked as an adult.', ur: 'بچہ $1: سفر کے دن اس کی عمر $2 سال ہے — بالغ کے طور پر بک کیا جائے گا۔', nl: 'Kind $1: is $2 jaar op de reisdag — moet als volwassene worden geboekt.' },
    { pattern: /^تواريخ ميلاد الأطفال يجب أن تكون قائمة\.$/u, en: "Children's dates of birth must be a list.", ur: 'بچوں کی تاریخ پیدائش ایک فہرست ہونی چاہیے۔', nl: 'De geboortedata van kinderen moeten een lijst zijn.' },
    { pattern: /^أرسل childrenDobs \(تواريخ ميلاد الأطفال\) بدل children — سعر تذكرة الطفل يتبع عمره يوم السفر\.$/u,
        en: "Send childrenDobs (children's dates of birth) instead of children — a child's fare follows their age on the travel date.",
        ur: 'children کے بجائے childrenDobs (بچوں کی تاریخ پیدائش) بھیجیں — بچے کے ٹکٹ کی قیمت سفر کے دن اس کی عمر کے مطابق ہوتی ہے۔',
        nl: 'Stuur childrenDobs (geboortedata van kinderen) in plaats van children — het tarief van een kind volgt de leeftijd op de reisdag.' },
    // التواصل
    { pattern: /^بريد تواصل صالح مطلوب\.$/u, en: 'A valid contact email is required.', ur: 'رابطے کے لیے درست ای میل درکار ہے۔', nl: 'Een geldig contact-e-mailadres is vereist.' },
    { pattern: /^هاتف بصيغة دولية يبدأ بـ\+ ورمز الدولة \(مثل \+966501234567\)\.$/u, en: 'Phone in international format starting with + and the country code (e.g. +966501234567).', ur: 'فون نمبر بین الاقوامی فارمیٹ میں + اور ملکی کوڈ سے شروع ہونا چاہیے (مثلاً +966501234567)۔', nl: 'Telefoon in internationaal formaat, beginnend met + en de landcode (bijv. +966501234567).' },
    { pattern: /^(\d+) ليالٍ$/u, en: '$1 nights', ur: '$1 راتیں', nl: '$1 nachten' },
    { pattern: /^متاح: (\d+) مقاعد$/u, en: 'Available: $1 seats', ur: 'دستیاب: $1 نشستیں', nl: 'Beschikbaar: $1 stoelen' },
    { pattern: /^🔥 تبقى (\d+) مقاعد فقط$/u, en: '🔥 Only $1 seats left', ur: '🔥 صرف $1 نشستیں باقی ہیں', nl: '🔥 Nog maar $1 stoelen over' },
    { pattern: /^إجمالي (\d+) مسافر$/u, en: 'Total for $1 traveller(s)', ur: 'کل $1 مسافر(وں) کے لیے', nl: 'Totaal voor $1 reiziger(s)' },
    { pattern: /^(\d+) مسافر$/u, en: '$1 traveller(s)', ur: '$1 مسافر', nl: '$1 reiziger(s)' },
    { pattern: /^⭐ ([\d.]+) · (\d+) مراجعة موثقة$/u, en: '⭐ $1 · $2 verified reviews', ur: '⭐ $1 · $2 تصدیق شدہ جائزے', nl: '⭐ $1 · $2 geverifieerde beoordelingen' },
    { pattern: /^عربون (\d+)% يثبّت مقعدك — الأسماء قبل ([\d-]+)$/u, en: '$1% deposit secures your seat — names due before $2', ur: '$1% ایڈوانس آپ کی نشست محفوظ کرتا ہے — نام $2 سے پہلے', nl: '$1% aanbetaling reserveert uw stoel — namen vóór $2' },
    { pattern: /^عربون (\d+)% الآن$/u, en: '$1% deposit now', ur: 'ابھی $1% ایڈوانس', nl: '$1% aanbetaling nu' },
    { pattern: /^(\d+) بالغ — غرفة مزدوجة$/u, en: '$1 adult(s) — double room', ur: '$1 بالغ — ڈبل روم', nl: '$1 volwassene(n) — tweepersoonskamer' },
    { pattern: /^(\d+) غرفة مفردة/u, en: '$1 single room(s)', ur: '$1 سنگل کمرہ(جات)', nl: '$1 eenpersoonskamer(s)' },
    { pattern: /^(\d+) طفل$/u, en: '$1 child(ren)', ur: '$1 بچہ(جات)', nl: '$1 kind(eren)' },
    { pattern: /^👥 حتى (\d+)$/u, en: '👥 Up to $1', ur: '👥 $1 تک', nl: '👥 Tot $1' },
    { pattern: /^⏳ صلاحية السعر حتى (.+)$/u, en: '⏳ Price valid until $1', ur: '⏳ قیمت $1 تک کارآمد ہے', nl: '⏳ Prijs geldig tot $1' },
    // سطرا سياسة الإلغاء — الأخصّ أولاً (أول نمط مطابق يفوز)
    { pattern: /^ابتداءً من (.+) تُخصم رسوم يحددها الفندق$/u, en: 'From $1 a fee set by the hotel applies', ur: '$1 سے شروع ہو کر ہوٹل کی مقرر کردہ فیس کاٹی جائے گی', nl: 'Vanaf $1 wordt een door het hotel bepaalde vergoeding in rekening gebracht' },
    { pattern: /^ابتداءً من (.+) تُخصم (.+)$/u, en: 'From $1 a charge of $2 applies', ur: '$1 سے شروع ہو کر $2 کاٹی جائے گی', nl: 'Vanaf $1 wordt $2 in rekening gebracht' },

    // ─── رقائق شفافية المساعد (نصوصها تُبنى في الخادم بأرقام مُدرَجة) ───
    { pattern: /^🔎 (.+) \((\d+) عروض\)$/u, en: '🔎 $1 ($2 offers)', ur: '🔎 $1 ($2 پیشکشیں)', nl: '🔎 $1 ($2 aanbiedingen)' },
    { pattern: /^💰 عرض بسعر (.+)$/u, en: '💰 Offer at $1', ur: '💰 $1 کی پیشکش', nl: '💰 Aanbieding voor $1' },
    { pattern: /^💰 عرض فندق بسعر (.+)$/u, en: '💰 Hotel offer at $1', ur: '💰 ہوٹل کی پیشکش $1', nl: '💰 Hotelaanbieding voor $1' },
    { pattern: /^💰 عرض سيارة بسعر (.+)$/u, en: '💰 Car offer at $1', ur: '💰 گاڑی کی پیشکش $1', nl: '💰 Autoaanbieding voor $1' },
    { pattern: /^✅ حُجز — المرجع (.+)$/u, en: '✅ Booked — reference $1', ur: '✅ بک ہو گیا — حوالہ $1', nl: '✅ Geboekt — referentie $1' },
    { pattern: /^💳 بانتظار الدفع — (.+)$/u, en: '💳 Awaiting payment — $1', ur: '💳 ادائیگی کا انتظار — $1', nl: '💳 Wachten op betaling — $1' },
    { pattern: /^↩️ تعذّر إصدار حجزك — أُعيد المبلغ$/u, en: '↩️ Your booking could not be issued — refunded', ur: '↩️ آپ کی بکنگ جاری نہیں ہو سکی — رقم واپس کر دی گئی', nl: '↩️ Uw boeking kon niet worden uitgegeven — terugbetaald' },
    // رسائل فشل تُكتب على الحجز في الخادم وقت وقوعها (تبقى مخزَّنة بلغتها)
    { pattern: /^انتهت مهلة الدفع دون سداد — لم يُصدر الحجز ولم تُحاسَب على شيء\.$/u,
        en: 'The payment window expired — nothing was issued and you were not charged.',
        ur: 'ادائیگی کی مدت بغیر ادائیگی کے ختم ہو گئی — نہ کچھ جاری ہوا اور نہ آپ سے کوئی رقم لی گئی۔',
        nl: 'De betalingstermijn is verstreken zonder betaling — er is niets uitgegeven en er is niets in rekening gebracht.' },
    { pattern: /^انتهت مهلة الدفع \((\d+) دقيقة\) دون سداد — تحررت المقاعد\. احجز من جديد متى شئت\.$/u,
        en: 'The payment window ($1 minutes) expired — the seats were released. Book again whenever you like.',
        ur: 'ادائیگی کی مدت ($1 منٹ) بغیر ادائیگی کے ختم ہو گئی — نشستیں خالی کر دی گئیں۔ جب چاہیں دوبارہ بک کریں۔',
        nl: 'De betalingstermijn ($1 minuten) is verstreken zonder betaling — de stoelen zijn vrijgegeven. Boek opnieuw wanneer u wilt.' },
    { pattern: /^تعذّر إصدار حجز (.+) بعد الدفع: (.+)$/u, en: 'Could not issue your $1 booking after payment: $2', ur: 'ادائیگی کے بعد آپ کی $1 بکنگ جاری نہیں ہو سکی: $2', nl: 'Kon uw $1-boeking na betaling niet uitgeven: $2' },
    { pattern: /^تعذّر فتح صفحة الدفع: (.+)$/u, en: 'Could not open the payment page: $1', ur: 'ادائیگی کا صفحہ نہیں کھل سکا: $1', nl: 'Kon de betaalpagina niet openen: $1' },
    { pattern: /^تعذّر إصدار الحجز: (.+)$/u, en: 'Could not issue the booking: $1', ur: 'بکنگ جاری نہیں ہو سکی: $1', nl: 'Kon de boeking niet uitgeven: $1' },
    { pattern: /^✅ حُجز فندق — المرجع (.+)$/u, en: '✅ Hotel booked — reference $1', ur: '✅ ہوٹل بک ہو گیا — حوالہ $1', nl: '✅ Hotel geboekt — referentie $1' },
    { pattern: /^✅ حُجزت سيارة — المرجع (.+)$/u, en: '✅ Car booked — reference $1', ur: '✅ گاڑی بک ہو گئی — حوالہ $1', nl: '✅ Auto geboekt — referentie $1' },
    { pattern: /^↩️ أُلغي الحجز (.+)$/u, en: '↩️ Cancelled booking $1', ur: '↩️ بکنگ منسوخ ہوئی $1', nl: '↩️ Boeking geannuleerd $1' },
    { pattern: /^↩️ أُلغي حجز الفندق (.+)$/u, en: '↩️ Cancelled hotel booking $1', ur: '↩️ ہوٹل کی بکنگ منسوخ ہوئی $1', nl: '↩️ Hotelboeking geannuleerd $1' },
    { pattern: /^↩️ أُلغي حجز السيارة (.+)$/u, en: '↩️ Cancelled car booking $1', ur: '↩️ گاڑی کی بکنگ منسوخ ہوئی $1', nl: '↩️ Autoboeking geannuleerd $1' },
    { pattern: /^🧳 (\d+) حجوزات$/u, en: '🧳 $1 bookings', ur: '🧳 $1 بکنگز', nl: '🧳 $1 boekingen' },
    { pattern: /^🏨 (.+) \((\d+) فنادق\)$/u, en: '🏨 $1 ($2 hotels)', ur: '🏨 $1 ($2 ہوٹلز)', nl: '🏨 $1 ($2 hotels)' },
    { pattern: /^🚗 (.+) \((\d+) سيارات\)$/u, en: '🚗 $1 ($2 cars)', ur: '🚗 $1 ($2 گاڑیاں)', nl: '🚗 $1 ($2 auto’s)' },
    { pattern: /^📅 (.+) \((\d+) تواريخ\)$/u, en: '📅 $1 ($2 dates)', ur: '📅 $1 ($2 تاریخیں)', nl: '📅 $1 ($2 data)' },
    { pattern: /^⚠️ (\d+) تعارض محتمل$/u, en: '⚠️ $1 potential conflict(s)', ur: '⚠️ $1 ممکنہ تصادم', nl: '⚠️ $1 mogelijk(e) conflict(en)' },
    { pattern: /^✅ لا تعارض$/u, en: '✅ No conflicts', ur: '✅ کوئی تصادم نہیں', nl: '✅ Geen conflicten' },
    { pattern: /^👁️ مراقبة سعر (.+)$/u, en: '👁️ Price watch $1', ur: '👁️ قیمت کی نگرانی $1', nl: '👁️ Prijsbewaking $1' },
    { pattern: /^👁️ (\d+) مراقبات نشطة$/u, en: '👁️ $1 active watches', ur: '👁️ $1 فعال نگرانیاں', nl: '👁️ $1 actieve bewakingen' },
    { pattern: /^🚫 أُلغيت المراقبة (.+)$/u, en: '🚫 Watch cancelled $1', ur: '🚫 نگرانی منسوخ ہوئی $1', nl: '🚫 Bewaking geannuleerd $1' },
    { pattern: /^🌤️ طقس (.+) \((\d+) أيام\)$/u, en: '🌤️ $1 weather ($2 days)', ur: '🌤️ موسم $1 ($2 دن)', nl: '🌤️ Weer $1 ($2 dagen)' },
    { pattern: /^📋 ملخص رحلة \((\d+) حجوزات\)$/u, en: '📋 Trip summary ($1 bookings)', ur: '📋 سفری خلاصہ ($1 بکنگز)', nl: '📋 Reisoverzicht ($1 boekingen)' },
    { pattern: /^🔀 أجاب (.+) \(حصّة المزوّد الأساسي مؤقتاً ممتلئة\)$/u, en: '🔀 Answered by $1 (primary provider quota temporarily full)', ur: '🔀 جواب $1 کی طرف سے (بنیادی فراہم کنندہ کا کوٹہ عارضی طور پر بھرا ہوا ہے)', nl: '🔀 Beantwoord door $1 (quotum van de primaire aanbieder tijdelijk vol)' },

    // ─── التنبيهات المخزَّنة (تُكتب بالعربية وقت وقوعها في الخادم — تُترجم
    // عرضاً سطراً سطراً: الواجهة تقسم الجسم بـ<br> فيصير كل سطر عقدة) ───
    { pattern: /^✅ تأكيد حجزك — مرجع (.+)$/u, en: '✅ Booking confirmed — reference $1', ur: '✅ بکنگ کی تصدیق — حوالہ $1', nl: '✅ Boeking bevestigd — referentie $1' },
    { pattern: /^↩️ تم إلغاء حجزك — مرجع (.+)$/u, en: '↩️ Booking cancelled — reference $1', ur: '↩️ آپ کی بکنگ منسوخ کر دی گئی — حوالہ $1', nl: '↩️ Boeking geannuleerd — referentie $1' },
    { pattern: /^⚠️ تغيير من شركة الطيران على حجزك — مرجع (.+)$/u, en: '⚠️ Airline change on your booking — reference $1', ur: '⚠️ آپ کی بکنگ میں ایئرلائن کی جانب سے تبدیلی — حوالہ $1', nl: '⚠️ Wijziging door de luchtvaartmaatschappij op uw boeking — referentie $1' },
    { pattern: /^🔔 توفّرت مقاعد — (.+)$/u, en: '🔔 Seats available — $1', ur: '🔔 نشستیں دستیاب ہو گئیں — $1', nl: '🔔 Stoelen beschikbaar — $1' },
    { pattern: /^💳 اكتمل سداد باقتك — (.+)$/u, en: '💳 Package fully paid — $1', ur: '💳 آپ کے پیکج کی مکمل ادائیگی ہو گئی — $1', nl: '💳 Uw pakket is volledig betaald — $1' },
    { pattern: /^⏰ تذكير برحلتك — مرجع (.+)$/u, en: '⏰ Trip reminder — reference $1', ur: '⏰ آپ کے سفر کی یاد دہانی — حوالہ $1', nl: '⏰ Herinnering aan uw reis — referentie $1' },
    { pattern: /^(.+) — عربون (\d+)% \((.+)\)$/u, en: '$1 — $2% deposit ($3)', ur: '$1 — $2% ایڈوانس ($3)', nl: '$1 — $2% aanbetaling ($3)' },
    { pattern: /^(.+) — دفع كامل \((.+)\)$/u, en: '$1 — paid in full ($2)', ur: '$1 — مکمل ادائیگی ($2)', nl: '$1 — volledig betaald ($2)' },
    { pattern: /^سداد متبقي (.+) \((.+)\)$/u, en: 'Balance due — $1 ($2)', ur: 'بقایا رقم — $1 ($2)', nl: 'Resterend bedrag — $1 ($2)' },
    { pattern: /^تم تأكيد حجزك بنجاح\.$/u, en: 'Your booking was confirmed successfully.', ur: 'آپ کی بکنگ کامیابی سے تصدیق ہو گئی۔', nl: 'Uw boeking is succesvol bevestigd.' },
    { pattern: /^تم إلغاء حجزك\.$/u, en: 'Your booking was cancelled.', ur: 'آپ کی بکنگ منسوخ کر دی گئی۔', nl: 'Uw boeking is geannuleerd.' },
    { pattern: /^المرجع: (.+)$/u, en: 'Reference: $1', ur: 'حوالہ: $1', nl: 'Referentie: $1' },
    { pattern: /^الإجمالي: (.+)$/u, en: 'Total: $1', ur: 'کل رقم: $1', nl: 'Totaal: $1' },
    { pattern: /^راجع كل حجوزاتك من بوابة السفر\.$/u, en: 'See all your bookings in the travel portal.', ur: 'اپنی تمام بکنگز سفری پورٹل سے دیکھیں۔', nl: 'Bekijk al uw boekingen in het reisportaal.' },
    { pattern: /^راجع تفاصيل حجزك من بوابة السفر أو تواصل مع شركة الطيران بالمرجع أعلاه\.$/u,
        en: 'See your booking details in the travel portal, or contact the airline with the reference above.',
        ur: 'اپنی بکنگ کی تفصیلات سفری پورٹل سے دیکھیں، یا اوپر دیے گئے حوالے کے ساتھ ایئرلائن سے رابطہ کریں۔',
        nl: 'Bekijk uw boekingsdetails in het reisportaal, of neem contact op met de luchtvaartmaatschappij met de referentie hierboven.' },
    { pattern: /^أجرت شركة الطيران تغييراً على رحلتك بعد الحجز \(موعد أو مسار\)\.$/u,
        en: 'The airline changed your flight after booking (schedule or route).',
        ur: 'ایئرلائن نے بکنگ کے بعد آپ کی پرواز میں تبدیلی کی ہے (وقت یا روٹ)۔',
        nl: 'De luchtvaartmaatschappij heeft na de boeking een wijziging aangebracht in uw vlucht (tijd of route).' },
    { pattern: /^⚠️ وأثر هذا على بقية خطتك:$/u, en: '⚠️ This affects the rest of your plan:', ur: '⚠️ اور اس کا اثر آپ کے باقی سفری منصوبے پر پڑا:', nl: '⚠️ En dit heeft invloed op de rest van uw planning:' },
    { pattern: /^انخفض سعر (.+) بتاريخ ([\d-]+) إلى (.+)\.$/u, en: 'The price for $1 on $2 dropped to $3.', ur: '$1 کی قیمت $2 کو کم ہو کر $3 ہو گئی۔', nl: 'De prijs van $1 daalde op $2 naar $3.' },
    { pattern: /^\(هدفك كان (.+)\.\)$/u, en: '(Your target was $1.)', ur: '(آپ کا ہدف $1 تھا۔)', nl: '(Uw doel was $1.)' },
    { pattern: /^الأسعار تتغيّر باستمرار — احجز من بوابة السفر إن ناسبك\.$/u,
        en: 'Prices move constantly — book from the travel portal if it suits you.',
        ur: 'قیمتیں مسلسل تبدیل ہوتی رہتی ہیں — اگر مناسب لگے تو سفری پورٹل سے بک کریں۔',
        nl: 'Prijzen veranderen voortdurend — boek via het reisportaal als het u uitkomt.' },
];

/**
 * استبدالات جزئية آمنة داخل النصوص المختلطة (مدينة · تاريخ · «5 ليالٍ»):
 * كلمات عربية مميزة لا تلتبس — تُطبَّق أخيراً وعالمياً داخل عقدة النص.
 * `{ ar, en }` بدل زوج مصفوفة — نفس مبدأ الجدول الرئيسي أعلاه.
 */
window.JAOLA_I18N_SUBS = [
    { ar: ' ليالٍ', en: ' nights', ur: ' راتیں', nl: ' nachten' },
    { ar: ' ليلة', en: ' night(s)', ur: ' رات(یں)', nl: ' nacht(en)' },
    { ar: ' مقاعد', en: ' seats', ur: ' نشستیں', nl: ' stoelen' },
    { ar: ' مسافر', en: ' traveller(s)', ur: ' مسافر', nl: ' reiziger(s)' },
    { ar: ' مراجعة موثقة', en: ' verified reviews', ur: ' تصدیق شدہ جائزے', nl: ' geverifieerde beoordelingen' },
    { ar: 'انطلاق ', en: 'Departs ', ur: 'روانگی ', nl: 'Vertrek ' },
    { ar: 'أقرب انطلاقة ', en: 'Next departure ', ur: 'اگلی روانگی ', nl: 'Eerstvolgende vertrek ' },
    { ar: 'شامل الإفطار', en: 'Breakfast included', ur: 'ناشتہ شامل', nl: 'Inclusief ontbijt' },
    { ar: 'إفطار وعشاء', en: 'Half board', ur: 'ناشتہ اور رات کا کھانا', nl: 'Half pension' },
    { ar: 'بدون إعاشة', en: 'Room only', ur: 'صرف کمرہ (کھانا شامل نہیں)', nl: 'Alleen kamer' },
    { ar: 'حقيبة مسجَّلة', en: 'checked bag', ur: 'چیک اِن بیگ', nl: 'incheckbagage' },
    { ar: 'حقيبة يد', en: 'carry-on bag', ur: 'ہینڈ بیگ', nl: 'handbagage' },
];
