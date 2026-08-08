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
const MAX_TOOL_ROUNDS = 6;
const MAX_TOOL_RESULT_CHARS = 6000;

const SYSTEM_PROMPT = `أنت "مساعد جاولا للسفر" — وكيل حجز طيران محترف يتحدث العربية (أو لغة المستخدم).
قدراتك عبر الأدوات: البحث عن رحلات، فحص عرض محدد، حجز فعلي، عرض حجوزات المستخدم، وإلغاء حجز.
قواعد صارمة:
1. الأسعار التي تعيدها الأدوات نهائية وشاملة — لا تخترع أسعاراً أو رحلات من ذاكرتك أبداً؛ كل معلومة رحلة تأتي من أداة.
2. قبل أي حجز: اعرض ملخص الرحلة والسعر الإجمالي واسأل المستخدم صراحةً "هل أؤكد الحجز؟" — لا تضبط confirmed=true إلا بعد موافقة صريحة في رسالة المستخدم الأخيرة.
3. للحجز تحتاج لكل مسافر: اللقب (mr/ms/mrs)، الاسم الأول واسم العائلة بالحروف اللاتينية كما في الجواز، تاريخ الميلاد (YYYY-MM-DD)، والجنس (m/f) — ولا تنس بريد التواصل والهاتف. اجمعها بالحوار إن نقصت.
4. قبل الإلغاء: أكد مع المستخدم واذكر أن مبلغ الاسترداد يحدده المزوّد.
5. كن موجزاً وعملياً — رقّم الخيارات ليسهل الاختيار، واذكر التوقيتات والمدة وعدد التوقفات.
6. رموز المطارات IATA من ثلاثة أحرف (RUH, JED, CAI, DXB...) — استنتجها من أسماء المدن، واسأل عند اللبس.`;

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
            description: 'يلغي حجزاً قائماً (issued) بعد تأكيد المستخدم. الاسترداد حسب سياسة المزوّد.',
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
