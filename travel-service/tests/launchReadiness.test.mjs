// 🚦 جاهزية الإطلاق التجاري: الخدمة تقول ما ينقصها في سجلّ الاستضافة، بدل
// أن تبقى القائمة في محادثةٍ أو في رأس أحد.
//
// القاعدة **تعارضٌ لا «غير حيّ»**: أول نسخةٍ أعلنت على بيئة تطويرٍ كلّها
// محاكاة «٧ موانع» — إنذارٌ يصرخ بلا خطر يُدرَّب قارئه على تجاهله. هذه
// الاختبارات تحرس التمييز نفسه.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { collectLaunchBlockers, formatLaunchReport } from '../src/launchReadiness.js';

const idsOf = (b) => b.map((x) => x.id);
const call = (over = {}) => collectLaunchBlockers({
    nonLiveProducts: [], liveProducts: [], trustedNonLiveProducts: [], allowNonLiveProducts: false,
    storeName: 'postgres', stripeMode: 'live', hasStripeWebhookSecret: true, percentIssueCount: 0, ...over,
});

describe('🚦 جاهزية الإطلاق', () => {
    test('الإعداد الجاهز فعلاً: لا مانع ولا تنبيه', () => {
        const b = call({ liveProducts: ['flights', 'stays'] });
        assert.deepEqual(b, []);
        assert.deepEqual(formatLaunchReport(b), ['🚦 جاهزية الإطلاق التجاري: ✅ لا مانع.']);
    });

    test('بيئة تطويرٍ كاملة: وصفٌ واحد لا سبعة موانع', () => {
        const b = call({
            stripeMode: null, storeName: 'file',
            nonLiveProducts: ['flights', 'stays', 'cars', 'esim'],
        });
        assert.deepEqual(idsOf(b), ['dev_environment']);
        assert.equal(b[0].level, 'info');
        assert.match(formatLaunchReport(b)[0], /✅ لا مانع/);
    });

    test('⛔ مالٌ حقيقي بجانب مزوّدٍ تجريبي — لكلّ منتجٍ مانعُه', () => {
        const b = call({ liveProducts: ['flights'], nonLiveProducts: ['stays', 'esim'] });
        assert.deepEqual(idsOf(b), ['paid_but_fake_stays', 'paid_but_fake_esim']);
        assert.match(b[0].text, /الفنادق/);
        assert.match(b[0].text, /TRAVEL_DISABLED_PRODUCTS/);
    });

    test('المستثنى صراحةً يُقال عنه ذلك — لا يُخلط بمن نسيه المالك', () => {
        const [b] = call({
            liveProducts: ['flights'], nonLiveProducts: ['stays'], trustedNonLiveProducts: ['stays'],
        });
        assert.match(b.text, /مستثنى صراحةً/);
        assert.match(b.text, /TRAVEL_TRUSTED_NON_LIVE_PRODUCTS/);
    });

    test('⛔ حجزٌ حقيقي بلا تحصيل — الاتجاه الذي يخسر', () => {
        const t = call({ liveProducts: ['flights'], stripeMode: 'test' });
        assert.deepEqual(idsOf(t), ['booked_but_unpaid']);
        assert.match(t[0].text, /Stripe تجريبي/);
        const n = call({ liveProducts: ['flights'], stripeMode: null });
        assert.deepEqual(idsOf(n), ['booked_but_unpaid']);
        assert.match(n[0].text, /بلا تحصيل إلكتروني/);
    });

    test('وضع Stripe غير المعروف مانعٌ دائماً — «لا أعرف» ليست «حيّاً»', () => {
        assert.ok(idsOf(call({ stripeMode: 'unknown' })).includes('stripe_unknown'));
        assert.ok(idsOf(call({ stripeMode: 'unknown', liveProducts: ['flights'] })).includes('stripe_unknown'));
    });

    test('الحارس المعطَّل: مانعٌ حيث يوجد ما يحرسه، وتنبيهٌ حيث لا شيء', () => {
        const real = call({ liveProducts: ['flights'], allowNonLiveProducts: true });
        assert.ok(idsOf(real).includes('guard_disabled'));
        assert.equal(real.find((x) => x.id === 'guard_disabled').level, 'blocker');

        const dev = call({ stripeMode: null, allowNonLiveProducts: true, nonLiveProducts: ['flights'] });
        const g = dev.find((x) => x.id === 'guard_disabled_dev');
        assert.ok(g && g.level === 'warn', 'في التطوير تنبيهٌ لا مانع');
        assert.match(g.text, /يصير خطراً لحظةَ/);
    });

    test('نسبةٌ فاسدة مانعٌ حتى في التطوير — إعدادٌ معطوبٌ بذاته', () => {
        assert.ok(idsOf(call({ percentIssueCount: 2 })).includes('percent_config'));
        assert.ok(idsOf(call({ stripeMode: null, percentIssueCount: 1 })).includes('percent_config'));
    });

    test('التخزين الملفّي: مانعٌ مع بياناتٍ حقيقية، ومقبولٌ في التطوير', () => {
        assert.ok(idsOf(call({ liveProducts: ['flights'], storeName: 'file' })).includes('file_store'));
        assert.ok(!idsOf(call({ stripeMode: null, storeName: 'file' })).includes('file_store'));
    });

    test('التقرير يعدّ الموانع والتنبيهات ويفصلهما', () => {
        const lines = formatLaunchReport(call({
            liveProducts: ['flights'], nonLiveProducts: ['stays'],
            storeName: 'file', hasStripeWebhookSecret: false,
        }));
        assert.match(lines[0], /⛔ 2 مانع و1 تنبيه/);
        assert.equal(lines.filter((l) => l.includes('⛔')).length, 3); // الترويسة + مانعان
        assert.equal(lines.filter((l) => l.includes('⚠️')).length, 1);
    });

    test('🔒 لا قيمة سرٍّ في أي نصّ — الأوضاع والأسماء فقط', () => {
        const all = formatLaunchReport(call({
            stripeMode: 'unknown', liveProducts: ['flights'], nonLiveProducts: ['stays'],
            percentIssueCount: 1, storeName: 'file', allowNonLiveProducts: true, hasStripeWebhookSecret: false,
        })).join('\n');
        for (const s of ['sk_', 'rk_', 'whsec_', 'sand_', 'prod_', 'duffel_'])
            assert.ok(!all.includes(s), `تسريب: ${s}`);
    });

    test('المدخلات الغائبة لا تُسقط التقرير — عقدٌ متسامح', () => {
        const b = collectLaunchBlockers();
        assert.deepEqual(idsOf(b), ['dev_environment']);
        assert.equal(formatLaunchReport().length, 1);
    });
});
