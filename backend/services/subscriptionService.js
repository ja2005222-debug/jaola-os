/**
 * 🧾 Subscription Service — JAOLA OS
 *
 * منطق الاشتراك والاستهلاك وفرض حدود الخطة. مستقل عن Stripe تماماً كي
 * يبقى قابلاً للاختبار: Stripe يُحدّث حقول المستخدم، وهذا الملف يقرأها.
 *
 * - getUserSubscription: الخطة الحالية + الحالة من وثيقة المستخدم (مع افتراض مجاني)
 * - getUsage: استهلاك المستخدم الفعلي (عدد المشاريع)
 * - canCreateProject: هل يسمح حدّ الخطة بمشروع جديد؟
 * - hasFeature: هل الخطة تتيح ميزة (autoDeploy/customAgents…)؟
 */

import { getPlan, DEFAULT_PLAN, UNLIMITED } from '../config/plans.js';

/**
 * يستخرج اشتراك المستخدم من وثيقته. يقبل كائن المستخدم مباشرة كي يبقى
 * قابلاً للاختبار دون قاعدة بيانات.
 */
export function getUserSubscription(userDoc) {
    const sub = userDoc?.subscription || {};
    // الاشتراك فعّال فقط إن كانت الحالة active/trialing ولم تنتهِ المدة
    const active = ['active', 'trialing'].includes(sub.status);
    const notExpired = !sub.currentPeriodEnd || new Date(sub.currentPeriodEnd) > new Date();
    const planId = (active && notExpired && sub.plan) ? sub.plan : DEFAULT_PLAN;

    const plan = getPlan(planId);
    return {
        planId: plan.id,
        status: sub.status || 'none',
        currentPeriodEnd: sub.currentPeriodEnd || null,
        cancelAtPeriodEnd: !!sub.cancelAtPeriodEnd,
        limits: plan.limits,
    };
}

/**
 * استهلاك المستخدم. projectCount يُمرَّر من طبقة أعلى (تعدّها من DB) كي
 * يبقى هذا الملف خالياً من الاعتماديات.
 */
export function getUsage(userDoc, projectCount = 0, botAiUsed = 0) {
    const { planId, limits, status, currentPeriodEnd } = getUserSubscription(userDoc);
    const limit = limits.projects;
    const botLimit = limits.botAiMessages ?? 0;
    return {
        planId,
        status,
        currentPeriodEnd,
        projects: {
            used: projectCount,
            limit: limit === UNLIMITED ? null : limit,
            remaining: limit === UNLIMITED ? null : Math.max(0, limit - projectCount),
            unlimited: limit === UNLIMITED,
        },
        botAi: {
            used: botAiUsed,
            limit: botLimit === UNLIMITED ? null : botLimit,
            remaining: botLimit === UNLIMITED ? null : Math.max(0, botLimit - botAiUsed),
            unlimited: botLimit === UNLIMITED,
        },
        features: {
            autoDeploy: limits.autoDeploy,
            prioritySupport: limits.prioritySupport,
            customAgents: limits.customAgents,
            privateHosting: limits.privateHosting,
        },
    };
}

/** هل يمكن للمستخدم إنشاء مشروع جديد ضمن حدّ خطته؟ */
export function canCreateProject(userDoc, currentProjectCount = 0) {
    const { limits, planId } = getUserSubscription(userDoc);
    const limit = limits.projects;
    if (limit === UNLIMITED) return { allowed: true, planId };
    if (currentProjectCount < limit) return { allowed: true, planId, remaining: limit - currentProjectCount };
    return {
        allowed: false,
        planId,
        limit,
        reason: `خطتك (${planId}) تسمح بـ ${limit} مشاريع فقط. رقِّ إلى Pro لمشاريع غير محدودة.`,
    };
}

/** هل تتيح خطة المستخدم ميزة معينة؟ */
export function hasFeature(userDoc, feature) {
    const { limits } = getUserSubscription(userDoc);
    return !!limits[feature];
}

/**
 * حصة ذكاء البوت الحيّ الشهرية لصاحب الموقع (Infinity = بلا حدود).
 * userDoc غائب (offline أو غير موجود) → حصة الخطة المجانية.
 */
export function botAiQuota(userDoc) {
    const { limits, planId } = getUserSubscription(userDoc);
    return { planId, monthly: limits.botAiMessages ?? 0 };
}

/** حصة الردود البريدية الشهرية من الداشبورد (Infinity = بلا حدود). */
export function emailQuota(userDoc) {
    const { limits, planId } = getUserSubscription(userDoc);
    return { planId, monthly: limits.emails ?? 0 };
}

/** سقف عدد الوكلاء المخصّصين للخطة (Infinity = بلا حدود). */
export function customAgentsMax(userDoc) {
    const { limits, planId } = getUserSubscription(userDoc);
    return { planId, max: limits.customAgentsMax ?? 1 };
}

/** حصة صور AI الحقيقية الشهرية (Infinity = بلا حدود). */
export function aiImagesQuota(userDoc) {
    const { limits, planId } = getUserSubscription(userDoc);
    return { planId, monthly: limits.aiImages ?? 0 };
}

/** حصة المنشورات المنشورة مباشرة للقنوات شهرياً (Infinity = بلا حدود). */
export function socialQuota(userDoc) {
    const { limits, planId } = getUserSubscription(userDoc);
    return { planId, monthly: limits.socialPosts ?? 0 };
}

/** 🌐 حد النطاقات الخاصة بالخطة (المجانية 0 — ميزة مدفوعة) */
export function customDomainsMax(userDoc) {
    const { limits, planId } = getUserSubscription(userDoc);
    return { planId, max: limits.customDomainsMax ?? 0 };
}

/** 📈 سقف قائمة متابعة مستشار الأسهم/الفوركس حسب الخطة — نفس منطق cryptoWatchlistMax. */
export function stockWatchlistMax(userDoc) {
    const { limits, planId } = getUserSubscription(userDoc);
    return { planId, max: limits.stockWatchlistMax ?? 5 };
}

/** 📊 سقف قائمة متابعة مستشار الكريبتو حسب الخطة (Infinity لا يُستخدم هنا — سقف تقني ثابت أيضاً). */
export function cryptoWatchlistMax(userDoc) {
    const { limits, planId } = getUserSubscription(userDoc);
    return { planId, max: limits.cryptoWatchlistMax ?? 5 };
}
