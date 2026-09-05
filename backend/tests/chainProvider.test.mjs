// ⛓️ مزوّدُ السلسلة — مِفصلُ حقنٍ غرضُه الاختبار، وكان عقدُه المكتوب يناقض كودَه.
import { test } from 'node:test';
import assert from 'node:assert';
import { getProvider, _setProviderForTest } from '../services/chainProvider.js';

test('الحقنُ يفرض المزوّدَ الوهميّ', () => {
    const fake = { id: 'وهميّ' };
    _setProviderForTest(fake);
    assert.strictEqual(getProvider(), fake);
    _setProviderForTest();
});

test('العطب: `null` كان يجعل المزوّدَ null للأبد بدل إعادة الضبط', () => {
    _setProviderForTest({ id: 'وهميّ' });
    _setProviderForTest(null);                  // العقدُ المكتوب: «أو null لإعادة الضبط»
    const p = getProvider();
    assert.notStrictEqual(p, null, 'عاد null — لسُمّم كلُّ اختبارٍ بعده');
    assert.ok(p, 'مزوّدٌ حقيقيّ');
    _setProviderForTest();
});

test('بلا وسيطٍ يعيد الضبط أيضاً', () => {
    _setProviderForTest({ id: 'وهميّ' });
    _setProviderForTest();
    assert.ok(getProvider());
});

test('المزوّدُ محفوظٌ بين النداءات (memoized)', () => {
    _setProviderForTest();
    assert.strictEqual(getProvider(), getProvider());
});

test('BSC_RPC_URL يتصدّر القائمة إن ضُبط', () => {
    const prev = process.env.BSC_RPC_URL;
    process.env.BSC_RPC_URL = 'https://custom.example/rpc';
    try {
        _setProviderForTest();                  // يُبطل الكاش فيُبنى من جديد
        assert.ok(getProvider(), 'بُني مزوّدٌ بلا سقوط');
    } finally {
        if (prev === undefined) delete process.env.BSC_RPC_URL; else process.env.BSC_RPC_URL = prev;
        _setProviderForTest();
    }
});
