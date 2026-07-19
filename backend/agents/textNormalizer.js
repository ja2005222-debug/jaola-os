/**
 * 🧠 Text Normalizer — JAOLA OS
 *
 * يُعالج النص قبل أي تصنيف:
 * - يصحح الأخطاء الإملائية الشائعة
 * - يُوحّد الكتابة (ألف مقصورة، همزات، إلخ)
 * - يستنبط المعنى من السياق حتى لو كان النص به أخطاء
 * - يدعم العربية والإنجليزية
 */

// ═══════════════════════════════════════════════════════
// 🔤 تطبيع الحروف العربية
// ═══════════════════════════════════════════════════════
export function normalizeArabic(text) {
    if (!text) return '';
    return text
        // توحيد الألف
        .replace(/[أإآا]/g, 'ا')
        // توحيد الياء والألف المقصورة
        .replace(/[يى]/g, 'ي')
        // توحيد التاء المربوطة
        .replace(/ة/g, 'ه')
        // حذف التشكيل
        .replace(/[\u064B-\u065F]/g, '')
        // حذف الشدة والسكون
        .replace(/[\u0651\u0652]/g, '');
}

// ═══════════════════════════════════════════════════════
// 📚 قاموس الأخطاء الشائعة → المعنى الصحيح
// ═══════════════════════════════════════════════════════
const COMMON_CORRECTIONS = {
    // أخطاء في كلمات البناء
    'بني': 'ابني',
    'build': 'build',
    'build me': 'build',
    'create': 'build',
    'make': 'build',
    'design': 'build',
    'develop': 'build',
    'maak': 'build',
    'maak een': 'build',
    'بنى': 'ابني',
    'انشي': 'انشئ',
    'انشا': 'انشئ',
    'اصنع لي': 'ابني',
    'اعمل لي': 'ابني',
    'سوي': 'ابني',
    'سوي لي': 'ابني',
    'طور': 'ابني',
    'طورلي': 'ابني',
    'صمم': 'ابني',
    'صمم لي': 'ابني',

    // أخطاء في أنواع المشاريع
    'مطعام': 'مطعم',
    'مطاعم': 'مطعم',
    'متجره': 'متجر',
    'متجر الكتروني': 'متجر إلكتروني',
    'شوب': 'متجر',
    'موقع شوبينج': 'متجر إلكتروني',
    'مستشفه': 'مستشفى',
    'مستشفا': 'مستشفى',
    'عياده': 'عيادة',
    'فندق': 'فندق',
    'فندق': 'فندق',
    'جيم': 'جيم رياضي',
    'نادي': 'نادي رياضي',
    'بورتفوليو': 'معرض أعمال',
    'بورتفليو': 'معرض أعمال',
    'portfolio': 'معرض أعمال',
    'لاندنج': 'صفحة هبوط',
    'لاندينق': 'صفحة هبوط',
    'landing page': 'صفحة هبوط',

    // أخطاء في الأوامر
    'وقف': 'توقف',
    'كفاية': 'توقف',
    'بس': 'توقف',
    'خلاص': 'توقف',
    'غير اللون': 'غير الألوان',
    'التعجيلات': 'التعديلات',
    'تعجيل': 'تعديل',
    'تحسينات': 'تعديلات',
    'عدل': 'غير',

    // أخطاء إنجليزية شائعة
    'bild': 'build',
    'biuld': 'build',
    'websit': 'website',
    'webside': 'website',
    'restaurent': 'restaurant',
    'resturant': 'restaurant',
    'hospitel': 'hospital',
};

// ═══════════════════════════════════════════════════════
// 🎯 كلمات تدل على البناء (معنى وليس نص حرفي)
// ═══════════════════════════════════════════════════════
const BUILD_INTENT_PATTERNS = [
    // عربي — أوامر بناء صريحة
    /^(ابني|اصنع|انشئ|أنشئ|اعمل|صمم|طور|بني|بنى|سوي|حط|اعمللي|اصنعلي|ابنيلي)\s+/i,
    /^(build|create|make|design|develop|generate|maak|erstelle|créer|construire)\s+/i,
    // عربي — طلب غير مباشر
    /^(اريد|أريد|ابغى|أبغى|محتاج|بحاجة)\s+(موقع|متجر|تطبيق|صفحة|مدونة)/i,
    // عربي — "عايز/عاوز" (مصري)
    /^(عايز|عاوز|عايزه|عاوزه)\s+(موقع|متجر|تطبيق)/i,
    // إنجليزي
    /^(build|create|make|design|develop|generate|give me|i want|i need|can you (make|build|create))\s+/i,
    // فرنسي
    /^(créer|faire|construire|développer)\s+/i,
];

const MODIFY_INTENT_PATTERNS = [
    /^(غير|عدل|بدل|أضف|احذف|صحح|أصلح|تعديل|حوّل|اجعل|عجل|بدّل)\s+/i,
    /^(change|edit|modify|update|fix|adjust|make it)\s+/i,
    /اللون|الخط|الحجم|الخلفية|النص|الصورة|الزر/i,
];

const STOP_INTENT_PATTERNS = [
    /^(توقف|وقف|إيقاف|إلغاء|الغ|كفاية|خلاص|بس|لا تكمل|لا تبدأ)/i,
    /^(stop|cancel|halt|quit|no|don't|dont)\b/i,
];

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية — تُعالج النص وتُعيد نسخة محسّنة
// ═══════════════════════════════════════════════════════
export function normalizeText(text) {
    if (!text) return text;

    let normalized = text.trim();

    // تطبيق تصحيحات القاموس
    for (const [wrong, correct] of Object.entries(COMMON_CORRECTIONS)) {
        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
        normalized = normalized.replace(regex, correct);
    }

    return normalized;
}

// ═══════════════════════════════════════════════════════
// 🎯 كشف النية من المعنى (بغض النظر عن الأخطاء)
// ═══════════════════════════════════════════════════════
export function detectIntentFromMeaning(text) {
    const normalized = normalizeText(text);
    const normAr = normalizeArabic(normalized);

    // فحص نية البناء
    for (const pattern of BUILD_INTENT_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(normAr)) {
            return { intent: 'build', confidence: 95, normalized };
        }
    }

    // فحص نية التعديل
    for (const pattern of MODIFY_INTENT_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(normAr)) {
            return { intent: 'modify', confidence: 95, normalized };
        }
    }

    // فحص نية الإيقاف
    for (const pattern of STOP_INTENT_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(normAr)) {
            return { intent: 'stop', confidence: 98, normalized };
        }
    }

    // Multi-language intent detection
    const lowerNorm = normalized.toLowerCase();
    const buildWords = ['build','create','make','design','develop','generate','maak','maak een','ontwerp','bouw','créer','crée','faire','concevoir','construire','erstelle','erstellen','machen','bauen','crear','crea','hacer','diseñar','fare','criar','fazer','yap','oluştur','buat','buatkan','build me','make me','create me','i want a','i need a','can you build','ich möchte','je veux','quiero','voglio','istiyorum','ik wil'];
    const modifyWords = ['change','update','modify','edit','fix','improve','add','remove','alter','verander','wijzig','changer','modifier','ajouter','ändern','bearbeiten','cambiar','modificar','değiştir','cambia','modifica'];
    const stopWords = ['stop','cancel','halt','pause','abort','stoppen','arrêter','stopp','parar','dur','ferma'];
    if (buildWords.some(w => lowerNorm.startsWith(w + ' ') || lowerNorm === w)) return { intent: 'build', confidence: 95, normalized };
    if (modifyWords.some(w => lowerNorm.startsWith(w + ' '))) return { intent: 'modify', confidence: 85, normalized };
    if (stopWords.some(w => lowerNorm.startsWith(w))) return { intent: 'stop', confidence: 95, normalized };
    // كلمة وحيدة تصف مشروعاً → build intent
    const singleWord = normalized.trim().split(/\s+/);
    const projectTypes = ['مستشفى','مستشفي','مطعم','متجر','فندق','عيادة','مقهى','مدرسة','جيم','صيدلية',
        'restaurant','hotel','hospital','clinic','cafe','store','shop','gym'];
    if (singleWord.length <= 2 && projectTypes.some(p => normalized.includes(p))) {
        return { intent: 'build', confidence: 80, normalized };
    }
    return { intent: null, confidence: 0, normalized };
}

// ═══════════════════════════════════════════════════════
// 💡 استنباط نوع المشروع من النص المكسور
// ═══════════════════════════════════════════════════════
const PROJECT_TYPE_HINTS = {
    medical:    ['طبي', 'مستشفي', 'مستشفا', 'عياده', 'دكتور', 'صحه', 'طبيب', 'مرضي', 'hospital', 'clinic', 'doctor'],
    restaurant: ['مطعام', 'مطاعم', 'اكل', 'طعام', 'قهوه', 'كافيه', 'وجبه', 'شيف', 'food', 'restaurant', 'cafe'],
    ecommerce:  ['متجره', 'شوب', 'بيع', 'شراء', 'منتجات', 'تسوق', 'shop', 'store', 'ecommerce'],
    gym:        ['جيم', 'نادي', 'رياضه', 'لياقه', 'تمرين', 'gym', 'fitness', 'sport'],
    hotel:      ['فندق', 'نزل', 'فنادق', 'غرفه', 'حجز', 'اقامه', 'hotel', 'resort'],
    portfolio:  ['بورتفوليو', 'بورتفليو', 'اعمالي', 'معرض', 'portfolio', 'cv', 'resume'],
};

export function inferProjectType(text) {
    const normAr = normalizeArabic(text.toLowerCase());

    for (const [type, hints] of Object.entries(PROJECT_TYPE_HINTS)) {
        if (hints.some(hint => normAr.includes(normalizeArabic(hint)))) {
            return type;
        }
    }
    return null;
}

// ═══════════════════════════════════════════════════════
// ❓ كشف الأسئلة — واعٍ بالعربية (\b لا يعمل مع الحروف العربية في JS)
// يُستخدم كحماية: السؤال لا يُعامل أبداً كأمر تعديل/بناء مهما قال المصنّف.
// ═══════════════════════════════════════════════════════
const QUESTION_STARTERS = /(?:^|\s)(?:هل|ما|ماذا|ماهي|ما هي|ماهو|ما هو|كيف|لماذا|ليش|ليه|وش|ايش|إيش|شو|متى|امتى|أين|اين|وين|فين|كم|بكم|مين|من هو|من هي|شنو|علاش|what|how|why|when|where|which|who|whose|can you|could you|would you|should i|is it|is there|are there|do you|does|did|tell me about)(?=\s|$|[؟?!.،,])/iu;

export function isQuestionMessage(text) {
    const t = (text || '').trim();
    if (!t) return false;
    if (t.includes('?') || t.includes('؟')) return true;
    return QUESTION_STARTERS.test(t);
}

// ═══════════════════════════════════════════════════════
// 🔨 كشف نيّة الفعل — هل الرسالة تطلب تنفيذ تغيير فعلاً؟
// التعديل التلقائي كان ينفّذ أي جملة غير استفهامية — حتى الإخبارية
// ("ولكن قائمة الأصدقاء موجودة" عدّلت الموقع!). البوابة: لا تعديل
// بلا فعل أمر أو تعبير رغبة صريح.
// ═══════════════════════════════════════════════════════
const ACTION_SIGNALS = /(?:^|\s)(?:غيّ?ر|عدّ?ل|بدّ?ل|اضف|أضف|ضف|زوّ?د|زد|احذف|امسح|شيل|صحّ?ح|اصلح|أصلح|حوّ?ل|اجعل|إجعل|ضع|حط|كبّ?ر|صغّ?ر|لوّ?ن|انقل|رتّ?ب|حسّ?ن|طوّ?ر|اربط|فعّ?ل|عطّ?ل|خلّ?ي|خليه|سوّ?ي|اعمل|أعمل|اكتب|ترجم|وسّ?ع|قلّ?ل|ارفع|انزل|ثبّ?ت|اعرض|أخفِ|اخفي|استبدل|نسّ?ق|انسق|اضبط|ظبط|زبط|حرّ?ك|انقص|وسّ?ط|عرّ?ب|بسّ?ط|رمّ?م|جمّ?ل|حدّ?ث|أعد|اعد|نفّ?ذ|طبّ?ق|قم\s+ب[؀-ۿ]*|انشئ|أنشئ|اصنع|أريد|اريد|أبغى|ابغى|أبي|ابي|عايز|عاوز|محتاج|نحتاج|نبي|ممكن تضيف|ممكن تغير|ممكن تعدل|make|add|change|remove|delete|set|update|fix|translate|resize|move|link|connect|enable|disable|replace|insert|rename|adjust|increase|decrease|show|hide|align|center|format|optimize|improve|polish|style|redesign|execute|implement|apply|build|create|ابني|ابن|أبني|أبن|ابنِ|بنّ?ي|ابنو|سوّ?ي\s+لي|اعمل\s+لي|صمّ?م|جهّ?ز|i want|i need|please add|please change|can you add|can you change)(?=\s|$|[؟?!.،,:：])/iu;

export function hasActionIntent(text) {
    const t = (text || '').trim();
    if (!t) return false;
    return ACTION_SIGNALS.test(t);
}
