/**
 * 🗃️ storage/index.js — اختيار تخزين ملفات الفيديو (نقطة التبديل الوحيدة)
 *
 * عقد التخزين:
 *   mirrorFromUrl(sourceUrl, key)   → {key, bytes}   (يرمي عند الفشل)
 *   putObject(key, body, mimeType)  → {key, bytes}   (رفع مباشر من الذاكرة)
 *   signedUrl(key, ttlSec?)         → رابط موقّع قصير الأجل
 *   remove(key)                     → حذف الملف
 *
 * **معطَّل افتراضياً** (يُرجع null): بلا مفاتيح R2 تعمل الخدمة كما كانت —
 * روابط المزوّد كما هي. لا تعطُّل ولا سلوك نصف-مفعَّل.
 */
import { createR2Storage } from './r2Storage.js';

/** مسار الملف داخل الدلو — يعزل مستخدماً عن آخر ويبقى قابلاً للتتبع. */
export function storageKeyFor({ username, jobId }) {
    const safeUser = String(username || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 64);
    const safeJob = String(jobId).replace(/[^a-z0-9_-]/gi, '_');
    return `videos/${safeUser}/${safeJob}.mp4`;
}

/**
 * مسار صورة رفعها المستخدم من جهازه — نفس قواعد العزل. البادئة
 * `uploads/<user>/` هي أيضاً فحص الملكية: قيمة `upload:<key>` في حقل
 * صورة تُقبل فقط إن طابقت بادئة صاحب الطلب (راجع server.js).
 */
export function uploadImageKeyFor({ username, uploadId, ext }) {
    const safeUser = String(username || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 64);
    const safeId = String(uploadId).replace(/[^a-z0-9_-]/gi, '_');
    const safeExt = ['png', 'jpg', 'webp'].includes(ext) ? ext : 'png';
    return `uploads/${safeUser}/${safeId}.${safeExt}`;
}

/** مسار صورة مرجعية لشخصية (بنك الشخصيات) — نفس قواعد العزل. */
export function characterImageKeyFor({ username, characterId, angle }) {
    const safeUser = String(username || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 64);
    const safeChar = String(characterId).replace(/[^a-z0-9_-]/gi, '_');
    const safeAngle = String(angle).replace(/[^a-z]/gi, '').slice(0, 16) || 'front';
    return `characters/${safeUser}/${safeChar}-${safeAngle}.png`;
}

export function buildStorage(env = process.env) {
    const enabled = String(env.VIDEO_STORAGE || '').toLowerCase() === 'r2';
    if (!enabled) return null;

    // مفعَّل صراحةً لكن بإعداد ناقص = خطأ إعداد يجب أن يوقف الإقلاع،
    // لا أن يتحول لفشل صامت في كل مهمة (نفس فلسفة مزوّد shotstack).
    return createR2Storage({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET,
        endpoint: env.S3_ENDPOINT,
        signedUrlTtlSec: Number(env.SIGNED_URL_TTL_SEC) > 0 ? Number(env.SIGNED_URL_TTL_SEC) : 600,
    });
}

/** مدة الاحتفاظ بالملفات (أيام) — 0 يعني بلا حذف تلقائي. */
export function retentionDays(env = process.env) {
    const v = Number(env.VIDEO_RETENTION_DAYS);
    return Number.isInteger(v) && v >= 0 ? v : 30;
}
