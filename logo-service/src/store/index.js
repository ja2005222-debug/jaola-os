/**
 * 🗄️ store/index.js — اختيار المخزن (نقطة التبديل الوحيدة)
 *
 * عقد المخزن (يحققه fileStore وpostgresStore بالتطابق):
 *   init() / close()
 *   recordDraftRound({ipHash, username|null, prompt, params, images}) → round
 *   getDraftRound(id) → round|null
 *   countDraftRoundsSince(since) → number
 *   countDraftRoundsSinceForIp(ipHash, since) → number
 *   countDraftRoundsSinceForUser(username, since) → number
 *   recordFinal({username, roundId, prompt, params, imageUrl}) → final
 *   countFinalsSinceForUser(username, since) → number
 *   listFinalsByUser(username) → [final]           (الأحدث أولاً)
 *   getFlag(key) / setFlag(key, value)
 *
 * الاختيار: DATABASE_URL مضبوط → postgres (دائم — وضروري إنتاجياً لأن
 * عدّادات السقوف درعُ التكلفة، وقرص Render المؤقت يمسحها مع كل نشر)،
 * وإلا → ملفات (صفر إعداد، للتطوير والاختبار).
 */
import { createFileStore } from './fileStore.js';
import { createPostgresStore } from './postgresStore.js';

export function buildStore({ databaseUrl, dataDir } = {}) {
    if (databaseUrl) return createPostgresStore({ connectionString: databaseUrl });
    if (!dataDir) throw new Error('dataDir مطلوب حين لا يُضبط DATABASE_URL.');
    return createFileStore({ dataDir });
}
