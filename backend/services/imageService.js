/**
 * 🖼️ Image Service — صور حقيقية للمواقع المولّدة
 *
 * المشكلة: المواقع المبنية تستخدم صوراً مكسورة أو عامة.
 * الحل بطبقتين:
 * - PEXELS_API_KEY مضبوط → صور فوتوغرافية حقيقية مطابقة لموضوع المشروع
 * - بدونه → picsum.photos بمعرّف seed ثابت (صور عشوائية جميلة تعمل دائماً)
 *
 * تُحقن الروابط في سياق هدف البناء ليستخدمها وكيل البرمجة مباشرة.
 */

// كلمة البحث الإنجليزية حسب نوع المشروع (Pexels يبحث بالإنجليزية)
const TYPE_QUERIES = {
    restaurant: 'restaurant food gourmet',
    medical: 'hospital doctor medical',
    clinic: 'clinic dental medical',
    ecommerce: 'products shopping retail',
    hotel: 'luxury hotel resort',
    gym: 'gym fitness workout',
    portfolio: 'creative workspace design',
    realestate: 'modern house architecture',
    education: 'students learning classroom',
    business: 'business office team',
};

async function fetchPexels(query, count = 6) {
    const key = process.env.PEXELS_API_KEY;
    if (!key) return null;
    try {
        const res = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
            { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const urls = (data.photos || []).map(p => p.src?.large).filter(Boolean);
        return urls.length ? urls : null;
    } catch (e) {
        console.warn('[ImageService] Pexels فشل:', e.message);
        return null;
    }
}

function picsumFallback(seedBase, count = 6) {
    // seed ثابت لكل مشروع → نفس الصور في كل إعادة بناء (اتساق بصري)
    return Array.from({ length: count }, (_, i) =>
        `https://picsum.photos/seed/${encodeURIComponent(seedBase)}-${i}/1200/800`);
}

/**
 * يجلب روابط صور مناسبة للمشروع ويعيد فقرة سياق جاهزة للحقن في هدف البناء
 */
export async function buildImageContext(goal, projectType, projectName = 'site') {
    const query = TYPE_QUERIES[projectType] || TYPE_QUERIES.business;

    let urls = await fetchPexels(query);
    let source = 'Pexels';
    if (!urls) {
        urls = picsumFallback(projectName || projectType);
        source = 'picsum';
    }

    const list = urls.map((u, i) => `${i + 1}. ${u}`).join('\n');
    return {
        source,
        count: urls.length,
        context: `\n## صور حقيقية جاهزة للاستخدام (استخدمها في img src مباشرة — لا تخترع روابط صور):\n${list}\n`,
    };
}
