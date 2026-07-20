/**
 * 📚 Model Library — المعرفة التراكمية للفهم عبر كل المشاريع
 *
 * النموذج الدائم يتراكم داخل المشروع الواحد. لكن مشروعاً جديداً كان يبدأ من
 * الصفر (اشتقاق LLM + احتياطي مكتوب يدوياً). هذه المكتبة تجعل الفهم يتراكم
 * *بين* المشاريع: كل مشروع ينجح تحقّقه السلوكي يُغني نموذج فئته، والمشروع
 * الجديد يُبذَر من ذلك الفهم الناضج المُجرَّب بدل البدء من جديد.
 *
 * دائم عبر MongoDB (قرص Render يُمسح مع كل نشر) بمفتاح = الفئة.
 */

import { persistEntry, hydrateStore, onMongoReady } from '../services/persistence.js';
import { normalizeProjectModel, mergeProjectModel } from './projectModel.js';

const STORE = 'modelLibrary';
const library = new Map(); // category → { model, count, verifiedCount, updatedAt }

// استرجاع دائم عند توفّر Mongo — الأحدث يفوز (لا نطمس تراكم الجلسة الحالية)
onMongoReady(() => hydrateStore(STORE, (key, value) => {
    const cur = library.get(key);
    if (!cur || (value?.updatedAt || 0) > (cur.updatedAt || 0)) library.set(key, value);
}));

function keyOf(category) {
    return (category || 'other').toString().toLowerCase().trim() || 'other';
}

/** نموذج الفئة المتراكم (أو null) — لبذر مشروع جديد. */
export function getLibraryModel(category) {
    const entry = library.get(keyOf(category));
    return entry?.model ? normalizeProjectModel(entry.model) : null;
}

/**
 * يُسجّل نموذج مشروع في مكتبة فئته (اتحاد تراكمي). نحفظ فقط ما له قيمة
 * (كيانات/أدوار فعلية) — ويُفضّل ما مرّ بالتحقّق السلوكي (إشارة جودة).
 */
export function recordModel(category, model, { verified = false } = {}) {
    if (!model) return null;
    const norm = normalizeProjectModel(model);
    if (!norm.entities.length && !norm.roles.length) return null; // لا نحفظ فراغاً
    const key = keyOf(category);
    const cur = library.get(key);
    const merged = cur?.model ? mergeProjectModel(cur.model, norm) : norm;
    const entry = {
        model: merged,
        count: (cur?.count || 0) + 1,
        verifiedCount: (cur?.verifiedCount || 0) + (verified ? 1 : 0),
        updatedAt: Date.now(),
    };
    library.set(key, entry);
    persistEntry(STORE, key, entry); // دائم في Mongo (no-op بأمان إن غير متصل)
    return merged;
}

/** ملخّص المكتبة (للمعاينة/التشخيص). */
export function librarySummary() {
    return [...library.entries()].map(([category, e]) => ({
        category,
        contributions: e.count || 0,
        verified: e.verifiedCount || 0,
        entities: e.model?.entities?.length || 0,
        roles: e.model?.roles?.length || 0,
        flows: e.model?.flows?.length || 0,
    }));
}

// للاختبار فقط — تصفير الذاكرة بين الحالات
export function _resetForTest() { library.clear(); }
