/**
 * 🔐 Secret Vault — تشفير التوكنات الحساسة (GitHub PAT) قبل حفظها في DB
 *
 * AES-256-GCM مع مفتاح مشتق من PAT_ENCRYPTION_KEY (أو JWT_SECRET كاحتياط).
 * الصيغة المخزنة: iv:authTag:ciphertext (hex) — لم تتغيّر.
 *
 * 🔴 الاحتياطُ كان في الكتابة وحدها. فمن أقلع بـ`JWT_SECRET` ثمّ أضاف
 *    `PAT_ENCRYPTION_KEY` — وهو ما يطلبه `systemDoctorAgent` صراحةً —
 *    فقد كلَّ سرٍّ مخزَّن دفعةً واحدة: توكنات GitHub وتليجرام وفيسبوك وX
 *    وأسرار المشاريع. النصيحةُ نفسُها كانت تُتلِف. فصار الفكُّ يجرّب
 *    المفاتيح المتاحة بالترتيب، والتشفيرُ يبقى على الأوّل كما كان.
 */

import crypto from 'crypto';

const IV_HEX = 24;   // 12 بايت
const TAG_HEX = 32;  // 16 بايت

/** المفاتيح المرشَّحة بالترتيب: المخصَّص أوّلاً ثمّ الاحتياط، بلا تكرار. */
export function candidateSecrets(env = process.env) {
    const out = [];
    for (const s of [env.PAT_ENCRYPTION_KEY, env.JWT_SECRET]) {
        if (s && !out.includes(s)) out.push(s);
    }
    return out;
}

function deriveKey(secret) {
    return crypto.scryptSync(secret, 'jaola-pat-vault', 32);
}

function vaultError(message, reason) {
    const e = new Error(message);
    e.reason = reason;   // 'no-key' | 'empty' | 'malformed' | 'key-mismatch'
    return e;
}

export function encryptSecret(plainText) {
    // 🔴 كانت تقبل '' فتُخرِج `iv:tag:` — نصٌّ صادقٌ للعين (truthy فيمرّ كلَّ
    //    `if (pat)`) لكنّ `decryptSecret` تسمّيه «صيغة غير صالحة». فيُتَّهم
    //    المخزونُ بالتلف وهو لم يتلف. خزنةٌ لا تُنتج سرّاً لا تستطيع إعادته.
    if (typeof plainText !== 'string' || !plainText.trim()) {
        throw vaultError('لا يُشفَّر سرٌّ فارغ: مُخرَجه يبدو سرّاً مضبوطاً ثمّ يُرفَض عند القراءة.', 'empty');
    }
    const secrets = candidateSecrets();
    if (!secrets.length) {
        throw vaultError('PAT_ENCRYPTION_KEY أو JWT_SECRET مطلوب لتشفير التوكنات.', 'no-key');
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secrets[0]), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

const isHex = (s, len) => new RegExp(`^[0-9a-fA-F]{${len}}$`).test(s);

function openWith(secret, ivHex, tagHex, dataHex) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
    ]).toString('utf8');
}

export function decryptSecret(payload) {
    const [ivHex, tagHex, dataHex] = (payload || '').split(':');
    // الشكلُ يُفحَص قبل المفاتيح، وإلّا خرج التلفُ الحقيقيّ باسم «تدوير المفتاح».
    if (!isHex(ivHex || '', IV_HEX) || !isHex(tagHex || '', TAG_HEX)
        || !dataHex || dataHex.length % 2 || !/^[0-9a-fA-F]+$/.test(dataHex)) {
        throw vaultError('صيغة السر المشفر غير صالحة.', 'malformed');
    }
    const secrets = candidateSecrets();
    if (!secrets.length) {
        throw vaultError('PAT_ENCRYPTION_KEY أو JWT_SECRET مطلوب لفكّ التوكنات.', 'no-key');
    }
    for (const s of secrets) {
        try { return openWith(s, ivHex, tagHex, dataHex); } catch { /* جرّب المفتاح التالي */ }
    }
    throw vaultError(
        'تعذّر فكّ السرّ بأيٍّ من مفاتيح التشفير المتاحة — الغالب تدوير PAT_ENCRYPTION_KEY/JWT_SECRET.',
        'key-mismatch',
    );
}
