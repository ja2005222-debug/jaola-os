/**
 * 📶 mockEsimProvider.js — مزوّد باقات إنترنت سفر (eSIM) محاكاة
 *
 * منتج مستقل جديد بلا مزوّد حي بعد (قرار المالك: نبدأ بمحاكاة كاملة
 * التدفق الآن، ونؤجّل الربط الحي لحين التعاقد مع مزوّد فعلي مثل Airalo
 * أو eSIMAccess — «لا صيغة مزوّد بلا توثيق مؤكَّد»). نفس فلسفة
 * mockCarsProvider.js حرفياً: حتمي بالكامل (بذرة من الوجهة والمدة)،
 * ويحقق نفس شكل عقد أي مزوّد حي مستقبلي (searchEsims/getEsimOffer/
 * getQuote/createEsimOrder) فيتبادلان بلا لمس server.js.
 *
 * ⚠️ بلا cancelEsimOrder عمداً: الصناعة الفعلية (Airalo وأمثالها) لا
 * تُرجع باقة رقمية بعد إصدارها — ملفّ eSIM يُسلَّم فوراً، والادّعاء بإلغاء
 * أو استرداد بعده كذبٌ تسويقي. غياب الدالة هنا يمنع بناء زرّ إلغاء لاحقاً
 * بالخطأ (server.js لا يملك ما ينادَى أصلاً).
 *
 * الوجهة بلد لا مطار: نشتق `country`/`countryEn` من رمز IATA الذي
 * يختاره المسافر (نفس حقل airports.js المستعمَل أصلاً في بحث السيارات) —
 * فلا حاجة لقائمة دول جديدة، والمسافر يكتب "باريس" لا "FR".
 */
import { seedOf } from './mockUtils.js';
import { airportCoords } from '../airports.js';

const MOCK_CURRENCY = 'USD';
const MOCK_NETWORKS = ['Orange/Vodafone Partner', 'Local Tier-1 Partner', 'Multi-carrier (أفضل إشارة)'];

// شرائح بيانات حقيقية الشكل (تطابق ما تبيعه Airalo/Holafly فعلاً) — كل
// شريحة صالحة فقط لرحلة لا تتجاوز مدتها validityDays، وإلا لا تغطيها.
const PLAN_TIERS = [
    { dataGb: 1, validityDays: 7 },
    { dataGb: 3, validityDays: 15 },
    { dataGb: 5, validityDays: 30 },
    { dataGb: 10, validityDays: 30 },
    { dataGb: 20, validityDays: 30 },
];

export function createMockEsimProvider({ failCreate = false } = {}) {
    const offers = new Map();
    const orders = new Map();
    let orderSeq = 0;

    return {
        name: 'mock-esim',
        mode: 'mock',

        async searchEsims({ iata, days }) {
            const location = airportCoords(iata);
            const country = location?.country || iata;
            const countryEn = location?.countryEn || iata;
            const seed = seedOf(`${iata}${days}`);
            const results = [];
            for (const [i, tier] of PLAN_TIERS.entries()) {
                if (tier.validityDays < days) continue; // لا تغطي كامل الرحلة — تُستبعد لا تُعرض ناقصة
                const s = seed + i * 149;
                const perGbPrice = Math.round((3.5 + (s % 30) / 10) * 100) / 100; // ~3.5–6.5 لكل GB
                const netAmount = Math.round(tier.dataGb * perGbPrice * 100) / 100;
                const offer = {
                    id: `mock_esim_${seed}_${i}`,
                    country, countryEn,
                    dataGb: tier.dataGb,
                    validityDays: tier.validityDays,
                    network: MOCK_NETWORKS[i % MOCK_NETWORKS.length],
                    netAmount, currency: MOCK_CURRENCY,
                    expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
                };
                offers.set(offer.id, offer);
                results.push({ ...offer });
            }
            return results;
        },

        async getEsimOffer(offerId) {
            const offer = offers.get(offerId);
            return offer ? { ...offer } : null;
        },

        // بلا تفرقة rate/quote في المحاكاة — نفس المعرّف طوال الوقت (تعادل
        // getQuote لدى mockCarsProvider الذي يجلب لا ينشئ).
        async getQuote(offerId) {
            const offer = offers.get(offerId);
            return offer ? { ...offer } : null;
        },

        async createEsimOrder({ offerId, contact }) {
            if (failCreate) throw new Error('محاكاة: مزوّد eSIM رفض إصدار الباقة.');
            const offer = offers.get(offerId);
            if (!offer) throw new Error('عرض باقة eSIM غير موجود أو انتهت صلاحيته.');
            orderSeq += 1;
            // كود تفعيل شكلي (نمط LPA الحقيقي لتثبيت eSIM يدوياً) — بلا صورة
            // QR فعلية (تحتاج مكتبة رسم لا نضيفها لمزوّد محاكاة سيُستبدَل).
            const s = seedOf(offerId + orderSeq);
            const iccid = '8901' + String(s % 1e15).padStart(15, '0');
            const activationCode = `LPA:1$esim.jatrava.mock$${orderSeq}-${s.toString(36).toUpperCase()}`;
            const order = {
                orderId: 'mock_esim_ord_' + orderSeq,
                bookingReference: 'JAE' + String(1000 + orderSeq),
                status: 'issued',
                netAmount: offer.netAmount,
                currency: offer.currency,
                esim: { iccid, activationCode },
                contact,
            };
            orders.set(order.orderId, order);
            return { ...order };
        },
    };
}
