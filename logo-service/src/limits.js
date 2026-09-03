/**
 * 🛡️ limits.js — درع التكلفة لخدمة مجانية بلا أرصدة
 *
 * الفرق الجوهري عن خدمة الفيديو: هناك أرصدة مسبقة الدفع تحمي الفاتورة
 * بنيوياً؛ هنا كل شيء مجاني **علينا نحن**، والصفحة العامة مفتوحة لزوار
 * مجهولين — فالسقوف هي الدرع الوحيد. أربع طبقات:
 *
 * 1. سقف يومي عام للمسودات (كل الخدمة)  — حد الفاتورة اليومي المطلق.
 * 2. سقف يومي للـIP المجهول             — الزائر بلا حساب يجرّب لا يستنزف.
 * 3. سقف يومي لصاحب الحساب              — أرحب من الزائر (حافز التسجيل).
 * 4. سقف شهري للنسخ النهائية لكل حساب  — النموذج الأجود أغلى، فيُقنَّن.
 *
 * الـIP لا يُخزَّن أبداً خاماً — تعمية SHA-256 بملح ثابت للخدمة، فالعدّ
 * ممكن والتتبع العكسي لا.
 */
import crypto from 'crypto';

export const DEFAULTS = Object.freeze({
    dailyDraftCap: 300,        // إجمالي جولات المسودات يومياً لكل الخدمة
    dailyDraftCapPerIp: 2,     // جولات الزائر المجهول (لكل IP) يومياً
    dailyDraftCapPerUser: 10,  // جولات صاحب الحساب يومياً
    monthlyFinalCapPerUser: 5, // النسخ النهائية شهرياً لكل حساب
    draftVariants: 4,          // صور لكل جولة مسودات
    alertAtPct: 80,            // ٪ من السقف العام يُرسَل عندها تنبيه التكلفة
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
        dailyDraftCap: intFromEnv(env.LOGO_DAILY_DRAFT_CAP, DEFAULTS.dailyDraftCap),
        dailyDraftCapPerIp: intFromEnv(env.LOGO_DAILY_DRAFT_CAP_PER_IP, DEFAULTS.dailyDraftCapPerIp),
        dailyDraftCapPerUser: intFromEnv(env.LOGO_DAILY_DRAFT_CAP_PER_USER, DEFAULTS.dailyDraftCapPerUser),
        monthlyFinalCapPerUser: intFromEnv(env.LOGO_MONTHLY_FINAL_CAP_PER_USER, DEFAULTS.monthlyFinalCapPerUser),
        draftVariants: intFromEnv(env.LOGO_DRAFT_VARIANTS, DEFAULTS.draftVariants, { min: 1, max: 8 }),
        alertAtPct: intFromEnv(env.COST_ALERT_AT_PCT, DEFAULTS.alertAtPct, { min: 1, max: 100 }),
        alertWebhookUrl: String(env.COST_ALERT_WEBHOOK_URL || '').trim(),
    };
}

/** تعمية IP — عدٌّ بلا تخزين عنوان خام. الملح من البيئة أو ثابت للخدمة. */
export function hashIp(ip, salt = process.env.IP_HASH_SALT || 'jalogo') {
    return crypto.createHash('sha256').update(`${salt}:${ip || 'unknown'}`).digest('hex').slice(0, 32);
}

/** بداية اليوم الحالي بتوقيت UTC — نافذة العدّ اليومية. */
export function startOfUtcDay(now = Date.now()) {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** بداية الشهر الحالي بتوقيت UTC — نافذة عدّ النسخ النهائية. */
export function startOfUtcMonth(now = Date.now()) {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function utcDayKey(now = Date.now()) {
    return new Date(startOfUtcDay(now)).toISOString().slice(0, 10);
}

/**
 * يقرر السماح بجولة مسودات. زائر مجهول → حد الـIP؛ صاحب حساب → حده
 * الأرحب (الـIP لا يقيّده — شبكة مكتب واحدة لا تعاقب حسابات متعددة).
 * يُرجع {allowed:true} أو {allowed:false, code, error} برسائل عربية.
 * السقف = 0 يعني "موقوف تماماً" (إيقاف طوارئ بمتغير بيئة واحد).
 */
export async function checkDraftAllowed(store, { ipHash, username = null, limits, now = Date.now() }) {
    const since = startOfUtcDay(now);

    const globalCount = await store.countDraftRoundsSince(since);
    if (globalCount >= limits.dailyDraftCap) {
        return {
            allowed: false, code: 'daily_cap_reached',
            error: 'بلغت الخدمة سقفها اليومي — عُد غداً، شعارك ينتظرك.',
        };
    }

    if (username) {
        const userCount = await store.countDraftRoundsSinceForUser(username, since);
        if (userCount >= limits.dailyDraftCapPerUser) {
            return {
                allowed: false, code: 'user_daily_cap_reached',
                error: `بلغت حدك اليومي (${limits.dailyDraftCapPerUser} جولات) — يتجدد غداً.`,
            };
        }
    } else {
        const ipCount = await store.countDraftRoundsSinceForIp(ipHash, since);
        if (ipCount >= limits.dailyDraftCapPerIp) {
            return {
                allowed: false, code: 'guest_cap_reached',
                error: 'استنفدت محاولات الزائر اليوم — أنشئ حساباً مجانياً لمحاولات أكثر وتنزيل شعارك.',
            };
        }
    }

    return { allowed: true, globalCount: globalCount + 1 };
}

/** يقرر السماح بنسخة نهائية (تتطلب حساباً أصلاً — الحد شهري لكل حساب). */
export async function checkFinalAllowed(store, { username, limits, now = Date.now() }) {
    const since = startOfUtcMonth(now);
    const count = await store.countFinalsSinceForUser(username, since);
    if (count >= limits.monthlyFinalCapPerUser) {
        return {
            allowed: false, code: 'monthly_final_cap_reached',
            error: `بلغت حد الشهر (${limits.monthlyFinalCapPerUser} شعارات نهائية) — يتجدد مطلع الشهر.`,
        };
    }
    return { allowed: true };
}

/**
 * ينبّه مرة واحدة يومياً عند بلوغ نسبة السقف العام — نفس آلية خدمة
 * الفيديو حرفياً: تسجيل صاخب دوماً + POST اختياري للويبهوك.
 */
export async function maybeAlertCost(store, { limits, count, now = Date.now(), fetchImpl = fetch }) {
    const threshold = Math.ceil(limits.dailyDraftCap * limits.alertAtPct / 100);
    if (count < threshold) return false;

    const key = `cost_alert_${utcDayKey(now)}`;
    if (await store.getFlag(key)) return false;
    await store.setFlag(key, '1');

    const message = `⚠️ jalogo: بلغ استهلاك المسودات اليومي ${count} من أصل ${limits.dailyDraftCap} (${limits.alertAtPct}%+).`;
    console.warn(message);

    if (limits.alertWebhookUrl) {
        try {
            await fetchImpl(limits.alertWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: message, count, cap: limits.dailyDraftCap, day: utcDayKey(now) }),
            });
        } catch (e) {
            console.warn('⚠️ تعذّر إرسال تنبيه التكلفة:', e.message);
        }
    }
    return true;
}
