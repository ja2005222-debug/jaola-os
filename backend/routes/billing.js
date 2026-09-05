/**
 * 💳 مسارات الاشتراكات والدفع (Stripe) — أول قطعة تخرج من server.js
 *
 * جزء من التفكيك التزايدي للـ God Server: الوحدة مكتفية ذاتياً (خطط،
 * اشتراك، Checkout، بوابة الإدارة، Webhook) وتُحقن تبعياتها من الخادم
 * (verifyToken، غلاف DB الصامد) بدل الاستيراد الدائري.
 *
 * ملاحظة حرجة: /webhook يحتاج الجسم الخام للتحقق من توقيع Stripe —
 * middleware الـ express.raw مسجَّل في server.js قبل express.json ويبقى هناك
 * لأن ترتيب التسجيل هو ما يحميه.
 */

import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { publicPlans } from '../config/plans.js';
import { getUsage } from '../services/subscriptionService.js';
import {
    isStripeConfigured, createCheckoutSession, createPortalSession,
    constructWebhookEvent, interpretWebhookEvent,
} from '../services/stripeService.js';

export function createBillingRouter({ verifyToken, DB, getBotAiUsed = () => 0 }) {
    const router = express.Router();

    // قائمة الخطط — عامة (تُعرض في صفحة الأسعار/الإعدادات)
    router.get('/plans', (req, res) => {
        res.json({ success: true, plans: publicPlans(), stripeEnabled: isStripeConfigured() });
    });

    // اشتراك المستخدم الحالي + استهلاكه — للوحة التحكم
    router.get('/subscription', verifyToken, async (req, res) => {
        try {
            const username = req.user.username;
            const userDoc = await DB.findUser(username);
            const projects = await DB.findUserProjects(username);
            const count = (projects || []).filter(p => p.name !== 'sandbox_app').length;
            let botAiUsed = 0;
            try { botAiUsed = getBotAiUsed(username) || 0; } catch { /* العدّاد اختياري */ }
            res.json({ success: true, ...getUsage(userDoc, count, botAiUsed), stripeEnabled: isStripeConfigured() });
        } catch (err) {
            res.status(500).json({ error: 'تعذّر جلب الاشتراك: ' + err.message });
        }
    });

    // إنشاء جلسة Checkout للترقية إلى خطة مدفوعة
    router.post('/checkout', verifyToken, async (req, res) => {
        const { planId } = req.body || {};
        if (!['pro', 'enterprise'].includes(planId)) {
            return res.status(400).json({ error: 'خطة غير صالحة للاشتراك.' });
        }
        if (!isStripeConfigured()) {
            return res.status(503).json({ error: 'نظام الدفع غير مُفعّل حالياً.' });
        }
        try {
            const username = req.user.username;
            const userDoc = await DB.findUser(username);
            const session = await createCheckoutSession({
                planId,
                username,
                email: userDoc?.email,
                customerId: userDoc?.subscription?.stripeCustomerId || null,
            });
            res.json({ success: true, url: session.url });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // بوابة إدارة الاشتراك (تحديث/إلغاء) عبر Stripe
    router.post('/portal', verifyToken, async (req, res) => {
        try {
            const userDoc = await DB.findUser(req.user.username);
            const session = await createPortalSession({ customerId: userDoc?.subscription?.stripeCustomerId || null });
            res.json({ success: true, url: session.url });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    // Webhook — يُحدّث اشتراك المستخدم بناءً على أحداث Stripe (جسم خام)
    //
    // 🔴 عقدُ الـwebhook: الرمز 2xx يقول لـStripe «استُلم وطُبِّق»، فيشطب
    //    الحدثَ ولا يعيده. وكان هذا المعالج يقول ذلك في ثلاث حالاتٍ لم
    //    يُطبَّق فيها شيء: قاعدةُ البيانات مقطوعة، والكتابةُ رمَت، ولا
    //    مستخدمَ مطابق. فمن دفع أثناء انقطاعِ Mongo يبقى على المجانية
    //    إلى الأبد، ولا أثرَ إلا سطرُ تحذيرٍ يمرّ. (والحالةُ ليست نظرية:
    //    Mongo تتّصل بعد الإقلاع لا معه — راجع `onMongoReady`.)
    //
    //    الآن: ما يزول بالإعادة يُطلَب إعادتُه (5xx)، وما لا يزول يُستلَم
    //    بصدقٍ مع `applied: false`. والإعادةُ عند Stripe محدودةٌ بمهلةٍ
    //    ثمّ تتوقّف وتُعلَّم النقطةُ معطّلة — لا إعادةَ إلى ما لا نهاية
    //    كما افترض التعليقُ السابق. والتطبيقُ نفسه مُحايدُ التكرار
    //    (`$set` بالقيم ذاتها)، فإعادةُ الحدث لا تضرّ.
    router.post('/webhook', async (req, res) => {
        const signature = req.headers['stripe-signature'];
        let event;
        try {
            event = await constructWebhookEvent(req.body, signature);
        } catch (err) {
            return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
        }

        const update = interpretWebhookEvent(event);
        if (!update?.username) {
            if (update) console.warn(`[Billing] حدث ${event.type} بلا معرّف مستخدم — لم يُطبَّق`);
            return res.json({ received: true, applied: false });
        }

        if (mongoose.connection.readyState !== 1) {
            console.error(`[Billing] قاعدة البيانات غير متصلة — ${event.type} لـ${update.username} لم يُطبَّق؛ نطلب من Stripe الإعادة`);
            return res.status(503).json({ received: false, retry: true });
        }

        const set = {};
        if (update.plan) set['subscription.plan'] = update.plan;
        if (update.status) set['subscription.status'] = update.status;
        if (update.customerId) set['subscription.stripeCustomerId'] = update.customerId;
        if (update.subscriptionId) set['subscription.stripeSubscriptionId'] = update.subscriptionId;
        if (update.currentPeriodEnd) set['subscription.currentPeriodEnd'] = update.currentPeriodEnd;
        set['subscription.cancelAtPeriodEnd'] = !!update.cancelAtPeriodEnd;

        try {
            const result = await User.updateOne({ username: update.username }, { $set: set });
            if (!result?.matchedCount) {
                // غيابُ المستخدم لا يزول بالإعادة — نستلم بصدقٍ ولا نطلب تكراراً
                console.warn(`[Billing] لا مستخدمَ باسم ${update.username} — ${event.type} لم يُطبَّق`);
                return res.json({ received: true, applied: false });
            }
            console.log(`💳 [Billing] تحديث اشتراك ${update.username} → ${update.plan || '?'} (${update.status})`);
            return res.json({ received: true, applied: true });
        } catch (err) {
            console.error(`[Billing] تعذّر تطبيق ${event.type} لـ${update.username}: ${err.message} — نطلب من Stripe الإعادة`);
            return res.status(500).json({ received: false, retry: true });
        }
    });

    return router;
}
