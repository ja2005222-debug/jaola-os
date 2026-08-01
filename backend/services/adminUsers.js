/**
 * 👥 إدارة المستخدمين من لوحة الأدمِن — قائمة/بحث + تغيير خطة يدوي.
 *
 * ملاحظة حرجة (subscriptionService.js): الخطة الفعّالة تُشتقّ من status +
 * currentPeriodEnd معاً، لا من plan وحدها — تغيير يدوي يجب أن يضبط status
 * أيضاً (active لغير المجانية، none للمجانية) وإلا يبقى المستخدم على
 * المجانية فعلياً رغم تغيير الحقل. currentPeriodEnd فارغ = بلا انتهاء.
 */

import mongoose from 'mongoose';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { PLANS } from '../config/plans.js';

const SAFE_FIELDS = 'username email subscription createdAt provider githubLogin';
const online = () => mongoose.connection.readyState === 1;

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** قائمة المستخدمين (بحث + صفحات) مع عدد مشاريع كل واحد. لا حقول حسّاسة أبداً. */
export async function listUsers({ search = '', limit = 50, skip = 0 } = {}) {
    if (!online()) return { total: 0, users: [], offline: true };
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
    const filter = search
        ? { $or: [{ username: new RegExp(escapeRegex(search), 'i') }, { email: new RegExp(escapeRegex(search), 'i') }] }
        : {};
    const [users, total] = await Promise.all([
        User.find(filter).select(SAFE_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
        User.countDocuments(filter),
    ]);
    const names = users.map(u => u.username);
    const counts = names.length
        ? await Project.aggregate([{ $match: { owner: { $in: names } } }, { $group: { _id: '$owner', count: { $sum: 1 } } }])
        : [];
    const countMap = new Map(counts.map(c => [c._id, c.count]));
    return {
        total,
        users: users.map(u => ({
            username: u.username,
            email: u.email || '',
            provider: u.provider || 'local',
            githubLogin: u.githubLogin || '',
            createdAt: u.createdAt,
            plan: u.subscription?.plan || 'free',
            status: u.subscription?.status || 'none',
            currentPeriodEnd: u.subscription?.currentPeriodEnd || null,
            projectCount: countMap.get(u.username) || 0,
        })),
    };
}

/** يضبط خطة مستخدم يدوياً (تجاوز/منحة/تعويض). currentPeriodEnd اختياري (null = بلا انتهاء). */
export async function setUserPlan(username, planId, currentPeriodEnd = null) {
    if (!online()) return { error: 'قاعدة البيانات غير متصلة — لا يمكن تعديل الخطط الآن.' };
    if (!PLANS[planId]) return { error: `خطة غير صالحة: ${planId}` };
    const status = planId === 'free' ? 'none' : 'active';
    const user = await User.findOneAndUpdate(
        { username: String(username || '').toLowerCase() },
        { $set: { 'subscription.plan': planId, 'subscription.status': status, 'subscription.currentPeriodEnd': currentPeriodEnd } },
        { new: true },
    ).select(SAFE_FIELDS);
    if (!user) return { error: 'المستخدم غير موجود.' };
    return { success: true, username: user.username, plan: user.subscription.plan, status: user.subscription.status };
}
