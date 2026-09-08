/**
 * 🧭 stages/understand.js — الفهم: ذاكرةُ المشروع/الملفُّ الشخصيّ ← مخطّطُ
 * التطبيق ← نموذجُ المجال. لا تفشل أبداً (كلُّ خطوةٍ باحتياطها)؛ تُرجع الهدفَ
 * المُثرى وسياقاتِ الحقن.
 *
 * ثاني طريقةٍ تخرج من `JaolaCognitiveRuntime` (JCR/5) بالقياس نفسِه: لا تلمس
 * من `this` إلّا البثَّ (٢ `emitLiveLog`)، ومستدعيها واحد (`_runMissionNow`)،
 * وسبعةٌ من استيراداتها الثلاثةَ عشرَ لا يستعملها غيرُها في `jcr` — قِيست هذه
 * المرّةَ قبل النقل لا بعده. نقلٌ حرفيّ: `this.emitLiveLog` → `reporter.liveLog`.
 *
 * تعيش في `agents/stages/`: تستورد من `agents/` وحدَها. `jcr._understandGoal`
 * مفوِّضٌ من سطر — فالمستدعي والاختباراتُ التي تستبدله على النسخة
 * (`s.rt._understandGoal = …`) لم تتغيّر.
 */
import { buildMemoryContext, updateStructure, setDomainModel, getDomainModel } from '../projectMemory.js';
import { deriveProjectModel, mergeProjectModel, buildProjectModelContext, summarizeModel, goalFidelity, headingEntityNames, articleEntityNames, normalizeProjectModel } from '../projectModel.js';
import { getLibraryModel } from '../modelLibrary.js';
import { buildProfileContext } from '../userProfile.js';
import { isExplicitNewBuild } from '../textNormalizer.js';
import { generateBlueprint, buildBlueprintContext } from '../appBlueprint.js';
import { matchBlueprint, referenceModel } from '../referenceBlueprints.js';

export async function understandGoal(goal, ctx, reporter) {
    const { username, activeProject, roomName } = ctx;
    // 🆕 دمج Project Memory + User Profile في سياق الهدف
    const memoryContext = buildMemoryContext(username, activeProject);
    const profileContext = buildProfileContext(username);
    const enrichedGoal = (memoryContext || profileContext)
        ? `${goal}\n${memoryContext}${profileContext}`
        : goal;

    // 🧭 App Blueprint — يفهم نوع التطبيق ومكوّناته الوظيفية (أول وأهم خطوة)
    // يمنع تحويل كل شيء لبروشور ويضمن بناء ميزات عاملة (بحث/فلترة/حجز...)
    let blueprintContext = '';
    let blueprint = null;
    try {
        blueprint = await generateBlueprint(goal);
        blueprintContext = buildBlueprintContext(blueprint);
        const kindLabel = { webapp: 'تطبيق تفاعلي', tool: 'أداة', landing: 'صفحة هبوط', brochure: 'موقع تعريفي' }[blueprint.kind] || blueprint.kind;
        reporter.liveLog(roomName, 'BLUEPRINT', 'AppAnalyzer',
            `🧭 ${blueprint.appType} — ${kindLabel}${blueprint.functionalComponents?.length ? ` (${blueprint.functionalComponents.length} مكوّن وظيفي)` : ''}`);

        // تحديث ذاكرة المشروع بأقسام المخطط الحقيقية — يمنع بقاء أقسام قديمة
        // خاطئة في تقرير التسليم (كانت تظهر أقسام طبية لمشروع طيران)
        if (blueprint.keySections?.length) {
            updateStructure(username, activeProject, blueprint.keySections,
                (blueprint.functionalComponents || []).map(c => c.name));
        }
    } catch (e) { console.warn('[ProjectMemory]', 'فشل تحديث هيكل المشروع:', e.message); }

    // 🧩 نموذج المشروع (طبقة الفهم) — يستخلص كيانات + أدوار + تدفّقات،
    // يُدمج مع النموذج المحفوظ (فهم متراكم لا يُستبدل)، ويُحقن في التوليد
    // ليبني الفريق على نظام متماسك لا على تخمين. لا يفشل أبداً (احتياطي مفيد).
    let domainModelContext = '';
    try {
        // 📚 بذرة من مكتبة النماذج: فهم فئة المشروع المتراكم عبر كل المشاريع
        // السابقة الناجحة — فلا نبدأ من الصفر. الأولوية: المشروع نفسه > اشتقاق
        // هذه الجولة > مكتبة الفئة العامة.
        const seed = getLibraryModel(blueprint?.category);
        // 🧠 المعرفةُ المرجعيّة (PM/1): مجالٌ معروف في الطلب (تاكسي، توصيل طعام…) يبذر
        // أدوارَه أوّلاً — فيوجد فهمٌ حتى بلا نموذجٍ لغويّ، ويُقارَن به الكلونُ لا بالكلمات.
        const reference = matchBlueprint(goal);
        const refModel = referenceModel(reference);
        const derived = await deriveProjectModel(goal, blueprint);
        const prior = getDomainModel(username, activeProject);
        // 🆕 بناء بهوية جديدة («ابني متجر عطور») يستبدل النموذج القديم — لا يدمجه،
        // كي لا يرث المتجر أدوار مشروع سابق (TeamMember/Driver) فيبني الشيء الخطأ.
        const newIdentity = isExplicitNewBuild(goal);
        let model = seed ? mergeProjectModel(seed, derived) : derived;
        if (refModel) model = mergeProjectModel(refModel, model); // المرجعُ أوّلاً كي لا تُسقطه سقوفُ التطبيع
        if (prior && !newIdentity) model = mergeProjectModel(model, prior);

        // ⚠️ PM/22 — الفهمُ الذي لا يمسّ الطلبَ لا يُبتلع صامتاً.
        //
        //    قِيس في `from0`: طُلب متتبّعُ حفظِ قرآن فخرج `Student/Teacher/Parent/Grade/ForumPost`،
        //    ولم يرَ صاحبُ المشروع في السجلّ إلّا «🧩 نموذج المشروع: ٥ كيان…» — سطرَ إنجازٍ لا
        //    سطرَ تحذير. فما أخفاه السطرُ أنّ **لا اسمَ واحداً** من الخمسة له أثرٌ في وصفه.
        //
        // 🏷️ PM/23 — وحين تكون للطلب **عناوينُ بنودٍ مرقّمة**، لا نكتفي بالقول: نُسمّي بها.
        //
        //    كُتب في PM/22 أنّ الاستبدال يحتاج تحليلاً صرفيّاً، لأنّ كلماتِ المتن بالتكرار تخلط
        //    صدقاً بضوضاء (نحوُ ٥٠٪ نظيفة). ثمّ قِيس أنّ الإشارةَ في مكانٍ آخر: **رأسُ كلِّ عنوان**
        //    يكتبه صاحبُ المشروع اسماً لا فعلاً، مجرّداً من لواصق الضمائر — **١٨/١٩ (٩٥٪)** على
        //    ستِّ مواصفات. فالاستبدالُ هنا مقيسٌ لا مُرتجَل.
        //
        //    ولا يقع إلّا حين يكون الفهمُ **بلا أثرٍ في الطلب أصلاً**: بديلٌ ٩٥٪ نظيف خيرٌ من فهمٍ
        //    قِيس أنّه فهمُ منتجٍ آخر. وما دون ذلك يبقى كما هو — لا نُصلح ما لم يُقَس كسرُه.
        //    وحدٌّ مكتوب: العناوينُ تسمّي **كياناتٍ** لا أدواراً، فالأدوارُ تسقط ولا تُختلق.
        //
        // 🏷️ PM/24 — ومصدرٌ ثانٍ للتسمية حين لا عناوين: **أداةُ التعريف**.
        //    الطلبُ القصير بلا بنودٍ مرقّمة، وقِيس أنّ كلماتِه بالتكرار ٤٤٪ نظيفة فقط (أفعالٌ
        //    ولواصقُ ضمائر). و«ال» لا تدخل على فعل — فهي وحدَها، بإسقاط صفةِ النسبة، **٩٦٪**.
        //    العناوينُ أوّلاً لأنّها أدقُّ وأوسعُ أثراً؛ والأداةُ حين تعوزنا العناوين.
        const fidelity = goalFidelity(model, goal);
        let renamed = null;
        if (fidelity.ungrounded) {
            const heads = headingEntityNames(goal);
            const names = heads.length >= 2 ? heads : articleEntityNames(goal);
            if (names.length >= 2) {
                renamed = names;
                model = normalizeProjectModel({
                    entities: names.map(name => ({ name })), roles: [], flows: [], _source: 'headings',
                });
            }
        }

        setDomainModel(username, activeProject, model);
        domainModelContext = buildProjectModelContext(model);
        reporter.liveLog(roomName, 'MODEL', 'DomainAnalyst',
            `🧩 نموذج المشروع: ${summarizeModel(model)}${newIdentity ? ' (هوية جديدة — استُبدل النموذج القديم)' : seed ? ' (مبذور من مكتبة الفئة)' : ''}${refModel ? ` (مرجع: ${reference.label})` : ''}`);
        if (fidelity.ungrounded) {
            const gone = `لا أثرَ في وصفِك لـ${fidelity.groundless.slice(0, 5).join('، ')}${fidelity.groundless.length > 5 ? '…' : ''}`;
            reporter.liveLog(roomName, 'MODEL', 'DomainAnalyst', renamed
                ? `⚠️ فهمي لم يمسّ طلبَك (${gone}) — فطرحتُه وبنيتُ على عناوينك أنت: ${renamed.join('، ')}.`
                : `⚠️ فهمي لا يمسّ طلبَك: ${gone} — أبني عليه وأنا غيرُ واثقٍ منه، ولن أُودِعه ذاكرةَ الفئة.`);
        }
    } catch (e) { console.warn('[ProjectModel]', 'فشل استخلاص نموذج المشروع:', e.message); }
    return { enrichedGoal, blueprint, blueprintContext, domainModelContext };
}
