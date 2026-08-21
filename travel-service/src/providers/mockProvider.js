/**
 * 🧪 mockProvider.js — مزوّد طيران محاكاة (اختبارات + تطوير بلا مفاتيح)
 *
 * حتمي بالكامل: نفس البحث يعطي نفس العروض دوماً (البذرة من المسار
 * والتاريخ) — الاختبارات تتحقق من قيم فعلية لا "أي شيء رجع".
 * يحقق نفس عقد duffelProvider حرفياً (searchOffers/getOffer/createOrder/
 * cancelOrder بنفس أشكال المخرجات) فتتبادل الخدمتان بلا لمس server.js.
 */

import { seedOf, pad } from './mockUtils.js';
import { normalizeFareConditions } from '../fareConditions.js';
import { sortOffers, totalDurationMin, applyOfferFilters } from './duffelProvider.js';
import { buildSearchPassengers } from '../passengerAges.js';

const MOCK_AIRLINES = ['طيران جاولا', 'أجنحة الصقر', 'سماء العرب'];
const MOCK_CURRENCY = 'USD';

export function createMockTravelProvider({ failCreate = false, failCancel = false } = {}) {
    const offers = new Map();  // id → عرض كامل (بالصافي)
    const orders = new Map();  // orderId → طلب
    let orderSeq = 0;

    // 🧳 أمتعةٌ محاكاة **ثلاثيّة القيم عمداً**: مصرَّحة بحقيبة، ومصرَّحة
    // بلا حقيبة، وغير مصرَّحة أصلاً (null). المزوّد الحي يُنتج الثلاث،
    // فمحاكاةٌ تُنتج واحدة تترك فرعين من فلتر الأمتعة بلا اختبار —
    // ويظهر عطبهما في الإنتاج وحده. الاشتقاق من البذرة فيبقى حتمياً.
    function mockBaggage(seed) {
        const kind = seed % 3;
        if (kind === 0) return null;                                  // لم يصرّح
        if (kind === 1) return [{ type: 'carry_on', quantity: 1 }];   // بلا مسجَّلة
        return [{ type: 'carry_on', quantity: 1 }, { type: 'checked', quantity: 1 }];
    }

    function buildSlice(origin, destination, date, seed, stops) {
        const depHour = 6 + (seed % 12);
        const durationMin = 90 + (seed % 300) + stops * 95;
        const departAt = `${date}T${pad(depHour)}:${pad(seed % 60)}:00`;
        const arrive = new Date(`${departAt}Z`);
        arrive.setUTCMinutes(arrive.getUTCMinutes() + durationMin);
        const segments = [];
        if (stops === 0) {
            segments.push({
                origin, destination, departAt,
                arriveAt: arrive.toISOString().slice(0, 19),
                carrier: MOCK_AIRLINES[seed % MOCK_AIRLINES.length],
                flightNumber: 'JA' + (100 + (seed % 900)),
                baggage: mockBaggage(seed),
            });
        } else {
            const mid = 'HUB';
            const midAt = new Date(`${departAt}Z`);
            midAt.setUTCMinutes(midAt.getUTCMinutes() + Math.floor(durationMin / 2) - 40);
            segments.push({
                origin, destination: mid, departAt,
                arriveAt: midAt.toISOString().slice(0, 19),
                carrier: MOCK_AIRLINES[seed % MOCK_AIRLINES.length],
                flightNumber: 'JA' + (100 + (seed % 900)),
                baggage: mockBaggage(seed),
            });
            const leg2 = new Date(midAt); leg2.setUTCMinutes(leg2.getUTCMinutes() + 80);
            segments.push({
                origin: mid, destination, departAt: leg2.toISOString().slice(0, 19),
                arriveAt: arrive.toISOString().slice(0, 19),
                carrier: MOCK_AIRLINES[(seed + 1) % MOCK_AIRLINES.length],
                flightNumber: 'JA' + (500 + (seed % 400)),
                baggage: mockBaggage(seed),
            });
        }
        return {
            origin, destination, departAt,
            arriveAt: arrive.toISOString().slice(0, 19),
            durationMin, stops, segments,
            // نفس حقل الشريحة في الرد الحي — بلا هذا تبقى شارة العائلة
            // في الواجهة بلا اختبارٍ يمرّ عليها.
            fareBrand: ['Basic', 'Standard', 'Flex'][seed % 3],
        };
    }

    return {
        name: 'mock',
        mode: 'mock',

        async searchOffers({ origin, destination, departDate, returnDate = null, adults = 1, childrenDobs = [], cabin = 'economy', sort = 'price', maxStops = null, airline = null, maxNetAmount = null, checkedBagOnly = false }) {
            const seed = seedOf(`${origin}${destination}${departDate}${cabin}`);
            const paxCount = adults + childrenDobs.length;
            // نفس ترتيب duffelProvider (بالغون ثم أطفال) ونفس شكل الكائن —
            // فيسري فحص الأعمار في الخادم على المحاكاة كما على المزوّد الحي.
            const passengers = buildSearchPassengers({ adults, childrenDobs, departDate })
                .map((p, idx) => ({ id: `mock_pas_${idx}`, type: p.type ?? null, age: p.age ?? null }));
            const results = [];
            for (let i = 0; i < 3; i++) {
                const s = seed + i * 137;
                const base = 80 + (s % 420);
                const cabinFactor = { economy: 1, premium_economy: 1.7, business: 3.2, first: 5 }[cabin] || 1;
                const netAmount = Math.round(base * cabinFactor * paxCount * 100) / 100;
                const slices = [buildSlice(origin, destination, departDate, s, i === 2 ? 1 : 0)];
                if (returnDate) slices.push(buildSlice(destination, origin, returnDate, s + 7, i === 2 ? 1 : 0));
                // 🎟️ عائلات سعر متمايزة عمداً: الأرخص مقيَّدة والأغلى مرنة —
                // فيرى المطوّر (والاختبار) الحالات الحقيقية الثلاث لا حالةً
                // واحدة وردية. الثالثة تُبقي الرسم null: «مسموح والرسم يحدّده
                // الناقل»، وهي الحالة التي تُنسى فتُعرض خطأً كأنها مجانية.
                const FARES = [
                    { brand: 'Economy Light', change: { allowed: false }, refund: { allowed: false } },
                    { brand: 'Economy Flex', change: { allowed: true, penalty_amount: '75', penalty_currency: MOCK_CURRENCY }, refund: { allowed: true, penalty_amount: '150', penalty_currency: MOCK_CURRENCY } },
                    { brand: 'Economy Standard', change: { allowed: true }, refund: { allowed: false } },
                ];
                const fare = FARES[i % FARES.length];
                for (const sl of slices) sl.fareBrand = fare.brand;
                const offer = {
                    id: `mock_off_${seed}_${i}`,
                    owner: MOCK_AIRLINES[s % MOCK_AIRLINES.length],
                    netAmount,
                    currency: MOCK_CURRENCY,
                    cabin,
                    passengerCount: paxCount,
                    passengers,
                    passengerIds: passengers.map(p => p.id),
                    expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
                    // تعادل عقد duffelProvider: الشعار null (لا نختلق رابطاً)
                    ownerLogo: null,
                    ownerIata: null,
                    totalDurationMin: totalDurationMin(slices),
                    conditions: normalizeFareConditions({
                        change_before_departure: fare.change,
                        refund_before_departure: fare.refund,
                    }),
                    slices,
                };
                offers.set(offer.id, offer);
                results.push({ ...offer });
            }
            // نفس عقد duffelProvider حرفياً: فلترة قبل الترتيب
            return sortOffers(applyOfferFilters(results, { maxStops, airline, maxNetAmount, checkedBagOnly }), sort);
        },

        async getOffer(offerId) {
            const offer = offers.get(offerId);
            return offer ? { ...offer } : null;
        },

        async createOrder({ offerId, passengers, contact }) {
            if (failCreate) throw new Error('محاكاة: المزوّد رفض إصدار الحجز.');
            const offer = offers.get(offerId);
            if (!offer) throw new Error('العرض غير موجود أو انتهت صلاحيته.');
            orderSeq += 1;
            const order = {
                orderId: 'mock_ord_' + orderSeq,
                bookingReference: 'JAO' + String(1000 + orderSeq),
                status: 'issued',
                netAmount: offer.netAmount,
                currency: offer.currency,
                passengers, contact,
            };
            orders.set(order.orderId, order);
            return { ...order };
        },

        async cancelOrder(orderId) {
            if (failCancel) throw new Error('محاكاة: المزوّد رفض الإلغاء.');
            const order = orders.get(orderId);
            if (!order) throw new Error('الطلب غير موجود لدى المزوّد.');
            order.status = 'cancelled';
            // سياسة المحاكاة: استرداد 80% من الصافي — قيمة حتمية للاختبارات
            return {
                status: 'cancelled',
                refundAmount: Math.round(order.netAmount * 0.8 * 100) / 100,
                currency: order.currency,
            };
        },
    };
}
