/**
 * 🗺️ topDestinations.js — قائمة "أهم الوجهات" بصور Wikimedia + أرخص سعر حقيقي
 *
 * لا بيانات وهمية: السعر يأتي من provider.searchOffers الحقيقي (نفس مزوّد
 * الطيران المستخدَم بالفعل)، والصورة من Wikipedia REST API (بلا مفتاح
 * تسجيل — تأكَّد بحثاً قبل الاختيار، نفس معيار travelInfo.js). كلا
 * المصدرين مُخزَّنان مؤقتاً (cache) بذاكرة العملية — الصور TTL طويل لأنها
 * لا تتغيّر عملياً، والأسعار TTL أقصر (نفس فاصل مراقب الأسعار الدوري
 * الموجود أصلاً، priceWatchPoller.js، لتناسق منطقي بين الفاصلين).
 *
 * ⚠️ صيغة Wikipedia REST API من التوثيق العام المنشور — لم تُجرَّب ضد
 * الشبكة الحية من بيئة التطوير (نفس حجب النطاقات الجديدة الذي يطال
 * open-meteo/frankfurter في travelInfo.js). أول تشغيل فعلي على الخادم
 * المنشور هو الاختبار الحقيقي؛ فشل الصورة لواحدة لا يُسقط الوجهة كلها —
 * تُعرض بلا صورة (null) لا بفشل صامت أو رابط مكسور.
 */
import { airportCoords } from './airports.js';
import { applyMarkup } from './pricing.js';

const WIKI_SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const IMAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // أسبوع — الصور لا تتغيّر عملياً
const PRICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // نفس فاصل priceWatchPoller.js
const PRICE_CONCURRENCY = 3; // نفس FLEX_CONCURRENCY في server.js — أدب مع حد معدّل المزوّد
const DEFAULT_DAYS_AHEAD = 30;

// وجهات مختارة يدوياً (تنوّع جغرافي لجمهور خليجي/عربي) — كل واحدة تحتاج
// عنوان ويكيبيديا إنجليزي صريح لتفادي تحويلات/غموض عناوين الصفحات.
export const CURATED_DESTINATIONS = [
    { iata: 'DXB', wikiTitle: 'Dubai' },
    { iata: 'IST', wikiTitle: 'Istanbul' },
    { iata: 'CAI', wikiTitle: 'Cairo' },
    { iata: 'LHR', wikiTitle: 'London' },
    { iata: 'CDG', wikiTitle: 'Paris' },
    { iata: 'BCN', wikiTitle: 'Barcelona' },
    { iata: 'FCO', wikiTitle: 'Rome' },
    { iata: 'BKK', wikiTitle: 'Bangkok' },
    { iata: 'KUL', wikiTitle: 'Kuala Lumpur' },
    { iata: 'VIE', wikiTitle: 'Vienna' },
];

const imageCache = new Map(); // wikiTitle → { url, expiresAt }
const priceCache = new Map(); // `${origin}:${destination}:${departDate}` → { price, currency, expiresAt }

/** يجلب صورة تمثيلية للوجهة من Wikipedia — null عند أي فشل (لا استثناء يُسقط الوجهة). */
async function fetchDestinationImage(wikiTitle, fetchImpl) {
    const cached = imageCache.get(wikiTitle);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    try {
        const res = await fetchImpl(WIKI_SUMMARY_URL + encodeURIComponent(wikiTitle));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const url = data.thumbnail?.source || data.originalimage?.source || null;
        imageCache.set(wikiTitle, { url, expiresAt: Date.now() + IMAGE_CACHE_TTL_MS });
        return url;
    } catch {
        return null;
    }
}

/** أرخص سعر بيع (net + هامش) لرحلة ذهاب فقط — null عند أي فشل بحث. */
async function fetchCheapestPrice({ provider, origin, destination, departDate, markupPct }) {
    const key = `${origin}:${destination}:${departDate}`;
    const cached = priceCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return { price: cached.price, currency: cached.currency };
    try {
        const offers = await provider.searchOffers({ origin, destination, departDate, returnDate: null, adults: 1, childrenDobs: [], cabin: 'economy' });
        if (offers.length === 0) {
            priceCache.set(key, { price: null, currency: null, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
            return { price: null, currency: null };
        }
        const cheapestNet = Math.min(...offers.map(o => o.netAmount));
        const result = { price: applyMarkup(cheapestNet, markupPct), currency: offers[0].currency };
        priceCache.set(key, { ...result, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
        return result;
    } catch {
        return { price: null, currency: null };
    }
}

/**
 * يبني قائمة الوجهات المُثراة (صورة + سعر) لأصل بحث معيّن — يستبعد
 * الوجهة إن طابقت الأصل (بحث بمطار مطابق للوصول مرفوض أصلاً لدى provider).
 *
 * `limit` ليس تجميلاً: كل وجهة = بحث حقيقي لدى المزوّد، والشريط الترويجي
 * في صفحة الهبوط يعمل لكل زائر لا عند ضغطة زر. تقليل العدد هناك يقلّل
 * الضغط على حدّ معدّل المزوّد عند أول زيارة من مطار غير مُخزَّن مسبقاً.
 */
export async function buildTopDestinations({ origin, provider, markupPct, fetchImpl = fetch, limit = CURATED_DESTINATIONS.length }) {
    const departDate = new Date(Date.now() + DEFAULT_DAYS_AHEAD * 86400000).toISOString().slice(0, 10);
    const list = CURATED_DESTINATIONS.filter(d => d.iata !== origin).slice(0, Math.max(1, limit));

    const results = [];
    for (let i = 0; i < list.length; i += PRICE_CONCURRENCY) {
        const batch = list.slice(i, i + PRICE_CONCURRENCY);
        const batchResults = await Promise.all(batch.map(async d => {
            const coords = airportCoords(d.iata);
            const [image, priced] = await Promise.all([
                fetchDestinationImage(d.wikiTitle, fetchImpl),
                fetchCheapestPrice({ provider, origin, destination: d.iata, departDate, markupPct }),
            ]);
            return {
                iata: d.iata,
                city: coords?.city || d.iata,
                country: coords?.country || null,
                // الأسماء الإنجليزية للواجهة ثنائية اللغة — من نفس سجل المطار
                cityEn: coords?.cityEn || d.wikiTitle || d.iata,
                countryEn: coords?.countryEn || null,
                image,
                fromPrice: priced.price,
                currency: priced.currency,
            };
        }));
        results.push(...batchResults);
    }
    return results;
}
