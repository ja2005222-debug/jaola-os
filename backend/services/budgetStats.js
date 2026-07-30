/**
 * 💰 budgetStats.js — دوال حسابية بحتة لتلخيص المعاملات المالية الشخصية
 * (دخل/مصروف) وحساب حالة الميزانيات الشهرية. لا حالة ولا شبكة هنا — كل
 * البيانات (سجلات المعاملات/الميزانيات) تأتي من appCollections.js عبر
 * server.js، وهذا الملف فقط يحسب منها أرقاماً حقيقية قابلة للاختبار.
 */

const MONTH_RE = /^\d{4}-\d{2}/;

/** "YYYY-MM" لتاريخ مُعطى (كائن Date أو نص ISO) — بتوقيت UTC كي يكون حتمياً في الاختبارات. */
export function monthKey(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 7);
}

/** آخر N شهراً بصيغة "YYYY-MM" بترتيب تصاعدي، ابتداءً من شهر مرجعي (افتراضياً الآن). */
export function lastMonths(n, from = new Date()) {
    const out = [];
    const base = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
        out.push(monthKey(d));
    }
    return out;
}

function isValidTx(r) {
    return r && (r.type === 'income' || r.type === 'expense') && typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount >= 0 && typeof r.month === 'string' && MONTH_RE.test(r.month);
}

/**
 * ملخّص فترة (مجموعة أشهر): إجمالي الدخل/المصروف/الصافي + تفصيل المصروف
 * حسب الفئة (مرتّبة تنازلياً). سجلات غير صالحة تُتجاهل بصمت (لا رمي خطأ).
 */
export function summarize(records, months) {
    const wanted = new Set(Array.isArray(months) ? months : [months]);
    let income = 0, expense = 0;
    const byCategory = new Map();
    for (const r of Array.isArray(records) ? records : []) {
        if (!isValidTx(r) || !wanted.has(r.month)) continue;
        if (r.type === 'income') { income += r.amount; continue; }
        expense += r.amount;
        const cat = (typeof r.category === 'string' && r.category.trim()) || 'أخرى';
        byCategory.set(cat, (byCategory.get(cat) || 0) + r.amount);
    }
    const categories = [...byCategory.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
    return { income, expense, net: income - expense, categories };
}

/**
 * حالة كل ميزانية شهرية (سقف لكل فئة) مقابل المصروف الفعلي للشهر المُعطى.
 * budgets: [{ id, category, monthlyLimit }], records: معاملات (أي شهر — تُفلتَر هنا للشهر المطلوب فقط).
 */
export function budgetStatus(budgets, records, month) {
    const spentByCategory = new Map();
    for (const r of Array.isArray(records) ? records : []) {
        if (!isValidTx(r) || r.type !== 'expense' || r.month !== month) continue;
        const cat = (typeof r.category === 'string' && r.category.trim()) || 'أخرى';
        spentByCategory.set(cat, (spentByCategory.get(cat) || 0) + r.amount);
    }
    return (Array.isArray(budgets) ? budgets : [])
        .filter(b => b && typeof b.category === 'string' && typeof b.monthlyLimit === 'number' && b.monthlyLimit > 0)
        .map(b => {
            const spent = spentByCategory.get(b.category) || 0;
            const pct = Math.round((spent / b.monthlyLimit) * 1000) / 10;
            return { id: b.id, category: b.category, monthlyLimit: b.monthlyLimit, spent, pct, over: spent > b.monthlyLimit };
        });
}
