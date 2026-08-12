/**
 * 🤝 contractedStaysProvider.js — مزوّد فنادق العقود المباشرة
 *
 * يحقق **نفس عقد staysProvider** (searchStays/getStayOffer/getQuote/
 * createStayOrder/cancelStayOrder/getHotelDetails) فيتبادل مع LiteAPI
 * وDuffel والمحاكاة بلا لمس server.js — نفس القاعدة التي جعلت المزوّدات
 * الثلاثة الأخرى قابلة للتبديل.
 *
 * الفرق الجوهري عن بقية المزوّدات: «المزوّد» هنا هو **نحن** — الحجز
 * تخصيصُ غرفة من حصة عقدنا (ذرّي في المخزن)، والإلغاء إعادتُها. لا شبكة
 * إطلاقاً. والعروض قابلة لإعادة البناء من معرّفها فلا تضيع بإعادة تشغيل.
 *
 * `withContractedStays(base, contracted)` يدمج المزوّدين: عروض العقود
 * أولاً (السعر الخاص يتصدّر) ثم عروض المزوّد العام، والتوجيه عند الحجز
 * والإلغاء ببادئة المعرّف.
 */
import {
    contractCoversStay, nightsBetween, contractOfferId, parseContractOfferId,
    CONTRACT_OFFER_PREFIX, CONTRACT_ORDER_PREFIX, CONTRACT_HOTEL_PREFIX,
} from '../contracts.js';

function round2(n) { return Math.round(n * 100) / 100; }

function offerFromContract(contract, { checkInDate, checkOutDate, adults, rooms }) {
    const nights = nightsBetween(checkInDate, checkOutDate);
    return {
        id: contractOfferId(contract.id, checkInDate, checkOutDate, adults, rooms),
        name: contract.hotelName,
        hotelId: CONTRACT_HOTEL_PREFIX + contract.id,
        hotelName: contract.hotelName,
        roomName: 'سعر خاص متعاقَد',
        city: contract.city,
        country: null,
        rating: null,
        checkInDate, checkOutDate, nights, adults, rooms,
        netAmount: round2(contract.netPerNight * nights * rooms),
        currency: contract.currency,
        // شرط الباقات محقّق بالبناء: عقودنا Free-sale قابلة للإلغاء —
        // إعادة الغرفة لحصتنا لا تكلّفنا شيئاً.
        cancellable: true,
        contracted: true, // 🤝 شارة «سعر خاص» في الواجهة
        boardName: null,
        maxOccupancy: null,
        cancelPolicy: [],
        feesAtProperty: [],
        expiresAt: null, // العرض من عقدنا نحن — لا صلاحية تنتهي قبل نهاية العقد
    };
}

export function createContractedStaysProvider({ store }) {
    /** يبني العرض من معرّفه بعد التحقق أن العقد ما زال يغطيه وفيه غرف. */
    async function resolveOffer(offerId) {
        const parsed = parseContractOfferId(offerId);
        if (!parsed) return null;
        const contract = await store.getContract(parsed.contractId);
        if (!contract || contract.active === false) return null;
        if (!contractCoversStay(contract, parsed.checkInDate, parsed.checkOutDate)) return null;
        if ((contract.usedRooms || 0) + parsed.rooms > contract.allotment) return null;
        return offerFromContract(contract, parsed);
    }

    return {
        name: 'contracted',
        mode: 'contracted',

        async searchStays({ iata, checkInDate, checkOutDate, adults = 1, rooms = 1 }) {
            const contracts = await store.listContracts();
            return contracts
                .filter(c => c.active !== false
                    && c.iata === String(iata || '').toUpperCase()
                    && contractCoversStay(c, checkInDate, checkOutDate)
                    && (c.usedRooms || 0) + rooms <= c.allotment)
                .map(c => offerFromContract(c, { checkInDate, checkOutDate, adults, rooms }));
        },

        async getStayOffer(offerId) { return resolveOffer(offerId); },
        async getQuote(offerId) { return resolveOffer(offerId); },

        async getHotelDetails(hotelId) {
            const id = String(hotelId || '');
            if (!id.startsWith(CONTRACT_HOTEL_PREFIX)) return null;
            const contract = await store.getContract(id.slice(CONTRACT_HOTEL_PREFIX.length));
            if (!contract) return null;
            return {
                id: hotelId,
                name: contract.hotelName,
                description: 'سعر خاص بموجب اتفاق مباشر بين جولا والفندق — التأكيد فوري.',
                importantInformation: null,
                address: null,
                city: contract.city, country: null,
                starRating: null, reviewRating: null, reviewCount: null,
                checkinTime: null, checkoutTime: null,
                location: null, images: [], facilities: [],
            };
        },

        async createStayOrder({ offerId, guests, contact }) {
            const offer = await resolveOffer(offerId);
            if (!offer) throw new Error('عرض العقد غير متاح — نفدت الحصة أو تغيّر العقد. أعد البحث.');
            const parsed = parseContractOfferId(offerId);
            // الذرّية في المخزن: الشرط على الحصة داخل العملية نفسها —
            // null يعني خسرنا السباق على آخر غرفة، وهو جواب صريح لا خطأ.
            const allocation = await store.createContractAllocation(parsed.contractId, {
                rooms: parsed.rooms,
                netAmount: offer.netAmount,
                currency: offer.currency,
                checkIn: parsed.checkInDate,
                checkOut: parsed.checkOutDate,
            });
            if (!allocation) throw new Error('نفدت حصة الغرف المتعاقَد عليها لهذه التواريخ — أعد البحث.');
            return {
                orderId: allocation.id,
                bookingReference: 'JAC' + allocation.id.slice(-6).toUpperCase(),
                status: 'issued',
                netAmount: offer.netAmount,
                currency: offer.currency,
                guests, contact,
            };
        },

        async cancelStayOrder(orderId) {
            const released = await store.releaseContractAllocation(String(orderId || ''));
            if (!released) throw new Error('التخصيص غير موجود أو أُلغي سلفاً.');
            // Free-sale قابل للإلغاء: الغرفة عادت لحصتنا بلا كلفة — استرداد كامل
            return {
                status: 'cancelled',
                refundAmount: released.netAmount,
                currency: released.currency,
            };
        },
    };
}

/**
 * يدمج مزوّد العقود مع المزوّد العام في مزوّد واحد يراه الخادم.
 *
 * البحث: عروض العقود أولاً (السعر الخاص يتصدّر) ثم العام — وفشل أحد
 * الجانبين لا يُسقط الآخر: عقودنا محلية لا تفشل بانقطاع شبكة LiteAPI،
 * والعكس صحيح.
 *
 * التوجيه ببادئة المعرّف (`ctr_`/`ctro_`/`ctrh_`): حتمي، لا تخمين.
 */
export function withContractedStays(base, contracted) {
    if (!base) return contracted;
    return {
        name: base.name,
        mode: base.mode,

        async searchStays(params) {
            const [fromContracts, fromBase] = await Promise.allSettled([
                contracted.searchStays(params),
                base.searchStays(params),
            ]);
            const list = [];
            if (fromContracts.status === 'fulfilled') list.push(...fromContracts.value);
            if (fromBase.status === 'fulfilled') list.push(...fromBase.value);
            else if (fromContracts.status !== 'fulfilled' || list.length === 0) {
                // كلا الجانبين فشل (أو لا عقود والعام فشل) — الخطأ الحقيقي يصعد
                throw fromBase.reason;
            }
            return list;
        },

        async getStayOffer(offerId) {
            if (String(offerId || '').startsWith(CONTRACT_OFFER_PREFIX)) {
                return contracted.getStayOffer(offerId);
            }
            return base.getStayOffer(offerId);
        },

        async getQuote(offerId) {
            if (String(offerId || '').startsWith(CONTRACT_OFFER_PREFIX)) {
                return contracted.getQuote(offerId);
            }
            return base.getQuote(offerId);
        },

        async getHotelDetails(hotelId) {
            if (String(hotelId || '').startsWith(CONTRACT_HOTEL_PREFIX)) {
                return contracted.getHotelDetails(hotelId);
            }
            if (typeof base.getHotelDetails !== 'function') {
                // الغلاف يعرّف الدالة دوماً (فنادق العقود تحتاجها) فيُخفي عن
                // الخادم أن المزوّد الأساسي لا يدعمها — status هنا يحفظ 501
                // الصادق بدل 502 «فشل» لشيء لم يُحاوَل أصلاً.
                throw Object.assign(new Error('تفاصيل الفنادق غير مدعومة لدى المزوّد الحالي.'), { status: 501 });
            }
            return base.getHotelDetails(hotelId);
        },

        async createStayOrder(params) {
            if (String(params?.offerId || '').startsWith(CONTRACT_OFFER_PREFIX)) {
                return contracted.createStayOrder(params);
            }
            return base.createStayOrder(params);
        },

        async cancelStayOrder(orderId) {
            if (String(orderId || '').startsWith(CONTRACT_ORDER_PREFIX)) {
                return contracted.cancelStayOrder(orderId);
            }
            return base.cancelStayOrder(orderId);
        },
    };
}
