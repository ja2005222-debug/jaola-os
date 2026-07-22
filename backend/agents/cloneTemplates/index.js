/**
 * 📚 سجلّ قوالب الكلون العاملة — تطبيقات كاملة تعمل فعلاً، لا توليد من الصفر.
 * كل مشروع معقّد يبدأ من كلون مطابق (يجتاز التحقّق السلوكي)، ثم يخصّصه الذكاء.
 */
import { foodDeliveryClone } from './foodDelivery.js';
import { jaolaWeather } from './jaolaWeather.js';
import { jaolaCrypto } from './jaolaCrypto.js';
import { jaolaStore } from './jaolaStore.js';
import { jaolaBooking } from './jaolaBooking.js';
import { jaolaRealestate } from './jaolaRealestate.js';
import { jaolaCurrency } from './jaolaCurrency.js';
import { jaolaMarketplace } from './jaolaMarketplace.js';
import { jaolaTaxi } from './jaolaTaxi.js';
import { jaolaTravel } from './jaolaTravel.js';

// كل قوالب jaola المتاحة (تُبنى مرة عند الحاجة)
const BUILDERS = [foodDeliveryClone, jaolaStore, jaolaBooking, jaolaRealestate, jaolaMarketplace, jaolaTaxi, jaolaTravel, jaolaWeather, jaolaCrypto, jaolaCurrency];

/** بيانات وصفية للعرض (لوحة «معرفة المنصّة») — بلا محتوى الملفات الثقيل. */
export function listClones() {
    return BUILDERS.map(b => {
        const c = b();
        return {
            id: c.id, name: c.name, category: c.category, description: c.description,
            roles: (c.model?.roles || []).map(r => r.name),
            files: c.files.map(f => f.name),
            externalApi: c.externalApi || null,
        };
    });
}

/**
 * يختار أنسب كلون لمشروع (أو null). المطابقة بالكلمات المفتاحية في الهدف +
 * فئة المخطّط. مخصّص للتطبيقات التفاعلية فقط (لا البروشورات).
 */
export function matchCloneTemplate(goal = '', blueprint = null, domainModel = null) {
    const category = blueprint?.category;
    const isApp = blueprint?.kind === 'webapp' || blueprint?.kind === 'tool'
        || (Array.isArray(domainModel?.roles) && domainModel.roles.length > 1);
    if (!isApp) return null; // البروشورات لا تحتاج كلون تطبيق

    // نبني نصّ بحث من الهدف + أسماء النموذج المحفوظ (كيانات/أدوار/تدفّقات) —
    // فيطابق حتى لو كان الهدف ضعيفاً («اكمل») لأن النموذج يحمل هوية المشروع.
    const modelText = [
        ...(domainModel?.entities || []).map(e => e?.name),
        ...(domainModel?.roles || []).map(r => r?.name),
        ...(domainModel?.flows || []).map(f => f?.name),
    ].filter(Boolean).join(' ');
    const hay = `${goal || ''} ${modelText}`.toLowerCase();

    let best = null, bestScore = 0;
    for (const build of BUILDERS) {
        const c = build();
        let score = 0;
        if (category && c.category === category) score += 2;
        for (const kw of c.keywords || []) {
            if (kw && hay.includes(kw.toLowerCase())) score += 1;
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
