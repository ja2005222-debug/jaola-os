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
 */
(function () {
    const DAY = 86400000;
    const dayOf = v => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);
    const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

    /** المدى الزمني للحجز — null لما لا موعد له (فلا يُجمَع). */
    function bookingSpan(b) {
        if (!b) return null;
        const kind = b.kind || 'flight';
        if (kind === 'stay') {
            const from = dayOf(b.offer?.checkInDate), to = dayOf(b.offer?.checkOutDate);
            return from ? { from, to: to || from } : null;
        }
        if (kind === 'car') {
            const from = dayOf(b.offer?.pickUpAt) || dayOf(b.offer?.pickupDate);
            const to = dayOf(b.offer?.dropOffAt) || dayOf(b.offer?.dropoffDate);
            return from ? { from, to: to || from } : null;
        }
        if (kind === 'fixed_package') {
            const from = dayOf(b.offer?.departDate);
            const nights = Number(b.offer?.nights);
            return from ? { from, to: Number.isFinite(nights) ? addDays(from, nights) : from } : null;
        }
        // طيران وباقة حيّة: أول إقلاع → آخر وصول
        const slices = b.offer?.flight?.slices || b.offer?.slices || [];
        const from = dayOf(slices[0]?.departAt);
        const last = slices[slices.length - 1] || {};
        const to = dayOf(last.arriveAt) || dayOf(last.departAt) || from;
        return from ? { from, to } : null;
    }

    /**
     * وجهة الحجز: `code` للمطابقة و`label` للعرض.
     *
     * ⚠️ الفصل بينهما ليس تجميلاً: الطيران يعرف وجهته برمز المطار (DXB)
     * والفندق يعرفها باسم المدينة (دبي)، فمقارنةُ النصوص كانت تُظهر
     * «سفرة دبي · DXB» لمكانٍ واحد. المطابقة بالرمز حين يتوفر، والعرض
     * باسم المدينة حين يتوفر — وإلا فالرمز.
     */
    function destinationOf(b) {
        const kind = b?.kind || 'flight';
        if (kind === 'stay') {
            return { code: b.offer?.iata || b.offer?.city || '', label: b.offer?.city || b.offer?.iata || '' };
        }
        if (kind === 'car') {
            return { code: b.offer?.iata || b.offer?.pickupLocation || '', label: b.offer?.pickupLocation || b.offer?.iata || '' };
        }
        if (kind === 'fixed_package') {
            return { code: b.offer?.iata || b.offer?.city || '', label: b.offer?.city || b.offer?.iata || '' };
        }
        const slices = b?.offer?.flight?.slices || b?.offer?.slices || [];
        const dest = slices[0]?.destination || '';
        return { code: dest, label: dest };
    }

    /** وجهة الحجز كما تُعرض في عنوان السفرة. */
    function bookingDestination(b) {
        return destinationOf(b).label;
    }

    /** أسماء وجهات السفرة بلا تكرار — رمزٌ واحد يظهر مرة باسم مدينته. */
    function tripDestinations(items) {
        const byCode = new Map();
        for (const b of items || []) {
            const { code, label } = destinationOf(b);
            if (!code) continue;
            const isCode = /^[A-Z]{3}$/.test(label);
            // اسم المدينة يتقدّم على الرمز لنفس الوجهة
            if (!byCode.has(code) || (isCode === false && /^[A-Z]{3}$/.test(byCode.get(code)))) {
                byCode.set(code, label);
            }
        }
        const labels = [...byCode.values()];
        // ⚠️ الفنادق لا تحمل رمز مطار أصلاً (تعرف مكانها بالمدينة فقط)،
        // فالرمز والمدينة يبقيان مفتاحين مختلفين لمكانٍ واحد. وداخل سفرة
        // واحدة (مواعيد متداخلة) المكان واحدٌ عملياً — فيُعرض اسم المدينة
        // ويُطوى الرمز. الثمن المقبول: سفرةٌ بمدينتين مختلفتين إحداهما بلا
        // اسم مدينة تُعرض بمدينتها المعروفة — وتفاصيل كل حجز في بطاقته.
        const cities = labels.filter(l => !/^[A-Z]{3}$/.test(l));
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
        for (const b of bookings || []) {
            const span = GROUPABLE.has(b.status) ? bookingSpan(b) : null;
            if (span) dated.push({ b, span });
            else loose.push(b);
        }
        dated.sort((x, y) => (x.span.from < y.span.from ? -1 : x.span.from > y.span.from ? 1 : 0));

        const groups = [];
        for (const entry of dated) {
            const g = groups[groups.length - 1];
            // التلامس يُقاس على نهاية المجموعة كاملةً لا على آخر عنصر أُضيف
            if (g && entry.span.from <= addDays(g.to, gapDays)) {
                g.items.push(entry.b);
                if (entry.span.to > g.to) g.to = entry.span.to;
            } else {
                groups.push({ from: entry.span.from, to: entry.span.to, items: [entry.b] });
            }
        }
        return { groups, loose };
    }

    window.JAOLA_TRIPS = { bookingSpan, bookingDestination, destinationOf, tripDestinations, groupTrips };
})();
