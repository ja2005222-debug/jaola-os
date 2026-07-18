/**
 * 👤 User Profile Agent — JAOLA OS
 *
 * يبني شخصية المستخدم تدريجياً عبر الجلسات:
 * - لغته المفضلة
 * - أنواع المشاريع التي يبنيها
 * - تفضيلاته البصرية (ألوان، أسلوب)
 * - مستواه التقني
 * - مشاريعه السابقة
 *
 * يُقرأ في كل محادثة ليُخصّص ردود JAOLA.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { persistEntry, hydrateStore, onMongoReady } from '../services/persistence.js';
import { recordEditLesson } from '../services/platformLessons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILES_FILE = path.join(__dirname, '../memory/user_profiles.json');

// ذاكرة RAM للوصول السريع
const profilesCache = new Map();

// ═══════════════════════════════════════════════════════
// 📋 هيكل ملف المستخدم
// ═══════════════════════════════════════════════════════
function createUserProfile(username) {
    return {
        username,
        createdAt: Date.now(),
        updatedAt: Date.now(),

        // اللغة والموقع
        language: null,
        region: null,

        // المستوى التقني (يُستنتج من الأسئلة والتعديلات)
        techLevel: 'beginner', // beginner | intermediate | advanced

        // التفضيلات البصرية
        designPrefs: {
            favoriteColors: [],    // ['أزرق', 'ذهبي']
            favoriteStyle: null,   // 'راقٍ' | 'بسيط' | 'جريء' | 'عصري'
            prefersDark: false,
        },

        // إحصائيات الاستخدام
        stats: {
            totalProjects: 0,
            totalBuilds: 0,
            totalEdits: 0,
            favoriteProjectType: null,
        },

        // أنواع المشاريع المبنية (لحساب المفضل)
        projectTypes: {},     // { medical: 2, restaurant: 1, ... }

        // آخر 5 مشاريع
        recentProjects: [],   // [{ name, type, date }]

        // تفضيلات خاصة مستنتجة
        preferences: {
            wantsBackend: false,   // هل يطلب خادماً دائماً؟
            wantsAnimations: false,
            wantsPWA: false,
            preferredSections: [], // أقسام يطلبها دائماً
        },
    };
}

// ═══════════════════════════════════════════════════════
// 💾 تحميل وحفظ
// ═══════════════════════════════════════════════════════
function loadProfiles() {
    try {
        if (fs.existsSync(PROFILES_FILE)) {
            const data = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
            for (const [key, value] of Object.entries(data)) {
                profilesCache.set(key, value);
            }
        }
    } catch (e) {
        console.warn('[UserProfile] فشل تحميل الملفات:', e.message);
    }
}

function saveProfiles() {
    try {
        const dir = path.dirname(PROFILES_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PROFILES_FILE, JSON.stringify(Object.fromEntries(profilesCache), null, 2));
    } catch (e) {
        console.warn('[UserProfile] فشل الحفظ:', e.message);
    }

    // 💾 حفظ دائم في MongoDB
    for (const [key, value] of profilesCache) {
        persistEntry('userProfiles', key, value);
    }
}

loadProfiles();

// 💾 استرجاع ملفات المستخدمين الدائمة من MongoDB
onMongoReady(() => hydrateStore('userProfiles', (key, value) => {
    const current = profilesCache.get(key);
    if (!current || (value?.updatedAt || 0) > (current.updatedAt || 0)) {
        profilesCache.set(key, value);
    }
}));

// ═══════════════════════════════════════════════════════
// 🔑 دوال أساسية
// ═══════════════════════════════════════════════════════

/** استرجاع ملف مستخدم (أو إنشاء جديد) */
export function getUserProfile(username) {
    if (!profilesCache.has(username)) {
        profilesCache.set(username, createUserProfile(username));
    }
    return profilesCache.get(username);
}

/** تحديث لغة المستخدم */
export function updateLanguage(username, language) {
    const profile = getUserProfile(username);
    profile.language = language;
    profile.updatedAt = Date.now();
    saveProfiles();
}

/** تسجيل مشروع جديد وتحديث الإحصائيات */
export function recordProject(username, projectName, projectType) {
    const profile = getUserProfile(username);

    // تحديث إحصائيات
    profile.stats.totalProjects++;
    profile.stats.totalBuilds++;

    // تحديث أنواع المشاريع
    profile.projectTypes[projectType] = (profile.projectTypes[projectType] || 0) + 1;

    // تحديث النوع المفضل
    const maxType = Object.entries(profile.projectTypes)
        .sort((a, b) => b[1] - a[1])[0];
    if (maxType) profile.stats.favoriteProjectType = maxType[0];

    // إضافة للمشاريع الأخيرة
    profile.recentProjects.unshift({
        name: projectName,
        type: projectType,
        date: new Date().toLocaleDateString('ar-SA'),
    });
    profile.recentProjects = profile.recentProjects.slice(0, 5);

    profile.updatedAt = Date.now();
    saveProfiles();
}

/** تسجيل تعديل وتحديث المستوى التقني */
export function recordEdit(username, editMessage) {
    const profile = getUserProfile(username);
    profile.stats.totalEdits++;

    // استنتاج المستوى التقني من طبيعة التعديلات
    const techKeywords = /css|html|javascript|api|backend|database|json|flex|grid|animation/i;
    if (techKeywords.test(editMessage) && profile.techLevel === 'beginner') {
        profile.techLevel = 'intermediate';
    }

    // استنتاج تفضيل الألوان
    const colorMatch = editMessage.match(/(أزرق|أحمر|أخضر|ذهبي|بنفسجي|برتقالي|أبيض|أسود|رمادي|blue|red|green|gold|purple)/i);
    if (colorMatch && !profile.designPrefs.favoriteColors.includes(colorMatch[1])) {
        profile.designPrefs.favoriteColors.push(colorMatch[1]);
        profile.designPrefs.favoriteColors = profile.designPrefs.favoriteColors.slice(0, 5);
    }

    // استنتاج تفضيل الأسلوب
    if (/فاخر|راقٍ|luxury|elegant/i.test(editMessage)) profile.designPrefs.favoriteStyle = 'راقٍ';
    if (/بسيط|نظيف|simple|clean/i.test(editMessage)) profile.designPrefs.favoriteStyle = 'بسيط';
    if (/جريء|bold|dark/i.test(editMessage)) profile.designPrefs.favoriteStyle = 'جريء';

    // استنتاج تفضيل PWA
    if (/pwa|تطبيق|app/i.test(editMessage)) profile.preferences.wantsPWA = true;

    // 📚 كل تعديل بعد البناء درسٌ للمنصة كلها — النقطة المركزية الوحيدة
    // التي تمر منها جميع مسارات التعديل
    recordEditLesson(editMessage);

    profile.updatedAt = Date.now();
    saveProfiles();
}

/** توليد ملخص شخصية المستخدم للـ AI */
export function buildProfileContext(username) {
    const profile = getUserProfile(username);
    const parts = [];

    if (profile.stats.totalProjects > 0) {
        parts.push(`عدد مشاريعه السابقة: ${profile.stats.totalProjects}`);
    }
    if (profile.stats.favoriteProjectType) {
        const typeNames = {
            medical: 'طبية', restaurant: 'مطاعم', ecommerce: 'متاجر',
            hotel: 'فنادق', education: 'تعليم', portfolio: 'معرض أعمال',
            business: 'شركات', gym: 'رياضة', clinic: 'عيادات', realestate: 'عقارات'
        };
        parts.push(`نوع مشاريعه المفضل: ${typeNames[profile.stats.favoriteProjectType] || profile.stats.favoriteProjectType}`);
    }
    if (profile.designPrefs.favoriteColors.length > 0) {
        parts.push(`ألوانه المفضلة: ${profile.designPrefs.favoriteColors.join('، ')}`);
    }
    if (profile.designPrefs.favoriteStyle) {
        parts.push(`أسلوبه البصري المفضل: ${profile.designPrefs.favoriteStyle}`);
    }
    if (profile.techLevel !== 'beginner') {
        parts.push(`مستواه التقني: ${profile.techLevel}`);
    }
    if (profile.recentProjects.length > 0) {
        const recent = profile.recentProjects.slice(0, 3)
            .map(p => p.name).join('، ');
        parts.push(`مشاريعه الأخيرة: ${recent}`);
    }

    return parts.length > 0
        ? `\n## ملف المستخدم:\n${parts.map(p => `- ${p}`).join('\n')}\n`
        : '';
}
