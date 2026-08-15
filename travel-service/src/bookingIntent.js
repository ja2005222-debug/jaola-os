/**
 * 🔐 bookingIntent.js — نية الحجز الموقّعة: الحارس الذي يُخرج الحجز من يد النموذج
 *
 * ⚠️ العطب الذي وُلد منه هذا الملف — واقعة إنتاج حقيقية:
 *
 *   المستخدم: «هل يوجد فندق قرب المطار؟»   ← سؤال عن التوفّر
 *   النظام:   «✅ حُجز فندق — المرجع k5f34ZWLB»   ← حجز فعلي!
 *
 * الحارس القديم كان راية `confirmed: true` **يضبطها النموذج على نفسه**،
 * والخادم لا يعرف بالتأكيد شيئاً أصلاً (`grep confirmed server.js` =
 * صفر). أي أن «الحارس على مستويين» الموصوف في رأس agent.js كان في
 * الحقيقة مستوىً واحداً تعليمياً: النموذج يقرر، والنموذج ينفّذ. وحارسٌ
 * يحرس نفسه ليس حارساً — وهذا بالضبط نمط «الحارس التعليماتي» الذي
 * يرفضه هذا الكود في كل موضع آخر.
 *
 * 🛡️ البنية الجديدة: الايجنت **لا يحجز**. يُصدر «نية حجز» موقّعة
 * بـHMAC-SHA256 بمفتاح الخادم، تعرضها الواجهة كبطاقة فيها العرض
 * والسعر وزر تأكيد. الحجز الفعلي لا يقع إلا على مسار يتحقق من التوقيع.
 *
 * ولماذا هذا **بنيويّ لا تعليماتيّ**: النموذج لا يملك المفتاح، فلا
 * يستطيع تزوير نية صالحة مهما أُقنع أو انحرف أو هُوجم بحقن تعليمات.
 * أسوأ ما يفعله هو عرض بطاقة تأكيد لم تطلبها — فترفضها.
 *
 * والنية تحمل السعر الذي عُرض عليك: يتحقق منه المسار قبل الحجز، فلو
 * تغيّر سعر المزوّد بين العرض والتأكيد رُفض الحجز بدل أن يُخصَم مبلغ
 * لم توافق عليه (العيب الثاني في نفس البلاغ: وافق المستخدم على 207.73
 * فحُجز بـ206.51 لأن الايجنت أعاد البحث فتغيّر ترتيب «رقم ٢»).
 */

import crypto from 'crypto';

/** صلاحية النية — قصيرة عمداً: بطاقة تأكيد منسيّة لا تبقى قابلة للضغط. */
export const INTENT_TTL_MS = 15 * 60 * 1000; // ١٥ دقيقة

export const INTENT_KINDS = ['flight', 'stay', 'car'];

/**
 * ترميز base64url بلا حشو — النية تسافر في JSON ثم قد تمرّ في عنوان،
 * فالحشو (`=`) و`+`/`/` تُفسد ذلك صامتاً.
 */
function b64u(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64u(str) {
    const pad = String(str).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(pad + '='.repeat((4 - (pad.length % 4)) % 4), 'base64');
}

/**
 * يوقّع نية حجز. الحمولة تُسلسَل مرة واحدة ويُوقَّع نصّها حرفياً —
 * لا يُعاد بناؤها عند التحقق (إعادة البناء تعني اعتماداً على ترتيب
 * مفاتيح JSON، وهو تفصيل غير مضمون بين إصدارات ومنصّات).
 */
export function signBookingIntent(payload, secret, { now = Date.now(), ttlMs = INTENT_TTL_MS } = {}) {
    if (!secret) throw new Error('توقيع نية الحجز يتطلب مفتاحاً.');
    const body = { ...payload, iat: now, exp: now + ttlMs };
    const json = JSON.stringify(body);
    const encoded = b64u(json);
    const sig = crypto.createHmac('sha256', secret).update(encoded).digest();
    return `${encoded}.${b64u(sig)}`;
}

/**
 * يتحقق من نية ويعيد {values} أو {error} — بنفس عقد بقية المُتحقِّقات
 * في server.js (لا استثناءات لتدفّق متوقَّع).
 *
 * الترتيب مقصود: التوقيع **أولاً** قبل أي قراءة للحمولة. قراءة حقول
 * من نصّ لم يُتحقق منه بعد هي الباب الذي تدخل منه بيانات مُلفَّقة.
 */
export function verifyBookingIntent(token, secret, { now = Date.now() } = {}) {
    if (!secret) return { error: 'التحقق من نية الحجز يتطلب مفتاحاً.' };
    const parts = String(token || '').split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return { error: 'نية الحجز غير صالحة.' };
    const [encoded, sig] = parts;

    const expected = crypto.createHmac('sha256', secret).update(encoded).digest();
    const actual = unb64u(sig);
    // ⚠️ timingSafeEqual ترمي عند اختلاف الطول — الفحص قبلها لا بعدها
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return { error: 'توقيع نية الحجز لا يطابق — أعد الطلب من المساعد.' };
    }

    let body;
    try {
        body = JSON.parse(unb64u(encoded).toString('utf8'));
    } catch {
        return { error: 'نية الحجز غير صالحة.' };
    }
    if (!body || typeof body !== 'object') return { error: 'نية الحجز غير صالحة.' };
    if (!Number.isFinite(body.exp) || now > body.exp) {
        return { error: 'انتهت صلاحية تأكيد الحجز — اطلب العرض من جديد.' };
    }
    if (!INTENT_KINDS.includes(body.kind)) return { error: 'نوع نية حجز غير معروف.' };
    if (!body.username || !body.offerId) return { error: 'نية الحجز ناقصة.' };
    return { values: body };
}
