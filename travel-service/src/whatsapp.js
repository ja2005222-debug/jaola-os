/**
 * 💬 whatsapp.js — قناة تنبيه ثالثة عبر WhatsApp Cloud API (Meta مباشرةً)
 *
 * نفس عقد mailer.js حرفياً (`ready()` + دالة إرسال تُعيد {ok}/{error}) —
 * فالمُسلِّم في notifications.js لا يعرف قناةً عن أخرى، ويبقى الاختبار بلا
 * شبكة بحقن fetch.
 *
 * ⚠️⚠️ القيد الذي يحكم التصميم كله — ولا يظهر إلا عند أول إرسال حقيقي:
 *
 *   **رسالة يبدأها العمل (business-initiated) لا يمكن أن تكون نصاً حراً.**
 *   واتساب لا يسمح بالنص الحر إلا داخل نافذة خدمة عمرها ٢٤ ساعة تبدأ من
 *   **رسالة العميل إلينا**. وكل تنبيهاتنا نبدأها نحن (حجز صدر، سعر
 *   انخفض، سفر غداً) والمسافر لم يراسلنا — فكلها **بلا استثناء** يجب أن
 *   تُرسَل بقالب معتمَد مسبقاً من Meta.
 *
 * ويترتب على ذلك أمران لا مفرّ منهما:
 *
 *   ١) **لا تُرسَل الصياغة المُحسَّنة بالنموذج اللغوي عبر واتساب.** القالب
 *      نصّه ثابت معتمَد ومتغيّراته مرقّمة؛ نصٌّ يعيد النموذج صوغه كل مرة
 *      يخالف القالب فيُرفض. البريد والسجل يأخذان الصياغة المحسّنة،
 *      وواتساب يأخذ المتغيّرات الحتمية — وهو ما تفرضه notifications.js.
 *
 *   ٢) **لا نخترع متغيّرات.** إن لم يعطِ منادي `deliver` مصفوفة
 *      `whatsappParams` صراحةً، تُتخطّى القناة بصمت مسجَّل بدل إرسال
 *      قالب بمتغيّرات ناقصة (خطأ 132000 من Meta، ورسالة نصفها فارغ عند
 *      المسافر).
 *
 * وأسماء القوالب كلها قابلة للتجاوز بمتغيّرات بيئة: Meta قد تعتمد اسماً
 * غير الذي نقترحه، فلا يُقفَل الاسم في الكود.
 */

const DEFAULT_API_VERSION = 'v21.0';
const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;
const MAX_PARAM_CHARS = 900; // سقف Meta للمتغيّر 1024 — نترك هامشاً

/** القناة جاهزة فقط بالمفتاحين معاً — أحدهما وحده لا يرسل شيئاً. */
export function whatsappReady(env = process.env) {
    return !!(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export function isWhatsAppPhone(v) {
    return PHONE_RE.test(normalizeWhatsAppPhone(v));
}

/**
 * يطبّع الهاتف كما في نموذج الحجز: يزيل الفواصل الشكلية ويحوّل `00`
 * الدولية إلى `+`. فلا يُرفض رقم صحيح لاختلاف صيغة كتابته وحدها.
 */
export function normalizeWhatsAppPhone(raw) {
    const cleaned = String(raw || '').replace(/[\s()\-.]/g, '');
    return cleaned.startsWith('00') ? '+' + cleaned.slice(2) : cleaned;
}

/**
 * ينقّي متغيّر قالب.
 *
 * Meta ترفض المتغيّر الذي يحوي سطراً جديداً أو جدولة أو أكثر من أربع
 * مسافات متتالية — قاعدة يسهل السهو عنها لأن نصوصنا الداخلية متعدّدة
 * الأسطر أصلاً (`renderAirlineChangeNotice` مثلاً). فالتسطيح هنا لا
 * تجميل بل شرط قبول.
 */
export function sanitizeTemplateParam(value) {
    return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_PARAM_CHARS);
}

/**
 * يرسل قالباً معتمَداً. يعيد {ok,id} أو {error, notConfigured?} — ولا يرمي
 * أبداً، كحال mailer.js: تنبيهٌ فشل تسليمه لا يُسقط العملية التي ولّدته.
 */
export async function sendWhatsAppTemplate({ to, template, params = [], lang } = {}, deps = {}) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    if (!whatsappReady(env)) {
        return {
            error: 'واتساب غير مُفعّل — اضبط WHATSAPP_TOKEN وWHATSAPP_PHONE_NUMBER_ID.',
            notConfigured: true,
        };
    }
    const phone = normalizeWhatsAppPhone(to);
    if (!PHONE_RE.test(phone)) return { error: 'رقم واتساب غير صالح (صيغة دولية مطلوبة).' };
    if (!template) return { error: 'اسم القالب مطلوب — واتساب لا يقبل نصاً حراً في رسالة نبدأها نحن.' };

    const apiVersion = env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
    const base = env.WHATSAPP_API_URL || `https://graph.facebook.com/${apiVersion}`;
    const clean = params.map(sanitizeTemplateParam);
    const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
            name: String(template),
            language: { code: lang || env.WHATSAPP_TEMPLATE_LANG || 'ar' },
            // مكوّن الجسم فقط: القوالب ذات الرأس/الأزرار تحتاج مكوّنات
            // أخرى، ولا نرسلها ما لم نعتمدها — إرسال مكوّن لا يطابق القالب
            // المعتمَد يُرفض كله.
            ...(clean.length > 0
                ? { components: [{ type: 'body', parameters: clean.map(text => ({ type: 'text', text })) }] }
                : {}),
        },
    };
    try {
        const r = await fetchImpl(`${base}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        // نقرأ نصاً خاماً أولاً: ردود رفض Meta قد تكون HTML من طبقة أمامية
        // لا JSON، ولو اعتمدنا json() لضاع سبب الرفض كلياً (نفس علاج
        // duffelClient.js).
        const rawText = await r.text();
        let data = {};
        try { data = rawText ? JSON.parse(rawText) : {}; } catch { /* رد ليس JSON */ }
        if (!r.ok) {
            const detail = data?.error?.message || rawText.slice(0, 300) || 'خطأ غير مفصَّل';
            return { error: `فشل إرسال واتساب (${r.status}): ${detail}` };
        }
        return { ok: true, id: data?.messages?.[0]?.id || null };
    } catch (e) {
        return { error: 'تعذّر الوصول لخدمة واتساب: ' + e.message };
    }
}
