import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { getDB } from './database.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// تسجيل المستخدم أو جلب بياناته بناءً على provider و providerId
export async function findOrCreateUser(profile, provider) {
    const db = getDB();
    const providerId = profile.id;
    const email = profile.emails?.[0]?.value;
    const username = profile.displayName || profile.username || email?.split('@')[0] || `${provider}_user`;
    const avatar = profile.photos?.[0]?.value;
    
    // البحث عن مستخدم موجود
    let user = db.prepare(`SELECT * FROM users WHERE provider = ? AND providerId = ?`).get(provider, providerId);
    
    if (!user && email) {
        // البحث عن مستخدم بنفس البريد الإلكتروني
        user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
        if (user) {
            // ربط حساب OAuth بالحساب الحالي
            db.prepare(`UPDATE users SET provider = ?, providerId = ?, avatar = ? WHERE id = ?`).run(provider, providerId, avatar, user.id);
        }
    }
    
    if (!user) {
        // إنشاء مستخدم جديد
        const id = crypto.randomUUID();
        db.prepare(`INSERT INTO users (id, username, email, provider, providerId, avatar, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
            id, username, email, provider, providerId, avatar, new Date().toISOString()
        );
        user = { id, username, email, provider, providerId, avatar };
    }
    
    // إنشاء JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user };
}

export function configurePassport(app) {
    app.use(passport.initialize());
    
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback'
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const result = await findOrCreateUser(profile, 'google');
            done(null, result);
        } catch (err) {
            done(err, null);
        }
    }));
    
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: '/api/auth/github/callback',
        scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const result = await findOrCreateUser(profile, 'github');
            done(null, result);
        } catch (err) {
            done(err, null);
        }
    }));
    
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));
}
