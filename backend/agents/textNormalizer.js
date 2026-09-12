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
/**
 * 🔻 إسقاطُ التشكيل وحدَه — **مصدرٌ واحدٌ لهذه القاعدة**، يقرؤه `normalizeArabic`
 *    ومطابقةُ الكلمات المفتاحيّة معاً.
 *
 * قِيس على سجلّ إنتاجٍ حيّ (٢٠٢٦-٠٩-٠٩، ١١:٥٢): كتب صاحبُ المشروع «أبغى **منصّة**
 * لجمعية خيرية»، والمعجمُ يخزّن «منصة» غُفلاً. فالشدّةُ (`\u0651`) بين الصاد والتاء
 * منعت المطابقة، فلم يجد `staticKind` في الطلب **ولا لفظَ تطبيقٍ واحداً**، فصنّفه
 * «موقع تعريفي» — فبُنيت لمنصّةِ إدارةٍ صفحةُ تسويقٍ فيها `pricing` و`testimonials`.
 * حرفٌ واحدٌ غيرُ منطوقٍ قلب المنتجَ كلَّه.
 *
 * والمدى `\u064B-\u065F` يشمل التنوينَ والحركاتِ والشدّةَ والسكون. (كان في
 * `normalizeArabic` سطرٌ ثانٍ لـ`\u0651\u0652` وهما داخلَ المدى أصلاً — فأُدمج.)
 */
export const stripDiacritics = (text) => String(text || '').replace(/[\u064B-\u065F]/g, '');

export function normalizeArabic(text) {
    if (!text) return '';
    return stripDiacritics(text)
        // توحيد الألف
        .replace(/[أإآا]/g, 'ا')
        // توحيد الياء والألف المقصورة
        .replace(/[يى]/g, 'ي')
        // توحيد التاء المربوطة
        .replace(/ة/g, 'ه');
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
    // In an explicit edit command, dialectal «بس ما تغير» is a constraint.
    const questionText = /^(?:صلح|أصلح|اصلح|عدل|عدّل|غير|غيّر|ضيف|أضف|اضف)\s/u.test(t)
        ? t.replace(/بس\s+ما\s+(?=تغير|تغيّر|تبدل|تحذف)/gu, 'بس لا ') : t;
    return QUESTION_STARTERS.test(questionText.replace(/(^|\s)و(?=كيف\s|هل\s|ماذا\s|لماذا\s)/gu, '$1'));
}

// ═══════════════════════════════════════════════════════
// 🔨 كشف نيّة الفعل — هل الرسالة تطلب تنفيذ تغيير فعلاً؟
// التعديل التلقائي كان ينفّذ أي جملة غير استفهامية — حتى الإخبارية
// ("ولكن قائمة الأصدقاء موجودة" عدّلت الموقع!). البوابة: لا تعديل
// بلا فعل أمر أو تعبير رغبة صريح.
// ═══════════════════════════════════════════════════════
const ACTION_SIGNALS = /(?:^|\s)(?:غيّ?ر|عدّ?ل|بدّ?ل|اضف|أضف|ضف|زوّ?د|زد|احذف|امسح|شيل|صحّ?ح|اصلح|أصلح|حوّ?ل|اجعل|إجعل|ضع|حط|اعطِ?ي?|أعطِ?ي?|اعطني|أعطني|امنح|أمنح|خصّ?ص|كبّ?ر|صغّ?ر|لوّ?ن|انقل|رتّ?ب|حسّ?ن|طوّ?ر|اربط|فعّ?ل|عطّ?ل|خلّ?ي|خليه|سوّ?ي|اعمل|أعمل|اكتب|ترجم|وسّ?ع|قلّ?ل|ارفع|انزل|ثبّ?ت|اعرض|أخفِ|اخفي|استبدل|نسّ?ق|انسق|اضبط|ظبط|زبط|حرّ?ك|انقص|وسّ?ط|عرّ?ب|بسّ?ط|رمّ?م|جمّ?ل|حدّ?ث|أعد|اعد|نفّ?ذ|طبّ?ق|قم\s+ب[؀-ۿ]*|انشئ|أنشئ|اصنع|استكمل|اكمل|أكمل|كمّ?ل|واصل|تابع|استمر|أريد|اريد|أبغى|ابغى|أبي|ابي|عايز|عاوز|محتاج|نحتاج|نبي|ممكن تضيف|ممكن تغير|ممكن تعدل|make|add|change|remove|delete|set|update|fix|translate|resize|move|link|connect|enable|disable|replace|insert|rename|adjust|increase|decrease|show|hide|align|center|format|optimize|improve|polish|style|redesign|execute|implement|apply|build|create|continue|resume|ابني|ابن|أبني|أبن|ابنِ|بنّ?ي|ابنو|سوّ?ي\s+لي|اعمل\s+لي|صمّ?م|جهّ?ز|i want|i need|please add|please change|can you add|can you change)(?=\s|$|[؟?!.،,:：])/iu;

export function hasActionIntent(text) {
    const t = (text || '').trim();
    if (!t) return false;
    return ACTION_SIGNALS.test(t);
}

// ═══════════════════════════════════════════════════════
// 📋 مواصفةٌ كاملة — وثيقةٌ لا جملة
//
// جاء هذا من بلاغِ المالك: مواصفةُ نظامِ نقاطِ بيعٍ من ٤٤ بنداً تُرسَل، فتُعامَل **تعديلاً
// جراحيّاً** على المشروع القائم (`hasActionIntent` تُطابق «أريد»، والرسالةُ ليست سؤالاً) —
// فتذهب وثيقةُ نظامٍ كاملةٍ إلى مُرقِّعِ ملفٍّ واحد. والمواصفةُ طلبُ بناءٍ بطبيعتها.
//
// 🔬 قِيست الإشاراتُ على متن: المواصفةُ ١٨٦٨٠ حرفاً و٣٦ قسماً مرقّماً؛ وكلُّ ما عداها في المتن
//    (تعديلٌ قصير، تعديلٌ متوسّط، أمرُ بناءٍ صريح، سؤال، جملةٌ إخباريّة، طلبٌ طويلٌ بلا ترقيم)
//    ≤ ١٨٩ حرفاً و**صفرُ** أقسام. فالفصلُ واسعٌ لا حدّيّ.
//
// والشرطان معاً لا أحدُهما: الطولُ وحدَه يلتقط طلبَ تعديلٍ مُسهَباً، والترقيمُ وحدَه يلتقط
// «١. أحمر ٢. أزرق ٣. أخضر». الوثيقةُ ما جمعت الأمرَين — سعةً وتعداداً.
//
// ولا نُعمّم أكثرَ من ذلك عمداً: خطأُ الإيجاب هنا يحوّل تعديلاً مشروعاً إلى سؤالِ «أعيد البناء؟»
// على مشروعٍ قائم، وهو ضررٌ أكبرُ من خطأ السلب.
// ═══════════════════════════════════════════════════════
const SPEC_MIN_CHARS = 1200;
const SPEC_MIN_SECTIONS = 6;
// بندٌ مرقّمٌ في أوّل سطره: «1.» أو «2)» أو «٣-» — عربيّةً كانت أرقامُه أو لاتينيّة.
// 📐 رأسُ ماركداون اختياريّ قبل الرقم (`## 1.`): قِيس على مواصفةٍ حقيقيّة أنّ الصيغةَ
//    الماركداونيّة تُعطي **صفرَ** بنودٍ، فتسقط `isFullSpecification` ومعها كلُّ ما تحرسه —
//    بوّابةُ المتطلّبات (PM/9، PM/12) وتسميةُ الكيانات (PM/23) و`specHead` (PM/11: تعود
//    بالوثيقة كلِّها بدل جملة التسمية). والرقمُ يبقى **شرطاً**: `## الغاية` عنوانٌ لا بند.
const NUMBERED_SECTION = /^[\t ]*(?:#{1,6}[\t ]*)?[\d\u0660-\u0669]{1,2}\s*[.)\u061B:-]\s*\S/gmu;


/**
 * 🚫 النفيُ يُطوى قبل أيِّ مطابقة — الجملةُ التي تنفي لا تُوجب. دالّةٌ نقيّة.
 *
 * قِيس من أوّل بناءٍ حرٍّ حيّ (`from0`): «تعمل بالكامل داخل المتصفّح **بلا خادم ولا حساب**» خرجت
 * بـNext.js + Prisma، لأنّ المطابقةَ كلماتٌ مفردةٌ لا ترى سياقاً فالتقطت «حساب» من «بلا حساب» —
 * أي أنّ **النفيَ نفسَه هو ما أوجب**.
 *
 * وقِيس ثانيةً بعد PM/22 أنّ العلّةَ نفسَها تنخر **بوّابةَ الفهم** الجديدة: المفهومُ الوحيدُ الذي
 * رأتْه `conceptsInText` في مواصفة «وِرد» كلِّها كان `account` من «بلا حساب» — فأنقذ فهماً مهلوَساً
 * (`Grade/ForumPost/Teacher/Parent`) من أن يُوصَم «لا يمسّ الطلب». فمن هنا صار موضعُها واحداً:
 * أداةُ نصٍّ عامّة لا تخصُّ سؤالَ الخادم، ومستهلكاها يقرآن من مصدرٍ واحد.
 *
 * القاعدة: أداةُ نفيٍ (`بلا`/`بدون`/`دون`/`no`/`without`) تُلغي ما بعدها إلى أوّل فاصلٍ أو رابطِ
 * استدراك (`لكن`/`إلّا`/`but`) — لا إلى آخر النصّ. و«ولا» بعد نفيٍ تمتدّ به: «بلا خادم **ولا** حساب».
 *
 * حدٌّ مكتوب: هذا نفيٌ **معجميّ** لا نحويّ؛ «لا أريد أن أبني بلا حساب» تُقرأ نفياً وهي إثبات.
 * لم يُقَس مثالٌ حقيقيٌّ كهذا، ولا يُدَّعى تغطيتُه.
 */
const NEGATION_SCOPE = /(?:^|[\s،,.؛;:()])(?:بلا|بدون|دون|without|no)\s+((?:(?!\s(?:لكن|لكنّ|إلا|إلّا|but|however)\s)[^،,.؛;:()\n])*)/giu;

export function stripNegated(text) {
    return String(text || '').replace(NEGATION_SCOPE, ' ');
}

/** عددُ البنود المرقّمة في مستهلّ الأسطر. */
export function numberedSections(text) {
    return (String(text || '').match(NUMBERED_SECTION) || []).length;
}

// توأمُ `NUMBERED_SECTION` أعلاه — يبقيان متطابقَين في ما يعدّانه بنداً، وإلّا عدّت
// البوّابةُ ما لا تقرؤه القائمة.
const NUMBERED_LINE = /^[\t ]*(?:#{1,6}[\t ]*)?([\d\u0660-\u0669]{1,2})\s*[.)\u061B:-]\s*(\S.*)$/u;
const AR_DIGITS = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
const toLatinDigits = (s) => String(s).replace(/[\u0660-\u0669]/g, (d) => String(AR_DIGITS.indexOf(d)));

/**
 * 📋 بنودُ الوثيقة بعينها (PM/9): كلُّ سطرٍ مرقّم بنداً — رقمُه، وعنوانُه (بقيّةُ السطر)، ومتنُه (الأسطرُ التالية حتّى
 * البند التالي). هذه لغةُ المستخدم لا لغةُ المعجم: الحكمُ والإكمالُ يقرآنها كما كُتبت.
 * @returns {Array<{ n: number, title: string, body: string }>}
 */
export function specSections(text) {
    const out = [];
    for (const raw of String(text || '').split('\n')) {
        const m = NUMBERED_LINE.exec(raw);
        if (m) { out.push({ n: Number(toLatinDigits(m[1])), title: m[2].trim(), body: '' }); continue; }
        const last = out[out.length - 1];
        if (last && raw.trim()) last.body = last.body ? `${last.body}\n${raw.trim()}` : raw.trim();
    }
    return out;
}

/**
 * 🏷️ رأسُ الوثيقة (PM/11): ما قبل أوّل بندٍ مرقّم — الجملةُ التي يسمّي فيها المستخدمُ منتجَه («أريد بناء نظام إدارة مكتبة…»).
 * جملةٌ بلا بنود = رأسُها كلُّها؛ قائمةٌ مرقّمة من أوّلها = بلا رأس.
 */
export function specHead(text) {
    const lines = String(text || '').split('\n');
    const i = lines.findIndex(l => NUMBERED_LINE.test(l));
    return (i === -1 ? lines : lines.slice(0, i)).join('\n').trim();
}

/** قصٌّ على حدّ كلمة بعلامة «…» — لا كلمةً مبتورة في منتصفها (اسمُ التطبيق المعروض). */
export function clipWords(text, max = 60) {
    const t = String(text || '').trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s،,:;—-]+$/u, '') + '…';
}

/**
 * 🚧 **أهذا من جنس ما يصنعه جولا أصلاً؟** — لا موضوعُ الطلب، بل **ما سمّاه صاحبُه مُخرَجاً**.
 *
 * قِيس (١١ طلباً، فصلٌ تامّ عند ٢): طلباتُ المواقع والتطبيقات تُسمّي **صفرَ** ملفّاتٍ برمجيّة
 * غريبة — حتّى «غيّر لون الأزرار في styles.css» و«اقرأ المنتجات من data.json»، لأنّ ملفّات
 * جولا نفسِها تُستثنى. وما هو خارجُ ما يصنع يُسمّي **اثنين فأكثر**: سكربتُ ترحيلٍ (٢)،
 * خطُّ CI (٢)، مكتبةُ npm (٤)، وحزمةُ اختباراتٍ لشفرة خادم (٢٣).
 *
 * 🔤 **ولمَ لا قائمةَ كلماتٍ محظورة؟** لأنّها تُصيب موضوعاً لا شكلاً: «اختبارات» ترد في موقعِ
 *    مدرسةٍ بريئاً. والمقيسُ هنا **شكلُ المُخرَج**، وهو مفتوحٌ لا يحتاج معرفةَ المجال — وذاك درسُ
 *    `PM/22` نفسُه: المقارنةُ المفتوحة تُقاس بكلمات صاحب الطلب لا بقائمةٍ مغلقة.
 *
 * ⚠️ والغيابُ ليس دليلَ شيء: طلبٌ خارجَ النطاق لا يسمّي ملفّات («اكتب لي خوارزميّة فرز») يمرّ —
 *    وذلك **حدٌّ مكتوب لا نقصٌ مستور**. المقياسُ يُدين بدليلٍ ولا يُبرّئ بغيابه.
 */
// مُخرَجاتُ جولا نفسِه (وما يكتبه في مشاريع المستخدمين) — ذكرُها ليس دليلَ خروج.
const OWN_ARTIFACTS = /^(?:index\.html|styles?\.css|script\.js|app\.js|main\.js|sw\.js|manifest\.json|content\.js|data\.js(?:on)?|index\.js)$/i;
// 🔗 الروابطُ تُنزع أوّلاً: «https://example.com/shop/items/» كان يُخرِج «com/shop/items/»
//    مساراً — فطلبُ موقعٍ يذكر رابطَين يُدان بلا ذنب. (مقيس.)
const URLS = /https?:\/\/\S+/gu;
// اسمُ ملفٍّ بامتدادٍ برمجيّ **مع مجلّداته** (`tests/parse.test.js` كاملاً لا «test.js» مبتوراً)،
// أو مسارُ مجلّدَين فأكثر (`backend/testing/unit/`).
const CODE_ARTIFACT = /(?:[\w-]+\/)*[\w.-]+\.(?:m?[jt]sx?|py|rb|go|rs|java|php|ya?ml|toml|ini|sh|sql|lock)\b|(?:[.\w-]+\/){2,}/gu;

/**
 * أسماءُ المُخرَجات البرمجيّة الغريبة التي سمّاها الطلبُ صراحةً (بلا تكرار، وبلا ملفّات جولا).
 * @returns {string[]}
 */
export function foreignCodeArtifacts(text, { limit = 20000 } = {}) {
    const out = [];
    const clean = String(text || '').slice(0, limit).replace(URLS, ' ');
    for (const raw of clean.match(CODE_ARTIFACT) || []) {
        const name = raw.trim();
        if (OWN_ARTIFACTS.test(name.replace(/^.*\//, '')) || out.includes(name)) continue;
        out.push(name);
    }
    return out;
}

/** أخارجَ ما يصنعه جولا؟ (اثنان فأكثر من المُخرَجات الغريبة — العتبةُ مقيسة، انظر أعلاه) */
export function isOutOfScopeRequest(text) {
    return foreignCodeArtifacts(text).length >= 2;
}

/** أهذه وثيقةُ مواصفاتٍ لنظامٍ كامل (لا جملةُ طلب)؟ */
export function isFullSpecification(text) {
    const t = String(text || '');
    return t.length >= SPEC_MIN_CHARS && numberedSections(t) >= SPEC_MIN_SECTIONS;
}

// ═══════════════════════════════════════════════════════
// 🏗️ كشف «بناء بهوية جديدة» — يميّز طلب موقع جديد (يستبدل الهوية) عن المتابعة
// («اكمل»). عند البناء الجديد يجب *عدم* دمج النموذج القديم كي لا يرث المتجر
// أدوار مشروع سابق (TeamMember/Driver) — جذر «متجر عطور بنى إدارة مشاريع».
// ═══════════════════════════════════════════════════════
// ملاحظة: \b لا يعمل مع الحروف العربية في JS — نستخدم lookahead لمسافة/نهاية/ترقيم.
const REBUILD_SIGNALS = /(?:أعد|اعد)\s+(?:ال)?(?:بناء|تصميم|إنشاء|انشاء)|من\s+جديد|من\s+الصفر|rebuild|from\s+scratch|start\s+over|redo/iu;
const NEW_BUILD_STARTERS = /^\s*["'«]?\s*(?:ابني|أبني|ابنِ|أبنِ|ابن|انشئ|أنشئ|اصنع|صمّم|صمم|build|create|make|generate|design)(?=\s|$|[؟?!.،,:])/iu;

// 🛡️ عبارات منفيّة تحمي من قلب المعنى: «لا تبدأ من الصفر» كانت تُطابق
// «من الصفر» فتُحوّل الاستئنافَ إعادةَ بناءٍ تدهس المشروع (عطل إنتاجي حقيقي).
// نحذف الجملة المنفيّة كاملة قبل فحص الإشارات.
const NEGATED_CLAUSE = /(?:لا|لن|بدون|دون|من\s+غير)\s+(?:تبدأ|تبدا|يبدأ|يبدا|نبدأ|نبدا|البدء|بدء|إعادة|اعادة|تعد|تعيد|هدم)[^\n.،؛!؟—-]*|(?:don'?t|do\s+not|never|without|no\s+need\s+to)\s+(?:start|rebuild|redo|recreate)[^\n.!?]*/giu;
function stripNegatedClauses(t) {
    return t.replace(NEGATED_CLAUSE, ' ');
}

// 🧭 هدف استئناف مولَّد داخلياً (buildContinuationGoal) — لا يُعامَل أبداً
// كبناء جديد/إعادة بناء مهما احتوى نصّه.
export function isContinuationGoal(text) {
    return /^\s*\[استئناف\]/.test(text || '');
}

/** طلب إعادة بناء صريح للمشروع الحالي (نفس الهوية، من جديد). */
export function isExplicitRebuild(text) {
    const t = (text || '').trim();
    if (!t || isContinuationGoal(t)) return false;
    return REBUILD_SIGNALS.test(stripNegatedClauses(normalizeArabic(t)));
}

/** طلب بناء موقع جديد بهوية جديدة (أمر بناء يصف موضوعاً) → يستبدل النموذج. */
export function isExplicitNewBuild(text) {
    const t = (text || '').trim();
    if (!t) return false;
    if (isExplicitRebuild(t)) return true;
    // أمر بناء في البداية + وصف كافٍ (كلمتان فأكثر) = موقع جديد، لا مجرّد «ابنِ»
    return NEW_BUILD_STARTERS.test(t) && t.split(/\s+/).length >= 2;
}
