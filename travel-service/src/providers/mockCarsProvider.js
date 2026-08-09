/**
 * 🚗 mockCarsProvider.js — مزوّد سيارات محاكاة (اختبارات + تطوير بلا مفاتيح)
 *
 * نفس فلسفة mockStaysProvider.js حرفياً: حتمي بالكامل (بذرة من الوجهة
 * والتواريخ)، ويحقق عقد duffelCarsProvider نفسه (searchCars/getCarOffer/
 * getQuote/createCarOrder/cancelCarOrder) فتتبادل الخدمتان بلا لمس server.js.
 */
import { seedOf } from './mockUtils.js';
import { airportCoords } from '../airports.js';

const MOCK_VEHICLES = [
    { name: 'اقتصادية — تويوتا يارس', supplier: 'Avis' },
    { name: 'سيدان — هيونداي إلنترا', supplier: 'Hertz' },
    { name: 'دفع رباعي — تويوتا لاندكروزر', supplier: 'Sixt' },
    { name: 'فاخرة — مرسيدس E-Class', supplier: 'Europcar' },
];
const MOCK_CURRENCY = 'USD';

function rentalDays(pickupAt, dropoffAt) {
    return Math.max(1, Math.ceil((new Date(dropoffAt) - new Date(pickupAt)) / 86400000));
}

export function createMockCarsProvider({ failCreate = false, failCancel = false } = {}) {
    const offers = new Map();
    const orders = new Map();
    let orderSeq = 0;

    return {
        name: 'mock-cars',
        mode: 'mock',

        async searchCars({ iata, pickupAt, dropoffAt }) {
            const days = rentalDays(pickupAt, dropoffAt);
            const seed = seedOf(`${iata}${pickupAt}${dropoffAt}`);
            const location = airportCoords(iata);
            const results = [];
            for (let i = 0; i < 4; i++) {
                const s = seed + i * 173;
                const perDay = 25 + (s % 180);
                const netAmount = Math.round(perDay * days * 100) / 100;
                const v = MOCK_VEHICLES[i % MOCK_VEHICLES.length];
                const offer = {
                    id: `mock_car_${seed}_${i}`,
                    vehicleName: v.name,
                    supplier: v.supplier,
                    pickupLocation: location?.city || iata,
                    pickupAt, dropoffAt, days,
                    netAmount, currency: MOCK_CURRENCY,
                    cancellable: i !== 2,
                    expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
                };
                offers.set(offer.id, offer);
                results.push({ ...offer });
            }
            return results;
        },

        async getCarOffer(offerId) {
            const offer = offers.get(offerId);
            return offer ? { ...offer } : null;
        },

        // بلا تفرقة rate/quote في المحاكاة — نفس المعرّف طوال الوقت (تعادل
        // getQuote لدى mockStaysProvider الذي يجلب لا ينشئ).
        async getQuote(offerId) {
            const offer = offers.get(offerId);
            return offer ? { ...offer } : null;
        },

        async createCarOrder({ offerId, drivers, contact }) {
            if (failCreate) throw new Error('محاكاة: مزوّد السيارات رفض إصدار الحجز.');
            const offer = offers.get(offerId);
            if (!offer) throw new Error('عرض السيارة غير موجود أو انتهت صلاحيته.');
            orderSeq += 1;
            const order = {
                orderId: 'mock_car_ord_' + orderSeq,
                bookingReference: 'JAC' + String(1000 + orderSeq),
                status: 'issued',
                netAmount: offer.netAmount,
                currency: offer.currency,
                drivers, contact,
            };
            orders.set(order.orderId, order);
            return { ...order };
        },

        async cancelCarOrder(orderId) {
            if (failCancel) throw new Error('محاكاة: مزوّد السيارات رفض الإلغاء.');
            const order = orders.get(orderId);
            if (!order) throw new Error('الطلب غير موجود لدى المزوّد.');
            order.status = 'cancelled';
            return {
                status: 'cancelled',
                refundAmount: Math.round(order.netAmount * 0.8 * 100) / 100,
                currency: order.currency,
            };
        },
    };
}
