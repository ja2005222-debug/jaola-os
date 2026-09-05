/**
 * 🎛️ Backend Team Orchestrator — JAOLA
 *
 * يشغّل الوكلاء المتخصصين كسلسلة إنتاج متعاونة (لا وكيل واحد يفعل كل شيء):
 *   Architect → Database → API → Security → QA → DevOps  (+ Debug عند الفشل)
 *
 * التعاون: مخرجات كل وكيل تصبح مدخلات من يعتمد عليه (عبر dependsOn).
 * كل وكيل يمرّ بـ Self Review، وعند فشل QA يتدخّل Debug Agent.
 *
 * قابل للاختبار: يقبل حاقن llm(messages, opts) → نص، فيُختبر المنطق بلا نموذج حي.
 */

import path from 'path';
import { promises as fsp } from 'fs';
import { orderTasks } from '../../core/runtime/TaskGraph.js';
import { runAgent } from '../../core/runtime/AgentRuntime.js';
import { safeRelPath, resolveInside } from '../../core/runtime/workspacePaths.js';
import { BACKEND_TEAM } from './specs.js';
import { syntaxCheckFiles } from './backendVerify.js';

// 🛡️ حارس المسار انتقل حرفياً إلى core/runtime/workspacePaths.js (محور Tool)
// ويُعاد تصديره هنا كي يبقى عقد هذه الوحدة كما هو لكل مستورديها.
export { safeRelPath };

/** يكتب ملفات الفريق إلى مجلد المشروع بأمان (خارج المشروع = مرفوض) */
export async function writeBackendTeamFiles(files, projectPath, { transform } = {}) {
    const written = [];
    const root = path.resolve(projectPath);
    for (const f of files) {
        const rel = safeRelPath(f.path);
        if (!rel) continue;
        const abs = resolveInside(root, rel); // نواة الاحتواء المشتركة
        if (!abs) continue; // منع الخروج من المشروع
        let content = f.content;
        if (typeof transform === 'function') {
            try { content = await transform(rel, content); } catch { /* أبقِ الأصل */ }
        }
        await fsp.mkdir(path.dirname(abs), { recursive: true });
        await fsp.writeFile(abs, content);
        written.push(rel);
    }
    return written;
}

/** ترتيب التنفيذ عبر فرز طوبولوجي لاعتماديات dependsOn (Kahn) */
export function planExecution(team = BACKEND_TEAM) {
    // 📐 عقد Task: الخوارزمية نفسها انتقلت حرفياً إلى core/runtime/TaskGraph.js
    // (ترتيب طوبولوجي مستقرّ من dependsOn + كشف الدورات) — الفريق يبقى مستهلكها الأول
    return orderTasks(team, { key: 'id', label: 'فريق الوكلاء' }).map((a) => a.id);
}

/**
 * خطة الفريق (بلا تنفيذ) — للعرض في لوحة الأدمِن والاختبار.
 *
 * ⚠️ كان البحث `TEAM_BY_ID[id] || team.find(...)`: خريطةُ **فريق الخلفية**
 * تُستشار أولاً حتى حين تكون الخطة المطلوبة لفريق الواجهة
 * (`frontendTeamPlan` يمرّ من هنا بـ`FRONTEND_TEAM`). لا أثر له اليوم —
 * تحقّقتُ بتشغيل المعرّفين: لا تصادم بين الفريقين إطلاقاً — لكنه فخّ
 * مؤجَّل: وكيل واجهةٍ يُسمّى باسم وكيل خلفيةٍ يُعرض بدور الخلفية ومخرجاتها
 * بصمت. الخريطة تُبنى الآن من الفريق الممرَّر نفسه، فلا مصدر ثانٍ للحقيقة.
 */
export function teamPlan(team = BACKEND_TEAM) {
    const order = planExecution(team);
    const byId = Object.fromEntries(team.map((a) => [a.id, a]));
    return order.map((id) => {
        const a = byId[id];
        return {
            id: a.id, role: a.role, icon: a.icon,
            mission: a.mission,
            dependsOn: a.dependsOn,
            outputs: a.outputs,
        };
    });
}

/**
 * يشغّل الفريق كاملاً.
 * @param {string} goal هدف المشروع
 * @param {object} opts { lang, llm, onEvent, team }
 *   - llm: async (messages, options) => string. إن غاب → يُرجع الخطة فقط (وضع plan).
 *   - onEvent: (evt) => void لبثّ التقدّم الحي
 */
export async function runBackendTeam(goal, opts = {}) {
    const team = opts.team || BACKEND_TEAM;
    const byId = Object.fromEntries(team.map((a) => [a.id, a]));
    const lang = opts.lang || 'ar';
    const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
    const order = planExecution(team);

    if (!opts.llm) {
        // وضع الخطة: لا نموذج متاح — نُرجع خطة الفريق القابلة للتنفيذ
        return { mode: 'plan', order, plan: teamPlan(team) };
    }

    const artifacts = {};
    const results = [];
    const fileMap = {}; // path → { path, content, kind, by }  (المُعدِّلون يستبدلون السابق)
    for (const id of order) {
        const agent = byId[id] || team.find((a) => a.id === id);
        // وكيل الـ debug يُشغّل فقط عند وجود فشل من وكيل QA المرتبط (عام عبر debugFor)
        if (agent.debugFor) {
            const qa = artifacts[agent.debugFor];
            const hasFailures = qa && qa.issues && qa.issues.length > 0;
            if (!hasFailures) {
                onEvent({ type: 'agent_skipped', agent: agent.id, role: agent.role, reason: 'لا أخطاء من QA' });
                results.push({ agent: agent.id, role: agent.role, skipped: true, reason: 'no-failures' });
                continue;
            }
        }
        onEvent({ type: 'agent_start', agent: agent.id, role: agent.role, icon: agent.icon });
        try {
            const res = await runAgent(agent, { goal, lang, artifacts, fileMap, llm: opts.llm, byId });
            artifacts[agent.id] = res;
            results.push(res);
            // دمج الملفات: create يضيف، modify يستبدل ما سبق بنفس المسار (تعاون فعلي)
            for (const f of res.files) {
                fileMap[f.path] = { path: f.path, content: f.content, kind: f.kind, by: agent.id, action: f.action };
            }
            onEvent({ type: 'agent_done', agent: agent.id, role: agent.role, summary: res.summary, files: res.files.length, selfReviewPassed: res.selfReviewPassed, issues: res.issues.length });
        } catch (e) {
            const failed = { agent: agent.id, role: agent.role, error: e.message };
            results.push(failed);
            onEvent({ type: 'agent_error', agent: agent.id, role: agent.role, error: e.message });
        }
    }

    // ✅ فحص تنفيذي حقيقي: node --check على الكود المولّد، والأخطاء تُغذّى Debug ليصلحها
    let verification = null;
    const debug = team.find((a) => a.debugFor); // وكيل الإصلاح (عام)
    // لا فحص على صفر ملفات — «اجتاز الفحص» بلا شيء يُفحص نجاحٌ أجوف يضلّل السجل
    if (opts.verify && debug && Object.keys(fileMap).length > 0) {
        const qaKey = debug.debugFor;
        const maxRounds = Number.isInteger(opts.maxVerifyRounds) ? opts.maxVerifyRounds : 2;
        let ver = await syntaxCheckFiles(Object.values(fileMap));
        let round = 0;
        while (!ver.ok && round < maxRounds) {
            onEvent({ type: 'verify_failed', round: round + 1, failures: ver.failures.length });
            const dbgArtifacts = {
                ...artifacts,
                [qaKey]: {
                    ...(artifacts[qaKey] || {}),
                    issues: [
                        ...((artifacts[qaKey] || {}).issues || []),
                        ...ver.failures.map((f) => `${f.path}: ${f.error}`),
                    ],
                },
            };
            try {
                const res = await runAgent(debug, { goal, lang, artifacts: dbgArtifacts, fileMap, llm: opts.llm, byId });
                for (const f of res.files) fileMap[f.path] = { path: f.path, content: f.content, kind: f.kind, by: debug.id, action: f.action };
                results.push({ ...res, phase: 'verify-fix', round: round + 1 });
            } catch (e) {
                onEvent({ type: 'agent_error', agent: debug.id, role: debug.role, error: e.message });
                break;
            }
            ver = await syntaxCheckFiles(Object.values(fileMap));
            round++;
        }
        verification = { ok: ver.ok, checked: ver.checked, failures: ver.failures, rounds: round };
        onEvent({ type: 'verify_done', ok: ver.ok, failures: ver.failures.length, rounds: round });
    }

    const files = Object.values(fileMap);
    const openIssues = results.flatMap((r) => (r.issues || []).map((i) => ({ issue: i, by: r.agent })));
    return {
        mode: 'execute',
        order,
        results,
        files,
        verification,
        openIssues,
        summary: `فريق خلفي: ${results.filter((r) => !r.skipped && !r.error).length}/${team.length} وكيل أنجز، ${files.length} ملف، ${openIssues.length} مشكلة مفتوحة${verification ? `، فحص: ${verification.ok ? 'نجح' : verification.failures.length + ' خطأ'}` : ''}`,
    };
}
