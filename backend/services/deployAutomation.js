/**
 * 🚀 أتمتة نشر Full-Stack (الجولة أ) — «زر واحد → رابط حيّ».
 *
 * يزيل الخطوات اليدوية الثلاث للمشاريع الكبيرة:
 *  1) إنشاء مستودع GitHub للمشروع تلقائياً (بتوكن منصّة، مرة واحدة في البيئة).
 *  2) الدفع إليه (المسار الموجود pushProject نفسه — لا تكرار).
 *  3) إنشاء خدمة Render عبر الـ API + حقن أسرار المشروع (MONGODB_URI…)
 *     وإعادة رابط `.onrender.com` مباشرة.
 *
 * تهيئة المنصّة (مرة واحدة):
 *  - GITHUB_PLATFORM_TOKEN  توكن بصلاحية repo (يُنشئ مستودعات المشاريع).
 *  - GITHUB_PLATFORM_OWNER  (اختياري) الحساب/المنظمة المالكة للمستودعات.
 *  - RENDER_API_KEY         مفتاح Render API.
 *  - RENDER_OWNER_ID        (اختياري) مالك الخدمات؛ يُكتشف تلقائياً إن غاب.
 *
 * إن غابت المفاتيح: لا فشل — يعيد {fallback:true} فيكمل المسار النصف-آلي
 * الحالي (رابط Deploy to Render) كما هو. كل الخارجيّات قابلة للحقن للاختبار.
 */

import { encryptSecret } from '../utils/secretVault.js';
import { saveProjectFields } from './projectRecord.js';
import { isPlatformRepo } from './githubSync.js';

const GITHUB_API = 'https://api.github.com';
const RENDER_API = 'https://api.render.com/v1';

// ─── جاهزية التهيئة ─────────────────────────────────────────────────────
export function platformGithubReady(env = process.env) {
    return !!env.GITHUB_PLATFORM_TOKEN;
}
export function renderReady(env = process.env) {
    return !!env.RENDER_API_KEY;
}
/** الأتمتة الكاملة ممكنة فقط بالمفتاحين معاً (مستودع + خدمة). */
export function fullAutomationReady(env = process.env) {
    return platformGithubReady(env) && renderReady(env);
}

// اسم مستودع/خدمة آمن: أحرف صغيرة وأرقام وشرطات، بلا أطراف شرطية
export function safeSlug(s = '') {
    return String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function ghFetch(fetchImpl, token, path, options = {}) {
    const res = await fetchImpl(`${GITHUB_API}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'jaola-os',
            ...(options.headers || {}),
        },
    });
    let body = null;
    try { body = await res.json(); } catch { /* بلا جسم */ }
    return { status: res.status, ok: res.ok, body };
}

/**
 * يضمن وجود مستودع GitHub للمشروع: يعيد المرتبط إن وُجد، وإلا يُنشئه
 * بتوكن المنصّة ويحفظ الربط (بنفس بنية التكامل الحالية فيعمل pushProject
 * كما هو). يرفض دائماً مستودع المنصّة (isPlatformRepo).
 */
export async function ensureProjectRepo({ username, project, deps = {} }) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    const getIntegration = deps.getIntegration || (await import('./githubSync.js')).getIntegration;

    const existing = await getIntegration(username, project);
    if (existing?.repoUrl) {
        if (isPlatformRepo(existing.repoUrl)) return { success: false, error: 'المستودع المرتبط هو مستودع المنصّة — مرفوض.' };
        return { success: true, repoUrl: existing.repoUrl, branch: existing.branch || 'main', created: false };
    }

    if (!platformGithubReady(env)) return { success: false, fallback: true, error: 'لا توكن منصّة لإنشاء المستودع تلقائياً.' };
    const token = env.GITHUB_PLATFORM_TOKEN;

    const repoName = safeSlug(`jaola-${username}-${project}`);
    if (!repoName || isPlatformRepo(`https://github.com/x/${repoName}`)) {
        return { success: false, error: 'اسم مستودع غير صالح.' };
    }

    // المالك: منظمة/حساب صريح أو صاحب التوكن
    let owner = env.GITHUB_PLATFORM_OWNER || '';
    if (!owner) {
        const me = await ghFetch(fetchImpl, token, '/user');
        if (!me.ok || !me.body?.login) return { success: false, error: 'تعذّر التعرّف على حساب توكن المنصّة.' };
        owner = me.body.login;
    }

    // إنشاء المستودع (خاص). 422 = موجود مسبقاً → نعيد استخدامه بأمان.
    const createPath = env.GITHUB_PLATFORM_OWNER ? `/orgs/${owner}/repos` : '/user/repos';
    const created = await ghFetch(fetchImpl, token, createPath, {
        method: 'POST',
        body: JSON.stringify({ name: repoName, private: true, auto_init: false, description: `موقع ${project} — أُنشئ عبر JAOLA OS` }),
    });
    const exists = created.status === 422; // name already exists on this account
    if (!created.ok && !exists) {
        return { success: false, error: `تعذّر إنشاء المستودع (${created.status}): ${created.body?.message || ''}`.trim() };
    }

    const repoUrl = created.body?.html_url || `https://github.com/${owner}/${repoName}`;
    if (isPlatformRepo(repoUrl)) return { success: false, error: 'رفض أمني: الاسم يطابق مستودع المنصّة.' };

    // حفظ الربط بنفس بنية التكامل (التوكن مشفّراً) — فيعمل الدفع الحالي بلا تغيير
    const saveIntegration = deps.saveIntegration || defaultSaveIntegration;
    await saveIntegration(username, project, {
        repoUrl, branch: 'main', autoCommit: true, patEncrypted: encryptSecret(token),
    });

    return { success: true, repoUrl, branch: 'main', created: !exists };
}

// 🔴 كانت تعيد `true` بعد `updateOne` بلا `upsert`: مع `sandbox_app` صفرُ
//    مطابقاتٍ وصفرُ كتابة — والتكاملُ **وتوكنُه المعمّى** يضيعان، ويُعلَن
//    الحفظُ ناجحاً. الناتجُ الآن يقول ما وقع فعلاً.
async function defaultSaveIntegration(username, project, github) {
    return saveProjectFields(username, project, { github });
}

async function renderFetch(fetchImpl, apiKey, path, options = {}) {
    const res = await fetchImpl(`${RENDER_API}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    let body = null;
    try { body = await res.json(); } catch { /* بلا جسم */ }
    return { status: res.status, ok: res.ok, body };
}

/**
 * يضمن خدمة Render للمشروع: يبحث بالاسم، يُنشئ عند الغياب (node، خطة free،
 * autoDeploy مع كل دفعة)، يحقن متغيّرات البيئة، ويعيد الرابط الحيّ.
 */
export async function ensureRenderService({ name, repoUrl, branch = 'main', envVars = {}, deps = {} }) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    if (!renderReady(env)) return { success: false, fallback: true, error: 'لا مفتاح Render API.' };
    const apiKey = env.RENDER_API_KEY;

    const svcName = safeSlug(name);
    const envVarList = Object.entries(envVars).map(([key, value]) => ({ key, value: String(value) }));

    // 1) موجودة مسبقاً؟ (إعادة نشر بدل إنشاء مكرّر)
    const found = await renderFetch(fetchImpl, apiKey, `/services?name=${encodeURIComponent(svcName)}&limit=5`);
    const match = Array.isArray(found.body)
        ? found.body.map(x => x.service || x).find(s => s?.name === svcName)
        : null;

    if (match?.id) {
        if (envVarList.length) {
            await renderFetch(fetchImpl, apiKey, `/services/${match.id}/env-vars`, { method: 'PUT', body: JSON.stringify(envVarList) });
        }
        await renderFetch(fetchImpl, apiKey, `/services/${match.id}/deploys`, { method: 'POST', body: JSON.stringify({}) });
        const url = match.serviceDetails?.url || `https://${svcName}.onrender.com`;
        return { success: true, serviceId: match.id, url, created: false };
    }

    // 2) إنشاء جديدة — المالك من البيئة أو أول مالك في الحساب
    let ownerId = env.RENDER_OWNER_ID || '';
    if (!ownerId) {
        const owners = await renderFetch(fetchImpl, apiKey, '/owners?limit=20');
        const first = Array.isArray(owners.body) ? (owners.body[0]?.owner || owners.body[0]) : null;
        if (!first?.id) return { success: false, error: 'تعذّر تحديد مالك خدمات Render.' };
        ownerId = first.id;
    }

    const created = await renderFetch(fetchImpl, apiKey, '/services', {
        method: 'POST',
        body: JSON.stringify({
            type: 'web_service',
            name: svcName,
            ownerId,
            repo: repoUrl.replace(/\.git$/i, ''),
            branch,
            autoDeploy: 'yes',
            envVars: envVarList,
            serviceDetails: {
                runtime: 'node',
                plan: 'free',
                region: env.RENDER_REGION || 'frankfurt',
                envSpecificDetails: { buildCommand: 'npm install', startCommand: 'node server.js' },
            },
        }),
    });
    if (!created.ok) {
        return { success: false, error: `تعذّر إنشاء خدمة Render (${created.status}): ${created.body?.message || ''}`.trim() };
    }
    const svc = created.body?.service || created.body;
    const url = svc?.serviceDetails?.url || `https://${svcName}.onrender.com`;
    return { success: true, serviceId: svc?.id || '', url, created: true };
}

/**
 * 🧩 المنسّق: زر واحد → رابط حيّ.
 * يجهّز ملفات Render، يضمن المستودع، يدفع، يضمن الخدمة بحقن الأسرار،
 * ويعيد {liveUrl}. أي غياب تهيئة → {fallback:true} ليكمل المسار النصف-آلي.
 */
export async function autoDeployFullStack({ username, project, projectPath, projectSlug, secrets = {}, deps = {} }) {
    const env = deps.env || process.env;
    if (!fullAutomationReady(env)) return { success: false, fallback: true, error: 'الأتمتة الكاملة غير مهيّأة (مفاتيح المنصّة).' };

    // 1) ملفات التشغيل (server.js + render.yaml) — نفس المُجهّز الموجود
    const prepare = deps.prepareRenderDeploy || (await import('../agents/renderAgent.js')).prepareRenderDeploy;
    const prep = await prepare(projectPath, projectSlug, true);
    if (!prep.success) return { success: false, error: `تجهيز Render: ${prep.error}` };

    // 2) المستودع (إنشاء تلقائي عند الغياب) ثم الدفع
    const repo = await ensureProjectRepo({ username, project, deps });
    if (!repo.success) return repo;

    const pushProject = deps.pushProject || (await import('./githubSync.js')).pushProject;
    const push = await pushProject(username, project, projectPath, { repoUrl: repo.repoUrl, branch: repo.branch });
    if (!push.success) return { success: false, error: `الدفع إلى GitHub: ${push.error}` };

    // 3) خدمة Render + أسرار المشروع (MONGODB_URI…) + NODE_ENV
    const service = await ensureRenderService({
        name: projectSlug,
        repoUrl: repo.repoUrl,
        branch: repo.branch,
        envVars: { NODE_ENV: 'production', ...secrets },
        deps,
    });
    if (!service.success) return service;

    return {
        success: true,
        liveUrl: service.url,
        repoUrl: repo.repoUrl,
        repoCreated: !!repo.created,
        serviceCreated: !!service.created,
    };
}
