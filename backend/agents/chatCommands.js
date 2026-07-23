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

// ─── التأكيد المجرّد ("نعم/تمام" وحدها → استئناف) ───────────────────
const BARE_YES = /^\s*(نعم|ايوه|أيوه|اه|آه|تمام|طيب|يلا|ok|okay|yes|sure|yep|go)\s*[.!؟?]*\s*$/i;
export function isBareYes(message) {
    return BARE_YES.test(message || '');
}

// ─── أمر التنفيذ المجرّد ("نفذهما/طبقها/do it" → تنفيذ ما نوقش) ─────
const BARE_EXECUTE = /^\s*(?:تمام|طيب|اوكي?|ok|okay|نعم|يلا)?\s*(?:نفّ?ذ(?:ها|هم|هما|ه|وا)?|طبّ?ق(?:ها|هم|هما|ه)?|اعملها|سوّ?ها|قم\s+بذلك|قم\s+بها|نفذ\s+ذلك|do\s+it|execute(?:\s+it)?|go\s+ahead|implement(?:\s+it)?|apply(?:\s+it)?)\s*[.!؟?]*\s*$/iu;
export function isBareExecute(message) {
    return BARE_EXECUTE.test(message || '');
}
