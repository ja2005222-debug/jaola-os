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
/**
 * 📈 رُفعت 3000 → 12000 بعد ترقية حساب Groq من المجاني (12,000 TPM) إلى
 * Developer (300,000 TPM لـllama-3.3-70b-versatile — تحقّق حيّ من لوحة
 * الحساب لا افتراضاً). القياس بالمقياس التجريبي نفسه الذي بُني به الحدّ
 * الأول (README، «المرحلة ٤و»): أسوأ حالة ≈ 3301 رمز ثابت (مخططات
 * الأدوات + التعليمة) + ~2.78 رمز لكل حرف من هذا الحدّ عبر عشر جولات
 * تراكمية (MAX_TOOL_ROUNDS) — أي **~36,661 رمزاً** أسوأ حالة عند 12000،
 * ما يزال **~12%** فقط من الحصّة الجديدة، لا حافتها.
 *
 * ⚠️ عمداً لم يُرفع إلى حافة الحصّة (كان الحدّ القديم عند ~97% منها —
 * ضيقٌ اضطراريٌّ فرضه المجاني): 88% المتبقّية هامشٌ لمستخدمين متزامنين
 * ومحاولات إعادة، لا رقماً مُهدَراً. ولو تشارك هذا المفتاح TRAVEL_AGENT_
 * API_KEY مع مزوّدات أخرى في jaola-os يوماً، الحصّة الفعلية المتاحة أقل
 * من رقم اللوحة — الهامش الواسع يمتصّ ذلك أيضاً.
 */
export const MAX_TOOL_RESULT_CHARS = 12000;
const MAX_RETRIES = 2;          // ثلاث محاولات إجمالاً
const MAX_RETRY_WAIT_MS = 4000; // لا نُجمّد المسافر انتظاراً لحدّ معدّل

/**
 * كم ننتظر قبل إعادة المحاولة؟ نُفضّل ما يقوله المزوّد على تخميننا:
 * ترويسة `retry-after` أولاً، ثم المدة المذكورة في نص الخطأ، وأخيراً
 * تراجع أُسّي. مسقوفٌ دوماً حتى لا يعلق الطلب.
 */
export function retryDelayMs(res, detail, attempt) {
    const header = Number(res?.headers?.get?.('retry-after'));
    if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, MAX_RETRY_WAIT_MS);
    const m = /try again in ([\d.]+)\s*s/i.exec(String(detail || ''));
    if (m) return Math.min(Math.ceil(parseFloat(m[1]) * 1000) + 250, MAX_RETRY_WAIT_MS);
    return Math.min(500 * 2 ** attempt, MAX_RETRY_WAIT_MS);
}

/**
 * يقلّص نتيجة أداة مع **إبقائها JSON صالحاً**.
 *
 * ⚠️ كان التقليص `JSON.stringify(data).slice(0, N)` — يقطع وسط البنية
 * فيصل النموذجَ نصٌّ لا يُحلَّل، ويبني عليه جوابه. الآن تُسقَط عناصر من
 * آخر المصفوفة (الأقل صلة عادةً: النتائج مرتّبة بالأنسب أولاً) ويُذكر
 * كم أُسقط، فيعرف النموذج أن ثمّة المزيد بدل أن يظنّ القائمة كاملة.
 */
export function compactToolResult(data, maxChars = MAX_TOOL_RESULT_CHARS) {
    let text = JSON.stringify(data);
    if (text.length <= maxChars) return text;
    if (Array.isArray(data)) {
        const kept = data.slice();
        while (kept.length > 1) {
            kept.pop();
            text = JSON.stringify({ items: kept, omitted: data.length - kept.length });
            if (text.length <= maxChars) return text;
        }
        return JSON.stringify({ items: kept.slice(0, 1), omitted: data.length - 1, truncated: true });
    }
    // كائن مفرد ضخم: نُبقيه نصاً مقطوعاً لكن نُعلم النموذج صراحةً
    return JSON.stringify({ partial: true, text: text.slice(0, maxChars - 40) });
}

const SYSTEM_PROMPT = `أنت "مساعد جاولا للسفر" — وكيل سفر شامل محترف يتحدث العربية (أو لغة المستخدم)، لا مجرد حاجز طيران.
قدراتك عبر الأدوات: بحث رحلات وفنادق وسيارات إيجار، فحص عرض محدد، حجز فعلي (طيران/فنادق/سيارات)، عرض حجوزات المستخدم، إلغاء حجز، بحث تواريخ مرنة، فحص تعارض الرحلة، مراقبة سعر، توقعات طقس الوجهة، تحويل عملات، وتجميع ملخص رحلة منسّق.
قواعد صارمة:
1. الأسعار التي تعيدها الأدوات نهائية وشاملة — لا تخترع أسعاراً أو رحلات أو فنادق أو سيارات من ذاكرتك أبداً؛ كل معلومة رحلة/فندق/سيارة تأتي من أداة.
2. قبل أي حجز: اعرض ملخص الرحلة/الإقامة/السيارة والسعر الإجمالي واسأل المستخدم صراحةً "هل أؤكد الحجز؟" — لا تضبط confirmed=true إلا بعد موافقة صريحة في رسالة المستخدم الأخيرة.
3. للحجز تحتاج لكل مسافر: اللقب (mr/ms/mrs)، الاسم الأول واسم العائلة بالحروف اللاتينية كما في الجواز، تاريخ الميلاد (YYYY-MM-DD)، والجنس (m/f) — ولا تنس بريد التواصل والهاتف. اجمعها بالحوار إن نقصت. للفنادق والسيارات يكفي اسم كل ضيف/سائق (بالحروف اللاتينية) + بريد وهاتف تواصل، بلا جواز أو ميلاد.
4. قبل الإلغاء: أكد مع المستخدم واذكر أن مبلغ الاسترداد يحدده المزوّد.
5. كن موجزاً وعملياً — رقّم الخيارات ليسهل الاختيار، واذكر التوقيتات والمدة وعدد التوقفات (للطيران) أو التقييم والليالي (للفنادق) أو نوع السيارة والشركة المؤجّرة (للسيارات).
6. رموز المطارات IATA من ثلاثة أحرف (RUH, JED, CAI, DXB...) — استنتجها من أسماء المدن، واسأل عند اللبس. بحث الفنادق يستخدم نفس رمز المطار كمرجع للمدينة.
7. بعد حجز رحلة طيران بنجاح، اقترح على المستخدم فندقاً بنفس الوجهة وتواريخ قريبة (عبر search_stays)، وسيارة إيجار لنفس فترة الإقامة إن ناسب (عبر search_cars) — لا تفترض موافقته، اقترح فقط.
8. عند نتائج بحث غالية جداً أو معدومة، جرّب مطارات قريبة أو تواريخ مجاورة (نداءات search_flights/search_stays/search_cars إضافية) قبل إخبار المستخدم بعدم وجود خيارات — لا تستسلم من أول محاولة.
9. إن سأل المستخدم عن أرخص تاريخ ضمن مدى مرن استخدم find_flexible_dates بدل نداءات search_flights متكررة يدوياً. بعد أي حجز جديد أو عند سؤال المستخدم "هل خطتي متعارضة؟" استخدم check_trip_conflicts وأبلغه بأي تحذير فوراً. إن طلب مراقبة سعر رحلة لم تنخفض بعد استخدم watch_price واشرح أن الفحص دوري لا لحظي.
10. أسئلة الطقس والعملة تُجاب حصراً عبر get_destination_weather وconvert_currency (بيانات حقيقية) — لا تخمين درجات حرارة أو أسعار صرف من ذاكرتك أبداً. أسئلة الأمتعة تُجاب من بيانات العرض نفسه (search_flights) إن وُجدت.
11. أسئلة عامة عن الوجهة (تأشيرة، جمارك، عادات، أفضل وقت للزيارة، سلامة) يمكنك إجابتها من معرفتك العامة — بخلاف السعر/التوفر التي تبقى حصراً من الأدوات — لكن أضف دوماً جملة تنبيه واضحة: "معلومة استرشادية عامة، تحقق من السفارة أو الموقع الرسمي قبل السفر."
12. إن طلب المستخدم "رتّب لي رحلتي" أو ملخصاً شاملاً لخطته استخدم generate_trip_summary بدل تجميع الحجوزات يدوياً من list_my_bookings.`;

// صياغة قراءة النتائج: مهمة واحدة ضيّقة عمداً. كل رقم في المُدخَل محسوب
// في insights.js، فالتعليمة الأهم هنا هي المنع من الإضافة لا الحثّ عليها.
const INSIGHT_PROMPT = `أنت محرّر لغوي في بوابة سفر. تصلك قراءة مقارنة لنتائج بحث رحلات، مصوغة آلياً.
مهمتك إعادة صياغتها بعربية سلسة موجزة كأن وكيل سفر خبير يقولها للمسافر.
قواعد قاطعة:
1. لا تضف أي رقم أو حقيقة غير موجودة في النص المُعطى — لا سعراً ولا مدة ولا اسم شركة ولا توصية بمطار أو تاريخ.
2. لا تحذف أي رقم ورد في النص.
3. جملتان على الأكثر. بلا مقدمات ("بالتأكيد"، "إليك") وبلا سؤال ختامي.
4. حافظ على إشارات **العريض** كما هي.
5. أعد النص المُعاد صياغته فقط، بلا تعليق أو علامات اقتباس.`;

// تنبيه يصل بلا طلب ولا مراجعة — فالتعليمة تمنع التهوين والتهويل معاً،
// لا الاختلاق وحده. «طمئن المستخدم» ليست مهمة النموذج: الواقعة كما هي.
const NOTICE_PROMPT = `أنت محرّر لغوي في بوابة سفر. يصلك نص تنبيه مصوغ آلياً عن حدث جرى على حجز مسافر.
مهمتك إعادة صياغته بعربية واضحة هادئة، موجزة ومحترمة.
قواعد قاطعة:
1. لا تضف أي معلومة أو رقم أو تاريخ أو اسم غير موجود في النص، ولا تقترح حلاً لم يُذكر فيه.
2. لا تحذف أي رقم أو مرجع حجز أو تحذير ورد في النص.
3. لا تُهوّن من الحدث ولا تُهوّله — انقله كما هو بلا "لا تقلق" وبلا "خطر عاجل".
4. لا تَعِد بشيء نيابةً عن الخدمة (لا تعويض، لا استرداد، لا إعادة حجز تلقائي).
5. حافظ على الأسطر المنفصلة والنقاط كما هي، وأعد النص فقط بلا تعليق.`;

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
                    // ⚠️ عطب إنتاج حقيقي: type:'integer' وحدها كانت تجعل Groq
                    // يرفض النداء كاملاً (400 tool_use_failed: "expected
                    // integer, but got string") حين يولّد النموذج "1" بدل 1
                    // — رفضٌ يقع عند Groq **قبل** أن يصل الطلب حتى إلى
                    // الخادم. والخادم يتقبّل السلسلة أصلاً (Number(body.
                    // adults) في validateSearchParams) فلا حاجة لمنعها هنا؛
                    // القيد كان أضيق مما يتطلبه الخادم فعلياً.
                    adults: { type: ['integer', 'string'], description: 'عدد البالغين، رقماً صحيحاً (افتراضي 1)' },
                    // عمداً تواريخ لا عدد: العدد يترك العمر مجهولاً فيُخمَّن،
                    // والتخمين هو العطب نفسه الذي أصلحه passengerAges.js.
                    // النموذج لا يملك ما يخمّن به هنا — عليه أن يسأل.
                    childrenDobs: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'تواريخ ميلاد الأطفال YYYY-MM-DD (دون 18 سنة). اسأل المسافر عنها ولا تخمّنها — العمر يحدّد السعر والتذكرة.',
                    },
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
                    // ⚠️ عطب إنتاج حقيقي: type:'integer' وحدها كانت تجعل Groq
                    // يرفض النداء كاملاً (400 tool_use_failed: "expected
                    // integer, but got string") حين يولّد النموذج "1" بدل 1
                    // — رفضٌ يقع عند Groq **قبل** أن يصل الطلب حتى إلى
                    // الخادم. والخادم يتقبّل السلسلة أصلاً (Number(body.
                    // adults) في validateSearchParams) فلا حاجة لمنعها هنا؛
                    // القيد كان أضيق مما يتطلبه الخادم فعلياً.
                    adults: { type: ['integer', 'string'], description: 'عدد البالغين، رقماً صحيحاً (افتراضي 1)' },
                    // نفس عطب adults أعلاه بالضبط — راجع تعليقه
                    rooms: { type: ['integer', 'string'], description: 'عدد الغرف، رقماً صحيحاً (افتراضي 1)' },
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
            name: 'search_cars',
            description: 'يبحث عن سيارات إيجار متاحة قرب موقع استلام محدد بأسعار نهائية. يعيد قائمة عروض بمعرّفاتها.',
            parameters: {
                type: 'object',
                properties: {
                    iata: { type: 'string', description: 'رمز IATA لمطار أقرب مدينة لموقع الاستلام (مثل RUH أو DXB)' },
                    pickupAt: { type: 'string', description: 'تاريخ ووقت الاستلام بصيغة ISO (مثال 2027-01-15T10:00:00Z)' },
                    dropoffAt: { type: 'string', description: 'تاريخ ووقت التسليم بصيغة ISO' },
                },
                required: ['iata', 'pickupAt', 'dropoffAt'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_car_offer',
            description: 'يجلب تفاصيل عرض سيارة محدد بسعر محدَّث (العروض تنتهي صلاحيتها).',
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
            name: 'book_car',
            description: 'يحجز عرض سيارة فعلياً. لا تستخدمه إلا بعد موافقة المستخدم الصريحة على الملخص والسعر.',
            parameters: {
                type: 'object',
                properties: {
                    offerId: { type: 'string' },
                    drivers: {
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
                required: ['offerId', 'drivers', 'contact', 'confirmed'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'cancel_car',
            description: 'يلغي حجز سيارة قائم (issued) بعد تأكيد المستخدم. الاسترداد حسب سياسة المزوّد.',
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
                    // نفس عطب adults أعلاه — الخادم يحوّلها بـNumber() في doFindFlexibleDates
                    windowDays: { type: ['integer', 'string'], description: 'نصف عرض النافذة بالأيام، رقماً صحيحاً (1-7، افتراضي 3)' },
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
            case 'search_cars': {
                if (!services.searchCars) return { ok: false, data: { error: 'استئجار السيارات غير مفعَّل حالياً.' } };
                const offers = await services.searchCars(args);
                return { ok: true, summary: `🚗 ${args.iata} (${offers.length} سيارات)`, data: offers };
            }
            case 'get_car_offer': {
                if (!services.getCarOffer) return { ok: false, data: { error: 'استئجار السيارات غير مفعَّل حالياً.' } };
                const offer = await services.getCarOffer(args.offerId);
                if (!offer) return { ok: false, data: { error: 'عرض السيارة غير موجود أو انتهت صلاحيته — أعد البحث.' } };
                return { ok: true, summary: `💰 عرض سيارة بسعر ${offer.sellAmount} ${offer.currency}`, data: offer };
            }
            case 'book_car': {
                if (!services.bookCar) return { ok: false, data: { error: 'استئجار السيارات غير مفعَّل حالياً.' } };
                if (args.confirmed !== true) {
                    return { ok: false, data: { error: 'الحجز يتطلب موافقة المستخدم الصريحة أولاً — اعرض الملخص والسعر واسأله، ثم أعد النداء بـconfirmed=true.' } };
                }
                const booking = await services.bookCar(args);
                return {
                    ok: true,
                    summary: `✅ حُجزت سيارة — المرجع ${booking.bookingReference}`,
                    data: {
                        bookingId: booking.id, bookingReference: booking.bookingReference,
                        status: booking.status, total: `${booking.sellAmount} ${booking.currency}`,
                    },
                };
            }
            case 'cancel_car': {
                if (!services.cancelCar) return { ok: false, data: { error: 'استئجار السيارات غير مفعَّل حالياً.' } };
                if (args.confirmed !== true) {
                    return { ok: false, data: { error: 'الإلغاء يتطلب تأكيد المستخدم الصريح — اسأله أولاً ثم أعد النداء بـconfirmed=true.' } };
                }
                const result = await services.cancelCar(args.bookingId);
                return { ok: true, summary: `↩️ أُلغي حجز السيارة ${args.bookingId}`, data: result };
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

export function createTravelAgent({
    apiKey, apiUrl = DEFAULT_API_URL, model = DEFAULT_MODEL, fetchImpl = fetch,
    // مُحقَنة ليختبر الانتظارُ منطقَه بلا أن تنتظر الاختبارات فعلياً
    sleepImpl = ms => new Promise(r => setTimeout(r, ms)),
    // مزوّد احتياطي اختياري {apiKey, apiUrl, model, label} — بلا شيء يعمل
    // كما كان تماماً: سلسلة من مزوّد واحد.
    fallback = null,
}) {
    if (!apiKey) throw new Error('مفتاح مزوّد الايجنت مطلوب.');
    const primary = { apiKey, apiUrl, model, label: 'المزوّد الأساسي' };
    if (fallback && !fallback.apiKey) {
        throw new Error('المزوّد الاحتياطي بلا مفتاح — اضبطه أو أزله.');
    }
    // آخر مزوّد أجاب فعلاً — تُعرَض للمستخدم فيعرف لماذا تغيّر الأسلوب
    let lastProviderUsed = primary.label;

    async function complete(messages, { tools = true, temperature = 0.3 } = {}) {
        // صياغة القراءة تُنادى بلا أدوات إطلاقاً: لا شيء تحجزه أو تلغيه، فلا
        // سبب لوضع أدوات الكتابة في يدها. منعٌ بالبنية لا بالتعليمات.
        const body = tools
            ? { model, messages, tools: AGENT_TOOLS, tool_choice: 'auto', temperature }
            : { model, messages, temperature };
        // ⚠️ حدّ المعدّل ليس عطلاً بل انتظاراً: مزوّد الايجنت يردّ 429 مع
        // المدة المطلوبة صراحةً («try again in 1.39s»)، وكنّا نرمي فوراً
        // فيرى المسافر «تعذّر رد المساعد» على شيء يُحلّ بثانية ونصف.
        //
        // والترتيب مقصود: نصبر على الأساسي أولاً (الانتظار ثانية أرخص من
        // تبديل مزوّد وتبديل سلوك)، فإن نفدت حصّته فعلاً تحوّلنا للبديل
        // بدل أن نُفشل الطلب. مزوّد واحد معطّل لا يعني مساعداً معطّلاً.
        const chain = fallback ? [primary, fallback] : [primary];
        let lastError = null;

        for (const [index, provider] of chain.entries()) {
            const isLast = index === chain.length - 1;
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                const res = await fetchImpl(provider.apiUrl, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...body, model: provider.model }),
                });
                if (res.ok) {
                    const payload = await res.json();
                    const message = payload.choices?.[0]?.message;
                    if (!message) throw new Error('رد مزوّد الايجنت بلا رسالة.');
                    lastProviderUsed = provider.label;
                    return message;
                }
                const detail = await res.text().catch(() => '');
                // ⚠️ كان الخطأ لا يذكر أيّ مزوّد رفض — فحين يفشل الاحتياطي
                // بعد الأساسي (401 مثلاً بمفتاح فاسد) لا سبيل لمعرفة أيّهما
                // من نصّ الرسالة وحده إلا بتخمين صيغة الردّ. الاسم صريح الآن.
                lastError = new Error(`تعذّر الاتصال بمزوّد الايجنت (${provider.label}، HTTP ${res.status}). ${detail.slice(0, 300)}`);
                // 429 وأعطال الخادم عابرة؛ 4xx غيرها خطأ في طلبنا فإعادته عبث
                const retriable = res.status === 429 || res.status >= 500;
                if (!retriable) throw lastError;      // لا إعادة ولا تحويل
                if (attempt < MAX_RETRIES) {
                    await sleepImpl(retryDelayMs(res, detail, attempt));
                    continue;
                }
                if (isLast) throw lastError;          // نفد الصبر وما من بديل
                console.warn(`⚠️ ${provider.label} تعذّر (HTTP ${res.status}) — التحويل إلى ${chain[index + 1].label}.`);
            }
        }
        throw lastError;
    }

    return {
        name: 'travel-agent',
        model,

        /**
         * جولة حوار كاملة: تاريخ الرسائل → (نداءات أدوات حتى MAX_TOOL_ROUNDS)
         * → {reply, actions} حيث actions سجل ما نُفّذ فعلاً (تعرضه الواجهة
         * كرقائق شفافية: المستخدم يرى ماذا فعل الوكيل لا كلامه فقط).
         */
        async chat({ messages, services, memory = '', now = Date.now() }) {
            // ⚠️ العطب المُصلَح هنا: SYSTEM_PROMPT لا يذكر تاريخ اليوم أبداً،
            // فحين يطلب المسافر "غداً" لا مرجع لدى النموذج ليحسب منه —
            // شُوهد فعلياً يحاول تمرير الكلمة "tomorrow" حرفياً في وسيط
            // departDate، فيرفضها محلّل Groq الصارم للنداءات (400
            // tool_use_failed) قبل أن تصل حتى إلى تحقق الخادم.
            //
            // التاريخ رسالة نظام منفصلة كالذاكرة أدناه لا إلحاقٌ بـ
            // SYSTEM_PROMPT: يتغيّر مرة كل يوم فقط فيبقى مفيداً لتخزين
            // مزوّدات الطلبات المؤقت المؤقّت (prompt caching) عبر كل
            // المستخدمين خلال نفس اليوم — خلافاً للذاكرة الخاصة بمستخدم واحد.
            // بتوقيت UTC اتساقاً مع todayUtc() في server.js (نفس المرجع
            // الذي يتحقّق به الخادم لاحقاً — تاريخ ميلاد/سفر لا يتناقضان
            // بين ما يقترحه الايجنت وما يقبله الخادم).
            const today = new Date(now).toISOString().slice(0, 10);
            const dateLine = `تاريخ اليوم (بتوقيت UTC): ${today} — بصيغة YYYY-MM-DD. احسب أي تاريخ نسبي (غداً/بعد أسبوع/الشهر القادم/نهاية الأسبوع) من هذا التاريخ فعلياً، وأرسل الناتج دوماً بصيغة YYYY-MM-DD في وسائط الأدوات — لا تُرسل كلمات مثل "tomorrow" أو "غداً" حرفياً كقيمة تاريخ أبداً.`;
            // الذاكرة رسالة نظام منفصلة لا إلحاقٌ بالتعليمة الأساسية:
            // تبقى التعليمة ثابتة عبر المستخدمين (وهو ما يجعل الكاش مفيداً)،
            // ويبقى الجزء المتغيّر معزولاً ومقروءاً في السجل.
            const convo = [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'system', content: dateLine },
            ];
            if (memory) convo.push({ role: 'system', content: memory });
            convo.push(...messages);
            const actions = [];
            for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
                const msg = await complete(convo);
                if (!msg.tool_calls || msg.tool_calls.length === 0) {
                    return { reply: msg.content || '', actions, provider: lastProviderUsed };
                }
                // ⚠️ عطب إنتاج حقيقي: كنّا نُعيد بناء رسالة المساعد من
                // content/tool_calls فقط، فتضيع أي حقول أخرى أعادها
                // المزوّد. مع DeepSeek في "وضع التفكير" (thinking mode)
                // يُعيد الردّ reasoning_content إلى جانب tool_calls —
                // وDeepSeek يشترط إعادة هذا الحقل بعينه في الجولة
                // التالية، فيرفض الطلب (400) لأننا حذفناه سهواً. الآن
                // يُمرَّر إن وُجد؛ Groq لا يُعيده أصلاً فلا يتأثر.
                convo.push({
                    role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls,
                    ...(msg.reasoning_content != null ? { reasoning_content: msg.reasoning_content } : {}),
                });
                for (const call of msg.tool_calls) {
                    let args = {};
                    try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* أدناه يرفضها المنفّذ */ }
                    const result = await executeAgentTool(call.function?.name, args, services);
                    if (result.ok && result.summary) actions.push({ tool: call.function?.name, summary: result.summary });
                    convo.push({
                        role: 'tool',
                        tool_call_id: call.id,
                        content: compactToolResult(result.data),
                    });
                }
            }
            return { reply: 'تجاوزت الجولة حد الأدوات — جرّب طلباً أبسط أو أكمل خطوة خطوة.', actions, provider: lastProviderUsed };
        },

        /**
         * يصوغ قراءة نتائج البحث بأسلوب أفضل — **صياغة لا تحليل**.
         *
         * النموذج لا يرى العروض إطلاقاً، بل النص الحتمي المُولَّد من أرقام
         * محسوبة في insights.js. فأسوأ ما يفعله هو صياغة رديئة، لا رقم
         * مختلَق — وهذا هو سبب تمرير النص لا البيانات.
         *
         * بلا أدوات وبلا جولات: نداء واحد يعيد جملة أو جملتين. وأي فشل
         * (شبكة، مهلة، رد فارغ) يعيد النص الأصلي — القراءة لا تختفي لأن
         * النموذج تعثّر.
         */
        async phraseInsight(deterministicText) {
            return rephrase(deterministicText, INSIGHT_PROMPT);
        },

        /**
         * يصوغ نص تنبيه حدثٍ (تغيير طيران، انخفاض سعر) — نفس العقد تماماً:
         * الوقائع محسوبة في notifications.js، وهذه صياغة فوقها.
         *
         * ⚠️ الأخطر بين المسارين: التنبيه يصل المستخدمَ بلا أن يطلبه ولا
         * أن يراجعه أحد. لذا التعليمة تمنع الإضافة والتهوين والتهويل معاً،
         * والحدّ الأقصى للطول أضيق — تنبيهٌ مُطوَّل يُتجاهَل فيضيع الحدث.
         */
        async phraseNotice(deterministicText) {
            return rephrase(deterministicText, NOTICE_PROMPT, 1.6);
        },
    };

    /**
     * إعادة صياغة محروسة: بلا أدوات إطلاقاً، ورجوعٌ للنص الأصلي عند أي
     * فشل أو ردٍّ مُطوَّل. مشتركة بين القراءة والتنبيه فلا يفترق حارساهما.
     */
    async function rephrase(deterministicText, systemPrompt, maxGrowth = 2.5) {
        const source = String(deterministicText || '').trim();
        if (!source) return '';
        try {
            const msg = await complete([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: source },
            ], { tools: false, temperature: 0.4 });
            const out = String(msg.content || '').trim();
            // رد فارغ أو مُطوَّل بلا داعٍ → النص الحتمي أصدق وأقصر
            return out && out.length <= source.length * maxGrowth ? out : source;
        } catch {
            return source;
        }
    }
}

/** null بلا مفتاح — الخدمة تعمل كاملة بدون الايجنت (تدهور رشيق). */
export function buildTravelAgent(env = process.env) {
    if (!env.TRAVEL_AGENT_API_KEY) return null;
    return createTravelAgent({
        apiKey: env.TRAVEL_AGENT_API_KEY,
        apiUrl: env.TRAVEL_AGENT_API_URL || undefined,
        model: env.TRAVEL_AGENT_MODEL || undefined,
        fallback: buildFallbackProvider(env),
    });
}

// ✅ العنوان والنموذج مأخوذان من التكامل **القائم والمُتحقَّق منه** في
// backend/agents/baseAgent.js لا من تخمين: نفس `baseURL` (‎/v1‎) ونفس
// النموذج الافتراضي. وتعليق ذلك الملف يحذّر صراحةً أن `deepseek-chat`
// و`coder` **أُلغيا نهائياً** لصالح الجيل الرابع — وهو ما تؤكده لوحة
// الإدارة (فحص حيّ يُظهر deepseek-v4-pro يعمل).
const DEFAULT_FALLBACK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEFAULT_FALLBACK_MODEL = 'deepseek-v4-pro';

/**
 * null بلا مفتاح احتياطي — السلسلة تعود مزوّداً واحداً كما كانت.
 *
 * يقبل `DEEPSEEK_API_KEY` أيضاً: المفتاح نفسه مضبوط سلفاً لبقية المنصة،
 * فإلزام المالك بنسخه تحت اسم ثانٍ تكرارٌ يُنسى تحديثه عند التدوير.
 * والاسم الخاص `TRAVEL_AGENT_FALLBACK_*` يبقى مقدَّماً لمن أراد مزوّداً
 * مختلفاً لبوابة السفر وحدها.
 */
export function buildFallbackProvider(env = process.env) {
    const apiKey = env.TRAVEL_AGENT_FALLBACK_API_KEY || env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;
    return {
        apiKey,
        apiUrl: env.TRAVEL_AGENT_FALLBACK_API_URL || DEFAULT_FALLBACK_API_URL,
        model: env.TRAVEL_AGENT_FALLBACK_MODEL || env.DEEPSEEK_MODEL || DEFAULT_FALLBACK_MODEL,
        label: env.TRAVEL_AGENT_FALLBACK_LABEL || 'DeepSeek',
    };
}
