/**
 * 📚 سجلّ قوالب الكلون العاملة — تطبيقات كاملة تعمل فعلاً، لا توليد من الصفر.
 * كل مشروع معقّد يبدأ من كلون مطابق (يجتاز التحقّق السلوكي)، ثم يخصّصه الذكاء.
 */
import { foodDeliveryClone } from './foodDelivery.js';

// كل القوالب المتاحة (تُبنى مرة عند الحاجة)
const BUILDERS = [foodDeliveryClone];

/** بيانات وصفية للعرض (لوحة «معرفة المنصّة») — بلا محتوى الملفات الثقيل. */
export function listClones() {
    return BUILDERS.map(b => {
        const c = b();
        return {
            id: c.id, name: c.name, category: c.category, description: c.description,
            roles: (c.model?.roles || []).map(r => r.name),
            files: c.files.map(f => f.name),
        };
    });
}

/**
 * يختار أنسب كلون لمشروع (أو null). المطابقة بالكلمات المفتاحية في الهدف +
 * فئة المخطّط. مخصّص للتطبيقات التفاعلية فقط (لا البروشورات).
 */
export function matchCloneTemplate(goal = '', blueprint = null, domainModel = null) {
    const g = (goal || '').toLowerCase();
    const category = blueprint?.category;
    const isApp = blueprint?.kind === 'webapp' || blueprint?.kind === 'tool'
        || (Array.isArray(domainModel?.roles) && domainModel.roles.length > 1);
    if (!isApp) return null; // البروشورات لا تحتاج كلون تطبيق

    let best = null, bestScore = 0;
    for (const build of BUILDERS) {
        const c = build();
        let score = 0;
        if (category && c.category === category) score += 2;
        for (const kw of c.keywords || []) {
            if (kw && g.includes(kw.toLowerCase())) score += 1;
        }
        if (score > bestScore) { bestScore = score; best = c; }
    }
    // نطلب دليلاً كافياً (كلمة مفتاحية أو تطابق فئة + دور متعدّد) لتجنّب الفرض
    return bestScore >= 2 ? best : null;
}

/** يجلب كلوناً بمعرّفه (للتطبيق المباشر/الاختبار). */
export function getCloneById(id) {
    for (const build of BUILDERS) {
        const c = build();
        if (c.id === id) return c;
    }
    return null;
}
