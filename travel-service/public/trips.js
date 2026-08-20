/**
 * 🧳 trips.js — تجميع الحجوزات المتفرّقة في «رحلات»
 *
 * المشكلة التي يحلّها: المسافر يحجز طيراناً وفندقاً وسيارة لسفرةٍ واحدة،
 * فتظهر ثلاث بطاقات متجاورة بلا رابط بينها — وترتيبها بالأحدث حجزاً لا
 * بالأقرب سفراً، فتضيع السفرة القادمة بين حجوزات قديمة. هنا تُجمع
 * الحجوزات المتداخلة زمنياً في سفرة واحدة بخط زمني ومهلة عدّ تنازلي.
 *
 * ⚠️ منطق نقيّ بلا DOM ولا شبكة عمداً: يُختبر في Node كما يُختبر i18n.js،
 * لأن قاعدة التجميع (التداخل الزمني) هي الموضع الذي يخطئ فيه التقدير
 * لا الرسم — سفرتان متتاليتان بيومٍ بينهما ليستا سفرة واحدة.
 *
 * القاعدة: حجزان في سفرة واحدة إن تداخل مداهما الزمنيان أو تلامسا خلال
 * `gapDays` (يوم افتراضاً — رحلة تصل ليلاً وفندق يبدأ صباح الغد).
 * والمُلغى/الفاشل لا يُجمَع: لا سفرة فيه، ووجوده يوسّع المدى بلا معنى.
 *
 * 🧩 قراءة الحقول بجدولٍ لكل نوع لا بسلسلة شروط: الأنواع تتكاثر (طيران،
 * فندق، سيارة، باقتان) وكل واحد يسمّي مواعيده ووجهته باسمه هو، فسلسلة
 * `if` كانت تتضخّم تعقيداً مع كل نوع جديد.
 */
(function () {
    const DAY = 86400000;
    const IATA_RE = /^[A-Z]{3}$/;
    const dayOf = value => (typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : null);
    const addDays = (day, count) => new Date(Date.parse(`${day}T00:00:00Z`) + count * DAY).toISOString().slice(0, 10);
    const firstOf = (...values) => values.find(v => v) || '';
    const slicesOf = booking => booking?.offer?.flight?.slices || booking?.offer?.slices || [];

    /**
     * لكل نوع: كيف يقرأ مداه الزمني ووجهته.
     * `span` يعيد {from,to} أو null، و`place` يعيد {code,label} — والفصل
     * بين الرمز والاسم ليس تجميلاً: الطيران يعرف وجهته برمز المطار (DXB)
     * والفندق باسم المدينة (دبي)، فمقارنةُ النصوص كانت تُظهر «دبي · DXB»
     * لمكانٍ واحد. المطابقة بالرمز حين يتوفر، والعرض بالاسم حين يتوفر.
     */
    const KINDS = {
        stay: {
            span: o => ({ from: dayOf(o.checkInDate), to: dayOf(o.checkOutDate) }),
            place: o => ({ code: firstOf(o.iata, o.city), label: firstOf(o.city, o.iata) }),
        },
        car: {
            span: o => ({ from: dayOf(o.pickUpAt) || dayOf(o.pickupDate), to: dayOf(o.dropOffAt) || dayOf(o.dropoffDate) }),
            place: o => ({ code: firstOf(o.iata, o.pickupLocation), label: firstOf(o.pickupLocation, o.iata) }),
        },
        fixed_package: {
            span: (o) => {
                const from = dayOf(o.departDate);
                const nights = Number(o.nights);
                return { from, to: from && Number.isFinite(nights) ? addDays(from, nights) : from };
            },
            place: o => ({ code: firstOf(o.iata, o.city), label: firstOf(o.city, o.iata) }),
        },
        // الطيران والباقة الحيّة: أول إقلاع → آخر وصول
        flight: {
            span: (o, booking) => {
                const slices = slicesOf(booking);
                const last = slices[slices.length - 1] || {};
                return { from: dayOf(slices[0]?.departAt), to: dayOf(last.arriveAt) || dayOf(last.departAt) };
            },
            place: (o, booking) => {
                const dest = slicesOf(booking)[0]?.destination || '';
                return { code: dest, label: dest };
            },
        },
    };
    const handlerFor = booking => KINDS[booking?.kind] || KINDS.flight;

    /** المدى الزمني للحجز — null لما لا موعد له (فلا يُجمَع). */
    function bookingSpan(booking) {
        if (!booking) return null;
        const { from, to } = handlerFor(booking).span(booking.offer || {}, booking);
        return from ? { from, to: to || from } : null;
    }

    /** وجهة الحجز: `code` للمطابقة و`label` للعرض. */
    function destinationOf(booking) {
        return handlerFor(booking).place(booking?.offer || {}, booking);
    }

    /** وجهة الحجز كما تُعرض في عنوان السفرة. */
    function bookingDestination(booking) {
        return destinationOf(booking).label;
    }

    /** أسماء وجهات السفرة بلا تكرار — رمزٌ واحد يظهر مرة باسم مدينته. */
    function tripDestinations(items) {
        const byCode = new Map();
        for (const booking of items || []) {
            const { code, label } = destinationOf(booking);
            if (!code) continue;
            const known = byCode.get(code);
            // اسم المدينة يتقدّم على الرمز لنفس الوجهة
            if (known === undefined || (IATA_RE.test(known) && !IATA_RE.test(label))) byCode.set(code, label);
        }
        const labels = [...byCode.values()];
        // ⚠️ الفنادق لا تحمل رمز مطار أصلاً (تعرف مكانها بالمدينة فقط)،
        // فالرمز والمدينة يبقيان مفتاحين مختلفين لمكانٍ واحد. وداخل سفرة
        // واحدة (مواعيد متداخلة) المكان واحدٌ عملياً — فيُعرض اسم المدينة
        // ويُطوى الرمز. الثمن المقبول: سفرةٌ بمدينتين إحداهما بلا اسم
        // تُعرض بمدينتها المعروفة — وتفاصيل كل حجز في بطاقته.
        const cities = labels.filter(label => !IATA_RE.test(label));
        return cities.length ? cities : labels;
    }

    const GROUPABLE = new Set(['issued', 'pending']);

    /**
     * يجمع الحجوزات في سفرات مرتّبة بالأقرب موعداً.
     * كل مجموعة: { from, to, items } — ومجموعةٌ بعنصر واحد تبقى كما هي
     * (لا نُلبس حجزاً مفرداً ثوب «سفرة» ونضيف ضجيجاً بلا فائدة).
     */
    function groupTrips(bookings, { gapDays = 1 } = {}) {
        const dated = [];
        const loose = [];
        for (const booking of bookings || []) {
            const span = GROUPABLE.has(booking?.status) ? bookingSpan(booking) : null;
            if (span) dated.push({ booking, span });
            else loose.push(booking);
        }
        dated.sort((a, b) => a.span.from.localeCompare(b.span.from));

        const groups = [];
        for (const entry of dated) {
            const current = groups[groups.length - 1];
            // التلامس يُقاس على نهاية المجموعة كاملةً لا على آخر عنصر أُضيف
            if (current && entry.span.from <= addDays(current.to, gapDays)) {
                current.items.push(entry.booking);
                if (entry.span.to > current.to) current.to = entry.span.to;
            } else {
                groups.push({ from: entry.span.from, to: entry.span.to, items: [entry.booking] });
            }
        }
        return { groups, loose };
    }

    window.JAOLA_TRIPS = { bookingSpan, bookingDestination, destinationOf, tripDestinations, groupTrips };
})();
