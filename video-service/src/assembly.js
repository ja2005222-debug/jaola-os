/**
 * 🎞️ assembly.js — تجميع الفيلم: لقطات المشروع الجاهزة → فيلم واحد
 *
 * التجميع مهمة **تركيب** (timeline) لا توليد: تمر بنفس الطابور والأرصدة
 * والمحوّلات القائمة — مع المحاكاة تكتمل بلا ملف، ومع Shotstack تُنتج
 * فيلماً حقيقياً بانتقالات وموسيقى وعنوان ختامي.
 *
 * 🎵 الموسيقى من مكتبة يملكها صاحب المنصة حصراً (MUSIC_LIBRARY_JSON —
 * روابط مقاطع مرخصة يستضيفها بنفسه): لا نضمّن مكتبة مدمجة لأن ترخيص
 * الموسيقى مسؤولية قانونية لا تُفترض افتراضاً.
 */

export const ASSEMBLY_COST_CREDITS = 1;

// خيارات الانتقال المعروضة بالعربية → قيم Shotstack
export const TRANSITIONS = Object.freeze({
    'قطع مباشر': null,
    'تلاشٍ': 'fade',
    'انزلاق': 'slideLeft',
    'تقريب': 'zoom',
});

/** مكتبة الموسيقى المرخصة من البيئة — [{id, nameAr, url}] أو فارغة. */
export function readMusicLibrary(env = process.env) {
    if (!env.MUSIC_LIBRARY_JSON) return [];
    let list;
    try { list = JSON.parse(env.MUSIC_LIBRARY_JSON); }
    catch { throw new Error('MUSIC_LIBRARY_JSON ليس JSON صالحاً.'); }
    if (!Array.isArray(list)) throw new Error('MUSIC_LIBRARY_JSON يجب أن يكون مصفوفة مقاطع.');
    return list.map((m, i) => {
        if (!m?.id || !m?.nameAr || !/^https?:\/\//.test(String(m?.url || ''))) {
            throw new Error(`MUSIC_LIBRARY_JSON: المدخل ${i} ناقص (id, nameAr, url مطلوبة).`);
        }
        return { id: String(m.id), nameAr: String(m.nameAr), url: String(m.url) };
    });
}

/**
 * يبني مخطط الفيلم المُجمَّع من اللقطات الجاهزة (بروابط قابلة للوصول).
 * كل لقطة مشهد فيديو متتابع، ثم لوحة ختامية اختيارية.
 *
 * ⚠️ الطول: مدة اللقطة الفعلية لدى النموذج قد تتجاوز durationSec
 * المخطط له (نموذج ينتج 8 ثوانٍ لمخطط 5). نستخدم المخطط له كحد موثوق —
 * قصّ زائد خيرٌ من إطار متجمد؛ الضبط الدقيق يأتي مع أول تشغيل Shotstack.
 */
export function buildFilmSpec({ shots, transition = null, musicUrl = null, endTitle = '', aspectRatio = '16:9' }) {
    if (!Array.isArray(shots) || shots.length === 0) {
        throw new Error('لا لقطات جاهزة للتجميع.');
    }
    const scenes = [];
    let cursor = 0;
    for (const shot of shots) {
        const lengthSec = Number(shot.durationSec) > 0 ? Number(shot.durationSec) : 5;
        scenes.push({
            startSec: cursor,
            lengthSec,
            layers: [{ kind: 'video', url: shot.videoUrl }],
        });
        cursor += lengthSec;
    }
    if (endTitle) {
        scenes.push({
            startSec: cursor, lengthSec: 3,
            layers: [{ kind: 'title', text: endTitle }],
        });
        cursor += 3;
    }
    return {
        kind: 'timeline',
        assembly: true, // للعرض: "فيلم مُجمَّع" لا لقطة عادية
        durationSec: cursor,
        background: '#000000',
        aspectRatio,
        transition: transition || null,
        soundtrackUrl: musicUrl || null,
        scenes,
    };
}
