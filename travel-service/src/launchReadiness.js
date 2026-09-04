/**
 * 🚦 جاهزية الإطلاق التجاري — حكمٌ واحد تقوله الخدمة عن نفسها
 *
 * الإعدادات التي تقرّر «هل يُحصَّل مالٌ حقيقي مقابل ما لا يوجد؟» موزّعةٌ
 * على متغيّرات بيئةٍ عند الاستضافة، ولا يُعلن عند الإقلاع إلا بعضها. فمن
 * يقرأ سجلّ الاستضافة لا يعرف أن الفنادق ما تزال على مفتاح تجريبي، ولا أن
 * الحارس معطَّل كلياً، ولا أن Stripe في وضع اختبار بينما التذاكر تُصدر
 * حقيقيةً.
 *
 * 🎯 **القاعدة تعارضٌ لا «غير حيّ»**. أول نسخةٍ من هذا الملف كانت تعدّ كل
 * منتجٍ غير حيٍّ مانعاً، فأعلنت على بيئة تطويرٍ كلّها محاكاة «٧ موانع».
 * إنذارٌ يصرخ حيث لا خطر يُدرَّب قارئه على تجاهله — وهو نفس العطب الذي
 * تُصلحه هذه الشجرة. كشفه تشغيلُ الخدمة فعلاً لا قراءةُ الكود.
 *
 * فالخطر في **اختلال الطرفين**:
 *   • مالٌ حقيقي (Stripe حيّ) بجانب منتجٍ مزوّده تجريبي → يدفع المسافر
 *     مقابل حجزٍ لا وجود له.
 *   • حجزٌ حقيقي (مزوّد حيّ) بلا مالٍ حقيقي (Stripe تجريبي أو غائب) →
 *     تُصدر التذكرة ولا يصلك ثمنها.
 * وحين لا مالَ ولا حجزَ حقيقيَّين فهي بيئة تطوير، تُوصف ولا يُنذَر منها.
 *
 * 🔒 ولا تُطبع قيمة سرٍّ واحدة: الأوضاع والأسماء فقط.
 */

const PRODUCT_AR = { flights: 'الطيران', stays: 'الفنادق', cars: 'السيارات', esim: 'شرائح eSIM' };
const productName = (id) => PRODUCT_AR[id] || id;
const listAr = (ids) => ids.map(productName).join(' و');

/**
 * @returns {{id: string, level: 'blocker'|'warn'|'info', text: string}[]}
 *   `blocker` يمنع الإطلاق التجاري، `warn` يُقلّص الأمان لا يمنعه،
 *   `info` وصفُ حالٍ لا خطرَ فيه.
 */
export function collectLaunchBlockers({
    nonLiveProducts = [],        // معروضٌ ومزوّده غير حيّ (محسوب في server.js)
    liveProducts = [],           // معروضٌ ومزوّده حيّ (نفس المصدر، مرشّحٌ معاكس)
    trustedNonLiveProducts = [], // ما استُثني صراحةً من الحارس
    allowNonLiveProducts = false,// TRAVEL_ALLOW_NON_LIVE_PRODUCTS=1 — يعطّل الحارس كله
    storeName = null,
    stripeMode = null,           // من stripeKeyMode: 'live' | 'test' | 'unknown' | null
    hasStripeWebhookSecret = false,
    percentIssueCount = 0,       // من collectPercentConfigIssues (تفاصيلها تُطبع منفصلة)
} = {}) {
    const out = [];
    const moneyReal = stripeMode === 'live';
    const bookingReal = liveProducts.length > 0;
    const anythingReal = moneyReal || bookingReal;

    // ── ١) وضعٌ غير معروف: لا يُفترض فيه خيرٌ ولا شر، يُسأل عنه ──────────
    if (stripeMode === 'unknown') {
        out.push({
            id: 'stripe_unknown', level: 'blocker',
            text: 'مفتاح Stripe لا يحمل `_live_` ولا `_test_` — وضعه غير معروف. تحقّق منه قبل الإطلاق («لا أعرف» ليست «حيّاً»).',
        });
    }

    // ── ٢) التعارضان اللذان يكلّفان مالاً ────────────────────────────────
    if (moneyReal && nonLiveProducts.length) {
        for (const id of nonLiveProducts) {
            const trusted = trustedNonLiveProducts.includes(id);
            out.push({
                id: `paid_but_fake_${id}`, level: 'blocker',
                text: `${productName(id)}: يُدفع ثمنه بمالٍ حقيقي ومزوّده تجريبي${trusted
                    ? ' — مستثنى صراحةً بـTRAVEL_TRUSTED_NON_LIVE_PRODUCTS. أزل الاستثناء أو انقله لمفتاح إنتاجي.'
                    : '. عطّله بـTRAVEL_DISABLED_PRODUCTS أو انقله لمفتاح إنتاجي.'}`,
            });
        }
    }
    if (bookingReal && !moneyReal) {
        out.push({
            id: 'booked_but_unpaid', level: 'blocker',
            text: `${listAr(liveProducts)}: حجزٌ حقيقي ${stripeMode === 'test' ? 'ومفتاح Stripe تجريبي' : 'وبلا تحصيل إلكتروني'} — تُصدر الحجوزات ولا يصلك ثمنها.`,
        });
    }

    // ── ٣) حارسٌ معطَّل: خطرٌ فقط حين يوجد ما يحرسه ──────────────────────
    if (allowNonLiveProducts && anythingReal) {
        out.push({
            id: 'guard_disabled', level: 'blocker',
            text: 'حارس الإنتاج معطَّل كلياً (TRAVEL_ALLOW_NON_LIVE_PRODUCTS=1) — يُعرض كل منتجٍ مهما كان مزوّده. احذف المتغيّر.',
        });
    } else if (allowNonLiveProducts) {
        out.push({
            id: 'guard_disabled_dev', level: 'warn',
            text: 'حارس الإنتاج معطَّل (TRAVEL_ALLOW_NON_LIVE_PRODUCTS=1) — لا ضرر الآن، لكنه يصير خطراً لحظةَ يصير مفتاحٌ واحد حيّاً.',
        });
    }

    // ── ٤) إعدادٌ فاسدٌ بذاته — لا يعتمد على وجود مالٍ حقيقي ─────────────
    if (percentIssueCount > 0) {
        out.push({
            id: 'percent_config', level: 'blocker',
            text: `${percentIssueCount} متغيّر نسبةٍ مضبوطٌ ولا تُستعمل قيمته (التفاصيل أعلاه) — الهامش يعمل بالافتراضي لا بما ضبطتَه.`,
        });
    }

    // ── ٥) ما يخصّ الإنتاج وحده ─────────────────────────────────────────
    if (anythingReal && storeName === 'file') {
        out.push({
            id: 'file_store', level: 'blocker',
            text: 'التخزين بالملفات مع بيانات حقيقية — على قرصٍ مؤقت تُمسح الحجوزات مع كل إعادة نشر. اضبط DATABASE_URL.',
        });
    }
    if (moneyReal && !hasStripeWebhookSecret) {
        out.push({
            id: 'stripe_webhook', level: 'warn',
            text: 'STRIPE_WEBHOOK_SECRET غير مضبوط — التسوية تعتمد على المصالحة الدورية وحدها.',
        });
    }

    // ── ٦) لا مالَ ولا حجزَ حقيقيَّين: وصفٌ لا إنذار ────────────────────
    if (!anythingReal) {
        out.push({
            id: 'dev_environment', level: 'info',
            text: 'بيئة تطوير: لا مزوّد حيّ ولا تحصيل حقيقي — لا مال يتحرك.',
        });
    }

    return out;
}

/** أسطر جاهزة للطباعة — الحكم أولاً ثم كل مانعٍ مرقّماً. */
export function formatLaunchReport(blockers = []) {
    const hard = blockers.filter((b) => b.level === 'blocker');
    const soft = blockers.filter((b) => b.level === 'warn');
    const info = blockers.filter((b) => b.level === 'info');

    const tail = soft.length ? ` و${soft.length} تنبيه` : '';
    const lines = [hard.length
        ? `🚦 جاهزية الإطلاق التجاري: ⛔ ${hard.length} مانع${tail}.`
        : `🚦 جاهزية الإطلاق التجاري: ✅ لا مانع${tail ? ` —${tail.slice(2)}` : '.'}`];
    hard.forEach((b, i) => lines.push(`   ${i + 1}. ⛔ ${b.text}`));
    soft.forEach((b) => lines.push(`   • ⚠️ ${b.text}`));
    info.forEach((b) => lines.push(`   • ℹ️ ${b.text}`));
    return lines;
}

export default { collectLaunchBlockers, formatLaunchReport };
