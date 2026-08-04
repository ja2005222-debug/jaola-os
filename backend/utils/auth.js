import jwt from 'jsonwebtoken';

export function getJwtSecret() {
    return process.env.JWT_SECRET || 'jaola-dev-secret-change-me';
}

/**
 * 🔑 أسرار التحقق مرتَّبة: الحالي أولاً، ثم السابق إن وُجد.
 * التوقيع يستخدم الحالي دوماً؛ السابق يُقبل للتحقق فقط أثناء **تدوير
 * المفتاح**، فيُبدَّل السر بلا إخراج كل المستخدمين. يُزال
 * JWT_SECRET_PREVIOUS بعد انقضاء أطول صلاحية توكن (٧ أيام هنا).
 */
export function getJwtVerifySecrets() {
    return [getJwtSecret(), process.env.JWT_SECRET_PREVIOUS].filter(Boolean);
}

/** يتحقق مقابل كل الأسرار المقبولة — يُرجع الحمولة أو يرمي آخر خطأ. */
export function verifyJwt(token) {
    let lastError;
    for (const secret of getJwtVerifySecrets()) {
        try { return jwt.verify(token, secret); } catch (e) { lastError = e; }
    }
    throw lastError || new Error('No verification secret configured');
}

export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Bearer token required' });
    }

    try {
        req.user = verifyJwt(token);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}
