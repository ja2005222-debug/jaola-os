/**
 * 👤 accounts.js — حسابات Jatrava الذاتية (بريد وكلمة مرور)
 *
 * المشكلة: الخدمة كانت **لا تُصدر توكنات أبداً** — تتحقق فقط من توكن منصة
 * JAOLA. فمن يصل jatrava.com ولا حساب له في المنصة الأم لا يستطيع الحجز
 * مهما تصفّح. ولا يصلح لموقع سفر أن يطلب من مسافرٍ حساباً في منصةٍ أخرى
 * باسم مستخدم إنجليزي لا بريد.
 *
 * ══════ ثلاثة قرارات تحكم هذا الملف ══════
 *
 * 🔐 (١) **سرٌّ مشتقّ لا JWT_SECRET حرفياً.** توكن Jatrava موقّع بسرٍّ
 *    مشتقّ بفصلٍ نطاقي (نفس نمط shareLinks.js). ولو وقّعناه بـJWT_SECRET
 *    نفسه لصار توكنُ **أي مسافر** صالحاً على منصة JAOLA كلها — تصعيدُ
 *    صلاحيةٍ صامت. الآن: المنصة تُصدر توكناتٍ تعمل هنا، وJatrava تُصدر
 *    توكناتٍ لا تعمل هناك. الاتجاه واحد عمداً.
 *
 * 🆔 (٢) **البريد هو `username`.** الخدمة كلها تفهرس بـusername (حجوزات،
 *    ملف، تنبيهات، مفضلة). فلو أعطينا حساب Jatrava اسماً حرّاً لأمكن أن
 *    يطابق اسم مستخدمٍ في المنصة الأم فيرى حجوزاته! والحلّ ليس بادئةً
 *    نتذكّرها، بل **استحالةٌ بنيوية**: أسماء المنصة الأم محكومة بـ
 *    /^[a-zA-Z][a-zA-Z0-9_-]{2,19}$/ — لا تقبل `@` أبداً. وكل بريد فيه
 *    `@`. فالتصادم مستحيل لا مستبعَد، واختبارٌ يحرس هذا تحديداً.
 *
 * 🔑 (٣) **scrypt من node:crypto لا مكتبة خارجية.** memory-hard ومقاوم
 *    للعتاد المتخصّص، وبلا اعتمادية جديدة (عرف المستودع: بلا مكتبات ما
 *    أمكن). والمعاملات **مخزَّنة داخل الهاش نفسه** فترقيتها لاحقاً لا
 *    تُبطل كلمات المرور القديمة.
 *
 * 🌐 جاهز لدخول جوجل بلا إعادة كتابة: `provider` يسجّل مصدر الحساب،
 *    و`passwordHash` يقبل الفراغ (حساب جوجل بلا كلمة مرور)، والهوية تبقى
 *    البريد — فمن سجّل بكلمة مرور ثم دخل بجوجل بنفس البريد هو **هو**.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

// الفصل النطاقي + رقم الإصدار: تغيير الصيغة لاحقاً يُبطل القديم حتماً
const DOMAIN = 'jatrava:account:v1';

/** يشتقّ سرّ توقيع حسابات Jatrava — لا يُستعمل JWT_SECRET حرفياً (انظر أعلاه). */
export function deriveAccountSecret(jwtSecret) {
    const base = Array.isArray(jwtSecret) ? jwtSecret[0] : jwtSecret;
    if (!base) throw new Error('JWT_SECRET مطلوب لاشتقاق سرّ الحسابات.');
    return crypto.createHmac('sha256', String(base)).update(DOMAIN).digest('hex');
}

// ─── البريد ────────────────────────────────────────────────────────────
// تحقق **بنيوي متحفّظ** لا محاولةَ مطابقة RFC 5322 كاملاً (تعابيرها
// النمطية الشهيرة مصدر عطبٍ أكثر منها حماية). الشرط: جزءٌ محلي ثم @ ثم
// نطاق بنقطة واحدة على الأقل، بلا فراغات.
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * يطبّع البريد: قصّ وتحويل لحروف صغيرة.
 * ⚠️ **بلا حيَل جوجل** (حذف النقاط أو ما بعد `+`): تلك سياسةُ مزوّدٍ
 * بعينه لا قاعدةً عامة، وتطبيقها على الجميع يدمج حسابَي شخصين مختلفين
 * على نطاقٍ لا يتبع تلك السياسة. التطبيع الآمن هو حالة الأحرف وحدها.
 */
export function normalizeEmail(raw) {
    return String(raw || '').trim().toLowerCase();
}

export function isValidEmail(raw) {
    const e = normalizeEmail(raw);
    return e.length <= 254 && EMAIL_RE.test(e);
}

// ─── كلمة المرور ───────────────────────────────────────────────────────
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200; // سقفٌ لازم: scrypt على مدخلٍ ضخم إنهاكٌ للخادم

/**
 * سياسة **الطول أولاً**: ثمانية أحرف حدّاً أدنى بلا اشتراط رموز وأرقام.
 * اشتراط التركيبة يدفع الناس إلى «Password1!» — أضعف عملياً من عبارةٍ
 * طويلة. ونرفض المكشوفة الشائعة صراحةً بدل الاكتفاء بالطول.
 */
const COMMON = new Set([
    'password', '12345678', '123456789', '1234567890', 'qwerty123', 'password1',
    'password123', 'iloveyou', 'admin123', '11111111', 'abc12345', 'letmein1',
    'welcome1', 'qwertyui', '87654321', 'jatrava1', 'jatrava123',
]);

/** يُرجع رسالة الخطأ العربية، أو null إن كانت مقبولة. */
export function passwordProblem(raw) {
    const p = String(raw == null ? '' : raw);
    if (p.length < PASSWORD_MIN) return `كلمة المرور ${PASSWORD_MIN} أحرف على الأقل.`;
    if (p.length > PASSWORD_MAX) return `كلمة المرور أطول من ${PASSWORD_MAX} حرفاً.`;
    if (COMMON.has(p.toLowerCase())) return 'كلمة المرور شائعة جداً — اختر غيرها.';
    return null;
}

// ─── التعمية ───────────────────────────────────────────────────────────
// المعاملات تُخزَّن داخل الهاش، فرفعها لاحقاً لا يُبطل كلمات المرور القائمة.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, saltBytes: 16 };

const scrypt = (password, salt, keylen, opts) => new Promise((resolve, reject) => {
    // maxmem: الافتراضي (32MB) أضيق من حاجة N=16384,r=8 — بلا رفعه يرمي
    crypto.scrypt(password, salt, keylen, { ...opts, maxmem: 256 * 1024 * 1024 },
        (err, dk) => (err ? reject(err) : resolve(dk)));
});

/** يُنتج `scrypt$N$r$p$saltB64$hashB64` — صيغة واصفة لنفسها. */
export async function hashPassword(password) {
    const { N, r, p, keylen, saltBytes } = SCRYPT;
    const salt = crypto.randomBytes(saltBytes);
    const dk = await scrypt(String(password), salt, keylen, { N, r, p });
    return ['scrypt', N, r, p, salt.toString('base64'), dk.toString('base64')].join('$');
}

/**
 * يتحقق بمقارنة **ثابتة الزمن**. وأي هاش مشوّه أو غائب يُرد false بهدوء
 * (حساب جوجل بلا كلمة مرور يمرّ من هنا أيضاً).
 */
export async function verifyPassword(password, stored) {
    try {
        const parts = String(stored || '').split('$');
        if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
        const [, N, r, p, saltB64, hashB64] = parts;
        const expected = Buffer.from(hashB64, 'base64');
        const dk = await scrypt(String(password), Buffer.from(saltB64, 'base64'),
            expected.length, { N: Number(N), r: Number(r), p: Number(p) });
        return dk.length === expected.length && crypto.timingSafeEqual(dk, expected);
    } catch {
        return false;
    }
}

/**
 * 🕰️ هاشٌ وهميّ لتسوية الزمن عند الدخول ببريدٍ غير مسجَّل.
 *
 * بلا هذا: البريد غير المسجَّل يردّ **فوراً** (لا هاش يُحسب)، والمسجَّل
 * يتأخّر ~50ms — فرقٌ يُقاس بثقة، وبه يَعُدّ المهاجم حساباتنا رغم أن نصّ
 * الخطأ موحَّد. فنحسب scrypt على هذا الهاش الثابت حين لا نجد المستخدم:
 * الفشل مؤكَّد (كلمة مروره عشوائية ٣٢ بايت ضاعت عمداً) والزمن مطابق.
 */
export const DUMMY_HASH =
    'scrypt$16384$8$1$1W1ZhWoUkpStpvyBwYx5mA==$+V1pI8Qx6KcJqazJM1J4VeJqv+yZB3U8YLY+9cFLaORO7VK9C5YEL0A4gGvnqDdanTzo9aroPVYvywUpie0UBA==';

// ─── التوكن ────────────────────────────────────────────────────────────
export const ACCOUNT_TOKEN_DAYS = 30; // المسافر يعود بعد أسابيع لا دقائق

/**
 * يوقّع توكن حساب Jatrava. الحمولة **مطابقة لشكل توكن المنصة الأم** في
 * حقل `username` تحديداً، لأن كل منطق الملكية في الخدمة يقرأه — فلا
 * يحتاج مسارٌ واحد أن يعرف من أين جاء المستخدم.
 * و`iss` للتمييز عند الحاجة (تشخيص، وتقييد لاحق إن لزم).
 */
export function signAccountToken(user, accountSecret, { days = ACCOUNT_TOKEN_DAYS } = {}) {
    return jwt.sign({
        id: user.id,
        username: user.email, // الهوية = البريد (انظر القرار ٢ أعلاه)
        email: user.email,
        name: user.name || '',
        iss: 'jatrava',
    }, accountSecret, { expiresIn: `${days}d` });
}

/** ما يُعاد للواجهة عن الحساب — بلا هاش كلمة المرور أبداً. */
export function publicUser(u) {
    if (!u) return null;
    return {
        id: u.id,
        email: u.email,
        name: u.name || '',
        provider: u.provider || 'password',
        emailVerified: !!u.emailVerifiedAt,
        createdAt: u.createdAt,
    };
}

/** ينقّي الاسم المعروض: بلا أسطر ولا طولٍ مفرط — يظهر في الترويسة والبريد. */
export function normalizeName(raw) {
    return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 60);
}
