/**
 * 🤖 AgentRuntime — منفّذ الوكيل الواحد (Sprint 2d / محور Runtime).
 *
 * `runAgent` هو **الموضع الوحيد** الذي يتحوّل فيه عقدُ وكيلٍ إلى نداء نموذج
 * ثم إلى ملفات: يبني الرسالة من العقد (`compileSpecToPrompt`)، ويضخّ فيها
 * مخرجات من يعتمد عليهم (`gatherCooperationInputs`)، ويطهّر كل مسار عائد
 * (`safeRelPath`). لا شيء منه خاصٌّ بفريق الخلفية — وهذا مثبتٌ بالاستعمال
 * لا بالدعوى: `runFrontendTeam` يمرّ عبر `runBackendTeam` نفسه بفريقٍ آخر
 * (`agents/frontendTeam/index.js`)، فالمستهلكان اثنان اليوم لا واحد.
 *
 * ⚠️ **التغيير الوحيد عن النصّ المنقول**: كان `byId || TEAM_BY_ID` —
 * افتراضٌ يسقط على خريطة **فريق الخلفية** حين لا يمرَّر شيء. في موقعٍ محايد
 * هذا الافتراض خطأ بنيوي: يجعل منفّذاً عاماً يعرف فريقاً بعينه، ولو نُودي
 * بلا `byId` من فريق الواجهة لَسمّى وكلاء الخلفية في رسالة التعاون. فحصتُ
 * الاستدعاءين الحيّين في `runBackendTeam` وكلاهما يمرّر `byId` صراحةً —
 * أي أن الافتراض كان **شيفرةً ميتة**، وإسقاطه لا يغيّر سلوكاً قائماً.
 */

import { compileSpecToPrompt } from './AgentSpec.js';
import { withUsageLabel } from '../providers/llm.js';
import { safeRelPath } from './workspacePaths.js';

/** يجمع مخرجات الوكلاء الذين يعتمد عليهم هذا الوكيل (التعاون) */
export function gatherCooperationInputs(agent, artifacts, byId) {
    const parts = [];
    for (const dep of agent.dependsOn || []) {
        if (artifacts[dep]) {
            const a = byId[dep];
            parts.push(`### مخرجات ${a ? a.role : dep}:\n${artifacts[dep].summary || JSON.stringify(artifacts[dep].output).slice(0, 1500)}`);
        }
    }
    return parts.join('\n\n');
}

export async function runAgent(agent, { goal, lang, artifacts, fileMap, llm, byId, repairPaths, contextBudget = 48000 }) {
    const system = compileSpecToPrompt(agent, { lang });
    const coop = gatherCooperationInputs(agent, artifacts, byId);

    // المُعدِّلون يستقبلون الملفات الحالية ليصلحوها/يحصّنوها (عام عبر flag العقد)
    let currentFilesBlock = '';
    const visiblePaths = new Set();
    if (agent.modifier) {
        let remaining = contextBudget;
        const files = Object.values(fileMap).filter(f => {
            if (repairPaths && !repairPaths.includes(f.path)) return false;
            const size = String(f.content || '').length + f.path.length + 30;
            if (size > remaining) return false;
            remaining -= size;
            visiblePaths.add(f.path);
            return true;
        });
        if (files.length) {
            currentFilesBlock = `\n## الملفات الحالية (عدّل ما يلزم منها وأعِدها بنفس المسار مع action="modify"):\n` +
                files.map((f) => `### ${f.path}\n\`\`\`\n${f.content || ''}\n\`\`\``).join('\n');
        }
        currentFilesBlock += '\nلا تستبدل ملفاً لم يصلك محتواه الكامل. الملفات المستبعدة: ' + Object.keys(fileMap).filter(p => !visiblePaths.has(p)).join(', ');
        // وكيل الـ debug: زوّده بأخطاء وكيل QA المرتبط تحديداً
        if (agent.debugFor) {
            const qa = artifacts[agent.debugFor];
            if (qa?.issues?.length) currentFilesBlock += `\n## أخطاء لإصلاحها:\n${qa.issues.map((i) => `- ${i}`).join('\n')}`;
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

    // 🏷️ وسمُ الكلفة: هنا يُنسَب استهلاكُ **كلِّ** وكلاء العقود إلى أسمائهم دفعةً واحدة —
    //    `agent.id` معروفٌ هنا سلفاً، فلا تُغيَّر توقيعاتُ المنادين لأجل عدّاد.
    const raw = await withUsageLabel(`agent:${agent.id}`, () => llm(
        [{ role: 'system', content: system }, { role: 'user', content: user }],
        { max_tokens: 2500, temperature: 0.2, json: true }
    ));
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch { parsed = { summary: String(raw).slice(0, 300), files: [], issues: ['رد غير صالح JSON'], selfReviewPassed: false }; }

    const files = (Array.isArray(parsed.files) ? parsed.files : [])
        .map((f) => ({ path: safeRelPath(f.path), kind: f.kind || 'code', action: f.action === 'modify' ? 'modify' : 'create', content: typeof f.content === 'string' ? f.content : '' }))
        .filter((f) => f.path && f.content);
    if (agent.modifier && files.some(f => fileMap[f.path] && !visiblePaths.has(f.path))) {
        throw new Error('رفض استبدال ملف لم يُرسل محتواه الكامل للوكيل');
    }

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
