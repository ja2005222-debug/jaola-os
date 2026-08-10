/**
 * 🔎 insights.js — «قراءة» الايجنت لنتائج البحث، تظهر بلا أن يسأل أحد
 *
 * المستوى الأول من تصوّر الايجنت الاستباقي: أغلب المسافرين لا يضغطون
 * تبويب المساعد ولا يعرفون أنهم يستطيعون سؤاله. فبدل انتظار السؤال،
 * تُعرض المقارنة فوق النتائج مباشرةً.
 *
 * ⚠️ المبدأ الحاكم: **الحقائق تُحسب هنا بالكود، والنموذج يصوغ فقط.**
 * كل رقم في القراءة (فرق سعر، دقائق موفَّرة، عدد توقفات) ناتج دالة نقية
 * أدناه — النموذج لا يرى العروض الخام أصلاً، بل نتائج مُحسَّنة مُبنيَة،
 * فيستحيل عليه اختلاق سعر أو مدة. وهذا يعطي أثراً ثانياً مقصوداً: الميزة
 * تعمل كاملةً **بلا مفتاح ايجنت** عبر الصياغة الحتمية أدناه، والنموذج
 * تحسينٌ للأسلوب لا شرطٌ للوظيفة.
 *
 * لا شيء هنا ينادي شبكة أو يقرأ حالة — دوال نقية قابلة للاختبار كلياً.
 */

// عتبات القرار: ما دونها فرقٌ لا يستحق سطراً على الشاشة.
const MIN_SAVED_MIN = 60;        // أقل توفير زمني يُذكر — أقل من ساعة ضجيج
const MAX_DIRECT_PREMIUM_PCT = 35; // فوقها المباشر ليس «فرقاً بسيطاً» بل خيار آخر
// سقف علاوة السرعة أوسع من سقف المباشر (المباشر راحة، والسرعة قد تكون
// ضرورة) لكنه **سقف**: بلا هذا كانت القراءة تقترح خياراً بثلاثة أضعاف
// السعر مقابل ساعتين — عيبٌ ظهر على بيانات حقيقية لا في اختبار.
const MAX_SPEED_PREMIUM_PCT = 60;
const MIN_SPREAD_PCT = 40;       // تشتّت الأسعار يُذكر حين يكون لافتاً فعلاً
const MAX_FINDINGS = 3;          // قراءة تُقرأ بلمحة، لا تقريرٌ يُتصفَّح

/** إجمالي التوقفات عبر كل الاتجاهات — null إن لم تُعرف الشرائح. */
function totalStops(offer) {
    const slices = offer?.slices;
    if (!Array.isArray(slices) || slices.length === 0) return null;
    let sum = 0;
    for (const s of slices) {
        if (!Number.isFinite(s?.stops)) return null;
        sum += s.stops;
    }
    return sum;
}

/**
 * هل يشمل العرض حقيبة مسجَّلة؟ true/false/null.
 *
 * null ليست تفصيلاً: Duffel قد لا يصرّح بالأمتعة إطلاقاً (موثَّق في
 * duffelProvider.js). «لا نعرف» تختلف عن «لا توجد» — وادّعاء الثانية
 * مكان الأولى يجعل المسافر يدفع رسوم حقيبة لم نحذّره منها.
 */
export function checkedBaggage(offer) {
    let sawAny = false;
    for (const slice of offer?.slices || []) {
        for (const seg of slice?.segments || []) {
            if (!Array.isArray(seg?.baggage)) continue;
            sawAny = true;
            for (const b of seg.baggage) {
                if (b?.type === 'checked' && Number(b.quantity) > 0) return true;
            }
        }
    }
    return sawAny ? false : null;
}

const isDirect = offer => totalStops(offer) === 0;
const price = offer => Number(offer?.sellAmount);
const duration = offer => (Number.isFinite(offer?.totalDurationMin) ? offer.totalDurationMin : null);

function cheapestOf(offers) {
    return offers.reduce((best, o) => (best === null || price(o) < price(best) ? o : best), null);
}

function fastestOf(offers) {
    const timed = offers.filter(o => duration(o) !== null);
    if (timed.length === 0) return null;
    // تعادل المدة → الأرخص، تماشياً مع ترتيب sortOffers في المزوّد
    return timed.reduce((best, o) => {
        if (best === null) return o;
        if (duration(o) !== duration(best)) return duration(o) < duration(best) ? o : best;
        return price(o) < price(best) ? o : best;
    }, null);
}

const pctMore = (from, to) => Math.round(((to - from) / from) * 100);

/**
 * يحلّل قائمة عروض ويعيد نتائج **مُبنيَة** (لا نصاً) — الفصل مقصود:
 * الاختبارات تؤكد الأرقام، والصياغة (حتمية كانت أو بالنموذج) تبقى
 * طبقة عرض لا تملك تغيير حقيقة.
 *
 * يعيد [] عند غياب ما يستحق الذكر — والصمت هنا نتيجة صحيحة لا فشل.
 */
export function analyzeOffers(offers) {
    const list = (Array.isArray(offers) ? offers : []).filter(o => Number.isFinite(price(o)));
    if (list.length < 2) return []; // بعرض واحد لا توجد مقارنة أصلاً

    const findings = [];
    const cheapest = cheapestOf(list);
    const fastest = fastestOf(list);
    const cheapestIdx = list.indexOf(cheapest);

    // ١) بديل مباشر يستحق فرقه — أنفع قراءة على الإطلاق لمسافر يقارن
    if (isDirect(cheapest) === false) {
        const directs = list.filter(isDirect).filter(o => duration(o) !== null);
        const bestDirect = cheapestOf(directs);
        const cheapestDur = duration(cheapest);
        if (bestDirect && cheapestDur !== null) {
            const savedMin = cheapestDur - duration(bestDirect);
            const extraPct = pctMore(price(cheapest), price(bestDirect));
            if (savedMin >= MIN_SAVED_MIN && extraPct <= MAX_DIRECT_PREMIUM_PCT) {
                findings.push({
                    type: 'direct_alternative',
                    index: list.indexOf(bestDirect),
                    extraAmount: Math.round((price(bestDirect) - price(cheapest)) * 100) / 100,
                    extraPct,
                    savedMin,
                    currency: bestDirect.currency || cheapest.currency || null,
                    stopsAvoided: totalStops(cheapest),
                });
            }
        }
    }

    // ٢) الأرخص هو الأسرع — إشارة «لا مقايضة هنا» توفّر على المسافر المقارنة
    if (fastest && fastest === cheapest && list.length >= 2) {
        findings.push({ type: 'cheapest_is_fastest', index: cheapestIdx, durationMin: duration(cheapest) });
    } else if (fastest && duration(cheapest) !== null && findings.length === 0) {
        // ٣) الأسرع يكلّف زيادة — تُذكر فقط إن لم يُذكر بديل مباشر (تكرار)
        const savedMin = duration(cheapest) - duration(fastest);
        const premiumPct = pctMore(price(cheapest), price(fastest));
        if (savedMin >= MIN_SAVED_MIN && premiumPct > 0 && premiumPct <= MAX_SPEED_PREMIUM_PCT) {
            findings.push({
                type: 'fastest_premium',
                index: list.indexOf(fastest),
                extraAmount: Math.round((price(fastest) - price(cheapest)) * 100) / 100,
                extraPct: pctMore(price(cheapest), price(fastest)),
                savedMin,
                currency: fastest.currency || null,
            });
        }
    }

    // ٤) الأرخص بلا حقيبة مسجَّلة بينما غيره يشملها — تكلفة خفية تُدفَع بالمطار
    if (checkedBaggage(cheapest) === false) {
        const withBag = list.find(o => o !== cheapest && checkedBaggage(o) === true);
        if (withBag) {
            findings.push({
                type: 'cheapest_no_baggage',
                index: cheapestIdx,
                alternativeIndex: list.indexOf(withBag),
                extraAmount: Math.round((price(withBag) - price(cheapest)) * 100) / 100,
                currency: withBag.currency || null,
            });
        }
    }

    return withSpread(findings, list).slice(0, MAX_FINDINGS);
}

/**
 * يضيف تشتّت السعر — أضعف الإشارات، فلا يُذكر إلا حين لا شيء أنفع منه.
 * بلا هذا الشرط كانت نسبته تتكرّر حرفياً مع نسبة علاوة ذُكرت قبلها بسطر
 * («+246%» مرتين) — ضجيج لا قراءة. مشتركة بين الأنواع الثلاثة فلا يفترق
 * انضباطها بينها.
 */
function withSpread(findings, list) {
    if (findings.length > 0) return findings;
    const cheapest = cheapestOf(list);
    const highest = list.reduce((max, o) => (price(o) > price(max) ? o : max), list[0]);
    const spreadPct = pctMore(price(cheapest), price(highest));
    if (spreadPct >= MIN_SPREAD_PCT) {
        return [{ type: 'price_spread', spreadPct, count: list.length }];
    }
    return findings;
}

// ─── 🏨 الفنادق ───────────────────────────────────────────────────────

const MIN_RATING_GAIN = 1;          // أقل من نجمة فرقٌ لا يُلاحَظ
const MAX_RATING_PREMIUM_PCT = 25;
const MAX_BOARD_PREMIUM_PCT = 20;   // فطور بربع السعر ليس صفقة
const MAX_REFUND_PREMIUM_PCT = 25;

const BREAKFAST_RE = /breakfast|فطور|\bBB\b|half board|full board/i;
const ROOM_ONLY_RE = /room only|\bRO\b|بدون وجبات/i;

/**
 * هل يشمل السعر فطوراً؟ true/false/null — و`null` ليست تفصيلاً هنا أيضاً:
 * مزوّد صامت عن نوع الإقامة يختلف عن مزوّد يقول «بلا وجبات»، وادّعاء
 * الثانية مكان الأولى يجعل المسافر يفاجأ بفاتورة إفطار.
 */
export function hasBreakfast(offer) {
    const board = offer?.boardName;
    if (!board) return null;
    if (BREAKFAST_RE.test(board)) return true;
    if (ROOM_ONLY_RE.test(board)) return false;
    return null; // وصفٌ لا نفهمه ≠ لا فطور
}

/** مجموع الرسوم التي تُدفع في الفندق — خارج السعر المعروض. */
function propertyFeesTotal(offer) {
    const fees = offer?.feesAtProperty;
    if (!Array.isArray(fees) || fees.length === 0) return 0;
    return fees.reduce((sum, f) => sum + (Number(f?.amount) || 0), 0);
}

const isRefundable = offer => (offer?.cancellable === true
    || (Array.isArray(offer?.cancelPolicy) && offer.cancelPolicy.length > 0));

export function analyzeStayOffers(offers) {
    const list = (Array.isArray(offers) ? offers : []).filter(o => Number.isFinite(price(o)));
    if (list.length < 2) return [];

    const findings = [];
    const cheapest = cheapestOf(list);
    const cheapestIdx = list.indexOf(cheapest);
    const cheapestRating = Number(cheapest.rating);

    // ١) تقييم أعلى بفارق يسير — نظير «البديل المباشر» في الطيران
    if (Number.isFinite(cheapestRating)) {
        const better = list
            .filter(o => o !== cheapest && Number(o.rating) - cheapestRating >= MIN_RATING_GAIN)
            .filter(o => pctMore(price(cheapest), price(o)) <= MAX_RATING_PREMIUM_PCT && price(o) > price(cheapest));
        const pick = cheapestOf(better);
        if (pick) {
            findings.push({
                type: 'rating_upgrade',
                index: list.indexOf(pick),
                rating: Number(pick.rating),
                cheapestRating,
                extraAmount: Math.round((price(pick) - price(cheapest)) * 100) / 100,
                extraPct: pctMore(price(cheapest), price(pick)),
                currency: pick.currency || null,
            });
        }
    }

    // ٢) فطور مشمول بفارق يسير — قرار سفرٍ ملموس لا تفصيل
    if (hasBreakfast(cheapest) === false) {
        const withBreakfast = cheapestOf(list.filter(o => o !== cheapest && hasBreakfast(o) === true
            && price(o) > price(cheapest) && pctMore(price(cheapest), price(o)) <= MAX_BOARD_PREMIUM_PCT));
        if (withBreakfast) {
            findings.push({
                type: 'breakfast_included',
                index: list.indexOf(withBreakfast),
                extraAmount: Math.round((price(withBreakfast) - price(cheapest)) * 100) / 100,
                extraPct: pctMore(price(cheapest), price(withBreakfast)),
                currency: withBreakfast.currency || null,
            });
        }
    }

    // ٣) الأرخص غير قابل للإلغاء — أثقل من فارق سعر عند تغيّر الخطط
    if (!isRefundable(cheapest)) {
        const refundable = cheapestOf(list.filter(o => o !== cheapest && isRefundable(o)
            && pctMore(price(cheapest), price(o)) <= MAX_REFUND_PREMIUM_PCT && price(o) > price(cheapest)));
        if (refundable) {
            findings.push({
                type: 'cheapest_not_refundable',
                index: cheapestIdx,
                alternativeIndex: list.indexOf(refundable),
                extraAmount: Math.round((price(refundable) - price(cheapest)) * 100) / 100,
                extraPct: pctMore(price(cheapest), price(refundable)),
                currency: refundable.currency || null,
            });
        }
    }

    // ٤) رسوم تُدفع في الفندق — السعر المعروض ليس ما سيدفعه فعلاً
    const fees = propertyFeesTotal(cheapest);
    if (fees > 0 && findings.length < MAX_FINDINGS) {
        findings.push({
            type: 'fees_at_property',
            index: cheapestIdx,
            feesAmount: Math.round(fees * 100) / 100,
            currency: cheapest.currency || null,
        });
    }

    return withSpread(findings, list).slice(0, MAX_FINDINGS);
}

// ─── 🚗 السيارات ──────────────────────────────────────────────────────

/**
 * أنحف القراءات الثلاث، وعن قصد: العرض الموحّد للسيارة لا يحمل فئة
 * حجم قابلة للمقارنة (لا ACRISS مُطبَّع ولا عدد مقاعد)، فمقارنة «سيارة
 * أكبر بفارق يسير» تحتاج تخميناً من اسم الطراز — وذلك اختلاقٌ لا تحليل.
 * ما يُحسب بيقين: الإلغاء المجاني وتشتّت السعر.
 */
export function analyzeCarOffers(offers) {
    const list = (Array.isArray(offers) ? offers : []).filter(o => Number.isFinite(price(o)));
    if (list.length < 2) return [];

    const findings = [];
    const cheapest = cheapestOf(list);
    if (cheapest.cancellable === false) {
        const refundable = cheapestOf(list.filter(o => o !== cheapest && o.cancellable === true
            && pctMore(price(cheapest), price(o)) <= MAX_REFUND_PREMIUM_PCT && price(o) > price(cheapest)));
        if (refundable) {
            findings.push({
                type: 'cheapest_not_refundable',
                index: list.indexOf(cheapest),
                alternativeIndex: list.indexOf(refundable),
                extraAmount: Math.round((price(refundable) - price(cheapest)) * 100) / 100,
                extraPct: pctMore(price(cheapest), price(refundable)),
                currency: refundable.currency || null,
            });
        }
    }
    return withSpread(findings, list).slice(0, MAX_FINDINGS);
}

/** «7 س 30 د» — صياغة مدة مقروءة بالعربية. */
export function formatDuration(min) {
    if (!Number.isFinite(min) || min <= 0) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} د`;
    return m === 0 ? `${h} س` : `${h} س ${m} د`;
}

const money = (amount, currency) => `${amount} ${currency || ''}`.trim();
const optionNo = index => `الخيار ${index + 1}`;

/**
 * صياغة حتمية للنتائج — ليست «بديلاً احتياطياً» بل المسار الافتراضي:
 * تعمل بلا مفتاح ايجنت وبلا كلفة نداء وبلا زمن انتظار.
 */
export function renderInsight(findings) {
    const parts = [];
    for (const f of findings || []) {
        switch (f.type) {
            case 'direct_alternative':
                parts.push(
                    `${optionNo(f.index)} **مباشر** ويوفّر ${formatDuration(f.savedMin)}` +
                    `${f.stopsAvoided ? ` وتوقفاً${f.stopsAvoided > 1 ? ` (${f.stopsAvoided} توقفات)` : ''}` : ''}` +
                    ` مقابل ${money(f.extraAmount, f.currency)} فقط (+${f.extraPct}%).`);
                break;
            case 'cheapest_is_fastest':
                parts.push(`${optionNo(f.index)} هو الأرخص **والأسرع** معاً — لا مقايضة هنا.`);
                break;
            case 'fastest_premium':
                parts.push(
                    `${optionNo(f.index)} أسرع بـ${formatDuration(f.savedMin)} مقابل ` +
                    `${money(f.extraAmount, f.currency)} زيادة (+${f.extraPct}%).`);
                break;
            case 'cheapest_no_baggage':
                parts.push(
                    `الأرخص (${optionNo(f.index)}) **لا يشمل حقيبة مسجَّلة**، بينما ` +
                    `${optionNo(f.alternativeIndex)} يشملها بفارق ${money(f.extraAmount, f.currency)}.`);
                break;
            case 'price_spread':
                parts.push(`الفرق بين الأرخص والأغلى ${f.spreadPct}% — تصفّح أبعد من أول نتيجة.`);
                break;
            case 'rating_upgrade':
                parts.push(
                    `${optionNo(f.index)} تقييمه **${f.rating}** مقابل ${f.cheapestRating} للأرخص، ` +
                    `بفارق ${money(f.extraAmount, f.currency)} فقط (+${f.extraPct}%).`);
                break;
            case 'breakfast_included':
                parts.push(
                    `${optionNo(f.index)} يشمل **الفطور** مقابل ${money(f.extraAmount, f.currency)} ` +
                    `زيادة (+${f.extraPct}%).`);
                break;
            case 'cheapest_not_refundable':
                parts.push(
                    `الأرخص (${optionNo(f.index)}) **غير قابل للإلغاء**، بينما ` +
                    `${optionNo(f.alternativeIndex)} قابل للإلغاء بفارق ${money(f.extraAmount, f.currency)} (+${f.extraPct}%).`);
                break;
            case 'fees_at_property':
                parts.push(
                    `⚠️ ${optionNo(f.index)} عليه **${money(f.feesAmount, f.currency)} رسوم تُدفع في الفندق** ` +
                    `خارج السعر المعروض.`);
                break;
            default:
                break; // نوع غير معروف يُتجاهل بدل كسر القراءة كلها
        }
    }
    return parts.join(' ');
}

// أنواع النتائج المعروفة وحقولها الرقمية — قائمة بيضاء لا قائمة سوداء.
const FINDING_FIELDS = {
    direct_alternative: ['index', 'extraAmount', 'extraPct', 'savedMin', 'stopsAvoided'],
    cheapest_is_fastest: ['index', 'durationMin'],
    fastest_premium: ['index', 'extraAmount', 'extraPct', 'savedMin'],
    cheapest_no_baggage: ['index', 'alternativeIndex', 'extraAmount'],
    price_spread: ['spreadPct', 'count'],
    rating_upgrade: ['index', 'extraAmount', 'extraPct', 'rating', 'cheapestRating'],
    breakfast_included: ['index', 'extraAmount', 'extraPct'],
    cheapest_not_refundable: ['index', 'alternativeIndex', 'extraAmount', 'extraPct'],
    fees_at_property: ['index', 'feesAmount'],
};
const CURRENCY_RE = /^[A-Za-z]{3}$/;

/**
 * ينقّي نتائج واردة من العميل قبل صياغتها.
 *
 * ⚠️ سبب وجودها: مسار الصياغة يمرّر نصاً إلى نموذج لغوي. لو بُني ذلك
 * النص من حقول العميل كما وردت، لصار حقلٌ نصّي (العملة مثلاً) قناة حقن
 * تعليمات في النموذج. فلا يُقبل إلا نوعٌ معروف، وأرقامٌ مُحوَّلة بـNumber،
 * وعملةٌ من ثلاثة أحرف — أي شيء آخر يسقط. النتيجة أن النموذج لا يرى
 * حرفاً واحداً كتبه العميل، بل نصاً وَلَّده الخادم من قوالبه.
 */
export function sanitizeFindings(raw) {
    const out = [];
    for (const item of Array.isArray(raw) ? raw.slice(0, MAX_FINDINGS) : []) {
        const fields = FINDING_FIELDS[item?.type];
        if (!fields) continue;
        const clean = { type: item.type };
        for (const key of fields) {
            const n = Number(item[key]);
            if (Number.isFinite(n)) clean[key] = n;
        }
        if (CURRENCY_RE.test(item?.currency || '')) clean.currency = String(item.currency).toUpperCase();
        out.push(clean);
    }
    return out;
}

/** القراءة الكاملة لعروض — null حين لا يوجد ما يستحق الذكر. */
function wrap(findings) {
    if (findings.length === 0) return null;
    return { findings, text: renderInsight(findings) };
}

export const buildInsight = offers => wrap(analyzeOffers(offers));
export const buildStayInsight = offers => wrap(analyzeStayOffers(offers));
export const buildCarInsight = offers => wrap(analyzeCarOffers(offers));
