// 🔑 مسارُ التحقق من التوكن — يمرّ به كلُّ طلبٍ مُصادَق وكلُّ اتصال socket
// (`server.js` 581 و599 و707 و826 و1037)، وكان بلا تغطية.
//
// جوهرُه تدويرُ المفتاح: التوقيعُ بالسرّ الحالي دوماً، والسابقُ يُقبل للتحقق
// وحدَه أثناء التدوير فلا يُخرَج المستخدمون. وهو ضمانٌ يسقط بصمتٍ إن تحقّق
// موضعٌ واحدٌ بسرٍّ مفرد — فيَقبل طريقٌ ما يرفضه آخر.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { getJwtSecret, getJwtVerifySecrets, verifyJwt, authenticate } from '../utils/auth.js';

const BACKEND = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** يضبط متغيّراتِ البيئة لهذا الاختبار ثمّ يُعيدها كما كانت. */
function withEnv(vars, fn) {
    const old = {};
    for (const [k, v] of Object.entries(vars)) {
        old[k] = process.env[k];
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    try { return fn(); } finally {
        for (const [k, v] of Object.entries(old)) {
            if (v === undefined) delete process.env[k]; else process.env[k] = v;
        }
    }
}

test('التدوير: توكنُ السرّ السابق يُقبل، والحاليُّ يُقبل، والغريبُ يُرفض', () => {
    withEnv({ JWT_SECRET: 'الحالي', JWT_SECRET_PREVIOUS: 'السابق' }, () => {
        const cur = jwt.sign({ u: 'a' }, 'الحالي');
        const prev = jwt.sign({ u: 'b' }, 'السابق');
        const alien = jwt.sign({ u: 'c' }, 'مُختلَق');
        assert.strictEqual(verifyJwt(cur).u, 'a', 'رُفض توكنُ السرّ الحالي');
        assert.strictEqual(verifyJwt(prev).u, 'b', 'التدويرُ يُخرج المستخدمين — وهو ما يمنعه السرّ السابق');
        assert.throws(() => verifyJwt(alien), /invalid signature|jwt/i, 'قُبل توكنٌ بسرٍّ لا نعرفه');
    });
});

test('بعد انتهاء التدوير: توكنُ السرّ السابق يُرفض', () => {
    const prev = withEnv({ JWT_SECRET: 'الحالي', JWT_SECRET_PREVIOUS: 'السابق' },
        () => jwt.sign({ u: 'b' }, 'السابق'));
    withEnv({ JWT_SECRET: 'الحالي', JWT_SECRET_PREVIOUS: undefined }, () => {
        assert.deepStrictEqual(getJwtVerifySecrets(), ['الحالي'], 'السابقُ ما زال مقبولاً بعد رفعه');
        assert.throws(() => verifyJwt(prev));
    });
});

test('التوقيعُ بالحالي دوماً — السابقُ للتحقق لا للإصدار', () => {
    withEnv({ JWT_SECRET: 'الحالي', JWT_SECRET_PREVIOUS: 'السابق' }, () => {
        assert.strictEqual(getJwtSecret(), 'الحالي');
        assert.strictEqual(getJwtVerifySecrets()[0], 'الحالي', 'الحاليُّ ليس أوّلَ ما يُجرَّب');
    });
});

test('توكنٌ منتهي الصلاحية يُرفض ولو وُقّع بالسرّ الصحيح', () => {
    withEnv({ JWT_SECRET: 'الحالي', JWT_SECRET_PREVIOUS: undefined }, () => {
        const expired = jwt.sign({ u: 'a' }, 'الحالي', { expiresIn: '-1s' });
        assert.throws(() => verifyJwt(expired), /expired/i);
    });
});

test('غيابُ كلّ سرٍّ لا يُقرأ نجاحاً', () => {
    withEnv({ JWT_SECRET: undefined, JWT_SECRET_PREVIOUS: undefined }, () => {
        // الاحتياطُ التطويريُّ يبقى سرّاً واحداً — لا قائمةً فارغة تُمرّ صامتة
        assert.ok(getJwtVerifySecrets().length >= 1);
        assert.throws(() => verifyJwt(jwt.sign({ u: 'a' }, 'شيءٌ آخر')));
    });
});

test('الوسيط: ترويسةٌ ناقصةٌ أو بمخطّطٍ آخر تُرفض ٤٠١ ولا تمرّ', () => {
    const run = (authorization) => {
        let status = null, body = null, passed = false;
        const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
        authenticate({ headers: authorization === undefined ? {} : { authorization } }, res, () => { passed = true; });
        return { status, body, passed };
    };
    for (const bad of [undefined, '', 'abc', 'Basic xyz', 'Bearer', 'bearer tok']) {
        const r = run(bad);
        assert.strictEqual(r.passed, false, `مرّت ترويسةٌ لا يجوز مرورُها: ${JSON.stringify(bad)}`);
        assert.strictEqual(r.status, 401, `حالةٌ خاطئة لـ${JSON.stringify(bad)}`);
        // 🔑 تُردّ **قبل** التحقّق لا بعده: «Bearer مطلوب» لا «توكن فاسد».
        //    وبلا هذا التمييز يمرّ `Basic <أيّ شيء>` إلى مُتحقّقٍ يرفضه صدفةً،
        //    فيبدو الحارسُ قائماً وهو معطَّل.
        assert.strictEqual(r.body.error, 'Bearer token required',
            `رُدَّت ${JSON.stringify(bad)} بعد التحقّق لا قبله`);
    }
});

// الطفرةُ التي نجت أوّلاً: `catch { next() }` — كلُّ حالاتي كانت تُردّ عند
// فحص المخطّط فلا تبلغ الـcatch أصلاً. فلا بدّ من توكنٍ يعبر المخطّطَ ويسقط.
test('الوسيط: Bearer بتوكنٍ فاسد يُردّ ولا يمرّ', () => {
    withEnv({ JWT_SECRET: 'الحالي', JWT_SECRET_PREVIOUS: undefined }, () => {
        for (const tok of ['لا-توكن', jwt.sign({ u: 'x' }, 'سرٌّ آخر')]) {
            let status = null, body = null, passed = false;
            const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
            authenticate({ headers: { authorization: `Bearer ${tok}` } }, res, () => { passed = true; });
            assert.strictEqual(passed, false, 'مرّ توكنٌ فاسد إلى المسار المحميّ');
            assert.strictEqual(status, 401);
            assert.strictEqual(body.error, 'Invalid token');
        }
    });
});

test('الوسيط: توكنٌ صالح يمرّ ويُعلّق الحمولةَ على الطلب', () => {
    withEnv({ JWT_SECRET: 'الحالي', JWT_SECRET_PREVIOUS: undefined }, () => {
        const req = { headers: { authorization: `Bearer ${jwt.sign({ u: 'a' }, 'الحالي')}` } };
        let passed = false;
        authenticate(req, { status() { return this; }, json() { return this; } }, () => { passed = true; });
        assert.ok(passed, 'رُفض توكنٌ صالح');
        assert.strictEqual(req.user.u, 'a');
    });
});

// 🔑 الضمانُ يسقط بصمتٍ إن تحقّق موضعٌ واحدٌ بسرٍّ مفرد: يقبل طريقٌ ما يرفضه
// آخر أثناء التدوير. فيُمنع أيُّ تحقّقٍ خارج `utils/auth.js`.
test('لا تحقّقَ من توكنٍ يلتفّ على قائمة أسرار التدوير', () => {
    const offenders = [];
    (function walk(dir, rel = '') {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (['node_modules', 'tests', 'workspaces', 'memory', 'plugins'].includes(e.name) || e.name.startsWith('.')) continue;
            const p = path.join(dir, e.name), r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) walk(p, r);
            else if (e.name.endsWith('.js')) {
                const src = fs.readFileSync(p, 'utf8');
                // 🔴 كان الحارسُ يبحث عن `jwt.verify` بالاسم، فطفرةٌ تستورد
                //    المكتبةَ باسمٍ آخر (`jwtX`) تمرّ من تحته. القاعدةُ على
                //    المكتبة لا على الاسم: من استورد jsonwebtoken ثمّ نادى
                //    `.verify(` فهو موضعُ تحقّقٍ مهما سمّى متغيّره.
                if (/from\s*['"]jsonwebtoken['"]|require\(\s*['"]jsonwebtoken['"]/.test(src)
                    && /\.verify\s*\(/.test(src)) offenders.push(r);
            }
        }
    })(BACKEND);
    // `utils/auth.js` هو التحقّقُ نفسُه. و`agents/authAgent.js` **مولِّدُ كود**:
    // نداؤه داخل نصٍّ يُكتب في تطبيق المستخدم، لا في مصادقة جولا.
    assert.deepStrictEqual(offenders.sort(), ['agents/authAgent.js', 'utils/auth.js'],
        'موضعُ تحقّقٍ جديد يلتفّ على verifyJwt — فيَقبل طريقٌ ما يرفضه آخر أثناء التدوير');
    const gen = fs.readFileSync(path.join(BACKEND, 'agents/authAgent.js'), 'utf8');
    assert.ok(/'api\/middleware\/auth\.js':\s*`/.test(gen),
        'لم يعد نداءُ authAgent داخل قالبِ كودٍ مولَّد — فراجِع الاستثناء');
});
