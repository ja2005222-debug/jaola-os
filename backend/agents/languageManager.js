/**
 * 🌐 Language Manager — JAOLA OS
 * يُقرر لغة الرد قبل كل استدعاء AI
 */

const sessions = new Map(); // username → { preferredLang, switchCount, lastMessages }

const LANG_NAMES = { ar:'Arabic', en:'English', nl:'Dutch', fr:'French', de:'German', es:'Spanish' };

// كشف لغة النص
function detectLang(text) {
    const ar = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const nl = (text.match(/\b(de|het|een|van|voor|met|zijn|hebben|niet|maar|ook|worden|deze|dit|als|naar|dan|bij|nog|wel|door|over|aan|kan|meer|zo|komen|die|dat|op|al|je|ze)\b/gi) || []).length;
    const en = (text.match(/\b(the|a|an|is|are|was|were|be|been|have|has|do|did|will|would|can|could|should|may|might|must|shall|for|in|on|at|to|of|and|or|but|with|from|this|that|it|he|she|we|they)\b/gi) || []).length;
    const fr = (text.match(/\b(le|la|les|un|une|des|est|sont|avec|pour|dans|sur|par|que|qui|cette|mais|ou|et|donc)\b/gi) || []).length;
    const scores = { ar, en, nl, fr };
    return Object.entries(scores).sort((a,b) => b[1]-a[1])[0][0];
}

// كشف طلب تغيير صريح
function detectExplicitSwitch(text) {
    const t = text.toLowerCase().trim();
    // عربي
    if (/تكلم بالعربي|رد بالعربي|باللغة العربية|تحدث عربي|عربي فقط|^عربي$/.test(t)) return 'ar';
    // انجليزي
    if (/تكلم بالانجليزي|رد بالانجليزي|باللغة الانجليزية|^english$|speak english|in english|continue in english/i.test(t)) return 'en';
    // هولندي
    if (/^nederlands$|spreek nederlands|in het nederlands/i.test(t)) return 'nl';
    // فرنسي
    if (/^français$|en français|parle français/i.test(t)) return 'fr';
    return null;
}

// كشف إصرار (70%+ من الرسالة بلغة ثانية)
function detectPersistence(text, preferredLang) {
    const detected = detectLang(text);
    if (detected === preferredLang) return null;
    const words = text.trim().split(/\s+/).length;
    if (words < 4) return null; // جملة قصيرة → خلط عادي
    // تحقق نسبة اللغة الأخرى
    const otherChars = detected === 'ar'
        ? (text.match(/[\u0600-\u06FF]/g) || []).length
        : (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = text.replace(/\s/g,'').length;
    if (otherChars / totalChars > 0.7) return detected;
    return null;
}

export function getLanguageDecision(username, userMessage) {
    let session = sessions.get(username) || { preferredLang: null, switchCount: 0, lastLang: null };

    // أول رسالة
    if (!session.preferredLang) {
        session.preferredLang = detectLang(userMessage) || 'ar';
        sessions.set(username, session);
        return { preferredLang: session.preferredLang, replyLang: session.preferredLang, langChanged: false, reason: 'initial' };
    }

    // طلب صريح
    const explicit = detectExplicitSwitch(userMessage);
    if (explicit && explicit !== session.preferredLang) {
        session.preferredLang = explicit;
        session.switchCount++;
        sessions.set(username, session);
        return { preferredLang: explicit, replyLang: explicit, langChanged: true, reason: 'explicit_switch' };
    }

    // إصرار (جملة كاملة بلغة أخرى)
    const persistent = detectPersistence(userMessage, session.preferredLang);
    if (persistent && persistent !== session.preferredLang) {
        // نسمح بالتغيير إذا جملة كاملة
        session.preferredLang = persistent;
        sessions.set(username, session);
        return { preferredLang: persistent, replyLang: persistent, langChanged: true, reason: 'persistent_language' };
    }

    // بخلاف ذلك — ابقَ على اللغة المفضلة
    sessions.set(username, session);
    return { preferredLang: session.preferredLang, replyLang: session.preferredLang, langChanged: false, reason: 'keep_preferred' };
}

export function buildLanguagePrompt(decision) {
    const langName = LANG_NAMES[decision.replyLang] || decision.replyLang;
    return `\nCRITICAL LANGUAGE RULE: You MUST respond ONLY in ${langName}. Never switch languages. Even if the user writes in another language, always reply in ${langName} only. This is a strict system requirement.`;
}

export function resetUserLanguage(username) {
    sessions.delete(username);
}
