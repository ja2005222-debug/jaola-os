/**
 * 🗺️ airports.js — إحداثيات مطارات ثابتة (IATA → مدينة/دولة/إحداثيات)
 *
 * مصدر وحيد يخدم غرضين: البحث عن فنادق قريبة من الوجهة (Duffel Stays
 * يطلب إحداثيات جغرافية لا رمز IATA)، وطقس الوجهة (Open-Meteo، المرحلة
 * ٢ج). قائمة ثابتة يدوية — لا اشتقاق من خدمة خارجية إضافية لهذا وحده.
 * تغطي أكبر المطارات في الشرق الأوسط وأشهر وجهات السفر عالمياً؛ رمز
 * غير موجود هنا يُرجع null والمستدعي يتعامل معه بوضوح (لا تخمين إحداثيات).
 */
const MIN_QUERY_LEN = 2; // أقل طول بحث مفيد — ما دونه يطابق كل شيء

export const AIRPORT_COORDS = {
    RUH: { lat: 24.9576, lon: 46.6988, city: 'الرياض', country: 'السعودية', cityEn: 'Riyadh', countryEn: 'Saudi Arabia' },
    JED: { lat: 21.6796, lon: 39.1565, city: 'جدة', country: 'السعودية', cityEn: 'Jeddah', countryEn: 'Saudi Arabia' },
    DMM: { lat: 26.4712, lon: 49.7979, city: 'الدمام', country: 'السعودية', cityEn: 'Dammam', countryEn: 'Saudi Arabia' },
    MED: { lat: 24.5534, lon: 39.7051, city: 'المدينة المنورة', country: 'السعودية', cityEn: 'Medina', countryEn: 'Saudi Arabia' },
    AHB: { lat: 18.2404, lon: 42.6562, city: 'أبها', country: 'السعودية', cityEn: 'Abha', countryEn: 'Saudi Arabia' },
    CAI: { lat: 30.1219, lon: 31.4056, city: 'القاهرة', country: 'مصر', cityEn: 'Cairo', countryEn: 'Egypt' },
    HRG: { lat: 27.1783, lon: 33.7994, city: 'الغردقة', country: 'مصر', cityEn: 'Hurghada', countryEn: 'Egypt' },
    SSH: { lat: 27.9773, lon: 34.3950, city: 'شرم الشيخ', country: 'مصر', cityEn: 'Sharm El Sheikh', countryEn: 'Egypt' },
    DXB: { lat: 25.2532, lon: 55.3657, city: 'دبي', country: 'الإمارات', cityEn: 'Dubai', countryEn: 'United Arab Emirates' },
    AUH: { lat: 24.4330, lon: 54.6511, city: 'أبوظبي', country: 'الإمارات', cityEn: 'Abu Dhabi', countryEn: 'United Arab Emirates' },
    SHJ: { lat: 25.3286, lon: 55.5172, city: 'الشارقة', country: 'الإمارات', cityEn: 'Sharjah', countryEn: 'United Arab Emirates' },
    DOH: { lat: 25.2731, lon: 51.6081, city: 'الدوحة', country: 'قطر', cityEn: 'Doha', countryEn: 'Qatar' },
    KWI: { lat: 29.2266, lon: 47.9689, city: 'الكويت', country: 'الكويت', cityEn: 'Kuwait City', countryEn: 'Kuwait' },
    BAH: { lat: 26.2708, lon: 50.6336, city: 'المنامة', country: 'البحرين', cityEn: 'Manama', countryEn: 'Bahrain' },
    MCT: { lat: 23.5933, lon: 58.2844, city: 'مسقط', country: 'عُمان', cityEn: 'Muscat', countryEn: 'Oman' },
    AMM: { lat: 31.7226, lon: 35.9932, city: 'عمّان', country: 'الأردن', cityEn: 'Amman', countryEn: 'Jordan' },
    BEY: { lat: 33.8209, lon: 35.4884, city: 'بيروت', country: 'لبنان', cityEn: 'Beirut', countryEn: 'Lebanon' },
    DAM: { lat: 33.4114, lon: 36.5156, city: 'دمشق', country: 'سوريا', cityEn: 'Damascus', countryEn: 'Syria' },
    BGW: { lat: 33.2625, lon: 44.2346, city: 'بغداد', country: 'العراق', cityEn: 'Baghdad', countryEn: 'Iraq' },
    EBL: { lat: 36.2375, lon: 43.9633, city: 'أربيل', country: 'العراق', cityEn: 'Erbil', countryEn: 'Iraq' },
    TUN: { lat: 36.8510, lon: 10.2272, city: 'تونس', country: 'تونس', cityEn: 'Tunis', countryEn: 'Tunisia' },
    ALG: { lat: 36.6910, lon: 3.2154, city: 'الجزائر', country: 'الجزائر', cityEn: 'Algiers', countryEn: 'Algeria' },
    CMN: { lat: 33.3675, lon: -7.5900, city: 'الدار البيضاء', country: 'المغرب', cityEn: 'Casablanca', countryEn: 'Morocco' },
    RAK: { lat: 31.6069, lon: -8.0363, city: 'مراكش', country: 'المغرب', cityEn: 'Marrakesh', countryEn: 'Morocco' },
    KRT: { lat: 15.5895, lon: 32.5532, city: 'الخرطوم', country: 'السودان', cityEn: 'Khartoum', countryEn: 'Sudan' },
    IST: { lat: 41.2753, lon: 28.7519, city: 'إسطنبول', country: 'تركيا', cityEn: 'Istanbul', countryEn: 'Turkey' },
    SAW: { lat: 40.8986, lon: 29.3092, city: 'إسطنبول (صبيحة)', country: 'تركيا', cityEn: 'Istanbul Sabiha', countryEn: 'Turkey' },
    ADB: { lat: 38.2924, lon: 27.1570, city: 'إزمير', country: 'تركيا', cityEn: 'Izmir', countryEn: 'Turkey' },
    CDG: { lat: 49.0097, lon: 2.5479, city: 'باريس', country: 'فرنسا', cityEn: 'Paris', countryEn: 'France' },
    LHR: { lat: 51.4700, lon: -0.4543, city: 'لندن', country: 'بريطانيا', cityEn: 'London', countryEn: 'United Kingdom' },
    LGW: { lat: 51.1537, lon: -0.1821, city: 'لندن (غاتويك)', country: 'بريطانيا', cityEn: 'London Gatwick', countryEn: 'United Kingdom' },
    FRA: { lat: 50.0379, lon: 8.5622, city: 'فرانكفورت', country: 'ألمانيا', cityEn: 'Frankfurt', countryEn: 'Germany' },
    MUC: { lat: 48.3538, lon: 11.7861, city: 'ميونخ', country: 'ألمانيا', cityEn: 'Munich', countryEn: 'Germany' },
    MAD: { lat: 40.4983, lon: -3.5676, city: 'مدريد', country: 'إسبانيا', cityEn: 'Madrid', countryEn: 'Spain' },
    BCN: { lat: 41.2974, lon: 2.0833, city: 'برشلونة', country: 'إسبانيا', cityEn: 'Barcelona', countryEn: 'Spain' },
    FCO: { lat: 41.8003, lon: 12.2389, city: 'روما', country: 'إيطاليا', cityEn: 'Rome', countryEn: 'Italy' },
    MXP: { lat: 45.6306, lon: 8.7281, city: 'ميلانو', country: 'إيطاليا', cityEn: 'Milan', countryEn: 'Italy' },
    AMS: { lat: 52.3105, lon: 4.7683, city: 'أمستردام', country: 'هولندا', cityEn: 'Amsterdam', countryEn: 'Netherlands' },
    VIE: { lat: 48.1103, lon: 16.5697, city: 'فيينا', country: 'النمسا', cityEn: 'Vienna', countryEn: 'Austria' },
    ZRH: { lat: 47.4647, lon: 8.5492, city: 'زيورخ', country: 'سويسرا', cityEn: 'Zurich', countryEn: 'Switzerland' },
    GVA: { lat: 46.2381, lon: 6.1090, city: 'جنيف', country: 'سويسرا', cityEn: 'Geneva', countryEn: 'Switzerland' },
    CPH: { lat: 55.6180, lon: 12.6560, city: 'كوبنهاغن', country: 'الدنمارك', cityEn: 'Copenhagen', countryEn: 'Denmark' },
    ARN: { lat: 59.6519, lon: 17.9186, city: 'ستوكهولم', country: 'السويد', cityEn: 'Stockholm', countryEn: 'Sweden' },
    OSL: { lat: 60.1976, lon: 11.1004, city: 'أوسلو', country: 'النرويج', cityEn: 'Oslo', countryEn: 'Norway' },
    HEL: { lat: 60.3172, lon: 24.9633, city: 'هلسنكي', country: 'فنلندا', cityEn: 'Helsinki', countryEn: 'Finland' },
    WAW: { lat: 52.1657, lon: 20.9671, city: 'وارسو', country: 'بولندا', cityEn: 'Warsaw', countryEn: 'Poland' },
    PRG: { lat: 50.1008, lon: 14.2600, city: 'براغ', country: 'التشيك', cityEn: 'Prague', countryEn: 'Czechia' },
    BUD: { lat: 47.4369, lon: 19.2556, city: 'بودابست', country: 'المجر', cityEn: 'Budapest', countryEn: 'Hungary' },
    ATH: { lat: 37.9364, lon: 23.9445, city: 'أثينا', country: 'اليونان', cityEn: 'Athens', countryEn: 'Greece' },
    LIS: { lat: 38.7756, lon: -9.1354, city: 'لشبونة', country: 'البرتغال', cityEn: 'Lisbon', countryEn: 'Portugal' },
    DUB: { lat: 53.4264, lon: -6.2499, city: 'دبلن', country: 'أيرلندا', cityEn: 'Dublin', countryEn: 'Ireland' },
    BRU: { lat: 50.9010, lon: 4.4844, city: 'بروكسل', country: 'بلجيكا', cityEn: 'Brussels', countryEn: 'Belgium' },
    IAD: { lat: 38.9531, lon: -77.4565, city: 'واشنطن', country: 'أمريكا', cityEn: 'Washington', countryEn: 'United States' },
    JFK: { lat: 40.6413, lon: -73.7781, city: 'نيويورك', country: 'أمريكا', cityEn: 'New York', countryEn: 'United States' },
    LAX: { lat: 33.9416, lon: -118.4085, city: 'لوس أنجلوس', country: 'أمريكا', cityEn: 'Los Angeles', countryEn: 'United States' },
    ORD: { lat: 41.9742, lon: -87.9073, city: 'شيكاغو', country: 'أمريكا', cityEn: 'Chicago', countryEn: 'United States' },
    MIA: { lat: 25.7959, lon: -80.2870, city: 'ميامي', country: 'أمريكا', cityEn: 'Miami', countryEn: 'United States' },
    SFO: { lat: 37.6213, lon: -122.3790, city: 'سان فرانسيسكو', country: 'أمريكا', cityEn: 'San Francisco', countryEn: 'United States' },
    YYZ: { lat: 43.6777, lon: -79.6248, city: 'تورونتو', country: 'كندا', cityEn: 'Toronto', countryEn: 'Canada' },
    YVR: { lat: 49.1967, lon: -123.1815, city: 'فانكوفر', country: 'كندا', cityEn: 'Vancouver', countryEn: 'Canada' },
    GRU: { lat: -23.4356, lon: -46.4731, city: 'ساو باولو', country: 'البرازيل', cityEn: 'Sao Paulo', countryEn: 'Brazil' },
    MEX: { lat: 19.4363, lon: -99.0721, city: 'مكسيكو سيتي', country: 'المكسيك', cityEn: 'Mexico City', countryEn: 'Mexico' },
    SIN: { lat: 1.3644, lon: 103.9915, city: 'سنغافورة', country: 'سنغافورة', cityEn: 'Singapore', countryEn: 'Singapore' },
    HKG: { lat: 22.3080, lon: 113.9185, city: 'هونغ كونغ', country: 'هونغ كونغ', cityEn: 'Hong Kong', countryEn: 'Hong Kong' },
    NRT: { lat: 35.7720, lon: 140.3929, city: 'طوكيو (ناريتا)', country: 'اليابان', cityEn: 'Tokyo Narita', countryEn: 'Japan' },
    HND: { lat: 35.5494, lon: 139.7798, city: 'طوكيو (هانيدا)', country: 'اليابان', cityEn: 'Tokyo Haneda', countryEn: 'Japan' },
    ICN: { lat: 37.4602, lon: 126.4407, city: 'سيول', country: 'كوريا الجنوبية', cityEn: 'Seoul', countryEn: 'South Korea' },
    PEK: { lat: 40.0799, lon: 116.6031, city: 'بكين', country: 'الصين', cityEn: 'Beijing', countryEn: 'China' },
    PVG: { lat: 31.1443, lon: 121.8083, city: 'شنغهاي', country: 'الصين', cityEn: 'Shanghai', countryEn: 'China' },
    BKK: { lat: 13.6900, lon: 100.7501, city: 'بانكوك', country: 'تايلاند', cityEn: 'Bangkok', countryEn: 'Thailand' },
    KUL: { lat: 2.7456, lon: 101.7099, city: 'كوالالمبور', country: 'ماليزيا', cityEn: 'Kuala Lumpur', countryEn: 'Malaysia' },
    CGK: { lat: -6.1256, lon: 106.6559, city: 'جاكرتا', country: 'إندونيسيا', cityEn: 'Jakarta', countryEn: 'Indonesia' },
    DEL: { lat: 28.5562, lon: 77.1000, city: 'دلهي', country: 'الهند', cityEn: 'Delhi', countryEn: 'India' },
    BOM: { lat: 19.0896, lon: 72.8656, city: 'مومباي', country: 'الهند', cityEn: 'Mumbai', countryEn: 'India' },
    KHI: { lat: 24.9065, lon: 67.1608, city: 'كراتشي', country: 'باكستان', cityEn: 'Karachi', countryEn: 'Pakistan' },
    LHE: { lat: 31.5216, lon: 74.4036, city: 'لاهور', country: 'باكستان', cityEn: 'Lahore', countryEn: 'Pakistan' },
    ISB: { lat: 33.5492, lon: 72.8256, city: 'إسلام آباد', country: 'باكستان', cityEn: 'Islamabad', countryEn: 'Pakistan' },
    DAC: { lat: 23.8433, lon: 90.3978, city: 'دكا', country: 'بنغلاديش', cityEn: 'Dhaka', countryEn: 'Bangladesh' },
    CMB: { lat: 7.1808, lon: 79.8842, city: 'كولومبو', country: 'سريلانكا', cityEn: 'Colombo', countryEn: 'Sri Lanka' },
    NBO: { lat: -1.3192, lon: 36.9278, city: 'نيروبي', country: 'كينيا', cityEn: 'Nairobi', countryEn: 'Kenya' },
    ADD: { lat: 8.9779, lon: 38.7993, city: 'أديس أبابا', country: 'إثيوبيا', cityEn: 'Addis Ababa', countryEn: 'Ethiopia' },
    JNB: { lat: -26.1392, lon: 28.2460, city: 'جوهانسبرغ', country: 'جنوب أفريقيا', cityEn: 'Johannesburg', countryEn: 'South Africa' },
    CPT: { lat: -33.9715, lon: 18.6021, city: 'كيب تاون', country: 'جنوب أفريقيا', cityEn: 'Cape Town', countryEn: 'South Africa' },
    LOS: { lat: 6.5774, lon: 3.3211, city: 'لاغوس', country: 'نيجيريا', cityEn: 'Lagos', countryEn: 'Nigeria' },
};

/** إحداثيات مطار أو null إن كان الرمز غير مغطّى — لا تخمين. */
export function airportCoords(iata) {
    return AIRPORT_COORDS[String(iata || '').toUpperCase()] || null;
}

/**
 * 🔤 تطبيع نص للبحث — عربي وإنجليزي معاً.
 *
 * بلا هذا لا يعمل البحث العربي عملياً: من يكتب «الریاض» (بياء فارسية) أو
 * «الرياض» (بتشكيل) أو «رياض» (بلا أل) يقصد المدينة نفسها، ومقارنة النص
 * الخام تفشل في الحالات الثلاث. نوحّد صور الألف والياء والتاء المربوطة،
 * ونحذف التشكيل وعلامات الاتجاه غير المرئية التي تلتصق باللصق من المتصفح.
 */
export function normalizeSearchText(raw) {
    return String(raw || '')
        .toLowerCase()
        .replace(/[‎‏‪-‮]/g, '') // علامات اتجاه غير مرئية
        .replace(/[ً-ْٰ]/g, '')       // تشكيل
        .replace(/ـ/g, '')                      // تطويل (ـــ)
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/[ىی]/g, 'ي')                       // ألف مقصورة + ياء فارسية
        .replace(/ة/g, 'ه')
        .replace(/[ؤئ]/g, 'ء')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')           // ترقيم/شرطات
        .replace(/\s+/g, ' ')
        .trim();
}

/** يزيل «ال» التعريف من بداية الكلمات ليتطابق «رياض» مع «الرياض». */
function stripAl(text) {
    return text.replace(/\bال/g, '');
}

/**
 * 🔎 بحث المطارات بالاسم أو الدولة أو رمز IATA، عربياً أو إنجليزياً.
 *
 * يخدم الغرض الذي طلبه المالك: لا أحد مُلزَم بحفظ رموز IATA — يكتب
 * «الرياض» أو «Saudi» أو «RUH» فيحصل على الخيارات. النطاق مقصور على
 * المطارات المغطّاة هنا **عمداً**: هي وحدها التي نملك إحداثياتها، فبحث
 * الفنادق/السيارات/الطقس يعمل لها فعلاً — اقتراح مطار لا نخدمه إغراء
 * بفشل لاحق.
 *
 * الترتيب: تطابق رمز IATA، ثم بداية اسم المدينة، ثم ورودها داخله، ثم الدولة.
 */
export function searchAirports(query, limit = 8) {
    const q = normalizeSearchText(query);
    // حرف واحد يطابق عشرات المطارات — ضجيج لا فائدة فيه. الحارس هنا في
    // المنطق المشترك لا في الواجهة وحدها، فيسري على المسار والوكيل أيضاً.
    if (q.length < MIN_QUERY_LEN) return [];
    const qBare = stripAl(q);
    const isIata = /^[a-z]{3}$/.test(q);

    const scored = [];
    for (const [iata, a] of Object.entries(AIRPORT_COORDS)) {
        const code = iata.toLowerCase();
        const city = normalizeSearchText(a.city);
        const cityBare = stripAl(city);
        const country = normalizeSearchText(a.country);
        const countryBare = stripAl(country);
        const cityEn = normalizeSearchText(a.cityEn);
        const countryEn = normalizeSearchText(a.countryEn);

        let score = null;
        if (isIata && code === q) score = 0;
        else if (cityBare.startsWith(qBare) || cityEn.startsWith(q)) score = 1;
        else if (cityBare.includes(qBare) || cityEn.includes(q)) score = 2;
        else if (countryBare.startsWith(qBare) || countryEn.startsWith(q)) score = 3;
        else if (countryBare.includes(qBare) || countryEn.includes(q)) score = 4;
        else if (code.includes(q)) score = 5;
        if (score === null) continue;

        scored.push({
            score,
            iata,
            city: a.city, country: a.country,
            cityEn: a.cityEn, countryEn: a.countryEn,
            label: `${a.city} — ${a.country} (${iata})`,
            labelEn: `${a.cityEn} — ${a.countryEn} (${iata})`,
        });
    }
    return scored
        .sort((x, y) => x.score - y.score || x.city.localeCompare(y.city, 'ar'))
        .slice(0, limit)
        .map(({ score, ...rest }) => rest);
}
