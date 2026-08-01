/**
 * 🎛️ Chat Commands — أنماط الأوامر الحتمية للشات (نقية وقابلة للاختبار)
 *
 * كانت مدفونة inline داخل jcr.handleUserMessage (2000+ سطر) فيستحيل
 * اختبارها — وهي أخطر ما في النظام (حذف مشروع، تأكيدات، تنفيذ).
 * أول خطوة في التفكيك التزايدي للوحش: القطعة تخرج مع اختباراتها.
 *
 * كل داله هنا نقية: نص → نتيجة. لا حالة، لا IO، لا LLM.
 */

// ─── حذف المشروع ────────────────────────────────────────────────────
// تأكيد الحذف: "احذف نهائياً <اسم>" — كتابة الاسم الحرفي هي التأكيد
const DELETE_CONFIRM = /^(?:نعم\s+)?(?:احذف|امسح|delete)\s+(?:نهائيا?ً?|permanently)\s+([a-z0-9_\-]+)\s*$/i;
// حذف مشروع مسمّى: "احذف المشروع newline"
const NAMED_DELETE = /^(?:امسح|احذف|delete|remove)\s+(?:المشروع|مشروع|project)\s+([a-z0-9_\-]+)\s*[.!؟?]*$/i;
// نية حذف عامة: "امسح المشروع" / "احذف الموقع كله"
const DELETE_INTENT = /(?:^|\s)(?:امسح|احذف|شيل|delete|remove)\s*(?:هذا\s*)?(?:المشروع|المشروع\s+كله|الموقع\s+كله|the\s+project|this\s+project)\s*(?:كامل|بالكامل|نهائيا|نهائياً)?\s*[.!؟?]*\s*$/iu;
// حذف مشروع مسمّى مباشرةً بلا كلمة "المشروع": "احذف online-shop نهائيا" —
// الاسم قبل "نهائيا". slug لاتيني فقط (فلا يلتقط أهداف تعديل عربية مثل "احذف الصفحة").
const NAMED_DELETE_DIRECT = /^(?:نعم\s+)?(?:امسح|احذف|إحذف|delete|remove)\s+([a-z0-9][a-z0-9_\-]{1,})\s*(?:نهائيا?ً?|بالكامل|كامل|كله|permanently|completely)?\s*[.!؟?]*$/i;
const DELETE_STRENGTH = /نهائيا?ً?|بالكامل|كامل|كله|permanently|completely/i;

/**
 * يحلل رسالة ضد أوامر حذف المشروع.
 * @returns {{ kind: 'confirm'|'intent', target: string|null } | null}
 */
export function matchDeleteCommand(message, activeProject = '') {
    const t = (message || '').trim();
    const confirm = t.match(DELETE_CONFIRM);
    if (confirm) return { kind: 'confirm', target: confirm[1].toLowerCase() };
    const named = t.match(NAMED_DELETE);
    if (named) return { kind: 'intent', target: named[1].toLowerCase() };
    // "احذف <slug> [نهائيا]" — نيّة حذف (تتطلّب تأكيداً) إن كان الاسم = المشروع
    // النشط أو ورد لفظ حذف قويّ؛ وإلا نتركه (قد يكون تعديلاً).
    const direct = t.match(NAMED_DELETE_DIRECT);
    if (direct) {
        const name = direct[1].toLowerCase();
        if (DELETE_STRENGTH.test(t) || name === (activeProject || '').toLowerCase()) {
            return { kind: 'intent', target: name };
        }
    }
    if (DELETE_INTENT.test(t)) return { kind: 'intent', target: (activeProject || '').toLowerCase() || null };
    return null;
}

// ─── 🎨 نية توليد صور حقيقية ─────────────────────────────────────────
// «انشئ صورة حقيقية لليلة الطرب» / «غير صورة البنر بصورة حديثة حقيقية» —
// كانت تسقط في المحادثة («لا أستطيع إنشاء صور») أو الأسوأ: مهمة تعديل كود.
// «بصورة» الظرفية (بصورة أفضل) لا تُلتقط: الاسم يجب أن يبدأ كلمة مستقلة.
const IMG_VERB = '(?:ولّ?د|أنشئ|انشئ|انشي|أنشي|اصنع|إصنع|غيّ?ر|استبدل|إستبدل|بدّ?ل|حدّ?ث|ضع|حط|اريد|أريد|generate|create|make|replace|change|swap)';
const IMG_NOUN = '(?:صور(?:ة|تين)?|الصور(?:ة)?|images?|photos?|pictures?|بنر|بانر|banner|غلاف)';
const IMG_STOP_WORDS = /موقع|متجر|تطبيق|صفحة|معرض|site|store|app|page|gallery|website/i;
const IMG_LOGO_RE = /شعار|لوجو|لوقو|logo|أيقونة|ايقونة|favicon/i;
const IMG_CMD_RE = new RegExp(`(?:^|\\s)${IMG_VERB}\\s+(?:(?:لي|لنا|كل|جميع)\\s+)?((?:[\\u0600-\\u06FF\\w]+\\s+){0,2}?)${IMG_NOUN}(?=\\s|$|[.!؟?،,])`, 'iu');
const IMG_REAL_RE = /(?:^|\s)(?:صور(?:ة)?|الصور)\s+(?:حقيقية|واقعية|احترافية|بالذكاء)|real\s+(?:images?|photos?)|ai\s+(?:images?|photos?)/iu;
const IMG_HERO_RE = /بنر|بانر|banner|غلاف|خلفية|hero/iu;
// «صورة» مفردة يتبعها موضوع (لل…/عن…/of …) — مشهد واحد كبير = بنر
const IMG_SCENE_RE = /(?:^|\s)صورة\s+(?:(?:حقيقية|حقيقة|واقعية|احترافية|جديدة|حديثة|جميلة)\s+)*(?:لل|عن\s+|ل[ء-ي])|(?:image|photo|picture)\s+(?:of|for)\s+/iu;
// كلمات بعد «صورة» ليست اسمَ عنصر: صفات وحروف جر وكلمات البنر
const IMG_NOT_TARGET = /^(?:حقيقية|حقيقة|واقعية|احترافية|جديدة|حديثة|جميلة|أفضل|افضل|بالذكاء|الى|إلى|في|من|مع|عن|قسم|عنصر|بطاقة|كل|جميع|البنر|بنر|البانر|بانر|الغلاف|غلاف|الخلفية|خلفية|real|new|nice|professional|ai|a|an|the|with|to|for|of|banner|hero)$/i;
const IMG_TARGET_RE = /(?:^|\s)(?:صورة|الصورة|image|photo|picture)\s+(?:(?:قسم|عنصر|بطاقة|of|the)\s+)?([؀-ۿ\w][؀-ۿ\w\-]*)/iu;

/**
 * يحلل رسالة ضد نية توليد الصور بالذكاء.
 * @returns {{ hero: boolean, target: string|null } | null}
 *   hero = طلب صورة بنر/غلاف تحديداً؛
 *   target = اسم عنصر مسمّى («غير صورة مؤتمرات» → 'مؤتمرات') أو null للكل.
 */
// طلب بناء صريح («ابني موقع فعاليات مع صور حقيقية») — البناء يغلب نية الصور:
// ذكر الصور هنا وصفٌ للموقع المطلوب لا أمرُ توليدٍ على المشروع الحالي.
const IMG_BUILD_RE = /(?:ابنِ|ابني|ابن|أنشئ|انشئ|انشي|أنشي|اصنع|إصنع|اعمل|build|create|make)\s+(?:(?:لي|لنا|a|an|the|me)\s+)?(?:موقع|متجر|تطبيق|صفحة|منصة|منصّة|بوابة|بوّابة|site|website|store|shop|app|page|platform|portal)/iu;

export function matchImageCommand(message) {
    const t = (message || '').trim();
    if (!t || IMG_LOGO_RE.test(t)) return null; // الشعار له مسار رفع خاص
    if (IMG_BUILD_RE.test(t)) return null; // طلب بناء موقع — يمضي لمسار البناء
    const m = t.match(IMG_CMD_RE);
    const viaVerb = m && !IMG_STOP_WORDS.test(m[1] || '');
    if (!viaVerb && !IMG_REAL_RE.test(t)) return null;
    let hero = IMG_HERO_RE.test(t);
    let target = null;
    if (!hero) {
        const tm = t.match(IMG_TARGET_RE);
        const word = tm?.[1] || '';
        if (word && !IMG_NOT_TARGET.test(word)) target = word.replace(/^ال/, '');
    }
    // «صورة» مفردة بموضوع («انشي صورة حقيقة لليلة الطرب») بلا عنصر مسمّى =
    // طلب صورة مشهد كبيرة → بنر. الجمع («صور للمنتجات») يبقى للعناصر.
    if (!hero && !target && IMG_SCENE_RE.test(t)) hero = true;
    return { hero, target };
}

// ─── 🔬 أمر تشخيص الصور («شخص الصور») ────────────────────────────────
const IMG_DIAG_RE = /^\s*(?:شخّ?ص|افحص)\s+الصور\s*[.!؟?]*\s*$|^\s*diagnose\s+images\s*[.!?]*\s*$/iu;
export function isImageDiagCommand(message) {
    return IMG_DIAG_RE.test(message || '');
}

// ─── التأكيد المجرّد ("نعم/تمام" وحدها → استئناف) ───────────────────
const BARE_YES = /^\s*(نعم|ايوه|أيوه|اه|آه|تمام|طيب|يلا|ok|okay|yes|sure|yep|go)\s*[.!؟?]*\s*$/i;
export function isBareYes(message) {
    return BARE_YES.test(message || '');
}

// ─── أمر التراجع ("تراجع/استرجع آخر نسخة/undo") → استرجاع حتمي بلا LLM ──
// شبكة أمان فورية من الشات (مكافئ Version Restore عند المنافسين):
// آخر نسخة احتياطية تُسترجع فوراً — لا تفسير ذكاء، لا مجال لانحراف.
const UNDO_RE = /^\s*(?:تراجع(?:\s+عن\s+(?:آخر|اخر)\s+(?:تعديل|تغيير))?|استرجع(?:\s+(?:آخر|اخر|ال)?\s*نسخ[ةه](?:\s+(?:ال)?سابق[ةه])?)?|رجّ?ع(?:\s+(?:آخر|اخر|ال)?\s*(?:نسخ[ةه]|تعديل|الموقع))?|undo|revert|rollback)\s*[.!؟?]*\s*$/iu;
export function isUndoCommand(message) {
    return UNDO_RE.test(message || '');
}

// ─── أمر التنفيذ المجرّد ("نفذهما/طبقها/do it" → تنفيذ ما نوقش) ─────
const BARE_EXECUTE = /^\s*(?:تمام|طيب|اوكي?|ok|okay|نعم|يلا)?\s*(?:نفّ?ذ(?:ها|هم|هما|ه|وا)?|طبّ?ق(?:ها|هم|هما|ه)?|اعملها|سوّ?ها|قم\s+بذلك|قم\s+بها|نفذ\s+ذلك|do\s+it|execute(?:\s+it)?|go\s+ahead|implement(?:\s+it)?|apply(?:\s+it)?)\s*[.!؟?]*\s*$/iu;
export function isBareExecute(message) {
    return BARE_EXECUTE.test(message || '');
}
