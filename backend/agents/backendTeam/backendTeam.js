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

import { compileSpecToPrompt } from './agentSpec.js';
import { BACKEND_TEAM, TEAM_BY_ID, BACKEND_DEBUG_AGENT } from './specs.js';

/** ترتيب التنفيذ عبر فرز طوبولوجي لاعتماديات dependsOn (Kahn) */
export function planExecution(team = BACKEND_TEAM) {
    const ids = new Set(team.map((a) => a.id));
    const indeg = new Map(team.map((a) => [a.id, 0]));
    const adj = new Map(team.map((a) => [a.id, []]));
    for (const a of team) {
        for (const dep of a.dependsOn || []) {
            if (!ids.has(dep)) continue; // تجاهل اعتمادية خارج الفريق
            indeg.set(a.id, indeg.get(a.id) + 1);
            adj.get(dep).push(a.id);
        }
    }
    // طابور مستقر: يحافظ على ترتيب التعريف عند تساوي الدرجة
    const order = [];
    let queue = team.filter((a) => indeg.get(a.id) === 0).map((a) => a.id);
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
    if (order.length !== team.length) {
        throw new Error('دورة اعتمادية في فريق الوكلاء — تعذّر ترتيب التنفيذ');
    }
    return order;
}

/** خطة الفريق (بلا تنفيذ) — للعرض في لوحة الأدمِن والاختبار */
export function teamPlan(team = BACKEND_TEAM) {
    const order = planExecution(team);
    return order.map((id) => {
        const a = TEAM_BY_ID[id] || team.find((x) => x.id === id);
        return {
            id: a.id, role: a.role, icon: a.icon,
            mission: a.mission,
            dependsOn: a.dependsOn,
            outputs: a.outputs,
        };
    });
}

/** يجمع مخرجات الوكلاء الذين يعتمد عليهم هذا الوكيل (التعاون) */
function gatherCooperationInputs(agent, artifacts) {
    const parts = [];
    for (const dep of agent.dependsOn || []) {
        if (artifacts[dep]) {
            const a = TEAM_BY_ID[dep];
            parts.push(`### مخرجات ${a ? a.role : dep}:\n${artifacts[dep].summary || JSON.stringify(artifacts[dep].output).slice(0, 1500)}`);
        }
    }
    return parts.join('\n\n');
}

async function runAgent(agent, { goal, lang, artifacts, llm }) {
    const system = compileSpecToPrompt(agent, { lang });
    const coop = gatherCooperationInputs(agent, artifacts);
    const user = `## المشروع
${goal}

${coop ? `## مخرجات الوكلاء السابقين (استخدمها كمدخلات):\n${coop}\n` : ''}
أنجز مهمتك بحسب Outputs في عقدك. أعِد **JSON فقط** بهذا الشكل:
{
  "summary": "ملخص ما أنجزته (سطران)",
  "artifacts": [ { "name": "اسم المخرج", "kind": "doc|schema|code|config|report|tests", "content": "..." } ],
  "issues": [ "مشاكل مكتشفة إن وُجدت" ],
  "selfReviewPassed": true
}`;

    const raw = await llm(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { max_tokens: 1500, temperature: 0.2, json: true }
    );
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { parsed = { summary: String(raw).slice(0, 300), artifacts: [], issues: ['رد غير صالح JSON'], selfReviewPassed: false }; }

    return {
        agent: agent.id,
        role: agent.role,
        summary: parsed.summary || '',
        output: parsed,
        artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        selfReviewPassed: parsed.selfReviewPassed !== false,
    };
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
    const lang = opts.lang || 'ar';
    const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
    const order = planExecution(team);

    if (!opts.llm) {
        // وضع الخطة: لا نموذج متاح — نُرجع خطة الفريق القابلة للتنفيذ
        return { mode: 'plan', order, plan: teamPlan(team) };
    }

    const artifacts = {};
    const results = [];
    for (const id of order) {
        const agent = TEAM_BY_ID[id] || team.find((a) => a.id === id);
        // Debug Agent يُشغّل فقط عند وجود فشل من QA
        if (agent.id === 'backend-debug-agent') {
            const qa = artifacts['backend-qa-engineer'];
            const hasFailures = qa && qa.issues && qa.issues.length > 0;
            if (!hasFailures) {
                onEvent({ type: 'agent_skipped', agent: agent.id, role: agent.role, reason: 'لا أخطاء من QA' });
                results.push({ agent: agent.id, role: agent.role, skipped: true, reason: 'no-failures' });
                continue;
            }
        }
        onEvent({ type: 'agent_start', agent: agent.id, role: agent.role, icon: agent.icon });
        try {
            const res = await runAgent(agent, { goal, lang, artifacts, llm: opts.llm });
            artifacts[agent.id] = res;
            results.push(res);
            onEvent({ type: 'agent_done', agent: agent.id, role: agent.role, summary: res.summary, selfReviewPassed: res.selfReviewPassed, issues: res.issues.length });
        } catch (e) {
            const failed = { agent: agent.id, role: agent.role, error: e.message };
            results.push(failed);
            onEvent({ type: 'agent_error', agent: agent.id, role: agent.role, error: e.message });
        }
    }

    const allArtifacts = results.flatMap((r) => (r.artifacts || []).map((a) => ({ ...a, by: r.agent })));
    const openIssues = results.flatMap((r) => (r.issues || []).map((i) => ({ issue: i, by: r.agent })));
    return {
        mode: 'execute',
        order,
        results,
        artifacts: allArtifacts,
        openIssues,
        summary: `فريق خلفي: ${results.filter((r) => !r.skipped && !r.error).length}/${team.length} وكيل أنجز، ${allArtifacts.length} مخرج، ${openIssues.length} مشكلة مفتوحة`,
    };
}
