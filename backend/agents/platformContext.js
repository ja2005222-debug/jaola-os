/**
 * 🧭 Platform Context — معلومات حقيقية عن منصّة JAOLA OS نفسها للوكلاء
 *
 * المشكلة: وكلاء لوحة الأدمِن (المصنوعون من نموذج «صنع وكيل جديد» البسيط)
 * كانوا شخصيات LLM فارغة — بلا أي معرفة بالموقع، فيتعاملون معه كغريب عند
 * أي سؤال. هذه الدالة تبني سياقاً حقيقياً (لا مُختلَق) في كل استدعاء:
 * عدد القوالب الفعلي من listClones()، ورابط المنصّة المباشر، ولقطة حيّة
 * (عنوان + وصف) من الموقع نفسه إن كان الرابط معروفاً ومتاحاً.
 *
 * فشل أي جزء (لا رابط مضبوط، تعذّر الوصول) لا يوقف شيئاً — يُحذف من
 * السياق بصمت فقط.
 */
import { listClones } from './cloneTemplates/index.js';

export async function buildPlatformContext() {
    const lines = [];
    try {
        const clones = listClones();
        lines.push(`- عدد القوالب الجاهزة العاملة فعلياً على المنصّة: ${clones.length}`);
    } catch { /* لا يوقف السياق */ }

    const liveUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    if (liveUrl) {
        lines.push(`- الرابط المباشر للمنصّة: ${liveUrl}`);
        try {
            const res = await fetch(liveUrl, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                const html = await res.text();
                const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
                const desc = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1]?.trim();
                if (title) lines.push(`- عنوان الموقع الحالي (لقطة حيّة): ${title}`);
                if (desc) lines.push(`- وصف الموقع الحالي (لقطة حيّة): ${desc}`);
            }
        } catch { /* تعذّر الوصول — يُتجاهَل، لا كسر */ }
    }

    if (!lines.length) return '';
    return [
        'معلومات حقيقية عن منصّة JAOLA OS التي تعمل ضمنها — استخدمها إن كانت متعلقة بسؤال المستخدم، ولا تخترع تفاصيل غيرها:',
        ...lines,
    ].join('\n');
}
