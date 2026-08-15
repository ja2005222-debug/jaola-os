/**
 * 🎒 fixedPackages.js — الباقات المجدولة (المنتج الجاهز مسبق التعاقد)
 *
 * يختلف جوهرياً عن packages.js (الساغا الحية): هناك نُركّب عرضين حيّين من
 * مزوّدين لحظة الطلب؛ هنا **المخزون مِلكنا سلفاً** — فندق متعاقَد ومقاعد
 * طيران محجوزة قبل فتح البيع (حجز جماعي/حصة موسمية/موزّع جملة/عارض)،
 * فالتأكيد فوري من طرفنا بلا أي نداء مزوّد، والسعر رقم واحد نهائي.
 *
 * الحقيقة التشغيلية المطابقة لصناعة الطيران الجماعي:
 *  - أسماء الركاب لا تلزم عند الحجز — تُسلَّم قبل الإقلاع بأسبوعين
 *    (نفس موعد سداد المتبقي). الحجز باسم قائد المجموعة + وسيلة تواصل.
 *  - العربون يثبّت المقاعد، والمتبقي قبل `dueDate` (الإقلاع − ١٤ يوماً).
 *  - الإلغاء الذاتي متاح حتى `dueDate` باسترداد كامل المدفوع؛ بعده يُدار
 *    يدوياً (شروط الناقل/الفندق تحكم) — لا وعد آلي كاذب.
 *
 * حارس البيع الزائد: **الحجز يبدأ بحجز المقاعد ذرّياً في المخزن**
 * (allocateFixedSeats بشرط `seatsSold + n <= seatCapacity` داخل تحديث
 * واحد) ثم يُنشأ سجل الحجز؛ فشل الإنشاء يعيد المقاعد فوراً. النمط نفسه
 * المجرَّب في حصص العقود الفندقية (contracts.js).
 *
 * ما يراه الجمهور مُنقّى عمداً: `netPerSeat` (كلفتنا) و`sourcing` (مصدر
 * تعاقدنا) و`releaseDate` (موعد استرجاع حصتنا) أسرار تشغيلية للمالك —
 * publicFixedPackage يحجبها كما يحجب publicSummaries صوافي packages.js.
 */

import { createBooking, getBooking, transitionBooking } from './bookings.js';

const round2 = n => Math.round(n * 100) / 100;
const httpError = (status, message) => Object.assign(new Error(message), { status });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const IATA_RE = /^[A-Z]{3}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const MAX_NAME = 80;
const MAX_TEXT = 400;
const MAX_SEATS = 300;
const MAX_NIGHTS = 30;
const MAX_PARTY = 9; // لكل فئة عدّ في الحجز الواحد
export const NAMES_DEADLINE_DAYS = 14; // تسليم الأسماء وسداد المتبقي: الإقلاع − ١٤

/** مصادر تعاقد مقاعد الطيران — المصطلحات الفعلية للصناعة. */
export const SEAT_SOURCING = {
    group: 'حجز جماعي (Group)',
    allotment: 'حصة موسمية (Allotment)',
    consolidator: 'موزّع جملة (Consolidator)',
    charter: 'طيران عارض (Charter)',
};

export function todayUtcStr() {
    return new Date().toISOString().slice(0, 10);
}
export function addDaysStr(dateStr, delta) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
}

/** ينقّي باقة جديدة/معدَّلة من الأدمن — {error} أو {value}. */
export function normalizeFixedPackage(raw) {
    const title = String(raw?.title || '').trim().slice(0, MAX_NAME);
    if (!title) return { error: 'اسم الباقة مطلوب.' };
    const city = String(raw?.city || '').trim().slice(0, MAX_NAME);
    if (!city) return { error: 'مدينة الوجهة مطلوبة.' };
    const iata = String(raw?.iata || '').trim().toUpperCase();
    if (!IATA_RE.test(iata)) return { error: 'وجهة الباقة رمز IATA من ثلاثة أحرف (مثل AYT).' };
    const hotelName = String(raw?.hotelName || '').trim().slice(0, MAX_NAME);
    if (!hotelName) return { error: 'اسم الفندق المتعاقَد مطلوب.' };
    const board = String(raw?.board || 'شامل الإفطار').trim().slice(0, MAX_NAME);
    const description = String(raw?.description || '').trim().slice(0, MAX_TEXT);

    const departDate = String(raw?.departDate || '').trim();
    if (!DATE_RE.test(departDate)) return { error: 'تاريخ الانطلاق بصيغة YYYY-MM-DD.' };
    const nights = Number(raw?.nights);
    if (!Number.isInteger(nights) || nights < 1 || nights > MAX_NIGHTS) {
        return { error: `عدد الليالي عدد صحيح بين 1 و${MAX_NIGHTS}.` };
    }

    const seatCapacity = Number(raw?.seatCapacity);
    if (!Number.isInteger(seatCapacity) || seatCapacity < 1 || seatCapacity > MAX_SEATS) {
        return { error: `سعة المقاعد عدد صحيح بين 1 و${MAX_SEATS}.` };
    }

    const sourcing = String(raw?.sourcing || '').trim();
    if (!SEAT_SOURCING[sourcing]) {
        return { error: 'مصدر المقاعد أحد: group / allotment / consolidator / charter.' };
    }
    let releaseDate = null;
    if (raw?.releaseDate != null && raw.releaseDate !== '') {
        releaseDate = String(raw.releaseDate).trim();
        if (!DATE_RE.test(releaseDate)) return { error: 'تاريخ استرجاع المقاعد بصيغة YYYY-MM-DD.' };
        if (releaseDate >= departDate) return { error: 'تاريخ الاسترجاع يجب أن يسبق الانطلاق.' };
    }

    const currency = String(raw?.currency || '').trim().toUpperCase();
    if (!CURRENCY_RE.test(currency)) return { error: 'العملة رمز من ثلاثة أحرف (مثل USD).' };
    const pricePerSeat = Number(raw?.pricePerSeat);
    if (!Number.isFinite(pricePerSeat) || pricePerSeat <= 0) {
        return { error: 'سعر المقعد (بالغ في غرفة مزدوجة) رقم موجب.' };
    }
    let netPerSeat = null;
    if (raw?.netPerSeat != null && raw.netPerSeat !== '') {
        netPerSeat = Number(raw.netPerSeat);
        if (!Number.isFinite(netPerSeat) || netPerSeat < 0) return { error: 'كلفة المقعد الصافية رقم ≥ 0.' };
        if (netPerSeat >= pricePerSeat) return { error: 'كلفة المقعد الصافية يجب أن تكون دون سعر البيع — وإلا فالهامش سالب.' };
    }
    let singleSupplement = 0;
    if (raw?.singleSupplement != null && raw.singleSupplement !== '') {
        singleSupplement = Number(raw.singleSupplement);
        if (!Number.isFinite(singleSupplement) || singleSupplement < 0) return { error: 'فارق الغرفة المفردة رقم ≥ 0.' };
    }
    let childPrice = null;
    if (raw?.childPrice != null && raw.childPrice !== '') {
        childPrice = Number(raw.childPrice);
        if (!Number.isFinite(childPrice) || childPrice <= 0) return { error: 'سعر الطفل رقم موجب.' };
    }

    let ebPct = 0;
    let ebUntil = null;
    if (raw?.ebPct != null && raw.ebPct !== '') {
        ebPct = Number(raw.ebPct);
        if (!Number.isFinite(ebPct) || ebPct < 0 || ebPct > 50) return { error: 'خصم السعر المبكّر بين 0 و50٪.' };
    }
    if (ebPct > 0) {
        ebUntil = String(raw?.ebUntil || '').trim();
        if (!DATE_RE.test(ebUntil)) return { error: 'مع خصم مبكّر، تاريخ نهايته (ebUntil) مطلوب بصيغة YYYY-MM-DD.' };
        if (ebUntil >= departDate) return { error: 'نهاية السعر المبكّر يجب أن تسبق الانطلاق.' };
    }

    let depositPct = 30;
    if (raw?.depositPct != null && raw.depositPct !== '') {
        depositPct = Number(raw.depositPct);
        if (!Number.isFinite(depositPct) || depositPct < 10 || depositPct > 100) {
            return { error: 'نسبة العربون بين 10 و100٪.' };
        }
    }

    return {
        value: {
            title, city, iata, hotelName, board, description,
            departDate, nights, seatCapacity,
            sourcing, releaseDate,
            currency, netPerSeat, pricePerSeat, singleSupplement, childPrice,
            ebPct, ebUntil, depositPct,
            active: raw?.active !== false,
        },
    };
}

export function seatsLeft(pkg) {
    return Math.max(0, (pkg.seatCapacity || 0) - (pkg.seatsSold || 0));
}

export function isEarlyBird(pkg, today = todayUtcStr()) {
    return !!(pkg.ebPct > 0 && pkg.ebUntil && today <= pkg.ebUntil);
}

/**
 * يسعّر طلب حجز محدد العدد — نفس الحساب للعرض المسبق وللحجز الفعلي
 * (مصدر واحد، فلا «سعر شاشة» يخالف «سعر فاتورة»).
 * children بلا childPrice مضبوط → خطأ صريح بدل تسعير مخمَّن.
 */
export function priceFixedPackage(pkg, { adults, singles = 0, children = 0, pay = 'deposit' }, today = todayUtcStr()) {
    const a = Number(adults), s = Number(singles), c = Number(children);
    if (!Number.isInteger(a) || a < 1 || a > MAX_PARTY) {
        throw httpError(400, `عدد البالغين (غرفة مزدوجة) عدد صحيح بين 1 و${MAX_PARTY}.`);
    }
    if (!Number.isInteger(s) || s < 0 || s > MAX_PARTY) {
        throw httpError(400, `عدد الغرف المفردة عدد صحيح بين 0 و${MAX_PARTY}.`);
    }
    if (!Number.isInteger(c) || c < 0 || c > MAX_PARTY) {
        throw httpError(400, `عدد الأطفال عدد صحيح بين 0 و${MAX_PARTY}.`);
    }
    if (c > 0 && pkg.childPrice == null) {
        throw httpError(400, 'هذه الباقة بلا سعر أطفال معلن — احجز بالغين فقط أو خاطب الدعم.');
    }
    if (pay !== 'deposit' && pay !== 'full') {
        throw httpError(400, "طريقة الدفع 'deposit' (عربون) أو 'full' (كامل).");
    }

    const eb = isEarlyBird(pkg, today);
    const discount = eb ? (1 - pkg.ebPct / 100) : 1;
    const ppAdult = round2(pkg.pricePerSeat * discount);
    const ppChild = pkg.childPrice != null ? round2(pkg.childPrice * discount) : null;

    const lines = [];
    let total = 0;
    const vAdults = round2(ppAdult * a);
    total += vAdults;
    lines.push({ label: `${a} بالغ — غرفة مزدوجة`, amount: vAdults });
    if (s > 0) {
        // فارق المفردة كلفة فندقية صافية — خارج خصم السعر المبكّر عمداً
        const vSingles = round2((ppAdult + pkg.singleSupplement) * s);
        total += vSingles;
        lines.push({ label: `${s} غرفة مفردة (+${pkg.singleSupplement})`, amount: vSingles });
    }
    if (c > 0) {
        const vChildren = round2(ppChild * c);
        total += vChildren;
        lines.push({ label: `${c} طفل`, amount: vChildren });
    }
    total = round2(total);

    const deposit = round2(total * pkg.depositPct / 100);
    const paidNow = pay === 'deposit' ? deposit : total;
    const remaining = round2(total - paidNow);
    const dueDate = addDaysStr(pkg.departDate, -NAMES_DEADLINE_DAYS);
    const seats = a + s + c;

    return {
        seats, lines, total, currency: pkg.currency,
        earlyBird: eb, ebPct: eb ? pkg.ebPct : 0,
        pay, depositPct: pkg.depositPct, paidNow, remaining, dueDate,
        namesDeadline: dueDate,
        netAmount: pkg.netPerSeat != null ? round2(pkg.netPerSeat * seats) : null,
    };
}

/** الشكل العام — بلا كلفة صافية ولا تفاصيل تعاقدنا الداخلية. */
export function publicFixedPackage(pkg, today = todayUtcStr()) {
    const left = seatsLeft(pkg);
    return {
        id: pkg.id,
        title: pkg.title, city: pkg.city, iata: pkg.iata,
        hotelName: pkg.hotelName, board: pkg.board, description: pkg.description,
        departDate: pkg.departDate, nights: pkg.nights,
        returnDate: addDaysStr(pkg.departDate, pkg.nights),
        currency: pkg.currency,
        pricePerSeat: pkg.pricePerSeat, singleSupplement: pkg.singleSupplement,
        childPrice: pkg.childPrice, depositPct: pkg.depositPct,
        earlyBird: isEarlyBird(pkg, today),
        ebPct: isEarlyBird(pkg, today) ? pkg.ebPct : 0,
        ebUntil: isEarlyBird(pkg, today) ? pkg.ebUntil : null,
        effectivePrice: isEarlyBird(pkg, today) ? round2(pkg.pricePerSeat * (1 - pkg.ebPct / 100)) : pkg.pricePerSeat,
        seatsLeft: left,
        soldOut: left <= 0,
        fewSeats: left > 0 && left <= 5,
        namesDeadline: addDaysStr(pkg.departDate, -NAMES_DEADLINE_DAYS),
    };
}

/**
 * الحجز الفعلي: مقاعد أولاً (ذرّياً — حارس البيع الزائد) ثم سجل الحجز.
 * التأكيد فوري (issued) لأن المخزون ملكنا — لا مزوّد يُنتظر.
 */
export async function bookFixedPackage({
    store, packageId, username,
    adults, singles = 0, children = 0, pay = 'deposit',
    leadName, contact,
}) {
    const pkg = await store.getFixedPackage(String(packageId || ''));
    if (!pkg || pkg.active === false) throw httpError(404, 'الباقة غير موجودة أو أُغلقت.');
    const today = todayUtcStr();
    if (pkg.departDate <= today) throw httpError(400, 'هذه الانطلاقة انقضت — تصفّح الانطلاقات القادمة.');

    const name = String(leadName || '').trim().slice(0, MAX_NAME);
    if (!name) throw httpError(400, 'اسم قائد المجموعة (المسافر الرئيسي) مطلوب.');
    const email = String(contact?.email || '').trim();
    const phone = String(contact?.phone || '').trim();
    if (!email && !phone) throw httpError(400, 'وسيلة تواصل مطلوبة: بريد أو هاتف.');

    const q = priceFixedPackage(pkg, { adults, singles, children, pay }, today);

    const allocated = await store.allocateFixedSeats(pkg.id, q.seats);
    if (!allocated) {
        const fresh = await store.getFixedPackage(pkg.id);
        const left = fresh ? seatsLeft(fresh) : 0;
        throw httpError(409, left > 0
            ? `المقاعد المتبقية (${left}) لا تكفي طلبك (${q.seats}) — قلّل العدد أو انضم لقائمة الانتظار.`
            : 'اكتملت مقاعد هذه الانطلاقة — انضم لقائمة الانتظار وسنبلغك فور التوفّر.');
    }

    let booking;
    try {
        booking = await createBooking(store, {
            username, provider: 'fixed', kind: 'fixed_package',
            offer: {
                fixedPackageId: pkg.id,
                ...publicFixedPackage(pkg, today),
                party: { adults, singles, children },
                lines: q.lines,
            },
            passengers: [{ givenName: name, familyName: '', lead: true }],
            contact: { email: email || null, phone: phone || null },
            netAmount: q.netAmount, sellAmount: q.total, currency: q.currency,
        });
        const reference = 'FP-' + booking.id.slice(-6).toUpperCase();
        const issued = await transitionBooking(store, booking.id, 'issued', {
            bookingReference: reference,
            paymentPlan: {
                mode: q.pay, depositPct: q.depositPct,
                paidNow: q.paidNow, remaining: q.remaining, dueDate: q.dueDate,
            },
            seats: q.seats,
            namesDeadline: q.namesDeadline,
        });
        return { booking: issued || await getBooking(store, booking.id), quote: q };
    } catch (e) {
        // فشل ما بعد حجز المقاعد → تُعاد فوراً كي لا «تتبخر» سعة لم تُبَع
        await store.releaseFixedSeats(pkg.id, q.seats).catch(() => {});
        if (booking) {
            await transitionBooking(store, booking.id, 'failed', { error: e.message }).catch(() => {});
        }
        throw e;
    }
}

/**
 * إلغاء ذاتي — مسموح حتى موعد تسليم الأسماء (الإقلاع − ١٤ يوماً)
 * باسترداد كامل المدفوع. بعده تحكم شروط الناقل/الفندق فيُدار يدوياً.
 */
export async function cancelFixedPackageBooking({ store, username, bookingId }) {
    const booking = await getBooking(store, String(bookingId || ''));
    if (!booking || booking.username !== username || booking.kind !== 'fixed_package') {
        throw httpError(404, 'الحجز غير موجود.');
    }
    if (booking.status !== 'issued') throw httpError(400, 'الإلغاء متاح للحجوزات المُصدَرة فقط.');
    const dueDate = booking.paymentPlan?.dueDate
        || addDaysStr(booking.offer?.departDate || todayUtcStr(), -NAMES_DEADLINE_DAYS);
    if (todayUtcStr() > dueDate) {
        throw httpError(400, `انقضى موعد الإلغاء الذاتي (${dueDate}) — بعد تسليم الأسماء تحكم شروط الناقل والفندق. خاطب الدعم لإدارة الإلغاء.`);
    }
    const cancelled = await transitionBooking(store, booking.id, 'cancelled', {
        refund: { amount: booking.paymentPlan?.paidNow ?? booking.sellAmount, currency: booking.currency },
    });
    if (!cancelled) throw httpError(409, 'تعذّر الإلغاء — الحالة تغيّرت للتو. حدّث الصفحة.');
    const pkgId = booking.offer?.fixedPackageId;
    if (pkgId && booking.seats > 0) {
        await store.releaseFixedSeats(pkgId, booking.seats).catch(() => {});
    }
    return cancelled;
}
