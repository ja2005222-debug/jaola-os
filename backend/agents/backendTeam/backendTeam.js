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
import { compileSpecToPrompt } from './agentSpec.js';
import { BACKEND_TEAM, TEAM_BY_ID, BACKEND_DEBUG_AGENT } from './specs.js';

/** يطهّر مساراً نسبياً: يمنع الجذر المطلق و.. وأحرف خطيرة، ويوحّد الفواصل */
export function safeRelPath(p) {
    if (typeof p !== 'string') return null;
    let clean = p.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!clean || clean.includes('..') || /[<>:"|?*\0]/.test(clean)) return null;
    // احصر الطول والأحرف المسموحة
    if (clean.length > 200 || !/^[\w.\-\/ ]+$/.test(clean)) return null;
    return clean;
}

/** يكتب ملفات الفريق إلى مجلد المشروع بأمان (خارج المشروع = مرفوض) */
export async function writeBackendTeamFiles(files, projectPath, { transform } = {}) {
    const written = [];
    const root = path.resolve(projectPath);
    for (const f of files) {
        const rel = safeRelPath(f.path);
        if (!rel) continue;
        const abs = path.resolve(root, rel);
        if (abs !== root && !abs.startsWith(root + path.sep)) continue; // منع الخروج من المشروع
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

// الوكلاء الذين يُعدّلون ملفات سابقة (تعاون فعلي) بدل إنشاء ملفات جديدة فقط
const MODIFIER_AGENTS = new Set(['security-engineer', 'backend-debug-agent']);

async function runAgent(agent, { goal, lang, artifacts, fileMap, llm }) {
    const system = compileSpecToPrompt(agent, { lang });
    const coop = gatherCooperationInputs(agent, artifacts);
    const isModifier = MODIFIER_AGENTS.has(agent.id);

    // المُعدِّلون يستقبلون الملفات الحالية ليصلحوها/يحصّنوها
    let currentFilesBlock = '';
    if (isModifier) {
        const files = Object.values(fileMap);
        if (files.length) {
            currentFilesBlock = `\n## الملفات الحالية (عدّل ما يلزم منها وأعِدها بنفس المسار مع action="modify"):\n` +
                files.map((f) => `### ${f.path}\n\`\`\`\n${(f.content || '').slice(0, 1200)}\n\`\`\``).join('\n');
        }
        // Debug: زوّده بأخطاء QA تحديداً
        if (agent.id === 'backend-debug-agent') {
            const qa = artifacts['backend-qa-engineer'];
            if (qa?.issues?.length) currentFilesBlock += `\n## أخطاء QA لإصلاحها:\n${qa.issues.map((i) => `- ${i}`).join('\n')}`;
        }
    }

    const user = `## المشروع
${goal}

${coop ? `## مخرجات الوكلاء السابقين (استخدمها كمدخلات):\n${coop}\n` : ''}${currentFilesBlock}

أنجز مهمتك بحسب Outputs في عقدك، وأنتج **ملفات حقيقية** بمسارات صحيحة.
أعِد **JSON فقط** بهذا الشكل:
{
  "summary": "ملخص ما أنجزته (سطران)",
  "files": [ { "path": "api/routes/users.js", "kind": "code|schema|migration|config|tests|doc", "action": "create|modify", "content": "المحتوى الكامل للملف" } ],
  "issues": [ "مشاكل مكتشفة إن وُجدت" ],
  "selfReviewPassed": true
}`;

    const raw = await llm(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { max_tokens: 2500, temperature: 0.2, json: true }
    );
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { parsed = { summary: String(raw).slice(0, 300), files: [], issues: ['رد غير صالح JSON'], selfReviewPassed: false }; }

    const files = (Array.isArray(parsed.files) ? parsed.files : [])
        .map((f) => ({ path: safeRelPath(f.path), kind: f.kind || 'code', action: f.action === 'modify' ? 'modify' : 'create', content: typeof f.content === 'string' ? f.content : '' }))
        .filter((f) => f.path && f.content);

    return {
        agent: agent.id,
        role: agent.role,
        summary: parsed.summary || '',
        output: parsed,
        files,
        artifacts: files.map((f) => ({ name: f.path, kind: f.kind })), // توافق خلفي
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
    const fileMap = {}; // path → { path, content, kind, by }  (المُعدِّلون يستبدلون السابق)
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
            const res = await runAgent(agent, { goal, lang, artifacts, fileMap, llm: opts.llm });
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

    const files = Object.values(fileMap);
    const openIssues = results.flatMap((r) => (r.issues || []).map((i) => ({ issue: i, by: r.agent })));
    return {
        mode: 'execute',
        order,
        results,
        files,
        openIssues,
        summary: `فريق خلفي: ${results.filter((r) => !r.skipped && !r.error).length}/${team.length} وكيل أنجز، ${files.length} ملف، ${openIssues.length} مشكلة مفتوحة`,
    };
}
