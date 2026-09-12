/** Evidence supplied to the semantic router, never a replacement for user text. */
export function arabicRequestContext(original = '') {
    const normalized = original.normalize('NFC').replace(/[\u064b-\u065f\u0670\u0640]/gu, '');
    const clauses = original.split(/[،\n؛]/u).map(value => value.trim()).filter(Boolean);
    const constraints = clauses.filter(value => /(?:^|\s)(?:لا|بدون|فقط|بس|ما تغير|ما تغيّر|متغيرش|ما تبدل)(?:\s|$)/u.test(value));
    const lastCorrection = [...original.matchAll(/(?:لا[،,\s]*)?(?:أقصد|اقصد|قصدي)\s+/gu)].at(-1);
    const correction = lastCorrection ? original.slice(lastCorrection.index + lastCorrection[0].length).trim() : null;
    const complaint = /(?:ما بيحفظ|ما بتتحفظ|ما يصير شيء|ما بصير شي|مش بيحفظ|لا يعمل|مش شغال|ما يشتغل)/u.test(normalized);
    const explicitFix = /(?:^|\s)(?:صلح|اصلح|أصلح|عدّل|عدل|غيّر|غير|احذف|ابني|ابن)(?:\s|$)/u.test(original);
    return { original, normalized, constraints, correction, diagnosisOnly: complaint && !explicitFix,
        hasArabic: /[\u0600-\u06ff]/u.test(original) };
}

export const ARABIC_ROUTING_GUIDANCE = `
افهم العربية الفصحى واللهجات والعبارات المختلطة بالكود دون تغيير النص الأصلي:
- «سوي/سوّي/اعمل/عايز/أبغى» لا تحدد المجال؛ افصل فعل الطلب عن موضوعه.
- «أعد البناء» عملية على المشروع الحالي، لا تعني شركة مقاولات.
- «لا تغيّر القالب، أصلح تسجيل الدخول» تعديل محدود؛ النفي قيد ملزم لا أمر بالتغيير.
- «ممكن نضيف دفع لاحقًا؟» نقاش مستقبلي وليس إذنًا بالتنفيذ.
- «غير اللون بس» يحافظ على التخطيط والمحتوى والوظائف.
- «شيل ده» و«عدّل الثانية» تحتاجان مرجعًا محددًا؛ لا تختر عنصرًا بالتخمين.
- استخرج المرجع من السياق فقط إن كان وحيدًا وواضحًا. وإلا أعد action=chat مع
  requiresClarification=true وquestion سؤال قصير عن العنصر المقصود.
- لا تفترض البلد أو العملة أو الصلاحيات من اللهجة. لا تغير أسماء الأشخاص أو العلامات أو الكود.
- حافظ في instruction على جميع قيود المستخدم ونفيه؛ لا تضف متطلبات تجارية لم يطلبها.
- التصحيح «أزرق… لا، أقصد أخضر» يعتمد آخر تصحيح مع حفظ بقية الطلب.
- شكوى مثل «أضغط حفظ وما يصير شيء» تستدعي diagnose: افحص واشرح دون تغيير الملفات.
- «الحسابات لا تلمسها» قيد حماية للسلوك؛ لا تعتبر نجاح ترجمة الكود دليلًا على سلامة الحسابات.
`;
