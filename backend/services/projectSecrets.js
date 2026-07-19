/**
 * 🔑 Project Secrets — مفاتيح أطراف ثالثة لكل مشروع (Travelpayouts, ...)
 *
 * يخزّن مفاتيح المستخدم مشفّرة (AES-256-GCM عبر secretVault)، ويكتبها في
 * ملف .env داخل مجلد المشروع فتعمل المعاينة/التشغيل المحلي — و.env مستثنى من git.
 *
 * الأسرار لا تُرسل للواجهة إطلاقاً (getProjectSecretNames يُرجع الأسماء فقط).
 */

import { promises as fsp } from 'fs';
import path from 'path';
import { encryptSecret, decryptSecret } from '../utils/secretVault.js';
import { persistEntry, hydrateStore, onMongoReady } from './persistence.js';

// user:project → { KEY: encryptedValue }
const store = new Map();
const keyOf = (user, project) => `${user}:${project}`;
const VALID_KEY = /^[A-Z][A-Z0-9_]{1,48}$/;

// 💾 ثبات: القيم مشفّرة (AES-256-GCM) فآمن حفظها في Mongo — تنجو من إعادة
// نشر Render، فيبقى MONGODB_URI متاحاً للنشر بعد أي إعادة تشغيل.
onMongoReady(() => hydrateStore('projectSecrets', (key, value) => {
    if (value && typeof value === 'object') store.set(key, value);
}));

/** يحفظ سرّاً مشفّراً ويكتب .env المشروع */
export async function setProjectSecret(user, project, projectPath, key, value) {
    if (!VALID_KEY.test(key || '')) throw new Error('اسم المفتاح غير صالح (أحرف كبيرة/أرقام/_ ويبدأ بحرف)');
    if (typeof value !== 'string' || !value.trim()) throw new Error('القيمة مطلوبة');
    const k = keyOf(user, project);
    const secrets = store.get(k) || {};
    secrets[key] = encryptSecret(value.trim());
    store.set(k, secrets);
    persistEntry('projectSecrets', k, secrets);
    await writeEnvFile(projectPath, decryptAll(secrets));
    return true;
}

/** يحذف سرّاً */
export async function deleteProjectSecret(user, project, projectPath, key) {
    const k = keyOf(user, project);
    const secrets = store.get(k) || {};
    delete secrets[key];
    store.set(k, secrets);
    persistEntry('projectSecrets', k, secrets);
    await writeEnvFile(projectPath, decryptAll(secrets));
    return true;
}

/** أسماء المفاتيح فقط (بلا قيم) — آمن للواجهة */
export function getProjectSecretNames(user, project) {
    return Object.keys(store.get(keyOf(user, project)) || {});
}

/** القيم المفكوكة — للاستخدام الداخلي فقط (الحقن/التشغيل) */
export function getProjectSecrets(user, project) {
    return decryptAll(store.get(keyOf(user, project)) || {});
}

function decryptAll(encMap) {
    const out = {};
    for (const [k, v] of Object.entries(encMap)) {
        try { out[k] = decryptSecret(v); } catch { /* تجاهل التالف */ }
    }
    return out;
}

/** يكتب/يحدّث .env في مجلد المشروع + يضمن استثناءه من git */
export async function writeEnvFile(projectPath, secrets) {
    if (!projectPath) return;
    const lines = Object.entries(secrets).map(([k, v]) => `${k}=${v}`);
    try {
        await fsp.writeFile(path.join(projectPath, '.env'), lines.join('\n') + (lines.length ? '\n' : ''));
        // ضمان .env في .gitignore حتى لا يُرفع السرّ
        const giPath = path.join(projectPath, '.gitignore');
        let gi = '';
        try { gi = await fsp.readFile(giPath, 'utf-8'); } catch {}
        if (!/^\.env$/m.test(gi)) {
            await fsp.writeFile(giPath, (gi ? gi.replace(/\s*$/, '') + '\n' : '') + '.env\n');
        }
    } catch { /* best-effort */ }
}
