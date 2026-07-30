/**
 * 🔔 budgetAlerts.js — فهرس ملفّي لمشاريع مستشار الميزانية (لكل مشروع)
 * + حالة آخر إخطار لكل (فئة، شهر)، يغذّي حلقة فحص دورية في server.js
 * ترسل بريداً عند تجاوز ميزانية فئة شهرياً — مرّة واحدة فقط لكل (فئة، شهر).
 *
 * البيانات الفعلية (الميزانيات/المعاملات) تعيش في appCollections.js —
 * هذا الفهرس فقط "يُسجّل" أي مشروع يستخدم الميزانيات كي تعرف حلقة الفحص
 * أيّها تفحص، بلا مسح كل مشاريع المنصّة. نفس فلسفة cryptoAlerts.js تماماً.
 *
 * ملفّي بسيط (نفس فلسفة appData.js) — لا Mongo، فشل صامت دائماً.
 */
import fs from 'fs';
import path from 'path';

const slug = (u, p) => `${String(u || '').replace(/[^a-zA-Z0-9_-]/g, '_')}__${String(p || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
const storePath = (dir, u, p) => path.join(dir, slug(u, p) + '.json');

function readEntry(dir, user, project) {
    try {
        const s = JSON.parse(fs.readFileSync(storePath(dir, user, project), 'utf8'));
        return (s && typeof s === 'object' && !Array.isArray(s)) ? s : null;
    } catch { return null; }
}

/** يُسجّل مشروعاً كمستخدم لميزانيات مستشار الميزانية — يدمج مع سجل التنبيهات السابق (لا يفقده). */
export function registerBudgetProject(dir, user, project) {
    const prev = readEntry(dir, user, project) || {};
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project), JSON.stringify({
        user, project, updatedAt: Date.now(), alerted: prev.alerted || {},
    }));
}

/** كل مشاريع مستشار الميزانية المسجَّلة — أساس حلقة فحص التجاوز الدورية. */
export function listBudgetProjects(dir) {
    try {
        return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
            try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; }
        }).filter(Boolean);
    } catch { return []; }
}

/** يُسجّل أن المالك أُخطِر بتجاوز فئة معيّنة لشهر معيّن. */
export function markBudgetAlerted(dir, user, project, category, month) {
    const entry = readEntry(dir, user, project);
    if (!entry) return;
    entry.alerted = entry.alerted || {};
    entry.alerted[`${category}|${month}`] = { notifiedAt: Date.now() };
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath(dir, user, project), JSON.stringify(entry));
}

/** هل يستحق إخطار المالك بتجاوز هذه الفئة لهذا الشهر؟ مرّة واحدة فقط لكل (فئة، شهر). */
export function shouldAlertBudget(entry, category, month) {
    return !entry?.alerted?.[`${category}|${month}`];
}
