/**
 * 🛠️ Site CMS — لوحة تحكم لموقع العميل المولَّد (يديرها العميل، لا أدمِن جولا)
 *
 * يمكّن عميل الموقع (متجر/شركة) من إدارة محتواه بنفسه: نصوص، صور، ومنتجات —
 * محميّاً بكلمة مرور خاصة بالموقع (منفصلة عن حساب جولا). التعديلات تُحفظ في
 * lib/content.js ويُعاد توليد الموقع الثابت. هذه الوحدة **منطق نقيّ قابل للاختبار**
 * (تجزئة كلمة المرور، توكن موقّع، دمج تعديل بقائمة سماح، وفكّ/حفظ الصور).
 *
 * ملاحظة صادقة: هذا CMS مُدار عبر خادم جولا (يعمل فوراً في المعاينة/الاستضافة على
 * جولا). المتجر المستقل الكامل (طلبات/دفع/DB) مسار قالب vercel/commerce.
 */

import crypto from 'crypto';

const MAX_ASSET_BYTES = 4 * 1024 * 1024;   // 4MB لكل صورة
const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
const str = (v, max = 300) => String(v ?? '').slice(0, max);

// ── كلمة مرور الموقع (scrypt، ملح لكل كلمة) ─────────────────────────
export function hashPassword(pw) {
    const salt = crypto.randomBytes(16).toString('hex');
    const h = crypto.scryptSync(String(pw || ''), salt, 32).toString('hex');
    return `${salt}:${h}`;
}
export function verifyPassword(pw, stored) {
    if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
    const [salt, h] = stored.split(':');
    try {
        const c = crypto.scryptSync(String(pw || ''), salt, 32).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(c, 'hex'));
    } catch { return false; }
}

// ── توكن موقّع لجلسة العميل (HMAC، بلا اعتماد خارجي) ────────────────
const b64u = (buf) => Buffer.from(buf).toString('base64url');
export function signSiteToken({ user, project }, secret, ttlSec = 60 * 60 * 8) {
    const payload = b64u(JSON.stringify({ u: user, p: project, exp: Math.floor(Date.now() / 1000) + ttlSec }));
    const sig = crypto.createHmac('sha256', String(secret)).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}
export function verifySiteToken(token, secret) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const expect = crypto.createHmac('sha256', String(secret)).update(payload).digest('base64url');
    if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
        return { user: data.u, project: data.p };
    } catch { return null; }
}

// ── منتج واحد مُنقّى ────────────────────────────────────────────────
export function sanitizeProduct(p = {}) {
    return {
        name: str(p.name, 120),
        price: str(p.price, 40),
        desc: str(p.desc, 400),
        image: str(p.image, 400),
    };
}

// ── دمج تعديل بقائمة سماح صارمة (لا يلمس routes/بنية الموقع) ─────────
export function applyContentPatch(content, patch = {}) {
    const out = { ...(content || {}) };
    if (patch.brand != null) out.brand = str(patch.brand, 120);
    if (patch.hero && typeof patch.hero === 'object') {
        out.hero = { ...(out.hero || {}) };
        for (const k of ['title', 'subtitle', 'cta1', 'cta2', 'image']) if (patch.hero[k] != null) out.hero[k] = str(patch.hero[k], 400);
    }
    if (patch.footer && typeof patch.footer === 'object') {
        out.footer = { ...(out.footer || {}) };
        if (patch.footer.rights != null) out.footer.rights = str(patch.footer.rights, 200);
    }
    if (patch.sections && typeof patch.sections === 'object') {
        out.sections = { ...(out.sections || {}) };
        for (const key of Object.keys(patch.sections)) {
            if (!out.sections[key]) continue;                 // لا يُنشئ أقساماً جديدة (بنية ثابتة)
            const s = patch.sections[key], cur = out.sections[key];
            out.sections[key] = {
                heading: s.heading != null ? str(s.heading, 160) : cur.heading,
                subheading: s.subheading != null ? str(s.subheading, 300) : cur.subheading,
                items: Array.isArray(s.items)
                    ? s.items.slice(0, 24).map((it) => ({ title: str(it.title, 120), desc: str(it.desc, 400), image: str(it.image, 400) }))
                    : cur.items,
            };
        }
    }
    if (Array.isArray(patch.products)) {
        out.products = patch.products.slice(0, 200).map(sanitizeProduct);
    }
    return out;
}

// ── فكّ صورة data:URL والتحقّق منها ─────────────────────────────────
export function decodeDataUrl(dataUrl) {
    const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(String(dataUrl || ''));
    if (!m) return { error: 'صيغة غير صالحة' };
    const ext = MIME_EXT[m[1].toLowerCase()];
    if (!ext) return { error: 'نوع صورة غير مدعوم' };
    let buf;
    try { buf = Buffer.from(m[2], 'base64'); } catch { return { error: 'ترميز غير صالح' }; }
    if (!buf.length) return { error: 'ملف فارغ' };
    if (buf.length > MAX_ASSET_BYTES) return { error: 'الصورة كبيرة جداً (>4MB)' };
    return { mime: m[1], ext, buf };
}

// اسم ملف آمن للصورة (بلا مسارات/أحرف خطيرة)
export function safeAssetName(name, ext) {
    const base = String(name || 'img').toLowerCase().replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'img';
    return `${base}-${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}.${ext}`;
}
