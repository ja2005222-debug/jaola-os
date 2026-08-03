/**
 * 🧪 mockProvider.js — مزود محاكاة (الافتراضي بلا مفاتيح)
 *
 * الغرض: تطوير واختبار كامل دورة الحياة (إرسال → معالجة → اكتمال/فشل)
 * بلا أي تكلفة أو شبكة. صدقٌ كامل: لا يُفبرك روابط فيديو وهمية —
 * الاكتمال في وضع المحاكاة يُرجع videoUrl: null مع ملاحظة صريحة،
 * والواجهة تعرض ذلك كما هو ("وضع تجريبي بلا ملف فعلي").
 *
 * حتمي وقابل للحقن: يكتمل بعد pollsToComplete استطلاعاً (افتراضياً 2)،
 * ويُفشَل قسرياً إن حمل المخطط علامة _forceFail (تُضبط من الاختبارات فقط).
 */
import crypto from 'crypto';

export function createMockProvider({ pollsToComplete = 2 } = {}) {
    const renders = new Map();

    return {
        name: 'mock',

        /** يُرجع { providerId } أو يرمي خطأ (يحاكي رفض المزود). */
        async submitRender(spec) {
            if (spec && spec._forceSubmitError) {
                throw new Error('محاكاة: المزود رفض الطلب.');
            }
            const providerId = `mock-${crypto.randomBytes(6).toString('hex')}`;
            renders.set(providerId, { spec, polls: 0 });
            return { providerId };
        },

        /** يُرجع { status: 'rendering'|'done'|'failed', videoUrl?, error?, note? }. */
        async getRender(providerId) {
            const entry = renders.get(providerId);
            if (!entry) return { status: 'failed', error: 'محاكاة: معرف تصدير مجهول.' };
            entry.polls += 1;
            if (entry.spec && entry.spec._forceFail) {
                return { status: 'failed', error: 'محاكاة: فشل التصدير.' };
            }
            if (entry.polls >= pollsToComplete) {
                return {
                    status: 'done',
                    videoUrl: null,
                    note: 'وضع المحاكاة — اكتملت الدورة بنجاح بلا ملف فيديو فعلي.',
                };
            }
            return { status: 'rendering' };
        },
    };
}
