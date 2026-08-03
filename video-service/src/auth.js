/**
 * 🔐 auth.js — الدخول الموحّد مع منصة JAOLA (بلا أي استيراد من backend/)
 *
 * الخدمة لا تُصدر توكنات أبداً — تتحقق فقط من التوكن الصادر من المنصة
 * الرئيسية بنفس JWT_SECRET، فيعمل نفس تسجيل الدخول في الخدمتين.
 * العقد مطابق حرفياً لعقد backend/server.js (verifyToken) و
 * backend/middleware/adminOnly.js حتى لا يتباعد السلوك بين الخدمتين.
 */
import jwt from 'jsonwebtoken';

/** يبني وسيط التحقق — حقن السر بدل قراءته عالمياً ليسهل الاختبار. */
export function buildVerifyToken(jwtSecret) {
    return function verifyToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'غير مصرح: التوكن مفقود.' });
        }

        jwt.verify(token, jwtSecret, (err, user) => {
            if (err) {
                return res.status(401).json({ error: 'غير مصرح: التوكن منتهي أو غير صالح.' });
            }
            req.user = user;
            next();
        });
    };
}

/** نفس دلالات adminOnly في المنصة: قائمة ADMIN_USERS أو علامة isAdmin في التوكن. */
export function buildAdminOnly(adminUsersCsv) {
    const adminUsers = String(adminUsersCsv || '')
        .split(',')
        .map(u => u.trim().toLowerCase())
        .filter(Boolean);

    return function adminOnly(req, res, next) {
        if (!req.user) {
            return res.status(401).json({ error: 'غير مصرح: التوكن مطلوب.' });
        }
        const uname = (req.user.username || '').toLowerCase();
        if (req.user.isAdmin !== true && !adminUsers.includes(uname)) {
            return res.status(403).json({ error: 'هذا المسار للمشرفين فقط.' });
        }
        next();
    };
}
