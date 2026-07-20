/**
 * 🧩 Project Model — نموذج المشروع المُهيكَل والدائم (طبقة الفهم)
 *
 * المشكلة الجذرية: المنصّة كانت تولّد "ملفات معقولة من جملة" بلا نموذج داخلي
 * للمشروع. فصفحة استقبال طلبات المطعم لم تتحقق لأنه لا يوجد تمثيل يقول
 * "هناك كيان Order يتشاركه Customer وRestaurantOwner، ويمرّ بينهما عبر تدفّق".
 *
 * الحل: قبل التوليد، نستخلص نموذجاً مُهيكَلاً ونحفظه بشكل دائم:
 * - entities: الكيانات (البيانات) + حقولها + من يملكها
 * - roles:    الأدوار (المستخدمون) + صلاحياتهم
 * - flows:    التدفّقات التي تنقل الحالة بين الأدوار والكيانات
 * ثم نحقنه في سياق البناء ليبني الفريق على *نظام متماسك* لا على تخمين،
 * ويُدمج (لا يُستبدل) مع كل تعديل ليصير فهماً متراكماً للمشروع.
 */

import { smartChat } from './baseAgent.js';

const MODEL_SYSTEM = `أنت مهندس برمجيات ومحلل مجال (domain analyst) خبير.
مهمتك تحويل طلب المستخدم (بأي لغة) إلى *نموذج مجال مُهيكَل* — لا كود، بل فهم البنية.
فكّر: ما البيانات (الكيانات)؟ من يستخدمها (الأدوار)؟ وكيف تنتقل الحالة بينهم (التدفّقات)؟

أرجع JSON فقط بهذا الشكل الحرفي:
{
  "entities": [
    { "name": "Order", "fields": [{"name":"id","type":"string"},{"name":"status","type":"string"}], "ownedBy": "Customer", "description": "طلب يقدّمه زبون" }
  ],
  "roles": [
    { "name": "Customer", "description": "من يتصفّح ويطلب", "capabilities": ["يتصفّح القائمة","يقدّم طلباً","يتابع الحالة"] }
  ],
  "flows": [
    { "name": "تقديم طلب", "actor": "Customer", "steps": ["يختار أصنافاً","يؤكّد الطلب","يصل الطلب للمطعم","المطعم يحدّث الحالة"], "touches": ["Order","MenuItem"], "realtime": true }
  ]
}

قواعد:
- الكيانات هي أسماء المجال (Order, MenuItem, Restaurant, User...) لا عناصر واجهة.
- إن كان للتطبيق أكثر من نوع مستخدم (زبون + صاحب مطعم + سائق) فاذكرهم جميعاً كأدوار منفصلة.
- كل تدفّق يجب أن يذكر الأدوار والكيانات التي يلمسها؛ وضع realtime=true إن كان يتطلب تحديثاً لحظياً بين طرفين.
- 2-6 كيانات، 1-4 أدوار، 1-5 تدفّقات. كن دقيقاً لا مسهباً.`;

// خرائط احتياطية بسيطة حسب الفئة — تضمن نموذجاً مفيداً حتى بلا LLM
const CATEGORY_FALLBACK = {
    restaurant: {
        entities: [
            { name: 'Order', fields: [{ name: 'id', type: 'string' }, { name: 'items', type: 'array' }, { name: 'total', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Customer', description: 'طلب زبون' },
            { name: 'MenuItem', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'price', type: 'number' }], ownedBy: 'RestaurantOwner', description: 'صنف في القائمة' },
        ],
        roles: [
            { name: 'Customer', description: 'يتصفّح ويطلب', capabilities: ['يتصفّح القائمة', 'يقدّم طلباً', 'يتابع الحالة'] },
            { name: 'RestaurantOwner', description: 'يستقبل الطلبات وينفّذها', capabilities: ['يستقبل الطلبات', 'يحدّث حالة الطلب', 'يدير القائمة'] },
        ],
        flows: [
            { name: 'تقديم طلب', actor: 'Customer', steps: ['يختار أصنافاً', 'يؤكّد الطلب', 'يصل الطلب للمطعم', 'المطعم يحدّث الحالة'], touches: ['Order', 'MenuItem'], realtime: true },
        ],
    },
    ecommerce: {
        entities: [
            { name: 'Product', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }, { name: 'price', type: 'number' }], ownedBy: 'Seller', description: 'منتج للبيع' },
            { name: 'Order', fields: [{ name: 'id', type: 'string' }, { name: 'items', type: 'array' }, { name: 'total', type: 'number' }, { name: 'status', type: 'string' }], ownedBy: 'Customer', description: 'طلب شراء' },
        ],
        roles: [
            { name: 'Customer', description: 'يتصفّح ويشتري', capabilities: ['يتصفّح المنتجات', 'يضيف للسلة', 'يدفع'] },
            { name: 'Seller', description: 'يدير المنتجات والطلبات', capabilities: ['يضيف منتجات', 'يستقبل الطلبات'] },
        ],
        flows: [
            { name: 'شراء منتج', actor: 'Customer', steps: ['يتصفّح', 'يضيف للسلة', 'يدفع', 'يصل الطلب للبائع'], touches: ['Product', 'Order'], realtime: false },
        ],
    },
};

/**
 * يحصّن ويطبّع نموذجاً خاماً إلى الشكل المتوقّع (دالة نقية قابلة للاختبار).
 */
export function normalizeProjectModel(raw) {
    const model = raw && typeof raw === 'object' ? raw : {};
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const arr = (v) => (Array.isArray(v) ? v : []);

    // العناصر بلا اسم حقيقي تُستبعد (لا تُخترع أسماء افتراضية من ضوضاء الـ LLM)
    const entities = arr(model.entities).slice(0, 6).map(e => ({
        name: str(e?.name),
        fields: arr(e?.fields).slice(0, 12).map(f => ({
            name: str(f?.name) || 'field',
            type: str(f?.type) || 'string',
        })),
        ownedBy: str(e?.ownedBy) || null,
        description: str(e?.description),
    })).filter(e => e.name);

    const roles = arr(model.roles).slice(0, 4).map(r => ({
        name: str(r?.name),
        description: str(r?.description),
        capabilities: arr(r?.capabilities).map(str).filter(Boolean).slice(0, 8),
    })).filter(r => r.name);

    const flows = arr(model.flows).slice(0, 5).map(fl => ({
        name: str(fl?.name),
        actor: str(fl?.actor) || null,
        steps: arr(fl?.steps).map(str).filter(Boolean).slice(0, 10),
        touches: arr(fl?.touches).map(str).filter(Boolean).slice(0, 8),
        realtime: !!fl?.realtime,
    })).filter(fl => fl.name);

    return { entities, roles, flows, _source: model._source || 'llm' };
}

/**
 * نموذج احتياطي من الفئة + مكوّنات المخطط — يضمن فهماً مفيداً بلا LLM.
 */
function fallbackModel(goal, blueprint) {
    const category = blueprint?.category;
    if (category && CATEGORY_FALLBACK[category]) {
        return normalizeProjectModel({ ...CATEGORY_FALLBACK[category], _source: 'fallback' });
    }
    // نموذج أدنى عام: مستخدم واحد + كيان أساسي مشتقّ من مكوّنات المخطط
    const comps = Array.isArray(blueprint?.functionalComponents) ? blueprint.functionalComponents : [];
    return normalizeProjectModel({
        entities: [{ name: 'Item', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }], ownedBy: 'User', description: str(goal).slice(0, 60) }],
        roles: [{ name: 'User', description: 'المستخدم الأساسي', capabilities: comps.map(c => c?.name).filter(Boolean).slice(0, 6) }],
        flows: comps.length ? [{ name: blueprint?.primaryAction || 'الفعل الأساسي', actor: 'User', steps: comps.map(c => c?.name).filter(Boolean).slice(0, 6), touches: ['Item'], realtime: false }] : [],
        _source: 'fallback',
    });
    function str(v) { return typeof v === 'string' ? v : ''; }
}

/**
 * يستخلص نموذج المشروع من الهدف والمخطط. يقبل chat مُحقَناً للاختبار.
 * لا يفشل أبداً — يسقط لنموذج احتياطي مفيد.
 */
export async function deriveProjectModel(goal, blueprint = null, { chat = smartChat } = {}) {
    try {
        const raw = await chat([
            { role: 'system', content: MODEL_SYSTEM },
            { role: 'user', content: `الطلب: "${goal}"${blueprint?.appType ? `\nنوع التطبيق: ${blueprint.appType} (فئة: ${blueprint.category})` : ''}` },
        ], { max_tokens: 900, temperature: 0.2, json: true });
        const parsed = JSON.parse(raw);
        const model = normalizeProjectModel({ ...parsed, _source: 'llm' });
        // إن جاء فارغاً فعلياً نستخدم الاحتياطي
        if (!model.entities.length && !model.roles.length) return fallbackModel(goal, blueprint);
        return model;
    } catch (e) {
        return fallbackModel(goal, blueprint);
    }
}

/**
 * يدمج نموذجاً جديداً في القائم (اتحاد بالاسم) — الفهم يتراكم مع التعديلات
 * بدل أن يُستبدل. دالة نقية.
 */
export function mergeProjectModel(existing, incoming) {
    const base = normalizeProjectModel(existing || {});
    const add = normalizeProjectModel(incoming || {});
    const byName = (list, item) => {
        const i = list.findIndex(x => x.name.toLowerCase() === item.name.toLowerCase());
        if (i === -1) list.push(item);
        else list[i] = { ...list[i], ...item, // الجديد يُحدّث القديم مع دمج الحقول/الصلاحيات
            fields: dedupeByName([...(list[i].fields || []), ...(item.fields || [])]),
            capabilities: [...new Set([...(list[i].capabilities || []), ...(item.capabilities || [])])],
        };
        return list;
    };
    const merged = {
        entities: [...base.entities],
        roles: [...base.roles],
        flows: [...base.flows],
        _source: add._source === 'llm' || base._source === 'llm' ? 'llm' : 'fallback',
    };
    for (const e of add.entities) byName(merged.entities, e);
    for (const r of add.roles) byName(merged.roles, r);
    for (const fl of add.flows) {
        const i = merged.flows.findIndex(x => x.name.toLowerCase() === fl.name.toLowerCase());
        if (i === -1) merged.flows.push(fl); else merged.flows[i] = { ...merged.flows[i], ...fl };
    }
    return normalizeProjectModel(merged);

    function dedupeByName(fields) {
        const seen = new Set(); const out = [];
        for (const f of fields) { const k = f.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(f); } }
        return out.slice(0, 12);
    }
}

/**
 * ملخّص نصّي قصير للنموذج (لعرضه في السجل/الواجهة). دالة نقية.
 */
export function summarizeModel(model) {
    const m = normalizeProjectModel(model || {});
    const roles = m.roles.map(r => r.name).join('، ');
    const ents = m.entities.map(e => e.name).join('، ');
    return `${m.entities.length} كيان (${ents || '—'}) • ${m.roles.length} دور (${roles || '—'}) • ${m.flows.length} تدفّق`;
}

/**
 * يبني فقرة سياق تُحقن في هدف البناء — تفرض البناء على النموذج لا التخمين.
 * دالة نقية قابلة للاختبار.
 */
export function buildProjectModelContext(model) {
    const m = normalizeProjectModel(model || {});
    if (!m.entities.length && !m.roles.length && !m.flows.length) return '';

    const lines = ['\n## 🧩 نموذج المشروع (Domain Model) — ابنِ عليه، لا تخمّن:'];

    if (m.entities.length) {
        lines.push('', '### الكيانات (البيانات):');
        for (const e of m.entities) {
            const fields = e.fields.map(f => `${f.name}:${f.type}`).join(', ');
            lines.push(`- **${e.name}**${fields ? ` { ${fields} }` : ''}${e.ownedBy ? ` — يملكه ${e.ownedBy}` : ''}${e.description ? ` (${e.description})` : ''}`);
        }
    }

    if (m.roles.length) {
        lines.push('', '### الأدوار (المستخدمون):');
        for (const r of m.roles) {
            lines.push(`- **${r.name}**${r.description ? ` — ${r.description}` : ''}${r.capabilities.length ? ` [${r.capabilities.join('، ')}]` : ''}`);
        }
    }

    if (m.flows.length) {
        lines.push('', '### التدفّقات (كيف تنتقل الحالة):');
        for (const fl of m.flows) {
            lines.push(`- **${fl.name}**${fl.actor ? ` (${fl.actor})` : ''}: ${fl.steps.join(' → ')}${fl.touches.length ? ` — يلمس [${fl.touches.join(', ')}]` : ''}${fl.realtime ? ' ⚡لحظي' : ''}`);
        }
    }

    lines.push(
        '',
        '**قواعد إلزامية (هذا نظام متماسك لا صفحات منفصلة):**',
        '- كل كيان أعلاه له تمثيل بيانات فعلي (نموذج/جدول أو مصفوفة كائنات واقعية).',
        '- كل دور له واجهته وصلاحياته — إن وُجد أكثر من دور فابنِ لكلٍّ منظوره (مثلاً واجهة الزبون وواجهة استقبال الطلبات).',
        '- كل تدفّق يجب أن يعمل من طرفه إلى طرفه؛ وما كان ⚡لحظياً يتطلب تحديثاً فورياً بين الطرفين.',
        '- لا تكتفِ بواجهة طرف واحد إن كان النموذج يذكر أكثر من دور.',
    );

    return lines.join('\n');
}
