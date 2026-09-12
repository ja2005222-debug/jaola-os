const fail = code => { throw Object.assign(new Error(code), { status: 400, code }); };
export const DEFAULT_BOOKING_CONFIG = {
    timezone: 'UTC', resources: [{ id: 'main', name: 'الموظف الأول' }],
    services: [
        { id: 's1', name: 'قصّ وتصفيف', emoji: '💇', dur: 45, price: 80 },
        { id: 's2', name: 'حلاقة ذقن', emoji: '🧔', dur: 30, price: 50 },
        { id: 's3', name: 'استشارة طبية', emoji: '🩺', dur: 30, price: 150 },
        { id: 's4', name: 'جلسة تدليك', emoji: '💆', dur: 60, price: 200 },
    ],
    slots: ['10:00', '11:00', '12:00', '13:00', '16:00', '17:00', '18:00', '19:00'],
};
const idPattern = /^[a-zA-Z0-9_-]{1,40}$/;
export function validateBookingConfiguration(value) {
    if (!value || typeof value !== 'object' || typeof value.timezone !== 'string' || value.timezone.length > 80) fail('INVALID_CONFIGURATION');
    try { new Intl.DateTimeFormat('en', { timeZone: value.timezone }).format(); } catch { fail('INVALID_TIMEZONE'); }
    const clean = { timezone: value.timezone };
    for (const [kind, max] of [['resources', 20], ['services', 40]]) {
        const rows = value[kind];
        if (!Array.isArray(rows) || !rows.length || rows.length > max) fail('INVALID_' + kind.toUpperCase());
        const ids = new Set();
        clean[kind] = rows.map(row => {
            if (!row || !idPattern.test(row.id) || ids.has(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 80) fail('INVALID_' + kind.toUpperCase());
            ids.add(row.id);
            const result = { id: row.id, name: row.name.trim() };
            if (kind === 'services') {
                if (!Number.isInteger(row.dur) || row.dur < 5 || row.dur > 240 || !Number.isFinite(row.price) || row.price < 0 || row.price > 1000000) fail('INVALID_SERVICE');
                Object.assign(result, { dur: row.dur, price: Math.round(row.price * 100) / 100, emoji: typeof row.emoji === 'string' ? row.emoji.slice(0, 8) : '📅' });
            }
            return result;
        });
    }
    if (!Array.isArray(value.slots) || !value.slots.length || value.slots.length > 48 || value.slots.some(s => typeof s !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s))) fail('INVALID_SLOTS');
    clean.slots = [...new Set(value.slots)].sort();
    return clean;
}
function parts(time, timezone) {
    const values = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(time);
    return Object.fromEntries(values.map(p => [p.type, p.value]));
}
export function calendarDays(now, timezone, count = 7) {
    const p = parts(now, timezone);
    const midnight = Date.parse(`${p.year}-${p.month}-${p.day}T00:00:00Z`);
    return Array.from({ length: count }, (_, i) => new Date(midnight + i * 86400000).toISOString().slice(0, 10));
}
/** Convert wall time by offset correction; reject DST gaps instead of silently moving a booking. */
export function bookingInstant(date, slot, timezone) {
    const target = Date.parse(date + 'T' + slot + ':00Z');
    if (!Number.isFinite(target)) return NaN;
    let candidate = target;
    for (let i = 0; i < 4; i++) {
        const p = parts(candidate, timezone);
        const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
        if (wall === target) return candidate;
        candidate += target - wall;
    }
    return NaN;
}
export function overlapsBooking(booking, resource, start, end) {
    if (booking.status !== 'مؤكّد' || (booking.resource || 'main') !== resource) return false;
    const previousStart = booking.startsAt ?? Date.parse(booking.date + 'T' + booking.slot + ':00Z');
    const previousEnd = booking.endsAt ?? previousStart + 60 * 60000;
    return start < previousEnd && end > previousStart;
}
