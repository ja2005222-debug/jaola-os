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

/**
 * كلماتٌ تُثري بحثَ Pexels لأنواعٍ اسمُها وحدَه غامض. وما لم يُذكر هنا
 * يُبحث **باسم نوعه** — وأسماءُ الأنواع في `knowledge/design-rules.json`
 * إنجليزيةٌ أصلاً، فالاشتقاقُ من السجلّ لا من قائمةٍ ثانيةٍ تنجرف عنه.
 *
 * 🔴 كانت هنا خريطةٌ يدويّةٌ بعشرة مفاتيح و`|| TYPE_QUERIES.business`.
 *    وقياسُ التقاطع مع السجلّ الحيّ: **٢١ من ٣١ نوعاً** تسقط إلى
 *    «business office team» — عرسٌ وصالونُ تجميل ومكتبُ محاماة ووكالةُ
 *    سيارات وموقعُ سفر، كلُّها صورُ مكاتب. والسياقُ المحقون يقول للوكيل
 *    «صور حقيقية جاهزة للاستخدام… استخدمها في img src مباشرة».
 */
const QUERY_HINTS = {
    restaurant: 'food gourmet',
    medical: 'hospital doctor',
    clinic: 'dental medical',
    ecommerce: 'shopping retail products',
    hotel: 'luxury resort',
    gym: 'fitness workout',
    portfolio: 'creative workspace design',
    realestate: 'modern house architecture',
    education: 'students learning classroom',
    business: 'office team',
};

/** كلمةُ بحثٍ لكلّ نوع — مشتقّةٌ من اسمه، لا من قائمةٍ قد تُغفِله. */
export function queryForType(projectType) {
    const type = String(projectType || '').trim().toLowerCase() || 'business';
    const hint = QUERY_HINTS[type];
    return hint ? `${type} ${hint}` : type;
}

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
    const query = queryForType(projectType);

    let urls = await fetchPexels(query);
    let source = 'Pexels';
    if (!urls) {
        urls = picsumFallback(projectName || projectType);
        source = 'picsum';
    }

    const list = urls.map((u, i) => `${i + 1}. ${u}`).join('\n');
    // صورُ picsum عشوائيةٌ لا صلةَ لها بالموضوع — يُقال ذلك للوكيل بدل أن
    // يبني عليها تسمياتٍ موضوعيّةً كاذبة («فريقنا»، «طبقُ اليوم»).
    const heading = source === 'Pexels'
        ? `صور حقيقية مطابقة لموضوع «${query}»`
        : 'صور عامّة (غير مطابقة للموضوع — استخدمها خلفياتٍ أو أغلفةً بلا تسمياتٍ موضوعيّة)';
    return {
        source,
        query,
        count: urls.length,
        context: `\n## ${heading} — استخدمها في img src مباشرة، لا تخترع روابط صور:\n${list}\n`,
    };
}
