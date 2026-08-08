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
 */
export async function checkWatches({ store, provider, markupPct, mailer = { sendMail, mailReady } }) {
    const watches = await store.listActivePriceWatches();
    let notified = 0;
    const errors = [];

    for (const watch of watches) {
        try {
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

            await store.updatePriceWatch(watch.id, {
                lastPrice: price, currency,
                status: hitTarget ? 'triggered' : watch.status,
            });

            if ((dropped || hitTarget) && watch.contactEmail && mailer.mailReady()) {
                const reason = hitTarget ? `وصل السعر الهدف (${watch.targetPrice})` : 'انخفض السعر';
                await mailer.sendMail({
                    to: watch.contactEmail,
                    subject: `✈️ ${reason}: ${watch.origin}→${watch.destination}`,
                    text: `${reason} إلى ${price} ${currency} لرحلة ${watch.origin}→${watch.destination} بتاريخ ${watch.departDate}.\nافتح بوابة السفر لمراجعة العروض والحجز.`,
                });
                notified += 1;
            }
        } catch (e) {
            errors.push({ watchId: watch.id, error: e.message });
        }
    }
    return { checked: watches.length, notified, errors };
}
