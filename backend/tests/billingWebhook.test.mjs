/**
 * 💳 عقدُ الـwebhook: لا نقول «استُلم» إلا عمّا طُبِّق — Sprint 3i
 *
 * الرمز 2xx يقول لـStripe «خُذ هذا الحدثَ من قائمتك». وكان المعالجُ يقوله في
 * ثلاث حالاتٍ لم يُكتب فيها حرف: قاعدةُ البيانات مقطوعة، والكتابةُ رمَت، ولا
 * مستخدمَ مطابقاً. فمن دفع أثناء انقطاع Mongo يبقى على الخطّة المجانية أبداً.
 *
 * الاختبارُ يشغّل الراوتر الحقيقيّ خلف `express.raw` كما في `server.js`، بحمولةٍ
 * موقّعةٍ بتوقيع Stripe صحيح (`generateTestHeaderString`) — لا محاكاةَ للتوقيع.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import User from '../models/User.js';
import { createBillingRouter } from '../routes/billing.js';

const SECRET = 'whsec_test_billing_webhook';
const realUpdateOne = User.updateOne;
const realDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');

let server, port, stripe;
let prevKey, prevHook;

before(() => {
    prevKey = process.env.STRIPE_SECRET_KEY;
    prevHook = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = 'sk_test_billing_webhook';
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;

    const app = express();
    app.use('/api/billing', express.raw({ type: 'application/json' }));
    app.use('/api/billing', createBillingRouter({
        verifyToken: (req, _res, next) => { req.user = { username: 'omar' }; next(); },
        DB: { findUser: async () => ({ username: 'omar' }), findUserProjects: async () => [] },
    }));
    server = http.createServer(app).listen(0);
    port = server.address().port;
    stripe = new Stripe('sk_test_billing_webhook');
});

after(() => {
    server?.close();
    User.updateOne = realUpdateOne;
    if (realDescriptor) Object.defineProperty(mongoose.connection, 'readyState', realDescriptor);
    if (prevKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = prevKey;
    if (prevHook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = prevHook;
});

const setDbState = (n) => Object.defineProperty(mongoose.connection, 'readyState', { get: () => n, configurable: true });

function paidEvent(username = 'omar') {
    return {
        id: 'evt_test', type: 'checkout.session.completed',
        data: { object: { client_reference_id: username, customer: 'cus_1', subscription: 'sub_1', metadata: { username, planId: 'pro' } } },
    };
}

async function postEvent(event, { sign = true } = {}) {
    const payload = JSON.stringify(event);
    const header = sign
        ? stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })
        : 't=1,v1=deadbeef';
    const r = await fetch(`http://127.0.0.1:${port}/api/billing/webhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': header },
        body: payload,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
}

test('توقيعٌ فاسد يُرفَض قبل أي كتابة', async () => {
    setDbState(1);
    let writes = 0;
    User.updateOne = async () => { writes += 1; return { matchedCount: 1 }; };
    const r = await postEvent(paidEvent(), { sign: false });
    assert.equal(r.status, 400);
    assert.equal(writes, 0, 'حدثٌ غيرُ موقَّعٍ لا يمسّ قاعدة البيانات');
});

test('الدفعُ يُطبَّق ويُقال إنّه طُبِّق', async () => {
    setDbState(1);
    let seen = null;
    User.updateOne = async (filter, doc) => { seen = { filter, doc }; return { matchedCount: 1, modifiedCount: 1 }; };
    const r = await postEvent(paidEvent());
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { received: true, applied: true });
    assert.deepEqual(seen.filter, { username: 'omar' });
    assert.equal(seen.doc.$set['subscription.plan'], 'pro');
    assert.equal(seen.doc.$set['subscription.status'], 'active');
    assert.equal(seen.doc.$set['subscription.stripeCustomerId'], 'cus_1');
});

test('🔴 قاعدةٌ مقطوعة: لا نقول «استُلم» بل نطلب الإعادة', async () => {
    setDbState(0);
    let writes = 0;
    User.updateOne = async () => { writes += 1; return { matchedCount: 1 }; };
    const r = await postEvent(paidEvent());
    assert.equal(writes, 0);
    assert.ok(r.status >= 500, `الرمز ${r.status} — 2xx يشطب الحدثَ من Stripe فيضيع الدفع`);
    assert.equal(r.body.received, false);
});

test('🔴 الكتابةُ ترمي: نطلب الإعادة لا الشطب', async () => {
    setDbState(1);
    User.updateOne = async () => { throw new Error('connection timed out'); };
    const r = await postEvent(paidEvent());
    assert.ok(r.status >= 500, `الرمز ${r.status} — خطأٌ عابرٌ يزول بالإعادة، فلا يُشطب الحدث`);
    assert.equal(r.body.received, false);
});

test('🔴 لا مستخدمَ مطابق: يُستلَم بصدقٍ ولا يُدّعى تطبيق', async () => {
    setDbState(1);
    User.updateOne = async () => ({ matchedCount: 0, modifiedCount: 0 });
    const r = await postEvent(paidEvent('ghost'));
    assert.equal(r.status, 200, 'الغيابُ لا يزول بالإعادة، فلا تُطلب');
    assert.equal(r.body.applied, false, 'لا يُقال «طُبِّق» عن كتابةٍ لم تطابق أحداً');
});

test('حدثٌ لا يعنينا يُستلَم بلا ادّعاء ولا كتابة', async () => {
    setDbState(1);
    let writes = 0;
    User.updateOne = async () => { writes += 1; return { matchedCount: 1 }; };
    const r = await postEvent({ id: 'evt_x', type: 'invoice.paid', data: { object: {} } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { received: true, applied: false });
    assert.equal(writes, 0);
});

test('الإلغاءُ يُنزل الخطّةَ إلى المجانية', async () => {
    setDbState(1);
    let seen = null;
    User.updateOne = async (_f, doc) => { seen = doc; return { matchedCount: 1, modifiedCount: 1 }; };
    const r = await postEvent({
        id: 'evt_del', type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_1', customer: 'cus_1', metadata: { username: 'omar' } } },
    });
    assert.equal(r.body.applied, true);
    assert.equal(seen.$set['subscription.plan'], 'free');
    assert.equal(seen.$set['subscription.status'], 'canceled');
});

test('إعادةُ الحدث نفسه مُحايدةُ التكرار', async () => {
    setDbState(1);
    const docs = [];
    User.updateOne = async (_f, doc) => { docs.push(JSON.stringify(doc)); return { matchedCount: 1, modifiedCount: 1 }; };
    await postEvent(paidEvent());
    await postEvent(paidEvent());
    assert.equal(docs.length, 2);
    assert.equal(docs[0], docs[1], 'التكرارُ يكتب القيمَ ذاتها — فالإعادةُ آمنة');
});
