/**
 * ⏱️ priceWatchPoller.js — الفحص الدوري لمراقبات الأسعار
 *
 * دالة نقية قابلة للحقن/الاختبار — بلا setInterval بداخلها؛ server.js
 * يستدعيها دورياً **فقط** داخل حارس isMain (نفس نمط إقلاع الخادم).
 * ⚠️ يعمل فقط أثناء يقظة الخدمة — على خطة استضافة مجانية تنام الخدمة
 * بلا زيارات فيتوقف الفحص حتى يوقظها أول طلب (حد منصة معروف، لا خلل).
 */
import { applyMarkup } from './pricing.js';
import { sendMail, mailReady } from './mailer.js';

function cheapestSellAmount(offers, markupPct) {
    if (offers.length === 0) return null;
    const cheapestNet = Math.min(...offers.map(o => o.netAmount));
    return applyMarkup(cheapestNet, markupPct);
}

/**
 * يفحص كل المراقبات النشطة مرة واحدة. يعيد ملخص {checked, notified, errors}
 * للتسجيل — لا يرمي أبداً (خطأ في مراقبة واحدة لا يوقف البقية).
 *
 * قواعد الحالة:
 *   - رحلة تاريخها مضى → 'expired' فوراً، بلا نداء مزوّد (توفير + إنهاء نظيف).
 *   - بلوغ السعر الهدف مع بريد مضبوط ونجاح الإرسال فعلياً → 'triggered'
 *     (لا يُنتقَل إليها إلا بعد تأكيد نجاح الإرسال — فشل الإرسال يُبقيها
 *     'active' لتُعاد المحاولة في الدورة التالية بدل إسكاتها صامتة).
 *   - بلوغ الهدف بلا بريد مضبوط (أو الإرسال معطَّل) → تبقى 'active'
 *     وlastPrice يتحدّث دوماً؛ المستخدم يسأل الايجنت list_price_watches.
 */
export async function checkWatches({ store, provider, markupPct, mailer = { sendMail, mailReady } }) {
    const watches = await store.listActivePriceWatches();
    let notified = 0;
    const errors = [];
    const todayIso = new Date().toISOString().slice(0, 10);

    for (const watch of watches) {
        try {
            if (watch.departDate < todayIso) {
                await store.updatePriceWatch(watch.id, { status: 'expired' });
                continue;
            }
            const offers = await provider.searchOffers({
                origin: watch.origin, destination: watch.destination,
                departDate: watch.departDate, returnDate: watch.returnDate || null,
                adults: 1, children: 0, cabin: watch.cabin,
            });
            const price = cheapestSellAmount(offers, markupPct);
            if (price == null) continue; // لا عروض حالياً — لا تحديث ولا إشعار

            const currency = offers[0].currency;
            const isFirstCheck = watch.lastPrice == null;
            const dropped = !isFirstCheck && price < watch.lastPrice;
            const hitTarget = watch.targetPrice != null && price <= watch.targetPrice;

            let emailSent = false;
            if ((dropped || hitTarget) && watch.contactEmail && mailer.mailReady()) {
                const reason = hitTarget ? `وصل السعر الهدف (${watch.targetPrice})` : 'انخفض السعر';
                const result = await mailer.sendMail({
                    to: watch.contactEmail,
                    subject: `✈️ ${reason}: ${watch.origin}→${watch.destination}`,
                    text: `${reason} إلى ${price} ${currency} لرحلة ${watch.origin}→${watch.destination} بتاريخ ${watch.departDate}.\nافتح بوابة السفر لمراجعة العروض والحجز.`,
                });
                emailSent = !!result?.ok; // sendMail لا يرمي أبداً — {error} يعني فشلاً صامتاً بلا هذا التحقق
                if (emailSent) notified += 1;
            }

            await store.updatePriceWatch(watch.id, {
                lastPrice: price, currency,
                status: hitTarget && emailSent ? 'triggered' : watch.status,
            });
        } catch (e) {
            errors.push({ watchId: watch.id, error: e.message });
        }
    }
    return { checked: watches.length, notified, errors };
}
