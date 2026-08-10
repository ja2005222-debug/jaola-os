/**
 * 🔔 notifications.js — نقطة التسليم الوحيدة لكل تنبيه في البوابة
 *
 * قبل هذا الملف كان كل مصدر تنبيه يرسل بريده بنفسه (تأكيد الحجز، إلغاؤه،
 * تغيير شركة الطيران، انخفاض السعر) — أربعة قوالب متفرقة بلا سجل يراه
 * المستخدم ولا خيار يوقفها. الآن يمرّ الجميع من `deliver` واحدة:
 * تفحص تفضيلات المستخدم، تكتب سجلاً داخل البوابة، وترسل بريداً إن رغب.
 *
 * 🛡️ خط أحمر واحد: التنبيه **يخبر ولا ينفّذ**. لا شيء هنا يحجز أو يلغي
 * أو يدفع — مسار الأحداث لا إنسان فيه يوافق، فلا توضع فيه يدٌ تصرف مالاً.
 */

/**
 * فئات التنبيهات. `alwaysInApp` ليست تعطيلاً لخيار المستخدم بل حفظٌ
 * للسجل: هذه وقائع جرت على ماله وسفره فعلاً (حجز صدر، شركة غيّرت
 * موعداً). إسقاطها صامتةً يترك المسافر بلا أثرٍ لما حدث — فيبقى السجل
 * داخل البوابة دوماً، ويبقى البريد اختياره وحده.
 */
export const NOTIFICATION_CATEGORIES = {
    booking_issued: { label: 'تأكيد الحجز', alwaysInApp: true, defaultEmail: true },
    booking_cancelled: { label: 'إلغاء الحجز', alwaysInApp: true, defaultEmail: true },
    airline_change: { label: 'تغيير من شركة الطيران', alwaysInApp: true, defaultEmail: true },
    price_drop: { label: 'انخفاض سعر مُراقَب', alwaysInApp: false, defaultEmail: true },
    trip_reminder: { label: 'تذكير قبل السفر', alwaysInApp: false, defaultEmail: false },
};

export const NOTIFICATION_CHANNELS = ['inApp', 'email'];
const CATEGORY_KEYS = Object.keys(NOTIFICATION_CATEGORIES);
const MAX_TITLE = 120;
const MAX_BODY = 2000;

/** التفضيلات الافتراضية لمستخدم لم يضبط شيئاً بعد. */
export function defaultNotificationPrefs() {
    const prefs = {};
    for (const [key, meta] of Object.entries(NOTIFICATION_CATEGORIES)) {
        prefs[key] = { inApp: true, email: meta.defaultEmail };
    }
    return prefs;
}

/**
 * ينقّي تفضيلات واردة من العميل: فئات معروفة وقنوات معروفة وقيم منطقية
 * فقط. الفئة الغائبة تأخذ افتراضها بدل أن تختفي — فإرسال جزئي من واجهة
 * قديمة لا يُطفئ تنبيهات لم يقصد المستخدم إطفاءها.
 */
export function normalizeNotificationPrefs(raw) {
    const prefs = defaultNotificationPrefs();
    if (!raw || typeof raw !== 'object') return prefs;
    for (const key of CATEGORY_KEYS) {
        const incoming = raw[key];
        if (!incoming || typeof incoming !== 'object') continue;
        for (const channel of NOTIFICATION_CHANNELS) {
            if (typeof incoming[channel] === 'boolean') prefs[key][channel] = incoming[channel];
        }
        // فئةٌ سجلُّها محفوظ دوماً — اختيار المستخدم يطال بريدها لا سجلها
        if (NOTIFICATION_CATEGORIES[key].alwaysInApp) prefs[key].inApp = true;
    }
    return prefs;
}

export function isChannelEnabled(prefs, category, channel) {
    const meta = NOTIFICATION_CATEGORIES[category];
    if (!meta) return false;
    if (channel === 'inApp' && meta.alwaysInApp) return true;
    const clean = normalizeNotificationPrefs(prefs);
    return !!clean[category]?.[channel];
}

/**
 * يبني المُسلِّم. `mailer` مُحقَن ليبقى الاختبار بلا شبكة، و`phrase`
 * اختيارية: دالة تُحسّن صياغة النص إن وُجد ايجنت — وغيابها لا يُسقط
 * التنبيه، تماماً كقراءة نتائج البحث (الحقائق من الكود لا من النموذج).
 */
export function createNotifier({ store, mailer, phrase = null }) {
    return {
        /**
         * يسلّم تنبيهاً واحداً. لا يرمي أبداً: فشل التسليم يجب ألا يُسقط
         * العملية التي ولّدته (حجزٌ نجح فعلاً لا يُبلَّغ عنه بخطأ لأن
         * البريد تعطّل).
         *
         * يعيد {inApp, email, skipped} لتسجيل ما جرى فعلاً لا ما نُوي.
         */
        async deliver({ username, category, title, body, email = null, meta = {} }) {
            const result = { inApp: false, email: false, skipped: false };
            if (!NOTIFICATION_CATEGORIES[category] || !username) {
                result.skipped = true;
                return result;
            }
            let prefs;
            try {
                prefs = await store.getNotificationPrefs(username);
            } catch {
                prefs = null; // تعذّر قراءة التفضيلات → الافتراضات، لا صمت
            }
            const wantInApp = isChannelEnabled(prefs, category, 'inApp');
            const wantEmail = isChannelEnabled(prefs, category, 'email');
            if (!wantInApp && !wantEmail) {
                result.skipped = true;
                return result;
            }

            // الصياغة تُحسَّن مرة واحدة ويُستخدم ناتجها في القناتين معاً،
            // فلا يصل المستخدمَ نصّان مختلفان عن حدث واحد.
            let finalBody = String(body || '').slice(0, MAX_BODY);
            if (phrase) {
                try { finalBody = (await phrase(finalBody)) || finalBody; } catch { /* الأصل يكفي */ }
            }
            const finalTitle = String(title || '').slice(0, MAX_TITLE);

            if (wantInApp) {
                try {
                    await store.createNotification({ username, category, title: finalTitle, body: finalBody, meta });
                    result.inApp = true;
                } catch (e) {
                    console.error('⚠️ تعذّر حفظ تنبيه داخل البوابة:', e.message);
                }
            }
            if (wantEmail && email && mailer?.mailReady?.()) {
                try {
                    const sent = await mailer.sendMail({ to: email, subject: finalTitle, text: finalBody });
                    result.email = !!sent?.ok;
                } catch (e) {
                    console.error('⚠️ تعذّر إرسال بريد تنبيه:', e.message);
                }
            }
            return result;
        },
    };
}

// ─── صياغة حتمية لنصوص الأحداث (نفس مبدأ insights.js) ───
// كل رقم أدناه يأتي من الحجز المخزَّن أو من فحصٍ محسوب — لا شيء من نموذج.

/** نص تغيير تجريه شركة الطيران بعد الحجز، مع أثره على بقية الخطة. */
export function renderAirlineChangeNotice({ summaryLine, bookingReference, warnings = [] }) {
    const lines = [
        'أجرت شركة الطيران تغييراً على رحلتك بعد الحجز (موعد أو مسار).',
        '',
        summaryLine,
        `المرجع: ${bookingReference || '—'}`,
    ];
    if (warnings.length > 0) {
        lines.push('', '⚠️ وأثر هذا على بقية خطتك:');
        for (const w of warnings) lines.push(`• ${w.message || w}`);
    }
    lines.push('', 'راجع تفاصيل حجزك من بوابة السفر أو تواصل مع شركة الطيران بالمرجع أعلاه.');
    return lines.join('\n');
}

/** نص بلوغ سعر مُراقَب هدفَه. */
export function renderPriceDropNotice({ origin, destination, departDate, price, currency, targetPrice }) {
    const lines = [
        `انخفض سعر ${origin} → ${destination} بتاريخ ${departDate} إلى ${price} ${currency}.`,
    ];
    if (Number.isFinite(targetPrice)) lines.push(`(هدفك كان ${targetPrice} ${currency}.)`);
    lines.push('', 'الأسعار تتغيّر باستمرار — احجز من بوابة السفر إن ناسبك.');
    return lines.join('\n');
}
