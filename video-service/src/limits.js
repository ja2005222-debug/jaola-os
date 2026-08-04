/**
 * 🛡️ limits.js — درع التكلفة (يمنع فاتورة مفاجئة قبل أن تقع)
 *
 * الأرصدة مسبقة الدفع درعٌ بنيوي، لكن فيه ثقب حقيقي: **الرصيد الترحيبي
 * المجاني**. مع مزوّد حقيقي، كل حساب جديد = توليدات مدفوعة عليك، فتعرّضك
 * = (عدد المسجَّلين) × الرصيد الترحيبي، بلا سقف. لذا هنا ثلاث طبقات:
 *
 * 1. سقف يومي عام لكل الخدمة  — الحد الأقصى المطلق لفاتورة يومك.
 * 2. سقف يومي لكل مستخدم       — يمنع مستخدماً واحداً من ابتلاع السقف العام.
 * 3. تنبيه عند بلوغ نسبة من السقف العام — إنذار مبكر مرة واحدة يومياً.
 *
 * الرصيد الترحيبي نفسه صار قابلاً للضبط (STARTER_CREDITS) ويمكن تصفيره
 * تماماً (=0) فلا يُمنح شيء مجاناً إطلاقاً.
 */

export const DEFAULTS = Object.freeze({
    dailyRenderCap: 200,        // إجمالي التوليدات المسموحة يومياً لكل الخدمة
    dailyRenderCapPerUser: 20,  // حد المستخدم الواحد يومياً
    alertAtPct: 80,             // ٪ من السقف العام يُرسَل عندها التنبيه
    starterCredits: 3,          // رصيد ترحيبي مجاني — 0 يعطّله كلياً
});

function intFromEnv(raw, fallback, { min = 0, max = 1_000_000 } = {}) {
    if (raw == null || raw === '') return fallback;
    const v = Number(raw);
    if (!Number.isInteger(v) || v < min || v > max) return fallback;
    return v;
}

/** يقرأ إعداد الحدود من البيئة مع افتراضات آمنة (قيمة خاطئة → الافتراضي). */
export function readLimits(env = process.env) {
    return {
        dailyRenderCap: intFromEnv(env.DAILY_RENDER_CAP, DEFAULTS.dailyRenderCap),
        dailyRenderCapPerUser: intFromEnv(env.DAILY_RENDER_CAP_PER_USER, DEFAULTS.dailyRenderCapPerUser),
        alertAtPct: intFromEnv(env.COST_ALERT_AT_PCT, DEFAULTS.alertAtPct, { min: 1, max: 100 }),
        starterCredits: intFromEnv(env.STARTER_CREDITS, DEFAULTS.starterCredits, { max: 1000 }),
        alertWebhookUrl: String(env.COST_ALERT_WEBHOOK_URL || '').trim(),
    };
}

/** بداية اليوم الحالي بتوقيت UTC — نافذة العدّ الموحدة. */
export function startOfUtcDay(now = Date.now()) {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function utcDayKey(now = Date.now()) {
    return new Date(startOfUtcDay(now)).toISOString().slice(0, 10);
}

/**
 * يقرر السماح بتوليد جديد. يُرجع {allowed:true} أو
 * {allowed:false, code, error} — والرسائل عربية جاهزة للعرض.
 * السقف = 0 يعني "موقوف تماماً" (مفيد لإيقاف الطوارئ بمتغير بيئة واحد).
 */
export async function checkRenderAllowed(store, { username, limits, exemptPerUser = false, now = Date.now() }) {
    const since = startOfUtcDay(now);

    const globalCount = await store.countJobsSince(since);
    if (globalCount >= limits.dailyRenderCap) {
        return {
            allowed: false, code: 'daily_cap_reached',
            error: 'بلغت الخدمة سقف التوليد اليومي — حاول غداً أو تواصل مع الدعم.',
        };
    }

    // المشرف معفى من سقف الفرد (يختبر منصته بلا قيد مصطنع)، لكن السقف
    // العام أعلاه يسري على الجميع بلا استثناء — هو حد الفاتورة المطلق.
    if (!exemptPerUser) {
        const userCount = await store.countJobsSinceForUser(username, since);
        if (userCount >= limits.dailyRenderCapPerUser) {
            return {
                allowed: false, code: 'user_daily_cap_reached',
                error: `بلغت حدك اليومي (${limits.dailyRenderCapPerUser} فيديو) — يتجدد غداً.`,
            };
        }
    }

    return { allowed: true, globalCount: globalCount + 1 };
}

/**
 * ينبّه مرة واحدة فقط في اليوم عند بلوغ نسبة السقف. يُرجع true إن أُرسل
 * تنبيه فعلاً (الاختبارات تتحقق من عدم التكرار).
 *
 * التنبيه: تسجيل صاخب دوماً + POST اختياري إلى COST_ALERT_WEBHOOK_URL —
 * بلا اعتماد على بريد أو خدمة خارجية إلزامية.
 */
export async function maybeAlertCost(store, { limits, count, now = Date.now(), fetchImpl = fetch }) {
    const threshold = Math.ceil(limits.dailyRenderCap * limits.alertAtPct / 100);
    if (count < threshold) return false;

    const key = `cost_alert_${utcDayKey(now)}`;
    if (await store.getFlag(key)) return false; // نُبِّه اليوم بالفعل
    await store.setFlag(key, '1');

    const message = `⚠️ خدمة الفيديو: بلغ الاستهلاك اليومي ${count} من أصل ${limits.dailyRenderCap} (${limits.alertAtPct}%+).`;
    console.warn(message);

    if (limits.alertWebhookUrl) {
        try {
            await fetchImpl(limits.alertWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: message, count, cap: limits.dailyRenderCap, day: utcDayKey(now) }),
            });
        } catch (e) {
            // فشل التنبيه لا يُفشل التوليد — السجل الصاخب أعلاه يبقى شاهداً.
            console.warn('⚠️ تعذّر إرسال تنبيه التكلفة:', e.message);
        }
    }
    return true;
}
