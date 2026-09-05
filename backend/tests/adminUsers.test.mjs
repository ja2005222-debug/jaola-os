// 👥 إدارةُ المستخدمين من لوحة الأدمِن — وحدةٌ تمسّ الفوترة، وكانت بلا تغطية.
//
// ترويستُها تحذّر بنفسها: «الخطة الفعّالة تُشتقّ من status + currentPeriodEnd
// معاً، لا من plan وحدها — تغيير يدوي يجب أن يضبط status أيضاً وإلا يبقى
// المستخدم على المجانية فعلياً رغم تغيير الحقل». هذا الملفُّ يثبّت ذلك العقد
// **بوصله بالمستهلك الحقيقيّ** `subscriptionService` لا بادّعاءِ حقلٍ وحدَه.
import { test } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { listUsers, setUserPlan } from '../services/adminUsers.js';
import { getUserSubscription } from '../services/subscriptionService.js';

const setReady = (v) => Object.defineProperty(mongoose.connection, 'readyState', { value: v, configurable: true });

/** يجعل الطبقةَ تظنّ أنّها متصلة ويعترض عمليّات النماذج. */
function withDb({ found = null, users = [], counts = [] } = {}) {
    const User = mongoose.models.User;
    const Project = mongoose.models.Project;
    const real = { fu: User.findOneAndUpdate, f: User.find, c: User.countDocuments, a: Project.aggregate };
    const seen = {};
    User.findOneAndUpdate = (filter, update) => {
        seen.filter = filter; seen.update = update;
        return { select: () => (found ? { ...found, subscription: update.$set && {
            plan: update.$set['subscription.plan'],
            status: update.$set['subscription.status'],
            currentPeriodEnd: update.$set['subscription.currentPeriodEnd'],
        } } : null) };
    };
    const chain = { select: () => chain, sort: () => chain, skip: () => chain, limit: () => chain, lean: async () => users };
    User.find = (f) => { seen.listFilter = f; return chain; };
    User.countDocuments = async () => users.length;
    Project.aggregate = async () => counts;
    setReady(1);
    return { seen, restore() {
        User.findOneAndUpdate = real.fu; User.find = real.f;
        User.countDocuments = real.c; Project.aggregate = real.a; setReady(0);
    } };
}

test('العقد الذي تحذّر منه الترويسة: الخطةُ والحالةُ تُضبطان معاً', async () => {
    const db = withDb({ found: { username: 'u' } });
    try {
        const r = await setUserPlan('U', 'pro');
        assert.strictEqual(r.success, true);
        assert.strictEqual(r.status, 'active', 'غيرُ المجانية تُفعَّل');
        // 🔑 الوصلُ بالمستهلك الحقيقيّ: أتُقرأ الخطةُ فعّالةً فعلاً؟
        const eff = getUserSubscription({ subscription: {
            plan: r.plan, status: r.status, currentPeriodEnd: null } });
        assert.strictEqual(eff.planId, 'pro', 'المنحةُ اليدويّة سارية، لا مجانيّةٌ صامتة');
    } finally { db.restore(); }
});

test('المجانيّةُ تُعاد إلى none — لا active على خطةٍ مجانية', async () => {
    const db = withDb({ found: { username: 'u' } });
    try {
        const r = await setUserPlan('u', 'free');
        assert.strictEqual(r.status, 'none');
    } finally { db.restore(); }
});

test('اسمُ المستخدم يُطبَّع كما يُخزَّن (lowercase في النموذج)', async () => {
    const db = withDb({ found: { username: 'ahmed' } });
    try {
        await setUserPlan('AhMeD', 'pro');
        assert.strictEqual(db.seen.filter.username, 'ahmed', 'يُصغَّر قبل الاستعلام');
    } finally { db.restore(); }
});

// الوحدةُ تُصغّر ولا تُشذّب. الفراغُ لا يصل القاعدةَ مع ذلك: صبُّ mongoose
// يُطبّق `trim`/`lowercase` من النموذج على فلتر الاستعلام. مقيسٌ لا مفترَض —
// لذا يُثبَّت هنا الطريقُ كاملاً لا نصفُه: لو رُفع `trim` عن النموذج ظنّاً
// أنّ الخدمةَ تُشذّب، سقط هذا الاختبار.
test('الفراغُ المحيط لا يصل القاعدة — صبُّ النموذج يُشذّبه', async () => {
    const db = withDb({ found: { username: 'ahmed' } });
    let filter;
    try {
        await setUserPlan('  AhMeD  ', 'pro');
        filter = db.seen.filter;
    } finally { db.restore(); }          // الصبُّ يحتاج الاستعلامَ الحقيقيّ لا البديل
    assert.strictEqual(filter.username, '  ahmed  ', 'الخدمةُ تُصغّر ولا تُشذّب');
    const q = User.findOneAndUpdate(filter, { $set: {} });
    q.cast(User);
    assert.strictEqual(q.getFilter().username, 'ahmed', 'النموذجُ يُغلق ما تركته الخدمة');
});

test('خطةٌ غير صالحة تُرفض قبل أيّ كتابة', async () => {
    const db = withDb({ found: { username: 'u' } });
    try {
        const r = await setUserPlan('u', 'مخترَعة');
        assert.match(r.error, /خطة غير صالحة/);
        assert.strictEqual(db.seen.filter, undefined, 'لم تُلمَس قاعدةُ البيانات');
    } finally { db.restore(); }
});

test('مستخدمٌ غير موجود يُقال لا يُبتلَع', async () => {
    const db = withDb({ found: null });
    try {
        assert.match((await setUserPlan('ghost', 'pro')).error, /غير موجود/);
    } finally { db.restore(); }
});

test('بلا اتصال: لا دعوى نجاحٍ في التعديل ولا قائمةٌ فارغةٌ تُقرأ «لا مستخدمين»', async () => {
    setReady(0);
    assert.match((await setUserPlan('u', 'pro')).error, /غير متصلة/);
    const l = await listUsers();
    assert.strictEqual(l.offline, true, 'العجزُ يُعلَن — والواجهةُ تقرؤه');
    assert.deepStrictEqual([l.total, l.users], [0, []]);
});

test('القائمة: البحثُ يُهرَّب، والعدُّ يُوصَل، ولا حقولَ حسّاسة', async () => {
    const db = withDb({
        users: [{ username: 'a', email: 'a@x', subscription: { plan: 'pro', status: 'active' } }],
        counts: [{ _id: 'a', count: 3 }],
    });
    try {
        const r = await listUsers({ search: 'a.*b' });
        assert.strictEqual(r.total, 1);
        assert.strictEqual(r.users[0].projectCount, 3);
        assert.strictEqual(r.users[0].plan, 'pro');
        assert.ok(!('password' in r.users[0]) && !('githubToken' in r.users[0]));
        // النقطةُ والنجمةُ مُهرَّبتان فلا تصير الرقعةُ نمطاً يطابق كلَّ شيء
        assert.ok(db.seen.listFilter.$or[0].username.source.includes('a\\.\\*b'));
    } finally { db.restore(); }
});
