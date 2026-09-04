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
// 🔴 القيمة تُلصَق في `KEY=VALUE` سطراً في .env، فسطرٌ جديد داخلها يفتح
// سطراً ثانياً — أي **مفتاحاً لم يمرّ بـVALID_KEY قط** وبشكلٍ يرفضه أصلاً
// (`lower_case=…`). و.env هذا يُحقَن بيئةً لتشغيل المشروع. ولا هروبَ
// قياسياً يفهمه كل قارئ .env، فالمنعُ أصدق من ترميزٍ يقرؤه بعضهم.
const HAS_LINE_BREAK = /[\r\n]/;

// 💾 ثبات: القيم مشفّرة (AES-256-GCM) فآمن حفظها في Mongo — تنجو من إعادة
// نشر Render، فيبقى MONGODB_URI متاحاً للنشر بعد أي إعادة تشغيل.
onMongoReady(() => hydrateStore('projectSecrets', (key, value) => {
    if (value && typeof value === 'object') store.set(key, value);
}));

/** يحفظ سرّاً مشفّراً ويكتب .env المشروع */
export async function setProjectSecret(user, project, projectPath, key, value) {
    if (!VALID_KEY.test(key || '')) throw new Error('اسم المفتاح غير صالح (أحرف كبيرة/أرقام/_ ويبدأ بحرف)');
    if (typeof value !== 'string' || !value.trim()) throw new Error('القيمة مطلوبة');
    if (HAS_LINE_BREAK.test(value)) throw new Error('القيمة لا تحتمل سطراً جديداً (يفتح مفتاحاً ثانياً في .env)');
    const k = keyOf(user, project);
    const secrets = store.get(k) || {};
    secrets[key] = encryptSecret(value.trim());
    store.set(k, secrets);
    persistEntry('projectSecrets', k, secrets);
    const { values, unreadable } = decryptAll(secrets);
    await writeEnvFile(projectPath, values, unreadable);
    return { ok: true, unreadable };
}

/** يحذف سرّاً */
export async function deleteProjectSecret(user, project, projectPath, key) {
    const k = keyOf(user, project);
    const secrets = store.get(k) || {};
    delete secrets[key];
    store.set(k, secrets);
    persistEntry('projectSecrets', k, secrets);
    const { values, unreadable } = decryptAll(secrets);
    await writeEnvFile(projectPath, values, unreadable);
    return { ok: true, unreadable };
}

/** أسماء المفاتيح فقط (بلا قيم) — آمن للواجهة */
export function getProjectSecretNames(user, project) {
    return Object.keys(store.get(keyOf(user, project)) || {});
}

/** القيم المفكوكة — للاستخدام الداخلي فقط (الحقن/التشغيل) */
export function getProjectSecrets(user, project) {
    return decryptAll(store.get(keyOf(user, project)) || {}).values;
}

/**
 * 🔴 يفصل ما فُكَّ عمّا عجزنا عنه بدل ابتلاع الثاني صامتاً.
 *
 * كان `catch { /* تجاهل *\/ }` يجعل سؤالاً واحداً («أيُّ أسرارٍ لهذا
 * المشروع؟») بمصدرَي حقيقة: الأسماء من الخريطة **المشفّرة**، والقيم من
 * الفكّ. فحين يتغيّر `PAT_ENCRYPTION_KEY`/`JWT_SECRET` — تدويرٌ في Render —
 * تفترقان بلا إشارة: اللوحة تعرض السرّ والتطبيق يستلم لا شيء.
 */
function decryptAll(encMap) {
    const values = {};
    const unreadable = [];
    for (const [k, v] of Object.entries(encMap)) {
        try { values[k] = decryptSecret(v); } catch { unreadable.push(k); }
    }
    if (unreadable.length) {
        console.warn(`🔑 [projectSecrets] تعذّر فكّ ${unreadable.length} سرّاً (${unreadable.join(', ')}) — `
            + 'الغالب تغيّر PAT_ENCRYPTION_KEY/JWT_SECRET. أُبقيت قيمها في .env كما هي، وتحتاج إعادة إدخال.');
    }
    return { values, unreadable };
}

/** أسماء الأسرار التي عجزنا عن فكّها — تُقال للوحة بدل ادّعاء أنها بخير. */
export function getUnreadableSecretNames(user, project) {
    return decryptAll(store.get(keyOf(user, project)) || {}).unreadable;
}

/** يكتب/يحدّث .env في مجلد المشروع + يضمن استثناءه من git */
export async function writeEnvFile(projectPath, secrets, unreadable = []) {
    if (!projectPath) return;
    // 🔴 سرٌّ عجزنا عن فكّه ما زال **عاملاً في التطبيق**: سطرُه في .env
    // صحيحٌ كُتب يوم كان المفتاح يفكّه. فإعادةُ الكتابة من المفكوك وحده
    // كانت تمحوه نهائياً — نخسر مفتاح Stripe حيّاً لأننا فقدنا مفتاح
    // التشفير، لا لأن أحداً طلب حذفه. يُنقَل سطره كما هو من الملف القائم.
    const kept = {};
    if (unreadable.length) {
        let old = '';
        try { old = await fsp.readFile(path.join(projectPath, '.env'), 'utf-8'); } catch { /* لا ملف بعد */ }
        for (const line of old.split('\n')) {
            const eq = line.indexOf('=');
            if (eq > 0 && unreadable.includes(line.slice(0, eq))) kept[line.slice(0, eq)] = line.slice(eq + 1);
        }
    }
    const lines = Object.entries({ ...kept, ...secrets }).map(([k, v]) => `${k}=${v}`);
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
