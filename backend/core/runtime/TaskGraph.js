/**
 * 🕸️ Task Graph — ترتيب تنفيذ المهام من اعتمادياتها (Sprint 2 / Runtime).
 *
 * الخوارزمية هي `backendTeam.planExecution` حرفياً (ترتيب طوبولوجي **مستقرّ**
 * يحافظ على ترتيب التعريف عند تساوي الدرجة، ويتجاهل اعتمادية خارج المجموعة،
 * ويرمي عند الدورة) — عُمِّمت على أي عناصر تحمل مفتاحاً و`dependsOn`:
 *   • فرق الوكلاء: `{ id, dependsOn }` (المستهلك الأصلي)
 *   • مراحل التسليم: `{ name, dependsOn? }` من `DELIVERY_STAGES` (عقد Task)
 * لا تنفيذ هنا — الترتيب فقط؛ التشغيل الجزئي/الإيقاف بين المهام يُبنى فوقه.
 */

/**
 * @template T
 * @param {ReadonlyArray<T>} items
 * @param {{ key?: string, label?: string }} [opts]  key: اسم حقل الهوية (`id` افتراضياً)
 * @returns {T[]} العناصر نفسها مرتّبة للتنفيذ
 */
export function orderTasks(items, { key = 'id', label = 'المهام' } = {}) {
    const list = [...items];
    const idOf = (t) => t[key];
    const ids = new Set(list.map(idOf));
    const indeg = new Map(list.map((t) => [idOf(t), 0]));
    const adj = new Map(list.map((t) => [idOf(t), []]));
    for (const t of list) {
        for (const dep of t.dependsOn || []) {
            if (!ids.has(dep)) continue; // تجاهل اعتمادية خارج المجموعة
            indeg.set(idOf(t), indeg.get(idOf(t)) + 1);
            adj.get(dep).push(idOf(t));
        }
    }
    // طابور مستقر: يحافظ على ترتيب التعريف عند تساوي الدرجة
    const order = [];
    let queue = list.filter((t) => indeg.get(idOf(t)) === 0).map(idOf);
    while (queue.length) {
        const next = [];
        for (const id of queue) {
            order.push(id);
            for (const m of adj.get(id)) {
                indeg.set(m, indeg.get(m) - 1);
                if (indeg.get(m) === 0) next.push(m);
            }
        }
        queue = next;
    }
    if (order.length !== list.length) {
        throw new Error(`دورة اعتمادية في ${label} — تعذّر ترتيب التنفيذ`);
    }
    const byId = new Map(list.map((t) => [idOf(t), t]));
    return order.map((id) => byId.get(id));
}
