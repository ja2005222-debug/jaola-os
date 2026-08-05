/**
 * 🎞️ assembly.js — تجميع الفيلم: لقطات المشروع الجاهزة → فيلم واحد
 *
 * التجميع مهمة **تركيب** (timeline) لا توليد: تمر بنفس الطابور والأرصدة
 * والمحوّلات القائمة — مع المحاكاة تكتمل بلا ملف، ومع Shotstack تُنتج
 * فيلماً حقيقياً بانتقالات وموسيقى وعنوان ختامي.
 *
 * 🎵 الموسيقى والمؤثرات الصوتية من مكتبات يملكها صاحب المنصة حصراً
 * (MUSIC_LIBRARY_JSON وSFX_LIBRARY_JSON — روابط مقاطع مرخصة يستضيفها
 * بنفسه): لا نضمّن مكتبة مدمجة لأن ترخيص الصوت مسؤولية قانونية لا
 * تُفترض افتراضاً.
 */

export const ASSEMBLY_COST_CREDITS = 1;

// خيارات الانتقال المعروضة بالعربية → قيم Shotstack
export const TRANSITIONS = Object.freeze({
    'قطع مباشر': null,
    'تلاشٍ': 'fade',
    'انزلاق': 'slideLeft',
    'تقريب': 'zoom',
});

// فلاتر لونية (ما بعد الإنتاج) بالعربية → قيم فلاتر Shotstack
export const COLOR_FILTERS = Object.freeze({
    'بلا فلتر': null,
    'أبيض وأسود': 'greyscale',
    'دافئ مُشبع': 'boost',
    'خافت سينمائي': 'muted',
    'معتم درامي': 'darken',
});

// مقاسات المنصات: يوتيوب/ريلز/بوست
export const OUTPUT_ASPECTS = Object.freeze(['16:9', '9:16', '1:1']);

/** يقرأ مكتبة مقاطع صوتية مرخصة من متغير بيئة — [{id, nameAr, url}] أو فارغة. */
function readAudioLibrary(env, varName) {
    if (!env[varName]) return [];
    let list;
    try { list = JSON.parse(env[varName]); }
    catch { throw new Error(`${varName} ليس JSON صالحاً.`); }
    if (!Array.isArray(list)) throw new Error(`${varName} يجب أن يكون مصفوفة مقاطع.`);
    return list.map((m, i) => {
        if (!m?.id || !m?.nameAr || !/^https?:\/\//.test(String(m?.url || ''))) {
            throw new Error(`${varName}: المدخل ${i} ناقص (id, nameAr, url مطلوبة).`);
        }
        return { id: String(m.id), nameAr: String(m.nameAr), url: String(m.url) };
    });
}

/** مكتبة الموسيقى التصويرية المرخصة من البيئة. */
export function readMusicLibrary(env = process.env) {
    return readAudioLibrary(env, 'MUSIC_LIBRARY_JSON');
}

/** مكتبة مؤثرات صوتية (Hits/Whoosh) تُشغَّل عند كل نقطة انتقال بين اللقطات. */
export function readSfxLibrary(env = process.env) {
    return readAudioLibrary(env, 'SFX_LIBRARY_JSON');
}

/**
 * يبني مخطط الفيلم المُجمَّع من اللقطات الجاهزة (بروابط قابلة للوصول).
 * كل لقطة مشهد فيديو متتابع، ثم لوحة ختامية اختيارية.
 *
 * ⚠️ الطول: مدة اللقطة الفعلية لدى النموذج قد تتجاوز durationSec
 * المخطط له (نموذج ينتج 8 ثوانٍ لمخطط 5). نستخدم المخطط له كحد موثوق —
 * قصّ زائد خيرٌ من إطار متجمد؛ الضبط الدقيق يأتي مع أول تشغيل Shotstack.
 */
export function buildFilmSpec({
    shots, transition = null, musicUrl = null, endTitle = '',
    aspectRatio = '16:9', filter = null, logoUrl = null, sfxUrl = null,
}) {
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
        filter: filter || null, // فلتر لوني يطبَّق على كل اللقطات
        logoUrl: logoUrl || null, // شعار ثابت في الزاوية طوال مدة الفيلم
        // نقاط بداية كل مشهد (لقطة/ختام) — أساس تشغيل مؤثر صوتي عند كل
        // انتقال؛ محسوبة هنا بدل المحوّل كي تبقى مصدراً محايداً واحداً.
        sceneStarts: scenes.map(s => s.startSec),
        sfxUrl: sfxUrl || null,
        scenes,
    };
}
