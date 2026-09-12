import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { storeKey } from './storeKey.js';

const secretFor = secret => crypto.createHash('sha256').update('jaola-project-session:' + secret).digest('hex');
export function credentialVersion(dir, user, project) {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, storeKey(user, project) + '.json'), 'utf8'));
        if (typeof data.hash !== 'string' || !data.hash.startsWith('$2')) return null;
        return crypto.createHash('sha256').update(data.hash).digest('hex');
    } catch { return null; }
}
export function issueProjectSession(dir, user, project, secret) {
    const version = credentialVersion(dir, user, project);
    if (!version || !secret) throw new Error('Project credentials not configured');
    return jwt.sign({ user, project, version, role: 'project-admin' }, secretFor(secret), {
        algorithm: 'HS256', audience: 'jaola-project-data', issuer: 'jaola', expiresIn: '1h',
    });
}
export function verifyProjectSession(token, dir, user, project, secret) {
    try {
        if (!secret) return null;
        const claims = jwt.verify(token, secretFor(secret), { algorithms: ['HS256'], audience: 'jaola-project-data', issuer: 'jaola' });
        const version = credentialVersion(dir, user, project);
        return version && claims.user === user && claims.project === project && claims.version === version && claims.role === 'project-admin' ? claims : null;
    } catch { return null; }
}
export function projectSessionGuard({ dir, secret, verifyProjectToken }) {
    return (req, res, next) => {
        const identity = verifyProjectToken(req.body?.token || req.query?.token);
        const session = String(req.headers.authorization || '').replace(/^Bearer /, '');
        if (!identity?.u || !identity?.p || !verifyProjectSession(session, dir, identity.u, identity.p, secret)) {
            return res.status(401).json({ error: 'Project login required', code: 'PROJECT_LOGIN_REQUIRED' });
        }
        req.projectSession = { user: identity.u, project: identity.p, role: 'project-admin' };
        next();
    };
}
