// 🗄️ معايرةُ ماسحِ كتابات Mongo، ثمّ الحدُّ الذي يحرسه.
//
// أداةُ القياس تُعايَر بعيّنةٍ حقيقتُها معروفةٌ قبل أن يُوثَق برقمها. وهذا
// الماسحُ أخطأ فعلاً في أوّل صيغةٍ له: التقط الاستيرادَ الساكنَ وحدَه، فسقط
// `services/deployAutomation.js` — وهو من أخطرِ المواضع — من الجرد كلِّه.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { scanMongoWrites, modelIdents, WRITE_OPS } from '../scripts/mongoWrites.mjs';

const BACKEND = path.resolve(import.meta.dirname, '..');

/** يبني شجرةً مؤقّتةً حقيقتُها معروفةٌ سلفاً، ويمسحها. */
function scanFixture(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mongoscan-'));
    try {
        for (const [rel, body] of Object.entries(files)) {
            const p = path.join(dir, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, body);
        }
        return scanMongoWrites(dir);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('الاستيرادُ الديناميكيّ يُلتقط — إغفالُه أسقط deployAutomation من الجرد', () => {
    const r = scanFixture({
        'a.js': "const Project = (await import('../models/Project.js')).default;\nawait Project.updateOne({}, {});\n",
    });
    assert.deepStrictEqual(r.own, ['a.js:2 → Project.updateOne']);
});

test('الاستيرادان الساكنُ والمُعرَّفُ داخليّاً يُلتقطان كذلك', () => {
    const r = scanFixture({
        'b.js': "import User from './models/User.js';\nawait User.create({});\n",
        'c.js': "const KV = mongoose.models.KV || mongoose.model('KV', s);\nawait KV.deleteOne({});\n",
    });
    assert.deepStrictEqual(r.own.sort(), ['b.js:2 → User.create', 'c.js:2 → KV.deleteOne']);
});

test('العمليّةُ لا تُعرّف الوجهة — المستقبِلُ يُعرّفها', () => {
    // `.create(` على مزوّدٍ خارجيّ ليست كتابةً على Mongo. لولا هذا التمييز
    // لعُدَّ كلُّ نداءِ نموذجٍ لغويّ ونداءِ Stripe كتابةً على القاعدة.
    const r = scanFixture({
        'd.js': "import User from './models/User.js';\n"
              + "await groq.chat.completions.create({});\n"
              + "await stripe.paymentIntents.create({});\n"
              + "await prisma.product.create({ data });\n"
              + "await User.create({});\n",
    });
    assert.deepStrictEqual(r.own, ['d.js:5 → User.create'], 'موضعٌ واحدٌ من أربعة');
});

test('القالبُ النصّيّ كودٌ لمشروع المستخدم لا لنا — والتعليقُ لا يُنفَّذ', () => {
    // 🔴 هذان الدلوان فارغان على القرص الحقيقيّ. ولولا عيّنةٌ تملؤهما لكان
    //    «صفرٌ» بلا معنى: لا نعرف أهو نتيجةٌ أم أنّ التصنيفَ لا يعمل أصلاً.
    const r = scanFixture({
        'e.js': "import Project from './models/Project.js';\n"
              + "const tpl = `\n  await Project.deleteMany({});\n`;\n"
              + "// await Project.updateMany({}, {});\n"
              + "await Project.updateOne({}, {});\n",
    });
    assert.deepStrictEqual(r.generated, ['e.js:3 → Project.deleteMany'], 'داخلَ القالب');
    assert.deepStrictEqual(r.inert, ['e.js:5 → Project.updateMany'], 'داخلَ التعليق');
    assert.deepStrictEqual(r.own, ['e.js:6 → Project.updateOne'], 'الحيُّ وحدَه');
});

test('نموذجٌ يُستورد داخل قالبٍ نصّيّ ليس نموذجَنا', () => {
    // `agents/authAgent.js` يولّد كودَ مصادقةٍ لمشروع المستخدم: الاستيرادُ
    // والكتابةُ كلاهما داخلَ القالب. لا يُعدّان علينا.
    const r = scanFixture({
        'f.js': "const gen = `\nimport User from './models/User.js';\nawait User.create({});\n`;\n",
    });
    assert.deepStrictEqual(r.own, []);
    assert.deepStrictEqual(r.generated, []);
    assert.strictEqual(modelIdents(fs.readFileSync(path.join(BACKEND, 'agents/authAgent.js'), 'utf8')).size, 0,
        'authAgent لا يملك نموذجَ Mongo في كوده');
});

test('القراءةُ ليست كتابة', () => {
    const r = scanFixture({
        'g.js': "import User from './models/User.js';\nawait User.findOne({});\nawait User.find({}).lean();\nawait User.countDocuments({});\n",
    });
    assert.deepStrictEqual(r.own, []);
    for (const op of ['find', 'findOne', 'countDocuments', 'aggregate', 'distinct']) {
        assert.ok(!WRITE_OPS.includes(op), `\`${op}\` قراءةٌ ولا مكانَ لها في عمليّات الكتابة`);
    }
});

test('الحدُّ المحروس: لا وكيلَ يكتب على Mongo مباشرةً', () => {
    // نُقلت الكتابةُ الوحيدةُ في `agents/` (رابطُ Vercel) إلى بوّابةِ السجلّ،
    // فصارت الطبقةُ خاليةً. أيُّ عودةٍ تكسر هذا السطر.
    const { own } = scanMongoWrites(BACKEND);
    const agents = own.filter((s) => s.startsWith('agents/'));
    assert.deepStrictEqual(agents, [], `طبقةُ الوكلاء لا تلمس القاعدة:\n${agents.join('\n')}`);
});

test('مواضعُ حقائقِ المشروع الثلاثةُ تمرّ بالبوّابة', () => {
    const gate = /saveProjectFields\s*\(/;
    for (const f of ['agents/deployAgent.js', 'services/deployAutomation.js', 'server.js']) {
        const src = fs.readFileSync(path.join(BACKEND, f), 'utf8');
        assert.match(src, gate, `${f} يحفظ حقائقَ المشروع عبر البوّابة`);
    }
    // ولا يعود أحدُهم إلى النموذج مباشرةً من وراءِ ظهرِها.
    const dep = fs.readFileSync(path.join(BACKEND, 'services/deployAutomation.js'), 'utf8');
    assert.ok(!/models\/Project\.js/.test(dep), 'deployAutomation لا يستورد النموذجَ بعد اليوم');
    const agent = fs.readFileSync(path.join(BACKEND, 'agents/deployAgent.js'), 'utf8');
    assert.ok(!/models\/Project\.js/.test(agent), 'deployAgent لا يستورد النموذجَ بعد اليوم');
});

test('حارسُ الخواء: المسحُ بلغ الطبقاتِ التي ندّعي فحصَها', () => {
    // 🔴 يُقاس **ما مُسح** لا ما نتج: لو نتج صفرٌ لأنّ المسحَ لم يبلغ
    //    `services/` أصلاً لمرّ الاختبارُ السابقُ مرورَ الظافر.
    const { own } = scanMongoWrites(BACKEND);
    for (const layer of ['services/', 'routes/']) {
        assert.ok(own.some((s) => s.startsWith(layer)), `لم يُمسح \`${layer}\``);
    }
    assert.ok(own.some((s) => s.startsWith('server.js')), 'لم يُمسح `server.js`');
    assert.ok(own.length >= 15, `الجردُ انهار إلى ${own.length} موضعاً — الماسحُ معطوبٌ لا المستودعُ نظيف`);
});
