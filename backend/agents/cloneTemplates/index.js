/**
 * 📚 سجلّ قوالب الكلون العاملة — تطبيقات كاملة تعمل فعلاً، لا توليد من الصفر.
 * كل مشروع معقّد يبدأ من كلون مطابق (يجتاز التحقّق السلوكي)، ثم يخصّصه الذكاء.
 */
import { foodDeliveryClone } from './foodDelivery.js';
import { jaolaWeather } from './jaolaWeather.js';
import { jaolaCrypto } from './jaolaCrypto.js';
import { jaolaStore } from './jaolaStore.js';
import { jaolaBooking } from './jaolaBooking.js';
import { jaolaRealestate } from './jaolaRealestate.js';
import { jaolaCurrency } from './jaolaCurrency.js';
import { jaolaMarketplace } from './jaolaMarketplace.js';
import { jaolaTaxi } from './jaolaTaxi.js';
import { jaolaTravel } from './jaolaTravel.js';
import { jaolaLms } from './jaolaLms.js';
import { jaolaSchool } from './jaolaSchool.js';
import { jaolaEvents } from './jaolaEvents.js';
import { jaolaErp } from './jaolaErp.js';
import { jaolaClinic } from './jaolaClinic.js';
import { jaolaHr } from './jaolaHr.js';
import { jaolaPos } from './jaolaPos.js';
import { jaolaRestaurantOps } from './jaolaRestaurantOps.js';
import { jaolaPharmacy } from './jaolaPharmacy.js';
import { jaolaProperty } from './jaolaProperty.js';
import { jaolaCinema } from './jaolaCinema.js';
import { jaolaWorkshop } from './jaolaWorkshop.js';
import { jaolaGym } from './jaolaGym.js';
import { jaolaAccounting } from './jaolaAccounting.js';
import { jaolaSalon } from './jaolaSalon.js';
import { jaolaWarehouse } from './jaolaWarehouse.js';
import { jaolaHotel } from './jaolaHotel.js';
import { jaolaLaundry } from './jaolaLaundry.js';
import { jaolaCarRental } from './jaolaCarRental.js';
import { jaolaLawfirm } from './jaolaLawfirm.js';
import { jaolaCoworking } from './jaolaCoworking.js';
import { jaolaHelpdesk } from './jaolaHelpdesk.js';
import { jaolaPhotography } from './jaolaPhotography.js';
import { jaolaFleet } from './jaolaFleet.js';
import { jaolaTutoring } from './jaolaTutoring.js';
import { jaolaVetClinic } from './jaolaVetClinic.js';
import { jaolaVetClinicReact } from './jaolaVetClinicReact.js';
import { jaolaCleaning } from './jaolaCleaning.js';
import { jaolaCryptoAdvisor } from './jaolaCryptoAdvisor.js';
import { jaolaBudgetAdvisor } from './jaolaBudgetAdvisor.js';
import { jaolaStockAdvisor } from './jaolaStockAdvisor.js';
import { modelAffinity, conceptOf } from '../projectModel.js';
import { isLatin, arabicMatcher, latinMatcher } from '../keywordMatch.js';
import { specHead, numberedSections } from '../textNormalizer.js';

// كل قوالب jaola المتاحة (تُبنى مرة عند الحاجة)
const BUILDERS = [foodDeliveryClone, jaolaStore, jaolaBooking, jaolaRealestate, jaolaMarketplace, jaolaTaxi, jaolaTravel, jaolaEvents, jaolaLms, jaolaSchool, jaolaWeather, jaolaCrypto, jaolaCurrency, jaolaErp, jaolaClinic, jaolaHr, jaolaPos, jaolaRestaurantOps, jaolaPharmacy, jaolaProperty, jaolaCinema, jaolaWorkshop, jaolaGym, jaolaAccounting, jaolaSalon, jaolaWarehouse, jaolaHotel, jaolaLaundry, jaolaCarRental, jaolaLawfirm, jaolaCoworking, jaolaHelpdesk, jaolaPhotography, jaolaFleet, jaolaTutoring, jaolaVetClinic, jaolaCleaning, jaolaVetClinicReact, jaolaCryptoAdvisor, jaolaBudgetAdvisor, jaolaStockAdvisor];

// 🧭 مساران منفصلان: «موقع» (لزوّار) و«سيستم داخلي» (أداة عمل) — طلب
// سيستم لا يُقفز أبداً لقالب متجر (عطل photo-test الحقيقي: طلب نظام
// مصنع فبُني متجر منتجات). القوالب بلا track تُعامل كمواقع.
const SYSTEM_INTENT_RE = /سيستم|نظام\s*(?:داخلي|إداري|ادار|إدار|محاسب|عيادة|مركز|موارد|موظف|مطعم|نقطة|كاشير|مبيعات|مخزون|فوترة|مساعدة)|إدارة\s*(?:مصنع|منشأة|منشاة|مستودع|مخزون|ورشة|عيادة|موظف|موارد|مطعم)|ادارة\s*(?:مصنع|منشأة|منشاة|مستودع|مخزون|ورشة|عيادة|موظف|موارد|مطعم|صيدلية|عقار|إيجار|ايجار)|منصرفات|نقطة\s*بيع|كاشير|موارد\s*بشرية|شؤون\s*موظف|رواتب|حضور\s*وانصراف|شاشة\s*مطبخ|تشغيل\s*مطعم|صيدلية|صرف\s*دواء|صلاحية\s*الدواء|إدارة\s*عقارات|ادارة\s*عقارات|تحصيل\s*إيجار|تحصيل\s*ايجار|مستأجر|ورشة\s*سيارات|إصلاح\s*سيارات|صيانة\s*سيارات|بطاقة\s*عمل|بطاقات\s*عمل|قطع\s*غيار|محاسبة|قيد\s*يومية|قيود\s*يومية|دفتر\s*أستاذ|ميزان\s*مراجعة|دليل\s*حسابات|مدين\s*دائن|مستودع|مستودعات|مخازن|شحنات|شحنة\s*واردة|شحنة\s*صادرة|استلام\s*شحنة|صرف\s*شحنة|لوجستيات|حركة\s*مخزون|رفوف\s*تخزين|مغسلة|مغاسل|غسيل\s*ملابس|تنظيف\s*جاف|مكتب\s*محاماة|محاماة|أتعاب\s*محاماة|شؤون\s*قانونية|تذاكر\s*دعم|دعم\s*فني|مركز\s*مساعدة|مساعدة\s*داخلية|طلبات\s*(?:ومشاكل\s*)?الموظفين|مشاكل\s*الموظفين|أسطول\s*مركبات|إدارة\s*أسطول|ادارة\s*أسطول|صيانة\s*مركبات|عيادة\s*بيطرية|طبيب\s*بيطري|تحليل\s*(?:فني|كريبتو|عملات\s*رقمية)|توصيات?\s*(?:تداول|شراء\s*وبيع|استثمار)|إشارات?\s*(?:تداول|شراء|بيع)|مستشار\s*(?:كريبتو|تداول)|\b(?:erp|pos|hr|kds|pharmacy|garage|accounting|ledger|warehouse|logistics|shipment|laundry|law\s*firm|help\s*desk|helpdesk|ticketing|fleet|veterinary|vet\s*clinic|crypto\s*advisor|trading\s*signal)\b|internal\s+(?:system|help\s*desk)|management\s+system/i;

/** يستنتج المسار من نص الطلب حين لا يُمرَّر صراحة. */
export function inferTrack(goal = '') {
    return SYSTEM_INTENT_RE.test(String(goal)) ? 'system' : null;
}

/** بيانات وصفية للعرض (لوحة «معرفة المنصّة») — بلا محتوى الملفات الثقيل. */
export function listClones() {
    return BUILDERS.map(b => {
        const c = b();
        return {
            id: c.id, name: c.name, category: c.category, description: c.description,
            nameEn: c.nameEn || c.name, descriptionEn: c.descriptionEn || c.description,
            roles: (c.model?.roles || []).map(r => r.name),
            files: c.files.map(f => f.name),
            externalApi: c.externalApi || null,
        };
    });
}

/**
 * يختار أنسب كلون لمشروع (أو null). المطابقة بالكلمات المفتاحية في الهدف +
 * فئة المخطّط. مخصّص للتطبيقات التفاعلية فقط (لا البروشورات).
 */
export function matchCloneTemplate(goal = '', blueprint = null, domainModel = null, opts = {}) {
    return matchCloneTemplateDetailed(goal, blueprint, domainModel, opts).clone;
}

// 🏷️ PM/11: كلماتُ المسار العامّة — ما لا يسمّي منتجاً. كان `isTrackPhrase` يقرأ `SYSTEM_INTENT_RE` كلَّه (وهو كاشفُ
// المسار، يحوي أسماءَ منتجات السيستم: كاشير، نقطة بيع، صيدلية، محاسبة…) فابتلع ١١٦ من ٦٤٦ كلمةَ كلون — كلَّ ما يسمّي
// به المستخدمُ منتجَ سيستم — فلم يكن اسمُ المنتج يرفع الفيتو قطّ، وترفعه كلمةٌ عابرة («وردية»، «إيصال»).
const TRACK_WORDS = new Set(['سيستم', 'نظام', 'داخلي', 'داخلية', 'إداري', 'اداري', 'إدارة', 'ادارة', 'internal', 'system', 'management']);
/** عبارةُ مسارٍ لا منتج: لا يبقى منها شيءٌ بعد كلمات المسار العامّة («نظام إدارة»، «سيستم داخلي»)؛ «إدارة مصنع» تسمّي منتجاً. */
export function isTrackPhrase(keyword = '') {
    const words = String(keyword).toLowerCase().split(/[\s\u0640]+/).filter(Boolean);
    return words.length > 0 && words.every(w => TRACK_WORDS.has(w));
}

// 🔤 PM/11: الكلمةُ كلمةٌ كاملة بحدودها (`keywordMatch`) لا نصّاً فرعيّاً — «جرد» كانت تُصيب «مجرد» فتختار ERP لرأس وثيقة
// نقاط البيع. مُطابِقٌ واحد لكلِّ كلمة يُبنى مرّةً.
const KW_RE = new Map();
function kwMatcher(k) {
    let re = KW_RE.get(k);
    if (!re) { re = isLatin(k) ? latinMatcher(k) : arabicMatcher(k); KW_RE.set(k, re); }
    return re;
}
/** كم بنداً مرقّماً يجعل النصَّ وثيقةً تُقرأ تسميةُ منتجها من رأسها لا من متنها. */
const NAMING_MIN_SECTIONS = 3;

/**
 * 🧠 الاختيارُ بالفهم (PM/1، `PRODUCT_MIND.md`) — يعيد `{ clone, rejected, reason }`.
 *
 * مصادرُ الدليل مرتّبةً: (١) كلماتُ المستخدم التي تسمّي *منتجاً* بعينه (لا عباراتُ المسار)؛
 * (٢) نموذجُ الفهم (أدوار/كيانات) مقارَناً بنموذج كلِّ كلون؛ (٣) الفئةُ والكلماتُ العامّة ترجيحاً فقط.
 * - **الفيتو**: كلونٌ لا يغطّي دوراً من أدوار الفهم يُستبعد — إلّا إن سمّى المستخدمُ منتجَه صراحةً
 *   (كلماتُه الحرفيّة تغلب نموذجاً مُهلوَساً). «نظام إدارة» ليست تسميةَ منتج فلا ترفع الفيتو:
 *   طلبُ تاكسي لن يصير ERP بسبب هذه العبارة (العطبُ الأصل).
 * - **الترتيب**: كما كان (كلمة ١٠، فئة ٢) + قربُ النموذج (≤ ٨) فيَحسم بين المتعادلين.
 * - **الفهمُ وحده**: بلا كلماتٍ أصلاً، كلونٌ يغطّي كلَّ الأدوار (دورَين فأكثر) ويشارك كياناً واحداً
 *   على الأقلّ، ولا منافسَ له، يُختار. البوّابةُ القديمة (كلمة + مجموع ≥ ٢) تبقى للمسار المعتاد.
 */
export function matchCloneTemplateDetailed(goal = '', blueprint = null, domainModel = null, opts = {}) {
    const category = blueprint?.category;
    const isApp = blueprint?.kind === 'webapp' || blueprint?.kind === 'tool'
        || (Array.isArray(domainModel?.roles) && domainModel.roles.length > 1);
    if (!isApp) return { clone: null, rejected: [], reason: 'not-app' }; // البروشورات لا تحتاج كلون تطبيق

    // 🧭 المسار: صريح من زر الواجهة، وإلا من كلمات الطلب. سيستم → قوالب
    // السيستم حصراً (أو لا شيء = بناء حر)، موقع → لا قوالب سيستم.
    const track = opts.track || inferTrack(goal);
    const inTrack = (c) => track === 'system' ? c.track === 'system' : c.track !== 'system';

    // نصّان منفصلان: كلمات المستخدم الحرفية (الهدف) هي الحقيقة الأرضية،
    // وأسماء النموذج المحفوظ سند ثانوي فقط — نموذج مُهلوَس (Student/Grade
    // على طلب «موقع فعاليات») كان يقلب الاختيار لقالب لا علاقة له بالطلب.
    const goalHay = String(goal || '').toLowerCase();
    // 🏷️ PM/11: وثيقةٌ مرقّمة تسمّي منتجَها في رأسها — كلمةٌ في المتن (بند «الطباعة: … إيصال») ترجّح ولا ترفع الفيتو.
    const isDoc = numberedSections(goal) >= NAMING_MIN_SECTIONS;
    const namingHay = isDoc ? specHead(goal).toLowerCase() : goalHay;
    const modelHay = [
        ...(domainModel?.entities || []).map(e => e?.name),
        ...(domainModel?.roles || []).map(r => r?.name),
        ...(domainModel?.flows || []).map(f => f?.name),
    ].filter(Boolean).join(' ').toLowerCase();

    let best = null, bestRaw = 0, bestRank = 0, bestKw = 0, bestWhy = null;
    const rejected = [];
    const byModel = []; // مرشّحو «الفهم وحده»
    for (const build of BUILDERS) {
        const c = build();
        if (!inTrack(c)) continue;
        let raw = 0, kwHits = 0, explicit = false;
        const hits = [];
        if (category && c.category === category) raw += 2;
        for (const kw of c.keywords || []) {
            const k = kw && kw.toLowerCase();
            if (!k) continue;
            const re = kwMatcher(k);
            if (re.test(goalHay)) { raw += 10; kwHits += 1; hits.push(kw); if (!isTrackPhrase(kw) && re.test(namingHay)) explicit = true; } // كلمة المستخدم تحسم
            else if (re.test(modelHay)) { raw += 1; kwHits += 1; }
        }
        const affinity = modelAffinity(domainModel, c.model);
        if (affinity.substantive && affinity.roleCoverage !== null && affinity.roleCoverage < 1 && !explicit) {
            rejected.push({ id: c.id, missingRoles: affinity.missingRoles });
            continue;
        }
        // 🏷️ PM/11: ما يسمّيه المستخدمُ في **رأس** وثيقته يغلب كلمةً في متنها. كان الوزنُ متساوياً،
        //    فوثيقةٌ رأسُها «أريد بناء صيدلية» وبنودُها تذكر «الفواتير» يحسمها ترتيبُ البُناة لا الرأس.
        //    (قِيس حين أوقعَ الفيتوُ الجديدُ مطابقةً صحيحة: المرشّحُ الفائز لم يكن المسمَّى في الرأس.)
        const rank = raw + Math.round(affinity.score * 8) + (explicit ? 5 : 0);
        if (rank > bestRank) { bestRank = rank; bestRaw = raw; best = c; bestKw = kwHits; bestWhy = { hits, explicit, affinity }; }
        // الفهمُ وحده: دورانِ فأكثر كلُّها مغطّاة + كيانٌ مشترك واحد على الأقلّ (نماذجُ الكلونات جزئيّة:
        // كلونُ التاكسي يذكر Ride/Zone لا Vehicle/Fare — فالنسبةُ ظالمة والعددُ صادق).
        if (affinity.substantive && affinity.roleCoverage === 1 && affinity.missingRoles.length === 0
            && affinity.sharedEntities.length >= 1 && conceptCount(domainModel?.roles) >= 2) {
            byModel.push({ c, affinity });
        }
    }
    // 🛡️ دليل كافٍ = كلمة مفتاحية واحدة على الأقل *إلزامية* + مجموع ≥ 2.
    // الفئة وحدها لا تكفي: تصنيف مهلوس من المخطّط (مثل travel على نظام مخزون)
    // كان يفرض قالباً لا علاقة له بالطلب — عطل إنتاجي حقيقي.
    //
    // 🧭 والكلمةُ العابرة (مقيسٌ من الإنتاج): وثيقةٌ من تسعة بنودٍ تطلب منصّةَ هندسةِ برمجيّات ذكرت
    //    `marketplace` مرّةً في جملةٍ عن مستقبلٍ بعيد («…and an agent marketplace») — فبُني متجر.
    //    وسندُ الاختيار المُسجَّل يفضح نفسَه: `hits:["marketplace"]، roleCoverage:null` — الفهمُ لم
    //    يساهم بشيء. والتمييزُ كان محسوباً ولا يُقرأ: `explicit` لا تُرفع إلّا حين تقع الكلمةُ في
    //    **رأس الوثيقة** حيث يسمّي المستخدمُ منتجَه (PM/11)، وهذه وقعت بعد البنود.
    //
    //    فالشرطُ اجتماعُ ضعفٍ على ضعف: كلمةٌ واحدةٌ لا غير + خارجَ ما يسمّي المستخدمُ به منتجَه +
    //    لا سندَ من نموذج الفهم. وحينها **لا كلون**: البناءُ الحرّ أصدقُ
    //    من قالبٍ لمنتجٍ آخر (والسببُ يُسمّى، فلا يبقى الاختيارُ صندوقاً مغلقاً).
    //    و**شرطُ «وثيقةٌ مرقّمة» أُسقط لأنّه ميّت**: بغير وثيقةٍ يصير `namingHay` هو الهدفَ كلَّه،
    //    فأيُّ إصابةٍ ترفع `explicit` ويسقط الفيتو من تلقائه. (يبقى الطلبُ القصير الذي إصابتُه
    //    الوحيدة **عبارةُ مسار** — «نظام»/«سيستم» — فيُوقَف، وذلك هو المقصود: تلك لا تسمّي منتجاً.)
    //    و`modelBacked` احتياطٌ **غيرُ مقيسٍ مستقلّاً**: كلُّ حالةٍ بُنيت وجدَ فيها شرطُ العدد
    //    (`bestKw < 2`) يسبقه — لأنّ إصابةَ نموذجِ الفهم تُحسب في العدد أيضاً. يبقى مكتوباً ولا يُدَّعى.
    const modelBacked = !!(bestWhy?.affinity?.substantive
        && (bestWhy.affinity.roleCoverage > 0 || (bestWhy.affinity.sharedEntities || []).length > 0));
    const incidental = bestKw >= 1 && bestRaw >= 2 && bestKw < 2
        && !bestWhy?.explicit && !modelBacked;
    if (incidental) return { clone: null, rejected, reason: `incidental-keyword:${(bestWhy?.hits || []).join('/')}` };
    if (bestKw >= 1 && bestRaw >= 2) return { clone: tag(best, 'keywords+model', bestWhy, rejected), rejected, reason: 'keywords+model' };
    byModel.sort((a, b) => b.affinity.score - a.affinity.score);
    if (byModel.length && (byModel.length === 1 || byModel[0].affinity.score > byModel[1].affinity.score)) {
        const { c, affinity } = byModel[0];
        return { clone: tag(c, 'model-only', { hits: [], explicit: false, affinity }, rejected), rejected, reason: 'model-only' };
    }
    return { clone: null, rejected, reason: rejected.length ? 'rejected-by-understanding' : 'no-evidence' };

    function tag(clone, reason, why, rej) {
        clone.matchReason = { reason, hits: why.hits, explicit: why.explicit,
            roleCoverage: why.affinity.roleCoverage, entityOverlap: why.affinity.entityOverlap, rejected: rej.map(r => r.id) };
        return clone;
    }
    function conceptCount(roles) {
        return new Set((roles || []).map(r => conceptOf(r?.name)).filter(Boolean)).size;
    }
}

/** يجلب كلوناً بمعرّفه (للتطبيق المباشر/الاختبار). */
export function getCloneById(id) {
    for (const build of BUILDERS) {
        const c = build();
        if (c.id === id) return c;
    }
    return null;
}
