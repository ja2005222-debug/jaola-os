/**
 * 🌐 Custom Domains — ربط نطاق المستخدم الخاص بموقعه المنشور على Vercel.
 *
 * الرحلة: المستخدم يملك نطاقاً (مثل mystore.com) → نربطه بمشروع Vercel
 * المنشور (نفس اسم مشروع deployAgent) → نعطيه سجلات DNS الدقيقة ليضبطها
 * عند مسجّل نطاقه → «تحقق الآن» يقرأ الحالة الحية من Vercel.
 *
 * ميزة خطط مدفوعة: customDomainsMax (المجانية 0، الاحترافية 1، المؤسسات ∞).
 * التخزين ملفّي: .domains/<username>.json → { [project]: { domain, addedAt } }.
 * كل الدوال قابلة للحقن (fetchImpl/env/baseDir) للاختبار.
 */

import fs from 'fs';
import path from 'path';
import { slugPart, nameFingerprint } from './hostNames.js';

const VERCEL_API = 'https://api.vercel.com';
// قيم Vercel الرسمية الثابتة لتوجيه DNS
export const VERCEL_A_RECORD = '76.76.21.21';
export const VERCEL_CNAME = 'cname.vercel-dns.com';

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const PLATFORM_DOMAIN_RE = /\.(vercel\.app|onrender\.com|netlify\.app|github\.io)$/i;

/** ينظّف مدخل المستخدم: بروتوكول/مسار/منفذ/مسافات → نطاق صِرف صغير الحروف. */
export function normalizeDomain(raw = '') {
    return String(raw).trim().toLowerCase()
        .replace(/^[a-z]+:\/\//, '')
        .replace(/[/?#].*$/, '')
        .replace(/:\d+$/, '')
        .replace(/\.+$/, '');
}

/** يتحقق من صلاحية النطاق. يعيد {ok, domain} أو {error}. */
export function validateDomain(raw) {
    const domain = normalizeDomain(raw);
    if (!domain) return { error: 'اكتب النطاق أولاً (مثل mystore.com).' };
    if (PLATFORM_DOMAIN_RE.test(domain)) return { error: 'هذا نطاق منصة استضافة — اربط نطاقاً تملكه أنت (مثل mystore.com).' };
    if (!DOMAIN_RE.test(domain)) return { error: `«${domain}» ليس نطاقاً صالحاً — الشكل المتوقع: mystore.com أو shop.mystore.com.` };
    return { ok: true, domain };
}

/**
 * سجلات DNS المطلوبة عند مسجّل النطاق:
 * - نطاق جذر (mystore.com) → سجل A يشير لعنوان Vercel.
 * - نطاق فرعي (shop.mystore.com / www...) → CNAME.
 */
export function dnsInstructionsFor(domain) {
    const labels = String(domain).split('.');
    if (labels.length <= 2) {
        return [{ type: 'A', host: '@', value: VERCEL_A_RECORD }];
    }
    return [{ type: 'CNAME', host: labels[0], value: VERCEL_CNAME }];
}

/**
 * اسم مشروع Vercel — مصدر الحقيقة عند النشر وعند ربط النطاق المخصَّص معاً.
 *
 * 🔴 كانت الصيغة تطهّر النصّ المدموج وحده، فتقع في عطبٍ مزدوج على أي اسمٍ
 * لا يحمل محرفاً لاتينياً واحداً — وأسماء المشاريع العربية كلها كذلك:
 *
 *     ('ali', 'متجري')  →  'ali-'
 *     ('ali', 'دكاني')  →  'ali-'      ← **الاسم نفسه**
 *
 * والاسم المنتهي بشَرطة مرفوضٌ عند Vercel أصلاً، فالنشر يفشل. ولو قُبل
 * لكان أسوأ: مشروعان بهويةِ نشرٍ واحدة، فالنطاق المخصَّص المربوط بأحدهما
 * يشير إلى موقع الآخر — وهذا الملفّ نفسه يربط النطاقات بهذا الاسم في
 * ثلاثة مواضع أدناه.
 *
 * الصيغة الآن مبنيّة على `hostNames.js` (نفس بدائيّات اسم خدمة Render —
 * العطب كان واحداً فلا يُصلَح مرّتين). و**ناتجها مطابقٌ حرفياً** للصيغة
 * القديمة في كل مُدخَلٍ كانت تُنتج له اسماً صالحاً أصلاً، فلا يُعاد تسمية
 * مشروعٍ منشورٍ يعمل اليوم — لا يتغيّر إلا ما كان مكسوراً. اختبارٌ يحرس
 * هذا التطابق على مجموعةٍ من الأسماء، لا التعليق وحده.
 */
export function vercelProjectNameOf(username, project) {
    const user = slugPart(username) || 'user';
    const proj = slugPart(project) || nameFingerprint(project);
    return `${user}-${proj}`.slice(0, 100).replace(/-+$/g, '');
}

// ─── التخزين الملفّي ─────────────────────────────────────────────────
function userFile(baseDir, username) {
    const safe = String(username).replace(/[^a-z0-9_\-]/gi, '_').toLowerCase();
    return path.join(baseDir, `${safe}.json`);
}

export function readUserDomains(baseDir, username) {
    try { return JSON.parse(fs.readFileSync(userFile(baseDir, username), 'utf8')); } catch { return {}; }
}

export function saveUserDomain(baseDir, username, project, domain) {
    fs.mkdirSync(baseDir, { recursive: true });
    const all = readUserDomains(baseDir, username);
    all[project] = { domain, addedAt: new Date().toISOString() };
    fs.writeFileSync(userFile(baseDir, username), JSON.stringify(all, null, 2));
    return all[project];
}

export function removeUserDomain(baseDir, username, project) {
    const all = readUserDomains(baseDir, username);
    if (!all[project]) return false;
    delete all[project];
    fs.writeFileSync(userFile(baseDir, username), JSON.stringify(all, null, 2));
    return true;
}

/** عدد النطاقات المربوطة للمستخدم (لفرض حد الخطة). */
export function countUserDomains(baseDir, username) {
    return Object.keys(readUserDomains(baseDir, username)).length;
}

// ─── استدعاءات Vercel ────────────────────────────────────────────────
function authHeaders(env) {
    return { Authorization: `Bearer ${env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
}
function teamQuery(env) {
    return env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : '';
}

/**
 * يربط النطاق بمشروع Vercel المنشور. يعيد {ok, dns, verification} أو {error}.
 */
export async function attachDomain({ username, project, domain }, deps = {}) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    if (!env.VERCEL_TOKEN) return { error: 'ربط النطاقات غير مُفعّل — VERCEL_TOKEN غير مضبوط في بيئة الخادم.', notConfigured: true };

    const vName = vercelProjectNameOf(username, project);
    try {
        const r = await fetchImpl(`${VERCEL_API}/v10/projects/${vName}/domains${teamQuery(env)}`, {
            method: 'POST',
            headers: authHeaders(env),
            body: JSON.stringify({ name: domain }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
            const code = d?.error?.code || '';
            if (r.status === 404 || code === 'not_found') {
                return { error: 'مشروع Vercel غير موجود بعد — انشر موقعك أولاً (زر Deploy) ثم اربط النطاق.' };
            }
            if (code === 'domain_taken' || code === 'conflict' || r.status === 409) {
                return { error: `النطاق «${domain}» مربوط بمشروع آخر على Vercel — فُكّه من هناك أولاً.` };
            }
            if (code === 'forbidden' || r.status === 403) {
                return { error: 'صلاحية التوكن لا تسمح بإدارة النطاقات — تحقق من VERCEL_TOKEN.' };
            }
            return { error: `تعذّر ربط النطاق (${d?.error?.message || r.status}).` };
        }
        return { ok: true, dns: dnsInstructionsFor(domain), verification: d?.verification || [] };
    } catch (e) {
        return { error: 'تعذّر الوصول إلى Vercel: ' + e.message };
    }
}

/**
 * الحالة الحية للنطاق: 'active' يعمل | 'awaiting-dns' سجلات لم تُضبط |
 * 'needs-verification' يتطلب سجل TXT (نُعيده) | {error}.
 */
export async function domainStatus({ username, project, domain }, deps = {}) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    if (!env.VERCEL_TOKEN) return { error: 'VERCEL_TOKEN غير مضبوط.', notConfigured: true };

    const vName = vercelProjectNameOf(username, project);
    try {
        const [projR, cfgR] = await Promise.all([
            fetchImpl(`${VERCEL_API}/v9/projects/${vName}/domains/${domain}${teamQuery(env)}`, { headers: authHeaders(env) }),
            fetchImpl(`${VERCEL_API}/v6/domains/${domain}/config${teamQuery(env)}`, { headers: authHeaders(env) }),
        ]);
        const proj = await projR.json().catch(() => ({}));
        const cfg = await cfgR.json().catch(() => ({}));
        if (!projR.ok) {
            return { error: projR.status === 404 ? 'النطاق غير مربوط بالمشروع — اربطه أولاً.' : `تعذّر قراءة الحالة (${projR.status}).` };
        }
        if (proj.verified === false) {
            return { status: 'needs-verification', verification: proj.verification || [], dns: dnsInstructionsFor(domain) };
        }
        if (cfg.misconfigured) {
            return { status: 'awaiting-dns', dns: dnsInstructionsFor(domain) };
        }
        return { status: 'active', dns: dnsInstructionsFor(domain) };
    } catch (e) {
        return { error: 'تعذّر الوصول إلى Vercel: ' + e.message };
    }
}

/** يفكّ النطاق عن المشروع. */
export async function detachDomain({ username, project, domain }, deps = {}) {
    const env = deps.env || process.env;
    const fetchImpl = deps.fetchImpl || fetch;
    if (!env.VERCEL_TOKEN) return { error: 'VERCEL_TOKEN غير مضبوط.', notConfigured: true };
    const vName = vercelProjectNameOf(username, project);
    try {
        const r = await fetchImpl(`${VERCEL_API}/v9/projects/${vName}/domains/${domain}${teamQuery(env)}`, {
            method: 'DELETE',
            headers: authHeaders(env),
        });
        if (!r.ok && r.status !== 404) {
            const d = await r.json().catch(() => ({}));
            return { error: `تعذّر فكّ النطاق (${d?.error?.message || r.status}).` };
        }
        return { ok: true };
    } catch (e) {
        return { error: 'تعذّر الوصول إلى Vercel: ' + e.message };
    }
}
