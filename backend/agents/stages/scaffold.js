/**
 * 🧱 stages/scaffold.js — ثلاثُ مراحلِ تسليمٍ بعد الكتابة: الوحداتُ المتقدّمة (Stripe/Upload/OAuth/Travelpayouts)،
 * سكافولد Full-Stack في `fullstack/`، وتحديثُ ذاكرة المشروع (الهيكل + الهويّة البصريّة).
 *
 * تخرج من `JaolaCognitiveRuntime` في JCR/14 بالمنهج نفسِه: `this` = `emitLiveLog` فقط (وذاكرةُ المشروع
 * بلا بثٍّ أصلاً فلا مُبلِّغَ لها — لا وسيطَ بلا مستهلك). تُستدعى بالاسم من `DELIVERY_STAGES` عبر
 * مفوِّضاتٍ باقيةٍ في jcr. نقلٌ حرفيّ.
 */
import path from 'path';
import { updateDesign, updateStructure } from '../projectMemory.js';
import { generateAdvancedModules } from '../backendAgent.js';
import { recommendFullStack, buildFullStackProject } from '../fullstackTemplates.js';
import { writeProjectFile } from '../../core/runtime/workspacePaths.js';

// 🆕 Advanced Modules — Stripe, Upload, OAuth
export async function runAdvancedModules(context, roomName, reporter) {
    try {
        const advResult = await generateAdvancedModules(context.originalGoal, context.projectPath);
        if (advResult.files.length > 0) {
            for (const file of advResult.files) {
                await writeProjectFile(context.projectPath, file.name, file.content);
            }
            const features = Object.entries(advResult.features)
                .filter(([, v]) => v)
                .map(([k]) => k.replace('needs', ''))
                .join(', ');
            const envNote = advResult.requiredEnv?.length
                ? ` — يتطلّب ضبط: ${advResult.requiredEnv.join('، ')}`
                : '';
            reporter.liveLog(roomName, '5. RUNTIME', 'AdvancedAgent',
                `✅ ${features} (${advResult.files.length} ملف)${envNote}`
            );
        }
    } catch (e) { console.warn('[AdvancedModules]', 'فشل كتابة الوحدات المتقدمة:', e.message); }
}

// 🏗️ Full-Stack Scaffold — للفئات المتقدمة (متجر/حجوزات/عقارات…)
// يُولّد مشروع Next.js + API + Prisma كامل في مجلد fullstack/ بجانب
// الموقع الثابت (لا يتعارض معه) — نقطة انطلاق جاهزة للتشغيل والنشر.
export async function runFullStackScaffold(context, roomName, reporter) {
    try {
        const fsRec = recommendFullStack(
            context.originalGoal, context.blueprint?.category, context.blueprint?.kind
        );
        if (fsRec.fullstack) {
            const { category, files } = buildFullStackProject(fsRec.category, context.activeProject);
            for (const file of files) {
                await writeProjectFile(path.join(context.projectPath, 'fullstack'), file.name, file.content);
            }
            reporter.liveLog(roomName, '5. RUNTIME', 'FullStackAgent',
                `🏗️ نسخة Full-Stack (${category}) في مجلد fullstack/ — Next.js + API + Prisma (${files.length} ملف)`
            );
        }
    } catch (e) { console.warn('[FullStack]', 'فشل كتابة سكافولد fullstack/:', e.message); }
}

// 🗂️ تحديث Project Memory بهيكل الموقع المبني وهويته البصرية
export async function runProjectMemory(context) {
    if (context.mentalModel?.templateSections?.length) {
        updateStructure(context.username, context.activeProject, context.mentalModel.templateSections);
    }
    if (context.mentalModel?.visualIdentity) {
        updateDesign(context.username, context.activeProject, { style: context.mentalModel.visualIdentity });
    }
}
