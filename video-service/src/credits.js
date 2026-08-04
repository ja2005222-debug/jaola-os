/**
 * 💳 credits.js — قواعد الأرصدة (منطق أعمال نقي فوق المخزن)
 *
 * القاعدة الذهبية: كل تكلفة توليد متغيرة تُخصم من رصيد اشتراه/مُنحه
 * المستخدم مسبقاً — الخدمة لا تتحمل تكلفة مفتوحة أبداً.
 *
 * هذا الملف لا يعرف شيئاً عن طريقة التخزين (ملفات/Postgres) — يتحقق من
 * صحة المدخلات ويُطبّع أسماء المستخدمين ثم يفوّض للمخزن، الذي يضمن
 * ذرّية الخصم وعصمة الاسترداد من الازدواج.
 */

export { STARTER_CREDITS } from './store/index.js';

const MAX_GRANT = 100000;

function normalizeUser(username) {
    return String(username || '').trim().toLowerCase();
}

function validAmount(amount) {
    const value = Number(amount);
    return Number.isInteger(value) && value > 0 ? value : null;
}

export async function getBalance(store, username) {
    const user = normalizeUser(username);
    if (!user) return 0;
    return store.getBalance(user);
}

/** منح إداري — grantedBy إلزامي للتدقيق (من فعل ماذا). */
export async function grantCredits(store, { username, amount, grantedBy, note = null }) {
    const user = normalizeUser(username);
    const value = validAmount(amount);
    if (!user || !value || value > MAX_GRANT) return false;
    return store.grantCredits({ user, amount: value, grantedBy: String(grantedBy || ''), note });
}

/** خصم قبل إرسال أي مهمة — jobId إلزامي لربط الخصم بمهمة قابلة للتدقيق. */
export async function deductCredits(store, { username, amount, jobId }) {
    const user = normalizeUser(username);
    const value = validAmount(amount);
    if (!user || !jobId || !value) return false;
    return store.deductCredits({ user, amount: value, jobId });
}

/** استرداد عند فشل المهمة — فشل المزود لا يجوز أن يكلف المستخدم رصيداً. */
export async function refundCredits(store, { username, amount, jobId, reason = null }) {
    const user = normalizeUser(username);
    const value = validAmount(amount);
    if (!user || !jobId || !value) return false;
    return store.refundCredits({ user, amount: value, jobId, reason });
}

/** سجل حركات مستخدم واحد (الأحدث أولاً) — لواجهة "رصيدي". */
export async function getUserLedger(store, username, limit = 50) {
    const user = normalizeUser(username);
    if (!user) return [];
    return store.getUserLedger(user, limit);
}
