/**
 * 🔐 adminOnly — بوابة المسارات الإدارية
 *
 * يسمح فقط للمستخدمين المدرجين في ADMIN_USERS (قائمة أسماء مفصولة بفواصل)
 * أو من يحمل التوكن علامة isAdmin. يُوضع بعد verifyToken في سلسلة الحماية.
 *
 * ملاحظة أمنية: يعتمد على req.user المُثبت من verifyToken — لا يثق بأي
 * حقل قادم من جسم الطلب.
 */

const ADMIN_USERS = (process.env.ADMIN_USERS || '')
    .split(',')
    .map(u => u.trim().toLowerCase())
    .filter(Boolean);

export function isAdminUser(user) {
    if (!user) return false;
    if (user.isAdmin === true) return true;
    const uname = (user.username || '').toLowerCase();
    return ADMIN_USERS.includes(uname);
}

export function adminOnly(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'غير مصرح: التوكن مطلوب.' });
    }
    if (!isAdminUser(req.user)) {
        return res.status(403).json({ error: 'هذا المسار للمشرفين فقط.' });
    }
    next();
}

export default adminOnly;
