/**
 * 🔐 Secret Vault — تشفير التوكنات الحساسة (GitHub PAT) قبل حفظها في DB
 *
 * AES-256-GCM مع مفتاح مشتق من PAT_ENCRYPTION_KEY (أو JWT_SECRET كاحتياط).
 * الصيغة المخزنة: iv:authTag:ciphertext (hex)
 */

import crypto from 'crypto';

function getKey() {
    const secret = process.env.PAT_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('PAT_ENCRYPTION_KEY أو JWT_SECRET مطلوب لتشفير التوكنات.');
    }
    return crypto.scryptSync(secret, 'jaola-pat-vault', 32);
}

export function encryptSecret(plainText) {
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(payload) {
    const [ivHex, tagHex, dataHex] = (payload || '').split(':');
    if (!ivHex || !tagHex || !dataHex) {
        throw new Error('صيغة السر المشفر غير صالحة.');
    }
    const key = getKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(dataHex, 'hex')),
        decipher.final(),
    ]).toString('utf8');
}
