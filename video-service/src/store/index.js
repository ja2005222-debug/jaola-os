/**
 * 🗄️ store/index.js — اختيار المخزن (نقطة التبديل الوحيدة)
 *
 * عقد المخزن (يحققه fileStore وpostgresStore بالتطابق):
 *   init() / close()
 *   getBalance(user) → number                      (ينشئ الحساب بالرصيد الترحيبي عند أول نداء)
 *   grantCredits({user, amount, grantedBy, note}) → true
 *   deductCredits({user, amount, jobId})  → bool   (ذرّي؛ false عند رصيد غير كافٍ)
 *   refundCredits({user, amount, jobId, reason}) → bool (معصوم من الازدواج لكل jobId)
 *   getUserLedger(user, limit) → [حركة]            (الأحدث أولاً)
 *   createJob(job) → job                           (يولّد id/at/updatedAt)
 *   getJob(id) → job|null
 *   listJobsByUser(user, limit) → [job]            (الأحدث أولاً)
 *   listActiveJobs() → [job]                       (queued|rendering، الأقدم أولاً)
 *   transitionJob(id, {from:[حالات], to, patch}) → job|null   (ذرّي)
 *
 * الاختيار: DATABASE_URL مضبوط → postgres (دائم، للإنتاج)، وإلا → ملفات
 * (صفر إعداد، للتطوير والاختبار).
 */
import { createFileStore } from './fileStore.js';
import { createPostgresStore } from './postgresStore.js';

export const STARTER_CREDITS = 3;

export function buildStore({ databaseUrl, dataDir, starterCredits = STARTER_CREDITS } = {}) {
    if (databaseUrl) {
        return createPostgresStore({ connectionString: databaseUrl, starterCredits });
    }
    if (!dataDir) throw new Error('dataDir مطلوب حين لا يُضبط DATABASE_URL.');
    return createFileStore({ dataDir, starterCredits });
}
