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
export function getUsage(userDoc, projectCount = 0) {
    const { planId, limits, status, currentPeriodEnd } = getUserSubscription(userDoc);
    const limit = limits.projects;
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
