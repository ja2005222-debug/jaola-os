/**
 * 🤖 agent.js — الايجنت الحاجز: وكيل حواري يبحث ويحجز ويلغي **فعلياً**
 *
 * نقطة تميّز البوابة كلها: ليس شات يقترح روابط، بل وكيل بأدوات (tool
 * use) فوق نفس منطق الخدمة الداخلي — أدواته هي حرفياً نفس الدوال التي
 * تنفذها مسارات HTTP (تُحقن services مربوطة بالمستخدم لكل طلب)، فكل
 * حراسات التحقق والملكية والتسعير تسري عليه تلقائياً: **صفر التفاف**.
 *
 * نقطة النهاية: أي خدمة متوافقة مع OpenAI chat/completions تدعم tools
 * (Groq افتراضياً بنموذج llama-3.3-70b) — نفس الصيغة المستخدمة فعلياً في
 * scriptProvider.js وbackend/utils/aiProvider.js، وصيغة tools/tool_calls
 * موثَّقة لدى Groq. لا تخمين صيغ جديدة.
 *
 * 🛡️ حارس الحجز على مستويين:
 *   1. أداة book_flight تتطلب confirmed=true، والتعليمات تلزم الايجنت
 *      بعرض ملخص العرض والسعر الكامل ونيل موافقة صريحة قبل ضبطها.
 *   2. منفّذ الأداة يرفض confirmed غير الصريح برسالة تعليمية تُعاد
 *      للنموذج فيصحح مساره (لا حجز صامت أبداً).
 * (المرحلة ١ بيئة تجريبية — قبل الإنتاج يُضاف تأكيد UI صريح خارج
 * النموذج كلياً: زر يوقّع نية الحجز في الطلب نفسه.)
 */

const DEFAULT_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
// 10 لا 6: البحث المقارن (تواريخ مرنة/بدائل) يستهلك جولات أكثر من حجز مباشر
const MAX_TOOL_ROUNDS = 10;
const MAX_TOOL_RESULT_CHARS = 6000;

const SYSTEM_PROMPT = `أنت "مساعد جاولا للسفر" — وكيل سفر شامل محترف يتحدث العربية (أو لغة المستخدم)، لا مجرد حاجز طيران.
قدراتك عبر الأدوات: بحث رحلات وفنادق، فحص عرض محدد، حجز فعلي (طيران/فنادق)، عرض حجوزات المستخدم، إلغاء حجز، بحث تواريخ مرنة، فحص تعارض الرحلة، مراقبة سعر، توقعات طقس الوجهة، تحويل عملات، وتجميع ملخص رحلة منسّق.
قواعد صارمة:
1. الأسعار التي تعيدها الأدوات نهائية وشاملة — لا تخترع أسعاراً أو رحلات أو فنادق من ذاكرتك أبداً؛ كل معلومة رحلة/فندق تأتي من أداة.
2. قبل أي حجز: اعرض ملخص الرحلة/الإقامة والسعر الإجمالي واسأل المستخدم صراحةً "هل أؤكد الحجز؟" — لا تضبط confirmed=true إلا بعد موافقة صريحة في رسالة المستخدم الأخيرة.
3. للحجز تحتاج لكل مسافر: اللقب (mr/ms/mrs)، الاسم الأول واسم العائلة بالحروف اللاتينية كما في الجواز، تاريخ الميلاد (YYYY-MM-DD)، والجنس (m/f) — ولا تنس بريد التواصل والهاتف. اجمعها بالحوار إن نقصت. للفنادق يكفي اسم كل ضيق (بالحروف اللاتينية) + بريد وهاتف تواصل، بلا جواز أو ميلاد.
4. قبل الإلغاء: أكد مع المستخدم واذكر أن مبلغ الاسترداد يحدده المزوّد.
5. كن موجزاً وعملياً — رقّم الخيارات ليسهل الاختيار، واذكر التوقيتات والمدة وعدد التوقفات (للطيران) أو التقييم والليالي (للفنادق).
6. رموز المطارات IATA من ثلاثة أحرف (RUH, JED, CAI, DXB...) — استنتجها من أسماء المدن، واسأل عند اللبس. بحث الفنادق يستخدم نفس رمز المطار كمرجع للمدينة.
7. بعد حجز رحلة طيران بنجاح، اقترح على المستخدم فندقاً بنفس الوجهة وتواريخ قريبة (عبر search_stays) إن كان ذلك منطقياً — لا تفترض موافقته، اقترح فقط.
8. عند نتائج بحث غالية جداً أو معدومة، جرّب مطارات قريبة أو تواريخ مجاورة (نداءات search_flights/search_stays إضافية) قبل إخبار المستخدم بعدم وجود خيارات — لا تستسلم من أول محاولة.
9. إن سأل المستخدم عن أرخص تاريخ ضمن مدى مرن استخدم find_flexible_dates بدل نداءات search_flights متكررة يدوياً. بعد أي حجز جديد أو عند سؤال المستخدم "هل خطتي متعارضة؟" استخدم check_trip_conflicts وأبلغه بأي تحذير فوراً. إن طلب مراقبة سعر رحلة لم تنخفض بعد استخدم watch_price واشرح أن الفحص دوري لا لحظي.
10. أسئلة الطقس والعملة تُجاب حصراً عبر get_destination_weather وconvert_currency (بيانات حقيقية) — لا تخمين درجات حرارة أو أسعار صرف من ذاكرتك أبداً. أسئلة الأمتعة تُجاب من بيانات العرض نفسه (search_flights) إن وُجدت.
11. أسئلة عامة عن الوجهة (تأشيرة، جمارك، عادات، أفضل وقت للزيارة، سلامة) يمكنك إجابتها من معرفتك العامة — بخلاف السعر/التوفر التي تبقى حصراً من الأدوات — لكن أضف دوماً جملة تنبيه واضحة: "معلومة استرشادية عامة، تحقق من السفارة أو الموقع الرسمي قبل السفر."
12. إن طلب المستخدم "رتّب لي رحلتي" أو ملخصاً شاملاً لخطته استخدم generate_trip_summary بدل تجميع الحجوزات يدوياً من list_my_bookings.`;

/** تعريفات الأدوات بصيغة OpenAI tools الموثَّقة. */
export const AGENT_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'search_flights',
            description: 'يبحث عن رحلات طيران متاحة بأسعار نهائية. يعيد قائمة عروض بمعرّفاتها.',
            parameters: {
                type: 'object',
                properties: {
                    origin: { type: 'string', description: 'رمز IATA لمطار المغادرة (مثل RUH)' },
                    destination: { type: 'string', description: 'رمز IATA لمطار الوصول (مثل CAI)' },
                    departDate: { type: 'string', description: 'تاريخ الذهاب YYYY-MM-DD' },
                    returnDate: { type: 'string', description: 'تاريخ العودة YYYY-MM-DD (اختياري — ذهاب فقط بدونه)' },
                    adults: { type: 'integer', description: 'عدد البالغين (افتراضي 1)' },
                    children: { type: 'integer', description: 'عدد الأطفال (افتراضي 0)' },
                    cabin: { type: 'string', enum: ['economy', 'premium_economy', 'business', 'first'] },
                },
                required: ['origin', 'destination', 'departDate'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_offer',
            description: 'يجلب تفاصيل عرض محدد بسعر محدَّث (العروض تنتهي صلاحيتها).',
            parameters: {
                type: 'object',
                properties: { offerId: { type: 'string' } },
                required: ['offerId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'book_flight',
            description: 'يحجز عرضاً فعلياً ويصدر التذكرة. لا تستخدمه إلا بعد موافقة المستخدم الصريحة على الملخص والسعر.',
            parameters: {
                type: 'object',
                properties: {
                    offerId: { type: 'string' },
                    passengers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string', enum: ['mr', 'ms', 'mrs'] },
                                givenName: { type: 'string' },
                                familyName: { type: 'string' },
                                bornOn: { type: 'string', description: 'YYYY-MM-DD' },
                                gender: { type: 'string', enum: ['m', 'f'] },
                            },
                            required: ['title', 'givenName', 'familyName', 'bornOn', 'gender'],
                        },
                    },
                    contact: {
                        type: 'object',
                        properties: { email: { type: 'string' }, phone: { type: 'string' } },
                        required: ['email', 'phone'],
                    },
                    confirmed: { type: 'boolean', description: 'true فقط بعد موافقة المستخدم الصريحة على الحجز' },
                },
                required: ['offerId', 'passengers', 'contact', 'confirmed'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_my_bookings',
            description: 'يعرض حجوزات المستخدم الحالية بحالاتها ومراجعها.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'cancel_booking',
            description: 'يلغي حجز رحلة قائم (issued) بعد تأكيد المستخدم. الاسترداد حسب سياسة المزوّد.',
            parameters: {
                type: 'object',
                properties: {
                    bookingId: { type: 'string' },
                    confirmed: { type: 'boolean', description: 'true فقط بعد تأكيد المستخدم الصريح للإلغاء' },
                },
                required: ['bookingId', 'confirmed'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_stays',
            description: 'يبحث عن فنادق متاحة قرب وجهة محددة بأسعار نهائية. يعيد قائمة عروض بمعرّفاتها.',
            parameters: {
                type: 'object',
                properties: {
                    iata: { type: 'string', description: 'رمز IATA لمطار أقرب مدينة (مثل RUH أو DXB)' },
                    checkInDate: { type: 'string', description: 'تاريخ الوصول YYYY-MM-DD' },
                    checkOutDate: { type: 'string', description: 'تاريخ المغادرة YYYY-MM-DD' },
                    adults: { type: 'integer', description: 'عدد البالغين (افتراضي 1)' },
                    rooms: { type: 'integer', description: 'عدد الغرف (افتراضي 1)' },
                },
                required: ['iata', 'checkInDate', 'checkOutDate'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_stay_offer',
            description: 'يجلب تفاصيل عرض فندق محدد بسعر محدَّث (العروض تنتهي صلاحيتها).',
            parameters: {
                type: 'object',
                properties: { offerId: { type: 'string' } },
                required: ['offerId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'book_stay',
            description: 'يحجز عرض فندق فعلياً. لا تستخدمه إلا بعد موافقة المستخدم الصريحة على الملخص والسعر.',
            parameters: {
                type: 'object',
                properties: {
                    offerId: { type: 'string' },
                    guests: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                givenName: { type: 'string' },
                                familyName: { type: 'string' },
                            },
                            required: ['givenName', 'familyName'],
                        },
                    },
                    contact: {
                        type: 'object',
                        properties: { email: { type: 'string' }, phone: { type: 'string' } },
                        required: ['email', 'phone'],
                    },
                    confirmed: { type: 'boolean', description: 'true فقط بعد موافقة المستخدم الصريحة على الحجز' },
                },
                required: ['offerId', 'guests', 'contact', 'confirmed'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'cancel_stay',
            description: 'يلغي حجز فندق قائم (issued) بعد تأكيد المستخدم. الاسترداد حسب سياسة المزوّد.',
            parameters: {
                type: 'object',
                properties: {
                    bookingId: { type: 'string' },
                    confirmed: { type: 'boolean', description: 'true فقط بعد تأكيد المستخدم الصريح للإلغاء' },
                },
                required: ['bookingId', 'confirmed'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'find_flexible_dates',
            description: 'يبحث عن أرخص تاريخ رحلة ضمن نافذة أيام حول تاريخ مستهدف — أفضل من نداءات search_flights متكررة يدوياً.',
            parameters: {
                type: 'object',
                properties: {
                    origin: { type: 'string', description: 'رمز IATA لمطار المغادرة' },
                    destination: { type: 'string', description: 'رمز IATA لمطار الوصول' },
                    aroundDate: { type: 'string', description: 'تاريخ مركزي YYYY-MM-DD' },
                    windowDays: { type: 'integer', description: 'نصف عرض النافذة بالأيام (1-7، افتراضي 3)' },
                    cabin: { type: 'string', enum: ['economy', 'premium_economy', 'business', 'first'] },
                },
                required: ['origin', 'destination', 'aroundDate'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'check_trip_conflicts',
            description: 'يفحص حجوزات المستخدم الحالية (طيران+فنادق) بحثاً عن تعارض تواريخ — يستخدم بعد أي حجز جديد أو عند سؤال المستخدم.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'watch_price',
            description: 'ينشئ مراقبة دورية لسعر رحلة معيّنة — يُخطر (بريدياً إن مضبوط) عند الانخفاض. الفحص دوري لا لحظي.',
            parameters: {
                type: 'object',
                properties: {
                    origin: { type: 'string' },
                    destination: { type: 'string' },
                    departDate: { type: 'string' },
                    returnDate: { type: 'string' },
                    cabin: { type: 'string', enum: ['economy', 'premium_economy', 'business', 'first'] },
                    targetPrice: { type: 'number', description: 'سعر يودّ المستخدم التنبيه دونه (اختياري)' },
                    contactEmail: { type: 'string', description: 'بريد المستخدم لإشعار انخفاض السعر (اختياري — اسأله إن أراد إشعاراً بريدياً)' },
                },
                required: ['origin', 'destination', 'departDate'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_price_watches',
            description: 'يعرض مراقبات الأسعار النشطة للمستخدم.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'cancel_price_watch',
            description: 'يلغي مراقبة سعر قائمة.',
            parameters: {
                type: 'object',
                properties: { watchId: { type: 'string' } },
                required: ['watchId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_destination_weather',
            description: 'يجلب توقعات طقس يومية حقيقية (حرارة عليا/دنيا وهطول) لوجهة ومدى تاريخ — متاح حتى 16 يوماً قادماً فقط.',
            parameters: {
                type: 'object',
                properties: {
                    iata: { type: 'string', description: 'رمز IATA لأقرب مطار للوجهة' },
                    dateFrom: { type: 'string', description: 'تاريخ بداية YYYY-MM-DD' },
                    dateTo: { type: 'string', description: 'تاريخ نهاية YYYY-MM-DD (اختياري — يوم واحد بدونه)' },
                },
                required: ['iata', 'dateFrom'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'convert_currency',
            description: 'يحوّل مبلغاً بسعر صرف حقيقي محدَّث بين عملتين — لأسئلة "كم هذا بعملتي؟".',
            parameters: {
                type: 'object',
                properties: {
                    amount: { type: 'number' },
                    from: { type: 'string', description: 'رمز العملة المصدر (مثل USD)' },
                    to: { type: 'string', description: 'رمز العملة الهدف (مثل SAR)' },
                },
                required: ['amount', 'from', 'to'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generate_trip_summary',
            description: 'يجمع كل حجوزات المستخدم المُصدَرة (طيران+فنادق) في نص منسّق مرتّب زمنياً — "رتّب لي خطة رحلتي".',
            parameters: {
                type: 'object',
                properties: {
                    fromDate: { type: 'string', description: 'تاريخ بداية المدى YYYY-MM-DD (اختياري)' },
                    toDate: { type: 'string', description: 'تاريخ نهاية المدى YYYY-MM-DD (اختياري)' },
                },
            },
        },
    },
];

/**
 * ينفّذ أداة واحدة عبر services المحقونة (المربوطة بالمستخدم). يعيد
 * دوماً نتيجة نصية تُغذَّى للنموذج — الأخطاء تعود كرسائل عربية تعليمية
 * يصحّح بها النموذج مساره، لا استثناءات تقطع الحوار.
 */
export async function executeAgentTool(name, args, services) {
    try {
        switch (name) {
            case 'search_flights': {
                const offers = await services.searchFlights(args);
                return { ok: true, summary: `🔎 ${args.origin}→${args.destination} (${offers.length} عروض)`, data: offers };
            }
            case 'get_offer': {
                const offer = await services.getOffer(args.offerId);
                if (!offer) return { ok: false, data: { error: 'العرض غير موجود أو انتهت صلاحيته — أعد البحث.' } };
                return { ok: true, summary: `💰 عرض بسعر ${offer.sellAmount} ${offer.currency}`, data: offer };
            }
            case 'book_flight': {
                if (args.confirmed !== true) {
                    return { ok: false, data: { error: 'الحجز يتطلب موافقة المستخدم الصريحة أولاً — اعرض الملخص والسعر واسأله، ثم أعد النداء بـconfirmed=true.' } };
                }
                const booking = await services.bookFlight(args);
                return {
                    ok: true,
                    summary: `✅ حُجز — المرجع ${booking.bookingReference}`,
                    data: {
                        bookingId: booking.id, bookingReference: booking.bookingReference,
                        status: booking.status, total: `${booking.sellAmount} ${booking.currency}`,
                    },
                };
            }
            case 'list_my_bookings': {
                const bookings = await services.listBookings();
                return { ok: true, summary: `🧳 ${bookings.length} حجوزات`, data: bookings };
            }
            case 'cancel_booking': {
                if (args.confirmed !== true) {
                    return { ok: false, data: { error: 'الإلغاء يتطلب تأكيد المستخدم الصريح — اسأله أولاً ثم أعد النداء بـconfirmed=true.' } };
                }
                const result = await services.cancelBooking(args.bookingId);
                return { ok: true, summary: `↩️ أُلغي الحجز ${args.bookingId}`, data: result };
            }
            case 'search_stays': {
                if (!services.searchStays) return { ok: false, data: { error: 'حجز الفنادق غير مفعَّل حالياً.' } };
                const offers = await services.searchStays(args);
                return { ok: true, summary: `🏨 ${args.iata} (${offers.length} فنادق)`, data: offers };
            }
            case 'get_stay_offer': {
                if (!services.getStayOffer) return { ok: false, data: { error: 'حجز الفنادق غير مفعَّل حالياً.' } };
                const offer = await services.getStayOffer(args.offerId);
                if (!offer) return { ok: false, data: { error: 'عرض الفندق غير موجود أو انتهت صلاحيته — أعد البحث.' } };
                return { ok: true, summary: `💰 عرض فندق بسعر ${offer.sellAmount} ${offer.currency}`, data: offer };
            }
            case 'book_stay': {
                if (!services.bookStay) return { ok: false, data: { error: 'حجز الفنادق غير مفعَّل حالياً.' } };
                if (args.confirmed !== true) {
                    return { ok: false, data: { error: 'الحجز يتطلب موافقة المستخدم الصريحة أولاً — اعرض الملخص والسعر واسأله، ثم أعد النداء بـconfirmed=true.' } };
                }
                const booking = await services.bookStay(args);
                return {
                    ok: true,
                    summary: `✅ حُجز فندق — المرجع ${booking.bookingReference}`,
                    data: {
                        bookingId: booking.id, bookingReference: booking.bookingReference,
                        status: booking.status, total: `${booking.sellAmount} ${booking.currency}`,
                    },
                };
            }
            case 'cancel_stay': {
                if (!services.cancelStay) return { ok: false, data: { error: 'حجز الفنادق غير مفعَّل حالياً.' } };
                if (args.confirmed !== true) {
                    return { ok: false, data: { error: 'الإلغاء يتطلب تأكيد المستخدم الصريح — اسأله أولاً ثم أعد النداء بـconfirmed=true.' } };
                }
                const result = await services.cancelStay(args.bookingId);
                return { ok: true, summary: `↩️ أُلغي حجز الفندق ${args.bookingId}`, data: result };
            }
            case 'find_flexible_dates': {
                if (!services.findFlexibleDates) return { ok: false, data: { error: 'بحث التواريخ المرنة غير متاح حالياً.' } };
                const days = await services.findFlexibleDates(args);
                return { ok: true, summary: `📅 ${args.origin}→${args.destination} (${days.length} تواريخ)`, data: days };
            }
            case 'check_trip_conflicts': {
                if (!services.checkTripConflicts) return { ok: false, data: { error: 'فحص التعارض غير متاح حالياً.' } };
                const warnings = await services.checkTripConflicts();
                return { ok: true, summary: warnings.length ? `⚠️ ${warnings.length} تعارض محتمل` : '✅ لا تعارض', data: warnings };
            }
            case 'watch_price': {
                if (!services.watchPrice) return { ok: false, data: { error: 'مراقبة الأسعار غير متاحة حالياً.' } };
                const watch = await services.watchPrice(args);
                return { ok: true, summary: `👁️ مراقبة سعر ${args.origin}→${args.destination}`, data: watch };
            }
            case 'list_price_watches': {
                if (!services.listPriceWatches) return { ok: false, data: { error: 'مراقبة الأسعار غير متاحة حالياً.' } };
                const watches = await services.listPriceWatches();
                return { ok: true, summary: `👁️ ${watches.length} مراقبات نشطة`, data: watches };
            }
            case 'cancel_price_watch': {
                if (!services.cancelPriceWatch) return { ok: false, data: { error: 'مراقبة الأسعار غير متاحة حالياً.' } };
                const result = await services.cancelPriceWatch(args.watchId);
                return { ok: true, summary: `🚫 أُلغيت المراقبة ${args.watchId}`, data: result };
            }
            case 'get_destination_weather': {
                if (!services.getDestinationWeather) return { ok: false, data: { error: 'توقعات الطقس غير متاحة حالياً.' } };
                const weather = await services.getDestinationWeather(args);
                return { ok: true, summary: `🌤️ طقس ${weather.city} (${weather.days.length} أيام)`, data: weather };
            }
            case 'convert_currency': {
                if (!services.convertCurrency) return { ok: false, data: { error: 'تحويل العملات غير متاح حالياً.' } };
                const result = await services.convertCurrency(args);
                return { ok: true, summary: `💱 ${result.amount} ${args.from} = ${result.converted} ${args.to}`, data: result };
            }
            case 'generate_trip_summary': {
                if (!services.generateTripSummary) return { ok: false, data: { error: 'ملخص الرحلة غير متاح حالياً.' } };
                const summary = await services.generateTripSummary(args);
                return { ok: true, summary: `📋 ملخص رحلة (${summary.bookingCount} حجوزات)`, data: summary };
            }
            default:
                return { ok: false, data: { error: `أداة مجهولة: ${name}` } };
        }
    } catch (e) {
        return { ok: false, data: { error: e.message } };
    }
}

export function createTravelAgent({ apiKey, apiUrl = DEFAULT_API_URL, model = DEFAULT_MODEL, fetchImpl = fetch }) {
    if (!apiKey) throw new Error('مفتاح مزوّد الايجنت مطلوب.');

    async function complete(messages) {
        const res = await fetchImpl(apiUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, tools: AGENT_TOOLS, tool_choice: 'auto', temperature: 0.3 }),
        });
        if (!res.ok) {
            const detail = await res.text().catch(() => '');
            throw new Error(`تعذّر الاتصال بمزوّد الايجنت (HTTP ${res.status}). ${detail.slice(0, 300)}`);
        }
        const payload = await res.json();
        const message = payload.choices?.[0]?.message;
        if (!message) throw new Error('رد مزوّد الايجنت بلا رسالة.');
        return message;
    }

    return {
        name: 'travel-agent',
        model,

        /**
         * جولة حوار كاملة: تاريخ الرسائل → (نداءات أدوات حتى MAX_TOOL_ROUNDS)
         * → {reply, actions} حيث actions سجل ما نُفّذ فعلاً (تعرضه الواجهة
         * كرقائق شفافية: المستخدم يرى ماذا فعل الوكيل لا كلامه فقط).
         */
        async chat({ messages, services }) {
            const convo = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
            const actions = [];
            for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
                const msg = await complete(convo);
                if (!msg.tool_calls || msg.tool_calls.length === 0) {
                    return { reply: msg.content || '', actions };
                }
                convo.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls });
                for (const call of msg.tool_calls) {
                    let args = {};
                    try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* أدناه يرفضها المنفّذ */ }
                    const result = await executeAgentTool(call.function?.name, args, services);
                    if (result.ok && result.summary) actions.push({ tool: call.function?.name, summary: result.summary });
                    convo.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: JSON.stringify(result.data).slice(0, MAX_TOOL_RESULT_CHARS),
                    });
                }
            }
            return { reply: 'تجاوزت الجولة حد الأدوات — جرّب طلباً أبسط أو أكمل خطوة خطوة.', actions };
        },
    };
}

/** null بلا مفتاح — الخدمة تعمل كاملة بدون الايجنت (تدهور رشيق). */
export function buildTravelAgent(env = process.env) {
    if (!env.TRAVEL_AGENT_API_KEY) return null;
    return createTravelAgent({
        apiKey: env.TRAVEL_AGENT_API_KEY,
        apiUrl: env.TRAVEL_AGENT_API_URL || undefined,
        model: env.TRAVEL_AGENT_MODEL || undefined,
    });
}
