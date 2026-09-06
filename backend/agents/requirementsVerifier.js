/**
 * 📋 Requirements Verifier — هل نُفِّذت متطلبات المشروع فعلاً؟
 *
 * الفجوة التي يسدّها: الـ App Blueprint كان يحدد المكوّنات الوظيفية
 * (بحث، حجز، سلة...) وتُحقن كسياق توليد — لكن لا أحد يتحقق بعد البناء
 * أنها نُفِّذت فعلاً وتعمل. النتيجة: مواقع "تبدو" صحيحة وميزاتها ناقصة.
 *
 * الدور:
 * - verifyRequirements: فحص LLM منظّم — لكل مكوّن وظيفي: نُفِّذ أم لا،
 *   ولماذا، وتعليمة إصلاح جاهزة للناقص.
 * - formatChecklist: قائمة تحقق صادقة تُعرض للمستخدم في الشات.
 *
 * llm قابل للحقن للاختبار. فشل النداء → null (المهمة لا تتعطل).
 */

import { smartChat } from '../core/providers/llm.js';
import { conceptOf, conceptKind, conceptsInText, isGenericConcept, normalizeConceptText } from './projectModel.js';

const VERIFY_SYSTEM = `أنت مدقق جودة صارم لمواقع الويب. لديك متطلبات وظيفية وكود الموقع الفعلي.
لكل متطلب، افحص الكود بدقة: هل نُفِّذ **فعلاً بشكل عامل** (عناصر UI موجودة + منطق JavaScript حقيقي يعمل عليها ببيانات) — أم مجرد شكل/زخرفة/غير موجود؟

أعد JSON فقط:
{ "results": [ { "name": "اسم المتطلب", "implemented": true|false, "reason": "دليل موجز من الكود", "fixInstruction": "تعليمة تنفيذ كاملة (للناقص فقط، بالعربية، محددة قابلة للتنفيذ مباشرة)" } ] }

قواعد:
- زر بلا دالة تعمل = غير منفّذ. نموذج لا يعالج الإدخال = غير منفّذ. بحث لا يُصفّي بيانات حقيقية = غير منفّذ.
- كن صارماً لكن عادلاً: التنفيذ البسيط العامل يُحتسب منفّذاً.
- fixInstruction يجب أن تكفي وحدها لمحرر كود لتنفيذ المتطلب (اذكر الملفات والعناصر والسلوك المطلوب).`;

/**
 * 🧩 PM/4 — المتطلّباتُ من الفهم لا من قائمة المخطّط وحدَها.
 *
 * قِيس: بلا نموذجٍ لغويّ يخرج المخطّطُ بمكوّنٍ وظيفيٍّ واحدٍ اسمُه «الميزة الأساسية
 * التفاعلية» — وهذه كلُّ مواصفةِ نظامِ تاكسي يعرف المرجعُ له خمسَ شاشات. فالمحقّقُ
 * يتحقّق من عموميّةٍ ويسكت عمّا فُهم. هنا: كلُّ دورٍ مفهومٍ شاشتُه، وكلُّ كيانٍ تمثيلُه،
 * وكلُّ تدفّقٍ انتقالُه — تُضاف لِما في المخطّط ولا تُزيحه، بلا تكرارِ ما هو مذكورٌ أصلاً.
 */
export function composeRequirements(blueprint, domainModel = null) {
    const comps = (blueprint?.functionalComponents || []).filter(c => c && c.name);
    const seen = new Set(comps.map(c => String(c.name).toLowerCase().trim()));
    // PM/7: `_kind` يقول من أيّ وجهٍ من الفهم جاء المتطلّب — المتتبِّعُ الحتميّ يقرؤه (التدفّقُ لا يُتتبَّع بالمفردات).
    const add = (name, behavior, kind) => {
        const k = String(name).toLowerCase().trim();
        if (seen.has(k)) return;
        seen.add(k);
        comps.push({ name, behavior, _source: 'model', _kind: kind });
    };
    for (const r of (domainModel?.roles || [])) {
        if (r?.name) add(`شاشة ${r.name}`, `قسمٌ/صفحةٌ مستقلّة للدور «${r.name}» تعمل فعلاً (عناصر + منطق JS)، لا ذكرَ اسمٍ في نصّ`, 'role');
    }
    for (const e of (domainModel?.entities || [])) {
        if (e?.name) add(`بيانات ${e.name}`, `تمثيلٌ فعليّ للكيان «${e.name}»: مصفوفةُ بياناتٍ واقعيّة تُعرض وتُحدَّث، لا عنوانٌ ثابت`, 'entity');
    }
    for (const f of (domainModel?.flows || [])) {
        // اسمُ التدفّق قد يبدأ بالكلمة نفسِها («تدفّق حالة الرحلة») فلا نكرّرها
        if (f?.name) add(String(f.name).startsWith('تدفّق') ? f.name : `تدفّق ${f.name}`, `انتقالُ الحالة${f.steps?.length ? ` (${f.steps.join(' → ')})` : ''} يعمل بـ JS على البيانات نفسِها`, 'flow');
    }
    return comps;
}

/**
 * 🔎 PM/7 — أثرُ المتطلّبات في الملفّات، حتميّاً وبلا مزوّد: لكلِّ متطلّبٍ مفهومُه من المعجم (PM/1)، ثمّ هل
 * تنطق الملفّاتُ به (`conceptsInText`، PM/3)؟
 *
 * ما يقوله وما لا يقوله — مكتوبٌ لأنّ الحكمَ يُبنى عليه: **الغيابُ قاطع** (مفهومٌ لا تذكره الملفّاتُ لم يُنفَّذ
 * فيها)، أمّا **الحضورُ فأثرٌ لا تنفيذ** (لفظُ «عميل» في الصفحة لا يُثبت شاشةَ عميلٍ تعمل — ذلك للمحقّق السلوكيّ
 * أو لمحقّق المتطلّبات بمزوّد). وما ليس في المعجم أو كان عامّاً (`user`/`item`) أو تدفّقاً (انتقالُ حالةٍ لا
 * مفردة) **لا يُتتبَّع** ولا يُحسب له ولا عليه.
 * @returns {{ traced: string[], missing: string[], untraceable: string[] }} أسماءُ المتطلّبات بترتيبها
 */
export function traceRequirements(requirements, files) {
    const spoken = conceptsInText((files || []).map(f => f?.content || '').join('\n'));
    const out = { traced: [], missing: [], untraceable: [] };
    for (const r of (requirements || [])) {
        if (!r?.name) continue;
        const concept = r._kind === 'flow' ? '' : conceptOf(r.name);
        if (!concept || !conceptKind(concept) || isGenericConcept(concept)) { out.untraceable.push(r.name); continue; }
        (spoken.has(concept) ? out.traced : out.missing).push(r.name);
    }
    return out;
}

// كلماتُ الوثيقة التي لا تسمّي شيئاً: أدواتٌ وحروفٌ وألفاظُ إطارٍ («نظام»، «دعم»، «إمكانية») — لا تُعدّ أثراً.
const SECTION_STOPWORDS = new Set(['نظام', 'دعم', 'امكانيه', 'امكانية', 'كل', 'مع', 'او', 'من', 'في', 'على', 'عن', 'الى', 'ان', 'يجب', 'يكون', 'ويجب',
    'عبر', 'لكل', 'بين', 'حسب', 'عند', 'بعد', 'قبل', 'ذلك', 'هذا', 'هذه', 'ثم', 'اذا', 'لا', 'الا', 'غير', 'مثل', 'حتى', 'ايضا', 'مرحله',
    'the', 'and', 'for', 'with', 'of', 'to', 'a', 'an', 'in', 'on', 'or', 'by', 'system', 'support', 'all', 'each', 'via', 'must', 'should']);

/**
 * 🔎 PM/9 — أثرُ بنود الوثيقة بعينها في الملفّات، حتميّاً وبلا مزوّد: لكلِّ بندٍ مرقّم مفرداتُ **عنوانه** (بعد التطبيع، بلا
 * كلماتِ الإطار، ≥٣ أحرف)؛ إن نطقت الملفّاتُ بإحداها ككلمةٍ كاملة فللبند أثر. الغيابُ قاطع، والحضورُ أثرٌ لا تنفيذ (كما في
 * `traceRequirements`) — لكن بلغة المستخدم: «الباركود» و«الموردون» لا «entity/role» يعرفها المعجم أو لا يعرفها.
 * بندٌ بلا مفردةٍ صالحة (عنوانُه كلُّه كلماتُ إطار) لا يُتتبَّع.
 * @returns {{ traced: Array<{n,title}>, missing: Array<{n,title}>, untraceable: Array<{n,title}> }}
 */
export function traceSections(sections, files) {
    const corpus = ' ' + normalizeConceptText((files || []).map(f => f?.content || '').join('\n')) + ' ';
    const out = { traced: [], missing: [], untraceable: [] };
    for (const sec of (sections || [])) {
        if (!sec?.title) continue;
        const item = { n: sec.n, title: sec.title };
        const toks = [...new Set(normalizeConceptText(sec.title).split(' ').filter(t => t.length >= 3 && !SECTION_STOPWORDS.has(t)))];
        if (!toks.length) { out.untraceable.push(item); continue; }
        (toks.some(t => corpus.includes(' ' + t + ' ')) ? out.traced : out.missing).push(item);
    }
    return out;
}

/** «٣ الباركود» — تسميةُ البند كما يراها المستخدم. */
export const sectionLabel = (sec) => `${sec.n} ${String(sec.title).replace(/[:：]\s*$/, '')}`;

/**
 * تعليمةُ إكمالٍ من نصّ الوثيقة نفسِه (PM/9): البنودُ بلا أثر بعناوينها ومتونها كما كتبها المستخدم — لا صياغةٌ عامّة.
 * تُقصّ إلى `limit` بنداً بترتيب الوثيقة (جولةٌ واحدة محدودة) ويُقال كم بقي.
 */
export function buildSectionFixInstruction(missing, sections, domainModel = null, { limit = 8 } = {}) {
    const byN = new Map((sections || []).map(s => [s.n, s]));
    const chosen = (missing || []).slice(0, limit).map(m => byN.get(m.n) || m);
    if (!chosen.length) return '';
    const items = chosen.map(s => `${s.n}. ${s.title}${s.body ? `\n${s.body}` : ''}`).join('\n\n');
    const rest = Math.max(0, (missing || []).length - chosen.length);
    const roles = Array.isArray(domainModel?.roles) ? domainModel.roles.map(r => r.name).filter(Boolean) : [];
    const ents = Array.isArray(domainModel?.entities) ? domainModel.entities.map(e => e.name).filter(Boolean) : [];
    const modelHint = (roles.length || ents.length) ? `\n\nنموذج المشروع: الأدوار [${roles.join('، ') || '—'}] والكيانات [${ents.join('، ') || '—'}] — على مصدر البيانات المشترك نفسِه.` : '';
    return `نفّذ البنودَ التالية من مواصفة المستخدم كميزاتٍ **عاملة فعلياً** (عناصر UI حقيقية + منطق JavaScript على بيانات مشتركة واقعية)، بنصّها كما كُتب:\n\n${items}${rest ? `\n\n(وبقي ${rest} بنداً لجولةٍ لاحقة.)` : ''}${modelHint}\nأضِف ما ينقص دون حذف ما يعمل، واربط الأزرار بمعالجات فعلية (لا تترك دوالّ معلّقة).`;
}

/**
 * @param {object} blueprint مخطط التطبيق (functionalComponents)
 * @param {Array<{name, content}>} files ملفات الموقع المبنية
 * @param {function} llm قابل للحقن (افتراضياً smartChat)
 * @param {object} domainModel نموذجُ الفهم — متطلّباتُه تُضاف لقائمة المخطّط (PM/4)
 * @returns {Promise<{results: Array, missing: Array, implementedCount: number} | null>}
 */
export async function verifyRequirements(blueprint, files, llm = smartChat, domainModel = null) {
    const comps = composeRequirements(blueprint, domainModel);
    if (!comps.length || !Array.isArray(files) || !files.length) return null;

    // الكود ذو الصلة — مقصوص بحدود آمنة للسياق
    const html = files.filter(f => f.name.endsWith('.html'))
        .map(f => `// FILE: ${f.name}\n${(f.content || '').slice(0, 5000)}`).join('\n\n');
    const js = files.filter(f => f.name.endsWith('.js'))
        .map(f => `// FILE: ${f.name}\n${(f.content || '').slice(0, 7000)}`).join('\n\n');

    const reqList = comps.map((c, i) => `${i + 1}. ${c.name} — السلوك المطلوب: ${c.behavior || 'يعمل فعلياً'}`).join('\n');

    let parsed;
    try {
        const raw = await llm([
            { role: 'system', content: VERIFY_SYSTEM },
            { role: 'user', content: `## المتطلبات الوظيفية:\n${reqList}\n\n## HTML:\n${html}\n\n## JavaScript:\n${js}` },
        ], { max_tokens: 1200, temperature: 0, json: true });
        parsed = JSON.parse(raw);
    } catch (e) {
        return null; // فشل التحقق لا يُفشل المهمة
    }

    const results = Array.isArray(parsed?.results) ? parsed.results
        .filter(r => r && typeof r.name === 'string')
        .map(r => ({
            name: r.name,
            implemented: r.implemented === true,
            reason: typeof r.reason === 'string' ? r.reason : '',
            fixInstruction: typeof r.fixInstruction === 'string' ? r.fixInstruction : '',
        })) : [];
    if (!results.length) return null;

    const missing = results.filter(r => !r.implemented);
    return { results, missing, implementedCount: results.length - missing.length };
}

/** تعليمة إصلاح مجمّعة لكل النواقص — جولة تنفيذ واحدة */
export function buildFixInstruction(missing, domainModel = null) {
    if (!missing?.length) return '';
    const items = missing
        .map((m, i) => `${i + 1}. ${m.name}: ${m.fixInstruction || `نفّذ "${m.name}" كشاشة/قسم عامل فعلياً (UI + منطق JS ببيانات حقيقية)`}`)
        .join('\n');

    // 🧩 إرشاد بنموذج المجال: كل دور = شاشته، وكل كيان = تمثيل بيانات فعلي.
    let modelHint = '';
    const roles = Array.isArray(domainModel?.roles) ? domainModel.roles.map(r => r.name).filter(Boolean) : [];
    const ents = Array.isArray(domainModel?.entities) ? domainModel.entities.map(e => e.name).filter(Boolean) : [];
    if (roles.length || ents.length) {
        modelHint = `\n\nنموذج المشروع: الأدوار [${roles.join('، ') || '—'}] والكيانات [${ents.join('، ') || '—'}]. ابنِ **لكل دور شاشته/قسمه المستقل** يعمل على الكيانات (مثال: قسم الزبون لتقديم الطلب، قسم المطعم لعرض الطلبات وتغيير حالتها، قسم التوصيل، قسم التتبّع) — كلها على نفس مصدر البيانات المشترك في script.js.`;
    }

    return `نفّذ المتطلبات/الشاشات الناقصة التالية كميزات **عاملة فعلياً** — عناصر UI حقيقية (نماذج، قوائم، أزرار) + منطق JavaScript يعمل على بيانات مشتركة واقعية، لا زخرفة ولا نصّ فقط:\n${items}${modelHint}\nأضِف ما ينقص دون حذف ما يعمل، واربط الأزرار بمعالجات فعلية (لا تترك دوالّ معلّقة).`;
}

/** قائمة تحقق صادقة للمستخدم */
export function formatChecklist(verdict, lang = 'ar', fixedNames = []) {
    if (!verdict?.results?.length) return '';
    const fixed = new Set(fixedNames);
    const lines = verdict.results.map(r => {
        if (r.implemented) return `✅ ${r.name}`;
        if (fixed.has(r.name)) return `🔧 ${r.name} — ${lang === 'ar' ? 'كان ناقصاً وأُصلح تلقائياً' : 'was missing, auto-fixed'}`;
        return `⚠️ ${r.name} — ${lang === 'ar' ? 'غير مكتمل' : 'incomplete'}${r.reason ? ` (${r.reason.slice(0, 80)})` : ''}`;
    });
    const header = lang === 'ar' ? '📋 **تحقق متطلبات المشروع:**' : '📋 **Project requirements check:**';
    return `${header}\n${lines.join('\n')}`;
}
