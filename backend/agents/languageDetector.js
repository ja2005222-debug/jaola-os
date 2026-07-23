/**
 * 🌐 Language Detector — JAOLA OS
 * 
 * أول وكيل يقرأ كل رسالة.
 * يكشف اللغة من الرسالة الأولى ويحفظها للجلسة كاملة.
 * لا يتغير حتى لو كتب المستخدم جملة بلغة أخرى لاحقاً.
 */

// ═══════════════════════════════════════════════════════
// 🗂️ حفظ لغة كل مستخدم طوال الجلسة
// ═══════════════════════════════════════════════════════
const sessionLanguages = new Map(); // username → language code

// ═══════════════════════════════════════════════════════
// 🔤 خرائط الحروف لكل لغة
// ═══════════════════════════════════════════════════════
const SCRIPT_PATTERNS = [
    // العربية والفارسية والأردية
    { code: 'ar', range: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, label: 'العربية' },
    // الروسية والكيريلية
    { code: 'ru', range: /[\u0400-\u04FF]/g, label: 'الروسية' },
    // الصينية
    { code: 'zh', range: /[\u4E00-\u9FFF\u3400-\u4DBF]/g, label: 'الصينية' },
    // اليابانية (هيراغانا + كاتاكانا)
    { code: 'ja', range: /[\u3040-\u30FF]/g, label: 'اليابانية' },
    // الكورية
    { code: 'ko', range: /[\uAC00-\uD7AF\u1100-\u11FF]/g, label: 'الكورية' },
    // العبرية
    { code: 'he', range: /[\u0590-\u05FF]/g, label: 'العبرية' },
    // الهندية (ديفاناغاري)
    { code: 'hi', range: /[\u0900-\u097F]/g, label: 'الهندية' },
    // التايلاندية
    { code: 'th', range: /[\u0E00-\u0E7F]/g, label: 'التايلاندية' },
];

// كلمات مميّزة للغات اللاتينية (نفس الحروف لكنها مختلفة)
const LATIN_KEYWORDS = {
    fr: ['je', 'tu', 'nous', 'vous', 'est', 'sont', 'avec', 'pour', 'dans', 'sur', 'une', 'des', 'les', 'du', 'qui', 'que', 'pas'],
    es: ['yo', 'tú', 'el', 'ella', 'nosotros', 'que', 'con', 'por', 'para', 'una', 'los', 'las', 'del', 'está', 'son', 'muy'],
    de: ['ich', 'du', 'wir', 'ist', 'sind', 'mit', 'für', 'auf', 'ein', 'eine', 'der', 'die', 'das', 'und', 'nicht', 'auch'],
    tr: ['ben', 'sen', 'biz', 'siz', 'bir', 'bu', 'şu', 'o', 've', 'ile', 'için', 'değil', 'var', 'yok', 'mı', 'mi'],
    pt: ['eu', 'tu', 'nós', 'você', 'que', 'com', 'por', 'para', 'uma', 'os', 'as', 'do', 'da', 'não', 'mais', 'são'],
    nl: ['ik', 'je', 'wij', 'zijn', 'met', 'voor', 'op', 'een', 'de', 'het', 'van', 'aan', 'ook', 'niet', 'naar', 'maar'],
    en: ['i', 'you', 'we', 'they', 'is', 'are', 'was', 'with', 'for', 'the', 'a', 'an', 'and', 'not', 'to', 'in', 'of'],
};

// ═══════════════════════════════════════════════════════
// 🔍 الدالة الرئيسية لكشف اللغة
// ═══════════════════════════════════════════════════════
export function detectLanguage(text) {
    if (!text || text.trim().length < 2) return 'en';

    const clean = text.trim().toLowerCase();
    const totalChars = clean.replace(/\s/g, '').length;
    if (totalChars === 0) return 'en';

    // ١. فحص الخطوط غير اللاتينية أولاً (دقيقة 100%)
    for (const script of SCRIPT_PATTERNS) {
        const matches = (clean.match(script.range) || []).length;
        if (matches / totalChars > 0.15) {
            return script.code;
        }
    }

    // ٢. للغات اللاتينية — حساب الكلمات المميّزة
    const words = clean
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

    if (words.length === 0) return 'en';

    const scores = {};
    for (const [lang, keywords] of Object.entries(LATIN_KEYWORDS)) {
        const hits = words.filter(w => keywords.includes(w)).length;
        scores[lang] = hits / words.length;
    }

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0.05 ? best[0] : 'en'; // حد أدنى 5% كلمات مطابقة
}

// ═══════════════════════════════════════════════════════
// 💾 إدارة لغة الجلسة
// ═══════════════════════════════════════════════════════

/** يُسجّل لغة المستخدم — يُحدَّث إذا جاءت رسالة أوضح (أكثر من كلمتين) */
export function initUserLanguage(username, message) {
    const words = message.trim().split(/\s+/).length;
    const current = sessionLanguages.get(username);

    // إذا لا توجد لغة محفوظة — سجّل دائماً
    if (!current) {
        const lang = detectLanguage(message);
        sessionLanguages.set(username, lang);
        return lang;
    }

    // 🆕 Language Lock — إذا اللغة المحفوظة عربية، لا تغيّرها حتى لو كتب المستخدم إنجليزي
    // فقط حدّث إذا كانت الرسالة الجديدة أوضح وأطول (أكثر من 3 كلمات) وغير إنجليزية
    if (words > 3) {
        const lang = detectLanguage(message);
        // لا تغيّر من عربي إلى إنجليزي (قد يكتب كلمة تقنية بالإنجليزي)
        const isDowngrade = current !== 'en' && lang === 'en';
        if (lang !== current && !isDowngrade) {
            sessionLanguages.set(username, lang);
            return lang;
        }
    }

    return current;
}

/** يُعيد لغة المستخدم الحالية (أو en افتراضياً) */
export function getUserLanguage(username) {
    return sessionLanguages.get(username) || 'en';
}

/**
 * لغة الردّ على طلب بناء: لا نردّ بالإنجليزية على طلب *عربيّ واضح* حتى لو كانت
 * لغة الجلسة غير مضبوطة (تعود en افتراضياً بعد إعادة تشغيل الخادم). لا يمسّ
 * اللغات الأخرى المضبوطة صراحةً (fr/es/…). دالة نقية.
 */
export function resolveGoalLanguage(goal, sessionLang) {
    const s = sessionLang || 'en';
    if (s === 'en' && detectLanguage(goal || '') === 'ar') return 'ar';
    return s;
}

/** هل سُجّلت لغة لهذا المستخدم فعلاً؟ (يميّز "غير مضبوط" عن "en") */
export function hasUserLanguage(username) {
    return sessionLanguages.has(username);
}

/** يُغيّر اللغة يدوياً (مثلاً إذا طلب المستخدم صراحةً) */
export function setUserLanguage(username, lang) {
    sessionLanguages.set(username, lang);
}

/** يمسح لغة المستخدم عند تسجيل الخروج */
export function clearUserLanguage(username) {
    sessionLanguages.delete(username);
}

// ═══════════════════════════════════════════════════════
// 🌍 معلومات اللغات المدعومة
// ═══════════════════════════════════════════════════════
export const LANGUAGE_INFO = {
    ar: { label: 'العربية',   dir: 'rtl', greet: 'مرحباً! كيف يمكنني مساعدتك؟' },
    en: { label: 'English',   dir: 'ltr', greet: 'Hello! How can I help you?' },
    fr: { label: 'Français',  dir: 'ltr', greet: 'Bonjour! Comment puis-je vous aider?' },
    es: { label: 'Español',   dir: 'ltr', greet: '¡Hola! ¿Cómo puedo ayudarte?' },
    de: { label: 'Deutsch',   dir: 'ltr', greet: 'Hallo! Wie kann ich Ihnen helfen?' },
    tr: { label: 'Türkçe',    dir: 'ltr', greet: 'Merhaba! Size nasıl yardımcı olabilirim?' },
    pt: { label: 'Português', dir: 'ltr', greet: 'Olá! Como posso ajudá-lo?' },
    nl: { label: 'Nederlands',dir: 'ltr', greet: 'Hallo! Hoe kan ik u helpen?' },
    ru: { label: 'Русский',   dir: 'ltr', greet: 'Привет! Как я могу вам помочь?' },
    zh: { label: '中文',       dir: 'ltr', greet: '您好！我能帮您什么？' },
    ja: { label: '日本語',     dir: 'ltr', greet: 'こんにちは！何かお手伝いできますか？' },
    ko: { label: '한국어',     dir: 'ltr', greet: '안녕하세요! 어떻게 도와드릴까요?' },
};

export function getLangInfo(code) {
    return LANGUAGE_INFO[code] || LANGUAGE_INFO['en'];
}

export function detectExplicitLanguageSwitch(text) {
    const t = (text || '').toLowerCase().trim();
    if (/تكلم بالانجليزي|رد بالانجليزي|باللغة الانجليزية|باللغة الإنجليزية|english|إنجليزي|انجليزي/.test(t)) return 'en';
    if (/speak english|reply in english|continue in english/i.test(t)) return 'en';
    if (/تكلم بالعربي|رد بالعربي|باللغة العربية|عربي|arabic/.test(t)) return 'ar';
    if (/speak arabic|reply in arabic|تحدث عربي|تكلم عربي/.test(t)) return 'ar';
    if (/^عربي$|^arabic$|^english$|^إنجليزي$/.test(t)) return t.includes('عرب') || t === 'arabic' ? 'ar' : 'en';
    if (/speak dutch|in het nederlands/i.test(t)) return 'nl';
    if (/speak french|en français/i.test(t)) return 'fr';
    return null;
}

export function getReplyLanguage(userMessage, username) {
    const explicitSwitch = detectExplicitLanguageSwitch(userMessage);
    if (explicitSwitch) {
        sessionLanguages.set(username, explicitSwitch);
        return explicitSwitch;
    }
    const current = sessionLanguages.get(username);
    if (!current) {
        const detected = detectLanguage(userMessage);
        sessionLanguages.set(username, detected);
        return detected;
    }
    return current;
}
