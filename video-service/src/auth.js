/**
 * 🔐 auth.js — الدخول الموحّد مع منصة JAOLA (بلا أي استيراد من backend/)
 *
 * الخدمة لا تُصدر توكنات أبداً — تتحقق فقط من التوكن الصادر من المنصة
 * الرئيسية بنفس JWT_SECRET، فيعمل نفس تسجيل الدخول في الخدمتين.
 * العقد مطابق حرفياً لعقد backend/server.js (verifyToken) و
 * backend/middleware/adminOnly.js حتى لا يتباعد السلوك بين الخدمتين.
 */
import jwt from 'jsonwebtoken';

/**
 * يتحقق من التوكن مقابل أكثر من سر (الحالي ثم السابق) — أساس **تدوير
 * المفتاح بلا إخراج المستخدمين**: خلال فترة التدوير تُقبل التوكنات
 * الموقّعة بالسر القديم، فيُبدَّل السر في النظامين بلا انقطاع، ثم يُزال
 * السر القديم بعد انقضاء أطول صلاحية توكن.
 * يُرجع الحمولة أو يرمي آخر خطأ.
 */
export function verifyWithSecrets(token, secrets) {
    let lastError;
    for (const secret of secrets) {
        try { return jwt.verify(token, secret); } catch (e) { lastError = e; }
    }
    throw lastError || new Error('لا أسرار للتحقق.');
}

/**
 * يبني وسيط التحقق — حقن السر بدل قراءته عالمياً ليسهل الاختبار.
 * يقبل سراً واحداً أو مصفوفة (الحالي أولاً ثم السابق للتدوير).
 */
export function buildVerifyToken(jwtSecret) {
    const secrets = (Array.isArray(jwtSecret) ? jwtSecret : [jwtSecret]).filter(Boolean);
    if (secrets.length === 0) throw new Error('JWT_SECRET مطلوب.');

    return function verifyToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'غير مصرح: التوكن مفقود.' });
        }

        try {
            req.user = verifyWithSecrets(token, secrets);
            next();
        } catch {
            return res.status(401).json({ error: 'غير مصرح: التوكن منتهي أو غير صالح.' });
        }
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
