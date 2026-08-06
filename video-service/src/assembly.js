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

// تكلفة تعليق صوتي واحد (TTS) لكامل الفيلم — تُخصم مرة واحدة قبل
// الإرسال لمزوّد fal، منفصلة عن تكلفة التجميع نفسها.
export const NARRATION_COST_CREDITS = 1;

// علامة مائية للخطة المجانية — نص افتراضي، قابل للتخصيص. تُفرض من
// الخادم وحده حسب خطة المستخدم (req.user.plan من التوكن الموحّد)، لا
// حقلاً يرسله العميل أبداً — راجع WATERMARK_ENFORCEMENT في server.js.
export const DEFAULT_WATERMARK_TEXT = 'JAOLA OS';

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

// أنماط الكابشن المحروق بالعربية → قيم Shotstack title.style. 'نظيف'
// (minimal) هو الوحيد المؤكَّد عملياً من هذه الخدمة تحديداً (نفس المخطط
// المستخدم أصلاً في العنوان الختامي/الشعار) — البقية من كتالوج Shotstack
// الموثَّق تاريخياً لنفس الحقل لكن غير مجرَّبة من هذه الخدمة، ورفضها إن
// حدث يظهر بتفصيل رد Shotstack كاملاً (راجع shotstackProvider.js).
export const CAPTION_STYLES = Object.freeze({
    'نظيف': 'minimal',
    'عريض جريء': 'blockbuster',
    'أنيق': 'vogue',
    'ترجمة كلاسيكية': 'subtitle',
    'قلم تظليل': 'marker',
    'مستقبلي': 'future',
});
export const DEFAULT_CAPTION_STYLE = 'نظيف';

// مواضع الكابشن — نفس آلية position المؤكَّدة أصلاً للشعار/العلامة المائية.
export const CAPTION_POSITIONS = Object.freeze({
    'أسفل الشاشة': 'bottom',
    'منتصف الشاشة': 'center',
    'أعلى الشاشة': 'top',
});
export const DEFAULT_CAPTION_POSITION = 'أسفل الشاشة';

// دقة الإخراج — قيم Shotstack. 'hd' هي المؤكَّدة عملياً (أول تجميع حقيقي
// نجح بها). البقية قيم كتالوج Shotstack الموثَّقة تاريخياً بنفس الحقل؛
// '4k' تحديداً ⚠️ غير مؤكَّدة من هذه الخدمة (توثيق Shotstack غير
// متاح من بيئة التطوير) — رفض Shotstack لها يظهر بتفصيل رده الآن (لا
// فشل صامت)، وتكلفة/زمن تصديرها أعلى فعلياً بغضّ النظر عن قبولها.
export const OUTPUT_RESOLUTIONS = Object.freeze(['sd', 'hd', '1080', '4k']);
export const DEFAULT_RESOLUTION = 'hd';

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
    narrationUrl = null, resolution = DEFAULT_RESOLUTION, watermarkText = null,
    burnCaptions = false, captionStyle = null, captionPosition = null, captionAnimated = false,
}) {
    if (!Array.isArray(shots) || shots.length === 0) {
        throw new Error('لا لقطات جاهزة للتجميع.');
    }
    const scenes = [];
    // 📝 كابشن محروق: مقطع نصي أسفل الشاشة لكل لقطة تحمل كابشن خاصاً بها
    // (values.caption عند توليدها) — مسار مستقل عن الفيديو (انظر
    // shotstackProvider.js)، لا يُفعَّل إلا حين يطلبه المستخدم صراحةً.
    //
    // 🎬 نمط "متحرك": بدل مقطع واحد بالسطر الكامل طوال اللقطة، يُقسَّم
    // الكابشن لكلماته وتُوزَّع مدة اللقطة عليها بالتساوي — كل كلمة مقطع
    // Shotstack title مستقل بتوقيته الخاص، فتظهر كلمة واحدة كبيرة في كل
    // لحظة بدل السطر الثابت (أسلوب شائع في أدوات صنّاع المحتوى القصيرة).
    // مبني بالكامل على نوع المقطع المؤكَّد (title) — لا بدائل غير مجرَّبة.
    const captionCues = [];
    let cursor = 0;
    for (const shot of shots) {
        const lengthSec = Number(shot.durationSec) > 0 ? Number(shot.durationSec) : 5;
        scenes.push({
            startSec: cursor,
            lengthSec,
            layers: [{ kind: 'video', url: shot.videoUrl }],
        });
        if (burnCaptions && shot.caption) {
            if (captionAnimated) {
                const words = shot.caption.trim().split(/\s+/).filter(Boolean);
                if (words.length) {
                    const wordDur = lengthSec / words.length;
                    words.forEach((word, i) => {
                        captionCues.push({ startSec: cursor + i * wordDur, lengthSec: wordDur, text: word });
                    });
                }
            } else {
                captionCues.push({ startSec: cursor, lengthSec, text: shot.caption });
            }
        }
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
        narrationUrl: narrationUrl || null, // تعليق صوتي (TTS) يمتد طوال الفيلم
        resolution: resolution || DEFAULT_RESOLUTION,
        watermarkText: watermarkText || null, // علامة الخطة المجانية — فرض خادم فقط
        captionCues: captionCues.length ? captionCues : null,
        captionStyle: captionCues.length ? (captionStyle || null) : null,
        captionPosition: captionCues.length ? (captionPosition || null) : null,
        scenes,
    };
}
