/**
 * ⭐ reviews.js — مراجعات موثقة بحجز فعلي (لا مراجعات مفتوحة)
 *
 * الفجوة الأولى أمام كبار مواقع السفر كانت غياب التقييمات — عمود الثقة
 * الذي تُبنى عليه قرارات الشراء هناك. نسدّها **بشرط أصدق من شرطهم**:
 * لا يراجع الباقة إلا من يحمل حجزاً مُصدَراً عليها **وانطلقت رحلته
 * فعلاً** (departDate ≤ اليوم). مراجعاتهم المفتوحة/شبه المفتوحة تعاني
 * تضخيماً وتزييفاً معروفين — كل مراجعة هنا خلفها مقعد بيع حقيقي.
 *
 * مراجعة واحدة لكل (مستخدم، باقة): الإرسال الثاني **تحديث** للأولى لا
 * صف جديد — فلا يُضخّم مسافر واحد تقييم باقة بالتكرار.
 *
 * الاسم المعروض يُقنَّع (أول مقطع + حرف): توثيق بلا كشف هوية كاملة.
 */

const httpError = (status, message) => Object.assign(new Error(message), { status });

const MAX_TITLE = 80;
const MAX_TEXT = 1000;

export function todayUtcStr() {
    return new Date().toISOString().slice(0, 10);
}

/** ينقّي مراجعة — {error} أو {value}. النص اختياري، التقييم إلزامي. */
export function normalizeReview(raw) {
    const rating = Number(raw?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return { error: 'التقييم عدد صحيح من 1 إلى 5 نجوم.' };
    }
    return {
        value: {
            rating,
            title: String(raw?.title || '').trim().slice(0, MAX_TITLE) || null,
            text: String(raw?.text || '').trim().slice(0, MAX_TEXT) || null,
        },
    };
}

/** «سالم الحربي» → «سالم ح.» — توثيق بلا كشف هوية كاملة. */
export function maskReviewerName(username) {
    const parts = String(username || '').trim().split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) return 'مسافر';
    const first = parts[0];
    const second = parts[1] ? ' ' + [...parts[1]][0] + '.' : '';
    return first + second;
}

/**
 * أهلية المراجعة: حجز باقة مجدولة مُصدَر (غير ملغى) على هذه الباقة
 * وانطلاقتها انقضت. يعيد الحجز المؤهِّل أو يرمي بسبب صريح.
 */
export async function assertReviewEligible({ store, username, packageId, today = todayUtcStr() }) {
    const mine = await store.listBookingsByUser(username, 200);
    const relevant = mine.filter(b =>
        b.kind === 'fixed_package' && b.offer?.fixedPackageId === packageId);
    if (relevant.length === 0) {
        throw httpError(403, 'المراجعات موثقة: لا يراجع الباقة إلا من حجزها فعلاً.');
    }
    const issued = relevant.find(b => b.status === 'issued');
    if (!issued) {
        throw httpError(403, 'حجزك على هذه الباقة غير مُصدَر (ملغى أو فاشل) — المراجعة لمن سافر فعلاً.');
    }
    const departDate = issued.offer?.departDate || null;
    if (!departDate || departDate > today) {
        throw httpError(400, 'المراجعة تُفتح بعد الانطلاق — شاركنا تجربتك حين تعود.');
    }
    return issued;
}

/** يحفظ/يحدّث مراجعة بعد التحقق من الأهلية. */
export async function submitReview({ store, username, packageId, review, today = todayUtcStr() }) {
    const pkg = await store.getFixedPackage(String(packageId || ''));
    if (!pkg) throw httpError(404, 'الباقة غير موجودة.');
    const check = normalizeReview(review);
    if (check.error) throw httpError(400, check.error);
    const booking = await assertReviewEligible({ store, username, packageId: pkg.id, today });
    return store.upsertReview({
        packageId: pkg.id,
        username,
        bookingId: booking.id, // أثر التوثيق: أي مراجعة تُقفى لحجز حقيقي
        ...check.value,
    });
}

/** الشكل العام للمراجعة — اسم مُقنَّع وبلا معرّف حجز. */
export function publicReview(r) {
    return {
        id: r.id,
        at: r.at,
        rating: r.rating,
        title: r.title,
        text: r.text,
        reviewer: maskReviewerName(r.username),
        verified: true, // بنيوياً: لا طريق لمراجعة غير موثقة أصلاً
    };
}

/** تجميع تقييم باقة من مراجعاتها — متوسط بمنزلة واحدة + العدد. */
export function aggregateRating(reviews) {
    if (!reviews || reviews.length === 0) return { ratingAvg: null, ratingCount: 0 };
    const sum = reviews.reduce((s, r) => s + (r.rating || 0), 0);
    return {
        ratingAvg: Math.round((sum / reviews.length) * 10) / 10,
        ratingCount: reviews.length,
    };
}
