/**
 * 🎥 cinema.js — معايير الإخراج السينمائي (لغة صانع الأفلام)
 *
 * الفارق بين "اكتب وصفاً" واستوديو حقيقي: تحكّم إخراجي منظَّم — حجم
 * اللقطة، حركة الكاميرا، الإضاءة، الأسلوب البصري — يختاره المستخدم
 * بالعربية وتُركَّب ترجمته الاصطلاحية الإنجليزية في الوصف النهائي
 * (النماذج دُرّبت على مصطلحات التصوير الإنجليزية فتستجيب لها أدق).
 *
 * التركيب في **نص الوصف** لا في حقول API متعمَّد: حقول النماذج تختلف
 * وتتغير (درس 422)، أما الوصف النصي فيفهمه كل نموذج — صفر مخاطرة.
 */

export const CINEMA_CONTROLS = Object.freeze([
    {
        key: 'shotSize', labelAr: 'حجم اللقطة',
        map: Object.freeze({
            'واسعة جداً': 'extreme wide shot',
            'واسعة': 'wide shot',
            'متوسطة': 'medium shot',
            'قريبة': 'close-up shot',
            'قريبة جداً': 'extreme close-up',
        }),
    },
    {
        key: 'cameraMove', labelAr: 'حركة الكاميرا',
        map: Object.freeze({
            'ثابتة': 'static camera on tripod',
            'دوللي للأمام': 'slow dolly in',
            'دوللي للخلف': 'slow dolly out',
            'بان جانبي': 'smooth lateral pan',
            'كرين صاعد': 'crane shot rising up',
            'تتبع': 'tracking shot following the subject',
            'دوران حول الهدف': 'orbit shot circling the subject',
            'محمولة باليد': 'handheld camera, subtle shake',
        }),
    },
    {
        key: 'lighting', labelAr: 'الإضاءة',
        map: Object.freeze({
            'الساعة الذهبية': 'golden hour sunlight',
            'نهارية ساطعة': 'bright natural daylight',
            'ليلية': 'night scene, moody low light',
            'نيون': 'vibrant neon lighting',
            'سينمائية خافتة': 'low-key dramatic cinematic lighting',
            'ضوء شموع': 'warm candlelight',
            'ضبابية ناعمة': 'soft diffused foggy light',
        }),
    },
    {
        key: 'mood', labelAr: 'المزاج والإيقاع',
        map: Object.freeze({
            'ملحمي': 'epic grand atmosphere, sweeping momentum',
            'متوتر': 'tense suspenseful atmosphere, urgent pacing',
            'هادئ تأملي': 'calm contemplative mood, slow gentle pacing',
            'رومانسي': 'romantic warm mood, soft intimate atmosphere',
            'كوميدي': 'lighthearted comedic tone, playful energy',
            'غامض': 'mysterious eerie atmosphere',
        }),
    },
    {
        key: 'style', labelAr: 'الأسلوب البصري',
        map: Object.freeze({
            'سينمائي واقعي': 'cinematic, photorealistic, shot on 35mm film, film grain',
            'نوار': 'film noir, high contrast black and white, deep shadows',
            'وثائقي': 'documentary style, natural colors',
            'خيال علمي': 'sci-fi aesthetic, futuristic atmosphere',
            'حالم': 'dreamy soft focus, ethereal atmosphere',
            'أنمي': 'anime style animation',
            'ريترو ٨٠s': 'retro 1980s aesthetic, VHS look',
        }),
    },
]);

/** خيارات كل معيار (للقوالب/الواجهة) — المفاتيح العربية فقط. */
export function cinemaFieldOptions(key) {
    const control = CINEMA_CONTROLS.find(c => c.key === key);
    return control ? Object.keys(control.map) : [];
}

/**
 * يركّب الوصف النهائي: وصف المستخدم + المعايير المختارة بمصطلحاتها
 * الإنجليزية، والوصف السلبي يُلحق بصيغة "Avoid: …" — تعمل مع كل
 * النماذج بلا الاعتماد على حقل negative_prompt المتقلب بينها.
 */
export function composeCinematicPrompt(values) {
    const parts = [String(values.prompt || '').trim()];
    const fragments = [];
    for (const control of CINEMA_CONTROLS) {
        const chosen = values[control.key];
        if (chosen && control.map[chosen]) fragments.push(control.map[chosen]);
    }
    if (fragments.length) parts.push(fragments.join(', '));
    const negative = String(values.negativePrompt || '').trim();
    if (negative) parts.push(`Avoid: ${negative}`);
    return parts.filter(Boolean).join('. ');
}
