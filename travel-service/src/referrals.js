/**
 * 🤝 referrals.js — برنامج الإحالة: كل حساب Jatrava له رابط دعوة، وأول
 * حجزٍ يُصدَر فعلياً لمن دعوته يمنح الطرفين نقاطاً إضافية في الولاء.
 *
 * ⚠️ **قرار نطاق متعمَّد**: يخصّ حسابات Jatrava الذاتية (بريد أو جوجل عبر
 * هذه الخدمة تحديداً) لا حسابات منصة JAOLA الأم الواصلة بتوكنٍ جاهز —
 * فلا لحظة "تسجيل" هنا لتلتقط رمز الإحالة أصلاً لهذه الأخيرة، ومسارا
 * `/auth/signup` و`/auth/google` (الفرع الجديد) هما نقطتا الالتقاط
 * الوحيدتان.
 *
 * مخزَّنٌ بمعزل تام عن travel_users (الأخير يقتصر على من يملك بريداً
 * وكلمة مرور/جوجل هنا) — travel_referrals مفهرسٌ بـ`username` كبقية
 * الخدمة (ملف شخصي، مفضلة)، فيعمل لأي هوية بصرف النظر عن مصدر توكنها،
 * ويبقى **المُحال** دوماً حساب Jatrava ذاتياً (وحده من يمرّ بلحظة تسجيل)
 * بينما **المُحيل** قد يكون أي مستخدم (حتى من منصة JAOLA الأم).
 */

// بلا 0/O و1/I/L الملتبسة بصرياً — رابطٌ يُقرأ بصوتٍ عالٍ أو يُكتب يدوياً
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LEN = 7;

export function generateReferralCode() {
    let out = '';
    for (let i = 0; i < REFERRAL_CODE_LEN; i++) {
        out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return out;
}

/** يطبّع رمز إحالة مُدخَلاً من المستخدم (رابطٌ نُسخ بأحرف صغيرة مثلاً). */
export function normalizeReferralCode(raw) {
    return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

export const DEFAULT_REFERRAL_BONUS_POINTS = 500;

export function readReferralBonusPoints(env = process.env) {
    const n = Number(env.TRAVEL_REFERRAL_BONUS_POINTS);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_REFERRAL_BONUS_POINTS;
}

/**
 * يُستدعى من bookings.js عند كل انتقالٍ إلى "issued" — عمداً **لا يرمي
 * أبداً**: فشل مكافأة إحالة لا يجوز أن يُسقط حجزاً حقيقياً دفع صاحبه ماله.
 *
 * "أول" حجزٍ يستحق المكافأة تحدّده الحارس الذرّي `grantReferralRewardIfDue`
 * نفسه (يمنح مرةً واحدة لكل مُحال) — لا عدّ حجوزاتٍ سابقة هنا، فتفادي
 * السباق يكمن في المخزن لا في هذا المستوى.
 */
export async function maybeRewardReferral(store, booking, { bonusPoints } = {}) {
    try {
        if (!booking || booking.status !== 'issued' || !booking.username) return;
        if (!store.grantReferralRewardIfDue || !store.addBonusPoints) return; // مخزنٌ لا يدعم الإحالة
        const points = bonusPoints ?? readReferralBonusPoints();
        const result = await store.grantReferralRewardIfDue(booking.username, points);
        if (!result?.granted || !result.referredBy) return;
        await store.addBonusPoints(result.referredBy, points);
    } catch {
        // أفضل جهد فقط — انظر التعليق أعلاه
    }
}
