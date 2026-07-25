/**
 * 📡 قنوات النشر الإضافية — فيسبوك (صفحة Meta) و X — (وكلاء القنوات ٣ب).
 *
 * نفس عقد تيليجرام: توكنات المستخدم تُخزَّن مشفّرة (secretVault) في ملف
 * تكاملاته، لا تُعاد للواجهة أبداً، وتُفكّ لحظة الاستدعاء فقط.
 *
 * - فيسبوك: Page ID + Page Access Token → POST /{page}/feed (بلا OAuth تفاعلي).
 * - X: مفاتيح المطوّر الأربعة للمستخدم → POST /2/tweets بتوقيع OAuth 1.0a
 *   (HMAC-SHA1 عبر crypto — بلا اعتماديات).
 * - واتساب: لا تدعم واجهتها العامة النشر لقناة — تُخدم بزرّ مشاركة في الواجهة.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encryptSecret, decryptSecret } from '../utils/secretVault.js';

const FB_API = 'https://graph.facebook.com/v19.0';
const X_API = 'https://api.twitter.com/2/tweets';

const fileOf = (dir, user) => path.join(dir, String(user || '').replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
const readAll = (dir, user) => { try { return JSON.parse(fs.readFileSync(fileOf(dir, user), 'utf8')) || {}; } catch { return {}; } };
const writeAll = (dir, user, obj) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(fileOf(dir, user), JSON.stringify(obj)); };

// ── فيسبوك (صفحة) ───────────────────────────────────────────────────
export function saveFacebookConfig(dir, user, { pageId, pageToken, pageName }) {
    const all = readAll(dir, user);
    all.facebook = { pageId: String(pageId).trim(), tokenEnc: encryptSecret(String(pageToken).trim()), pageName: String(pageName || '').slice(0, 80) };
    writeAll(dir, user, all);
    return { ok: true };
}
export function deleteFacebookConfig(dir, user) {
    const all = readAll(dir, user); delete all.facebook; writeAll(dir, user, all); return { ok: true };
}

/** يتحقق أن التوكن يصل للصفحة ويعيد اسمها. */
export async function checkFacebookToken(pageId, pageToken, deps = {}) {
    const fetchImpl = deps.fetchImpl || fetch;
    try {
        const r = await fetchImpl(`${FB_API}/${encodeURIComponent(pageId)}?fields=name&access_token=${encodeURIComponent(pageToken)}`);
        const d = await r.json().catch(() => ({}));
        if (d.error || !d.name) return { error: 'توكن الصفحة غير صالح أو لا يملك صلاحيتها — استخرجه من Meta Business Suite.' };
        return { ok: true, pageName: d.name };
    } catch (e) { return { error: 'تعذّر الوصول لفيسبوك: ' + e.message }; }
}

export async function sendFacebookPost(dir, user, text, deps = {}) {
    const fetchImpl = deps.fetchImpl || fetch;
    const c = readAll(dir, user).facebook;
    if (!c?.tokenEnc || !c?.pageId) return { error: 'فيسبوك غير مربوط.', notConfigured: true };
    let token; try { token = decryptSecret(c.tokenEnc); } catch { return { error: 'تعذّر فكّ توكن الصفحة.' }; }
    const message = String(text || '').slice(0, 5000);
    if (!message.trim()) return { error: 'النص فارغ.' };
    try {
        const r = await fetchImpl(`${FB_API}/${encodeURIComponent(c.pageId)}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, access_token: token }),
        });
        const d = await r.json().catch(() => ({}));
        if (d.error || !d.id) return { error: `رفض فيسبوك النشر (${d.error?.message || r.status}).` };
        return { ok: true };
    } catch (e) { return { error: 'تعذّر الوصول لفيسبوك: ' + e.message }; }
}

// ── X (تغريدة عبر مفاتيح المستخدم — OAuth 1.0a) ─────────────────────
export function saveXConfig(dir, user, { apiKey, apiSecret, accessToken, accessSecret }) {
    const vals = [apiKey, apiSecret, accessToken, accessSecret].map(v => String(v || '').trim());
    if (vals.some(v => v.length < 10)) return { error: 'المفاتيح الأربعة مطلوبة (من X Developer Portal).' };
    const all = readAll(dir, user);
    all.x = { enc: encryptSecret(JSON.stringify({ k: vals[0], s: vals[1], t: vals[2], ts: vals[3] })) };
    writeAll(dir, user, all);
    return { ok: true };
}
export function deleteXConfig(dir, user) {
    const all = readAll(dir, user); delete all.x; writeAll(dir, user, all); return { ok: true };
}

// ترميز RFC3986 الصارم الذي يتطلبه توقيع OAuth1
const enc3986 = (s) => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** رأس Authorization بتوقيع OAuth 1.0a لطلب POST بلا معاملات query. */
export function oauth1Header(url, method, { k, s, t, ts }, { nonce, timestamp } = {}) {
    const p = {
        oauth_consumer_key: k,
        oauth_nonce: nonce || crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
        oauth_token: t,
        oauth_version: '1.0',
    };
    const paramStr = Object.keys(p).sort().map(key => `${enc3986(key)}=${enc3986(p[key])}`).join('&');
    const base = [method.toUpperCase(), enc3986(url), enc3986(paramStr)].join('&');
    const signingKey = `${enc3986(s)}&${enc3986(ts)}`;
    p.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
    return 'OAuth ' + Object.keys(p).sort().map(key => `${enc3986(key)}="${enc3986(p[key])}"`).join(', ');
}

export async function sendXPost(dir, user, text, deps = {}) {
    const fetchImpl = deps.fetchImpl || fetch;
    const c = readAll(dir, user).x;
    if (!c?.enc) return { error: 'X غير مربوط.', notConfigured: true };
    let creds; try { creds = JSON.parse(decryptSecret(c.enc)); } catch { return { error: 'تعذّر فكّ مفاتيح X.' }; }
    const body = { text: String(text || '').slice(0, 280) };
    if (!body.text.trim()) return { error: 'النص فارغ.' };
    try {
        const r = await fetchImpl(X_API, {
            method: 'POST',
            headers: { Authorization: oauth1Header(X_API, 'POST', creds), 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const d = await r.json().catch(() => ({}));
        if (!d?.data?.id) return { error: `رفض X النشر (${d?.detail || d?.title || r.status}) — تحقق من صلاحيات المفاتيح (Read and Write).` };
        return { ok: true };
    } catch (e) { return { error: 'تعذّر الوصول لـ X: ' + e.message }; }
}

/** حالة كل القنوات للواجهة — بلا أي توكنات. */
export function channelsStatus(dir, user) {
    const all = readAll(dir, user);
    return {
        telegram: all.telegram?.tokenEnc ? { configured: true, chatId: all.telegram.chatId, botName: all.telegram.botName || null } : { configured: false },
        facebook: all.facebook?.tokenEnc ? { configured: true, pageId: all.facebook.pageId, pageName: all.facebook.pageName || null } : { configured: false },
        x: all.x?.enc ? { configured: true } : { configured: false },
    };
}
