// 🔐 توكن جولا بوت الموقّع: توقيع/تحقّق سليم، ورفض المزوّر.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signBotToken, verifyBotToken } from '../agents/jaolaBotToken.js';

test('توكن البوت: دورة توقيع/تحقّق تعيد الحمولة', () => {
    const t = signBotToken({ u: 'jamal', p: 'restaurant', b: 'مطعمي' });
    const claims = verifyBotToken(t);
    assert.equal(claims.u, 'jamal');
    assert.equal(claims.p, 'restaurant');
    assert.equal(claims.b, 'مطعمي');
});

test('توكن البوت: التلاعب بالحمولة يُرفض (توقيع لا يطابق)', () => {
    const t = signBotToken({ u: 'jamal', p: 'restaurant' });
    const body = t.split('.')[0];
    const tampered = Buffer.from(JSON.stringify({ u: 'attacker', p: 'other' })).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.' + t.split('.')[1];
    assert.equal(verifyBotToken(tampered), null, 'حمولة مبدّلة بتوقيع قديم → مرفوضة');
    assert.notEqual(body, ''); // sanity
});

test('توكن البوت: صيَغ فاسدة تُرفض بلا انهيار', () => {
    assert.equal(verifyBotToken(null), null);
    assert.equal(verifyBotToken(''), null);
    assert.equal(verifyBotToken('لا-نقطة-هنا'), null);
    assert.equal(verifyBotToken('body.'), null);
    assert.equal(verifyBotToken('.sig'), null);
    assert.equal(verifyBotToken('a.b'), null);
});
