/**
 * 🎁 packages.js — محرّك ساغا الباقات (طيران + فندق)
 *
 * القاعدة الحاكمة: **الأسهل تراجعاً يُحجز أولاً، والنهائي أخيراً.**
 * الفندق (قابل للإلغاء مجاناً) ثم الطيران (نهائي). فإن فشل الطيران أُلغي
 * الفندق بكلفة صفر. ولذلك تُرفض باقة بسعر فندقي غير قابل للإلغاء قبل أي
 * حجز — فشل الخطوة الثانية عليها يُحمّلنا ثمن الفندق كاملاً.
 *
 * البنية: حجز أب `kind='package'` وابنان (فندق `stay` وطيران `flight`)
 * يحملان `packageId = الأب`. حالة الأب تُشتق: `issued` فقط حين يصير
 * الابنان معاً `issued`. **الهامش يُطبَّق مرة واحدة على الأب** — الابن
 * `sellAmount = null` فلا سعران متناقضان، وتقرير الأرباح يبقى جمعاً.
 *
 * والخصم حقيقي بقرار المالك: هامش الباقة أدنى من العادي (محروس بنيوياً
 * في readPackageMarkupPct)، و«وفّر X» **يُحسب** من السعرين الفعليين:
 * مجموع بيعِ المكوّنين منفصلَين ناقص بيع الباقة — لا عبارة تسويقية.
 *
 * ⚠️ ومنذ فصل هامش الفئات (طيران/فندق منفصلان — راجع pricing.js) صار
 * "بيع المكوّنين منفصلَين" له هامشان مختلفان محتملان لا واحد: `flight
 * MarkupPct` و`stayMarkupPct` كلٌّ بقيمته الفعلية، لا رقم واحد مُبلَّط.
 * والفندق المتعاقَد يذهب أبعد: هامشه الخاص (`stay.marginPct`) إن وُجد
 * يتقدّم حتى على `stayMarkupPct` العام — فـ«ما كنت لتدفعه منفصلاً» يبقى
 * صادقاً بالضبط لما كنت لتدفعه فعلاً، لا تقريباً.
 *
 * حين يفشل التعويض نفسه (فشل الطيران ثم فشل إلغاء الفندق): لا حلقة
 * انتظار تحبس الطلب — الأب `failed` مع `compensation.pending`، الابن
 * الفندقي يبقى `issued` لأنه فعلاً مُصدَر (الكذب عليه في القاعدة أسوأ من
 * العالق المعلوم)، تنبيهٌ للأدمن فوراً، والمُطلِق الزمني يعيد المحاولة.
 */
import { applyMarkup } from './pricing.js';
import { createBooking, getBooking, transitionBooking } from './bookings.js';

const round2 = n => Math.round(n * 100) / 100;
const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * يقيّم باقة من عرضين حيّين — التحقق المسبق قبل أي حجز:
 * العرضان موجودان، العملة واحدة، الفندق قابل للإلغاء.
 * الفشل هنا أرخص فشل ممكن: لا حجز جرى ولا تعويض يلزم.
 */
export async function quotePackage({ provider, staysProvider, flightOfferId, stayOfferId, flightMarkupPct, stayMarkupPct, packageMarkupPct }) {
    const flight = await provider.getOffer(String(flightOfferId || ''));
    if (!flight) throw httpError(404, 'عرض الطيران غير موجود أو انتهت صلاحيته — أعد البحث.');
    const stay = await staysProvider.getQuote(String(stayOfferId || ''));
    if (!stay) throw httpError(404, 'عرض الفندق غير موجود أو انتهت صلاحيته — أعد البحث.');
    if (!stay.cancellable) {
        throw httpError(400, 'الباقة تُركَّب من سعر فندقي قابل للإلغاء فقط — فشل الطيران بعده يُحمّلك ثمن فندق لا رحلة له. اختر سعراً قابلاً للإلغاء.');
    }
    if (flight.currency !== stay.currency) {
        // جمع عملتين مختلفتين في رقم واحد بيعٌ بسعر مُختلَق — نرفض بصراحة
        throw httpError(400, `عملتا العرضين مختلفتان (${flight.currency}/${stay.currency}) — لا يمكن تسعير الباقة برقم واحد صادق. جرّب فندقاً آخر.`);
    }
    const netTotal = round2(flight.netAmount + stay.netAmount);
    const sellAmount = applyMarkup(netTotal, packageMarkupPct);
    // فندق متعاقَد بهامش خاص (stay.marginPct) يتقدّم على stayMarkupPct
    // العام — نفس أسبقية server.js/publicOffer، مكرَّرة هنا لأن الباقات
    // تحسب هذا بمعزل عن publicOffer (لا تمرّ عرض الفندق عبرها).
    const effectiveStayMarkupPct = stay.marginPct != null ? stay.marginPct : stayMarkupPct;
    const separateTotal = round2(
        applyMarkup(flight.netAmount, flightMarkupPct) + applyMarkup(stay.netAmount, effectiveStayMarkupPct)
    );
    // «وفّر X» محسوب لا مكتوب — وإن لم يكن موجباً (تقريب سنتات على مبالغ
    // ضئيلة) لا يُدّعى توفير أصلاً
    const savings = round2(separateTotal - sellAmount);
    return {
        flight, stay, netTotal, sellAmount, separateTotal,
        savings: savings > 0 ? savings : 0,
        savingsPct: separateTotal > 0 ? Math.round((Math.max(savings, 0) / separateTotal) * 1000) / 10 : 0,
        currency: flight.currency,
    };
}

/** ملخّصا العرضين المخزَّنان على الحجوزات — بلا صافٍ ولا معرّفات مزوّد داخلية. */
function publicSummaries(q) {
    // availableServices: كتالوجٌ يحمل صافياً لكل خدمة (انظر publicOffer في
    // server.js) — الباقات لا تدعم شراء أمتعة إضافية بعد، فيُسقَط كلياً.
    const { netAmount: _nf, passengerIds: _ids, passengers: _pax, availableServices: _avail, ...flightSummary } = q.flight;
    const { netAmount: _ns, marginPct: _mp, ...staySummary } = q.stay;
    return { flightSummary, staySummary };
}

/**
 * ينفّذ الساغا كاملة. يعيد {parent, stayChild, flightChild} عند النجاح،
 * ويرمي بخطأ ذي status عند أي فشل — بعد ترتيب البيت: كل حجز جرى إمّا
 * أُلغي أو سُجّل تعويضه المعلّق.
 */
export async function bookPackage({
    store, provider, staysProvider,
    username, flightOfferId, stayOfferId, passengers, contact,
    flightMarkupPct, stayMarkupPct, packageMarkupPct,
    validatePassengers, validateGuests, checkPassengerAges,
    onCompensationStuck = null, // async (parent, stayChild) — تنبيه الأدمن
}) {
    const q = await quotePackage({ provider, staysProvider, flightOfferId, stayOfferId, flightMarkupPct, stayMarkupPct, packageMarkupPct });

    const checkP = validatePassengers({ passengers, contact }, q.flight.passengerCount);
    if (checkP.error) throw httpError(400, checkP.error);
    // نفس شبكة الأعمار التي تحرس حجز الطيران المفرد — تاريخ ميلاد يناقض
    // ما سُعِّر به العرض يُرفض هنا لا عند المزوّد
    const ageError = checkPassengerAges({
        passengers: checkP.values.passengers,
        offerPassengers: q.flight.passengers,
        departAt: q.flight.slices?.[0]?.departAt,
    });
    if (ageError) throw httpError(400, ageError);
    // ضيوف الفندق من ركاب الطيران أنفسهم — مصدر واحد لا نموذجان يُملآن
    const guests = checkP.values.passengers.map(p => ({ givenName: p.givenName, familyName: p.familyName }));
    const checkG = validateGuests({ guests, contact });
    if (checkG.error) throw httpError(400, checkG.error);

    const { flightSummary, staySummary } = publicSummaries(q);

    // الأب أولاً: سجلّ الباقة موجود قبل أي نداء مزوّد — فشلٌ لاحق يوثَّق
    const parent = await createBooking(store, {
        username, provider: 'package', kind: 'package',
        offer: {
            flight: flightSummary, stay: staySummary,
            separateTotal: q.separateTotal, savings: q.savings, savingsPct: q.savingsPct,
        },
        passengers: checkP.values.passengers, contact: checkP.values.contact,
        netAmount: q.netTotal, sellAmount: q.sellAmount, currency: q.currency,
    });
    const stayChild = await createBooking(store, {
        username, provider: staysProvider.name, kind: 'stay', packageId: parent.id,
        offer: staySummary,
        passengers: checkG.values.guests, contact: checkG.values.contact,
        netAmount: q.stay.netAmount, sellAmount: null, currency: q.stay.currency,
    });
    const flightChild = await createBooking(store, {
        username, provider: provider.name, kind: 'flight', packageId: parent.id,
        offer: flightSummary,
        passengers: checkP.values.passengers, contact: checkP.values.contact,
        netAmount: q.flight.netAmount, sellAmount: null, currency: q.flight.currency,
    });

    // ─── الخطوة ١: الفندق (القابل للإلغاء أولاً) ─────────────────────
    let stayOrder;
    try {
        stayOrder = await staysProvider.createStayOrder({
            offerId: q.stay.id, guests: checkG.values.guests, contact: checkG.values.contact,
        });
    } catch (e) {
        await transitionBooking(store, stayChild.id, 'failed', { error: e.message });
        await transitionBooking(store, flightChild.id, 'failed', { error: 'لم يُحاوَل — فشل الفندق قبله.' });
        await transitionBooking(store, parent.id, 'failed', { error: `تعذّر حجز الفندق: ${e.message}` });
        throw httpError(502, `تعذّر إصدار الباقة — رفض مزوّد الفنادق الحجز: ${e.message}. لم تُحاسَب على شيء.`);
    }
    const issuedStay = await transitionBooking(store, stayChild.id, 'issued', {
        providerOrderId: stayOrder.orderId,
        bookingReference: stayOrder.bookingReference,
    });

    // ─── الخطوة ٢: الطيران (النهائي أخيراً) ──────────────────────────
    let flightOrder;
    try {
        flightOrder = await provider.createOrder({
            offerId: q.flight.id,
            passengers: checkP.values.passengers,
            contact: checkP.values.contact,
        });
    } catch (e) {
        await transitionBooking(store, flightChild.id, 'failed', { error: e.message });
        // 🧯 التعويض: إلغاء الفندق الذي حجزناه قبل ثوانٍ — Free-cancel فكلفته صفر
        try {
            const refund = await staysProvider.cancelStayOrder(stayOrder.orderId);
            await transitionBooking(store, stayChild.id, 'cancelled', {
                refund: { amount: refund.refundAmount ?? null, currency: refund.currency ?? null },
            });
            await transitionBooking(store, parent.id, 'failed', {
                error: `تعذّر حجز الطيران: ${e.message} — أُلغي الفندق تلقائياً بلا كلفة.`,
            });
        } catch (cancelErr) {
            // التعويض نفسه فشل: الابن يبقى issued لأنه فعلاً مُصدَر —
            // الكذب عليه أسوأ من العالق المعلوم. المُطلِق الزمني سيعيد.
            const failedParent = await transitionBooking(store, parent.id, 'failed', {
                error: `تعذّر حجز الطيران: ${e.message} — وفشل إلغاء الفندق مؤقتاً (${cancelErr.message})، سيُعاد تلقائياً.`,
                compensation: { pending: [stayChild.id] },
            });
            if (onCompensationStuck) {
                try { await onCompensationStuck(failedParent || parent, issuedStay || stayChild); }
                catch { /* التنبيه إثراء — فشله لا يغيّر الحصيلة */ }
            }
        }
        throw httpError(502, `تعذّر إصدار الطيران: ${e.message}. حجز الفندق أُلغي (أو سيُلغى تلقائياً) ولن تُحاسَب عليه.`);
    }
    await transitionBooking(store, flightChild.id, 'issued', {
        providerOrderId: flightOrder.orderId,
        bookingReference: flightOrder.bookingReference,
    });
    // الابنان مُصدَران معاً — الآن فقط يستحق الأب `issued` (حالة مشتقة)
    const issuedParent = await transitionBooking(store, parent.id, 'issued', {
        bookingReference: flightOrder.bookingReference,
    });

    return {
        parent: issuedParent || await getBooking(store, parent.id),
        stayChild: await getBooking(store, stayChild.id),
        flightChild: await getBooking(store, flightChild.id),
    };
}

/**
 * إلغاء باقة مُصدَرة بمبادرة المسافر — بسياسة معلنة صادقة: الفندق يُسترد
 * وفق سياسته، والطيران يخضع لشروط الناقل (قد يكون استرداده صفراً).
 *
 * الترتيب معكوس الحجز عمداً: الطيران (الأصعب) أولاً — فإن رفض الناقل
 * الإلغاء لم نلمس الفندق وبقيت الباقة سليمة كما كانت. ولو ألغينا الفندق
 * أولاً ثم رفض الناقل لبقي المسافر بطيران بلا سكن — نفس كارثة الحجز
 * بالمقلوب.
 */
export async function cancelPackage({ store, provider, staysProvider, username, packageId }) {
    const parent = await getBooking(store, String(packageId || ''));
    if (!parent || parent.username !== username || parent.kind !== 'package') {
        throw httpError(404, 'الباقة غير موجودة.');
    }
    if (parent.status !== 'issued') throw httpError(400, 'الإلغاء متاح للباقات المُصدَرة فقط.');

    const children = (await store.listBookingsByUser(username, 200)).filter(b => b.packageId === parent.id);
    const flightChild = children.find(b => b.kind === 'flight');
    const stayChild = children.find(b => b.kind === 'stay');

    let flightRefund = null;
    if (flightChild?.status === 'issued') {
        let result;
        try {
            result = await provider.cancelOrder(flightChild.providerOrderId);
        } catch (e) {
            // رفض الناقل والفندق لم يُلمَس — الباقة باقية سليمة كما كانت
            throw httpError(502, `رفض الناقل إلغاء الطيران: ${e.message}. لم يُلغَ شيء — حاول لاحقاً أو خاطب الدعم.`);
        }
        flightRefund = { amount: result.refundAmount ?? null, currency: result.currency ?? null };
        await transitionBooking(store, flightChild.id, 'cancelled', { refund: flightRefund });
    }
    let stayRefund = null;
    if (stayChild?.status === 'issued') {
        try {
            const result = await staysProvider.cancelStayOrder(stayChild.providerOrderId);
            stayRefund = { amount: result.refundAmount ?? null, currency: result.currency ?? null };
            await transitionBooking(store, stayChild.id, 'cancelled', { refund: stayRefund });
        } catch (e) {
            // الطيران أُلغي فعلاً — لا تراجع عنه. الفندق يُسجَّل تعويضاً معلّقاً.
            await transitionBooking(store, parent.id, 'cancelled', {
                refund: { flight: flightRefund, stay: null },
                compensation: { pending: [stayChild.id] },
                error: `أُلغي الطيران وفشل إلغاء الفندق مؤقتاً (${e.message}) — سيُعاد تلقائياً.`,
            });
            return getBooking(store, parent.id);
        }
    }
    await transitionBooking(store, parent.id, 'cancelled', {
        refund: { flight: flightRefund, stay: stayRefund },
    });
    return getBooking(store, parent.id);
}

/**
 * يلتقط الباقات ذات التعويض المعلّق ويعيد محاولة إلغاء أبنائها الفندقيين.
 * يستدعيه المُطلِق الزمني كل ساعة — وزرّ «أعد الآن» في صفحة الأدمن.
 */
export async function retryPackageCompensations({ store, staysProvider, limit = 20 }) {
    const stuck = await store.listCompensationPending(limit);
    let resolved = 0;
    const errors = [];
    for (const parent of stuck) {
        const pending = [...(parent.compensation?.pending || [])];
        const remaining = [];
        for (const childId of pending) {
            const child = await getBooking(store, childId);
            if (!child || child.status !== 'issued') continue; // حُلّ من طريق آخر
            try {
                const refund = await staysProvider.cancelStayOrder(child.providerOrderId);
                await transitionBooking(store, child.id, 'cancelled', {
                    refund: { amount: refund.refundAmount ?? null, currency: refund.currency ?? null },
                });
                resolved += 1;
            } catch (e) {
                remaining.push(childId);
                errors.push({ bookingId: childId, error: e.message });
            }
        }
        // تحديث علامة التعويض لا انتقالُ حالة (الأب يبقى failed/cancelled
        // كما هو): نداء المخزن مباشرةً بشرط «من نفس الحالة إلى نفسها» —
        // ذرّيٌّ كأي انتقال، ولا يمرّ على جدول canTransition لأنه ليس
        // انتقالاً أصلاً (نفس فلسفة markTripReminderSent).
        await store.transitionBooking(parent.id, {
            from: [parent.status], to: parent.status,
            patch: { compensation: { pending: remaining } },
        });
    }
    return { checked: stuck.length, resolved, errors };
}
