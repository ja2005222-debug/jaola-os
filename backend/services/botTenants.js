/**
 * 🤖 مستأجرو جولا بوت المستقلّون — منطق صرف (توليد معرّف + تنقية إعداد) بلا
 * لمس قاعدة البيانات، ليبقى قابلاً للاختبار بمعزل عن Mongo. الحفظ/القراءة
 * الفعليان في `DB.botTenant*` (server.js) عبر نموذج `models/BotTenant.js`.
 * الحدود (طول/عدد) نفسها المستخدمة في jaolaBot.js — اتساق بين المسارين.
 */

import crypto from 'crypto';

const ID_RE = /^[a-f0-9]{20}$/;

/** معرّف مستأجر عشوائي غير قابل للتخمين (يعمل كبيانات اعتماد بلا توقيع — مثل التوكن الحالي). */
export function genTenantId() {
    return crypto.randomBytes(10).toString('hex');
}

export function isValidTenantId(id) {
    return ID_RE.test(String(id || ''));
}

/** ينقّي إعداد مستأجر قادم من العميل — نفس حدود jaolaBot.js تماماً. */
export function sanitizeTenantConfig(input = {}) {
    const faq = Array.isArray(input.faq)
        ? input.faq.filter(x => x && x.q && x.a)
            .map(x => ({ q: String(x.q).slice(0, 200), a: String(x.a).slice(0, 600) })).slice(0, 20)
        : [];
    const quick = Array.isArray(input.quick) ? input.quick.slice(0, 4).map(String).map(s => s.slice(0, 60)) : [];
    return {
        brandName: (input.brandName || 'مساعدك').toString().trim().slice(0, 40),
        emoji: (input.emoji || '🤖').toString().trim().slice(0, 4),
        color: /^#[0-9a-fA-F]{6}$/.test(input.color || '') ? input.color : '#3b82f6',
        welcome: (input.welcome || '').toString().trim().slice(0, 300),
        faq,
        quick,
        apiEnabled: input.apiEnabled !== false,
    };
}
