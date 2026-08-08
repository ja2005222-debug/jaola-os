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

import { createApp, validateSearchParams, validatePassengers } from '../server.js';
import { createMockTravelProvider } from '../src/providers/mockProvider.js';
import { createDuffelProvider, normalizeDuffelOffer } from '../src/providers/duffelProvider.js';
import { buildProvider } from '../src/providers/index.js';
import { readMarkupPct, applyMarkup, DEFAULT_MARKUP_PCT } from '../src/pricing.js';
import { canTransition, createBooking, transitionBooking, getBooking } from '../src/bookings.js';
import { createFileStore } from '../src/store/fileStore.js';
import { createPostgresStore } from '../src/store/postgresStore.js';
import { createTravelAgent, executeAgentTool, buildTravelAgent, AGENT_TOOLS } from '../src/agent/agent.js';

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

// ─── المجموعة الكاملة، مُعامَلة بمصنع المخزن ──────────────────────────
function runSuite(storeLabel, { makeStore, resetStore }) {
    describe(`بوابة السفر — تخزين: ${storeLabel}`, () => {
        let store, server, baseUrl, provider;

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
            const app = createApp({ store, jwtSecret: JWT_SECRET, provider, markupPct: MARKUP });
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
        });

        test('🔌 اختيار المزوّد: مفتاح Duffel → duffel (وsandbox لمفتاح اختباري)، وبلا مفتاح → محاكاة', () => {
            assert.equal(buildProvider({}).name, 'mock');
            const d = buildProvider({ DUFFEL_API_KEY: 'duffel_test_abc' });
            assert.equal(d.name, 'duffel');
            assert.equal(d.mode, 'sandbox');
            assert.equal(buildProvider({ DUFFEL_API_KEY: 'duffel_live_x' }).mode, 'live');
            assert.throws(() => createDuffelProvider({}));
        });
    });
}

// ─── 🤖 اختبارات الايجنت (مستقلة عن المخزن — نموذج مُسجَّل) ────────────
describe('الايجنت الحاجز', () => {
    let store, server, baseUrl, provider;

    async function call(pathname, { method = 'GET', token = null, body = null } = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(baseUrl + pathname, {
            method, headers, body: body ? JSON.stringify(body) : undefined,
        });
        return { status: res.status, data: await res.json().catch(() => null) };
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

    after(async () => {
        if (server) await new Promise(r => server.close(r));
    });

    test('بلا مفتاح: buildTravelAgent يرجع null والمسار يرد 503 بوضوح', async () => {
        assert.equal(buildTravelAgent({}), null);
        const app = createApp({ store, jwtSecret: JWT_SECRET, provider, agent: null, markupPct: MARKUP });
        const s = await new Promise(r => { const srv = app.listen(0, () => r(srv)); });
        try {
            const res = await fetch(`http://127.0.0.1:${s.address().port}/api/travel/agent/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${makeToken('u')}` },
                body: JSON.stringify({ messages: [{ role: 'user', content: 'مرحبا' }] }),
            });
            assert.equal(res.status, 503);
        } finally {
            await new Promise(r => s.close(r));
        }
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
        const app = createApp({ store, jwtSecret: JWT_SECRET, provider, agent, markupPct: MARKUP });
        server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
        baseUrl = `http://127.0.0.1:${server.address().port}`;
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
