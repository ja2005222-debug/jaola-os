/** Pure project-type decision contract. UI defaults are never user consent. */
export const PROJECT_TYPES = Object.freeze([
    Object.freeze({ id: 'site', label: 'موقع ويب', description: 'صفحات عامة ومحتوى وخدمات للعملاء' }),
    Object.freeze({ id: 'system', label: 'سيستم داخلي', description: 'عمليات وبيانات وصلاحيات لإدارة العمل' }),
]);

export function explicitProjectType(message = '') {
    // Only a direct leading request counts; mentions inside requirements do not.
    if (/(?:لا أريد|لا اريد|ليس|not|don't|without)/iu.test(message)) return undefined;
    const prefix = /^(?:(?:ابن|ابني|انشئ|أنشئ|صمم|أريد|اريد|build|create|make)\s+(?:لي\s+|a\s+|an\s+)?)?/iu;
    const subject = message.trim().replace(/[\u064b-\u065f]/gu, '').replace(prefix, '');
    const site = /^(?:موقعا?(?:\s|$)|website\b|web site\b)/iu.test(subject);
    const system = /^(?:سيستم داخلي|نظام داخلي|internal system\b|internal tool\b)/iu.test(subject);
    return site === system ? undefined : site ? 'site' : 'system';
}

export function resolveProjectType({ explicitType, confirmedDecision, uiDefault } = {}, registry = PROJECT_TYPES) {
    // Intentionally unused: a default tab is not evidence of intent.
    void uiDefault;
    const ids = new Set(registry.map(type => type.id));
    if (ids.size !== registry.length || registry.some(type => !type.id || !type.label)) {
        throw new TypeError('Project types require unique IDs and labels');
    }
    const previous = confirmedDecision?.source === 'user-confirmed'
        && ids.has(confirmedDecision.type) ? confirmedDecision.type : null;
    const requested = ids.has(explicitType) ? explicitType : null;
    const changingType = previous && requested && previous !== requested;
    if (!changingType && (requested || previous)) {
        return { status: 'resolved', type: requested || previous, source: 'user-confirmed', needsClarification: false };
    }
    return {
        status: 'AWAITING_USER_DECISION', needsClarification: true,
        reason: changingType ? 'project_type_change' : 'project_type_required',
        previousType: previous, requestedType: requested,
        question: changingType
            ? 'تغيير نوع المشروع قد يغيّر البنية والبيانات. هل تؤكد هذا التغيير؟'
            : 'ما نوع المشروع الذي تريد بناءه: موقع ويب أم سيستم داخلي؟',
        options: registry.map(({ id, label, description }) => ({ id, label, description })),
        allowGuidance: true,
    };
}
