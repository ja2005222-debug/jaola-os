// 💳 نظام الاشتراكات (#22): الحدود تُفرض، الاشتراك المنتهي يسقط للمجاني،
// وأحداث Stripe تُفسَّر بأمان.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicPlans, getStripePriceId, planFromStripePrice } from '../config/plans.js';
import { getUserSubscription, getUsage, canCreateProject, hasFeature } from '../services/subscriptionService.js';
import { interpretWebhookEvent } from '../services/stripeService.js';

test('الخطط الثلاث بحدودها', () => {
    const plans = publicPlans();
    assert.equal(plans.length, 3);
    assert.equal(plans.find(p => p.id === 'free').limits.projects, 5);
    assert.equal(plans.find(p => p.id === 'pro').limits.projects, null);
});

test('فرض حد المشاريع للمجاني', () => {
    const freeUser = {};
    assert.equal(getUserSubscription(freeUser).planId, 'free');
    assert.equal(canCreateProject(freeUser, 4).allowed, true);
    assert.equal(canCreateProject(freeUser, 5).allowed, false);
});

test('Pro فعّال: غير محدود + مزايا', () => {
    const pro = { subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) } };
    assert.equal(canCreateProject(pro, 999).allowed, true);
    assert.equal(hasFeature(pro, 'autoDeploy'), true);
    assert.equal(hasFeature({}, 'autoDeploy'), false);
});

test('الاشتراك المنتهي/الملغى يسقط للمجاني', () => {
    const expired = { subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() - 86400000) } };
    assert.equal(getUserSubscription(expired).planId, 'free');
    const canceled = { subscription: { plan: 'pro', status: 'canceled' } };
    assert.equal(getUserSubscription(canceled).planId, 'free');
});

test('حساب الاستهلاك', () => {
    const u = getUsage({}, 3);
    assert.equal(u.projects.used, 3);
    assert.equal(u.projects.remaining, 2);
});

test('تفسير أحداث webhook', () => {
    const co = interpretWebhookEvent({ type: 'checkout.session.completed',
        data: { object: { client_reference_id: 'sara', customer: 'cus_1', subscription: 'sub_1', metadata: { planId: 'pro' } } } });
    assert.equal(co.username, 'sara');
    assert.equal(co.plan, 'pro');
    const del = interpretWebhookEvent({ type: 'customer.subscription.deleted',
        data: { object: { metadata: { username: 'sara' }, customer: 'cus_1', id: 'sub_1' } } });
    assert.equal(del.plan, 'free');
    assert.equal(interpretWebhookEvent({ type: 'invoice.paid', data: { object: {} } }), null);
});

test('أسعار Stripe من البيئة', () => {
    process.env.STRIPE_PRICE_PRO = 'price_test_pro';
    assert.equal(getStripePriceId('pro'), 'price_test_pro');
    assert.equal(planFromStripePrice('price_test_pro'), 'pro');
    assert.equal(getStripePriceId('free'), null);
    delete process.env.STRIPE_PRICE_PRO;
});
