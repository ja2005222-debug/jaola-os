/**
 * 🧪 اختبارات بوابة السفر — نفس المجموعة كاملةً ضد **كلا المخزنين**
 *
 * الملفات دوماً، وPostgres أيضاً إذا ضُبط TEST_DATABASE_URL (مضبوط في CI
 * عبر حاوية خدمة postgres) — نفس عقيدة خدمة الفيديو: منع تباعد سلوك
 * المخزنين بصمت.
 *
 * بلا شبكة ولا مفاتيح حقيقية: مزوّد محاكاة حتمي، والايجنت يُختبر بنموذج
 * لغوي **مُسجَّل** (fetchImpl يعيد tool_calls مكتوبة سلفاً) — نختبر حلقة
 * الأدوات والحراس، لا ذكاء النموذج.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';

import { createApp, validateSearchParams, validatePassengers, validateStaySearchParams, validateGuests, validateCarSearchParams, validateDrivers, verifyDuffelWebhookSignature } from '../server.js';
import crypto from 'crypto';
import { createMockTravelProvider } from '../src/providers/mockProvider.js';
import { createDuffelProvider, normalizeDuffelOffer, sortOffers, totalDurationMin } from '../src/providers/duffelProvider.js';
import { createMockStaysProvider } from '../src/providers/mockStaysProvider.js';
import { normalizeDuffelStayResult } from '../src/providers/duffelStaysProvider.js';
import { createMockCarsProvider } from '../src/providers/mockCarsProvider.js';
import { normalizeDuffelCarResult } from '../src/providers/duffelCarsProvider.js';
import { buildProvider, buildStaysProvider, buildCarsProvider } from '../src/providers/index.js';
import { readMarkupPct, applyMarkup, DEFAULT_MARKUP_PCT } from '../src/pricing.js';
import { canTransition, createBooking, transitionBooking, getBooking, getBookingByProviderOrderId } from '../src/bookings.js';
import { createFileStore } from '../src/store/fileStore.js';
import { createPostgresStore } from '../src/store/postgresStore.js';
import { createTravelAgent, executeAgentTool, buildTravelAgent, AGENT_TOOLS } from '../src/agent/agent.js';
import { listPriceWatchesByUser, cancelPriceWatch } from '../src/priceWatches.js';
import { checkWatches } from '../src/priceWatchPoller.js';
import { searchAirports, AIRPORT_COORDS } from '../src/airports.js';
import { getDestinationWeather, convertCurrency } from '../src/travelInfo.js';
import { buildTopDestinations, CURATED_DESTINATIONS } from '../src/topDestinations.js';
import { createLiteApiStaysProvider } from '../src/providers/liteApiStaysProvider.js';

const JWT_SECRET = 'test-secret-not-for-production';
const MARKUP = 10; // هامش الاختبارات — أرقامه سهلة التحقق يدوياً

function makeToken(username) {
    return jwt.sign({ id: username, username }, JWT_SECRET, { expiresIn: '1h' });
}

function futureDate(days) {
    return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

const SEARCH_BODY = () => ({
    origin: 'RUH', destination: 'CAI', departDate: futureDate(14), adults: 1,
});

const VALID_PAX = {
    passengers: [{ title: 'mr', givenName: 'AHMED', familyName: 'ALI', bornOn: '1990-05-01', gender: 'm' }],
    contact: { email: 'a@test.com', phone: '+966500000000' },
};

const STAY_SEARCH_BODY = () => ({
    iata: 'RUH', checkInDate: futureDate(14), checkOutDate: futureDate(17), adults: 1, rooms: 1,
});

const VALID_GUESTS = {
    guests: [{ givenName: 'AHMED', familyName: 'ALI' }],
    contact: { email: 'a@test.com', phone: '+966500000000' },
};

const CAR_SEARCH_BODY = () => ({
    iata: 'RUH', pickupDate: futureDate(14), pickupTime: '10:00',
    dropoffDate: futureDate(16), dropoffTime: '10:00',
});

const VALID_DRIVERS = {
    drivers: [{ givenName: 'AHMED', familyName: 'ALI' }],
    contact: { email: 'a@test.com', phone: '+966500000000' },
};

// ─── 👁️ مراقب الأسعار الدوري (وحدة مستقلة — بلا خادم HTTP) ────────────
describe('checkWatches: الفحص الدوري لمراقبات الأسعار', () => {
    test('خط أساس أول فحص بلا إشعار، ثم إشعار عند بلوغ السعر الهدف وstatus=triggered', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-travel-watch-'));
        const watchStore = createFileStore({ dataDir: dir });
        await watchStore.init();
        const watch = await watchStore.createPriceWatch({
            username: 'poll-user', origin: 'RUH', destination: 'CAI',
            departDate: futureDate(40), returnDate: null, cabin: 'economy',
            targetPrice: 50, contactEmail: 'poll@test.com', status: 'active',
        });

        let price = 100;
        const stubProvider = { async searchOffers() { return [{ netAmount: price, currency: 'USD' }]; } };
        const sentMails = [];
        const stubMailer = {
            mailReady: () => true,
            sendMail: async (msg) => { sentMails.push(msg); return { ok: true }; },
        };

        // الفحص الأول: خط أساس فقط — لا سعر سابق للمقارنة، فلا إشعار
        let result = await checkWatches({ store: watchStore, provider: stubProvider, markupPct: 0, mailer: stubMailer });
        assert.equal(result.checked, 1);
        assert.equal(result.notified, 0);
        let updated = await watchStore.getPriceWatch(watch.id);
        assert.equal(updated.lastPrice, 100);
        assert.equal(updated.status, 'active');

        // الفحص الثاني: السعر ينخفض تحت الهدف (50) → إشعار + status=triggered
        price = 40;
        result = await checkWatches({ store: watchStore, provider: stubProvider, markupPct: 0, mailer: stubMailer });
        assert.equal(result.notified, 1);
        assert.equal(sentMails.length, 1);
        assert.match(sentMails[0].subject, /RUH→CAI/);
        assert.equal(sentMails[0].to, 'poll@test.com');
        updated = await watchStore.getPriceWatch(watch.id);
        assert.equal(updated.status, 'triggered');

        // triggered لم تعد "نشطة" — الفحص التالي لا يعاود فحصها ولا الإشعار
        result = await checkWatches({ store: watchStore, provider: stubProvider, markupPct: 0, mailer: stubMailer });
        assert.equal(result.checked, 0);
        assert.equal(sentMails.length, 1);
    });

    test('بلا بريد تواصل: تحديث السعر يستمر بلا محاولة إرسال', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-travel-watch2-'));
        const watchStore = createFileStore({ dataDir: dir });
        await watchStore.init();
        await watchStore.createPriceWatch({
            username: 'poll-user2', origin: 'RUH', destination: 'JED',
            departDate: futureDate(40), returnDate: null, cabin: 'economy',
            targetPrice: null, contactEmail: null, status: 'active',
        });
        let price = 100;
        const stubProvider = { async searchOffers() { return [{ netAmount: price, currency: 'USD' }]; } };
        const stubMailer = { mailReady: () => true, sendMail: async () => { throw new Error('لا يجب أن يُستدعى'); } };

        await checkWatches({ store: watchStore, provider: stubProvider, markupPct: 0, mailer: stubMailer });
        price = 10; // انخفاض حقيقي — لكن بلا contactEmail لا إرسال
        const result = await checkWatches({ store: watchStore, provider: stubProvider, markupPct: 0, mailer: stubMailer });
        assert.equal(result.notified, 0);
        assert.equal(result.errors.length, 0);
    });

    test('رحلة مضى تاريخها → expired فوراً بلا نداء مزوّد', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-travel-watch3-'));
        const watchStore = createFileStore({ dataDir: dir });
        await watchStore.init();
        const watch = await watchStore.createPriceWatch({
            username: 'poll-user3', origin: 'RUH', destination: 'CAI',
            departDate: '2020-01-01', returnDate: null, cabin: 'economy',
            targetPrice: null, contactEmail: null, status: 'active',
        });
        let searchCalls = 0;
        const stubProvider = { async searchOffers() { searchCalls += 1; return [{ netAmount: 100, currency: 'USD' }]; } };

        const result = await checkWatches({ store: watchStore, provider: stubProvider, markupPct: 0 });
        assert.equal(searchCalls, 0); // لا نداء مزوّد لرحلة مضت — توفير
        assert.equal(result.checked, 1);
        const updated = await watchStore.getPriceWatch(watch.id);
        assert.equal(updated.status, 'expired');

        // expired لم تعد نشطة — لا تُفحص مجدداً
        const again = await checkWatches({ store: watchStore, provider: stubProvider, markupPct: 0 });
        assert.equal(again.checked, 0);
    });

    test('فشل الإرسال البريدي لا يُسكت المراقبة: تبقى active لإعادة المحاولة لاحقاً', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-travel-watch4-'));
        const watchStore = createFileStore({ dataDir: dir });
        await watchStore.init();
        const watch = await watchStore.createPriceWatch({
            username: 'poll-user4', origin: 'RUH', destination: 'CAI',
            departDate: futureDate(40), returnDate: null, cabin: 'economy',
            targetPrice: 50, contactEmail: 'fail@test.com', status: 'active',
        });
        const stubProvider = { async searchOffers() { return [{ netAmount: 20, currency: 'USD' }]; } };
        // sendMail الحقيقي لا يرمي أبداً عند فشل مزوّد البريد — يعيد {error}
        const failingMailer = { mailReady: () => true, sendMail: async () => ({ error: 'فشل الإرسال (429).' }) };

        const result = await checkWatches({ store: watchStore, provider: stubProvider, markupPct: 0, mailer: failingMailer });
        assert.equal(result.notified, 0); // الإرسال فشل — لا يُحتسَب إشعاراً ناجحاً
        const updated = await watchStore.getPriceWatch(watch.id);
        assert.equal(updated.status, 'active'); // ليست triggered رغم بلوغ الهدف — تُعاد المحاولة
        assert.equal(updated.lastPrice, 20); // السعر يتحدّث رغم فشل الإرسال
    });
});

// ─── 🌤️💱 طقس + عملة (وحدة مستقلة — fetchImpl مُحاكى، بلا شبكة حقيقية) ──
describe('travelInfo: طقس الوجهة وتحويل العملات (بيانات حقيقية عبر fetchImpl قابل للحقن)', () => {
    test('getDestinationWeather: يطبّع رد Open-Meteo الموثَّق إلى أيام', async () => {
        const stubFetch = async () => ({
            ok: true,
            json: async () => ({
                daily: {
                    time: ['2027-01-15', '2027-01-16'],
                    temperature_2m_max: [30, 31],
                    temperature_2m_min: [18, 19],
                    precipitation_sum: [0, 2.4],
                },
            }),
        });
        const days = await getDestinationWeather({ lat: 24.9, lon: 46.7, dateFrom: '2027-01-15', dateTo: '2027-01-16', fetchImpl: stubFetch });
        assert.equal(days.length, 2);
        assert.equal(days[0].date, '2027-01-15');
        assert.equal(days[0].maxTempC, 30);
        assert.equal(days[1].precipitationMm, 2.4);
    });

    test('getDestinationWeather: خطأ HTTP يظهر برسالة واضحة لا فشلاً صامتاً', async () => {
        const stubFetch = async () => ({ ok: false, status: 400, text: async () => 'Bad Request' });
        await assert.rejects(
            getDestinationWeather({ lat: 0, lon: 0, dateFrom: '2027-01-15', dateTo: '2027-01-15', fetchImpl: stubFetch }),
            /HTTP 400/
        );
    });

    test('convertCurrency: يحسب المبلغ المحوَّل من السعر الحقيقي', async () => {
        const stubFetch = async () => ({ ok: true, json: async () => ({ rates: { SAR: 3.75 }, date: '2027-01-15' }) });
        const result = await convertCurrency({ amount: 100, from: 'USD', to: 'SAR', fetchImpl: stubFetch });
        assert.equal(result.converted, 375);
        assert.equal(result.rate, 3.75);
        assert.equal(result.date, '2027-01-15');
    });

    test('convertCurrency: عملة غير معروفة في الرد → خطأ واضح لا NaN صامت', async () => {
        const stubFetch = async () => ({ ok: true, json: async () => ({ rates: {} }) });
        await assert.rejects(
            convertCurrency({ amount: 10, from: 'USD', to: 'ZZZ', fetchImpl: stubFetch }),
            /لا سعر صرف متاح/
        );
    });
});

// ─── 🗺️ أهم الوجهات (وحدة مستقلة — كاش عملية مشترك بين الاختبارات) ────
// ⚠️ ترتيب الاختبارات أدناه مقصود لا اعتباطي: imageCache/priceCache في
// topDestinations.js كاش عملية (module-level) بلا دالة تصفير للاختبارات
// — اختبار "تعطّل الصور" يجب أن يسبق أي اختبار ينجح في جلب صورة (نجاح
// يُخزَّن مؤقتاً 7 أيام، فيُبطل تأكيد null لاحقاً)، والاختبارات تستخدم
// أصول (origin) مختلفة فيما بينها لتفادي تصادم كاش السعر أيضاً.
describe('topDestinations: أهم الوجهات (صورة Wikimedia + سعر حقيقي عبر مزوّد الطيران)', () => {
    test('buildTopDestinations: تعطّل شبكة الصور كليةً → صور null لكل الوجهات مع أسعار حقيقية سليمة', async () => {
        const provider = createMockTravelProvider();
        const flakyFetch = async () => { throw new Error('شبكة معطوبة'); };
        const destinations = await buildTopDestinations({ origin: 'DXB', provider, markupPct: MARKUP, fetchImpl: flakyFetch });
        assert.equal(destinations.length, CURATED_DESTINATIONS.length - 1); // DXB أصل البحث → مُستبعدة
        assert.ok(destinations.every(d => d.iata !== 'DXB'));
        assert.ok(destinations.every(d => d.image === null));
        assert.ok(destinations.every(d => Number.isFinite(d.fromPrice) && d.fromPrice > 0));
        const cai = destinations.find(d => d.iata === 'CAI');
        assert.equal(cai.city, 'القاهرة'); // من airports.js
    });

    test('buildTopDestinations: يُرجع صورة حقيقية لكل وجهة عند نجاح الشبكة', async () => {
        const provider = createMockTravelProvider();
        const stubFetch = async (url) => ({ ok: true, json: async () => ({ thumbnail: { source: String(url) + '.jpg' } }) });
        const destinations = await buildTopDestinations({ origin: 'JED', provider, markupPct: MARKUP, fetchImpl: stubFetch });
        assert.equal(destinations.length, CURATED_DESTINATIONS.length); // JED ليست ضمن القائمة المختارة
        assert.ok(destinations.every(d => typeof d.image === 'string' && d.image.includes('wikipedia.org')));
    });

    test('buildTopDestinations: فشل بحث المزوّد لوجهة واحدة → سعرها null بلا كسر بقية الوجهات', async () => {
        const base = createMockTravelProvider();
        const flakyProvider = {
            ...base,
            async searchOffers(params) {
                if (params.destination === 'IST') throw new Error('مزوّد معطوب مؤقتاً');
                return base.searchOffers(params);
            },
        };
        const stubFetch = async (url) => ({ ok: true, json: async () => ({ thumbnail: { source: String(url) + '.jpg' } }) });
        const destinations = await buildTopDestinations({ origin: 'AMM', provider: flakyProvider, markupPct: MARKUP, fetchImpl: stubFetch });
        const ist = destinations.find(d => d.iata === 'IST');
        assert.equal(ist.fromPrice, null);
        assert.equal(ist.currency, null);
        const dxb = destinations.find(d => d.iata === 'DXB');
        assert.ok(Number.isFinite(dxb.fromPrice) && dxb.fromPrice > 0);
    });
});

// ─── 🏨 liteApiStaysProvider (LiteAPI/Nuitee) — ردود Sandbox حقيقية ────
describe('liteApiStaysProvider: بحث فنادق حقيقي (رد Sandbox حي مُلتقَط فعلياً)', () => {
    // نسخة مختصَرة من رد GET /data/hotels وPOST /hotels/rates الحقيقيين
    // (بنفس أسماء الحقول والقيم — لا اختلاق) كما وردا من لوحة العميل.
    function stubFetch() {
        return async (url) => {
            const u = String(url);
            if (u.includes('/data/hotels')) {
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        data: [{ id: 'lp1897', name: 'Test Hotel NYC', city: 'New York', country: 'us', starRating: 4 }],
                    }),
                };
            }
            // ⚠️ الشكلان أدناه (prebook/book) اختُلقا لاختبار منطق كودنا
            // نفسه (تحليل الحقول التي افترضناها بحذر) — لا يمثّلان رد
            // LiteAPI الفعلي عند النجاح، لأنه لم يُشاهَد حياً بعد (راجع
            // تحذير أعلى liteApiStaysProvider.js). أول رد حي حقيقي قد
            // يحتاج تعديل مسارات الحقول في الكود لا هذا الاختبار وحده.
            if (u.includes('/rates/prebook')) {
                return { ok: true, text: async () => JSON.stringify({ data: { prebookId: 'prebook_xyz' } }) };
            }
            if (u.includes('/rates/book')) {
                return { ok: true, text: async () => JSON.stringify({ data: { bookingId: 'bk_123', bookingReference: 'LTA789' } }) };
            }
            if (u.includes('/bookings/bk_123')) {
                return { ok: true, text: async () => JSON.stringify({ data: { refundAmount: 200.5, currency: 'USD' } }) };
            }
            if (u.includes('/data/hotel?')) {
                // شكل موثَّق حرفياً في دليل LiteAPI المنشور
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        data: {
                            id: 'lp1897', name: 'Test Hotel NYC',
                            hotelDescription: '<p><strong>Oceanfront</strong> property...</p>',
                            hotelImportantInformation: 'Photo ID required at check-in.',
                            checkinCheckoutTimes: { checkin: '04:00 PM', checkout: '11:00 AM' },
                            hotelImages: [{ url: 'https://img.example/1.jpg', caption: 'hotel building' }],
                            country: 'us', city: 'New York', starRating: 4, rating: 8.6, reviewCount: 1599,
                            location: { latitude: 40.75, longitude: -73.99 },
                            address: '703 South Ocean Boulevard',
                            hotelFacilities: ['Free WiFi', 'Parking'],
                        },
                    }),
                };
            }
            if (u.includes('/hotels/rates')) {
                return {
                    ok: true,
                    text: async () => JSON.stringify({
                        data: [{
                            hotelId: 'lp1897',
                            et: 10800,
                            roomTypes: [
                                {
                                    roomTypeId: 'rt1', offerId: 'offer_abc', supplier: 'nuitee',
                                    rates: [{ name: 'Premium Two Queen Beds room', cancellationPolicies: { refundableTag: 'NRFN' } }],
                                    offerRetailRate: { amount: 474.65, currency: 'USD' },
                                },
                                {
                                    roomTypeId: 'rt2', offerId: 'offer_cheaper', supplier: 'nuitee',
                                    // حقول التفاصيل بنفس أسماء رد Sandbox الحقيقي المُلتقَط
                                    rates: [{
                                        name: 'Queen Standard Room',
                                        boardName: 'Breakfast Included',
                                        maxOccupancy: 3,
                                        cancellationPolicies: {
                                            refundableTag: 'RFN',
                                            cancelPolicyInfos: [{ cancelTime: '2027-01-13 07:00:00', amount: 381.62, currency: 'USD' }],
                                        },
                                        retailRate: {
                                            taxesAndFees: [
                                                { included: true, description: 'Resort fee', amount: 80, currency: 'USD' },
                                                { included: false, description: 'City tax', amount: 7, currency: 'USD' },
                                            ],
                                        },
                                    }],
                                    offerRetailRate: { amount: 253.01, currency: 'USD' },
                                },
                            ],
                        }],
                        guestLevel: 0,
                    }),
                };
            }
            throw new Error('مسار غير متوقَّع بالاختبار: ' + u);
        };
    }

    test('searchStays: يطبّع الرد الحقيقي (اسم فندق+غرفة، أرخص أولاً، refundableTag → cancellable)', async () => {
        const provider = createLiteApiStaysProvider({ apiKey: 'sand_test123', fetchImpl: stubFetch() });
        const offers = await provider.searchStays({ iata: 'RUH', checkInDate: '2027-01-15', checkOutDate: '2027-01-17', adults: 2, rooms: 1 });
        assert.equal(offers.length, 2);
        // مرتَّبة تصاعدياً بالسعر — الأرخص (offer_cheaper) أولاً
        assert.equal(offers[0].id, 'offer_cheaper');
        assert.equal(offers[0].netAmount, 253.01);
        assert.equal(offers[0].currency, 'USD');
        assert.equal(offers[0].cancellable, true); // RFN
        assert.match(offers[0].name, /Test Hotel NYC/);
        assert.match(offers[0].name, /Queen Standard Room/);
        assert.equal(offers[1].id, 'offer_abc');
        assert.equal(offers[1].cancellable, false); // NRFN
    });

    test('searchStays: وجهة غير مغطّاة (بلا إحداثيات) → خطأ واضح بلا نداء شبكة', async () => {
        const provider = createLiteApiStaysProvider({ apiKey: 'sand_test123', fetchImpl: stubFetch() });
        await assert.rejects(
            provider.searchStays({ iata: 'ZZZ', checkInDate: '2027-01-15', checkOutDate: '2027-01-17' }),
            /لا إحداثيات معروفة/
        );
    });

    test('searchStays: يحمل تفاصيل العرض التي كانت تُهمَل (إقامة/سعة/إلغاء/رسوم الفندق)', async () => {
        const provider = createLiteApiStaysProvider({ apiKey: 'sand_test123', fetchImpl: stubFetch() });
        const offers = await provider.searchStays({ iata: 'RUH', checkInDate: '2027-01-15', checkOutDate: '2027-01-17', adults: 2, rooms: 1 });
        const cheap = offers.find(o => o.id === 'offer_cheaper');
        assert.equal(cheap.hotelId, 'lp1897');           // أساس جلب تفاصيل الفندق
        assert.equal(cheap.roomName, 'Queen Standard Room');
        assert.equal(cheap.boardName, 'Breakfast Included');
        assert.equal(cheap.maxOccupancy, 3);
        assert.deepEqual(cheap.cancelPolicy, [{ before: '2027-01-13 07:00:00', amount: 381.62, currency: 'USD' }]);
        // الرسوم **غير المشمولة** فقط (تُدفع بالفندق) — المشمولة لا تُكرَّر
        assert.deepEqual(cheap.feesAtProperty, [{ description: 'City tax', amount: 7, currency: 'USD' }]);
    });

    test('getHotelDetails: يطبّع الشكل الموثَّق، وبلا أي حقل سعر', async () => {
        const provider = createLiteApiStaysProvider({ apiKey: 'sand_test123', fetchImpl: stubFetch() });
        const h = await provider.getHotelDetails('lp1897');
        assert.equal(h.name, 'Test Hotel NYC');
        assert.equal(h.starRating, 4);
        assert.equal(h.reviewRating, 8.6);
        assert.equal(h.reviewCount, 1599);
        assert.equal(h.checkinTime, '04:00 PM');
        assert.equal(h.checkoutTime, '11:00 AM');
        assert.deepEqual(h.location, { lat: 40.75, lon: -73.99 });
        assert.equal(h.images.length, 1);
        assert.deepEqual(h.facilities, ['Free WiFi', 'Parking']);
        // 💰 لا سعر إطلاقاً من هذا المسار — الأسعار حصراً من البحث المُسعَّر
        for (const k of ['netAmount', 'sellAmount', 'price', 'currency']) {
            assert.equal(h[k], undefined, `تسرّب حقل سعري: ${k}`);
        }
    });

    test('getStayOffer: يرجّع من الكاش بعد البحث، وnull لمعرّف غير موجود', async () => {
        const provider = createLiteApiStaysProvider({ apiKey: 'sand_test123', fetchImpl: stubFetch() });
        await provider.searchStays({ iata: 'RUH', checkInDate: '2027-01-15', checkOutDate: '2027-01-17', adults: 2, rooms: 1 });
        const found = await provider.getStayOffer('offer_abc');
        assert.equal(found.netAmount, 474.65);
        assert.equal(await provider.getStayOffer('لا-وجود'), null);
    });

    test('getQuote → createStayOrder: دورة حجز كاملة (prebook ثم book) عبر book.liteapi.travel', async () => {
        const provider = createLiteApiStaysProvider({ apiKey: 'sand_test123', fetchImpl: stubFetch() });
        await provider.searchStays({ iata: 'RUH', checkInDate: '2027-01-15', checkOutDate: '2027-01-17', adults: 1, rooms: 1 });

        const quote = await provider.getQuote('offer_abc');
        assert.equal(quote.id, 'prebook_xyz'); // prebookId من رد /rates/prebook
        assert.equal(quote.netAmount, 474.65); // نفس سعر البحث (لا رد نجاح حي يُعيد سعراً محدَّثاً بعد)

        const order = await provider.createStayOrder({
            offerId: quote.id,
            guests: [{ givenName: 'AHMED', familyName: 'ALI' }],
            contact: { email: 'a@test.com', phone: '+966500000000' },
        });
        assert.equal(order.orderId, 'bk_123');
        assert.equal(order.bookingReference, 'LTA789');
        assert.equal(order.status, 'issued');
        assert.equal(order.netAmount, 474.65);
        assert.equal(order.currency, 'USD');

        const cancelled = await provider.cancelStayOrder(order.orderId);
        assert.equal(cancelled.status, 'cancelled');
        assert.equal(cancelled.refundAmount, 200.5);
        assert.equal(cancelled.currency, 'USD');
    });

    test('getQuote: عرض غير موجود/منتهٍ → null بلا نداء شبكة', async () => {
        const provider = createLiteApiStaysProvider({ apiKey: 'sand_test123', fetchImpl: stubFetch() });
        assert.equal(await provider.getQuote('لا-وجود'), null);
    });

});

// ─── 🔤 بحث المطارات بالاسم (عربي/إنجليزي) بدل حفظ رموز IATA ──────────
describe('searchAirports: بحث بالمدينة أو الدولة، عربياً أو إنجليزياً', () => {
    const codes = q => searchAirports(q, 8).map(a => a.iata);

    test('العربية بكل صورها الشائعة تصل لنفس المطار', () => {
        // العيب الذي يعالجه التطبيع: من يكتب أياً من هذه يقصد الرياض،
        // والمقارنة النصية الخام تفشل في أغلبها.
        for (const q of ['الرياض', 'رياض', 'الریاض', 'الريااض'.replace('اا', 'ا'), ' الرياض ']) {
            assert.ok(codes(q).includes('RUH'), `فشل: ${q}`);
        }
        // تاء مربوطة/هاء، وألف مقصورة
        assert.ok(codes('جدة').includes('JED'));
        assert.ok(codes('جده').includes('JED'));
    });

    test('اسم الدولة يعطي كل مطاراتها المغطّاة', () => {
        const sa = codes('السعودية');
        for (const c of ['RUH', 'JED', 'DMM', 'MED', 'AHB']) assert.ok(sa.includes(c), `ناقص: ${c}`);
        assert.deepEqual(codes('سعودي').sort(), sa.sort()); // بلا «ال» نفس النتيجة
        const eg = codes('مصر');
        for (const c of ['CAI', 'HRG', 'SSH']) assert.ok(eg.includes(c), `ناقص: ${c}`);
    });

    test('الإنجليزية ورموز IATA تعمل بنفس الحقل', () => {
        assert.ok(codes('london').includes('LHR'));
        assert.ok(codes('London').includes('LGW'));
        assert.ok(codes('Saudi').includes('RUH'));
        assert.equal(codes('ruh')[0], 'RUH');   // تطابق الرمز يتصدّر
        assert.equal(codes('RUH')[0], 'RUH');
    });

    test('الترتيب: المدينة قبل الدولة، والرمز المطابق أولاً', () => {
        // «مصر» دولة لكل من CAI/HRG/SSH؛ و«القاهرة» مدينة واحدة
        assert.equal(codes('القاهرة')[0], 'CAI');
        // بحث بحرفين على الأقل، وما دونه لا يُرجع شيئاً (تفادي ضجيج)
        assert.deepEqual(searchAirports('ا'), []);
        assert.deepEqual(searchAirports(''), []);
        assert.deepEqual(searchAirports(null), []);
    });

    test('اسم غير مغطّى يُرجع فارغاً بدل اقتراح مطار لا نخدمه', () => {
        // نطاق البحث = المطارات التي نملك إحداثياتها فعلاً، فاقتراح غيرها
        // إغراء بفشل لاحق في الفنادق/الطقس.
        assert.deepEqual(codes('أنتاركتيكا'), []);
        assert.deepEqual(codes('zzzzz'), []);
    });

    test('كل نتيجة تحمل ما تحتاجه الواجهة للعرض والاختيار', () => {
        const [first] = searchAirports('الرياض');
        assert.equal(first.iata, 'RUH');
        assert.equal(first.city, 'الرياض');
        assert.equal(first.country, 'السعودية');
        assert.equal(first.cityEn, 'Riyadh');
        assert.match(first.label, /الرياض/);
        assert.match(first.label, /RUH/);
    });

    test('كل مطار مغطّى له اسم إنجليزي (لا فجوات في البيانات)', () => {
        for (const [iata, a] of Object.entries(AIRPORT_COORDS)) {
            assert.ok(a.cityEn, `بلا cityEn: ${iata}`);
            assert.ok(a.countryEn, `بلا countryEn: ${iata}`);
            // ويجب أن يكون قابلاً للإيجاد باسمه الإنجليزي فعلاً
            assert.ok(searchAirports(a.cityEn, 20).some(r => r.iata === iata), `لا يُوجد بالإنجليزية: ${iata}`);
        }
    });
});

// ─── المجموعة الكاملة، مُعامَلة بمصنع المخزن ──────────────────────────
function runSuite(storeLabel, { makeStore, resetStore }) {
    describe(`بوابة السفر — تخزين: ${storeLabel}`, () => {
        let store, server, baseUrl, provider, staysProvider, carsProvider;

        async function call(pathname, { method = 'GET', token = null, body = null } = {}) {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch(baseUrl + pathname, {
                method, headers, body: body ? JSON.stringify(body) : undefined,
            });
            let data = null;
            try { data = await res.json(); } catch { /* بعض الردود بلا جسم */ }
            return { status: res.status, data };
        }

        before(async () => {
            store = await makeStore();
            await store.init();
            provider = createMockTravelProvider();
            staysProvider = createMockStaysProvider();
            carsProvider = createMockCarsProvider();
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider, staysProvider, carsProvider, markupPct: MARKUP });
            server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
            baseUrl = `http://127.0.0.1:${server.address().port}`;
        });

        after(async () => {
            await new Promise(r => server.close(r));
            await store.close();
            if (resetStore) await resetStore();
        });

        test('💰 التسعير: الهامش يُطبَّق لأعلى، والبيئة الفاسدة تقع على الافتراضي', () => {
            assert.equal(applyMarkup(100, 10), 110);
            assert.equal(applyMarkup(99.99, 8), 107.99); // ceil لآخر سنت: 107.9892 → 107.99
            assert.equal(applyMarkup(0, 10), 0);
            assert.throws(() => applyMarkup(-5, 10));
            assert.throws(() => applyMarkup('abc', 10));
            assert.equal(readMarkupPct({ TRAVEL_MARKUP_PCT: '12.5' }), 12.5);
            assert.equal(readMarkupPct({ TRAVEL_MARKUP_PCT: 'garbage' }), DEFAULT_MARKUP_PCT);
            assert.equal(readMarkupPct({ TRAVEL_MARKUP_PCT: '-3' }), DEFAULT_MARKUP_PCT);
            assert.equal(readMarkupPct({ TRAVEL_MARKUP_PCT: '99' }), DEFAULT_MARKUP_PCT);
            assert.equal(readMarkupPct({}), DEFAULT_MARKUP_PCT);
        });

        test('🎫 آلة الحالات: المسارات المسموحة فقط', () => {
            assert.ok(canTransition('pending', 'issued'));
            assert.ok(canTransition('pending', 'failed'));
            assert.ok(canTransition('issued', 'cancelled'));
            assert.ok(!canTransition('pending', 'cancelled'));
            assert.ok(!canTransition('failed', 'issued'));    // لا إحياء
            assert.ok(!canTransition('cancelled', 'issued'));
            assert.ok(!canTransition('issued', 'pending'));
        });

        test('🧪 مزوّد المحاكاة حتمي: نفس البحث → نفس العروض والأسعار', async () => {
            const p = createMockTravelProvider();
            const q = { origin: 'RUH', destination: 'CAI', departDate: '2027-01-15', adults: 2, cabin: 'economy' };
            const a = await p.searchOffers(q);
            const b = await p.searchOffers(q);
            assert.equal(a.length, 3);
            assert.deepEqual(a.map(o => o.netAmount), b.map(o => o.netAmount));
            assert.equal(a[0].passengerCount, 2);
            // getOffer يعيد نفس العرض المخزَّن
            const again = await p.getOffer(a[1].id);
            assert.equal(again.netAmount, a[1].netAmount);
            assert.equal(await p.getOffer('لا-وجود'), null);
        });

        test('🔐 كل المسارات محمية بالتوكن', async () => {
            for (const [method, pathname] of [
                ['GET', '/api/travel/config'],
                ['POST', '/api/travel/flights/search'],
                ['GET', '/api/travel/bookings'],
                ['POST', '/api/travel/agent/chat'],
                ['POST', '/api/travel/stays/search'],
                ['POST', '/api/travel/stays/bookings'],
            ]) {
                assert.equal((await call(pathname, { method })).status, 401, pathname);
            }
            // health عام — مراقبة الحياة بلا توكن
            assert.equal((await call('/api/travel/health')).status, 200);
        });

        test('🔎 البحث: تحقق صارم من المعايير + الهامش مطبَّق والصافي لا يتسرب', async () => {
            const token = makeToken('searcher');
            for (const bad of [
                { ...SEARCH_BODY(), origin: 'RUHX' },              // IATA فاسد
                { ...SEARCH_BODY(), destination: 'C!' },
                { ...SEARCH_BODY(), origin: 'CAI' },               // مطابق للوجهة
                { ...SEARCH_BODY(), departDate: '2020-01-01' },    // ماضٍ
                { ...SEARCH_BODY(), departDate: futureDate(400) }, // أبعد من النافذة
                { ...SEARCH_BODY(), returnDate: futureDate(2) },   // عودة قبل ذهاب
                { ...SEARCH_BODY(), adults: 0 },
                { ...SEARCH_BODY(), adults: 15 },
                { ...SEARCH_BODY(), children: -1 },
                { ...SEARCH_BODY(), cabin: 'vip' },
            ]) {
                const r = await call('/api/travel/flights/search', { method: 'POST', token, body: bad });
                assert.equal(r.status, 400, JSON.stringify(bad));
            }

            const ok = await call('/api/travel/flights/search', { method: 'POST', token, body: SEARCH_BODY() });
            assert.equal(ok.status, 200);
            assert.equal(ok.data.offers.length, 3);
            // نفس البحث مباشرة على المزوّد: sell = net + 10% لأعلى، والصافي مخفي
            const rawOffers = await provider.searchOffers({ ...SEARCH_BODY(), returnDate: null, children: 0, cabin: 'economy' });
            for (const [i, offer] of ok.data.offers.entries()) {
                assert.equal(offer.sellAmount, applyMarkup(rawOffers[i].netAmount, MARKUP));
                assert.equal(offer.netAmount, undefined);      // 💰 لا تسريب للصافي
                assert.equal(offer.passengerIds, undefined);   // ولا لمعرّفات المزوّد
            }

            // تحديث عرض مفرد بنفس الضمانات
            const one = await call(`/api/travel/flights/offers/${rawOffers[0].id}`, { token });
            assert.equal(one.status, 200);
            assert.equal(one.data.offer.netAmount, undefined);
            assert.equal((await call('/api/travel/flights/offers/ghost', { token })).status, 404);
        });

        test('🎟️ الحجز الكامل: pending→issued بمرجع، وتحقق الركاب، وعزل الملكية', async () => {
            const token = makeToken('booker');
            const search = await call('/api/travel/flights/search', { method: 'POST', token, body: SEARCH_BODY() });
            const offerId = search.data.offers[0].id;

            // بيانات ركاب فاسدة → 400
            for (const badPax of [
                {},                                                        // لا ركاب
                { ...VALID_PAX, passengers: [...VALID_PAX.passengers, ...VALID_PAX.passengers] }, // عدد زائد
                { ...VALID_PAX, passengers: [{ ...VALID_PAX.passengers[0], title: 'dr' }] },
                { ...VALID_PAX, passengers: [{ ...VALID_PAX.passengers[0], givenName: 'أحمد' }] }, // غير لاتيني
                { ...VALID_PAX, passengers: [{ ...VALID_PAX.passengers[0], bornOn: futureDate(10) }] },
                { ...VALID_PAX, passengers: [{ ...VALID_PAX.passengers[0], gender: 'x' }] },
                { ...VALID_PAX, contact: { email: 'bad', phone: '+966500000000' } },
                { ...VALID_PAX, contact: { email: 'a@test.com', phone: '123' } },
            ]) {
                const r = await call('/api/travel/bookings', { method: 'POST', token, body: { offerId, ...badPax } });
                assert.equal(r.status, 400, JSON.stringify(badPax).slice(0, 80));
            }

            // عرض مجهول → 404
            assert.equal((await call('/api/travel/bookings', {
                method: 'POST', token, body: { offerId: 'ghost', ...VALID_PAX },
            })).status, 404);

            // حجز صحيح → issued بمرجع وسعر بيع
            const booked = await call('/api/travel/bookings', { method: 'POST', token, body: { offerId, ...VALID_PAX } });
            assert.equal(booked.status, 200);
            const b = booked.data.booking;
            assert.equal(b.status, 'issued');
            assert.match(b.bookingReference, /^JAO\d+/);
            assert.equal(b.sellAmount, search.data.offers[0].sellAmount);
            assert.equal(b.offer.netAmount, undefined); // الملخص المخزَّن بلا صافٍ

            // القائمة تعيده، والحجز الفردي كذلك
            const list = await call('/api/travel/bookings', { token });
            assert.equal(list.data.bookings.length, 1);
            assert.equal((await call(`/api/travel/bookings/${b.id}`, { token })).status, 200);

            // عزل صارم: مستخدم آخر لا يرى ولا يلغي (404 لا 403)
            const stranger = makeToken('stranger');
            assert.equal((await call(`/api/travel/bookings/${b.id}`, { token: stranger })).status, 404);
            assert.equal((await call(`/api/travel/bookings/${b.id}/cancel`, { method: 'POST', token: stranger })).status, 404);

            // الإلغاء: issued→cancelled باسترداد المزوّد (80% في المحاكاة)
            const cancelled = await call(`/api/travel/bookings/${b.id}/cancel`, { method: 'POST', token });
            assert.equal(cancelled.status, 200);
            assert.equal(cancelled.data.booking.status, 'cancelled');
            assert.ok(cancelled.data.booking.refund.amount > 0);
            // إلغاء مكرر → 400 (ليس issued بعد الآن)
            assert.equal((await call(`/api/travel/bookings/${b.id}/cancel`, { method: 'POST', token })).status, 400);
        });

        test('💥 فشل المزوّد وقت الإصدار: الحجز يتحول failed برسالة، والرد 502', async () => {
            const failingProvider = createMockTravelProvider({ failCreate: true });
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider: failingProvider, markupPct: MARKUP });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('unlucky');
                const search = await fetch(url + '/api/travel/flights/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(SEARCH_BODY()),
                }).then(r => r.json());
                const res = await fetch(url + '/api/travel/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ offerId: search.offers[0].id, ...VALID_PAX }),
                });
                assert.equal(res.status, 502);
                // الحجز الفاشل مسجَّل بحالة failed — لا حجوزات معلقة يتيمة
                const list = await fetch(url + '/api/travel/bookings', {
                    headers: { Authorization: `Bearer ${token}` },
                }).then(r => r.json());
                assert.equal(list.bookings.length, 1);
                assert.equal(list.bookings[0].status, 'failed');
                assert.ok(list.bookings[0].error);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('🏨ℹ️ GET /api/travel/stays/hotels/:id: تفاصيل حقيقية، و501 لمزوّد لا يدعمها', async () => {
            const token = makeToken('hotel-details-user');
            // مزوّد المحاكاة يدعمها (تعادل العقد)
            const ok = await call('/api/travel/stays/hotels/mock_hotel_1', { token });
            assert.equal(ok.status, 200);
            assert.ok(ok.data.hotel.name);
            assert.ok(Array.isArray(ok.data.hotel.facilities));
            assert.equal(ok.data.hotel.sellAmount, undefined); // بلا أسعار

            assert.equal((await call('/api/travel/stays/hotels/x')).status, 401); // محمي بالتوكن

            // مزوّد بلا القدرة (كـDuffel Stays) → 501 صريح لا تعطّل
            const bare = { name: 'no-details', mode: 'mock', async searchStays() { return []; } };
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider, staysProvider: bare, markupPct: MARKUP });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            try {
                const res = await fetch(`http://127.0.0.1:${s.address().port}/api/travel/stays/hotels/abc`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(res.status, 501);
                assert.match((await res.json()).error, /غير مدعومة/);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('↕️ الترتيب أرخص/أسرع: يُطبَّق قبل الاقتطاع لا بعده', async () => {
            // 💡 جوهر الاختبار: لو رُتّب بعد الاقتطاع لأعطى "أسرع العشرة
            // الأرخص" لا الأسرع فعلاً. هنا أسرع رحلة هي الأغلى عمداً،
            // فلا تظهر أولاً إلا إذا كان الترتيب قبل الاقتطاع فعلياً.
            const many = Array.from({ length: 25 }, (_, i) => ({
                netAmount: 100 + i,                       // الأرخص أولاً = i=0
                totalDurationMin: 600 - i * 10,           // الأسرع = i=24 (الأغلى)
                id: 'off_' + i,
            }));
            const byPrice = sortOffers(many, 'price');
            assert.equal(byPrice[0].id, 'off_0');
            const byDuration = sortOffers(many, 'duration');
            assert.equal(byDuration[0].id, 'off_24');     // الأسرع رغم أنه الأغلى
            assert.equal(byDuration[0].totalDurationMin, 360);

            // مدة مجهولة → آخر القائمة لا أولها (لا تتصدّر بقيمة صفرية مضلّلة)
            const withUnknown = sortOffers(
                [{ id: 'a', netAmount: 50, totalDurationMin: null }, { id: 'b', netAmount: 90, totalDurationMin: 120 }],
                'duration');
            assert.equal(withUnknown[0].id, 'b');
            // تعادل المدة → الأرخص أولاً
            const tie = sortOffers(
                [{ id: 'x', netAmount: 90, totalDurationMin: 120 }, { id: 'y', netAmount: 50, totalDurationMin: 120 }],
                'duration');
            assert.equal(tie[0].id, 'y');

            assert.equal(totalDurationMin([{ durationMin: 100 }, { durationMin: 50 }]), 150); // ذهاب+عودة
            assert.equal(totalDurationMin([]), null);

            // المسار كاملاً: ترتيب فاسد يُرفض، والصحيح يمرّ للمزوّد
            const token = makeToken('sorter');
            assert.equal((await call('/api/travel/flights/search', {
                method: 'POST', token, body: { ...SEARCH_BODY(), sort: 'nonsense' },
            })).status, 400);
            const ok = await call('/api/travel/flights/search', {
                method: 'POST', token, body: { ...SEARCH_BODY(), sort: 'duration' },
            });
            assert.equal(ok.status, 200);
            const durations = ok.data.offers.map(o => o.totalDurationMin ?? Infinity);
            assert.deepEqual(durations, durations.slice().sort((a, b) => a - b), 'النتائج غير مرتَّبة بالأسرع');
        });

        test('📞 الهاتف E.164 إلزامي: رقم محلي يُرفض عندنا قبل أن يرفضه Duffel', () => {
            // عُطل حي حقيقي: 05xxxxxxxx كان يمرّ ثم يرفضه Duffel بـ422
            // **بعد** إنشاء حجز يتحول failed. الآن يُرفض بتحققنا بلا أي أثر.
            for (const bad of ['0500000000', '966500000000', '+0500000000', '', '+123', 'abc']) {
                const flight = validatePassengers({ ...VALID_PAX, contact: { email: 'a@test.com', phone: bad } }, 1);
                assert.ok(flight.error, `طيران قَبِل رقماً فاسداً: ${bad}`);
                assert.match(flight.error, /بصيغة دولية/);
                // نفس الصرامة للفنادق والسيارات — لا مسار يتسرب منه رقم فاسد
                assert.ok(validateGuests({ ...VALID_GUESTS, contact: { email: 'a@test.com', phone: bad } }).error, `فنادق قَبِلت: ${bad}`);
                assert.ok(validateDrivers({ ...VALID_DRIVERS, contact: { email: 'a@test.com', phone: bad } }).error, `سيارات قَبِلت: ${bad}`);
            }

            // صيغ صحيحة تمرّ، مع تطبيع 00 → + والفواصل الشكلية
            const cases = [
                ['+966501234567', '+966501234567'],
                ['00966501234567', '+966501234567'],   // بادئة الاتصال الدولي
                ['+966 50 123 4567', '+966501234567'], // مسافات
                ['+966-50-123-4567', '+966501234567'], // شرطات
            ];
            for (const [input, expected] of cases) {
                const res = validatePassengers({ ...VALID_PAX, contact: { email: 'a@test.com', phone: input } }, 1);
                assert.ok(!res.error, `رُفض رقم صحيح ${input}: ${res.error}`);
                assert.equal(res.values.contact.phone, expected);
            }
        });

        test('💥 فشل المزوّد وقت البحث: 502 بتفصيل الرسالة الفعلية لا 500 مبهم', async () => {
            // نفس عطل حقيقي واجهه المالك: Duffel/LiteAPI يرفض بحث الفنادق
            // فيسقط كخطأ 500 عام يخفي السبب — تحقق الإصلاح لثلاثة أنواع البحث.
            const rejectingProvider = { ...provider, async searchOffers() { throw new Error('Duffel HTTP 403: تفصيل رفض حقيقي'); } };
            const rejectingStays = { name: 'x', mode: 'sandbox', async searchStays() { throw new Error('تفصيل رفض فنادق'); } };
            const rejectingCars = { name: 'y', mode: 'sandbox', async searchCars() { throw new Error('تفصيل رفض سيارات'); } };
            const app = createApp({
                store, jwtSecret: JWT_SECRET, provider: rejectingProvider,
                staysProvider: rejectingStays, carsProvider: rejectingCars, markupPct: MARKUP,
            });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('search-fail-tester');
                const call = (path, body) => fetch(url + path, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(body),
                });

                const flightRes = await call('/api/travel/flights/search', SEARCH_BODY());
                assert.equal(flightRes.status, 502);
                assert.match((await flightRes.json()).error, /تفصيل رفض حقيقي/);

                const stayRes = await call('/api/travel/stays/search', STAY_SEARCH_BODY());
                assert.equal(stayRes.status, 502);
                assert.match((await stayRes.json()).error, /تفصيل رفض فنادق/);

                const carRes = await call('/api/travel/cars/search', CAR_SEARCH_BODY());
                assert.equal(carRes.status, 502);
                assert.match((await carRes.json()).error, /تفصيل رفض سيارات/);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('📧 بريد تأكيد/إلغاء الحجز: يُرسَل بالمحتوى الصحيح عند تفعيل mailer', async () => {
            const sentMails = [];
            const stubMailer = {
                mailReady: () => true,
                sendMail: async (msg) => { sentMails.push(msg); return { ok: true }; },
            };
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider, markupPct: MARKUP, mailer: stubMailer });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('mail-flyer');
                const search = await fetch(url + '/api/travel/flights/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(SEARCH_BODY()),
                }).then(r => r.json());
                const bookRes = await fetch(url + '/api/travel/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ offerId: search.offers[0].id, ...VALID_PAX }),
                }).then(r => r.json());

                assert.equal(sentMails.length, 1);
                assert.equal(sentMails[0].to, VALID_PAX.contact.email);
                assert.match(sentMails[0].subject, new RegExp(bookRes.booking.bookingReference));
                assert.match(sentMails[0].text, new RegExp(String(bookRes.booking.sellAmount)));

                await fetch(url + `/api/travel/bookings/${bookRes.booking.id}/cancel`, {
                    method: 'POST', headers: { Authorization: `Bearer ${token}` },
                });
                assert.equal(sentMails.length, 2);
                assert.equal(sentMails[1].to, VALID_PAX.contact.email);
                assert.match(sentMails[1].subject, /إلغاء/);
                assert.match(sentMails[1].text, /استرداد/);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('📧 فشل مزوّد البريد لا يكسر الحجز — الاستجابة تبقى 200 بلا محاولة ثانية', async () => {
            const stubMailer = { mailReady: () => true, sendMail: async () => ({ error: 'فشل الإرسال (429).' }) };
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider, markupPct: MARKUP, mailer: stubMailer });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('mail-unlucky');
                const search = await fetch(url + '/api/travel/flights/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(SEARCH_BODY()),
                }).then(r => r.json());
                const res = await fetch(url + '/api/travel/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ offerId: search.offers[0].id, ...VALID_PAX }),
                });
                assert.equal(res.status, 200); // sendMail لا يرمي أبداً — {error} لا يُسقط الحجز
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('📧 بلا RESEND_API_KEY (mailReady=false): لا محاولة إرسال إطلاقاً', async () => {
            const stubMailer = { mailReady: () => false, sendMail: async () => { throw new Error('لا يجب أن يُستدعى'); } };
            const app = createApp({ store, jwtSecret: JWT_SECRET, staysProvider, markupPct: MARKUP, mailer: stubMailer });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const token = makeToken('mail-quiet-guest');
                const search = await fetch(url + '/api/travel/stays/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(STAY_SEARCH_BODY()),
                }).then(r => r.json());
                const res = await fetch(url + '/api/travel/stays/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ offerId: search.offers[0].id, ...VALID_GUESTS }),
                });
                assert.equal(res.status, 200); // sendMail المُزيَّف كان سيرمي لو استُدعي
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('🔔 verifyDuffelWebhookSignature: توقيع صحيح يمرّ، وأي تلاعب يُرفض', () => {
            const secret = 'whsec_test_123';
            const rawBody = JSON.stringify({ type: 'order.airline_initiated_change_detected', data: { object: { id: 'ord_1' } } });
            const t = '1616202842';
            const signedPayload = Buffer.concat([Buffer.from(`${t}.`, 'utf8'), Buffer.from(rawBody, 'utf8')]);
            const v1 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
            const header = `t=${t},v1=${v1}`;

            assert.equal(verifyDuffelWebhookSignature(Buffer.from(rawBody), header, secret), true);
            assert.equal(verifyDuffelWebhookSignature(Buffer.from(rawBody + 'x'), header, secret), false); // جسم مُتلاعَب به
            assert.equal(verifyDuffelWebhookSignature(Buffer.from(rawBody), header, 'wrong_secret'), false);
            assert.equal(verifyDuffelWebhookSignature(Buffer.from(rawBody), null, secret), false);
            assert.equal(verifyDuffelWebhookSignature(Buffer.from(rawBody), 't=1616202842,v1=', secret), false);
            assert.equal(verifyDuffelWebhookSignature(Buffer.from(rawBody), 'garbage', secret), false);
        });

        test('🔔 POST /api/travel/webhooks/duffel: تحقق توقيع + إشعار تغيير طيران حقيقي', async () => {
            const secret = 'whsec_test_456';
            const sign = (rawBody, t = String(Math.floor(Date.now() / 1000))) => {
                const signedPayload = Buffer.concat([Buffer.from(`${t}.`, 'utf8'), Buffer.from(rawBody, 'utf8')]);
                const v1 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
                return `t=${t},v1=${v1}`;
            };
            const sentMails = [];
            const stubMailer = { mailReady: () => true, sendMail: async (msg) => { sentMails.push(msg); return { ok: true }; } };
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider, markupPct: MARKUP, mailer: stubMailer, duffelWebhookSecret: secret });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                // حجز حقيقي مُصدَر بـproviderOrderId معروف — نفس ما يخزّنه doBook فعلياً
                const flightBooking = await createBooking(store, {
                    username: 'webhook-traveler', provider: 'mock',
                    offer: { owner: 'Test Air', slices: [{ origin: 'RUH', destination: 'DXB', departAt: '2027-09-01T10:00:00', arriveAt: '2027-09-01T12:00:00' }] },
                    passengers: [], contact: { email: 'traveler@test.com', phone: '+966500000001' },
                    netAmount: 100, sellAmount: 110, currency: 'USD',
                });
                await transitionBooking(store, flightBooking.id, 'issued', { providerOrderId: 'ord_webhook_1', bookingReference: 'REFWH1' });

                // توقيع فاسد → 400، بلا محاولة إرسال
                const badBody = JSON.stringify({ type: 'order.airline_initiated_change_detected', data: { object: { id: 'ord_webhook_1' } } });
                const badRes = await fetch(url + '/api/travel/webhooks/duffel', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Duffel-Signature': 'garbage' }, body: badBody,
                });
                assert.equal(badRes.status, 400);
                assert.equal(sentMails.length, 0);

                // توقيع صحيح + حدث تغيير طيران بمعرّف حجزنا → 200 + بريد فعلي
                const goodBody = JSON.stringify({ type: 'order.airline_initiated_change_detected', data: { object: { id: 'ord_webhook_1' } } });
                const goodRes = await fetch(url + '/api/travel/webhooks/duffel', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Duffel-Signature': sign(goodBody) }, body: goodBody,
                });
                assert.equal(goodRes.status, 200);
                assert.equal(sentMails.length, 1);
                assert.equal(sentMails[0].to, 'traveler@test.com');
                assert.match(sentMails[0].subject, /REFWH1/);

                // نوع حدث غير معنيّين به → 200 بلا أي محاولة إرسال إضافية
                const otherBody = JSON.stringify({ type: 'order.created', data: { object: { id: 'ord_webhook_1' } } });
                const otherRes = await fetch(url + '/api/travel/webhooks/duffel', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Duffel-Signature': sign(otherBody) }, body: otherBody,
                });
                assert.equal(otherRes.status, 200);
                assert.equal(sentMails.length, 1); // لم يزد
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('🔔 POST /api/travel/webhooks/duffel: بلا DUFFEL_WEBHOOK_SECRET → 503 صريح', async () => {
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider, markupPct: MARKUP });
            const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
            const url = `http://127.0.0.1:${s.address().port}`;
            try {
                const res = await fetch(url + '/api/travel/webhooks/duffel', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
                });
                assert.equal(res.status, 503);
            } finally {
                await new Promise(r => s.close(r));
            }
        });

        test('⚛️ transitionBooking ذرّي: انتقال من حالة خاطئة يُرفض بلا أثر', async () => {
            const booking = await createBooking(store, {
                username: 'atomic', provider: 'mock',
                offer: { owner: 'x', slices: [] }, passengers: [], contact: {},
                netAmount: 100, sellAmount: 110, currency: 'USD',
            });
            assert.equal(booking.status, 'pending');
            assert.equal(await transitionBooking(store, booking.id, 'cancelled'), null); // pending→cancelled ممنوع
            const issued = await transitionBooking(store, booking.id, 'issued', { bookingReference: 'REF1' });
            assert.equal(issued.status, 'issued');
            assert.equal(await transitionBooking(store, 'ghost', 'issued'), null);
            const final = await getBooking(store, booking.id);
            assert.equal(final.bookingReference, 'REF1');

            assert.equal(await getBookingByProviderOrderId(store, 'لا-وجود'), null);
        });

        test('🔎 getBookingByProviderOrderId: يجد الحجز بمعرّف المزوّد (أساس بحث webhook)', async () => {
            const booking = await createBooking(store, {
                username: 'provider-lookup', provider: 'mock',
                offer: { owner: 'x', slices: [] }, passengers: [], contact: {},
                netAmount: 50, sellAmount: 55, currency: 'USD',
            });
            await transitionBooking(store, booking.id, 'issued', { providerOrderId: 'ord_lookup_1', bookingReference: 'REFLK1' });
            const found = await getBookingByProviderOrderId(store, 'ord_lookup_1');
            assert.equal(found.id, booking.id);
            assert.equal(found.bookingReference, 'REFLK1');
        });

        test('✈️ تطبيع عرض Duffel: الشكل الخام الموثَّق → العرض الموحّد', () => {
            const raw = {
                id: 'off_123', total_amount: '250.50', total_currency: 'USD',
                cabin_class: 'economy', expires_at: '2027-01-01T00:00:00Z',
                owner: { name: 'Test Air' },
                passengers: [{ id: 'pas_1' }, { id: 'pas_2' }],
                slices: [{
                    segments: [{
                        origin: { iata_code: 'RUH' }, destination: { iata_code: 'CAI' },
                        departing_at: '2027-01-15T08:00:00', arriving_at: '2027-01-15T10:30:00',
                        marketing_carrier: { name: 'Test Air', iata_code: 'TA' },
                        marketing_carrier_flight_number: '101',
                    }],
                }],
            };
            const offer = normalizeDuffelOffer(raw, ['pas_1', 'pas_2']);
            assert.equal(offer.netAmount, 250.5);
            assert.equal(offer.passengerCount, 2);
            assert.equal(offer.slices[0].origin, 'RUH');
            assert.equal(offer.slices[0].durationMin, 150);
            assert.equal(offer.slices[0].stops, 0);
            assert.equal(offer.slices[0].segments[0].flightNumber, 'TA101');
            assert.deepEqual(offer.passengerIds, ['pas_1', 'pas_2']);
            assert.equal(offer.slices[0].segments[0].baggage, null); // بلا حقل خام → null لا اختلاق
        });

        test('🧳 إثراء الأمتعة: يُستخرج إن وُجد، وnull بأمان إن غاب', () => {
            const withBaggage = normalizeDuffelOffer({
                id: 'off_1', total_amount: '100', total_currency: 'USD',
                slices: [{
                    segments: [{
                        origin: { iata_code: 'RUH' }, destination: { iata_code: 'CAI' },
                        departing_at: '2027-01-15T08:00:00', arriving_at: '2027-01-15T10:00:00',
                        passengers: [{ baggages: [{ type: 'checked', quantity: 1 }, { type: 'carry_on', quantity: 1 }] }],
                    }],
                }],
            }, ['pas_1']);
            assert.deepEqual(withBaggage.slices[0].segments[0].baggage, [
                { type: 'checked', quantity: 1 }, { type: 'carry_on', quantity: 1 },
            ]);
        });

        test('🔌 اختيار المزوّد: مفتاح Duffel → duffel (وsandbox لمفتاح اختباري)، وبلا مفتاح → محاكاة', () => {
            assert.equal(buildProvider({}).name, 'mock');
            const d = buildProvider({ DUFFEL_API_KEY: 'duffel_test_abc' });
            assert.equal(d.name, 'duffel');
            assert.equal(d.mode, 'sandbox');
            assert.equal(buildProvider({ DUFFEL_API_KEY: 'duffel_live_x' }).mode, 'live');
            assert.throws(() => createDuffelProvider({}));

            assert.equal(buildStaysProvider({}).name, 'mock-stays');
            const ds = buildStaysProvider({ DUFFEL_API_KEY: 'duffel_test_abc' });
            assert.equal(ds.name, 'duffel-stays');
            assert.equal(ds.mode, 'sandbox');
            // LITEAPI_API_KEY له الأولوية على DUFFEL_API_KEY (Stays معطَّل حالياً على Duffel)
            const ls = buildStaysProvider({ LITEAPI_API_KEY: 'sand_abc', DUFFEL_API_KEY: 'duffel_test_abc' });
            assert.equal(ls.name, 'liteapi-stays');
            assert.equal(ls.mode, 'sandbox');

            assert.equal(buildCarsProvider({}).name, 'mock-cars');
            const dc = buildCarsProvider({ DUFFEL_API_KEY: 'duffel_test_abc' });
            assert.equal(dc.name, 'duffel-cars');
            assert.equal(dc.mode, 'sandbox');
        });

        test('🏨 بحث الفنادق: تحقق صارم من المعايير + الهامش مطبَّق والصافي لا يتسرب', async () => {
            const token = makeToken('stay-searcher');
            for (const bad of [
                { ...STAY_SEARCH_BODY(), iata: 'RUHX' },                    // IATA فاسد
                { ...STAY_SEARCH_BODY(), iata: 'ZZZ' },                     // غير مغطّى
                { ...STAY_SEARCH_BODY(), checkInDate: '2020-01-01' },       // ماضٍ
                { ...STAY_SEARCH_BODY(), checkOutDate: futureDate(10) },    // مغادرة قبل وصول
                { ...STAY_SEARCH_BODY(), checkOutDate: futureDate(50) },    // أطول من الحد
                { ...STAY_SEARCH_BODY(), adults: 0 },
                { ...STAY_SEARCH_BODY(), rooms: 0 },
                { ...STAY_SEARCH_BODY(), rooms: 10 },
            ]) {
                const r = await call('/api/travel/stays/search', { method: 'POST', token, body: bad });
                assert.equal(r.status, 400, JSON.stringify(bad));
            }

            const ok = await call('/api/travel/stays/search', { method: 'POST', token, body: STAY_SEARCH_BODY() });
            assert.equal(ok.status, 200);
            assert.equal(ok.data.offers.length, 4);
            const rawOffers = await staysProvider.searchStays(STAY_SEARCH_BODY());
            for (const [i, offer] of ok.data.offers.entries()) {
                assert.equal(offer.sellAmount, applyMarkup(rawOffers[i].netAmount, MARKUP));
                assert.equal(offer.netAmount, undefined); // 💰 لا تسريب للصافي
            }

            const one = await call(`/api/travel/stays/offers/${rawOffers[0].id}`, { token });
            assert.equal(one.status, 200);
            assert.equal(one.data.offer.netAmount, undefined);
            assert.equal((await call('/api/travel/stays/offers/ghost', { token })).status, 404);
        });

        test('🏨🎫 حجز فندق كامل: pending→issued بمرجع، وحجوزاتي موحّدة طيران+فنادق، وعزل الملكية', async () => {
            const token = makeToken('stay-booker');
            const search = await call('/api/travel/stays/search', { method: 'POST', token, body: STAY_SEARCH_BODY() });
            const offerId = search.data.offers[0].id;

            for (const badGuests of [
                {},
                { ...VALID_GUESTS, guests: [{ ...VALID_GUESTS.guests[0], givenName: 'أحمد' }] }, // غير لاتيني
                { ...VALID_GUESTS, contact: { email: 'bad', phone: '+966500000000' } },
            ]) {
                const r = await call('/api/travel/stays/bookings', { method: 'POST', token, body: { offerId, ...badGuests } });
                assert.equal(r.status, 400, JSON.stringify(badGuests).slice(0, 80));
            }

            assert.equal((await call('/api/travel/stays/bookings', {
                method: 'POST', token, body: { offerId: 'ghost', ...VALID_GUESTS },
            })).status, 404);

            const booked = await call('/api/travel/stays/bookings', { method: 'POST', token, body: { offerId, ...VALID_GUESTS } });
            assert.equal(booked.status, 200);
            const b = booked.data.booking;
            assert.equal(b.status, 'issued');
            assert.equal(b.kind, 'stay');
            assert.match(b.bookingReference, /^JAH\d+/);

            // القائمة الموحّدة تعيد الفندق (kind: stay) — بلا أداة عرض إضافية
            const list = await call('/api/travel/bookings', { token });
            assert.equal(list.data.bookings.length, 1);
            assert.equal(list.data.bookings[0].kind, 'stay');

            // عزل صارم + عزل بين الأنواع: مسار إلغاء الطيران لا يلغي حجز فندق
            const stranger = makeToken('stay-stranger');
            assert.equal((await call(`/api/travel/stays/bookings/${b.id}/cancel`, { method: 'POST', token: stranger })).status, 404);
            assert.equal((await call(`/api/travel/bookings/${b.id}/cancel`, { method: 'POST', token })).status, 404);

            const cancelled = await call(`/api/travel/stays/bookings/${b.id}/cancel`, { method: 'POST', token });
            assert.equal(cancelled.status, 200);
            assert.equal(cancelled.data.booking.status, 'cancelled');
            assert.ok(cancelled.data.booking.refund.amount > 0);
            assert.equal((await call(`/api/travel/stays/bookings/${b.id}/cancel`, { method: 'POST', token })).status, 400);
        });

        test('✈️🏨 تطبيع نتيجة Duffel Stays: الشكل الخام الموثَّق → العرض الموحّد', () => {
            const raw = {
                cheapest_rate: { id: 'rat_123', total_amount: '340.00', total_currency: 'USD', refundable_until: '2027-01-10' },
                accommodation: {
                    id: 'acc_1', name: 'Test Hotel', rating: 4,
                    location: { address: { city_name: 'Riyadh', country_code: 'SA' } },
                },
            };
            const offer = normalizeDuffelStayResult(raw);
            assert.equal(offer.id, 'rat_123');
            assert.equal(offer.netAmount, 340);
            assert.equal(offer.name, 'Test Hotel');
            assert.equal(offer.city, 'Riyadh');
            assert.equal(offer.cancellable, true);
        });

        test('🚗 بحث السيارات: تحقق صارم من المعايير + الهامش مطبَّق والصافي لا يتسرب', async () => {
            const token = makeToken('car-searcher');
            for (const bad of [
                { ...CAR_SEARCH_BODY(), iata: 'RUHX' },                     // IATA فاسد
                { ...CAR_SEARCH_BODY(), iata: 'ZZZ' },                      // غير مغطّى
                { ...CAR_SEARCH_BODY(), pickupDate: '2020-01-01' },         // ماضٍ
                { ...CAR_SEARCH_BODY(), pickupTime: '25:00' },              // وقت فاسد
                { ...CAR_SEARCH_BODY(), dropoffDate: futureDate(10) },      // تسليم قبل استلام
                { ...CAR_SEARCH_BODY(), dropoffDate: futureDate(50) },      // أطول من الحد
            ]) {
                const r = await call('/api/travel/cars/search', { method: 'POST', token, body: bad });
                assert.equal(r.status, 400, JSON.stringify(bad));
            }

            const ok = await call('/api/travel/cars/search', { method: 'POST', token, body: CAR_SEARCH_BODY() });
            assert.equal(ok.status, 200);
            assert.equal(ok.data.offers.length, 4);
            const validated = validateCarSearchParams(CAR_SEARCH_BODY());
            const rawOffers = await carsProvider.searchCars(validated.values);
            for (const [i, offer] of ok.data.offers.entries()) {
                assert.equal(offer.sellAmount, applyMarkup(rawOffers[i].netAmount, MARKUP));
                assert.equal(offer.netAmount, undefined); // 💰 لا تسريب للصافي
            }

            const one = await call(`/api/travel/cars/offers/${rawOffers[0].id}`, { token });
            assert.equal(one.status, 200);
            assert.equal(one.data.offer.netAmount, undefined);
            assert.equal((await call('/api/travel/cars/offers/ghost', { token })).status, 404);
        });

        test('🚗🎫 حجز سيارة كامل: pending→issued بمرجع، وحجوزاتي موحّدة، وعزل الملكية', async () => {
            const token = makeToken('car-booker');
            const search = await call('/api/travel/cars/search', { method: 'POST', token, body: CAR_SEARCH_BODY() });
            const offerId = search.data.offers[0].id;

            for (const badDrivers of [
                {},
                { ...VALID_DRIVERS, drivers: [{ ...VALID_DRIVERS.drivers[0], givenName: 'أحمد' }] }, // غير لاتيني
                { ...VALID_DRIVERS, contact: { email: 'bad', phone: '+966500000000' } },
            ]) {
                const r = await call('/api/travel/cars/bookings', { method: 'POST', token, body: { offerId, ...badDrivers } });
                assert.equal(r.status, 400, JSON.stringify(badDrivers).slice(0, 80));
            }

            assert.equal((await call('/api/travel/cars/bookings', {
                method: 'POST', token, body: { offerId: 'ghost', ...VALID_DRIVERS },
            })).status, 404);

            const booked = await call('/api/travel/cars/bookings', { method: 'POST', token, body: { offerId, ...VALID_DRIVERS } });
            assert.equal(booked.status, 200);
            const b = booked.data.booking;
            assert.equal(b.status, 'issued');
            assert.equal(b.kind, 'car');
            assert.match(b.bookingReference, /^JAC\d+/);

            const list = await call('/api/travel/bookings', { token });
            assert.equal(list.data.bookings.length, 1);
            assert.equal(list.data.bookings[0].kind, 'car');

            const stranger = makeToken('car-stranger');
            assert.equal((await call(`/api/travel/cars/bookings/${b.id}/cancel`, { method: 'POST', token: stranger })).status, 404);
            assert.equal((await call(`/api/travel/bookings/${b.id}/cancel`, { method: 'POST', token })).status, 404);

            const cancelled = await call(`/api/travel/cars/bookings/${b.id}/cancel`, { method: 'POST', token });
            assert.equal(cancelled.status, 200);
            assert.equal(cancelled.data.booking.status, 'cancelled');
            assert.ok(cancelled.data.booking.refund.amount > 0);
            assert.equal((await call(`/api/travel/cars/bookings/${b.id}/cancel`, { method: 'POST', token })).status, 400);
        });

        test('✈️🚗 تطبيع نتيجة Duffel Cars: الشكل المُستنتَج → العرض الموحّد', () => {
            const raw = {
                cheapest_rate: { id: 'rat_car_1', total_amount: '120.00', total_currency: 'USD', refundable_until: '2027-01-10' },
                vehicle: { name: 'Toyota Corolla', acriss_code: 'CDMR' },
                supplier: { name: 'Avis' },
                pickup: { location: { address: { city_name: 'Riyadh' } } },
            };
            const offer = normalizeDuffelCarResult(raw);
            assert.equal(offer.id, 'rat_car_1');
            assert.equal(offer.netAmount, 120);
            assert.equal(offer.vehicleName, 'Toyota Corolla');
            assert.equal(offer.supplier, 'Avis');
            assert.equal(offer.pickupLocation, 'Riyadh');
            assert.equal(offer.cancellable, true);
        });
    });
}

// ─── 🤖 اختبارات الايجنت (مستقلة عن المخزن — نموذج مُسجَّل) ────────────
describe('الايجنت الحاجز', () => {
    let store, provider;

    /**
     * ينشئ تطبيقاً+خادماً محلياً لجولة اختبار واحدة ويُغلقه دوماً بعد
     * انتهاء fn (حتى عند رمي استثناء) — خادم متروك مفتوحاً بلا إغلاق
     * يُبقي عملية node --test حيّة إلى الأبد (عُطل حقيقي صودف أثناء
     * التطوير: عدة اختبارات تُعيد تعيين متغيّر server مشترك فتُغرق كل
     * الخوادم السابقة ما عدا الأخير).
     */
    async function withAgentApp(agent, fn, extra = {}) {
        const app = createApp({ store, jwtSecret: JWT_SECRET, provider, agent, markupPct: MARKUP, ...extra });
        const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
        const baseUrl = `http://127.0.0.1:${s.address().port}`;
        async function call(pathname, { method = 'GET', token = null, body = null } = {}) {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch(baseUrl + pathname, {
                method, headers, body: body ? JSON.stringify(body) : undefined,
            });
            return { status: res.status, data: await res.json().catch(() => null) };
        }
        try {
            await fn(call);
        } finally {
            await new Promise(r => s.close(r));
        }
    }

    /** نموذج مُسجَّل: يرد بالسيناريو المكتوب رداً تلو رد. */
    function scriptedFetch(script) {
        let i = 0;
        return async () => {
            const message = script[Math.min(i, script.length - 1)];
            i += 1;
            return {
                ok: true,
                json: async () => ({ choices: [{ message }] }),
            };
        };
    }

    before(async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-travel-agent-'));
        store = createFileStore({ dataDir: dir });
        await store.init();
        provider = createMockTravelProvider();
    });

    test('بلا مفتاح: buildTravelAgent يرجع null والمسار يرد 503 بوضوح', async () => {
        assert.equal(buildTravelAgent({}), null);
        await withAgentApp(null, async call => {
            const res = await call('/api/travel/agent/chat', {
                method: 'POST', token: makeToken('u'), body: { messages: [{ role: 'user', content: 'مرحبا' }] },
            });
            assert.equal(res.status, 503);
        });
    });

    test('حلقة الأدوات: بحث → رد نهائي، مع سجل actions شفاف', async () => {
        const agent = createTravelAgent({
            apiKey: 'k',
            fetchImpl: scriptedFetch([
                {
                    role: 'assistant', content: null,
                    tool_calls: [{
                        id: 'c1', type: 'function',
                        function: { name: 'search_flights', arguments: JSON.stringify(SEARCH_BODY()) },
                    }],
                },
                { role: 'assistant', content: 'وجدت 3 رحلات، أرخصها…' },
            ]),
        });
        await withAgentApp(agent, async call => {
            const token = makeToken('chatter');

            // تحقق مدخلات المحادثة أولاً
            assert.equal((await call('/api/travel/agent/chat', { method: 'POST', token, body: {} })).status, 400);
            assert.equal((await call('/api/travel/agent/chat', {
                method: 'POST', token, body: { messages: [{ role: 'user', content: '' }] },
            })).status, 400);

            const res = await call('/api/travel/agent/chat', {
                method: 'POST', token, body: { messages: [{ role: 'user', content: 'ابحث لي عن رحلة' }] },
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.reply, 'وجدت 3 رحلات، أرخصها…');
            assert.equal(res.data.actions.length, 1);
            assert.equal(res.data.actions[0].tool, 'search_flights');
            assert.match(res.data.actions[0].summary, /RUH→CAI/);
        });
    });

    test('🛡️ حارس الحجز: confirmed=false يُرفض بلا حجز، وconfirmed=true يحجز فعلاً', async () => {
        const username = 'agent-booker';
        const offers = await provider.searchOffers({ ...SEARCH_BODY(), returnDate: null, children: 0, cabin: 'economy' });
        const services = {
            searchFlights: async () => [],
            getOffer: async () => null,
            listBookings: async () => store.listBookingsByUser(username),
            bookFlight: async (args) => {
                // نفس مسار doBook منطقياً — هنا نتحقق فقط أن المنفّذ وصل
                const booking = await createBooking(store, {
                    username, provider: 'mock',
                    offer: { owner: 'x', slices: [] },
                    passengers: args.passengers, contact: args.contact,
                    netAmount: 100, sellAmount: 110, currency: 'USD',
                });
                return { ...booking, bookingReference: 'JAO9999', status: 'issued', sellAmount: 110, currency: 'USD' };
            },
            cancelBooking: async () => ({ status: 'cancelled' }),
        };
        const bookArgs = { offerId: offers[0].id, ...VALID_PAX };

        // بلا تأكيد → رسالة تعليمية ولا حجز
        const refused = await executeAgentTool('book_flight', { ...bookArgs, confirmed: false }, services);
        assert.equal(refused.ok, false);
        assert.match(refused.data.error, /موافقة المستخدم الصريحة/);
        assert.equal((await store.listBookingsByUser(username)).length, 0);

        // بتأكيد صريح → حجز فعلي
        const done = await executeAgentTool('book_flight', { ...bookArgs, confirmed: true }, services);
        assert.equal(done.ok, true);
        assert.equal(done.data.bookingReference, 'JAO9999');
        assert.equal((await store.listBookingsByUser(username)).length, 1);

        // نفس الحارس للإلغاء
        const cancelRefused = await executeAgentTool('cancel_booking', { bookingId: 'b1', confirmed: false }, services);
        assert.equal(cancelRefused.ok, false);
        // أداة مجهولة → رسالة لا استثناء
        const unknown = await executeAgentTool('teleport', {}, services);
        assert.equal(unknown.ok, false);

        // تعريفات الأدوات سليمة البنية (أسماء فريدة + مخططات)
        const names = AGENT_TOOLS.map(t => t.function.name);
        assert.equal(new Set(names).size, names.length);
        for (const t of AGENT_TOOLS) assert.ok(t.function.parameters);
    });

    test('🏨 حارس حجز الفندق: بلا خدمة → رسالة تعليمية، وconfirmed=true يحجز فعلاً', async () => {
        const username = 'agent-stay-booker';
        const bookArgs = { offerId: 'off_x', ...VALID_GUESTS };

        // الخدمة غير محقونة (حجز فنادق معطَّل على هذا الخادم) → رسالة لا استثناء
        const disabled = await executeAgentTool('book_stay', { ...bookArgs, confirmed: true }, {});
        assert.equal(disabled.ok, false);
        assert.match(disabled.data.error, /غير مفعَّل/);

        const services = {
            bookStay: async (args) => {
                const booking = await createBooking(store, {
                    username, provider: 'mock-stays', kind: 'stay',
                    offer: { name: 'x' },
                    passengers: args.guests, contact: args.contact,
                    netAmount: 200, sellAmount: 220, currency: 'USD',
                });
                return { ...booking, bookingReference: 'JAH9999', status: 'issued', sellAmount: 220, currency: 'USD' };
            },
            cancelStay: async () => ({ status: 'cancelled' }),
        };

        // بلا تأكيد → رسالة تعليمية ولا حجز
        const refused = await executeAgentTool('book_stay', { ...bookArgs, confirmed: false }, services);
        assert.equal(refused.ok, false);
        assert.equal((await store.listBookingsByUser(username)).length, 0);

        // بتأكيد صريح → حجز فعلي
        const done = await executeAgentTool('book_stay', { ...bookArgs, confirmed: true }, services);
        assert.equal(done.ok, true);
        assert.equal(done.data.bookingReference, 'JAH9999');
        assert.equal((await store.listBookingsByUser(username)).length, 1);

        const cancelRefused = await executeAgentTool('cancel_stay', { bookingId: 'b1', confirmed: false }, services);
        assert.equal(cancelRefused.ok, false);
    });

    test('🚗 حارس حجز السيارة: بلا خدمة → رسالة تعليمية، وconfirmed=true يحجز فعلاً', async () => {
        const username = 'agent-car-booker';
        const bookArgs = { offerId: 'off_x', ...VALID_DRIVERS };

        const disabled = await executeAgentTool('book_car', { ...bookArgs, confirmed: true }, {});
        assert.equal(disabled.ok, false);
        assert.match(disabled.data.error, /غير مفعَّل/);

        const services = {
            bookCar: async (args) => {
                const booking = await createBooking(store, {
                    username, provider: 'mock-cars', kind: 'car',
                    offer: { vehicleName: 'x' },
                    passengers: args.drivers, contact: args.contact,
                    netAmount: 60, sellAmount: 66, currency: 'USD',
                });
                return { ...booking, bookingReference: 'JAC9999', status: 'issued', sellAmount: 66, currency: 'USD' };
            },
            cancelCar: async () => ({ status: 'cancelled' }),
        };

        const refused = await executeAgentTool('book_car', { ...bookArgs, confirmed: false }, services);
        assert.equal(refused.ok, false);
        assert.equal((await store.listBookingsByUser(username)).length, 0);

        const done = await executeAgentTool('book_car', { ...bookArgs, confirmed: true }, services);
        assert.equal(done.ok, true);
        assert.equal(done.data.bookingReference, 'JAC9999');
        assert.equal((await store.listBookingsByUser(username)).length, 1);

        const cancelRefused = await executeAgentTool('cancel_car', { bookingId: 'b1', confirmed: false }, services);
        assert.equal(cancelRefused.ok, false);
    });

    test('📅 find_flexible_dates حقيقي عبر الوكيل: نطاق تواريخ + محدّد معدّل مخصّص', async () => {
        // 6 محادثات منفصلة عبر نفس الوكيل — لا نموذج مُسجَّل ثابت الفهرس
        // (scriptedFetch أحادي الاستخدام لكل محادثة)؛ بدلاً منه رد يقرأ
        // آخر رسالة فعلياً: نداء أداة عند رسالة مستخدم جديدة، ورد نهائي
        // بعد نتيجة الأداة — يحاكي وكيلاً حقيقياً عبر جولات متعددة.
        function reactiveFlexFetch() {
            return async (url, opts) => {
                const body = JSON.parse(opts.body);
                const last = body.messages[body.messages.length - 1];
                if (last.role === 'tool') {
                    return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'أرخص تاريخ هو…' } }] }) };
                }
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{
                            message: {
                                role: 'assistant', content: null,
                                tool_calls: [{
                                    id: 'c' + Math.random(), type: 'function',
                                    function: {
                                        name: 'find_flexible_dates',
                                        arguments: JSON.stringify({ origin: 'RUH', destination: 'CAI', aroundDate: futureDate(60), windowDays: 2 }),
                                    },
                                }],
                            },
                        }],
                    }),
                };
            };
        }
        const token = makeToken('flexer');
        const agent1 = createTravelAgent({ apiKey: 'k', fetchImpl: reactiveFlexFetch() });

        await withAgentApp(agent1, async call => {
            const first = await call('/api/travel/agent/chat', {
                method: 'POST', token, body: { messages: [{ role: 'user', content: 'ابحث أرخص تاريخ ±يومين' }] },
            });
            assert.equal(first.status, 200);
            assert.equal(first.data.actions[0].tool, 'find_flexible_dates');
            assert.match(first.data.actions[0].summary, /RUH→CAI/);
            assert.match(first.data.actions[0].summary, /\(5 تواريخ\)/); // ±2 حول المركز = 5 أيام

            // المحدّد الخاص FLEX_MAX_CALLS=5: 4 نداءات إضافية تمر (المجموع 5)، والسادس يُرفض
            for (let i = 0; i < 4; i++) {
                const r = await call('/api/travel/agent/chat', {
                    method: 'POST', token, body: { messages: [{ role: 'user', content: 'كرر' }] },
                });
                assert.equal(r.status, 200);
                assert.equal(r.data.actions.length, 1, `النداء رقم ${i + 2} يجب أن ينجح`);
            }
            const limited = await call('/api/travel/agent/chat', {
                method: 'POST', token, body: { messages: [{ role: 'user', content: 'كرر مرة أخرى' }] },
            });
            assert.equal(limited.status, 200); // HTTP 200 دوماً؛ الحد داخل نتيجة الأداة لا كود الحالة
            assert.equal(limited.data.actions.length, 0); // فشلت الأداة (محدّد المعدّل) → لا إجراء ناجح مسجَّل
        });
    });

    test('⚠️ check_trip_conflicts حقيقي: يكتشف تداخل توقيت رحلتين مُصدَرتين', async () => {
        const username = 'conflict-user';
        async function issuedFlight(depart, arrive) {
            const b = await createBooking(store, {
                username, provider: 'mock',
                offer: { owner: 'x', slices: [{ departAt: depart, arriveAt: arrive }] },
                passengers: [], contact: {},
                netAmount: 100, sellAmount: 110, currency: 'USD',
            });
            return transitionBooking(store, b.id, 'issued', { bookingReference: 'REFX' });
        }
        await issuedFlight('2027-06-01T08:00:00', '2027-06-01T12:00:00');
        await issuedFlight('2027-06-01T10:00:00', '2027-06-01T14:00:00'); // يتداخل مع الأولى

        const agent = createTravelAgent({
            apiKey: 'k',
            fetchImpl: scriptedFetch([
                { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'check_trip_conflicts', arguments: '{}' } }] },
                { role: 'assistant', content: 'وجدت تعارضاً…' },
            ]),
        });
        await withAgentApp(agent, async call => {
            const token = makeToken(username);
            const res = await call('/api/travel/agent/chat', {
                method: 'POST', token, body: { messages: [{ role: 'user', content: 'هل هناك تعارض في رحلاتي؟' }] },
            });
            assert.equal(res.status, 200);
            assert.match(res.data.actions[0].summary, /1 تعارض محتمل/);
        });
    });

    test('👁️ مراقبة الأسعار حقيقية: إنشاء عبر الوكيل، عزل ملكية عند الإلغاء', async () => {
        const username = 'watcher';
        const agent = createTravelAgent({
            apiKey: 'k',
            fetchImpl: scriptedFetch([
                {
                    role: 'assistant', content: null,
                    tool_calls: [{
                        id: 'c1', type: 'function',
                        function: { name: 'watch_price', arguments: JSON.stringify({ origin: 'RUH', destination: 'CAI', departDate: futureDate(30) }) },
                    }],
                },
                { role: 'assistant', content: 'أنشأت المراقبة.' },
            ]),
        });
        await withAgentApp(agent, async call => {
            const token = makeToken(username);
            const created = await call('/api/travel/agent/chat', {
                method: 'POST', token, body: { messages: [{ role: 'user', content: 'راقب لي سعر هذه الرحلة' }] },
            });
            assert.equal(created.status, 200);
            assert.match(created.data.actions[0].summary, /RUH→CAI/);
        });

        const watches = await listPriceWatchesByUser(store, username);
        assert.equal(watches.length, 1);
        assert.equal(watches[0].status, 'active');

        // list_price_watches عبر الوكيل (مباشرة — يفحص دمج agent.js/server.js)
        const listResult = await executeAgentTool('list_price_watches', {}, {
            listPriceWatches: () => listPriceWatchesByUser(store, username),
        });
        assert.equal(listResult.ok, true);
        assert.match(listResult.summary, /1 مراقبات/);

        // عزل الملكية: مستخدم آخر لا يلغي، صاحبها يلغي فعلياً
        assert.equal(await cancelPriceWatch(store, watches[0].id, 'stranger'), null);
        const cancelled = await cancelPriceWatch(store, watches[0].id, username);
        assert.equal(cancelled.status, 'cancelled');
        assert.equal(await cancelPriceWatch(store, watches[0].id, username), null); // إلغاء مكرر
    });

    test('🌤️💱 طقس وعملة حقيقيان عبر الوكيل: دمج server.js/agent.js + fetchImpl محقون', async () => {
        const stubTravelFetch = async (url) => {
            const u = String(url);
            if (u.includes('open-meteo')) {
                return { ok: true, json: async () => ({ daily: { time: ['DATE'], temperature_2m_max: [35], temperature_2m_min: [22], precipitation_sum: [0] } }) };
            }
            if (u.includes('frankfurter')) {
                return { ok: true, json: async () => ({ rates: { SAR: 3.75 }, date: 'DATE' }) };
            }
            throw new Error('نطاق غير متوقَّع في الاختبار: ' + u);
        };
        const agent = createTravelAgent({
            apiKey: 'k',
            fetchImpl: scriptedFetch([
                {
                    role: 'assistant', content: null,
                    tool_calls: [
                        { id: 'c1', type: 'function', function: { name: 'get_destination_weather', arguments: JSON.stringify({ iata: 'RUH', dateFrom: futureDate(5) }) } },
                        { id: 'c2', type: 'function', function: { name: 'convert_currency', arguments: JSON.stringify({ amount: 100, from: 'USD', to: 'SAR' }) } },
                    ],
                },
                { role: 'assistant', content: 'الطقس حار والسعر محوَّل.' },
            ]),
        });
        await withAgentApp(agent, async call => {
            const token = makeToken('info-seeker');
            const res = await call('/api/travel/agent/chat', {
                method: 'POST', token, body: { messages: [{ role: 'user', content: 'كيف الطقس بالرياض؟ وكم 100 دولار بالريال؟' }] },
            });
            assert.equal(res.status, 200);
            assert.equal(res.data.actions.length, 2);
            assert.match(res.data.actions.find(a => a.tool === 'get_destination_weather').summary, /الرياض/);
            assert.match(res.data.actions.find(a => a.tool === 'convert_currency').summary, /375/);
        }, { travelInfoFetch: stubTravelFetch });

        // تحقق التحقق الصارم مباشرة عبر executeAgentTool (وجهة غير مغطّاة، عملة فاسدة)
        const badIata = await executeAgentTool('get_destination_weather', { iata: 'ZZZ', dateFrom: futureDate(5) }, {
            getDestinationWeather: async () => { throw new Error('غير مغطّاة'); },
        });
        assert.equal(badIata.ok, false);
    });

    test('🗺️ GET /api/travel/destinations/top: مصادقة + تحقق + شكل الرد', async () => {
        const stubFetch = async (url) => ({ ok: true, json: async () => ({ thumbnail: { source: String(url) + '.jpg' } }) });
        await withAgentApp(null, async call => {
            const noAuth = await call('/api/travel/destinations/top?origin=RUH');
            assert.equal(noAuth.status, 401);

            const token = makeToken('dest-seeker');
            const badOrigin = await call('/api/travel/destinations/top?origin=xx', { token });
            assert.equal(badOrigin.status, 400);

            const res = await call('/api/travel/destinations/top?origin=RUH', { token });
            assert.equal(res.status, 200);
            assert.equal(res.data.destinations.length, CURATED_DESTINATIONS.length);
            assert.ok(res.data.destinations.every(d => Number.isFinite(d.fromPrice)));
        }, { travelInfoFetch: stubFetch });
    });

    test('📋 generate_trip_summary حقيقي: يجمع طيران+فنادق مُصدَرة فقط، مع تصفية مدى تاريخ', async () => {
        const username = 'summary-user';
        const flightB = await createBooking(store, {
            username, provider: 'mock',
            offer: { owner: 'Test Air', slices: [{ origin: 'RUH', destination: 'CAI', departAt: '2027-08-20T10:00:00', arriveAt: '2027-08-20T12:00:00' }] },
            passengers: [], contact: {}, netAmount: 100, sellAmount: 110, currency: 'USD',
        });
        await transitionBooking(store, flightB.id, 'issued', { bookingReference: 'REFF' });

        const stayB = await createBooking(store, {
            username, provider: 'mock-stays', kind: 'stay',
            offer: { name: 'Test Hotel', city: 'Cairo', checkInDate: '2027-08-10', checkOutDate: '2027-08-12' },
            passengers: [], contact: {}, netAmount: 200, sellAmount: 220, currency: 'USD',
        });
        await transitionBooking(store, stayB.id, 'issued', { bookingReference: 'REFH' });

        // حجز pending (غير مُصدَر) — يجب ألا يظهر في الملخص إطلاقاً
        await createBooking(store, {
            username, provider: 'mock',
            offer: { owner: 'x', slices: [{ origin: 'RUH', destination: 'DXB', departAt: '2027-08-15T10:00:00', arriveAt: '2027-08-15T12:00:00' }] },
            passengers: [], contact: {}, netAmount: 50, sellAmount: 55, currency: 'USD',
        });

        const bareAgent = createTravelAgent({
            apiKey: 'k',
            fetchImpl: scriptedFetch([
                { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'generate_trip_summary', arguments: '{}' } }] },
                { role: 'assistant', content: 'هذا ملخص رحلتك الكامل.' },
            ]),
        });
        await withAgentApp(bareAgent, async call => {
            const res = await call('/api/travel/agent/chat', {
                method: 'POST', token: makeToken(username), body: { messages: [{ role: 'user', content: 'رتّب لي رحلتي' }] },
            });
            assert.equal(res.status, 200);
            assert.match(res.data.actions[0].summary, /2 حجوزات/); // فندق + رحلة مُصدَرة فقط، لا pending
        });

        // تصفية مدى تاريخ تستبعد الفندق (قبل 15 أغسطس) وتُبقي الرحلة فقط
        const filteredAgent = createTravelAgent({
            apiKey: 'k',
            fetchImpl: scriptedFetch([
                {
                    role: 'assistant', content: null,
                    tool_calls: [{ id: 'c2', type: 'function', function: { name: 'generate_trip_summary', arguments: JSON.stringify({ fromDate: '2027-08-15', toDate: '2027-08-31' }) } }],
                },
                { role: 'assistant', content: 'هذا ملخص المدى المطلوب.' },
            ]),
        });
        await withAgentApp(filteredAgent, async call => {
            const res = await call('/api/travel/agent/chat', {
                method: 'POST', token: makeToken(username), body: { messages: [{ role: 'user', content: 'رتّب رحلتي من 15 أغسطس' }] },
            });
            assert.equal(res.status, 200);
            assert.match(res.data.actions[0].summary, /1 حجوزات/);
        });
    });
});

// ─── التشغيل: ملفات دوماً + postgres إن توفر ──────────────────────────
runSuite('file', {
    makeStore: async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaola-travel-test-'));
        return createFileStore({ dataDir: dir });
    },
});

if (process.env.TEST_DATABASE_URL) {
    runSuite('postgres', {
        makeStore: async () => {
            const s = createPostgresStore({ connectionString: process.env.TEST_DATABASE_URL });
            await s.init();
            // عزل كل تشغيل: جدول نظيف (التشغيل المحلي المتكرر ضد نفس القاعدة)
            const pg = (await import('pg')).default;
            const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
            await pool.query('DELETE FROM travel_bookings');
            await pool.end();
            return s;
        },
    });
}
