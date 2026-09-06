/**
 * 🧭 stages/selectBuildStrategy.js — اختيارُ استراتيجيّة البناء قبل النواة: Registry (صفحة تسويقيّة من بلوكات) / Clone (تطبيقٌ
 * عامل مطابق) / React-Next (مشروعٌ كبير جديد) بحماياتها الثلاث المولودة من أعطالٍ إنتاجيّة (الاستئنافُ لا يُقرأ إعادةَ بناء ولا
 * يُطابَق كلوناً؛ تطبيقٌ قائمٌ **يعمل** لا يُستبدل بصفحة هبوطٍ ولا بكلونٍ دون «أعد البناء» صريحة)، وإلّا `null` = النواةُ الافتراضيّة.
 * أيُّ قيمةٍ غير `null` هي نتيجةُ المهمّة النهائيّة.
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/29 بالمنهج نفسِه: `this` = البثُّ (٥ + ٢) + ثلاثةُ بناةٍ (`_buildFromRegistry`/`_buildFromClone`/
 * `_buildReactProject` — تستبدلها الاختباراتُ على النسخة → `ops`) + قراءةٌ واحدة لتلميح المسار `trackByRoom` (خريطةٌ على النسخة يكتبها
 * `handleUserMessage`) → `ops.trackOf(roomName)` دالّةً مربوطة، لا كائنَ جديد (على سابقة شقّ `gate` في JCR/26) + القارئُ `readCodeContext`
 * يُستورد. لا `io`. مستدعٍ واحد (`_runMissionNow`). نقلٌ حرفيّ.
 */
import { getUserLanguage } from '../languageDetector.js';
import { getProjectMemory, getDomainModel } from '../projectMemory.js';
import { matchCloneTemplateDetailed } from '../cloneTemplates/index.js';
import { resolveStack } from '../starterRegistry.js';
import { isMarketingPageGoal } from '../blockRegistry.js';
import { analyzeProjectStatic } from '../behaviorVerifier.js';
import { transitionState, STATES } from '../stateMachine.js';
import { isExplicitRebuild, isExplicitNewBuild, isContinuationGoal } from '../textNormalizer.js';
import { readCodeContext } from '../projectReader.js';
import { resolveProjectType } from './enrich.js';

// 🧭 اختيار استراتيجية البناء: Registry (صفحة تسويقية) / Clone (تطبيق مطابق) /
// React (مشروع كبير جديد) بحماياتها (استئناف، «يعمل فعلاً» → لا استبدال)،
// وإلا null ← النواة. أي قيمة غير null هي نتيجة المهمة النهائية.
// المُبلِّغُ يُمرَّر؛ البناةُ الثلاثة عبر `ops` (تستبدلها الاختبارات على النسخة)؛ تلميحُ المسار (`site`/`system`) عبر `ops.trackOf`
// دالّةً مربوطةً بخريطة النسخة؛ القارئُ `readCodeContext` يُستورد (لا اختبارَ يستبدل مفوِّضَه).
export async function selectBuildStrategy(goal, blueprint, ctx, reporter, ops) {
    const { projectPath, username, activeProject, roomName } = ctx;
    // «بناء جديد» = لا شفرة قائمة تُذكر (< 80 حرفاً). تُحسب مرة واحدة: لا مسار
    // أدناه يكتب على القرص قبل أن يُرجع نتيجته، فالقراءة الثانية كانت تكراراً.
    const existingCtx = await readCodeContext(projectPath).catch(() => '');
    const isFreshBuild = !existingCtx || existingCtx.trim().length < 80;

    // 🍔 كلون عامل — للتطبيقات المعقّدة المطابقة نبدأ من *تطبيق يعمل فعلاً*
    // (يجتاز التحقّق السلوكي) بدل التوليد من الصفر الذي يفشل (app.js لا يُكتب،
    // أدوار ناقصة)، ثم نضع البصمة. هذا يضمن أن يعمل مشروع التوصيل من أول مرة.
    try {
        // 🛡️ استئناف («اكمل») على مشروع قائم = تطوير الموجود حصراً — لا
        // إعادة بناء ولا كلون يستبدله ولا هوية جديدة، مهما احتوى نصّ الهدف.
        // (عطل إنتاجي: «لا تبدأ من الصفر» طابقت «من الصفر» فدهست المشروع.)
        const continuation = isContinuationGoal(goal);
        const explicitRebuild = !continuation && (isExplicitRebuild(goal) || isExplicitNewBuild(goal));

        // 🧱 صفحة تسويقيّة/تعريفيّة (هبوط/بروشور/بورتفوليو/شركة) → إعادة تركيب من
        // JAOLA Registry: صفحة *كاملة واحترافية* من بلوكات جاهزة، لا توليد هشّ.
        if (isMarketingPageGoal(goal, blueprint) && (isFreshBuild || explicitRebuild)) {
            // 🛡️ تطبيق قائم *يعمل* لا يُستبدل بصفحة هبوط ثابتة بجملة بناء عادية
            // («صمم تطبيق عرض صور لمطعم...») — مسار الكلونات يملك هذه الحماية
            // (worksNow → لا نكلبره) وهذا المسار كان بلا مثيلها فدهس تطبيق
            // test-edit2 التفاعلي بصفحة أقسام جاهزة (عطل إنتاجي حقيقي).
            // الاستبدال يبقى ممكناً بطلب إعادة بناء صريح («أعد البناء/من الصفر»).
            if (!isFreshBuild && !isExplicitRebuild(goal)) {
                const chk = await analyzeProjectStatic({
                    projectPath, domainModel: getDomainModel(username, activeProject),
                }).catch(() => null);
                const worksNow = chk?.hasProject && !chk.checks.some(c => c.status === 'fail');
                if (worksNow) {
                    const lang = getUserLanguage(username);
                    reporter.liveLog(roomName, 'STACK', 'JaolaRegistry',
                        'ℹ️ المشروع القائم يعمل — لا يُستبدل بصفحة تسويقية دون «أعد البناء» صريحة.');
                    reporter.send(roomName, 'chat_reply', {
                        message: lang === 'en'
                            ? '✅ Your current app is working, so I won\'t replace it with a static marketing page. Tell me a specific change to add to it, or type "rebuild" if you really want to start over as a landing page.'
                            : '✅ تطبيقك الحالي يعمل، فلن أستبدله بصفحة تسويقية ثابتة. أخبرني بتعديل محدّد أضيفه إليه، أو اكتب «أعد البناء» إن كنت تريد فعلاً البدء من جديد كصفحة هبوط.',
                    });
                    transitionState(username, activeProject, STATES.COMPLETED);
                    return { success: true, skipped: 'works' };
                }
            }
            return await ops.buildFromRegistry(goal, ctx);
        }

        const pick = (continuation && !isFreshBuild)
            ? { clone: null, rejected: [] } // الاستئناف يكمل الموجود عبر المسار التزايدي — لا استبدال بالقالب
            : matchCloneTemplateDetailed(goal, blueprint, getDomainModel(username, activeProject),
                { track: ops.trackOf(roomName) });
        const clone = pick.clone;
        // 🧠 الفهمُ يُقال (PM/1): ما استُبعد ولماذا، وما اختير وبأيّ دليل — لا اختيارَ صامت.
        if (pick.rejected.length) {
            reporter.liveLog(roomName, 'STACK', 'ProductMind',
                `🧠 استُبعد بالفهم: ${pick.rejected.slice(0, 4).map(r => `${r.id} (بلا ${r.missingRoles.join('/')})`).join('، ')}${pick.rejected.length > 4 ? ` +${pick.rejected.length - 4}` : ''}`);
        }
        if (clone) {
            const why = clone.matchReason || {};
            reporter.liveLog(roomName, 'STACK', 'ProductMind',
                `🧠 اختيارٌ بالفهم: ${clone.id} — ${why.reason === 'model-only' ? 'نموذجُ المنتج مطابق بلا كلمات' : `كلمات: ${(why.hits || []).join('/') || '—'}`}${why.roleCoverage !== null && why.roleCoverage !== undefined ? `، الأدوار ${Math.round(why.roleCoverage * 100)}٪` : ''}`);
            // نبدأ من الكلون العامل إن: (أ) بناء جديد/هوية جديدة، أو (ب) إعادة بناء
            // صريحة، أو (ج) المشروع القائم معطّل فعلاً (نُصلح المكسور).
            let apply = isFreshBuild || explicitRebuild;
            let worksNow = false;
            if (!apply) {
                const chk = await analyzeProjectStatic({
                    projectPath, domainModel: getDomainModel(username, activeProject),
                });
                // 🧠 فجوةُ الأدوار ليست عطلاً (PM/1): مشروعٌ يعمل لكنّه لا يغطّي كلَّ أدوار الفهم لا
                // يُدهَس بكلونٍ دون «أعد البناء» صريحة — الفهمُ يُقال، والقرارُ للمستخدم (الحكمُ في PM/2).
                const fails = chk.checks.filter(c => c.status === 'fail');
                const roleGap = fails.find(c => c.name === 'role-coverage');
                const broken = !chk.hasProject || fails.some(c => c.name !== 'role-coverage');
                worksNow = chk.hasProject && !broken;
                apply = broken;
                if (worksNow && roleGap) reporter.liveLog(roomName, 'STACK', 'ProductMind', `🧠 يعمل لكنّه لا يغطّي كلَّ الأدوار — ${roleGap.detail}`);
            }
            if (apply) {
                return await ops.buildFromClone(clone, goal, ctx);
            }
            // 🛡️ المشروع القائم يعمل وليس طلب إعادة بناء صريح → لا نُعيد البناء
            // الكامل (كان مسار Vanilla يدهس الكلون العامل عند «اكمل»). نُبلغ
            // ونتوقّف — التعديلات المحدّدة تمرّ عبر التعديل الجراحي.
            if (worksNow) {
                const okMsg = getUserLanguage(username) === 'en'
                    ? '✅ Your app is already working (customer + staff panels with role-based login). Tell me a specific change to add (e.g. "add a ratings section"), or "rebuild" to start fresh.'
                    : '✅ تطبيقك يعمل بالفعل (واجهة الزبون + لوحات الطاقم بدخول موجَّه حسب الصلاحية). أخبرني بتعديل محدّد لإضافته (مثل: «أضف قسم تقييمات»)، أو اكتب «أعد البناء» للبدء من جديد.';
                reporter.send(roomName, 'chat_reply', { message: okMsg });
                transitionState(username, activeProject, STATES.COMPLETED);
                reporter.liveLog(roomName, 'STACK', 'CloneTemplate', 'ℹ️ المشروع يعمل — تفادينا إعادة بناء تدهسه.');
                return { success: true, skipped: 'works' };
            }
            reporter.liveLog(roomName, 'STACK', 'CloneTemplate', 'ℹ️ يوجد كلون مطابق لكن المشروع القائم يعمل — لا نكلبره.');
        }
    } catch (e) { console.warn('[Clone]', 'تعذّر مطابقة الكلون:', e.message); }

    // 🧰 المسار الهجين — مشروع كبير → React/Next حقيقي بمعاينة حيّة؛ غيره → Vanilla سريع
    try {
        // 🛡️ فئة المخطّط تُعتمد فقط حين تأتي من النموذج — الاحتياط يضع 'business'
        // دائماً فكان يُعطّل الموجّه الهجين (React للمشاريع الكبيرة) كلما غاب الـLLM
        const ptype = resolveProjectType(goal, blueprint);
        const scope = getProjectMemory(username, activeProject)?.plan?.scope || '';
        const stack = resolveStack({ projectType: ptype, scope });
        // 🔴 كان يُختار هنا قالبٌ من السجلّ (`selectStarter`) ويُمرَّر إلى البناء
        //    ثمّ يُسمَّى للمستخدم: «قالب: Next.js SaaS + Stripe». ولم يكن يُقرأ
        //    في البناء إطلاقاً — `generateNextScaffold` لا يستقبل قالباً أصلاً.
        //    مقيسٌ لا مفترَض: من خصائص ذلك القالب الأربع (subscriptions/auth/
        //    stripe/dashboard) **صفرٌ** في السبعة عشر ملفاً المُسلَّمة. فكان
        //    المستخدمُ يُخبَر أنّ مشروعه مبنيٌّ على قالبِ اشتراكاتٍ وStripe،
        //    فيبني عليه توقّعاً كاذباً. والمسارُ يُقرّره `resolveStack` وحدَه.
        //    حين يُجلب قالبٌ حقيقيّ فعلاً (عبر `fetchStarter`) يعود ذكرُه هنا.
        if (stack === 'react-next' && isFreshBuild) {
            reporter.liveLog(roomName, 'STACK', 'HybridRouter', '🧰 مشروع كبير → React/Next');
            return await ops.buildReactProject(goal, ctx, {
                sections: blueprint?.keySections || [],
            });
        }
        reporter.liveLog(roomName, 'STACK', 'HybridRouter', '🧰 مسار سريع → Vanilla');
    } catch (e) { /* اختياري — نُكمل بالمسار الافتراضي */ }
    return null; // لا استراتيجية خاصة → النواة (Vanilla) على الهدف المُثرى
}
