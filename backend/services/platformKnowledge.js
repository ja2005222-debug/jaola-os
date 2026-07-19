/**
 * 🧠 Platform Knowledge — مصدر معرفة حيّ لمساعد الشات
 *
 * كان المساعد يجهل قدرات المنصة (أجاب "راجع الإعدادات" عن النشر). حللنا ذلك
 * أولاً بنص ثابت في البرومبت، لكنه لا يعرف حقائق المستخدم اللحظية (خطته،
 * استهلاكه، هل مشروعه منشور). هذه الوحدة تحقن الاثنين معاً في البرومبت:
 *
 * - القدرات الثابتة: مصدر واحد مركزي (بدل نص متناثر يتقادم)
 * - الحقائق اللحظية: الخطة + الاستهلاك + حالة نشر المشروع الحالي ورابطه
 *
 * getPlatformKnowledge لا يرمي أبداً — يعود للقدرات الثابتة عند تعذّر DB
 * (وضع الصمود)، فالشات يعمل دائماً.
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { getUsage } from './subscriptionService.js';
import { PLANS } from '../config/plans.js';

// ─── القدرات الثابتة (مصدر واحد — يُحدَّث هنا عند إضافة ميزة) ─────────
export function capabilitiesBlock(lang = 'en') {
    const deploy = lang === 'ar' ? 'انشر' : 'deploy';
    const del = lang === 'ar' ? 'احذف المشروع' : 'delete the project';
    const editEx = lang === 'ar' ? 'غيّر لون الترويسة' : 'change the header color';
    return `- BUILD: the user describes a website in ONE message → the build system builds it (HTML/CSS/JS or a React/Next site) with a live preview that updates automatically.
- EDIT: the user describes a change in chat (e.g. "${editEx}") → applied surgically; the preview refreshes instantly.
- DEPLOY / HOSTING: sites are published to **Vercel**. Click the 🚀 Deploy button or type "${deploy}". Each project gets its own stable public link of the form <username>-<project>.vercel.app.
- RE-DEPLOY: after editing, click 🔄 Re-deploy (or type "${deploy}") to push changes to the live site — the link stays the same.
- CUSTOM DOMAIN: added from Vercel → Project → Settings → Domains.
- GITHUB: the project can be pushed to GitHub (🐙 button).
- FILES: the user can view and open project files in the Editor tab.
- PROJECTS: create a new project (+), switch between projects, or delete the current one ("${del}").
- The platform itself runs on Render; user SITES are hosted on Vercel.`;
}

// ─── الحقائق اللحظية (نقية، قابلة للاختبار) ─────────────────────────
export function liveFactsBlock({ lang = 'en', usage = null, deployUrl = null } = {}) {
    const lines = [];
    if (usage) {
        const plan = PLANS[usage.planId];
        const planName = plan ? (lang === 'ar' ? plan.nameAr : plan.nameEn) : usage.planId;
        const p = usage.projects || {};
        if (p.unlimited) {
            lines.push(`- Current plan: ${planName} — unlimited projects (${p.used ?? 0} created so far).`);
        } else {
            lines.push(`- Current plan: ${planName} — ${p.used ?? 0}/${p.limit} projects used (${p.remaining ?? 0} remaining). Upgrading (💳 Billing) raises the limit.`);
        }
        if (usage.features) {
            lines.push(`- Auto-deploy after each build: ${usage.features.autoDeploy ? 'enabled on this plan' : 'not on this plan (deploy manually with 🚀)'}.`);
        }
    }
    if (deployUrl) {
        lines.push(`- THIS project IS already live at ${deployUrl} — if asked, tell the user they can open it or click 🔄 Re-deploy to update it after edits.`);
    } else {
        lines.push(`- THIS project is NOT deployed yet — to publish it the user clicks 🚀 Deploy (or types the deploy command).`);
    }
    return lines.join('\n');
}

// ─── الكتلة الكاملة للحقن في البرومبت ───────────────────────────────
export function buildKnowledgeBlock({ lang = 'en', usage = null, deployUrl = null } = {}) {
    return `## PLATFORM CAPABILITIES — you KNOW this platform inside out; answer factually when asked "how do I…/what can you do/what hosting/what's my plan". NEVER say "I don't have information, check the settings", and never invent capabilities not listed here:
${capabilitiesBlock(lang)}

## LIVE ACCOUNT & PROJECT STATE (current facts — cite when relevant):
${liveFactsBlock({ lang, usage, deployUrl })}`;
}

// ─── الجامع مع DB — لا يرمي أبداً (صمود) ────────────────────────────
export async function getPlatformKnowledge(username, project, lang = 'en') {
    let usage = null;
    let deployUrl = null;
    try {
        if (mongoose.connection.readyState === 1) {
            const userDoc = await User.findOne({ username }).lean().catch(() => null);
            const projectCount = await Project
                .countDocuments({ owner: username, name: { $ne: 'sandbox_app' } })
                .catch(() => 0);
            usage = getUsage(userDoc, projectCount);
            if (project && project !== 'sandbox_app') {
                const pr = await Project.findOne({ owner: username, name: project }).lean().catch(() => null);
                deployUrl = pr?.vercelUrl || null;
            }
        }
    } catch { /* صمود: نكتفي بالقدرات الثابتة */ }
    return buildKnowledgeBlock({ lang, usage, deployUrl });
}
