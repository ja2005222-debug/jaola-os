/**
 * 📆 calendarFeed.js — تقويم الحجوزات: ملفّ واحد، ومصدرُ حقيقةٍ واحد.
 *
 * كان بناء ملفّ `.ics` يعيش في `public/index.html` وحده (تنزيلٌ لحجز
 * واحد). واشتراك التقويم يحتاج نفس المنطق على الخادم — ونسخُه هناك كان
 * سيخلق نسختين من قواعد RFC 5545 تتباعدان بصمت (وهو صنف العطب الذي
 * كلّفنا فعلاً في transitionBooking وفي قاموس التوطين). فنُقل المنطق
 * كلّه إلى هنا، وصارت الواجهة تطلب الملفّ من الخادم كما يطلبه التقويم.
 *
 * ميزتان فوق ذلك: التنزيل والاشتراك يخرجان **متطابقين** حتماً، ولغة
 * الوصف تتبع لغة الطالب في الحالتين.
 *
 * ⚠️ التوقيت «عائم» (بلا منطقة زمنية ولا Z) عن قصد: مواعيد الرحلات محلية
 * بمطاراتها، ولا نملك جدول مناطق زمنية للمطارات — فإلحاق Z كان سيزيح
 * الموعد ساعاتٍ عن الحقيقة. العائم يعرضه التقويم كما كُتب.
 */
import crypto from 'node:crypto';

// ─── 🔑 مفتاح التقويم: عشوائيٌّ مخزَّن في ملف المستخدم ─────────────────
//
// لماذا مخزَّن هنا بينما رابط المشاركة موقّع بلا حالة؟ لأن الاشتراك
// **يعيش سنين** في تقويم الهاتف، لا ساعاتٍ معدودة. رابطٌ طويل العمر بلا
// إلغاء خطرٌ حقيقي — فالمفتاح يُخزَّن ليُلغى: «جدّد الرابط» يولّد مفتاحاً
// جديداً فيموت القديم في اللحظة نفسها. والتخزين يتّسع له `profile_json`
// في المخزنين معاً بلا أي تغيير في العقد أو المخطّط.

export function newCalendarKey() {
    return crypto.randomBytes(16).toString('hex');
}

/** التوكن: اسم المستخدم مُرمَّزاً + المفتاح — لا حاجة لتوقيع فوق سرٍّ عشوائي. */
export function encodeFeedToken(username, key) {
    return `${Buffer.from(String(username), 'utf8').toString('base64url')}.${key}`;
}

/** يفكّ التوكن إلى `{ username, key }` أو null لأي صيغة تالفة. */
export function parseFeedToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    let username;
    try {
        username = Buffer.from(parts[0], 'base64url').toString('utf8');
    } catch {
        return null;
    }
    if (!username || !/^[0-9a-f]{32}$/.test(parts[1])) return null;
    return { username, key: parts[1] };
}

/** مقارنة ثابتة الزمن — المفتاح سرٌّ، فلا يُقارَن بـ===. */
export function calendarKeyMatches(expected, given) {
    if (typeof expected !== 'string' || typeof given !== 'string') return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── 📄 بناء ICS ────────────────────────────────────────────────────────

const icsEsc = s => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
// ⚠️ الفراغ يعود فراغاً لا أصفاراً: `padEnd` على سلسلة فارغة كان يعطي
// «000000000000000» — قيمةً *صادقة* فتمرّ من حارس المواعيد الناقصة أدناه،
// فيخرج حدثٌ في السنة صفر داخل تقويم المسافر. (كان هذا قائماً في نسخة
// المتصفح السابقة؛ كشفه اختبار «حجزٌ بلا تواريخ».)
const icsLocal = iso => {
    const raw = String(iso || '').replace(/[-:]/g, '').slice(0, 15);
    return raw ? raw.padEnd(15, '0') : '';
};
const icsDate = d => String(d || '').replace(/-/g, '');

/**
 * RFC 5545: أسطر مطويّة، والتالي منها يبدأ بمسافة. القطع لا يقع بين
 * نصفَي رمز تعبيري (زوج بديل) وإلا خرج حرفٌ مكسور في ملف التقويم.
 */
export function icsFold(line) {
    const chunks = [];
    let s = String(line), limit = 73;
    while (s.length > limit) {
        let cut = limit;
        if (/[\uD800-\uDBFF]/.test(s[cut - 1])) cut -= 1;
        chunks.push(s.slice(0, cut));
        s = s.slice(cut);
        limit = 72; // الأسطر التالية تُصدَّر بمسافة فينقص المتاح حرفاً
    }
    chunks.push(s);
    return chunks.map((c, i) => (i ? ' ' + c : c)).join('\r\n');
}

const T = (lang, ar, en) => (lang === 'en' ? en : ar);

/**
 * مواعيد حجزٍ واحد كأحداث مجرّدة (بلا نصّ ICS) — الرحلة متعددة الشرائح
 * تعطي حدثاً لكل شريحة، والفندق/الباقة حدثاً ممتداً بأيام كاملة.
 * تُرجع [] لحجزٍ بلا تواريخ صالحة، فلا يُكتب VEVENT فارغ.
 */
export function bookingEvents(b, lang = 'ar') {
    const ref = b.bookingReference ? ` (${b.bookingReference})` : '';
    const tail = T(lang, 'التوقيت محلي بمكانه. عبر جولا ترافل.', 'Times are local to the location. Via JAOLA Travel.');
    const o = b.offer || {};
    const out = [];
    const add = (uid, summary, start, end, allDay, desc, loc) => {
        if (!start || !end) return; // موعدٌ ناقص لا يصير حدثاً مشوّهاً
        out.push({ uid, summary, start, end, allDay, desc, loc: loc || '' });
    };

    if (b.kind === 'stay') {
        add(b.id, `🏨 ${o.name || ''}${ref}`, icsDate(o.checkInDate), icsDate(o.checkOutDate), true,
            `${o.roomName || ''}\n${tail}`, o.city);
    } else if (b.kind === 'fixed_package') {
        if (o.departDate) {
            const end = new Date(new Date(o.departDate + 'T00:00:00Z').getTime() + (Number(o.nights) || 1) * 86400000);
            add(b.id, `🎒 ${o.title || ''}${ref}`, icsDate(o.departDate), icsDate(end.toISOString().slice(0, 10)), true,
                `${o.hotelName || ''}\n${tail}`, o.city);
        }
    } else if (b.kind === 'car') {
        add(b.id, `🚗 ${o.vehicleName || ''}${ref}`, icsLocal(o.pickUpAt), icsLocal(o.dropOffAt || o.pickUpAt), false,
            `${o.supplier || ''}\n${tail}`, o.pickupLocation);
    } else {
        const slices = o.flight?.slices || o.slices || [];
        const owner = o.owner || o.flight?.owner || '';
        const checkIn = T(lang,
            'تسجيل الوصول يفتح لدى الناقل قبل الإقلاع بـ24–48 ساعة.',
            'Airline check-in opens 24–48 hours before departure.');
        slices.forEach((s, i) => {
            const nums = (s.segments || []).map(g => `${g.carrier} ${g.flightNumber}`).join(' → ');
            add(`${b.id}-${i}`, `✈️ ${s.origin} → ${s.destination}${ref}`,
                icsLocal(s.departAt), icsLocal(s.arriveAt), false,
                `${owner}\n${nums}\n${checkIn}\n${tail}`, s.origin);
        });
    }
    return out;
}

function eventBlock(ev, stamp) {
    return [
        'BEGIN:VEVENT',
        `UID:${ev.uid}@jaola.travel`,
        `DTSTAMP:${stamp}`,
        ev.allDay ? `DTSTART;VALUE=DATE:${ev.start}` : `DTSTART:${ev.start}`,
        ev.allDay ? `DTEND;VALUE=DATE:${ev.end}` : `DTEND:${ev.end}`,
        icsFold(`SUMMARY:${icsEsc(ev.summary)}`),
        icsFold(`DESCRIPTION:${icsEsc(ev.desc)}`),
        ev.loc ? icsFold(`LOCATION:${icsEsc(ev.loc)}`) : '',
        'END:VEVENT',
    ].filter(Boolean).join('\r\n');
}

const nowStamp = now => new Date(now).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

/** ملفّ تقويم لحجزٍ واحد (زرّ «أضف للتقويم») — null إن لا مواعيد فيه. */
export function bookingIcs(b, { lang = 'ar', now = Date.now() } = {}) {
    const events = bookingEvents(b, lang);
    if (events.length === 0) return null;
    return wrapCalendar(events.map(e => eventBlock(e, nowStamp(now))));
}

/**
 * تغذية الاشتراك: كل حجوزات المستخدم في ملفّ واحد يُعاد جلبه دورياً.
 *
 * المُلغى والفاشل **يُستبعدان**: التقويم يعرض ما سيحدث، وإبقاء رحلةٍ
 * ملغاة فيه أسوأ من غيابها. وحذفُها من التغذية يجعل التقويم يزيلها
 * تلقائياً عند التحديث التالي — وهذا نصف قيمة الاشتراك أصلاً.
 *
 * `X-WR-CALNAME` و`REFRESH-INTERVAL` غير قياسيتين لكنهما ما تقرؤه تطبيقات
 * التقويم فعلاً لتسمية التقويم وتحديد وتيرة التحديث.
 */
export function buildFeedIcs(bookings, { lang = 'ar', now = Date.now() } = {}) {
    const stamp = nowStamp(now);
    const blocks = [];
    for (const b of bookings || []) {
        if (b.status !== 'issued' && b.status !== 'pending') continue;
        for (const ev of bookingEvents(b, lang)) blocks.push(eventBlock(ev, stamp));
    }
    return wrapCalendar(blocks, {
        name: T(lang, 'رحلاتي — جولا ترافل', 'My trips — JAOLA Travel'),
    });
}

function wrapCalendar(blocks, { name = null } = {}) {
    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//JAOLA Travel//AR//',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        ...(name ? [icsFold(`X-WR-CALNAME:${icsEsc(name)}`), 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H'] : []),
        ...blocks,
        'END:VCALENDAR',
    ].join('\r\n');
}
