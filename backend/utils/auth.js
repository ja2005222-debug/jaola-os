import jwt from 'jsonwebtoken';

export function getJwtSecret() {
    return process.env.JWT_SECRET || 'jaola-dev-secret-change-me';
}

export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Bearer token required' });
    }

    try {
        req.user = jwt.verify(token, getJwtSecret());
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}
