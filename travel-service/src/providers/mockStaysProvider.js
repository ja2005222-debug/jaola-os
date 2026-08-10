/**
 * 🏨 mockStaysProvider.js — مزوّد فنادق محاكاة (اختبارات + تطوير بلا مفاتيح)
 *
 * نفس فلسفة mockProvider.js حرفياً للطيران: حتمي بالكامل (بذرة من
 * الوجهة والتواريخ)، ويحقق عقد duffelStaysProvider نفسه
 * (searchStays/getStayOffer/createStayOrder/cancelStayOrder) فتتبادل
 * الخدمتان بلا لمس server.js.
 */
import { seedOf } from './mockUtils.js';
import { airportCoords } from '../airports.js';

const MOCK_HOTEL_NAMES = ['فندق الواحة', 'برج اللؤلؤة', 'نزل النخيل', 'قصر الشرق'];
const MOCK_CURRENCY = 'USD';

function nightsBetween(checkIn, checkOut) {
    return Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
}

export function createMockStaysProvider({ failCreate = false, failCancel = false } = {}) {
    const offers = new Map(); // id → عرض كامل (بالصافي)
    const orders = new Map(); // orderId → طلب
    let orderSeq = 0;

    return {
        name: 'mock-stays',
        mode: 'mock',

        async searchStays({ iata, checkInDate, checkOutDate, adults = 1, rooms = 1 }) {
            const nights = nightsBetween(checkInDate, checkOutDate);
            const seed = seedOf(`${iata}${checkInDate}${checkOutDate}${adults}${rooms}`);
            const location = airportCoords(iata);
            const results = [];
            for (let i = 0; i < 4; i++) {
                const s = seed + i * 211;
                const perNight = 40 + (s % 260);
                const netAmount = Math.round(perNight * nights * rooms * 100) / 100;
                const offer = {
                    id: `mock_stay_${seed}_${i}`,
                    name: MOCK_HOTEL_NAMES[s % MOCK_HOTEL_NAMES.length],
                    hotelId: `mock_hotel_${s % MOCK_HOTEL_NAMES.length}`,
                    hotelName: MOCK_HOTEL_NAMES[s % MOCK_HOTEL_NAMES.length],
                    roomName: i === 0 ? 'غرفة مزدوجة' : 'غرفة فردية',
                    city: location?.city || iata,
                    country: location?.country || null,
                    rating: 3 + (s % 3),
                    checkInDate, checkOutDate, nights, adults, rooms,
                    netAmount, currency: MOCK_CURRENCY,
                    cancellable: i !== 2,
                    // نفس حقول liteApiStaysProvider الجديدة — تعادل العقد
                    boardName: i % 2 === 0 ? 'Room Only' : 'Breakfast Included',
                    maxOccupancy: 2 + (i % 2),
                    cancelPolicy: i === 2 ? [] : [{ before: `${checkInDate}T12:00:00`, amount: netAmount, currency: MOCK_CURRENCY }],
                    feesAtProperty: i === 0 ? [{ description: 'ضريبة المدينة', amount: 5, currency: MOCK_CURRENCY }] : [],
                    expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
                };
                offers.set(offer.id, offer);
                results.push({ ...offer });
            }
            return results;
        },

        async getStayOffer(offerId) {
            const offer = offers.get(offerId);
            return offer ? { ...offer } : null;
        },

        // تعادل عقد liteApiStaysProvider.getHotelDetails — حتمي بلا شبكة.
        async getHotelDetails(hotelId) {
            const s = seedOf(String(hotelId || ''));
            return {
                id: hotelId,
                name: MOCK_HOTEL_NAMES[s % MOCK_HOTEL_NAMES.length],
                description: 'فندق محاكاة للتطوير — وصف تجريبي بلا بيانات حقيقية.',
                importantInformation: 'يلزم إبراز هوية عند الوصول (نص محاكاة).',
                address: 'شارع المحاكاة 1',
                city: null, country: null,
                starRating: 3 + (s % 3),
                reviewRating: 7 + (s % 3),
                reviewCount: 100 + (s % 900),
                checkinTime: '03:00 PM',
                checkoutTime: '12:00 PM',
                location: null,
                images: [],
                facilities: ['واي فاي مجاني', 'موقف سيارات', 'مصعد'],
            };
        },

        // بلا تفرقة rate/quote في المحاكاة — نفس المعرّف طوال الوقت،
        // فتُعيد نفس البحث في الخريطة (تحقق تعادل duffelStaysProvider
        // الحقيقي حيث getQuote تجلب quote موجوداً لا تُنشئ آخر).
        async getQuote(offerId) {
            const offer = offers.get(offerId);
            return offer ? { ...offer } : null;
        },

        async createStayOrder({ offerId, guests, contact }) {
            if (failCreate) throw new Error('محاكاة: مزوّد الفنادق رفض إصدار الحجز.');
            const offer = offers.get(offerId);
            if (!offer) throw new Error('عرض الفندق غير موجود أو انتهت صلاحيته.');
            orderSeq += 1;
            const order = {
                orderId: 'mock_stay_ord_' + orderSeq,
                bookingReference: 'JAH' + String(1000 + orderSeq),
                status: 'issued',
                netAmount: offer.netAmount,
                currency: offer.currency,
                guests, contact,
            };
            orders.set(order.orderId, order);
            return { ...order };
        },

        async cancelStayOrder(orderId) {
            if (failCancel) throw new Error('محاكاة: مزوّد الفنادق رفض الإلغاء.');
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
