/**
 * 💾 Project Memory — JAOLA OS
 *
 * يحفظ قرارات كل مشروع: ألوان، تقنية، هيكل، تاريخ التعديلات.
 * يُقرأ في كل طلب بناء أو تعديل ليُعطي الـ AI سياقاً كاملاً.
 *
 * التخزين: MongoDB أولاً، ملف JSON كـ fallback.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.join(__dirname, '../memory/project_memory.json');

// ذاكرة في RAM للوصول السريع
const memoryCache = new Map(); // key: `${username}:${project}` → ProjectMemory

// ═══════════════════════════════════════════════════════
// 📋 هيكل ذاكرة المشروع
// ═══════════════════════════════════════════════════════
function createProjectMemory(username, project, goal = '') {
    return {
        username,
        project,
        originalGoal: goal,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // قرارات التصميم
        design: {
            colors: null,        // مثال: "أزرق داكن مع ذهبي"
            style: null,         // مثال: "راقٍ، مظلم، عصري"
            font: null,          // مثال: "Cairo"
            layout: null,        // مثال: "RTL, Grid"
        },
        // القرارات التقنية
        tech: {
            hasBackend: false,
            apis: [],            // مثال: ['products', 'cart', 'auth']
            framework: 'vanilla', // vanilla | react | next
        },
        // هيكل الموقع
        structure: {
            sections: [],        // مثال: ['hero', 'products', 'contact']
            features: [],        // مثال: ['shopping cart', 'booking form']
            pages: ['index'],    // الصفحات المبنية
        },
        // تاريخ التعديلات
        history: [],             // آخر 10 تعديلات
    };
}

// ═══════════════════════════════════════════════════════
// 💾 تحميل وحفظ من الملف
// ═══════════════════════════════════════════════════════
function loadFromFile() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
            for (const [key, value] of Object.entries(data)) {
                memoryCache.set(key, value);
            }
        }
    } catch (e) {
        console.warn('[ProjectMemory] فشل تحميل الذاكرة من الملف:', e.message);
    }
}

function saveToFile() {
    try {
        const dir = path.dirname(MEMORY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const data = Object.fromEntries(memoryCache);
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.warn('[ProjectMemory] فشل حفظ الذاكرة:', e.message);
    }
}

// تحميل عند بدء التشغيل
loadFromFile();

// ═══════════════════════════════════════════════════════
// 🔑 دوال أساسية
// ═══════════════════════════════════════════════════════
const getKey = (username, project) => `${username}:${project}`;

/** استرجاع ذاكرة مشروع (أو إنشاء جديدة) */
export function getProjectMemory(username, project) {
    const key = getKey(username, project);
    if (!memoryCache.has(key)) {
        memoryCache.set(key, createProjectMemory(username, project));
    }
    return memoryCache.get(key);
}

/** تحديث قرارات التصميم */
export function updateDesign(username, project, designUpdates) {
    const mem = getProjectMemory(username, project);
    Object.assign(mem.design, designUpdates);
    mem.updatedAt = Date.now();
    saveToFile();
}

/** تحديث المعلومات التقنية */
export function updateTech(username, project, techUpdates) {
    const mem = getProjectMemory(username, project);
    Object.assign(mem.tech, techUpdates);
    mem.updatedAt = Date.now();
    saveToFile();
}

/** تحديث هيكل الموقع */
export function updateStructure(username, project, sections = [], features = []) {
    const mem = getProjectMemory(username, project);
    if (sections.length) mem.structure.sections = sections;
    if (features.length) mem.structure.features = features;
    mem.updatedAt = Date.now();
    saveToFile();
}

/** تسجيل تعديل جديد في التاريخ */
export function addToHistory(username, project, action) {
    const mem = getProjectMemory(username, project);
    mem.history.unshift({
        action,
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString('ar-SA'),
    });
    // احتفظ بآخر 10 تعديلات فقط
    mem.history = mem.history.slice(0, 10);
    mem.updatedAt = Date.now();
    saveToFile();
}

/** تهيئة ذاكرة مشروع جديد من نتائج Clarifier */
export function initFromClarifier(username, project, clarifierData) {
    const key = getKey(username, project);
    const mem = createProjectMemory(username, project, clarifierData.originalGoal);

    if (clarifierData.plan) {
        mem.structure.sections = clarifierData.plan.sections || [];
        mem.structure.features = clarifierData.plan.features || [];
        if (clarifierData.plan.colorMood) {
            mem.design.colors = clarifierData.plan.colorMood;
        }
    }

    memoryCache.set(key, mem);
    saveToFile();
    return mem;
}

/** توليد ملخص نصي للـ AI */
export function buildMemoryContext(username, project) {
    const mem = getProjectMemory(username, project);
    const parts = [];

    if (mem.originalGoal) {
        parts.push(`الهدف الأصلي: ${mem.originalGoal}`);
    }
    if (mem.design.colors) {
        parts.push(`الألوان المختارة: ${mem.design.colors}`);
    }
    if (mem.design.style) {
        parts.push(`الأسلوب البصري: ${mem.design.style}`);
    }
    if (mem.structure.sections.length) {
        parts.push(`الأقسام الموجودة: ${mem.structure.sections.join('، ')}`);
    }
    if (mem.structure.features.length) {
        parts.push(`الميزات المطلوبة: ${mem.structure.features.join('، ')}`);
    }
    if (mem.tech.hasBackend) {
        parts.push(`APIs موجودة: ${mem.tech.apis.join(', ')}`);
    }
    if (mem.history.length) {
        const recent = mem.history.slice(0, 3).map(h => h.action).join(' | ');
        parts.push(`آخر التعديلات: ${recent}`);
    }

    return parts.length > 0
        ? `\n## ذاكرة المشروع:\n${parts.map(p => `- ${p}`).join('\n')}\n`
        : '';
}
