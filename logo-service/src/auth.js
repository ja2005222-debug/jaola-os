/**
 * 🔐 auth.js — الدخول الموحّد مع منصة JAOLA (بلا أي استيراد من backend/)
 *
 * نفس عقد video-service/src/auth.js حرفياً: الخدمة لا تُصدر توكنات —
 * تتحقق فقط من توكن المنصة بنفس JWT_SECRET (مع دعم تدوير السر).
 *
 * الإضافة الوحيدة هنا: buildOptionalToken — جوهر نموذج jalogo التسويقي:
 * الزائر المجهول يولّد مسودات بلا حساب (يُحدّ بالـIP)، ومن يحمل توكناً
 * صالحاً يُعامل كصاحب حساب (حدود أرحب + التنزيل النهائي). توكن تالف
 * لا يرفض الطلب — يسقط لحالة الزائر بصمت، فلا تنكسر الصفحة العامة
 * لمجرد توكن قديم في localStorage.
 */
import jwt from 'jsonwebtoken';

/** يتحقق من التوكن مقابل أكثر من سر (الحالي ثم السابق) — تدوير المفتاح بلا إخراج المستخدمين. */
export function verifyWithSecrets(token, secrets) {
    let lastError;
    for (const secret of secrets) {
        try { return jwt.verify(token, secret); } catch (e) { lastError = e; }
    }
    throw lastError || new Error('لا أسرار للتحقق.');
}

function normalizeSecrets(jwtSecret) {
    const secrets = (Array.isArray(jwtSecret) ? jwtSecret : [jwtSecret]).filter(Boolean);
    if (secrets.length === 0) throw new Error('JWT_SECRET مطلوب.');
    return secrets;
}

/** وسيط إلزامي: 401 بلا توكن صالح — للمسارات المحاسبية (النهائي، شعاراتي). */
export function buildVerifyToken(jwtSecret) {
    const secrets = normalizeSecrets(jwtSecret);
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

/** وسيط اختياري: يضع req.user إن وُجد توكن صالح، ويمضي زائراً إن لم يوجد أو تلف. */
export function buildOptionalToken(jwtSecret) {
    const secrets = normalizeSecrets(jwtSecret);
    return function optionalToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try { req.user = verifyWithSecrets(token, secrets); } catch { /* زائر */ }
        }
        next();
    };
}

/** محمول (predicate) لا وسيط: هل هذا المستخدم مشرف؟ — نفس دلالات المنصة. */
export function buildIsAdmin(adminUsersCsv) {
    const adminUsers = String(adminUsersCsv || '')
        .split(',')
        .map(u => u.trim().toLowerCase())
        .filter(Boolean);
    return function isAdmin(user) {
        if (!user) return false;
        const uname = (user.username || '').toLowerCase();
        return user.isAdmin === true || adminUsers.includes(uname);
    };
}

/** نفس دلالات adminOnly في المنصة: قائمة ADMIN_USERS أو علامة isAdmin في التوكن. */
export function buildAdminOnly(adminUsersCsv) {
    const isAdmin = buildIsAdmin(adminUsersCsv);
    return function adminOnly(req, res, next) {
        if (!req.user) {
            return res.status(401).json({ error: 'غير مصرح: التوكن مطلوب.' });
        }
        if (!isAdmin(req.user)) {
            return res.status(403).json({ error: 'هذا المسار للمشرفين فقط.' });
        }
        next();
    };
}
