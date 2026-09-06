/**
 * 💬 stages/chatResponse.js — ردُّ الشات: ذاكرةٌ تنفيذيّة + نافذةُ المحادثة + دماغُ المشروع
 * مُؤرَّضاً على الكود الفعليّ + معرفةُ المنصّة، ثمّ بثٌّ حيٌّ حرفاً-بحرف بمحاولتَين.
 *
 * تخرج من `JaolaCognitiveRuntime` (JCR/31) بالمنهج نفسِه. قِيس قبل النقل: ١٣٧ سطراً تلمس من
 * `this` ثلاثةَ أشياءَ فقط — طريقتان تستبدلهما الاختباراتُ على النسخة (`loadExecutiveMemory`،
 * `summarizeConversation`) تصلان في `ops`، وستُّ نداءاتِ بثٍّ (٤ `send` + ٢ `emitLiveLog`)
 * تصير `reporter`، ونداءُ البثّ إلى `groq` يُحقَن بمعاملٍ افتراضيّ على سابقة JCR/30.
 *
 * ⚠️ `emitChatReply(roomName, reply)` كانت غلافاً من سطرٍ واحد حول
 *    `reporter.send(roomName, 'chat_reply', …)` — كُتب النداءُ صريحاً هنا، والغلافُ باقٍ في
 *    الصنف لمستدعيه الآخرين. لا تغييرَ سلوك.
 */
import { groq } from '../../core/providers/llm.js';
import { scanProjectFiles, buildProjectBrain, summarizeBrain, summarizeFacts } from '../../services/projectBrain.js';
import { getLangInfo } from '../languageDetector.js';
import { getProjectMemory, getDomainModel } from '../projectMemory.js';
import { analyzeProjectStatic } from '../behaviorVerifier.js';
import { projectPathOf } from '../../core/runtime/workspacePaths.js';
import { getPlatformKnowledge } from '../../services/platformKnowledge.js';
import { loadForPrompt as loadConversation, recordTurn } from '../../services/conversationStore.js';
import { WORKSPACE_ROOT } from '../../core/runtime/workspaceRoots.js';

export async function generateChatResponse(userMessage, username, roomName, userLang = 'en', reporter, ops = {}, client = groq) {
const { loadExecutiveMemory, summarizeConversation } = ops;
    const langInfo = getLangInfo(userLang);
    const execMemory = await loadExecutiveMemory(username);

    // 🧠 نافذة السياق الأخيرة + الملخّص طويل المدى — يبقي الموضوع حاضراً
    // مهما طالت المحادثة بدل اقتطاعها لآخر 30 رسالة وفقدان السياق.
    // 💬 الذاكرة لكل مشروع (username::project) — كانت لكل المستخدم فتُعاد
    // «الطبقة القديمة» من مشاريع أخرى مع كل تحديث.
    const convKey = roomName.startsWith(username + '-') ? `${username}::${roomName.slice(username.length + 1)}` : username;
    const { window: history, summary: convSummary } = await loadConversation(convKey);

    // 🧠 Project Brain — يفهم كامل المشروع (ملفات + قرارات + أُنجز/متبقٍّ) لا الرسالة الأخيرة فقط
    let brainContext = '';
    // 🔬 الدماغ يُؤرَّض على الكود الفعلي (المتبقّي/يعمل) لا على خطة مخزّنة —
    // المستخدم: الردّ كان يقرأ الخطة لا الملفات فيجهل ما يجب عمله ويخترع 67%.
    const project = roomName.startsWith(username + '-') ? roomName.slice(username.length + 1) : null;
    try {
        if (project) {
            // 🔀 كان هذا يبني المسارَ بيده: نفسُ التطهير، لكن **بلا**
            //    احتياطَي `projectPathOf` (`guest_user`/`sandbox_app`) —
            //    فلو خلا أحدُ الاسمين لأشار هذا إلى مسارٍ غيرِ الذي يراه
            //    بقيّةُ النظام. اشتقاقٌ ثانٍ لسؤالٍ له اشتقاقٌ رسميّ.
            const projectPath = projectPathOf(WORKSPACE_ROOT, username, project);
            const files = await scanProjectFiles(projectPath, { maxFiles: 300 });
            const brain = buildProjectBrain(getProjectMemory(username, project), files);

            // 🔬 فحص ساكن حقيقي على الكود قبل التلخيص — نُصحّح «المتبقّي»
            // و«النسبة» في الدماغ نفسه ليكون صادقاً (لا يكفي إلحاق قسم؛
            // النموذج يثق بأرقام الدماغ الواثقة فيردّدها). الكود هو الحكم.
            const { hasProject, checks } = await analyzeProjectStatic({
                projectPath, domainModel: getDomainModel(username, project),
            });
            if (hasProject) {
                const fails = checks.filter(c => c.status === 'fail');
                const gapDetails = checks.filter(c => c.status !== 'pass').map(c => c.detail);
                if (gapDetails.length) {
                    brain.progress.remaining = gapDetails;      // فجوات حقيقية بدل الخطة
                    brain.progress.works = fails.length === 0;  // fail = لا يعمل → لا نسبة مطمئنة
                } else {
                    brain.progress.works = true;                // اجتاز التحقّق
                }
            } else if (files.length) {
                // مشروع بملفات لكن تعذّر التحليل الساكن (React/Next بلا index.html
                // جذري) — لا نخترع نسبة/قائمة من الخطة (جذر «67%» الوهمي).
                brain.progress.works = null;
                brain.progress.percent = null;
                brain.progress.remaining = [];
            }
            brainContext = summarizeBrain(brain, userLang);
            // حقائق ملفات دقيقة (عدد الصفحات/الملفات/أكبر ملف) — يجيب الشات
            // بدل «غير محدد في السجل».
            brainContext += summarizeFacts(files, userLang);
        }
    } catch { /* الشات يعمل حتى لو تعذّر بناء الصورة */ }

    // 🧠 معرفة المنصة الحيّة — قدرات ثابتة + حقائق المستخدم اللحظية
    // (الخطة، الاستهلاك، هل المشروع منشور ورابطه). لا يرمي أبداً.
    const platformKnowledge = await getPlatformKnowledge(username, project, userLang);

    const messages = [
        { role: "system", content: `You are JAOLA — the chat assistant of an AI web-building platform. (You are a TEXT chat assistant — never describe yourself as a "voice assistant" / "مساعد صوتي".)

CRITICAL LANGUAGE RULE: The user's language is "${userLang}" (${langInfo.label}). You MUST reply ONLY in this language for the entire conversation. Never switch languages even if the user writes a word in another language.

⛔ HARD BOUNDARIES — you are the CHAT voice, NOT the builder:
- You CANNOT build, edit, or write code yourself. A separate build system does that. NEVER role-play building ("let's start with the Navbar...") or announce work you cannot do.
- NEVER collect specs step-by-step (asking for site name, then menu items, then hero text...). The build system gathers everything itself from one request.
- NEVER invent progress numbers or remaining-parts lists. ONLY state what the Project Brain below explicitly says. If it shows files/sections, they EXIST — do not claim they are missing. If unsure, say you're not sure.
- NEVER fabricate a list of "changes applied" or files you edited. If asked what changed, cite ONLY edit history explicitly present in the Project Brain below; if none is listed, say you have no record of specific changes.
- Your own earlier replies in this conversation may contain MISTAKES. NEVER repeat a past claim (e.g. "I added api.js") unless the Project Brain below confirms it — the Project Brain ALWAYS overrides conversation history. If you previously claimed something the Brain doesn't show, admit the earlier reply was wrong.
- Do NOT append "type build [name]" (or similar) to every reply. Mention what to type ONLY when the user is actually asking to build, continue, or change something.
- NEVER tell the user to type the exact same words they just sent — that creates an infinite loop. If their message already describes a change, tell them to send it again once to confirm, or rephrase it starting with an action verb (e.g. "${userLang === 'ar' ? 'غيّر / اضف / نسّق' : 'change / add / format'}").
- When the user wants to build, continue, or change something: tell them in ONE sentence what to type — "${userLang === 'ar' ? 'اكمل' : 'continue'}" to resume the build, "${userLang === 'ar' ? 'ابني [وصف الموقع]' : 'build [site description]'}" for a new site, or simply describe the specific change (e.g. "${userLang === 'ar' ? 'غيّر الألوان إلى أزرق' : 'change the colors to blue'}") and the build system executes it directly.
- To DELETE the current project: the user types "${userLang === 'ar' ? 'احذف المشروع' : 'delete the project'}" and the system will ask for explicit confirmation. These are the ONLY commands that exist — NEVER invent or promise any other command or capability.
- RENAMING a project is NOT supported. If asked to rename, say so honestly and suggest creating a new project with the desired name from the projects list. NEVER promise "the project will be named X".

${platformKnowledge}

RESPONSE RULES:
- Keep replies SHORT: 1-3 sentences maximum
- Be direct and friendly
- Answer about the WHOLE project using the state below — not just the last message. If asked what's done or remaining, use ONLY it.
- The current project's NAME is "${project || 'sandbox_app'}" — if asked the project name, answer with it directly.

## Current project state (Project Brain — the ONLY source of truth; its "Remaining" and working-status come from the ACTUAL code, so report them verbatim — never invent a percentage or a different remaining list):
${brainContext || 'No project files yet.'}
${convSummary ? `\n## LONG-TERM CONVERSATION MEMORY (do not lose this context; never contradict earlier decisions or re-ask known facts):\n${convSummary}\n` : ''}
User preferences: ${JSON.stringify(execMemory)}` },
        ...history,
        { role: 'user', content: userMessage }
    ];
    // رسالة صادقة بدل "حدث خطأ" الغامضة — السبب الشائع هو ضغط حصة الذكاء (rate limit)
    let reply = userLang === 'ar'
        ? '⚠️ خدمة الذكاء مشغولة مؤقتاً (ضغط طلبات بعد البناء) — أعد إرسال رسالتك بعد ثوانٍ قليلة وسأنفذها فوراً.'
        : '⚠️ AI service is momentarily busy (rate limited after the build) — resend your message in a few seconds.';

    // محاولتان مع مهلة قصيرة — أغلب حالات rate limit تنجح في الثانية
    // 🔴 بثّ حيّ: الرد يظهر حرفاً-بحرف بدل دفعة واحدة (إحساس بالحياة)
    let streamed = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const stream = await client.chat.completions.create({
                messages,
                model: "llama-3.3-70b-versatile",
                max_tokens: 200,
                temperature: 0.6,
                stream: true,
            });
            reporter.send(roomName, 'chat_stream_start', {});
            let acc = '';
            for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta?.content || '';
                if (delta) { acc += delta; reporter.send(roomName, 'chat_stream_chunk', { delta }); }
            }
            if (acc.trim()) { reply = acc; streamed = true; }
            break;
        } catch (e) {
            console.error(`Chat error (attempt ${attempt}):`, e.message || e);
            reporter.liveLog(roomName, 'CHAT', 'Groq', `⚠️ محاولة ${attempt}/2 فشلت: ${(e.message || '').slice(0, 120)}`);
            if (attempt < 2) await new Promise(r => setTimeout(r, 2500));
        }
    }
    // 🧠 نحفظ الدورة (ونطوي الملخّص) فقط عند نجاح الرد — لا نلوّث الذاكرة
    // برسائل خطأ الـ rate-limit. conversationStore يحفظ كامل الحوار دائماً.
    if (streamed) {
        await recordTurn(
            convKey, userMessage, reply,
            (prev, older) => summarizeConversation(prev, older, userLang)
        );
    }
    // أنهِ البثّ بالنسخة النهائية (يستبدل النص المتراكم ويثبّته)؛
    // وإن لم ينجح البثّ (rate limit) أرسل الرد دفعة واحدة كالمعتاد
    if (streamed) reporter.send(roomName, 'chat_stream_end', { message: reply });
    else reporter.send(roomName, 'chat_reply', { message: reply });
    reporter.liveLog(roomName, '💬 Assistant', 'Chat Reply', reply);
    return reply;
}
