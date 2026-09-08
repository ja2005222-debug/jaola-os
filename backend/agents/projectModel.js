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

import { smartChat } from '../core/providers/llm.js';
import { specSections, stripNegated } from './textNormalizer.js';

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
    const comps = Array.isArray(blueprint?.functionalComponents) ? blueprint.functionalComponents : [];
    // 📏 PM/6 — الاحتياطُ يقرأ معجمَه: كان يعود بـ`User/Item` لأيّ طلبٍ بلا فئةٍ مجدولة، بينما `conceptsInText`
    //    على النصّ نفسِه ترى المنتجَ (مواصفةُ نقاطِ البيع: ١٦ مفهوماً ← فهمٌ من دورٍ واحد وكيانٍ واحد؛
    //    قِيس في posSpecMeasure). الأداةُ كانت موجودةً منذ PM/3 والاحتياطُ لا يستعملها. الآن: الأدوارُ
    //    والكياناتُ من المعجم بترتيب التكرار، والتدفّقُ الوحيدُ من مكوّنات المخطّط كما كان — وفاعلُه أهمُّ
    //    الأدوار لا `User` المكتوب. النصُّ الذي لا يسمّي شيئاً يبقى على الحدّ الأدنى القديم.
    // 🚫 والنفيُ يُطوى هنا أيضاً — ثالثُ موضعٍ للعلّة نفسِها (PM/23). قِيس بلا نموذجٍ لغويّ:
    //    مواصفةُ متتبّعِ حفظٍ كاملةً تُنتج كياناً واحداً اسمُه `account` — مأخوذاً من «بلا **حساب**»؛
    //    أي أنّ فهمَ جولا الاحتياطيَّ للمنتج كلِّه كان **الشيءَ الذي نفاه صاحبُه**.
    const lex = lexiconModel(stripNegated(goal));
    if (lex.roles.length || lex.entities.length) {
        const actor = lex.roles[0]?.name || 'User';
        return normalizeProjectModel({
            ...lex,
            flows: comps.length ? [{ name: blueprint?.primaryAction || 'الفعل الأساسي', actor, steps: comps.map(c => c?.name).filter(Boolean).slice(0, 6), touches: lex.entities.slice(0, 1).map(e => e.name), realtime: false }] : [],
        });
    }
    // نموذج أدنى عام: مستخدم واحد + كيان أساسي مشتقّ من مكوّنات المخطط
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
            // PM/6: الاسمُ القائم يبقى — المطابقةُ لا تفرّق الحالة، فمفتاحُ معجمٍ (`admin`) لا يُطفئ
            //    لقبَ المرجع (`Admin`)؛ والوصفُ الفارغ لا يمحو وصفاً قائماً.
            name: list[i].name,
            description: item.description || list[i].description || '',
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
 * يشتقّ أقسام/شاشات التطبيق من النموذج (شاشة لكل دور + كل تدفّق) — تحلّ محلّ
 * أقسام القالب التعريفية للتطبيقات التفاعلية. دالة نقية.
 */
export function buildAppSections(model) {
    const m = normalizeProjectModel(model || {});
    return [
        ...m.roles.map(r => `واجهة ${r.name}${r.description ? ` (${r.description})` : ''}`),
        ...m.flows.map(f => f.name),
    ].filter(Boolean);
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

// ═══════════════════════════════════════════════════════════════════════
// 🧠 مفاهيمُ المنتج — الفهمُ يقارن نماذجَ لا كلمات (PM/1، `PRODUCT_MIND.md`)
// ═══════════════════════════════════════════════════════════════════════
// نموذجُ الفهم (أدوار/كيانات) يأتي بالعربيّة أو الإنجليزيّة، مفرداً أو جمعاً،
// وأحياناً بصيغة «العميل (Passenger)». نماذجُ الكلونات كذلك. المقارنةُ الصادقة
// تحتاج تطبيعاً إلى *مفهومٍ* واحد: راكب = Rider = Passenger، إدارة = Admin =
// مالك = مدير. ما ليس في المعجم يبقى باسمه المطبَّع (فيُطابق نفسَه فقط).
const ROLE_CONCEPTS = {
    user: ['user', 'users', 'visitor', 'مستخدم', 'مستخدمين', 'زائر', 'مالك الحساب', 'صاحب الحساب'],
    customer: ['customer', 'customers', 'client', 'clients', 'buyer', 'buyers', 'shopper', 'consumer', 'عميل', 'عملاء', 'زبون', 'زبائن', 'مشتري', 'مشترين', 'مشترون'],
    passenger: ['passenger', 'passengers', 'rider', 'riders', 'راكب', 'ركاب'],
    traveler: ['traveler', 'traveller', 'tourist', 'مسافر', 'مسافرين', 'سائح', 'سياح'],
    guest: ['guest', 'guests', 'نزيل', 'نزلاء', 'ضيف', 'ضيوف'],
    tenant: ['tenant', 'tenants', 'renter', 'مستأجر', 'مستأجرين'],
    patient: ['patient', 'patients', 'مريض', 'مرضى'],
    student: ['student', 'students', 'learner', 'طالب', 'طلاب', 'طلبة', 'متعلم', 'متدرب'],
    member: ['member', 'members', 'subscriber', 'عضو', 'أعضاء', 'مشترك'],
    viewer: ['viewer', 'audience', 'مشاهد', 'مشاهدين'],
    admin: ['admin', 'admins', 'administrator', 'administration', 'management', 'manager', 'owner', 'supervisor', 'moderator', 'schooladmin',
        'إدارة', 'مدير', 'مدراء', 'مالك', 'مشرف', 'ادمن', 'أدمن'],
    driver: ['driver', 'drivers', 'courier', 'couriers', 'captain', 'سائق', 'سائقين', 'كابتن', 'مندوب', 'مناديب'],
    dispatcher: ['dispatcher', 'operator', 'موزع', 'مشغل', 'مشغّل'],
    seller: ['seller', 'sellers', 'vendor', 'vendors', 'merchant', 'بائع', 'باعة', 'بائعين', 'تاجر', 'تجار'],
    restaurant: ['restaurant', 'restaurants', 'مطعم', 'مطاعم'],
    teacher: ['teacher', 'teachers', 'instructor', 'instructors', 'tutor', 'trainer', 'coach', 'معلم', 'معلّم', 'معلمين', 'مدرس', 'مدرّس', 'مدرب'],
    parent: ['parent', 'parents', 'guardian', 'ولي أمر', 'ولي الأمر', 'أولياء الأمور'],
    doctor: ['doctor', 'doctors', 'physician', 'vet', 'veterinarian', 'طبيب', 'أطباء', 'طبيب بيطري', 'بيطري'],
    pharmacist: ['pharmacist', 'صيدلي'],
    accountant: ['accountant', 'accounting', 'finance manager', 'محاسب', 'مدير مالي'],
    staff: ['staff', 'employee', 'employees', 'worker', 'waiter', 'cashier', 'reception', 'receptionist', 'technician', 'secretary', 'agent', 'support agent', 'kitchen', 'chef',
        'موظف', 'موظفين', 'عامل', 'نادل', 'كاشير', 'استقبال', 'موظف استقبال', 'فني', 'فنّي', 'سكرتير', 'سكرتير قانوني', 'وكيل', 'وكيل دعم', 'مطبخ', 'طباخ'],
    organizer: ['organizer', 'organiser', 'host', 'منظم', 'منظّم'],
    lawyer: ['lawyer', 'attorney', 'محامي', 'محامٍ', 'محام'],
    storekeeper: ['storekeeper', 'warehouse manager', 'أمين المخزن', 'أمين مخزن', 'مدير مستودع', 'مشغل مغسلة', 'مشغّل مغسلة'],
    fleet_manager: ['fleet manager', 'مدير أسطول'],
};
const ENTITY_CONCEPTS = {
    order: ['order', 'orders', 'طلب', 'طلبات', 'طلب مطبخ', 'طلب غسيل'],
    item: ['item', 'items', 'عنصر', 'عناصر'],
    product: ['product', 'products', 'sku', 'goods', 'menuitem', 'menu item', 'dish', 'meal',
        'منتج', 'منتجات', 'صنف', 'أصناف', 'سلعة', 'بضاعة', 'صنف قائمة', 'وجبة', 'صنف غسيل'],
    trip: ['trip', 'trips', 'ride', 'rides', 'journey', 'رحلة', 'رحلات', 'مشوار', 'مشاوير'],
    vehicle: ['vehicle', 'vehicles', 'car', 'cars', 'cab', 'مركبة', 'مركبات', 'سيارة', 'سيارات', 'فئة سيارة'],
    invoice: ['invoice', 'invoices', 'bill', 'receipt', 'فاتورة', 'فواتير', 'فاتورة بيع', 'فاتورة كشف', 'فاتورة طاولة', 'قسيمة'],
    booking: ['booking', 'bookings', 'reservation', 'appointment', 'appointments', 'حجز', 'حجوزات', 'موعد', 'مواعيد', 'حجز تذكرة'],
    ticket: ['ticket', 'tickets', 'ticket tier', 'تذكرة', 'تذاكر'],
    support_ticket: ['support ticket', 'تذكرة دعم', 'تذاكر دعم'],
    event: ['event', 'events', 'فعالية', 'فعاليات', 'مناسبة', 'مناسبات', 'حفلة', 'حفلات'],
    course: ['course', 'courses', 'lesson', 'lessons', 'class', 'enrollment', 'دورة', 'دورات', 'كورس', 'كورسات', 'درس', 'دروس', 'مادة', 'مواد', 'حصة', 'حصص'],
    property: ['property', 'properties', 'unit', 'listing', 'عقار', 'عقارات', 'وحدة', 'شقة', 'شقق'],
    employee: ['staff member', 'موظف'],
    pet: ['pet', 'pets', 'animal', 'حيوان', 'حيوان أليف', 'صاحب حيوان'],
    medicine: ['medicine', 'drug', 'دواء', 'أدوية', 'عملية صرف'],
    table: ['table', 'tables', 'طاولة', 'طاولات'],
    store: ['store', 'stores', 'shop', 'متجر', 'متاجر', 'محل'],
    payment: ['payment', 'payments', 'transaction', 'fare', 'دفع', 'دفعة', 'تحصيل', 'دفعة تحصيل', 'معاملة مالية', 'أجرة'],
    location: ['location', 'locations', 'zone', 'zones', 'area', 'موقع', 'مواقع', 'منطقة', 'مناطق'],
    room: ['room', 'rooms', 'room type', 'غرفة', 'غرف', 'نوع غرفة'],
    package: ['package', 'packages', 'plan', 'باقة', 'باقات', 'باقة تصوير', 'باقة تنظيف'],
    shipment: ['shipment', 'shipments', 'شحنة', 'شحنات', 'شحنة واردة', 'شحنة صادرة'],
    account: ['account', 'accounts', 'ledger', 'journal entry', 'حساب', 'حسابات', 'قيد', 'قيد يومية', 'سطر قيد'],
    currency: ['currency', 'currencies', 'coin', 'crypto', 'stock', 'عملة', 'عملات', 'عملة رقمية', 'سهم', 'أسهم'],
    forecast: ['forecast', 'weather', 'طقس', 'توقعات'],
    expense: ['expense', 'expenses', 'منصرف', 'منصرفات', 'مصروف', 'مصروفات'],
    production: ['production', 'production batch', 'إنتاج', 'دفعة إنتاج'],
    lease: ['lease', 'contract', 'عقد', 'عقود', 'عقد إيجار'],
    legal_case: ['case', 'cases', 'hearing', 'قضية', 'قضايا', 'جلسة'],
    service: ['service', 'services', 'خدمة', 'خدمات', 'بند خدمة'],
    workspace: ['workspace', 'desk', 'مساحة عمل'],
    salary: ['salary', 'payslip', 'راتب', 'رواتب', 'قسيمة راتب'],
    attendance: ['attendance', 'حضور', 'سجل حضور'],
    leave: ['leave', 'vacation', 'إجازة', 'طلب إجازة'],
    shift: ['shift', 'وردية'],
    // «عرض»/«show» مشتركتان لفظاً (عرض القيمة، عرض سعر، اعرض القائمة) فكانتا تجعلان
    // كلَّ مشروعٍ مشروعَ أفلام — أُسقطتا وبقي ما لا يلتبس (PM/4).
    film: ['film', 'movie', 'فيلم', 'أفلام'],
    budget: ['budget', 'ميزانية', 'ميزانية شهرية', 'فئة إنفاق'],
    analysis: ['analysis', 'technical analysis', 'تحليل', 'تحليل فني'],
    visit: ['visit', 'visits', 'زيارة', 'زيارات'],
    grade: ['grade', 'grades', 'assignment', 'درجة', 'درجات', 'واجب'],
    announcement: ['announcement', 'إعلان', 'إعلانات'],
    reply: ['reply', 'رد', 'ردود'],
    maintenance: ['maintenance', 'صيانة', 'عملية صيانة'],
    work_order: ['work order', 'job card', 'بطاقة عمل'],
    inquiry: ['inquiry', 'استفسار', 'طلب عرض سعر'],
};
// المعجمُ واحدٌ كما كان (الأدوارُ أوّلاً ثمّ الكيانات — ترتيبُ البناء لم يتغيّر)، لكنّه
// صار يعرف **نوعَ** كلِّ مفهوم: PM/4 يشتقّ من نصِّ المرجع كياناتِه لا أدوارَه فقط.
const CONCEPTS = { ...ROLE_CONCEPTS, ...ENTITY_CONCEPTS };
const ROLE_KEYS = new Set(Object.keys(ROLE_CONCEPTS));
const ENTITY_KEYS = new Set(Object.keys(ENTITY_CONCEPTS));

// 🎯 PM/5 — نوعُ المشروع من الفهم لا من تخمينٍ مكتوب.
//
// قِيس: `designer.js` لا يمرّر النموذجَ إطلاقاً، و`backend.js` يشتقّ النوعَ من
// بريف التصميم باحتياطَين مكتوبَين: 'business' لقاعدة البيانات و'ecommerce'
// لـPrisma. و'ecommerce' **مفتاحٌ موجود** في `PRISMA_SCHEMAS` — فنظامُ تاكسي
// بلا نوعٍ في البريف كان يأخذ مخطّطَ متجرٍ إلكترونيّ (Product/OrderItem/Review)
// حتميّاً وبلا مزوّد. الاحتياطُ الذي يُخمّن أسوأُ من الاحتياط الذي يعترف.
//
// التوقيعُ هنا: مجموعةُ مفاهيمَ دالّة → نوع. لا تُطابَق إلّا إن حضر ما يميّز،
// وإلّا فـnull: «لا أعرف» جوابٌ صحيح يُمرَّر لمن يقرأ الهدفَ نفسَه.
const TYPE_SIGNATURES = [
    ['restaurant', ['restaurant', 'table', 'product', 'order']],
    ['hotel', ['room', 'guest', 'booking']],
    ['medical', ['patient', 'doctor', 'visit']],
    ['clinic', ['patient', 'doctor', 'booking']],
    ['education', ['course', 'student', 'teacher', 'grade']],
    ['realestate', ['property', 'tenant', 'lease']],
    ['travel', ['traveler', 'trip', 'booking', 'ticket']],
    ['ecommerce', ['product', 'order', 'customer', 'store']],
    ['booking', ['booking', 'service']],
];

/**
 * نوعُ المشروع المستنتَجُ من الفهم، أو `null` إن لم يميّزه الفهم.
 * الأعلى تطابقاً يفوز، والتعادلُ يُكسر باسم النوع (ترتيبٌ معلَنٌ مستقرّ لا ترتيبُ مصفوفة).
 */
export function modelProjectType(domainModel) {
    const m = normalizeProjectModel(domainModel || {});
    // لا حاجةَ لحارسِ حجمٍ هنا: `score ≤ have.size`، وشرطُ «مطابقتان فأكثر» أدناه
    // يمنع وحدَه كلَّ فهمٍ أفقرَ من مفهومَين. ولا توقيعَ يحوي مفهوماً عامّاً (يثبّته
    // اختبارُ الحدود)، فلا أثرَ لإسقاط العامّ على النتيجة.
    const have = conceptSet([...m.entities.map(e => e.name), ...m.roles.map(r => r.name)]);
    let best = null; let bestScore = 0;
    for (const [type, sig] of TYPE_SIGNATURES) {
        const score = sig.filter(c => have.has(c)).length;
        // مفهومان دالّان على الأقلّ — الواحدُ يصادف
        if (score < 2) continue;
        if (score > bestScore || (score === bestScore && type < best)) { bestScore = score; best = type; }
    }
    return best;
}

/** نوعُ المفهوم: 'role' أو 'entity' أو null لما ليس في المعجم. */
export function conceptKind(concept) {
    const c = String(concept || '');
    if (ROLE_KEYS.has(c)) return 'role';
    if (ENTITY_KEYS.has(c)) return 'entity';
    return null;
}
/** المفاهيمُ التي لا تحمل معلومةَ منتج — لا تُقيِّد الاختيار. */
const GENERIC_CONCEPTS = new Set(['user', 'item', 'employee']);
/** هل المفهومُ عامٌّ (PM/7)؟ — عامٌّ لا يُتتبَّع في ملفّات: `conceptsInText` تستبعده أصلاً فغيابُه ليس ثغرة. */
export function isGenericConcept(concept) { return GENERIC_CONCEPTS.has(String(concept || '')); }

/**
 * تطبيعُ الحروف وحدَه: صغيرة، بلا تشكيل، همزاتٌ موحَّدة، ة → ه — **و«ال» باقية**.
 *
 * شُقَّ عن `normalizeConceptText` (PM/24) لأنّ لأداة التعريف مستهلكاً يحتاجها لا يُسقطها:
 * «ال» **علامةُ اسم** لا تدخل على فعل، وهي أوثقُ ما في الطلب القصير. ولمّا كان التطبيعُ
 * يبتلعها، كان القارئُ الجديد سيكتب نسخةً ثانية — وهي علّةُ النسختين التي تكرّرت في هذه
 * الشجرة مراراً. فالمصدرُ واحدٌ بخطوتين: هذه، ثمّ نزعُ الأداة فوقها.
 */
export function normalizeLetters(s) {
    return String(s || '').toLowerCase()
        .replace(/[ً-ْـ]/g, '')
        .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
        .replace(/[^\p{L}\p{N}\s/]/gu, ' ')
        .split(/[\s/]+/).filter(Boolean)
        .join(' ').trim();
}

/** تطبيعٌ لغويّ خفيف: `normalizeLetters` + نزعُ «ال» التعريف وسوابقِها الملتصقة. */
export function normalizeConceptText(s) {
    return normalizeLetters(s).split(' ').filter(Boolean)
        // «ال» التعريف وسوابقُ العطف/الجرّ الملتصقة بها (والسائق، بالمركبة، للراكب) تُنزع — بلا هذا
        // تفلت نصفُ مفردات النصّ العربيّ. السابقةُ وحدها (بلا «ال») لا تُنزع: «وقت» ليست «قت».
        .map(t => (t.length > 4 && /^[وفبكل]ال/.test(t)) ? t.slice(3) : t)
        .map(t => (t.length > 3 && t.startsWith('ال')) ? t.slice(2) : t)
        .join(' ').trim();
}
const SYNONYMS = []; // [normalizedSynonym, concept] — الأطولُ أوّلاً كي يغلب «مدير أسطول» «مدير»
for (const [concept, list] of Object.entries(CONCEPTS)) for (const s of list) SYNONYMS.push([normalizeConceptText(s), concept]);
SYNONYMS.sort((a, b) => b[0].length - a[0].length);
const EXACT = new Map(SYNONYMS.map(([s, c]) => [s, c]));

/**
 * مفهومُ اسمٍ واحد. «العميل (Passenger)»: ما بين القوسين هو المصطلحُ الأدقّ فيُقدَّم.
 * الترتيب: مطابقةٌ تامّة → مرادفٌ متعدّدُ الكلمات مضمَّن → كلمةٌ واحدة → الاسمُ المطبَّع نفسُه.
 */
export function conceptOf(name) {
    const raw = String(name || '');
    const inParens = [...raw.matchAll(/\(([^)]+)\)/g)].map(m => m[1]);
    const outside = raw.replace(/\([^)]*\)/g, ' ');
    const candidates = [...inParens, outside].map(normalizeConceptText).filter(Boolean);
    for (const s of candidates) {
        if (EXACT.has(s)) return EXACT.get(s);
        for (const [syn, c] of SYNONYMS) if (syn.includes(' ') && (' ' + s + ' ').includes(' ' + syn + ' ')) return c;
        for (const tok of s.split(' ')) if (EXACT.has(tok)) return EXACT.get(tok);
    }
    return candidates[0] || '';
}
const conceptSet = (names, { dropGeneric = false } = {}) => new Set(
    (names || []).map(conceptOf).filter(c => c && !(dropGeneric && GENERIC_CONCEPTS.has(c))));

/**
 * 🗣️ PM/14 — نصُّ **المنتج** من نصِّ الملفّ: لغةُ الآلة ليست لغةَ صاحب المشروع.
 *
 * قِيس: صفحةٌ لا تذكر المجالَ بكلمةٍ واحدة تنطق بستّة كياناتٍ من المعجم — `course` من السمة `class`، و`event`
 * من `pointer-events`، و`order` من خاصّة الترتيب، و`location` من `grid-area`، و`property` من
 * `transition-property`، و`table` من الوسم وخاصّته. فمنتجُ العقارات كان يجتاز بوّابةَ متطلّباته **٢/٢** على
 * صفحةٍ فارغة، والمطعمُ ٢/٣ — و«الغيابُ قاطع» هو نصُّ عقد `traceRequirements`. وأسوأُ منه أنّ «المغطّى» يصير
 * غيرَ صفر فتُخرَس بوّابةُ التلوّث (PM/3) الموضوعةُ لالتقاط «بُني منتجٌ آخر».
 *
 * القاعدةُ ثلاثٌ، بنيويّةٌ لا قائمةَ كلمات: **التنسيقُ لا يسمّي منتجاً** (ملفُّ CSS كلُّه، و`<style>` المضمَّن)؛
 * **أسماءُ الوسوم والسمات كلماتُ المنصّة** (القيمةُ والنصُّ المرئيُّ يبقيان — «ابحث عن طلب» في `placeholder`
 * أثرٌ صادق)؛ و**تعبيرُ المتصفّح المعروف يُسقَط** (`window.location.href`) لا الكلمةُ وحدَها، فـ`location`
 * حقلَ بياناتٍ في تطبيق توصيلٍ أثرٌ صادق أيضاً.
 * دالّةٌ نقيّة. لا تُستعمل على نصّ المستخدم (الهدف/الوثيقة) — هناك لا آلةَ تتكلّم.
 * @param {string} content محتوى الملفّ  @param {string} name اسمُه (يُميّز CSS)
 */
export function productText(content = '', name = '') {
    if (/\.css$/i.test(String(name))) return '';
    let s = String(content).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
    // الوسمُ يُستبدل بقيم سماته وحدَها — إلّا `style` فقيمتُها تنسيقٌ أيضاً
    s = s.replace(/<[^>]*>/g, (tag) => ' ' + [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
        .filter(m => m[1].toLowerCase() !== 'style').map(m => m[2] ?? m[3]).join(' ') + ' ');
    // تعبيراتُ المتصفّح المعروفة — لا الكلماتُ المفردة
    return s
        .replace(/\b(?:window|document|globalThis)\s*\.\s*location\b/g, ' ')
        .replace(/\blocation\s*\.\s*(?:href|hash|search|pathname|origin|host|hostname|protocol|port|reload|assign|replace)\b/g, ' ')
        .replace(/\b(?:Event|CustomEvent|EventTarget|PointerEvent|KeyboardEvent|MouseEvent)\b/g, ' ')
        .replace(/\bclass\s+(?=[A-Z_$])/g, ' ');
}

/**
 * 🔎 المفاهيمُ التي ينطق بها نصٌّ فعلاً (PM/3): فهرسٌ عكسيّ للمعجم نفسِه — لا قائمةَ كلماتٍ ثانية.
 * يُطبَّع النصُّ مرّةً ثمّ يُبحث عن كلِّ مرادفٍ ككلمةٍ كاملة (أو عبارةٍ كاملة). المفاهيمُ العامّة تُستبعد
 * لأنّها لا تسمّي منتجاً. دالّةٌ نقيّة، بلا نموذجٍ لغويّ.
 */
export function conceptsInText(text, { limit = 200000 } = {}) {
    const s = ' ' + normalizeConceptText(String(text || '').slice(0, limit)) + ' ';
    const found = new Set();
    for (const [syn, concept] of SYNONYMS) {
        if (GENERIC_CONCEPTS.has(concept) || found.has(concept)) continue;
        if (syn.length >= 3 && s.includes(' ' + syn + ' ')) found.add(concept);
    }
    return found;
}

/**
 * 🔢 تكرارُ المفاهيم في نصّ (PM/6): كم مرّةً يُذكر كلُّ مفهومٍ — بمجموع مرادفاته ككلماتٍ/عباراتٍ كاملة.
 *
 * لماذا التكرار؟ `conceptsInText` تجمع المفاهيمَ بترتيب طول المرادف (الأطولُ أوّلاً) لا بأهمّيّتها، وسقوفُ
 * التطبيع (٤ أدوار، ٦ كيانات) تقطع ما زاد — فمن ستّةَ عشرَ مفهوماً في مواصفةِ نقاطِ البيع وصل النموذجَ عشرة،
 * وسقط `admin`/`accountant`/`payment` لا لأنّها أقلُّ شأناً بل لأنّ مرادفاتها أقصر. «فاتورة» في تلك المواصفة
 * تتكرّر، و«عملة» عابرة — فالتكرارُ هو إشارةُ الأهمّيّة الصادقة بلا نموذجٍ لغويّ. المرادفاتُ المتداخلة
 * («مدير أسطول» تحوي «مدير») تُعدّ لكليهما — للترتيب يكفي، وللدقّة ديْنٌ مكتوب. دالّةٌ نقيّة.
 */
export function conceptFrequencies(text, { limit = 200000 } = {}) {
    const s = ' ' + normalizeConceptText(String(text || '').slice(0, limit)) + ' ';
    const freq = new Map();
    for (const [syn, concept] of SYNONYMS) {
        if (GENERIC_CONCEPTS.has(concept) || syn.length < 3) continue;
        const needle = ' ' + syn + ' ';
        let i = 0, n = 0;
        while ((i = s.indexOf(needle, i)) !== -1) { n += 1; i += needle.length - 1; }
        if (n) freq.set(concept, (freq.get(concept) || 0) + n);
    }
    return freq;
}

/**
 * 🧩 نموذجٌ من معجم الطلب (PM/6): الأدوارُ والكياناتُ التي ينطق بها النصُّ مرتّبةً بالتكرار ثمّ بالاسم.
 * أسماؤها مفاتيحُ مفاهيمَ (`storekeeper`, `invoice`) على سابقة PM/4 — تكفي للمقارنة والتحقّق. لا تدفّقات:
 * المعجمُ أسماءٌ لا أفعال. دالّةٌ نقيّة، تعود فارغةً لنصٍّ بلا مفاهيم.
 */
export function lexiconModel(text) {
    const ranked = [...conceptFrequencies(text).entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([c]) => c);
    const pick = (kind) => ranked.filter(c => conceptKind(c) === kind).map(name => ({ name, description: '' }));
    return { roles: pick('role'), entities: pick('entity'), flows: [], _source: 'lexicon' };
}

/**
 * 🗣️ الكلماتُ الدالّة في نصّ طلب (PM/22): ما يقولُه صاحبُ المشروعِ بلفظِه هو، بلا معجم.
 *
 * المعجمُ (`CONCEPTS`) قائمةٌ **مغلقة**: ما ليس فيها لا يُرى. وقِيس أنّ ثمانيةَ أهدافٍ
 * ممّا ليس موقعاً تجاريّاً (متتبّعُ حفظ، متتبّعُ عادات، بطاقاتُ مذاكرة، يوميّات، مترونوم، مواقيتُ
 * صلاة، ميزانيّةٌ شخصيّة، لعبةُ كلمات) تُنتج **صفرَ مفاهيمَ في ثمانٍ من ثمان**، فيما يُنتج
 * متجرٌ وعيادةٌ خمسةً لكلٍّ. فكلُّ بوّابات عقل المنتج تصمت هناك (`applicable:false`،
 * `substantive:false`، `modelProjectType ← null`) ولا يبقى إلّا تخمينُ النموذج اللغويّ بلا رقيب.
 *
 * فهذه تقرأ الطلبَ بلا قائمة: الكلماتُ المتكرّرةُ بعد حذفِ أدواتِ الربط وألفاظِ المنصّة
 * («تطبيق»، «صفحة»، «app»…) مرتّبةً بالتكرار. دالّةٌ نقيّة.
 *
 * حدٌّ **مقيسٌ ومقصود**: هذه صالحةٌ لـ**للمقارنة** لا لـ**للتسمية**. قِيس على الأهداف
 * الثمانية أنّ مخرجاتِها تخلط إشارةً صادقة («حفظ، آيات، عادة، بطاقة، صلاة، قبلة، لاعب») بضوضاء
 * («تزامه، بكل، ذهب، أتم») — فلا تُشتقَّ منها أسماءُ كيانات. ذلك دَينٌ مفتوح.
 */
const GOAL_STOPWORDS = new Set(normalizeConceptText(
    'تطبيق تطبيقا برنامج موقع نظام صفحة صفحات شاشة شاشات زر أزرار واجهة واجهات بيانات معلومات أداة '
    + 'كل من في على إلى عن مع أو ثم لا ما هو هي التي الذي بلا بدون دون يكون تكون يمكن بعض جميع هذا هذه ذلك '
    + 'كما حيث عند أي إذا قد لكن إلا نفس بحسب داخل خارج بين قبل بعد فقط أيضا كذلك حين أثناء عبر خلال حول ضمن '
    + 'نحو منذ حتى لدى غير سوى الآن اليوم أمس غدا كذا شيء أشياء عدد كم مثل نوع أنواع أريد ابن ابني أجل '
    + 'app web page pages screen button data user tool system site build make create the a an of in on to for '
    + 'with and or not is are be this that it as by from at all any each new one two how many what which when where'
).split(' '));

/**
 * @param {string} text نصُّ الطلب  @returns {string[]} الكلماتُ الدالّة مرتّبةً بالتكرار ثمّ بالحرف
 */
export function goalWords(text, { min = 3, top = 60, limit = 200000 } = {}) {
    const freq = new Map();
    for (const t of normalizeConceptText(String(text || '').slice(0, limit)).split(' ')) {
        if (t.length < min || GOAL_STOPWORDS.has(t) || /^[\d\u0660-\u0669]+$/.test(t)) continue;
        freq.set(t, (freq.get(t) || 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, top).map(([w]) => w);
}

/**
 * 🧱 ألفاظُ **إطار الوثيقة** — عناوينُ تصف الوثيقةَ لا المنتج. تُسقَط من التسمية وحدَها.
 * ليست قائمةَ مجال (تلك مغلقةٌ بطبعها، وهي علّةُ PM/22 نفسُها) بل ألفاظُ كتابةِ المواصفات.
 */
const FRAME_HEADINGS = new Set(normalizeConceptText(
    'الغاية الهدف الاهداف المقدمة النظرة الملخص الخلاصة الخاتمة المتطلبات المواصفات النطاق '
    + 'الشاشات الصفحات الواجهة الواجهات التصميم الاعدادات الضبط التهيئة الاحصاءات التقرير التقارير '
    + 'الملاحظات الميزات الوظائف المراحل الخطة التنفيذ التقنيات القيود الامان الاداء '
    + 'goal goals purpose overview summary scope requirements screens pages ui design settings '
    + 'stats statistics report reports notes features functions plan phases stack constraints'
).split(' '));

/**
 * 🏷️ أسماءُ كياناتٍ من **عناوين صاحب المشروع نفسِه** (PM/23).
 *
 * قِيس في PM/22 أنّ كلماتِ الطلب بالتكرار تصلح للمقارنة لا للتسمية: تخلط صدقاً («حفظ، آيات، عادة»)
 * بضوضاء («تزامه، بكل، ذهب، أتم»). فكُتب ذلك ديْناً وقيل إنّه يحتاج تحليلاً صرفيّاً.
 *
 * ثمّ قِيس أنّ **الإشارةَ كانت في مكانٍ آخر**: عناوينُ البنود المرقّمة. صاحبُ المشروع يكتبها **أسماءً**
 * لا أفعالاً، مجرّدةً من لواصق الضمائر — فهي تسميتُه هو لأجزاء منتجه. المقياسُ على ستِّ مواصفاتٍ
 * («وِرد»، عادات، بطاقات، مترونوم، ميزانيّة، مواقيت):
 *   • أوّلُ كلمةٍ من كلِّ عنوان: **١٨/١٩ (٩٥٪)**
 *   • كلُّ كلمات العنوان:        ٢٣/٢٨ (٨٢٪) — «الورد **اليوميّ**»، «التقرير **الشهريّ**» صفاتٌ لا كيانات
 *   • التكرارُ في المتن:          نحوُ ٥٠٪
 * فالأولى هي القاعدة: **رأسُ العنوان**، وما بعده وصفٌ.
 *
 * دالّةٌ نقيّة. تعود فارغةً لطلبٍ بلا بنودٍ مرقّمة — وذلك صحيح: لا عناوينَ فلا تسمية.
 * وحدٌّ مكتوب: هذا يسمّي **كياناتٍ** لا أدواراً؛ العنوانُ لا يقول من يستعمل ماذا.
 * @param {string} goalText نصُّ الطلب كما كتبه صاحبُه
 */
export function headingEntityNames(goalText, { max = 6 } = {}) {
    const out = [];
    for (const { title } of specSections(goalText)) {
        const head = normalizeConceptText(title).split(' ')
            .find(w => w.length >= 3 && !/^[\d\u0660-\u0669]+$/.test(w));
        if (head && !FRAME_HEADINGS.has(head) && !out.includes(head)) out.push(head);
    }
    return out.slice(0, max);
}

/**
 * 🏷️ أسماءُ كياناتٍ من **أداة التعريف** في طلبٍ قصير (PM/24).
 *
 * PM/23 سمّت من عناوين البنود المرقّمة (٩٥٪). لكنّ الطلبَ القصير بلا عناوين، وقِيس أنّ كلماتِه
 * بالتكرار أسوأُ من متن الوثيقة: **٢١/٤٨ = ٤٤٪** — أفعالٌ («اصنع»، «أسجّل»، «تضبط») ولواصقُ
 * ضمائرَ («عاداتي»، «تدويناتي») وحروفٌ («فيه»، «بوسوم»).
 *
 * والإشارةُ كانت في اللواصق نفسِها لا في إسقاطها: **«ال» لا تدخل على فعل**. فقِيست وحدَها:
 *   • «ال» بلا فلتر            ٢٦/٣٤ = ٧٦٪
 *   • **«ال» بإسقاط صفةِ النسبة  ٢٥/٢٦ = ٩٦٪**
 *   • الضميرُ المتّصل           ٥/٢٢ = ٢٣٪  ← ساقط: تطبيعُ `ة→ه` يجعل كلَّ مؤنّثٍ يبدو
 *     منتهياً بهاء الملكيّة («مذاكرة»→«مذاكر»)، والأفعالُ تأخذ ضمائرَ مفعولٍ («ينبّهني»).
 *
 * وصفةُ النسبة هي أكثرُ ما يلتبس بالاسم بعد «ال» («اليوميّة»، «أفقيّة»، «النسخيّ»، «إلكترونيّاً»)،
 * فتُسقَط بلاحقتها. وثمنُها مقيسٌ: تسقط معها أسماءٌ صحيحةٌ قليلة («السقاية») — والدقّةُ أولى هنا،
 * لأنّ الاسمَ الخطأ يصير كياناً يُبنى له.
 *
 * التغطيةُ ٨/١٤ هدفاً — وذلك صريحٌ لا عيب: طلبٌ بلا «ال» يبقى بلا تسمية، فيُقال ولا يُختلق.
 * وستٌّ من الأهداف الأربعةَ عشرَ أُضيفت **بعد** صوغ القاعدة، ونصيبُها ١٦/١٧ — فلا تفصيلَ على المثال.
 *
 * دالّةٌ نقيّة. حدٌّ مكتوب: «ال» التي ليست أداةَ تعريف تمرّ («الالتزام» ← «تزام»)، وهي — كأختِها
 * في `wordsMeet` — التباسٌ لا يُحسم بلا معجمٍ صرفيّ.
 */
const ARTICLE_MARKED = /^(?:[وفبكل])?ال(.{3,})$/u;
const NISBA_SUFFIX = /(?:يه|يا|ي)$/u;

export function articleEntityNames(goalText, { max = 6 } = {}) {
    const out = [];
    for (const w of normalizeLetters(stripNegated(goalText)).split(' ')) {
        const m = ARTICLE_MARKED.exec(w);
        if (!m) continue;
        const stem = m[1];
        if (NISBA_SUFFIX.test(stem) || FRAME_HEADINGS.has(stem) || GOAL_STOPWORDS.has(stem)) continue;
        if (!out.includes(stem)) out.push(stem);
    }
    return out.slice(0, max);
}

/**
 * ⚖️ هل يمسُّ الفهمُ الطلبَ أصلاً؟ (PM/22) — `domainFidelity` تسأل عن **المبنيّ**، وهذه تسأل عن **المطلوب**.
 *
 * قِيس في تجربة `from0`: طُلب متتبّعُ حفظِ قرآن، فأعاد النموذجُ اللغويّ
 * `Student/Teacher/Parent/Grade/ForumPost`، و`normalizeProjectModel` تفحص **شكلَ** النموذج ولا تفحص
 * **صلتَه بالطلب** أبداً — فلا بوّابةَ بين الفهم والسؤال. وقُِيس أنّ `domainFidelity` لو طُبّقت
 * على الطلب لما مَيّزت: المهلوَس والصادق كلاهما `covered:0` — لأنّ طرفَي المقارنة لا يتكلّمان
 * لغةً واحدة: طرفُ الفهم **مفتوح** (`conceptOf` تعود بالاسم نفسِه حين يغيب المعجم)،
 * وطرفُ النصّ **مغلق** (`conceptsInText` لا ترى إلّا المعجم). فالمقياسُ يقول الشيءَ نفسَه للصادق والكاذب.
 *
 * فهنا جسران، والاسمُ مسنودٌ إن عبَر أحدَهما:
 *  1. **جسرُ المعجم**: الاسمُ مفهومٌ معروف، والطلبُ ينطق به — يجسر اللغتين (`Product` ↔ «منتجات»).
 *  2. **جسرُ اللفظ**: إحدى كلماتِ الاسم تلتقي كلمةً دالّةً في الطلب — يعمل خارج المعجم كلِّه.
 *
 * مقيسٌ على مواصفة «وِرد»: المهلوَس ٠/٦ والصادق ٤/٤ — فصلٌ تامُّ.
 *
 * حدٌّ مقيسٌ مكتوب: فهمٌ **صادق** بأسماءٍ إنجليزيّة في مجالٍ **خارج المعجم** على طلبٍ عربيّ
 * لا يعبر أيَّ جسر (`Wird/Surah/Memorizer` على وصفٍ عربيّ ← ٠/٤) — إنذارٌ كاذب. ولذلك لا يُسقِط
 * مستهلِكُها بناءً ولا يستبدل فهماً: يقول «لم يُتحقَّق». والمجالُ المعروف لا يقع فيه: جسرُ
 * المعجم يعبر بـ`Product/Order/Customer` إلى «منتجات/طلبات/عملاء» (مقيس).
 *
 * @param {object} understood نموذجُ الفهم  @param {string} goalText نصُّ الطلب كما كتبه صاحبُه
 */
export function goalFidelity(understood, goalText) {
    const m = normalizeProjectModel(understood || {});
    // الأسماءُ العامّة (`User`/`Item`) لا تُحسَب دليلاً ولا تُهمة — لا تسمّي منتجاً
    const names = [...m.entities.map(e => e.name), ...m.roles.map(r => r.name)]
        .filter(n => !isGenericConcept(conceptOf(n)));
    // 🧭 لا نصَّ طلبٍ = لا حكم. قِيس: مسارٌ يستدعي المرحلةَ بسياقٍ بلا هدف كان يُدان فهمُه
    //    «لا يمسّ الطلبَ» — وهو عينُ الخطأ الذي تُصلحه هذه الجولة: مقياسٌ بلا مُدخَلٍ يقول
    //    «لا أستطيع الحكم» لا «مُدان». (`applicable:false` تُسكت الحكمَ كما في `domainFidelity`.)
    if (!String(goalText || '').trim()) {
        return { applicable: false, names, supported: [], groundless: [], words: [], ungrounded: false };
    }
    // 🚫 ما نفاه صاحبُ المشروع ليس دليلاً على أنّ طلبَه ينطق به. قِيس: مواصفةُ «وِرد» كلُّها
    //    تُنتج مفهوماً واحداً — `account` — من عبارة «بلا **حساب**»، فكان يسنُد فهماً مهلوَساً
    //    (`Grade/ForumPost/Teacher/Parent`) فينجو من الوصم. وهي علّةُ `needsBackend` نفسُها
    //    بوجهٍ ثانٍ، ولذلك صار مصدرُ `stripNegated` واحداً.
    const said = stripNegated(goalText);
    const spoken = conceptsInText(said);
    const words = goalWords(said);
    const supported = []; const groundless = [];
    for (const name of names) {
        const concept = conceptOf(name);
        const byLexicon = !!concept && spoken.has(concept);
        const byWord = normalizeConceptText(name).split(' ')
            .some(t => t.length >= 3 && words.some(w => wordsMeet(t, w)));
        (byLexicon || byWord ? supported : groundless).push(name);
    }
    return {
        // مفهومان فأكثر — العتبةُ نفسُها في `domainFidelity`: الواحدُ يُصادَف
        applicable: names.length >= 2,
        names, supported, groundless, words,
        // لا أحدَ من أسماء الفهم له أثرٌ في طلب صاحبِه — فهذا فهمُ منتجٍ آخر
        ungrounded: names.length >= 2 && supported.length === 0,
    };
}

/**
 * هل تلتقي كلمتان؟ جذرٌ خشن: البدايةُ المشتركة تكفي (حفظ/يحفظ/حافظ) — مقياسٌ لا لغويّاتٌ،
 * والتساهلُ مقصود: الإنذارُ هو الفعلُ الخطِر فيُمال إلى عدمِه.
 *
 * والاحتواءُ (لا البدايةُ وحدَها) لأربعةِ أحرفٍ فأكثر: `normalizeConceptText` تنزع «ال» وسوابقَها
 * الملتصقة (`[وفبكل]ال`) ولا تنزع «لل» — فطلبٌ يقول «تعود **للمراجعة**» كان يُسقط اسماً صادقاً
 * اسمُه «مراجعة» (مقيس). والحدُّ أربعةٌ لأنّ ما دونها يلتقي مصادفةً داخل كلماتٍ أخرى.
 * أُصلح هنا لا في `normalizeConceptText`: نزعُ «لل» هناك يمسّ كلَّ المطابقات ويلتبس
 * («للعبة» = لِـ+لعبة لا لِـ+اللعبة)، وهنا أثرُه في اتّجاه التساهل وحدَه.
 */
function wordsMeet(a, b) {
    if (a === b) return true;
    const short = a.length <= b.length ? a : b;
    const long = a.length <= b.length ? b : a;
    if (short.length < 3) return false;
    return long.startsWith(short) || (short.length >= 4 && long.includes(short));
}

/**
 * ⚖️ صدقُ المجال (PM/3): هل يتكلّم المبنيُّ لغةَ المنتج المفهوم أم لغةَ منتجٍ آخر؟ دالّةٌ نقيّة.
 * - `expected`: مفاهيمُ الفهم (كيانات + أدوار، بلا العامّة). `spoken`: ما ينطق به النصّ.
 * - `foreign`: مفاهيمُ منتجٍ لا يذكرها الفهمُ إطلاقاً. `covered`: ما تقاطع.
 * - **تلوّث** (`contaminated`): ثلاثةُ مفاهيمَ أجنبيّة فأكثر بلا أيِّ تقاطع — الصفحةُ تسمّي منتجاً آخر.
 *   العتبةُ ثلاثة لا واحد: كلمةٌ عابرة («طلب»، «حجز») تظهر في كلّ منتجٍ تقريباً، أمّا ثلاثةٌ بلا تقاطعٍ فهويّةٌ كاملة.
 */
export function domainFidelity(understood, text) {
    const m = normalizeProjectModel(understood || {});
    const expected = conceptSet([...m.entities.map(e => e.name), ...m.roles.map(r => r.name)], { dropGeneric: true });
    const spoken = conceptsInText(text);
    const covered = [...expected].filter(c => spoken.has(c));
    const foreign = [...spoken].filter(c => !expected.has(c));
    const missing = [...expected].filter(c => !spoken.has(c));
    return {
        applicable: expected.size >= 2,
        expected: [...expected], spoken: [...spoken], covered, foreign, missing,
        contaminated: expected.size >= 2 && covered.length === 0 && foreign.length >= 3,
    };
}

/**
 * قربُ نموذجِ الفهم من نموذجِ مرشَّح (كلون/مرجع). دالّةٌ نقيّة.
 * - `roleCoverage`: نسبةُ أدوار الفهم التي يغطّيها المرشَّح (null إن لم يكن للفهم أدوارٌ ذاتُ معنى).
 *   دورٌ غيرُ مغطّى = واجهةٌ كاملة يطلبها المستخدم ولا يملكها المنتجُ المرشَّح.
 * - `entityOverlap`: نسبةُ كيانات الفهم المشتركة (null إن لم تكن كيانات).
 * - `substantive`: للفهم أدوارٌ أو كياناتٌ غيرُ عامّة — وإلّا لا شيءَ يُقارَن.
 */
export function modelAffinity(understood, candidate) {
    const u = normalizeProjectModel(understood || {});
    const c = normalizeProjectModel(candidate || {});
    const uRoles = conceptSet(u.roles.map(r => r.name), { dropGeneric: true });
    const cRoles = conceptSet(c.roles.map(r => r.name));
    const uEnts = conceptSet(u.entities.map(e => e.name), { dropGeneric: true });
    const cEnts = conceptSet(c.entities.map(e => e.name));
    const missingRoles = [...uRoles].filter(k => !cRoles.has(k));
    const sharedEntities = [...uEnts].filter(k => cEnts.has(k));
    const roleCoverage = uRoles.size ? (uRoles.size - missingRoles.length) / uRoles.size : null;
    const entityOverlap = uEnts.size ? sharedEntities.length / uEnts.size : null;
    const parts = [roleCoverage, entityOverlap].filter(v => v !== null);
    const score = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    return { roleCoverage, entityOverlap, missingRoles, sharedEntities, score, substantive: uRoles.size + uEnts.size > 0 };
}
